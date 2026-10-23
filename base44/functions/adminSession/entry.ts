import {createClientFromRequest} from 'npm:@base44/sdk@0.8.57';
import {secrets} from 'base44:runtime';
import {serveInventoryWorkflow} from '../../shared/inventory/operationalAccess.js';
import {createAdminSessionHandler} from './handler.js';
export default serveInventoryWorkflow({secrets,createClientFromRequest,createHandler:({runtime,createClientFromRequest})=>createAdminSessionHandler({createClientFromRequest,config:runtime.config})});
