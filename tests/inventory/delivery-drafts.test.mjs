import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryDraftService} from '../../base44/shared/inventory/deliveryDrafts.js';
import {base44DeliveryDraftStore} from '../../base44/shared/inventory/deliveryDraftStore.js';
import {createDeliveryDraftHandler} from '../../base44/functions/deliveryDrafts/handler.js';
import {initialManualEntries,manualDeliveryLines} from '../../src/components/inventory/delivery/manualDelivery.js';
import {deliveryExamples} from '../../src/components/inventory/delivery/reviewExamples.js';

const clone=value=>structuredClone(value);
function fixture(){
    const example=deliveryExamples(),records=new Map(),config={failAfterWrite:false,failBeforeWrite:false};
    const catalog={...example.catalog,outlet:{id:example.outletId,name:'Synthetic outlet'},supplier:{id:example.supplierId,name:'Synthetic supplier'}};
    let count=0,writes=0;
    const store={verifiedAtomicWrites:true,options:async()=>({outlets:[],suppliers:[]}),
        get:async id=>clone(records.get(id)),find:async query=>clone([...records.values()].filter(row=>Object.entries(query).every(([key,value])=>row[key]===value))),
        create:async data=>{const row={...clone(data),id:`draft-${++count}`};records.set(row.id,row);return clone(row);},
        catalog:async()=>clone(catalog),
        cas:async(draft,patch)=>{
            if(config.failBeforeWrite){config.failBeforeWrite=false;throw new Error('before commit');}
            const current=records.get(draft.id);if(current.revision!==draft.revision)return false;
            records.set(draft.id,{...current,...clone(patch)});writes++;
            if(config.failAfterWrite){config.failAfterWrite=false;throw new Error('response lost');}
            return true;
        }};
    const employee={id:'employee',role:'user',data:{outlet_id:example.outletId}},admin={id:'admin',role:'admin'};
    const service=user=>createDeliveryDraftService({store,user,now:()=> '2026-10-22T00:00:00Z'});
    const input={outlet_id:example.outletId,supplier_id:example.supplierId,delivery_date:'2026-10-22',document_reference:'TEST-1',start_key:'start-key-00000001',lines:[example.lines[0],example.lines[9]]};
    return {example,catalog,records,config,store,employee,admin,service,input,writes:()=>writes,
        start:()=>service(employee).start(clone(input)),request:(draft,extra={})=>({id:draft.id,revision:draft.revision,request_id:'request-id-00000001',...extra})};
}
test('delivery draft persists source strings and recomputed review; no stock or active article is created',async()=>{
    const f=fixture(),draft=await f.start(),loaded=await f.service(f.employee).get(draft.id);
    assert.deepEqual(loaded.lines,f.input.lines);assert.equal(loaded.review.summary.matched,1);
    assert.equal(loaded.booking_enabled,true);assert.equal(f.records.size,1);assert.equal(f.writes(),0);
});
test('same start recovers a lost create response and changed start input is rejected',async()=>{
    const f=fixture(),draft=await f.start();assert.equal((await f.start()).id,draft.id);assert.equal(f.records.size,1);
    await assert.rejects(f.service(f.employee).start({...f.input,document_reference:'changed'}),{code:'START_CONTENT_CHANGED'});
});
test('existing reference at the same outlet and supplier is detected across users',async()=>{
    const f=fixture();await f.start();
    await assert.rejects(f.service(f.admin).start({...f.input,start_key:'another-start-00001',document_reference:' test-1 '}),{code:'DOCUMENT_REFERENCE_ALREADY_EXISTS'});
});
test('race-created duplicate draft or document identity prevents subsequent mutations',async()=>{
    const f=fixture(),draft=await f.start(),row=f.records.get(draft.id);
    f.records.set('duplicate',{...clone(row),id:'duplicate'});
    await assert.rejects(f.service(f.employee).save(f.request(draft,{lines:draft.lines})),{code:'DUPLICATE_DRAFT_REQUIRES_REVIEW'});
    f.records.get('duplicate').start_key='another-key-0000001';
    await assert.rejects(f.service(f.employee).save(f.request(draft,{lines:draft.lines})),{code:'DOCUMENT_REFERENCE_ALREADY_EXISTS'});
});
test('all draft reads and mutations require the actual outlet assignment, including conflicting assignments',async()=>{
    const f=fixture(),draft=await f.start();
    for(const user of [null,{id:'other',role:'user',data:{outlet_id:'other'}},{...f.employee,outlet_id:'other'}]){
        const s=f.service(user);
        await assert.rejects(s.get(draft.id));await assert.rejects(s.list(f.input.outlet_id));
        await assert.rejects(s.save(f.request(draft,{lines:draft.lines})));
    }
    assert.equal(f.writes(),0);
});
test('concurrent same draft request acknowledges one write while a competing edit cannot overwrite it',async()=>{
    const f=fixture(),draft=await f.start(),input=f.request(draft,{lines:draft.lines.map((line,i)=>i?line:{...line,purchase_quantity:'3'})});
    const s=f.service(f.employee),replies=await Promise.all([s.save(input),s.save(input)]);
    assert.equal(replies[0].revision,1);assert.equal(replies[1].revision,1);assert.equal(f.writes(),1);
    await assert.rejects(s.save({...input,request_id:'other-request-00001',lines:draft.lines}),{code:'DRAFT_CHANGED_RELOAD'});
    await assert.rejects(s.save({...input,lines:draft.lines}),{code:'REQUEST_CONTENT_CHANGED'});
});
test('lost write response recovers the stored acknowledgment; retries survive a new service instance',async()=>{
    const f=fixture(),draft=await f.start(),input=f.request(draft,{lines:draft.lines});f.config.failAfterWrite=true;
    assert.equal((await f.service(f.employee).save(input)).revision,1);
    assert.equal((await f.service(f.employee).save(input)).revision,1);assert.equal(f.writes(),1);
    const reordered=Object.fromEntries(Object.entries(input).reverse());
    assert.equal((await f.service(f.employee).save(reordered)).revision,1);
});
test('failed before commit preserves the old draft and can retry the exact operation',async()=>{
    const f=fixture(),draft=await f.start(),input=f.request(draft,{lines:draft.lines});f.config.failBeforeWrite=true;
    await assert.rejects(f.service(f.employee).save(input));assert.equal(f.records.get(draft.id).revision,0);
    assert.equal((await f.service(f.employee).save(input)).revision,1);
});
test('confirmed quantity and conversion come from the approved server offer, not the client',async()=>{
    const f=fixture(),draft=await f.start();
    const result=await f.service(f.employee).confirm(f.request(draft,{line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]}));
    assert.equal(result.draft.line_states[0].status,'confirmed');assert.equal(result.draft.line_states[0].confirmation.base_quantity,25);
    f.catalog.offers[0].base_quantity_per_purchase=8;
    assert.equal((await f.service(f.employee).get(draft.id)).line_states[0].status,'confirmation_stale');
    assert.equal(result.draft.line_states[0].confirmation.base_quantity,25);
});
test('editing a confirmed position invalidates confirmation; unedited confirmations survive',async()=>{
    const f=fixture(),draft=await f.start(),s=f.service(f.employee);
    const confirmed=(await s.confirm(f.request(draft,{line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]}))).draft;
    const changed=await s.save(f.request(confirmed,{request_id:'save-request-000001',lines:confirmed.lines.map((line,i)=>i?line:{...line,purchase_quantity:'4'})}));
    assert.equal(changed.draft.line_states[0].status,'open');
});
test('repeated source identity added later clears previous confirmation for the affected article',async()=>{
    const f=fixture(),draft=await f.start(),s=f.service(f.employee);
    const confirmed=(await s.confirm(f.request(draft,{line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]}))).draft;
    const saved=(await s.save(f.request(confirmed,{request_id:'save-request-000001',lines:[...confirmed.lines,{...confirmed.lines[0],id:'extra-line'}]}))).draft;
    assert.equal(saved.line_states[0].status,'open');assert(saved.review.lines[0].issues.includes('POSSIBLE_REPEATED_LINE'));
});
test('price and description changes require exact acknowledgement; master price remains untouched',async()=>{
    const f=fixture();f.input.lines[0].net_purchase_price='20';const draft=await f.start(),s=f.service(f.employee);
    const input=f.request(draft,{line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]});
    await assert.rejects(s.confirm(input),{code:'LINE_HINTS_NOT_ACKNOWLEDGED'});
    const reply=await s.confirm({...input,acknowledged_issues:['RECEIPT_PRICE_DIFFERS']});
    assert.equal(reply.draft.line_states[0].confirmation.net_base_unit_price,2);assert.equal(f.catalog.offers[0].net_purchase_price,15);
});
test('unknown position proposal survives reload and duplicate submission cannot create another pending proposal',async()=>{
    const f=fixture(),draft=await f.start(),s=f.service(f.employee),input=f.request(draft,{line_id:'line-10',note:'Please check supplier'});
    const saved=await s.propose(input);assert.equal(saved.draft.line_states[1].status,'proposal_pending');
    assert.equal((await s.propose(input)).revision,1);assert.equal(f.writes(),1);
    const loaded=await f.service(f.admin).get(draft.id);assert.equal(loaded.line_states[1].proposal.proposed_by,'employee');
    await assert.rejects(s.propose({...input,revision:1,request_id:'second-request-0001'}),{code:'PROPOSAL_ALREADY_PENDING'});
});
test('only admin can reject or link a proposal; rejection requires a reason and is persisted',async()=>{
    const f=fixture(),draft=await f.start(),proposed=(await f.service(f.employee).propose(f.request(draft,{line_id:'line-10',note:''}))).draft;
    const input=f.request(proposed,{request_id:'resolve-request-001',line_id:'line-10',resolution:'reject',note:'Already stocked elsewhere'});
    await assert.rejects(async()=>f.service(f.employee).resolve(input),{code:'ADMIN_REQUIRED'});
    const saved=await f.service(f.admin).resolve(input);assert.equal(saved.draft.line_states[1].status,'proposal_rejected');
    assert.equal(saved.draft.line_states[1].proposal.reviewed_by,'admin');
    await assert.rejects(async()=>f.service(f.employee).resolve(input),{code:'ADMIN_REQUIRED'});
});
test('admin can link a proposal only to a valid existing outlet offer with explicit identity confirmation',async()=>{
    const f=fixture(),draft=await f.start(),proposed=(await f.service(f.employee).propose(f.request(draft,{line_id:'line-10',note:''}))).draft;
    const input=f.request(proposed,{request_id:'resolve-request-001',line_id:'line-10',resolution:'link',note:'Supplier description checked',supplier_item_id:'offer-001'});
    await assert.rejects(f.service(f.admin).resolve(input),{code:'PRODUCT_IDENTITY_CONFIRMATION_REQUIRED'});
    const saved=await f.service(f.admin).resolve({...input,identity_confirmed:true});
    assert.equal(saved.draft.line_states[1].status,'confirmed');assert.equal(saved.draft.line_states[1].proposal.status,'linked');
    assert.equal(saved.draft.line_states[1].confirmation.base_quantity,20);
    assert.equal(saved.draft.line_states[1].review_required_before_booking,true);
    assert.deepEqual(saved.draft.line_states[0].effective_duplicate_line_ids,['line-10']);
    assert.equal(saved.draft.lines[1].supplier_article_number,'NEU-010');
    assert.equal(f.catalog.offers.length,9);
});
test('name-only offers can be explicitly confirmed without inventing supplier numbers',async()=>{
    const f=fixture();delete f.catalog.offers[0].supplier_article_number;f.input.lines[0].supplier_article_number='';
    const draft=await f.start(),s=f.service(f.employee),input=f.request(draft,{line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]});
    await assert.rejects(s.confirm(input),{code:'LINE_HINTS_NOT_ACKNOWLEDGED'});
    const result=await s.confirm({...input,acknowledged_issues:['NAME_IDENTITY_CHECK_REQUIRED']});
    assert.equal(result.draft.line_states[0].status,'confirmed');
    assert.equal(result.draft.lines[0].supplier_article_number,'');
    assert.equal(result.draft.line_states[0].confirmation.supplier_article_number,'');
    assert.equal((await s.get(draft.id)).line_states[0].status,'confirmed');
});
test('admin can explicitly link a differently named proposal to a numberless offer, keeping the source',async()=>{
    const f=fixture();delete f.catalog.offers[0].supplier_article_number;
    const draft=await f.start(),proposed=(await f.service(f.employee).propose(f.request(draft,{line_id:'line-10',note:''}))).draft;
    const result=await f.service(f.admin).resolve(f.request(proposed,{request_id:'resolve-request-001',line_id:'line-10',resolution:'link',note:'Product and pack checked',supplier_item_id:'offer-001',identity_confirmed:true}));
    assert.equal(result.draft.line_states[1].status,'confirmed');
    assert.equal(result.draft.lines[1].supplier_article_number,'NEU-010');
    assert.equal(result.draft.line_states[1].confirmation.supplier_article_number,'');
});
test('editing proposed source archives its previous proposal and returns the line to open',async()=>{
    const f=fixture(),draft=await f.start(),s=f.service(f.employee);
    const proposed=(await s.propose(f.request(draft,{line_id:'line-10',note:''}))).draft;
    const saved=await s.save(f.request(proposed,{request_id:'edit-request-000001',lines:proposed.lines.map(line=>line.id==='line-10'?{...line,original_name:'Changed name'}:line)}));
    assert.equal(saved.draft.line_states[1].status,'open');assert.equal(f.records.get(draft.id).lines[1].proposal_history[0].status,'superseded');
});
test('line shape cannot inject confirmations, roles or snapshots; removing a source line is explicit unsupported',async()=>{
    const f=fixture(),draft=await f.start(),s=f.service(f.employee);
    await assert.rejects(s.save(f.request(draft,{lines:draft.lines.map(line=>({...line,confirmed:true}))})),{code:'INVALID_REVIEW_LINE'});
    await assert.rejects(s.save(f.request(draft,{lines:[draft.lines[0]]})),{code:'DRAFT_LINE_REMOVAL_NOT_SUPPORTED'});
});
test('draft adapter never accepts unverified conditional-write results',async()=>{
    const e={DeliveryDraft:{updateMany:async()=>({updated:1})}};
    await assert.rejects(base44DeliveryDraftStore(e,{id:'admin',role:'admin'}).cas({id:'draft',outlet_id:'outlet',revision:0},{}),{code:'UNVERIFIED_DRAFT_UPDATE_RESULT'});
});
test('endpoint enforces dev environment, fresh write grant, strict input and actual authentication',async()=>{
    const f=fixture(),draft=await f.start(),config={enabled:true,user:f.employee};
    const handler=createDeliveryDraftHandler({createClientFromRequest:()=>({auth:{me:async()=>config.user},asServiceRole:{entities:{}}}),isEnabled:()=>config.enabled,storeFor:()=>f.store});
    const call=(body,env='dev')=>handler(new Request('https://test.invalid',{method:'POST',headers:{'X-Data-Env':env},body:JSON.stringify(body)}));
    assert.equal((await call({action:'get',id:draft.id},'prod')).status,503);
    assert.equal((await call({action:'get',id:draft.id,role:'admin'})).status,400);
    config.enabled=false;
    const readonly=await call({action:'get',id:draft.id});assert.equal(readonly.status,200);assert.equal((await readonly.json()).read_only,true);
    assert.equal((await call({action:'save',...f.request(draft,{lines:draft.lines})})).status,503);
    config.user=null;assert.equal((await call({action:'get',id:draft.id})).status,401);
});


