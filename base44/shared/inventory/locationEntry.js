import {BookingError} from './quantities.js';

const fail=(code,status=403)=>{throw new BookingError(code,status);};
const string=(v,max=120)=>typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim();
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=text=>{if(!/^[A-Za-z0-9_-]+$/.test(text))fail('ENTRY_SIGNATURE_INVALID');return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));};
const launchFields=['v','kind','issuer','audience','environment','location_id','actor_ref','issued_at','expires_at'];
const sessionFields=['v','kind','issuer','audience','environment','location_id','binding_id','binding_revision','outlet_id','actor_ref','issued_at','expires_at'];
const LAUNCH_AGE=90_000,SESSION_AGE=60*60*1000;
export const employeeCookie='__Host-inventory_employee_dev';
async function key(secret){
 if(typeof secret!=='string'||encoder.encode(secret).length<32)fail('LOCATION_ENTRY_NOT_CONFIGURED',503);
 return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function signed(payload,secret,domain){
 const body=encode(encoder.encode(JSON.stringify(payload))),sig=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(`${domain}.${body}`));
 return `${body}.${encode(new Uint8Array(sig))}`;
}
async function verified(token,secret,domain){
 if(typeof token!=='string'||token.length>4000||token.split('.').length!==2)fail('ENTRY_SIGNATURE_INVALID');
 const [body,sig]=token.split('.');let payload,valid;
 try{
  valid=await crypto.subtle.verify('HMAC',await key(secret),decode(sig),encoder.encode(`${domain}.${body}`));
  if(valid)payload=JSON.parse(decoder.decode(decode(body)));
 }catch(error){if(error?.code==='LOCATION_ENTRY_NOT_CONFIGURED')throw error;fail('ENTRY_SIGNATURE_INVALID');}
 if(!valid)fail('ENTRY_SIGNATURE_INVALID');return payload;
}
function claims(value,config,kind,now){
 const fields=kind==='launch'?launchFields:sessionFields,maxAge=kind==='launch'?LAUNCH_AGE:SESSION_AGE;
 if(!exact(value,fields)||value.v!==1||value.kind!==kind||value.issuer!==config.issuer||value.audience!=='inventory'
  ||value.environment!=='dev'||!string(value.location_id)||!string(value.actor_ref,160)
  ||!Number.isSafeInteger(now)||!Number.isSafeInteger(value.issued_at)||!Number.isSafeInteger(value.expires_at)
  ||value.issued_at>now||value.expires_at<=now||value.expires_at<=value.issued_at||value.expires_at-value.issued_at>maxAge)fail('ENTRY_CONTEXT_INVALID');
 if(kind==='session'&&(!string(value.binding_id)||!string(value.outlet_id)||!Number.isSafeInteger(value.binding_revision)||value.binding_revision<0))fail('ENTRY_CONTEXT_INVALID');
 return value;
}
/** Server-to-server issuer helper. Never accepts a browser-supplied location or admin role. */
export async function issueLocationLaunch({resolveWorkContext,request,issuer,secret,now=Date.now()}){
 if(typeof resolveWorkContext!=='function'||!string(issuer))fail('LOCATION_ISSUER_NOT_CONFIGURED',503);
 const result=await resolveWorkContext(request);
 if(result?.ok!==true||!string(result.context?.location?.id)||!string(result.context?.user_id,160))fail('SOURCE_LOCATION_NOT_VERIFIED');
 return signed({v:1,kind:'launch',issuer,audience:'inventory',environment:'dev',location_id:result.context.location.id,
  actor_ref:result.context.user_id,issued_at:now,expires_at:now+LAUNCH_AGE},secret,'inventory-launch-v1');
}
export function base44LocationBindingStore(e){
 return {find:query=>e.InventoryOutletBinding.filter(query,'id',3),getOutlet:id=>e.Outlet.get(id)};
}
export async function resolveLocationBinding({store,issuer,locationId,now=Date.now()}){
 const query={source_app_id:issuer,source_location_id:locationId,environment:'dev',is_active:true};
 const rows=await store.find(query);
 if(!Array.isArray(rows)||rows.length!==1)fail(rows?.length?'LOCATION_BINDING_AMBIGUOUS':'LOCATION_BINDING_MISSING');
 const binding=rows[0];
 if(!string(binding.id)||!string(binding.outlet_id)||binding.source_app_id!==issuer||binding.source_location_id!==locationId
  ||binding.environment!=='dev'||binding.is_active!==true||!Number.isSafeInteger(binding.revision)||binding.revision<0)fail('LOCATION_BINDING_INVALID');
 if(!Number.isSafeInteger(binding.expires_at)||binding.expires_at<=now)fail('LOCATION_BINDING_EXPIRED');
 const reverse=await store.find({source_app_id:issuer,environment:'dev',outlet_id:binding.outlet_id,is_active:true});
 if(!Array.isArray(reverse)||reverse.length!==1||reverse[0].id!==binding.id)fail('LOCATION_BINDING_AMBIGUOUS');
 const outlet=await store.getOutlet(binding.outlet_id);
 if(!outlet||outlet.id!==binding.outlet_id||outlet.is_active!==true||outlet.type==='AGGREGATOR'||!string(outlet.name,300))fail('LOCATION_OUTLET_INACTIVE');
 return {binding,outlet};
}
function allowedOrigin(req,config){
 if(req.headers.get('X-Data-Env')!=='dev')fail('TEST_DATA_ENV_REQUIRED',503);
 if(!Array.isArray(config.origins)||!config.origins.includes(req.headers.get('Origin')))fail('ENTRY_ORIGIN_FORBIDDEN');
}
const cookieToken=req=>{
 const found=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(`${employeeCookie}=`));
 if(found.length!==1)fail('EMPLOYEE_ENTRY_REQUIRED',401);return found[0].slice(employeeCookie.length+1);
};
export async function exchangeLocationLaunch({req,launch,config,store,now=Date.now()}){
 allowedOrigin(req,config);
 const input=claims(await verified(launch,config.launchSecret,'inventory-launch-v1'),config,'launch',now);
 const {binding,outlet}=await resolveLocationBinding({store,issuer:input.issuer,locationId:input.location_id,now});
 const session={...input,kind:'session',binding_id:binding.id,binding_revision:binding.revision,outlet_id:outlet.id,issued_at:now,expires_at:Math.min(now+SESSION_AGE,binding.expires_at)};
 const token=await signed(session,config.sessionSecret,'inventory-session-v1');
 return {cookie:`${employeeCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor((session.expires_at-now)/1000)}`,outlet:{id:outlet.id,name:outlet.name}};
}
export async function employeeLocationContext({req,config,store,now=Date.now()}){
 allowedOrigin(req,config);
 const input=claims(await verified(cookieToken(req),config.sessionSecret,'inventory-session-v1'),config,'session',now);
 // Re-read both directions and outlet on every request: suspension/rebinding takes effect immediately.
 const {binding,outlet}=await resolveLocationBinding({store,issuer:input.issuer,locationId:input.location_id,now});
 if(binding.id!==input.binding_id||binding.revision!==input.binding_revision||outlet.id!==input.outlet_id)fail('LOCATION_BINDING_CHANGED');
 const digest=await crypto.subtle.sign('HMAC',await key(config.sessionSecret),encoder.encode(`inventory-actor-v1\n${input.issuer}\n${input.location_id}\n${input.actor_ref}`));
 const user={id:`location:${encode(new Uint8Array(digest))}`,role:'user',data:{outlet_id:outlet.id},access_kind:'location_entry'};
 return {user,outlet:{id:outlet.id,name:outlet.name}};
}
export async function inventoryRequestActor(req,client,config){
 const mode=req.headers.get('X-Inventory-Mode');
 if(mode==='employee')return(await employeeLocationContext({req,config,store:base44LocationBindingStore(client.asServiceRole.entities)})).user;
 if(mode!==null&&mode!=='admin')fail('ENTRY_MODE_INVALID');
 let user;try{user=await client.auth.me();}catch{fail('AUTHENTICATION_REQUIRED',401);}
 if(!user?.id)fail('AUTHENTICATION_REQUIRED',401);
 // Native user profile fields are not proof of a location assignment. Staff must use the signed cookie.
 if(user.role!=='admin')fail('ADMIN_REQUIRED');
 return user;
}
