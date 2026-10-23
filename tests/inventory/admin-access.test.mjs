import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';
import {checkNativeAdmin, isNativeAdmin, requiresNativeAdmin, inventoryDataEnvironment} from '../../src/components/auth/adminAccess.js';
import {inventoryRequestActor} from '../../base44/shared/inventory/locationEntry.js';
const root = new URL('../../', import.meta.url);
test('admin needs an authenticated id and exact native role; browser/profile flags cannot grant access', async () => {
 for (const user of [null, {}, {role:'admin'}, {id:'actor',role:'user',data:{role:'admin',outlet_id:'arbitrary'}}, {id:'actor',role:'administrator'}]) {
  assert.equal(isNativeAdmin(user),false);assert.notEqual((await checkNativeAdmin({me:async()=>user})).status,'allowed');
 }
 const user={id:'actor',role:'admin'};assert.deepEqual(await checkNativeAdmin({me:async()=>user}),{status:'allowed',user});
});
test('expired logins and network failures fail closed without echoing raw errors', async () => {
 for (const [error,status] of [[{status:401},'login'],[{response:{status:401}},'login'],[{status:403},'unavailable'],[new Error('private response'),'unavailable']]) assert.deepEqual(await checkNativeAdmin({me:async()=>{throw error;}}),{status});
});
test('only the two-card start and location workflows bypass the admin UI boundary', () => {
 for (const page of ['Dashboard','Settings','AdminOverview','Analytics','Suppliers','Users','History','Produktpass','Unexpected']) assert.equal(requiresNativeAdmin(page),true);
 assert.equal(requiresNativeAdmin('OutletLogin'),false);
 for (const workflow of ['entry','server','scan','delivery']) assert.equal(requiresNativeAdmin('InventoryCapture',`?workflow=${workflow}`),false);
 for (const query of ['', '?workflow=import','?workflow=entry-setup','?workflow=unknown','?diagnostics=storage','?workflow=server&diagnostics=storage','?workflow=entry&diagnostics=storage']) assert.equal(requiresNativeAdmin('InventoryCapture',query),true);
});
test('branch admin requests are explicitly pinned to test data', () => {
 assert.equal(inventoryDataEnvironment('branch:synthetic'),'dev');assert.equal(inventoryDataEnvironment('branch:another'),'dev');
 for(const value of [null,undefined,'','published']) assert.equal(inventoryDataEnvironment(value),'prod');
});
test('editable native staff profile fields cannot substitute for a signed location context', async () => {
 const req=mode=>new Request('https://inventory.example.invalid/endpoint',{headers:mode?{'X-Inventory-Mode':mode}:{}});
 for(const mode of [null,'admin']) {
  await assert.rejects(inventoryRequestActor(req(mode),{auth:{me:async()=>({id:'staff',role:'user',data:{outlet_id:'forged'}})}},{}),{code:'ADMIN_REQUIRED'});
  assert.equal((await inventoryRequestActor(req(mode),{auth:{me:async()=>({id:'owner',role:'admin'})}},{})).id,'owner');
 }
});
test('prepared entity rules close public/profile access and preserve every schema field', async () => {
 const serverOnly=new Set(['DeliveryScan','DeliveryDraft','InventoryRun','DeliveryLine','ArticleProposal','PriceChangeRequest','InventoryOutletBinding','CatalogImportBatch','BookingProbeStock']);
 const files=(await readdir(new URL('base44/entities/',root))).filter(p=>p.endsWith('.jsonc'));assert(files.length>=25);
 for(const file of files) {
  const schema=JSON.parse(await readFile(new URL(`security/pending-entities/${file}`,root),'utf8'));
  const actual=JSON.parse(await readFile(new URL(`base44/entities/${file}`,root),'utf8'));
  const plan=JSON.parse(await readFile(new URL('security/entity-access-change-plan.json',root),'utf8'));
  const change=plan.changed_entities.find(c=>c.entity===schema.name);
  const {rls:actualRules,...actualFields}=actual, {rls:preparedRules,...preparedFields}=schema;
  assert.deepEqual(actualFields,preparedFields,`${file} must preserve data structure`);
  assert([JSON.stringify(preparedRules),JSON.stringify(change?.before)].includes(JSON.stringify(actualRules ?? null)),`${file} rules must match the reviewed baseline or prepared policy`);
  assert.deepEqual(Object.keys(schema.rls).sort(),['create','delete','read','update'],file);
  for(const op of ['create','read','update','delete']) assert.deepEqual(schema.rls[op],serverOnly.has(schema.name)?false:{user_condition:{role:'admin'}},`${file} ${op}`);
 }
});
test('admin boundary mounts before legacy pages and no shared-password comparison remains', async () => {
 const app=await readFile(new URL('src/App.jsx',root),'utf8');assert(app.includes('requiresNativeAdmin(currentPageName, location.search)'));assert(app.includes('<NativeAdminBoundary>{content}</NativeAdminBoundary>'));
 for(const path of ['src/pages/OutletLogin.jsx','src/pages/Settings.jsx','src/pages/Dashboard.jsx','src/Layout.jsx']) {
  const code=await readFile(new URL(path,root),'utf8');assert(!code.includes("getItem('user_role')"),path);assert(!code.includes('adminPassword'),path);
 }
});
test('legacy export and maintenance endpoints deny non-admins before data or input access', async () => {
 const names=(await readdir(new URL('base44/functions/',root))).filter(name=>/^(generate|merge|migrate|restore)/.test(name));
 for(const name of names) {
  let handler;const source=(await readFile(new URL(`base44/functions/${name}/entry.ts`,root),'utf8')).replace(/^import .*;\s*$/gm,'');
  for(const identity of [null,{id:'staff',role:'user',data:{role:'admin'}}]) {
   let dataTouched=false,bodyTouched=false;
   const client={auth:{me:async()=>identity},get entities(){dataTouched=true;throw Error('data accessed');},get asServiceRole(){dataTouched=true;throw Error('service accessed');}};
   vm.runInNewContext(source,{Deno:{serve:fn=>{handler=fn;}},createClientFromRequest:()=>client,Response,console:{error:()=>{}}});
   const result=await handler({json:async()=>{bodyTouched=true;throw Error('body read');}});
   assert(result.status>=400,`${name} must reject non-admin`);assert.equal(dataTouched,false,name);assert.equal(bodyTouched,false,name);
  }
 }
});
