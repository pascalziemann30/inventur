import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Standalone, synthetic UI preview: intentionally no Base44 SDK or backend proxy.
export default defineConfig({
    plugins: [react()],
    build: {outDir: 'dist-counting', rollupOptions: {input: ['counting-preview.html','delivery-preview.html','design-preview.html']}},
});
