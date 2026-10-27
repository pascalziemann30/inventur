import {scaledQuantity,monetaryNumber} from '../../../lib/inventory/quantities.js';

// Blank and explicit zero rows are not delivered. Every other input must be valid.
export function manualDeliveryLines(articles,entries,newId=()=>crypto.randomUUID()) {
    const lines=[];
    for(const article of articles) {
        const entry=entries[article.id];
        if(!entry || !String(entry.quantity ?? '').trim())continue;
        let quantity;
        try{quantity=scaledQuantity(entry.quantity);}catch{throw new Error(`Bitte eine gültige Liefermenge für „${article.name}“ eingeben.`);}
        if(quantity===0n)continue;
        const offer=article.offers.find(o=>o.id===entry.offer_id && o.available);
        if(!offer)throw new Error(`Bitte ein gültiges Gebinde für „${article.name}“ wählen.`);
        try{if(monetaryNumber(entry.price)<=0)throw new Error();}catch{throw new Error(`Bitte den Nettopreis je Gebinde für „${article.name}“ prüfen.`);}
        lines.push({id:newId(),original_name:offer.original_name,supplier_article_number:offer.supplier_article_number || '',purchase_unit_code:offer.purchase_unit_code,purchase_quantity:String(entry.quantity).trim(),net_purchase_price:String(entry.price).trim()});
    }
    if(!lines.length)throw new Error('Bitte bei mindestens einem Artikel eine Liefermenge größer als 0 eintragen.');
    if(lines.length>100)throw new Error('Bitte höchstens 100 gelieferte Artikel in einem Entwurf erfassen.');
    return lines;
}
export function initialManualEntries(articles) {
    return Object.fromEntries(articles.map(article=>{const offer=article.offers.find(o=>o.available);return [article.id,{offer_id:offer?.id || '',quantity:'',price:String(offer?.net_purchase_price ?? '')}];}));
}