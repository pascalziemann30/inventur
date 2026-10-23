import {bookStockOperation} from '../../shared/inventory/stock.js';
import {base44StockStore} from '../../shared/inventory/base44Store.js';
import {BookingError} from '../../shared/inventory/quantities.js';

async function settledBookings(promises) {
    const outcomes = await Promise.allSettled(promises);
    const failure = outcomes.find(outcome => outcome.status === 'rejected');
    if (failure) throw failure.reason;
}

// Opt-in diagnostic. Its sole writable entity is BookingProbeStock, never OutletStock.
export function createStorageProbeHandler({createClientFromRequest, isAllowed, runId = () => crypto.randomUUID()}) {
    return async req => {
        if (req.method !== 'POST') return Response.json({error: 'METHOD_NOT_ALLOWED'}, {status: 405});
        const client = createClientFromRequest(req);
        let user;
        try { user = await client.auth.me(); } catch { return Response.json({error: 'AUTHENTICATION_REQUIRED'}, {status: 401}); }
        if (!user?.id) return Response.json({error: 'AUTHENTICATION_REQUIRED'}, {status: 401});
        if (user.role !== 'admin') return Response.json({error: 'ADMIN_REQUIRED'}, {status: 403});
        if (!isAllowed()) return Response.json({error: 'TEST_PROBE_DISABLED'}, {status: 503});
        const probeEntity = client.asServiceRole.entities.BookingProbeStock;
        let record;
        let result;
        let stage = 'check_sdk';
        try {
            if (typeof probeEntity.updateMany !== 'function') throw new BookingError('CONDITIONAL_UPDATE_UNAVAILABLE', 503);
            const run = runId();
            stage = 'create_probe';
            record = await probeEntity.create({outlet_id: `probe:${run}`, outlet_item_id: 'probe-item', global_item_id: 'probe-global', unit_abbreviation: 'Stk', on_hand_quantity: 10, revision: 0, booking_journal: []});
            const store = base44StockStore({OutletStock: probeEntity}, true);
            const operation = id => ({id, kind: 'delivery', outlet_id: record.outlet_id, outlet_item_id: record.outlet_item_id, global_item_id: record.global_item_id, unit_abbreviation: 'Stk', quantity: 2, source: {document_id: `probe:${run}`, line_id: id}});
            const book = (op, actualStore = store) => bookStockOperation({store: actualStore, user, stockId: record.id, operation: op, maxAttempts: 24});
            const checks = [];
            stage = 'same_line_concurrent';
            await settledBookings(Array.from({length: 12}, () => book(operation('same-line'))));
            let observed = await store.get(record.id);
            checks.push({name: 'same_line_concurrent',passed: observed.on_hand_quantity === 12 && observed.revision === 1 && observed.booking_journal.length === 1});
            stage = 'different_lines_concurrent';
            await settledBookings(Array.from({length: 4}, (_, i) => book(operation(`different-${i}`))));
            observed = await store.get(record.id);
            checks.push({name: 'different_lines_concurrent', passed: observed.on_hand_quantity === 20 && observed.revision === 5 && observed.booking_journal.length === 5});
            let conflict = false;
            stage = 'stale_inventory_conflict';
            try { await book({...operation('count'), kind: 'inventory', expected_revision: 0, quantity: 0}); } catch (error) { conflict = error.code === 'STOCK_CHANGED_DURING_COUNT'; }
            checks.push({name: 'stale_inventory_conflict', passed: conflict});
            let loseResponse = true;
            stage = 'retry_after_committed_write';
            const uncertainStore = {...store, async compareAndSwap(stock, next) {
                const changed = await store.compareAndSwap(stock, next);
                if (changed && loseResponse) {loseResponse = false;throw new Error('Simulated response loss');}
                return changed;
            }};
            await book(operation('lost-response'), uncertainStore);
            await book(operation('lost-response'));
            observed = await store.get(record.id);
            checks.push({name: 'retry_after_committed_write', passed: observed.on_hand_quantity === 22 && observed.revision === 6 && observed.booking_journal.length === 6});
            result = {passed: checks.every(c => c.passed), checks, scope: 'BookingProbeStock only; does not verify employee RLS or enable bookings'};
        } catch (error) {
            // Never echo SDK response bodies, request headers, secrets or stack traces.
            const platformStatus = error.status ?? error.response?.status;
            result = {passed: false, stage, error: typeof error.code === 'string' ? error.code : 'STORAGE_PROBE_FAILED',
                ...(Number.isInteger(platformStatus) ? {platform_status: platformStatus} : {}),
                ...(error instanceof TypeError ? {error_type: 'TypeError'} : {})};
        } finally {
            if (record) {
                try {await probeEntity.delete(record.id);result.cleanup_completed = true;}
                catch {result.cleanup_completed = false;result.probe_record_id = record.id;}
            }
        }
        return Response.json(result);
    };
}
