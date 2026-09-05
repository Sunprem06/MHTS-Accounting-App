import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Per-company data encryption key (DEK) management for the SQLCipher-encrypted
 * Company DB files (CLAUDE.md Rule #3). The DEK itself is a random 32-byte key,
 * never stored in plaintext: for each user granted access to a company
 * (system DB's CompanyAccessTable), the DEK is wrapped (AES-256-GCM) under a
 * key-encryption-key (KEK) derived from that user's login password via scrypt.
 * A user can only unwrap the DEK — and therefore open that Company DB — by
 * supplying the correct password, without the DEK ever touching disk in the clear.
 */

const KEK_SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEK_SCRYPT_N = 16384;
const KEK_SCRYPT_R = 8;
const KEK_SCRYPT_P = 1;

export interface WrappedKey {
  wrappedKeyHex: string;
  ivHex: string;
  authTagHex: string;
  kekSaltHex: string;
}

export function generateDataKey(): Buffer {
  return randomBytes(32);
}

function deriveKek(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: KEK_SCRYPT_N, r: KEK_SCRYPT_R, p: KEK_SCRYPT_P });
}

export function wrapDataKey(dek: Buffer, password: string): WrappedKey {
  const kekSalt = randomBytes(KEK_SALT_LENGTH);
  const kek = deriveKek(password, kekSalt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  return {
    wrappedKeyHex: wrapped.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: cipher.getAuthTag().toString('hex'),
    kekSaltHex: kekSalt.toString('hex'),
  };
}

/** Throws if the password is wrong — GCM auth-tag verification fails closed. */
export function unwrapDataKey(wrapped: WrappedKey, password: string): Buffer {
  const kekSalt = Buffer.from(wrapped.kekSaltHex, 'hex');
  const kek = deriveKek(password, kekSalt);
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(wrapped.ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(wrapped.authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(wrapped.wrappedKeyHex, 'hex')), decipher.final()]);
}
