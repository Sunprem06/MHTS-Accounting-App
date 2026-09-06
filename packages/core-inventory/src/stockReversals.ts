import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { restoreFifoLayerInTransaction } from './stockLayers';
import type { MovementType } from './types';

const OUTBOUND_REVERSIBLE_TYPES: readonly string[] = ['SALES_ISSUE', 'ADJUSTMENT_OUT'];
const INBOUND_REVERSIBLE_TYPES: readonly string[] = ['PURCHASE_RECEIPT', 'ADJUSTMENT_IN'];

function reversalTypeFor(movementType: string): MovementType {
  switch (movementType) {
    case 'SALES_ISSUE':
      return 'SALES_ISSUE_REVERSAL';
    case 'ADJUSTMENT_OUT':
      return 'ADJUSTMENT_OUT_REVERSAL';
    case 'PURCHASE_RECEIPT':
      return 'PURCHASE_RECEIPT_REVERSAL';
    case 'ADJUSTMENT_IN':
      return 'ADJUSTMENT_IN_REVERSAL';
    default:
      throw new Error(`Cannot reverse a movement of type ${movementType}`);
  }
}

/**
 * Reverses an outbound movement (SALES_ISSUE or ADJUSTMENT_OUT) — always
 * safe regardless of what's happened to the item/warehouse/batch since,
 * because it credits stock back to the EXACT layer(s) originally drawn
 * from (via stock_movement_layer_consumption, replayed as plain
 * increments — see restoreFifoLayerInTransaction), or, for a
 * weighted-average item, inserts a plain compensating inbound movement
 * with the exact original quantity/value (computeCumulativePosition's sum
 * is order-independent, so this always nets out correctly no matter when
 * it's inserted). Never mutates the original movement row — inserts a new
 * one instead (append-only, same convention as audit_log/voucher_line).
 */
export async function reverseOutboundMovementInTransaction(trx: Transaction<CompanyDatabase>, movementId: string, reversalDate: string, actorUserId: string | null): Promise<{ reversalMovementId: string }> {
  const movement = await trx.selectFrom('stock_movement').selectAll().where('id', '=', movementId).executeTakeFirst();
  if (!movement) {
    throw new Error('Stock movement not found');
  }
  if (!OUTBOUND_REVERSIBLE_TYPES.includes(movement.movement_type)) {
    throw new Error(`Cannot reverse a movement of type ${movement.movement_type} as an outbound movement`);
  }

  const item = await trx.selectFrom('item').select('valuation_method').where('id', '=', movement.item_id).executeTakeFirstOrThrow();
  if (item.valuation_method === 'FIFO') {
    const consumptions = await trx.selectFrom('stock_movement_layer_consumption').selectAll().where('movement_id', '=', movementId).execute();
    if (consumptions.length === 0) {
      throw new Error('No layer-consumption record found for this movement — cannot reverse it precisely. This should not happen for a movement posted after the reversal feature shipped.');
    }
    for (const consumption of consumptions) {
      await restoreFifoLayerInTransaction(trx, consumption.layer_id, consumption.quantity_consumed_thousandths, consumption.value_consumed_paise);
    }
  }

  const reversalMovementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: reversalMovementId,
      item_id: movement.item_id,
      warehouse_id: movement.warehouse_id,
      batch_id: movement.batch_id,
      movement_type: reversalTypeFor(movement.movement_type),
      quantity_thousandths: movement.quantity_thousandths,
      rate_paise: movement.rate_paise,
      value_paise: movement.value_paise,
      reference_type: 'STOCK_MOVEMENT_REVERSAL',
      reference_id: movement.id,
      movement_date: reversalDate,
      created_by: actorUserId,
    })
    .execute();

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: reversalMovementId,
    afterData: { reverses: movement.id, movementType: reversalTypeFor(movement.movement_type), quantityThousandths: movement.quantity_thousandths, valuePaise: movement.value_paise },
  });

  return { reversalMovementId };
}

/**
 * Reverses an inbound movement (PURCHASE_RECEIPT or ADJUSTMENT_IN) — NOT
 * always safe, unlike the outbound case, and gated by a real eligibility
 * check:
 *
 * - FIFO: only safe if nothing has been drawn from the layer this
 *   movement created — quantity_remaining must still equal the movement's
 *   own (never-mutated) quantity_thousandths. A defensive value check
 *   guards against a bug elsewhere ever silently desyncing the two.
 * - Weighted-average: there's no per-receipt layer once pooled, so the
 *   only safe rule is that this must currently be the MOST RECENT
 *   stock_movement for this exact (item, warehouse, batch) scope — using
 *   SQLite's implicit rowid (not `id`, a random UUID, and not
 *   `created_at`, only 1-second text resolution) as the ordering signal.
 *   This is deliberately stricter than the theoretical minimum (only a
 *   LATER OUTBOUND movement actually bakes a corrupted average into an
 *   already-posted, immutable COGS figure) — a conservative v1 choice,
 *   not tightened further in this pass.
 */
