import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { createFifoLayerInTransaction, consumeFifoLayersInTransaction } from './stockLayers';
import { computeWeightedAverageIssueCost } from './weightedAverage';
import type { TransferStockInput } from './types';

/**
 * Moves stock between warehouses of the same company — no GL impact, since
 * it's the same Stock-in-Hand ledger overall. TRANSFER_OUT consumes
 * source-warehouse layers exactly like a sale (capturing real historical
 * cost, never "current cost at destination" — that would silently revalue
 * stock for free by moving it between bins). For a FIFO item, TRANSFER_IN
 * recreates an equivalent layer at the destination for each original layer
 * drawn from, preserving its ORIGINAL received_at — so a transferred batch
 * doesn't jump the destination warehouse's FIFO queue ahead of genuinely
 * older local stock. Weighted-average items need no layer at either end;
 * their cost is derived on the fly from full movement history regardless of
 * warehouse.
 */
export async function transferStockInTransaction(trx: Transaction<CompanyDatabase>, input: TransferStockInput, actorUserId: string | null): Promise<{ outMovementId: string; inMovementId: string }> {
  if (!Number.isInteger(input.quantityThousandths) || input.quantityThousandths <= 0) {
    throw new Error('Quantity must be a positive whole number of thousandths of a unit');
  }
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error('Source and destination warehouse must be different');
  }

  const item = await trx.selectFrom('item').selectAll().where('id', '=', input.itemId).executeTakeFirst();
  if (!item) {
    throw new Error('Item not found');
  }
  if (item.item_type !== 'STOCKABLE') {
    throw new Error('This item is not stockable');
  }
  const fromWarehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.fromWarehouseId).executeTakeFirst();
  if (!fromWarehouse) {
    throw new Error('Source warehouse not found');
  }
  const toWarehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.toWarehouseId).executeTakeFirst();
  if (!toWarehouse) {
    throw new Error('Destination warehouse not found');
  }

  let batchId: string | null = null;
  if (item.is_batch_tracked) {
    if (!input.batchId) {
      throw new Error('A batch must be specified to transfer a batch-tracked item');
    }
    const batch = await trx.selectFrom('item_batch').select('id').where('id', '=', input.batchId).where('item_id', '=', input.itemId).executeTakeFirst();
    if (!batch) {
      throw new Error('Batch not found for this item');
    }
    batchId = input.batchId;
  }

  const sourceScope = { itemId: input.itemId, warehouseId: input.fromWarehouseId, batchId };
  const isFifo = item.valuation_method === 'FIFO';
  const { costPaise, consumptions } = isFifo
    ? await consumeFifoLayersInTransaction(trx, sourceScope, input.quantityThousandths)
    : { costPaise: await computeWeightedAverageIssueCost(trx, sourceScope, input.quantityThousandths), consumptions: [] };

  const ratePaise = Math.round((costPaise * 1000) / input.quantityThousandths);
  const transferId = randomUUID();

  const outMovementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: outMovementId,
      item_id: input.itemId,
      warehouse_id: input.fromWarehouseId,
      batch_id: batchId,
      movement_type: 'TRANSFER_OUT',
      quantity_thousandths: input.quantityThousandths,
      rate_paise: ratePaise,
      value_paise: costPaise,
      reference_type: 'STOCK_TRANSFER',
      reference_id: transferId,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  for (const consumption of consumptions) {
    await trx
      .insertInto('stock_movement_layer_consumption')
      .values({ id: randomUUID(), movement_id: outMovementId, layer_id: consumption.layerId, quantity_consumed_thousandths: consumption.quantityThousandths, value_consumed_paise: consumption.valuePaise })
      .execute();
  }

  const inMovementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: inMovementId,
      item_id: input.itemId,
      warehouse_id: input.toWarehouseId,
      batch_id: batchId,
      movement_type: 'TRANSFER_IN',
      quantity_thousandths: input.quantityThousandths,
      rate_paise: ratePaise,
      value_paise: costPaise,
      reference_type: 'STOCK_TRANSFER',
      reference_id: transferId,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  if (isFifo) {
    for (const consumption of consumptions) {
      await createFifoLayerInTransaction(
        trx,
        { itemId: input.itemId, warehouseId: input.toWarehouseId, batchId },
        consumption.quantityThousandths,
        consumption.ratePaise,
        consumption.valuePaise,
        inMovementId,
        consumption.receivedAt,
      );
    }
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockTransfer',
    entityId: transferId,
    afterData: { itemId: input.itemId, fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, batchId, quantityThousandths: input.quantityThousandths, costPaise, outMovementId, inMovementId },
  });

  return { outMovementId, inMovementId };
}

export async function transferStock(companyDb: Kysely<CompanyDatabase>, input: TransferStockInput, actorUserId: string | null): Promise<{ outMovementId: string; inMovementId: string }> {
  return companyDb.transaction().execute((trx) => transferStockInTransaction(trx, input, actorUserId));
}
