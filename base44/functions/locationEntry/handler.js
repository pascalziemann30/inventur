import {BookingError} from '../../shared/inventory/quantities.js';
import {exchangeLocationLaunch,employeeLocationContext,base44LocationBindingStore} from '../../shared/inventory/locationEntry.js';
export function createLocationEntryHandler({createClientFromRequest,config,isEnabled,storeFor=base44LocationBindingStore}){
 return async req=>{
  try{
   if(req.method!=='POST')throw new BookingError('METHOD_NOT_ALLOWED',405);
   if(req.headers.get('X-Data-Env')!=='dev')throw new BookingError('TEST_DATA_ENV_REQUIRED',503);
   const raw=await req.text();if(raw.length>5000)throw new BookingError('REQUEST_TOO_LARGE',413);
   const body=JSON.parse(raw),fields={exchange:['launch'],context:[]};
   if(!body||!Object.hasOwn(fields,body.action)||Object.keys(body).some(k=>k!=='action'&&!fields[body.action].includes(k)))throw new BookingError('INVALID_REQUEST',400);
   if(body.action==='exchange'&&(await isEnabled(req))!==true)throw new BookingError('LOCATION_ENTRY_TEST_DISABLED',503);
   const store=storeFor(createClientFromRequest(req).asServiceRole.entities);
   if(body.action==='exchange'){
    const result=await exchangeLocationLaunch({req,launch:body.launch,config,store});
    return Response.json({outlet:result.outlet,is_admin:false},{headers:{'Set-Cookie':result.cookie,'Cache-Control':'no-store'}});
   }
   const result=await employeeLocationContext({req,config,store});
   return Response.json({outlet:result.outlet,is_admin:false,read_only:(await isEnabled(req))!==true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof BookingError?e.code:e instanceof SyntaxError?'INVALID_REQUEST':'LOCATION_ENTRY_UNAVAILABLE'},
   {status:e instanceof BookingError?e.status:e instanceof SyntaxError?400:503,headers:{'Cache-Control':'no-store'}});}
 };
}
