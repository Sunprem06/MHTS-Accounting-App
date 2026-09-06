// Phase 3 (Inventory): items, units, warehouses, batches, FIFO/weighted-avg
// valuation. Pure TypeScript, zero Electron/UI dependency (Rule #1).
export { ITEM_TYPES, VALUATION_METHODS, MOVEMENT_TYPES } from './types';
export type {
  ItemType,
  ValuationMethod,
  UnitOfMeasureSummary,
  CreateUnitOfMeasureInput,
  WarehouseSummary,
  CreateWarehouseInput,
  ItemSummary,
  CreateItemInput,
  ItemBatchSummary,
  MovementType,
  StockMovementSummary,
  RecordOpeningStockInput,
  PostStockAdjustmentInput,
  TransferStockInput,
  StockPositionRow,
  StockPositionQuery,
} from './types';

export { INVENTORY_PERMISSIONS, grantInventoryPermissions } from './permissions';
export { seedInventoryLedgers, getInventoryLedgerIds } from './ledgers';
export type { InventoryLedgerIds } from './ledgers';

export { createUnitOfMeasure, listUnitsOfMeasure } from './units';
export { createWarehouse, listWarehouses } from './warehouses';
export { createItem, listItems, getItemOrThrow } from './items';
export { getOrCreateBatch, listBatchesForItem } from './batches';

export { consumeFifoLayersInTransaction, createFifoLayerInTransaction } from './stockLayers';
export type { LayerScope, FifoConsumptionResult } from './stockLayers';
export { computeCumulativePosition, computeWeightedAverageIssueCost } from './weightedAverage';
export {
  postPurchaseReceiptInTransaction,
  postPurchaseReceipt,
  postSalesIssueInTransaction,
  postSalesIssue,
  recordOpeningStockInTransaction,
  recordOpeningStock,
  listStockMovements,
  hasStockMovementsForReference,
} from './stockMovements';
export type { PostPurchaseReceiptInput, PostSalesIssueInput } from './stockMovements';
export { postStockAdjustmentInTransaction, postStockAdjustment, cancelStockAdjustment } from './stockAdjustments';
export { transferStockInTransaction, transferStock } from './stockTransfers';
export { computeStockPosition } from './stockPosition';
export { reverseOutboundMovementInTransaction, reverseInboundMovementInTransaction, reverseStockMovementsForReferenceInTransaction } from './stockReversals';
