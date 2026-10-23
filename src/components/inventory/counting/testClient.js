import {createClient} from '@base44/sdk';
import {appParams} from '@/lib/app-params';
import {entryTransport} from '../entry/entryMode.js';
import {workflowDataEnvironment} from '../entry/dataEnvironment.js';

// Hosting origin + branch state choose transport; the server independently authorizes every request.
export const inventoryEnvironment=workflowDataEnvironment({origin:window.location.origin,functionsVersion:appParams.functionsVersion});
const options={appId:appParams.appId,functionsVersion:appParams.functionsVersion,
 serverUrl:'',appBaseUrl:appParams.appBaseUrl,requiresAuth:false};
const admin=createClient({...options,token:appParams.token,headers:{'X-Data-Env':inventoryEnvironment}});
export const inventoryAdminTestClient=createClient({...options,token:appParams.token,headers:{'X-Data-Env':'dev'}});
export const employeeTestClient=createClient({...options,headers:{'X-Data-Env':inventoryEnvironment,'X-Inventory-Mode':'employee'}});
export const inventoryTestClient=entryTransport({admin,employee:employeeTestClient});
