import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createLocationSetupHandler} from './handler.js';
import {locationEntryConfig} from '../../shared/inventory/locationEntryConfig.js';
import {isStorageProbeAllowed} from '../../shared/inventory/storageProbeGate.js';
export default req=>createLocationSetupHandler({createClientFromRequest,config:locationEntryConfig(secrets),
 isEnabled:()=>isStorageProbeAllowed(secrets.get('INVENTORY_SESSION_TEST_ALLOWED')),
})(req);
