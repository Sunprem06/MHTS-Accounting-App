import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openCompanyDb, openSystemDb } from './connection';
import { migrateCompanyDb, migrateSystemDb } from './migrate';

/**
 * db-schema has no committed test-support fixture of its own (it's the
 * foundation @mhts/test-support itself is built on, so depending on that
 * package here would be circular) — this file bootstraps directly, the same
 * pattern every throwaway verification script has used since Phase 0.
 * A clean migration run on a fresh temp DB, for both System and Company
 * shapes, is the one universal precondition every other test file's
 * createTempSystemDb/createTempCompanyDb fixture silently depends on.
 */
describe('db-schema: migrateSystemDb / migrateCompanyDb', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempFilePath(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return join(dir, `${randomUUID()}.db`);
  }

  it('applies every System DB migration cleanly to a brand-new encrypted file', async () => {
    const db = openSystemDb({ filePath: tempFilePath('mhts-migrate-system-'), encryptionKey: 'test-passphrase' });
    const result = await migrateSystemDb(db);
    expect(result.error).toBeUndefined();
    expect(result.results?.every((r) => r.status === 'Success')).toBe(true);
    await db.destroy();
  });

  it('applies every Company DB migration cleanly to a brand-new encrypted file', async () => {
    const db = openCompanyDb({ filePath: tempFilePath('mhts-migrate-company-'), encryptionKey: 'test-passphrase' });
    const result = await migrateCompanyDb(db);
    expect(result.error).toBeUndefined();
    expect(result.results?.every((r) => r.status === 'Success')).toBe(true);
    await db.destroy();
  });

  it('re-running migrateCompanyDb on an already-current DB is a safe no-op (guaranteed by Kysely\'s own migration tracking — the exact property openExistingCompanyDb\'s always-migrate-on-login fix depends on)', async () => {
    const filePath = tempFilePath('mhts-migrate-company-idempotent-');
    const db = openCompanyDb({ filePath, encryptionKey: 'test-passphrase' });
    const firstRun = await migrateCompanyDb(db);
    const secondRun = await migrateCompanyDb(db);
    expect(firstRun.error).toBeUndefined();
    expect(secondRun.error).toBeUndefined();
    expect(secondRun.results ?? []).toHaveLength(0); // nothing left to apply
    await db.destroy();
  });

  it('rejects opening an encrypted file with the wrong key (fails closed rather than silently returning garbage/empty data)', async () => {
    const filePath = tempFilePath('mhts-migrate-wrongkey-');
    const dbA = openCompanyDb({ filePath, encryptionKey: 'correct-passphrase' });
    await migrateCompanyDb(dbA);
    await dbA.destroy();

    const dbB = openCompanyDb({ filePath, encryptionKey: 'wrong-passphrase' });
    await expect(dbB.selectFrom('ledger_account').selectAll().execute()).rejects.toThrow();
    await dbB.destroy();
  });
});
