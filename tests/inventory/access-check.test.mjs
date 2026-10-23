import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifyInventoryAccessHandler} from '../../base44/functions/verifyInventoryAccess/handler.js';
import {adminManagedEntities,serverOwnedEntities} from '../../base44/shared/inventory/entityAccessPolicy.js';
const appId='aaaaaaaaaaaaaaaaaaaaaaaa',origin='https://inventory.example.invalid';
function fixture(){
 let user={id:'native-admin',role:'admin'},anonymousCreated=0,reads=0,leak=false,empty=false;
 const entities={},service={},anonymous={entities:{}};
 for(const name of [...adminManagedEntities,...serverOwnedEntities]){
  service[name]={list:async()=>{reads++;return empty?[]:[{id:'private-sample-id',private_field:'private-test-data'}];}};
  entities[name]={filter:async()=>adminManagedEntities.includes(name)?[{id:'private-sample-id'}]:[]};
  anonymous.entities[name]={filter:async()=>leak?[{id:'private-sample-id'}]:[]};
 }
 const handler=createVerifyInventoryAccessHandler({createClientFromRequest:()=>({auth:{me:async()=>user},entities,asServiceRole:{entities:service}}),createAnonymousClient:(...args)=>{anonymousCreated++;assert.deepEqual(args,[appId]);return anonymous;},appId,origin});
 const call=(headers={},body='{"action":"check"}',method='POST')=>handler(new Request(origin+'/check',{method,headers:{'X-Data-Env':'dev',Origin:origin,...headers},...(method==='POST'?{body}:{})}));
 return {call,entities,service,setUser:v=>user=v,setLeak:v=>leak=v,setEmpty:v=>empty=v,anonymousCreated:()=>anonymousCreated,reads:()=>reads};
}
test('access check is read-only, native-admin-only, dev-only and origin-bound',async()=>{
 const f=fixture();assert.equal((await f.call({},undefined,'GET')).status,405);
 for(const headers of [{'X-Data-Env':'prod'},{Origin:'https://other.example.invalid'}])assert.equal((await f.call(headers)).status,403);
 for(const user of [null,{id:'staff',role:'user',data:{role:'admin'}}]){f.setUser(user);assert.equal((await f.call()).status,403);}
 assert.equal(f.anonymousCreated(),0);assert.equal(f.reads(),0);
});
test('only outcomes leave the server; no record fields, identifiers or credentials are returned',async()=>{
 const f=fixture(),reply=await f.call({Cookie:'incoming-secret-must-not-be-forwarded'}),data=await reply.json();
 assert.equal(data.passed,true);assert.equal(data.tested_models,25);assert.equal(data.empty_models,0);assert.equal(data.write_probe_performed,false);assert.equal(data.native_non_admin_account_tested,false);
 for(const value of ['private-sample-id','private-test-data','incoming-secret-must-not-be-forwarded'])assert(!JSON.stringify(data).includes(value));
 assert.equal(f.anonymousCreated(),1);assert.equal(f.reads(),25);
});
test('public leaks, direct server-owned reads and uncertain service access cannot pass',async()=>{
 const leaked=fixture();leaked.setLeak(true);assert.equal((await(await leaked.call()).json()).passed,false);
 const server=fixture();server.entities.InventoryRun.filter=async()=>[{id:'private-sample-id'}];assert.equal((await(await server.call()).json()).passed,false);
 const unavailable=fixture();unavailable.service.Article.list=async()=>{throw Error('private error');};const data=await(await unavailable.call()).json();assert.equal(data.passed,false);assert(!JSON.stringify(data).includes('private error'));
});
test('empty tables are explicitly untested; an all-empty database never passes',async()=>{
 const f=fixture();f.setEmpty(true);const data=await(await f.call()).json();assert.equal(data.passed,false);assert.equal(data.empty_models,25);assert.equal(data.tested_models,0);
});
test('caller cannot supply table names, sample ids or a different target app',async()=>{
 const f=fixture();assert.equal((await f.call({},'{"action":"check","table":"User"}')).status,400);assert.equal(f.anonymousCreated(),0);assert.equal(f.reads(),0);
});
