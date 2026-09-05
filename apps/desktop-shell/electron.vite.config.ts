import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * @mhts/* workspace packages ship raw TypeScript as their `main` (no build
 * step of their own consumed here) and `kysely` is ESM-only — both break a
 * plain Node `require()` if left external. Bundle them instead; only
 * `better-sqlite3-multiple-ciphers` (a native addon) must stay external.
 */
const bundleInsteadOfExternalize = [
  'kysely',
  '@mhts/db-schema',
  '@mhts/core-identity',
  '@mhts/core-accounting',
  '@mhts/core-gst-engine',
  '@mhts/core-inventory',
  '@mhts/core-payroll-engine',
  '@mhts/core-rules-engine',
  '@mhts/shared-types',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundleInsteadOfExternalize })],
    build: {
      rollupOptions: {
        input: { index: 'src/main/index.ts' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundleInsteadOfExternalize })],
    build: {
      rollupOptions: {
        input: { index: 'src/preload/index.ts' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
  },
});
