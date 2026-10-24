import React,{useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {employeeMode,passwordAdminMode} from '../entry/entryMode.js';
import {employeeTestClient,inventoryAdminClient,inventoryEnvironment} from './testClient.js';
import {inventoryTestClient as base44} from './testClient.js';
import EntryHeader from '../entry/EntryHeader.jsx';
import CountingWorkspace from './CountingWorkspace.jsx';
import {inventoryRunApi,runErrorMessage} from './runApi.js';
import InventoryTestControls from './InventoryTestControls.jsx';
import './counting.css';
import '../delivery/deliveryReview.css';
import {isLifecycleRequest,withLifecycleDeadline} from '../delivery/lifecycleRequest.js';

const periods={monthly:'Monatsinventur',yearly:'Jahresinventur',weekly:'Wocheninventur',adhoc:'Einzelzählung'};
const lifecycleKey='inventory_run_lifecycle_pending_v1';
const savedLifecycle=()=>{try{const value=JSON.parse(sessionStorage.getItem(lifecycleKey)||'null');return isLifecycleRequest(value)?value:null;}catch{return null;}};
const backupKey=id=>`inventory_conflict_copy:${id}`;

export default function ServerCountingPage() {
    const [params,setParams]=useSearchParams();
    const id=params.get('run');
    const [outlets,setOutlets]=useState([]);
    const [outletId,setOutletId]=useState(params.get('outlet') || '');
    const [period,setPeriod]=useState('monthly');
    const [date,setDate]=useState(()=>new Date().toLocaleDateString('en-CA'));
    const [sessions,setSessions]=useState([]),[showDiscarded,setShowDiscarded]=useState(false),[listVersion,setListVersion]=useState(0);
    const [lifecycle,setLifecycle]=useState(null),[lifecyclePending,setLifecyclePending]=useState(savedLifecycle),[notice,setNotice]=useState('');
    const lifecycleFlight=useRef(false);
    const [run,setRun]=useState(null);
    const [loading,setLoading]=useState(true);
    const [busy,setBusy]=useState(false);
    const [error,setError]=useState(null);
    const [generation,setGeneration]=useState(0);
    const [saveStatus,setSaveStatus]=useState('saved');
    const [backup,setBackup]=useState(null);
    const [isAdmin,setIsAdmin]=useState(false);
    const revisionRef=useRef(0);
    const startRef=useRef(null);
    const reopenRef=useRef(null);
    useEffect(()=>{
        let active=true;
        (async()=>{
            if(employeeMode()){
                const {data}=await employeeTestClient.functions.invoke('locationEntry',{action:'context'});
                if(!data?.outlet?.id||data.is_admin!==false)throw new Error('Bitte die Inventur erneut über Shift Control öffnen.');
                if(active){setIsAdmin(false);setOutlets([data.outlet]);setOutletId(data.outlet.id);}
                return;
            }
            if(passwordAdminMode()){const {data}=await inventoryAdminClient.functions.invoke('adminSession',{action:'context'});if(!data?.authenticated||!data.outlet?.id)throw Error('Bitte erneut mit dem Admin-Passwort anmelden.');if(active){setIsAdmin(true);setOutlets([data.outlet]);setOutletId(data.outlet.id);}return;}
            const user=await base44.auth.me();
            if (!user?.id) throw new Error('Bitte mit deinem echten App-Konto anmelden.');
            const all=await base44.entities.Outlet.filter({is_active:true},'name',501);
            const assigned=user.data?.outlet_id || user.outlet_id;
            const allowed=all.filter(outlet=>outlet.type !== 'AGGREGATOR' && (user.role === 'admin' || outlet.id === assigned));
            if (active) {setIsAdmin(user.role === 'admin');setOutlets(allowed);if (allowed.length === 1) setOutletId(allowed[0].id);}
        })().catch(cause=>{if (active) setError(cause.message);}).finally(()=>{if (active) setLoading(false);});
        return ()=>{active=false;};
    },[]);
    useEffect(()=>{
        if (!outletId || id) return;
        let active=true;
        inventoryRunApi('list',{outlet_id:outletId,...(isAdmin?{include_discarded:showDiscarded}:{})}).then(value=>{if(active)setSessions(value);}).catch(cause=>{if(active)setError(cause.message);});
        return ()=>{active=false;};
    },[outletId,id,isAdmin,showDiscarded,listVersion]);
    useEffect(()=>{
        if (!id) {setRun(null);return;}
        let active=true;
        setLoading(true);setError(null);
        inventoryRunApi('get',{id}).then(value=>{
            if (!active)return;
            setRun(value);revisionRef.current=value.revision;setGeneration(value=>value+1);
            try {setBackup(JSON.parse(sessionStorage.getItem(backupKey(id)) || 'null'));} catch {setBackup(null);}
        }).catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
        return ()=>{active=false;};
    },[id]);
    const loadCurrent=async localCopy=>{
        setBusy(true);setError(null);
        try {
            // Save the local copy BEFORE replacing the component or its queue.
            if (localCopy) {sessionStorage.setItem(backupKey(id),JSON.stringify(localCopy));setBackup(localCopy);}
            const value=await inventoryRunApi('get',{id});
            revisionRef.current=value.revision;setRun(value);setGeneration(value=>value+1);setSaveStatus('saved');
        } catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    const start=async event=>{
        event.preventDefault();setBusy(true);setError(null);
        const signature=JSON.stringify([outletId,period,date]);
        if (startRef.current?.signature !== signature) startRef.current={signature,start_key:crypto.randomUUID()};
        try {
            const value=await inventoryRunApi('start',{outlet_id:outletId,period_type:period,session_date:date,start_key:startRef.current.start_key});
            const next=new URLSearchParams(params);next.set('run',value.id);setParams(next);
        }catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    const saveDraft=async request=>{
        const result=await inventoryRunApi('save',{id,request_id:request.id,revision:request.revision,
            entries:request.snapshot.map(entry=>({article_id:entry.article_id,status:entry.status,values:entry.values}))});
        revisionRef.current=result.revision;
        return result;
    };
    const complete=async()=>{
        const value=await inventoryRunApi('finalize',{id,revision:revisionRef.current});
        revisionRef.current=value.revision;setRun(value);setGeneration(value=>value+1);
        if (value.status !== 'completed') throw new Error('Der Abschluss ist noch offen. Bitte die markierten Artikel prüfen.');
    };
    const lifecycleRequest=async request=>{
        if(lifecycleFlight.current || !isLifecycleRequest(request))return;
        lifecycleFlight.current=true;setBusy(true);setError(null);
        try{
            sessionStorage.setItem(lifecycleKey,JSON.stringify(request));
            await withLifecycleDeadline(()=>inventoryRunApi(request.action,request.input));
            sessionStorage.removeItem(lifecycleKey);setLifecyclePending(null);setLifecycle(null);setListVersion(v=>v+1);
            setNotice(request.action==='discard'?'Zwischenstand gelöscht. Unter „Gelöschte Zwischenstände“ kannst du ihn wiederherstellen. Keine Bestandsänderung.':'Zwischenstand wiederhergestellt.');
            if(id){const next=new URLSearchParams(params);next.delete('run');setParams(next);}
        }catch(cause){setError(cause.message);setLifecycle(null);if(cause.uncertain)setLifecyclePending(request);else{sessionStorage.removeItem(lifecycleKey);setLifecyclePending(null);setListVersion(v=>v+1);}}
        finally{lifecycleFlight.current=false;setBusy(false);}
    };
    const recount=async entry=>{
        setBusy(true);setError(null);
        const signature=JSON.stringify([id,entry.article_id,run.revision]);
        if (reopenRef.current?.signature !== signature) reopenRef.current={signature,request_id:crypto.randomUUID()};
        try {
            const result=await inventoryRunApi('reopen',{id,article_id:entry.article_id,revision:run.revision,request_id:reopenRef.current.request_id});
            revisionRef.current=result.revision;setRun(result.run);setGeneration(value=>value+1);setSaveStatus('saved');
        }catch(cause){setError(cause.message);}finally{setBusy(false);}
    };
    if (loading) return <div className="counting-workspace"><main className="count-main"><p role="status">Inventur wird geladen …</p></main></div>;
    return <div className="counting-workspace">
        <EntryHeader outlet={run?.outlet_name || outlets.find(o=>o.id===outletId)?.name} outletId={run?.outlet_id || outletId} disabled={busy || !!lifecyclePending}/>
        {inventoryEnvironment==='dev'&&<aside className="count-server-note"><strong>Testbetrieb · Speicherung in getrennten Testdaten</strong></aside>}
        {isAdmin && inventoryEnvironment==='dev' && <InventoryTestControls outletId={run?.outlet_id || outletId} run={run} onPrepared={value=>{setOutletId(value.outlet_id);setOutlets(current=>[...current,{id:value.outlet_id,name:value.outlet_name}]);setError(null);}}/>}
        {notice&&<p role="status" className="count-run-notice">{notice}</p>}
        {lifecyclePending&&<div className="count-copy"><p>Das Ergebnis des Löschens oder Wiederherstellens ist noch unklar. Bitte denselben Vorgang erneut prüfen.</p><button className="count-confirm" disabled={busy} onClick={()=>lifecycleRequest(lifecyclePending)}>Gleichen Vorgang erneut prüfen</button></div>}
        {lifecycle&&<div className="delivery-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="run-lifecycle-title" className="delivery-lifecycle-dialog"><h2 id="run-lifecycle-title">{lifecycle.action==='discard'?'Zwischenstand löschen?':'Zwischenstand wiederherstellen?'}</h2><p>{lifecycle.item.session_date} · {periods[lifecycle.item.period_type]}</p><p>{lifecycle.action==='discard'?'Nur der ungebuchte Zwischenstand wird aus der aktiven Liste entfernt. Der Bestand bleibt unverändert. Eine Wiederherstellung ist möglich.':'Der gespeicherte Zwischenstand erscheint wieder in der aktiven Inventurübersicht.'}</p><div className="delivery-actions"><button className="count-confirm" disabled={busy} onClick={()=>setLifecycle(null)}>Abbrechen</button><button className="count-primary" disabled={busy} onClick={()=>lifecycleRequest({action:lifecycle.action,input:{id:lifecycle.item.id,revision:lifecycle.item.revision,request_id:crypto.randomUUID()}})}>{busy?'Bestätigung läuft …':lifecycle.action==='discard'?'Zwischenstand löschen':'Wiederherstellen'}</button></div></section></div>}
        {error && <p className="count-error" role="alert">{error}</p>}
        {run?.read_only && <aside className="count-server-note">Änderungen gesperrt · gespeicherter Stand nur lesbar.</aside>}
        {backup && <details className="count-copy"><summary>Eigene Eingaben als Vergleichskopie erhalten</summary><p>Diese Kopie wird nicht automatisch über den aktuellen Stand geschrieben.</p>
            <ul>{backup.map(entry=><li key={entry.article_id}><strong>{entry.article_name}</strong>: {entry.status === 'skipped' ? 'ausdrücklich übersprungen' : Object.entries(entry.values || {}).map(([code,value])=>`${code}: ${value || 'leer'}`).join(' · ') || 'offen'}</li>)}</ul></details>}
        {run ? <>
            {isAdmin&&<div className="count-run-controls">{run.discarded_at?<><p>Gelöschter Zwischenstand · keine Bestandsbuchung</p><button className="count-confirm" disabled={busy || !!lifecyclePending} onClick={()=>setLifecycle({action:'restore',item:{...run,revision:revisionRef.current}})}>Wiederherstellen</button></>:run.can_discard?<button className="count-confirm" disabled={busy || !!lifecyclePending || saveStatus!=='saved'} onClick={()=>setLifecycle({action:'discard',item:{...run,revision:revisionRef.current}})}>Zwischenstand löschen</button>:<p>Der Abschluss wurde bereits begonnen. Diese Inventur kann nicht als Entwurf gelöscht werden.</p>}</div>}
            {run.status === 'posting' && <div className="count-recovery"><h2>Abschluss noch offen</h2><p>Bereits übernommene Positionen werden bei einer Wiederholung nicht erneut gebucht.</p>
                {run.entries.filter(entry=>entry.booking_error && !entry.booked).map(entry=><article key={entry.article_id}><strong>{entry.article_name}</strong><p>{runErrorMessage(entry.booking_error)}</p>
                    <button disabled={busy || run.read_only || saveStatus !== 'saved'} onClick={()=>recount(entry)}>Diesen Artikel erneut zählen</button></article>)}</div>}
            {run.status === 'completed' ? <>
                <main className="count-main"><section className="count-completed"><h1>Inventur abgeschlossen</h1><p>{run.entries.filter(entry=>entry.booked).length} Mengen übernommen · {run.entries.filter(entry=>entry.status === 'skipped').length} ausdrücklich übersprungen.</p>
                <p>Der Abschluss ist auf dem Server gespeichert und nach erneutem Laden verfügbar.</p><button className="count-primary" onClick={()=>{const next=new URLSearchParams(params);next.delete('run');next.set('outlet',run.outlet_id);setParams(next);}}>Zur Inventurübersicht</button></section></main></>
                : <CountingWorkspace embedded sessionKey={run.id} key={`${run.id}:${generation}`} initialEntries={run.entries} initialRevision={run.revision} outletName={run.outlet_name}
                    title={periods[run.period_type]} saveDraft={saveDraft} completeSession={complete} completionLabel={run.status === 'posting' ? 'Abschluss fortsetzen' : undefined}
                    onSaveState={state=>setSaveStatus(state.status)} onReload={loadCurrent} readOnly={busy || !!lifecyclePending || run.read_only}/>}
        </> : <main className="count-main"><header className="count-title"><div><p className="count-eyebrow">BESTAND AUFNEHMEN</p><h1>Inventur starten oder fortsetzen</h1><p>Monatlich als Standard. Der Zählrhythmus filtert die Artikel bereits beim Start.</p></div></header>

            <form className="count-card count-start product-count-start" onSubmit={start}><label>Standort<select value={outletId} onChange={event=>{setOutletId(event.target.value);setError(null);}} required disabled={busy||!isAdmin||outlets.length===1}><option value="">Bitte wählen</option>{outlets.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
                <label>Zählrhythmus<select value={period} onChange={event=>setPeriod(event.target.value)} disabled={busy}>{Object.entries(periods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
                <label>Inventurdatum<input type="date" value={date} onChange={event=>setDate(event.target.value)} required disabled={busy}/></label>
                <button className="count-primary" type="submit" disabled={busy || !outletId}>{busy ? 'Wird gestartet …' : 'Neue Inventur starten'}</button></form>
            <section className="count-sessions"><div className="delivery-actions"><h2>{showDiscarded?'Gelöschte Zwischenstände':'Gespeicherte Inventuren'}</h2>{isAdmin&&<button className="count-confirm" disabled={busy || !!lifecyclePending} onClick={()=>setShowDiscarded(v=>!v)}>{showDiscarded?'Aktive Inventuren':'Gelöschte Zwischenstände'}</button>}</div>
                {sessions.filter(session=>!!session.discarded_at===showDiscarded).map(session=><article className="count-session-row" key={session.id}><button className="count-session-open" disabled={busy || !!lifecyclePending} onClick={()=>{const next=new URLSearchParams(params);next.set('run',session.id);setParams(next);}}><strong>{session.session_date} · {periods[session.period_type]}</strong><span>{session.discarded_at?'Gelöscht':session.status==='completed'?'Abgeschlossen':session.status==='posting'?'Abschluss fortsetzen':'Zwischenstand öffnen'}</span></button>{isAdmin&&(session.can_discard || session.discarded_at)&&<button className="count-confirm" disabled={busy || !!lifecyclePending} onClick={()=>setLifecycle({action:session.discarded_at?'restore':'discard',item:session})}>{session.discarded_at?'Wiederherstellen':'Zwischenstand löschen'}</button>}</article>)}
                {!sessions.filter(session=>!!session.discarded_at===showDiscarded).length&&<p>{showDiscarded?'Keine gelöschten Zwischenstände.':'Noch keine gespeicherten Inventuren an diesem Standort.'}</p>}
            </section>
        </main>}
    </div>;
}
