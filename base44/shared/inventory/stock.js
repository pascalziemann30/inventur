import {BookingError, addQuantity, scaledQuantity, quantityNumber} from './quantities.js';

export function assertOutletAccess(user, outletId) {
    if (!user || typeof user.id !== 'string' || !user.id) throw new BookingError('AUTHENTICATION_REQUIRED', 401);
    if (typeof outletId !== 'string' || !outletId) throw new BookingError('OUTLET_REQUIRED');
    if (user.role === 'admin') {if(user.access_kind==='password_admin'&&user.outlet_id!==outletId)throw new BookingError('OUTLET_FORBIDDEN',403);return;}
    if (user.role !== 'user') throw new BookingError('OUTLET_FORBIDDEN', 403);
    const nested = user.data?.outlet_id;
    const direct = user.outlet_id;
    if (nested && direct && nested !== direct) throw new BookingError('OUTLET_ASSIGNMENT_CONFLICT', 403);
    if ((nested || direct) !== outletId) throw new BookingError('OUTLET_FORBIDDEN', 403);
}

function operationFingerprint(operation) {
    return JSON.stringify({
        kind: operation.kind,
        outlet_id: operation.outlet_id,
        outlet_item_id: operation.outlet_item_id,
        global_item_id: operation.global_item_id,
        unit_abbreviation: operation.unit_abbreviation,
        quantity: quantityNumber(scaledQuantity(operation.quantity)),
        expected_revision: operation.kind !== 'delivery' ? operation.expected_revision : null,
        source: operation.source,
    });
}

function assertStock(stock, operation) {
    if (!stock || stock.outlet_id !== operation.outlet_id || stock.outlet_item_id !== operation.outlet_item_id || stock.global_item_id !== operation.global_item_id || stock.unit_abbreviation !== operation.unit_abbreviation) {
        throw new BookingError('STOCK_LINK_MISMATCH', 409);
    }
    if (!Number.isSafeInteger(stock.revision) || stock.revision < 0 || !Array.isArray(stock.booking_journal)) throw new BookingError('STOCK_NOT_INITIALIZED', 409);
    if (stock.revision === Number.MAX_SAFE_INTEGER) throw new BookingError('REVISION_LIMIT', 409);
}

function existingReceipt(stock, operationId, fingerprint) {
    const receipts = stock.booking_journal.filter(receipt => receipt.operation_id === operationId);
    if (receipts.length > 1) throw new BookingError('DUPLICATE_RECEIPT', 409);
    const receipt = receipts[0];
    if (receipt && receipt.fingerprint !== fingerprint) throw new BookingError('OPERATION_CONTENT_CHANGED', 409);
    return receipt;
}

/**
 * Stock and its authoritative receipt are changed in ONE conditional document write.
 * A separate StockMovement projection must never be the proof that a stock write happened.
 * The adapter is usable only after its conditional-write semantics have been verified.
 */
export async function bookStockOperation({store, user, stockId, operation, now = () => new Date().toISOString(), maxAttempts = 8}) {
    assertOutletAccess(user, operation.outlet_id);
    if (!store.verifiedAtomicWrites) throw new BookingError('ATOMIC_WRITES_NOT_VERIFIED', 503);
    if (!['delivery', 'inventory', 'inventory_fence'].includes(operation.kind)) throw new BookingError('INVALID_OPERATION_KIND');
    if (typeof operation.id !== 'string' || !operation.id || operation.id.length > 200) throw new BookingError('OPERATION_ID_REQUIRED');
    if (!operation.source || typeof operation.source.document_id !== 'string' || !operation.source.document_id || typeof operation.source.line_id !== 'string' || !operation.source.line_id) throw new BookingError('SOURCE_REFERENCE_REQUIRED');
    if (operation.kind !== 'delivery' && (!Number.isSafeInteger(operation.expected_revision) || operation.expected_revision < 0)) throw new BookingError('EXPECTED_REVISION_REQUIRED');
    if (operation.kind === 'inventory_fence' && scaledQuantity(operation.quantity) !== 0n) throw new BookingError('INVALID_FENCE_QUANTITY');
    const fingerprint = operationFingerprint(operation);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const stock = await store.get(stockId);
        assertStock(stock, operation);
        const prior = existingReceipt(stock, operation.id, fingerprint);
        if (prior) return {already_applied: true, receipt: prior};
        if (operation.kind !== 'delivery' && stock.revision !== operation.expected_revision) throw new BookingError('STOCK_CHANGED_DURING_COUNT', 409);
        // Never discard old receipts to save space: doing so would permit old requests to book again.
        if (stock.booking_journal.length >= 1000) throw new BookingError('JOURNAL_ARCHIVE_REQUIRED', 409);
        const before = quantityNumber(scaledQuantity(stock.on_hand_quantity));
        const after = operation.kind === 'inventory_fence' ? before : operation.kind === 'delivery' ? addQuantity(before, operation.quantity) : quantityNumber(scaledQuantity(operation.quantity));
        const receipt = {
            operation_id: operation.id,
            fingerprint,
            kind: operation.kind,
            source_document_id: operation.source.document_id,
            source_line_id: operation.source.line_id,
            before_quantity: before,
            after_quantity: after,
            delta_quantity: Number(scaledQuantity(after) - scaledQuantity(before)) / 1_000_000,
            actor_id: user.id,
            booked_at: now(),
            revision: stock.revision + 1,
        };
        const next = {on_hand_quantity: after, revision: stock.revision + 1, booking_journal: [...stock.booking_journal, receipt]};
        try {
            if (await store.compareAndSwap(stock, next)) return {already_applied: false, receipt};
        } catch (error) {
            // The server may have committed before its response was lost. Read proof; never compensate blindly.
            const observed = await store.get(stockId);
            assertStock(observed, operation);
            const committed = existingReceipt(observed, operation.id, fingerprint);
            if (committed) return {already_applied: true, receipt: committed};
            throw error;
        }
    }
    throw new BookingError('CONCURRENT_BOOKING_RETRY', 409);
}
