import {BookingError, toBaseQuantity, baseUnitPrice, scaledQuantity} from '../../shared/inventory/quantities.js';
import {assertOutletAccess, bookStockOperation} from '../../shared/inventory/stock.js';
import {base44StockStore} from '../../shared/inventory/base44Store.js';

export function createBookDeliveryLineHandler({createClientFromRequest, isEnabled, now}) {
    return async req => {
        try {
            if (req.method !== 'POST') return Response.json({error: 'METHOD_NOT_ALLOWED'}, {status: 405});
            const client = createClientFromRequest(req);
            let user;
            try { user = await client.auth.me(); } catch { throw new BookingError('AUTHENTICATION_REQUIRED', 401); }
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED', 401);
            // Enable only after staging proves CAS semantics, function packaging AND direct-write restrictions.
            if (!isEnabled()) throw new BookingError('BOOKING_ROLLOUT_NOT_VERIFIED', 503);
            const body = await req.json().catch(() => { throw new BookingError('INVALID_REQUEST'); });
            if (!body || typeof body.delivery_line_id !== 'string' || !body.delivery_line_id || Object.keys(body).some(key => key !== 'delivery_line_id')) throw new BookingError('DELIVERY_LINE_ID_REQUIRED');
            const entities = client.asServiceRole.entities;
            const line = await entities.DeliveryLine.get(body.delivery_line_id);
            if (!line) throw new BookingError('LINE_NOT_FOUND', 404);
            assertOutletAccess(user, line.outlet_id);
            const delivery = await entities.Delivery.get(line.delivery_id);
            if (!delivery || delivery.outlet_id !== line.outlet_id || delivery.supplier_id !== line.supplier_id || delivery.status === 'cancelled') throw new BookingError('DELIVERY_LINK_MISMATCH', 409);
            if (!['ready', 'booked'].includes(line.status)) throw new BookingError('LINE_NOT_READY', 409);
            const item = await entities.OutletItem.get(line.outlet_item_id);
            if (!item || item.outlet_id !== line.outlet_id || item.global_item_id !== line.global_item_id || item.supplier_id !== line.supplier_id || item.is_active === false) throw new BookingError('ARTICLE_NOT_APPROVED', 409);
            const offer = await entities.SupplierItem.get(line.supplier_item_id);
            if (!offer || offer.status !== 'approved' || offer.supplier_id !== line.supplier_id || offer.global_item_id !== line.global_item_id || offer.unit_abbreviation !== line.unit_abbreviation || offer.supplier_article_number !== line.supplier_article_number) throw new BookingError('SUPPLIER_ITEM_NOT_APPROVED', 409);
            if (line.confirmed !== true || !line.conversion_snapshot || line.conversion_snapshot.supplier_item_id !== offer.id || line.conversion_snapshot.unit_abbreviation !== line.unit_abbreviation) throw new BookingError('CONVERSION_NOT_CONFIRMED', 409);
            const conversion = line.conversion_snapshot;
            if (!Number.isSafeInteger(conversion.revision) || conversion.revision < 0 || conversion.revision !== line.offer_revision || conversion.purchase_unit_code !== line.purchase_unit_code) throw new BookingError('CONVERSION_LINK_MISMATCH', 409);
            const globalItem = await entities.GlobalItem.get(line.global_item_id);
            if (!globalItem || globalItem.unit_abbreviation !== line.unit_abbreviation) throw new BookingError('BASE_UNIT_MISMATCH', 409);
            // Snapshot is fixed when the line is confirmed; later offer edits must not alter retries.
            const quantity = toBaseQuantity(line.purchase_quantity, conversion.base_quantity_per_purchase);
            if (scaledQuantity(quantity) === 0n) throw new BookingError('POSITIVE_DELIVERY_QUANTITY_REQUIRED');
            const price = baseUnitPrice(line.net_purchase_price, conversion.base_quantity_per_purchase);
            const stocks = await entities.OutletStock.filter({outlet_id: line.outlet_id, outlet_item_id: line.outlet_item_id});
            if (stocks.length !== 1) throw new BookingError('UNIQUE_STOCK_REQUIRED', 409);
            const result = await bookStockOperation({
                store: base44StockStore(entities, true), user, stockId: stocks[0].id, now,
                operation: {
                    id: `delivery:${delivery.id}:${line.id}`, kind: 'delivery',
                    outlet_id: line.outlet_id, outlet_item_id: line.outlet_item_id,
                    global_item_id: line.global_item_id, unit_abbreviation: line.unit_abbreviation, quantity,
                    source: {
                        document_id: delivery.id, line_id: line.id, supplier_item_id: offer.id,
                        purchase_unit_code: line.purchase_unit_code, purchase_quantity: line.purchase_quantity,
                        conversion_revision: conversion.revision, base_quantity_per_purchase: conversion.base_quantity_per_purchase,
                        net_purchase_price: line.net_purchase_price, net_base_unit_price: price,
                    },
                },
            });
            // A failed acknowledgement can safely be repeated: the journal proves the stock write.
            await entities.DeliveryLine.update(line.id, {status: 'booked', booking_operation_id: result.receipt.operation_id, booked_at: result.receipt.booked_at});
            // Never update OutletItem.net_purchase_price here. Admin price approval is a separate operation.
            return Response.json(result);
        } catch (error) {
            if (error instanceof BookingError) return Response.json({error: error.code}, {status: error.status});
            return Response.json({error: 'BOOKING_FAILED_RETRY_SAME_LINE'}, {status: 500});
        }
    };
}
