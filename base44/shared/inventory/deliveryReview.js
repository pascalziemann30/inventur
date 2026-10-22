import {BookingError, scaledQuantity, toBaseQuantity, baseUnitPrice} from './quantities.js';

// Search normalization is deliberately NOT an identity key. Numbers and variant words survive.
export const searchName = value => String(value || '').normalize('NFKC').toLocaleLowerCase('de')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = value => typeof value === 'string' ? value.trim() : '';
const validMoney = value => {
    try {return scaledQuantity(value) > 0n;} catch {return false;}
};

// Conservative spelling/abbreviation help for suggestions only. Never an identity or approval.
function nearWord(a,b){
    if(a===b)return true;
    if(!/^[a-zäöüß]+$/i.test(a+b) || Math.min(a.length,b.length)<4)return false;
    if(a.startsWith(b) || b.startsWith(a))return true;
    if(Math.min(a.length,b.length)<5 || Math.abs(a.length-b.length)>1)return false;
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=next;}
    return previous[b.length]<=1;
}
function suggestionScore(left, right) {
    const a = new Set(searchName(left).split(' ').filter(Boolean));
    const b = new Set(searchName(right).split(' ').filter(Boolean));
    if (!a.size || !b.size) return 0;
    const remaining=[...b];let common=0;
    for(const token of a){const index=remaining.findIndex(other=>nearWord(token,other));if(index!==-1){common++;remaining.splice(index,1);}}
    return common / Math.max(a.size, b.size);
}

function linkedCandidate(offer, catalog, outletId, supplierId) {
    const global = catalog.globals.find(item => item.id === offer.global_item_id);
    const items = catalog.items.filter(item => item.global_item_id === offer.global_item_id
        && item.outlet_id === outletId && item.is_active === true);
    const problems = [];
    if (offer.status !== 'approved') problems.push('OFFER_NOT_APPROVED');
    if (offer.identity_conflict === true) problems.push('DUPLICATE_SUPPLIER_IDENTITY');
    if (!global) problems.push('GLOBAL_ITEM_MISSING');
    if (items.length !== 1) problems.push('UNIQUE_OUTLET_ITEM_REQUIRED');
    const item = items.length === 1 ? items[0] : null;
    if (item && item.supplier_id !== supplierId) problems.push('ARTICLE_SUPPLIER_LINK_MISMATCH');
    if (!global?.unit_abbreviation || global.unit_abbreviation !== offer.unit_abbreviation) problems.push('BASE_UNIT_MISMATCH');
    if (!Number.isSafeInteger(offer.revision) || offer.revision < 0) problems.push('OFFER_REVISION_REQUIRED');
    try {if (scaledQuantity(offer.base_quantity_per_purchase) === 0n) throw new Error();}
    catch {problems.push('CONVERSION_REQUIRED');}
    return {
        supplier_item_id:offer.id, outlet_item_id:item?.id || null, global_item_id:offer.global_item_id,
        name:item?.display_name || global?.canonical_name || offer.original_name,
        original_name:offer.original_name, supplier_article_number:offer.supplier_article_number,
        purchase_unit_code:offer.purchase_unit_code, purchase_unit_label:offer.purchase_unit_label,
        base_quantity_per_purchase:problems.includes('CONVERSION_REQUIRED') ? null : offer.base_quantity_per_purchase,
        unit_abbreviation:offer.unit_abbreviation, offer_revision:offer.revision,
        problems,
    };
}

