import {createClient,createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {createCatalogAdminHandler} from './handler.js';
import {assertProductionRuntime} from '../../shared/inventory/operationalAccess.js';
const appId='6975d510bbe0422af7fe76ca';
export default createCatalogAdminHandler({createClientFromRequest,
 originAllowed:origin=>['https://preview--6975d510bbe0422af7fe76ca--b-c2d3901.base44.app','https://siftcntrl-bestand.base44.app'].includes(origin),
 defaultEnvironment:req=>{
  const env=req.headers.get('Origin')==='https://preview--6975d510bbe0422af7fe76ca--b-c2d3901.base44.app'?'dev':'prod';
  if(req.headers.get('X-Data-Env')!==env)throw Error('Environment mismatch');
  if(env==='prod')assertProductionRuntime(req);
  return env;
 },
 // One-off approved production preparation uses only the existing native admin's rights,
 // canonical global API and fixed app. Never forward a preview service token into production.
 productionClient:req=>createClient({appId,serverUrl:'https://base44.app',token:(req.headers.get('Authorization')||'').replace(/^Bearer /,''),headers:{'X-Data-Env':'prod'}}),
});
