import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const sharedPrefix = 'virtual:shared-inventory/';
const sharedRoot = fileURLToPath(new URL('./base44/shared/inventory/', import.meta.url));

// The browser must not request /base44/** directly. Modules under base44/shared are
// bundled through this virtual path instead, so counting, scan and article logic stay
// a single source shared with the backend functions.
function sharedInventoryForBrowser() {
  return {
    name: 'shared-inventory-for-browser',
    enforce: 'pre',
    resolveId(source) {
      const virtual = source.startsWith(sharedPrefix)
        ? source
        : source.match(/base44\/shared\/inventory\/(.+)$/)?.[0].replace('base44/shared/inventory/', sharedPrefix);
      return virtual ? '\0' + virtual : null;
    },
    async load(id) {
      if (!id.startsWith('\0' + sharedPrefix)) return null;
      const file = sharedRoot + id.slice(('\0' + sharedPrefix).length);
      this.addWatchFile(file);
      const code = await readFile(file, 'utf8');
      return code.replace(/(from\s*['"])\.\//g, `$1${sharedPrefix}`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    sharedInventoryForBrowser(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
  ]
});