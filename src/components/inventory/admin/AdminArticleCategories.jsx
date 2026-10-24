import {useState} from 'react';
import {canonicalCategory} from '../../../../base44/shared/inventory/categories.js';
import {Pencil,Trash2,Undo2} from 'lucide-react';

const money=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:6}).format(n||0);
const periods={weekly:'wöchentlich',monthly:'monatlich',yearly:'jährlich'};

export default function AdminArticleCategories({articles,searching=false,disabled=false,onEdit,onDelete,onRestore,trashMode=false}){
 const grouped=new Map();
 for(const row of articles){
  const name=canonicalCategory(row.definition.category)||'Ohne Kategorie';
  if(!grouped.has(name))grouped.set(name,[]);
  grouped.get(name).push(row);
 }
 const groups=[...grouped].sort(([a],[b])=>a.localeCompare(b,'de'));
 const [expanded,setExpanded]=useState(()=>new Set(searching?groups.map(([name])=>name):[]));
 if(!articles.length)return null;
 const toggle=name=>setExpanded(previous=>{
  const next=new Set(previous);
  if(next.has(name))next.delete(name);else next.add(name);
  return next;
 });
 return <section aria-label="Artikel nach Kategorien">
  <div className="count-category-tools">
   <span>{articles.length} {searching?'Treffer':'Artikel'} in {groups.length} {groups.length===1?'Kategorie':'Kategorien'}</span>
   <div><button onClick={()=>setExpanded(new Set(groups.map(([name])=>name)))}>Alle aufklappen</button><button onClick={()=>setExpanded(new Set())}>Alle zuklappen</button></div>
  </div>
  <div className="count-categories">{groups.map(([name,rows])=><details className="count-category-group admin-article-category" key={name} open={expanded.has(name)}>
   <summary onClick={event=>{event.preventDefault();toggle(name);}}><h2>{name}</h2><span className="admin-category-count">{rows.length} Artikel</span></summary>
   <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-category-caption">Artikel in {name}</caption><thead><tr><th scope="col">Artikel</th><th scope="col">Einkaufsgebinde</th><th scope="col">Netto / Gebinde</th><th scope="col">Bestand</th><th scope="col">Aktionen</th></tr></thead><tbody>{rows.map(row=><tr key={row.definition.id}>
    <td><strong>{row.definition.name}</strong><small>{row.definition.supplier}{row.definition.is_active?'':' · inaktiv'}{row.links_valid?'':' · Verknüpfung prüfen'}</small>{trashMode&&<small>{row.purging?'Endgültige Bereinigung läuft':`Im Papierkorb bis ${new Date(row.delete_after).toLocaleDateString('de-DE')}`}</small>}</td>
    <td>{row.definition.purchase_label}<small>{row.definition.factor} {row.definition.unit} · {row.definition.inventory_intervals.map(p=>periods[p]).join(', ')}</small></td>
    <td>{money(row.definition.net_price)} €<small>{money(row.base_price)} € / {row.definition.unit}</small></td>
    <td>{row.stock??'Offen'} {row.definition.unit}</td>
    <td><div className="admin-article-actions">{trashMode?<button disabled={disabled||row.purging||Date.parse(row.delete_after)<=Date.now()} aria-label={`${row.definition.name} wiederherstellen`} title="Artikel wiederherstellen" onClick={()=>onRestore(row)}><Undo2 size={18} aria-hidden="true"/></button>:<><button disabled={disabled} aria-label={`${row.definition.name} bearbeiten`} title="Artikel bearbeiten" onClick={()=>onEdit(row)}><Pencil size={18} aria-hidden="true"/></button><button className="admin-article-delete" disabled={disabled} aria-label={`${row.definition.name} in den Papierkorb verschieben`} title="Löschen · 30 Tage wiederherstellbar" onClick={()=>onDelete(row)}><Trash2 size={18} aria-hidden="true"/></button></>}</div></td>
   </tr>)}</tbody></table></div>
  </details>)}</div>
 </section>;
}
