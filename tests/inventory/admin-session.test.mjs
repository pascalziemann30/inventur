import test from 'node:test';
import assert from 'node:assert/strict';
import {loginAdminPassword,adminSessionContext,adminSessionStore} from '../../base44/shared/inventory/adminSession.js';
import {inventoryRequestActor} from '../../base44/shared/inventory/locationEntry.js';
import {assertOutletAccess} from '../../base44/shared/inventory/stock.js';
import {createAdminSessionHandler} from '../../base44/functions/adminSession/handler.js';
import {createCatalogAdminHandler} from '../../base44/functions/catalogAdmin/handler.js';
const id='697f405ef1744da8ba46c99d',at=1800000000000;
const configuration=()=>({environment:'prod',origins:['https://siftcntrl-bestand.base44.app'],adminPassword:'synthetic-password-for-tests-only',sessionSecret:'synthetic-independent-session-secret-0001'});
function fixture(){
 let outlet={id,name:'Kuno15',is_active:true,admin_auth_revision:0},writes=0;
 const store={getOutlet:async()=>structuredClone(outlet),reserve:async(before,state)=>{if((before.admin_auth_revision||0)!==(outlet.admin_auth_revision||0))return false;outlet={...outlet,admin_auth_revision:(outlet.admin_auth_revision||0)+1,admin_auth_state:state};writes++;return true;}};
 const config=configuration();
 const req=cookie=>new Request('https://siftcntrl-bestand.base44.app/api/test',{headers:{Origin:config.origins[0],'X-Data-Env':'prod',...(cookie?{Cookie:cookie}:{})}});
 return {config,store,req,writes:()=>writes,setOutlet:patch=>Object.assign(outlet,patch)};
}
test('password is verified on server, protected cookie only authorizes Kuno15',async()=>{
 const f=fixture(),login=await loginAdminPassword({...f,password:f.config.adminPassword,now:at});
 assert.equal(f.writes(),1);assert.equal(login.user.access_kind,'password_admin');
 assert(login.cookie.startsWith('__Host-inventory_admin_prod='));for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=2592000'])assert(login.cookie.includes(flag));
 assert(!login.cookie.includes(f.config.adminPassword));assert(!login.cookie.includes(f.config.sessionSecret));
 const context=await adminSessionContext({...f,req:f.req(login.cookie.split(';')[0]),now:at+1});
 assert.equal(context.user.role,'admin');assertOutletAccess(context.user,id);assert.throws(()=>assertOutletAccess(context.user,'different-outlet'),{code:'OUTLET_FORBIDDEN'});
});
test('wrong password, missing configuration, tampering, expiry, environment and rotation deny access',async()=>{
 const f=fixture();await assert.rejects(loginAdminPassword({...f,password:'wrong',now:at}),{code:'ADMIN_PASSWORD_INCORRECT'});
 await assert.rejects(loginAdminPassword({...f,config:{...f.config,adminPassword:undefined},password:'anything',now:at}),{code:'ADMIN_PASSWORD_NOT_CONFIGURED'});
 const login=await loginAdminPassword({...f,password:f.config.adminPassword,now:at}),cookie=login.cookie.split(';')[0];
 for(const [cfg,token,now]of [[f.config,'',at],[f.config,cookie.replace(/.$/,'!'),at],[f.config,cookie,at+30*24*3600000],[{...f.config,environment:'dev'},cookie,at],[{...f.config,adminPassword:'different-strong-test-password'},cookie,at]])await assert.rejects(adminSessionContext({req:f.req(token),config:cfg,store:f.store,now}),{code:'ADMIN_PASSWORD_REQUIRED'});
 f.setOutlet({is_active:false});await assert.rejects(adminSessionContext({...f,req:f.req(cookie),now:at+2}),{code:'LOCATION_OUTLET_INACTIVE'});
});
test('parallel attempts reserve a bounded durable slot and recover after five minutes',async()=>{
 const f=fixture(),results=await Promise.allSettled(Array.from({length:15},()=>loginAdminPassword({...f,password:'incorrect',now:at})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,0);assert(f.writes()<=8);assert(results.every(r=>['ADMIN_PASSWORD_INCORRECT','ADMIN_LOGIN_RETRY','ADMIN_LOGIN_PAUSED'].includes(r.reason.code)));
 while(f.writes()<8)await assert.rejects(loginAdminPassword({...f,password:'incorrect',now:at}),{code:'ADMIN_PASSWORD_INCORRECT'});
 await assert.rejects(loginAdminPassword({...f,password:f.config.adminPassword,now:at+1}),{code:'ADMIN_LOGIN_PAUSED'});
 assert((await loginAdminPassword({...f,password:f.config.adminPassword,now:at+300001})).cookie);
});
test('uncertain conditional storage never issues a session',async()=>{
 const config=configuration(),entities={Outlet:{get:async()=>({id,is_active:true}),updateMany:async()=>({success:true,updated:1})}};
 await assert.rejects(loginAdminPassword({config,password:config.adminPassword,store:adminSessionStore(entities),now:at}),{code:'ADMIN_LOGIN_UNAVAILABLE'});
});
test('employee cookie and browser role markers cannot become admin',async()=>{
 const f=fixture(),req=new Request('https://inventory.invalid',{headers:{'X-Inventory-Mode':'password_admin',Cookie:'__Host-inventory_employee_prod=untrusted'}});
 await assert.rejects(inventoryRequestActor(req,{asServiceRole:{entities:{Outlet:{get:async()=>({id,is_active:true})}}}},f.config),{code:'ADMIN_PASSWORD_REQUIRED'});
});
test('login API never exposes password, checks origin and clears only admin cookie',async()=>{
 const f=fixture(),handler=createAdminSessionHandler({config:f.config,now:()=>at,createClientFromRequest:()=>({auth:{me:async()=>{throw Error('anonymous');}},asServiceRole:{entities:{}}}),storeFor:()=>f.store});
 const request=(body,origin=f.config.origins[0],cookie)=>new Request('https://inventory.invalid',{method:'POST',headers:{Origin:origin,'X-Data-Env':'prod',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 assert.deepEqual(await(await handler(request({action:'context'}))).json(),{authenticated:false,configured:true});
 assert.equal((await handler(request({action:'login',password:f.config.adminPassword},'https://foreign.example.invalid'))).status,403);assert.equal(f.writes(),0);
 const login=await handler(request({action:'login',password:f.config.adminPassword}));assert.equal(login.status,200);const body=await login.json();assert.equal(body.authenticated,true);assert(!JSON.stringify(body).includes(f.config.adminPassword));
 const cookie=login.headers.get('Set-Cookie').split(';')[0];assert.equal((await(await handler(request({action:'context'},undefined,cookie))).json()).authenticated,true);
 const logout=await handler(request({action:'logout'}));assert(logout.headers.get('Set-Cookie').startsWith('__Host-inventory_admin_prod=;'));assert(!logout.headers.get('Set-Cookie').includes('employee'));
 assert.equal((await handler(request({action:'context',password:'not-allowed'}))).status,400);
});
test('catalog scope is checked before reading foreign outlet data',async()=>{
 let reads=0;const user={id:'password-admin:kuno15',role:'admin',access_kind:'password_admin',outlet_id:id};
 const handler=createCatalogAdminHandler({originAllowed:()=>true,defaultEnvironment:()=> 'prod',createClientFromRequest:()=>({asServiceRole:{get entities(){reads++;return {};}}}),resolveAdmin:async()=>user});
 const response=await handler(new Request('https://inventory.invalid',{method:'POST',headers:{'X-Data-Env':'prod'},body:JSON.stringify({action:'list',outlet_id:'foreign'})}));
 assert.equal(response.status,403);assert.equal((await response.json()).error,'OUTLET_FORBIDDEN');assert.equal(reads,0);
});

test('valid password session loads the scoped admin catalog with no native user account',async()=>{
 const f=fixture(),now=Date.now(),login=await loginAdminPassword({...f,password:f.config.adminPassword,now});
 const outlet={id,name:'Kuno15',is_active:true};
 const entities={Outlet:{get:async()=>outlet,filter:async()=>[outlet,{id:'other',name:'Other',is_active:true}]}};
 for(const entity of ['OutletItem','OutletStock','GlobalItem','SupplierItem','Supplier','Category','Unit'])entities[entity]={filter:async()=>[]};
 let nativeCalls=0;const client={auth:{me:async()=>{nativeCalls++;throw Error('no native account');}},asServiceRole:{entities}};
 const handler=createCatalogAdminHandler({originAllowed:o=>o===f.config.origins[0],defaultEnvironment:()=> 'prod',createClientFromRequest:()=>client,resolveAdmin:(req,c)=>inventoryRequestActor(req,c,f.config)});
 const request=action=>new Request('https://inventory.invalid',{method:'POST',headers:{Origin:f.config.origins[0],'X-Data-Env':'prod','X-Inventory-Mode':'password_admin',Cookie:login.cookie.split(';')[0]},body:JSON.stringify({action,outlet_id:id})});
 const list=await handler(request('list'));assert.equal(list.status,200);assert.equal((await list.json()).outlet.id,id);
 const outlets=await handler(request('outlets'));assert.equal(outlets.status,200);assert.deepEqual((await outlets.json()).outlets.map(o=>o.id),[id]);assert.equal(nativeCalls,0);
});

test('remembered admin survives navigation and browser reopening, with a fixed thirty-day deadline',async()=>{
 const f=fixture(),login=await loginAdminPassword({...f,password:f.config.adminPassword,now:at});
 const cookie=login.cookie.split(';')[0];
 for(const elapsed of [3600001,7*24*3600000,30*24*3600000-1]){
  const context=await adminSessionContext({...f,req:f.req(cookie),now:at+elapsed});
  assert.equal(context.user.role,'admin');assert.equal(context.cookie,undefined);
 }
 await assert.rejects(adminSessionContext({...f,req:f.req(cookie),now:at+30*24*3600000}),{code:'ADMIN_PASSWORD_REQUIRED'});
});
test('only an unexpired signed legacy session is upgraded and keeps its original sign-in deadline',async()=>{
 const f=fixture(),login=await loginAdminPassword({...f,password:f.config.adminPassword,now:at});
 const original=login.cookie.split(';')[0],name=original.slice(0,original.indexOf('='));
 const claims=JSON.parse(Buffer.from(original.split('=')[1].split('.')[0],'base64url').toString());
 claims.expires_at=at+3600000;
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
 const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`inventory-admin-key-v1\n${f.config.sessionSecret}\n${f.config.adminPassword}`));
 const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`inventory-admin-session-v1.${payload}`))).toString('base64url');
 const legacy=`${name}=${payload}.${signature}`;
 const upgraded=await adminSessionContext({...f,req:f.req(legacy),now:at+600000});
 assert(upgraded.cookie.includes('Max-Age=2591400'));
 const renewed=JSON.parse(Buffer.from(upgraded.cookie.split('=')[1].split('.')[0],'base64url').toString());
 assert.equal(renewed.issued_at,at);assert.equal(renewed.expires_at,at+30*24*3600000);
 await assert.rejects(adminSessionContext({...f,req:f.req(legacy),now:at+3600000}),{code:'ADMIN_PASSWORD_REQUIRED'});
});

