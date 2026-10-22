import {BookingError} from './quantities.js';

// One pre-existing outlet is the atomic anchor; never create competing registry documents.
export async function claimDeliveryReference({store,outletId,supplierId,reference,draftId,now=()=>new Date().toISOString()}) {
    if (!reference) throw new BookingError('BOOKING_REFERENCE_REQUIRED',400);
    const key=JSON.stringify([supplierId,reference]);
    for(let attempt=0;attempt<8;attempt++) {
        const outlet=await store.get(outletId);
        if (!outlet || outlet.is_active!==true || outlet.type==='AGGREGATOR') throw new BookingError('OUTLET_NOT_ACTIVE',409);
        if (!Number.isSafeInteger(outlet.delivery_registry_revision) || outlet.delivery_registry_revision<0 || !Array.isArray(outlet.delivery_registry)) throw new BookingError('DELIVERY_REGISTRY_NOT_INITIALIZED',409);
        const matches=outlet.delivery_registry.filter(row=>row.key===key);
        if(matches.length>1)throw new BookingError('DELIVERY_REGISTRY_DUPLICATE',409);
        if(matches.length){if(matches[0].draft_id!==draftId)throw new BookingError('DOCUMENT_ALREADY_CLAIMED',409);return;}
        if(outlet.delivery_registry.length>=1000 || outlet.delivery_registry_revision===Number.MAX_SAFE_INTEGER)throw new BookingError('DELIVERY_REGISTRY_ARCHIVE_REQUIRED',409);
        const next={delivery_registry_revision:outlet.delivery_registry_revision+1,delivery_registry:[...outlet.delivery_registry,{key,draft_id:draftId,claimed_at:now()}]};
        try {if(await store.cas(outlet,next))return;}
        catch(error){
            const observed=await store.get(outletId),prior=observed?.delivery_registry?.filter(row=>row.key===key);
            if(prior?.length===1 && prior[0].draft_id===draftId)return;
            throw error;
        }
    }
    throw new BookingError('DELIVERY_REGISTRY_RETRY',409);
}
