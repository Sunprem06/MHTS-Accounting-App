/** A counterparty is often both — one table, distinguished by type, rather than forcing a business to pick. */
export const PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const ORDER_STATUSES = ['DRAFT', 'CONFIRMED', 'CONVERTED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Fixed legal section identifiers (Income Tax Act) — a closed vocabulary
 * like ACCOUNT_NATURES/VOUCHER_TYPES, not a rate. The *rate* and *threshold*
 * for each section are resolved from the versioned rule_set table (system
 * DB) via @mhts/core-rules-engine, never hardcoded here (CLAUDE.md Rule #2).
 */
export const TDS_SECTIONS = [
  { code: '194C', description: 'Payments to contractors / sub-contractors' },
  { code: '194J', description: 'Fees for professional or technical services' },
  { code: '194Q', description: 'Purchase of goods (buyer turnover > Rs 10 crore in preceding FY)' },
  { code: '194I', description: 'Rent (land, building, plant, machinery, furniture)' },
] as const;
export type TdsSectionCode = (typeof TDS_SECTIONS)[number]['code'];

/** Shape of the rule_payload JSON stored in rule_set for rule_type `TDS_RATE_<section>`. */
export interface TdsRatePayload {
  ratePercent: number;
  /** Paise. Cumulative taxable value in the financial year, per (party, section), below which no TDS applies. */
  thresholdAmount: number;
}

export interface BusinessPartySummary {
  id: string;
  partyType: PartyType;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  isMsmeUdyamRegistered: boolean;
  udyamRegistrationNumber: string | null;
  creditPeriodDays: number | null;
  ledgerAccountId: string;
  isActive: boolean;
}

export interface CreatePartyInput {
  partyType: PartyType;
  name: string;
  gstin?: string;
  stateCode?: string;
  isMsmeUdyamRegistered: boolean;
  udyamRegistrationNumber?: string;
  creditPeriodDays?: number;
}

/** One line of an invoice or order. Tax is manually entered against any existing Duties & Taxes ledger — GST auto-computation lands in Phase 4. */
export interface DocumentLineInput {
  description: string;
  /** Income ledger (sales) or expense ledger (purchase). */
  ledgerId: string;
  /** Paise. Taxable value. */
  amount: number;
  taxLedgerId?: string;
  /** Paise. */
  taxAmount?: number;
  lineNarration?: string;
}

export interface CreateSalesInvoiceInput {
  partyId: string;
  financialYear: string;
  invoiceDate: string;
  narration?: string;
  lines: DocumentLineInput[];
}

export interface CreatePurchaseInvoiceInput {
  partyId: string;
  financialYear: string;
  invoiceDate: string;
  narration?: string;
  tdsSection?: TdsSectionCode;
  lines: DocumentLineInput[];
}

export interface InvoiceSummary {
  id: string;
  voucherId: string;
  voucherNumber: number;
  financialYear: string;
  partyId: string;
  partyName: string;
  invoiceDate: string;
  narration: string | null;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  cancelledAt: string | null;
}

export interface PurchaseInvoiceSummary extends InvoiceSummary {
  isMsmeVendor: boolean;
  dueDate: string;
  tdsSection: string | null;
  tdsAmount: number;
  /** totalAmount - tdsAmount: what's actually payable to the supplier. */
  netPayable: number;
}

export interface CreateSalesOrderInput {
  partyId: string;
  financialYear: string;
  orderDate: string;
  narration?: string;
  lines: DocumentLineInput[];
}

export interface CreatePurchaseOrderInput {
  partyId: string;
  financialYear: string;
  orderDate: string;
  narration?: string;
  tdsSection?: TdsSectionCode;
  lines: DocumentLineInput[];
}

export interface OrderSummary {
  id: string;
  orderNumber: number;
  financialYear: string;
  partyId: string;
  partyName: string;
  orderDate: string;
  status: OrderStatus;
  narration: string | null;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  convertedToInvoiceId: string | null;
}

export interface PartyOutstandingRow {
  partyId: string;
  partyName: string;
  ledgerId: string;
  isMsmeUdyamRegistered: boolean;
  /** Paise. Positive = normal direction (customer owes us / we owe supplier). Negative means a credit balance (e.g. an advance) in the unusual direction — reports include these too rather than silently dropping them. */
  outstandingAmount: number;
}

export interface MsmeAgeingRow {
  partyId: string;
  partyName: string;
  invoiceId: string;
  voucherNumber: number;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  /**
   * Estimated via a FIFO settlement assumption (oldest invoices assumed
   * paid first) since this pass doesn't track bill-wise (invoice-level)
   * payment allocation — a known simplification, see Phase Tracker Open
   * Questions. Paise.
   */
  estimatedOutstanding: number;
}
