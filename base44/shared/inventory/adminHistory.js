import {BookingError} from './quantities.js';
const fail=(code,status=409)=>{throw new BookingError(code,status);};
const bounded=async p=>{const r=await p;if(!Array.isArray(r)||r.length>=501)fail('HISTORY_REQUIRES_PAGING');return r;};
export async function readAdminHistory(e,outletId){
 const [runs,drafts,prices]=await Promise.all([bounded(e.InventoryRun.filter({outlet_id:outletId},'-created_date',501)),bounded(e.DeliveryDraft.filter({outlet_id:outletId},'-created_date',501)),bounded(e.PriceHistory.list('-created_date',501))]);
 const ids=new Set((await bounded(e.OutletItem.filter({outlet_id:outletId},'id',501))).map(r=>r.id));
 return {inventories:runs.map(r=>({id:r.id,date:r.session_date,period:r.period_type,status:r.status,completed_at:r.completed_at,entries:r.entries.map(x=>({article_id:x.article_id,name:x.article_name,category:x.category_name,unit:x.unit_abbreviation,status:x.status,counted_quantity:x.counted_quantity??null,previous_quantity:x.last_stock,base_price:x.net_base_unit_price,booked:x.booked===true}))})),
 deliveries:drafts.map(d=>({id:d.id,date:d.delivery_date,supplier:d.supplier_name,reference:d.document_reference,status:d.status,lines:d.lines.map(l=>({name:l.source.original_name,quantity:l.source.purchase_quantity,purchase_unit:l.source.purchase_unit_code,receipt_price:l.source.net_purchase_price,booked:!!l.booking_receipt,base_quantity:l.confirmation?.base_quantity??null,unit:l.confirmation?.unit_abbreviation||'',price_review:l.price_review||null}))})),prices:prices.filter(p=>ids.has(p.article_id))};
}
export async function readAdminQueue(e,outletId){
 const [drafts,items]=await Promise.all([bounded(e.DeliveryDraft.filter({outlet_id:outletId},'-created_date',501)),bounded(e.OutletItem.filter({outlet_id:outletId},'id',501))]);
 const proposals=[],prices=[];
 for(const draft of drafts)for(const line of draft.lines){
  if(line.proposal?.status==='pending')proposals.push({draft_id:draft.id,revision:draft.revision,line_id:line.source.id,supplier_id:draft.supplier_id,supplier_name:draft.supplier_name,date:draft.delivery_date,reference:draft.document_reference,source:line.source,note:line.proposal.note});
  if(line.booking_receipt&&line.confirmation&&!line.price_review){
   const item=items.find(i=>i.id===line.confirmation.outlet_item_id);
   if(item&&Math.abs(item.net_purchase_price-line.confirmation.net_base_unit_price)>1e-10)prices.push({draft_id:draft.id,line_id:line.source.id,article_id:item.id,name:item.display_name,unit:line.confirmation.unit_abbreviation,current:item.net_purchase_price,proposed:line.confirmation.net_base_unit_price,date:draft.delivery_date,reference:draft.document_reference});
  }
 }
 return {proposals,prices};
}
export function historyCsv(history,id){
 const run=history.inventories.find(r=>r.id===id);if(!run)fail('INVENTORY_NOT_FOUND',404);
 const cell=value=>{const text=typeof value==='number'?String(value).replace('.',','):String(value??'');return '"'+(typeof value!=='number'&&/^(?:\s*[=+@\-]|[\t\r\n])/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
 const rows=[['Datum','Inventur','Status','Artikel','Kategorie','Einheit','Gezählt','Vorheriger Bestand','Differenz','Netto je Basiseinheit','Inventurwert netto','Buchung'],...run.entries.map(x=>[run.date,run.period,x.status,x.name,x.category,x.unit,x.counted_quantity,x.previous_quantity,x.counted_quantity==null?'':x.counted_quantity-x.previous_quantity,x.base_price,x.counted_quantity==null?'':x.counted_quantity*x.base_price,x.booked?'übernommen':x.status==='skipped'?'ausdrücklich übersprungen':'offen'])];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
export async function reviewPrice({e,store,user,outletId,draftId,lineId,decision,requestId,now=()=>new Date().toISOString()}){
 if(!['approve','reject'].includes(decision))fail('INVALID_PRICE_DECISION',400);
 const draft=await e.DeliveryDraft.get(draftId);
 if(!draft||draft.outlet_id!==outletId)fail('DRAFT_NOT_FOUND',404);
 const line=draft.lines.find(l=>l.source.id===lineId);
 if(!line?.booking_receipt||!line.confirmation)fail('PRICE_RECEIPT_REQUIRED');
 if(line.price_review){if(line.price_review.request_id!==requestId)fail('PRICE_ALREADY_REVIEWED');return {completed:true};}
 const item=await store.get('OutletItem',line.confirmation.outlet_item_id);
 if(!item||item.outlet_id!==outletId||item.global_item_id!==line.confirmation.global_item_id)fail('ARTICLE_LINK_CHANGED');
 // Only explicit approval can change the master. Receipt snapshots are never changed.
 return {draft,line,item,proposed:line.confirmation.net_base_unit_price,decision,requestId,userId:user.id,at:now()};
}
export async function priceReviewPlan(context,{store,requestId}){
 const {draft,line,item,proposed,decision,userId,at}=context,nodes=[];
 const addUpdate=(key,entity,row,data)=>nodes.push({key,entity,kind:'update',id:row.id,expected:Object.fromEntries(Object.keys(data).map(k=>[k,row[k]])),data});
 if(decision==='approve'){
  addUpdate('price:item','OutletItem',item,{net_purchase_price:proposed});
  const global=await store.get('GlobalItem',item.global_item_id);
  addUpdate('price:global','GlobalItem',global,{default_net_price:proposed});
  const offers=await store.find('SupplierItem',{global_item_id:item.global_item_id,supplier_id:item.supplier_id});
  for(const offer of offers.filter(o=>o.status==='approved'))addUpdate(`price:offer:${offer.id}`,'SupplierItem',offer,{net_purchase_price:proposed*offer.base_quantity_per_purchase,revision:offer.revision+1});
  nodes.push({key:'price:history',entity:'PriceHistory',kind:'create',data:{article_id:item.id,article_name:item.display_name,old_price:item.net_purchase_price,new_price:proposed,change_date:at.slice(0,10),changed_by:userId,reason:`Belegpreis ausdrücklich freigegeben · ${draft.document_reference}`,catalog_key:`${requestId}:price:history`}});
 }
 nodes.push({key:'price:review',entity:'DeliveryDraft',kind:'price-review',id:draft.id,line_id:line.source.id,outlet_id:draft.outlet_id,receipt:line.booking_receipt,confirmation:line.confirmation,data:{request_id:requestId,decision,reviewed_by:userId,reviewed_at:at,previous_base_price:item.net_purchase_price,receipt_base_price:proposed}});
 return {kind:'price-review',request_id:requestId,input_fingerprint:JSON.stringify({draft_id:draft.id,line_id:line.source.id,decision}),nodes,results:[],cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:at,articles:0};
}
