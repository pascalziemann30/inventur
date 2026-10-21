/** Ordered full-snapshot writes; the adapter must also enforce server revisions.
 * On an uncertain response retry the EXACT request ID and body before newer edits.
 */
export function createDraftQueue({save, onState = () => {}, makeId = () => crypto.randomUUID(), initialRevision = 0}) {
    let next = null;
    let failed = null;
    let running = false;
    let revision = initialRevision;
    let generation = 0;
    let acknowledged = 0;
    let error = null;
    const listeners = new Set();
    const emit = () => {
        onState({status: error ? 'error' : running || next || failed ? 'saving' : 'saved', error,
            generation, acknowledged, revision});
        for (const listener of listeners) listener();
    };
    const run = async () => {
        if (running || error) return;
        running = true;
        emit();
        try {
            while (failed || next) {
                const request = failed || {id: makeId(), revision, ...next};
                failed = request;
                // Only clear next if it is the snapshot used for this request.
                if (next?.generation === request.generation) next = null;
                emit();
                const result = await save(structuredClone(request));
                if (result?.request_id !== request.id || result?.revision !== request.revision + 1) {
                    throw new Error('Die Speicherbestätigung passt nicht zur Anfrage. Bitte erneut versuchen.');
                }
                revision = result.revision;
                acknowledged = request.generation;
                failed = null;
            }
        } catch (cause) {
            error = cause;
        } finally {
            running = false;
            emit();
        }
    };
    return {
        enqueue(snapshot) {
            next = {snapshot: structuredClone(snapshot), generation: ++generation};
            emit();
            void run();
        },
        retry() { error = null; void run(); },
        async flush() {
            // Wait for the current worker and every newer snapshot; never claim success early.
            while (running || next || failed) {
                if (error) throw error;
                await new Promise(resolve => {
                    const listener = () => { listeners.delete(listener); resolve(); };
                    listeners.add(listener);
                });
            }
            if (error) throw error;
        },
    };
}
