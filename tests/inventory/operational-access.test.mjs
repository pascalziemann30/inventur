import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryWorkflowRuntime,serveInventoryWorkflow,inventoryAppId,kunoSourceAppId,kunoOutletId,inventoryProductionOrigin} from '../../base44/shared/inventory/operationalAccess.js';
import {base44LocationBindingStore,exchangeLocationLaunch,employeeLocationContext,employeeCookie} from '../../base44/shared/inventory/locationEntry.js';
import {workflowDataEnvironment,workflowFunctionsVersion} from '../../src/components/inventory/entry/dataEnvironment.js';
import {createInventoryRunsHandler} from '../../base44/functions/inventoryRuns/handler.js';

const at=1800000000000,launchSecret='synthetic-launch-key-at-least-32-bytes-not-real',sessionSecret='synthetic-session-key-at-least-32-bytes-not-real';
function fixture(){
 const settings={INVENTORY_KUNO_PRODUCTION_ACCESS:JSON.stringify({enabled:true,revision:1}),INVENTORY_SHIFT_SOURCE_ID_DEV:kunoSourceAppId,
  INVENTORY_SHIFT_LAUNCH_KEY_DEV:launchSecret,INVENTORY_EMPLOYEE_SESSION_KEY_DEV:sessionSecret};
 const secrets={get:key=>settings[key]};
 const headers={Origin:inventoryProductionOrigin,'X-Data-Env':'prod','Base44-App-Id':inventoryAppId,'Base44-Api-Url':'https://base44.app'};
 const req=(patch={},cookie='')=>new Request(`${inventoryProductionOrigin}/api/test`,{method:'POST',headers:{...headers,...patch,...(cookie?{Cookie:cookie}:{})},body:'{}'});
 const runtime=()=>inventoryWorkflowRuntime(secrets,req());
 const outlet={id:kunoOutletId,name:'Kuno 15 · freely renamed',is_active:true,type:'NORMAL'};
 let reads=0;
 const entities={Outlet:{get:async id=>{reads++;assert.equal(id,kunoOutletId);return structuredClone(outlet);}}};
 const store=config=>base44LocationBindingStore(entities,config);
 const issue=async(patch={})=>{
  const payload=Buffer.from(JSON.stringify({v:1,kind:'launch',issuer:kunoSourceAppId,audience:'inventory',environment:'prod',location_id:kunoSourceAppId,actor_ref:'synthetic-shared-actor',issued_at:at,expires_at:at+90000,...patch})).toString('base64url');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(launchSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return `${payload}.${Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`inventory-launch-v1.${payload}`))).toString('base64url')}`;
 };
 const exchange=async()=>{const {config}=runtime();return exchangeLocationLaunch({req:req(),config,store:store(config),launch:await issue(),now:at});};
 return {settings,secrets,req,runtime,store,issue,exchange,outlet,reads:()=>reads};
}
test('production defaults closed, requires an exact grant and never falls back to the test window',()=>{
 for(const value of [undefined,'enabled','{}','null',JSON.stringify({enabled:false,revision:1}),JSON.stringify({enabled:true,revision:0}),JSON.stringify({enabled:true,revision:1,expires_at:at})]){
  const f=fixture();f.settings.INVENTORY_KUNO_PRODUCTION_ACCESS=value;
  assert.throws(f.runtime,{code:'INVENTORY_PRODUCTION_DISABLED'});
 }
 const f=fixture();assert.equal(f.runtime().enabled,true);assert.equal(f.runtime().environment,'prod');
 f.settings.INVENTORY_SHIFT_SOURCE_ID_DEV='untrusted';assert.throws(f.runtime,{code:'PRODUCTION_SOURCE_UNCONFIRMED'});
});
test('preview/branch, foreign origin/app/API and unknown environments are rejected before SDK access',async()=>{
 const f=fixture();let touched=0;
 const handler=serveInventoryWorkflow({secrets:f.secrets,createClientFromRequest:()=>{touched++;},createHandler:()=>{touched++;}});
 for(const patch of [{'Base44-Functions-Version':'branch:synthetic'},{'Base44-Functions-Version':'arbitrary'},
  {'Base44-Api-Url':'https://preview.example.invalid'},{'Base44-App-Id':'foreign'},{Origin:'https://foreign.example.invalid'},
  {'X-Data-Env':'unrecognized'}])assert((await handler(f.req(patch))).status>=400);
 assert.equal(touched,0);
});
test('test runtime remains gated and uses its original preview origin; a prod flag cannot open it',()=>{
 const f=fixture(),runtime=inventoryWorkflowRuntime(f.secrets,f.req({'X-Data-Env':'dev'}));
 assert.equal(runtime.environment,'dev');assert.equal(runtime.enabled,false);
 assert(!runtime.config.origins.includes(inventoryProductionOrigin));
});
test('production cookie has a separate name, a one-hour maximum and exactly the fixed Kuno outlet',async()=>{
 const f=fixture(),result=await f.exchange();
 assert(result.cookie.startsWith('__Host-inventory_employee_prod='));assert(!result.cookie.startsWith(`${employeeCookie}=`));
 assert(result.cookie.includes('Max-Age=3600'));for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert(result.cookie.includes(flag));
 const {config}=f.runtime(),cookie=result.cookie.split(';')[0];
 const result2=await employeeLocationContext({req:f.req({},cookie),config,store:f.store(config),now:at+3599999});
 assert.equal(result2.outlet.id,kunoOutletId);assert.equal(result2.user.role,'user');assert.equal(result2.outlet.name,f.outlet.name);
 await assert.rejects(employeeLocationContext({req:f.req({},cookie),config,store:f.store(config),now:at+3600000}),{code:'ENTRY_CONTEXT_INVALID'});
});
test('signed development launches and foreign locations cannot become production even with the same key material',async()=>{
 const f=fixture(),{config}=f.runtime();
 for(const patch of [{environment:'dev'},{issuer:'foreign'},{location_id:'foreign'}]){
  await assert.rejects(exchangeLocationLaunch({req:f.req(),config,store:f.store(config),launch:await f.issue(patch),now:at}));
 }
 assert.equal(f.reads(),0);
});
test('production disable, revision rotation and outlet suspension revoke existing employee sessions',async()=>{
 const f=fixture(),cookie=(await f.exchange()).cookie.split(';')[0];
 f.settings.INVENTORY_KUNO_PRODUCTION_ACCESS=JSON.stringify({enabled:false,revision:1});assert.throws(f.runtime,{code:'INVENTORY_PRODUCTION_DISABLED'});
 f.settings.INVENTORY_KUNO_PRODUCTION_ACCESS=JSON.stringify({enabled:true,revision:2});let {config}=f.runtime();
 await assert.rejects(employeeLocationContext({req:f.req({},cookie),config,store:f.store(config),now:at+1000}),{code:'LOCATION_BINDING_CHANGED'});
 f.settings.INVENTORY_KUNO_PRODUCTION_ACCESS=JSON.stringify({enabled:true,revision:1});config=f.runtime().config;f.outlet.is_active=false;
 await assert.rejects(employeeLocationContext({req:f.req({},cookie),config,store:f.store(config),now:at+1000}),{code:'LOCATION_OUTLET_INACTIVE'});
});
test('workflow awaits the write gate: a Promise resolving false must never allow a write',async()=>{
 let dataReads=0;
 const handler=createInventoryRunsHandler({createClientFromRequest:()=>({auth:{me:async()=>({id:'owner',role:'admin'})}}),
  isEnabled:async()=>false,storeFor:()=>{dataReads++;}});
 const response=await handler(new Request('https://test.example.invalid',{method:'POST',headers:{'X-Data-Env':'dev'},body:JSON.stringify({action:'start',outlet_id:'one',period_type:'monthly',session_date:'2026-10-23',start_key:'synthetic'})}));
 assert.equal(response.status,503);assert.equal(dataReads,0);
});
test('browser cannot choose production through query settings or an unrecognized hosting origin',()=>{
 assert.equal(workflowDataEnvironment({origin:inventoryProductionOrigin}),'prod');
 assert.equal(workflowDataEnvironment({origin:inventoryProductionOrigin,functionsVersion:'branch:synthetic'}),'prod');
 for(const origin of ['http://127.0.0.1:5173','https://preview.example.invalid','https://foreign.example.invalid'])assert.equal(workflowDataEnvironment({origin}),'dev');
});

test('public transport discards stale branch version while preview keeps its version',()=>{
 assert.equal(workflowFunctionsVersion({origin:inventoryProductionOrigin,functionsVersion:'branch:old'}),undefined);
 assert.equal(workflowFunctionsVersion({origin:'https://preview.example.invalid',functionsVersion:'branch:old'}),'branch:old');
});

test('canonical public workflow binds the SDK request to prod even when gateway labels it dev',async()=>{
 const f=fixture();let seen;
 const handler=serveInventoryWorkflow({secrets:f.secrets,createClientFromRequest:()=>{},createHandler:({runtime})=>async req=>{seen={env:runtime.environment,header:req.headers.get('X-Data-Env')};return Response.json({ok:true});}});
 assert.equal((await handler(f.req({'X-Data-Env':'dev'}))).status,200);
 assert.deepEqual(seen,{env:'prod',header:'prod'});
 seen=null;assert.equal((await handler(f.req({'X-Data-Env':'dev','Base44-Functions-Version':'branch:old'}))).status,503);assert.equal(seen,null);
});

test('canonical public request accepts the platform default missing data label without relaxing runtime checks',async()=>{
 const f=fixture();let seen=false;
 const handler=serveInventoryWorkflow({secrets:f.secrets,createClientFromRequest:()=>{},createHandler:({runtime})=>async req=>{seen=runtime.environment==='prod'&&req.headers.get('X-Data-Env')==='prod';return Response.json({ok:true});}});
 const request=f.req(),headers=new Headers(request.headers);headers.delete('X-Data-Env');
 assert.equal((await handler(new Request(request,{headers}))).status,200);assert.equal(seen,true);
});

test('missing optional platform API override retains the SDK fixed canonical default',()=>{
 const f=fixture(),request=f.req(),headers=new Headers(request.headers);headers.delete('Base44-Api-Url');
 assert.equal(inventoryWorkflowRuntime(f.secrets,new Request(request,{headers})).environment,'prod');
 assert.throws(()=>inventoryWorkflowRuntime(f.secrets,f.req({'Base44-Api-Url':'https://foreign.example.invalid'})),{code:'PRODUCTION_CONTEXT_UNCONFIRMED'});
});
