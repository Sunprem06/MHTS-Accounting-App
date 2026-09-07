import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { consumeFifoLayersInTransaction, createFifoLayerInTransaction, computeWeightedAverageIssueCost, getOrCreateBatch, getInventoryLedgerIds } from '@mhts/core-inventory';
import type { ManufacturingJournalMovementSummary, ManufacturingJournalSummary, PostManufacturingJournalInput } from './types';

interface ScaledComponent {
  itemId: string;
  itemName: string;
  quantityThousandths: number;
  batchId: string | null;
  valuationMethod: string | null;
}

/**
 * Posts a single consume/produce manufacturing journal atomically: consumes
 * every BOM component (scaled to the quantity actually produced) exactly
 * like a sales issue — FIFO layer consumption or weighted-average lookup,
 * reusing @mhts/core-inventory's existing valuation functions as-is — then
 * produces the output item at cost = sum of components consumed (no
 * overhead/conversion-cost or wastage absorption this pass — a deliberate
 * simplification). The GL entry (Dr/Cr the same Stock-in-Hand ledger for
 * that amount) has zero net effect by construction, same precedent as
 * transferStockInTransaction, but still gets a real MANUFACTURING_JOURNAL
 * voucher/number since it's a distinct financial event worth its own audit
 * trail entry, not a mere relocation. Cancellation/reversal is deliberately
 * out of scope this pass (see Phase Tracker Open Questions).
 */
export async function postManufacturingJournalInTransaction(
  trx: Transaction<CompanyDatabase>,
  input: PostManufacturingJournalInput,
  actorUserId: string | null,
): Promise<{ journalId: string; voucherId: string }> {
  if (!Number.isInteger(input.quantityProducedThousandths) || input.quantityProducedThousandths <= 0) {
    throw new Error('Quantity produced must be a positive whole number of thousandths of a unit');
  }

  const bom = await trx.selectFrom('bill_of_material').selectAll().where('id', '=', input.bomId).executeTakeFirst();
  if (!bom) {
    throw new Error('Bill of material not found');
  }
  if (!bom.is_active) {
    throw new Error('This bill of material is no longer active — a newer version has superseded it');
  }

  const bomLines = await trx.selectFrom('bill_of_material_line').selectAll().where('bom_id', '=', bom.id).execute();

  const outputItem = await trx.selectFrom('item').selectAll().where('id', '=', bom.output_item_id).executeTakeFirst();
  if (!outputItem) {
    throw new Error('Output item not found');
  }
  if (!outputItem.is_active) {
    throw new Error('The output item is inactive');
  }
  const warehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.warehouseId).executeTakeFirst();
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  // Scale each component's BOM quantity to the quantity actually being
  // produced — same Math.round discipline as every other paise/thousandths
  // computation in this codebase (never REAL/float).
  const scaledComponents: ScaledComponent[] = [];
  for (const line of bomLines) {
    const scaledQty = Math.round((line.quantity_thousandths * input.quantityProducedThousandths) / bom.output_quantity_thousandths);
    if (scaledQty <= 0) {
      throw new Error('Quantity produced is too small to consume a whole unit of one or more components at this scale');
    }

    const componentItem = await trx.selectFrom('item').selectAll().where('id', '=', line.component_item_id).executeTakeFirst();
    if (!componentItem) {
      throw new Error('Component item not found');
    }
    if (!componentItem.is_active) {
      throw new Error(`Component "${componentItem.name}" is inactive`);
    }

    let batchId: string | null = null;
    if (componentItem.is_batch_tracked) {
      const providedBatchId = input.componentBatchIds?.[line.component_item_id];
      if (!providedBatchId) {
        throw new Error(`A batch must be specified for batch-tracked component "${componentItem.name}"`);
      }
      const batch = await trx.selectFrom('item_batch').select('id').where('id', '=', providedBatchId).where('item_id', '=', line.component_item_id).executeTakeFirst();
      if (!batch) {
        throw new Error(`Batch not found for component "${componentItem.name}"`);
      }
      batchId = providedBatchId;
    }

    scaledComponents.push({ itemId: line.component_item_id, itemName: componentItem.name, quantityThousandths: scaledQty, batchId, valuationMethod: componentItem.valuation_method });
  }

  let outputBatchId: string | null = null;
  if (outputItem.is_batch_tracked) {
    if (!input.outputBatchNumber) {
      throw new Error('A batch number is required for the batch-tracked output item');
    }
    outputBatchId = await getOrCreateBatch(trx, outputItem.id, input.outputBatchNumber, input.expiryDate ?? null, input.manufactureDate ?? null);
  }

  const journalId = randomUUID();

  let totalCostPaise = 0;
  for (const component of scaledComponents) {
    const scope = { itemId: component.itemId, warehouseId: input.warehouseId, batchId: component.batchId };
    const { costPaise, consumptions } =
      component.valuationMethod === 'FIFO'
        ? await consumeFifoLayersInTransaction(trx, scope, component.quantityThousandths)
        : { costPaise: await computeWeightedAverageIssueCost(trx, scope, component.quantityThousandths), consumptions: [] };

    const ratePaise = Math.round((costPaise * 1000) / component.quantityThousandths);
    const movementId = randomUUID();
    await trx
      .insertInto('stock_movement')
      .values({
        id: movementId,
        item_id: component.itemId,
        warehouse_id: input.warehouseId,
        batch_id: component.batchId,
        movement_type: 'MANUFACTURING_CONSUME',
        quantity_thousandths: component.quantityThousandths,
        rate_paise: ratePaise,
        value_paise: costPaise,
        reference_type: 'MANUFACTURING_JOURNAL',
        reference_id: journalId,
        movement_date: input.journalDate,
        created_by: actorUserId,
      })
      .execute();

    for (const consumption of consumptions) {
      await trx
        .insertInto('stock_movement_layer_consumption')
        .values({ id: randomUUID(), movement_id: movementId, layer_id: consumption.layerId, quantity_consumed_thousandths: consumption.quantityThousandths, value_consumed_paise: consumption.valuePaise })
        .execute();
    }

    totalCostPaise += costPaise;
  }

  const outputRatePaise = Math.round((totalCostPaise * 1000) / input.quantityProducedThousandths);
  const produceMovementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: produceMovementId,
      item_id: outputItem.id,
      warehouse_id: input.warehouseId,
      batch_id: outputBatchId,
      movement_type: 'MANUFACTURING_PRODUCE',
      quantity_thousandths: input.quantityProducedThousandths,
      rate_paise: outputRatePaise,
      value_paise: totalCostPaise,
      reference_type: 'MANUFACTURING_JOURNAL',
      reference_id: journalId,
      movement_date: input.journalDate,
      created_by: actorUserId,
    })
    .execute();

  if (outputItem.valuation_method === 'FIFO') {
    await createFifoLayerInTransaction(
      trx,
      { itemId: outputItem.id, warehouseId: input.warehouseId, batchId: outputBatchId },
      input.quantityProducedThousandths,
      outputRatePaise,
      totalCostPaise,
      produceMovementId,
      input.journalDate,
    );
  }

  const { stockInHandLedgerId } = await getInventoryLedgerIds(trx);
  const { voucherId } = await createVoucherInTransaction(
    trx,
    {
      voucherType: 'MANUFACTURING_JOURNAL',
      financialYear: input.financialYear,
      voucherDate: input.journalDate,
      narration: input.narration,
      lines: [
        { ledgerId: stockInHandLedgerId, debitAmount: totalCostPaise, creditAmount: 0 },
        { ledgerId: stockInHandLedgerId, debitAmount: 0, creditAmount: totalCostPaise },
      ],
    },
    actorUserId,
  );

  await trx
    .insertInto('manufacturing_journal')
    .values({
      id: journalId,
      bom_id: bom.id,
      output_item_id: outputItem.id,
      warehouse_id: input.warehouseId,
      quantity_produced_thousandths: input.quantityProducedThousandths,
      total_cost_paise: totalCostPaise,
      voucher_id: voucherId,
      financial_year: input.financialYear,
      journal_date: input.journalDate,
      narration: input.narration ?? null,
      created_by: actorUserId,
    })
    .execute();

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'ManufacturingJournal',
    entityId: journalId,
    afterData: {
      bomId: bom.id,
      outputItemId: outputItem.id,
      warehouseId: input.warehouseId,
      quantityProducedThousandths: input.quantityProducedThousandths,
      totalCostPaise,
      voucherId,
      components: scaledComponents.map((c) => ({ itemId: c.itemId, itemName: c.itemName, quantityThousandths: c.quantityThousandths })),
    },
  });

  return { journalId, voucherId };
}

