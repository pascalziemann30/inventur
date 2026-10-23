import React,{useState,useEffect,useRef} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {employeeTestClient} from '../counting/testClient.js';
import {selectEmployeeMode,selectAdminMode} from './entryMode.js';
import {consumeLaunch} from './launchBootstrap.js';
import '../counting/counting.css';

export default function LocationEntryPage(){
 const navigate=useNavigate(),[params]=useSearchParams();
 const [launch,setLaunch]=useState(null);
 const consumed=useRef(false);
 useEffect(()=>{if(!consumed.current){consumed.current=true;setLaunch(consumeLaunch());}},[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const start=async()=>{
  setBusy(true);setError('');
  try{
   if(launch)await employeeTestClient.functions.invoke('locationEntry',{action:'exchange',launch});
   // A second request proves the browser actually retained and sends the protected cookie.
   const {data}=await employeeTestClient.functions.invoke('locationEntry',{action:'context'});
   if(!data?.outlet?.id||data.is_admin!==false)throw new Error('INVALID_CONTEXT');
   selectEmployeeMode();
   const next=new URLSearchParams(params);next.set('workflow','server');next.set('outlet',data.outlet.id);next.delete('run');
   navigate(`/InventoryCapture?${next}`,{replace:true});
  }catch{setError('Der Standortzugang konnte nicht bestätigt werden. Bitte die Inventur erneut über Shift Control öffnen. Falls das weiterhin auftritt, den Admin informieren.');}
  finally{setBusy(false);}
 };
 return <div className="counting-workspace"><main className="count-main">
  <h1>Inventur</h1>
  <p>Dein Standort wird aus Shift Control übernommen.</p>
  {error&&<p className="count-error" role="alert">{error}</p>}
  <section className="count-sessions"><button disabled={busy} onClick={start}><strong>Mitarbeiterbereich</strong><span>{busy?'Standort wird geprüft …':'Inventur am zugeordneten Standort öffnen'}</span></button>
  <button disabled={busy} onClick={()=>{selectAdminMode();navigate(`/OutletLogin?${params}`);}}><strong>Administratorbereich</strong><span>Mit Base44-Admin-Anmeldung öffnen</span></button></section>
 </main></div>;
}
