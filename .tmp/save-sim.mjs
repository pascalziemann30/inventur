import fs from 'fs';
const mod=await import('../base44/shared/inventory/catalogAdmin.js');
const {createCatalogAdminService,adminStore,definitionFor}=mod;
const snap=JSON.parse(fs.readFileSync('.tmp/catalog.json','utf8'));
const db={};
for(const [k,v] of Object.entries(snap)) db[k==='outlet'?'Outlet':k[0].toUpperCase()+k.slice(1)]=k==='outlet'?[v]:v;
// collection names used by the store: Outlet, OutletItem, OutletStock, GlobalItem, SupplierItem, Supplier, Category, Unit
const entityOf=name=>({Outlet:'outlet',OutletItem:'items',OutletStock:'stocks',GlobalItem:'globals',SupplierItem:'offers',Supplier:'suppliers',Category:'categories',Unit:'units'})[name];
const rows=name=>db[entityOf(name)]||(db[entityOf(name)]=[]);
function matches(row,q){return Object.entries(q).every(([k,v])=>{
  if(k==='$or')return v.some(sub=>matches(row,sub));
  if(v&&typeof v==='object'&&'$in'in v)return v.$in.includes(row[k]);
  if(v&&typeof v==='object'&&'$exists'in v)return (k in row)===v.$exists;
  return JSON.stringify(row[k])===JSON.stringify(v);});}
function applySet(row,set){Object.assign(row,structuredClone(set));}
const e={
 get:async(name,id)=>structuredClone(rows(name).find(r=>r.id===id)||null),
 find:async(name,where)=>structuredClone(rows(name).filter(r=>matches(r,where))),
 updateMany:async(name,where,update)=>{const hit=rows(name).filter(r=>matches(r,where));hit.forEach(r=>applySet(r,update.$set||{}));return {success:true,has_more:false,updated:hit.length};},
 bulkCreate:async(name,docs)=>{const created=docs.map(d=>({...structuredClone(d),id:crypto.randomUUID()}));rows(name).push(...created);return created;},
 delete:async(name,id)=>{const i=rows(name).findIndex(r=>r.id===id);if(i>=0)rows(name).splice(i,1);return true;}
};
const outletId=snap.outlet.id;
const user={id:'password-admin:kuno15',role:'admin',data:{outlet_id:outletId},access_kind:'password_admin',outlet_id:outletId};
const store=adminStore(e);
const service=createCatalogAdminService({store,user,now:()=>new Date(2026,9,27,15,0,0).toISOString()});
const catalog={outlet:db.outlet,items:rows('OutletItem'),stocks:rows('OutletStock'),globals:rows('GlobalItem'),offers:rows('SupplierItem'),suppliers:rows('Supplier'),categories:rows('Category'),units:rows('Unit')};
const {availableSubcategories}=await import('../base44/shared/inventory/subcategories.js');
const subs=availableSubcategories(catalog.categories,outletId);
// choose an article with a matching subcategory and change it
let report=[];
const candidates=catalog.items.filter(i=>!i.deleted_at).slice(0,5);
for(const item of candidates){
  const row=definitionFor(item,catalog);
  const children=subs.filter(s=>s.parent_name===row.definition.category);
  if(!children.length)continue;
  const target=children.find(s=>s.id!==row.definition.subcategory_id)||children[0];
  const definition={...row.definition,subcategory_id:target.id};
  const request_id=crypto.randomUUID();
  try{
    let state=await service.start({outlet_id:outletId,request_id,articles:[definition],expected:row.fingerprint});
    let steps=0;
    while(state.operation.status!=='completed'&&steps<50){state=await service.step({outlet_id:outletId,request_id,revision:state.revision});steps++;}
    const after=rows('OutletItem').find(r=>r.id===item.id);
    report.push({name:item.display_name,target:target.name,status:state.operation.status,steps,saved:after.subcategory_id===target.id});
  }catch(err){report.push({name:item.display_name,target:target.name,error:err.code||err.message});}
}
console.log(JSON.stringify(report,null,1));
