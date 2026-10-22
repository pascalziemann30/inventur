import {issueLocationLaunch} from '../../base44/shared/inventory/locationEntry.js';

/** Integration factory for Shift Control's server. No browser-provided location is accepted. */
export function createInventoryLaunchHandler({resolveWorkContext,issuer,secret,sourceOrigin,targetUrl}){
 return async request=>{
  try{
   if(request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
   const target=new URL(targetUrl);
   if(target.protocol!=='https:'||target.username||target.password||target.hash||!sourceOrigin||request.headers.get('Origin')!==sourceOrigin)
    return Response.json({error:'ENTRY_ORIGIN_FORBIDDEN'},{status:403});
   const text=await request.text();
   if(text.trim()&&text.trim()!=='{}')return Response.json({error:'INVALID_REQUEST'},{status:400});
   const launch=await issueLocationLaunch({request,resolveWorkContext,issuer,secret});
   target.searchParams.set('workflow','entry');
   target.hash=new URLSearchParams({inventory_launch:launch}).toString();
   return Response.json({url:target.href},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch{return Response.json({error:'LOCATION_ENTRY_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
 };
}
