import {BookingError,scaledQuantity,monetaryNumber} from './quantities.js';
import {unitsFor} from './counting.js';
import {offerIdentityKey,searchName} from './deliveryReview.js';
const fail=(code,status=409)=>{throw new BookingError(code,status);};
export const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v??null);
const equal=(a,b)=>canonical(a)===canonical(b);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
const name=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/gu,' ');
const text=(v,max=300)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max;
const positive=v=>{if(scaledQuantity(v)===0n)fail('POSITIVE_CONVERSION_REQUIRED',400);return Number(String(v).replace(',','.'));};
const bounded=async promise=>{const rows=await promise;if(!Array.isArray(rows)||rows.length>=501)fail('CATALOG_PAGING_REQUIRED');return rows;};
export function normalizeDefinition(input){
 const allowed=['key','id','name','supplier','category','unit','sku','purchase_code','purchase_label','factor','net_price','count_units','receipt_units','inventory_intervals','is_active','notes'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k)))fail('ARTICLE_INPUT_INVALID',400);
 const r={...input,sku:input.sku||'',receipt_units:input.receipt_units||[],inventory_intervals:input.inventory_intervals||['monthly','yearly'],notes:input.notes||'',is_active:input.is_active!==false};
 for(const k of ['name','supplier','category','unit','purchase_code','purchase_label'])if(!text(r[k]))fail('ARTICLE_REQUIRED_FIELDS',400);
 if(typeof r.sku!=='string'||r.sku.length>100||typeof r.notes!=='string'||r.notes.length>1000)fail('ARTICLE_INPUT_INVALID',400);
 r.factor=positive(r.factor);r.net_price=monetaryNumber(r.net_price);if(r.net_price<=0)fail('POSITIVE_PRICE_REQUIRED',400);
 if(!Array.isArray(r.count_units)||!r.count_units.length||r.count_units.length>8)fail('COUNT_UNITS_REQUIRED',400);
 r.count_units=r.count_units.map(u=>{if(!u||Object.keys(u).some(k=>!['code','label','base_quantity','whole_numbers_only'].includes(k))||!text(u.code,80)||!text(u.label,100)||typeof u.whole_numbers_only!=='boolean')fail('COUNT_UNIT_INVALID',400);return {...u,base_quantity:positive(u.base_quantity)};});
 unitsFor(r);
 if(!Array.isArray(r.inventory_intervals)||!r.inventory_intervals.length||new Set(r.inventory_intervals).size!==r.inventory_intervals.length||r.inventory_intervals.some(p=>!['weekly','monthly','yearly'].includes(p)))fail('INTERVALS_REQUIRED',400);
 if(!Array.isArray(r.receipt_units)||r.receipt_units.length>8)fail('RECEIPT_UNITS_INVALID',400);
 r.receipt_units=r.receipt_units.map(u=>{if(!u||Object.keys(u).some(k=>!['code','factor'].includes(k))||!text(u.code,100))fail('RECEIPT_UNITS_INVALID',400);return {code:u.code,factor:positive(u.factor)};});
 if(new Set([r.purchase_code,...r.receipt_units.map(u=>u.code)]).size!==r.receipt_units.length+1)fail('DUPLICATE_PURCHASE_UNIT',400);
 return r;
}
export function adminStore(e){
 const check=result=>{if(result?.success!==true||result.has_more!==false||![0,1].includes(result.updated))fail('CONDITIONAL_WRITE_UNCONFIRMED',503);return result.updated===1;};
 const expectedQuery=values=>Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v===undefined?{$exists:false}:v]));
 return {get:(entity,id)=>e[entity].get(id),find:(entity,query={})=>bounded(e[entity].filter(query,'id',501)),
  bulkCreate:(entity,data)=>e[entity].bulkCreate(data),
  cas:async(entity,id,expected,patch)=>check(await e[entity].updateMany({id,...expectedQuery(expected)},{$set:patch})),
  async activateMany(nodes,results){
   const ids=nodes.map(n=>n.id||results.find(r=>r.key===n.item_key)?.id),active=nodes[0].data.is_active;
   if(ids.some(id=>!id)||new Set(ids).size!==ids.length)fail('CATALOG_REFERENCE_MISSING');
   const result=await e.OutletItem.updateMany({id:{$in:ids},is_active:false},{$set:{is_active:active}});
   if(result?.success!==true||result.has_more!==false||!Number.isInteger(result.updated)||result.updated<0||result.updated>ids.length)fail('CONDITIONAL_WRITE_UNCONFIRMED',503);
   const rows=await bounded(e.OutletItem.filter({id:{$in:ids}},'id',501));
   if(rows.length!==ids.length||rows.some(r=>r.is_active!==active))fail('CATALOG_WRITE_UNCERTAIN');
  },
  async casOutlet(outlet,state){
   const revision=outlet.catalog_admin_revision||0;
   const query={id:outlet.id,...(revision===0?{$or:[{catalog_admin_revision:0},{catalog_admin_revision:{$exists:false}}]}:{catalog_admin_revision:revision})};
   return check(await e.Outlet.updateMany(query,{$set:{catalog_admin_revision:revision+1,catalog_admin_state:state}}));
  }};
}
export async function readAdminCatalog(store,outletId){
 const outlet=await store.get('Outlet',outletId);
 if(!outlet||outlet.type==='AGGREGATOR')fail('OUTLET_NOT_FOUND',404);
 const [items,stocks,globals,offers,suppliers,categories,units]=await Promise.all([
  store.find('OutletItem',{outlet_id:outletId}),store.find('OutletStock',{outlet_id:outletId}),store.find('GlobalItem'),store.find('SupplierItem'),store.find('Supplier'),store.find('Category'),store.find('Unit')]);
 return {outlet,items,stocks,globals,offers,suppliers,categories,units};
}
const fields=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]]));
export function definitionFor(item,catalog){
 const global=catalog.globals.find(g=>g.id===item.global_item_id),supplier=catalog.suppliers.find(s=>s.id===item.supplier_id);
 const offers=catalog.offers.filter(o=>o.global_item_id===global?.id&&o.supplier_id===item.supplier_id&&o.status==='approved');
 offers.sort((a,b)=>Number(b.purchase_unit_code===item.primary_purchase_code)-Number(a.purchase_unit_code===item.primary_purchase_code));
 const primary=offers[0],stock=catalog.stocks.filter(s=>s.outlet_item_id===item.id);
 const definition={id:item.id,key:item.id,name:item.display_name,supplier:supplier?.name||'',category:global?.category_name||catalog.categories.find(c=>c.id===global?.category_id)?.name||'',unit:global?.unit_abbreviation||'',sku:primary?.supplier_article_number||'',purchase_code:primary?.purchase_unit_code||'',purchase_label:primary?.purchase_unit_label||'',factor:primary?.base_quantity_per_purchase||1,net_price:primary?.net_purchase_price||0,count_units:item.count_units||[],receipt_units:offers.slice(1).map(o=>({code:o.purchase_unit_code,factor:o.base_quantity_per_purchase})),inventory_intervals:item.inventory_intervals||[],is_active:item.is_active!==false,notes:item.notes||''};
 let countValid=true;try{unitsFor(item);}catch{countValid=false;}
 return {definition,fingerprint:canonical({item,global,offers}),base_price:item.net_purchase_price,stock:stock.length===1?stock[0].on_hand_quantity:null,links_valid:countValid&&!!global&&!!supplier&&catalog.units.some(u=>u.id===global.unit_id&&u.abbreviation===global.unit_abbreviation)&&catalog.categories.some(c=>c.id===global.category_id)&&offers.length>0&&offers.every(o=>o.unit_abbreviation===global.unit_abbreviation&&o.base_quantity_per_purchase>0&&o.net_purchase_price>0&&Number.isSafeInteger(o.revision))&&stock.length===1&&stock[0].global_item_id===global.id&&stock[0].unit_abbreviation===global.unit_abbreviation&&Number.isSafeInteger(stock[0].revision)&&Array.isArray(stock[0].booking_journal)};
}
export function makeCatalogPlan({catalog,articles,requestId,importing=false,expected,userId,now}){
 const inputs=articles.map(normalizeDefinition),nodes=[],results=[];
 const add=(key,entity,data,existing=null)=>{
  if(existing){nodes.push({key,entity,kind:'update',id:existing.id,expected:fields(existing,Object.keys(data)),data});return;}
  nodes.push({key,entity,kind:'create',data:{...data,catalog_key:`${requestId}:${key}`}});
 };
 const ref=key=>({catalog_ref:key});
 const shared=(entity,label,field='name')=>{
  const key=`${entity}:${name(label)}`;
  if(results.some(r=>r.key===key)||nodes.some(n=>n.key===key))return ref(key);
  let records=catalog[{Supplier:'suppliers',Category:'categories',Unit:'units'}[entity]].filter(row=>name(row[field])===name(label));
  if(records.length>1){
   const globals=catalog.globals.filter(g=>catalog.items.some(i=>i.global_item_id===g.id));
   const usedIds=new Set(entity==='Supplier'?catalog.items.map(i=>i.supplier_id):globals.map(g=>entity==='Unit'?g.unit_id:g.category_id));
   const scoped=records.filter(r=>usedIds.has(r.id));
   if(scoped.length!==1)fail('DUPLICATE_REFERENCE_REQUIRES_REVIEW');
   records=scoped;
  }
  if(records.length){if(entity==='Supplier'&&records[0].is_active===false)fail('SUPPLIER_INACTIVE');results.push({key,entity,id:records[0].id});}
  else add(key,entity,entity==='Unit'?{name:label,abbreviation:label,type:label==='kg'?'weight':label==='l'?'volume':'count'}:entity==='Supplier'?{name:label,is_active:true}:{name:label});
  return ref(key);
 };
 if(!Number.isSafeInteger(catalog.outlet.delivery_registry_revision)||!Array.isArray(catalog.outlet.delivery_registry)){
  if(catalog.outlet.delivery_registry_revision!=null||catalog.outlet.delivery_registry!=null)fail('DELIVERY_REGISTRY_INCOMPLETE');
  add('delivery-registry','Outlet',{delivery_registry_revision:0,delivery_registry:[]},catalog.outlet);
 }
 const seenNames=new Set(),seenOffers=new Set();
 for(const [index,r] of inputs.entries()){
  const identity=name(r.name);if(seenNames.has(identity))fail('DUPLICATE_ARTICLE');seenNames.add(identity);
  const supplier=shared('Supplier',r.supplier),category=shared('Category',r.category),unit=shared('Unit',r.unit,'abbreviation');
  const existing=r.id?catalog.items.find(i=>i.id===r.id):null;
  if(r.id&&!existing)fail('ARTICLE_NOT_FOUND',404);
  if(existing&&definitionFor(existing,catalog).fingerprint!==expected)fail('ARTICLE_CHANGED_RELOAD');
  const oldGlobal=existing&&catalog.globals.find(g=>g.id===existing.global_item_id);
  if(existing&&(!oldGlobal||oldGlobal.unit_abbreviation!==r.unit))fail('BASE_UNIT_IMMUTABLE');
  const duplicates=catalog.items.filter(i=>i.id!==existing?.id&&name(i.display_name)===name(r.name));
  if(duplicates.length)fail('EXISTING_ARTICLE_REQUIRES_LINK');
  const key=`article:${index}`,globalKey=`${key}:global`,itemKey=`${key}:item`;
  const globalData={canonical_name:r.name,unit_id:unit,unit_abbreviation:r.unit,category_id:category,category_name:r.category,default_net_price:r.net_price/r.factor};
  if(oldGlobal&&catalog.items.filter(i=>i.global_item_id===oldGlobal.id).length!==1)fail('SHARED_ARTICLE_REQUIRES_REVIEW');
  add(globalKey,'GlobalItem',globalData,oldGlobal);
  const globalId=oldGlobal?oldGlobal.id:ref(globalKey);
  // New items remain inactive until their full graph is verified; activation is the last step.
  const itemData={outlet_id:catalog.outlet.id,outlet_name:catalog.outlet.name,global_item_id:globalId,display_name:r.name,supplier_id:supplier,supplier_name:r.supplier,net_purchase_price:r.net_price/r.factor,count_units:r.count_units,primary_purchase_code:r.purchase_code,inventory_intervals:r.inventory_intervals,is_active:false,is_finished_product:existing?.is_finished_product===true,notes:r.notes};
  add(itemKey,'OutletItem',itemData,existing);
  const itemId=existing?existing.id:ref(itemKey);
  if(!existing)add(`${key}:stock`,'OutletStock',{outlet_id:catalog.outlet.id,outlet_name:catalog.outlet.name,outlet_item_id:itemId,global_item_id:globalId,display_name:r.name,unit_abbreviation:r.unit,on_hand_quantity:0,revision:0,booking_journal:[]});
  else{const stocks=catalog.stocks.filter(s=>s.outlet_item_id===existing.id);if(stocks.length!==1)fail('UNIQUE_STOCK_REQUIRED');add(`${key}:stock-name`,'OutletStock',{display_name:r.name},stocks[0]);}
  for(const [i,u]of[{code:r.purchase_code,factor:r.factor},...r.receipt_units].entries()){
   const offer={supplier_id:supplier,global_item_id:globalId,supplier_article_number:r.sku,original_name:r.name,purchase_unit_code:u.code,purchase_unit_label:i===0?r.purchase_label:`${u.code} = ${u.factor} ${r.unit}`,base_quantity_per_purchase:u.factor,unit_abbreviation:r.unit,net_purchase_price:r.net_price/r.factor*u.factor,status:'approved',source_reference:'Admin-Freigabe'};
   const supplierId=results.find(x=>x.key===supplier.catalog_ref)?.id;
   const knownSupplier=catalog.suppliers.find(s=>s.id===supplierId);
   const identityOffer=offerIdentityKey({...offer,supplier_id:knownSupplier?.id||name(r.supplier)});
   if(seenOffers.has(identityOffer))fail('DUPLICATE_OFFER');seenOffers.add(identityOffer);
   const matches=catalog.offers.filter(o=>offerIdentityKey(o)===identityOffer);
   if(matches.length>1||matches.some(o=>o.global_item_id!==oldGlobal?.id))fail('DUPLICATE_OFFER');
   const previous=matches.length?matches:oldGlobal?catalog.offers.filter(o=>o.global_item_id===oldGlobal.id&&o.supplier_id===knownSupplier?.id&&o.purchase_unit_code===u.code&&o.status==='approved'):[];
   if(previous.length>1)fail('DUPLICATE_OFFER');
   const old=previous[0];add(`${key}:offer:${i}`,'SupplierItem',{...offer,revision:old?old.revision+1:0},old);
  }
  if(oldGlobal){
   const retained=new Set([r.purchase_code,...r.receipt_units.map(u=>u.code)]);
   for(const old of catalog.offers.filter(o=>o.global_item_id===oldGlobal.id&&o.status!=='archived'&&(!retained.has(o.purchase_unit_code)||o.supplier_id!==results.find(x=>x.key===supplier.catalog_ref)?.id)))add(`${key}:archive:${old.id}`,'SupplierItem',{status:'archived',revision:old.revision+1},old);
   if(existing.net_purchase_price!==itemData.net_purchase_price)add(`${key}:price-history`,'PriceHistory',{article_id:existing.id,article_name:r.name,old_price:existing.net_purchase_price,new_price:itemData.net_purchase_price,change_date:now.slice(0,10),changed_by:userId,reason:'Ausdrücklich in der Artikelverwaltung freigegeben'});
  }
  nodes.push({key:`${key}:activate`,entity:'OutletItem',kind:'activate',item_key:itemKey,id:existing?.id||null,data:{is_active:r.is_active}});
 }
 // References precede graph records; keep each article's activation last relative to its own dependencies.
 const rank={Supplier:0,Unit:0,Category:0,Outlet:0,GlobalItem:1,OutletItem:2,OutletStock:3,SupplierItem:4,PriceHistory:5};
 nodes.sort((a,b)=>(a.kind==='activate'?6:rank[a.entity])-(b.kind==='activate'?6:rank[b.entity]));
 return {kind:importing?'catalog-import':'article-save',request_id:requestId,input_fingerprint:canonical(inputs),nodes,results,cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:now,articles:inputs.length};
}
export function resolveCatalogData(value,results){
 const map=new Map(results.map(r=>[r.key,r.id]));
 const resolve=v=>Array.isArray(v)?v.map(resolve):v&&typeof v==='object'?Object.keys(v).length===1&&v.catalog_ref?(map.get(v.catalog_ref)||fail('CATALOG_REFERENCE_MISSING')):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)])):v;
 return resolve(value);
}
export function createCatalogAdminService({store,user,now=()=>new Date().toISOString()}){
 if(!text(user?.id,200)||user.role!=='admin')fail('ADMIN_REQUIRED',403);
 const load=async id=>{const o=await store.get('Outlet',id);if(!o||o.type==='AGGREGATOR')fail('OUTLET_NOT_FOUND',404);return o;};
 const view=o=>{const s=o.catalog_admin_state;return {outlet_id:o.id,revision:o.catalog_admin_revision||0,operation:s?{request_id:s.request_id,kind:s.kind,status:s.status,completed:s.completed_operations??s.cursor,total:s.total_operations??s.nodes.length,articles:s.articles,error:s.error||null,results:s.status==='completed'?s.results.filter(r=>r.entity==='OutletItem'||r.entity==='SupplierItem'):[]}:null};};
 const checkpoint=async(o,state)=>{if(!await store.casOutlet(o,state))fail('CATALOG_CHANGED_RELOAD');return {...o,catalog_admin_revision:(o.catalog_admin_revision||0)+1,catalog_admin_state:state};};
 const verifiedRows=async(s,nodes)=>{
  const data=nodes.map(n=>resolveCatalogData(n.data,s.results));
  const rows=await store.find(nodes[0].entity,{catalog_key:{$in:data.map(p=>p.catalog_key)}});
  return nodes.map((node,i)=>{const matches=rows.filter(r=>r.catalog_key===data[i].catalog_key&&Object.entries(data[i]).every(([k,v])=>equal(r[k],v)));if(matches.length!==1)fail('CATALOG_WRITE_UNCERTAIN');return {key:node.key,entity:node.entity,id:matches[0].id};});
 };
 const applyUpdate=async(node,results)=>{
  if(node.kind==='price-review'){
   for(let attempt=0;attempt<5;attempt++){
    const d=await store.get('DeliveryDraft',node.id),line=d?.lines?.find(l=>l.source.id===node.line_id);
    if(!line||d.outlet_id!==node.outlet_id||!equal(line.booking_receipt,node.receipt)||!equal(line.confirmation,node.confirmation))fail('PRICE_RECEIPT_CHANGED');
    if(line.price_review){if(!equal(line.price_review,node.data))fail('PRICE_ALREADY_REVIEWED');return [];}
    const lines=d.lines.map(l=>l.source.id===node.line_id?{...l,price_review:node.data}:l);
    if(await store.cas('DeliveryDraft',d.id,{revision:d.revision},{lines,revision:d.revision+1}))return [];
   }
   fail('DRAFT_CHANGED_RELOAD');
  }
  const id=node.kind==='activate'?(node.id||results.find(r=>r.key===node.item_key)?.id):node.id;
  if(!id)fail('CATALOG_REFERENCE_MISSING');
  const current=await store.get(node.entity,id),patch=resolveCatalogData(node.data,results),expected=node.kind==='activate'?{is_active:false}:node.expected;
  if(!Object.entries(patch).every(([k,v])=>equal(current[k],v))){
   if(!Object.entries(expected).every(([k,v])=>equal(current[k],v))||!await store.cas(node.entity,id,expected,patch))fail('ARTICLE_CHANGED_RELOAD');
  }
  const observed=await store.get(node.entity,id);if(!Object.entries(patch).every(([k,v])=>equal(observed[k],v)))fail('CATALOG_WRITE_UNCERTAIN');
  return node.kind==='update'?[{key:node.key,entity:node.entity,id}]:[];
 };
 const verifyGraph=async(o)=>{
  const c=await readAdminCatalog(store,o.id),s=o.catalog_admin_state;
  for(const r of s.results.filter(r=>r.entity==='OutletItem')){
   const item=c.items.find(i=>i.id===r.id);if(!item||!definitionFor(item,c).links_valid)fail('ARTICLE_GRAPH_INCOMPLETE');
   if(s.kind==='catalog-import'){const stock=c.stocks.find(x=>x.outlet_item_id===r.id);if(stock.on_hand_quantity!==0||stock.revision!==0||stock.booking_journal.length)fail('IMPORT_ZERO_STOCK_CHANGED');}
  }
 };
 return {
  status:async({outlet_id})=>view(await load(outlet_id)),
  async list({outlet_id}){const c=await readAdminCatalog(store,outlet_id);return {...view(c.outlet),outlet:{id:c.outlet.id,name:c.outlet.name},articles:c.items.map(i=>definitionFor(i,c)),suppliers:c.suppliers.filter(s=>s.is_active!==false).map(s=>s.name),categories:c.categories.map(c=>c.name),units:c.units.map(u=>u.abbreviation)};},
  async startPrepared({outlet_id,request_id,plan}){
   const o=await load(outlet_id),prior=o.catalog_admin_state;
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==plan.input_fingerprint)fail('REQUEST_CONTENT_CHANGED');return view(o);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   return view(await checkpoint(o,plan));
  },
  async start({outlet_id,request_id,articles,importing=false,expected}){
   if(!text(request_id,80)||!/^[A-Za-z0-9-]{16,80}$/.test(request_id)||!Array.isArray(articles)||!articles.length||articles.length>250||(!importing&&articles.length!==1))fail('CATALOG_REQUEST_INVALID',400);
   const c=await readAdminCatalog(store,outlet_id),o=c.outlet,prior=o.catalog_admin_state;
   const inputs=articles.map(normalizeDefinition),fingerprint=await digest(inputs);
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==fingerprint)fail('REQUEST_CONTENT_CHANGED');return view(o);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   if(importing&&c.items.length)fail('IMPORT_REQUIRES_EMPTY_DESTINATION');
   const plan={...makeCatalogPlan({catalog:c,articles:inputs,requestId:request_id,importing,expected,userId:user.id,now:now()}),input_fingerprint:fingerprint};
   return view(await checkpoint(o,plan));
  },
  async step({outlet_id,request_id,revision}){
   let o=await load(outlet_id),s=o.catalog_admin_state;
   if(!s||s.request_id!==request_id)fail('CATALOG_OPERATION_NOT_FOUND',404);
   if(s.status==='completed')return view(o);
   if(o.catalog_admin_revision!==revision)fail('CATALOG_CHANGED_RELOAD');
   if(s.in_flight){
    const nodes=s.nodes.slice(s.cursor,s.cursor+s.in_flight.count);
    let rows;
    if(nodes[0].kind==='create')rows=await verifiedRows(s,nodes);
    else if(nodes[0].kind==='activate'&&store.activateMany){await store.activateMany(nodes,s.results);rows=[];}
    else rows=await applyUpdate(nodes[0],s.results);
    return view(await checkpoint(o,{...s,results:[...s.results,...rows],cursor:s.cursor+nodes.length,in_flight:null,status:'ready',error:null}));
   }
   if(s.cursor===s.nodes.length){await verifyGraph(o);return view(await checkpoint(o,{...s,status:'completed',completed_operations:s.cursor,total_operations:s.nodes.length,nodes:[],results:s.results.filter(r=>['OutletItem','SupplierItem'].includes(r.entity)),verification:{all_links_valid:true,zero_stocks_verified:s.kind==='catalog-import',articles:s.articles}}));}
   const node=s.nodes[s.cursor];
   const batchable=node.kind==='create'||(node.kind==='activate'&&store.activateMany);
   const group=batchable?s.nodes.slice(s.cursor,s.cursor+20).filter((n,i,a)=>n.kind===node.kind&&n.entity===node.entity&&(node.kind!=='activate'||n.data.is_active===node.data.is_active)&&a.slice(0,i).every(x=>x.kind===node.kind&&x.entity===node.entity&&(node.kind!=='activate'||x.data.is_active===node.data.is_active))):[node];
   o=await checkpoint(o,{...s,status:'working',in_flight:{count:group.length}});s=o.catalog_admin_state;
   try{
    let results=[];
    if(node.kind==='create'){
     await store.bulkCreate(node.entity,group.map(n=>resolveCatalogData(n.data,s.results)));
     results=await verifiedRows(s,group);
    }else if(node.kind==='activate'&&store.activateMany)await store.activateMany(group,s.results);
    else results=await applyUpdate(node,s.results);
    return view(await checkpoint(o,{...s,results:[...s.results,...results],cursor:s.cursor+group.length,in_flight:null,status:'ready',error:null}));
   }catch(error){
    // Keep the in-flight marker. Unknown creates are reconciled by their exact persisted marker,
    // never re-issued. Updates can be safely retried only after proving their exact post-image.
    try{await checkpoint(o,{...s,status:'blocked',error:error instanceof BookingError?error.code:'CATALOG_WRITE_UNCERTAIN'});}catch{/* Preserve the prior lock. */}
    throw error;
   }
  },
 };
}
