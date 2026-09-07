import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearDateBounds, createVoucherInTransaction } from '@mhts/core-accounting';
import { computeItWdvBlockDepreciation, computeSchedule2Depreciation, daysBetweenInclusive } from './depreciationMath';
import { resolveItWdvBlockRate, resolveSchedule2Rate } from './rules';
import { getFixedAssetLedgerIds } from './ledgers';

export interface AssetDepreciationPreviewLine {
  assetId: string;
  assetClassId: string;
  assetName: string;
  assetCode: string;
  schedule2OpeningWdvPaise: number;
  schedule2DepreciationPaise: number;
  schedule2ClosingWdvPaise: number;
  itWdvOpeningWdvPaise: number;
  itWdvDepreciationPaise: number;
  itWdvClosingWdvPaise: number;
}

async function computeAssetDepreciation(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  asset: { id: string; asset_class_id: string; name: string; asset_code: string; purchase_date: string; purchase_cost_paise: number; salvage_value_paise: number },
  assetClassByAssetClassId: Map<string, { schedule2_rate_category: string; it_wdv_block_category: string }>,
  financialYear: string,
  fromDate: string,
  toDate: string,
): Promise<AssetDepreciationPreviewLine> {
  const assetClass = assetClassByAssetClassId.get(asset.asset_class_id);
  if (!assetClass) {
    throw new Error(`Asset "${asset.name}" references a missing asset class`);
  }

  const priorEntries = await companyDb
    .selectFrom('asset_depreciation_entry')
    .selectAll()
    .where('asset_id', '=', asset.id)
    .where('financial_year', '<', financialYear)
    .orderBy('financial_year', 'desc')
    .execute();

  const priorSchedule2 = priorEntries.find((e) => e.book === 'SCHEDULE2');
  const priorItWdv = priorEntries.find((e) => e.book === 'IT_WDV');

  const daysInFy = daysBetweenInclusive(fromDate, toDate);
  const effectiveFrom = asset.purchase_date > fromDate ? asset.purchase_date : fromDate;
  const isFirstYear = !priorSchedule2;
  const schedule2DaysInService = isFirstYear ? Math.max(0, daysBetweenInclusive(effectiveFrom, toDate)) : daysInFy;

  const schedule2Rate = await resolveSchedule2Rate(systemDb, assetClass.schedule2_rate_category, toDate);
  const schedule2OpeningWdv = priorSchedule2?.closing_wdv_paise ?? asset.purchase_cost_paise;
  const schedule2 = computeSchedule2Depreciation({
    method: schedule2Rate.method,
    purchaseCostPaise: asset.purchase_cost_paise,
    salvageValuePaise: asset.salvage_value_paise,
    openingWdvPaise: schedule2OpeningWdv,
    ratePercent: schedule2Rate.ratePercent,
    daysInService: schedule2DaysInService,
    daysInFinancialYear: daysInFy,
  });

  const itWdvRate = await resolveItWdvBlockRate(systemDb, assetClass.it_wdv_block_category, toDate);
  const itWdvOpeningWdv = priorItWdv?.closing_wdv_paise ?? asset.purchase_cost_paise;
  const isFirstYearUsedLessThan180Days = !priorItWdv && daysBetweenInclusive(effectiveFrom, toDate) < 180;
  const itWdv = computeItWdvBlockDepreciation({
    openingWdvPaise: itWdvOpeningWdv,
    ratePercent: itWdvRate.ratePercent,
    isFirstYearUsedLessThan180Days,
  });

  return {
    assetId: asset.id,
    assetClassId: asset.asset_class_id,
    assetName: asset.name,
    assetCode: asset.asset_code,
    schedule2OpeningWdvPaise: schedule2OpeningWdv,
    schedule2DepreciationPaise: schedule2.depreciationPaise,
    schedule2ClosingWdvPaise: schedule2.closingWdvPaise,
    itWdvOpeningWdvPaise: itWdvOpeningWdv,
    itWdvDepreciationPaise: itWdv.depreciationPaise,
    itWdvClosingWdvPaise: itWdv.closingWdvPaise,
  };
}

/**
 * Read-only: computes what a depreciation run for this financial year would
 * post, for every ACTIVE asset that doesn't already have a SCHEDULE2 entry
 * for this FY (already-processed assets are silently skipped, making a
 * partial re-run safe). Disposed assets are excluded — a disposed asset's
 * accumulated depreciation is finalized at disposal time instead (see
 * disposal.ts), not by this run.
 */
