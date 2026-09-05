/**
 * The only contract shared between main and renderer. Keeping it here (not
 * importing db-schema/core-* types directly into the renderer) is the IPC
 * boundary: business logic and DB access stay in the main process (Rule #1).
 */

export interface CompanySummary {
  id: string;
  legalName: string;
  tradeName: string | null;
  entityType: string;
  isActive: boolean;
}

export interface CreateCompanyInput {
  legalName: string;
  tradeName: string;
  entityType: string;
  stateCode: string;
  financialYearStartMonth: number;
  baseCurrency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CreateCompanyResult {
  company: CompanySummary;
  /** Shown to the user exactly once — never retrievable again. See RecoveryKeyScreen. */
  recoveryKey: string;
}

export interface LoginInput {
  companyId: string;
  email: string;
  password: string;
}

/** A successful login either yields a session, or — if this credential was set by an admin reset — requires the user to set a real password first. */
export type LoginResult = { mustChangePassword: true } | { mustChangePassword: false; session: SessionInfo };

export interface ChangePasswordInput {
  companyId: string;
  email: string;
  /** The password the user just logged in with (temporary or otherwise) — re-verified server-side, never trusted from a prior call. */
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  companyId: string;
  email: string;
  recoveryKey: string;
  newPassword: string;
}

/** Requires the caller's session to already carry SYSTEM.RESET_USER_PASSWORD for the company it's scoped to — see main/handlers.ts. The temporary password is generated server-side, never supplied by the caller. */
export interface AdminResetPasswordInput {
  targetEmail: string;
}

export interface AdminResetPasswordResult {
  temporaryPassword: string;
}

export interface CompanyUserSummary {
  email: string;
  name: string;
  roleName: string;
}

export type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type BalanceSide = 'DEBIT' | 'CREDIT';
export type VoucherType = 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'SALES_INVOICE' | 'PURCHASE_INVOICE';

export interface AccountGroupSummary {
  id: string;
  name: string;
  parentGroupId: string | null;
  nature: AccountNature;
  isSystemGroup: boolean;
}

export interface LedgerAccountSummary {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  nature: AccountNature;
  openingBalance: number;
  openingBalanceSide: BalanceSide;
  isSystemLedger: boolean;
}

export interface CreateLedgerInput {
  name: string;
  groupId: string;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. */
  openingBalanceRupees: number;
  openingBalanceSide: BalanceSide;
}

export interface VoucherLineInput {
  ledgerId: string;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. Exactly one of debit/credit per line. */
  debitRupees: number;
  creditRupees: number;
  lineNarration?: string;
}

export interface CreateVoucherInput {
  voucherType: VoucherType;
  voucherDate: string;
  narration?: string;
  lines: VoucherLineInput[];
}

export interface VoucherSummary {
  id: string;
  voucherType: VoucherType;
  voucherNumber: number;
  financialYear: string;
  voucherDate: string;
  narration: string | null;
  /** Rupees. */
  totalAmount: number;
  cancelledAt: string | null;
  cancelledByVoucherId: string | null;
  reversesVoucherId: string | null;
}

export interface TrialBalanceRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  /** Rupees, for display. */
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface ProfitAndLossRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  /** Rupees. Positive = income earned / expense incurred. */
  amount: number;
}

export interface ProfitAndLossInput {
  fromDate: string;
  toDate: string;
}

export interface ProfitAndLossResult {
  incomeRows: ProfitAndLossRow[];
  expenseRows: ProfitAndLossRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export interface BalanceSheetRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  /** Rupees. Debit-positive for ASSET rows, credit-positive for LIABILITY/EQUITY rows. */
  amount: number;
}

export interface BalanceSheetResult {
  asOfDate: string;
  assetRows: BalanceSheetRow[];
  liabilityRows: BalanceSheetRow[];
  equityRows: BalanceSheetRow[];
  currentEarnings: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}

// --- Phase 2: Sales + Purchase ---

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED';
export type TdsSectionCode = '194C' | '194J' | '194Q' | '194I';

