import {BookingError} from '../../shared/inventory/quantities.js';
import {base44DeliveryDraftStore} from '../../shared/inventory/deliveryDraftStore.js';
import {createDeliveryDraftService} from '../../shared/inventory/deliveryDrafts.js';

const fields={options:[],list:['outlet_id'],get:['id'],start:['outlet_id','supplier_id','delivery_date','document_reference','start_key','lines'],
    save:['id','request_id','revision','lines'],confirm:['id','request_id','revision','line_id','supplier_item_id','acknowledged_issues'],
    propose:['id','request_id','revision','line_id','note'],resolve:['id','request_id','revision','line_id','resolution','note','supplier_item_id','identity_confirmed'],
    book:['id','revision','line_ids']};

export function createDeliveryDraftHandler({createClientFromRequest,isEnabled,storeFor=base44DeliveryDraftStore,now}) {
    return async req=>{
        try {
            if (req.method !== 'POST') throw new BookingError('METHOD_NOT_ALLOWED',405);
            const client=createClientFromRequest(req);
            let user;
            try {user=await client.auth.me();} catch {throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (req.headers.get('X-Data-Env') !== 'dev') throw new BookingError('TEST_DATA_ENV_REQUIRED',503);
            const raw=await req.text();
            if (raw.length > 150_000) throw new BookingError('REQUEST_TOO_LARGE',413);
            let body;
            try {body=JSON.parse(raw);} catch {throw new BookingError('INVALID_REQUEST',400);}
            if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(fields,body.action)
                || Object.keys(body).some(key=>key !== 'action' && !fields[body.action].includes(key))) throw new BookingError('INVALID_REQUEST',400);
            const writable=(await isEnabled(req))===true;
            if (!writable && !['options','list','get'].includes(body.action)) throw new BookingError('DELIVERY_DRAFT_TEST_DISABLED',503);
            const service=createDeliveryDraftService({store:storeFor(client.asServiceRole.entities,user),user,now});
            const {action,...input}=body;
            const value=action === 'options' ? await service.options() : action === 'list' ? await service.list(input.outlet_id)
                : action === 'get' ? await service.get(input.id) : await service[action](input);
            return Response.json(action === 'book' ? {draft:value} : ['get','options'].includes(action) ? {...value,read_only:!writable} : value);
        } catch(error) {
            if (error instanceof BookingError) return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'DELIVERY_DRAFT_REQUEST_UNCERTAIN_RETRY_SAME_OPERATION'},{status:500});
        }
    };
}
