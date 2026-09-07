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
