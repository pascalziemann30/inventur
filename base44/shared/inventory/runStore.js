import {BookingError, scaledQuantity, quantityNumber} from './quantities.js';
import {base44StockStore} from './base44Store.js';
import {unitsFor, selectCountItems} from './counting.js';

const reject = code => {throw new BookingError(code,409);};
const canonicalUnits = units => units.map(unit=>({code:unit.code,label:unit.label,base_quantity:unit.base_quantity,whole_numbers_only:unit.whole_numbers_only === true}));
const unitIdentity = units => JSON.stringify(canonicalUnits(units).sort((a,b)=>a.code.localeCompare(b.code)));

export function base44RunStore(entities) {
    const runs=entities.InventoryRun;
    if (typeof runs.updateMany !== 'function') throw new BookingError('SDK_CONDITIONAL_UPDATE_UNAVAILABLE',503);
    const bounded = async request => {
        const records=await request;
        if (!Array.isArray(records) || records.length >= 501) reject('CATALOG_OR_RUN_LIMIT_REQUIRES_PAGING');
        return records;
    };
    return {
        verifiedAtomicWrites:true,
        stocks:base44StockStore(entities,true),
        getRun:id=>runs.get(id),
        createRun:data=>runs.create(data),
        findRuns:query=>bounded(runs.filter(query,'-created_date',501)),
        async casRun(run,next) {
            const result=await runs.updateMany({id:run.id,outlet_id:run.outlet_id,revision:run.revision},{$set:next});
            if (result?.success !== true || result.has_more !== false || ![0,1].includes(result.updated)) throw new BookingError('UNVERIFIED_RUN_UPDATE_RESULT',503);
            return result.updated === 1;
        },
        async snapshot(outletId,period) {
            const outlet=await entities.Outlet.get(outletId);
            if (!outlet || outlet.is_active !== true || outlet.type === 'AGGREGATOR') reject('OUTLET_NOT_ACTIVE');
            const [items,stocks,globals,suppliers,units,categories]=await Promise.all([
                bounded(entities.OutletItem.filter({outlet_id:outletId},'id',501)),
                bounded(entities.OutletStock.filter({outlet_id:outletId},'id',501)),
                bounded(entities.GlobalItem.list('id',501)),bounded(entities.Supplier.list('id',501)),
                bounded(entities.Unit.list('id',501)),bounded(entities.Category.list('id',501)),
            ]);
            const selected=selectCountItems(items.map(item=>({...item,article_name:item.display_name})),period);
            const entries=selected.map(item=>{
                const global=globals.find(candidate=>candidate.id === item.global_item_id);
                const stockMatches=stocks.filter(stock=>stock.outlet_item_id === item.id);
                const unit=units.find(candidate=>candidate.id === global?.unit_id);
                const category=categories.find(candidate=>candidate.id === global?.category_id);
                if (!item.id || !item.display_name || !global || !suppliers.some(supplier=>supplier.id === item.supplier_id)
                    || !unit || unit.abbreviation !== global.unit_abbreviation || !category) reject('ARTICLE_REFERENCE_INCOMPLETE');
                if (stockMatches.length !== 1) reject('UNIQUE_STOCK_REQUIRED');
                const stock=stockMatches[0];
                if (stock.global_item_id !== global.id || stock.unit_abbreviation !== global.unit_abbreviation
                    || !Number.isSafeInteger(stock.revision) || stock.revision < 0 || !Array.isArray(stock.booking_journal)) reject('STOCK_NOT_INITIALIZED');
                // Converted money values may have more than six decimals (e.g. a box price / 3 kg).
                // Quantity precision must not round or reject an approved monetary snapshot.
                if (typeof item.net_purchase_price !== 'number' || !Number.isFinite(item.net_purchase_price)
                    || item.net_purchase_price < 0 || item.net_purchase_price > 1_000_000_000) reject('APPROVED_BASE_PRICE_REQUIRED');
                const entry={article_id:item.id,article_name:item.display_name,global_item_id:global.id,
                    stock_id:stock.id,supplier_id:item.supplier_id,unit_id:global.unit_id,category_id:global.category_id,
                    category_name:category.name,unit_abbreviation:global.unit_abbreviation,
                    last_stock:quantityNumber(scaledQuantity(stock.on_hand_quantity)),stock_revision:stock.revision,
                    net_base_unit_price:item.net_purchase_price,count_units:canonicalUnits(item.count_units || [])};
                unitsFor(entry);
                return entry;
            });
            return {outlet_name:outlet.name,entries};
        },
        async assertEntry(entry,outletId) {
            const item=await entities.OutletItem.get(entry.article_id);
            const global=await entities.GlobalItem.get(entry.global_item_id);
            if (!item || item.is_active !== true || item.outlet_id !== outletId || item.global_item_id !== entry.global_item_id
                || item.supplier_id !== entry.supplier_id || !global || global.unit_abbreviation !== entry.unit_abbreviation
                || global.unit_id !== entry.unit_id || global.category_id !== entry.category_id
                || unitIdentity(item.count_units || []) !== unitIdentity(entry.count_units)) reject('ARTICLE_CONFIGURATION_CHANGED');
            const outlet=await entities.Outlet.get(outletId);
            if (!outlet || outlet.is_active !== true || outlet.type === 'AGGREGATOR') reject('OUTLET_NOT_ACTIVE');
        },
    };
}
