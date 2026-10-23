import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogImportService,base44CatalogImportStore,importTables} from '../../base44/shared/inventory/catalogImport.js';
import {createDeliveryScanService} from '../../base44/shared/inventory/deliveryScan.js';
import {base44DeliveryScanStore} from '../../base44/shared/inventory/deliveryScanStore.js';
import {createDeliveryDraftService} from '../../base44/shared/inventory/deliveryDrafts.js';
import {base44DeliveryDraftStore} from '../../base44/shared/inventory/deliveryDraftStore.js';
import {createInventoryRunService} from '../../base44/shared/inventory/runs.js';
import {base44RunStore} from '../../base44/shared/inventory/runStore.js';
import {adminStore,createCatalogAdminService} from '../../base44/shared/inventory/catalogAdmin.js';
import {readAdminHistory,historyCsv} from '../../base44/shared/inventory/adminHistory.js';

const copy=v=>structuredClone(v);
/** Real persistence adapters against an in-memory entity API. This does not emulate Base44 login or OCR. */
function entities(){
 let id=0;const tables=new Map();
 const match=(r,q)=>Object.entries(q).every(([k,v])=>k==='$or'?v.some(x=>match(r,x)):v&&typeof v==='object'&&'$in'in v?v.$in.includes(r[k]):v&&typeof v==='object'&&'$exists'in v?Object.hasOwn(r,k)===v.$exists:JSON.stringify(r[k])===JSON.stringify(v));
 const e={};
 for(const name of [...importTables,'CatalogImportBatch','DeliveryDraft','DeliveryScan','InventoryRun','PriceHistory']){
  const rows=new Map();tables.set(name,rows);
  e[name]={get:async key=>copy(rows.get(key)),filter:async(q,sort,limit=501)=>copy([...rows.values()].filter(r=>match(r,q)).slice(0,limit)),
   list:async(sort,limit=501)=>copy([...rows.values()].slice(0,limit)),
   create:async data=>{const r={...copy(data),id:`${name}-${++id}`};rows.set(r.id,r);return copy(r);},
   bulkCreate:async values=>Promise.all(values.map(v=>e[name].create(v))),
   update:async(key,patch)=>{const r={...rows.get(key),...copy(patch)};rows.set(key,r);return copy(r);},
   updateMany:async(q,patch)=>{await Promise.resolve();let updated=0;for(const [key,r]of rows)if(match(r,q)){rows.set(key,{...r,...copy(patch.$set)});updated++;}return {success:true,updated,has_more:false};},
  };
 }
 return {e,tables};
}
async function fixture(){
 const {e,tables}=entities(),admin={id:'real-admin-fixture',role:'admin'};
 const articles=[{key:'milk',name:'Test milk 1 l',supplier:'Test supplier',sku:'',purchase_code:'KT',purchase_label:'10 × 1 l',factor:10,unit:'l',net_price:15,
  count_units:[{code:'pack',label:'1-l packs',base_quantity:1,whole_numbers_only:false}],receipt_units:[]},
 {key:'soup',name:'Test soup',supplier:'Test supplier',sku:'SOUP',purchase_code:'BT',purchase_label:'1.5-kg bag',factor:1.5,unit:'kg',net_price:9,
  count_units:[{code:'bag',label:'Full bags',base_quantity:1.5,whole_numbers_only:true}],receipt_units:[]}];
 const imports=createCatalogImportService({store:base44CatalogImportStore(e),user:admin,uuid:()=> 'integration-test'});
 let batch=await imports.start({key:'workflow-start-key-01',articles});while(batch.status==='ready')batch=await imports.step(batch);
 batch=await imports.verify(batch);
 const outlet=batch.outlet_id,supplier=[...tables.get('Supplier').keys()][0];
 // Shared location actor, not an individual employee account. Transport authentication is a separate acceptance test.
 const employee={id:'shared-location-session',role:'user',data:{outlet_id:outlet}};
 const drafts=createDeliveryDraftService({store:base44DeliveryDraftStore(e,employee),user:employee});
 const raw={document_kind:'delivery',supplier_name:'Test supplier',document_reference:'INTEGRATION-RECEIPT-1',delivery_date:'2026-10-22',price_basis:'net',quality:'readable',pages:1,warnings:[],
  lines:[{original_name:'Test milk 1 l',supplier_article_number:'',purchase_unit_code:'KT',purchase_quantity:'3',net_purchase_price:'16',page:1,source_text:'Test milk 1 l | 3 KT | 16.00'},
  {original_name:'Entirely unknown product',supplier_article_number:'NEW',purchase_unit_code:'PK',purchase_quantity:'1',net_purchase_price:'5',page:1,source_text:'Unknown | 1 PK | 5.00'}]};
 let reads=0;
 const scans=createDeliveryScanService({store:base44DeliveryScanStore(e,employee),user:employee,drafts,
  core:{UploadPrivateFile:async()=>({file_uri:'private/integration-only.png'}),CreateFileSignedUrl:async()=>({signed_url:'https://example.invalid/private'}),InvokeLLM:async()=>{reads++;return copy(raw);}}});
 const file=new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],'test.png',{type:'image/png'});
 let scan=await scans.upload({file,outlet_id:outlet,supplier_id:supplier});scan=await scans.analyze(scan);
 const review={document_reference:raw.document_reference,delivery_date:raw.delivery_date,document_checked:true,prices_net_checked:true,
  lines:scan.reads[0].lines.map(line=>({...Object.fromEntries(['id','original_name','supplier_article_number','purchase_unit_code','purchase_quantity','net_purchase_price'].map(k=>[k,line[k]])),checked:true}))};
 return {e,tables,admin,employee,outlet,supplier,drafts,scans,scan,review,reads:()=>reads};
}
test('shared location workflow: reviewed scan → explicit name confirmation → partial delivery → blind count → inventory finalization',async()=>{
 const f=await fixture(),before=f.tables.get('GlobalItem').size;
 assert.equal(f.reads(),2);assert.equal(f.tables.get('DeliveryDraft').size,0);
 const transferred=await f.scans.commit({id:f.scan.id,revision:f.scan.revision,review:f.review});
 let draft=await f.drafts.get(transferred.draft_id);assert.equal(draft.lines.length,2);
 assert([...f.tables.get('OutletStock').values()].every(r=>r.on_hand_quantity===0));
 const known=draft.review.lines.find(r=>r.match==='matched'),unknown=draft.review.lines.find(r=>r.match==='unknown');
 assert(known.issues.includes('NAME_IDENTITY_CHECK_REQUIRED'));assert(known.issues.includes('RECEIPT_PRICE_DIFFERS'));
 await assert.rejects(f.drafts.book({id:draft.id,revision:draft.revision,line_ids:[known.line_id]}),{code:'UNCONFIRMED_LINE_CANNOT_BOOK'});
 draft=(await f.drafts.confirm({id:draft.id,revision:draft.revision,request_id:'confirm-operation-001',line_id:known.line_id,
  supplier_item_id:known.candidates[0].supplier_item_id,acknowledged_issues:known.issues})).draft;
 draft=(await f.drafts.propose({id:draft.id,revision:draft.revision,request_id:'proposal-operation-01',line_id:unknown.line_id,note:'Admin should check this product'})).draft;
 await assert.rejects(async()=>f.drafts.resolve({id:draft.id,revision:draft.revision}),{code:'ADMIN_REQUIRED'});
 const booking={id:draft.id,revision:draft.revision,line_ids:[known.line_id]};
 draft=await f.drafts.book(booking);assert.equal(draft.status,'partially_booked');
 assert.equal(draft.line_states.find(r=>r.line_id===unknown.line_id).status,'proposal_pending');
 assert.equal(f.tables.get('GlobalItem').size,before);
 const milk=[...f.tables.get('OutletStock').values()].find(r=>r.unit_abbreviation==='l');
 assert.equal(milk.on_hand_quantity,30);assert.equal(milk.booking_journal.length,1);
 const item=f.tables.get('OutletItem').get(milk.outlet_item_id);assert.equal(item.net_purchase_price,1.5);
 const runs=createInventoryRunService({store:base44RunStore(f.e),user:f.employee});
 let run=await runs.start({outlet_id:f.outlet,period_type:'monthly',session_date:'2026-10-22',start_key:'integration-count-001'});
 assert.equal(run.entries.length,2);assert(run.entries.every(r=>!Object.hasOwn(r,'last_stock')));
 await assert.rejects(runs.finalize({id:run.id,revision:run.revision}),{code:'OPEN_COUNTS_REMAIN'});
 run=(await runs.save({id:run.id,revision:run.revision,request_id:'count-save-request-01',entries:run.entries.map(r=>({article_id:r.article_id,
  status:r.article_id===milk.outlet_item_id?'counted':'skipped',values:r.article_id===milk.outlet_item_id?{pack:'25'}:{}}))})).run;
 assert.equal(run.entries.find(r=>r.article_id===milk.outlet_item_id).last_stock,30);
 run=await runs.finalize({id:run.id,revision:run.revision});assert.equal(run.status,'completed');
 assert.equal(f.tables.get('OutletStock').get(milk.id).on_hand_quantity,25);
 await f.drafts.book(booking);await runs.finalize({id:run.id,revision:run.revision});
 assert.equal(f.tables.get('OutletStock').get(milk.id).on_hand_quantity,25);
 assert.equal(f.tables.get('OutletStock').get(milk.id).booking_journal.length,2);
});
test('the same shared actor cannot use another location during scan, delivery or inventory access',async()=>{
 const f=await fixture(),transferred=await f.scans.commit({id:f.scan.id,revision:f.scan.revision,review:f.review});
 const other={id:'other-shared-session',role:'user',data:{outlet_id:'foreign-outlet'}};
 const drafts=createDeliveryDraftService({store:base44DeliveryDraftStore(f.e,other),user:other});
 const runs=createInventoryRunService({store:base44RunStore(f.e),user:other});
 const scans=createDeliveryScanService({store:base44DeliveryScanStore(f.e,other),user:other,core:{},drafts});
 await assert.rejects(drafts.get(transferred.draft_id),{code:'OUTLET_FORBIDDEN'});
 await assert.rejects(scans.get(f.scan.id),{code:'OUTLET_FORBIDDEN'});
 await assert.rejects(runs.start({outlet_id:f.outlet,period_type:'monthly',session_date:'2026-10-22',start_key:'foreign-count-key-01'}),{code:'OUTLET_FORBIDDEN'});
 assert([...f.tables.get('OutletStock').values()].every(r=>r.on_hand_quantity===0));
});


