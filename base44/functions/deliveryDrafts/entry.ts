// Refresh branch deployment after dashboard configuration changes; grants remain bounded at runtime.
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';
import {locationEntryConfig} from '../../shared/inventory/locationEntryConfig.js';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
import {createDeliveryDraftHandler} from './handler.js';

// Verification complete; delivery handoff remains development-only and gated.
export default createDeliveryDraftHandler({createClientFromRequest,resolveActor:(req,client)=>inventoryRequestActor(req,client,locationEntryConfig(secrets)),
    isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED')),
});
