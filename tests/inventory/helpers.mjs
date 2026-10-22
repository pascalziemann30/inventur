export const user = {id: 'employee', role: 'user', data: {outlet_id: 'outlet'}};
export const initialStock = () => ({id: 'stock', outlet_id: 'outlet', outlet_item_id: 'item', global_item_id: 'global', unit_abbreviation: 'l', on_hand_quantity: 10, revision: 0, booking_journal: []});
export const operation = (id = 'delivery:doc:line') => ({id, kind: 'delivery', outlet_id: 'outlet', outlet_item_id: 'item', global_item_id: 'global', unit_abbreviation: 'l', quantity: 2, source: {document_id: 'doc', line_id: 'line', net_purchase_price: 4}});

export function memoryStore(initial = initialStock()) {
    let state = structuredClone(initial);
    let writes = 0;
    const store = {
        verifiedAtomicWrites: true,
        failBefore: false,
        loseResponse: false,
        loseRecoveryRead: false,
        async get() {
            if (store.failRead) { store.failRead = false; throw new Error('read failed'); }
            return structuredClone(state);
        },
        async compareAndSwap(expected, next) {
            await Promise.resolve();
            if (store.failBefore) { store.failBefore = false; throw new Error('write failed before commit'); }
            if (state.revision !== expected.revision) return false;
            state = {...state, ...structuredClone(next)};
            writes++;
            if (store.loseResponse) {
                store.loseResponse = false;
                store.failRead = store.loseRecoveryRead;
                throw new Error('response lost after commit');
            }
            return true;
        },
        snapshot: () => structuredClone(state),
        writes: () => writes,
    };
    return store;
}
