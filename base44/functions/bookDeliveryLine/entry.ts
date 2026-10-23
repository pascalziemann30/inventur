import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createBookDeliveryLineHandler} from './handler.js';

export default createBookDeliveryLineHandler({
    createClientFromRequest,
    isEnabled: () => secrets.get('INVENTORY_BOOKING_ENABLED') === 'verified-v1',
    now: () => new Date().toISOString(),
});