/** Read-only diagnosis. Even an exact match is NOT a confirmed or bookable DeliveryLine. */
export function reviewDeliveryLines({lines, catalog, outletId, supplierId}) {
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) throw new BookingError('DELIVERY_REVIEW_LINE_LIMIT');
    if (!catalog || !['offers','items','globals'].every(key => Array.isArray(catalog[key]))) throw new BookingError('INVALID_REVIEW_CATALOG',503);
    const allowed = ['id','original_name','supplier_article_number','purchase_unit_code','purchase_quantity','net_purchase_price'];
    const ids = new Set();
    for (const line of lines) {
        if (!line || typeof line !== 'object' || Array.isArray(line) || Object.keys(line).some(key => !allowed.includes(key))) throw new BookingError('INVALID_REVIEW_LINE');
        if (!text(line.id) || line.id !== text(line.id) || line.id.length > 100 || ids.has(line.id)) throw new BookingError('UNIQUE_REVIEW_LINE_ID_REQUIRED');
        ids.add(line.id);
        if (!text(line.original_name) || line.original_name.length > 300) throw new BookingError('REVIEW_NAME_REQUIRED');
        for (const field of ['supplier_article_number','purchase_unit_code']) {
            if (line[field] != null && (typeof line[field] !== 'string' || line[field].length > 100)) throw new BookingError('INVALID_REVIEW_IDENTITY');
        }
    }
    const offers = catalog.offers.filter(offer => offer.supplier_id === supplierId);
    const fingerprints = new Map();
    for (const line of lines) {
        const sku = text(line.supplier_article_number);
        const key = JSON.stringify([sku ? 'sku' : 'name',sku || searchName(line.original_name),text(line.purchase_unit_code)]);
        fingerprints.set(key,[...(fingerprints.get(key) || []),line.id]);
    }
    const results = lines.map(line => {
        const sku = text(line.supplier_article_number), pack = text(line.purchase_unit_code);
        const exact = sku && pack ? offers.filter(offer => offer.supplier_article_number === sku && offer.purchase_unit_code === pack) : [];
        const sameSku = sku ? offers.filter(offer => offer.supplier_article_number === sku) : [];
        const suggestions = offers.map(offer => ({offer,score:suggestionScore(line.original_name,offer.original_name)}))
            .filter(({score}) => score >= .3).sort((a,b) => b.score-a.score || a.offer.id.localeCompare(b.offer.id));
        const candidates = exact.length ? exact : sameSku.length ? sameSku : suggestions.map(entry => entry.offer);
        const projected = candidates.slice(0,5).map(offer => linkedCandidate(offer,catalog,outletId,supplierId));
        const candidate = exact.length === 1 ? projected[0] : null;
        const issues = [];
        if (!sku) issues.push('SUPPLIER_NUMBER_MISSING');
        if (!pack) issues.push('PURCHASE_UNIT_MISSING');
        if (exact.length > 1) issues.push('DUPLICATE_SUPPLIER_IDENTITY');
        if (candidate) issues.push(...candidate.problems);
        const duplicateKey = JSON.stringify([sku ? 'sku' : 'name',sku || searchName(line.original_name),pack]);
        const duplicateLines = fingerprints.get(duplicateKey).filter(id => id !== line.id);
        if (duplicateLines.length) issues.push('POSSIBLE_REPEATED_LINE');
        let baseQuantity = null, netBasePrice = null;
        try {
            if (scaledQuantity(line.purchase_quantity) === 0n) throw new Error();
            if (candidate && !candidate.problems.length) baseQuantity = toBaseQuantity(line.purchase_quantity,candidate.base_quantity_per_purchase);
        } catch {issues.push('POSITIVE_PURCHASE_QUANTITY_REQUIRED');}
        if (!validMoney(line.net_purchase_price)) issues.push('POSITIVE_RECEIPT_PRICE_REQUIRED');
        else if (candidate && !candidate.problems.length) netBasePrice = baseUnitPrice(line.net_purchase_price,candidate.base_quantity_per_purchase);
        if (candidate && !candidate.problems.length) {
            const offer = exact[0];
            // A different description can mean an OCR error or an incorrect supplier number.
            if (searchName(line.original_name) !== searchName(offer.original_name)) issues.push('DESCRIPTION_CHECK_REQUIRED');
            if (validMoney(line.net_purchase_price) && offer.net_purchase_price !== Number(String(line.net_purchase_price).replace(',','.'))) issues.push('RECEIPT_PRICE_DIFFERS');
        }
        const match = exact.length > 1 ? 'ambiguous' : candidate?.problems.length ? 'invalid'
            : candidate ? 'matched' : candidates.length ? 'needs_assignment' : 'unknown';
        return {line_id:line.id,original_name:line.original_name,match,issues,
            candidates:projected,candidate_count:candidates.length,candidates_truncated:candidates.length > 5,
            duplicate_line_ids:duplicateLines,base_quantity:baseQuantity,net_base_unit_price:netBasePrice,
            proposal_required:match === 'unknown',requires_confirmation:true,bookable:false};
    });
    return {mode:'review_only',lines:results,summary:{total:results.length,
        matched:results.filter(line => line.match === 'matched').length,
        unresolved:results.filter(line => line.match !== 'matched').length,
        repeated:results.filter(line => line.duplicate_line_ids.length).length},
    writes_performed:false};
}
