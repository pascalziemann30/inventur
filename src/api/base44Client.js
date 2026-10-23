import { createClient } from '@base44/sdk';
import {inventoryDataEnvironment} from '@/components/auth/adminAccess.js';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  headers: {'X-Data-Env': inventoryDataEnvironment(functionsVersion)},
  requiresAuth: false,
  appBaseUrl
});
