import {BookingError} from '../../shared/inventory/quantities.js';
import {assertOutletAccess} from '../../shared/inventory/stock.js';
import {reviewDeliveryLines} from '../../shared/inventory/deliveryReview.js';

const bounded = async promise => {
    const rows = await promise;
    if (!Array.isArray(rows) || rows.length >= 501) throw new BookingError('REVIEW_CATALOG_REQUIRES_PAGING',409);
    return rows;
};

export function createReviewDeliveryHandler({createClientFromRequest}) {
    return async req => {
        try {
            if (req.method !== 'POST') throw new BookingError('METHOD_NOT_ALLOWED',405);
            const client = createClientFromRequest(req);
            let user;
            try {user = await client.auth.me();} catch {throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (req.headers.get('X-Data-Env') !== 'dev') throw new BookingError('DELIVERY_REVIEW_TEST_ONLY',503);
            const raw = await req.text();
            if (raw.length > 100_000) throw new BookingError('REVIEW_REQUEST_TOO_LARGE',413);
            let body;
            try {body = JSON.parse(raw);} catch {throw new BookingError('INVALID_REQUEST');}
            if (!body || typeof body !== 'object' || Array.isArray(body)
                || Object.keys(body).some(key => !['outlet_id','supplier_id','lines'].includes(key))
                || typeof body.supplier_id !== 'string' || !body.supplier_id || body.supplier_id.length > 100) throw new BookingError('INVALID_REQUEST');
            assertOutletAccess(user,body.outlet_id);
            const e = client.asServiceRole.entities;
            const outlet = await e.Outlet.get(body.outlet_id);
            if (!outlet || outlet.is_active !== true || outlet.type === 'AGGREGATOR') throw new BookingError('OUTLET_NOT_ACTIVE',409);
            const supplier = await e.Supplier.get(body.supplier_id);
            if (!supplier || supplier.is_active === false) throw new BookingError('SUPPLIER_NOT_ACTIVE',409);
            const [items,offers] = await Promise.all([
                bounded(e.OutletItem.filter({outlet_id:body.outlet_id},'id',501)),
                bounded(e.SupplierItem.filter({supplier_id:body.supplier_id},'id',501)),
            ]);
            // Fetch only global products referenced at this authorized outlet. No whole-company catalog response.
            const ids = [...new Set(items.filter(item => item.is_active === true).map(item => item.global_item_id).filter(Boolean))];
            const globals = (await Promise.all(ids.map(id => e.GlobalItem.get(id)))).filter(Boolean);
            const scopedOffers = offers.filter(offer => ids.includes(offer.global_item_id)).map(offer => ({...offer,
                identity_conflict:offers.filter(other => other.supplier_article_number === offer.supplier_article_number
                    && other.purchase_unit_code === offer.purchase_unit_code).length > 1,
            }));
            const result = reviewDeliveryLines({lines:body.lines,catalog:{items,offers:scopedOffers,globals},outletId:body.outlet_id,supplierId:body.supplier_id});
            return Response.json(result);
        } catch (error) {
            if (error instanceof BookingError) return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'DELIVERY_REVIEW_FAILED'},{status:500});
        }
    };
}
