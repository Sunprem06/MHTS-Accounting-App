import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { RuleSetStatus } from '@mhts/shared-types';
import { createRuleSetVersion, resolveEffectiveRule, listRuleSetVersions } from '@mhts/core-rules-engine';
import type {
  CreateOrUpdatePayrollRuleInput,
  EsiRulePayload,
  GratuityEligibilityPayload,
  PfRulePayload,
  PtRulePayload,
  TdsSlabNewRegimePayload,
  WageDefinitionCapPayload,
} from './types';

/** The six statutory rule types this module resolves via the shared RuleSet mechanism — Blueprint §3.2's "component -> wage-classification -> statutory-base mapping", built once, exactly like the GST engine (see @mhts/core-rules-engine/ruleSet.ts). PT is jurisdiction-keyed (state code); the rest are national. */
export const PAYROLL_RULE_TYPES = {
  WAGE_DEFINITION_CAP: 'PAYROLL.WAGE_DEFINITION_CAP',
  PF: 'PAYROLL.PF',
  ESI: 'PAYROLL.ESI',
  PT: 'PAYROLL.PT',
  GRATUITY_ELIGIBILITY: 'PAYROLL.GRATUITY_ELIGIBILITY',
  TDS_SLAB_NEW_REGIME: 'PAYROLL.TDS_SLAB_NEW_REGIME',
} as const;

const DEFAULT_RULES_EFFECTIVE_FROM = '2025-11-21'; // Labour Codes' effective date — see CLAUDE.md compliance notes.

/**
 * Simplified defaults, seeded once per installation (system DB rule_set is
 * shared across every company — see @mhts/db-schema's system/types.ts
 * comment — so this must NOT be re-seeded at company creation, only once,
 * idempotently, at app bootstrap, same pattern as seedDefaultTdsRates and
 * seedDefaultGstRates). PT has no default — it's genuinely state-specific
 * (some states have none at all), so an unconfigured jurisdiction correctly
 * resolves to zero PT rather than an invented default. Every value here is a
 * CA-verify-before-filing simplified starting point, editable from the
 * Manage Payroll Rules screen exactly like a manually-added one.
 */
