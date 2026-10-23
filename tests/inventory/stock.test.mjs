import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookStockOperation, assertOutletAccess} from '../../base44/shared/inventory/stock.js';
import {base44StockStore} from '../../base44/shared/inventory/base44Store.js';
import {user, initialStock, operation, memoryStore} from './helpers.mjs';

const book = (store, op = operation(), actor = user, extra = {}) => bookStockOperation({store, user: actor, stockId: 'stock', operation: op, ...extra});

test('same operation sequentially or concurrently only changes stock once', async () => {
    const store = memoryStore();
    const replies = await Promise.all(Array.from({length: 16}, () => book(store)));
    assert.equal(store.snapshot().on_hand_quantity, 12);
    assert.equal(store.writes(), 1);
    assert.equal(replies.filter(r => !r.already_applied).length, 1);
    await book(store);
    assert.equal(store.writes(), 1);
});

test('concurrent different lines preserve all increments', async () => {
    const store = memoryStore();
    await Promise.all(Array.from({length: 12}, (_, i) => book(store, operation(`delivery:doc:line-${i}`), user, {maxAttempts: 24})));
    assert.equal(store.snapshot().on_hand_quantity, 34);
    assert.equal(store.snapshot().booking_journal.length, 12);
    assert.equal(store.snapshot().revision, 12);
});

test('failure before commit leaves stock and receipt untouched', async () => {
    const store = memoryStore();store.failBefore = true;
    await assert.rejects(book(store));
    assert.equal(store.snapshot().on_hand_quantity, 10);
    assert.equal(store.snapshot().booking_journal.length, 0);
    await book(store);assert.equal(store.snapshot().on_hand_quantity, 12);
});

test('lost response after commit recovers the same durable receipt', async () => {
    const store = memoryStore();store.loseResponse = true;
    const result = await book(store);
    assert.equal(result.already_applied, true);
    assert.equal(store.writes(), 1);
    await book(store);assert.equal(store.snapshot().on_hand_quantity, 12);
});

test('lost response and unavailable recovery read are safe on a later retry', async () => {
    const store = memoryStore();store.loseResponse = true;store.loseRecoveryRead = true;
    await assert.rejects(book(store));
    await book(store);
    assert.equal(store.snapshot().on_hand_quantity, 12);
    assert.equal(store.writes(), 1);
});

test('operation ID cannot be reused with changed quantity, unit or source price', async () => {
    const store = memoryStore();await book(store);
    await assert.rejects(book(store, {...operation(), quantity: 3}), {code: 'OPERATION_CONTENT_CHANGED'});
    await assert.rejects(book(store, {...operation(), source: {...operation().source, net_purchase_price: 5}}), {code: 'OPERATION_CONTENT_CHANGED'});
    await assert.rejects(book(store, {...operation(), unit_abbreviation: 'kg'}), {code: 'STOCK_LINK_MISMATCH'});
    assert.equal(store.writes(), 1);
});

test('inventory zero is a real count and its retry does not erase a later delivery', async () => {
    const store = memoryStore();
    const count = {...operation('inventory:session:item'), kind: 'inventory', quantity: 0, expected_revision: 0};
    await book(store, count);assert.equal(store.snapshot().on_hand_quantity, 0);
    await book(store, operation('delivery:other:line'));assert.equal(store.snapshot().on_hand_quantity, 2);
    await book(store, count);assert.equal(store.snapshot().on_hand_quantity, 2);
});

test('inventory detects a delivery since the count snapshot', async () => {
    const store = memoryStore();await book(store);
    const count = {...operation('inventory:session:item'), kind: 'inventory', quantity: 7, expected_revision: 0};
    await assert.rejects(book(store, count), {code: 'STOCK_CHANGED_DURING_COUNT'});
    assert.equal(store.snapshot().on_hand_quantity, 12);
});

test('authorization uses real user assignment, not a caller-selected location', async () => {
    assert.throws(() => assertOutletAccess(null, 'outlet'), {code: 'AUTHENTICATION_REQUIRED'});
    assert.throws(() => assertOutletAccess({...user, data: {outlet_id: 'other'}}, 'outlet'), {code: 'OUTLET_FORBIDDEN'});
    assert.throws(() => assertOutletAccess({...user, outlet_id: 'other'}, 'outlet'), {code: 'OUTLET_ASSIGNMENT_CONFLICT'});
    assert.doesNotThrow(() => assertOutletAccess({id: 'admin', role: 'admin'}, 'outlet'));
    const store = memoryStore();
    await assert.rejects(book(store, {...operation(), outlet_id: 'other'}), {code: 'OUTLET_FORBIDDEN'});
    assert.equal(store.writes(), 0);
});

test('uninitialized, mismatched or oversized journals stop booking', async () => {
    const raw = initialStock();delete raw.revision;
    await assert.rejects(book(memoryStore(raw)), {code: 'STOCK_NOT_INITIALIZED'});
    await assert.rejects(book(memoryStore({...initialStock(), global_item_id: 'other'})), {code: 'STOCK_LINK_MISMATCH'});
    const full = memoryStore({...initialStock(), booking_journal: Array.from({length: 1000}, (_, i) => ({operation_id: String(i)}))});
    await assert.rejects(book(full), {code: 'JOURNAL_ARCHIVE_REQUIRED'});assert.equal(full.writes(), 0);
});

test('missing platform proof or repeated conflicts never falls back to unsafe update', async () => {
    const store = memoryStore();store.verifiedAtomicWrites = false;
    await assert.rejects(book(store), {code: 'ATOMIC_WRITES_NOT_VERIFIED'});
    store.verifiedAtomicWrites = true;store.compareAndSwap = async () => false;
    await assert.rejects(book(store), {code: 'CONCURRENT_BOOKING_RETRY'});
    assert.equal(store.snapshot().on_hand_quantity, 10);
});

test('Base44 adapter performs one conditional stock-and-receipt write', async () => {
    let args;
    const adapter = base44StockStore({OutletStock: {get: async () => initialStock(), updateMany: async (...a) => {args = a;return {success: true, updated: 1, has_more: false};}}}, true);
    const next = {on_hand_quantity: 12, revision: 1, booking_journal: [{operation_id: 'id'}]};
    assert.equal(await adapter.compareAndSwap(initialStock(), next), true);
    assert.deepEqual(args, [{id: 'stock', outlet_id: 'outlet', revision: 0}, {$set: next}]);
    assert.throws(() => base44StockStore({OutletStock: {}}, true), {code: 'SDK_CONDITIONAL_UPDATE_UNAVAILABLE'});
});

test('unexpected platform response is treated as uncertain, never as success', async () => {
    const adapter = base44StockStore({OutletStock: {get: async () => initialStock(), updateMany: async () => ({updated: 1})}}, true);
    await assert.rejects(adapter.compareAndSwap(initialStock(), {}), {code: 'UNVERIFIED_UPDATE_RESULT'});
});
