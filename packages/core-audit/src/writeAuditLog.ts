import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { AuditAction } from '@mhts/shared-types';

export interface AuditLogEntry {
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
}

/**
 * The only way audit_log rows should ever be written (CLAUDE.md Rule #5).
 * Computes the tamper-evidence hash chain here, in application code, not the
 * DB — the DB only enforces append-only via its BEFORE UPDATE/DELETE
 * triggers (see company/migrations/001_init.ts). Callers should pass a
 * transaction (`trx`) so the audit row commits atomically with the business
 * change it's recording (Rule #4) — e.g. core-accounting's createVoucher.
 *
 * The timestamp is generated here and inserted explicitly (not left to the
 * column's CURRENT_TIMESTAMP default) because it has to be part of the
 * hashed payload — we can't hash a value the DB hasn't decided yet.
 */
export async function writeAuditLog(companyDb: Kysely<CompanyDatabase>, entry: AuditLogEntry): Promise<void> {
  const previous = await companyDb
    .selectFrom('audit_log')
    .select('hash')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();
  const prevHash = previous?.hash ?? null;

  const timestamp = new Date().toISOString();
  const beforeData = entry.beforeData === undefined ? null : JSON.stringify(entry.beforeData);
  const afterData = entry.afterData === undefined ? null : JSON.stringify(entry.afterData);

  const payload = JSON.stringify({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    before_data: beforeData,
    after_data: afterData,
    timestamp,
    prev_hash: prevHash,
  });
  const hash = createHash('sha256').update(payload).digest('hex');

  await companyDb
    .insertInto('audit_log')
    .values({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      before_data: beforeData,
      after_data: afterData,
      timestamp,
      prev_hash: prevHash,
      hash,
    })
    .execute();
}
