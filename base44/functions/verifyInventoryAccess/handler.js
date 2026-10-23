import {serverOwnedEntities,adminManagedEntities} from '../../shared/inventory/entityAccessPolicy.js';
const deniedStatus = error => [401,403,404].includes(error?.status ?? error?.response?.status);
const readState = async (entity,id) => {
    try {
        const rows = await entity.filter({id},'id',1);
        return Array.isArray(rows) ? rows.some(row=>row?.id===id) ? 'allowed' : rows.length===0 ? 'denied' : 'error' : 'error';
    } catch(error) {return deniedStatus(error) ? 'denied' : 'error';}
};
export function createVerifyInventoryAccessHandler({createClientFromRequest,createAnonymousClient,appId,origin}) {
    return async req => {
        try {
            if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
            if(req.headers.get('X-Data-Env')!=='dev'||req.headers.get('Origin')!==origin)return Response.json({error:'DEVELOPMENT_CONTEXT_REQUIRED'},{status:403});
            const client=createClientFromRequest(req);
            let user;
            try{user=await client.auth.me();}catch{return Response.json({error:'AUTHENTICATION_REQUIRED'},{status:401});}
            if(!user?.id||user.role!=='admin')return Response.json({error:'ADMIN_REQUIRED'},{status:403});
            if((await req.text()).trim()!=='{"action":"check"}')return Response.json({error:'INVALID_REQUEST'},{status:400});
            if(typeof appId!=='string'||!/^[a-f0-9]{24}$/.test(appId))return Response.json({error:'APP_NOT_CONFIGURED'},{status:503});
            // No caller token, service token, cookies or request headers are forwarded to this client.
            const anonymous=createAnonymousClient(appId),checks=[];
            for(const name of [...adminManagedEntities,...serverOwnedEntities]) {
                const expectedAdmin=adminManagedEntities.includes(name)?'allowed':'denied';
                try {
                    // Existing test records only. No fixtures are created or edited; identifiers/data never leave this handler.
                    const rows=await client.asServiceRole.entities[name].list('id',1);
                    if(!Array.isArray(rows))throw Error('Invalid response');
                    if(!rows.length){checks.push({entity:name,service_read:'allowed',admin_read:'no_sample',anonymous_read:'no_sample',expected_admin:expectedAdmin});continue;}
                    if(typeof rows[0]?.id!=='string')throw Error('Missing identity');
                    const id=rows[0].id;
                    const admin=await readState(client.entities[name],id);
                    const anon=await readState(anonymous.entities[name],id);
                    checks.push({entity:name,service_read:'allowed',admin_read:admin,anonymous_read:anon,expected_admin:expectedAdmin});
                } catch {checks.push({entity:name,service_read:'error',admin_read:'untested',anonymous_read:'untested',expected_admin:expectedAdmin});}
            }
            const tested=checks.filter(c=>c.admin_read!=='no_sample'), failures=tested.filter(c=>c.service_read!=='allowed'||c.admin_read!==c.expected_admin||c.anonymous_read!=='denied');
            return Response.json({passed:tested.length>0&&failures.length===0,tested_models:tested.length,empty_models:checks.filter(c=>c.admin_read==='no_sample').length,checks,
                write_probe_performed:false,native_non_admin_account_tested:false},{headers:{'Cache-Control':'no-store'}});
        } catch {return Response.json({error:'ACCESS_CHECK_UNAVAILABLE'},{status:503});}
    };
}
