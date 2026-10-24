import {canonicalCategory} from './categories.js';
import {BookingError} from './quantities.js';
const key=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/gu,' ');
const fail=code=>{throw new BookingError(code,409);};
export const starterSubcategories=[
 ['Gläser, Geschirr und Servieren',['trinkglas','gläser','kaffeeglas','geschirr','teller','tasse','teelöffel','serviertablett','tortenheber']],
 ['Kaffee- und Barzubehör',['milchkännchen','milchaufschäumkrug','milchaufschäumer','tamper','cocktail','barista','abschlagbehälter']],
 ['Aufbewahrung und Behälter',['vorratsglas','glasbehälter','frischhaltedose','schüttdose','eisbox','klarsichtdeckel','quetschflasche','aufbewahrung','vorratsdose']],
 ['Küchenwerkzeuge und Zubehör',['schneidebrett','küchenzange','spatel','thermometer','kurzzeitwecker','thermomix','rührschüssel','messer','schere']],
 ['Büro- und Organisationsmaterial',['druckerpapier','toner','ordner','trennblätter','dokumentenmappe','laminierfolien','whiteboard','prospekthülle','klebestift','etiketten']],
 ['Technik und Zubehör',['ladegerät','usb','hdmi','ipad','monitor','ventilator','windmaschine','drucker']],
 ['Möbel, Textilien und Dekoration',['arbeitstisch','servierwagen','sitzkissen','decke','vase','trockenblumen','eukalyptus','lichterkette','schürze']],
 ['Präsentation und Gästeinformation',['tischaufsteller','kundenstopper','letterboard','buchstaben','absperrkordel','speisekartenhalter']],
].map(([name,keywords])=>({name,keywords}));
export const isMainCategory=row=>!row.parent_id&&row.is_active!==false;
export function availableSubcategories(categories,outletId){
 return categories.filter(row=>row.parent_id&&row.is_active!==false&&row.outlet_id===outletId).flatMap(row=>{
  const parent=categories.find(p=>p.id===row.parent_id&&isMainCategory(p));
  return parent?[{id:row.id,name:row.name,parent_id:parent.id,parent_name:canonicalCategory(parent.name),keywords:row.keywords||[],fingerprint:subcategoryFingerprint(row)}]:[];
 }).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
export const subcategoryFingerprint=row=>JSON.stringify([row.id,row.name,row.parent_id,row.outlet_id,row.is_active??null,row.keywords||[]]);
export function selectedSubcategory(id,category,categories,outletId){
 if(!id)return null;
 const row=availableSubcategories(categories,outletId).find(r=>r.id===id&&r.parent_name===canonicalCategory(category));
 if(!row)fail('SUBCATEGORY_PARENT_MISMATCH');return row;
}
// Conservative, local suggestions. Ambiguous and unknown articles remain unassigned.
export function suggestSubcategory(articleName,category,subcategories){
 const source=key(articleName).replace(/[^\p{L}\p{N}]+/gu,' ');
 if(!source.trim())return null;
 const scored=subcategories.filter(r=>r.parent_name===canonicalCategory(category)).map(row=>{
  const terms=(row.keywords||[]).map(key).filter(t=>t.length>=3);
  const hits=terms.filter(term=>term.length>=5?source.includes(term):new RegExp(`(^| )${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}( |$)`,'u').test(source));
  return {row,score:hits.reduce((sum,hit)=>sum+hit.length,0),hits};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
 if(!scored.length||scored[1]?.score===scored[0].score)return null;
 return {id:scored[0].row.id,name:scored[0].row.name,reason:`Erkanntes Stichwort: ${scored[0].hits.join(', ')}`};
}
export function subcategoryPlan({catalog,input,requestId,userId,now}){
 const {mode,parent,id,name,keywords,expected}=input;
 if(!['create','rename','remove','setup'].includes(mode))fail('SUBCATEGORY_INPUT_INVALID');
 const roots=catalog.categories.filter(r=>isMainCategory(r)&&canonicalCategory(r.name)===canonicalCategory(parent)).sort((a,b)=>Number(b.name===parent)-Number(a.name===parent)||a.id.localeCompare(b.id));
 const root=roots[0];if(!root)fail('SUBCATEGORY_PARENT_MISMATCH');
 const child=id?catalog.categories.find(r=>r.id===id&&r.parent_id&&r.outlet_id===catalog.outlet.id&&r.is_active!==false):null;
 if(['rename','remove'].includes(mode)&&(!child||canonicalCategory(catalog.categories.find(p=>p.id===child.parent_id)?.name)!==canonicalCategory(root.name)))fail('SUBCATEGORY_PARENT_MISMATCH');
 if(child&&expected!==subcategoryFingerprint(child))fail('SUBCATEGORY_CHANGED_RELOAD');
 const nodes=[],add=(key,data,row)=>nodes.push(row?{key,entity:'Category',kind:'update',id:row.id,expected:Object.fromEntries(Object.keys(data).map(k=>[k,row[k]])),data}:{key,entity:'Category',kind:'create',data:{...data,catalog_key:`${requestId}:${key}`}});
 const children=catalog.categories.filter(r=>r.parent_id&&r.outlet_id===catalog.outlet.id&&canonicalCategory(catalog.categories.find(p=>p.id===r.parent_id)?.name)===canonicalCategory(root.name));
 const create=(label,terms,index)=>{
  if(typeof label!=='string'||!label.trim()||label!==label.trim()||label.length>100||!Array.isArray(terms)||terms.length>30||terms.some(k=>typeof k!=='string'||k.length<3||k.length>80))fail('SUBCATEGORY_INPUT_INVALID');
  if(children.some(r=>r.is_active!==false&&r.id!==id&&key(r.name)===key(label)))fail('SUBCATEGORY_DUPLICATE');
  add(`subcategory:${index}`,{name:label,keywords:[...new Set(terms.map(key))],parent_id:child?.parent_id||root.id,outlet_id:catalog.outlet.id,is_active:true},child);
 };
 if(mode==='setup'){
  if(canonicalCategory(root.name)!=='Betriebsausstattung'||children.length)fail('SUBCATEGORY_SETUP_EXISTS');
  starterSubcategories.forEach((row,i)=>create(row.name,row.keywords,i));
 }else if(mode==='remove'){
  for(const item of catalog.items.filter(r=>r.subcategory_id===id))nodes.push({key:`clear:${item.id}`,entity:'OutletItem',kind:'update',id:item.id,expected:{subcategory_id:id},data:{subcategory_id:''}});
  add('subcategory:remove',{is_active:false},child);
 }else create(name,keywords||[],0);
 return {kind:mode==='setup'?'subcategory-setup':'subcategory-change',request_id:requestId,input_fingerprint:JSON.stringify(input),nodes,results:[],cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:now,articles:0};
}
export function classificationPlan({catalog,groups,assignments,requestId,userId,now}){
 if(!Array.isArray(groups)||groups.length>40||!Array.isArray(assignments)||!assignments.length||assignments.length>250)fail('CLASSIFICATION_INVALID');
 const nodes=[],results=[],seen=new Set(),references=new Map();
 for(const [index,g] of groups.entries()){
  if(!g||Object.keys(g).some(k=>!['parent','name','keywords'].includes(k)))fail('CLASSIFICATION_INVALID');
  const existing=availableSubcategories(catalog.categories,catalog.outlet.id).filter(r=>r.parent_name===canonicalCategory(g.parent)&&key(r.name)===key(g.name));
  if(existing.length>1)fail('SUBCATEGORY_DUPLICATE');
  const identity=`${canonicalCategory(g.parent)}:${key(g.name)}`;if(references.has(identity))fail('SUBCATEGORY_DUPLICATE');
  if(existing.length)references.set(identity,existing[0].id);
  else{
   const plan=subcategoryPlan({catalog,input:{mode:'create',parent:g.parent,name:g.name,keywords:g.keywords||[]},requestId,userId,now});
   const node={...plan.nodes[0],key:`classification:group:${index}`};node.data={...node.data,catalog_key:`${requestId}:${node.key}`};nodes.push(node);references.set(identity,{catalog_ref:node.key});
  }
 }
 for(const [index,input]of assignments.entries()){
  if(!input||Object.keys(input).some(k=>!['id','expected','parent','subcategory'].includes(k))||seen.has(input.id))fail('CLASSIFICATION_INVALID');seen.add(input.id);
  const item=catalog.items.find(r=>r.id===input.id&&!r.deleted_at&&r.is_active!==false),global=item&&catalog.globals.find(r=>r.id===item.global_item_id);
  if(!item||!global||canonicalCategory(global.category_name||catalog.categories.find(r=>r.id===global.category_id)?.name)!==canonicalCategory(input.parent))fail('ARTICLE_CHANGED_RELOAD');
  // Fingerprint supplied by the authenticated catalog view: metadata changes never touch prices or stock.
  if(input.expected!==JSON.stringify([item.id,item.subcategory_id||'',global.category_id,item.display_name]))fail('ARTICLE_CHANGED_RELOAD');
  let id='';if(input.subcategory){id=references.get(`${canonicalCategory(input.parent)}:${key(input.subcategory)}`)||availableSubcategories(catalog.categories,catalog.outlet.id).find(r=>r.parent_name===canonicalCategory(input.parent)&&key(r.name)===key(input.subcategory))?.id;if(!id)fail('SUBCATEGORY_PARENT_MISMATCH');}
  if(id===item.subcategory_id||(!id&&!item.subcategory_id))continue;
  nodes.push({key:`classification:item:${index}`,entity:'OutletItem',kind:'update',id:item.id,expected:{subcategory_id:item.subcategory_id,display_name:item.display_name,global_item_id:item.global_item_id,is_active:item.is_active,deleted_at:item.deleted_at},data:{subcategory_id:id}});
 }
 nodes.sort((a,b)=>a.entity===b.entity?JSON.stringify(a.data).localeCompare(JSON.stringify(b.data)):a.entity==='Category'?-1:1);
 return {kind:'article-classification',request_id:requestId,input_fingerprint:JSON.stringify({groups,assignments}),nodes,results,cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:now,articles:assignments.length};
}
