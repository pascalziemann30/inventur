import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
import {createDeliveryDraftHandler} from './handler.js';

// Reviewed goods-only receipt handoff and manual drafts share the expiring dev grant.
export default createDeliveryDraftHandler({createClientFromRequest,
    isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED')),
});
