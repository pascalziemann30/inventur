import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookDeliveryLineHandler} from '../../base44/functions/bookDeliveryLine/handler.js';
import {initialStock, memoryStore, user} from './helpers.mjs';

function fixture() {
    const stock = memoryStore(initialStock());
    const line = {id: 'line', delivery_id: 'doc', outlet_id: 'outlet', supplier_id: 'supplier', supplier_item_id: 'offer', outlet_item_id: 'item', global_item_id: 'global', unit_abbreviation: 'l', offer_revision: 1, purchase_unit_code: 'KT', purchase_quantity: 2, net_purchase_price: 30, confirmed: true, status: 'ready', conversion_snapshot: {supplier_item_id: 'offer', revision: 1, purchase_unit_code: 'KT', base_quantity_per_purchase: 10, unit_abbreviation: 'l'}};
    line.supplier_article_number = '001-TEST';
    const offer = {id: 'offer', supplier_id: 'supplier', global_item_id: 'global', status: 'approved', unit_abbreviation: 'l', supplier_article_number: '001-TEST'};
    const counters = {masterPriceWrites: 0, lineWrites: 0};
    const entities = {
        DeliveryLine: {get: async () => structuredClone(line), update: async (_, patch) => {counters.lineWrites++;if (counters.failAcknowledgement) {counters.failAcknowledgement = false;throw new Error('line acknowledgement failed');}Object.assign(line, patch);}},
        Delivery: {get: async () => ({id: 'doc', outlet_id: 'outlet', supplier_id: 'supplier', status: 'draft'})},
        OutletItem: {get: async () => ({id: 'item', outlet_id: 'outlet', global_item_id: 'global', supplier_id: 'supplier', is_active: true}), update: async () => {counters.masterPriceWrites++;}},
        SupplierItem: {get: async () => structuredClone(offer)},
        GlobalItem: {get: async () => ({id: 'global', unit_abbreviation: 'l'})},
        OutletStock: {get: stock.get, filter: async () => [stock.snapshot()], updateMany: async (query, update) => ({success: true, updated: (await stock.compareAndSwap(query, update.$set)) ? 1 : 0, has_more: false})},
    };
    const config = {actor: {...user, role: 'admin'}, enabled: true};
    const handler = createBookDeliveryLineHandler({createClientFromRequest: () => ({auth: {me: async () => config.actor}, asServiceRole: {entities}}), isEnabled: () => config.enabled, now: () => '2026-01-01T00:00:00.000Z'});
    const request = body => handler(new Request('https://test.invalid/book', {method: 'POST', body: JSON.stringify(body || {delivery_line_id: 'line'})}));
    return {stock, line, offer, counters, entities, config, request};
}

test('confirmed purchase packs become base quantities without changing master price', async () => {
    const f = fixture();const reply = await f.request();assert.equal(reply.status, 200);
    assert.equal(f.stock.snapshot().on_hand_quantity, 30);
    assert.equal(f.line.status, 'booked');assert.equal(f.counters.masterPriceWrites, 0);
    const receipt = f.stock.snapshot().booking_journal[0];
    assert.equal(JSON.parse(receipt.fingerprint).source.net_base_unit_price, 3);
});

test('failed line acknowledgement can be resumed without a second stock increment', async () => {
    const f = fixture();f.counters.failAcknowledgement = true;
    assert.equal((await f.request()).status, 500);
    assert.equal(f.stock.snapshot().on_hand_quantity, 30);assert.equal(f.line.status, 'ready');
    assert.equal((await f.request()).status, 200);assert.equal(f.stock.writes(), 1);assert.equal(f.line.status, 'booked');
});

test('unresolved article proposals and unconfirmed conversion cannot book', async () => {
    const f = fixture();f.line.status = 'proposal_pending';assert.equal((await f.request()).status, 409);
    f.line.status = 'ready';f.line.confirmed = false;assert.equal((await f.request()).status, 409);
    assert.equal(f.stock.writes(), 0);
});

test('rollout gate and actual identity are enforced before any stock write', async () => {
    const f = fixture();f.config.enabled = false;assert.equal((await f.request()).status, 503);
    f.config.enabled = true;f.config.actor = null;assert.equal((await f.request()).status, 401);
    f.config.actor = {...user, data: {outlet_id: 'outlet'}};assert.equal((await f.request()).status, 403);
    assert.equal(f.stock.writes(), 0);
});

test('browser cannot supply a new quantity, price or claimed role to the booking endpoint', async () => {
    const f = fixture();
    assert.equal((await f.request({delivery_line_id: 'line', purchase_quantity: 999, role: 'admin'})).status, 400);
    assert.equal(f.stock.writes(), 0);
});

test('duplicate or mismatched stock records require explicit repair', async () => {
    const f = fixture();f.entities.OutletStock.filter = async () => [f.stock.snapshot(), f.stock.snapshot()];
    assert.equal((await f.request()).status, 409);assert.equal(f.stock.writes(), 0);
});

test('approved supplier identity is required even for an otherwise known article', async () => {
    const f = fixture();f.offer.supplier_id = 'other';assert.equal((await f.request()).status, 409);
    assert.equal(f.stock.writes(), 0);
});

test('a supplier unit mismatch or unversioned conversion cannot book', async () => {
    const f = fixture();f.offer.unit_abbreviation = 'kg';assert.equal((await f.request()).status, 409);
    f.offer.unit_abbreviation = 'l';delete f.line.conversion_snapshot.revision;assert.equal((await f.request()).status, 409);
    assert.equal(f.stock.writes(), 0);
});

test('base unit is checked against the actual global article', async () => {
    const f = fixture();f.entities.GlobalItem.get = async () => ({unit_abbreviation: 'kg'});
    assert.equal((await f.request()).status, 409);assert.equal(f.stock.writes(), 0);
});