export interface PartySummary {
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

/** Rupees, as typed by the user — converted to paise at the IPC boundary, same convention as VoucherLineInput. */
export interface DocumentLineInput {
  description: string;
  ledgerId: string;
  amountRupees: number;
  taxLedgerId?: string;
  taxAmountRupees?: number;
  lineNarration?: string;
}

export interface CreateSalesInvoiceInput {
  partyId: string;
  invoiceDate: string;
  narration?: string;
  lines: DocumentLineInput[];
}

export interface CreatePurchaseInvoiceInput {
  partyId: string;
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
  netPayable: number;
}

export interface CreateSalesOrderInput {
  partyId: string;
  orderDate: string;
  narration?: string;
  lines: DocumentLineInput[];
}

export interface CreatePurchaseOrderInput {
  partyId: string;
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
  /** Rupees. Positive = normal direction; negative = a credit balance (e.g. an advance). */
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
  /** Rupees. Estimated via a FIFO settlement assumption — see core-sales-purchase. */
  estimatedOutstanding: number;
}

export interface SessionInfo {
  userId: string;
  userName: string;
  email: string;
  companyId: string;
  companyName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const IPC = {
  LIST_COMPANIES: 'system:listCompanies',
  CREATE_COMPANY: 'system:createCompany',
  LIST_COMPANY_USERS: 'system:listCompanyUsers',
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
  GET_SESSION: 'auth:getSession',
  CHANGE_PASSWORD: 'auth:changePassword',
  RESET_PASSWORD: 'auth:resetPassword',
  ADMIN_RESET_PASSWORD: 'auth:adminResetPassword',
  LIST_ACCOUNT_GROUPS: 'accounting:listAccountGroups',
  LIST_LEDGERS: 'accounting:listLedgers',
  CREATE_LEDGER: 'accounting:createLedger',
  CREATE_VOUCHER: 'accounting:createVoucher',
  LIST_VOUCHERS: 'accounting:listVouchers',
  CANCEL_VOUCHER: 'accounting:cancelVoucher',
  GET_TRIAL_BALANCE: 'accounting:getTrialBalance',
  GET_PROFIT_AND_LOSS: 'accounting:getProfitAndLoss',
  GET_BALANCE_SHEET: 'accounting:getBalanceSheet',
  LIST_PARTIES: 'salesPurchase:listParties',
  CREATE_PARTY: 'salesPurchase:createParty',
  CREATE_SALES_INVOICE: 'salesPurchase:createSalesInvoice',
  LIST_SALES_INVOICES: 'salesPurchase:listSalesInvoices',
  CREATE_PURCHASE_INVOICE: 'salesPurchase:createPurchaseInvoice',
  LIST_PURCHASE_INVOICES: 'salesPurchase:listPurchaseInvoices',
  CREATE_SALES_ORDER: 'salesPurchase:createSalesOrder',
  LIST_SALES_ORDERS: 'salesPurchase:listSalesOrders',
  CONFIRM_SALES_ORDER: 'salesPurchase:confirmSalesOrder',
  CANCEL_SALES_ORDER: 'salesPurchase:cancelSalesOrder',
  CONVERT_SALES_ORDER: 'salesPurchase:convertSalesOrder',
  CREATE_PURCHASE_ORDER: 'salesPurchase:createPurchaseOrder',
  LIST_PURCHASE_ORDERS: 'salesPurchase:listPurchaseOrders',
  CONFIRM_PURCHASE_ORDER: 'salesPurchase:confirmPurchaseOrder',
  CANCEL_PURCHASE_ORDER: 'salesPurchase:cancelPurchaseOrder',
  CONVERT_PURCHASE_ORDER: 'salesPurchase:convertPurchaseOrder',
  LIST_RECEIVABLES: 'salesPurchase:listReceivables',
  LIST_PAYABLES: 'salesPurchase:listPayables',
  LIST_MSME_AGEING: 'salesPurchase:listMsmeAgeing',
} as const;
