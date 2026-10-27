// Frontend copy of base44/shared/inventory/articleFields.js — keep identical to the backend original.
export const articleFieldLabels={name:'Artikelbezeichnung',supplier:'Lieferant',category:'Hauptkategorie',unit:'Basiseinheit',purchase_code:'Einheit auf dem Beleg',purchase_label:'Bestellgebinde'};
const trim=value=>typeof value==='string'?value.trim():value;
// Trim boundary whitespace only; keep product wording, internal spacing and unit identity intact.
export function cleanArticleText(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 const result={...input};
 for(const field of [...Object.keys(articleFieldLabels),'sku'])if(Object.hasOwn(result,field))result[field]=trim(result[field]);
 if(Array.isArray(result.count_units))result.count_units=result.count_units.map(row=>row&&typeof row==='object'?{...row,code:trim(row.code),label:trim(row.label)}:row);
 if(Array.isArray(result.receipt_units))result.receipt_units=result.receipt_units.map(row=>row&&typeof row==='object'?{...row,code:trim(row.code)}:row);
 return result;
}
export function invalidArticleField(input){return Object.keys(articleFieldLabels).find(field=>typeof input?.[field]!=='string'||!input[field].trim()||input[field].length>300);}
export function articleFieldMessage(field){const label=articleFieldLabels[field];return label?`Bitte „${label}“ ausfüllen und höchstens 300 Zeichen verwenden.`:'Bitte Artikelbezeichnung, Lieferant, Hauptkategorie, Basiseinheit und Bestellgebinde einschließlich Belegeinheit prüfen.';}