export async function seedDefaultPayrollRules(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const seeds: { ruleType: string; payload: unknown; sourceReference: string }[] = [
    {
      ruleType: PAYROLL_RULE_TYPES.WAGE_DEFINITION_CAP,
      payload: { allowanceCapPctOfTotalPay: 50 } satisfies WageDefinitionCapPayload,
      sourceReference: 'Nov-2025 Labour Codes unified wages definition — verify with a CA before relying on this for a real filing',
    },
    {
      ruleType: PAYROLL_RULE_TYPES.PF,
      payload: { employeeRatePercent: 12, employerRatePercent: 12, wageCeiling: 1_500_000, applicabilityMinEmployees: 20 } satisfies PfRulePayload,
      sourceReference: 'EPF Act simplified default (Rs 15,000/month wage ceiling, 20-employee applicability) — verify current notification',
    },
    {
      ruleType: PAYROLL_RULE_TYPES.ESI,
      payload: { employeeRatePercent: 0.75, employerRatePercent: 3.25, wageCeiling: 2_100_000, applicabilityMinEmployees: 10 } satisfies EsiRulePayload,
      sourceReference: 'ESI Act simplified default (Rs 21,000/month gross ceiling, 10-employee applicability) — verify current notification',
    },
    {
      ruleType: PAYROLL_RULE_TYPES.GRATUITY_ELIGIBILITY,
      payload: { minYearsPermanent: 5, minYearsFixedTerm: 1, applicabilityMinEmployees: 10 } satisfies GratuityEligibilityPayload,
      sourceReference: 'Payment of Gratuity Act + Nov-2025 Labour Code fixed-term provision — verify current notification',
    },
    {
      ruleType: PAYROLL_RULE_TYPES.TDS_SLAB_NEW_REGIME,
      payload: {
        standardDeduction: 7_500_000, // Rs 75,000/year
        rebateThreshold: 120_000_000, // Rs 12,00,000/year net taxable income — Section 87A rebate (FY 2025-26)
        slabs: [
          { aboveAnnualIncome: 0, ratePercent: 0 }, // Rs 0
          { aboveAnnualIncome: 40_000_000, ratePercent: 5 }, // Rs 4,00,000
          { aboveAnnualIncome: 80_000_000, ratePercent: 10 }, // Rs 8,00,000
          { aboveAnnualIncome: 120_000_000, ratePercent: 15 }, // Rs 12,00,000
          { aboveAnnualIncome: 160_000_000, ratePercent: 20 }, // Rs 16,00,000
          { aboveAnnualIncome: 200_000_000, ratePercent: 25 }, // Rs 20,00,000
          { aboveAnnualIncome: 240_000_000, ratePercent: 30 }, // Rs 24,00,000
        ],
        cessPercent: 4,
      } satisfies TdsSlabNewRegimePayload,
      sourceReference: 'New-regime slabs, FY 2025-26 — old regime is manual-entry-only (see salaryTds.ts); verify with a CA before relying on this for a real filing',
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

export async function resolveWageDefinitionCap(systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<WageDefinitionCapPayload> {
  const resolved = await resolveEffectiveRule<WageDefinitionCapPayload>(systemDb, PAYROLL_RULE_TYPES.WAGE_DEFINITION_CAP, null, asOfDate);
  if (!resolved) {
    throw new Error(`No wage-definition-cap rule configured as of ${asOfDate}. Add one from Manage Payroll Rules first.`);
  }
  return resolved.payload;
}

export async function resolvePfRule(systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<PfRulePayload> {
  const resolved = await resolveEffectiveRule<PfRulePayload>(systemDb, PAYROLL_RULE_TYPES.PF, null, asOfDate);
  if (!resolved) {
    throw new Error(`No PF rule configured as of ${asOfDate}. Add one from Manage Payroll Rules first.`);
  }
  return resolved.payload;
}

export async function resolveEsiRule(systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<EsiRulePayload> {
  const resolved = await resolveEffectiveRule<EsiRulePayload>(systemDb, PAYROLL_RULE_TYPES.ESI, null, asOfDate);
  if (!resolved) {
    throw new Error(`No ESI rule configured as of ${asOfDate}. Add one from Manage Payroll Rules first.`);
  }
  return resolved.payload;
}

/** No default — a state with no configured slab correctly resolves to zero PT rather than an invented rate. */
export async function resolvePtRule(systemDb: Kysely<SystemDatabase>, jurisdiction: string | null, asOfDate: string): Promise<PtRulePayload | null> {
  if (!jurisdiction) {
    return null;
  }
  const resolved = await resolveEffectiveRule<PtRulePayload>(systemDb, PAYROLL_RULE_TYPES.PT, jurisdiction, asOfDate);
  return resolved?.payload ?? null;
}

export async function resolveGratuityEligibilityRule(systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<GratuityEligibilityPayload> {
  const resolved = await resolveEffectiveRule<GratuityEligibilityPayload>(systemDb, PAYROLL_RULE_TYPES.GRATUITY_ELIGIBILITY, null, asOfDate);
  if (!resolved) {
    throw new Error(`No gratuity eligibility rule configured as of ${asOfDate}. Add one from Manage Payroll Rules first.`);
  }
  return resolved.payload;
}

export async function resolveTdsSlabNewRegime(systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<TdsSlabNewRegimePayload> {
  const resolved = await resolveEffectiveRule<TdsSlabNewRegimePayload>(systemDb, PAYROLL_RULE_TYPES.TDS_SLAB_NEW_REGIME, null, asOfDate);
  if (!resolved) {
    throw new Error(`No new-regime TDS slab configured as of ${asOfDate}. Add one from Manage Payroll Rules first.`);
  }
  return resolved.payload;
}

/** The Manage Payroll Rules screen's write path — supersedes the current version for (ruleType, jurisdiction) with a new dated one, same versioning discipline as GST's createOrUpdateGstRate/vendor TDS's rate rows. */
export async function createOrUpdatePayrollRule(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdatePayrollRuleInput, createdBy: string | null): Promise<string> {
  const ruleType = input.ruleType.trim();
  if (!Object.values(PAYROLL_RULE_TYPES).includes(ruleType as (typeof PAYROLL_RULE_TYPES)[keyof typeof PAYROLL_RULE_TYPES])) {
    throw new Error(`Unknown payroll rule type: ${ruleType}`);
  }
  if (ruleType === PAYROLL_RULE_TYPES.PT && !input.jurisdiction) {
    throw new Error('Professional Tax rules must specify a state jurisdiction');
  }
  if (!input.effectiveFrom) {
    throw new Error('An effective-from date is required');
  }

  return createRuleSetVersion(systemDb, {
    ruleType,
    jurisdiction: ruleType === PAYROLL_RULE_TYPES.PT ? (input.jurisdiction ?? null) : null,
    effectiveFrom: input.effectiveFrom,
    payload: input.payload,
    sourceReference: input.sourceReference ?? null,
    createdBy,
  });
}

export interface PayrollRuleVersionSummary {
  id: string;
  ruleType: string;
  jurisdiction: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  payload: unknown;
  sourceReference: string | null;
}

export async function listPayrollRuleVersions(systemDb: Kysely<SystemDatabase>, ruleType: string): Promise<PayrollRuleVersionSummary[]> {
  const rows = await listRuleSetVersions(systemDb, ruleType);
  return rows;
}

/** Every payroll rule_type/jurisdiction pair with a currently-active version — the Manage Payroll Rules screen's list view. */
export async function listActivePayrollRules(systemDb: Kysely<SystemDatabase>): Promise<PayrollRuleVersionSummary[]> {
  const rows = await systemDb
    .selectFrom('rule_set')
    .selectAll()
    .where('rule_type', 'like', 'PAYROLL.%')
    .where('status', '=', 'ACTIVE' satisfies RuleSetStatus)
    .orderBy('rule_type')
    .orderBy('jurisdiction')
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
