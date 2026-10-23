import {BookingError} from '../../shared/inventory/quantities.js';
import {reviewDeliveryLines} from '../../shared/inventory/deliveryReview.js';
import {loadDeliveryCatalog} from '../../shared/inventory/deliveryCatalog.js';

export function createReviewDeliveryHandler({createClientFromRequest,environment='dev',resolveActor=(_req,client)=>client.auth.me()}) {
    return async req => {
        try {
            if (req.method !== 'POST') throw new BookingError('METHOD_NOT_ALLOWED',405);
            const client = createClientFromRequest(req);
            let user;
            try {user = await resolveActor(req,client);} catch(error) {if(error instanceof BookingError)throw error;throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (req.headers.get('X-Data-Env') !== environment) throw new BookingError('DELIVERY_REVIEW_TEST_ONLY',503);
            const raw = await req.text();
            if (raw.length > 100_000) throw new BookingError('REVIEW_REQUEST_TOO_LARGE',413);
            let body;
            try {body = JSON.parse(raw);} catch {throw new BookingError('INVALID_REQUEST');}
            if (!body || typeof body !== 'object' || Array.isArray(body)
                || Object.keys(body).some(key => !['outlet_id','supplier_id','lines'].includes(key))
                || typeof body.supplier_id !== 'string' || !body.supplier_id || body.supplier_id.length > 100) throw new BookingError('INVALID_REQUEST');
            const catalog=await loadDeliveryCatalog(client.asServiceRole.entities,user,body.outlet_id,body.supplier_id);
            const result=reviewDeliveryLines({lines:body.lines,catalog,outletId:body.outlet_id,supplierId:body.supplier_id});
            return Response.json(result);
        } catch (error) {
            if (error instanceof BookingError) return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'DELIVERY_REVIEW_FAILED'},{status:500});
        }
    };
}
