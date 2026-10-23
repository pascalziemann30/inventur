import {createClient,createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createProductionReadAccessHandler} from './handler.js';
export default req=>createProductionReadAccessHandler({createClientFromRequest,
 appId:secrets.get('BASE44_APP_ID'),origin:'https://preview--6975d510bbe0422af7fe76ca--b-c2d3901.base44.app',
 createProductionClients:(request,appId)=>{
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')||authorization.split(' ').length!==2)throw Error('Missing native identity');
  const options={appId,serverUrl:'https://base44.app',requiresAuth:false,headers:{'X-Data-Env':'prod'}};
  return {caller:createClient({...options,token:authorization.slice(7)}),anonymous:createClient(options)};
 },
})(req);
