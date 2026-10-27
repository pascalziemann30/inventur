import CategoryIcon from '../design/CategoryIcon.jsx';
import {useState} from 'react';
import {canonicalCategory} from '@/lib/inventory/categories.js';
import {Pencil,Trash2,Undo2} from 'lucide-react';

const money=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:6}).format(n||0);
const periods={weekly:'wöchentlich',monthly:'monatlich',yearly:'jährlich'};

export default function AdminArticleCategories({articles,searching=false,disabled=false,onEdit,onDelete,onRestore,trashMode=false,selectionMode=false,selectedIds=new Set(),onSelect}){
 const grouped=new Map();
 for(const row of articles){
  const name=canonicalCategory(row.definition.category)||'Ohne Kategorie';
  if(!grouped.has(name))grouped.set(name,[]);
  grouped.get(name).push(row);
 }
 const groups=[...grouped].sort(([a],[b])=>a.localeCompare(b,'de'));
 const [expanded,setExpanded]=useState(()=>new Set(searching?groups.flatMap(([name,rows])=>[name,...rows.map(row=>`${name}:${row.definition.subcategory_id||''}`)]):[]));
 if(!articles.length)return null;
 const toggle=name=>setExpanded(previous=>{
  const next=new Set(previous);
  if(next.has(name))next.delete(name);else next.add(name);
  return next;
 });
 const renderTable=(rows,name)=>(
<div className="admin-table-wrap"><table className="admin-table"><caption className="admin-category-caption">Artikel in {name}</caption><thead><tr><th scope="col">Artikel</th><th scope="col">Einkaufsgebinde</th><th scope="col">Netto / Gebinde</th><th scope="col">Bestand</th><th scope="col">Aktionen</th></tr></thead><tbody>{rows.map(row=><tr key={row.definition.id} className={selectionMode&&selectedIds.has(row.definition.id)?'admin-row-selected':undefined}>
    <td><div className="admin-article-name">{selectionMode&&<input type="checkbox" aria-label={`${row.definition.name} auswählen`} disabled={disabled} checked={selectedIds.has(row.definition.id)} onChange={event=>onSelect([row],event.target.checked)}/>}<strong>{row.definition.name}</strong></div><small>{row.definition.supplier}{row.definition.is_active?'':' · inaktiv'}{row.links_valid?'':' · Verknüpfung prüfen'}</small>{trashMode&&<small>{row.purging?'Endgültige Bereinigung läuft':`Im Papierkorb bis ${new Date(row.delete_after).toLocaleDateString('de-DE')}`}</small>}</td>
    <td>{row.definition.purchase_label}<small>{row.definition.factor} {row.definition.unit} · {row.definition.inventory_intervals.map(p=>periods[p]).join(', ')}</small></td>
    <td>{money(row.definition.net_price)} €<small>{money(row.base_price)} € / {row.definition.unit}</small></td>
    <td>{row.stock??'Offen'} {row.definition.unit}</td>
    <td><div className="admin-article-actions" hidden={selectionMode}>{trashMode?<button disabled={disabled||row.purging||Date.parse(row.delete_after)<=Date.now()} aria-label={`${row.definition.name} wiederherstellen`} title="Artikel wiederherstellen" onClick={()=>onRestore(row)}><Undo2 size={18} aria-hidden="true"/></button>:<><button disabled={disabled} aria-label={`${row.definition.name} bearbeiten`} title="Artikel bearbeiten" onClick={()=>onEdit(row)}><Pencil size={18} aria-hidden="true"/></button><button className="admin-article-delete" disabled={disabled} aria-label={`${row.definition.name} in den Papierkorb verschieben`} title="Löschen · 30 Tage wiederherstellbar" onClick={()=>onDelete(row)}><Trash2 size={18} aria-hidden="true"/></button></>}</div></td>
   </tr>)}</tbody></table></div>
 );
 return <section aria-label="Artikel nach Kategorien" className={selectionMode?'admin-selection-active':undefined}>
  <div className="count-category-tools">
   <span>{articles.length} {searching?'Treffer':'Artikel'} in {groups.length} {groups.length===1?'Kategorie':'Kategorien'}</span>
   <div><button onClick={()=>setExpanded(new Set(groups.flatMap(([name,rows])=>[name,...rows.map(row=>`${name}:${row.definition.subcategory_id||''}`)])))}>Alle aufklappen</button><button onClick={()=>setExpanded(new Set())}>Alle zuklappen</button></div>
  </div>
  <div className="count-categories">{groups.map(([name,rows])=><details className="count-category-group admin-article-category" key={name} open={expanded.has(name)}>
   <summary onClick={event=>{event.preventDefault();toggle(name);}}><CategoryIcon name={name}/><h2>{name}</h2><span className="admin-category-count">{rows.length} Artikel</span></summary>
   {rows.some(row=>row.definition.subcategory_id)?[...new Set(rows.map(row=>row.definition.subcategory_id||''))].sort((a,b)=>(rows.find(r=>r.definition.subcategory_id===a)?.subcategory_name||'Nur Hauptkategorie').localeCompare(rows.find(r=>r.definition.subcategory_id===b)?.subcategory_name||'Nur Hauptkategorie','de')).map(id=>{const subset=rows.filter(row=>(row.definition.subcategory_id||'')===id),label=subset[0]?.subcategory_name||'Nur Hauptkategorie',groupKey=`${name}:${id}`;return <details className="count-category-group admin-article-subcategory" key={groupKey} open={expanded.has(groupKey)}><summary onClick={event=>{event.preventDefault();toggle(groupKey);}}><h3>{label}</h3><span className="admin-category-count">{subset.length} Artikel</span></summary>{renderTable(subset,label)}</details>}):renderTable(rows,name)}
  </details>)}</div>
 </section>;
}