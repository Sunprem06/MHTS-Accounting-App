import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { createRuleSetVersion, resolveEffectiveRule } from '@mhts/core-rules-engine';
import { TDS_SECTIONS } from './types';
import type { TdsRatePayload, TdsSectionCode } from './types';

function ruleTypeFor(section: TdsSectionCode): string {
  return `TDS_RATE_${section}`;
}

/**
 * Simplified defaults, seeded once per installation (system DB rule_set is
 * shared across every company — see @mhts/db-schema's system/types.ts
 * comment — so this must NOT be re-seeded at every company creation, only
 * once, idempotently, at app bootstrap). Each section in reality has more
 * nuance (194C: 1% individual/HUF vs 2% others; 194I: 2% for plant/machinery
 * vs 10% for land/building; 194Q eligibility gated on the buyer's prior-year
 * turnover) collapsed here to one representative rate — a CA review is
 * required before relying on this for a real filing (CLAUDE.md's compliance
 * disclaimer), and the whole point of storing it as a rule_set row rather
 * than a JS constant is that a correction is a new dated version, not a code
 * change (Rule #2).
 */
const DEFAULT_TDS_RATES: Record<TdsSectionCode, TdsRatePayload> = {
  '194C': { ratePercent: 2, thresholdAmount: 10_000_000 }, // Rs 1,00,000 aggregate/FY = 10,000,000 paise
  '194J': { ratePercent: 10, thresholdAmount: 3_000_000 }, // Rs 30,000/FY = 3,000,000 paise
  '194Q': { ratePercent: 0.1, thresholdAmount: 500_000_000 }, // Rs 50,00,000 aggregate/FY = 500,000,000 paise
  '194I': { ratePercent: 10, thresholdAmount: 24_000_000 }, // Rs 2,40,000/FY = 24,000,000 paise
};

const DEFAULT_TDS_RATES_EFFECTIVE_FROM = '2025-04-01';

export async function seedDefaultTdsRates(systemDb: Kysely<SystemDatabase>): Promise<void> {
  for (const section of TDS_SECTIONS) {
    const ruleType = ruleTypeFor(section.code);
    const existing = await systemDb.selectFrom('rule_set').select('id').where('rule_type', '=', ruleType).executeTakeFirst();
    if (existing) {
      continue;
    }
    await createRuleSetVersion(systemDb, {
      ruleType,
      jurisdiction: null,
      effectiveFrom: DEFAULT_TDS_RATES_EFFECTIVE_FROM,
      payload: DEFAULT_TDS_RATES[section.code],
      sourceReference: 'Simplified default seeded at installation — verify with a CA before relying on this for a real filing',
      createdBy: null,
    });
  }
}

export async function resolveTdsRate(systemDb: Kysely<SystemDatabase>, section: TdsSectionCode, asOfDate: string): Promise<TdsRatePayload | null> {
  const resolved = await resolveEffectiveRule<TdsRatePayload>(systemDb, ruleTypeFor(section), null, asOfDate);
  return resolved?.payload ?? null;
}

/**
 * Threshold-aware TDS computation: sections like 194C/194Q only bite once a
 * party's cumulative taxable purchases in the financial year cross the
 * threshold, and even then only on the amount ABOVE it — not the whole
 * invoice. Handles all three cases: still under threshold (0), the invoice
 * that crosses it (partial), and every invoice after (the full rate).
 */
export function computeTdsAmount(priorCumulativeTaxable: number, thisInvoiceTaxable: number, thresholdAmount: number, ratePercent: number): number {
  const totalAfterThisInvoice = priorCumulativeTaxable + thisInvoiceTaxable;
  const excessOverThreshold = Math.max(0, totalAfterThisInvoice - thresholdAmount);
  const taxableForTds = Math.min(thisInvoiceTaxable, excessOverThreshold);
  return Math.round((taxableForTds * ratePercent) / 100);
}

/** Sum of taxable value (amount, excluding tax) across this party's prior purchase invoices under this TDS section, within the given financial year — the "prior cumulative" input to computeTdsAmount. */
export async function cumulativeTaxableThisFinancialYear(
  companyDb: Kysely<CompanyDatabase> | Transaction<CompanyDatabase>,
  partyId: string,
  section: TdsSectionCode,
  financialYear: string,
): Promise<number> {
  const row = await companyDb
    .selectFrom('purchase_invoice')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .innerJoin('purchase_invoice_line', 'purchase_invoice_line.purchase_invoice_id', 'purchase_invoice.id')
    .select(({ fn }) => fn.sum<number>('purchase_invoice_line.amount').as('total'))
    .where('purchase_invoice.party_id', '=', partyId)
    .where('purchase_invoice.tds_section', '=', section)
    .where('voucher.financial_year', '=', financialYear)
    .executeTakeFirst();
  return Number(row?.total ?? 0);
}
