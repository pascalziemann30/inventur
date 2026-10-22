import {BookingError} from './quantities.js';
export const receiptPolicy={version:'inventory-receipt-v2',delivery_fees:'exclude',supplier_transport:'exclude',overall_discounts:'ignore_for_inventory'};
export const dispositions=['goods','exclude_transport','exclude_delivery_fee','exclude_overall_discount'];
export function proposedDisposition(kind){return {supplier_transport:'exclude_transport',delivery_fee:'exclude_delivery_fee',overall_discount:'exclude_overall_discount'}[kind] || 'goods';}
export function pageCoverage(reads){
    const declared=Math.max(...reads.map(read=>read.declared_pages || read.pages || 1));
    const pageSets=reads.map(read=>read.page_numbers || Array.from({length:read.pages},(_,i)=>i+1));
    const verified=pageSets.length?pageSets[0].filter(page=>pageSets.every(pages=>pages.includes(page))):[];
    return {declared_pages:declared,provided_pages:verified,missing_pages:Array.from({length:declared},(_,i)=>i+1).filter(page=>!verified.includes(page))};
}
export function assertCoverageReview(reads,review){
    const coverage=pageCoverage(reads);
    if(coverage.missing_pages.length && review.missing_pages_no_goods_checked!==true)throw new BookingError('SCAN_MISSING_PAGES_REVIEW_REQUIRED',400);
    return {...coverage,missing_pages_no_goods_checked:coverage.missing_pages.length?true:false};
}
export function reviewedRows(rows,originals,fields){
    if(!Array.isArray(rows) || rows.length<originals.length || rows.length>100 || new Set(rows.map(row=>row.id)).size!==rows.length
        || originals.some(row=>!rows.some(next=>next.id===row.id))
        || rows.some(row=>!row || row.checked!==true || typeof row.id!=='string' || !row.id || row.id.length>100
            || !fields.every(field=>typeof row[field]==='string' && row[field].length<=(field==='original_name'?300:100)) || !row.original_name.trim()
            || !dispositions.includes(row.disposition || 'goods')))throw new BookingError('SCAN_HUMAN_REVIEW_REQUIRED',400);
    const all=rows.map(row=>({id:row.id,...Object.fromEntries(fields.map(field=>[field,row[field]])),disposition:row.disposition || 'goods',checked:true}));
    const goods=all.filter(row=>row.disposition==='goods').map(({disposition,checked,...source})=>source);
    if(!goods.length)throw new BookingError('SCAN_NO_GOODS',400);
    return {all,goods,excluded:all.filter(row=>row.disposition!=='goods')};
}
