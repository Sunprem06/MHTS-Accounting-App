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

interface DefaultGstRateSeed {
  category: string;
  hsnSacCode: string;
  description: string;
  ratePercent: number;
  /** Flags a known real-world nuance (threshold, ITC-dependent scheme, etc.) this single flat rate collapses — not silently presented as exact. */
  note?: string;
}

/**
 * A broad general-purpose STARTER catalog (NOT a bundled official HSN/SAC
 * directory — India has ~21,000 HSN codes; this is ~60 common ones spanning
 * many kinds of businesses so a new company finds a reasonable default
 * instead of starting from zero) seeded once per installation, same
 * idempotent "system DB rule_set is shared across every company" caveat as
 * seedDefaultTdsRates in @mhts/core-sales-purchase. Deliberately uses
 * 4-digit HSN/SAC *headings* rather than guessing precise 8-digit sub-codes
 * — broader, lower error risk, and just as usable as a category default.
 * Every entry is fully editable/overridable via the Manage GST Rates screen
 * (createOrUpdateGstRate) exactly like a manually-added one — this is a
 * head start, never a lock-in (CLAUDE.md Rule #2: rates as data, not code).
 */
const DEFAULT_GST_RATE_SEEDS: DefaultGstRateSeed[] = [
  // Groceries & Staples
  { category: 'Groceries & Staples', hsnSacCode: '1006', description: 'Rice', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '1001', description: 'Wheat', ratePercent: 5, note: 'Loose/unbranded grain is commonly Nil-rated; this assumes packaged & branded' },
  { category: 'Groceries & Staples', hsnSacCode: '1701', description: 'Sugar', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '1512', description: 'Edible oil', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '0902', description: 'Tea', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '0901', description: 'Coffee', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '0910', description: 'Spices', ratePercent: 5 },
  { category: 'Groceries & Staples', hsnSacCode: '0401', description: 'Milk and cream, not concentrated', ratePercent: 0 },
  // Food & Bakery
  { category: 'Food & Bakery', hsnSacCode: '1905', description: 'Bakery products (bread, cakes, pastries, biscuits)', ratePercent: 18, note: 'Plain/unbranded bread is commonly Nil-rated — this assumes packaged/branded bakery goods; split into a separate code if you sell both' },
  { category: 'Food & Bakery', hsnSacCode: '1704', description: 'Sugar confectionery', ratePercent: 18 },
  { category: 'Food & Bakery', hsnSacCode: '1806', description: 'Chocolate', ratePercent: 18 },
  // Hardware & Tools
  { category: 'Hardware & Tools', hsnSacCode: '8203', description: 'Hand tools (pliers, wrenches)', ratePercent: 18 },
  { category: 'Hardware & Tools', hsnSacCode: '7318', description: 'Screws, bolts, fasteners', ratePercent: 18 },
  { category: 'Hardware & Tools', hsnSacCode: '8302', description: 'Base-metal fittings and hardware', ratePercent: 18 },
  { category: 'Hardware & Tools', hsnSacCode: '3208', description: 'Paints and varnishes', ratePercent: 18 },
  { category: 'Hardware & Tools', hsnSacCode: '2523', description: 'Cement', ratePercent: 18 },
  { category: 'Hardware & Tools', hsnSacCode: '4412', description: 'Plywood', ratePercent: 18 },
  // Electrical & Electronics
  { category: 'Electrical & Electronics', hsnSacCode: '8544', description: 'Wires and cables', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '8536', description: 'Switches, sockets, electrical fittings', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '9405', description: 'LED lighting', ratePercent: 18, note: 'Some lighting sub-categories have historically sat at a different rate — confirm the exact fitting type' },
  { category: 'Electrical & Electronics', hsnSacCode: '8414', description: 'Fans', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '8415', description: 'Air conditioners', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '8418', description: 'Refrigerators', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '8517', description: 'Mobile phones', ratePercent: 18 },
  { category: 'Electrical & Electronics', hsnSacCode: '8471', description: 'Computers and laptops', ratePercent: 18 },
  // Textiles & Apparel
  { category: 'Textiles & Apparel', hsnSacCode: '6109', description: 'Apparel (T-shirts, garments)', ratePercent: 5, note: 'The real rule is value-per-piece based (a lower rate up to a threshold, higher above it) — this assumes the lower band' },
  { category: 'Textiles & Apparel', hsnSacCode: '5208', description: 'Cotton fabric', ratePercent: 5 },
  { category: 'Textiles & Apparel', hsnSacCode: '6301', description: 'Blankets', ratePercent: 18 },
  // Furniture
  { category: 'Furniture', hsnSacCode: '9403', description: 'Furniture (wooden, metal)', ratePercent: 18 },
  // Stationery & Books
  { category: 'Stationery & Books', hsnSacCode: '4901', description: 'Printed books', ratePercent: 0 },
  { category: 'Stationery & Books', hsnSacCode: '4820', description: 'Notebooks and registers', ratePercent: 18, note: 'School stationery has at times had a relief rate — confirm current treatment' },
  { category: 'Stationery & Books', hsnSacCode: '9608', description: 'Pens', ratePercent: 18 },
  // Pharma & Healthcare
  { category: 'Pharma & Healthcare', hsnSacCode: '3004', description: 'Medicines (most)', ratePercent: 5 },
  { category: 'Pharma & Healthcare', hsnSacCode: '9018', description: 'Medical equipment and devices', ratePercent: 18, note: 'Some life-saving devices sit at a lower/Nil rate — confirm the specific device' },
  // Agriculture Inputs
  { category: 'Agriculture Inputs', hsnSacCode: '3105', description: 'Fertilizers', ratePercent: 5 },
  { category: 'Agriculture Inputs', hsnSacCode: '1209', description: 'Seeds', ratePercent: 0 },
  // Automobiles & Parts
  { category: 'Automobiles & Parts', hsnSacCode: '8703', description: 'Motor cars, standard', ratePercent: 18 },
  { category: 'Automobiles & Parts', hsnSacCode: '8708', description: 'Auto parts', ratePercent: 18 },
  { category: 'Automobiles & Parts', hsnSacCode: '8711', description: 'Two-wheelers', ratePercent: 18 },
  // Services (general)
  { category: 'Services (general)', hsnSacCode: '9954', description: 'Construction services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '9983', description: 'Professional, consulting and IT services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '998311', description: 'Management consulting services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '9971', description: 'Financial services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '9973', description: 'Rental and leasing services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '9987', description: 'Repair and maintenance services', ratePercent: 18 },
  { category: 'Services (general)', hsnSacCode: '9965', description: 'Goods transport services', ratePercent: 5, note: 'GTA services can be 5% (no ITC) or 12% (with ITC) depending on the option taken — confirm which applies' },
  // Hotel & Restaurant
  { category: 'Hotel & Restaurant', hsnSacCode: '9963', description: 'Accommodation and restaurant services', ratePercent: 5, note: 'Real rule varies by room tariff and ITC opt-in — confirm the applicable slab for this establishment' },
  // Sin / Luxury Goods
  { category: 'Sin / Luxury Goods', hsnSacCode: '2401', description: 'Unmanufactured tobacco', ratePercent: 40 },
  { category: 'Sin / Luxury Goods', hsnSacCode: '2402', description: 'Cigarettes', ratePercent: 40 },
  { category: 'Sin / Luxury Goods', hsnSacCode: '2106', description: 'Pan masala', ratePercent: 40 },
  { category: 'Sin / Luxury Goods', hsnSacCode: '2202', description: 'Aerated / carbonated beverages', ratePercent: 40 },
  // Precious Metals
  { category: 'Precious Metals', hsnSacCode: '7108', description: 'Gold', ratePercent: 3 },
  { category: 'Precious Metals', hsnSacCode: '7106', description: 'Silver', ratePercent: 3 },
  { category: 'Precious Metals', hsnSacCode: '7113', description: 'Gold/silver jewellery', ratePercent: 3 },
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
    const noteSuffix = seed.note ? ` — NOTE: ${seed.note}` : '';
    await createRuleSetVersion(systemDb, {
      ruleType,
      jurisdiction: null,
      effectiveFrom: DEFAULT_GST_RATES_EFFECTIVE_FROM,
      payload: { ratePercent: seed.ratePercent, cessPercent: 0, category: seed.category, description: seed.description } satisfies GstRatePayload,
      sourceReference: `Starter catalog entry seeded at installation${noteSuffix} — verify the correct HSN/SAC code and rate with a CA before relying on this for a real filing`,
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
    payload: { ratePercent: input.ratePercent, cessPercent, category: input.category, description: input.description } satisfies GstRatePayload,
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
      category: payload.category ?? null,
      description: payload.description ?? null,
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
      category: payload.category ?? null,
      description: payload.description ?? null,
    };
  });
}
