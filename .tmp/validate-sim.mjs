import fs from 'fs';
const {definitionFor}=await import('../base44/shared/inventory/catalogAdmin.js');
const {invalidArticleField}=await import('../base44/shared/inventory/articleFields.js');
const snap=JSON.parse(fs.readFileSync('.tmp/catalog.json','utf8'));
const catalog={outlet:snap.outlet,items:snap.items,stocks:snap.stocks,globals:snap.globals,offers:snap.offers,suppliers:snap.suppliers,categories:snap.categories,units:snap.units};
const bad=[];
for(const item of catalog.items.filter(i=>!i.deleted_at)){
 const row=definitionFor(item,catalog);
 const field=invalidArticleField({...row.definition});
 if(field)bad.push({name:item.display_name,field,value:row.definition[field]});
}
console.log('rejected by client validation:',bad.length);
console.log(JSON.stringify(bad.slice(0,15),null,1));
const f={};for(const b of bad)f[b.field]=(f[b.field]||0)+1;
console.log('by field',JSON.stringify(f));
