import React,{useRef,useState} from 'react';
import {inventoryTestClient as base44} from './testClient.js';
import {inventoryRunApi} from './runApi.js';
import {checkRunPermissions} from './checkRunPermissions.js';

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
        try {setResult(await checkRunPermissions({entity:base44.entities.InventoryRun,loadRun:id=>inventoryRunApi('get',{id}),run}));}
        catch(cause){setResult({passed:false,error:cause.message});}
        finally{setBusy(false);}
    };
    return <details className="count-copy"><summary>Admin-Testwerkzeuge · ausschließlich Testdaten</summary><p>Beispielartikel anlegen, Testbestände prüfen oder eine Lieferung von 2 Litern Testmilch nachstellen.</p>
        <div className="count-test-actions">{!run && <button disabled={busy} onClick={()=>perform('prepare')}>Beispielartikel vorbereiten</button>}
            <button disabled={busy || !outletId} onClick={()=>perform('inspect')}>Testbestände prüfen</button>
            <button disabled={busy || !outletId} onClick={()=>perform('delivery')}>Testlieferung +2 l Milch</button>
            {run && <button disabled={busy} onClick={permissions}>Direktzugriffe auf Testsitzung prüfen</button>}</div>
        {busy && <p role="status">Test läuft …</p>}{result && <pre style={{whiteSpace:'pre-wrap'}} aria-label="Testwerkzeug-Ergebnis">{JSON.stringify(result,null,2)}</pre>}
    </details>;
}
