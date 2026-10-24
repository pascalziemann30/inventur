export function inventoryNavigation({employee=false,outlet='',pathname='',search=''}={}){
 const current=new URLSearchParams(search),common=new URLSearchParams(search);
 for(const key of ['workflow','section','run','scan','delivery','proposal'])common.delete(key);
 if(outlet)common.set('outlet',outlet);
 const route=(path,values)=>{const p=new URLSearchParams(common);for(const[k,v]of Object.entries(values))p.set(k,v);return `${path}?${p}`;};
 const workflow=name=>route('/InventoryCapture',{workflow:name});
 const section=name=>route('/Dashboard',{section:name});
 const home=employee?workflow('home'):section('home');
 const tabs=employee?[['home','Übersicht',home],['server','Inventur',workflow('server')],['scan','Beleg scannen',workflow('scan')],['delivery','Lieferungen',workflow('delivery')]]:[['home','Übersicht',home],['articles','Artikel',section('articles')],['server','Inventur',workflow('server')],['scan','Beleg scannen',workflow('scan')],['delivery','Lieferungen',workflow('delivery')],['approvals','Freigaben',section('approvals')],['history','Verlauf',section('history')]];
 const active=pathname==='/InventoryCapture'?current.get('workflow')||'server':current.get('section')||'articles';
 const detail=current.has('run')?'server':current.has('delivery')?'delivery':current.has('scan')?'scan':null;
 const parent=detail?workflow(detail):home;
 const backLabel=detail?({server:'Zur Inventurübersicht',delivery:'Zur Lieferübersicht',scan:'Zur Belegübersicht'})[detail]:employee?'Zur Mitarbeiterübersicht':'Zur Administration';
 return {tabs,active,home,parent,backLabel};
}
