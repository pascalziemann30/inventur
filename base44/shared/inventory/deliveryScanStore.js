import {BookingError} from './quantities.js';
import {boundedDeliveryRows,loadDeliveryCatalog} from './deliveryCatalog.js';
export function base44DeliveryScanStore(entities,user){
    const scans=entities.DeliveryScan;
    // Request-scoped only: repeated access checks/projecting reuse this read, never another request's catalog.
    const catalogs=new Map();
    const catalog=(outlet,supplier)=>{const key=JSON.stringify([outlet,supplier]);if(!catalogs.has(key))catalogs.set(key,loadDeliveryCatalog(entities,user,outlet,supplier));return catalogs.get(key);};
    if(typeof scans?.updateMany!=='function')throw new BookingError('SDK_CONDITIONAL_UPDATE_UNAVAILABLE',503);
    return {get:id=>scans.get(id),create:data=>scans.create(data),find:query=>boundedDeliveryRows(scans.filter(query,'-created_date',501)),
        catalog,
        async cas(scan,patch){
            const result=await scans.updateMany({id:scan.id,actor_id:user.id,revision:scan.revision},{$set:patch});
            if(result?.success!==true || result.has_more!==false || ![0,1].includes(result.updated))throw new BookingError('UNVERIFIED_SCAN_UPDATE_RESULT',503);
            return result.updated===1;
        }};
}
