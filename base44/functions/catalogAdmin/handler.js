import {articleFieldLabels} from '../../shared/inventory/articleFields.js';
import {assertOutletAccess} from '../../shared/inventory/stock.js';
import {BookingError} from '../../shared/inventory/quantities.js';
import {adminStore,createCatalogAdminService} from '../../shared/inventory/catalogAdmin.js';
import {readAdminHistory,readAdminQueue,historyCsv,reviewPrice,priceReviewPlan} from '../../shared/inventory/adminHistory.js';
const allowed={discardMany:['outlet_id','request_id','items'],classify:['outlet_id','request_id','groups','assignments'],subcategory:['outlet_id','request_id','mode','parent','id','name','keywords','expected'],lifecycle:['outlet_id','id','action_kind','request_id','expected'],outlets:['outlet_id'],list:['outlet_id'],status:['outlet_id'],start:['outlet_id','request_id','articles','importing','expected'],step:['outlet_id','request_id','revision'],queue:['outlet_id'],history:['outlet_id'],export:['outlet_id','id'],price:['outlet_id','draft_id','line_id','decision','request_id']};
export function createCatalogAdminHandler({createClientFromRequest,productionClient,originAllowed,defaultEnvironment,now,resolveAdmin=(_req,client)=>client.auth.me()}){
 return async req=>{
  try{
   if(req.method!=='POST')throw new BookingError('METHOD_NOT_ALLOWED',405);
   if(!originAllowed(req.headers.get('Origin')))throw new BookingError('ORIGIN_FORBIDDEN',403);
   const client=createClientFromRequest(req);let user;
   try{user=await resolveAdmin(req,client);}catch{throw new BookingError('AUTHENTICATION_REQUIRED',401);}
   if(!user?.id||user.role!=='admin')throw new BookingError('ADMIN_REQUIRED',403);
   const raw=await req.text();if(raw.length>1_500_000)throw new BookingError('REQUEST_TOO_LARGE',413);
   const body=JSON.parse(raw);
   if(!body||typeof body!=='object'||Array.isArray(body))throw new BookingError('INVALID_REQUEST',400);
   const environment=body.target_environment||defaultEnvironment(req);
   if(body.action==='price'&&(typeof body.request_id!=='string'||!/^[-A-Za-z0-9]{16,80}$/.test(body.request_id)))throw new BookingError('INVALID_REQUEST',400);
   if(!body||!Object.hasOwn(allowed,body.action)||Object.keys(body).some(k=>!['action','target_environment',...allowed[body.action]].includes(k)))throw new BookingError('INVALID_REQUEST',400);
   if(!['dev','prod'].includes(environment)||!body.outlet_id||typeof body.outlet_id!=='string')throw new BookingError('DATA_ENV_REQUIRED',400);
   assertOutletAccess(user,body.outlet_id);
   let e;
   const productionMigration=environment==='prod'&&defaultEnvironment(req)==='dev';
   if(productionMigration){
    if(!['list','status','start','step'].includes(body.action))throw new BookingError('PRODUCTION_MAIN_RUNTIME_REQUIRED',503);
    if(body.outlet_id!=='697f405ef1744da8ba46c99d')throw new BookingError('KUNO_PRODUCTION_OUTLET_REQUIRED',403);
    const native=productionClient(req);const verified=await native.auth.me();
    if(verified?.id!==user.id||verified?.role!=='admin')throw new BookingError('PRODUCTION_IDENTITY_UNCONFIRMED',403);
    e=native.entities;
   }else{
    if(req.headers.get('X-Data-Env')!==environment)throw new BookingError('DATA_ENV_MISMATCH',403);
    e=client.asServiceRole.entities;
   }
   const store=adminStore(e),service=createCatalogAdminService({store,user,now});
   const {action,target_environment,...input}=body;let result;
   if(action==='outlets'){const rows=await e.Outlet.filter({is_active:true},'name',100);result={outlets:rows.filter(o=>o.type!=='AGGREGATOR'&&(user.access_kind!=='password_admin'||o.id===user.outlet_id)).map(o=>({id:o.id,name:o.name,is_active:o.is_active,type:o.type}))};}
   else if(['history','export'].includes(action)){const history=await readAdminHistory(e,input.outlet_id);result=action==='history'?history:{filename:`Inventur-${input.id}.csv`,content:historyCsv(history,input.id)};}
   else if(action==='list'&&productionMigration)result=await service.list({...input,cleanup:false});
   else if(action==='queue')result=await readAdminQueue(e,input.outlet_id);
   else if(action==='price'){
    const context=await reviewPrice({e,store,user,outletId:input.outlet_id,draftId:input.draft_id,lineId:input.line_id,decision:input.decision,requestId:input.request_id,now});
    result=context.completed?await service.status(input):await service.startPrepared({outlet_id:input.outlet_id,request_id:input.request_id,plan:await priceReviewPlan(context,{store,requestId:input.request_id})});
   }else if(action==='lifecycle'){const {action_kind,...rest}=input;result=await service.lifecycle({...rest,action:action_kind});}
   else result=await service[action](input);
   return Response.json({...result,data_environment:environment},{headers:{'Cache-Control':'no-store'}});
  }catch(error){const transportStatus=error?.status??error?.response?.status;return Response.json({error:error instanceof BookingError?error.code:error instanceof SyntaxError?'INVALID_REQUEST':transportStatus===429?'CATALOG_RATE_LIMITED':'CATALOG_REQUEST_UNCERTAIN_RELOAD',...(error?.code==='ARTICLE_REQUIRED_FIELDS'&&Object.hasOwn(articleFieldLabels,error.field)?{field:error.field}:{}),...(Number.isInteger(transportStatus)?{transport_status:transportStatus}:{})},
   {status:error instanceof BookingError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'no-store'}});}
 };
}
