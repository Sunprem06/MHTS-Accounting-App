import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface LayerScope {
  itemId: string;
  warehouseId: string;
  /** null means "not batch-tracked" — matched with IS NULL, never left unconstrained. */
  batchId: string | null;
}

/** Creates a new FIFO cost layer from an inbound movement (purchase receipt, opening stock, or a transfer-in carrying its source cost forward). */
export async function createFifoLayerInTransaction(
  trx: Transaction<CompanyDatabase>,
  scope: LayerScope,
  quantityThousandths: number,
  ratePaise: number,
  valuePaise: number,
  sourceMovementId: string,
  receivedAt: string,
): Promise<string> {
  const id = randomUUID();
  await trx
    .insertInto('stock_receipt_layer')
    .values({
      id,
      item_id: scope.itemId,
      warehouse_id: scope.warehouseId,
      batch_id: scope.batchId,
      source_movement_id: sourceMovementId,
      quantity_remaining_thousandths: quantityThousandths,
      value_remaining_paise: valuePaise,
      rate_paise: ratePaise,
      received_at: receivedAt,
    })
    .execute();
  return id;
}

export interface FifoConsumptionResult {
  costPaise: number;
  /** receivedAt/ratePaise are the ORIGINAL layer's own values — carried along so a stock transfer can recreate an equivalent layer at the destination warehouse without losing FIFO queue position (see transferStockInTransaction). */
  consumptions: { layerId: string; quantityThousandths: number; valuePaise: number; ratePaise: number; receivedAt: string }[];
}

function scopedLayerQuery(trx: Transaction<CompanyDatabase>, scope: LayerScope) {
  let query = trx
    .selectFrom('stock_receipt_layer')
    .selectAll()
    .where('item_id', '=', scope.itemId)
    .where('warehouse_id', '=', scope.warehouseId)
    .where('quantity_remaining_thousandths', '>', 0);
  query = scope.batchId === null ? query.where('batch_id', 'is', null) : query.where('batch_id', '=', scope.batchId);
  // Tiebreak on rowid (SQLite's implicit insertion-order column — this table
  // has no INTEGER PRIMARY KEY so it isn't WITHOUT ROWID), not `id` (a random
  // UUID): two layers received on the same calendar date must still be
  // consumed in the order they were actually created, not UUID-lexicographic
  // order. Found while building stock-movement reversal — the same ordering
  // signal that feature's weighted-average eligibility check relies on.
  return query.orderBy('received_at', 'asc').orderBy(sql`rowid`, 'asc');
}

/**
 * Consumes as many oldest-received-first layers as needed to satisfy
 * quantityThousandths, scoped to exactly (item, warehouse, batch) — never
 * assumes a single layer suffices. The draw that fully drains a layer
 * charges whatever value_remaining_paise is left on it (not a freshly
 * rounded qty*rate), so partial-issue rounding can never let the sum of a
 * layer's issued cost drift from what it actually cost to receive. Throws
 * (rolling back the whole transaction) if the scoped layers can't cover the
 * full requested quantity — there is no separate "check availability first"
 * step, since this loop IS the only place that determines availability, by
 * construction.
 */
export async function consumeFifoLayersInTransaction(trx: Transaction<CompanyDatabase>, scope: LayerScope, quantityThousandths: number): Promise<FifoConsumptionResult> {
  const layers = await scopedLayerQuery(trx, scope).execute();

  let remainingToConsume = quantityThousandths;
  let totalCost = 0;
  const consumptions: FifoConsumptionResult['consumptions'] = [];

  for (const layer of layers) {
    if (remainingToConsume <= 0) break;

    const drawQty = Math.min(layer.quantity_remaining_thousandths, remainingToConsume);
    const fullyDrains = drawQty === layer.quantity_remaining_thousandths;
    const drawValue = fullyDrains ? layer.value_remaining_paise : Math.round((drawQty * layer.rate_paise) / 1000);

    await trx
      .updateTable('stock_receipt_layer')
      .set({
        quantity_remaining_thousandths: layer.quantity_remaining_thousandths - drawQty,
        value_remaining_paise: layer.value_remaining_paise - drawValue,
      })
      .where('id', '=', layer.id)
      .execute();

    consumptions.push({ layerId: layer.id, quantityThousandths: drawQty, valuePaise: drawValue, ratePaise: layer.rate_paise, receivedAt: layer.received_at });
    totalCost += drawValue;
    remainingToConsume -= drawQty;
  }

  if (remainingToConsume > 0) {
    throw new Error(`Insufficient stock: short by ${remainingToConsume / 1000} unit(s) for this item/warehouse/batch`);
  }

  return { costPaise: totalCost, consumptions };
}

/**
 * Credits a specific draw back onto the layer it came from — the mechanism
 * behind reversing an outbound movement (see stockReversals.ts). A plain
 * increment by id, deliberately with NO quantity_remaining > 0 filtering:
 * restoring into a layer that a later draw fully drained (quantity_remaining
 * currently 0) must still work, since draws and reversals always move a
 * layer's remaining quantity/value in matched pairs — see stockReversals.ts
 * for why this can never overshoot the layer's original quantity.
 */
export async function restoreFifoLayerInTransaction(trx: Transaction<CompanyDatabase>, layerId: string, quantityThousandths: number, valuePaise: number): Promise<void> {
  await trx
    .updateTable('stock_receipt_layer')
    .set((eb) => ({
      quantity_remaining_thousandths: eb('quantity_remaining_thousandths', '+', quantityThousandths),
      value_remaining_paise: eb('value_remaining_paise', '+', valuePaise),
    }))
    .where('id', '=', layerId)
    .execute();
}
