import Database from 'better-sqlite3-multiple-ciphers';
import { Kysely, SqliteDialect } from 'kysely';
import type { SystemDatabase } from './system/types';
import type { CompanyDatabase } from './company/types';

export interface OpenEncryptedDbOptions {
  filePath: string;
  /**
   * SQLCipher-compatible passphrase. TODO(Phase 0 — auth/licensing): decide
   * real key management (OS keychain / license-bound key derivation). This
   * spike-derived helper takes a raw passphrase for now; do not wire a
   * plaintext key into product code without that decision made first.
   */
  encryptionKey: string;
}

function openEncryptedRawDb(options: OpenEncryptedDbOptions): Database.Database {
  const db = new Database(options.filePath);
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key='${options.encryptionKey.replace(/'/g, "''")}'`);
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
