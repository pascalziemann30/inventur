import {createClientFromRequest} from 'npm:@base44/sdk@0.8.56';
import {secrets} from 'base44:runtime';
import {createStorageProbeHandler} from './handler.js';

export default createStorageProbeHandler({
    createClientFromRequest,
    isAllowed: () => secrets.get('INVENTORY_STORAGE_PROBE_ALLOWED') === 'test-only',
});
