import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { RuleSetStatus } from '@mhts/shared-types';
import { createRuleSetVersion, resolveEffectiveRule, listRuleSetVersions } from '@mhts/core-rules-engine';
import type { CreateOrUpdateGstRateInput, GstRatePayload, GstRateSummary, GstRateVersion } from './types';

const GST_RATE_RULE_TYPE_PREFIX = 'GST_RATE_';

function ruleTypeFor(hsnSacCode: string): string {
  return `${GST_RATE_RULE_TYPE_PREFIX}${hsnSacCode}`;
}

function hsnSacCodeFromRuleType(ruleType: string): string {
  return ruleType.slice(GST_RATE_RULE_TYPE_PREFIX.length);
}

/**
 * A handful of illustrative example rates (NOT a bundled HSN/SAC directory —
 * India has ~21,000 HSN codes, out of scope for this pass) seeded once per
 * installation, same idempotent "system DB rule_set is shared across every
 * company" caveat as seedDefaultTdsRates in @mhts/core-sales-purchase. Real
 * businesses add their own codes via the Manage GST Rates screen
 * (createOrUpdateGstRate) as items/services are onboarded — this is the
 * *mechanism*, per CLAUDE.md Rule #2, not a data migration.
 */
const DEFAULT_GST_RATE_SEEDS: Array<{ hsnSacCode: string; description: string; ratePercent: number }> = [
  { hsnSacCode: '0401', description: 'Milk and cream, not concentrated — illustrative nil-rated example', ratePercent: 0 },
  { hsnSacCode: '1006', description: 'Rice — illustrative 5% example', ratePercent: 5 },
  { hsnSacCode: '998311', description: 'Management consulting services — illustrative 18% example', ratePercent: 18 },
  { hsnSacCode: '2401', description: 'Unmanufactured tobacco — illustrative 40% example', ratePercent: 40 },
  { hsnSacCode: '7108', description: 'Gold — illustrative 3% special-rate example', ratePercent: 3 },
];

/** GST 2.0 reform date — the current 0%/5%/18%/40% (3% gold/silver) slab structure took effect this day. */
const DEFAULT_GST_RATES_EFFECTIVE_FROM = '2025-09-22';

export async function seedDefaultGstRates(systemDb: Kysely<SystemDatabase>): Promise<void> {
  for (const seed of DEFAULT_GST_RATE_SEEDS) {
    const ruleType = ruleTypeFor(seed.hsnSacCode);
    const existing = await systemDb.selectFrom('rule_set').select('id').where('rule_type', '=', ruleType).executeTakeFirst();
    if (existing) {
      continue;
    }
    await createRuleSetVersion(systemDb, {
      ruleType,
      jurisdiction: null,
      effectiveFrom: DEFAULT_GST_RATES_EFFECTIVE_FROM,
      payload: { ratePercent: seed.ratePercent, cessPercent: 0 } satisfies GstRatePayload,
      sourceReference: `Illustrative example seeded at installation (${seed.description}) — verify the correct HSN/SAC code and rate with a CA before relying on this for a real filing`,
      createdBy: null,
    });
  }
}

/** Resolves the GST rate in force for an HSN/SAC code on a given date — never a hardcoded constant (CLAUDE.md Rule #2). Throws (rather than silently defaulting to 0%) when nothing is configured, so a missing rate is surfaced to the user, not swallowed into an incorrect tax-free posting. */
export async function resolveGstRate(systemDb: Kysely<SystemDatabase>, hsnSacCode: string, asOfDate: string): Promise<GstRatePayload> {
  const resolved = await resolveEffectiveRule<GstRatePayload>(systemDb, ruleTypeFor(hsnSacCode), null, asOfDate);
  if (!resolved) {
    throw new Error(`No GST rate configured for HSN/SAC code "${hsnSacCode}" as of ${asOfDate}. Add one from Manage GST Rates first.`);
  }
  return resolved.payload;
}

/** The admin-facing entry point (Manage GST Rates screen): supersedes the current rate for this code with a new dated version — never edits a past rate in place, so historical invoices keep resolving to whatever rate actually applied on their own date (createRuleSetVersion's own versioning discipline, shared with vendor TDS). */
export async function createOrUpdateGstRate(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdateGstRateInput, createdBy: string | null): Promise<string> {
  const hsnSacCode = input.hsnSacCode.trim();
  if (!hsnSacCode) {
    throw new Error('HSN/SAC code is required');
  }
  if (!Number.isFinite(input.ratePercent) || input.ratePercent < 0) {
    throw new Error('Rate must be a non-negative number');
  }
  const cessPercent = input.cessPercent ?? 0;
  if (!Number.isFinite(cessPercent) || cessPercent < 0) {
    throw new Error('Cess rate must be a non-negative number');
  }
  if (!input.effectiveFrom) {
    throw new Error('An effective-from date is required');
  }

  return createRuleSetVersion(systemDb, {
    ruleType: ruleTypeFor(hsnSacCode),
    jurisdiction: null,
    effectiveFrom: input.effectiveFrom,
    payload: { ratePercent: input.ratePercent, cessPercent } satisfies GstRatePayload,
    sourceReference: input.sourceReference ?? null,
    createdBy,
  });
}

/** Full effective-dated version history for one HSN/SAC code — the Manage GST Rates screen's history view. */
export async function listGstRates(systemDb: Kysely<SystemDatabase>, hsnSacCode: string): Promise<GstRateVersion[]> {
  const rows = await listRuleSetVersions(systemDb, ruleTypeFor(hsnSacCode));
  return rows.map((row) => {
    const payload = row.payload as GstRatePayload;
    return {
      id: row.id,
      hsnSacCode,
      ratePercent: payload.ratePercent,
      cessPercent: payload.cessPercent,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      version: row.version,
      sourceReference: row.sourceReference,
    };
  });
}

/** Every HSN/SAC code with a currently-active rate — the Manage GST Rates screen's list view (as opposed to one code's own version history). */
export async function listActiveGstRates(systemDb: Kysely<SystemDatabase>): Promise<GstRateSummary[]> {
  const rows = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', 'like', `${GST_RATE_RULE_TYPE_PREFIX}%`)
    .where('status', '=', 'ACTIVE' satisfies RuleSetStatus)
    .orderBy('rule_type')
    .execute();

  return rows.map((row) => {
    const payload = JSON.parse(row.rule_payload) as GstRatePayload;
    return {
      hsnSacCode: hsnSacCodeFromRuleType(row.rule_type),
      ratePercent: payload.ratePercent,
      cessPercent: payload.cessPercent,
      effectiveFrom: row.effective_from,
      sourceReference: row.source_reference,
    };
  });
}
