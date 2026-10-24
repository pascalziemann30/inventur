import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ClipboardList,ScanLine,Truck} from 'lucide-react';
import {employeeTestClient} from '../counting/testClient.js';
import {selectEmployeeMode} from './entryMode.js';
import EntryHeader from './EntryHeader.jsx';
import './entry.css';
export default function EmployeeHomePage(){
 const [outlet,setOutlet]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;employeeTestClient.functions.invoke('locationEntry',{action:'context'}).then(({data})=>{if(!data?.outlet?.id||data.is_admin!==false)throw Error('Bitte die Inventur erneut über Shift Control öffnen.');if(live){selectEmployeeMode();setOutlet(data.outlet);}}).catch(()=>{if(live)setError('Der Standortzugang ist abgelaufen. Bitte die Inventur erneut über Shift Control öffnen.');});return()=>{live=false;};},[]);
 return <div className="inventory-shell"><EntryHeader outlet={outlet?.name} back={false} navigation/><main className="inventory-home"><Link className="inventory-back" to="/OutletLogin">Bereich wechseln</Link><p className="inventory-eyebrow">MITARBEITERBEREICH</p><h1>{outlet?`Inventur · ${outlet.name}`:'Inventur'}</h1><p>Was möchtest du erledigen?</p>{error?<p className="inventory-error" role="alert">{error}</p>:!outlet?<p role="status">Standort wird geladen …</p>:<div className="inventory-task-grid">{[
 ['server','Inventur','Bestände zählen oder eine gespeicherte Inventur fortsetzen.',ClipboardList],['scan','Beleg scannen','Lieferschein fotografieren oder eine Datei hochladen.',ScanLine],['delivery','Lieferungen','Lieferentwürfe prüfen und offene Positionen bearbeiten.',Truck],
 ].map(([workflow,title,text,Icon])=><Link className="inventory-choice" key={workflow} to={`/InventoryCapture?workflow=${workflow}&outlet=${outlet.id}`}><span className="inventory-icon"><Icon size={28}/></span><h2>{title}</h2><p>{text}</p><span className="inventory-choice-action">Öffnen →</span></Link>)}</div>}</main></div>;
}
