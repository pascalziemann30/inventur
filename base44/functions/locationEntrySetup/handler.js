import {BookingError} from '../../shared/inventory/quantities.js';
const fail=(code,status=403)=>{throw new BookingError(code,status);};
const id=value=>typeof value==='string'&&/^[a-f0-9]{24}$/.test(value);
const keyState=value=>typeof value!=='string'||!value.length?'missing':keyReady(value)?'ready':/^(?:[*.•●]+)$/.test(value)||value.endsWith('...')||value.endsWith('…')?'placeholder':'short';
const keyReady=value=>typeof value==='string'&&new TextEncoder().encode(value).length>=32;
export function createLocationSetupHandler({createClientFromRequest,config,isEnabled,now=Date.now}){
 return async req=>{
  try{
   if(req.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
   if(req.headers.get('X-Data-Env')!=='dev')fail('TEST_DATA_ENV_REQUIRED');
   if(!config.origins?.includes(req.headers.get('Origin')))fail('ENTRY_ORIGIN_FORBIDDEN');
   const raw=await req.text();if(raw.length>2000)fail('REQUEST_TOO_LARGE',413);
   const body=JSON.parse(raw),fields={status:[],prepare:['outlet_id'],activate:['id','revision'],close:['id','revision']};
   if(!body||!Object.hasOwn(fields,body.action)||Object.keys(body).some(k=>k!=='action'&&!fields[body.action].includes(k)))fail('INVALID_REQUEST',400);
   const client=createClientFromRequest(req);let user;
   try{user=await client.auth.me();}catch{fail('AUTHENTICATION_REQUIRED',401);}
   if(!user?.id||user.role!=='admin')fail('ADMIN_REQUIRED');
   const e=client.asServiceRole.entities,at=now(),ready=id(config.issuer)&&keyReady(config.launchSecret)&&keyReady(config.sessionSecret);
   const bindings=id(config.issuer)?await e.InventoryOutletBinding.filter({source_app_id:config.issuer,source_location_id:config.issuer,environment:'dev'},'id',3):[];
   if(!Array.isArray(bindings)||bindings.length>1)fail('LOCATION_BINDING_AMBIGUOUS');
   const eligible=outlet=>outlet&&id(outlet.id)&&outlet.type==='NORMAL'&&typeof outlet.code==='string'&&outlet.code.startsWith('CATALOG-TEST-');
   const readOutlet=async outletId=>{if(!id(outletId))fail('INVALID_REQUEST',400);const outlet=await e.Outlet.get(outletId);if(!eligible(outlet))fail('CATALOG_TEST_OUTLET_REQUIRED');return outlet;};
   const publicBinding=b=>b?{id:b.id,outlet_id:b.outlet_id,is_active:b.is_active,revision:b.revision,expires_at:b.expires_at}:null;
   if(body.action==='status'){
    const outlets=(await e.Outlet.filter({type:'NORMAL'},'name',501)).filter(eligible).map(o=>({id:o.id,name:o.name,is_active:o.is_active}));
    return Response.json({ready,source_id_configured:id(config.issuer),launch_key_configured:keyReady(config.launchSecret),session_key_configured:keyReady(config.sessionSecret),
     launch_key_state:keyState(config.launchSecret),session_key_state:keyState(config.sessionSecret),write_window_open:(await isEnabled())===true,outlets,binding:publicBinding(bindings[0])},{headers:{'Cache-Control':'no-store'}});
   }
   if(!ready)fail('LOCATION_ENTRY_NOT_CONFIGURED',503);
   if(body.action==='prepare'){
    if((await isEnabled())===true)fail('CLOSE_TEST_WINDOW_BEFORE_PREPARATION');
    const outlet=await readOutlet(body.outlet_id);
    if(bindings.length){if(bindings[0].outlet_id!==outlet.id)fail('LOCATION_BINDING_CHANGED');return Response.json({binding:publicBinding(bindings[0])},{headers:{'Cache-Control':'no-store'}});}
    const binding=await e.InventoryOutletBinding.create({source_app_id:config.issuer,source_location_id:config.issuer,outlet_id:outlet.id,environment:'dev',is_active:false,revision:0,expires_at:0,notes:'Single-app development binding; prepared inactive, expires automatically.'});
    const check=await e.InventoryOutletBinding.filter({source_app_id:config.issuer,source_location_id:config.issuer,environment:'dev'},'id',3);
    if(check.length!==1||check[0].id!==binding.id)fail('LOCATION_BINDING_AMBIGUOUS');
    return Response.json({binding:publicBinding(binding)},{headers:{'Cache-Control':'no-store'}});
   }
   const binding=bindings[0];
   if(!binding||binding.id!==body.id||!Number.isSafeInteger(body.revision)||binding.revision!==body.revision)fail('LOCATION_BINDING_CHANGED');
   const outlet=await readOutlet(binding.outlet_id);
   if(body.action==='activate'){
    if((await isEnabled())!==true)fail('LOCATION_ENTRY_TEST_DISABLED',503);
    const reverse=await e.InventoryOutletBinding.filter({source_app_id:config.issuer,environment:'dev',outlet_id:outlet.id,is_active:true},'id',3);
    if(reverse.some(r=>r.id!==binding.id)||reverse.length>1)fail('LOCATION_BINDING_AMBIGUOUS');
    await e.Outlet.update(outlet.id,{is_active:true});
    const active=await e.InventoryOutletBinding.update(binding.id,{is_active:true,expires_at:at+15*60*1000,revision:binding.revision+1});
    return Response.json({binding:publicBinding(active)},{headers:{'Cache-Control':'no-store'}});
   }
   // Revocation remains possible after the write window closes. Disable the binding before its test outlet.
   const closed=await e.InventoryOutletBinding.update(binding.id,{is_active:false,expires_at:at,revision:binding.revision+1});
   await e.Outlet.update(outlet.id,{is_active:false});
   return Response.json({binding:publicBinding(closed)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof BookingError?error.code:error instanceof SyntaxError?'INVALID_REQUEST':'LOCATION_SETUP_UNAVAILABLE'},
   {status:error instanceof BookingError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'no-store'}});}
 };
}
