import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { RuleSetStatus } from '@mhts/shared-types';
import { createRuleSetVersion, resolveEffectiveRule, listRuleSetVersions } from '@mhts/core-rules-engine';
import type { ItWdvBlockRatePayload, Schedule2RatePayload } from './types';

/**
 * Depreciation rates as data, not code (CLAUDE.md Rule #2) — jurisdiction is
 * always null (these are national rates), the category lives inside the
 * rule_type string itself so each asset category gets its own independently
 * versioned rate row (a Furniture rate change never touches Computers'),
 * same reasoning as GST's per-HSN rate rows.
 */
export function schedule2RuleType(category: string): string {
  return `FIXED_ASSET.SCHEDULE2_RATE.${category}`;
}

export function itWdvBlockRuleType(category: string): string {
  return `FIXED_ASSET.IT_WDV_BLOCK_RATE.${category}`;
}

const DEFAULT_RULES_EFFECTIVE_FROM = '2025-04-01';

/** A handful of illustrative real current rates, seeded once idempotently at app bootstrap (same pattern as seedDefaultPayrollRules) — every value is a CA-verify-before-filing starting point, editable from the Manage Fixed Asset Rates screen exactly like a manually-added one. */
export async function seedDefaultFixedAssetRules(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const seeds: { ruleType: string; payload: Schedule2RatePayload | ItWdvBlockRatePayload; sourceReference: string }[] = [
    {
      ruleType: schedule2RuleType('PLANT_AND_MACHINERY_GENERAL'),
      payload: { method: 'WDV', ratePercent: 18.1 } satisfies Schedule2RatePayload,
      sourceReference: 'Companies Act Schedule II, general plant & machinery (13-year useful life, WDV) — verify current notification',
    },
    {
      ruleType: schedule2RuleType('COMPUTERS_AND_LAPTOPS'),
      payload: { method: 'SLM', ratePercent: 31.67 } satisfies Schedule2RatePayload,
      sourceReference: 'Companies Act Schedule II, computers/laptops (3-year useful life, SLM) — verify current notification',
    },
    {
      ruleType: schedule2RuleType('FURNITURE_AND_FITTINGS'),
      payload: { method: 'WDV', ratePercent: 25.89 } satisfies Schedule2RatePayload,
      sourceReference: 'Companies Act Schedule II, furniture & fittings (10-year useful life, WDV) — verify current notification',
    },
    {
      ruleType: itWdvBlockRuleType('PLANT_AND_MACHINERY_GENERAL'),
      payload: { ratePercent: 15 } satisfies ItWdvBlockRatePayload,
      sourceReference: 'Income Tax Act WDV block, general plant & machinery (15% block) — verify current notification',
    },
    {
      ruleType: itWdvBlockRuleType('COMPUTERS_AND_LAPTOPS'),
      payload: { ratePercent: 40 } satisfies ItWdvBlockRatePayload,
      sourceReference: 'Income Tax Act WDV block, computers/software (40% block) — verify current notification',
    },
    {
      ruleType: itWdvBlockRuleType('FURNITURE_AND_FITTINGS'),
      payload: { ratePercent: 10 } satisfies ItWdvBlockRatePayload,
      sourceReference: 'Income Tax Act WDV block, furniture & fittings (10% block) — verify current notification',
    },
  ];

  for (const seed of seeds) {
    const existing = await systemDb.selectFrom('rule_set').select('id').where('rule_type', '=', seed.ruleType).executeTakeFirst();
    if (existing) {
      continue;
    }
    await createRuleSetVersion(systemDb, {
      ruleType: seed.ruleType,
      jurisdiction: null,
      effectiveFrom: DEFAULT_RULES_EFFECTIVE_FROM,
      payload: seed.payload,
      sourceReference: seed.sourceReference,
      createdBy: null,
    });
  }
}

export async function resolveSchedule2Rate(systemDb: Kysely<SystemDatabase>, category: string, asOfDate: string): Promise<Schedule2RatePayload> {
  const resolved = await resolveEffectiveRule<Schedule2RatePayload>(systemDb, schedule2RuleType(category), null, asOfDate);
  if (!resolved) {
    throw new Error(`No Schedule II depreciation rate configured for "${category}" as of ${asOfDate}. Add one from Manage Fixed Asset Rates first.`);
  }
  return resolved.payload;
}

export async function resolveItWdvBlockRate(systemDb: Kysely<SystemDatabase>, category: string, asOfDate: string): Promise<ItWdvBlockRatePayload> {
  const resolved = await resolveEffectiveRule<ItWdvBlockRatePayload>(systemDb, itWdvBlockRuleType(category), null, asOfDate);
  if (!resolved) {
    throw new Error(`No IT WDV block rate configured for "${category}" as of ${asOfDate}. Add one from Manage Fixed Asset Rates first.`);
  }
  return resolved.payload;
}

export interface CreateOrUpdateFixedAssetRateInput {
  book: 'SCHEDULE2' | 'IT_WDV';
  category: string;
  effectiveFrom: string;
  payload: Schedule2RatePayload | ItWdvBlockRatePayload;
  sourceReference?: string;
}

/** The Manage Fixed Asset Rates screen's write path — supersedes the current version for (book, category) with a new dated one, same versioning discipline as every other RuleSet consumer in this codebase. */
export async function createOrUpdateFixedAssetRate(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdateFixedAssetRateInput, createdBy: string | null): Promise<string> {
  if (!input.category.trim()) {
    throw new Error('A rate category is required');
  }
  if (!input.effectiveFrom) {
    throw new Error('An effective-from date is required');
  }
  const ruleType = input.book === 'SCHEDULE2' ? schedule2RuleType(input.category) : itWdvBlockRuleType(input.category);

  return createRuleSetVersion(systemDb, {
    ruleType,
    jurisdiction: null,
    effectiveFrom: input.effectiveFrom,
    payload: input.payload,
    sourceReference: input.sourceReference ?? null,
    createdBy,
  });
}

export interface FixedAssetRateVersionSummary {
  id: string;
  ruleType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  payload: unknown;
  sourceReference: string | null;
}

/** Every FIXED_ASSET.* rule_type currently ACTIVE — the Manage Fixed Asset Rates screen's list view. */
export async function listActiveFixedAssetRates(systemDb: Kysely<SystemDatabase>): Promise<FixedAssetRateVersionSummary[]> {
  const rows = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', 'like', 'FIXED_ASSET.%')
    .where('status', '=', 'ACTIVE' satisfies RuleSetStatus)
    .orderBy('rule_type')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    ruleType: row.rule_type,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    version: row.version,
    payload: JSON.parse(row.rule_payload) as unknown,
    sourceReference: row.source_reference,
  }));
}

export async function listFixedAssetRateVersions(systemDb: Kysely<SystemDatabase>, ruleType: string): Promise<FixedAssetRateVersionSummary[]> {
  return listRuleSetVersions(systemDb, ruleType);
}
