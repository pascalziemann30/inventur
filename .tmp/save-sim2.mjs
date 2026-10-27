import fs from 'fs';
const {createCatalogAdminService,adminStore,definitionFor}=await import('../base44/shared/inventory/catalogAdmin.js');
const {availableSubcategories}=await import('../base44/shared/inventory/subcategories.js');
const snap=JSON.parse(fs.readFileSync('.tmp/catalog.json','utf8'));
const map={Outlet:'outlet',OutletItem:'items',OutletStock:'stocks',GlobalItem:'globals',SupplierItem:'offers',Supplier:'suppliers',Category:'categories',Unit:'units'};
const db=structuredClone(snap); db.Outlet=[structuredClone(snap.outlet)];
const rows=name=>db[map[name]];
function matches(row,q){return Object.entries(q).every(([k,v])=>{
 if(k==='$or')return v.some(s=>matches(row,s));
 if(v&&typeof v==='object'&&'$in'in v)return v.$in.includes(row[k]);
 if(v&&typeof v==='object'&&'$exists'in v)return (k in row)===v.$exists;
 return JSON.stringify(row[k])===JSON.stringify(v);});}
const e={
 get:async(n,id)=>structuredClone(db[map[n]].find(r=>r.id===id)||null),
 find:async(n,w)=>structuredClone(db[map[n]].filter(r=>matches(r,w))),
 updateMany:async(n,w,u)=>{const hit=db[map[n]].filter(r=>matches(r,w));hit.forEach(r=>Object.assign(r,structuredClone(u.$set||{})));return{success:true,has_more:false,updated:hit.length};},
 bulkCreate:async(n,docs)=>{const c=docs.map(d=>({...structuredClone(d),id:crypto.randomUUID()}));db[map[n]].push(...c);return c;},
 delete:async(n,id)=>{const a=db[map[n]];const i=a.findIndex(r=>r.id===id);if(i>=0)a.splice(i,1);return true;}};
const outletId=snap.outlet.id;
const user={id:'password-admin:kuno15',role:'admin',data:{outlet_id:outletId},access_kind:'password_admin',outlet_id:outletId};
const service=createCatalogAdminService({store:adminStore(e),user,now:()=>'2026-10-27T15:00:00.000Z'});
const catalog={outlet:db.Outlet[0],items:rows('OutletItem'),stocks:rows('OutletStock'),globals:rows('GlobalItem'),offers:rows('SupplierItem'),suppliers:rows('Supplier'),categories:rows('Category'),units:rows('Unit')};
const subs=availableSubcategories(catalog.categories,outletId);
console.error('subs',subs.length);
const out=[];
for(const item of catalog.items.filter(i=>!i.deleted_at)){
 const row=definitionFor(item,catalog);
 const children=subs.filter(s=>s.parent_name===row.definition.category);
 if(!children.length)continue;
 if(out.length>=6)break;
 const target=children.find(s=>s.id!==row.definition.subcategory_id)||children[0];
 const definition={...row.definition,subcategory_id:target.id};
 const request_id=crypto.randomUUID();
 const entry={name:item.display_name,cat:row.definition.category,target:target.name};
 try{
  let state=await service.start({outlet_id:outletId,request_id,articles:[definition],expected:row.fingerprint});
  let steps=0;
  while(state.operation.status!=='completed'&&steps<50){state=await service.step({outlet_id:outletId,request_id,revision:state.revision});steps++;}
  const after=rows('OutletItem').find(r=>r.id===item.id);
  entry.status=state.operation.status;entry.steps=steps;entry.saved=after.subcategory_id===target.id;entry.error=state.operation.error;
 }catch(err){entry.error=err.code||err.message;}
 out.push(entry);
}
console.log(JSON.stringify(out,null,1));
