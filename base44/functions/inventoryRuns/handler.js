import {BookingError} from '../../shared/inventory/quantities.js';
import {createInventoryRunService} from '../../shared/inventory/runs.js';
import {base44RunStore} from '../../shared/inventory/runStore.js';

const fields={start:['outlet_id','period_type','session_date','start_key'],list:['outlet_id'],get:['id'],
    save:['id','request_id','revision','entries'],finalize:['id','revision'],reopen:['id','article_id','request_id','revision']};

export function createInventoryRunsHandler({createClientFromRequest,isEnabled,storeFor=base44RunStore,now}) {
    return async req=>{
        try {
            if (req.method !== 'POST') return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
            const client=createClientFromRequest(req);
            let user;
            try {user=await client.auth.me();} catch {throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            // Test-only rollout: the SDK forwards this exact environment header to every entity call.
            if (req.headers.get('X-Data-Env') !== 'dev' || !isEnabled(req)) throw new BookingError('INVENTORY_TEST_ROLLOUT_DISABLED',503);
            const text=await req.text();
            if (text.length > 150_000) throw new BookingError('REQUEST_TOO_LARGE',413);
            let body;
            try {body=JSON.parse(text);} catch {throw new BookingError('INVALID_REQUEST',400);}
            if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(fields,body.action)
                || Object.keys(body).some(name=>name !== 'action' && !fields[body.action].includes(name))) throw new BookingError('INVALID_REQUEST',400);
            const service=createInventoryRunService({store:storeFor(client.asServiceRole.entities),user,now});
            const {action,...input}=body;
            const result=action === 'list' ? await service.list(input.outlet_id) : action === 'get' ? await service.get(input.id) : await service[action](input);
            return Response.json(result);
        } catch (error) {
            if (error instanceof BookingError) return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'INVENTORY_REQUEST_UNCERTAIN_RETRY_SAME_OPERATION'},{status:500});
        }
    };
}
