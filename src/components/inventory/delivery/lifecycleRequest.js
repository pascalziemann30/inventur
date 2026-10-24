export const lifecyclePendingKey='delivery_lifecycle_pending_v1';
export const isLifecycleRequest=value=>!!value && ['discard','restore'].includes(value.action)
    && typeof value.input?.id==='string' && Number.isSafeInteger(value.input.revision) && value.input.revision>=0
    && typeof value.input.request_id==='string' && /^[a-zA-Z0-9._-]{16,100}$/.test(value.input.request_id);

// A timeout is an uncertain result, never a failed deletion. Retry the persisted operation unchanged.
export async function withLifecycleDeadline(operation,{timeoutMs=15000,schedule=setTimeout,cancel=clearTimeout}={}) {
    let timer;
    try {
        return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
            timer=schedule(()=>reject(Object.assign(new Error('Die Bestätigung dauert zu lange. Das Ergebnis ist noch unklar; bitte denselben Vorgang erneut prüfen.'),{uncertain:true})),timeoutMs);
        })]);
    } finally {cancel(timer);}
}
