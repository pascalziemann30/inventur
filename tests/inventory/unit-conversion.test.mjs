import test from 'node:test';
import assert from 'node:assert/strict';
import {convertUnitQuantity,convertDefinitionUnits,suggestedUnitRatio} from '../../base44/shared/inventory/unitConversion.js';
import {evaluateCount} from '../../base44/shared/inventory/counting.js';
test('136 pieces at 13.97 per order: one 34-piece pack and fractional packs keep the exact proportional value',()=>{
 const row={count_units:[{code:'pack',label:'Packung',base_quantity:34,whole_numbers_only:false}]};
 const result=evaluateCount(row,{pack:'1,5'});assert.equal(result.quantity,51);assert.equal((13.97/136)*34,13.97/4);assert.equal(Number(((13.97/136)*result.quantity).toFixed(2)),5.24);
 assert.equal(convertUnitQuantity(51,34,1),1.5);assert.equal(convertUnitQuantity(1.5,1,34),51);
 assert.throws(()=>convertUnitQuantity(1,34,1),{code:'UNIT_CONVERSION_PRECISION'});
});
test('metric conversions and primary base-count suggestions preserve purchase value',()=>{
 assert.deepEqual(suggestedUnitRatio('kg','g'),{old_quantity:1,new_quantity:1000});assert.equal(suggestedUnitRatio('kg','l'),null);
 const d={unit:'Stk',factor:136,count_units:[{code:'base',label:'Stk',base_quantity:1},{code:'pack',label:'Packung',base_quantity:34}],receipt_units:[]};
 const converted=convertDefinitionUnits(d,'Packung',34,1);assert.equal(converted.factor,4);assert.equal(converted.count_units[0].label,'Packung');assert.equal(converted.count_units[0].base_quantity,1);assert.equal(converted.count_units[1].base_quantity,1);
});
