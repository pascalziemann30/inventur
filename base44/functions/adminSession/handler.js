import {BookingError} from '../../shared/inventory/quantities.js';
import {adminPasswordConfigured,adminSessionStore,adminSessionContext,loginAdminPassword,clearAdminCookie} from '../../shared/inventory/adminSession.js';
export function createAdminSessionHandler({createClientFromRequest,config,storeFor=adminSessionStore,now=Date.now}){
 return async req=>{
  try{
   if(req.method!=='POST')throw new BookingError('METHOD_NOT_ALLOWED',405);
   if(!config.origins.includes(req.headers.get('Origin'))||req.headers.get('X-Data-Env')!==(config.environment||'dev'))throw new BookingError('ORIGIN_FORBIDDEN',403);
   const raw=await req.text();if(raw.length>1500)throw new BookingError('REQUEST_TOO_LARGE',413);
   const body=JSON.parse(raw);if(!body||Array.isArray(body)||!['context','login','logout'].includes(body.action)||Object.keys(body).some(k=>!['action',...(body.action==='login'?['password']:[])].includes(k)))throw new BookingError('INVALID_REQUEST',400);
   const client=createClientFromRequest(req),store=storeFor(client.asServiceRole.entities);
   if(body.action==='logout')return Response.json({authenticated:false},{headers:{'Cache-Control':'no-store','Set-Cookie':clearAdminCookie(config)}});
   if(body.action==='login'){
    const result=await loginAdminPassword({password:body.password,config,store,now:now()});
    return Response.json({authenticated:true,method:'password',outlet:result.outlet},{headers:{'Cache-Control':'no-store','Set-Cookie':result.cookie}});
   }
   // Existing native administrators remain usable for maintenance, with no public login redirect.
   if(req.headers.get('X-Inventory-Mode')!=='employee'){
    try{const native=await client.auth.me();if(native?.id&&native.role==='admin')return Response.json({authenticated:true,method:'native'},{headers:{'Cache-Control':'no-store'}});}catch{}
   }
   try{const result=await adminSessionContext({req,config,store,now:now()});return Response.json({authenticated:true,method:'password',outlet:result.outlet},{headers:{'Cache-Control':'no-store',...(result.cookie?{'Set-Cookie':result.cookie}:{})}});}catch(error){if(!(error instanceof BookingError)||!['ADMIN_PASSWORD_REQUIRED'].includes(error.code))throw error;}
   return Response.json({authenticated:false,configured:adminPasswordConfigured(config)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof BookingError?error.code:error instanceof SyntaxError?'INVALID_REQUEST':'ADMIN_LOGIN_UNAVAILABLE'},{status:error instanceof BookingError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'no-store'}});}
 };
}
