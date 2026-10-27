import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {createInventoryTestSetupHandler} from './handler.js';

// Test access is permanent by decision: every write stays in the separate test database.
export default createInventoryTestSetupHandler({createClientFromRequest,
    isEnabled:()=>true});