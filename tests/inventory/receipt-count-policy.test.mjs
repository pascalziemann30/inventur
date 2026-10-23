import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCount} from '../../base44/shared/inventory/counting.js';
import {baseUnitPrice,scaledQuantity,monetaryNumber} from '../../base44/shared/inventory/quantities.js';
const unit=(code,base_quantity,whole_numbers_only=false)=>({code,label:code,base_quantity,whole_numbers_only});
test('count policies support weighed goods, mixed cartons and loose packs, and quarter buckets',()=>{
 assert.equal(evaluateCount({count_units:[unit('kg',1)]},{kg:'4,8'}).quantity,4.8);
 assert.equal(evaluateCount({count_units:[unit('pack',1)]},{pack:'2,5'}).quantity,2.5);
 assert.equal(evaluateCount({count_units:[unit('carton',6,true),unit('loose',1)]},{carton:'10',loose:'4'}).quantity,64);
 assert.equal(evaluateCount({count_units:[unit('carton',8,true),unit('loose',1)]},{carton:'10',loose:'4'}).quantity,84);
 assert.equal(evaluateCount({count_units:[unit('bucket',1.5)]},{bucket:'2,5'}).quantity,3.75);
});
test('whole bag soup policy rejects opened fractions and unknown carton inputs',()=>{
 const entry={count_units:[unit('bag',1.5,true)]};
 assert.equal(evaluateCount(entry,{bag:'18'}).quantity,27);
 assert(evaluateCount(entry,{bag:'0,5'}).error);assert(evaluateCount(entry,{carton:'3'}).error);
});
test('derived net prices retain monetary precision without relaxing six-decimal stock quantities',()=>{
 const net=1.5/1.19;assert.equal(monetaryNumber(net),net);assert.equal(baseUnitPrice(net*6,6),net);
 assert.throws(()=>scaledQuantity(net));assert.throws(()=>monetaryNumber('Infinity'));assert.throws(()=>monetaryNumber(-1));
});
