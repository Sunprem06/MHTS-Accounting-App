import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { RuleSetStatus } from '@mhts/shared-types';

/**
 * `rule_type` is a controlled vocabulary interpreted only by callers — never
 * a closed TypeScript union here — so a brand-new rule type (a new GST
 * notification, a new TDS section, a new payroll formula) never requires a
 * schema or code change in this package (CLAUDE.md Rule #2).
 */
export interface RuleSetVersionInput {
  ruleType: string;
  /** e.g. 'IN-TN'. Null = national/default, matched when no jurisdiction-specific row exists. */
  jurisdiction: string | null;
  effectiveFrom: string;
  /** JSON-serializable. Shape is owned entirely by the caller (e.g. core-sales-purchase's TDS rate shape). */
  payload: unknown;
  sourceReference: string | null;
  createdBy: string | null;
}

export interface ResolvedRule<T> {
  id: string;
  ruleType: string;
  jurisdiction: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  payload: T;
  sourceReference: string | null;
}

/**
 * Inserts a new versioned rule row and, if an earlier row for the same
 * (ruleType, jurisdiction) is still open-ended (effective_to is null), closes
 * it off the day before this one starts and marks it SUPERSEDED — so a rate
 * change is a new row, never a destructive edit of the old one (consistent
 * with the append-only philosophy used for audit_log/voucher elsewhere in
 * this codebase).
 */
export async function createRuleSetVersion(systemDb: Kysely<SystemDatabase>, input: RuleSetVersionInput): Promise<string> {
  const previous = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', '=', input.ruleType)
    .where('jurisdiction', input.jurisdiction === null ? 'is' : '=', input.jurisdiction)
    .where('effective_to', 'is', null)
    .where('status', '=', 'ACTIVE' satisfies RuleSetStatus)
    .executeTakeFirst();

  const id = randomUUID();
  const version = (previous?.version ?? 0) + 1;

  if (previous) {
    const dayBefore = new Date(input.effectiveFrom);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    await systemDb
      .updateTable('rule_set')
      .set({
        effective_to: dayBefore.toISOString().slice(0, 10),
        status: 'SUPERSEDED' satisfies RuleSetStatus,
        superseded_by_id: id,
      })
      .where('id', '=', previous.id)
      .execute();
  }

  await systemDb
    .insertInto('rule_set')
    .values({
      id,
      rule_type: input.ruleType,
      jurisdiction: input.jurisdiction,
      effective_from: input.effectiveFrom,
      effective_to: null,
      rule_payload: JSON.stringify(input.payload),
      version,
      status: 'ACTIVE' satisfies RuleSetStatus,
      source_reference: input.sourceReference,
      superseded_by_id: null,
      created_by: input.createdBy,
    })
    .execute();

  return id;
}

/**
 * Finds whichever rule_set row was in force for `ruleType` on `asOfDate` —
 * date-effective lookup, not a fixed constant (Rule #2). Prefers an exact
 * jurisdiction match over the national/default (null) row when both would
 * otherwise apply. Both ACTIVE and SUPERSEDED rows are eligible (a
 * SUPERSEDED row still correctly covers whatever historical date range it
 * was active for — e.g. resolving the rate that applied to an old invoice).
 */
export async function resolveEffectiveRule<T>(
  systemDb: Kysely<SystemDatabase>,
  ruleType: string,
  jurisdiction: string | null,
  asOfDate: string,
): Promise<ResolvedRule<T> | null> {
  const row = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', '=', ruleType)
    .where('effective_from', '<=', asOfDate)
    .where((eb) => eb.or([eb('effective_to', 'is', null), eb('effective_to', '>=', asOfDate)]))
    .where((eb) =>
      jurisdiction === null ? eb('jurisdiction', 'is', null) : eb.or([eb('jurisdiction', '=', jurisdiction), eb('jurisdiction', 'is', null)]),
    )
    .orderBy(sql`CASE WHEN jurisdiction IS NOT NULL THEN 0 ELSE 1 END`)
    .orderBy('effective_from', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ruleType: row.rule_type,
    jurisdiction: row.jurisdiction,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    version: row.version,
    payload: JSON.parse(row.rule_payload) as T,
    sourceReference: row.source_reference,
  };
}

export async function listRuleSetVersions(systemDb: Kysely<SystemDatabase>, ruleType: string): Promise<ResolvedRule<unknown>[]> {
  const rows = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', '=', ruleType)
    .orderBy('effective_from', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    ruleType: row.rule_type,
    jurisdiction: row.jurisdiction,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    version: row.version,
    payload: JSON.parse(row.rule_payload) as unknown,
    sourceReference: row.source_reference,
  }));
}
