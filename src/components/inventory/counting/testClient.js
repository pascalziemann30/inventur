import {createClient} from '@base44/sdk';
import {appParams} from '@/lib/app-params';
import {entryTransport} from '../entry/entryMode.js';

// Pre-release clients always use Test Data. The marker is never an authorization.
const options={appId:appParams.appId,functionsVersion:appParams.functionsVersion,
 serverUrl:'',appBaseUrl:appParams.appBaseUrl,requiresAuth:false};
const admin=createClient({...options,token:appParams.token,headers:{'X-Data-Env':'dev'}});
export const employeeTestClient=createClient({...options,headers:{'X-Data-Env':'dev','X-Inventory-Mode':'employee'}});
export const inventoryTestClient=entryTransport({admin,employee:employeeTestClient});
