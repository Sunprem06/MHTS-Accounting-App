import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { getFixedAssetLedgerIds } from './ledgers';
import type { AssetStatus, DisposeFixedAssetInput } from './types';

/**
 * Disposes a fixed asset: posts one ASSET_DISPOSAL voucher (Dr this asset's
 * own accumulated SCHEDULE2 depreciation off the class's shared ledger, Dr
 * any sale proceeds, Cr the asset's original cost off the class's shared
 * gross-block ledger, with a Profit/Loss on Sale of Assets plug line
 * absorbing the difference — debited for a loss, credited for a gain) and
 * marks the register row DISPOSED, atomically (CLAUDE.md Rule #4).
 *
 * Accumulated depreciation is THIS asset's own total from
 * asset_depreciation_entry (book = SCHEDULE2), not the class ledger's whole
 * balance — that ledger is shared across every asset in the class, so only
 * this one unit's share may be removed from it. A known limitation (see
 * Phase Tracker Open Questions): depreciation for the disposal-year itself
 * is only reflected here if postDepreciationRun already ran for that FY —
 * this function does not compute a stub partial-year top-up at disposal.
 */
export async function disposeFixedAsset(companyDb: Kysely<CompanyDatabase>, input: DisposeFixedAssetInput, actorUserId: string | null): Promise<string> {
  if (!Number.isInteger(input.saleProceedsPaise) || input.saleProceedsPaise < 0) {
    throw new Error('Sale proceeds must be a non-negative whole number of paise');
  }
  if (input.saleProceedsPaise > 0 && !input.receiptLedgerId) {
    throw new Error('A receipt ledger is required when sale proceeds are greater than zero');
  }

  return companyDb.transaction().execute(async (trx) => {
    const asset = await trx.selectFrom('fixed_asset').selectAll().where('id', '=', input.assetId).executeTakeFirst();
    if (!asset) {
      throw new Error('Fixed asset not found');
    }
    if (asset.status === 'DISPOSED') {
      throw new Error('This asset has already been disposed');
    }

    const assetClass = await trx.selectFrom('asset_class').selectAll().where('id', '=', asset.asset_class_id).executeTakeFirst();
    if (!assetClass) {
      throw new Error('Asset class not found');
    }

    const depreciationEntries = await trx.selectFrom('asset_depreciation_entry').select('depreciation_amount_paise').where('asset_id', '=', asset.id).where('book', '=', 'SCHEDULE2').execute();
    const accumulatedDepreciationPaise = depreciationEntries.reduce((sum, row) => sum + row.depreciation_amount_paise, 0);

    const { profitLossOnAssetSaleLedgerId } = await getFixedAssetLedgerIds(trx);

    const diff = accumulatedDepreciationPaise + input.saleProceedsPaise - asset.purchase_cost_paise;
    const lines: VoucherLineInput[] = [];
    if (accumulatedDepreciationPaise > 0) {
      lines.push({ ledgerId: assetClass.accumulated_depreciation_ledger_id, debitAmount: accumulatedDepreciationPaise, creditAmount: 0, costCentreId: asset.cost_centre_id ?? undefined });
    }
    if (input.saleProceedsPaise > 0) {
      lines.push({ ledgerId: input.receiptLedgerId as string, debitAmount: input.saleProceedsPaise, creditAmount: 0 });
    }
    lines.push({ ledgerId: assetClass.gross_block_ledger_id, debitAmount: 0, creditAmount: asset.purchase_cost_paise, costCentreId: asset.cost_centre_id ?? undefined });
    if (diff > 0) {
      lines.push({ ledgerId: profitLossOnAssetSaleLedgerId, debitAmount: 0, creditAmount: diff });
    } else if (diff < 0) {
      lines.push({ ledgerId: profitLossOnAssetSaleLedgerId, debitAmount: -diff, creditAmount: 0 });
    }

    const { voucherId } = await createVoucherInTransaction(
      trx,
      {
        voucherType: 'ASSET_DISPOSAL',
        financialYear: input.financialYear,
        voucherDate: input.disposalDate,
        narration: input.narration ?? `Disposal of ${asset.name} (${asset.asset_code})`,
        lines,
      },
      actorUserId,
    );

    await trx
      .updateTable('fixed_asset')
      .set({ status: 'DISPOSED' satisfies AssetStatus, disposed_at: input.disposalDate, disposal_voucher_id: voucherId })
      .where('id', '=', asset.id)
      .execute();

    return voucherId;
  });
}
