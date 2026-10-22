const SCALE = 1_000_000n;
const MAX = 1_000_000_000n * SCALE;

export class BookingError extends Error {
    constructor(code, status = 400) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

// Quantities use six decimal places. Reject excess precision rather than rounding stock silently.
export function scaledQuantity(value) {
    if (typeof value !== 'string' && typeof value !== 'number') throw new BookingError('INVALID_QUANTITY');
    const text = String(value).trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new BookingError('INVALID_QUANTITY');
    const [whole, fraction = ''] = text.split('.');
    const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
    if (result > MAX) throw new BookingError('QUANTITY_TOO_LARGE');
    return result;
}

export function quantityNumber(scaled) {
    if (scaled < 0n || scaled > MAX) throw new BookingError('INVALID_STOCK_RESULT');
    const value = Number(scaled) / Number(SCALE);
    if (scaledQuantity(value) !== scaled) throw new BookingError('QUANTITY_REPRESENTATION_LOSS');
    return value;
}

export function toBaseQuantity(quantity, factor) {
    const factorScaled = scaledQuantity(factor);
    if (factorScaled === 0n) throw new BookingError('CONVERSION_REQUIRED');
    const product = scaledQuantity(quantity) * factorScaled;
    if (product % SCALE !== 0n) throw new BookingError('CONVERSION_PRECISION_EXCEEDED');
    return quantityNumber(product / SCALE);
}

export function addQuantity(left, right) {
    return quantityNumber(scaledQuantity(left) + scaledQuantity(right));
}

export function countCakes(wholeCakes, loosePieces, portionsPerCake) {
    if ((wholeCakes === '' || wholeCakes == null) && (loosePieces === '' || loosePieces == null)) return null;
    const whole = scaledQuantity(wholeCakes === '' || wholeCakes == null ? 0 : wholeCakes);
    const loose = scaledQuantity(loosePieces === '' || loosePieces == null ? 0 : loosePieces);
    const portions = scaledQuantity(portionsPerCake);
    if (whole % SCALE || loose % SCALE || portions % SCALE || portions === 0n) throw new BookingError('WHOLE_PIECES_REQUIRED');
    return addQuantity(toBaseQuantity(quantityNumber(whole), quantityNumber(portions)), quantityNumber(loose));
}

export function monetaryNumber(value) {
    if(typeof value!=='string' && typeof value!=='number')throw new BookingError('INVALID_PRICE');
    const text=String(value).trim().replace(',','.');
    if(!/^\d+(?:\.\d{1,16})?$/.test(text))throw new BookingError('INVALID_PRICE');
    const price=Number(text);
    if(!Number.isFinite(price) || price<0 || price>1_000_000_000)throw new BookingError('INVALID_PRICE');
    return price;
}
export function baseUnitPrice(purchasePrice, factor) {
    const price = monetaryNumber(purchasePrice);
    const quantity = quantityNumber(scaledQuantity(factor));
    if (quantity === 0) throw new BookingError('CONVERSION_REQUIRED');
    return price / quantity;
}

export function supplierItemKey(supplierId, articleNumber, purchaseUnitCode) {
    const values = [supplierId, articleNumber, purchaseUnitCode];
    if (values.some(value => typeof value !== 'string' || !value.trim())) throw new BookingError('SUPPLIER_IDENTITY_REQUIRED');
    // Do not parse SKUs as numbers, remove punctuation, or collapse variant/size tokens.
    return JSON.stringify(values.map(value => value.trim()));
}
