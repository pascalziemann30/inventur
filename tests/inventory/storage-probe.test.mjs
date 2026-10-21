import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStorageProbeHandler} from '../../base44/functions/verifyBookingStorage/handler.js';
import {memoryStore} from './helpers.mjs';
import {isStorageProbeAllowed} from '../../base44/shared/inventory/storageProbeGate.js';

test('cached diagnostic grants expire, reject future and overlong windows, and default closed', () => {
    const now = 1_800_000_000_000;
    const grant = (issued, expires) => `test-only|${issued}|${expires}`;
    assert.equal(isStorageProbeAllowed(grant(now - 1000, now + 1000), now), true);
    assert.equal(isStorageProbeAllowed(grant(now - 1000, now), now), false);
    assert.equal(isStorageProbeAllowed(grant(now + 1000, now + 2000), now), false);
    assert.equal(isStorageProbeAllowed(grant(now, now + 900_001), now), false);
    assert.equal(isStorageProbeAllowed(grant(now, now), now), false);
    for (const value of [undefined, null, '', 'test-only', 'disabled', 'test-only|NaN|Infinity']) assert.equal(isStorageProbeAllowed(value, now), false);
});

function fixture() {
    const state = {user: {id: 'admin', role: 'admin'}, enabled: true, created: 0, deleted: 0};
    let store;
    const entity = {
        async create(data) {state.created++;store = memoryStore({id: 'probe', ...data});return store.snapshot();},
        get: () => store.get(),
        async updateMany(query, patch) {return {success: true, updated: (await store.compareAndSwap(query, patch.$set)) ? 1 : 0, has_more: false};},
        async delete() {state.deleted++;},
    };
    const entities = new Proxy({BookingProbeStock: entity}, {get(target, name) {if (name !== 'BookingProbeStock') throw new Error('Production entity access forbidden');return target[name];}});
    const handler = createStorageProbeHandler({createClientFromRequest: () => ({auth: {me: async () => state.user}, asServiceRole: {entities}}), isAllowed: () => state.enabled, runId: () => 'fixed-test-id'});
    return {state, entity, call: () => handler(new Request('https://test.invalid/probe', {method: 'POST'}))};
}

test('storage diagnostic touches only its disposable entity and cleans it up', async () => {
    const f = fixture();const response = await f.call();const result = await response.json();
    assert.equal(result.passed, true);assert.equal(result.checks.length, 4);
    assert.equal(result.cleanup_completed, true);assert.equal(f.state.created, 1);assert.equal(f.state.deleted, 1);
});

test('storage diagnostic is disabled by default and restricted to authenticated admins', async () => {
    const f = fixture();f.state.enabled = false;assert.equal((await f.call()).status, 503);
    f.state.enabled = true;f.state.user = {id: 'employee', role: 'user'};assert.equal((await f.call()).status, 403);
    f.state.user = null;assert.equal((await f.call()).status, 401);assert.equal(f.state.created, 0);
});

test('platform failure identifies its stage and status without echoing private responses', async () => {
    const f = fixture();
    f.entity.create = async () => {throw Object.assign(new Error('private platform response'), {response: {status:404, data:'private response body'}});};
    const result = await (await f.call()).json();
    assert.deepEqual(result, {passed:false, stage:'create_probe', error:'STORAGE_PROBE_FAILED', platform_status:404});
    assert.equal(f.state.deleted, 0);
});

test('probe cleanup waits for concurrent requests even if one fails early', async () => {
    const f = fixture();
    const update = f.entity.updateMany;
    let calls = 0;
    let release;
    const held = new Promise(resolve => {release = resolve;});
    f.entity.updateMany = async (...args) => {
        calls++;
        if (calls === 1) throw new TypeError('synthetic early failure');
        await held;
        return update(...args);
    };
    const response = f.call();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.state.deleted, 0);
    release();
    const result = await (await response).json();
    assert.equal(result.stage, 'same_line_concurrent');
    assert.equal(result.error_type, 'TypeError');
    assert.equal(result.cleanup_completed, true);
    assert.equal(f.state.deleted, 1);
});
