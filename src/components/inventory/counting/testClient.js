import {createClient} from '@base44/sdk';
import {appParams} from '@/lib/app-params';
import {entryTransport,passwordAdminMode} from '../entry/entryMode.js';
import {workflowDataEnvironment,workflowFunctionsVersion} from '../entry/dataEnvironment.js';

// Hosting origin + branch state choose transport; the server independently authorizes every request.
export const inventoryEnvironment=workflowDataEnvironment({origin:window.location.origin,functionsVersion:appParams.functionsVersion});
const options={appId:appParams.appId,functionsVersion:workflowFunctionsVersion({origin:window.location.origin,functionsVersion:appParams.functionsVersion}),
 serverUrl:'',appBaseUrl:appParams.appBaseUrl,requiresAuth:false};
const admin=createClient({...options,token:appParams.token,headers:{'X-Data-Env':inventoryEnvironment}});
const passwordAdmin=createClient({...options,token:appParams.token,headers:{'X-Data-Env':inventoryEnvironment,'X-Inventory-Mode':'password_admin'}});
const selectedAdmin=()=>passwordAdminMode()?passwordAdmin:admin;
export const inventoryAdminClient={functions:{invoke:(name,input)=>selectedAdmin().functions.invoke(name,input)},auth:admin.auth,entities:new Proxy({}, {get:(_target,name)=>{if(passwordAdminMode())throw Error('Bitte die geschützte Artikelverwaltung verwenden.');return admin.entities[name];}})};
const catalog=createClient({...options,token:appParams.token,headers:{'X-Data-Env':'prod'}});
const catalogPassword=createClient({...options,token:appParams.token,headers:{'X-Data-Env':'prod','X-Inventory-Mode':'password_admin'}});
// The article catalog always reads and writes the live data, in preview and in the published app.
export const inventoryCatalogClient={functions:{invoke:(name,input)=>(passwordAdminMode()?catalogPassword:catalog).functions.invoke(name,input)}};
// The admin session belongs to that same live data surface, in the preview and after publishing.
export const inventoryAdminSessionClient=inventoryCatalogClient;
export const inventoryAdminTestClient=createClient({...options,token:appParams.token,headers:{'X-Data-Env':'dev'}});
export const employeeTestClient=createClient({...options,headers:{'X-Data-Env':inventoryEnvironment,'X-Inventory-Mode':'employee'}});
export const inventoryTestClient=entryTransport({admin:inventoryAdminClient,employee:employeeTestClient});