import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Root cause (see Phase Tracker Key Decisions Log, 2026-09-05): electron-vite's
 * `externalizeDepsPlugin` defaults to externalizing every dependency in this
 * package's package.json as a plain Node `require()`. That's correct for a
 * real published CJS/ESM-dual package, but breaks for two different reasons
 * here, so both need excluding (bundled instead):
 *
 *  1. Every `@mhts/*` workspace package ships raw TypeScript as its `main`
 *     (no build step of its own gets consumed by this app — see each
 *     package's package.json). A plain `require('@mhts/foo')` resolves to a
 *     .ts file Node can't execute. Discovered automatically below by reading
 *     packages/*\/package.json, so a *new* core-* package can never quietly
 *     regress this the way a hand-maintained list could.
 *  2. `kysely` (a real dependency, not a workspace package) ships ESM-only —
 *     `require()` of it throws ERR_REQUIRE_ESM. There's no reliable generic
 *     way to detect "ESM-only" from a package.json without false positives
 *     (dual CJS/ESM packages also declare "type": "module" + exports maps),
 *     so this half stays an explicit, short list — add to it if another
 *     ESM-only dependency shows the same crash.
 *
 * `better-sqlite3-multiple-ciphers` (a native addon) must NOT be in either
 * list — it has to stay a real external `require()` so Node resolves its
 * compiled .node binary from node_modules at its real path, not a bundled one.
 */
function workspacePackageNames(): string[] {
  const packagesDir = join(__dirname, '../../packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => JSON.parse(readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8')).name as string);
}

const esmOnlyDeps = ['kysely'];
const bundleInsteadOfExternalize = [...workspacePackageNames(), ...esmOnlyDeps];

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
