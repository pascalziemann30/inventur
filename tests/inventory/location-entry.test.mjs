import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueLocationLaunch,exchangeLocationLaunch,employeeLocationContext,inventoryRequestActor,employeeCookie} from '../../base44/shared/inventory/locationEntry.js';
import {createLocationEntryHandler} from '../../base44/functions/locationEntry/handler.js';
import {createInventoryRunsHandler} from '../../base44/functions/inventoryRuns/handler.js';
import {createDeliveryDraftHandler} from '../../base44/functions/deliveryDrafts/handler.js';
import {createScanDeliveryHandler} from '../../base44/functions/scanDelivery/handler.js';
import {createReviewDeliveryHandler} from '../../base44/functions/reviewDelivery/handler.js';
import {assertOutletAccess} from '../../base44/shared/inventory/stock.js';
const now=1_800_000_000_000;
const config={issuer:'synthetic-shift-app',launchSecret:'synthetic-launch-key-not-a-real-secret-0001',sessionSecret:'synthetic-session-key-not-a-real-secret-0002',origins:['https://inventory.example.invalid']};
function fixture(){
 const binding={id:'binding-one',source_app_id:config.issuer,source_location_id:'source-id',environment:'dev',outlet_id:'target-id',is_active:true,revision:0,expires_at:now+3600000};
 const rows=[binding],outlet={id:'target-id',name:'Kuno 15',is_active:true,type:'NORMAL'};let reads=0;
 const store={find:async query=>{reads++;return structuredClone(rows.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v)));},getOutlet:async()=>{reads++;return structuredClone(outlet);}};
 const req=(cookie='',origin=config.origins[0],mode='employee',env='dev')=>new Request('https://inventory.example.invalid/api/test',{method:'POST',headers:{Origin:origin,'X-Data-Env':env,'X-Inventory-Mode':mode,...(cookie?{Cookie:cookie}:{})}});
 const issue=(at=now)=>issueLocationLaunch({request:{},issuer:config.issuer,secret:config.launchSecret,now:at,
  resolveWorkContext:async()=>({ok:true,context:{location:{id:'source-id',name:'Kuno15'},user_id:'shared-store-actor'}})});
 const exchange=async()=>exchangeLocationLaunch({req:req(),launch:await issue(),config,store,now});
 return {rows,binding,outlet,store,req,issue,exchange,reads:()=>reads};
}
test('source and target names may differ or change; exact IDs bind the employee to one outlet',async()=>{
 const f=fixture(),result=await f.exchange();assert.equal(result.outlet.name,'Kuno 15');
 assert(result.cookie.startsWith(`${employeeCookie}=`));
 for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert(result.cookie.includes(flag));
 const context=await employeeLocationContext({req:f.req(result.cookie.split(';')[0]),config,store:f.store,now:now+1000});
 assert.equal(context.user.role,'user');assert.equal(context.user.data.outlet_id,'target-id');
 assert(!context.user.id.includes('shared-store-actor'));
 assertOutletAccess(context.user,'target-id');assert.throws(()=>assertOutletAccess(context.user,'another'),{code:'OUTLET_FORBIDDEN'});
 f.outlet.name='Kuno neu benannt';
 assert.equal((await employeeLocationContext({req:f.req(result.cookie.split(';')[0]),config,store:f.store,now:now+2000})).outlet.name,'Kuno neu benannt');
});
test('modified signatures, expiry, future grants and wrong audience/environment never read a location catalog',async()=>{
 const f=fixture(),launch=await f.issue(),before=f.reads();
 const [body,sig]=launch.split('.');
 const changed=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url')),location_id:'foreign'})).toString('base64url');
 for(const token of [`${changed}.${sig}`,`${body}.${sig.slice(0,-2)}aa`,'nonsense'])await assert.rejects(exchangeLocationLaunch({req:f.req(),launch:token,config,store:f.store,now}),{code:'ENTRY_SIGNATURE_INVALID'});
 await assert.rejects(exchangeLocationLaunch({req:f.req(),launch,config,store:f.store,now:now+90000}),{code:'ENTRY_CONTEXT_INVALID'});
 await assert.rejects(exchangeLocationLaunch({req:f.req(),launch:await f.issue(now+1),config,store:f.store,now}),{code:'ENTRY_CONTEXT_INVALID'});
 assert.equal(f.reads(),before);
});
test('missing, duplicate, reverse-duplicate or inactive bindings never guess from outlet names',async()=>{
 for(const mutate of [f=>f.rows.length=0,f=>f.rows.push({...f.binding,id:'duplicate'}),
  f=>f.rows.push({...f.binding,id:'reverse',source_location_id:'other-source'}),f=>f.binding.is_active=false,f=>f.outlet.is_active=false,
  f=>f.outlet.type='AGGREGATOR',f=>f.binding.revision=-1]){
  const f=fixture();mutate(f);await assert.rejects(f.exchange());
 }
});
test('suspension or a new binding revision revokes an existing employee context immediately',async()=>{
 for(const mutate of [f=>f.binding.is_active=false,f=>f.binding.revision++,f=>f.outlet.is_active=false]){
  const f=fixture(),result=await f.exchange();mutate(f);
  await assert.rejects(employeeLocationContext({req:f.req(result.cookie.split(';')[0]),config,store:f.store,now:now+1000}));
 }
});
test('session cannot be used as a launch grant, launch cannot be used as a session, and duplicate cookies fail closed',async()=>{
 const f=fixture(),launch=await f.issue(),session=await f.exchange(),cookie=session.cookie.split(';')[0],token=cookie.split('=')[1];
 await assert.rejects(exchangeLocationLaunch({req:f.req(),launch:token,config,store:f.store,now}),{code:'ENTRY_SIGNATURE_INVALID'});
 await assert.rejects(employeeLocationContext({req:f.req(`${employeeCookie}=${launch}`),config,store:f.store,now}),{code:'ENTRY_SIGNATURE_INVALID'});
 await assert.rejects(employeeLocationContext({req:f.req(`${cookie}; ${cookie}`),config,store:f.store,now}),{code:'EMPLOYEE_ENTRY_REQUIRED'});
 await assert.rejects(employeeLocationContext({req:f.req(cookie),config,store:f.store,now:now+8*60*60*1000}),{code:'ENTRY_CONTEXT_INVALID'});
});
test('only an exact allowed origin and dev context can exchange a grant',async()=>{
 const f=fixture(),launch=await f.issue();
 for(const req of [f.req('','https://evil.example'),f.req('',config.origins[0],'employee','prod')])await assert.rejects(exchangeLocationLaunch({req,launch,config,store:f.store,now}));
 assert.equal(f.reads(),0);
 await assert.rejects(exchangeLocationLaunch({req:f.req(),launch,config:{...config,launchSecret:''},store:f.store,now}),{code:'LOCATION_ENTRY_NOT_CONFIGURED'});
});
test('issuer accepts only the fresh server-resolved work context and never request outlet/role fields',async()=>{
 const request={outlet_id:'forged',role:'admin'};
 const launch=await issueLocationLaunch({request,issuer:config.issuer,secret:config.launchSecret,now,
  resolveWorkContext:async req=>{assert.equal(req,request);return {ok:true,context:{user_id:'shared-store-actor',location:{id:'source-id'}}};}});
 const payload=JSON.parse(Buffer.from(launch.split('.')[0],'base64url'));assert.equal(payload.location_id,'source-id');assert(!Object.hasOwn(payload,'role'));
 await assert.rejects(issueLocationLaunch({request,issuer:config.issuer,secret:config.launchSecret,now,resolveWorkContext:async()=>({ok:false})}),{code:'SOURCE_LOCATION_NOT_VERIFIED'});
});
test('choosing employee mode cannot inherit an existing Base44 administrator login',async()=>{
 const f=fixture(),launch=await issueLocationLaunch({request:{},issuer:config.issuer,secret:config.launchSecret,
  resolveWorkContext:async()=>({ok:true,context:{user_id:'shared-store-actor',location:{id:'source-id'}}})});
 const result=await exchangeLocationLaunch({req:f.req(),launch,config,store:f.store});let authReads=0;
 const client={auth:{me:async()=>{authReads++;return {id:'admin',role:'admin'};}},asServiceRole:{entities:{
  InventoryOutletBinding:{filter:f.store.find},Outlet:{get:f.store.getOutlet}}}};
 const employee=await inventoryRequestActor(f.req(result.cookie.split(';')[0]),client,config);
 assert.equal(employee.role,'user');assert.equal(authReads,0);
 const admin=await inventoryRequestActor(f.req('',config.origins[0],'admin'),client,config);assert.equal(admin.role,'admin');assert.equal(authReads,1);
 await assert.rejects(inventoryRequestActor(f.req('',config.origins[0],'administrator'),client,config),{code:'ENTRY_MODE_INVALID'});
});
test('location exchange defaults closed, accepts no client-selected outlet, and exposes no keys in errors',async()=>{
 const f=fixture();let called=0;
 const handler=createLocationEntryHandler({createClientFromRequest:()=>{called++;return {asServiceRole:{entities:{}}};},config,isEnabled:()=>false,storeFor:()=>f.store});
 const call=body=>handler(new Request('https://inventory.example.invalid/api/test',{method:'POST',headers:{Origin:config.origins[0],'X-Data-Env':'dev'},body:JSON.stringify(body)}));
 assert.equal((await call({action:'exchange',launch:'bad'})).status,503);assert.equal(called,0);
 assert.equal((await call({action:'exchange',launch:'bad',outlet_id:'chosen'})).status,400);assert.equal(called,0);
 const response=await call({action:'context'});assert.equal(response.status,401);assert.equal((await response.json()).error,'EMPLOYEE_ENTRY_REQUIRED');
});
test('all four newer workflow handlers use a server-derived employee actor and reject admin client fields',async()=>{
 const f=fixture(),launch=await issueLocationLaunch({request:{},issuer:config.issuer,secret:config.launchSecret,
  resolveWorkContext:async()=>({ok:true,context:{user_id:'shared-store-actor',location:{id:'source-id'}}})});
 const result=await exchangeLocationLaunch({req:f.req(),launch,config,store:f.store});
 const client={auth:{me:async()=>{throw new Error('No employee account exists');}},asServiceRole:{entities:{InventoryOutletBinding:{filter:f.store.find},Outlet:{get:f.store.getOutlet}}}};
 const resolveActor=(req,c)=>inventoryRequestActor(req,c,config),options={createClientFromRequest:()=>client,isEnabled:()=>false,resolveActor};
 const handlers=[createInventoryRunsHandler({...options,storeFor:()=>({verifiedAtomicWrites:true,getRun:async()=>null})}),
  createDeliveryDraftHandler({...options,storeFor:()=>({verifiedAtomicWrites:true,get:async()=>null})}),
  createScanDeliveryHandler({...options,serviceFor:(_client,user)=>({get:async()=>({is_employee:user.role==='user',outlet_id:user.data.outlet_id})})}),
  createReviewDeliveryHandler(options)];
 for(let i=0;i<handlers.length;i++){
  const headers={Origin:config.origins[0],'X-Data-Env':'dev','X-Inventory-Mode':'employee',Cookie:result.cookie.split(';')[0]};
  const response=await handlers[i](new Request('https://inventory.example.invalid/api/test',{method:'POST',headers,body:JSON.stringify(i===3?{outlet_id:'foreign',supplier_id:'s',lines:[]}:{action:'get',id:'one'})}));
  assert.equal(response.status,[404,404,200,403][i]);
 }
});
test('even correctly signed foreign audience, environment, issuer or extra role claims fail before lookup',async()=>{
 const f=fixture(),payload=JSON.parse(Buffer.from((await f.issue()).split('.')[0],'base64url'));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.launchSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 for(const patch of [{audience:'other'},{environment:'prod'},{issuer:'other'},{role:'admin'},{outlet_id:'foreign'}]){
  const body=Buffer.from(JSON.stringify({...payload,...patch})).toString('base64url');
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`inventory-launch-v1.${body}`))).toString('base64url');
  await assert.rejects(exchangeLocationLaunch({req:f.req(),launch:`${body}.${signature}`,config,store:f.store,now}),{code:'ENTRY_CONTEXT_INVALID'});
 }
 assert.equal(f.reads(),0);
});
test('the absolute binding deadline limits the cookie and revokes reads without relying on manual cleanup',async()=>{
 const f=fixture();f.binding.expires_at=now+120000;
 const result=await f.exchange();assert(result.cookie.includes('Max-Age=120'));
 const cookie=result.cookie.split(';')[0];
 assert.equal((await employeeLocationContext({req:f.req(cookie),config,store:f.store,now:now+119000})).outlet.id,'target-id');
 await assert.rejects(employeeLocationContext({req:f.req(cookie),config,store:f.store,now:now+120000}));
 f.binding.expires_at=now;await assert.rejects(f.exchange(),{code:'LOCATION_BINDING_EXPIRED'});
 delete f.binding.expires_at;await assert.rejects(f.exchange(),{code:'LOCATION_BINDING_EXPIRED'});
});
