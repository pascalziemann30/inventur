import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {withLifecycleDeadline} from '../delivery/lifecycleRequest.js';

export function requestInventoryNavigation(href,navigate){
 const event=new CustomEvent('inventory:navigate',{cancelable:true,detail:{href}});
 if(window.dispatchEvent(event))navigate(href);
}
export default function NavigationGuard({dirty,onSave,allowDiscard=false,blockedMessage,message}){
 const navigate=useNavigate(),[target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef(null);
 useEffect(()=>{
  if(!dirty)return;
  const block=event=>{event.preventDefault();setTarget(event.detail.href);setError('');};
  const unload=event=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('inventory:navigate',block);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('inventory:navigate',block);window.removeEventListener('beforeunload',unload);};
 },[dirty]);
 useEffect(()=>{if(target)dialog.current?.showModal();},[target]);
 const leave=async()=>{setBusy(true);setError('');try{await withLifecycleDeadline(onSave);navigate(target);}catch(cause){setError(cause.message||'Speicherung nicht bestätigt. Bitte hier bleiben und erneut speichern.');}finally{setBusy(false);}};
 return target?<dialog className="count-modal" ref={dialog} aria-labelledby="inventory-navigation-title" onCancel={event=>{event.preventDefault();if(!busy)setTarget(null);}}><h2 id="inventory-navigation-title">{blockedMessage?'Vorgang läuft':'Eingaben noch nicht gespeichert'}</h2><p>{blockedMessage || message || 'Vor dem Bereichswechsel wird dein aktueller Zwischenstand gespeichert.'}</p>{error&&<p className="count-error" role="alert">{error}</p>}<div><button disabled={busy} onClick={()=>setTarget(null)}>Hier bleiben</button>{allowDiscard&&!blockedMessage&&<button disabled={busy} onClick={()=>navigate(target)}>Eingaben verwerfen & wechseln</button>}{onSave&&!blockedMessage&&<button className="count-primary" disabled={busy} onClick={leave}>{busy?'Speicherung wird bestätigt …':'Speichern & wechseln'}</button>}</div></dialog>:null;
}
