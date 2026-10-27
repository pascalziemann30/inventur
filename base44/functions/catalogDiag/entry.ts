import {createClientFromRequest} from 'npm:@base44/sdk@0.8.57';
import {adminStore,createCatalogAdminService,readAdminCatalog,definitionFor} from '../../shared/inventory/catalogAdmin.js';
import {readAdminQueue,readAdminHistory} from '../../shared/inventory/adminHistory.js';

const outletId='697f405ef1744da8ba46c99d';
const user={id:'password-admin:kuno15',role:'admin',access_kind:'password_admin',outlet_id:outletId,data:{outlet_id:outletId}};

const describe=error=>({name:error?.name,message:error?.message,code:error?.code,status:error?.status,stack:String(error?.stack||'').split('\n').slice(0,4)});

export default async function(req){
 const client=createClientFromRequest(req);
 const e=client.asServiceRole.entities;
 const store=adminStore(e);
 const service=createCatalogAdminService({store,user});
 const steps={};
 const run=async(name,fn)=>{try{steps[name]=await fn();}catch(error){steps[name]=describe(error);}};

 await run('catalog',async()=>{
  const c=await readAdminCatalog(store,outletId);
  return {items:c.items.length,stocks:c.stocks.length,offers:c.offers.length,suppliers:c.suppliers.length,categories:c.categories.length,units:c.units.length};
 });
 await run('map',async()=>{
  const c=await readAdminCatalog(store,outletId);
  let fails=0;let first=null;
  for(const item of c.items){
   try{definitionFor(item,c);}catch(error){fails++;if(!first)first={id:item.id,name:item.display_name,...describe(error)};}
  }
  return {mapped:c.items.length-fails,fails,first};
 });
 await run('list',async()=>{const r=await service.list({outlet_id:outletId,cleanup:false});return {articles:r.articles.length,suppliers:r.suppliers.length,units:r.units.length,operation:r.operation?.status??null};});
 await run('status',async()=>(await service.status({outlet_id:outletId})).operation?.status??null);
 await run('queue',async()=>{const r=await readAdminQueue(e,outletId);return Array.isArray(r)?r.length:typeof r;});
 await run('history',async()=>{const r=await readAdminHistory(e,outletId);return Array.isArray(r)?r.length:typeof r;});
 return Response.json(steps);
}