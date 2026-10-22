import {secrets} from 'base44:runtime';
import {inventoryRequestActor} from '../../shared/inventory/locationEntry.js';
import {locationEntryConfig} from '../../shared/inventory/locationEntryConfig.js';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {createReviewDeliveryHandler} from './handler.js';

// Read-only, authenticated Test Data review. No booking switch, OCR or production writes.
export default createReviewDeliveryHandler({createClientFromRequest,resolveActor:(req,client)=>inventoryRequestActor(req,client,locationEntryConfig(secrets))});
