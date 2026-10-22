import {BookingError} from '../../shared/inventory/quantities.js';
import {createCatalogImportService,base44CatalogImportStore} from '../../shared/inventory/catalogImport.js';
const fields={status:[],start:['key','articles'],get:['id'],inspect:['id'],recover:['id','revision'],step:['id','revision'],verify:['id','revision'],close:['id','revision']};
export function createCatalogImportHandler({createClientFromRequest,isEnabled,storeFor=base44CatalogImportStore}){
 return async req=>{
  let stage='authorize';
  try{
   if(req.method!=='POST')throw new BookingError('METHOD_NOT_ALLOWED',405);
   const client=createClientFromRequest(req);let user;
   try{user=await client.auth.me();}catch{throw new BookingError('AUTHENTICATION_REQUIRED',401);}
   if(!user?.id)throw new BookingError('AUTHENTICATION_REQUIRED',401);
   if(user.role!=='admin')throw new BookingError('ADMIN_REQUIRED',403);
   if(req.headers.get('X-Data-Env')!=='dev')throw new BookingError('TEST_DATA_ENV_REQUIRED',503);
   const raw=await req.text();if(raw.length>750000)throw new BookingError('REQUEST_TOO_LARGE',413);
   const body=JSON.parse(raw);
   if(!body||!Object.hasOwn(fields,body.action)||Object.keys(body).some(k=>k!=='action'&&!fields[body.action].includes(k)))throw new BookingError('INVALID_REQUEST',400);
   const enabled=(await isEnabled(req))===true;
   if(body.action==='status')return Response.json({enabled,runtime_version:'catalog-import-test-v2'});
   if(!enabled&&!['get','inspect'].includes(body.action))throw new BookingError('IMPORT_TEST_WINDOW_CLOSED',503);
   stage=body.action;
   const service=createCatalogImportService({store:storeFor(client.asServiceRole.entities),user});
   const {action,...input}=body;
   return Response.json({...await service[action](input),read_only:!enabled});
  }catch(error){return Response.json({error:error instanceof BookingError?error.code:error instanceof SyntaxError?'INVALID_REQUEST':'IMPORT_REQUEST_UNCERTAIN_RELOAD',stage,
   ...(Number.isInteger(error.status)?{platform_status:error.status}:{})},
   {status:error instanceof BookingError?error.status:error instanceof SyntaxError?400:500});}
 };
}
