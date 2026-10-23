import {BookingError} from './quantities.js';
import {assertOutletAccess} from './stock.js';
import {offerIdentityKey} from './deliveryReview.js';

export const boundedDeliveryRows = async promise => {
    const rows=await promise;
    if (!Array.isArray(rows) || rows.length >= 501) throw new BookingError('REVIEW_CATALOG_REQUIRES_PAGING',409);
    return rows;
};

export async function loadDeliveryCatalog(e,user,outletId,supplierId) {
    assertOutletAccess(user,outletId);
    const [outlet,supplier]=await Promise.all([e.Outlet.get(outletId),e.Supplier.get(supplierId)]);
    if (!outlet || outlet.is_active !== true || outlet.type === 'AGGREGATOR') throw new BookingError('OUTLET_NOT_ACTIVE',409);
    if (!supplier || supplier.is_active === false) throw new BookingError('SUPPLIER_NOT_ACTIVE',409);
    const [items,offers]=await Promise.all([
        boundedDeliveryRows(e.OutletItem.filter({outlet_id:outletId},'id',501)),
        boundedDeliveryRows(e.SupplierItem.filter({supplier_id:supplierId},'id',501)),
    ]);
    const ids=[...new Set(items.filter(item=>item.is_active === true).map(item=>item.global_item_id).filter(Boolean))];
    const globals=(await Promise.all(ids.map(id=>e.GlobalItem.get(id)))).filter(Boolean);
    const scopedOffers=offers.filter(offer=>ids.includes(offer.global_item_id)).map(offer=>({...offer,
        identity_conflict:offers.filter(other=>offerIdentityKey(other) === offerIdentityKey(offer)).length > 1,
    }));
    return {outlet,supplier,items,offers:scopedOffers,globals};
}
