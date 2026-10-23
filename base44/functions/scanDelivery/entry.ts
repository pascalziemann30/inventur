import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createScanDeliveryHandler} from './handler.js';
import {serveInventoryWorkflow} from '../../shared/inventory/operationalAccess.js';
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';

export default serveInventoryWorkflow({secrets,createClientFromRequest,createHandler:({runtime,createClientFromRequest})=>createScanDeliveryHandler({
 createClientFromRequest,environment:runtime.environment,resolveActor:(req,client)=>inventoryRequestActor(req,client,runtime.config),
 isEnabled:()=>runtime.enabled,
})});
