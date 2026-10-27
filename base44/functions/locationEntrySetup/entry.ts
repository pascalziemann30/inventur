import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createLocationSetupHandler} from './handler.js';
import {locationEntryConfig} from '../../shared/inventory/locationEntryConfig.js';
// Test access is permanent by decision: every write stays in the separate test database.
export default req=>createLocationSetupHandler({createClientFromRequest,config:locationEntryConfig(secrets),
 isEnabled:()=>true,
})(req);