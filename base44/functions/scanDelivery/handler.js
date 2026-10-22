import {BookingError} from '../../shared/inventory/quantities.js';
import {createDeliveryScanService} from '../../shared/inventory/deliveryScan.js';
import {base44DeliveryScanStore} from '../../shared/inventory/deliveryScanStore.js';
import {base44DeliveryDraftStore} from '../../shared/inventory/deliveryDraftStore.js';
import {createDeliveryDraftService} from '../../shared/inventory/deliveryDrafts.js';
export function createScanDeliveryHandler({createClientFromRequest,isEnabled,serviceFor,now}){
    return async req=>{
        try{
            if(req.method!=='POST')throw new BookingError('METHOD_NOT_ALLOWED',405);
            const client=createClientFromRequest(req);
            let user;try{user=await client.auth.me();}catch{throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if(!user?.id)throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if(req.headers.get('X-Data-Env')!=='dev')throw new BookingError('TEST_DATA_ENV_REQUIRED',503);
            const writable=isEnabled(req),multipart=req.headers.get('content-type')?.startsWith('multipart/form-data');
            const limit=multipart?10*1024*1024+100000:150000;
            if(Number(req.headers.get('content-length'))>limit)throw new BookingError('REQUEST_TOO_LARGE',413);
            // Bound streamed bodies as well as their optional declared length.
            const reader=req.body?.getReader(),chunks=[];let size=0;
            if(!reader)throw new BookingError('INVALID_REQUEST',400);
            while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BookingError('REQUEST_TOO_LARGE',413);}chunks.push(value);}
            const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
            let body;
            if(multipart){const form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')}}).formData();body={};for(const [key,value]of form){if(Object.hasOwn(body,key))throw new BookingError('INVALID_REQUEST',400);body[key]=value;}}
            else{try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new BookingError('INVALID_REQUEST',400);}}
            const fields={upload:['file','outlet_id','supplier_id'],get:['id'],analyze:['id','revision'],commit:['id','revision','review']};
            if(!body || typeof body!=='object' || !Object.hasOwn(fields,body.action) || Object.keys(body).some(key=>key!=='action' && !fields[body.action].includes(key)) || multipart!==(body.action==='upload'))throw new BookingError('INVALID_REQUEST',400);
            if(!writable && body.action!=='get')throw new BookingError('DELIVERY_SCAN_TEST_DISABLED',503);
            const entities=client.asServiceRole.entities;
            const service=serviceFor?serviceFor(client,user):createDeliveryScanService({store:base44DeliveryScanStore(entities,user),core:client.asServiceRole.integrations.Core,user,
                drafts:createDeliveryDraftService({store:base44DeliveryDraftStore(entities,user),user,now}),now});
            const {action,...input}=body;
            const result=action==='get'?await service.get(input.id):await service[action](input);
            return Response.json({...result,read_only:!writable});
        }catch(error){if(error instanceof BookingError)return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'SCAN_REQUEST_UNCERTAIN_RELOAD'},{status:500});}
    };
}
