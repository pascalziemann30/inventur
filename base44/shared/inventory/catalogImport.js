import {BookingError,scaledQuantity,monetaryNumber} from './quantities.js';
import {unitsFor,evaluateCount} from './counting.js';
import {offerIdentityKey} from './deliveryReview.js';

const fail=(code,status=409)=>{throw new BookingError(code,status);};
const string=(value,max=300)=>typeof value==='string' && value.trim()===value && value.length>0 && value.length<=max;
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
export const importTables=['Outlet','Supplier','Unit','Category','GlobalItem','OutletItem','SupplierItem','OutletStock'];

/** Builds a closed reference graph. Client-supplied database IDs and stock quantities are never accepted. */
export function planCatalogImport(articles,tag){
 if(!Array.isArray(articles) || !articles.length || articles.length>250 || !string(tag,80))fail('IMPORT_INPUT_INVALID',400);
 const ids=new Set(),identities=new Set();
 for(const r of articles){
  const keys=['key','name','supplier','sku','purchase_code','purchase_label','factor','unit','net_price','count_units','receipt_units'];
  if(!r || Object.keys(r).some(k=>!keys.includes(k)) || !['key','name','supplier','purchase_code','purchase_label','unit'].every(k=>string(r[k],k==='key'?100:300))
   || (r.sku!=null && (typeof r.sku!=='string'||r.sku.length>100)))fail('IMPORT_ARTICLE_INVALID',400);
  if(ids.has(r.key))fail('IMPORT_DUPLICATE_KEY');ids.add(r.key);
  if(scaledQuantity(r.factor)===0n || monetaryNumber(r.net_price)<=0)fail('IMPORT_CONVERSION_OR_PRICE_REQUIRED');
  if(!Array.isArray(r.count_units)||!r.count_units.length||r.count_units.length>8)fail('IMPORT_COUNT_UNITS_REQUIRED');
  for(const u of r.count_units){
   if(!u || Object.keys(u).some(k=>!['code','label','base_quantity','whole_numbers_only'].includes(k)) || !string(u.code,80)||!string(u.label)
    || typeof u.whole_numbers_only!=='boolean')fail('IMPORT_COUNT_UNIT_INVALID');
  }
  unitsFor({count_units:r.count_units});
  if(!Array.isArray(r.receipt_units)||r.receipt_units.length>8)fail('IMPORT_RECEIPT_UNITS_INVALID');
  const offers=[{code:r.purchase_code,factor:r.factor},...r.receipt_units];
  for(const u of offers){
   if(Object.keys(u).some(k=>!['code','factor'].includes(k))||!string(u.code,100)||scaledQuantity(u.factor)===0n)fail('IMPORT_RECEIPT_UNITS_INVALID');
   const identity=offerIdentityKey({supplier_id:r.supplier,supplier_article_number:r.sku || '',original_name:r.name,purchase_unit_code:u.code});
   if(identities.has(identity))fail('IMPORT_DUPLICATE_OFFER');identities.add(identity);
  }
 }
 const nodes=[];
 const add=(key,entity,data)=>nodes.push({key,entity,data});
 const ref=key=>({ref:key});
 add('outlet','Outlet',{name:`Kuno15 · IMPORTTEST · ${tag.slice(0,8)}`,code:`CATALOG-TEST-${tag}`,type:'NORMAL',is_active:true,delivery_registry_revision:0,delivery_registry:[]});
 const suppliers=[...new Set(articles.map(r=>r.supplier))],units=[...new Set(articles.map(r=>r.unit))];
 suppliers.forEach((name,i)=>add(`supplier:${i}`,'Supplier',{name,is_active:true,notes:`Nur Importtest ${tag}`}));
 units.forEach((unit,i)=>add(`unit:${i}`,'Unit',{name:unit,abbreviation:unit,type:unit==='kg'?'weight':unit==='l'?'volume':'count'}));
 add('category','Category',{name:`Importprüfung · ${tag.slice(0,8)}`});
 for(const r of articles)add(`global:${r.key}`,'GlobalItem',{canonical_name:r.name,unit_id:ref(`unit:${units.indexOf(r.unit)}`),unit_abbreviation:r.unit,
  category_id:ref('category'),category_name:`Importprüfung · ${tag.slice(0,8)}`,default_net_price:r.net_price/r.factor,notes:`Nur Importtest ${tag}`});
 for(const r of articles)add(`item:${r.key}`,'OutletItem',{outlet_id:ref('outlet'),outlet_name:`Kuno15 · IMPORTTEST · ${tag.slice(0,8)}`,global_item_id:ref(`global:${r.key}`),
  display_name:r.name,supplier_id:ref(`supplier:${suppliers.indexOf(r.supplier)}`),supplier_name:r.supplier,net_purchase_price:r.net_price/r.factor,
  inventory_intervals:['monthly','yearly'],count_units:r.count_units,is_active:true,is_finished_product:false,notes:`Nur Importtest ${tag}`});
 for(const r of articles){
  for(const u of [{code:r.purchase_code,factor:r.factor},...r.receipt_units])add(`offer:${r.key}:${u.code}`,'SupplierItem',{
   supplier_id:ref(`supplier:${suppliers.indexOf(r.supplier)}`),global_item_id:ref(`global:${r.key}`),supplier_article_number:r.sku || '',original_name:r.name,
   purchase_unit_code:u.code,purchase_unit_label:u.code===r.purchase_code?r.purchase_label:`Belegeinheit ${u.code}: ${u.factor} ${r.unit}`,
   base_quantity_per_purchase:u.factor,unit_abbreviation:r.unit,net_purchase_price:r.net_price/r.factor*u.factor,revision:0,status:'approved',source_reference:`Importtest ${tag}`});
 }
 for(const r of articles)add(`stock:${r.key}`,'OutletStock',{outlet_id:ref('outlet'),outlet_name:`Kuno15 · IMPORTTEST · ${tag.slice(0,8)}`,outlet_item_id:ref(`item:${r.key}`),
  global_item_id:ref(`global:${r.key}`),display_name:r.name,on_hand_quantity:0,unit_abbreviation:r.unit,revision:0,booking_journal:[]});
 return {articles,nodes,counts:Object.fromEntries(importTables.map(t=>[t,nodes.filter(n=>n.entity===t).length]))};
}
export function resolveImportNode(node,created){
 const map=new Map(created.map(r=>[r.key,r.id]));
 const resolve=value=>Array.isArray(value)?value.map(resolve):value&&typeof value==='object'?
  (Object.keys(value).length===1 && value.ref ? map.get(value.ref)||fail('IMPORT_REFERENCE_MISSING'):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v)]))):value;
 return resolve(node.data);
}
export function base44CatalogImportStore(e){
 if(typeof e.CatalogImportBatch?.updateMany!=='function')fail('IMPORT_CONDITIONAL_WRITE_UNAVAILABLE',503);
 return {verifiedAtomicWrites:true,
  get:id=>e.CatalogImportBatch.get(id),find:async query=>{
   const rows=await e.CatalogImportBatch.filter(query,'id',3);if(!Array.isArray(rows)||rows.length>1)fail('IMPORT_DUPLICATE_BATCH');return rows;
  },create:data=>e.CatalogImportBatch.create(data),
  async cas(old,patch){
   const r=await e.CatalogImportBatch.updateMany({id:old.id,revision:old.revision,status:old.status},{$set:patch});
   if(r?.success!==true||r.has_more!==false||![0,1].includes(r.updated))fail('IMPORT_CONDITIONAL_RESULT_UNVERIFIED',503);
   return r.updated===1;
  },
  bulkCreate:(entity,values)=>e[entity].bulkCreate(values),read:(entity,id)=>e[entity].get(id),update:(entity,id,data)=>e[entity].update(id,data),
 };
}
export function createCatalogImportService({store,user,uuid=()=>crypto.randomUUID()}){
 if(user?.role!=='admin')fail('ADMIN_REQUIRED',403);
 if(!store.verifiedAtomicWrites)fail('IMPORT_ATOMIC_WRITES_REQUIRED',503);
 const load=async id=>{
  if(!string(id,100))fail('IMPORT_ID_REQUIRED',400);
  const batch=await store.get(id);if(!batch||batch.actor_id!==user.id)fail('IMPORT_NOT_FOUND',404);
  return batch;
 };
 const view=b=>({id:b.id,status:b.status,revision:b.revision,completed:b.created.length,total:b.plan.nodes.length,counts:b.plan.counts,
  article_count:b.plan.articles.length,outlet_id:b.created.find(n=>n.key==='outlet')?.id || null,report:b.report || null,error:b.error || null});
 const change=async(old,patch)=>{
  const next={...patch,revision:old.revision+1};if(!await store.cas(old,next))fail('IMPORT_CHANGED_RELOAD');return {...old,...next};
 };
 const claim=async(id,revision,statuses)=>{
  const b=await load(id);if(b.revision!==revision)fail('IMPORT_CHANGED_RELOAD');
  if(!statuses.includes(b.status))fail('IMPORT_NOT_READY');return change(b,{status:'working'});
 };
 return {
  get:async({id})=>view(await load(id)),
  async start({key,articles}){
   if(!string(key,80)||!/^[a-zA-Z0-9-]{16,80}$/.test(key))fail('IMPORT_KEY_REQUIRED',400);
   // Validate before persisting anything; never accepts an existing destination outlet.
   planCatalogImport(articles,'validate');
   const found=await store.find({start_key:key,actor_id:user.id});
   if(found.length){if(!same(found[0].plan.articles,articles))fail('IMPORT_START_CHANGED');return view(found[0]);}
   const plan=planCatalogImport(articles,uuid());
   const b=await store.create({start_key:key,actor_id:user.id,status:'ready',revision:0,plan,created:[]});
   const again=await store.find({start_key:key,actor_id:user.id});
   if(again.length!==1||again[0].id!==b.id)fail('IMPORT_DUPLICATE_BATCH');return view(b);
  },
  async step({id,revision}){
   let b=await claim(id,revision,['ready']);
   try{
    const remaining=b.plan.nodes.slice(b.created.length),entity=remaining[0]?.entity;
    const nodes=remaining.filter((n,i)=>i<20&&n.entity===entity);
    if(!nodes.length)fail('IMPORT_NOTHING_TO_WRITE');
    const payloads=nodes.map(n=>resolveImportNode(n,b.created));
    const result=await store.bulkCreate(entity,payloads);
    if(!Array.isArray(result)||result.length!==nodes.length||result.some(r=>!string(r.id,100))||new Set(result.map(r=>r.id)).size!==result.length)fail('IMPORT_WRITE_RESULT_UNCERTAIN');
    // Match by payload, not response ordering; createMany may reorder records.
    const created=nodes.map((node,i)=>{
     const matches=result.filter(r=>Object.entries(payloads[i]).every(([k,v])=>same(r[k],v)));
     if(matches.length!==1)fail('IMPORT_WRITE_RESULT_UNCERTAIN');return {key:node.key,entity:node.entity,id:matches[0].id};
    });
    b=await change(b,{created:[...b.created,...created],status:b.created.length+created.length===b.plan.nodes.length?'imported':'ready'});
    return view(b);
   }catch(error){
    // Never retry a possibly committed create. Unknown outcomes stay locked for inspection.
    try{await change(b,{status:'blocked',error:error instanceof BookingError?error.code:'IMPORT_WRITE_UNCERTAIN'});}catch{/* Keep working lock if the checkpoint result is itself uncertain. */}
    throw error;
   }
  },
  async verify({id,revision}){
   let b=await claim(id,revision,['imported','verified']);
   try{
    const results=[];
    // Bounded parallel reads; verification never writes article or stock records.
    for(let i=0;i<b.created.length;i+=20){
     const group=b.created.slice(i,i+20);
     results.push(...await Promise.all(group.map(async row=>({row,value:await store.read(row.entity,row.id)}))));
    }
    for(const {row,value} of results){
     const expected=resolveImportNode(b.plan.nodes.find(n=>n.key===row.key),b.created);
     if(!value||Object.entries(expected).some(([k,v])=>!same(value[k],v)))fail('IMPORT_READBACK_MISMATCH');
    }
    for(const r of b.plan.articles)for(const unit of r.count_units){
     const trial=evaluateCount({count_units:r.count_units},{[unit.code]:'1'});
     if(trial.error||trial.quantity!==unit.base_quantity)fail('IMPORT_COUNT_CHECK_FAILED');
    }
    const report={records_read:results.length,articles:b.plan.articles.length,zero_stocks:b.plan.counts.OutletStock,all_links_valid:true,count_units_valid:true,production_writes:0};
    b=await change(b,{status:'verified',report});return view(b);
   }catch(error){try{await change(b,{status:'blocked',error:error.code||'IMPORT_VERIFY_FAILED'});}catch{/* Preserve lock. */}throw error;}
  },
  async close({id,revision}){
   let b=await claim(id,revision,['verified']);
   const outlet=b.created.find(n=>n.key==='outlet'),existing=await store.read('Outlet',outlet.id);
   const planned=b.plan.nodes.find(n=>n.key==='outlet');
   if(existing.code!==planned.data.code||!existing.code.startsWith('CATALOG-TEST-'))fail('IMPORT_TEST_OUTLET_REQUIRED');
   await store.update('Outlet',outlet.id,{is_active:false});
   if((await store.read('Outlet',outlet.id)).is_active!==false)fail('IMPORT_CLOSE_FAILED');
   b=await change(b,{status:'closed'});return view(b);
  },
 };
}
