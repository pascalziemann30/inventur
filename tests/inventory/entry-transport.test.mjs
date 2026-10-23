import test from 'node:test';
import assert from 'node:assert/strict';
import {entryTransport,takeLaunch} from '../../src/components/inventory/entry/entryMode.js';
import {createInventoryLaunchHandler} from '../../integration/shift-control-location-entry/launchHandler.js';

test('employee transport has no direct entity/auth or setup/import path and never falls back to administrator',async()=>{
 let adminCalls=0,employeeCalls=0;
 const admin={functions:{invoke:()=>{adminCalls++;}},entities:{Outlet:{}},auth:{me:()=>{adminCalls++;}}};
 const employee={functions:{invoke:async()=>{employeeCalls++;throw new Error('cookie rejected');}}};
 const client=entryTransport({admin,employee,isEmployee:()=>true});
 for(const name of ['locationEntry','inventoryRuns','deliveryDrafts','reviewDelivery','scanDelivery'])await assert.rejects(client.functions.invoke(name,{}));
 for(const name of ['catalogImport','inventoryTestSetup','verifyBookingStorage'])assert.throws(()=>client.functions.invoke(name,{}));
 assert.throws(()=>client.auth.me());assert.throws(()=>client.entities.Outlet);
 assert.equal(adminCalls,0);assert.equal(employeeCalls,5);
 const normal=entryTransport({admin,employee,isEmployee:()=>false});normal.functions.invoke('inventoryRuns',{});assert.equal(adminCalls,1);
});
test('launch fragment is removed without losing deployment parameters or forwarding it into query/history',()=>{
 let replacement;
 const launch=takeLaunch({pathname:'/InventoryCapture',search:'?workflow=entry&functions_version=branch%3Atest',hash:'#inventory_launch=synthetic.token'},
 {replaceState:(_state,_title,url)=>{replacement=url;}});
 assert.equal(launch,'synthetic.token');assert.equal(replacement,'/InventoryCapture?workflow=entry&functions_version=branch%3Atest');
});
test('source handler verifies fresh server location and refuses caller-selected outlet or role',async()=>{
 let resolutions=0;
 const handler=createInventoryLaunchHandler({issuer:'synthetic-source',secret:'synthetic-secret-for-testing-at-least-32-bytes',sourceOrigin:'https://shift.example.invalid',targetUrl:'https://inventory.example.invalid/InventoryCapture?base44_data_env=dev',
 resolveWorkContext:async()=>{resolutions++;return {ok:true,context:{location:{id:'server-only'},user_id:'shared-location'}};}});
 const req=(body,origin='https://shift.example.invalid')=>new Request('https://shift.example.invalid/api/launch',{method:'POST',headers:{Origin:origin},body});
 assert.equal((await handler(req('{"outlet":"foreign","role":"admin"}'))).status,400);
 assert.equal((await handler(req('{}','https://foreign.example.invalid'))).status,403);assert.equal(resolutions,0);
 const result=await handler(req('{}'));assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'no-store');
 const url=new URL((await result.json()).url);assert.equal(url.searchParams.get('workflow'),'entry');
 assert.equal(url.searchParams.get('base44_data_env'),'dev');assert(new URLSearchParams(url.hash.slice(1)).get('inventory_launch'));assert.equal(resolutions,1);
});
test('early bootstrap removes launch before the application imports and consumes it once',async()=>{
 let cleaned;
 globalThis.window={location:{pathname:'/InventoryCapture',search:'?workflow=entry',hash:'#inventory_launch=synthetic.only'},history:{replaceState:(_s,_t,url)=>{cleaned=url;}}};
 try{
  const {consumeLaunch}=await import('../../src/components/inventory/entry/launchBootstrap.js');
  assert.equal(cleaned,'/InventoryCapture?workflow=entry');assert.equal(consumeLaunch(),'synthetic.only');assert.equal(consumeLaunch(),null);
 }finally{delete globalThis.window;}
});
