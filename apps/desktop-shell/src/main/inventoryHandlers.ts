import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import {
  createUnitOfMeasure as coreCreateUnitOfMeasure,
  listUnitsOfMeasure as coreListUnitsOfMeasure,
  createWarehouse as coreCreateWarehouse,
  listWarehouses as coreListWarehouses,
  createItem as coreCreateItem,
  listItems as coreListItems,
  listBatchesForItem as coreListBatchesForItem,
  recordOpeningStock as coreRecordOpeningStock,
  postStockAdjustment as corePostStockAdjustment,
  transferStock as coreTransferStock,
  listStockMovements as coreListStockMovements,
  computeStockPosition as coreComputeStockPosition,
  cancelStockAdjustment as coreCancelStockAdjustment,
} from '@mhts/core-inventory';
import { requireSessionWithCompanyDb } from './session';
import type {
  CreateItemInput,
  CreateUnitOfMeasureInput,
  CreateWarehouseInput,
  ItemBatchSummary,
  ItemSummary,
  PostStockAdjustmentInput,
  RecordOpeningStockInput,
  StockMovementSummary,
  StockPositionQuery,
  StockPositionRow,
  TransferStockInput,
  UnitOfMeasureSummary,
  WarehouseSummary,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const THOUSANDTHS_PER_UNIT = 1000;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
const unitsToThousandths = (units: number): number => Math.round(units * THOUSANDTHS_PER_UNIT);
const thousandthsToUnits = (thousandths: number): number => thousandths / THOUSANDTHS_PER_UNIT;

async function financialYearFor(systemDb: Kysely<SystemDatabase>, companyId: string, date: string): Promise<string> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return computeFinancialYearLabel(company.financial_year_start_month, new Date(date));
}

export async function createUnitOfMeasure(input: CreateUnitOfMeasureInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_UNITS');
  return coreCreateUnitOfMeasure(companyDb, input);
}

export async function listUnitsOfMeasure(): Promise<UnitOfMeasureSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_UNITS');
  return coreListUnitsOfMeasure(companyDb);
}

export async function createWarehouse(input: CreateWarehouseInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_WAREHOUSES');
  return coreCreateWarehouse(companyDb, input);
}

export async function listWarehouses(): Promise<WarehouseSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_WAREHOUSES');
  return coreListWarehouses(companyDb);
}

export async function createItem(input: CreateItemInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_ITEMS');
  return coreCreateItem(companyDb, input);
}

export async function listItems(): Promise<ItemSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.MANAGE_ITEMS');
  return coreListItems(companyDb);
}

export async function listBatchesForItem(itemId: string): Promise<ItemBatchSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.VIEW_REPORTS');
  return coreListBatchesForItem(companyDb, itemId);
}

export async function recordOpeningStock(input: RecordOpeningStockInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('INVENTORY.RECORD_OPENING_STOCK');
  const result = await coreRecordOpeningStock(
    companyDb,
    {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      manufactureDate: input.manufactureDate,
      quantityThousandths: unitsToThousandths(input.quantityUnits),
      ratePaise: rupeesToPaise(input.ratePerUnitRupees),
      movementDate: input.movementDate,
    },
    info.userId,
  );
  return result.movementId;
}

export async function postStockAdjustment(systemDb: Kysely<SystemDatabase>, input: PostStockAdjustmentInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('INVENTORY.ADJUST_STOCK');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.movementDate);
  const result = await corePostStockAdjustment(
    companyDb,
    {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      batchId: input.batchId,
      direction: input.direction,
      quantityThousandths: unitsToThousandths(input.quantityUnits),
      ratePaise: input.ratePerUnitRupees !== undefined ? rupeesToPaise(input.ratePerUnitRupees) : undefined,
      movementDate: input.movementDate,
      financialYear,
      narration: input.narration,
    },
    info.userId,
  );
  return result.movementId;
}

export async function cancelStockAdjustment(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('INVENTORY.ADJUST_STOCK');
  const reversalDate = new Date().toISOString().slice(0, 10);
  const reversalFinancialYear = await financialYearFor(systemDb, info.companyId, reversalDate);
  return coreCancelStockAdjustment(companyDb, voucherId, reversalFinancialYear, reversalDate, info.userId);
}

export async function transferStock(input: TransferStockInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('INVENTORY.TRANSFER_STOCK');
  const result = await coreTransferStock(
    companyDb,
    {
      itemId: input.itemId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      batchId: input.batchId,
      quantityThousandths: unitsToThousandths(input.quantityUnits),
      movementDate: input.movementDate,
    },
    info.userId,
  );
  return result.outMovementId;
}

export async function listStockMovements(): Promise<StockMovementSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.VIEW_REPORTS');
  const rows = await coreListStockMovements(companyDb);
  return rows.map((row) => ({
    ...row,
    quantityUnits: thousandthsToUnits(row.quantityThousandths),
    ratePerUnitRupees: paiseToRupees(row.ratePaise),
    valueRupees: paiseToRupees(row.valuePaise),
  }));
}

export async function getStockPosition(query: StockPositionQuery): Promise<StockPositionRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('INVENTORY.VIEW_REPORTS');
  const rows = await coreComputeStockPosition(companyDb, query);
  return rows.map((row) => ({ ...row, quantityUnits: thousandthsToUnits(row.quantityThousandths), valueRupees: paiseToRupees(row.valuePaise) }));
}
