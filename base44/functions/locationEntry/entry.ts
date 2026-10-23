import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createLocationEntryHandler} from './handler.js';
import {serveInventoryWorkflow} from '../../shared/inventory/operationalAccess.js';

export default serveInventoryWorkflow({secrets,createClientFromRequest,createHandler:({runtime,createClientFromRequest})=>createLocationEntryHandler({
 createClientFromRequest,environment:runtime.environment,config:runtime.config,
 isEnabled:()=>runtime.enabled,
})});
