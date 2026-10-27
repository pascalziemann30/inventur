import {useState} from 'react';
import {Link} from 'react-router-dom';
import {LockKeyhole,ArrowLeft} from 'lucide-react';
import EntryHeader from './EntryHeader.jsx';
import {adminSessionApi} from './adminSessionApi.js';
import {selectPasswordAdminMode} from './entryMode.js';
import './entry.css';
export default function AdminPasswordForm({configured,onAuthenticated,onRefresh}){
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{
  await adminSessionApi('login',{password});setPassword('');
  const context=await adminSessionApi('context');if(!context.authenticated||context.method!=='password')throw Error('Die Sitzung konnte nicht gespeichert werden. Bitte Cookies für diese App erlauben.');
  selectPasswordAdminMode();onAuthenticated(context);
 }catch(cause){setError(cause.message);}finally{setBusy(false);}};
 return <div className="inventory-shell"><EntryHeader back={false}/><main className="inventory-login"><Link className="inventory-back" to="/OutletLogin"><ArrowLeft size={16}/>Zur Bereichsauswahl</Link><section className="inventory-password"><span className="inventory-icon"><LockKeyhole size={26}/></span><p className="inventory-eyebrow">ADMINISTRATION · KUNO15</p><h1>Administrator anmelden</h1><p>Melde dich einmal an. Dieser Browser bleibt 30 Tage angemeldet, auch beim Wechsel der Bereiche. Mit „Abmelden“ beendest du den Zugang jederzeit.</p>
  {configured===false&&<p className="inventory-notice" role="status">Das Admin-Passwort wird noch eingerichtet. Der Mitarbeiterbereich ist bereits nutzbar. <button type="button" className="inventory-back" onClick={onRefresh}>Einrichtung erneut prüfen</button></p>}
  <form onSubmit={submit}><label htmlFor="inventory-admin-password">Admin-Passwort</label><input id="inventory-admin-password" type="password" autoComplete="current-password" maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||configured===false} required autoFocus/><button className="inventory-primary" type="submit" disabled={busy||configured===false||!password}>{busy?'Wird angemeldet …':'Administration öffnen'}</button></form>
  {error&&<p className="inventory-error" role="alert">{error}</p>}
 </section></main></div>;
}
