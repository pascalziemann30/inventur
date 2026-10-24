import test from 'node:test';import assert from 'node:assert/strict';
import {cleanArticleText,invalidArticleField,articleFieldMessage} from '../../base44/shared/inventory/articleFields.js';
test('client and server share field checks and preserve meaningful interior text',()=>{
 const input={name:' Papierhandtücher grün -2-LAG.- 25x23 cm ',supplier:'Doppelpack',category:'Reinigung und Hygiene',unit:'Stk',purchase_label:'Karton',purchase_code:'KT',factor:16,net_price:'22,79',count_units:[{code:'base',label:'Packung  à  16',base_quantity:1,whole_numbers_only:false}]},before=structuredClone(input),cleaned=cleanArticleText(input);
 assert.equal(invalidArticleField(cleaned),undefined);assert.equal(cleaned.name,'Papierhandtücher grün -2-LAG.- 25x23 cm');assert.equal(cleaned.count_units[0].label,'Packung  à  16');assert.equal(cleaned.factor,16);assert.equal(cleaned.net_price,'22,79');assert.deepEqual(input,before);
 assert.equal(invalidArticleField({...cleaned,purchase_label:''}),'purchase_label');assert.match(articleFieldMessage('purchase_label'),/Bestellgebinde/);
});
