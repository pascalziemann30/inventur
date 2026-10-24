import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalCategory,categoryChoices} from '../../base44/shared/inventory/categories.js';
import {countCategoryGroups} from '../../src/components/inventory/counting/categoryGroups.js';
test('confirmed synonyms and separator/case variants resolve to one stable category',()=>{
 for(const label of ['Reinigung / Hygiene','Reinigung und Hygiene','Reinigung - Hygiene','  REINIGUNG  &  HYGIENE  '])assert.equal(canonicalCategory(label),'Reinigung und Hygiene');
 for(const label of ['Milch / Käse','Milch und Käse','Milchprodukte und Pflanzendrinks'])assert.equal(canonicalCategory(label),'Milchprodukte und Pflanzendrinks');
 assert.equal(canonicalCategory('Getränke'),'Getränke und Getränkezutaten');
 for(const label of ['Verpackung','Verpackungen','Verpackung und Verbrauchsmaterial'])assert.equal(canonicalCategory(label),'Verpackung und Verbrauchsmaterial');
 assert.deepEqual(categoryChoices(['Reinigung / Hygiene','Reinigung und Hygiene','Getränke','Getränke und Getränkezutaten']),['Getränke und Getränkezutaten','Reinigung und Hygiene']);
 for(const label of ['Gewürze','Konserven','Frische Lebensmittel','Lebensmittel und Zutaten','Betriebsausstattung','Büromaterial'])assert.equal(canonicalCategory(label),label);
});
test('existing inventory snapshots with distinct alias category IDs combine without losing quantities, progress or filters',()=>{
 const entries=[{article_id:'1',category_id:'legacy',category_name:'Reinigung / Hygiene',status:'counted',counted_quantity:0,values:{pack:'0'}},{article_id:'2',category_id:'master',category_name:'Reinigung und Hygiene',status:'open',values:{pack:'1.5'}}];
 const original=structuredClone(entries),groups=countCategoryGroups(entries);assert.equal(groups.length,1);assert.equal(groups[0].name,'Reinigung und Hygiene');assert.equal(groups[0].all.length,2);assert.equal(groups[0].progress.total,2);assert.equal(groups[0].progress.counted,1);assert.equal(countCategoryGroups(entries,[entries[1]])[0].all.length,2);assert.deepEqual(entries,original);
});
