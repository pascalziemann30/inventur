import {BookingError,toBaseQuantity,baseUnitPrice} from './quantities.js';
import {assertOutletAccess,bookStockOperation} from './stock.js';
import {claimDeliveryReference} from './deliveryRegistry.js';
import {reviewDeliveryLines} from './deliveryReview.js';

const fail=(code,status=409)=>{throw new BookingError(code,status);};
const copy=value=>structuredClone(value);
const token=value=>typeof value === 'string' && /^[a-zA-Z0-9._-]{16,100}$/.test(value);
const eq=(a,b)=>JSON.stringify(a) === JSON.stringify(b);
const stable=value=>Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
const lineFields=['id','original_name','supplier_article_number','purchase_unit_code','purchase_quantity','net_purchase_price'];
const acknowledgeable=['DESCRIPTION_CHECK_REQUIRED','RECEIPT_PRICE_DIFFERS','POSSIBLE_REPEATED_LINE'];
const sourceLines=draft=>draft.lines.map(line=>line.source);
const review=(draft,catalog)=>reviewDeliveryLines({lines:sourceLines(draft),catalog,outletId:draft.outlet_id,supplierId:draft.supplier_id});

function cleanLines(lines) {
    if (!Array.isArray(lines) || !lines.length || lines.length > 100) fail('DELIVERY_REVIEW_LINE_LIMIT',400);
    return lines.map(line=>{
        if (!line || typeof line !== 'object' || Array.isArray(line) || Object.keys(line).some(key=>!lineFields.includes(key))) fail('INVALID_REVIEW_LINE',400);
        const result={};
        for (const field of lineFields) {
            const value=line[field] ?? '';
            if (typeof value !== 'string' || value.length > (field === 'original_name' ? 300 : 100)) fail('INVALID_REVIEW_LINE',400);
            result[field]=value;
        }
        return result;
    });
}

function snapshot(offer,candidate,line) {
    return {supplier_item_id:offer.id,global_item_id:offer.global_item_id,outlet_item_id:candidate.outlet_item_id,
        supplier_article_number:offer.supplier_article_number,purchase_unit_code:offer.purchase_unit_code,
        offer_revision:offer.revision,base_quantity_per_purchase:offer.base_quantity_per_purchase,
        unit_abbreviation:offer.unit_abbreviation,source:copy(line),
        base_quantity:toBaseQuantity(line.purchase_quantity,offer.base_quantity_per_purchase),
        net_base_unit_price:baseUnitPrice(line.net_purchase_price,offer.base_quantity_per_purchase)};
}

function candidateFor(draft,line,offerId,catalog) {
    const offer=catalog.offers.find(offer=>offer.id === offerId);
    if (!offer) fail('OFFER_NOT_AVAILABLE');
    // Admin linkage must still validate approved offer, outlet, unit, conversion, quantity and receipt price.
    const effective={...line,supplier_article_number:offer.supplier_article_number,purchase_unit_code:offer.purchase_unit_code};
    const diagnosis=reviewDeliveryLines({lines:[effective],catalog,outletId:draft.outlet_id,supplierId:draft.supplier_id}).lines[0];
    if (diagnosis.match !== 'matched' || diagnosis.issues.some(issue=>!acknowledgeable.includes(issue))) fail('LINE_NOT_CONFIRMABLE');
    return {offer,candidate:diagnosis.candidates[0]};
}

function confirmationCurrent(draft,line,catalog) {
    if (!line.confirmation || !eq(line.confirmation.source,line.source)) return false;
    try {
        const {offer,candidate}=candidateFor(draft,line.source,line.confirmation.supplier_item_id,catalog);
        const current=snapshot(offer,candidate,line.source);
        return Object.keys(current).every(key=>eq(current[key],line.confirmation[key]));
    } catch {return false;}
}

