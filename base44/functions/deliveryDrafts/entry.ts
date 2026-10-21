import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
import {createDeliveryDraftHandler} from './handler.js';

export default createDeliveryDraftHandler({createClientFromRequest,
    isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED')),
});
