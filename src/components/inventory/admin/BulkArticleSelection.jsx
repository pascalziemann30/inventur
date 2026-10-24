import {useEffect,useRef,useState} from 'react';
import {ListChecks,Trash2} from 'lucide-react';
export default function BulkArticleSelection({mode,selected,visible,busy,onStart,onCancel,onToggle,onDelete}){
 const [confirm,setConfirm]=useState(false),dialog=useRef(null),all=useRef(null);
 const selectedIds=new Set(selected.map(row=>row.definition.id));
 const count=visible.filter(row=>selectedIds.has(row.definition.id)).length;
 useEffect(()=>{if(all.current)all.current.indeterminate=count>0&&count<visible.length;},[count,visible.length,mode]);
 useEffect(()=>{if(confirm&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[confirm]);
 if(!mode)return <button className="admin-multi-start" disabled={busy} onClick={onStart}><ListChecks size={17} aria-hidden="true"/>Mehrere auswählen</button>;
 return <section className="admin-multi-select" aria-label="Mehrfachauswahl"><div className="admin-multi-bar"><strong role="status">{selected.length} Artikel ausgewählt</strong><button className="admin-article-delete" disabled={busy||!selected.length} onClick={()=>setConfirm(true)}><Trash2 size={17} aria-hidden="true"/>{selected.length?`${selected.length} in den Papierkorb`:'In den Papierkorb'}</button><button disabled={busy} onClick={onCancel}>Abbrechen</button></div><label className="admin-check"><input ref={all} type="checkbox" disabled={busy||!visible.length} checked={visible.length>0&&count===visible.length} onChange={e=>onToggle(visible,e.target.checked)}/>Alle {visible.length} Artikel dieser gefilterten Ansicht auswählen</label>
 {confirm&&<dialog ref={dialog} className="count-modal admin-multi-confirm" aria-labelledby="bulk-article-delete-title" onCancel={event=>{event.preventDefault();setConfirm(false);}}><h2 id="bulk-article-delete-title">{selected.length} Artikel in den Papierkorb verschieben?</h2><p>Die Artikel werden aus der aktiven Liste entfernt und können 30 Tage lang wiederhergestellt werden. Gespeicherte Inventuren und Belege bleiben erhalten.</p><ul>{selected.map(row=><li key={row.definition.id}>{row.definition.name}</li>)}</ul><footer><button onClick={()=>setConfirm(false)}>Weiter auswählen</button><button className="admin-article-delete" onClick={()=>{setConfirm(false);onDelete();}}>{selected.length} Artikel löschen</button></footer></dialog>}
 </section>;
}
