import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planCatalogImport,createCatalogImportService} from '../../base44/shared/inventory/catalogImport.js';
import {createCatalogImportHandler} from '../../base44/functions/catalogImport/handler.js';
const clone=v=>structuredClone(v);
const article={key:'sample',name:'Example drink 1 l',supplier:'Example supplier',sku:'',purchase_code:'carton',purchase_label:'6 × 1 l',factor:6,unit:'l',net_price:9,
 count_units:[{code:'carton',label:'Full cartons',base_quantity:6,whole_numbers_only:true},{code:'loose',label:'Loose packs',base_quantity:1,whole_numbers_only:false}],receipt_units:[{code:'L',factor:1}]};
function fixture(){
 const batches=new Map(),records=new Map();let counter=0,writes=0,failAfter=false,reorder=false;
 const store={verifiedAtomicWrites:true,get:async id=>clone(batches.get(id)),find:async query=>clone([...batches.values()].filter(r=>Object.entries(query).every(([k,v])=>r[k]===v))),
  create:async data=>{const r={...clone(data),id:`batch-${++counter}`};batches.set(r.id,r);return clone(r);},
  cas:async(old,patch)=>{await Promise.resolve();const r=batches.get(old.id);if(r.revision!==old.revision||r.status!==old.status)return false;batches.set(old.id,{...r,...clone(patch)});return true;},
  bulkCreate:async(entity,values)=>{const created=values.map(data=>{const r={...clone(data),id:`record-${++counter}`};records.set(r.id,{entity,data:r});writes++;return clone(r);});
   if(failAfter){failAfter=false;throw new Error('lost response');}return reorder?created.reverse():created;},
  read:async(entity,id)=>{const r=records.get(id);assert.equal(r.entity,entity);return clone(r.data);},
  update:async(entity,id,data)=>{const r=records.get(id);assert.equal(r.entity,entity);r.data={...r.data,...clone(data)};},
 };
 const user={id:'admin',role:'admin'},service=createCatalogImportService({store,user,uuid:()=> 'isolated-test-tag'});
 const start=()=>service.start({key:'test-import-key-00001',articles:[clone(article)]});
 const complete=async()=>{let b=await start();while(b.status==='ready')b=await service.step(b);return b;};
 return {store,user,service,start,complete,batches,records,writes:()=>writes,lose:()=>{failAfter=true;},reverse:()=>{reorder=true;}};
}
test('import builds only a new isolated test outlet, validated article links, optional numbers and zero stocks',async()=>{
 const f=fixture(),b=await f.complete();assert.equal(b.status,'imported');assert.equal(b.counts.SupplierItem,2);
 const verified=await f.service.verify(b);assert.equal(verified.status,'verified');
 assert.equal(verified.report.all_links_valid,true);assert.equal(verified.report.zero_stocks,1);
 const offer=[...f.records.values()].find(r=>r.entity==='SupplierItem').data;assert.equal(offer.supplier_article_number,'');
 assert.equal([...f.records.values()].find(r=>r.entity==='OutletStock').data.on_hand_quantity,0);
 assert.equal([...f.records.values()].find(r=>r.entity==='Outlet').data.code,'CATALOG-TEST-isolated-test-tag');
});
test('start replay returns the same batch without creating catalog rows and changed input is rejected',async()=>{
 const f=fixture(),a=await f.start();assert.equal((await f.start()).id,a.id);assert.equal(f.writes(),0);
 await assert.rejects(f.service.start({key:'test-import-key-00001',articles:[{...article,name:'Other'}]}),{code:'IMPORT_START_CHANGED'});
});
test('client cannot inject a real outlet, existing IDs, nonzero stock or approval flags',()=>{
 for(const key of ['outlet_id','global_item_id','startStock','status'])assert.throws(()=>planCatalogImport([{...article,[key]:'forged'}],'tag'),{code:'IMPORT_ARTICLE_INVALID'});
});
test('unknown conversions, duplicate keys, ambiguous offers and fractional count-unit definitions are rejected before any writes',()=>{
 assert.throws(()=>planCatalogImport([{...article,factor:null}],'tag'));
 assert.throws(()=>planCatalogImport([article,article],'tag'),{code:'IMPORT_DUPLICATE_KEY'});
 assert.throws(()=>planCatalogImport([article,{...article,key:'other'}],'tag'),{code:'IMPORT_DUPLICATE_OFFER'});
 assert.throws(()=>planCatalogImport([{...article,count_units:[]}],'tag'));
 assert.throws(()=>planCatalogImport([{...article,receipt_units:[{code:'L',factor:0}]}],'tag'));
});
test('concurrent workers and stale replay cannot create the same phase twice',async()=>{
 const f=fixture(),b=await f.start(),replies=await Promise.allSettled([f.service.step(b),f.service.step(b)]);
 assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.writes(),1);
 await assert.rejects(f.service.step(b),{code:'IMPORT_CHANGED_RELOAD'});assert.equal(f.writes(),1);
});
test('lost bulk-create response stays blocked instead of creating duplicate records on retry',async()=>{
 const f=fixture(),b=await f.start();f.lose();await assert.rejects(f.service.step(b));assert.equal(f.writes(),1);
 const current=await f.service.get(b);assert.equal(current.status,'blocked');
 await assert.rejects(f.service.step(current),{code:'IMPORT_NOT_READY'});assert.equal(f.writes(),1);
});
test('readback detects altered quantities or broken links and never reports a verified import',async()=>{
 for(const mutate of [r=>r.data.on_hand_quantity=1,r=>r.data.global_item_id='bad']){
  const f=fixture(),b=await f.complete(),stock=[...f.records.values()].find(r=>r.entity==='OutletStock');mutate(stock);
  await assert.rejects(f.service.verify(b),{code:'IMPORT_READBACK_MISMATCH'});assert.equal((await f.service.get(b)).status,'blocked');
 }
});
test('closing a verified test deactivates only its newly created outlet and preserves records for audit',async()=>{
 const f=fixture(),b=await f.complete(),v=await f.service.verify(b),before=f.records.size;
 const closed=await f.service.close(v);assert.equal(closed.status,'closed');assert.equal(f.records.size,before);
 assert.equal((await f.store.read('Outlet',b.outlet_id)).is_active,false);
 assert([...f.records.values()].filter(r=>r.entity==='OutletStock').every(r=>r.data.on_hand_quantity===0));
});
test('response order does not determine article links',async()=>{
 const f=fixture();f.reverse();
 const b=await f.service.start({key:'another-start-key-001',articles:[article,{...article,key:'second',name:'Different drink',sku:'2'}]});
 let current=b;while(current.status==='ready')current=await f.service.step(current);
 assert.equal((await f.service.verify(current)).status,'verified');
});
test('batch ownership and admin role are checked independently of client data',async()=>{
 const f=fixture(),b=await f.start();
 assert.throws(()=>createCatalogImportService({store:f.store,user:{id:'u',role:'user'}}),{code:'ADMIN_REQUIRED'});
 const other=createCatalogImportService({store:f.store,user:{id:'different-admin',role:'admin'}});
 await assert.rejects(other.get(b),{code:'IMPORT_NOT_FOUND'});
});
test('handler requires authentication, dev data and a currently open write window; closed results remain readable',async()=>{
 const f=fixture(),b=await f.complete();let user=f.user,enabled=false,reads=0;
 const handler=createCatalogImportHandler({createClientFromRequest:()=>({auth:{me:async()=>user},asServiceRole:{entities:{}}}),isEnabled:async()=>enabled,
  storeFor:()=>{reads++;return f.store;}});
 const req=(body,env='dev')=>handler(new Request('https://example.invalid',{method:'POST',headers:{'X-Data-Env':env},body:JSON.stringify(body)}));
 assert.equal((await req({action:'step',id:b.id,revision:b.revision})).status,503);assert.equal(reads,0);
 assert.equal((await req({action:'status'},'prod')).status,503);assert.equal(reads,0);
 user={id:'employee',role:'user'};assert.equal((await req({action:'status'})).status,403);
 user=null;assert.equal((await req({action:'status'})).status,401);
 user=f.user;const response=await req({action:'get',id:b.id});assert.equal(response.status,200);assert.equal((await response.json()).read_only,true);
 enabled=true;assert.equal((await req({action:'get',id:b.id,outlet_id:'forged'})).status,400);
});
