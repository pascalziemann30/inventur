import fs from 'fs';
const {createCatalogAdminService,adminStore,definitionFor}=await import('../base44/shared/inventory/catalogAdmin.js');
const {availableSubcategories}=await import('../base44/shared/inventory/subcategories.js');
const snap=JSON.parse(fs.readFileSync('.tmp/catalog.json','utf8'));
const map={Outlet:'outlet',OutletItem:'items',OutletStock:'stocks',GlobalItem:'globals',SupplierItem:'offers',Supplier:'suppliers',Category:'categories',Unit:'units',DeliveryDraft:'drafts',PriceHistory:'prices'};
const db=structuredClone(snap); db.outlet=[structuredClone(snap.outlet)]; db.drafts=[]; db.prices=[];
const rows=n=>db[map[n]]||(db[map[n]]=[]);
function matches(row,q){return Object.entries(q).every(([k,v])=>{
 if(k==='$or')return v.some(s=>matches(row,s));
 if(v&&typeof v==='object'&&'$in'in v)return v.$in.includes(row[k]);
 if(v&&typeof v==='object'&&'$exists'in v)return (k in row)===v.$exists;
 return JSON.stringify(row[k])===JSON.stringify(v);});}
const ent=n=>({
 get:async id=>structuredClone(rows(n).find(r=>r.id===id)||null),
 find:async(w={})=>structuredClone(rows(n).filter(r=>matches(r,w))),
 filter:async(w={})=>structuredClone(rows(n).filter(r=>matches(r,w))),
 updateMany:async(w,u)=>{const hit=rows(n).filter(r=>matches(r,w));hit.forEach(r=>Object.assign(r,structuredClone(u.$set||{})));return{success:true,has_more:false,updated:hit.length};},
 bulkCreate:async docs=>{const c=docs.map(d=>({...structuredClone(d),id:crypto.randomUUID()}));rows(n).push(...c);return c;},
 delete:async id=>{const a=rows(n);const i=a.findIndex(r=>r.id===id);if(i>=0)a.splice(i,1);return true;}});
const e=new Proxy({},{get:(_,n)=>ent(n)});
const outletId=snap.outlet.id;
const user={id:'password-admin:kuno15',role:'admin',data:{outlet_id:outletId},access_kind:'password_admin',outlet_id:outletId};
const service=createCatalogAdminService({store:adminStore(e),user,now:()=>'2026-10-27T15:00:00.000Z'});
const catalog={outlet:db.outlet[0],items:rows('OutletItem'),stocks:rows('OutletStock'),globals:rows('GlobalItem'),offers:rows('SupplierItem'),suppliers:rows('Supplier'),categories:rows('Category'),units:rows('Unit')};
const subs=availableSubcategories(catalog.categories,outletId);
const targets=catalog.items.filter(i=>!i.deleted_at&&!i.subcategory_id);
const out=[];
for(const item of targets){
 const row=definitionFor(item,catalog);
 const children=subs.filter(s=>s.parent_name===row.definition.category);
 if(!children.length){out.push({name:item.display_name,skip:'keine Unterkategorie',cat:row.definition.category});continue;}
 const target=children[0];
 const definition={...row.definition,subcategory_id:target.id};
 const request_id=crypto.randomUUID();
 const entry={name:item.display_name,cat:row.definition.category,target:target.name,active:item.is_active,links:row.links_valid};
 try{
  let state=await service.start({outlet_id:outletId,request_id,articles:[definition],expected:row.fingerprint});
  let steps=0;
  while(state.operation.status!=='completed'&&steps<50){state=await service.step({outlet_id:outletId,request_id,revision:state.revision});steps++;}
  const after=rows('OutletItem').find(r=>r.id===item.id);
  entry.status=state.operation.status;entry.saved=after.subcategory_id===target.id;entry.opError=state.operation.error||null;
 }catch(err){entry.error=err.code||err.message;entry.detail=(err.message||'').slice(0,120);}
 out.push(entry);
}
const failed=out.filter(o=>o.error||o.status!=='completed'||o.saved===false||o.skip);
console.log(JSON.stringify({total:out.length,failed:failed.slice(0,25),failedCount:failed.length},null,1));
