import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { RuleSetStatus } from '@mhts/shared-types';
import { createRuleSetVersion, resolveEffectiveRule, listRuleSetVersions } from '@mhts/core-rules-engine';
import type { ExchangeRatePayload, ExchangeRateVersionSummary } from './types';

/**
 * Exchange rates reuse @mhts/core-rules-engine's existing RuleSet mechanism
 * as-is (zero changes to that package) — a versioned, date-effective lookup
 * is exactly "what was the USD rate on this historical date", the same
 * mechanism GST/TDS/Payroll rates already prove (CLAUDE.md Rule #2).
 * jurisdiction is always null (a rate isn't jurisdiction-specific); the
 * currency code lives inside the rule_type string, so each currency's rate
 * history is independently versioned (a USD rate change never touches EUR's).
 */
export function fxRateRuleType(currency: string): string {
  return `FX_RATE.${currency.trim().toUpperCase()}`;
}

export async function resolveExchangeRate(systemDb: Kysely<SystemDatabase>, currency: string, asOfDate: string): Promise<number> {
  const resolved = await resolveEffectiveRule<ExchangeRatePayload>(systemDb, fxRateRuleType(currency), null, asOfDate);
  if (!resolved) {
    throw new Error(`No exchange rate configured for "${currency}" as of ${asOfDate}. Add one from Manage Exchange Rates first.`);
  }
  return resolved.payload.rateMicros;
}

const DEFAULT_RATES_EFFECTIVE_FROM = '2025-04-01';

/** A handful of illustrative starting rates, seeded once idempotently at app bootstrap (same pattern as seedDefaultFixedAssetRules/seedDefaultTdsRates) — every value is a verify-before-use starting point, editable from the Manage Exchange Rates screen exactly like a manually-added one. Real day-to-day rates move constantly; these exist only so a company isn't blocked with zero rate history on first use. */
export async function seedDefaultExchangeRates(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const seeds: { currency: string; rateMicros: number; sourceReference: string }[] = [
    { currency: 'USD', rateMicros: 83_250_000, sourceReference: 'Illustrative starting rate — verify against a live source before use' },
    { currency: 'EUR', rateMicros: 90_000_000, sourceReference: 'Illustrative starting rate — verify against a live source before use' },
    { currency: 'GBP', rateMicros: 105_000_000, sourceReference: 'Illustrative starting rate — verify against a live source before use' },
  ];

  for (const seed of seeds) {
    const existing = await systemDb.selectFrom('rule_set').select('id').where('rule_type', '=', fxRateRuleType(seed.currency)).executeTakeFirst();
    if (existing) {
      continue;
    }
    await createRuleSetVersion(systemDb, {
      ruleType: fxRateRuleType(seed.currency),
      jurisdiction: null,
      effectiveFrom: DEFAULT_RATES_EFFECTIVE_FROM,
      payload: { rateMicros: seed.rateMicros } satisfies ExchangeRatePayload,
      sourceReference: seed.sourceReference,
      createdBy: null,
    });
  }
}

export interface SetExchangeRateInput {
  currency: string;
  effectiveFrom: string;
  rateMicros: number;
  sourceReference?: string;
}

/** The Manage Exchange Rates screen's write path — supersedes the current version for this currency with a new dated one, same versioning discipline as every other RuleSet consumer. */
export async function setExchangeRate(systemDb: Kysely<SystemDatabase>, input: SetExchangeRateInput, createdBy: string | null): Promise<string> {
  if (!input.currency.trim()) {
    throw new Error('A currency code is required');
  }
  if (!input.effectiveFrom) {
    throw new Error('An effective-from date is required');
  }
  if (!Number.isInteger(input.rateMicros) || input.rateMicros <= 0) {
    throw new Error('Rate must be a positive whole number of micros');
  }

  return createRuleSetVersion(systemDb, {
    ruleType: fxRateRuleType(input.currency),
    jurisdiction: null,
    effectiveFrom: input.effectiveFrom,
    payload: { rateMicros: input.rateMicros } satisfies ExchangeRatePayload,
    sourceReference: input.sourceReference ?? null,
    createdBy,
  });
}

/** Every FX_RATE.* rule_type currently ACTIVE — the Manage Exchange Rates screen's list view. */
export async function listActiveExchangeRates(systemDb: Kysely<SystemDatabase>): Promise<ExchangeRateVersionSummary[]> {
  const rows = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', 'like', 'FX_RATE.%')
    .where('status', '=', 'ACTIVE' satisfies RuleSetStatus)
    .orderBy('rule_type')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    currency: row.rule_type.replace('FX_RATE.', ''),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    version: row.version,
    rateMicros: (JSON.parse(row.rule_payload) as ExchangeRatePayload).rateMicros,
    sourceReference: row.source_reference,
  }));
}

export async function listExchangeRateVersions(systemDb: Kysely<SystemDatabase>, currency: string): Promise<ExchangeRateVersionSummary[]> {
  const rows = await listRuleSetVersions(systemDb, fxRateRuleType(currency));
  return rows.map((row) => ({
    id: row.id,
    currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    version: row.version,
    rateMicros: (row.payload as ExchangeRatePayload).rateMicros,
    sourceReference: row.sourceReference,
  }));
}
