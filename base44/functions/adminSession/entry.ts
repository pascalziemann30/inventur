import {createClientFromRequest} from 'npm:@base44/sdk@0.8.57';
import {secrets} from 'base44:runtime';
import {createAdminSessionHandler} from './handler.js';
import {locationEntryConfig,inventoryAppOrigin} from '../../shared/inventory/locationEntryConfig.js';
import {inventoryProductionOrigin,inventoryWorkflowRuntime,normalizePublicInventoryRequest} from '../../shared/inventory/operationalAccess.js';
import {BookingError} from '../../shared/inventory/quantities.js';

// Production keeps its strict runtime check. A preview of this app signs in against the same
// live administration data as the article catalog, so it uses the production session there.
const resolveConfig=req=>{
 const origin=req.headers.get('Origin')||'';
 if(origin===inventoryProductionOrigin)return inventoryWorkflowRuntime(secrets,req).config;
 if(!inventoryAppOrigin(origin))throw new BookingError('ORIGIN_FORBIDDEN',403);
 const environment=req.headers.get('X-Data-Env');
 if(environment==='prod')return {...locationEntryConfig(secrets),environment:'prod',origins:[origin]};
 if(environment!=='dev')throw new BookingError('DATA_ENV_REQUIRED',503);
 return {...locationEntryConfig(secrets),environment:'dev',origins:[origin]};
};

export default async(req:Request)=>{
 try{
  const request=normalizePublicInventoryRequest(req);
  const config=resolveConfig(request);
  return await createAdminSessionHandler({createClientFromRequest,config})(request);
 }catch(error){
  return Response.json({error:error instanceof BookingError?error.code:'INVENTORY_UNAVAILABLE'},
   {status:error instanceof BookingError?error.status:503,headers:{'Cache-Control':'no-store'}});
 }
};