export async function postManufacturingJournal(companyDb: Kysely<CompanyDatabase>, input: PostManufacturingJournalInput, actorUserId: string | null): Promise<{ journalId: string; voucherId: string }> {
  return companyDb.transaction().execute((trx) => postManufacturingJournalInTransaction(trx, input, actorUserId));
}

export async function listManufacturingJournals(companyDb: Kysely<CompanyDatabase>): Promise<ManufacturingJournalSummary[]> {
  const rows = await companyDb
    .selectFrom('manufacturing_journal')
    .innerJoin('item', 'item.id', 'manufacturing_journal.output_item_id')
    .innerJoin('warehouse', 'warehouse.id', 'manufacturing_journal.warehouse_id')
    .select([
      'manufacturing_journal.id as id',
      'manufacturing_journal.bom_id as bomId',
      'manufacturing_journal.output_item_id as outputItemId',
      'item.name as outputItemName',
      'manufacturing_journal.warehouse_id as warehouseId',
      'warehouse.name as warehouseName',
      'manufacturing_journal.quantity_produced_thousandths as quantityProducedThousandths',
      'manufacturing_journal.total_cost_paise as totalCostPaise',
      'manufacturing_journal.voucher_id as voucherId',
      'manufacturing_journal.financial_year as financialYear',
      'manufacturing_journal.journal_date as journalDate',
      'manufacturing_journal.narration as narration',
    ])
    .orderBy('manufacturing_journal.journal_date', 'desc')
    .orderBy('manufacturing_journal.created_at', 'desc')
    .execute();

  return rows;
}

/** Drill-down for the register: every component consumed plus the output produced for one posted journal, sourced from stock_movement (no redundant line table — same choice as STOCK_ADJUSTMENT). */
export async function getManufacturingJournalMovements(companyDb: Kysely<CompanyDatabase>, journalId: string): Promise<ManufacturingJournalMovementSummary[]> {
  const rows = await companyDb
    .selectFrom('stock_movement')
    .innerJoin('item', 'item.id', 'stock_movement.item_id')
    .leftJoin('item_batch', 'item_batch.id', 'stock_movement.batch_id')
    .select([
      'stock_movement.item_id as itemId',
      'item.name as itemName',
      'stock_movement.movement_type as movementType',
      'stock_movement.quantity_thousandths as quantityThousandths',
      'stock_movement.rate_paise as ratePaise',
      'stock_movement.value_paise as valuePaise',
      'item_batch.batch_number as batchNumber',
    ])
    .where('stock_movement.reference_type', '=', 'MANUFACTURING_JOURNAL')
    .where('stock_movement.reference_id', '=', journalId)
    .orderBy('stock_movement.movement_type', 'asc')
    .execute();

  return rows;
}
