import {addQuantity, scaledQuantity, toBaseQuantity} from './quantities.js';

export function unitsFor(entry) {
    const units = entry.count_units || [];
    if (!units.length || new Set(units.map(unit => unit.code)).size !== units.length) {
        throw new Error('Zähleinheiten fehlen oder sind doppelt hinterlegt.');
    }
    for (const unit of units) {
        if (!unit.code || !unit.label || scaledQuantity(unit.base_quantity) === 0n) {
            throw new Error('Die Gebindeumrechnung ist unvollständig.');
        }
    }
    return units;
}

export function evaluateCount(entry, values) {
    try {
        const units = unitsFor(entry);
        if (Object.keys(values).some(code => !units.some(unit => unit.code === code))) {
            throw new Error('Die eingegebene Einheit gehört nicht zu diesem Artikel.');
        }
        let quantity = 0;
        let hasValue = false;
        for (const unit of units) {
            const raw = values[unit.code];
            if (raw === undefined || raw === null || String(raw).trim() === '') continue;
            hasValue = true;
            const scaled = scaledQuantity(raw);
            if (unit.whole_numbers_only && scaled % 1_000_000n !== 0n) {
                throw new Error(`Bitte bei „${unit.label}“ ganze Zahlen eingeben.`);
            }
            quantity = addQuantity(quantity, toBaseQuantity(raw, unit.base_quantity));
        }
        return {quantity: hasValue ? quantity : null, error: null};
    } catch (error) {
        return {quantity: null, error: error.code
            ? 'Bitte eine gültige Menge ab 0 mit höchstens sechs Nachkommastellen eingeben.'
            : error.message};
    }
}

export function resolveEntry(entry, action, values = {}) {
    if (action === 'skip') return {...entry, status: 'skipped', values: {}, counted_quantity: null};
    if (action === 'reopen') return {...entry, status: 'open', counted_quantity: null};
    if (action !== 'count') throw new Error('Unbekannte Zählaktion.');
    const result = evaluateCount(entry, values);
    if (result.error || result.quantity === null) throw new Error(result.error || 'Bitte eine Menge oder ausdrücklich 0 eingeben.');
    return {...entry, status: 'counted', values: {...values}, counted_quantity: result.quantity};
}

export function countProgress(entries) {
    const counted = entries.filter(entry => entry.status === 'counted' && Number.isFinite(entry.counted_quantity) && entry.counted_quantity >= 0).length;
    const skipped = entries.filter(entry => entry.status === 'skipped').length;
    const open = entries.length - counted - skipped;
    return {counted, skipped, open, total: entries.length, canComplete: entries.length > 0 && open === 0};
}

export function selectCountItems(items, period = 'monthly') {
    if (!['weekly', 'monthly', 'yearly', 'adhoc'].includes(period)) throw new Error('Ungültiger Zählrhythmus.');
    return items.filter(item => !item.deleted_at && item.is_active !== false && (period === 'adhoc' || item.inventory_intervals?.includes(period)))
        .sort((left, right) => left.article_name.localeCompare(right.article_name, 'de'));
}
