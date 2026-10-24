import {BookingError} from './quantities.js';
import {assertOutletAccess, bookStockOperation} from './stock.js';
import {evaluateCount, unitsFor, countProgress} from './counting.js';

const copy = value => structuredClone(value);
const fail = (code, status = 409) => {throw new BookingError(code, status);};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = value => typeof value === 'string' && /^[a-zA-Z0-9._-]{16,100}$/.test(value);
const countOperationId = (run, entry) => `inventory:${run.id}:${entry.article_id}:${entry.count_version}`;

export function projectRun(run) {
    return {
        id:run.id, outlet_id:run.outlet_id, outlet_name:run.outlet_name, session_date:run.session_date,
        period_type:run.period_type, status:run.status, revision:run.revision, completed_at:run.completed_at,discarded_at:run.discarded_at || '',read_only:!!run.discarded_at,
        entries:run.entries.map(entry => ({article_id:entry.article_id, article_name:entry.article_name,
            category_name:entry.category_name,...(entry.subcategory_id?{subcategory_id:entry.subcategory_id,subcategory_name:entry.subcategory_name}:{}),...(entry.category_id?{category_id:entry.category_id}:{}), unit_abbreviation:entry.unit_abbreviation,
            count_units:copy(entry.count_units), count_version:entry.count_version, values:copy(entry.values),
            status:entry.status, counted_quantity:entry.status === 'counted' ? entry.counted_quantity : null,
            ...(entry.status === 'counted' ? {last_stock:entry.last_stock} : {}),
            editable:!entry.locked && !entry.booked, booked:entry.booked === true,
            ...(entry.booking_error ? {booking_error:entry.booking_error} : {})})),
    };
}

function checkedEntries(run, submitted) {
    if (!Array.isArray(submitted) || submitted.length !== run.entries.length
        || new Set(submitted.map(entry => entry?.article_id)).size !== submitted.length) fail('INVALID_ENTRY_SET',400);
    return run.entries.map(entry => {
        const input = submitted.find(candidate => candidate?.article_id === entry.article_id);
        if (!input || Object.keys(input).some(name => !['article_id','status','values'].includes(name))
            || !['open','counted','skipped'].includes(input.status) || !input.values || Array.isArray(input.values) || typeof input.values !== 'object') fail('INVALID_ENTRY_INPUT',400);
        const units = unitsFor(entry);
        if (Object.keys(input.values).some(code => !units.some(unit => unit.code === code))) fail('INVALID_COUNT_UNIT',400);
        const values = {};
        for (const unit of units) {
            const value = input.values[unit.code];
            if (value === undefined) continue;
            if (typeof value !== 'string' || value.length > 32) fail('INVALID_COUNT_INPUT',400);
            values[unit.code] = value;
        }
        if (input.status === 'skipped' && Object.keys(values).length) fail('SKIPPED_COUNT_MUST_BE_EMPTY',400);
        const next = {...entry, status:input.status, values};
        delete next.counted_quantity;
        if (input.status === 'counted') {
            const result = evaluateCount(entry, values);
            if (result.error || result.quantity === null) fail('INVALID_CONFIRMED_COUNT',400);
            next.counted_quantity = result.quantity;
        }
        if ((entry.locked || entry.booked) && !equal([entry.status,entry.values,entry.counted_quantity], [next.status,next.values,next.counted_quantity])) fail('COUNT_ALREADY_FROZEN');
        return next;
    });
}

