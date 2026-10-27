import fs from 'fs';
const {makeCatalogPlan,definitionFor}=await import('../base44/shared/inventory/catalogAdmin.js');
const {availableSubcategories}=await import('../base44/shared/inventory/subcategories.js');
const catalog=JSON.parse(fs.readFileSync('.tmp/catalog.json','utf8'));
const subs=availableSubcategories(catalog.categories,catalog.outlet.id);
console.log('available subs',subs.length);
const results={};
let tested=0;
for(const item of catalog.items.filter(i=>!i.deleted_at).slice(0,40)){
  const def=definitionFor(item,catalog);
  const children=subs.filter(s=>s.parent_name===def.definition.category);
  if(!children.length){continue;}
  const target=children.find(s=>s.id!==def.definition.subcategory_id)||children[0];
  const input={...def.definition,subcategory_id:target.id};
  tested++;
  try{
    makeCatalogPlan({catalog,articles:[input],requestId:'r'.repeat(20),expected:def.fingerprint,userId:'u',now:()=>new Date().toISOString()});
    results.ok=(results.ok||0)+1;
  }catch(e){const k=e.code||e.message;results[k]=(results[k]||0)+1;}
}
console.log('tested',tested,JSON.stringify(results,null,1));
