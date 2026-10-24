import {useEffect,useState} from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {useNavigate} from 'react-router-dom';
import {withLifecycleDeadline} from '../delivery/lifecycleRequest.js';

export function requestInventoryNavigation(href,navigate){
 const event=new CustomEvent('inventory:navigate',{cancelable:true,detail:{href}});
 if(window.dispatchEvent(event))navigate(href);
}
export default function NavigationGuard({dirty,onSave,allowDiscard=false,blockedMessage,message}){
 const navigate=useNavigate(),[target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!dirty)return;
  const block=event=>{event.preventDefault();setTarget(event.detail.href);setError('');};
  const unload=event=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('inventory:navigate',block);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('inventory:navigate',block);window.removeEventListener('beforeunload',unload);};
 },[dirty]);

 const leave=async()=>{setBusy(true);setError('');try{await withLifecycleDeadline(onSave);const destination=target;setTarget(null);navigate(destination);}catch(cause){setError(cause.message||'Speicherung nicht bestätigt. Bitte hier bleiben und erneut speichern.');}finally{setBusy(false);}};
 return <AlertDialog.Root open={!!target} onOpenChange={open=>{if(!open&&!busy)setTarget(null);}}><AlertDialog.Portal><AlertDialog.Overlay className="inventory-navigation-overlay"/><AlertDialog.Content className="count-modal inventory-navigation-dialog"><AlertDialog.Title asChild><h2>{blockedMessage?'Vorgang läuft':'Eingaben noch nicht gespeichert'}</h2></AlertDialog.Title><AlertDialog.Description asChild><p>{blockedMessage || message || 'Vor dem Bereichswechsel wird dein aktueller Zwischenstand gespeichert.'}</p></AlertDialog.Description>{error&&<p className="count-error" role="alert">{error}</p>}<div><AlertDialog.Cancel asChild><button disabled={busy}>Hier bleiben</button></AlertDialog.Cancel>{allowDiscard&&!blockedMessage&&<button disabled={busy} onClick={()=>{const destination=target;setTarget(null);navigate(destination);}}>Eingaben verwerfen & wechseln</button>}{onSave&&!blockedMessage&&<button className="count-primary" disabled={busy} onClick={leave}>{busy?'Speicherung wird bestätigt …':'Speichern & wechseln'}</button>}</div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