test('admin creates a proposed article through the real graph adapter; employee books it and its inventory reaches persisted CSV history',async()=>{
 const f=await fixture(),transferred=await f.scans.commit({id:f.scan.id,revision:f.scan.revision,review:f.review});
 let draft=await f.drafts.get(transferred.draft_id);const unknown=draft.review.lines.find(r=>r.match==='unknown');
 draft=(await f.drafts.propose({id:draft.id,revision:draft.revision,request_id:'new-article-proposal-001',line_id:unknown.line_id,note:'Synthetic article proposal'})).draft;
 const catalog=createCatalogAdminService({store:adminStore(f.e),user:f.admin});
 let op=await catalog.start({outlet_id:f.outlet,request_id:'new-article-create-0001',articles:[{name:'Entirely unknown product',supplier:'Test supplier',category:'Synthetic groceries',unit:'kg',sku:'NEW',purchase_code:'PK',purchase_label:'1 kg pack',factor:1,net_price:5,count_units:[{code:'kg',label:'kg',base_quantity:1,whole_numbers_only:false}],receipt_units:[],inventory_intervals:['monthly','yearly'],is_active:true}]});
 for(let i=0;i<50&&op.operation.status!=='completed';i++)op=await catalog.step({outlet_id:f.outlet,request_id:op.operation.request_id,revision:op.revision});
 assert.equal(op.operation.status,'completed');
 const offer=op.operation.results.find(r=>r.key==='article:0:offer:0');
 const adminDrafts=createDeliveryDraftService({store:base44DeliveryDraftStore(f.e,f.admin),user:f.admin});
 draft=(await adminDrafts.resolve({id:draft.id,revision:draft.revision,request_id:'new-article-resolve-001',line_id:unknown.line_id,resolution:'link',note:'Product, unit and conversion explicitly reviewed',supplier_item_id:offer.id,identity_confirmed:true})).draft;
 const selected={id:draft.id,revision:draft.revision,line_ids:[unknown.line_id]};draft=await f.drafts.book(selected);
 assert.equal(draft.status,'partially_booked');await f.drafts.book(selected);
 const stock=[...f.tables.get('OutletStock').values()].find(s=>s.outlet_item_id===draft.line_states.find(s=>s.line_id===unknown.line_id).confirmation.outlet_item_id);
 assert.equal(stock.on_hand_quantity,1);assert.equal(stock.booking_journal.length,1);
 const runs=createInventoryRunService({store:base44RunStore(f.e),user:f.employee});
 let run=await runs.start({outlet_id:f.outlet,period_type:'monthly',session_date:'2026-10-23',start_key:'new-article-inventory-001'});
 run=(await runs.save({id:run.id,revision:run.revision,request_id:'new-article-count-save-01',entries:run.entries.map(r=>({article_id:r.article_id,status:r.article_id===stock.outlet_item_id?'counted':'skipped',values:r.article_id===stock.outlet_item_id?{kg:'0.75'}:{}}))})).run;
 run=await runs.finalize({id:run.id,revision:run.revision});assert.equal(run.status,'completed');
 const history=await readAdminHistory(f.e,f.outlet),csv=historyCsv(history,run.id);
 assert(csv.includes('Entirely unknown product'));assert(csv.includes('0,75'));assert(csv.includes('3,75'));assert.equal(f.tables.get('OutletStock').get(stock.id).on_hand_quantity,0.75);
});
