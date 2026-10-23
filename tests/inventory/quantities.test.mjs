import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toBaseQuantity, countCakes, baseUnitPrice, supplierItemKey, scaledQuantity} from '../../base44/shared/inventory/quantities.js';

test('fractional packages and German decimal separators convert exactly', () => {
    assert.equal(toBaseQuantity('2,5', '1'), 2.5);
    assert.equal(toBaseQuantity('2.5', '10'), 25);
    assert.equal(toBaseQuantity('3', '0.1'), 0.3);
    assert.equal(toBaseQuantity('0', '10'), 0);
});

test('blank, negative, non-finite and ambiguous values never become zero', () => {
    for (const input of ['', null, undefined, '-1', 'NaN', Infinity, '1,000.5', '1 000', '1e3', '2kg']) assert.throws(() => toBaseQuantity(input, 1));
    assert.throws(() => toBaseQuantity(1, 0));
    assert.throws(() => toBaseQuantity(1, null));
});

test('too much precision or overflow is rejected instead of silently losing stock', () => {
    assert.throws(() => toBaseQuantity('0.0000001', 1));
    assert.throws(() => toBaseQuantity('0.000001', '0.1'));
    assert.throws(() => scaledQuantity(Number.MAX_SAFE_INTEGER));
});

test('whole cakes and loose portions preserve blank versus zero', () => {
    assert.equal(countCakes('2', '3', 12), 27);
    assert.equal(countCakes('2', '3', 10), 23);
    assert.equal(countCakes('', '', 12), null);
    assert.equal(countCakes('', '0', 12), 0);
    assert.equal(countCakes('1', '', 12), 12);
    assert.throws(() => countCakes('1.5', '0', 12));
    assert.throws(() => countCakes('0', '1.5', 12));
});

test('unit prices retain precision until currency display', () => {
    assert.equal(baseUnitPrice('11', '3'), 11 / 3);
    assert.equal(baseUnitPrice('0', 1), 0);
    assert.throws(() => baseUnitPrice(1, 0));
});

test('supplier identity keeps leading zeros, punctuation and packaging context', () => {
    const key = supplierItemKey('a', '001-2', 'ST');
    assert.notEqual(key, supplierItemKey('b', '001-2', 'ST'));
    assert.notEqual(key, supplierItemKey('a', '12', 'ST'));
    assert.notEqual(key, supplierItemKey('a', '001-2', 'KT'));
    assert.throws(() => supplierItemKey('a', 12, 'ST'));
    assert.throws(() => supplierItemKey('a', '', 'ST'));
});
