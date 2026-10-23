import {BookingError} from './quantities.js';

export function base44StockStore(entities, verifiedAtomicWrites) {
    if (typeof entities.OutletStock.updateMany !== 'function') throw new BookingError('SDK_CONDITIONAL_UPDATE_UNAVAILABLE', 503);
    return {
        verifiedAtomicWrites,
        get: id => entities.OutletStock.get(id),
        async compareAndSwap(stock, next) {
            const result = await entities.OutletStock.updateMany(
                {id: stock.id, outlet_id: stock.outlet_id, revision: stock.revision},
                {$set: next},
            );
            if (result?.success !== true || result.has_more !== false || ![0, 1].includes(result.updated)) throw new BookingError('UNVERIFIED_UPDATE_RESULT', 503);
            return result.updated === 1;
        },
    };
}
