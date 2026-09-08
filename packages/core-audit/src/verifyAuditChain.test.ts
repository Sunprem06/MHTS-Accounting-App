import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { writeAuditLog } from './writeAuditLog';
import { verifyAuditChain } from './verifyAuditChain';

/**
 * The hash chain is Rule #5's tamper-EVIDENCE mechanism — the DB triggers
 * (company/migrations/001_init.ts) are the tamper-PREVENTION half, blocking
 * UPDATE/DELETE, but nothing previously verified the chain itself. This is
 * that missing verification, and its own regression test.
 */
describe('core-audit: verifyAuditChain', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
  });

  afterEach(async () => {
    await handle.close();
  });

  it('an empty audit log is trivially valid', async () => {
    const result = await verifyAuditChain(companyDb);
    expect(result.valid).toBe(true);
    expect(result.rowsChecked).toBe(0);
  });

  it('a chain of real writeAuditLog entries verifies as valid', async () => {
    await writeAuditLog(companyDb, { actorUserId: null, action: 'CREATE', entityType: 'Test', entityId: '1', afterData: { x: 1 } });
    await writeAuditLog(companyDb, { actorUserId: null, action: 'UPDATE', entityType: 'Test', entityId: '1', beforeData: { x: 1 }, afterData: { x: 2 } });
    await writeAuditLog(companyDb, { actorUserId: null, action: 'CREATE', entityType: 'Test', entityId: '2', afterData: { y: 1 } });

    const result = await verifyAuditChain(companyDb);
    expect(result.valid).toBe(true);
    expect(result.rowsChecked).toBe(3);
  });

  it('the DB triggers block a direct UPDATE against audit_log (Rule #5\'s prevention half, re-confirmed here since detection depends on prevention holding)', async () => {
    await writeAuditLog(companyDb, { actorUserId: null, action: 'CREATE', entityType: 'Test', entityId: '1', afterData: { x: 1 } });
    await expect(companyDb.updateTable('audit_log').set({ after_data: '{"x":999}' }).where('entity_id', '=', '1').execute()).rejects.toThrow();
  });

  it('detects a row whose stored hash does not match its own payload — the residual gap prevention alone does not cover: nothing stops a crafted INSERT with a fabricated hash', async () => {
    await writeAuditLog(companyDb, { actorUserId: null, action: 'CREATE', entityType: 'Test', entityId: '1', afterData: { x: 1 } });
    const first = await companyDb.selectFrom('audit_log').selectAll().orderBy('id', 'desc').limit(1).executeTakeFirstOrThrow();

    // Insert a second row directly (bypassing writeAuditLog) with a correct
    // prev_hash but a hash that does not actually match its own payload —
    // exactly what a crafted INSERT forging history would look like.
    await companyDb
      .insertInto('audit_log')
      .values({
        actor_user_id: null,
        action: 'CREATE',
        entity_type: 'Test',
        entity_id: '2',
        before_data: null,
        after_data: '{"x":2}',
        timestamp: new Date().toISOString(),
        prev_hash: first.hash,
        hash: 'fabricated-hash-that-does-not-match-the-payload',
      })
      .execute();

    const result = await verifyAuditChain(companyDb);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not match/);
  });

  it('detects a broken prev_hash chain (a row inserted with the wrong prev_hash)', async () => {
    await writeAuditLog(companyDb, { actorUserId: null, action: 'CREATE', entityType: 'Test', entityId: '1', afterData: { x: 1 } });

    // Insert a second row directly (bypassing writeAuditLog) with a deliberately wrong prev_hash — the append-only
    // triggers only block UPDATE/DELETE, not a malformed INSERT, which is exactly the residual gap this function exists to catch.
    await companyDb
      .insertInto('audit_log')
      .values({
        actor_user_id: null,
        action: 'CREATE',
        entity_type: 'Test',
        entity_id: '2',
        before_data: null,
        after_data: null,
        timestamp: new Date().toISOString(),
        prev_hash: 'deliberately-wrong-hash',
        hash: 'irrelevant-because-prev-hash-is-checked-first',
      })
      .execute();

    const result = await verifyAuditChain(companyDb);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBeDefined();
    expect(result.reason).toMatch(/prev_hash/);
  });
});
