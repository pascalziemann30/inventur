import React,{useRef,useState} from 'react';
import {inventoryTestClient as base44} from './testClient.js';

export default function InventoryTestControls({outletId,onPrepared,run}) {
    const [busy,setBusy]=useState(false);
    const [result,setResult]=useState(null);
    const deliveryRef=useRef(null);
    const perform=async action=>{
        setBusy(true);setResult(null);
        try {
            if (action === 'delivery' && !deliveryRef.current) deliveryRef.current=crypto.randomUUID();
            const data=(await base44.functions.invoke('inventoryTestSetup',{action,...(action !== 'prepare' ? {outlet_id:outletId} : {}),...(action === 'delivery' ? {request_id:deliveryRef.current} : {})})).data;
            setResult(data);
            if (action === 'prepare') onPrepared(data);
            if (action === 'delivery') deliveryRef.current=null;
        }catch(cause){setResult({error:cause.data?.error || cause.response?.data?.error || 'TESTZUGANG_NICHT_FREIGEGEBEN',status:cause.status ?? cause.response?.status});}
        finally{setBusy(false);}
    };
    const permissions=async()=>{
        setBusy(true);setResult(null);
        const checks=[];
        const cases=[
            ['Direktes Lesen gesperrt',404,()=>base44.entities.InventoryRun.get(run.id)],
            ['Direktes Anlegen gesperrt',403,()=>base44.entities.InventoryRun.create({outlet_id:run.outlet_id,actor_id:'client-permission-test',start_key:crypto.randomUUID(),start_fingerprint:'direct-permission-probe',session_date:run.session_date,period_type:run.period_type,status:'draft',revision:0,entries:[],request_receipts:[]})],
            ['Direktes Ändern gesperrt',403,()=>base44.entities.InventoryRun.update(run.id,{status:run.status})],
            ['Direktes Löschen gesperrt',403,()=>base44.entities.InventoryRun.delete(run.id)],
        ];
        for (const [name,expected,call] of cases) {
            try {await call();checks.push({name,passed:false});}
            catch(cause){const status=cause.status ?? cause.response?.status;checks.push({name,passed:status === expected,status});}
        }
        setResult({permission_checks:checks,passed:checks.every(check=>check.passed),scope:'Aktuelles echtes Benutzerkonto; keine simulierte Mitarbeiteranmeldung.'});setBusy(false);
    };
    return <details className="count-copy"><summary>Admin-Testwerkzeuge · ausschließlich Testdaten</summary><p>Beispielartikel anlegen, Testbestände prüfen oder eine Lieferung von 2 Litern Testmilch nachstellen.</p>
        <div className="count-test-actions">{!run && <button disabled={busy} onClick={()=>perform('prepare')}>Beispielartikel vorbereiten</button>}
            <button disabled={busy || !outletId} onClick={()=>perform('inspect')}>Testbestände prüfen</button>
            <button disabled={busy || !outletId} onClick={()=>perform('delivery')}>Testlieferung +2 l Milch</button>
            {run && <button disabled={busy} onClick={permissions}>Direktzugriffe auf Testsitzung prüfen</button>}</div>
        {busy && <p role="status">Test läuft …</p>}{result && <pre style={{whiteSpace:'pre-wrap'}} aria-label="Testwerkzeug-Ergebnis">{JSON.stringify(result,null,2)}</pre>}
    </details>;
}
