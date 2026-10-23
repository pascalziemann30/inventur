import {adminManagedEntities,serverOwnedEntities} from '../../shared/inventory/entityAccessPolicy.js';
const blocked = error => [401,403,404].includes(error?.status ?? error?.response?.status);
export function createProductionReadAccessHandler({createClientFromRequest,createProductionClients,appId,origin}) {
 return async req=>{
  try{
   if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
   if(req.headers.get('Origin')!==origin)return Response.json({error:'ORIGIN_FORBIDDEN'},{status:403});
   let user;try{user=await createClientFromRequest(req).auth.me();}catch{return Response.json({error:'AUTHENTICATION_REQUIRED'},{status:401});}
   if(!user?.id||user.role!=='admin')return Response.json({error:'ADMIN_REQUIRED'},{status:403});
   if((await req.text()).trim()!=='{"action":"check"}')return Response.json({error:'INVALID_REQUEST'},{status:400});
   if(typeof appId!=='string'||!/^[a-f0-9]{24}$/.test(appId))return Response.json({error:'APP_NOT_CONFIGURED'},{status:503});
   // Fixed global Base44 API and explicit prod header. No branch service token is used for production records.
   const {caller,anonymous}=createProductionClients(req,appId);
   let identity;try{identity=await caller.auth.me();}catch{return Response.json({error:'PRODUCTION_IDENTITY_UNCONFIRMED'},{status:403});}
   if(identity?.id!==user.id||identity?.role!=='admin')return Response.json({error:'PRODUCTION_IDENTITY_UNCONFIRMED'},{status:403});
   const checks=[];let tested=0,failures=0;
   for(const name of [...adminManagedEntities,...serverOwnedEntities]){
    const managed=adminManagedEntities.includes(name);let rows;
    try{rows=await caller.entities[name].list('id',1);if(!Array.isArray(rows))throw Error('Invalid result');}
    catch(error){if(!managed&&blocked(error)){checks.push({entity:name,service_read:'not_probed',admin_read:'denied',anonymous_read:'no_sample'});continue;}failures++;checks.push({entity:name,service_read:'not_probed',admin_read:'error',anonymous_read:'untested'});continue;}
    if(!rows.length){checks.push({entity:name,service_read:'not_probed',admin_read:'no_sample',anonymous_read:'no_sample'});continue;}
    tested++;const id=rows[0]?.id;if(!managed||typeof id!=='string'){failures++;checks.push({entity:name,service_read:'not_probed',admin_read:managed?'error':'allowed',anonymous_read:'untested'});continue;}
    let anon='error';try{const found=await anonymous.entities[name].filter({id},'id',1);anon=Array.isArray(found)&&found.length===0?'denied':Array.isArray(found)&&found.some(row=>row?.id===id)?'allowed':'error';}catch(error){anon=blocked(error)?'denied':'error';}
    if(anon!=='denied')failures++;
    checks.push({entity:name,service_read:'not_probed',admin_read:'allowed',anonymous_read:anon});
   }
   return Response.json({data_environment:'prod',production_identity_confirmed:true,passed:tested>0&&failures===0,tested_models:tested,empty_models:checks.filter(row=>row.admin_read==='no_sample'||row.anonymous_read==='no_sample').length,checks,write_probe_performed:false,native_non_admin_account_tested:false},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'PRODUCTION_READ_CHECK_UNAVAILABLE'},{status:503});}
 };
}
