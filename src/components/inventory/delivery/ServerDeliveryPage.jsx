import EntryHeader from '../entry/EntryHeader.jsx';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import DeliveryReviewWorkspace from './DeliveryReviewWorkspace.jsx';
import {deliveryDraftApi,prepareDeliveryFixture,reviewDraftLines} from './draftApi.js';
import {inventoryEnvironment} from '../counting/testClient.js';
import {isLifecycleRequest,lifecyclePendingKey,withLifecycleDeadline} from './lifecycleRequest.js';
import {initialManualEntries,manualDeliveryLines} from './manualDelivery.js';
import './deliveryReview.css';

const backupKey=id=>`delivery_input_copy:${id}`;
const pendingKey=id=>`delivery_pending_request:${id}`;
const readLocal=key=>{try{return JSON.parse(sessionStorage.getItem(key) || 'null');}catch{return null;}};
const statusLabel={draft:'Entwurf',posting:'Buchung läuft',partially_booked:'Teilweise gebucht',completed:'Vollständig gebucht'};
const dateToday=()=>new Date().toLocaleDateString('en-CA');

export default function ServerDeliveryPage() {
    const [params,setParams]=useSearchParams(),id=params.get('delivery');
    const [options,setOptions]=useState(null),[outlet,setOutlet]=useState(''),[supplier,setSupplier]=useState('');
    const [date,setDate]=useState(dateToday),[reference,setReference]=useState('');
    const [articles,setArticles]=useState([]),[entries,setEntries]=useState({}),[articleLoading,setArticleLoading]=useState(false),[articleError,setArticleError]=useState(''),[articleVersion,setArticleVersion]=useState(0),[search,setSearch]=useState('');
    const [showDiscarded,setShowDiscarded]=useState(false),[notice,setNotice]=useState(''),[lifecycle,setLifecycle]=useState(null),[lifecyclePending,setLifecyclePending]=useState(()=>{const saved=readLocal(lifecyclePendingKey);return isLifecycleRequest(saved)?saved:null;});
    const [draft,setDraft]=useState(null),[drafts,setDrafts]=useState([]),[error,setError]=useState('');
    const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[backup,setBackup]=useState(null);
    const [generation,setGeneration]=useState(0),[listVersion,setListVersion]=useState(0);
    const startRef=useRef(null),requestRef=useRef(null),revisionRef=useRef(0);
    const localCopyRef=useRef(null),lifecycleFlightRef=useRef(false);
    useEffect(()=>{
        let active=true;
        deliveryDraftApi('options').then(value=>{if(active){setOptions(value);if(value.outlets.length===1)setOutlet(value.outlets[0].id);}})
            .catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[]);
    useEffect(()=>{
        if(!outlet || id)return;
        let active=true;
        deliveryDraftApi('list',{outlet_id:outlet,...(options?.is_admin?{include_discarded:showDiscarded}:{})}).then(value=>{if(active)setDrafts(value);}).catch(cause=>{if(active)setError(cause.message);});
        return()=>{active=false;};
    },[outlet,id,listVersion,showDiscarded,options?.is_admin]);
    useEffect(()=>{
        let active=true;setArticles([]);setEntries({});setSearch('');setArticleError('');setArticleLoading(!!(outlet&&supplier&&!id));
        if(!outlet || !supplier || id)return()=>{active=false;};
        deliveryDraftApi('articles',{outlet_id:outlet,supplier_id:supplier}).then(value=>{if(active){setArticles(value);setEntries(initialManualEntries(value));}})
            .catch(cause=>{if(active)setArticleError(cause.message);}).finally(()=>{if(active)setArticleLoading(false);});
        return()=>{active=false;};
    },[outlet,supplier,id,articleVersion]);
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
        try {
            const signature=JSON.stringify([outlet,supplier,date,reference,entries]);
            if(startRef.current?.signature!==signature)startRef.current={signature,input:{outlet_id:outlet,supplier_id:supplier,delivery_date:date,document_reference:reference,start_key:crypto.randomUUID(),lines:manualDeliveryLines(articles,entries)}};
            open(await deliveryDraftApi('start',startRef.current.input));
        }catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    const changeEntry=(article,field,value)=>setEntries(current=>{
        const entry={...current[article.id],[field]:value};
        if(field==='offer_id')entry.price=String(article.offers.find(o=>o.id===value)?.net_purchase_price ?? '');
        return {...current,[article.id]:entry};
    });
    const lifecycleRequest=async request=>{
        if(lifecycleFlightRef.current || !isLifecycleRequest(request))return;
        lifecycleFlightRef.current=true;setBusy(true);setError('');
        try{
            sessionStorage.setItem(lifecyclePendingKey,JSON.stringify(request));
            await withLifecycleDeadline(()=>deliveryDraftApi(request.action,request.input));
            sessionStorage.removeItem(lifecyclePendingKey);
            setLifecyclePending(null);setLifecycle(null);setListVersion(v=>v+1);setNotice(request.action==='discard'?'Entwurf gelöscht. Unter „Gelöschte Entwürfe“ kannst du ihn wiederherstellen.':'Entwurf wiederhergestellt.');
            if(id){const next=new URLSearchParams(params);next.delete('delivery');setParams(next);}
        }catch(cause){setError(cause.message);setLifecycle(null);if(cause.uncertain)setLifecyclePending(request);else{setLifecyclePending(null);sessionStorage.removeItem(lifecyclePendingKey);setListVersion(v=>v+1);}}
        finally{lifecycleFlightRef.current=false;setBusy(false);}
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
        <EntryHeader outlet={options?.outlets.find(o=>o.id===outlet)?.name}/>
        {notice && <div role="status" className="count-copy">{notice}</div>}
        {lifecyclePending && <div className="count-copy"><p>Antwort zum Löschen oder Wiederherstellen noch unklar. Bitte denselben Vorgang erneut prüfen.</p><button className="count-confirm" disabled={busy} onClick={()=>lifecycleRequest(lifecyclePending)}>Gleichen Vorgang erneut versuchen</button></div>}
        {lifecycle && <div className="delivery-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="delivery-lifecycle-title" className="delivery-lifecycle-dialog"><h2 id="delivery-lifecycle-title">{lifecycle.action==='discard'?'Entwurf löschen?':'Entwurf wiederherstellen?'}</h2><p>{lifecycle.item.document_reference || 'Ohne Belegreferenz'} · {lifecycle.item.supplier_name}</p><p>{lifecycle.action==='discard'?'Der ungebuchte Entwurf verschwindet aus der aktiven Liste. Der Bestand bleibt unverändert. Du kannst ihn später wiederherstellen.':'Der Entwurf wird wieder in der aktiven Lieferübersicht angezeigt.'}</p><div className="delivery-actions"><button className="count-confirm" disabled={busy || !!lifecyclePending} onClick={()=>setLifecycle(null)}>Abbrechen</button><button className="count-primary" disabled={busy || !!lifecyclePending} onClick={()=>lifecycleRequest({action:lifecycle.action,input:{id:lifecycle.item.id,revision:lifecycle.item.revision,request_id:crypto.randomUUID()}})}>{busy?'Bestätigung läuft …':lifecycle.action==='discard'?'Entwurf löschen':'Wiederherstellen'}</button></div></section></div>}
        {error && <div role="alert" className="count-copy"><p>{error}</p>{draft && <button className="count-confirm" disabled={busy} onClick={reload}>Gespeicherten Stand laden · lokale Eingaben als Vergleich behalten</button>}</div>}
        {pending && <div className="count-copy"><strong>Antwort noch unklar</strong><p>Der exakt gleiche Vorgang bleibt für einen erneuten Versuch erhalten. Weitere Änderungen sind bis zur Klärung gesperrt.</p><button className="count-confirm" disabled={busy} onClick={()=>send(requestRef.current).catch(()=>{})}>Gleichen Vorgang erneut versuchen</button></div>}
        {backup && <details className="count-copy"><summary>Lokale Eingaben als Vergleichskopie</summary><ul>{backup.map(line=><li key={line.id}>{line.original_name || 'Ohne Bezeichnung'} · {line.purchase_quantity || 'keine Menge'} {line.purchase_unit_code} · {line.net_purchase_price || 'kein Preis'}</li>)}</ul></details>}
        {draft ? <>
            <div className="delivery-draft-meta"><button className="count-link" disabled={busy || !!pending} onClick={()=>{const next=new URLSearchParams(params);next.delete('delivery');setParams(next);setListVersion(v=>v+1);}}>Zur Lieferübersicht</button><span>{draft.delivery_date} · Beleg {draft.document_reference || 'ohne Referenz'} · Stand {draft.revision} · {statusLabel[draft.status]}</span></div>
            {draft.is_admin && <div className="delivery-draft-controls">{draft.discarded_at?<><p>Gelöschter Entwurf · Bestand unverändert</p><button className="count-confirm" disabled={busy || !!pending || !!lifecyclePending} onClick={()=>setLifecycle({action:'restore',item:draft})}>Entwurf wiederherstellen</button></>:draft.can_discard?<button className="count-confirm delivery-danger" disabled={busy || !!pending || !!lifecyclePending} onClick={()=>setLifecycle({action:'discard',item:draft})}>Entwurf löschen</button>:<p>Bereits gebuchte Lieferungen können nicht als Entwurf gelöscht werden.</p>}</div>}
            {draft.source_scan_id && <p><button className="count-link" onClick={()=>navigateWorkflow('scan',{scan:draft.source_scan_id})}>Originalbeleg und Gegenprüfung öffnen</button></p>}
            <DeliveryReviewWorkspace key={`${id}:${generation}`} initialLines={draft.lines} initialReview={draft.review} lineStates={draft.line_states}
                outletName={draft.outlet_name} supplierName={draft.supplier_name} offers={draft.offers} isAdmin={draft.is_admin}
                readOnly={draft.read_only} externalBusy={busy || !!pending || !!lifecyclePending} posting={draft.posting} bookingEnabled={draft.booking_enabled} batchLineIds={draft.batch_line_ids}
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
            <nav aria-label="Weitere Aufgaben" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}><button className="count-confirm" onClick={()=>navigateWorkflow('scan')}>Beleg scannen · Foto oder Datei</button><button className="count-link" onClick={()=>navigateWorkflow('server')}>Zur Inventurübersicht</button></nav>
            <form className="count-start delivery-manual-form" onSubmit={start}>
                <label>Standort<select aria-label="Lieferstandort" required disabled={busy||!options?.is_admin} value={outlet} onChange={e=>{setOutlet(e.target.value);setSupplier('');}}><option value="">Standort wählen</option>{options?.outlets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Lieferant<select aria-label="Lieferant" required disabled={busy} value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Lieferant wählen</option>{options?.suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Lieferdatum<input type="date" required disabled={busy} value={date} onChange={e=>setDate(e.target.value)}/></label>
                <label>Belegreferenz<input aria-label="Belegreferenz" value={reference} maxLength={100} disabled={busy} onChange={e=>setReference(e.target.value)} placeholder="Lieferscheinnummer, falls vorhanden"/></label>
                <section className="delivery-manual-articles" aria-label="Artikel des Lieferanten">
                    <h2>Gelieferte Artikel</h2><p>Nur gelieferte Mengen eintragen. Leere Felder und 0 werden nicht übernommen. Preise sind netto je gewähltem Gebinde und gelten nur für diese Lieferung.</p>
                    {!supplier?<p>Bitte zuerst einen Lieferanten wählen.</p>:articleLoading?<p role="status">Artikel werden geladen …</p>:articleError?<div role="alert"><p>{articleError}</p><button type="button" className="count-confirm" onClick={()=>setArticleVersion(v=>v+1)}>Artikel erneut laden</button></div>:<>
                        <label>Artikel suchen<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Artikelbezeichnung"/></label>
                        <p>{articles.length} angelegte Artikel · {Object.values(entries).filter(e=>Number(String(e.quantity).replace(',','.'))>0).length} mit Liefermenge</p>
                        {!articles.length && <p>Für diesen Lieferanten sind hier noch keine aktiven Artikel angelegt.</p>}
                        <div className="delivery-manual-list">{articles.filter(a=>a.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).map(article=>{
                            const entry=entries[article.id] || {},offer=article.offers.find(o=>o.id===entry.offer_id),available=article.offers.some(o=>o.available);
                            return <article className="delivery-manual-row" key={article.id}><h3>{article.name}</h3>{!available?<p className="delivery-warning">Einkaufsgebinde noch nicht eindeutig hinterlegt. Bitte vom Admin prüfen lassen.</p>:<div className="delivery-manual-fields">
                                <label>Gebinde<select aria-label={`Gebinde ${article.name}`} value={entry.offer_id || ''} disabled={busy} onChange={e=>changeEntry(article,'offer_id',e.target.value)}>{article.offers.filter(o=>o.available).map(o=><option key={o.id} value={o.id}>{o.purchase_unit_label || o.purchase_unit_code} · {o.base_quantity_per_purchase} {o.unit_abbreviation}</option>)}</select></label>
                                <label>Liefermenge<input aria-label={`Liefermenge ${article.name}`} inputMode="decimal" placeholder="0" value={entry.quantity || ''} disabled={busy} onChange={e=>changeEntry(article,'quantity',e.target.value)}/></label>
                                <label>Netto je Gebinde (€)<input aria-label={`Nettopreis ${article.name}`} inputMode="decimal" value={entry.price ?? ''} disabled={busy} onChange={e=>changeEntry(article,'price',e.target.value)}/></label>
                                {offer && <small>{offer.original_name}</small>}
                            </div>}</article>;
                        })}</div>
                    </>}
                </section>
                <p className="delivery-manual-note">Entwurf speichern ändert noch keinen Bestand. Anschließend Positionen gegenprüfen, bestätigen und ausdrücklich buchen.</p>
                <button className="count-primary" disabled={busy || !!lifecyclePending || options?.read_only || !options || articleLoading || !!articleError || !articles.length}>Lieferentwurf speichern und prüfen</button>
            </form>
            <section className="count-sessions"><div className="delivery-actions"><h2>Gespeicherte Lieferungen</h2>{options?.is_admin && <button className="count-confirm" aria-pressed={showDiscarded} disabled={busy || !!lifecyclePending} onClick={()=>setShowDiscarded(v=>!v)}>{showDiscarded?'Aktive Entwürfe anzeigen':'Gelöschte Entwürfe anzeigen'}</button>}</div>
                {!drafts.filter(item=>!!item.discarded_at===showDiscarded).length && <p>{showDiscarded?'Keine gelöschten Entwürfe.':'Für den ausgewählten Standort ist noch keine Lieferung gespeichert.'}</p>}
                {drafts.filter(item=>!!item.discarded_at===showDiscarded).map(item=><article className="delivery-saved-row" key={item.id}><button className="delivery-saved-open" disabled={busy || !!lifecyclePending} onClick={()=>open(item)}><strong>{item.document_reference || 'Ohne Belegreferenz'} · {item.supplier_name}</strong><span>{item.delivery_date} · {item.positions} Positionen · {item.discarded_at?'Gelöscht':statusLabel[item.status]} · {item.pending_proposals} Vorschläge offen</span></button>{options?.is_admin && (item.discarded_at || item.can_discard) && <button className="count-confirm" disabled={busy || !!lifecyclePending} onClick={()=>setLifecycle({action:item.discarded_at?'restore':'discard',item})}>{item.discarded_at?'Wiederherstellen':'Entwurf löschen'}</button>}</article>)}
            </section>
            {options?.is_admin && inventoryEnvironment==='dev' && <details className="count-copy"><summary>Admin-Testwerkzeug</summary><p>Erstellt einen eigenen synthetischen Standort, vier Testartikel mit Einkaufszuordnungen und einen Lieferentwurf mit einer bekannten und einer unbekannten Position.</p><button className="count-confirm" disabled={busy || options.read_only} onClick={fixture}>Synthetische Testlieferung vorbereiten</button></details>}
        </main>}
    </div>;
}
