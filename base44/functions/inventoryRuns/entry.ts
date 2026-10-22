import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createInventoryRunsHandler} from './handler.js';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';

export default createInventoryRunsHandler({
    createClientFromRequest,
    isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED')),
});
