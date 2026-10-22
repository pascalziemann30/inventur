import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
import {createScanDeliveryHandler} from './handler.js';
// Private original access survives the closed test-write window.
export default createScanDeliveryHandler({createClientFromRequest,isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED'))});
