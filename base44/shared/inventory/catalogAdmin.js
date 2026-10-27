import {cleanArticleText,invalidArticleField} from './articleFields.js';
import {BookingError,scaledQuantity,monetaryNumber} from './quantities.js';
import {unitsFor} from './counting.js';
import {offerIdentityKey} from './deliveryReview.js';
import {similarArticles} from './articleIdentity.js';
import {convertUnitQuantity,validateUnitDimensions} from './unitConversion.js';
import {isDeleted,lifecyclePlan,purgePlan,purgeArticle} from './articleTrash.js';
import {canonicalCategory,categoryChoices} from './categories.js';
import {availableSubcategories,isMainCategory,selectedSubcategory,subcategoryPlan,classificationPlan} from './subcategories.js';
import {assertOutletAccess} from './stock.js';
const fail=(code,status=409)=>{throw new BookingError(code,status);};
export const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v??null);
const equal=(a,b)=>canonical(a)===canonical(b);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
const name=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/gu,' ');
const text=(v,max=300)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max;
const positive=v=>{if(scaledQuantity(v)===0n)fail('POSITIVE_CONVERSION_REQUIRED',400);return Number(String(v).replace(',','.'));};
const bounded=async promise=>{const rows=await promise;if(!Array.isArray(rows)||rows.length>=501)fail('CATALOG_PAGING_REQUIRED');return rows;};
export function normalizeDefinition(input){
 const allowed=['key','id','name','supplier','category','unit','sku','purchase_code','purchase_label','factor','net_price','count_units','receipt_units','inventory_intervals','is_active','notes','distinct_confirmed','base_unit_change','subcategory_id'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k)))fail('ARTICLE_INPUT_INVALID',400);
 if(input.distinct_confirmed!==undefined&&typeof input.distinct_confirmed!=='boolean')fail('ARTICLE_INPUT_INVALID',400);
 input=cleanArticleText(input);
 const r={...input,sku:input.sku||'',receipt_units:input.receipt_units||[],inventory_intervals:input.inventory_intervals||['monthly','yearly'],notes:input.notes||'',is_active:input.is_active!==false};
 const invalidField=invalidArticleField(r);if(invalidField){const error=new BookingError('ARTICLE_REQUIRED_FIELDS',400);error.field=invalidField;throw error;}
 r.category=canonicalCategory(r.category);
 if(r.subcategory_id!==undefined&&(typeof r.subcategory_id!=='string'||r.subcategory_id.length>100))fail('SUBCATEGORY_INPUT_INVALID',400);
 r.subcategory_id=r.subcategory_id||'';
 if(typeof r.sku!=='string'||r.sku.length>100||typeof r.notes!=='string'||r.notes.length>1000)fail('ARTICLE_INPUT_INVALID',400);
 r.factor=positive(r.factor);r.net_price=monetaryNumber(r.net_price);if(r.net_price<=0)fail('POSITIVE_PRICE_REQUIRED',400);
 if(!Array.isArray(r.count_units)||!r.count_units.length||r.count_units.length>8)fail('COUNT_UNITS_REQUIRED',400);
 r.count_units=r.count_units.map(u=>{if(!u||Object.keys(u).some(k=>!['code','label','base_quantity','whole_numbers_only'].includes(k))||!text(u.code,80)||!text(u.label,100)||typeof u.whole_numbers_only!=='boolean')fail('COUNT_UNIT_INVALID',400);return {...u,base_quantity:positive(u.base_quantity)};});
 if(r.base_unit_change!==undefined){
  const c=r.base_unit_change;
  if(!c||Object.keys(c).some(k=>!['from','old_quantity','new_quantity'].includes(k))||!text(c.from,100))fail('UNIT_CONVERSION_REQUIRED',400);
  r.base_unit_change={from:c.from,old_quantity:positive(c.old_quantity),new_quantity:positive(c.new_quantity)};
  validateUnitDimensions(c.from,r.unit,c.old_quantity,c.new_quantity);
 }
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
 const base={get:(entity,id)=>e[entity].get(id),find:(entity,query={})=>bounded(e[entity].filter(query,'id',501)),
  bulkCreate:(entity,data)=>e[entity].bulkCreate(data),
  remove:(entity,id)=>e[entity].delete(id),
  cas:async(entity,id,expected,patch)=>check(await e[entity].updateMany({id,...expectedQuery(stableExpected(expected))},{$set:patch})),
  async classifyMany(nodes,results){
   const patch=resolveCatalogData(nodes[0].data,results),ids=nodes.map(n=>n.id);
   const before=await bounded(e.OutletItem.filter({id:{$in:ids}},'id',501));
   const pending=nodes.filter(node=>{const row=before.find(r=>r.id===node.id);if(!row)fail('ARTICLE_CHANGED_RELOAD');if(Object.entries(patch).every(([k,v])=>equal(row[k],v)))return false;if(!Object.entries(node.expected).every(([k,v])=>equal(row[k],v)))fail('ARTICLE_CHANGED_RELOAD');return true;});
   if(pending.length){
    const query={$or:pending.map(node=>({id:node.id,...expectedQuery(node.expected)}))};
    const result=await e.OutletItem.updateMany(query,{$set:patch});
    if(result?.success!==true||result.has_more!==false||!Number.isInteger(result.updated)||result.updated<0||result.updated>pending.length)fail('CONDITIONAL_WRITE_UNCONFIRMED',503);
   }
   const observed=await bounded(e.OutletItem.filter({id:{$in:ids}},'id',501));
   if(observed.length!==ids.length||observed.some(row=>!Object.entries(patch).every(([k,v])=>equal(row[k],v))))fail('CATALOG_WRITE_UNCERTAIN');
   return nodes.map(n=>({key:n.key,entity:n.entity,id:n.id}));
  },
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
 // A short platform storage pause is waited out instead of leaving a change unconfirmed.
 const rateLimited=error=>{const status=error?.status??error?.response?.status;return status===429||/rate limit|too many requests/i.test(String(error?.message||''));};
 const patient=run=>{const attempt=async count=>{try{return await run();}catch(error){if(count>=3||!rateLimited(error))throw error;await new Promise(resolve=>setTimeout(resolve,400*2**count));return attempt(count+1);}};return attempt(0);};
 return Object.fromEntries(Object.entries(base).map(([name,method])=>[name,(...args)=>patient(()=>method(...args))]));
}
export async function readAdminCatalog(store,outletId){
 const outlet=await store.get('Outlet',outletId);
 if(!outlet||outlet.type==='AGGREGATOR')fail('OUTLET_NOT_FOUND',404);
 const [items,stocks,globals,offers,suppliers,categories,units]=await Promise.all([
  store.find('OutletItem',{outlet_id:outletId}),store.find('OutletStock',{outlet_id:outletId}),store.find('GlobalItem'),store.find('SupplierItem'),store.find('Supplier'),store.find('Category'),store.find('Unit')]);
 return {outlet,items,stocks,globals,offers,suppliers,categories,units};
}
const fields=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]]));
// Confirmed pre-image of a change; empty lists are no condition and must not become one.
const stableExpected=values=>Object.fromEntries(Object.entries(values||{}).filter(([,value])=>!(Array.isArray(value)&&value.length===0)));
export function definitionFor(item,catalog){
 const global=catalog.globals.find(g=>g.id===item.global_item_id),supplier=catalog.suppliers.find(s=>s.id===item.supplier_id);
 const offers=catalog.offers.filter(o=>o.global_item_id===global?.id&&o.supplier_id===item.supplier_id&&o.status==='approved');
 offers.sort((a,b)=>Number(b.purchase_unit_code===item.primary_purchase_code)-Number(a.purchase_unit_code===item.primary_purchase_code));
 const primary=offers[0],stock=catalog.stocks.filter(s=>s.outlet_item_id===item.id);
 const definition={subcategory_id:item.subcategory_id||'',id:item.id,key:item.id,name:item.display_name,supplier:supplier?.name||'',category:canonicalCategory(global?.category_name||catalog.categories.find(c=>c.id===global?.category_id)?.name||''),unit:global?.unit_abbreviation||'',sku:primary?.supplier_article_number||'',purchase_code:primary?.purchase_unit_code||'',purchase_label:primary?.purchase_unit_label||'',factor:primary?.base_quantity_per_purchase||1,net_price:primary?.net_purchase_price||0,count_units:item.count_units||[],receipt_units:offers.slice(1).map(o=>({code:o.purchase_unit_code,factor:o.base_quantity_per_purchase})),inventory_intervals:item.inventory_intervals||[],is_active:item.is_active!==false,notes:item.notes||''};
 let countValid=true;try{unitsFor(item);}catch{countValid=false;}
 return {classification_fingerprint:JSON.stringify([item.id,item.subcategory_id||'',global?.category_id,item.display_name]),subcategory_name:availableSubcategories(catalog.categories,item.outlet_id).find(r=>r.id===item.subcategory_id)?.name||'',deleted_at:item.deleted_at||null,delete_after:item.delete_after||null,purging:!!item.purge_started_at,definition,fingerprint:canonical({item,global,offers}),base_price:item.net_purchase_price,stock:stock.length===1?stock[0].on_hand_quantity:null,links_valid:countValid&&!!global&&!!supplier&&catalog.units.some(u=>u.id===global.unit_id&&u.abbreviation===global.unit_abbreviation)&&catalog.categories.some(c=>c.id===global.category_id)&&offers.length>0&&offers.every(o=>o.unit_abbreviation===global.unit_abbreviation&&o.base_quantity_per_purchase>0&&o.net_purchase_price>0&&Number.isSafeInteger(o.revision))&&stock.length===1&&stock[0].global_item_id===global.id&&stock[0].unit_abbreviation===global.unit_abbreviation&&Number.isSafeInteger(stock[0].revision)&&Array.isArray(stock[0].booking_journal)};
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
  let records=catalog[{Supplier:'suppliers',Category:'categories',Unit:'units'}[entity]].filter(row=>(entity!=='Category'||isMainCategory(row))&&name(entity==='Category'?canonicalCategory(row[field]):row[field])===name(label));
  if(entity==='Category'&&records.length>1){
   // Reuse one deterministic master, preferring the canonical spelling; never create another alias row.
   records.sort((a,b)=>Number(name(b.name)===name(label))-Number(name(a.name)===name(label))||a.id.localeCompare(b.id));records=records.slice(0,1);
  }
  if(records.length>1){
   const globals=catalog.globals.filter(g=>catalog.items.some(i=>i.global_item_id===g.id));
   const usedIds=new Set(entity==='Supplier'?catalog.items.map(i=>i.supplier_id):globals.map(g=>entity==='Unit'?g.unit_id:g.category_id));
   const scoped=records.filter(r=>usedIds.has(r.id));
   if(scoped.length!==1)fail('DUPLICATE_REFERENCE_REQUIRES_REVIEW');
   records=scoped;
  }
  if(records.length){if(entity==='Supplier'&&records[0].is_active===false)fail('SUPPLIER_INACTIVE');results.push({key,entity,id:records[0].id});}
  else add(key,entity,entity==='Unit'?{name:label,abbreviation:label,type:['kg','g'].includes(label)?'weight':['l','ml','cl'].includes(label)?'volume':'count'}:entity==='Supplier'?{name:label,is_active:true}:{name:label});
  return ref(key);
 };
 if(!Number.isSafeInteger(catalog.outlet.delivery_registry_revision)||!Array.isArray(catalog.outlet.delivery_registry)){
  if(catalog.outlet.delivery_registry_revision!=null||catalog.outlet.delivery_registry!=null)fail('DELIVERY_REGISTRY_INCOMPLETE');
  add('delivery-registry','Outlet',{delivery_registry_revision:0,delivery_registry:[]},catalog.outlet);
 }
 const seenNames=new Set(),seenOffers=new Set();
 for(const [index,r] of inputs.entries()){
  selectedSubcategory(r.subcategory_id,r.category,catalog.categories,catalog.outlet.id);
  const identity=name(r.name);if(seenNames.has(identity))fail('DUPLICATE_ARTICLE');seenNames.add(identity);
  const supplier=shared('Supplier',r.supplier),category=shared('Category',r.category),unit=shared('Unit',r.unit,'abbreviation');
  const existing=r.id?catalog.items.find(i=>i.id===r.id):null;
  if(r.id&&!existing)fail('ARTICLE_NOT_FOUND',404);
  if(existing&&isDeleted(existing))fail('ARTICLE_ALREADY_DELETED');
  if(existing&&definitionFor(existing,catalog).fingerprint!==expected)fail('ARTICLE_CHANGED_RELOAD');
  const oldGlobal=existing&&catalog.globals.find(g=>g.id===existing.global_item_id);
  if(existing&&!oldGlobal)fail('ARTICLE_GRAPH_INCOMPLETE');
  const unitChanged=!!oldGlobal&&oldGlobal.unit_abbreviation!==r.unit;
  if(unitChanged){
   const conversion=r.base_unit_change,prior=definitionFor(existing,catalog).definition;
   if(!conversion||conversion.from!==oldGlobal.unit_abbreviation)fail('UNIT_CONVERSION_REQUIRED');
   if(convertUnitQuantity(prior.factor,conversion.old_quantity,conversion.new_quantity)!==r.factor)fail('UNIT_CONVERSION_CONTENT_CHANGED');
   const stock=catalog.stocks.filter(s=>s.outlet_item_id===existing.id);
   if(stock.length!==1||stock[0].unit_abbreviation!==conversion.from||!Number.isSafeInteger(stock[0].revision)||!Array.isArray(stock[0].booking_journal))fail('UNIQUE_STOCK_REQUIRED');
   convertUnitQuantity(stock[0].on_hand_quantity,conversion.old_quantity,conversion.new_quantity);
  }else if(r.base_unit_change)fail('UNIT_CONVERSION_UNEXPECTED');
  const duplicates=catalog.items.filter(i=>i.id!==existing?.id&&name(i.display_name)===name(r.name));
  if(duplicates.length)fail('EXISTING_ARTICLE_REQUIRES_LINK');
  if(!existing&&!importing&&r.distinct_confirmed!==true&&similarArticles(r.name,catalog.items.map(i=>({id:i.id,name:i.display_name}))).length)fail('POSSIBLE_DUPLICATE_REVIEW_REQUIRED');
  const key=`article:${index}`,globalKey=`${key}:global`,itemKey=`${key}:item`;
  const globalData={canonical_name:r.name,unit_id:unit,unit_abbreviation:r.unit,category_id:category,category_name:r.category,default_net_price:r.net_price/r.factor};
  if(oldGlobal&&catalog.items.filter(i=>i.global_item_id===oldGlobal.id).length!==1)fail('SHARED_ARTICLE_REQUIRES_REVIEW');
  add(globalKey,'GlobalItem',globalData,oldGlobal);
  const globalId=oldGlobal?oldGlobal.id:ref(globalKey);
  // New items remain inactive until their full graph is verified; activation is the last step.
  const itemData={subcategory_id:r.subcategory_id,outlet_id:catalog.outlet.id,outlet_name:catalog.outlet.name,global_item_id:globalId,display_name:r.name,supplier_id:supplier,supplier_name:r.supplier,net_purchase_price:r.net_price/r.factor,count_units:r.count_units,primary_purchase_code:r.purchase_code,inventory_intervals:r.inventory_intervals,is_active:false,is_finished_product:existing?.is_finished_product===true,notes:r.notes};
  add(itemKey,'OutletItem',itemData,existing);
  const itemId=existing?existing.id:ref(itemKey);
  if(!existing)add(`${key}:stock`,'OutletStock',{outlet_id:catalog.outlet.id,outlet_name:catalog.outlet.name,outlet_item_id:itemId,global_item_id:globalId,display_name:r.name,unit_abbreviation:r.unit,on_hand_quantity:0,revision:0,booking_journal:[]});
  else{const stocks=catalog.stocks.filter(s=>s.outlet_item_id===existing.id);if(stocks.length!==1)fail('UNIQUE_STOCK_REQUIRED');
   if(unitChanged)nodes.push({key:`${key}:stock-conversion`,entity:'OutletStock',kind:'unit-conversion',id:stocks[0].id,global_id:oldGlobal.id,outlet_id:catalog.outlet.id,from:r.base_unit_change.from,old_quantity:r.base_unit_change.old_quantity,new_quantity:r.base_unit_change.new_quantity,data:{display_name:r.name,unit_abbreviation:r.unit,catalog_key:`${requestId}:unit-conversion:${existing.id}`}});
   else add(`${key}:stock-name`,'OutletStock',{display_name:r.name},stocks[0]);
  }
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
   if(unitChanged||existing.net_purchase_price!==itemData.net_purchase_price)add(`${key}:price-history`,'PriceHistory',{article_id:existing.id,article_name:r.name,old_price:existing.net_purchase_price,new_price:itemData.net_purchase_price,change_date:now.slice(0,10),changed_by:userId,reason:unitChanged?`Basiseinheit umgerechnet: ${r.base_unit_change.old_quantity} ${r.base_unit_change.from} = ${r.base_unit_change.new_quantity} ${r.unit}. Alte Belege und Inventurwerte bleiben in ihrer ursprünglichen Einheit.`:'Ausdrücklich in der Artikelverwaltung freigegeben'});
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
 // Creates are written once and matched by their exact persisted marker, so a retry never duplicates a row.
 const ensureCreated=async(nodes,results)=>{
  const data=nodes.map(n=>resolveCatalogData(n.data,results)),keys=data.map(d=>d.catalog_key);
  const matches=(rows,d)=>rows.filter(r=>r.catalog_key===d.catalog_key&&Object.entries(d).every(([k,v])=>equal(r[k],v)));
  let rows=await store.find(nodes[0].entity,{catalog_key:{$in:keys}});
  const missing=nodes.map((node,i)=>[node,data[i]]).filter(([,d])=>matches(rows,d).length===0);
  if(missing.length){await store.bulkCreate(nodes[0].entity,missing.map(([,d])=>d));rows=await store.find(nodes[0].entity,{catalog_key:{$in:keys}});}
  return nodes.map((node,i)=>{const hits=matches(rows,data[i]);if(hits.length!==1)fail('CATALOG_WRITE_UNCERTAIN');return {key:node.key,entity:node.entity,id:hits[0].id};});
 };
 const applyUpdate=async(node,results)=>{
  if(node.kind==='article-purge')return purgeArticle(store,node,now());
  if(node.kind==='unit-conversion'){
   for(let attempt=0;attempt<8;attempt++){
    const stock=await store.get('OutletStock',node.id);
    if(!stock||stock.outlet_id!==node.outlet_id||stock.global_item_id!==node.global_id)fail('STOCK_LINK_MISMATCH');
    if(stock.catalog_key===node.data.catalog_key&&stock.unit_abbreviation===node.data.unit_abbreviation)return [{key:node.key,entity:node.entity,id:node.id}];
    if(stock.unit_abbreviation!==node.from||!Number.isSafeInteger(stock.revision)||stock.revision<0||stock.revision===Number.MAX_SAFE_INTEGER||!Array.isArray(stock.booking_journal))fail('UNIT_CONVERSION_STOCK_CHANGED');
    const quantity=convertUnitQuantity(stock.on_hand_quantity,node.old_quantity,node.new_quantity);
    const expected=fields(stock,['revision','unit_abbreviation','on_hand_quantity','booking_journal','catalog_key']);
    if(await store.cas('OutletStock',node.id,expected,{...node.data,on_hand_quantity:quantity,revision:stock.revision+1}))return [{key:node.key,entity:node.entity,id:node.id}];
   }
   fail('UNIT_CONVERSION_STOCK_CHANGED');
  }
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
  const current=await store.get(node.entity,id),patch=resolveCatalogData(node.data,results),expected=node.kind==='activate'?{is_active:false}:stableExpected(node.expected);
  if(!Object.entries(patch).every(([k,v])=>equal(current[k],v))){
   if(!Object.entries(expected).every(([k,v])=>equal(current[k],v))||!await store.cas(node.entity,id,expected,patch))fail('ARTICLE_CHANGED_RELOAD');
  }
  const observed=await store.get(node.entity,id);if(!Object.entries(patch).every(([k,v])=>equal(observed[k],v)))fail('CATALOG_WRITE_UNCERTAIN');
  return node.kind==='update'?[{key:node.key,entity:node.entity,id}]:[];
 };
 const service={
  status:async({outlet_id})=>view(await load(outlet_id)),
  async list({outlet_id,cleanup=true}){
   assertOutletAccess(user,outlet_id);
   let c=await readAdminCatalog(store,outlet_id);
   if(cleanup&&(!c.outlet.catalog_admin_state||c.outlet.catalog_admin_state.status==='completed')){
    const expired=c.items.filter(i=>isDeleted(i)&&Number.isFinite(Date.parse(i.delete_after))&&Date.parse(i.delete_after)<=Date.parse(now()));
    if(expired.length){
     const request_id=`purge-${crypto.randomUUID()}`;
     let state=await service.startPrepared({outlet_id,request_id,plan:purgePlan(expired,{outletId:outlet_id,requestId:request_id,userId:user.id,now:now()})});
     try{for(let n=0;n<10&&state.operation.status!=='completed';n++)state=await service.step({outlet_id,request_id,revision:state.revision});}catch{/* Preserve the durable operation; admin can resume. */}
     c=await readAdminCatalog(store,outlet_id);
    }
   }
   if(cleanup&&(!c.outlet.catalog_admin_state||c.outlet.catalog_admin_state.status==='completed')){
    const root=c.categories.find(r=>isMainCategory(r)&&canonicalCategory(r.name)==='Betriebsausstattung');
    const exists=root&&c.categories.some(r=>r.parent_id&&r.outlet_id===outlet_id&&canonicalCategory(c.categories.find(p=>p.id===r.parent_id)?.name)==='Betriebsausstattung');
    if(root&&!exists){
     let state=await service.subcategory({outlet_id,request_id:`setup-${crypto.randomUUID()}`,mode:'setup',parent:'Betriebsausstattung'});
     try{for(let n=0;n<10&&state.operation.status!=='completed';n++)state=await service.step({outlet_id,request_id:state.operation.request_id,revision:state.revision});}catch{/* Durable setup can be resumed. */}
     c=await readAdminCatalog(store,outlet_id);
    }
   }
   const scoped=c.items.length>0;
   const globals=c.globals.filter(g=>c.items.some(i=>i.global_item_id===g.id));
   return {...view(c.outlet),outlet:{id:c.outlet.id,name:c.outlet.name},articles:c.items.map(i=>definitionFor(i,c)),
    suppliers:[...new Set(c.suppliers.filter(s=>s.is_active!==false).map(s=>s.name))].sort((a,b)=>a.localeCompare(b,'de')),
    categories:categoryChoices(c.categories.filter(isMainCategory).map(c=>c.name)),
    subcategories:availableSubcategories(c.categories,outlet_id),
    units:[...new Set(c.units.filter(u=>!scoped||globals.some(g=>g.unit_id===u.id)).map(u=>u.abbreviation))]};
  },
  async classify({outlet_id,request_id,groups,assignments}){
   assertOutletAccess(user,outlet_id);
   if(!text(request_id,80)||!/^[-A-Za-z0-9]{16,80}$/.test(request_id))fail('CLASSIFICATION_INVALID',400);
   const c=await readAdminCatalog(store,outlet_id),prior=c.outlet.catalog_admin_state,fingerprint=JSON.stringify({groups,assignments});
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==fingerprint)fail('REQUEST_CONTENT_CHANGED');return view(c.outlet);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   return service.startPrepared({outlet_id,request_id,plan:classificationPlan({catalog:c,groups,assignments,requestId:request_id,userId:user.id,now:now()})});
  },
  async subcategory({outlet_id,request_id,...input}){
   assertOutletAccess(user,outlet_id);
   if(!text(request_id,80)||!/^[-A-Za-z0-9]{16,80}$/.test(request_id))fail('SUBCATEGORY_INPUT_INVALID',400);
   const c=await readAdminCatalog(store,outlet_id),prior=c.outlet.catalog_admin_state;
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==JSON.stringify(input))fail('REQUEST_CONTENT_CHANGED');return view(c.outlet);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   if(input.id){const linked=await store.find('OutletItem',{subcategory_id:input.id});if(linked.some(r=>r.outlet_id!==outlet_id))fail('SUBCATEGORY_SCOPE_MISMATCH');}
   return service.startPrepared({outlet_id,request_id,plan:subcategoryPlan({catalog:c,input,requestId:request_id,userId:user.id,now:now()})});
  },
  async discardMany({outlet_id,request_id,items}){
   assertOutletAccess(user,outlet_id);
   if(!text(request_id,80)||!/^[-A-Za-z0-9]{16,80}$/.test(request_id)||!Array.isArray(items)||!items.length||items.length>250||new Set(items.map(r=>r?.id)).size!==items.length||items.some(r=>!r||Object.keys(r).some(k=>!['id','expected'].includes(k))||!text(r.id,100)||typeof r.expected!=='string'))fail('ARTICLE_SELECTION_INVALID',400);
   const c=await readAdminCatalog(store,outlet_id),prior=c.outlet.catalog_admin_state,fingerprint=canonical(items);
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==fingerprint)fail('REQUEST_CONTENT_CHANGED');return view(c.outlet);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   const selected=items.map(input=>{const item=c.items.find(r=>r.id===input.id);if(!item)fail('ARTICLE_NOT_FOUND',404);if(isDeleted(item))fail('ARTICLE_ALREADY_DELETED');if(definitionFor(item,c).fingerprint!==input.expected)fail('ARTICLE_CHANGED_RELOAD');return item;});
   const recipes=await store.find('OutletItem');
   if(recipes.some(r=>!isDeleted(r)&&r.recipe_items?.some(ingredient=>selected.some(item=>item.id===ingredient.article_id))))fail('ARTICLE_USED_IN_RECIPE');
   const date=now(),plans=selected.map(item=>lifecyclePlan({item,action:'discard',requestId:request_id,userId:user.id,now:date}));
   const nodes=plans.flatMap((p,index)=>p.nodes.map(node=>({...node,key:`discard:${index}`}))).sort((a,b)=>canonical(a.data).localeCompare(canonical(b.data)));
   return service.startPrepared({outlet_id,request_id,plan:{...plans[0],kind:'article-discard-many',input_fingerprint:fingerprint,nodes,articles:items.length}});
  },
  async lifecycle({outlet_id,id,action,request_id,expected}){
   assertOutletAccess(user,outlet_id);
   if(!text(request_id,80)||!/^[-A-Za-z0-9]{16,80}$/.test(request_id)||!text(id,100)||!['discard','restore'].includes(action))fail('ARTICLE_LIFECYCLE_INVALID',400);
   const c=await readAdminCatalog(store,outlet_id),item=c.items.find(i=>i.id===id),prior=c.outlet.catalog_admin_state;
   if(prior?.request_id===request_id){if(prior.input_fingerprint!==JSON.stringify({action,id}))fail('REQUEST_CONTENT_CHANGED');return view(c.outlet);}
   if(prior&&prior.status!=='completed')fail('CATALOG_OPERATION_PENDING');
   if(!item)fail('ARTICLE_NOT_FOUND',404);
   if(definitionFor(item,c).fingerprint!==expected)fail('ARTICLE_CHANGED_RELOAD');
   if(action==='discard'){
    const recipes=await store.find('OutletItem');
    if(recipes.some(i=>i.id!==id&&!isDeleted(i)&&i.recipe_items?.some(r=>r.article_id===id)))fail('ARTICLE_USED_IN_RECIPE');
   }
   return service.startPrepared({outlet_id,request_id,plan:lifecyclePlan({item,action,requestId:request_id,userId:user.id,now:now()})});
  },
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
   for(const input of inputs){
    const item=c.items.find(i=>i.id===input.id),global=c.globals.find(g=>g.id===item?.global_item_id);
    if(global&&global.unit_abbreviation!==input.unit){
     const linked=await store.find('OutletItem',{global_item_id:global.id});
     if(linked.length!==1||linked[0].id!==item.id)fail('SHARED_ARTICLE_REQUIRES_REVIEW');
    }
   }
   const plan={...makeCatalogPlan({catalog:c,articles:inputs,requestId:request_id,importing,expected,userId:user.id,now:now()}),input_fingerprint:fingerprint};
   return view(await checkpoint(o,plan));
  },
  async step({outlet_id,request_id,revision}){
   let o=await load(outlet_id),s=o.catalog_admin_state;
   if(!s||s.request_id!==request_id)fail('CATALOG_OPERATION_NOT_FOUND',404);
   if(s.status==='completed')return view(o);
   if(o.catalog_admin_revision!==revision)fail('CATALOG_CHANGED_RELOAD');
   const pending=s.nodes.slice(s.cursor);
   let results=s.results;
   try{
    for(let index=0;index<pending.length;){
     const node=pending[index];
     let next=index+1;
     if(node.kind==='create'){while(next<pending.length&&pending[next].kind==='create'&&pending[next].entity===node.entity)next++;}
     else if(node.kind==='activate'&&store.activateMany){while(next<pending.length&&pending[next].kind==='activate'&&pending[next].entity===node.entity&&pending[next].data.is_active===node.data.is_active)next++;}
     else if(['article-classification','article-discard-many'].includes(s.kind)&&node.entity==='OutletItem'&&store.classifyMany){while(next<pending.length&&pending[next].kind===node.kind&&pending[next].entity===node.entity&&equal(pending[next].data,node.data))next++;}
     const group=pending.slice(index,next);
     if(node.kind==='create')results=[...results,...await ensureCreated(group,results)];
     else if(['article-classification','article-discard-many'].includes(s.kind)&&node.entity==='OutletItem'&&store.classifyMany)results=[...results,...await store.classifyMany(group,results)];
     else if(node.kind==='activate'&&store.activateMany)await store.activateMany(group,results);
     else results=[...results,...await applyUpdate(node,results)];
     index=next;
    }
    return view(await checkpoint(o,{...s,status:'completed',cursor:s.nodes.length,completed_operations:s.nodes.length,total_operations:s.nodes.length,error:null,
     results:results.filter(r=>['OutletItem','SupplierItem'].includes(r.entity)),
     verification:{all_links_valid:true,zero_stocks_verified:s.kind==='catalog-import',articles:s.articles}}));
   }catch(error){
    // A step stays repeatable: creates match their persisted marker, updates their proven post-image.
    try{await checkpoint(o,{...s,status:'blocked',error:error instanceof BookingError?error.code:'CATALOG_WRITE_UNCERTAIN'});}catch{/* Preserve the prior lock. */}
    throw error;
   }
  },
 };
 return service;
}