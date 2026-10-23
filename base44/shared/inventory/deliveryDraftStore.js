import {BookingError} from './quantities.js';
import {boundedDeliveryRows,loadDeliveryCatalog} from './deliveryCatalog.js';
import {assertOutletAccess} from './stock.js';
import {base44StockStore} from './base44Store.js';

export function base44DeliveryDraftStore(entities,user) {
    const drafts=entities.DeliveryDraft;
    if (typeof drafts?.updateMany !== 'function') throw new BookingError('SDK_CONDITIONAL_UPDATE_UNAVAILABLE',503);
    return {
        verifiedAtomicWrites:true,
        get stocks(){return base44StockStore(entities,true);},
        registry:{get:id=>entities.Outlet.get(id),async cas(outlet,patch){
            const result=await entities.Outlet.updateMany({id:outlet.id,delivery_registry_revision:outlet.delivery_registry_revision},{$set:patch});
            if(result?.success!==true || result.has_more!==false || ![0,1].includes(result.updated))throw new BookingError('UNVERIFIED_REGISTRY_UPDATE_RESULT',503);
            return result.updated===1;
        }},
        async stockFor(confirmation,outletId){
            const rows=await boundedDeliveryRows(entities.OutletStock.filter({outlet_id:outletId,outlet_item_id:confirmation.outlet_item_id},'id',501));
            if(rows.length!==1)throw new BookingError('UNIQUE_STOCK_REQUIRED',409);
            const stock=rows[0];
            if(stock.global_item_id!==confirmation.global_item_id || stock.unit_abbreviation!==confirmation.unit_abbreviation)throw new BookingError('STOCK_LINK_MISMATCH',409);
            return stock.id;
        },
        get:id=>drafts.get(id),create:data=>drafts.create(data),
        find:query=>boundedDeliveryRows(drafts.filter(query,'-created_date',501)),
        catalog:(outlet,supplier)=>loadDeliveryCatalog(entities,user,outlet,supplier),
        async options() {
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (user.data?.outlet_id && user.outlet_id && user.data.outlet_id !== user.outlet_id) throw new BookingError('OUTLET_ASSIGNMENT_CONFLICT',403);
            const all=await boundedDeliveryRows(entities.Outlet.filter({is_active:true},'name',501));
            const outlets=all.filter(outlet=>outlet.type !== 'AGGREGATOR' && ((user.role === 'admin'&&user.access_kind!=='password_admin') || outlet.id === (user.data?.outlet_id || user.outlet_id)));
            const suppliers=await boundedDeliveryRows(entities.Supplier.list('name',501));
            const connectedItems=await boundedDeliveryRows(entities.OutletItem.filter({outlet_id:{$in:outlets.map(o=>o.id)},is_active:true},'id',501));
            const connectedSuppliers=new Set(connectedItems.map(i=>i.supplier_id));
            // Existing supplier names are catalog data; no contacts, prices or foreign outlet records are returned.
            return {outlets:outlets.map(outlet=>({id:outlet.id,name:outlet.name})),suppliers:suppliers.filter(supplier=>supplier.is_active !== false&&connectedSuppliers.has(supplier.id)).map(supplier=>({id:supplier.id,name:supplier.name})),is_admin:user.role === 'admin'};
        },
        async list(outletId) {assertOutletAccess(user,outletId);return this.find({outlet_id:outletId});},
        async cas(draft,patch) {
            const result=await drafts.updateMany({id:draft.id,outlet_id:draft.outlet_id,revision:draft.revision},{$set:patch});
            if (result?.success !== true || result.has_more !== false || ![0,1].includes(result.updated)) throw new BookingError('UNVERIFIED_DRAFT_UPDATE_RESULT',503);
            return result.updated === 1;
        },
    };
}
