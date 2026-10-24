import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSubcategories,suggestSubcategory} from '../../base44/shared/inventory/subcategories.js';
import {countCategoryGroups} from '../../src/components/inventory/counting/categoryGroups.js';
import {projectRun} from '../../base44/shared/inventory/runs.js';
test('suggestions use explicit keywords within selected main category and refuse ambiguity',()=>{
 const rows=starterSubcategories.map((r,i)=>({...r,id:String(i),parent_name:'Betriebsausstattung'}));
 assert.equal(suggestSubcategory('Amazon Basics Druckerpapier A4','Betriebsausstattung',rows).name,'Büro- und Organisationsmaterial');
 assert.equal(suggestSubcategory('Dailyart Edelstahl-Milchkännchen','Betriebsausstattung',rows).name,'Kaffee- und Barzubehör');
 assert.equal(suggestSubcategory('APS Vorratsglas','Betriebsausstattung',rows).name,'Aufbewahrung und Behälter');
 assert.equal(suggestSubcategory('Propellermütze','Betriebsausstattung',rows),null);
 assert.equal(suggestSubcategory('Druckerpapier','Reinigung und Hygiene',rows),null);
 assert.equal(suggestSubcategory('Druckerpapier','Betriebsausstattung',[...rows,{id:'duplicate',name:'Another',parent_name:'Betriebsausstattung',keywords:['druckerpapier']}]),null);
});
test('nested category progress preserves full denominators when filtering and main-only items remain visible',()=>{
 const entries=[{article_id:'1',category_name:'Equipment',subcategory_id:'glasses',subcategory_name:'Glasses',status:'counted',counted_quantity:1},{article_id:'2',category_name:'Equipment',subcategory_id:'glasses',subcategory_name:'Glasses',status:'open'},{article_id:'3',category_name:'Equipment',status:'open'}];
 const [group]=countCategoryGroups(entries,[entries[1],entries[2]]);assert.equal(group.progress.total,3);assert.equal(group.subgroups.length,2);const sub=group.subgroups.find(r=>r.name==='Glasses');assert.equal(sub.progress.total,2);assert.equal(sub.progress.counted,1);assert.equal(sub.entries.length,1);assert(group.subgroups.some(r=>r.name==='Nur Hauptkategorie'));
 const projected=projectRun({entries:[{...entries[0],count_units:[],values:{}}]});assert.equal(projected.entries[0].subcategory_name,'Glasses');
});