export async function reverseInboundMovementInTransaction(trx: Transaction<CompanyDatabase>, movementId: string, reversalDate: string, actorUserId: string | null): Promise<{ reversalMovementId: string }> {
  const movement = await trx
    .selectFrom('stock_movement')
    .selectAll()
    .select(sql<number>`rowid`.as('rowNumber'))
    .where('id', '=', movementId)
    .executeTakeFirst();
  if (!movement) {
    throw new Error('Stock movement not found');
  }
  if (!INBOUND_REVERSIBLE_TYPES.includes(movement.movement_type)) {
    throw new Error(`Cannot reverse a movement of type ${movement.movement_type} as an inbound movement`);
  }

  const item = await trx.selectFrom('item').select('valuation_method').where('id', '=', movement.item_id).executeTakeFirstOrThrow();

  if (item.valuation_method === 'FIFO') {
    const layer = await trx.selectFrom('stock_receipt_layer').selectAll().where('source_movement_id', '=', movementId).executeTakeFirst();
    if (!layer) {
      throw new Error('No stock layer found for this receipt — cannot verify it is safe to reverse');
    }
    if (layer.quantity_remaining_thousandths !== movement.quantity_thousandths || layer.value_remaining_paise !== movement.value_paise) {
      const consumedQty = (movement.quantity_thousandths - layer.quantity_remaining_thousandths) / 1000;
      throw new Error(`Cannot reverse: ${consumedQty} unit(s) from this receipt have already been issued, adjusted out, or transferred to another warehouse`);
    }
    await trx.updateTable('stock_receipt_layer').set({ quantity_remaining_thousandths: 0, value_remaining_paise: 0 }).where('id', '=', layer.id).execute();
  } else {
    let laterQuery = trx
      .selectFrom('stock_movement')
      .select('id')
      .where('item_id', '=', movement.item_id)
      .where('warehouse_id', '=', movement.warehouse_id)
      .where(sql<number>`rowid`, '>', movement.rowNumber);
    laterQuery = movement.batch_id === null ? laterQuery.where('batch_id', 'is', null) : laterQuery.where('batch_id', '=', movement.batch_id);
    const later = await laterQuery.executeTakeFirst();
    if (later) {
      throw new Error('Cannot reverse: stock has moved for this item/warehouse/batch since this receipt was posted');
    }
  }

  const reversalMovementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: reversalMovementId,
      item_id: movement.item_id,
      warehouse_id: movement.warehouse_id,
      batch_id: movement.batch_id,
      movement_type: reversalTypeFor(movement.movement_type),
      quantity_thousandths: movement.quantity_thousandths,
      rate_paise: movement.rate_paise,
      value_paise: movement.value_paise,
      reference_type: 'STOCK_MOVEMENT_REVERSAL',
      reference_id: movement.id,
      movement_date: reversalDate,
      created_by: actorUserId,
    })
    .execute();

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: reversalMovementId,
    afterData: { reverses: movement.id, movementType: reversalTypeFor(movement.movement_type), quantityThousandths: movement.quantity_thousandths, valuePaise: movement.value_paise },
  });

  return { reversalMovementId };
}

/**
 * Reverses every stock_movement tied to a given reference (a sales/purchase
 * invoice id, or a STOCK_ADJUSTMENT voucher id) — all inside the caller's
 * transaction, so an ineligible movement anywhere in the set rolls back
 * everything reversed so far in this same call (nothing partially
 * reversed). Called by cancelSalesInvoice/cancelPurchaseInvoice/
 * cancelStockAdjustment BEFORE cancelVoucherInTransaction, in one shared
 * transaction with it.
 */
export async function reverseStockMovementsForReferenceInTransaction(
  trx: Transaction<CompanyDatabase>,
  referenceType: string,
  referenceId: string,
  reversalDate: string,
  actorUserId: string | null,
): Promise<void> {
  const movements = await trx.selectFrom('stock_movement').selectAll().where('reference_type', '=', referenceType).where('reference_id', '=', referenceId).execute();

  for (const movement of movements) {
    if (OUTBOUND_REVERSIBLE_TYPES.includes(movement.movement_type)) {
      await reverseOutboundMovementInTransaction(trx, movement.id, reversalDate, actorUserId);
    } else if (INBOUND_REVERSIBLE_TYPES.includes(movement.movement_type)) {
      await reverseInboundMovementInTransaction(trx, movement.id, reversalDate, actorUserId);
    } else {
      throw new Error(`Cannot reverse a movement of type ${movement.movement_type}`);
    }
  }
}
