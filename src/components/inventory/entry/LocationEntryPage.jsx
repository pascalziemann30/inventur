import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Users,ShieldCheck} from 'lucide-react';
import {employeeTestClient} from '../counting/testClient.js';
import {selectEmployeeMode,selectAdminMode} from './entryMode.js';
import {consumeLaunch} from './launchBootstrap.js';
import EntryHeader from './EntryHeader.jsx';
import './entry.css';
export default function LocationEntryPage(){
 const navigate=useNavigate(),pending=useRef(null);
 const [context,setContext]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;
  if(!pending.current)pending.current=(async()=>{const launch=consumeLaunch();if(launch)await employeeTestClient.functions.invoke('locationEntry',{action:'exchange',launch});const {data}=await employeeTestClient.functions.invoke('locationEntry',{action:'context'});if(!data?.outlet?.id||data.is_admin!==false)throw Error('INVALID_CONTEXT');return data;})();
  pending.current.then(value=>{if(live)setContext(value);}).catch(()=>{}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};
 },[]);
 const employee=()=>{if(!context){setError('Bitte die Inventur über den Inventur-Knopf in Shift Control öffnen. Dadurch wird Kuno15 sicher zugeordnet.');return;}selectEmployeeMode();navigate('/InventoryCapture?workflow=home');};
 return <div className="inventory-shell"><EntryHeader outlet={context?.outlet?.name} back={false} entryAligned/><main className="inventory-entry"><p className="inventory-eyebrow">WILLKOMMEN</p><h1>Inventur &amp; Produktcontrolling</h1><p>Wähle den Bereich, in dem du arbeiten möchtest.</p><div className="inventory-entry-grid">
  <button className="inventory-choice" disabled={loading} onClick={employee}><span className="inventory-icon"><Users size={28}/></span><h2>Mitarbeiter</h2><p>Bestände zählen, Belege scannen und Lieferungen erfassen.</p><span className="inventory-choice-action">{loading?'Standort wird übernommen …':'Mitarbeiterbereich öffnen →'}</span></button>
  <button className="inventory-choice" onClick={()=>{selectAdminMode();navigate('/Dashboard?section=articles&outlet=697f405ef1744da8ba46c99d');}}><span className="inventory-icon"><ShieldCheck size={28}/></span><h2>Administrator</h2><p>Artikel, Freigaben und Verlauf mit deinem Admin-Passwort verwalten.</p><span className="inventory-choice-action">Mit Admin-Passwort öffnen →</span></button>
 </div>{error&&<p className="inventory-error" role="alert">{error}</p>}</main></div>;
}
