import {ListFilter,MapPin} from 'lucide-react';

export default function DeliveryDetails({options,outlet,supplier,date,reference,busy,onOutletChange,onSupplierChange,onDateChange,onReferenceChange}){
 const outlets=options?.outlets||[];
 const outletName=outlets.find(item=>item.id===outlet)?.name||'Standort wird geladen …';
 return <section className="delivery-details" aria-labelledby="delivery-details-title">
  <div className="delivery-details-heading">
   <div><h2 id="delivery-details-title">Lieferdaten</h2><p>Lieferant und Beleg zusammen erfassen</p></div>
   {outlets.length>1&&options?.is_admin?<label className="delivery-details-outlet-select">Standort<select aria-label="Lieferstandort" required disabled={busy} value={outlet} onChange={e=>onOutletChange(e.target.value)}><option value="">Standort wählen</option>{outlets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:<span className="delivery-details-outlet"><MapPin size={16} aria-hidden="true"/>{outletName}</span>}
  </div>
  <div className="delivery-details-fields">
   <label>Lieferant<select aria-label="Lieferant" required disabled={busy} value={supplier} onChange={e=>onSupplierChange(e.target.value)}><option value="">Lieferant wählen</option>{options?.suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <label>Lieferdatum<input aria-label="Lieferdatum" type="date" required disabled={busy} value={date} onChange={e=>onDateChange(e.target.value)}/></label>
   <label><span>Belegnummer <small>optional</small></span><input aria-label="Belegreferenz" value={reference} maxLength={100} disabled={busy} onChange={e=>onReferenceChange(e.target.value)} placeholder="z. B. VL-26067828"/></label>
  </div>
  <p className="delivery-details-hint"><ListFilter size={16} aria-hidden="true"/><span>Artikel werden passend zum Lieferanten angezeigt.</span></p>
 </section>;
}
