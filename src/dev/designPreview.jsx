import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import EntryHeader from '../components/inventory/entry/EntryHeader.jsx';
import {selectAdminMode,selectEmployeeMode} from '../components/inventory/entry/entryMode.js';
import ArticleEditor from '../components/inventory/admin/ArticleEditor.jsx';
import AdminArticleCategories from '../components/inventory/admin/AdminArticleCategories.jsx';
import ScanWorkspace from '../components/inventory/scan/ScanWorkspace.jsx';
import CountingWorkspace from '../components/inventory/counting/CountingWorkspace.jsx';
import DeliveryDetails from '../components/inventory/delivery/DeliveryDetails.jsx';
import {Package,ClipboardList,ScanLine,Truck} from 'lucide-react';
import '../components/inventory/admin/admin.css';
const definitions=[
 {name:'Beispiel Milchkännchen, 600 ml',category:'Betriebsausstattung',subcategory_id:'bar',supplier:'Amazon',unit:'Stk',purchase_label:'1 Stück',factor:1,net_price:10.08},
 {name:'Beispiel Trinkgläser, 200 ml',category:'Betriebsausstattung',subcategory_id:'glass',supplier:'Amazon',unit:'Stk',purchase_label:'6 Stück',factor:6,net_price:6.88},
 {name:'Beispiel Milch, 1 l',category:'Milchprodukte und Pflanzendrinks',supplier:'Frischdienst Berlin',unit:'l',purchase_label:'10 × 1 Liter',factor:10,net_price:9.3},
].map((d,i)=>({id:'demo-'+i,...d,sku:'',purchase_code:'ST',is_active:true,count_units:[{code:'base',label:d.unit,base_quantity:1,whole_numbers_only:false}],receipt_units:[],notes:'',inventory_intervals:['monthly','yearly']}));
const subcategories=[{id:'bar',parent_name:'Betriebsausstattung',name:'Kaffee- und Barzubehör'},{id:'glass',parent_name:'Betriebsausstattung',name:'Gläser, Geschirr und Servieren'}];
const catalog=definitions.map(d=>({definition:d,base_price:d.net_price/d.factor,stock:0,links_valid:true,subcategory_name:subcategories.find(s=>s.id===d.subcategory_id)?.name}));
function Preview(){const location=useLocation(),params=new URLSearchParams(location.search),section=params.get('section')||params.get('workflow')||'home';const [employee,setEmployee]=useState(false),[editor,setEditor]=useState(null),[message,setMessage]=useState(''),[supplier,setSupplier]=useState(''),[date,setDate]=useState('2026-10-24'),[reference,setReference]=useState('');
 return <div className="counting-workspace admin-workspace"><EntryHeader outlet="Kuno15 · Vorschau" outletId="demo"/><main className="count-main"><div className="count-tools"><span>Gestaltungsprüfung · synthetische Beispieldaten</span><button onClick={()=>{employee?selectAdminMode():selectEmployeeMode();setEmployee(!employee);}}>{employee?'Administratoransicht':'Mitarbeiteransicht'}</button></div>{message&&<p role="status" className="admin-success">{message}</p>}
 {section==='home'&&<><div className="count-title"><h1>Inventur &amp; Produktcontrolling</h1></div><div className="inventory-task-grid">{[[Package,'Artikel'],[ClipboardList,'Inventur'],[ScanLine,'Beleg scannen'],[Truck,'Lieferungen']].map(([Icon,label])=><div key={label} className="inventory-choice"><span className="inventory-icon"><Icon size={24}/></span><h2>{label}</h2><p>Alles für deinen Warenbestand.</p></div>)}</div></>}
 {section==='articles'&&<><div className="count-title"><h1>Artikel verwalten</h1><button className="count-primary" onClick={()=>setEditor({})}>Artikel anlegen</button></div><div className="count-tools"><label className="count-search"><input placeholder="Artikel oder Lieferant suchen"/></label><select><option>Aktive Artikel</option></select><button>Mehrere auswählen</button></div><AdminArticleCategories articles={catalog} onEdit={article=>setEditor({article})} onDelete={()=>setMessage('Vorschau: keine echten Artikel gelöscht.')}/></>}
 {section==='scan'&&<ScanWorkspace outletId="demo" supplierId="demo" api={async()=>{throw Error('Vorschau ohne Datenübertragung.');}} onScan={()=>{}} onDraft={()=>{}}/>}
 {section==='delivery'&&<><div className="count-title"><h1>Lieferungen</h1></div><DeliveryDetails options={{outlets:[{id:'demo',name:'Kuno15'}],suppliers:[{id:'demo',name:'Frischdienst Berlin'}]}} outlet="demo" supplier={supplier} date={date} reference={reference} onSupplierChange={setSupplier} onDateChange={setDate} onReferenceChange={setReference}/></>}
 {['approvals','history'].includes(section)&&<><div className="count-title"><h1>{section==='history'?'Verlauf und Export':'Offene Vorschläge'}</h1></div><details className="count-card admin-history"><summary>Beispielvorgang · 24.10.2026</summary><p>Gespeicherter Vorgang zum Prüfen der Darstellung.</p><button className="count-confirm">Vorgang öffnen</button></details></>}
 </main>{section==='server'&&<CountingWorkspace embedded preview outletName="Kuno15" initialEntries={definitions.map(d=>({article_id:d.id,article_name:d.name,category_name:d.category,subcategory_id:d.subcategory_id,subcategory_name:subcategories.find(s=>s.id===d.subcategory_id)?.name,unit_abbreviation:d.unit,count_units:d.count_units,status:'open',values:{},last_stock:0}))} saveDraft={async r=>({request_id:r.id,revision:r.revision+1})}/>}
 {editor&&<ArticleEditor {...editor} suppliers={['Amazon','Doppelpack','Frischdienst Berlin']} categories={definitions.map(d=>d.category)} subcategories={subcategories} units={['Stk','kg','l']} existingArticles={catalog} onClose={()=>setEditor(null)} onSave={()=>{setMessage('Artikel gespeichert (nur Vorschau).');setEditor(null);}}/>}</div>;
}
selectAdminMode();createRoot(document.getElementById('root')).render(<BrowserRouter><Preview/></BrowserRouter>);
