import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Per-company data encryption key (DEK) management for the SQLCipher-encrypted
 * Company DB files (CLAUDE.md Rule #3). The DEK itself is a random 32-byte key,
 * never stored in plaintext. There are two independent ways to unwrap it,
 * either sufficient on its own:
 *
 *  1. Per-user password wrap (`wrapDataKey`/`unwrapDataKey`): for each user
 *     granted access to a company (system DB's CompanyAccessTable), the DEK
 *     is wrapped (AES-256-GCM) under a key-encryption-key (KEK) derived from
 *     that user's login password via scrypt.
 *  2. Company-wide recovery-key wrap (`wrapWithRawKey`/`unwrapWithRawKey`,
 *     used with a `generateDataKey()`-shaped recovery key — see
 *     `formatRecoveryKey`/`parseRecoveryKey`): generated once at company
 *     creation, shown to the user exactly once, and never stored anywhere.
 *     It's already 256 bits of uniform random entropy, so it's used directly
 *     as the KEK — no password-stretching KDF needed (unlike a human
 *     password, brute-forcing it isn't feasible). This is the disaster
 *     recovery path if a user forgets their password (see Phase Tracker Key
 *     Decisions Log): losing both the password AND the recovery key means
 *     the company's data is unrecoverable by design (no vendor master key
 *     exists — anything that could recover it would also be exploitable by
 *     anyone with database access, defeating the point of encrypting it).
 */

const KEK_SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEK_SCRYPT_N = 16384;
const KEK_SCRYPT_R = 8;
const KEK_SCRYPT_P = 1;
const RECOVERY_KEY_BYTES = 32;

export interface WrappedKey {
  wrappedKeyHex: string;
  ivHex: string;
  authTagHex: string;
  kekSaltHex: string;
}

export interface RawWrappedKey {
  wrappedKeyHex: string;
  ivHex: string;
  authTagHex: string;
}

export function generateDataKey(): Buffer {
  return randomBytes(32);
}

/** Same shape as a DEK (32 random bytes) — kept as a distinct name for call-site clarity. */
export const generateRecoveryKey = generateDataKey;

function deriveKek(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: KEK_SCRYPT_N, r: KEK_SCRYPT_R, p: KEK_SCRYPT_P });
}

/** Wraps `dek` under `kek` directly (no KDF) — `kek` must already be a uniformly random 32-byte key. */
export function wrapWithRawKey(dek: Buffer, kek: Buffer): RawWrappedKey {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  return {
    wrappedKeyHex: wrapped.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: cipher.getAuthTag().toString('hex'),
  };
}

/** Throws if `kek` is wrong — GCM auth-tag verification fails closed. */
export function unwrapWithRawKey(wrapped: RawWrappedKey, kek: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(wrapped.ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(wrapped.authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(wrapped.wrappedKeyHex, 'hex')), decipher.final()]);
}

export function wrapDataKey(dek: Buffer, password: string): WrappedKey {
  const kekSalt = randomBytes(KEK_SALT_LENGTH);
  const kek = deriveKek(password, kekSalt);
  return { ...wrapWithRawKey(dek, kek), kekSaltHex: kekSalt.toString('hex') };
}

/** Throws if the password is wrong — GCM auth-tag verification fails closed. */
export function unwrapDataKey(wrapped: WrappedKey, password: string): Buffer {
  const kek = deriveKek(password, Buffer.from(wrapped.kekSaltHex, 'hex'));
  return unwrapWithRawKey(wrapped, kek);
}

/** Human-copyable form of a recovery key: hex, grouped for readability (e.g. "a1b2-c3d4-..."). */
export function formatRecoveryKey(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return hex.match(/.{1,4}/g)!.join('-');
}

/** Inverse of `formatRecoveryKey`. Throws if the input isn't a well-formed recovery key. */
export function parseRecoveryKey(formatted: string): Buffer {
  const hex = formatted.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== RECOVERY_KEY_BYTES * 2) {
    throw new Error('Invalid recovery key format');
  }
  return Buffer.from(hex, 'hex');
}
