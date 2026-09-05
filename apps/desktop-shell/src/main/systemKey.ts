import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { safeStorage } from 'electron';

/**
 * The System DB's own SQLCipher key. It can't be password-derived like a
 * Company DB's DEK (see @mhts/core-identity/keyWrap) because the System DB has
 * to be readable before anyone logs in — it's what holds the login identities.
 * Instead the raw key is generated once and protected at rest by Electron's
 * `safeStorage`, which is backed by the OS keychain (DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux) — never stored or transmitted in the
 * clear. See Phase Tracker Key Decisions Log, 2026-09-05.
 */
export function loadOrCreateSystemKey(keyFilePath: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS-level secure storage is unavailable on this machine — refusing to persist the System DB key. ' +
        'Cannot start without it (no plaintext-key fallback).',
    );
  }

  if (existsSync(keyFilePath)) {
    const encrypted = readFileSync(keyFilePath);
    const hex = safeStorage.decryptString(encrypted);
    return Buffer.from(hex, 'hex');
  }

  const key = randomBytes(32);
  const encrypted = safeStorage.encryptString(key.toString('hex'));
  mkdirSync(dirname(keyFilePath), { recursive: true });
  writeFileSync(keyFilePath, encrypted);
  return key;
}