test('current Main preview accepts only a verified native administrator and stays in development',async()=>{
 const {inventoryWorkflowRuntime}=await import('../../base44/shared/inventory/operationalAccess.js');
 const origin='https://preview--siftcntrl-bestand.base44.app';
 const request=(host=origin)=>new Request(`${origin}/api/test`,{method:'POST',headers:{Origin:host,'X-Data-Env':'dev'},body:JSON.stringify({action:'context'})});
 const runtime=inventoryWorkflowRuntime({get:()=>undefined},request());
 assert.equal(runtime.environment,'dev');assert.equal(runtime.enabled,true);
 let actor={id:'existing-owner',role:'admin'},authReads=0;
 const handler=createAdminSessionHandler({config:runtime.config,storeFor:()=>({}),createClientFromRequest:()=>({auth:{me:async()=>{authReads++;return actor;}},asServiceRole:{entities:{}}})});
 assert.deepEqual(await(await handler(request())).json(),{authenticated:true,method:'native'});
 actor={id:'employee',role:'user'};
 assert.equal((await(await handler(request())).json()).authenticated,false);
 actor=null;
 assert.equal((await(await handler(request())).json()).authenticated,false);
 const before=authReads;
 for(const host of ['https://preview--foreign.base44.app','https://foreign.invalid'])assert.equal((await handler(request(host))).status,403);
 assert.equal(authReads,before);
});