/** The store must supply real conditional document writes, not read-then-update. */
export function createInventoryRunService({store, user, now = () => new Date().toISOString()}) {
    if (!store.verifiedAtomicWrites) fail('ATOMIC_WRITES_NOT_VERIFIED',503);
    const canDiscard=run=>run.status==='draft' && !run.entries.some(entry=>entry.booked || entry.locked) && !run.discarded_at;
    const project=run=>({...projectRun(run),is_admin:user?.role==='admin',can_discard:user?.role==='admin' && canDiscard(run)});
    const load = async (id,{includeDiscarded=false}={}) => {
        if (typeof id !== 'string' || !id || id.length > 100) fail('RUN_ID_REQUIRED',400);
        const run = await store.getRun(id);
        if (!run) fail('RUN_NOT_FOUND',404);
        assertOutletAccess(user, run.outlet_id);
        if (!Number.isSafeInteger(run.revision) || !Array.isArray(run.request_receipts) || !Array.isArray(run.entries)) fail('RUN_NOT_INITIALIZED');
        if(run.discarded_at && !includeDiscarded)fail('RUN_DISCARDED');
        return run;
    };
    const priorRequest = (run, id, fingerprint) => {
        const receipts = run.request_receipts.filter(receipt => receipt.request_id === id);
        if (receipts.length > 1) fail('DUPLICATE_REQUEST_RECEIPT');
        if (receipts[0] && receipts[0].fingerprint !== fingerprint) fail('REQUEST_CONTENT_CHANGED');
        return receipts[0];
    };
    const acknowledge = (run, receipt) => ({request_id:receipt.request_id, revision:receipt.revision, run:project(run)});
    const conditionalRequest = async (run, requestId, expectedRevision, fingerprint, patch) => {
        if (run.revision !== expectedRevision) fail('RUN_CHANGED_RELOAD');
        if (run.request_receipts.length >= 2000) fail('DRAFT_REQUEST_LIMIT');
        const receipt = {request_id:requestId, fingerprint, revision:run.revision + 1};
        const next = {...patch, revision:run.revision + 1, request_receipts:[...run.request_receipts,receipt]};
        try {
            if (await store.casRun(run,next)) return acknowledge({...run,...next},receipt);
        } catch (error) {
            const observed = await load(run.id,{includeDiscarded:true});
            const recovered = priorRequest(observed,requestId,fingerprint);
            if (recovered) return acknowledge(observed,recovered);
            throw error;
        }
        const observed = await load(run.id,{includeDiscarded:true});
        const recovered = priorRequest(observed,requestId,fingerprint);
        if (recovered) return acknowledge(observed,recovered);
        fail('RUN_CHANGED_RELOAD');
    };
    const internalUpdate = async (id, update) => {
        for (let attempt=0; attempt<12; attempt++) {
            const run=await load(id);
            const patch=update(run);
            if (!patch) return run;
            if (await store.casRun(run,{...patch,revision:run.revision+1})) return {...run,...patch,revision:run.revision+1};
        }
        fail('RUN_CONCURRENT_RETRY');
    };
    return {
        async start({outlet_id,period_type,session_date,start_key}) {
            assertOutletAccess(user,outlet_id);
            if (!key(start_key) || !['weekly','monthly','yearly','adhoc'].includes(period_type)
                || typeof session_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(session_date)
                || !Number.isFinite(Date.parse(session_date)) || new Date(session_date).toISOString().slice(0,10) !== session_date) fail('INVALID_START_INPUT',400);
            const fingerprint=JSON.stringify({outlet_id,period_type,session_date});
            const existing=await store.findRuns({outlet_id,start_key,actor_id:user.id});
            if (existing.length > 1) fail('DUPLICATE_START_REQUIRES_REVIEW');
            if (existing.length) {
                if (existing[0].start_fingerprint !== fingerprint) fail('START_CONTENT_CHANGED');
                if(existing[0].discarded_at)fail('RUN_DISCARDED');
                return project(existing[0]);
            }
            const snapshot=await store.snapshot(outlet_id,period_type);
            if (!snapshot.entries.length) fail('NO_ARTICLES_FOR_INTERVAL',400);
            if (new Set(snapshot.entries.map(entry=>entry.article_id)).size !== snapshot.entries.length) fail('DUPLICATE_ARTICLE_REFERENCE');
            for (const entry of snapshot.entries) unitsFor(entry);
            const run=await store.createRun({outlet_id,outlet_name:snapshot.outlet_name,period_type,session_date,start_key,
                start_fingerprint:fingerprint,actor_id:user.id,status:'draft',revision:0,request_receipts:[],
                entries:snapshot.entries.map(entry=>({...entry,status:'open',values:{},count_version:0,locked:false,booked:false}))});
            const duplicates=await store.findRuns({outlet_id,start_key,actor_id:user.id});
            if (duplicates.length !== 1) fail('DUPLICATE_START_REQUIRES_REVIEW');
            return project(run);
        },
        async list(outletId,includeDiscarded=false) {
            assertOutletAccess(user,outletId);
            if(includeDiscarded && user?.role!=='admin')fail('ADMIN_REQUIRED',403);
            return (await store.findRuns({outlet_id:outletId})).filter(run=>includeDiscarded || !run.discarded_at).map(run=>({id:run.id,session_date:run.session_date,period_type:run.period_type,status:run.status,revision:run.revision,discarded_at:run.discarded_at || '',can_discard:user?.role==='admin' && canDiscard(run)}));
        },
        async get(id) {const run=await load(id,{includeDiscarded:true});if(run.discarded_at && user?.role!=='admin')fail('RUN_DISCARDED');return project(run);},
        async lifecycle(action,{id,request_id,revision}) {
            if(user?.role!=='admin')fail('ADMIN_REQUIRED',403);
            if(!['discard','restore'].includes(action) || !key(request_id) || !Number.isSafeInteger(revision) || revision<0)fail('INVALID_SAVE_REQUEST',400);
            const run=await load(id,{includeDiscarded:true}),fingerprint=JSON.stringify({action,revision});
            const prior=priorRequest(run,request_id,fingerprint);if(prior)return acknowledge(run,prior);
            if(action==='discard' && !canDiscard(run))fail('BOOKED_RUN_CANNOT_DISCARD');
            if(action==='restore' && !run.discarded_at)fail('RUN_NOT_DISCARDED');
            return conditionalRequest(run,request_id,revision,fingerprint,{discarded_at:action==='discard'?now():'',discarded_by:action==='discard'?user.id:''});
        },
        async save({id,request_id,revision,entries}) {
            if (!key(request_id) || !Number.isSafeInteger(revision) || revision < 0) fail('INVALID_SAVE_REQUEST',400);
            const run=await load(id);
            // Preserve input strings but sort unit keys against the server snapshot for deterministic retries.
            const cleaned=checkedEntries({...run,entries:run.entries.map(entry=>({...entry,locked:false,booked:false}))},entries);
            const fingerprint=JSON.stringify({action:'save',revision,entries:cleaned.map(entry=>({article_id:entry.article_id,status:entry.status,values:entry.values}))});
            const prior=priorRequest(run,request_id,fingerprint);
            if (prior) return acknowledge(run,prior);
            if (!['draft','resolving'].includes(run.status)) fail('RUN_ALREADY_FROZEN');
            return conditionalRequest(run,request_id,revision,fingerprint,{entries:checkedEntries(run,entries)});
        },
        async finalize({id,revision}) {
            let run=await load(id);
            if (run.status === 'completed') return project(run);
            const identities=await store.findRuns({outlet_id:run.outlet_id,start_key:run.start_key,actor_id:run.actor_id});
            if (identities.length !== 1 || identities[0].id !== id) fail('DUPLICATE_START_REQUIRES_REVIEW');
            if (['draft','resolving'].includes(run.status)) {
                if (run.revision !== revision) fail('RUN_CHANGED_RELOAD');
                if (!countProgress(run.entries).canComplete) fail('OPEN_COUNTS_REMAIN',400);
                const patch={status:'posting',entries:run.entries.map(entry=>({...entry,locked:true})),revision:run.revision+1};
                if (!await store.casRun(run,patch)) {
                    run=await load(id);
                    if (run.status !== 'posting' && run.status !== 'completed') fail('RUN_CHANGED_RELOAD');
                } else run={...run,...patch};
            }
            if (run.status === 'completed') return project(run);
            if (run.status !== 'posting') fail('RUN_NOT_POSTING');
            for (const frozen of run.entries) {
                const current=await load(id);
                if (current.status !== 'posting') return project(current);
                const entry=current.entries.find(candidate=>candidate.article_id === frozen.article_id);
                if (entry.booked || entry.status === 'skipped' || entry.count_version !== frozen.count_version) continue;
                try {
                    await store.assertEntry(entry,current.outlet_id);
                    const result=await bookStockOperation({store:store.stocks,user,stockId:entry.stock_id,now,
                        operation:{id:countOperationId(current,entry),kind:'inventory',outlet_id:current.outlet_id,
                            outlet_item_id:entry.article_id,global_item_id:entry.global_item_id,unit_abbreviation:entry.unit_abbreviation,
                            quantity:entry.counted_quantity,expected_revision:entry.stock_revision,
                            source:{document_id:id,line_id:entry.article_id,count_version:entry.count_version,
                                net_base_unit_price:entry.net_base_unit_price,count_units:entry.count_units,values:entry.values}}});
                    await internalUpdate(id,latest=>{
                        const actual=latest.entries.find(candidate=>candidate.article_id === entry.article_id);
                        if (actual.count_version !== entry.count_version || actual.booked) return null;
                        return {entries:latest.entries.map(candidate=>candidate.article_id === entry.article_id
                            ? {...candidate,booked:true,booking_operation_id:result.receipt.operation_id,booked_at:result.receipt.booked_at,booking_error:''} : candidate)};
                    });
                } catch (error) {
                    await internalUpdate(id,latest=>{
                        const actual=latest.entries.find(candidate=>candidate.article_id === entry.article_id);
                        if (actual.booked || actual.count_version !== entry.count_version) return null;
                        return {entries:latest.entries.map(candidate=>candidate.article_id === entry.article_id
                            ? {...candidate,booking_error:error instanceof BookingError ? error.code : 'BOOKING_RETRY_REQUIRED'} : candidate)};
                    });
                }
            }
            run=await internalUpdate(id,latest=>latest.status === 'posting' && latest.entries.every(entry=>entry.booked || entry.status === 'skipped')
                ? {status:'completed',completed_at:now(),completed_by:user.id} : null);
            return project(run);
        },
        async reopen({id,article_id,request_id,revision}) {
            if (!key(request_id) || !Number.isSafeInteger(revision)) fail('INVALID_RECOUNT_REQUEST',400);
            const run=await load(id);
            const fingerprint=JSON.stringify({action:'reopen',article_id,revision});
            const prior=priorRequest(run,request_id,fingerprint);
            if (prior) return acknowledge(run,prior);
            if (run.revision !== revision) fail('RUN_CHANGED_RELOAD');
            if (!['posting','resolving'].includes(run.status)) fail('RUN_NOT_FROZEN');
            const entry=run.entries.find(candidate=>candidate.article_id === article_id);
            if (!entry || entry.booked || !entry.locked || entry.status === 'skipped') fail('ENTRY_NOT_RECOUNTABLE');
            await store.assertEntry(entry,run.outlet_id);
            const stock=await store.stocks.get(entry.stock_id);
            if (stock.booking_journal.some(receipt=>receipt.operation_id === countOperationId(run,entry))) fail('ENTRY_ALREADY_BOOKED_RETRY_FINALIZE');
            const fenceId=`inventory-fence:${id}:${article_id}:${request_id}`;
            const previous=stock.booking_journal.find(receipt=>receipt.operation_id === fenceId);
            if (previous && (previous.kind !== 'inventory_fence' || previous.source_document_id !== id || previous.source_line_id !== article_id)) fail('FENCE_REFERENCE_MISMATCH');
            const receipt=previous || (await bookStockOperation({store:store.stocks,user,stockId:entry.stock_id,now,
                operation:{id:fenceId,kind:'inventory_fence',outlet_id:run.outlet_id,outlet_item_id:article_id,
                    global_item_id:entry.global_item_id,unit_abbreviation:entry.unit_abbreviation,quantity:0,
                    expected_revision:stock.revision,source:{document_id:id,line_id:article_id,request_id}}})).receipt;
            const next={...entry,status:'open',values:{},locked:false,booking_error:'',count_version:entry.count_version+1,
                stock_revision:receipt.revision,last_stock:receipt.after_quantity};
            delete next.counted_quantity;
            return conditionalRequest(run,request_id,revision,fingerprint,{status:'resolving',entries:run.entries.map(candidate=>candidate.article_id === article_id ? next : candidate)});
        },
    };
}
