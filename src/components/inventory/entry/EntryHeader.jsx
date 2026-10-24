import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,House,Package,ClipboardList,ScanLine,Truck,CheckCheck,History} from 'lucide-react';
import './entry.css';
import {employeeMode} from './entryMode.js';
import {inventoryNavigation} from './navigationModel.js';
import {requestInventoryNavigation} from './NavigationGuard.jsx';
const icons={home:House,articles:Package,server:ClipboardList,scan:ScanLine,delivery:Truck,approvals:CheckCheck,history:History};
export default function EntryHeader({outlet,outletId,back=true,navigation=back,disabled=false,onLogout,entryAligned=false}){
 const location=useLocation(),navigate=useNavigate(),employee=employeeMode();
 const model=inventoryNavigation({employee,outlet:outletId||new URLSearchParams(location.search).get('outlet')||'',pathname:location.pathname,search:location.search});
 const follow=(event,href)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(!disabled)requestInventoryNavigation(href,navigate);};
 return <><header className={`inventory-header${entryAligned?' inventory-header--entry':''}`}><Link className="inventory-brand" to={navigation?model.home:'/OutletLogin'} onClick={event=>follow(event,navigation?model.home:'/OutletLogin')} aria-label={navigation?'Zur Übersicht':'Zur Bereichsauswahl'}>PrdktCntrl<span>.</span><small>Product Control</small></Link><div>{navigation&&<span className="inventory-role">{employee?'Mitarbeiter':'Administrator'}</span>}{outlet&&<span className="inventory-location">{outlet}</span>}{onLogout&&<button className="inventory-logout" disabled={disabled} onClick={onLogout}>Abmelden</button>}</div></header>
 {navigation&&<nav className="inventory-quicknav" aria-label="Bereiche">{model.tabs.map(([key,label,href])=>{const Icon=icons[key];return <Link key={key} to={href} aria-disabled={disabled||undefined} aria-current={model.active===key?'page':undefined} onClick={event=>follow(event,href)}><Icon size={16}/>{label}</Link>;})}</nav>}
 {back&&<div className="inventory-breadcrumb"><Link to={model.parent} onClick={event=>follow(event,model.parent)}><ArrowLeft size={16}/>{model.backLabel}</Link><span aria-hidden="true">/</span><span>{model.tabs.find(([key])=>key===model.active)?.[1]||'Verwaltung'}</span></div>}</>;
}