export function createDeliveryDraftService({store,user,now=()=>new Date().toISOString()}) {
    if (!store.verifiedAtomicWrites) fail('ATOMIC_WRITES_NOT_VERIFIED',503);
    const load=async id=>{
        if (typeof id !== 'string' || !id || id.length > 100) fail('DRAFT_ID_REQUIRED',400);
        const draft=await store.get(id);
        if (!draft) fail('DRAFT_NOT_FOUND',404);
        assertOutletAccess(user,draft.outlet_id);
        if (!Number.isSafeInteger(draft.revision) || draft.revision < 0 || !Array.isArray(draft.lines) || !Array.isArray(draft.request_receipts)) fail('DRAFT_NOT_INITIALIZED');
        return draft;
    };
    const project=async draft=>{
        const catalog=await store.catalog(draft.outlet_id,draft.supplier_id);
        const diagnosis=review(draft,catalog);
        const states=draft.lines.map(line=>({line_id:line.source.id,
            status:line.booking_receipt ? 'booked' : line.confirmation ? confirmationCurrent(draft,line,catalog) ? 'confirmed' : 'confirmation_stale'
                : line.proposal?.status === 'pending' ? 'proposal_pending' : line.proposal?.status === 'rejected' ? 'proposal_rejected' : 'open',
            confirmation:line.confirmation ? copy(line.confirmation) : null,proposal:line.proposal ? copy(line.proposal) : null,
            booking_receipt:line.booking_receipt ? copy(line.booking_receipt) : null,booking_error:line.booking_error || null}));
        const effectiveTarget=line=>{
            const state=states.find(state=>state.line_id === line.source.id);
            if (['confirmed','booked'].includes(state.status)) return state.confirmation.global_item_id;
            const found=diagnosis.lines.find(row=>row.line_id === line.source.id);
            return found.match === 'matched' ? found.candidates[0]?.global_item_id : null;
        };
        for (const state of states) {
            const source=draft.lines.find(line=>line.source.id === state.line_id),target=effectiveTarget(source);
            state.effective_duplicate_line_ids=target ? draft.lines.filter(line=>line.source.id !== state.line_id && effectiveTarget(line) === target).map(line=>line.source.id) : [];
            state.review_required_before_booking=state.effective_duplicate_line_ids.length > 0;
        }
        return {id:draft.id,outlet_id:draft.outlet_id,outlet_name:catalog.outlet.name,supplier_id:draft.supplier_id,
            supplier_name:catalog.supplier.name,delivery_date:draft.delivery_date,document_reference:draft.document_reference,
            status:draft.status,revision:draft.revision,lines:copy(sourceLines(draft)),review:diagnosis,line_states:states,
            is_admin:user.role === 'admin',booking_enabled:true,posting:draft.status==='posting',
            batch_line_ids:draft.booking_batch?.entries.map(entry=>entry.line_id) || [],
            offers:catalog.offers.filter(offer=>offer.status === 'approved').map(offer=>({id:offer.id,name:offer.original_name,sku:offer.supplier_article_number,purchase_unit_code:offer.purchase_unit_code,purchase_unit_label:offer.purchase_unit_label}))};
    };
    const unique=async draft=>{
        const starts=await store.find({outlet_id:draft.outlet_id,actor_id:draft.actor_id,start_key:draft.start_key});
        if (starts.length !== 1 || starts[0].id !== draft.id) fail('DUPLICATE_DRAFT_REQUIRES_REVIEW');
        if (draft.reference_key) {
            const refs=await store.find({outlet_id:draft.outlet_id,supplier_id:draft.supplier_id,reference_key:draft.reference_key});
            if (refs.length !== 1 || refs[0].id !== draft.id) fail('DOCUMENT_REFERENCE_ALREADY_EXISTS');
        }
    };
    const ack=async(draft,receipt)=>({request_id:receipt.request_id,revision:receipt.revision,draft:await project(draft)});
    const mutate=async(action,input,change)=>{
        if (!token(input.request_id) || !Number.isSafeInteger(input.revision) || input.revision < 0) fail('INVALID_DRAFT_REQUEST',400);
        const draft=await load(input.id);
        const fingerprint=JSON.stringify(stable({action,...input}));
        const prior=record=>{
            const found=record.request_receipts.filter(item=>item.request_id === input.request_id);
            if (found.length > 1) fail('DUPLICATE_REQUEST_RECEIPT');
            if (found[0] && found[0].fingerprint !== fingerprint) fail('REQUEST_CONTENT_CHANGED');
            return found[0];
        };
        const previous=prior(draft);
        if (previous) return ack(draft,previous);
        if(['posting','completed'].includes(draft.status))fail('DRAFT_FROZEN_FOR_BOOKING');
        await unique(draft);
        if (draft.revision !== input.revision) fail('DRAFT_CHANGED_RELOAD');
        if (draft.request_receipts.length >= 1000 || draft.revision >= Number.MAX_SAFE_INTEGER) fail('DRAFT_REQUEST_LIMIT');
        const catalog=await store.catalog(draft.outlet_id,draft.supplier_id);
        const patch=await change(draft,catalog);
        const receipt={request_id:input.request_id,fingerprint,revision:draft.revision+1,actor_id:user.id,at:now()};
        const next={...patch,revision:draft.revision+1,request_receipts:[...draft.request_receipts,receipt]};
        try {
            if (await store.cas(draft,next)) return ack({...draft,...next},receipt);
        } catch(error) {
            const observed=await load(draft.id),recovered=prior(observed);
            if (recovered) return ack(observed,recovered);
            throw error;
        }
        const observed=await load(draft.id),recovered=prior(observed);
        if (recovered) return ack(observed,recovered);
        fail('DRAFT_CHANGED_RELOAD');
    };
    const entry=(draft,id)=>{
        const line=draft.lines.find(line=>line.source.id === id);
        if (!line) fail('DRAFT_LINE_NOT_FOUND',404);
        return copy(line);
    };
    const replace=(draft,line)=>({lines:draft.lines.map(current=>current.source.id === line.source.id ? line : current)});
    const editable=line=>{if(line.booking_receipt)fail('BOOKED_LINE_IMMUTABLE');};
    const updateInternal=async(id,makePatch)=>{
        for(let attempt=0;attempt<12;attempt++){
            const draft=await load(id),patch=makePatch(draft);
            if(!patch)return draft;
            if(draft.revision>=Number.MAX_SAFE_INTEGER)fail('DRAFT_REQUEST_LIMIT');
            const next={...patch,revision:draft.revision+1};
            if(await store.cas(draft,next))return {...draft,...next};
        }
        fail('DRAFT_CHANGED_RETRY_BOOKING');
    };
    return {
        options:()=>store.options(),
        async get(id) {return project(await load(id));},
        async list(outletId) {
            assertOutletAccess(user,outletId);
            return (await store.find({outlet_id:outletId})).map(draft=>({id:draft.id,delivery_date:draft.delivery_date,
                document_reference:draft.document_reference,supplier_name:draft.supplier_name,revision:draft.revision,
                status:draft.status,
                positions:draft.lines.length,pending_proposals:draft.lines.filter(line=>line.proposal?.status === 'pending').length}));
        },
        async start({outlet_id,supplier_id,delivery_date,document_reference='',start_key,lines}) {
            assertOutletAccess(user,outlet_id);
            if (!token(start_key) || typeof supplier_id !== 'string' || !supplier_id || supplier_id.length > 100
                || typeof delivery_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)
                || !Number.isFinite(Date.parse(delivery_date)) || new Date(delivery_date).toISOString().slice(0,10) !== delivery_date
                || typeof document_reference !== 'string' || document_reference.length > 100) fail('INVALID_DRAFT_START',400);
            const sources=cleanLines(lines);
            const fingerprint=JSON.stringify({outlet_id,supplier_id,delivery_date,document_reference,lines:sources});
            const existing=await store.find({outlet_id,actor_id:user.id,start_key});
            if (existing.length > 1) fail('DUPLICATE_DRAFT_REQUIRES_REVIEW');
            if (existing.length) {
                if (existing[0].start_fingerprint !== fingerprint) fail('START_CONTENT_CHANGED');
                return project(existing[0]);
            }
            const reference_key=document_reference.trim().normalize('NFKC').toUpperCase();
            if (reference_key && (await store.find({outlet_id,supplier_id,reference_key})).length) fail('DOCUMENT_REFERENCE_ALREADY_EXISTS');
            const catalog=await store.catalog(outlet_id,supplier_id);
            reviewDeliveryLines({lines:sources,catalog,outletId:outlet_id,supplierId:supplier_id});
            const draft=await store.create({outlet_id,outlet_name:catalog.outlet.name,supplier_id,supplier_name:catalog.supplier.name,
                delivery_date,document_reference,reference_key,actor_id:user.id,start_key,start_fingerprint:fingerprint,
                revision:0,status:'draft',request_receipts:[],lines:sources.map(source=>({source,proposal_history:[]}))});
            await unique(draft);
            return project(draft);
        },
        save:input=>mutate('save',input,(draft,catalog)=>{
            const sources=cleanLines(input.lines);
            reviewDeliveryLines({lines:sources,catalog,outletId:draft.outlet_id,supplierId:draft.supplier_id});
            if (draft.lines.some(line=>!sources.some(source=>source.id === line.source.id))) fail('DRAFT_LINE_REMOVAL_NOT_SUPPORTED',400);
            const changed=sources.map(source=>{
                const old=draft.lines.find(line=>line.source.id === source.id);
                if (old && eq(old.source,source)) return old;
                if(old)editable(old);
                const history=copy(old?.proposal_history || []);
                if (old?.proposal) history.push({...old.proposal,status:'superseded',superseded_by:user.id,superseded_at:now()});
                if (history.length > 20) fail('PROPOSAL_HISTORY_LIMIT');
                return {source,proposal_history:history};
            });
            // Repeating a previously confirmed article on a new/edited line invalidates both confirmations.
            const repeated=reviewDeliveryLines({lines:sources,catalog,outletId:draft.outlet_id,supplierId:draft.supplier_id}).lines;
            return {lines:changed.map(line=>{
                const before=draft.lines.find(old=>old.source.id === line.source.id);
                const oldRepeated=before ? review(draft,catalog).lines.find(old=>old.line_id === line.source.id)?.duplicate_line_ids : [];
                const newRepeated=repeated.find(row=>row.line_id === line.source.id).duplicate_line_ids;
                if (line.confirmation && !line.booking_receipt && !eq(oldRepeated,newRepeated)) {const next={...line};delete next.confirmation;return next;}
                return line;
            })};
        }),
        confirm:input=>mutate('confirm',input,(draft,catalog)=>{
            const line=entry(draft,input.line_id),diagnosis=review(draft,catalog).lines.find(row=>row.line_id === input.line_id);
            editable(line);
            if (line.proposal?.status === 'pending') fail('PROPOSAL_REVIEW_REQUIRED');
            if (diagnosis.match !== 'matched' || diagnosis.candidates[0]?.supplier_item_id !== input.supplier_item_id
                || diagnosis.issues.some(issue=>!acknowledgeable.includes(issue))) fail('LINE_NOT_CONFIRMABLE');
            if (!Array.isArray(input.acknowledged_issues) || !eq([...input.acknowledged_issues].sort(),[...diagnosis.issues].sort())) fail('LINE_HINTS_NOT_ACKNOWLEDGED',400);
            const {offer,candidate}=candidateFor(draft,line.source,input.supplier_item_id,catalog);
            line.confirmation={...snapshot(offer,candidate,line.source),confirmed_by:user.id,confirmed_at:now(),acknowledged_issues:copy(input.acknowledged_issues)};
            return replace(draft,line);
        }),
        propose:input=>mutate('propose',input,(draft,catalog)=>{
            const line=entry(draft,input.line_id),diagnosis=review(draft,catalog).lines.find(row=>row.line_id === input.line_id);
            editable(line);
            if (!['unknown','needs_assignment'].includes(diagnosis.match)) fail('PROPOSAL_NOT_REQUIRED');
            if (line.proposal?.status === 'pending') fail('PROPOSAL_ALREADY_PENDING');
            if (typeof input.note !== 'string' || input.note.length > 500) fail('INVALID_PROPOSAL_NOTE',400);
            const history=copy(line.proposal_history || []);
            if (line.proposal) history.push(copy(line.proposal));
            if (history.length > 20) fail('PROPOSAL_HISTORY_LIMIT');
            line.proposal_history=history;
            delete line.confirmation;
            line.proposal={id:`${draft.id}:${line.source.id}:${draft.revision+1}`,status:'pending',name:line.source.original_name,
                source:copy(line.source),note:input.note,proposed_by:user.id,proposed_at:now()};
            return replace(draft,line);
        }),
        resolve:input=>{
            if (user?.role !== 'admin') fail('ADMIN_REQUIRED',403);
            return mutate('resolve',input,(draft,catalog)=>{
            const line=entry(draft,input.line_id);
            editable(line);
            if (line.proposal?.status !== 'pending') fail('PROPOSAL_NOT_PENDING');
            if (!['reject','link'].includes(input.resolution) || typeof input.note !== 'string' || !input.note.trim() || input.note.length > 500) fail('INVALID_PROPOSAL_REVIEW',400);
            if (input.resolution === 'link') {
                if (input.identity_confirmed !== true) fail('PRODUCT_IDENTITY_CONFIRMATION_REQUIRED',400);
                const {offer,candidate}=candidateFor(draft,line.source,input.supplier_item_id,catalog);
                line.confirmation={...snapshot(offer,candidate,line.source),confirmed_by:user.id,confirmed_at:now(),manual_admin_link:true,review_note:input.note};
            }
            line.proposal={...line.proposal,status:input.resolution === 'link' ? 'linked' : 'rejected',reviewed_by:user.id,
                reviewed_at:now(),review_note:input.note,...(input.resolution === 'link' ? {approved_supplier_item_id:input.supplier_item_id} : {})};
            return replace(draft,line);
            });
        },
        async book({id,revision,line_ids}) {
            if(!Number.isSafeInteger(revision) || revision<0 || !Array.isArray(line_ids) || !line_ids.length || line_ids.length>100
                || line_ids.some(id=>typeof id!=='string') || new Set(line_ids).size!==line_ids.length)fail('INVALID_BOOKING_SELECTION',400);
            let draft=await load(id);
            const selected=[...line_ids].sort();
            await unique(draft);
            if(draft.status==='posting'){
                if(!eq(selected,draft.booking_batch.entries.map(entry=>entry.line_id).sort()))fail('BOOKING_BATCH_ALREADY_FROZEN');
            } else {
                if(selected.every(id=>draft.lines.some(line=>line.source.id===id && line.booking_receipt)))return project(draft);
                if(draft.status==='completed')fail('DRAFT_FROZEN_FOR_BOOKING');
                if(draft.revision!==revision)fail('DRAFT_CHANGED_RELOAD');
                const projection=await project(draft),entries=[];
                for(const lineId of selected){
                    const line=entry(draft,lineId),state=projection.line_states.find(row=>row.line_id===lineId);
                    if(line.booking_receipt)fail('SELECT_ONLY_UNBOOKED_LINES',400);
                    if(state.status!=='confirmed')fail('UNCONFIRMED_LINE_CANNOT_BOOK');
                    if(state.review_required_before_booking)fail('REPEATED_PRODUCT_REQUIRES_REVIEW');
                    const stock_id=await store.stockFor(line.confirmation,draft.outlet_id);
                    entries.push({line_id:lineId,stock_id,confirmation:copy(line.confirmation)});
                }
                await claimDeliveryReference({store:store.registry,outletId:draft.outlet_id,supplierId:draft.supplier_id,reference:draft.reference_key,draftId:draft.id,now});
                const patch={status:'posting',booking_batch:{entries,frozen_at:now(),frozen_by:user.id},revision:draft.revision+1};
                if(await store.cas(draft,patch))draft={...draft,...patch};
                else {
                    draft=await load(id);
                    if(draft.status!=='posting' || !eq(selected,draft.booking_batch.entries.map(entry=>entry.line_id).sort()))fail('DRAFT_CHANGED_RELOAD');
                }
            }
            for(const frozen of draft.booking_batch.entries){
                const current=await load(id),line=entry(current,frozen.line_id);
                if(line.booking_receipt)continue;
                if(current.status!=='posting')break;
                const c=frozen.confirmation;
                try {
                    const result=await bookStockOperation({store:store.stocks,user,stockId:frozen.stock_id,now,
                        operation:{id:`delivery-draft:${id}:${frozen.line_id}`,kind:'delivery',outlet_id:current.outlet_id,
                            outlet_item_id:c.outlet_item_id,global_item_id:c.global_item_id,unit_abbreviation:c.unit_abbreviation,quantity:c.base_quantity,
                            source:{document_id:id,line_id:frozen.line_id,supplier_item_id:c.supplier_item_id,purchase_unit_code:c.purchase_unit_code,
                                purchase_quantity:c.source.purchase_quantity,net_purchase_price:c.source.net_purchase_price,
                                conversion_revision:c.offer_revision,base_quantity_per_purchase:c.base_quantity_per_purchase,net_base_unit_price:c.net_base_unit_price}}});
                    await updateInternal(id,latest=>{
                        const target=latest.lines.find(row=>row.source.id===frozen.line_id);
                        if(target.booking_receipt)return null;
                        return {lines:latest.lines.map(row=>row.source.id===frozen.line_id?{...row,booking_receipt:copy(result.receipt),booking_error:null}:row)};
                    });
                } catch(error){
                    await updateInternal(id,latest=>({lines:latest.lines.map(row=>row.source.id===frozen.line_id && !row.booking_receipt
                        ?{...row,booking_error:error instanceof BookingError?error.code:'BOOKING_RETRY_REQUIRED'}:row)}));
                }
            }
            draft=await updateInternal(id,latest=>{
                if(latest.status!=='posting' || !latest.booking_batch.entries.every(entry=>latest.lines.some(line=>line.source.id===entry.line_id && line.booking_receipt)))return null;
                return {status:latest.lines.every(line=>line.booking_receipt)?'completed':'partially_booked',booking_batch:{entries:[]}};
            });
            return project(draft);
        },
    };
}
