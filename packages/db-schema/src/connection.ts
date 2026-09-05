import Database from 'better-sqlite3-multiple-ciphers';
import { Kysely, SqliteDialect } from 'kysely';
import type { SystemDatabase } from './system/types';
import type { CompanyDatabase } from './company/types';

export interface OpenEncryptedDbOptions {
  filePath: string;
  /**
   * Key management (2026-09-05, see Phase Tracker Key Decisions Log): the
   * System DB is keyed by a random 32-byte key held only via Electron's
   * OS-keychain-backed `safeStorage`; each Company DB is keyed by its own
   * random DEK, which is never stored in the clear — it's AES-256-GCM-wrapped
   * per user via @mhts/core-identity's keyWrap and unwrapped only after a
   * successful login. Pass the raw key as `rawKey` in both cases — SQLCipher's
   * own passphrase-KDF (`encryptionKey`) is for interactive/legacy use only
   * (e.g. throwaway scripts), not product code.
   */
  rawKey?: Buffer;
  encryptionKey?: string;
}

function openEncryptedRawDb(options: OpenEncryptedDbOptions): Database.Database {
  if (!options.rawKey && !options.encryptionKey) {
    throw new Error('openEncryptedRawDb requires either rawKey or encryptionKey');
  }
  const db = new Database(options.filePath);
  db.pragma("cipher='sqlcipher'");
  if (options.rawKey) {
    db.pragma(`key="x'${options.rawKey.toString('hex')}'"`);
  } else {
    db.pragma(`key='${options.encryptionKey!.replace(/'/g, "''")}'`);
  }
  db.pragma('foreign_keys = ON');
  return db;
}

export function openSystemDb(options: OpenEncryptedDbOptions): Kysely<SystemDatabase> {
  return new Kysely<SystemDatabase>({
    dialect: new SqliteDialect({ database: openEncryptedRawDb(options) }),
  });
}

export function openCompanyDb(options: OpenEncryptedDbOptions): Kysely<CompanyDatabase> {
  return new Kysely<CompanyDatabase>({
    dialect: new SqliteDialect({ database: openEncryptedRawDb(options) }),
  });
}
