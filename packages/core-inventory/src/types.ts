/** A non-stockable item (e.g. a service) behaves like a plain description line always did — no stock movement, no batch/valuation concept. */
export const ITEM_TYPES = ['STOCKABLE', 'SERVICE'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const VALUATION_METHODS = ['FIFO', 'WEIGHTED_AVERAGE'] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export interface UnitOfMeasureSummary {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

export interface CreateUnitOfMeasureInput {
  name: string;
  symbol: string;
}

export interface WarehouseSummary {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface CreateWarehouseInput {
  name: string;
  address?: string;
}

export interface ItemSummary {
  id: string;
  itemCode: string;
  name: string;
  itemType: ItemType;
  unitId: string | null;
  unitName: string | null;
  hsnSacCode: string | null;
  isBatchTracked: boolean;
  valuationMethod: ValuationMethod | null;
  defaultSalesLedgerId: string | null;
  isActive: boolean;
}

export interface CreateItemInput {
  itemCode: string;
  name: string;
  itemType: ItemType;
  /** Required for STOCKABLE, ignored for SERVICE. */
  unitId?: string;
  hsnSacCode?: string;
  /** Only meaningful for STOCKABLE. */
  isBatchTracked?: boolean;
  /** Required for STOCKABLE, ignored for SERVICE. */
  valuationMethod?: ValuationMethod;
  defaultSalesLedgerId?: string;
}

export interface ItemBatchSummary {
  id: string;
  itemId: string;
  batchNumber: string;
  expiryDate: string | null;
  manufactureDate: string | null;
}

/**
 * Quantities are stored as integers in thousandths of a unit (3-decimal
 * precision, matching GST e-invoice quantity precision) — the same
 * "never REAL/float" discipline used for money (paise), applied here to
 * avoid the identical class of rounding bug in valuation math.
 */
export const MOVEMENT_TYPES = [
  'OPENING_STOCK',
  'PURCHASE_RECEIPT',
  'SALES_ISSUE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  /** Reversal types (stock-movement reversal feature) — dedicated types rather than doubling up on PURCHASE_RECEIPT/SALES_ISSUE, so the Stock Movement Register stays unambiguous about what's being reversed. */
  'SALES_ISSUE_REVERSAL',
  'PURCHASE_RECEIPT_REVERSAL',
  'ADJUSTMENT_IN_REVERSAL',
  'ADJUSTMENT_OUT_REVERSAL',
  /** Phase 8 Increment 3 (Manufacturing) — see @mhts/core-manufacturing. No reversal types yet: cancelling a posted manufacturing journal is deliberately out of scope this pass. */
  'MANUFACTURING_CONSUME',
  'MANUFACTURING_PRODUCE',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Shared by weightedAverage.ts's cumulative position and stockPosition.ts's
 * on-hand reporting — kept in one place so the two can't drift out of sync
 * (they used to be independently duplicated lists). A movement's sign in
 * both the running weighted-average pool and the on-hand quantity/value is
 * determined purely by which of these two lists it's in.
 */
const INBOUND_MOVEMENT_TYPES_TYPED: readonly MovementType[] = ['OPENING_STOCK', 'PURCHASE_RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'SALES_ISSUE_REVERSAL', 'ADJUSTMENT_OUT_REVERSAL', 'MANUFACTURING_PRODUCE'];
const OUTBOUND_MOVEMENT_TYPES_TYPED: readonly MovementType[] = ['SALES_ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'PURCHASE_RECEIPT_REVERSAL', 'ADJUSTMENT_IN_REVERSAL', 'MANUFACTURING_CONSUME'];
/** Typed as readonly string[] (not MovementType[]) at the exported boundary — every call site checks a raw movement_type string read back from the DB, not a value already known to be a MovementType. The *_TYPED consts above exist only so this list itself is checked against MovementType at compile time. */
export const INBOUND_MOVEMENT_TYPES: readonly string[] = INBOUND_MOVEMENT_TYPES_TYPED;
export const OUTBOUND_MOVEMENT_TYPES: readonly string[] = OUTBOUND_MOVEMENT_TYPES_TYPED;

export interface StockMovementSummary {
  id: string;
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string | null;
  batchNumber: string | null;
  movementType: MovementType;
  quantityThousandths: number;
  ratePaise: number;
  valuePaise: number;
  referenceType: string | null;
  referenceId: string | null;
  movementDate: string;
}

export interface RecordOpeningStockInput {
  itemId: string;
  warehouseId: string;
  /** Required if the item is batch-tracked. */
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  quantityThousandths: number;
  ratePaise: number;
  movementDate: string;
}

export interface PostStockAdjustmentInput {
  itemId: string;
  warehouseId: string;
  batchId?: string;
  direction: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantityThousandths: number;
  /** Required for ADJUSTMENT_IN (there's no receipt to draw a rate from). Ignored for ADJUSTMENT_OUT — cost is drawn from existing stock the same way a sale would be. */
  ratePaise?: number;
  movementDate: string;
  financialYear: string;
  narration?: string;
}

export interface TransferStockInput {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  batchId?: string;
  quantityThousandths: number;
  movementDate: string;
}

export interface StockPositionRow {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string | null;
  batchNumber: string | null;
  quantityThousandths: number;
  valuePaise: number;
}

export interface StockPositionQuery {
  itemId?: string;
  warehouseId?: string;
  batchId?: string;
  asOfDate?: string;
}
