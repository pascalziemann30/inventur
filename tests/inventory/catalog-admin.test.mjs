import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogAdminService,readAdminCatalog,definitionFor} from '../../base44/shared/inventory/catalogAdmin.js';
import {readAdminQueue,reviewPrice,priceReviewPlan,historyCsv} from '../../base44/shared/inventory/adminHistory.js';
import {createCatalogAdminHandler} from '../../base44/functions/catalogAdmin/handler.js';
const article={name:'Synthetic oat drink',supplier:'Synthetic supplier',category:'Drinks',unit:'l',sku:'',purchase_code:'KT',purchase_label:'6 × 1 l',factor:6,net_price:9,count_units:[{code:'case',label:'Karton',base_quantity:6,whole_numbers_only:false},{code:'pack',label:'Packung',base_quantity:1,whole_numbers_only:false}],receipt_units:[{code:'ST',factor:1}],inventory_intervals:['monthly','yearly'],is_active:true};
const copy=structuredClone;
function fixture(){
 const db=Object.fromEntries(['Outlet','OutletItem','OutletStock','GlobalItem','SupplierItem','Supplier','Category','Unit','PriceHistory','DeliveryDraft','InventoryRun'].map(k=>[k,[]]));db.Outlet.push({id:'outlet',name:'Synthetic outlet',type:'NORMAL',is_active:true});
 let seq=0,lost=false;const match=(r,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&'$in'in v?v.$in.includes(r[k]):JSON.stringify(r[k])===JSON.stringify(v));
 const store={get:async(t,id)=>copy(db[t].find(r=>r.id===id)),find:async(t,q={})=>copy(db[t].filter(r=>match(r,q))),
 bulkCreate:async(t,rows)=>{const r=rows.map(x=>({...copy(x),id:`generated-${++seq}`}));db[t].push(...r);if(lost){lost=false;throw Error('lost');}return copy(r.reverse());},
 cas:async(t,id,expected,patch)=>{const r=db[t].find(r=>r.id===id);if(!r||!match(r,expected))return false;Object.assign(r,copy(patch));return true;},
 casOutlet:async(old,state)=>{const o=db.Outlet[0];if((o.catalog_admin_revision||0)!==(old.catalog_admin_revision||0))return false;o.catalog_admin_revision=(o.catalog_admin_revision||0)+1;o.catalog_admin_state=copy(state);return true;}};
 const user={id:'synthetic-owner',role:'admin'},service=createCatalogAdminService({store,user,now:()=> '2026-10-23T10:00:00Z'});
 const complete=async s=>{for(let i=0;i<120&&s.operation.status!=='completed';i++)s=await service.step({outlet_id:'outlet',request_id:s.operation.request_id,revision:s.revision});assert.equal(s.operation.status,'completed');return s;};
 const e=Object.fromEntries(Object.keys(db).map(t=>[t,{get:id=>store.get(t,id),filter:q=>store.find(t,q),list:()=>store.find(t)}]));
 const start=(request_id,input=article,extra={})=>service.start({outlet_id:'outlet',request_id,articles:[input],...extra});
 return {db,store,user,service,complete,start,e,loseNext:()=>lost=true};
}
test('new article graph links real category, zero journalled stock and purchase/receipt units before activation',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-create-001'));const c=await readAdminCatalog(f.store,'outlet'),r=definitionFor(c.items[0],c);
 assert.equal(r.links_valid,true);assert.equal(r.definition.factor,6);assert.equal(r.base_price,1.5);assert.equal(f.db.SupplierItem.length,2);assert.equal(f.db.OutletItem[0].is_active,true);
 assert.deepEqual(f.db.OutletStock[0].booking_journal,[]);assert.equal(f.db.OutletStock[0].on_hand_quantity,0);assert.equal(f.db.OutletStock[0].revision,0);assert.equal(f.db.Category[0].name,'Drinks');assert.deepEqual(f.db.Outlet[0].delivery_registry,[]);
});
test('repeated keys are idempotent, changed bodies and normalized duplicates are rejected',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-create-002'));assert.equal((await f.start('synthetic-create-002')).operation.status,'completed');
 await assert.rejects(f.start('synthetic-create-002',{...article,name:'Changed'}),{code:'REQUEST_CONTENT_CHANGED'});
 await assert.rejects(f.start('synthetic-create-003',{...article,name:'SYNTHETIC oat drink'}),{code:'EXISTING_ARTICLE_REQUIRES_LINK'});assert.equal(f.db.OutletItem.length,1);
});
test('a lost create response is recovered by exact marker without another create; stale checkpoints fail',async()=>{
 const f=fixture();let s=await f.start('synthetic-lost-00001');s=await f.service.step({outlet_id:'outlet',request_id:s.operation.request_id,revision:s.revision});f.loseNext();
 await assert.rejects(f.service.step({outlet_id:'outlet',request_id:s.operation.request_id,revision:s.revision}));s=await f.service.status({outlet_id:'outlet'});assert.equal(s.operation.status,'blocked');
 const n=f.db.Supplier.length;const next=await f.service.step({outlet_id:'outlet',request_id:s.operation.request_id,revision:s.revision});assert.equal(f.db.Supplier.length,n);
 await assert.rejects(f.service.step({outlet_id:'outlet',request_id:s.operation.request_id,revision:s.revision}),{code:'CATALOG_CHANGED_RELOAD'});await f.complete(next);assert.equal(f.db.GlobalItem.length,1);
});
test('edits preserve stock journals and supplier IDs, forbid base-unit changes and allow historical deactivation',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-edit-00001'));f.db.OutletStock[0].on_hand_quantity=9;f.db.OutletStock[0].revision=2;f.db.OutletStock[0].booking_journal=[{operation_id:'historical'}];
 const current=(await f.service.list({outlet_id:'outlet'})).articles[0],ids=f.db.SupplierItem.map(o=>o.id);
 await assert.rejects(f.start('synthetic-edit-00002',{...current.definition,unit:'kg'},{expected:current.fingerprint}),{code:'BASE_UNIT_IMMUTABLE'});
 await f.complete(await f.start('synthetic-edit-00003',{...current.definition,name:'Renamed',is_active:false,net_price:12},{expected:current.fingerprint}));
 assert.equal(f.db.OutletItem[0].is_active,false);assert.equal(f.db.OutletStock[0].on_hand_quantity,9);assert.equal(f.db.OutletStock[0].revision,2);assert.equal(f.db.OutletStock[0].booking_journal.length,1);assert.deepEqual(f.db.SupplierItem.map(o=>o.id),ids);assert.equal(f.db.PriceHistory.length,1);
});
test('empty destination import reuses unique shared references, cannot overwrite a populated outlet',async()=>{
 const f=fixture();f.db.Supplier.push({id:'existing-supplier',name:article.supplier,is_active:true});f.db.Unit.push({id:'existing-unit',abbreviation:'l'});
 await f.complete(await f.start('synthetic-import-001',article,{importing:true}));assert.equal(f.db.Outlet.length,1);assert.equal(f.db.Supplier.length,1);assert.equal(f.db.Unit.length,1);
 await assert.rejects(f.start('synthetic-import-002',article,{importing:true}),{code:'IMPORT_REQUIRES_EMPTY_DESTINATION'});
});
test('staff, invalid conversions and simultaneous operations cannot open a catalog write path',async()=>{
 const f=fixture();assert.throws(()=>createCatalogAdminService({store:f.store,user:{id:'staff',role:'user'}}),{code:'ADMIN_REQUIRED'});
 await assert.rejects(f.start('synthetic-invalid-001',{...article,factor:0}));assert.equal(f.db.Outlet[0].catalog_admin_state,undefined);
 await f.start('synthetic-busy-00001');await assert.rejects(f.start('synthetic-busy-00002'),{code:'CATALOG_OPERATION_PENDING'});
});
test('price suggestion leaves master untouched until approval; approved offer prices and audit preserve receipt snapshots',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-price-0001'));const item=f.db.OutletItem[0],receipt={operation_id:'booked'},confirmation={outlet_item_id:item.id,global_item_id:item.global_item_id,net_base_unit_price:2,unit_abbreviation:'l'};
 f.db.DeliveryDraft.push({id:'draft',outlet_id:'outlet',revision:0,document_reference:'SYNTHETIC',lines:[{source:{id:'line',original_name:'Drink'},confirmation,booking_receipt:receipt}]});
 assert.equal((await readAdminQueue(f.e,'outlet')).prices.length,1);assert.equal(item.net_purchase_price,1.5);
 const context=await reviewPrice({e:f.e,store:f.store,user:f.user,outletId:'outlet',draftId:'draft',lineId:'line',decision:'approve',requestId:'synthetic-price-0002',now:()=> '2026-10-23T10:00:00Z'});
 const plan=await priceReviewPlan(context,{store:f.store,requestId:'synthetic-price-0002'});await f.complete(await f.service.startPrepared({outlet_id:'outlet',request_id:'synthetic-price-0002',plan}));
 assert.equal(item.net_purchase_price,2);assert.equal(f.db.SupplierItem[0].net_purchase_price,12);assert.deepEqual(f.db.DeliveryDraft[0].lines[0].confirmation,confirmation);assert.deepEqual(f.db.DeliveryDraft[0].lines[0].booking_receipt,receipt);assert.equal((await readAdminQueue(f.e,'outlet')).prices.length,0);
});
test('history CSV uses persisted snapshots, retains skips and escapes spreadsheet formulas',()=>{
 const csv=historyCsv({inventories:[{id:'run',date:'2026-10-23',period:'monthly',entries:[{name:'=HYPERLINK("synthetic")',status:'counted',counted_quantity:2,previous_quantity:1,base_price:3,booked:true},{name:'Skipped',status:'skipped',counted_quantity:null,previous_quantity:9,base_price:3,booked:false}]}]},'run');assert(csv.startsWith('\uFEFF'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes('ausdrücklich übersprungen'));assert(csv.includes('Inventurwert netto'));
});
test('admin handler rejects staff before privileged data access',async()=>{
 let touched=false;const handler=createCatalogAdminHandler({createClientFromRequest:()=>({auth:{me:async()=>({id:'staff',role:'user'})},get asServiceRole(){touched=true;}}),originAllowed:()=>true,defaultEnvironment:()=> 'dev'});
 const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Origin:'https://synthetic.invalid'},body:JSON.stringify({action:'list',outlet_id:'outlet'})}));assert.equal(response.status,403);assert.equal(touched,false);
});
test('production preparation uses verified global admin rights, never branch service credentials',async()=>{
 const f=fixture(),id='697f405ef1744da8ba46c99d';f.db.Outlet[0].id=id;let serviceAccess=false;
 const handler=createCatalogAdminHandler({createClientFromRequest:()=>({auth:{me:async()=>f.user},get asServiceRole(){serviceAccess=true;throw Error('branch service forbidden');}}),productionClient:()=>({auth:{me:async()=>f.user},entities:f.e}),originAllowed:()=>true,defaultEnvironment:()=> 'dev'});
 const call=action=>handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Origin:'https://synthetic.invalid','X-Data-Env':'dev'},body:JSON.stringify({action,target_environment:'prod',outlet_id:id})}));
 assert.equal((await call('list')).status,200);assert.equal((await call('queue')).status,503);assert.equal(serviceAccess,false);
});
test('production identity mismatch is rejected before catalog access',async()=>{
 const handler=createCatalogAdminHandler({createClientFromRequest:()=>({auth:{me:async()=>({id:'owner',role:'admin'})}}),productionClient:()=>({auth:{me:async()=>({id:'different',role:'admin'})},get entities(){throw Error('must not read');}}),originAllowed:()=>true,defaultEnvironment:()=> 'dev'});
 const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Origin:'https://synthetic.invalid'},body:JSON.stringify({action:'list',target_environment:'prod',outlet_id:'697f405ef1744da8ba46c99d'})}));assert.equal(response.status,403);
});
test('rejecting a price suggestion preserves all master prices and records the decision',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-reject-001'));const item=f.db.OutletItem[0];f.db.DeliveryDraft.push({id:'draft',outlet_id:'outlet',revision:0,lines:[{source:{id:'line'},confirmation:{outlet_item_id:item.id,global_item_id:item.global_item_id,net_base_unit_price:2,unit_abbreviation:'l'},booking_receipt:{operation_id:'booked'}}]});
 const context=await reviewPrice({e:f.e,store:f.store,user:f.user,outletId:'outlet',draftId:'draft',lineId:'line',decision:'reject',requestId:'synthetic-reject-002'}),plan=await priceReviewPlan(context,{store:f.store,requestId:'synthetic-reject-002'});
 await f.complete(await f.service.startPrepared({outlet_id:'outlet',request_id:'synthetic-reject-002',plan}));assert.equal(item.net_purchase_price,1.5);assert.equal(f.db.PriceHistory.length,0);assert.equal(f.db.DeliveryDraft[0].lines[0].price_review.decision,'reject');assert.equal((await readAdminQueue(f.e,'outlet')).prices.length,0);
});
test('shared metadata follows the unique existing outlet reference instead of a foreign test duplicate',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-scope-0001'));const original=f.db.Unit[0].id;
 f.db.Unit.push({id:'foreign-unit',name:'Foreign duplicate',abbreviation:'l',type:'volume'});
 f.db.Supplier.push({id:'foreign-supplier',name:article.supplier,is_active:true});
 await f.complete(await f.start('synthetic-scope-0002',{...article,name:'Second scoped drink'}));
 assert(f.db.GlobalItem.every(g=>g.unit_id===original));assert(f.db.OutletItem.every(i=>i.supplier_id!=='foreign-supplier'));
 const empty=fixture();empty.db.Unit.push({id:'one',abbreviation:'l'},{id:'two',abbreviation:'l'});
 await assert.rejects(empty.start('synthetic-scope-0003'),{code:'DUPLICATE_REFERENCE_REQUIRES_REVIEW'});
});
test('administrative choices show linked references instead of unrelated legacy metadata',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-choices-01'));
 f.db.Supplier.push({id:'unrelated-supplier',name:'Unused supplier',is_active:true});f.db.Category.push({id:'unrelated-category',name:'Unused category'});f.db.Unit.push({id:'unrelated-unit',abbreviation:'Unused unit'});
 const list=await f.service.list({outlet_id:'outlet'});assert.deepEqual(list.suppliers,[article.supplier]);assert.deepEqual(list.categories,[article.category]);assert.deepEqual(list.units,['l']);
});
test('similar names require an explicit distinction while exact duplicates remain blocked',async()=>{
 const f=fixture();await f.complete(await f.start('synthetic-near-00001'));
 await assert.rejects(f.start('synthetic-near-00002',{...article,name:'Synthetic oat drink unsweetened',sku:'OTHER'}),{code:'POSSIBLE_DUPLICATE_REVIEW_REQUIRED'});
 await f.complete(await f.start('synthetic-near-00003',{...article,name:'Synthetic oat drink unsweetened',sku:'OTHER',distinct_confirmed:true}));
 await assert.rejects(f.start('synthetic-near-00004',{...article,distinct_confirmed:true}),{code:'EXISTING_ARTICLE_REQUIRES_LINK'});
});
