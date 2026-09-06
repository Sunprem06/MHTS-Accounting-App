import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { cancelVoucherInTransaction, createVoucherInTransaction } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { createFifoLayerInTransaction, consumeFifoLayersInTransaction } from './stockLayers';
import type { FifoConsumptionResult } from './stockLayers';
import { computeWeightedAverageIssueCost } from './weightedAverage';
import { getInventoryLedgerIds } from './ledgers';
import { reverseStockMovementsForReferenceInTransaction } from './stockReversals';
import type { PostStockAdjustmentInput } from './types';

/**
 * Posts a stock adjustment as BOTH a real double-entry voucher (Rule #4 —
 * this is an in-period value change, unlike a static opening entry, so it
 * must hit the GL) and a stock movement, atomically. ADJUSTMENT_OUT draws
 * its cost from existing stock exactly like a sale (FIFO layer consumption
 * or weighted-average lookup) — the value being written off IS whatever it
 * actually cost to hold that stock. ADJUSTMENT_IN needs an explicit rate
 * (found stock has no prior receipt to draw a cost from) and, for a FIFO
 * item, opens a new cost layer the same way a purchase receipt would.
 */
export async function postStockAdjustmentInTransaction(trx: Transaction<CompanyDatabase>, input: PostStockAdjustmentInput, actorUserId: string | null): Promise<{ movementId: string; voucherId: string }> {
  if (!Number.isInteger(input.quantityThousandths) || input.quantityThousandths <= 0) {
    throw new Error('Quantity must be a positive whole number of thousandths of a unit');
  }

  const item = await trx.selectFrom('item').selectAll().where('id', '=', input.itemId).executeTakeFirst();
  if (!item) {
    throw new Error('Item not found');
  }
  if (item.item_type !== 'STOCKABLE') {
    throw new Error('This item is not stockable');
  }
  const warehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.warehouseId).executeTakeFirst();
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  let batchId: string | null = null;
  if (item.is_batch_tracked) {
    if (!input.batchId) {
      throw new Error('A batch must be specified to adjust a batch-tracked item');
    }
    const batch = await trx.selectFrom('item_batch').select('id').where('id', '=', input.batchId).where('item_id', '=', input.itemId).executeTakeFirst();
    if (!batch) {
      throw new Error('Batch not found for this item');
    }
    batchId = input.batchId;
  }

  const scope = { itemId: input.itemId, warehouseId: input.warehouseId, batchId };
  const { stockInHandLedgerId, adjustmentsLedgerId } = await getInventoryLedgerIds(trx);

  let ratePaise: number;
  let valuePaise: number;
  let fifoConsumptions: FifoConsumptionResult['consumptions'] = [];
  if (input.direction === 'ADJUSTMENT_OUT') {
    let costPaise: number;
    if (item.valuation_method === 'FIFO') {
      const result = await consumeFifoLayersInTransaction(trx, scope, input.quantityThousandths);
      costPaise = result.costPaise;
      fifoConsumptions = result.consumptions;
    } else {
      costPaise = await computeWeightedAverageIssueCost(trx, scope, input.quantityThousandths);
    }
    valuePaise = costPaise;
    ratePaise = Math.round((costPaise * 1000) / input.quantityThousandths);
  } else {
    if (input.ratePaise === undefined || !Number.isInteger(input.ratePaise) || input.ratePaise < 0) {
      throw new Error('A rate is required to record found/corrected stock (ADJUSTMENT_IN)');
    }
    ratePaise = input.ratePaise;
    valuePaise = Math.round((input.quantityThousandths * ratePaise) / 1000);
  }

  const isOut = input.direction === 'ADJUSTMENT_OUT';
  const { voucherId } = await createVoucherInTransaction(
    trx,
    {
      voucherType: 'STOCK_ADJUSTMENT',
      financialYear: input.financialYear,
      voucherDate: input.movementDate,
      narration: input.narration,
      lines: isOut
        ? [
            { ledgerId: adjustmentsLedgerId, debitAmount: valuePaise, creditAmount: 0 },
            { ledgerId: stockInHandLedgerId, debitAmount: 0, creditAmount: valuePaise },
          ]
        : [
            { ledgerId: stockInHandLedgerId, debitAmount: valuePaise, creditAmount: 0 },
            { ledgerId: adjustmentsLedgerId, debitAmount: 0, creditAmount: valuePaise },
          ],
    },
    actorUserId,
  );

  const movementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: movementId,
      item_id: input.itemId,
      warehouse_id: input.warehouseId,
      batch_id: batchId,
      movement_type: input.direction,
      quantity_thousandths: input.quantityThousandths,
      rate_paise: ratePaise,
      value_paise: valuePaise,
      reference_type: 'STOCK_ADJUSTMENT',
      reference_id: voucherId,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  if (!isOut && item.valuation_method === 'FIFO') {
    await createFifoLayerInTransaction(trx, scope, input.quantityThousandths, ratePaise, valuePaise, movementId, input.movementDate);
  }

  // Record exactly which layer(s) this ADJUSTMENT_OUT drew from, the same
  // way postSalesIssueInTransaction/transferStockInTransaction already do —
  // without this, a FIFO adjustment-out could never be reversed precisely
  // (found and fixed while designing stock-movement reversal).
  for (const consumption of fifoConsumptions) {
    await trx
      .insertInto('stock_movement_layer_consumption')
      .values({ id: randomUUID(), movement_id: movementId, layer_id: consumption.layerId, quantity_consumed_thousandths: consumption.quantityThousandths, value_consumed_paise: consumption.valuePaise })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: movementId,
    afterData: { movementType: input.direction, itemId: input.itemId, warehouseId: input.warehouseId, batchId, quantityThousandths: input.quantityThousandths, valuePaise, voucherId },
  });

  return { movementId, voucherId };
}

export async function postStockAdjustment(companyDb: Kysely<CompanyDatabase>, input: PostStockAdjustmentInput, actorUserId: string | null): Promise<{ movementId: string; voucherId: string }> {
  return companyDb.transaction().execute((trx) => postStockAdjustmentInTransaction(trx, input, actorUserId));
}

/**
 * Cancels a stock adjustment voucher — reverses its stock movement (via the
 * same eligibility-checked reversal machinery used for invoices) and its
 * voucher, atomically, in one transaction. Stock adjustments are keyed by
 * voucher id in stock_movement.reference_id (see postStockAdjustmentInTransaction).
 */
export async function cancelStockAdjustment(companyDb: Kysely<CompanyDatabase>, voucherId: string, reversalFinancialYear: string, reversalDate: string, actorUserId: string | null): Promise<string> {
  return companyDb.transaction().execute(async (trx) => {
    await reverseStockMovementsForReferenceInTransaction(trx, 'STOCK_ADJUSTMENT', voucherId, reversalDate, actorUserId);
    return cancelVoucherInTransaction(trx, voucherId, reversalFinancialYear, reversalDate, actorUserId);
  });
}
