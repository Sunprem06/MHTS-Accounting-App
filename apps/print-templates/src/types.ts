/** 'CLASSIC' | 'MODERN' — mirrors @mhts/core-company-profile's DocumentLayout, kept as a plain string here so this package stays dependency-free (pure HTML/CSS string building, no DB/Electron access of its own). */
export type DocumentLayout = 'CLASSIC' | 'MODERN';

export interface LetterheadForPrint {
  companyName: string;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  bankBranch: string | null;
  footerNote: string | null;
  /** A data: URI (e.g. 'data:image/png;base64,...') — null if no logo has been uploaded. */
  logoDataUrl: string | null;
  /** Hex, e.g. '#1a56db'. Null uses the layout's own default accent. */
  accentColorHex: string | null;
}

export interface InvoiceLineForPrint {
  description: string;
  hsnSacCode: string | null;
  itemName: string | null;
  /** Already converted from thousandths to a display quantity. Null for a service line. */
  quantity: number | null;
  unitSymbol: string | null;
  /** Rupees, per whole unit. */
  rate: number | null;
  /** Rupees. Taxable value. */
  taxableAmount: number;
  gstRatePercent: number | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  manualTaxAmount: number;
}

export interface InvoiceTemplateData {
  letterhead: LetterheadForPrint;
  voucherNumber: number;
  financialYear: string;
  invoiceDate: string;
  narration: string | null;
  cancelled: boolean;
  partyName: string;
  partyGstin: string | null;
  partyStateCode: string | null;
  partyAddress: string | null;
  /** Null (or the company's own base currency) for an ordinary invoice — no separate currency line is shown. */
  currency: string | null;
  lines: InvoiceLineForPrint[];
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  manualTaxAmount: number;
  totalAmount: number;
}

/** Phase 9 Increment 2 (Print + Templates) — same shape as InvoiceLineForPrint, reused as-is for a Purchase Invoice line (structurally identical: item/HSN/qty/rate/tax split). */
export type PurchaseInvoiceLineForPrint = InvoiceLineForPrint;

export interface PurchaseInvoiceTemplateData {
  letterhead: LetterheadForPrint;
  voucherNumber: number;
  financialYear: string;
  invoiceDate: string;
  narration: string | null;
  cancelled: boolean;
  partyName: string;
  partyGstin: string | null;
  partyStateCode: string | null;
  partyAddress: string | null;
  currency: string | null;
  isMsmeVendor: boolean;
  dueDate: string;
  tdsSection: string | null;
  /** Rupees. */
  tdsAmount: number;
  lines: PurchaseInvoiceLineForPrint[];
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  manualTaxAmount: number;
  totalAmount: number;
}

export type OrderKind = 'SALES_ORDER' | 'PURCHASE_ORDER';

/**
 * A Sales/Purchase Order line carries no CGST/SGST/IGST/Cess split (unlike
 * an invoice line) — only a flat tax amount, since GST isn't computed until
 * conversion to an invoice.
 */
export interface OrderLineForPrint {
  description: string;
  hsnSacCode: string | null;
  itemName: string | null;
  quantity: number | null;
  unitSymbol: string | null;
  rate: number | null;
  /** Rupees. Taxable value. */
  amount: number;
  taxAmount: number;
}

export interface OrderTemplateData {
  letterhead: LetterheadForPrint;
  kind: OrderKind;
  orderNumber: number;
  financialYear: string;
  orderDate: string;
  narration: string | null;
  status: string;
  convertedToInvoiceId: string | null;
  partyName: string;
  partyGstin: string | null;
  partyStateCode: string | null;
  partyAddress: string | null;
  lines: OrderLineForPrint[];
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/** Journal/Payment/Receipt/Contra — see @mhts/core-accounting's VoucherType; only these four route through this generic template (every other voucher type has its own richer, purpose-built print path). */
export type PrintableVoucherType = 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA';

export interface VoucherLineForPrint {
  ledgerName: string;
  /** Rupees. Exactly one of debitAmount/creditAmount is > 0. */
  debitAmount: number;
  creditAmount: number;
  lineNarration: string | null;
  costCentreName: string | null;
  branchName: string | null;
}

export interface VoucherTemplateData {
  letterhead: LetterheadForPrint;
  voucherType: PrintableVoucherType;
  voucherNumber: number;
  financialYear: string;
  voucherDate: string;
  narration: string | null;
  cancelled: boolean;
  lines: VoucherLineForPrint[];
  totalAmount: number;
}

export interface ExpenseClaimLineForPrint {
  expenseLedgerName: string;
  description: string;
  expenseDate: string;
  /** Rupees. */
  amount: number;
  lineNarration: string | null;
}

export interface ExpenseClaimTemplateData {
  letterhead: LetterheadForPrint;
  employeeName: string;
  claimNumber: number;
  financialYear: string;
  claimDate: string;
  purpose: string | null;
  status: string;
  rejectedReason: string | null;
  lines: ExpenseClaimLineForPrint[];
  totalAmount: number;
}

export type PayslipLineType = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';

export interface PayslipLineForPrint {
  lineType: PayslipLineType;
  label: string;
  /** Rupees. */
  amount: number;
}

export interface PayslipTemplateData {
  letterhead: LetterheadForPrint;
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  pan: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  uan: string | null;
  financialYear: string;
  periodMonth: number;
  periodYear: number;
  /** Already converted from tenths-of-a-day to a display day count. */
  paidDays: number;
  lopDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  lines: PayslipLineForPrint[];
}
