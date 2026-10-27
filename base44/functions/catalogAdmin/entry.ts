import {createClient,createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {createCatalogAdminHandler} from './handler.js';
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';
import {locationEntryConfig,inventoryAppOrigin} from '../../shared/inventory/locationEntryConfig.js';
import {secrets} from 'base44:runtime';
import {assertProductionRuntime,inventoryProductionOrigin,normalizePublicInventoryRequest} from '../../shared/inventory/operationalAccess.js';
const appId='6975d510bbe0422af7fe76ca';
const handler=createCatalogAdminHandler({createClientFromRequest,
 resolveAdmin:(req,client)=>inventoryRequestActor(req,client,{...locationEntryConfig(secrets),environment:'prod'}),
 originAllowed:inventoryAppOrigin,
 // The article catalog always works on the app's live data, also from the builder preview.
 // Identity stays authoritative: only a signed-in app administrator reaches this point.
 defaultEnvironment:req=>{
  const origin=req.headers.get('Origin')||'';
  if(!inventoryAppOrigin(origin))throw Error('Environment mismatch');
  if(req.headers.get('X-Data-Env')!=='prod')throw Error('Environment mismatch');
  if(origin===inventoryProductionOrigin)assertProductionRuntime(req);
  return 'prod';
 },
 // One-off approved production preparation uses only the existing native admin's rights,
 // canonical global API and fixed app. Never forward a preview service token into production.
 productionClient:req=>createClient({appId,serverUrl:'https://base44.app',token:(req.headers.get('Authorization')||'').replace(/^Bearer /,''),headers:{'X-Data-Env':'prod'}}),
});

export default (req:Request)=>handler(normalizePublicInventoryRequest(req));