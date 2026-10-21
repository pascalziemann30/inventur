import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCount, resolveEntry, countProgress, selectCountItems} from '../../src/components/inventory/counting/countModel.js';
import {createDraftQueue} from '../../src/components/inventory/counting/draftQueue.js';

const milk = {article_id: 'milk', article_name: 'Beispielmilch', unit_abbreviation: 'l', status: 'open',
    count_units: [{code: 'pack', label: 'Packungen', base_quantity: 1}, {code: 'carton', label: 'Kartons', base_quantity: 10}]};
const cake = {article_id: 'cake', article_name: 'Beispieltorte', unit_abbreviation: 'Stk', status: 'open',
    count_units: [{code: 'cake', label: 'Ganze Torten', base_quantity: 12, whole_numbers_only: true},
        {code: 'piece', label: 'Kuchenstücke', base_quantity: 1, whole_numbers_only: true}]};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('blank, explicit zero and comma fractions remain distinct', () => {
    assert.equal(evaluateCount(milk, {}).quantity, null);
    assert.equal(evaluateCount(milk, {pack: '  '}).quantity, null);
    assert.equal(resolveEntry(milk, 'count', {pack: '0'}).counted_quantity, 0);
    assert.equal(evaluateCount(milk, {carton: '2', pack: '0,5'}).quantity, 20.5);
    assert.throws(() => resolveEntry(milk, 'count', {}));
});
test('whole cakes and loose portions add without rounding', () => {
    assert.equal(evaluateCount(cake, {cake: '2', piece: '3'}).quantity, 27);
    assert.ok(evaluateCount(cake, {cake: '0,5'}).error);
    assert.ok(evaluateCount(cake, {piece: '1.5'}).error);
});
test('unknown, duplicate and unconfigured units fail closed', () => {
    assert.ok(evaluateCount(milk, {invented: '2'}).error);
    assert.ok(evaluateCount({...milk, count_units: []}, {pack: '2'}).error);
    assert.ok(evaluateCount({...milk, count_units: [...milk.count_units, milk.count_units[0]]}, {pack: '2'}).error);
    assert.ok(evaluateCount({...milk, count_units: [{code:'bad', label:'Bad', base_quantity: 0}]}, {bad:'2'}).error);
    for (const raw of ['-1', '1e3', '1.000.000', 'Infinity', '0.1234567']) assert.ok(evaluateCount(milk, {pack: raw}).error);
});
test('skip clears counts, reopen hides comparisons, invalid counts cannot complete', () => {
    const counted = resolveEntry(milk, 'count', {pack: '2,5'});
    const skipped = resolveEntry(counted, 'skip');
    assert.equal(skipped.counted_quantity, null);
    assert.deepEqual(skipped.values, {});
    assert.equal(resolveEntry(counted, 'reopen').status, 'open');
    assert.equal(countProgress([counted, skipped]).canComplete, true);
    assert.equal(countProgress([counted, {...cake, status:'counted', counted_quantity: NaN}]).canComplete, false);
    assert.equal(countProgress([]).canComplete, false);
});
test('interval is applied before a new session, including inactive and multiple intervals', () => {
    const items = [{...milk, inventory_intervals:['monthly','yearly']}, {...cake, inventory_intervals:['weekly','yearly']},
        {...milk, article_id:'old', is_active:false, inventory_intervals:['monthly']}];
    assert.deepEqual(selectCountItems(items).map(item => item.article_id), ['milk']);
    assert.equal(selectCountItems(items, 'yearly').length, 2);
    assert.equal(selectCountItems(items, 'adhoc').length, 2);
    assert.throws(() => selectCountItems(items, 'invalid'));
});
test('slow draft save is serialized and coalesces newer input without mutating snapshots', async () => {
    const calls = [];
    let release;
    const queue = createDraftQueue({makeId: () => `request-${calls.length}`, save: async request => {
        calls.push(request);
        if (calls.length === 1) await new Promise(resolve => {release = resolve;});
        return {request_id: request.id, revision: request.revision + 1};
    }});
    const first = [{quantity: 1}];
    queue.enqueue(first);
    first[0].quantity = 99;
    queue.enqueue([{quantity: 2}]);
    queue.enqueue([{quantity: 3}]);
    let flushed = false;
    const flushing = queue.flush().then(() => {flushed = true;});
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].snapshot[0].quantity, 1);
    assert.equal(flushed, false);
    release(); await flushing;
    assert.equal(calls.length, 2);
    assert.equal(calls[1].snapshot[0].quantity, 3);
    assert.equal(calls[1].revision, 1);
});
test('uncertain save retries identical request before newer edits; finalization stays blocked', async () => {
    const calls = [];
    let responseLost = true;
    const queue = createDraftQueue({initialRevision: 8, makeId: () => `request-${calls.length}`, save: async request => {
        calls.push(request);
        if (responseLost) throw new Error('Antwort verloren');
        return {request_id: request.id, revision: request.revision + 1};
    }});
    queue.enqueue(['first']); await tick();
    queue.enqueue(['latest']);
    await assert.rejects(queue.flush(), /Antwort verloren/);
    assert.equal(calls.length, 1);
    responseLost = false;
    queue.retry(); await queue.flush();
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[2].revision, 9);
    assert.deepEqual(calls[2].snapshot, ['latest']);
});
test('mismatched acknowledgment is an error, never a saved draft', async () => {
    let state;
    const queue = createDraftQueue({onState: value => {state = value;}, save: async () => ({request_id:'wrong', revision:1})});
    queue.enqueue(['draft']); await tick();
    assert.equal(state.status, 'error');
    await assert.rejects(queue.flush(), /Speicherbestätigung/);
});