test('manual supplier catalog returns only active linked articles and approved distinct usable purchase units',async()=>{
 const f=fixture();f.catalog.items[1].is_active=false;f.catalog.items[2].supplier_id='foreign';
 f.catalog.offers[3].status='archived';f.catalog.offers[4].base_quantity_per_purchase=0;
 f.catalog.offers.push({...f.catalog.offers[0],id:'offer-single',purchase_unit_code:'ST',purchase_unit_label:'Einzelpackung',base_quantity_per_purchase:1,net_purchase_price:1.5});
 const rows=await f.service(f.employee).articles({outlet_id:f.input.outlet_id,supplier_id:f.input.supplier_id});
 assert(!rows.some(a=>['item-002','item-003'].includes(a.id)));
 assert.equal(rows.find(a=>a.id==='item-004').offers.length,0);
 assert.equal(rows.find(a=>a.id==='item-005').offers[0].available,false);
 assert.equal(rows.find(a=>a.id==='item-001').offers.length,2);
 assert.equal(rows.find(a=>a.id==='item-001').offers[1].net_purchase_price,1.5);
 await assert.rejects(f.service(f.employee).articles({outlet_id:'foreign',supplier_id:f.input.supplier_id}),{code:'OUTLET_FORBIDDEN'});
 assert.equal(f.writes(),0);assert.equal(f.records.size,0);
});
test('manual quantities preserve exact stored identities and selected packaging; blank and zero rows never produce delivery positions',async()=>{
 const f=fixture(),rows=await f.service(f.employee).articles({outlet_id:f.input.outlet_id,supplier_id:f.input.supplier_id}),entries=initialManualEntries(rows);
 entries['item-001'].quantity='2,5';entries['item-002'].quantity='0';
 const lines=manualDeliveryLines(rows,entries,()=> 'manual-line-1');
 assert.deepEqual(lines,[{...f.example.lines[0],id:'manual-line-1'}]);
 const draft=await f.service(f.employee).start({...f.input,lines});
 assert.equal(draft.review.lines[0].base_quantity,25);assert.equal(draft.line_states[0].status,'open');assert.equal(draft.lines.length,1);
 for(const quantity of ['-1','1e2','1,2345678','NaN']){entries['item-001'].quantity=quantity;assert.throws(()=>manualDeliveryLines(rows,entries),/gültige Liefermenge/);}
 entries['item-001'].quantity='1';entries['item-001'].price='';assert.throws(()=>manualDeliveryLines(rows,entries),/Nettopreis/);
 entries['item-001'].price='15';entries['item-001'].offer_id='foreign';assert.throws(()=>manualDeliveryLines(rows,entries),/gültiges Gebinde/);
 assert.throws(()=>manualDeliveryLines(rows,{}),/mindestens einem Artikel/);
});
test('only admin may reversibly discard an entirely unbooked draft, preserving evidence and blocking old links and bookings',async()=>{
 const f=fixture(),draft=await f.start(),req=f.request(draft),admin=f.service(f.admin);
 await assert.rejects(async()=>f.service(f.employee).discard(req),{code:'ADMIN_REQUIRED'});
 const reply=await admin.discard(req);
 assert(reply.draft.discarded_at);assert.equal(reply.draft.read_only,true);assert.equal(reply.draft.can_discard,false);
 assert.deepEqual(f.records.get(draft.id).lines.map(l=>l.source),draft.lines);
 assert.equal((await admin.list(f.input.outlet_id)).length,0);
 assert.equal((await admin.list(f.input.outlet_id,true)).length,1);
 await assert.rejects(f.service(f.employee).list(f.input.outlet_id,true),{code:'ADMIN_REQUIRED'});
 await assert.rejects(f.service(f.employee).get(draft.id),{code:'DRAFT_DISCARDED'});
 await assert.rejects(admin.book({id:draft.id,revision:1,line_ids:['line-1']}),{code:'DRAFT_DISCARDED'});
 await assert.rejects(admin.save({...req,revision:1,request_id:'changed-request-0001',lines:draft.lines}),{code:'DRAFT_DISCARDED'});
 assert.equal((await admin.discard(req)).revision,1);assert.equal(f.writes(),1);
 const restored=await admin.restore({...req,request_id:'restore-request-0001',revision:1});
 assert.equal(restored.draft.discarded_at,'');assert.equal(restored.draft.read_only,false);
 assert.equal((await admin.list(f.input.outlet_id)).length,1);
 assert.equal((await f.service(f.employee).get(draft.id)).revision,2);
});
test('discard CAS survives lost response and concurrent save or frozen booking prevents discard',async()=>{
 const f=fixture(),draft=await f.start(),admin=f.service(f.admin);f.config.failAfterWrite=true;
 assert.equal((await admin.discard(f.request(draft))).revision,1);assert.equal(f.writes(),1);
 for(const state of ['posting','partially_booked','completed']){
  f.records.get(draft.id).discarded_at='';f.records.get(draft.id).status=state;
  await assert.rejects(admin.discard({...f.request(draft),revision:1,request_id:'other-request-000001'}));
 }
 f.records.get(draft.id).status='draft';f.records.get(draft.id).lines[0].booking_receipt={id:'already-booked'};
 await assert.rejects(admin.discard({...f.request(draft),revision:1,request_id:'other-request-000001'}),{code:'BOOKED_DRAFT_CANNOT_DISCARD'});
 assert.equal(f.writes(),1);
 const g=fixture(),d=await g.start(),s=g.service(g.admin);
 const results=await Promise.allSettled([s.discard(g.request(d)),s.save({...g.request(d),request_id:'racing-save-0000001',lines:d.lines})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(g.writes(),1);
});
test('discard frees an unbooked reference, but restore cannot collide with its replacement or resurrect an old start',async()=>{
 const f=fixture(),draft=await f.start(),admin=f.service(f.admin);await admin.discard(f.request(draft));
 await assert.rejects(f.start(),{code:'DRAFT_DISCARDED'});
 const replacement=await admin.start({...f.input,start_key:'replacement-key-00001'});
 assert.notEqual(replacement.id,draft.id);
 await assert.rejects(admin.restore({...f.request(draft),revision:1,request_id:'restore-request-0001'}),{code:'DOCUMENT_REFERENCE_ALREADY_EXISTS'});
 assert.equal(f.records.get(draft.id).revision,1);assert(f.records.get(draft.id).discarded_at);
});
