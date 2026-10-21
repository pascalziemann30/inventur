import {inventoryTestClient as client} from '../counting/testClient.js';

const messages={DRAFT_CHANGED_RELOAD:'Ein anderer Stand wurde gespeichert. Lade den aktuellen Stand und vergleiche deine Eingaben.',
    DELIVERY_DRAFT_TEST_DISABLED:'Das befristete Testfenster für Änderungen ist geschlossen.',TEST_DATA_ENV_REQUIRED:'Diese Funktion ist ausschließlich für Base44-Testdaten freigegeben.',
    AUTHENTICATION_REQUIRED:'Bitte mit deinem echten App-Konto anmelden.',OUTLET_FORBIDDEN:'Dein Konto ist diesem Standort nicht zugeordnet.',
    OUTLET_ASSIGNMENT_CONFLICT:'Die Standortzuordnung deines Kontos ist widersprüchlich. Bitte vom Admin prüfen lassen.',
    DOCUMENT_REFERENCE_ALREADY_EXISTS:'Diese Belegreferenz ist bereits als Entwurf vorhanden. Bitte den vorhandenen Entwurf öffnen.',
    DUPLICATE_DRAFT_REQUIRES_REVIEW:'Der Lieferentwurf ist doppelt angelegt und muss geprüft werden.',
    LINE_NOT_CONFIRMABLE:'Artikel, Gebinde, Menge oder Preis sind noch nicht eindeutig bestätigt.',
    LINE_HINTS_NOT_ACKNOWLEDGED:'Bitte sämtliche Hinweise vor der Bestätigung prüfen.',
    REVIEW_NAME_REQUIRED:'Bitte für jede Position eine Belegbezeichnung eingeben.',INVALID_REVIEW_LINE:'Bitte die Eingaben der Lieferpositionen prüfen.',
    ADMIN_REQUIRED:'Diese Entscheidung darf nur der Administrator treffen.',PROPOSAL_REVIEW_REQUIRED:'Der Artikelvorschlag wartet noch auf Adminprüfung.',
    PROPOSAL_ALREADY_PENDING:'Für diese Position liegt bereits ein offener Artikelvorschlag vor.',REQUEST_CONTENT_CHANGED:'Dieser Vorgang wurde mit anderen Eingaben bereits verwendet. Bitte den gespeicherten Stand laden.',
    INVENTORY_TEST_ROLLOUT_DISABLED:'Das befristete Testfenster ist geschlossen.',
};
export async function deliveryDraftApi(action,input={}) {
    try {return (await client.functions.invoke('deliveryDrafts',{action,...input})).data;}
    catch(cause) {
        const code=cause.data?.error || cause.response?.data?.error;
        throw Object.assign(new Error(messages[code] || 'Der Vorgang wurde nicht bestätigt. Deine Eingaben bleiben erhalten.'),
            {code,uncertain:!code || code === 'DELIVERY_DRAFT_REQUEST_UNCERTAIN_RETRY_SAME_OPERATION'});
    }
}
export async function reviewDraftLines(outlet,supplier,lines) {
    try {return (await client.functions.invoke('reviewDelivery',{outlet_id:outlet,supplier_id:supplier,lines})).data;}
    catch {throw new Error('Prüfung nicht abgeschlossen. Bitte Eingaben prüfen und erneut versuchen.');}
}
export async function prepareDeliveryFixture() {
    try {return (await client.functions.invoke('inventoryTestSetup',{action:'prepareDelivery'})).data;}
    catch {throw new Error('Testlieferung konnte nicht vorbereitet werden. Bitte Testfenster und Anmeldung prüfen.');}
}
