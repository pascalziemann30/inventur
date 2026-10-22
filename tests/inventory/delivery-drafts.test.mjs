import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryDraftService} from '../../base44/shared/inventory/deliveryDrafts.js';
import {base44DeliveryDraftStore} from '../../base44/shared/inventory/deliveryDraftStore.js';
import {createDeliveryDraftHandler} from '../../base44/functions/deliveryDrafts/handler.js';
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