export async function previewDepreciationRun(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  financialYear: string,
  financialYearStartMonth: number,
): Promise<AssetDepreciationPreviewLine[]> {
  const { fromDate, toDate } = computeFinancialYearDateBounds(financialYearStartMonth, financialYear);

  const assets = await companyDb.selectFrom('fixed_asset').selectAll().where('status', '=', 'ACTIVE').where('purchase_date', '<=', toDate).execute();
  const alreadyProcessed = await companyDb.selectFrom('asset_depreciation_entry').select('asset_id').where('book', '=', 'SCHEDULE2').where('financial_year', '=', financialYear).execute();
  const alreadyProcessedIds = new Set(alreadyProcessed.map((r) => r.asset_id));

  const classes = await companyDb.selectFrom('asset_class').selectAll().execute();
  const classById = new Map(classes.map((c) => [c.id, c]));

  const results: AssetDepreciationPreviewLine[] = [];
  for (const asset of assets) {
    if (alreadyProcessedIds.has(asset.id)) {
      continue;
    }
    results.push(await computeAssetDepreciation(companyDb, systemDb, asset, classById, financialYear, fromDate, toDate));
  }
  return results;
}

/**
 * Posts the depreciation run: re-runs previewDepreciationRun for
 * correctness (never trusts a stale UI-held preview), then — for every
 * asset class with at least one asset in the preview — posts ONE
 * DEPRECIATION voucher (Dr the shared Depreciation expense ledger, Cr that
 * class's accumulated-depreciation ledger for the SCHEDULE2 total only) and
 * writes asset_depreciation_entry rows for BOTH books per asset. IT_WDV
 * entries never get a voucher_id — memo-only, per the Blueprint's "two
 * independent depreciation calculations, not one shared field" requirement.
 * The whole run is one atomic transaction (CLAUDE.md Rule #4): every class's
 * voucher posts, or none do.
 */
export async function postDepreciationRun(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  financialYear: string,
  financialYearStartMonth: number,
  actorUserId: string | null,
): Promise<{ voucherIds: string[] }> {
  const preview = await previewDepreciationRun(companyDb, systemDb, financialYear, financialYearStartMonth);
  if (preview.length === 0) {
    return { voucherIds: [] };
  }

  const { toDate } = computeFinancialYearDateBounds(financialYearStartMonth, financialYear);
  const ledgerIds = await getFixedAssetLedgerIds(companyDb);

  const byClass = new Map<string, AssetDepreciationPreviewLine[]>();
  for (const line of preview) {
    const list = byClass.get(line.assetClassId) ?? [];
    list.push(line);
    byClass.set(line.assetClassId, list);
  }

  return companyDb.transaction().execute(async (trx) => {
    const voucherIds: string[] = [];

    for (const [assetClassId, lines] of byClass) {
      const assetClass = await trx.selectFrom('asset_class').selectAll().where('id', '=', assetClassId).executeTakeFirst();
      if (!assetClass) {
        throw new Error('Asset class not found mid-run');
      }
      const classTotal = lines.reduce((sum, l) => sum + l.schedule2DepreciationPaise, 0);

      let voucherId: string | null = null;
      if (classTotal > 0) {
        const posted = await createVoucherInTransaction(
          trx,
          {
            voucherType: 'DEPRECIATION',
            financialYear,
            voucherDate: toDate,
            narration: `Depreciation for ${assetClass.name} — FY ${financialYear}`,
            lines: [
              { ledgerId: ledgerIds.depreciationExpenseLedgerId, debitAmount: classTotal, creditAmount: 0 },
              { ledgerId: assetClass.accumulated_depreciation_ledger_id, debitAmount: 0, creditAmount: classTotal },
            ],
          },
          actorUserId,
        );
        voucherId = posted.voucherId;
        voucherIds.push(voucherId);
      }

      for (const line of lines) {
        if (line.schedule2DepreciationPaise > 0) {
          await trx
            .insertInto('asset_depreciation_entry')
            .values({
              id: randomUUID(),
              asset_id: line.assetId,
              book: 'SCHEDULE2',
              financial_year: financialYear,
              opening_wdv_paise: line.schedule2OpeningWdvPaise,
              depreciation_amount_paise: line.schedule2DepreciationPaise,
              closing_wdv_paise: line.schedule2ClosingWdvPaise,
              voucher_id: voucherId,
            })
            .execute();
        }
        if (line.itWdvDepreciationPaise > 0) {
          await trx
            .insertInto('asset_depreciation_entry')
            .values({
              id: randomUUID(),
              asset_id: line.assetId,
              book: 'IT_WDV',
              financial_year: financialYear,
              opening_wdv_paise: line.itWdvOpeningWdvPaise,
              depreciation_amount_paise: line.itWdvDepreciationPaise,
              closing_wdv_paise: line.itWdvClosingWdvPaise,
              voucher_id: null,
            })
            .execute();
        }
      }
    }

    return { voucherIds };
  });
}
