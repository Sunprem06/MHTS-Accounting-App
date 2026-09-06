import type { BalanceSide } from '@mhts/core-accounting';

/** Fixed taxonomy — not a rule_set, CLAUDE.md Rule #2 governs legislated rates/formulas, not this. */
export const ACCOUNT_TYPES = ['SAVINGS', 'CURRENT', 'CC', 'OD'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const INSTRUMENT_TYPES = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'DD', 'CARD'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const INSTRUMENT_STATUSES = ['PENDING', 'PRESENTED', 'CLEARED', 'BOUNCED', 'CANCELLED'] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

/** The bank's OWN statement terminology — CREDIT = the bank put money in (a deposit), DEBIT = the bank took money out (a withdrawal). This is the opposite sense of our own ledger's debit/credit on an asset ledger — see reconciliation.ts and statementImport.ts for where the flip is applied. */
export const STATEMENT_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
export type StatementDirection = (typeof STATEMENT_DIRECTIONS)[number];

export const MATCH_STATUSES = ['MATCHED', 'UNMATCHED', 'IGNORED'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCHED_VIA = ['MANUAL', 'IMPORT'] as const;
export type MatchedVia = (typeof MATCHED_VIA)[number];

export interface BankAccountSummary {
  id: string;
  ledgerAccountId: string;
  ledgerName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string | null;
  accountType: AccountType;
  isActive: boolean;
  /** Paise. Current book balance (debit-positive) of this bank's own ledger, since inception. */
  currentBalance: number;
}

export interface CreateBankAccountInput {
  /** Also becomes the name of this bank account's dedicated ledger_account. */
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: AccountType;
  /** Paise. Defaults to 0/DEBIT, same as any other ledger_account. */
  openingBalance?: number;
  openingBalanceSide?: BalanceSide;
}

export interface PaymentInstrumentInput {
  instrumentType: InstrumentType;
  chequeNumber?: string;
  chequeDate?: string;
  utrReference?: string;
}

export interface PaymentInstrumentSummary {
  id: string;
  voucherId: string;
  voucherType: string;
  voucherNumber: number;
  voucherDate: string;
  instrumentType: InstrumentType;
  chequeNumber: string | null;
  chequeDate: string | null;
  utrReference: string | null;
  instrumentStatus: InstrumentStatus;
  statusDate: string | null;
}

export interface ReconcilableLineRow {
  voucherLineId: string;
  voucherId: string;
  voucherType: string;
  voucherNumber: number;
  voucherDate: string;
  narration: string | null;
  /** Paise. Exactly one of these is non-zero, per the voucher engine's own invariant. */
  debitAmount: number;
  creditAmount: number;
  isReconciled: boolean;
  reconciledAt: string | null;
  bankStatementDate: string | null;
  matchedVia: MatchedVia | null;
}

export interface BankReconciliationStatement {
  bankLedgerId: string;
  asOfDate: string;
  /** Paise. computeLedgerBalances' netSigned for this one ledger, up to asOfDate. */
  bookBalance: number;
  /** Paise. Sum of credit_amount on unreconciled lines up to asOfDate — issued/outgoing amounts the bank hasn't processed yet. */
  unclearedPayments: number;
  /** Paise. Sum of debit_amount on unreconciled lines up to asOfDate — deposits the bank hasn't reflected yet. */
  unclearedReceipts: number;
  /** Paise. bookBalance + unclearedPayments - unclearedReceipts. */
  calculatedBankBalance: number;
  unclearedLineCount: number;
}

export interface ParsedStatementLine {
  statementDate: string;
  description: string;
  /** Always positive. Paise. */
  amountPaise: number;
  direction: StatementDirection;
}

export interface StatementColumnMapping {
  dateColumnIndex: number;
  descriptionColumnIndex: number;
  /** 'single-with-type': one amount column + one Dr/Cr (or Debit/Credit) type column. 'separate-debit-credit': two amount columns, one per direction, blank/zero when not applicable. */
  amountMode: 'single-with-type' | 'separate-debit-credit';
  amountColumnIndex?: number;
  typeColumnIndex?: number;
  debitColumnIndex?: number;
  creditColumnIndex?: number;
  /** How dates are written in this file, e.g. 'DD/MM/YYYY' or 'YYYY-MM-DD' — most Indian bank exports use DD/MM/YYYY, never assume ISO. */
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}

export interface StatementImportSummary {
  id: string;
  bankAccountId: string;
  fileName: string;
  importedAt: string;
  totalLines: number;
  matchedLines: number;
  unmatchedLines: number;
}

export interface StatementLineSummary {
  id: string;
  importId: string;
  statementDate: string;
  description: string;
  amountPaise: number;
  direction: StatementDirection;
  matchStatus: MatchStatus;
  matchedVoucherLineId: string | null;
  isLikelyDuplicate: boolean;
  /** Populated only when matchStatus is UNMATCHED and there was more than one same-amount/in-window candidate — for the manual-resolution UI. */
  candidateVoucherLineIds?: string[];
}

export interface ImportStatementResult {
  import: StatementImportSummary;
  lines: StatementLineSummary[];
}
