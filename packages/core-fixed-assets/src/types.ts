/** Companies Act Schedule II rate — the "book depreciation" rate, resolved via @mhts/core-rules-engine, never hardcoded (CLAUDE.md Rule #2). */
export interface Schedule2RatePayload {
  method: 'SLM' | 'WDV';
  /** Plain percent, decimals allowed (e.g. 18.10) — same convention as payroll's ESI rate (0.75), not basis points. */
  ratePercent: number;
}

/** Income Tax Act WDV block rate — the "tax depreciation" rate, resolved via @mhts/core-rules-engine, never hardcoded. */
export interface ItWdvBlockRatePayload {
  ratePercent: number;
}

export const ASSET_STATUSES = ['ACTIVE', 'DISPOSED'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const DEPRECIATION_BOOKS = ['SCHEDULE2', 'IT_WDV'] as const;
export type DepreciationBook = (typeof DEPRECIATION_BOOKS)[number];

export interface AssetClassSummary {
  id: string;
  name: string;
  schedule2RateCategory: string;
  itWdvBlockCategory: string;
  grossBlockLedgerId: string;
  grossBlockLedgerName: string;
  accumulatedDepreciationLedgerId: string;
  accumulatedDepreciationLedgerName: string;
  isActive: boolean;
}

export interface CreateAssetClassInput {
  name: string;
  schedule2RateCategory: string;
  itWdvBlockCategory: string;
}

export interface FixedAssetSummary {
  id: string;
  assetClassId: string;
  assetClassName: string;
  name: string;
  assetCode: string;
  purchaseDate: string;
  purchaseCostPaise: number;
  salvageValuePaise: number;
  costCentreId: string | null;
  status: AssetStatus;
  disposedAt: string | null;
  acquisitionVoucherId: string | null;
  disposalVoucherId: string | null;
}

export interface AcquireFixedAssetInput {
  assetClassId: string;
  name: string;
  assetCode: string;
  purchaseDate: string;
  /** Paise. */
  purchaseCostPaise: number;
  /** Paise. Defaults to 0. */
  salvageValuePaise?: number;
  costCentreId?: string;
  financialYear: string;
  /** Ledger the acquisition is paid/payable from (Bank or the supplier's own ledger). */
  paidFromLedgerId: string;
  narration?: string;
}

export interface AssetDepreciationEntrySummary {
  book: DepreciationBook;
  financialYear: string;
  openingWdvPaise: number;
  depreciationAmountPaise: number;
  closingWdvPaise: number;
  voucherId: string | null;
}

export interface DisposeFixedAssetInput {
  assetId: string;
  disposalDate: string;
  financialYear: string;
  /** Paise. Sale proceeds, if any — 0 for a write-off. */
  saleProceedsPaise: number;
  /** Ledger receiving the sale proceeds (Bank, or a Debtor if sold on credit). Required only when saleProceedsPaise > 0. */
  receiptLedgerId?: string;
  narration?: string;
}
