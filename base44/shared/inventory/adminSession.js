import {BookingError} from './quantities.js';

const encoder=new TextEncoder(),outletId='697f405ef1744da8ba46c99d',age=30*24*60*60*1000;
const fail=(code,status=401)=>{throw new BookingError(code,status);};
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const cookie=config=>`__Host-inventory_admin_${config.environment==='prod'?'prod':'dev'}`;
export const adminPasswordConfigured=config=>config.environment==='prod'&&typeof config.adminPassword==='string'&&config.adminPassword.length>=12&&config.adminPassword.length<=256&&typeof config.sessionSecret==='string'&&encoder.encode(config.sessionSecret).length>=32;
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
async function equal(left,right){const a=await digest(left),b=await digest(right);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
async function signingKey(config){
 if(!adminPasswordConfigured(config))fail('ADMIN_PASSWORD_NOT_CONFIGURED',503);
 return crypto.subtle.importKey('raw',await digest(`inventory-admin-key-v1\n${config.sessionSecret}\n${config.adminPassword}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function sessionCookie(config,claims,now){
 const payload=encode(encoder.encode(JSON.stringify(claims))),signature=await crypto.subtle.sign('HMAC',await signingKey(config),encoder.encode(`inventory-admin-session-v1.${payload}`));
 return `${cookie(config)}=${payload}.${encode(new Uint8Array(signature))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor((claims.expires_at-now)/1000)}`;
}
const user=()=>({id:'password-admin:kuno15',role:'admin',access_kind:'password_admin',outlet_id:outletId,data:{outlet_id:outletId}});
async function activeOutlet(store){const outlet=await store.getOutlet(outletId);if(!outlet||outlet.id!==outletId||outlet.is_active!==true||outlet.type==='AGGREGATOR')fail('LOCATION_OUTLET_INACTIVE',403);return {id:outlet.id,name:outlet.name};}
export async function adminSessionContext({req,config,store,now=Date.now()}){
 const name=cookie(config),matches=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));
 if(matches.length!==1)fail('ADMIN_PASSWORD_REQUIRED');
 const value=matches[0].slice(name.length+1);if(value.length>2000)fail('ADMIN_PASSWORD_REQUIRED');
 const parts=value.split('.');if(parts.length!==2||parts.some(p=>!/^[-_A-Za-z0-9]+$/.test(p)))fail('ADMIN_PASSWORD_REQUIRED');
 let claims,valid;try{claims=JSON.parse(new TextDecoder().decode(decode(parts[0])));valid=await crypto.subtle.verify('HMAC',await signingKey(config),decode(parts[1]),encoder.encode(`inventory-admin-session-v1.${parts[0]}`));}catch{fail('ADMIN_PASSWORD_REQUIRED');}
 if(!valid||!claims||Object.keys(claims).sort().join(',')!=='environment,expires_at,issued_at,kind,nonce,outlet_id,v'||claims.v!==1||claims.kind!=='admin_session'||claims.environment!==(config.environment||'dev')||claims.outlet_id!==outletId||!/^[-a-f0-9]{36}$/.test(claims.nonce)||!Number.isSafeInteger(claims.issued_at)||!Number.isSafeInteger(claims.expires_at)||claims.issued_at>now||claims.expires_at<=now||claims.expires_at<=claims.issued_at||claims.expires_at-claims.issued_at>age)fail('ADMIN_PASSWORD_REQUIRED');
 const outlet=await activeOutlet(store);
 // Upgrade a still-valid one-hour session, retaining its original sign-in date.
 // Ordinary navigation never pushes the thirty-day deadline forward.
 const upgraded=claims.expires_at<claims.issued_at+age?await sessionCookie(config,{...claims,expires_at:claims.issued_at+age},now):undefined;
 return {user:user(),outlet,...(upgraded?{cookie:upgraded}:{})};
}
async function reserveAttempt(store,now){
 for(let retry=0;retry<4;retry++){
  const outlet=await store.getOutlet(outletId);if(!outlet||outlet.is_active!==true)fail('LOCATION_OUTLET_INACTIVE',403);
  const previous=outlet.admin_auth_state,within=previous&&Number.isSafeInteger(previous.started_at)&&previous.started_at<=now&&now-previous.started_at<300000;
  const attempts=within?previous.attempts:0;if(!Number.isSafeInteger(attempts)||attempts<0)fail('ADMIN_LOGIN_UNAVAILABLE',503);
  if(attempts>=8)fail('ADMIN_LOGIN_PAUSED',429);
  if(await store.reserve(outlet,{started_at:within?previous.started_at:now,attempts:attempts+1}))return;
 }
 fail('ADMIN_LOGIN_RETRY',409);
}
export async function loginAdminPassword({password,config,store,now=Date.now()}){
 if(!adminPasswordConfigured(config))fail('ADMIN_PASSWORD_NOT_CONFIGURED',503);
 if(typeof password!=='string'||password.length>256)fail('INVALID_REQUEST',400);
 await reserveAttempt(store,now);
 if(!await equal(password,config.adminPassword))fail('ADMIN_PASSWORD_INCORRECT');
 const outlet=await activeOutlet(store),claims={v:1,kind:'admin_session',environment:config.environment||'dev',outlet_id:outletId,issued_at:now,expires_at:now+age,nonce:crypto.randomUUID()};
 return {user:user(),outlet,cookie:await sessionCookie(config,claims,now)};
}
export const clearAdminCookie=config=>`${cookie(config)}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function adminSessionStore(e){return {
 getOutlet:id=>e.Outlet.get(id),
 reserve:async(outlet,state)=>{
  const revision=outlet.admin_auth_revision||0;
  const result=await e.Outlet.updateMany({id:outlet.id,...(revision===0?{$or:[{admin_auth_revision:0},{admin_auth_revision:{$exists:false}}]}:{admin_auth_revision:revision})},{$set:{admin_auth_revision:revision+1,admin_auth_state:state}});
  if(result?.success!==true||result.has_more!==false||![0,1].includes(result.updated))fail('ADMIN_LOGIN_UNAVAILABLE',503);
  return result.updated===1;
 }
};}
