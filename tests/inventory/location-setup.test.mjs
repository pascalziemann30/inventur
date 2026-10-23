import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocationSetupHandler} from '../../base44/functions/locationEntrySetup/handler.js';
const at=1800000000000,issuer='aaaaaaaaaaaaaaaaaaaaaaaa',testId='bbbbbbbbbbbbbbbbbbbbbbbb',otherId='cccccccccccccccccccccccc';
function fixture(){
 const rows=[],outlets=[{id:testId,name:'Synthetic catalog test',type:'NORMAL',code:'CATALOG-TEST-synthetic',is_active:false},{id:otherId,name:'Other outlet',type:'NORMAL',code:'KUNO',is_active:true}];
 let writes=0,open=false,user={id:'native-admin',role:'admin'};
 const filter=(list,query)=>list.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v));
 const entities={InventoryOutletBinding:{filter:async query=>structuredClone(filter(rows,query)),create:async value=>{writes++;const r={...value,id:'dddddddddddddddddddddddd'};rows.push(r);return structuredClone(r);},update:async(id,patch)=>{writes++;const r=rows.find(r=>r.id===id);Object.assign(r,patch);return structuredClone(r);}},
 Outlet:{filter:async query=>structuredClone(filter(outlets,query)),get:async id=>structuredClone(outlets.find(o=>o.id===id)),update:async(id,patch)=>{writes++;Object.assign(outlets.find(o=>o.id===id),patch);}}};
 const config={issuer,launchSecret:'synthetic-launch-key-not-a-real-secret-0001',sessionSecret:'synthetic-session-key-not-a-real-secret-0002',origins:['https://inventory.example.invalid']};
 const handler=createLocationSetupHandler({createClientFromRequest:()=>({auth:{me:async()=>user},asServiceRole:{entities}}),config,isEnabled:()=>open,now:()=>at});
 const call=(body,headers={})=>handler(new Request('https://inventory.example.invalid/setup',{method:'POST',headers:{Origin:config.origins[0],'X-Data-Env':'dev',...headers},body:JSON.stringify(body)}));
 return {rows,outlets,config,call,writes:()=>writes,setOpen:v=>open=v,setUser:v=>user=v};
}
test('setup requires native admin, exact origin and dev; client role claims cannot authorize it',async()=>{
 for(const user of [null,{id:'employee',role:'user'},{id:'unknown',role:'guest'}]){const f=fixture();f.setUser(user);assert.equal((await f.call({action:'status'})).status,403);assert.equal(f.writes(),0);}
 const f=fixture();for(const headers of [{Origin:'https://foreign.example'},{'X-Data-Env':'prod'}])assert.equal((await f.call({action:'status'},headers)).status,403);
 assert.equal((await f.call({action:'prepare',outlet_id:testId,role:'admin'})).status,400);assert.equal(f.writes(),0);
});
test('readiness lists only catalog test outlets and never returns key values',async()=>{
 const f=fixture(),s=await(await f.call({action:'status'})).json();assert.equal(s.ready,true);assert.deepEqual(s.outlets.map(x=>x.id),[testId]);assert.equal(s.write_window_open,false);
 assert(!JSON.stringify(s).includes(f.config.launchSecret));assert(!JSON.stringify(s).includes(f.config.sessionSecret));assert.equal(f.writes(),0);
});
test('preparation creates one inactive expired binding; retries reuse it and do not enable the outlet',async()=>{
 const f=fixture();assert.equal((await f.call({action:'prepare',outlet_id:testId})).status,200);assert.equal(f.rows.length,1);assert.equal(f.rows[0].is_active,false);assert.equal(f.rows[0].expires_at,0);assert.equal(f.outlets[0].is_active,false);
 assert.equal((await f.call({action:'prepare',outlet_id:testId})).status,200);assert.equal(f.writes(),1);
});
test('cannot prepare with open grant or select a normal outlet even as native admin',async()=>{
 const f=fixture();assert.equal((await f.call({action:'prepare',outlet_id:otherId})).status,403);f.setOpen(true);assert.equal((await f.call({action:'prepare',outlet_id:testId})).status,403);assert.equal(f.writes(),0);
});
test('activation needs a fresh grant and revision; closing after the gate closes revokes only the test outlet',async()=>{
 const f=fixture();await f.call({action:'prepare',outlet_id:testId});const binding=f.rows[0],request={action:'activate',id:binding.id,revision:0};
 assert.equal((await f.call(request)).status,503);assert.equal(f.rows[0].is_active,false);f.setOpen(true);assert.equal((await f.call({...request,revision:5})).status,403);
 assert.equal((await f.call(request)).status,200);assert.equal(f.rows[0].is_active,true);assert.equal(f.rows[0].expires_at,at+900000);assert.equal(f.outlets[0].is_active,true);
 f.setOpen(false);assert.equal((await f.call({action:'close',id:binding.id,revision:1})).status,200);assert.equal(f.rows[0].is_active,false);assert.equal(f.outlets[0].is_active,false);assert.equal(f.outlets[1].is_active,true);
});
test('duplicates and incomplete keys fail closed without writing',async()=>{
 const f=fixture();f.rows.push({source_app_id:issuer,source_location_id:issuer,environment:'dev'},{source_app_id:issuer,source_location_id:issuer,environment:'dev'});assert.equal((await f.call({action:'status'})).status,403);assert.equal(f.writes(),0);
 const empty=fixture();empty.config.sessionSecret='';assert.equal((await empty.call({action:'prepare',outlet_id:testId})).status,503);assert.equal(empty.writes(),0);
});

test('key diagnostics distinguish missing values from short ones without exposing either value',async()=>{
 const f=fixture();f.config.launchSecret=undefined;f.config.sessionSecret='short-example';
 const result=await(await f.call({action:'status'})).json();
 assert.equal(result.launch_key_state,'missing');assert.equal(result.session_key_state,'short');assert(!JSON.stringify(result).includes('short-example'));
});

test('short redacted placeholders are diagnosed without echoing their content or enabling writes',async()=>{
 for(const placeholder of ['**********','synthetic-prefix...','synthetic-prefix…','••••••••']){
  const f=fixture();f.config.launchSecret=placeholder;f.config.sessionSecret=placeholder;
  const result=await(await f.call({action:'status'})).json();
  assert.equal(result.launch_key_state,'placeholder');assert.equal(result.session_key_state,'placeholder');assert.equal(result.ready,false);
  assert(!JSON.stringify(result).includes(placeholder));assert.equal((await f.call({action:'prepare',outlet_id:testId})).status,503);assert.equal(f.writes(),0);
 }
});
