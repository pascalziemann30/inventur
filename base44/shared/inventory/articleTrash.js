import {BookingError} from './quantities.js';
const fail=code=>{throw new BookingError(code,409);};
export const ARTICLE_RETENTION_MS=30*24*60*60*1000;
export const isDeleted=item=>!!item.deleted_at;
export function lifecyclePlan({item,action,requestId,userId,now}){
 if(!['discard','restore'].includes(action))fail('ARTICLE_LIFECYCLE_INVALID');
 if(action==='discard'&&isDeleted(item))fail('ARTICLE_ALREADY_DELETED');
 if(action==='restore'&&(!isDeleted(item)||item.purge_started_at))fail('ARTICLE_RESTORE_UNAVAILABLE');
 if(action==='restore'&&Date.parse(item.delete_after)<=Date.parse(now))fail('ARTICLE_RETENTION_EXPIRED');
 const data=action==='discard'?{is_active:false,deleted_at:now,delete_after:new Date(Date.parse(now)+ARTICLE_RETENTION_MS).toISOString(),deleted_by:userId,deleted_was_active:item.is_active!==false,purge_started_at:''}:{is_active:item.deleted_was_active!==false,deleted_at:'',delete_after:'',deleted_by:'',deleted_was_active:false,purge_started_at:''};
 return {kind:`article-${action}`,request_id:requestId,input_fingerprint:JSON.stringify({action,id:item.id}),nodes:[{key:'article:lifecycle',entity:'OutletItem',kind:'update',id:item.id,expected:Object.fromEntries(Object.keys(data).map(key=>[key,item[key]])),data}],results:[],cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:now,articles:1};
}
export function purgePlan(items,{outletId,requestId,userId,now}){
 return {kind:'article-purge',request_id:requestId,input_fingerprint:JSON.stringify(items.map(i=>({id:i.id,deleted_at:i.deleted_at,delete_after:i.delete_after}))),nodes:items.map(item=>({key:`purge:${item.id}`,entity:'OutletItem',kind:'article-purge',id:item.id,outlet_id:outletId,deleted_at:item.deleted_at,delete_after:item.delete_after})),results:[],cursor:0,in_flight:null,status:'ready',created_by:userId,created_at:now,articles:items.length};
}
// The tombstone is removed LAST. A partial/lost response can always resume from it.
export async function purgeArticle(store,node,now){
 const find=async(entity,query)=>store.find(entity,query);
 let item=(await find('OutletItem',{id:node.id}))[0];
 if(!item)return [];
 if(item.outlet_id!==node.outlet_id||item.is_active!==false||item.deleted_at!==node.deleted_at||item.delete_after!==node.delete_after||!Number.isFinite(Date.parse(item.delete_after))||Date.parse(item.delete_after)>Date.parse(now))fail('ARTICLE_PURGE_NOT_DUE');
 if(!item.purge_started_at){
  if(!await store.cas('OutletItem',item.id,{is_active:false,deleted_at:item.deleted_at,delete_after:item.delete_after,purge_started_at:item.purge_started_at},{purge_started_at:now}))fail('ARTICLE_CHANGED_RELOAD');
  item={...item,purge_started_at:now};
 }
 const remove=async(entity,row)=>{
  if(!(await find(entity,{id:row.id})).length)return;
  try{await store.remove(entity,row.id);}catch(error){if((await find(entity,{id:row.id})).length)throw error;}
  if((await find(entity,{id:row.id})).length)fail('ARTICLE_PURGE_UNCONFIRMED');
 };
 const linked=await find('OutletItem',{global_item_id:item.global_item_id});
 const stocks=await find('OutletStock',{global_item_id:item.global_item_id});
 if(stocks.some(stock=>stock.outlet_item_id===item.id&&stock.outlet_id!==node.outlet_id))fail('STOCK_LINK_MISMATCH');
 const shared=linked.some(other=>other.id!==item.id)||stocks.some(stock=>stock.outlet_item_id!==item.id);
 // Keep a global product and its offers if another outlet still uses them.
 if(!shared){
  for(const offer of await find('SupplierItem',{global_item_id:item.global_item_id}))await remove('SupplierItem',offer);
 }
 for(const stock of await find('OutletStock',{outlet_item_id:item.id})){
  if(stock.outlet_id!==node.outlet_id)fail('STOCK_LINK_MISMATCH');
  await remove('OutletStock',stock);
 }
 if(!shared)for(const global of await find('GlobalItem',{id:item.global_item_id}))await remove('GlobalItem',global);
 await remove('OutletItem',item);
 return [];
}
