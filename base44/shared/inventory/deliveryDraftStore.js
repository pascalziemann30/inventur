import {BookingError} from './quantities.js';
import {boundedDeliveryRows,loadDeliveryCatalog} from './deliveryCatalog.js';
import {assertOutletAccess} from './stock.js';

export function base44DeliveryDraftStore(entities,user) {
    const drafts=entities.DeliveryDraft;
    if (typeof drafts?.updateMany !== 'function') throw new BookingError('SDK_CONDITIONAL_UPDATE_UNAVAILABLE',503);
    return {
        verifiedAtomicWrites:true,
        get:id=>drafts.get(id),create:data=>drafts.create(data),
        find:query=>boundedDeliveryRows(drafts.filter(query,'-created_date',501)),
        catalog:(outlet,supplier)=>loadDeliveryCatalog(entities,user,outlet,supplier),
        async options() {
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (user.data?.outlet_id && user.outlet_id && user.data.outlet_id !== user.outlet_id) throw new BookingError('OUTLET_ASSIGNMENT_CONFLICT',403);
            const all=await boundedDeliveryRows(entities.Outlet.filter({is_active:true},'name',501));
            const outlets=all.filter(outlet=>outlet.type !== 'AGGREGATOR' && (user.role === 'admin' || outlet.id === (user.data?.outlet_id || user.outlet_id)));
            const suppliers=await boundedDeliveryRows(entities.Supplier.list('name',501));
            // Existing supplier names are catalog data; no contacts, prices or foreign outlet records are returned.
            return {outlets:outlets.map(outlet=>({id:outlet.id,name:outlet.name})),suppliers:suppliers.filter(supplier=>supplier.is_active !== false).map(supplier=>({id:supplier.id,name:supplier.name})),is_admin:user.role === 'admin'};
        },
        async list(outletId) {assertOutletAccess(user,outletId);return this.find({outlet_id:outletId});},
        async cas(draft,patch) {
            const result=await drafts.updateMany({id:draft.id,outlet_id:draft.outlet_id,revision:draft.revision},{$set:patch});
            if (result?.success !== true || result.has_more !== false || ![0,1].includes(result.updated)) throw new BookingError('UNVERIFIED_DRAFT_UPDATE_RESULT',503);
            return result.updated === 1;
        },
    };
}
