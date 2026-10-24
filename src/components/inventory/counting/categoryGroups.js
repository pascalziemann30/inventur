import {countProgress} from './countModel.js';
import {canonicalCategory,categoryGroupKey} from '../../../../base44/shared/inventory/categories.js';
export function countCategoryGroups(entries,visible=entries){
 const groups=new Map(),visibleIds=new Set(visible.map(entry=>entry.article_id));
 for(const entry of entries){
  const name=canonicalCategory(entry.category_name)||'Ohne Kategorie',id=categoryGroupKey(name,entry.category_id);
  if(!groups.has(id))groups.set(id,{id,name,all:[],entries:[]});
  const group=groups.get(id);group.all.push(entry);if(visibleIds.has(entry.article_id))group.entries.push(entry);
 }
 return [...groups.values()].filter(group=>group.entries.length).map(group=>({...group,progress:countProgress(group.all)})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
