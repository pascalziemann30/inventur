import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import DeliveryReviewWorkspace from './DeliveryReviewWorkspace.jsx';
import {deliveryDraftApi,prepareDeliveryFixture,reviewDraftLines} from './draftApi.js';
import {inventoryEnvironment} from '../counting/testClient.js';
import './deliveryReview.css';

const backupKey=id=>`delivery_input_copy:${id}`;
const pendingKey=id=>`delivery_pending_request:${id}`;
const readLocal=key=>{try{return JSON.parse(sessionStorage.getItem(key) || 'null');}catch{return null;}};
const statusLabel={draft:'Entwurf',posting:'Buchung läuft',partially_booked:'Teilweise gebucht',completed:'Vollständig gebucht'};
const dateToday=()=>new Date().toLocaleDateString('en-CA');

export default function ServerDeliveryPage() {
    const [params,setParams]=useSearchParams(),id=params.get('delivery');
    const [options,setOptions]=useState(null),[outlet,setOutlet]=useState(''),[supplier,setSupplier]=useState('');
    const [date,setDate]=useState(dateToday),[reference,setReference]=useState(''),[firstName,setFirstName]=useState('');
    const [draft,setDraft]=useState(null),[drafts,setDrafts]=useState([]),[error,setError]=useState('');
    const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[backup,setBackup]=useState(null);
    const [generation,setGeneration]=useState(0),[listVersion,setListVersion]=useState(0);
    const startRef=useRef(null),requestRef=useRef(null),revisionRef=useRef(0);
    const localCopyRef=useRef(null);
    useEffect(()=>{
        let active=true;
        deliveryDraftApi('options').then(value=>{if(active){setOptions(value);if(value.outlets.length===1)setOutlet(value.outlets[0].id);}})
            .catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[]);
    useEffect(()=>{
        if(!outlet || id)return;
        let active=true;
        deliveryDraftApi('list',{outlet_id:outlet}).then(value=>{if(active)setDrafts(value);}).catch(cause=>{if(active)setError(cause.message);});
        return()=>{active=false;};
    },[outlet,id,listVersion]);
    useEffect(()=>{
        if(!id){setDraft(null);return;}
        let active=true;setLoading(true);setError('');
        deliveryDraftApi('get',{id}).then(value=>{
            if(!active)return;
            setDraft(value);revisionRef.current=value.revision;setGeneration(v=>v+1);
            setBackup(readLocal(backupKey(id)));const saved=readLocal(pendingKey(id));setPending(saved);requestRef.current=saved;
        }).catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[id]);
    const navigateWorkflow=(workflow,extra={})=>{const next=new URLSearchParams(params);next.set('workflow',workflow);next.delete('delivery');next.delete('scan');for(const [key,value] of Object.entries(extra))next.set(key,value);setParams(next);};
    const open=value=>{const next=new URLSearchParams(params);next.set('delivery',value.id);setParams(next);};
    const start=async event=>{
        event.preventDefault();setBusy(true);setError('');
        const signature=JSON.stringify([outlet,supplier,date,reference,firstName]);
        if(startRef.current?.signature!==signature)startRef.current={signature,input:{outlet_id:outlet,supplier_id:supplier,delivery_date:date,document_reference:reference,start_key:crypto.randomUUID(),
            lines:[{id:crypto.randomUUID(),original_name:firstName,supplier_article_number:'',purchase_unit_code:'',purchase_quantity:'',net_purchase_price:''}]}};
        try{open(await deliveryDraftApi('start',startRef.current.input));}catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    const apply=value=>{setDraft(value);revisionRef.current=value.revision;setGeneration(v=>v+1);};
    const send=async request=>{
        setBusy(true);setError('');requestRef.current=request;
        // Record the exact operation before sending it, so a reload can resume an uncertain response.
        try{
            sessionStorage.setItem(pendingKey(id),JSON.stringify(request));
            const reply=await deliveryDraftApi(request.action,request.input);
            apply(reply.draft);setPending(null);requestRef.current=null;
            sessionStorage.removeItem(pendingKey(id));sessionStorage.removeItem(backupKey(id));localCopyRef.current=null;setBackup(null);
        }catch(cause){
            setError(cause.message);
            if(cause.uncertain)setPending(request);
            else {setPending(null);requestRef.current=null;sessionStorage.removeItem(pendingKey(id));}
            throw cause;
        }finally{setBusy(false);}
    };
    const mutate=(action,input)=>send({action,input:{id,request_id:crypto.randomUUID(),revision:revisionRef.current,...input}});
    const reload=async()=>{
        setBusy(true);setError('');
        try{
            const value=await deliveryDraftApi('get',{id});apply(value);setBackup(localCopyRef.current || readLocal(backupKey(id)));
            setPending(null);requestRef.current=null;sessionStorage.removeItem(pendingKey(id));
        }catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    const fixture=async()=>{
        setBusy(true);setError('');
        try{
            const prepared=await prepareDeliveryFixture();
            open(await deliveryDraftApi('start',{outlet_id:prepared.outlet_id,supplier_id:prepared.supplier_id,delivery_date:dateToday(),
                document_reference:`TEST-${crypto.randomUUID().slice(0,8)}`,start_key:crypto.randomUUID(),lines:prepared.lines}));
        }catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    if(loading)return <div className="counting-workspace"><main className="count-main"><p role="status">Lieferungen werden geladen …</p></main></div>;
    return <div className="counting-workspace">
        <aside className="count-server-note"><strong>Gespeicherte Lieferentwürfe</strong><span>Bestand ändert sich erst durch ausdrücklich bestätigte Buchungen.</span></aside>
        {error && <div role="alert" className="count-copy"><p>{error}</p>{draft && <button className="count-confirm" disabled={busy} onClick={reload}>Gespeicherten Stand laden · lokale Eingaben als Vergleich behalten</button>}</div>}
        {pending && <div className="count-copy"><strong>Antwort noch unklar</strong><p>Der exakt gleiche Vorgang bleibt für einen erneuten Versuch erhalten. Weitere Änderungen sind bis zur Klärung gesperrt.</p><button className="count-confirm" disabled={busy} onClick={()=>send(requestRef.current).catch(()=>{})}>Gleichen Vorgang erneut versuchen</button></div>}
        {backup && <details className="count-copy"><summary>Lokale Eingaben als Vergleichskopie</summary><ul>{backup.map(line=><li key={line.id}>{line.original_name || 'Ohne Bezeichnung'} · {line.purchase_quantity || 'keine Menge'} {line.purchase_unit_code} · {line.net_purchase_price || 'kein Preis'}</li>)}</ul></details>}
        {draft ? <>
            <div className="delivery-draft-meta"><button className="count-link" disabled={busy || !!pending} onClick={()=>{const next=new URLSearchParams(params);next.delete('delivery');setParams(next);setListVersion(v=>v+1);}}>Zur Lieferübersicht</button><span>{draft.delivery_date} · Beleg {draft.document_reference || 'ohne Referenz'} · Stand {draft.revision} · {statusLabel[draft.status]}</span></div>
            {draft.source_scan_id && <p><button className="count-link" onClick={()=>navigateWorkflow('scan',{scan:draft.source_scan_id})}>Originalbeleg und Gegenprüfung öffnen</button></p>}
            <DeliveryReviewWorkspace key={`${id}:${generation}`} initialLines={draft.lines} initialReview={draft.review} lineStates={draft.line_states}
                outletName={draft.outlet_name} supplierName={draft.supplier_name} offers={draft.offers} isAdmin={draft.is_admin}
                readOnly={draft.read_only} externalBusy={busy || !!pending} posting={draft.posting} bookingEnabled={draft.booking_enabled} batchLineIds={draft.batch_line_ids}
                onInventory={()=>navigateWorkflow('server')} onBook={line_ids=>send({action:'book',input:{id,revision:revisionRef.current,line_ids}})}
                onEditLines={lines=>{localCopyRef.current=lines;try{sessionStorage.setItem(backupKey(id),JSON.stringify(lines));}catch{setError('Die lokale Vergleichskopie konnte nicht dauerhaft gespeichert werden. Bitte Eingaben vor dem Neuladen sichern.');}}}
                reviewLines={lines=>reviewDraftLines(draft.outlet_id,draft.supplier_id,lines)}
                onSave={lines=>mutate('save',{lines})}
                onConfirm={(line_id,supplier_item_id,acknowledged_issues)=>mutate('confirm',{line_id,supplier_item_id,acknowledged_issues})}
                onPropose={(line_id,note)=>mutate('propose',{line_id,note})}
                onResolve={(line_id,input)=>mutate('resolve',{line_id,...input})}/>
        </> : <main className="count-main">
            <div className="count-title"><div><p className="count-eyebrow">WARENEINGANG</p><h1>Lieferentwürfe</h1><p>Erfassen, prüfen und später weiterbearbeiten.</p></div></div>
            {options?.read_only && <p className="count-preview">Änderungen gesperrt. Vorhandene Entwürfe können weiterhin geöffnet werden.</p>}
            <p><button className="count-confirm" onClick={()=>navigateWorkflow('scan')}>Beleg scannen · Foto oder Datei</button></p>
            <form className="count-start" onSubmit={start}>
                <label>Standort<select aria-label="Lieferstandort" required disabled={busy||!options?.is_admin} value={outlet} onChange={e=>setOutlet(e.target.value)}><option value="">Standort wählen</option>{options?.outlets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Lieferant<select aria-label="Lieferant" required disabled={busy} value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Lieferant wählen</option>{options?.suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Lieferdatum<input type="date" required disabled={busy} value={date} onChange={e=>setDate(e.target.value)}/></label>
                <label>Belegreferenz<input aria-label="Belegreferenz" value={reference} maxLength={100} disabled={busy} onChange={e=>setReference(e.target.value)} placeholder="Lieferscheinnummer, falls vorhanden"/></label>
                <label>Erste Belegposition<input aria-label="Erste Belegposition" required maxLength={300} disabled={busy} value={firstName} onChange={e=>setFirstName(e.target.value)}/></label>
                <button className="count-primary" disabled={busy || options?.read_only || !options}>Lieferentwurf anlegen</button>
            </form>
            <section className="count-sessions"><h2>Gespeicherte Entwürfe</h2>{!drafts.length && <p>Für den ausgewählten Standort ist noch kein Entwurf gespeichert.</p>}{drafts.map(item=><button key={item.id} onClick={()=>open(item)}><strong>{item.document_reference || 'Ohne Belegreferenz'} · {item.supplier_name}</strong><span>{item.delivery_date} · {item.positions} Positionen · {statusLabel[item.status]} · {item.pending_proposals} Vorschläge offen</span></button>)}</section>
            {options?.is_admin && inventoryEnvironment==='dev' && <details className="count-copy"><summary>Admin-Testwerkzeug</summary><p>Erstellt einen eigenen synthetischen Standort, vier Testartikel mit Einkaufszuordnungen und einen Lieferentwurf mit einer bekannten und einer unbekannten Position.</p><button className="count-confirm" disabled={busy || options.read_only} onClick={fixture}>Synthetische Testlieferung vorbereiten</button></details>}
        </main>}
    </div>;
}
