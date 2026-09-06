import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { LayerScope } from './stockLayers';
import { INBOUND_MOVEMENT_TYPES, OUTBOUND_MOVEMENT_TYPES } from './types';

/** Cumulative on-hand quantity/value for a (item, warehouse, batch) scope, summed from the full stock_movement history — the same on-the-fly philosophy as computeLedgerBalances, no cached balance table. */
export async function computeCumulativePosition(companyDb: Kysely<CompanyDatabase>, scope: LayerScope): Promise<{ quantityThousandths: number; valuePaise: number }> {
  let query = companyDb.selectFrom('stock_movement').where('item_id', '=', scope.itemId).where('warehouse_id', '=', scope.warehouseId);
  query = scope.batchId === null ? query.where('batch_id', 'is', null) : query.where('batch_id', '=', scope.batchId);
  const rows = await query.select(['movement_type', 'quantity_thousandths', 'value_paise']).execute();

  let quantityThousandths = 0;
  let valuePaise = 0;
  for (const row of rows) {
    const sign = INBOUND_MOVEMENT_TYPES.includes(row.movement_type) ? 1 : OUTBOUND_MOVEMENT_TYPES.includes(row.movement_type) ? -1 : 0;
    quantityThousandths += sign * row.quantity_thousandths;
    valuePaise += sign * row.value_paise;
  }
  return { quantityThousandths, valuePaise };
}

/**
 * Cost of issuing quantityThousandths under weighted-average valuation:
 * one rounding step (issueQty * cumulativeValue / cumulativeQty, rounded
 * once) — unlike FIFO's per-layer draws, this doesn't compound across
 * partial issues, since the average is recomputed from full history each
 * time rather than fed back into itself.
 */
export async function computeWeightedAverageIssueCost(companyDb: Kysely<CompanyDatabase>, scope: LayerScope, issueQuantityThousandths: number): Promise<number> {
  const { quantityThousandths, valuePaise } = await computeCumulativePosition(companyDb, scope);
  if (issueQuantityThousandths > quantityThousandths) {
    throw new Error(`Insufficient stock: short by ${(issueQuantityThousandths - quantityThousandths) / 1000} unit(s) for this item/warehouse/batch`);
  }
  if (quantityThousandths <= 0) {
    throw new Error('No stock on hand for this item/warehouse/batch');
  }
  return Math.round((issueQuantityThousandths * valuePaise) / quantityThousandths);
}
