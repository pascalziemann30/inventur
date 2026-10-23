// Refresh branch deployment after dashboard configuration changes; grants remain bounded at runtime.
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';
import {locationEntryConfig} from '../../shared/inventory/locationEntryConfig.js';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
import {createScanDeliveryHandler} from './handler.js';
// Verification complete; scan writes remain protected by the bounded dev grant.
export default createScanDeliveryHandler({createClientFromRequest,resolveActor:(req,client)=>inventoryRequestActor(req,client,locationEntryConfig(secrets)),isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED'))});
