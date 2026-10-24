import EntryHeader from '../entry/EntryHeader.jsx';
import {useEffect,useState,useRef,useCallback} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {inventoryAdminClient,inventoryEnvironment} from '../counting/testClient.js';
import {useOutlet} from '../../outlet/OutletContext';
import {adminApi,finishCatalogOperation,workflowLink} from './adminApi.js';
import {adminSessionApi} from '../entry/adminSessionApi.js';
import {selectAdminMode} from '../entry/entryMode.js';
import ArticleEditor from './ArticleEditor.jsx';
import AdminArticleCategories from './AdminArticleCategories.jsx';
import '../counting/counting.css';
import './admin.css';
const money=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:6}).format(n||0);
const statuses={completed:'Abgeschlossen',partially_booked:'Teilweise gebucht',posting:'Buchung läuft',draft:'Entwurf',counted:'Gezählt',skipped:'Übersprungen',open:'Offen'};
const productionOutlet='697f405ef1744da8ba46c99d';
export default function AdminWorkspace({initialSection='articles'}){
 const navigate=useNavigate(),[params,setParams]=useSearchParams(),section=params.get('section')||initialSection;
 const {currentOutletId,setOutlet}=useOutlet();
 const [outlets,setOutlets]=useState([]),[outlet,setCurrentOutlet]=useState(params.get('outlet')||currentOutletId||''),[catalog,setCatalog]=useState(null),[queue,setQueue]=useState(null),[history,setHistory]=useState(null);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[filter,setFilter]=useState('active'),[editor,setEditor]=useState(null),[operation,setOperation]=useState(null);
 const [importData,setImportData]=useState(null),[importTarget,setImportTarget]=useState(inventoryEnvironment),[importChecked,setImportChecked]=useState(false);
 const requestRef=useRef(null),fileRef=useRef(null);
 const target=importTarget==='prod'?productionOutlet:outlet;
 useEffect(()=>{let live=true;adminApi('outlets',{outlet_id:productionOutlet}).then(({outlets:rows})=>{if(!live)return;const valid=rows.filter(o=>o.type!=='AGGREGATOR'&&o.is_active);setOutlets(valid);setCurrentOutlet(value=>valid.some(o=>o.id===value)?value:valid.find(o=>o.is_active)?.id||valid[0]?.id||'');}).catch(()=>setError('Standorte konnten nicht geladen werden.'));return()=>{live=false;};},[]);
 useEffect(()=>{const selected=outlets.find(o=>o.id===outlet);if(selected)setOutlet(selected.id,selected.name);},[outlet,outlets,setOutlet]);
 const refresh=useCallback(async()=>{
  if(!outlet)return;setLoading(true);
  try{
   const c=await adminApi('list',{outlet_id:outlet});setCatalog(c);if(section==='import')setOperation(await adminApi('status',{outlet_id:target,target_environment:importTarget}));else setOperation(c);
   if(section==='approvals')setQueue(await adminApi('queue',{outlet_id:outlet}));
   if(section==='history')setHistory(await adminApi('history',{outlet_id:outlet}));
  }finally{setLoading(false);}
 },[outlet,section,target,importTarget]);
 useEffect(()=>{let live=true;refresh().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[refresh]);
 const chooseSection=value=>{setError('');setMessage('');const next=new URLSearchParams(params);next.set('section',value);setParams(next);};
 const work=async task=>{setBusy(true);setError('');setMessage('');try{await task();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const requestKey=signature=>{if(requestRef.current?.signature!==signature)requestRef.current={signature,id:crypto.randomUUID()};return requestRef.current.id;};
 const advance=async(state,environment)=>finishCatalogOperation(state,{target_environment:environment,onProgress:setOperation});
 const save=(definition,{expected,proposal})=>work(async()=>{
  const request_id=requestKey(JSON.stringify({definition,expected}));
  const state=await adminApi('start',{outlet_id:outlet,request_id,articles:[definition],...(expected?{expected}:{})});
  const result=await advance(state);setEditor(null);setMessage('Artikel vollständig gespeichert. Bestände wurden nicht verändert.');requestRef.current=null;
  if(proposal){
   const offer=result.operation.results.find(r=>r.key==='article:0:offer:0');
   const {data:draft}=await inventoryAdminClient.functions.invoke('deliveryDrafts',{action:'get',id:proposal.draft_id});
   await inventoryAdminClient.functions.invoke('deliveryDrafts',{action:'resolve',id:proposal.draft_id,revision:draft.revision,request_id:crypto.randomUUID(),line_id:proposal.line_id,resolution:'link',note:'Artikel mit geprüfter Basiseinheit, Gebinde und Preis angelegt und ausdrücklich zugeordnet.',supplier_item_id:offer.id,identity_confirmed:true});
   setMessage('Artikel angelegt und Lieferposition zugeordnet. Die Bestandsbuchung bleibt separat zu bestätigen.');
  }
  await refresh();
 });
 const price=(row,decision)=>work(async()=>{
  const request_id=requestKey(JSON.stringify({price:row,decision}));
  await advance(await adminApi('price',{outlet_id:outlet,draft_id:row.draft_id,line_id:row.line_id,decision,request_id}));
  requestRef.current=null;setMessage(decision==='approve'?'Stammpreis freigegeben. Der ursprüngliche Beleg bleibt unverändert.':'Preisvorschlag abgelehnt. Stammpreis unverändert.');await refresh();
 });
 const download=run=>work(async()=>{
  const result=await adminApi('export',{outlet_id:outlet,id:run.id});const url=URL.createObjectURL(new Blob([result.content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const readImport=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>1_000_000)throw Error('Bitte eine Artikelliste bis 1 MB verwenden.');const data=JSON.parse(await file.text());if(!Array.isArray(data)||!data.length||data.length>250)throw Error('Bitte die geprüfte Artikelliste verwenden.');setImportData(data);setImportChecked(false);setError('');}catch(e){setError(e.message);}};
 const importArticles=()=>work(async()=>{
  const request_id=requestKey(JSON.stringify({importData,target}));
  const state=await adminApi('start',{outlet_id:target,request_id,articles:importData,importing:true,target_environment:importTarget});
  await advance(state,importTarget);setMessage(`${importData.length} Artikel mit ihren Verknüpfungen übernommen. Anfangsbestände sind 0.`);requestRef.current=null;if(target===outlet)await refresh();
 });
 const activeOperation=operation?.operation&&operation.operation.status!=='completed';
 const visible=catalog?.articles.filter(row=>(filter==='all'||(filter==='active'?row.definition.is_active:!row.definition.is_active))&&`${row.definition.name} ${row.definition.supplier} ${row.definition.sku}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')))||[];
 return <div className="counting-workspace admin-workspace"><EntryHeader outlet={outlets.find(o=>o.id===outlet)?.name} outletId={outlet} disabled={busy} onLogout={()=>work(async()=>{await adminSessionApi('logout');selectAdminMode();window.location.assign('/OutletLogin');})}/>
  <main className="count-main">
   {inventoryEnvironment==='dev'&&<p className="count-preview">Entwurfsansicht · getrennte Testdaten. Eine Übernahme in den echten Kuno15 ist ausschließlich im Importbereich ausdrücklich auswählbar.</p>}
   {error&&<div className="count-error" role="alert">{error}<button disabled={busy} onClick={()=>work(refresh)}>Gespeicherten Stand laden</button></div>}{message&&<p className="admin-success" role="status">{message}</p>}
   {activeOperation&&<aside className="count-copy"><strong>{operation.operation.status==='blocked'?'Speicherung muss geprüft werden':'Speicherung noch offen'}</strong><p>{operation.operation.completed} von {operation.operation.total} Schritten bestätigt. {operation.operation.error||''}</p><button disabled={busy} onClick={()=>work(async()=>{const env=section==='import'?importTarget:undefined;const s=await adminApi('status',{outlet_id:operation.outlet_id,...(env?{target_environment:env}:{})});await advance(s,env);await refresh();setMessage('Gespeicherter Vorgang abgeschlossen.');})}>Gespeicherten Vorgang fortsetzen</button></aside>}
   {loading&&!catalog?<p role="status">Artikelverwaltung wird geladen …</p>:<>
    {section==='home'&&<><div className="count-title"><div><p className="count-eyebrow">KUNO15 · VERWALTUNG</p><h1>Administration</h1><p>Artikel pflegen, Vorgänge prüfen und Bestände verwalten.</p></div></div><div className="inventory-task-grid">{[['articles','Artikel','Artikel und Gebinde verwalten.'],['server','Inventur','Inventuren starten und Zwischenstände verwalten.'],['delivery','Lieferungen','Lieferungen erfassen und Entwürfe prüfen.'],['scan','Beleg scannen','Lieferschein fotografieren oder hochladen.'],['approvals','Freigaben','Artikelvorschläge und Preise prüfen.'],['history','Verlauf','Gespeicherte Inventuren und Exporte ansehen.']].map(([key,label,description])=><button className="inventory-choice" key={key} disabled={busy} onClick={()=>['server','delivery','scan'].includes(key)?navigate(workflowLink(key,{outlet})):chooseSection(key)}><h2>{label}</h2><p>{description}</p><span className="inventory-choice-action">Öffnen →</span></button>)}</div></>}
    {section==='articles'&&<><div className="count-title"><div><p className="count-eyebrow">STAMMDATEN</p><h1>Artikel verwalten</h1><button className="count-link" disabled={busy} onClick={()=>chooseSection('import')}>Artikelliste übernehmen</button><p>{catalog?.articles.filter(r=>r.definition.is_active).length||0} aktive Artikel · eindeutige Gebinde · nachvollziehbare Änderungen</p></div><button className="count-primary" disabled={busy||!outlet||activeOperation} onClick={()=>setEditor({})}>Artikel anlegen</button></div>
     <div className="count-tools"><label className="count-search"><input aria-label="Artikel suchen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Artikel, Lieferant oder Nummer suchen"/></label><select aria-label="Artikelstatus" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Aktive Artikel</option><option value="inactive">Inaktive Artikel</option><option value="all">Alle Artikel</option></select></div>
     {!visible.length&&<section className="count-card"><h2>Noch keine passenden Artikel</h2><p>Lege einen geprüften Artikel an oder übernimm die vorbereitete Artikelliste.</p></section>}
     <AdminArticleCategories key={`${outlet}:${filter}:${search.trim()}`} articles={visible} searching={Boolean(search.trim())} disabled={busy||activeOperation} onEdit={row=>setEditor({article:row})}/></>}
    {section==='approvals'&&<><div className="count-title"><div><p className="count-eyebrow">PRÜFEN UND FREIGEBEN</p><h1>Offene Vorschläge</h1><p>Artikel bleiben bis zur geprüften Anlage offen. Belegpreise ändern den Stammpreis erst nach deiner Freigabe.</p></div></div>
     <h2>Artikelvorschläge</h2>{queue?.proposals.length===0&&<p>Keine offenen Artikelvorschläge.</p>}{queue?.proposals.map(p=><article className="count-card admin-approval" key={`${p.draft_id}:${p.line_id}`}><h3>{p.source.original_name}</h3><p>{p.supplier_name} · {p.reference} · {p.date}</p><p>{p.source.purchase_quantity} {p.source.purchase_unit_code} · {p.source.net_purchase_price} € netto je Belegeinheit</p><p>{p.note}</p><div className="admin-actions"><button disabled={busy||activeOperation} onClick={()=>setEditor({proposal:p})}>Geprüften Artikel anlegen</button><button disabled={busy} onClick={()=>navigate(workflowLink('delivery',{delivery:p.draft_id,outlet}))}>Vorhandenen Artikel zuordnen / ablehnen</button></div></article>)}
     <h2>Abweichende Belegpreise</h2>{queue?.prices.length===0&&<p>Keine offenen Preisvorschläge.</p>}{queue?.prices.map(p=><article className="count-card admin-approval" key={`${p.draft_id}:${p.line_id}`}><h3>{p.name}</h3><p>{p.reference} · {p.date}</p><p>Stammpreis: {money(p.current)} € / {p.unit} → Belegpreis: <strong>{money(p.proposed)} € / {p.unit}</strong></p><div className="admin-actions"><button disabled={busy||activeOperation} onClick={()=>price(p,'reject')}>Stammpreis beibehalten</button><button className="count-primary" disabled={busy||activeOperation} onClick={()=>price(p,'approve')}>Diesen Belegpreis als Stammpreis freigeben</button></div></article>)}</>}
    {section==='history'&&<><div className="count-title"><div><p className="count-eyebrow">GESPEICHERTE VORGÄNGE</p><h1>Verlauf und Export</h1><p>Die Werte stammen aus den gespeicherten Buchungen und Inventuren. Spätere Stammdatenänderungen schreiben diese Werte nicht um.</p></div></div>
     <h2>Inventuren</h2>{history?.inventories.length===0&&<p>Noch keine Inventur gespeichert.</p>}{history?.inventories.map(r=><details className="count-card admin-history" key={r.id}><summary>{r.date} · {({weekly:'Wocheninventur',monthly:'Monatsinventur',yearly:'Jahresinventur',adhoc:'Einzelzählung'})[r.period]||r.period} · {statuses[r.status]||r.status} · {r.entries.length} Artikel</summary><div className="admin-actions"><button disabled={busy} onClick={()=>navigate(workflowLink('server',{run:r.id,outlet}))}>Inventur öffnen</button><button disabled={busy||r.status!=='completed'} onClick={()=>download(r)}>Abgeschlossene Inventur als CSV exportieren</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Artikel</th><th>Ergebnis</th><th>Netto / Basis</th></tr></thead><tbody>{r.entries.map(e=><tr key={e.article_id}><td>{e.name}</td><td>{e.status==='skipped'?'Ausdrücklich übersprungen':e.counted_quantity==null?'Noch offen':`${e.counted_quantity} ${e.unit}`}</td><td>{money(e.base_price)} €</td></tr>)}</tbody></table></div></details>)}
     <h2>Lieferungen</h2>{history?.deliveries.length===0&&<p>Noch keine Lieferung gespeichert.</p>}{history?.deliveries.map(d=><details className="count-card admin-history" key={d.id}><summary>{d.date} · {d.supplier} · {d.reference} · {statuses[d.status]||d.status}</summary><button disabled={busy} onClick={()=>navigate(workflowLink('delivery',{delivery:d.id,outlet}))}>Lieferung öffnen</button>{d.lines.map((l,i)=><p key={i}>{l.name}: {l.quantity} {l.purchase_unit} · {l.receipt_price} € netto · {l.booked?'gebucht':'offen'}</p>)}</details>)}
     <h2>Freigegebene Stammpreisänderungen</h2>{history?.prices.length===0&&<p>Noch keine Preisänderung gespeichert.</p>}{history?.prices.map(p=><p key={p.id}>{p.change_date} · {p.article_name}: {money(p.old_price)} € → {money(p.new_price)} € · {p.reason}</p>)}</>}
    {section==='import'&&<><div className="count-title"><div><p className="count-eyebrow">KONTROLLIERTER START</p><h1>Geprüfte Artikelliste übernehmen</h1><p>Vorhandener Standort, echte Kategorien und Bestand null. Keine Testbuchungen werden übernommen.</p></div></div><section className="count-card admin-import">
     <label>Zielbereich<select aria-label="Importziel" disabled={busy} value={importTarget} onChange={e=>{setImportTarget(e.target.value);setImportChecked(false);setOperation(null);}}>{inventoryEnvironment==='dev'&&<option value="dev">Aktueller Teststandort</option>}<option value="prod">Kuno15 · Produktivdaten</option></select></label>
     <p>Ein bestehender Artikelbestand wird nicht überschrieben. Ungeklärte Umrechnungen gehören nicht in die Importdatei.</p><label>Geprüfte Artikelliste<input ref={fileRef} type="file" accept="application/json,.json" disabled={busy} onChange={readImport}/></label>
     {importData&&<><p><strong>{importData.length} Artikel</strong> · {new Set(importData.map(r=>r.supplier)).size} Lieferanten · {new Set(importData.map(r=>r.category)).size} Kategorien</p><details><summary>Artikelliste vor der Übernahme ansehen</summary>{importData.map((r,i)=><p key={i}>{r.name} · {r.supplier} · {r.category} · {r.factor} {r.unit} je {r.purchase_label}</p>)}</details></>}
     <label className="admin-check"><input type="checkbox" checked={importChecked} disabled={busy||!importData} onChange={e=>setImportChecked(e.target.checked)}/>Zielbereich und geprüfte Artikelliste bestätigt. Neue Bestände werden mit 0 angelegt.</label>
     <button className="count-primary" disabled={busy||activeOperation||!importData||!importChecked||!target} onClick={importArticles}>{busy?'Übernahme läuft …':'Geprüfte Artikel übernehmen'}</button>
    </section></>}
   </>}
  </main>{editor&&<ArticleEditor key={editor.article?.definition.id||editor.proposal?.line_id||'new'} article={editor.article} proposal={editor.proposal} suppliers={catalog?.suppliers||[]} categories={catalog?.categories||[]} units={catalog?.units||[]} existingArticles={catalog?.articles||[]} busy={busy} error={error} onSave={save} onClose={()=>setEditor(null)}/>}
 </div>;
}
