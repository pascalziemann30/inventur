import {Link} from 'react-router-dom';
import './entry.css';
import {employeeMode} from './entryMode.js';
export default function EntryHeader({outlet,back=true}){return <header className="inventory-header"><Link className="inventory-brand" to="/OutletLogin" aria-label="Zur Bereichsauswahl">ShiftCntrl<span>.</span><small>INVENTUR</small></Link><div>{outlet&&<span className="inventory-location">{outlet}</span>}{back&&<Link className="inventory-back" to={employeeMode()?'/InventoryCapture?workflow=home':'/Dashboard'}>{employeeMode()?'Zum Mitarbeiterbereich':'Zur Administration'}</Link>}</div></header>;}
