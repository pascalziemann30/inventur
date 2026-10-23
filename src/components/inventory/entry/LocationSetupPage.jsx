import {useEffect,useState,useCallback} from 'react';
import {inventoryAdminTestClient} from '../counting/testClient.js';
import '../counting/counting.css';
const call=async(action,input={})=>(await inventoryAdminTestClient.functions.invoke('locationEntrySetup',{action,...input})).data;
export default function LocationSetupPage(){
 const [state,setState]=useState(null),[outlet,setOutlet]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{const data=await call('status');setState(data);setOutlet(current=>current||data.binding?.outlet_id||(data.outlets.length===1?data.outlets[0].id:''));},[]);
 useEffect(()=>{refresh().catch(()=>setError('Testverwaltung nicht erreichbar oder keine Admin-Berechtigung.'));},[refresh]);
 const change=async action=>{
  setBusy(true);setError('');
  try{await call(action,action==='prepare'?{outlet_id:outlet}:{id:state.binding.id,revision:state.binding.revision});await refresh();}
  catch{setError('Änderung nicht bestätigt. Aktuellen Stand erneut laden und Konfiguration prüfen.');}
  finally{setBusy(false);}
 };
 return <div className="counting-workspace"><main className="count-main"><h1>Kuno-Verbindung vorbereiten</h1><p>Admin-Testverwaltung · ausschließlich getrennte Testdaten</p>
  {error&&<p className="count-error" role="alert">{error}</p>}
  {!state?<p>Admin-Zugriff wird geprüft …</p>:<>
   <ul><li>Quell-App: {state.source_id_configured?'eingerichtet':'noch offen'}</li><li>Gemeinsamer Verbindungsschlüssel: {state.launch_key_configured?'vorhanden':'noch offen'}</li><li>Sitzungsschlüssel: {state.session_key_configured?'vorhanden':'noch offen'}</li><li>Schreibfenster: {state.write_window_open?'befristet offen':'geschlossen'}</li></ul>
   <label>Teststandort<select aria-label="Kuno-Teststandort" value={outlet} disabled={busy||!!state.binding} onChange={e=>setOutlet(e.target.value)}><option value="">Auswählen</option>{state.outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
   <p>Standortbindung: {state.binding?(state.binding.is_active?'aktiv':'vorbereitet, gesperrt'):'noch nicht angelegt'}</p>
   {state.binding?.is_active&&<p>Automatisches Ende: {new Date(state.binding.expires_at).toLocaleString('de-DE')}</p>}
   <div className="count-test-actions">
    {!state.binding&&<button disabled={busy||!state.ready||!outlet||state.write_window_open} onClick={()=>change('prepare')}>Gesperrte Zuordnung vorbereiten</button>}
    {state.binding&&!state.binding.is_active&&<button disabled={busy||!state.ready||!state.write_window_open} onClick={()=>change('activate')}>Testverbindung für 15 Minuten starten</button>}
    {state.binding?.is_active&&<button disabled={busy} onClick={()=>change('close')}>Testverbindung schließen</button>}
    <button disabled={busy} onClick={()=>refresh().catch(()=>setError('Stand konnte nicht geladen werden.'))}>Stand erneut prüfen</button>
   </div>
  </>}
 </main></div>;
}
