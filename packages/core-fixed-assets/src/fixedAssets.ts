import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { AcquireFixedAssetInput, AssetDepreciationEntrySummary, AssetStatus, FixedAssetSummary } from './types';

/** Creates the fixed_asset register row and posts the ASSET_ACQUISITION voucher (Dr the class's gross-block ledger, Cr the paid-from ledger) atomically — CLAUDE.md Rule #4. */
export async function acquireFixedAsset(companyDb: Kysely<CompanyDatabase>, input: AcquireFixedAssetInput, actorUserId: string | null): Promise<string> {
  if (!input.name.trim() || !input.assetCode.trim()) {
    throw new Error('Asset name and asset code are required');
  }
  if (!Number.isInteger(input.purchaseCostPaise) || input.purchaseCostPaise <= 0) {
    throw new Error('Purchase cost must be a positive whole number of paise');
  }
  const salvageValuePaise = input.salvageValuePaise ?? 0;
  if (!Number.isInteger(salvageValuePaise) || salvageValuePaise < 0 || salvageValuePaise >= input.purchaseCostPaise) {
    throw new Error('Salvage value must be a non-negative whole number of paise, less than the purchase cost');
  }

  return companyDb.transaction().execute(async (trx) => {
    const assetClass = await trx.selectFrom('asset_class').selectAll().where('id', '=', input.assetClassId).executeTakeFirst();
    if (!assetClass) {
      throw new Error('Asset class not found');
    }
    if (!assetClass.is_active) {
      throw new Error('This asset class is deactivated');
    }

    const { voucherId } = await createVoucherInTransaction(
      trx,
      {
        voucherType: 'ASSET_ACQUISITION',
        financialYear: input.financialYear,
        voucherDate: input.purchaseDate,
        narration: input.narration ?? `Acquisition of ${input.name.trim()} (${input.assetCode.trim()})`,
        lines: [
          { ledgerId: assetClass.gross_block_ledger_id, debitAmount: input.purchaseCostPaise, creditAmount: 0, costCentreId: input.costCentreId },
          { ledgerId: input.paidFromLedgerId, debitAmount: 0, creditAmount: input.purchaseCostPaise },
        ],
      },
      actorUserId,
    );

    const id = randomUUID();
    await trx
      .insertInto('fixed_asset')
      .values({
        id,
        asset_class_id: input.assetClassId,
        name: input.name.trim(),
        asset_code: input.assetCode.trim(),
        purchase_date: input.purchaseDate,
        purchase_cost_paise: input.purchaseCostPaise,
        salvage_value_paise: salvageValuePaise,
        cost_centre_id: input.costCentreId ?? null,
        status: 'ACTIVE' satisfies AssetStatus,
        disposed_at: null,
        acquisition_voucher_id: voucherId,
        disposal_voucher_id: null,
        created_by: actorUserId,
      })
      .execute();

    return id;
  });
}

export async function listFixedAssets(companyDb: Kysely<CompanyDatabase>): Promise<FixedAssetSummary[]> {
  const rows = await companyDb
    .selectFrom('fixed_asset')
    .innerJoin('asset_class', 'asset_class.id', 'fixed_asset.asset_class_id')
    .select([
      'fixed_asset.id as id',
      'fixed_asset.asset_class_id as assetClassId',
      'asset_class.name as assetClassName',
      'fixed_asset.name as name',
      'fixed_asset.asset_code as assetCode',
      'fixed_asset.purchase_date as purchaseDate',
      'fixed_asset.purchase_cost_paise as purchaseCostPaise',
      'fixed_asset.salvage_value_paise as salvageValuePaise',
      'fixed_asset.cost_centre_id as costCentreId',
      'fixed_asset.status as status',
      'fixed_asset.disposed_at as disposedAt',
      'fixed_asset.acquisition_voucher_id as acquisitionVoucherId',
      'fixed_asset.disposal_voucher_id as disposalVoucherId',
    ])
    .orderBy('fixed_asset.purchase_date', 'desc')
    .execute();

  return rows.map((row) => ({ ...row, status: row.status as AssetStatus }));
}

/** Both depreciation books side by side for one asset, across every financial year an entry exists for — the literal proof the two books are independently maintained. */
export async function getAssetDepreciationSchedule(companyDb: Kysely<CompanyDatabase>, assetId: string): Promise<AssetDepreciationEntrySummary[]> {
  const rows = await companyDb
    .selectFrom('asset_depreciation_entry')
    .selectAll()
    .where('asset_id', '=', assetId)
    .orderBy('financial_year')
    .orderBy('book')
    .execute();

  return rows.map((row) => ({
    book: row.book as AssetDepreciationEntrySummary['book'],
    financialYear: row.financial_year,
    openingWdvPaise: row.opening_wdv_paise,
    depreciationAmountPaise: row.depreciation_amount_paise,
    closingWdvPaise: row.closing_wdv_paise,
    voucherId: row.voucher_id,
  }));
}
