import {createClient} from '@base44/sdk';
import {appParams} from '@/lib/app-params';

// Dedicated client: this entire pre-release workflow always reads/writes Test Data.
// Do not reuse it for the production cutover or infer an environment from a claimed role.
export const inventoryTestClient=createClient({
    appId:appParams.appId,token:appParams.token,functionsVersion:appParams.functionsVersion,
    serverUrl:'',appBaseUrl:appParams.appBaseUrl,requiresAuth:false,headers:{'X-Data-Env':'dev'},
});
