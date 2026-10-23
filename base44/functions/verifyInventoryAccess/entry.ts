import {createClient,createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createVerifyInventoryAccessHandler} from './handler.js';
export default req=>createVerifyInventoryAccessHandler({createClientFromRequest,
 createAnonymousClient:appId=>createClient({appId,requiresAuth:false,headers:{'X-Data-Env':'dev'}}),
 appId:secrets.get('BASE44_APP_ID'),origin:'https://preview--6975d510bbe0422af7fe76ca--b-c2d3901.base44.app',
})(req);
