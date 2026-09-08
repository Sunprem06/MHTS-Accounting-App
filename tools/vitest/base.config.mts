import { defineConfig } from 'vitest/config';

/**
 * Shared by every packages/<name>/vitest.config.mts. Node environment (this
 * is server-side business logic, never DOM), no globals (tests import
 * describe/it/expect explicitly — same "no implicit magic" discipline as the
 * rest of this codebase), and a generous timeout because several test files
 * open a real SQLCipher-encrypted temp DB via @mhts/test-support (scrypt key
 * derivation + migrations take real wall-clock time, unlike a mocked DB).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    include: ['src/**/*.test.ts'],
    watch: false,
  },
});
