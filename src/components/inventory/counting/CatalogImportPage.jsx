import React,{useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {inventoryAdminTestClient as inventoryTestClient} from './testClient.js';
import './counting.css';
import './catalogImport.css';

const labels={ready:'Bereit zum Fortsetzen',working:'Vorgang läuft oder muss geprüft werden',imported:'Import gespeichert – Gegenprüfung offen',verified:'Import vollständig gegengeprüft',closed:'Test abgeschlossen und Teststandort deaktiviert',blocked:'Angehalten – Klärung erforderlich'};
const tableLabels={Outlet:'Teststandort',Supplier:'Lieferanten',Unit:'Einheiten',Category:'Testkategorie',GlobalItem:'Artikelstamm',OutletItem:'Standortartikel',SupplierItem:'Einkaufs- und Belegeinheiten',OutletStock:'Bestandsdatensätze'};
export default function CatalogImportPage(){
 const [params,setParams]=useSearchParams(),id=params.get('import');
 const [json,setJson]=useState(''),[batch,setBatch]=useState(null),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[inspection,setInspection]=useState(null);
 const startRequest=useRef(null);
 const api=async(action,input={})=>{
  const response=await inventoryTestClient.functions.invoke('catalogImport',{action,...input});
  if(response.data?.error)throw new Error(response.data.error);return response.data;
 };
 useEffect(()=>{let active=true;(async()=>{
  const status=await api('status');if(active)setEnabled(status.enabled===true);
  if(id){const result=await api('get',{id});if(active)setBatch(result);}
 })().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id]);
 const perform=async task=>{setBusy(true);setError('');try{await task();}catch(e){setError(e.response?.data?.error||e.message);if(batch?.id){try{setBatch(await api('get',{id:batch.id}));}catch{/* Original error stays visible. */}}}finally{setBusy(false);}};
 const advance=async initial=>{
  let current=initial;
  while(current.status==='ready'){
   current=await api('step',{id:current.id,revision:current.revision});setBatch(current);
   if(current.status==='ready')await new Promise(resolve=>setTimeout(resolve,2000));
  }
 };
 const start=()=>perform(async()=>{
  const articles=JSON.parse(json);
  if(startRequest.current?.json!==json)startRequest.current={json,key:crypto.randomUUID()};
  const result=await api('start',{key:startRequest.current.key,articles});setBatch(result);
  const next=new URLSearchParams(params);next.set('import',result.id);setParams(next);
  await advance(result);
 });
 const refresh=()=>perform(async()=>{
  const status=await api('status');setEnabled(status.enabled===true);
  if(id)setBatch(await api('get',{id}));
 });
 return <main className="counting-workspace catalog-import"><header className="count-header"><div><p className="count-eyebrow">ADMIN · NUR TESTDATEN</p><h1>Kontrollierter Artikelimport</h1><p>Eigener Standort „Kuno15 · Importtest“. Anfangsbestände bleiben 0.</p></div></header>
  <section className="count-card"><p>Artikelnummern sind optional. Ungeklärte Gebinde dürfen nicht enthalten sein. Dieser Ablauf verändert keinen bestehenden Standort.</p>
   <p role="status">{enabled?'Testfenster geöffnet':'Testfenster geschlossen · gespeicherte Ergebnisse bleiben lesbar'}</p>
   {!batch&&<><label htmlFor="import-json">Geprüfte Artikeldaten</label><textarea id="import-json" aria-label="Geprüfte Artikeldaten" value={json} onChange={e=>setJson(e.target.value)} rows={5} style={{width:'100%'}} disabled={busy}/>
    <button className="count-primary" disabled={busy||!enabled||!json.trim()} onClick={start}>Testimport starten</button></>}
   <button disabled={busy} onClick={refresh}>Stand neu laden</button>
   {error&&<p role="alert">{error}</p>}
   {batch&&<><h2>{labels[batch.status]||batch.status}</h2><p>{batch.article_count} Artikel · {batch.completed} / {batch.total} Datensätze gespeichert</p>
    <dl>{Object.entries(batch.counts).map(([name,total])=><React.Fragment key={name}><dt>{tableLabels[name]||name}</dt><dd>{total}</dd></React.Fragment>)}</dl>
    <details><summary>Technische Referenz</summary><p>Teststandort-ID: {batch.outlet_id||'Noch nicht angelegt'}</p></details>
    {batch.error&&<p role="alert">{batch.error} · Keine automatische Wiederholung unsicherer Schreibvorgänge.</p>}
    {['working','blocked'].includes(batch.status)&&batch.completed<batch.total&&<button disabled={busy} onClick={()=>perform(async()=>setInspection(await api('inspect',{id:batch.id})))}>Unterbrochene Gruppe nur lesend prüfen</button>}
    {inspection&&<p>{inspection.pending_entity}: {inspection.pending_valid} / {inspection.pending_count} Datensätze eindeutig und vollständig gespeichert. Mehrdeutig: {inspection.pending_ambiguous}.</p>}
    {inspection&&inspection.pending_valid===inspection.pending_count&&<button disabled={busy||!enabled} onClick={()=>perform(async()=>{setBatch(await api('recover',{id:batch.id,revision:batch.revision}));setInspection(null);})}>Vollständig gespeicherte Gruppe übernehmen</button>}
    {batch.status==='ready'&&<button disabled={busy||!enabled} onClick={()=>perform(()=>advance(batch))}>Testimport fortsetzen</button>}
    {batch.completed===batch.total&&batch.status!=='closed'&&<button disabled={busy||!enabled} onClick={()=>perform(async()=>setBatch(await api('verify',{id:batch.id,revision:batch.revision})))}>Gespeicherte Verknüpfungen und Bestände prüfen</button>}
    {batch.report&&<><h3>Gegenprüfung</h3><p>{batch.report.records_read} gespeicherte Datensätze erneut gelesen.</p><p>{batch.report.zero_stocks} Anfangsbestände sind 0. Alle Verknüpfungen und Zähleinheiten geprüft.</p><p>Änderungen in Produktionsdaten: {batch.report.production_writes}</p></>}
    {batch.status==='verified'&&<button disabled={busy||!enabled} onClick={()=>perform(async()=>setBatch(await api('close',{id:batch.id,revision:batch.revision})))}>Test abschließen und Teststandort deaktivieren</button>}
   </>}
  </section></main>;
}
