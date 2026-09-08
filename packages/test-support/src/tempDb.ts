import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { openCompanyDb, openSystemDb, migrateCompanyDb, migrateSystemDb } from '@mhts/db-schema';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';

/**
 * Every phase 1-10 session verified its work with a throwaway `.tsx` script
 * bootstrapping a real encrypted DB and then deleting it — never committed,
 * never re-runnable (see Phase Tracker Open Questions, flagged since Phase
 * 3). This is the same bootstrap, finally persisted: a real SQLCipher-backed
 * temp file (not an in-memory mock — Rule #1's "no fake functionality"
 * applies to test fixtures too), keyed via `db-schema`'s `encryptionKey`
 * passphrase mode, which its own JSDoc says exists "for interactive/legacy
 * use... e.g. throwaway scripts" — this is exactly that use, just reused by
 * every test file instead of hand-rolled per session.
 */
export interface TempDbHandle<T> {
  db: Kysely<T>;
  dir: string;
  filePath: string;
  close(): Promise<void>;
}

const TEST_ENCRYPTION_KEY = 'vitest-temp-db-passphrase-not-for-product-use';

export async function createTempSystemDb(): Promise<TempDbHandle<SystemDatabase>> {
  const dir = mkdtempSync(join(tmpdir(), 'mhts-test-system-'));
  const filePath = join(dir, `${randomUUID()}.db`);
  const db = openSystemDb({ filePath, encryptionKey: TEST_ENCRYPTION_KEY });
  await migrateSystemDb(db);
  return {
    db,
    dir,
    filePath,
    async close() {
      await db.destroy();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function createTempCompanyDb(): Promise<TempDbHandle<CompanyDatabase>> {
  const dir = mkdtempSync(join(tmpdir(), 'mhts-test-company-'));
  const filePath = join(dir, `${randomUUID()}.db`);
  const db = openCompanyDb({ filePath, encryptionKey: TEST_ENCRYPTION_KEY });
  await migrateCompanyDb(db);
  return {
    db,
    dir,
    filePath,
    async close() {
      await db.destroy();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
