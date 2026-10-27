// Frontend copy of base44/shared/inventory/unitConversion.js — keep identical to the backend original.
import {BookingError,scaledQuantity,quantityNumber} from './quantities.js';

// Ratios are quantities, not rounded reciprocals: 34 old pieces = 1 new pack.
export function convertUnitQuantity(value,oldQuantity,newQuantity){
 const old=scaledQuantity(oldQuantity),next=scaledQuantity(newQuantity);
 if(!old||!next)throw new BookingError('POSITIVE_CONVERSION_REQUIRED');
 const product=scaledQuantity(value)*next;
 if(product%old)throw new BookingError('UNIT_CONVERSION_PRECISION');
 return quantityNumber(product/old);
}
export function convertDefinitionUnits(definition,unit,oldQuantity,newQuantity){
 const convert=value=>convertUnitQuantity(value,oldQuantity,newQuantity);
 return {...definition,unit,factor:convert(definition.factor),
  count_units:definition.count_units.map(u=>({...u,label:u.code==='base'&&u.label===definition.unit?unit:u.label,base_quantity:u.code==='base'&&u.label===definition.unit&&Number(u.base_quantity)===1?1:convert(u.base_quantity)})),
  receipt_units:(definition.receipt_units||[]).map(u=>({...u,factor:convert(u.factor)}))};
}
const metric={kg:['weight',1000],g:['weight',1],l:['volume',1000],ml:['volume',1],cl:['volume',10]};
export function suggestedUnitRatio(from,to){
 const a=metric[from],b=metric[to];
 return a&&b&&a[0]===b[0]?{old_quantity:b[1],new_quantity:a[1]}:null;
}
export function validateUnitDimensions(from,to,oldQuantity,newQuantity){
 const a=metric[from],b=metric[to];
 if(a&&b&&(a[0]!==b[0]||scaledQuantity(oldQuantity)*BigInt(a[1])!==scaledQuantity(newQuantity)*BigInt(b[1])))throw new BookingError('UNIT_DIMENSION_MISMATCH');
}