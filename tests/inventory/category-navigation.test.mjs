import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countCategoryGroups} from '../../src/components/inventory/counting/categoryGroups.js';
import {inventoryNavigation} from '../../src/components/inventory/entry/navigationModel.js';
test('category progress keeps all entries in its denominator and distinguishes skipped from counted under filters',()=>{
 const entries=[{article_id:'1',category_id:'a',category_name:'Milch',status:'counted',counted_quantity:0},{article_id:'2',category_id:'a',category_name:'Milch',status:'skipped'},{article_id:'3',category_id:'a',category_name:'Milch',status:'open'},{article_id:'4',category_id:'b',category_name:'Gebäck',status:'open'}];
 const groups=countCategoryGroups(entries,[entries[2]]);assert.equal(groups.length,1);assert.equal(groups[0].entries.length,1);assert.equal(groups[0].all.length,3);
 assert.equal(groups[0].progress.counted,1);assert.equal(groups[0].progress.skipped,1);assert.equal(groups[0].progress.open,1);assert.equal(groups[0].progress.total,3);
 assert.equal(countCategoryGroups(entries)[0].name,'Gebäck');assert.equal(countCategoryGroups([{article_id:'x',status:'open'}])[0].name,'Ohne Kategorie');
});
test('employee quick navigation stays in its outlet, drops stale record ids and never includes admin sections',()=>{
 const model=inventoryNavigation({employee:true,outlet:'kuno',pathname:'/InventoryCapture',search:'?workflow=server&run=run-1&scan=old&delivery=old&section=articles&outlet=wrong'});
 assert.deepEqual(model.tabs.map(t=>t[0]),['home','server','scan','delivery']);
 assert.equal(model.backLabel,'Zur Inventurübersicht');
 for(const href of [model.parent,model.home,...model.tabs.map(t=>t[2])]){const url=new URL(href,'https://example.invalid');assert.equal(url.searchParams.get('outlet'),'kuno');for(const key of ['run','scan','delivery','section'])assert.equal(url.searchParams.has(key),false);}
});
test('admin overview and workflow return targets preserve platform environment without retaining detail selection',()=>{
 const model=inventoryNavigation({employee:false,outlet:'kuno',pathname:'/InventoryCapture',search:'?workflow=delivery&delivery=draft-1&base44_data_env=dev'});
 assert(model.home.startsWith('/Dashboard?'));assert(new URL(model.home,'https://x').searchParams.get('section')==='home');
 assert.equal(model.backLabel,'Zur Lieferübersicht');assert.equal(model.active,'delivery');
 for(const [,label,href] of model.tabs){assert(label);const url=new URL(href,'https://x');assert.equal(url.searchParams.get('base44_data_env'),'dev');assert.equal(url.searchParams.has('delivery'),false);}
});
