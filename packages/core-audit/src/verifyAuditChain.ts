import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface AuditChainVerificationResult {
  valid: boolean;
  rowsChecked: number;
  /** Set only when `valid` is false — the id of the first row where the chain breaks. */
  brokenAtId?: number;
  reason?: string;
}

/**
 * Walks the entire audit_log table in insertion order and recomputes each
 * row's hash from its own payload + the previous row's hash, exactly as
 * `writeAuditLog` originally computed it — the tamper-DETECTION half of
 * Rule #5 (the DB triggers in company/migrations/001_init.ts are the
 * tamper-PREVENTION half, blocking UPDATE/DELETE on this table, but nothing
 * before this function actually re-checked the chain a bad actor with direct
 * file access could still try to defeat via a crafted INSERT). Read-only —
 * does not mutate the log.
 */
export async function verifyAuditChain(companyDb: Kysely<CompanyDatabase>): Promise<AuditChainVerificationResult> {
  const rows = await companyDb.selectFrom('audit_log').selectAll().orderBy('id', 'asc').execute();

  let expectedPrevHash: string | null = null;
  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        rowsChecked: rows.length,
        brokenAtId: row.id,
        reason: `Row ${row.id} records prev_hash "${row.prev_hash}" but the actual previous row's hash is "${expectedPrevHash}"`,
      };
    }

    const payload: string = JSON.stringify({
      actor_user_id: row.actor_user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      before_data: row.before_data,
      after_data: row.after_data,
      timestamp: row.timestamp,
      prev_hash: row.prev_hash,
    });
    const expectedHash: string = createHash('sha256').update(payload).digest('hex');

    if (row.hash !== expectedHash) {
      return {
        valid: false,
        rowsChecked: rows.length,
        brokenAtId: row.id,
        reason: `Row ${row.id}'s stored hash does not match its recomputed payload hash — the row's contents were altered after being written`,
      };
    }

    expectedPrevHash = row.hash;
  }

  return { valid: true, rowsChecked: rows.length };
}
