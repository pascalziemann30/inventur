import {base44} from '@/api/base44Client';

const messages={
    INVENTORY_TEST_ROLLOUT_DISABLED:'Der Inventur-Testzugang ist noch nicht oder nicht mehr freigegeben.',
    AUTHENTICATION_REQUIRED:'Bitte mit deinem echten App-Konto anmelden.',OUTLET_FORBIDDEN:'Dein Konto ist diesem Standort nicht zugeordnet.',
    RUN_CHANGED_RELOAD:'Ein anderer Arbeitsstand wurde gespeichert. Lade ihn neu und vergleiche deine Eingaben.',
    STOCK_CHANGED_DURING_COUNT:'Der Bestand hat sich seit Beginn der Zählung geändert. Bitte diesen Artikel erneut zählen.',
    ARTICLE_CONFIGURATION_CHANGED:'Die Artikelzuordnung wurde verändert. Bitte vom Administrator prüfen lassen.',
    NO_ARTICLES_FOR_INTERVAL:'Für diesen Zählrhythmus sind noch keine Artikel eingerichtet.',
    UNIQUE_STOCK_REQUIRED:'Die Bestandszuordnung ist unvollständig oder doppelt. Bitte vom Administrator prüfen lassen.',
    ARTICLE_REFERENCE_INCOMPLETE:'Mindestens ein Artikel hat unvollständige Verknüpfungen. Bitte vom Administrator prüfen lassen.',
    STOCK_NOT_INITIALIZED:'Ein Bestand ist noch nicht für die sichere Buchung vorbereitet.',
    INVALID_CONFIRMED_COUNT:'Eine bestätigte Zählmenge ist ungültig.',OPEN_COUNTS_REMAIN:'Bitte alle Artikel zählen oder ausdrücklich überspringen.',
    ENTRY_ALREADY_BOOKED_RETRY_FINALIZE:'Die Menge wurde bereits übernommen. Bitte den Abschluss fortsetzen, um die Bestätigung nachzuholen.',
    DUPLICATE_START_REQUIRES_REVIEW:'Der Start ist doppelt vorhanden und muss geprüft werden. Es wird kein Bestand automatisch gebucht.',
    COUNT_ALREADY_FROZEN:'Diese Zählung ist für den Abschluss bereits gesperrt.',RUN_ALREADY_FROZEN:'Der Abschluss wurde bereits begonnen. Bitte den aktuellen Stand laden.',
    BOOKING_RETRY_REQUIRED:'Die Buchung ist noch nicht bestätigt. Bitte den Abschluss fortsetzen.',
};
export const runErrorMessage=code=>messages[code] || 'Der Vorgang konnte nicht bestätigt werden. Bitte denselben Vorgang erneut versuchen.';
export async function inventoryRunApi(action,input={}) {
    try {return (await base44.functions.invoke('inventoryRuns',{action,...input})).data;}
    catch (cause) {
        const code=cause.data?.error || cause.response?.data?.error;
        throw Object.assign(new Error(runErrorMessage(code)),{code});
    }
}
