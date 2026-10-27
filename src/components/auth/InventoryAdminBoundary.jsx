import {useState,useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {adminSessionApi} from '../inventory/entry/adminSessionApi.js';
import AdminPasswordForm from '../inventory/entry/AdminPasswordForm.jsx';
import {selectAdminMode,selectPasswordAdminMode} from '../inventory/entry/entryMode.js';
export default function InventoryAdminBoundary({children}){
 const location=useLocation(),[context,setContext]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[showForm,setShowForm]=useState(false);
 const accept=value=>{if(value.authenticated){if(value.method==='password')selectPasswordAdminMode();else selectAdminMode();}setContext(value);};
 useEffect(()=>{let live=true;setContext(null);setError('');setShowForm(false);adminSessionApi('context').then(value=>{if(live)accept(value);}).catch(cause=>{if(live)setError(cause.message);});return()=>{live=false;};},[location.pathname,retry]);
 if(context?.authenticated)return children;
 if(error&&showForm)return <AdminPasswordForm configured onAuthenticated={accept} onRefresh={()=>{setShowForm(false);setRetry(v=>v+1);}}/>;
 if(error)return <div className="inventory-shell"><main className="inventory-login"><p role="alert">{error}</p><button className="inventory-primary" onClick={()=>setRetry(v=>v+1)}>Erneut versuchen</button><button className="inventory-back" onClick={()=>setShowForm(true)}>Stattdessen mit Admin-Passwort anmelden</button></main></div>;
 if(!context)return <div className="inventory-shell"><main className="inventory-login"><p role="status">Admin-Zugang wird geprüft …</p></main></div>;
 return <AdminPasswordForm configured={context.configured} onAuthenticated={accept} onRefresh={()=>setRetry(v=>v+1)}/>;
}