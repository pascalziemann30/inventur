import {BookingError} from './quantities.js';
import {isStorageProbeAllowed} from './storageProbeGate.js';
import {locationEntryConfig} from './locationEntryConfig.js';

export const inventoryAppId='6975d510bbe0422af7fe76ca';
export const kunoSourceAppId='69be564806537ae8df3b71ff';
export const kunoOutletId='697f405ef1744da8ba46c99d';
export const inventoryProductionOrigin='https://siftcntrl-bestand.base44.app';
export function operationalGrant(value){
 try{
  const grant=JSON.parse(value);
  return grant&&Object.keys(grant).sort().join(',')==='enabled,revision'&&typeof grant.enabled==='boolean'
   &&Number.isSafeInteger(grant.revision)&&grant.revision>0&&grant.revision<=1_000_000?grant:null;
 }catch{return null;}
}
/** Called before constructing a privileged SDK client. Production accepts only the main runtime.
 * The Base44 gateway injects app/version/API headers; a preview must never select prod by URL alone.
 */
export function assertProductionRuntime(req,{appId=inventoryAppId,origin=inventoryProductionOrigin}={}){
 const fail=()=>{throw new BookingError('PRODUCTION_CONTEXT_UNCONFIRMED',503);};
 if(req.headers.get('X-Data-Env')!=='prod'||req.headers.get('Origin')!==origin
  ||req.headers.get('Base44-App-Id')!==appId)fail();
 const version=req.headers.get('Base44-Functions-Version');
 if(version&&version!=='published'&&version!=='main'&&version!=='prod')fail();
 const api=req.headers.get('Base44-Api-Url');
 if(api&&api!=='https://base44.app'&&api!==origin)fail();
}
export function inventoryWorkflowRuntime(secrets,req){
 const environment=req.headers.get('X-Data-Env');
 if(environment==='dev')return {environment,config:locationEntryConfig(secrets),
  enabled:isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED'))};
 if(environment!=='prod')throw new BookingError('DATA_ENV_REQUIRED',503);
 assertProductionRuntime(req);
 const grant=operationalGrant(secrets.get('INVENTORY_KUNO_PRODUCTION_ACCESS'));
 if(!grant?.enabled)throw new BookingError('INVENTORY_PRODUCTION_DISABLED',503);
 const config={...locationEntryConfig(secrets),environment:'prod',origins:[inventoryProductionOrigin],
  productionEnabled:true,productionRevision:grant.revision,productionOutletId:kunoOutletId};
 if(config.issuer!==kunoSourceAppId)throw new BookingError('PRODUCTION_SOURCE_UNCONFIRMED',503);
 // Existing independently generated launch/session secrets remain server-only. Signed claims,
 // cookie names, origins and binding queries isolate environments even with the same key material.
 return {environment,config,enabled:true};
}
export function serveInventoryWorkflow({secrets,createClientFromRequest,createHandler}){
 return async req=>{
  try{
   // The exact published origin uses only production. The canonical runtime
   // check below still rejects branch/app/API mismatches before SDK access.
   if(req.headers.get('Origin')===inventoryProductionOrigin&&[null,'dev','prod'].includes(req.headers.get('X-Data-Env'))){
    const headers=new Headers(req.headers);headers.set('X-Data-Env','prod');
    req=new Request(req,{headers});
   }
   const runtime=inventoryWorkflowRuntime(secrets,req);
   return await createHandler({runtime,createClientFromRequest})(req);
  }catch(error){return Response.json({error:error instanceof BookingError?error.code:'INVENTORY_UNAVAILABLE'},
   {status:error instanceof BookingError?error.status:503,headers:{'Cache-Control':'no-store'}});}
 };
}
