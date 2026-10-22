import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createStorageProbeHandler} from './handler.js';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';

export default createStorageProbeHandler({
    createClientFromRequest,
    isAllowed: () => isStorageProbeAllowed(secrets.get('INVENTORY_STORAGE_PROBE_ALLOWED')),
});
