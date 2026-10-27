import {createClient,createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {createCatalogAdminHandler} from './handler.js';
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';
import {locationEntryConfig,inventoryAppOrigin} from '../../shared/inventory/locationEntryConfig.js';
import {secrets} from 'base44:runtime';
import {assertProductionRuntime,inventoryProductionOrigin,normalizePublicInventoryRequest} from '../../shared/inventory/operationalAccess.js';
const appId='6975d510bbe0422af7fe76ca';
const bearer=req=>{const value=req.headers.get('Authorization')||'';return value.startsWith('Bearer ')?value.slice(7).trim():'';};
// The article catalog always works on the app's live data, in the published app and in the preview.
// The data surface is decided here, never by a browser-supplied header, and identity stays authoritative:
// only a signed-in app administrator reaches this point, verified against the same live data.
const productionClient=req=>createClient({appId,serverUrl:'https://base44.app',token:bearer(req),headers:{'X-Data-Env':'prod'}});
const handler=createCatalogAdminHandler({createClientFromRequest,productionClient,
 resolveAdmin:req=>inventoryRequestActor(req,productionClient(req),{...locationEntryConfig(secrets),environment:'prod'}),
 originAllowed:inventoryAppOrigin,
 defaultEnvironment:req=>{
  const origin=req.headers.get('Origin')||'';
  if(!inventoryAppOrigin(origin))throw Error('Origin not allowed');
  if(origin===inventoryProductionOrigin)assertProductionRuntime(req);
  return 'prod';
 },
});

export default (req:Request)=>handler(normalizePublicInventoryRequest(req));