import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import type { CreateBillOfMaterialInput, BillOfMaterialSummary } from './types';

// better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans — same cast as core-payroll-engine's salaryStructure.ts.
const IS_ACTIVE = 1 as unknown as boolean;
const IS_INACTIVE = 0 as unknown as boolean;

/**
 * Creates a new BOM version for an output item, deactivating any existing
 * active BOM for that item first — append-only supersede-on-new-version,
 * same pattern as salary_structure/asset_class (never edit a version in
 * place). No multi-level explosion: a component that is itself the output
 * of another BOM is not auto-expanded — a deliberate simplification.
 */
export async function createBillOfMaterial(companyDb: Kysely<CompanyDatabase>, input: CreateBillOfMaterialInput, actorUserId: string | null): Promise<string> {
  if (!Number.isInteger(input.outputQuantityThousandths) || input.outputQuantityThousandths <= 0) {
    throw new Error('Output quantity must be a positive whole number of thousandths of a unit');
  }
  if (input.lines.length === 0) {
    throw new Error('A bill of material needs at least one component line');
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantityThousandths) || line.quantityThousandths <= 0) {
      throw new Error('Each component quantity must be a positive whole number of thousandths of a unit');
    }
  }
  const componentIds = new Set(input.lines.map((line) => line.componentItemId));
  if (componentIds.size !== input.lines.length) {
    throw new Error('A component item cannot appear more than once in the same bill of material');
  }
  if (componentIds.has(input.outputItemId)) {
    throw new Error('The output item cannot also be one of its own components');
  }

  return companyDb.transaction().execute(async (trx) => {
    const outputItem = await trx.selectFrom('item').selectAll().where('id', '=', input.outputItemId).executeTakeFirst();
    if (!outputItem) {
      throw new Error('Output item not found');
    }
    if (outputItem.item_type !== 'STOCKABLE') {
      throw new Error('Only a stockable item can be manufactured via a bill of material');
    }

    const componentItems = await trx.selectFrom('item').selectAll().where('id', 'in', [...componentIds]).execute();
    if (componentItems.length !== componentIds.size) {
      throw new Error('One or more component items do not exist');
    }
    for (const item of componentItems) {
      if (item.item_type !== 'STOCKABLE') {
        throw new Error(`Component "${item.name}" is not a stockable item`);
      }
    }

    await trx.updateTable('bill_of_material').set({ is_active: IS_INACTIVE }).where('output_item_id', '=', input.outputItemId).where('is_active', '=', IS_ACTIVE).execute();

    const bomId = randomUUID();
    await trx
      .insertInto('bill_of_material')
      .values({
        id: bomId,
        output_item_id: input.outputItemId,
        output_quantity_thousandths: input.outputQuantityThousandths,
        is_active: IS_ACTIVE,
        created_by: actorUserId,
      })
      .execute();

    for (const line of input.lines) {
      await trx
        .insertInto('bill_of_material_line')
        .values({
          id: randomUUID(),
          bom_id: bomId,
          component_item_id: line.componentItemId,
          quantity_thousandths: line.quantityThousandths,
        })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'BillOfMaterial',
      entityId: bomId,
      afterData: { outputItemId: input.outputItemId, outputQuantityThousandths: input.outputQuantityThousandths, lines: input.lines },
    });

    return bomId;
  });
}

export async function listBillsOfMaterial(companyDb: Kysely<CompanyDatabase>): Promise<BillOfMaterialSummary[]> {
  const boms = await companyDb
    .selectFrom('bill_of_material')
    .innerJoin('item', 'item.id', 'bill_of_material.output_item_id')
    .select([
      'bill_of_material.id as id',
      'bill_of_material.output_item_id as outputItemId',
      'item.name as outputItemName',
      'bill_of_material.output_quantity_thousandths as outputQuantityThousandths',
      'bill_of_material.is_active as isActive',
    ])
    .orderBy('item.name')
    .execute();

  if (boms.length === 0) {
    return [];
  }

  const lines = await companyDb
    .selectFrom('bill_of_material_line')
    .innerJoin('item', 'item.id', 'bill_of_material_line.component_item_id')
    .select([
      'bill_of_material_line.bom_id as bomId',
      'bill_of_material_line.id as id',
      'bill_of_material_line.component_item_id as componentItemId',
      'item.name as componentItemName',
      'bill_of_material_line.quantity_thousandths as quantityThousandths',
    ])
    .where(
      'bill_of_material_line.bom_id',
      'in',
      boms.map((bom) => bom.id),
    )
    .execute();

  return boms.map((bom) => ({
    ...bom,
    isActive: Boolean(bom.isActive),
    lines: lines.filter((line) => line.bomId === bom.id).map(({ bomId: _bomId, ...rest }) => rest),
  }));
}
