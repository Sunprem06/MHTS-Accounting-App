export interface BillOfMaterialLineInput {
  componentItemId: string;
  /** Thousandths of a unit, needed per outputQuantityThousandths of output. */
  quantityThousandths: number;
}

export interface CreateBillOfMaterialInput {
  outputItemId: string;
  /** Thousandths of a unit. The quantity of output this recipe's lines are expressed against. */
  outputQuantityThousandths: number;
  lines: BillOfMaterialLineInput[];
}

export interface BillOfMaterialLineSummary {
  id: string;
  componentItemId: string;
  componentItemName: string;
  quantityThousandths: number;
}

export interface BillOfMaterialSummary {
  id: string;
  outputItemId: string;
  outputItemName: string;
  outputQuantityThousandths: number;
  isActive: boolean;
  lines: BillOfMaterialLineSummary[];
}

export interface PostManufacturingJournalInput {
  bomId: string;
  /** Both components consumed and output produced happen in this one warehouse — no multi-warehouse split per component this pass. */
  warehouseId: string;
  quantityProducedThousandths: number;
  /** Required if the output item is batch-tracked. */
  outputBatchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  /** Which existing batch to consume from, per batch-tracked component — keyed by componentItemId. Required for every component that is batch-tracked. */
  componentBatchIds?: Record<string, string>;
  financialYear: string;
  journalDate: string;
  narration?: string;
}

export interface ManufacturingJournalSummary {
  id: string;
  bomId: string;
  outputItemId: string;
  outputItemName: string;
  warehouseId: string;
  warehouseName: string;
  quantityProducedThousandths: number;
  /** Paise. */
  totalCostPaise: number;
  voucherId: string;
  financialYear: string;
  journalDate: string;
  narration: string | null;
}

export interface ManufacturingJournalMovementSummary {
  itemId: string;
  itemName: string;
  /** 'MANUFACTURING_CONSUME' | 'MANUFACTURING_PRODUCE'. */
  movementType: string;
  quantityThousandths: number;
  ratePaise: number;
  valuePaise: number;
  batchNumber: string | null;
}
