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
  /** Phase 10 Increment 3 (Demo Mode) — the single sandbox company a "Try Demo" click creates. */
  isDemo: boolean;
}

export type GstRegistrationType = 'REGULAR' | 'COMPOSITION';

export interface CreateCompanyInput {
  legalName: string;
  tradeName: string;
  entityType: string;
  stateCode: string;
  /** Phase 4 increment 2 — set once at company creation, not editable afterward in this pass (see Phase Tracker Open Questions). */
  gstRegistrationType: GstRegistrationType;
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

export interface RoleSummary {
  id: string;
  name: string;
}

export interface PermissionSummary {
  code: string;
  description: string | null;
}

export interface RoleWithPermissionsSummary {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissionCodes: string[];
}

export interface CreateRoleInput {
  name: string;
  permissionCodes: string[];
}

export interface UpdateRolePermissionsInput {
  roleId: string;
  permissionCodes: string[];
}

/** name is only used when this email doesn't already have an AppUser identity — an existing identity keeps its own name. */
export interface InviteUserInput {
  email: string;
  name: string;
  roleId: string;
}

export interface InviteUserResult {
  temporaryPassword: string;
}

export type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type BalanceSide = 'DEBIT' | 'CREDIT';
export type VoucherType =
  | 'JOURNAL'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'STOCK_ADJUSTMENT'
  | 'EXPENSE_CLAIM'
  | 'PAYROLL'
  | 'GRATUITY_PROVISION'
  | 'ASSET_ACQUISITION'
  | 'DEPRECIATION'
  | 'ASSET_DISPOSAL'
  | 'FX_REVALUATION'
  | 'INTER_BRANCH_TRANSFER';

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
  /** Phase 8 (Advanced ERP) — optional dimension tag. */
  costCentreId?: string;
  /** Phase 8 Increment 2 — optional dimension tag. */
  branchId?: string;
  /** Phase 8 Increment 2 (multi-currency) — all three set together or not at all. exchangeRate is a plain decimal (e.g. 83.25); converted to micros at the IPC boundary. foreignAmountUnits is in the foreign currency's major units (e.g. USD dollars), matching debitRupees/creditRupees's own convention. */
  foreignCurrency?: string;
  foreignAmountUnits?: number;
  exchangeRate?: number;
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
  /** Phase 9 Increment 1 (Print + Templates) — the printed "Bill To" address. */
  address: string | null;
}

export interface CreatePartyInput {
  partyType: PartyType;
  name: string;
  gstin?: string;
  stateCode?: string;
  isMsmeUdyamRegistered: boolean;
  udyamRegistrationNumber?: string;
  creditPeriodDays?: number;
  address?: string;
}

/** Phase 9 Increment 1 (Print + Templates) — the only party field editable after creation so far. */
export interface UpdateBusinessPartyAddressInput {
  partyId: string;
  address: string | null;
}

/** Rupees, as typed by the user — converted to paise at the IPC boundary, same convention as VoucherLineInput. */
export interface DocumentLineInput {
  description: string;
  ledgerId: string;
  amountRupees: number;
  taxLedgerId?: string;
  taxAmountRupees?: number;
  /** Phase 4 (GST) — mutually exclusive with taxLedgerId/taxAmountRupees. See core-sales-purchase's DocumentLineInput. */
  hsnSacCode?: string;
  /** Phase 4 increment 2 (ITC) — purchase lines only. Defaults to true when omitted. */
  itcEligible?: boolean;
  itcIneligibilityReason?: string;
  /** Phase 4 increment 2 (reverse charge) — either side. See core-sales-purchase's DocumentLineInput. */
  isReverseCharge?: boolean;
  lineNarration?: string;
  /** Phase 3 (Inventory) — set only for a stockable item line, all four required together. Quantity/rate are decimal units here, converted to thousandths-of-a-unit/paise at the IPC boundary. */
  itemId?: string;
  warehouseId?: string;
  quantityUnits?: number;
  ratePerUnitRupees?: number;
  /** Sales line, batch-tracked item: which existing batch to issue from. */
  batchId?: string;
  /** Purchase line, batch-tracked item: the batch this receipt belongs to. */
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  /** Phase 8 Increment 2 (multi-currency) — this line's amount in the invoice's own currency, for display. Only meaningful when the invoice itself carries a currency/exchangeRate. */
  foreignAmountUnits?: number;
}

export interface CreateSalesInvoiceInput {
  partyId: string;
  invoiceDate: string;
  narration?: string;
  /** Phase 8 Increment 2 (multi-currency). Omit for an ordinary base-currency invoice. exchangeRate is a plain decimal (e.g. 83.25). */
  currency?: string;
  exchangeRate?: number;
  /** Phase 8 Increment 2 (multi-branch). */
  branchId?: string;
  lines: DocumentLineInput[];
}

export interface CreatePurchaseInvoiceInput {
  partyId: string;
  invoiceDate: string;
  narration?: string;
  tdsSection?: TdsSectionCode;
  currency?: string;
  exchangeRate?: number;
  branchId?: string;
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

export interface OutstandingInvoiceRow {
  invoiceId: string;
  voucherId: string;
  voucherNumber: number;
  invoiceDate: string;
  dueDate: string | null;
  partyId: string;
  partyName: string;
  /** Rupees. */
  netAmount: number;
  settledAmount: number;
  outstandingAmount: number;
  /** Phase 8 Increment 2 (multi-currency). Null for a base-currency invoice. */
  currency: string | null;
  /** This invoice's own booking rate, as a plain decimal (e.g. 83.25) — the rate a settlement line's amountRupees must be consistent with. Null for a base-currency invoice. */
  exchangeRate: number | null;
  /** Foreign currency major units, only when currency is set. */
  outstandingForeignAmountUnits: number | null;
}

export interface SettlementLineInput {
  invoiceId: string;
  amountRupees: number;
  /** Phase 8 Increment 2 (multi-currency) — required together, only when settling against an FX invoice. See core-sales-purchase's SettlementLineInput for the realized-gain/loss mechanics. */
  foreignAmountUnits?: number;
  settlementExchangeRate?: number;
}

export interface RecordSalesReceiptInput {
  partyId: string;
  depositLedgerId: string;
  receiptDate: string;
  narration?: string;
  settlements: SettlementLineInput[];
}

export interface RecordPurchasePaymentInput {
  partyId: string;
  paymentLedgerId: string;
  paymentDate: string;
  narration?: string;
  settlements: SettlementLineInput[];
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

// --- Phase 4: GST Engine ---

export interface GstRateSummary {
  hsnSacCode: string;
  ratePercent: number;
  cessPercent: number;
  effectiveFrom: string;
  sourceReference: string | null;
  /** Browsing metadata only (e.g. "Electrical & Electronics" / "LED lighting") — no compliance meaning of its own. */
  category: string | null;
  description: string | null;
}

export interface GstRateVersion extends GstRateSummary {
  id: string;
  effectiveTo: string | null;
  version: number;
}

export interface CreateOrUpdateGstRateInput {
  hsnSacCode: string;
  ratePercent: number;
  cessPercent?: number;
  effectiveFrom: string;
  sourceReference?: string;
  category?: string;
  description?: string;
}

export interface GstRatePreviewInput {
  hsnSacCode: string;
  partyId: string;
  invoiceDate: string;
  amountRupees: number;
}

export interface GstRatePreviewResult {
  ratePercent: number;
  cessPercent: number;
  isIntraState: boolean;
  /** Rupees. */
  cgstRupees: number;
  sgstRupees: number;
  igstRupees: number;
  cessRupees: number;
  totalTaxRupees: number;
}

export interface GstSummaryInput {
  fromDate?: string;
  toDate?: string;
}

export interface GstSummaryResult {
  /** Rupees. */
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  outputCess: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
  inputCess: number;
  /** Rupees. Table 6.1-style net payable after set-off — see core-gst-engine's computeGstSetOff. */
  netCgstPayable: number;
  netSgstPayable: number;
  netIgstPayable: number;
  netCessPayable: number;
  carryForwardCgst: number;
  carryForwardSgst: number;
  carryForwardIgst: number;
  carryForwardCess: number;
  /** Rupees. GST that couldn't be claimed as credit (Section 17(5), or the company is on the composition scheme) — folded into cost instead. */
  blockedItcCgst: number;
  blockedItcSgst: number;
  blockedItcIgst: number;
  blockedItcCess: number;
  /** Rupees. Reverse-charge tax WE self-assessed on purchases — must be paid in cash, not eligible for set-off this period. */
  rcmInwardCgst: number;
  rcmInwardSgst: number;
  rcmInwardIgst: number;
  rcmInwardCess: number;
}

// --- Phase 4 increment 2: GST returns prep (GSTR-1/3B/9/9C) ---

export interface GstReturnPeriodInput {
  fromDate: string;
  toDate: string;
}

export interface GstFinancialYearInput {
  financialYear: string;
}

export interface Gstr1B2bInvoiceRow {
  invoiceId: string;
  voucherNumber: number;
  invoiceDate: string;
  partyName: string;
  partyGstin: string;
  partyStateCode: string | null;
  isReverseCharge: boolean;
  /** Rupees. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1B2cSummaryRow {
  stateCode: string | null;
  ratePercent: number;
  /** Rupees. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1HsnSummaryRow {
  hsnSacCode: string;
  /** Rupees. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1Result {
  b2bInvoices: Gstr1B2bInvoiceRow[];
  b2cSummary: Gstr1B2cSummaryRow[];
  hsnSummary: Gstr1HsnSummaryRow[];
}

export interface GstSetOffResult {
  /** Rupees. */
  netCgstPayable: number;
  netSgstPayable: number;
  netIgstPayable: number;
  netCessPayable: number;
  carryForwardCgst: number;
  carryForwardSgst: number;
  carryForwardIgst: number;
  carryForwardCess: number;
}

export interface Gstr3bResult {
  /** Rupees. */
  outwardTaxableValue: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  outwardCess: number;
  rcmInwardTaxableValue: number;
  rcmInwardCgst: number;
  rcmInwardSgst: number;
  rcmInwardIgst: number;
  rcmInwardCess: number;
  itcEligibleCgst: number;
  itcEligibleSgst: number;
  itcEligibleIgst: number;
  itcEligibleCess: number;
  itcIneligibleCgst: number;
  itcIneligibleSgst: number;
  itcIneligibleIgst: number;
  itcIneligibleCess: number;
  netPayable: GstSetOffResult;
}

export interface Gstr9Result extends Gstr3bResult {
  financialYear: string;
  fromDate: string;
  toDate: string;
  hsnSummary: Gstr1HsnSummaryRow[];
}

export interface ExportCsvInput {
  defaultFileName: string;
  csvContent: string;
}

export interface Gstr9cResult {
  financialYear: string;
  /** Rupees. */
  turnoverPerBooks: number;
  turnoverPerGstReturns: number;
  turnoverReconciliationGap: number;
  totalTaxDeclaredForYear: number;
}

// --- Phase 3: Inventory ---

export type ItemType = 'STOCKABLE' | 'SERVICE';
export type ValuationMethod = 'FIFO' | 'WEIGHTED_AVERAGE';

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

export interface CancelInvoiceInput {
  invoiceId: string;
}

export interface CreateItemInput {
  itemCode: string;
  name: string;
  itemType: ItemType;
  unitId?: string;
  hsnSacCode?: string;
  isBatchTracked?: boolean;
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

export type MovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE_RECEIPT'
  | 'SALES_ISSUE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'SALES_ISSUE_REVERSAL'
  | 'PURCHASE_RECEIPT_REVERSAL'
  | 'ADJUSTMENT_IN_REVERSAL'
  | 'ADJUSTMENT_OUT_REVERSAL';

export interface RecordOpeningStockInput {
  itemId: string;
  warehouseId: string;
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  quantityUnits: number;
  ratePerUnitRupees: number;
  movementDate: string;
}

export interface PostStockAdjustmentInput {
  itemId: string;
  warehouseId: string;
  batchId?: string;
  direction: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantityUnits: number;
  ratePerUnitRupees?: number;
  movementDate: string;
  narration?: string;
}

export interface TransferStockInput {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  batchId?: string;
  quantityUnits: number;
  movementDate: string;
}

export interface StockMovementSummary {
  id: string;
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string | null;
  batchNumber: string | null;
  movementType: MovementType;
  quantityUnits: number;
  ratePerUnitRupees: number;
  valueRupees: number;
  referenceType: string | null;
  referenceId: string | null;
  movementDate: string;
}

export interface StockPositionRow {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string | null;
  batchNumber: string | null;
  quantityUnits: number;
  valueRupees: number;
}

export interface StockPositionQuery {
  itemId?: string;
  warehouseId?: string;
  batchId?: string;
  asOfDate?: string;
}

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface RestoreResult {
  restored: boolean;
}

export interface LicensePayload {
  licenseId: string;
  issuedTo: string;
  brand: string;
  edition: string;
  maxCompanies: number | null;
  issuedAt: string;
  expiresAt: string | null;
}

export interface LicenseStatus {
  valid: boolean;
  payload?: LicensePayload;
  reason?: string;
  /** Null if perpetual (no expiresAt) or invalid. Can be negative — callers should treat <= 0 as already past its own grace, though checkLicenseStatus already fails `valid` once actually expired. */
  expiresInDays?: number | null;
}

/** Phase 10 Increment 3 (Demo Mode) — the 14-day, license-free window every install gets from first launch. Independent of LicenseStatus; createCompany's gate allows a company through when EITHER a valid license exists OR this is still active. */
export interface TrialStatus {
  active: boolean;
  daysRemaining: number;
}

/**
 * Pushed from main to renderer over the plain (non-`invoke`) `UPDATE_STATUS_EVENT`
 * channel — download progress can't be modeled as a request/response call, unlike
 * every other IPC surface in this codebase.
 */
export interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  /** 0-100, only present while state is 'downloading'. */
  percent?: number;
  message?: string;
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

// --- Phase 5: Banking ---

export type AccountType = 'SAVINGS' | 'CURRENT' | 'CC' | 'OD';
export type InstrumentType = 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'UPI' | 'IMPS' | 'DD' | 'CARD';
export type InstrumentStatus = 'PENDING' | 'PRESENTED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED';
export type StatementDirection = 'CREDIT' | 'DEBIT';
export type MatchStatus = 'MATCHED' | 'UNMATCHED' | 'IGNORED';
export type MatchedVia = 'MANUAL' | 'IMPORT';

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
  /** Rupees, for display. */
  currentBalance: number;
}

export interface CreateBankAccountInput {
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: AccountType;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. */
  openingBalanceRupees?: number;
  openingBalanceSide?: BalanceSide;
}

export interface PaymentInstrumentInput {
  instrumentType: InstrumentType;
  chequeNumber?: string;
  chequeDate?: string;
  utrReference?: string;
}

export interface RecordBankVoucherInput {
  voucherType: VoucherType;
  voucherDate: string;
  narration?: string;
  lines: VoucherLineInput[];
  instrument: PaymentInstrumentInput | null;
}

export interface UpdateInstrumentStatusInput {
  voucherId: string;
  status: InstrumentStatus;
  statusDate: string;
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
  /** Rupees. Exactly one of these is non-zero. */
  debitAmount: number;
  creditAmount: number;
  isReconciled: boolean;
  reconciledAt: string | null;
  bankStatementDate: string | null;
  matchedVia: MatchedVia | null;
}

export interface MarkReconciledInput {
  voucherLineId: string;
  bankStatementDate: string;
}

export interface BankReconciliationStatement {
  bankLedgerId: string;
  asOfDate: string;
  /** Rupees, for display (bookBalance/unclearedPayments/unclearedReceipts/calculatedBankBalance). */
  bookBalance: number;
  unclearedPayments: number;
  unclearedReceipts: number;
  calculatedBankBalance: number;
  unclearedLineCount: number;
}

export interface StatementPreview {
  headers: string[];
  previewRows: string[][];
}

export interface StatementColumnMapping {
  dateColumnIndex: number;
  descriptionColumnIndex: number;
  amountMode: 'single-with-type' | 'separate-debit-credit';
  amountColumnIndex?: number;
  typeColumnIndex?: number;
  debitColumnIndex?: number;
  creditColumnIndex?: number;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}

export interface ImportStatementFileInput {
  bankAccountId: string;
  fileName: string;
  csvText: string;
  mapping: StatementColumnMapping;
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
  /** Rupees, for display. */
  amount: number;
  direction: StatementDirection;
  matchStatus: MatchStatus;
  matchedVoucherLineId: string | null;
  isLikelyDuplicate: boolean;
  candidateVoucherLineIds?: string[];
}

export interface ImportStatementResult {
  import: StatementImportSummary;
  lines: StatementLineSummary[];
}

export interface ResolveStatementLineMatchInput {
  statementLineId: string;
  voucherLineId: string | null;
}

export interface ListReconcilableLinesInput {
  bankLedgerId: string;
  fromDate?: string;
  toDate?: string;
}

export interface GetReconciliationStatementInput {
  bankLedgerId: string;
  asOfDate: string;
}

// --- Phase 6: Expenses, Travel, Documents ---

export type ExpenseClaimStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED';

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  ledgerAccountId: string;
  isActive: boolean;
  /** Rupees, for display. */
  outstandingBalance: number;
}

export interface CreateEmployeeInput {
  employeeCode: string;
  name: string;
  department?: string;
}

export interface ExpenseClaimLineFormInput {
  expenseLedgerId: string;
  description: string;
  expenseDate: string;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. */
  amountRupees: number;
  lineNarration?: string;
}

export interface CreateExpenseClaimInput {
  employeeId: string;
  claimDate: string;
  purpose?: string;
  lines: ExpenseClaimLineFormInput[];
}

export interface ExpenseClaimLineSummary {
  id: string;
  expenseLedgerId: string;
  expenseLedgerName: string;
  description: string;
  expenseDate: string;
  /** Rupees, for display. */
  amount: number;
  lineNarration: string | null;
}

export interface ExpenseClaimSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  financialYear: string;
  claimNumber: number;
  claimDate: string;
  purpose: string | null;
  status: ExpenseClaimStatus;
  voucherId: string | null;
  rejectedReason: string | null;
  /** Rupees, for display. */
  totalAmount: number;
  lines: ExpenseClaimLineSummary[];
}

export interface RejectExpenseClaimInput {
  expenseClaimId: string;
  reason: string;
}

export interface OutstandingReimbursementRow {
  expenseClaimId: string;
  voucherId: string;
  voucherNumber: number;
  claimDate: string;
  employeeId: string;
  employeeName: string;
  /** Rupees, for display. */
  netAmount: number;
  settledAmount: number;
  outstandingAmount: number;
}

export interface ReimburseExpenseClaimInput {
  expenseClaimId: string;
  paymentLedgerId: string;
  paymentDate: string;
  narration?: string;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. */
  amountRupees: number;
  instrument?: PaymentInstrumentInput;
}

export interface DocumentSummary {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  description: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface UploadDocumentInput {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  /** Base64-encoded file content — crosses the IPC boundary as a string, decoded to a Buffer in the main-process handler. */
  fileDataBase64: string;
  description?: string;
}

export interface ListDocumentsForEntityInput {
  entityType: string;
  entityId: string;
}

export interface DownloadDocumentResult {
  fileName: string;
  saved: boolean;
}

export interface SearchDocumentsInput {
  query: string;
  entityType?: string;
}

// --- Phase 7: Payroll ---

export type EmploymentType = 'PERMANENT' | 'FIXED_TERM' | 'CONTRACTUAL' | 'CONSULTANT';
export type ComponentType = 'EARNING' | 'DEDUCTION';
export type CalculationType = 'FLAT' | 'PCT_OF_BASIC' | 'PCT_OF_CTC';
export type ApplicabilityMode = 'AUTO' | 'ALWAYS' | 'NEVER';
export type TdsRegime = 'NEW' | 'OLD';
export type LeaveApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF';
export type PayrollRunStatus = 'DRAFT' | 'PROCESSED' | 'POSTED' | 'CANCELLED';
export type PayslipLineType = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
export type GratuityRecordStatus = 'DRAFT' | 'SETTLED';

export interface EmployeePayrollProfileSummary {
  id: string;
  employeeCode: string;
  name: string;
  isActive: boolean;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  dateOfLeaving: string | null;
  employmentType: EmploymentType | null;
  pan: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  uan: string | null;
  esiNumber: string | null;
  pfVoluntaryOptOut: boolean;
  salaryPayableLedgerId: string | null;
  /** Phase 9 Increment 1 (Print + Templates) — shown on a printed payslip. */
  designation: string | null;
}

export interface UpdateEmployeePayrollProfileInput {
  employeeId: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  dateOfLeaving?: string;
  employmentType?: EmploymentType;
  pan?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  uan?: string;
  esiNumber?: string;
  pfVoluntaryOptOut?: boolean;
  designation?: string;
}

export interface SalaryComponentDefinitionInput {
  name: string;
  componentType: ComponentType;
  calculationType: CalculationType;
  /** Rupees. Only for calculationType 'FLAT'. */
  flatAmountRupees?: number;
  /** e.g. 40 for 40%. Only for the PCT_* calculation types. */
  percent?: number;
  isStatutoryWageBase: boolean;
  displayOrder?: number;
  expenseLedgerId?: string;
}

export interface SalaryComponentDefinitionSummary {
  id: string;
  name: string;
  componentType: ComponentType;
  calculationType: CalculationType;
  /** Rupees, for display. Null unless calculationType is 'FLAT'. */
  flatAmountRupees: number | null;
  /** e.g. 40 for 40%. Null unless calculationType is a PCT_* type. */
  percent: number | null;
  isStatutoryWageBase: boolean;
  displayOrder: number;
  expenseLedgerId: string | null;
  isActive: boolean;
}

export interface AssignSalaryStructureInput {
  employeeId: string;
  effectiveFrom: string;
  /** Rupees/year, as typed by the user — converted to paise at the IPC boundary. */
  annualCtcRupees: number;
}

export interface SalaryStructureLineSummary {
  componentId: string;
  componentName: string;
  componentType: ComponentType;
  isStatutoryWageBase: boolean;
  /** Rupees/month, for display. */
  monthlyAmount: number;
}

export interface SalaryStructureSummary {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Rupees/year, for display. */
  annualCtc: number;
  status: 'ACTIVE' | 'SUPERSEDED';
  lines: SalaryStructureLineSummary[];
  /** Rupees/month, for display. */
  monthlyStatutoryWageBase: number;
}

export interface CompanyPayrollSettingsSummary {
  pfApplicability: ApplicabilityMode;
  esiApplicability: ApplicabilityMode;
  gratuityApplicability: ApplicabilityMode;
  ptJurisdiction: string | null;
  tdsRegime: TdsRegime;
  /** Not persisted — computed live for display alongside the settings (see @mhts/core-payroll-engine's ResolvedApplicability). */
  resolvedApplicability?: {
    pfApplies: boolean;
    esiApplies: boolean;
    gratuityApplies: boolean;
    activeEmployeeCount: number;
    pfThreshold: number | null;
    esiThreshold: number | null;
    gratuityThreshold: number | null;
  };
}

export interface UpdateCompanyPayrollSettingsInput {
  pfApplicability?: ApplicabilityMode;
  esiApplicability?: ApplicabilityMode;
  gratuityApplicability?: ApplicabilityMode;
  ptJurisdiction?: string | null;
  tdsRegime?: TdsRegime;
}

export interface PayrollRuleVersionSummary {
  id: string;
  ruleType: string;
  jurisdiction: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  /** Shape depends on ruleType — see @mhts/core-payroll-engine's rules.ts payload types. Passed through as-is; the Manage Payroll Rules screen knows the shape for the ruleType it's editing. */
  payload: unknown;
  sourceReference: string | null;
}

export interface CreateOrUpdatePayrollRuleInput {
  ruleType: string;
  jurisdiction?: string | null;
  effectiveFrom: string;
  payload: unknown;
  sourceReference?: string;
}

export interface LeaveTypeInput {
  name: string;
  isPaid: boolean;
  annualEntitlementDays: number;
}

export interface LeaveTypeSummary {
  id: string;
  name: string;
  isPaid: boolean;
  annualEntitlementDays: number;
  isActive: boolean;
}

export interface ApplyLeaveInput {
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export interface LeaveApplicationSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: LeaveApplicationStatus;
  reason: string | null;
}

export interface RejectLeaveInput {
  leaveApplicationId: string;
  reason: string;
}

export interface LeaveBalanceSummary {
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  financialYear: string;
  openingBalanceDays: number;
  accruedDays: number;
  availedDays: number;
  balanceDays: number;
}

export interface MarkAttendanceInput {
  employeeIds: string[];
  fromDate: string;
  toDate: string;
  status: Exclude<AttendanceStatus, 'ON_LEAVE'>;
}

export interface AttendanceRecordSummary {
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
}

export interface ListAttendanceForEmployeeInput {
  employeeId: string;
  periodYear: number;
  periodMonth: number;
}

export interface CreatePayrollRunInput {
  periodMonth: number;
  periodYear: number;
}

export interface PayslipLineSummary {
  lineType: PayslipLineType;
  label: string;
  componentId: string | null;
  /** Rupees, for display. */
  amount: number;
}

export interface PayslipSummary {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  /** Days (already converted from the internal tenths-of-a-day storage). */
  paidDays: number;
  lopDays: number;
  /** Rupees, for display. */
  grossEarnings: number;
  totalDeductions: number;
  employerContributions: number;
  netPay: number;
  lines: PayslipLineSummary[];
  outstandingAmount: number;
}

export interface PayrollRunSummary {
  id: string;
  financialYear: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollRunStatus;
  voucherId: string | null;
  payslips: PayslipSummary[];
}

export interface DisbursePayslipInput {
  payslipId: string;
  paymentLedgerId: string;
  paymentDate: string;
  narration?: string;
  /** Rupees, as typed by the user. */
  amountRupees: number;
  instrument?: PaymentInstrumentInput;
}

export interface OverridePayslipTdsInput {
  payslipId: string;
  /** Rupees. */
  amountRupees: number;
}

export interface GratuityEligibilityResult {
  isEligible: boolean;
  reason: string;
  yearsOfServiceDays: number;
}

export interface RecordSeparationInput {
  employeeId: string;
  separationDate: string;
}

export interface GratuityRecordSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  separationDate: string;
  isEligible: boolean;
  eligibilityReason: string;
  yearsOfServiceDays: number;
  /** Rupees, for display. */
  formulaAmount: number;
  cumulativeProvisionAtSeparation: number;
  adjustmentAmount: number;
  status: GratuityRecordStatus;
  settlementVoucherId: string | null;
}

export interface SettleGratuityInput {
  gratuityRecordId: string;
  paymentLedgerId: string;
  paymentDate: string;
  narration?: string;
}

export interface RunGratuityProvisioningInput {
  periodMonth: number;
  periodYear: number;
}

// --- Phase 8 Increment 1: Advanced ERP (Cost Centres, Budgets, Fixed Assets) ---

export interface CostCentreSummary {
  id: string;
  name: string;
  code: string | null;
  parentCostCentreId: string | null;
  isActive: boolean;
}

export interface CreateCostCentreInput {
  name: string;
  code?: string;
  parentCostCentreId?: string;
}

export interface UpdateCostCentreInput {
  costCentreId: string;
  name?: string;
  code?: string | null;
  isActive?: boolean;
}

export interface CostCentreSummaryRow {
  costCentreId: string | null;
  costCentreName: string;
  /** Rupees. */
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface CostCentreReportInput {
  fromDate?: string;
  toDate?: string;
}

export interface BudgetLineInput {
  /** 1-12, calendar month number. */
  periodMonth: number;
  /** Rupees, as typed by the user — converted to paise at the IPC boundary. */
  amountRupees: number;
}

export interface CreateBudgetInput {
  name: string;
  financialYear: string;
  ledgerId?: string;
  costCentreId?: string;
  /** Exactly 12 lines. The renderer's helper form can pre-fill these evenly from one annual total before the user edits individual months. */
  lines: BudgetLineInput[];
}

export interface BudgetSummary {
  id: string;
  name: string;
  financialYear: string;
  ledgerId: string | null;
  ledgerName: string | null;
  costCentreId: string | null;
  costCentreName: string | null;
  lines: BudgetLineInput[];
}

export interface UpdateBudgetLineInput {
  budgetId: string;
  periodMonth: number;
  /** Rupees. */
  amountRupees: number;
}

export interface BudgetVsActualRow {
  periodMonth: number;
  /** Rupees, for display. */
  budgetedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercent: number | null;
}

export interface BudgetVsActualResult {
  budget: BudgetSummary;
  rows: BudgetVsActualRow[];
}

export type DepreciationMethod = 'SLM' | 'WDV';

export interface Schedule2RatePayload {
  method: DepreciationMethod;
  ratePercent: number;
}

export interface ItWdvBlockRatePayload {
  ratePercent: number;
}

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

export type FixedAssetStatus = 'ACTIVE' | 'DISPOSED';

export interface FixedAssetSummary {
  id: string;
  assetClassId: string;
  assetClassName: string;
  name: string;
  assetCode: string;
  purchaseDate: string;
  /** Rupees, for display. */
  purchaseCost: number;
  salvageValue: number;
  costCentreId: string | null;
  status: FixedAssetStatus;
  disposedAt: string | null;
  acquisitionVoucherId: string | null;
  disposalVoucherId: string | null;
}

export interface AcquireFixedAssetInput {
  assetClassId: string;
  name: string;
  assetCode: string;
  purchaseDate: string;
  /** Rupees, as typed by the user. */
  purchaseCostRupees: number;
  salvageValueRupees?: number;
  costCentreId?: string;
  paidFromLedgerId: string;
  narration?: string;
}

export type DepreciationBook = 'SCHEDULE2' | 'IT_WDV';

export interface AssetDepreciationEntrySummary {
  book: DepreciationBook;
  financialYear: string;
  /** Rupees, for display. */
  openingWdv: number;
  depreciationAmount: number;
  closingWdv: number;
  voucherId: string | null;
}

export interface DisposeFixedAssetInput {
  assetId: string;
  disposalDate: string;
  /** Rupees, as typed by the user. 0 for a write-off. */
  saleProceedsRupees: number;
  receiptLedgerId?: string;
  narration?: string;
}

export interface DepreciationPreviewLine {
  assetId: string;
  assetName: string;
  assetCode: string;
  /** Rupees, for display. */
  schedule2Depreciation: number;
  itWdvDepreciation: number;
}

export interface RunDepreciationInput {
  financialYear: string;
}

export interface PostDepreciationResult {
  voucherIds: string[];
}

export interface FixedAssetRateVersionSummary {
  id: string;
  ruleType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  /** Shape depends on the rule type — Schedule2RatePayload or ItWdvBlockRatePayload. Passed through as-is, same convention as PayrollRuleVersionSummary. */
  payload: unknown;
  sourceReference: string | null;
}

export interface CreateOrUpdateFixedAssetRateInput {
  book: 'SCHEDULE2' | 'IT_WDV';
  category: string;
  effectiveFrom: string;
  payload: unknown;
  sourceReference?: string;
}

// --- Phase 8 Increment 2: Advanced ERP (Multi-Currency, Multi-Branch) ---

export interface BranchSummary {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  interBranchLedgerId: string;
  isActive: boolean;
}

export interface CreateBranchInput {
  name: string;
  code?: string;
  address?: string;
}

export interface UpdateBranchInput {
  branchId: string;
  name?: string;
  code?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface RecordInterBranchTransferInput {
  fromBranchId: string;
  toBranchId: string;
  fromLedgerId: string;
  toLedgerId: string;
  /** Rupees, as typed by the user. */
  amountRupees: number;
  transferDate: string;
  narration?: string;
}

export interface BranchProfitAndLossRow {
  branchId: string | null;
  branchName: string;
  /** Rupees. */
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface BranchReportInput {
  fromDate?: string;
  toDate?: string;
}

export interface BranchBalanceSheetRow {
  branchId: string | null;
  branchName: string;
  ledgerId: string;
  ledgerName: string;
  nature: AccountNature;
  /** Rupees. */
  amount: number;
}

export interface BranchBalanceSheetSummaryRow {
  branchId: string | null;
  branchName: string;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  currentEarnings: number;
}

export interface BranchBalanceSheetResult {
  asOfDate: string;
  rows: BranchBalanceSheetRow[];
  branchSummaries: BranchBalanceSheetSummaryRow[];
  consolidatedTotalAssets: number;
  consolidatedTotalLiabilitiesAndEquity: number;
}

export interface ExchangeRateVersionSummary {
  id: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  /** Plain decimal (e.g. 83.25), not micros — converted at the IPC boundary. */
  rate: number;
  sourceReference: string | null;
}

export interface SetExchangeRateInput {
  currency: string;
  effectiveFrom: string;
  rate: number;
  sourceReference?: string;
}

export interface FxRevaluationLineDetail {
  ledgerId: string;
  ledgerName: string;
  currency: string;
  /** Foreign currency major units. */
  foreignBalanceUnits: number;
  /** Rupees, all three. */
  baseBalanceBeforeRupees: number;
  baseBalanceAfterRupees: number;
  adjustmentAmountRupees: number;
}

export interface FxRevaluationPreviewResult {
  asOfDate: string;
  lines: FxRevaluationLineDetail[];
  totalAdjustmentMagnitudeRupees: number;
}

export interface RunFxRevaluationInput {
  asOfDate: string;
}

export interface FxRevaluationRunResult {
  id: string;
  runDate: string;
  financialYear: string;
  voucherId: string | null;
  lines: FxRevaluationLineDetail[];
}

// --- Phase 8 Increment 3: Advanced ERP (Manufacturing) ---

export interface BillOfMaterialLineInput {
  componentItemId: string;
  /** Units, as typed by the user — needed per outputQuantityUnits of output. */
  quantityUnits: number;
}

export interface CreateBillOfMaterialInput {
  outputItemId: string;
  /** Units. The quantity of output this recipe's lines are expressed against. */
  outputQuantityUnits: number;
  lines: BillOfMaterialLineInput[];
}

export interface BillOfMaterialLineSummary {
  id: string;
  componentItemId: string;
  componentItemName: string;
  quantityUnits: number;
}

export interface BillOfMaterialSummary {
  id: string;
  outputItemId: string;
  outputItemName: string;
  outputQuantityUnits: number;
  isActive: boolean;
  lines: BillOfMaterialLineSummary[];
}

export interface PostManufacturingJournalInput {
  bomId: string;
  warehouseId: string;
  quantityProducedUnits: number;
  /** Required if the output item is batch-tracked. */
  outputBatchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  /** Which existing batch to consume from, per batch-tracked component — keyed by componentItemId. */
  componentBatchIds?: Record<string, string>;
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
  quantityProducedUnits: number;
  /** Rupees, for display. */
  totalCost: number;
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
  quantityUnits: number;
  /** Rupees, for display. */
  ratePerUnit: number;
  value: number;
  batchNumber: string | null;
}

// --- Phase 9 Increment 1: Print + Templates ---

/** 'CLASSIC' | 'MODERN' — see @mhts/print-templates for what each one actually renders. A config-based layout choice, not a code change. */
export type DocumentLayout = 'CLASSIC' | 'MODERN';

export interface CompanyLetterheadProfile {
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
  hasLogo: boolean;
  invoiceLayout: DocumentLayout;
  payslipLayout: DocumentLayout;
  accentColorHex: string | null;
  updatedAt: string;
}

export interface UpdateCompanyLetterheadProfileInput {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  footerNote?: string | null;
  invoiceLayout?: DocumentLayout;
  payslipLayout?: DocumentLayout;
  accentColorHex?: string | null;
}

/** Base64-over-IPC — a raw Buffer can't cross the contextBridge boundary, same convention as documentHandlers.ts's attachment upload. */
export interface PickedLogoFile {
  fileName: string;
  mimeType: string;
  fileDataBase64: string;
}

export interface UploadCompanyLogoInput {
  fileDataBase64: string;
  mimeType: string;
}

export interface PrintDocumentResult {
  /** False if the user cancelled the native save dialog. Always true for a print-dialog action (there's no dialog to cancel before the OS print dialog itself opens). */
  saved: boolean;
  filePath?: string;
}

/** Phase 9 Increment 2 (Print + Templates) — one row of the Print Centre's cross-run payslip listing. */
export interface PayslipPrintListItem {
  id: string;
  employeeName: string;
  employeeCode: string;
  financialYear: string;
  periodMonth: number;
  periodYear: number;
  /** Rupees. */
  netPay: number;
  runStatus: PayrollRunStatus;
}

// --- Phase 9 Increment 3: Print + Templates (drag-and-drop template designer) ---

/** The 6 groupings @mhts/print-templates already shares one renderer for. */
export type TemplateFamily = 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'ORDER' | 'VOUCHER' | 'EXPENSE_CLAIM' | 'PAYSLIP';

export interface TemplateElementStyle {
  fontSizePx?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  colorHex?: string;
}

export type TemplateValueFormat = 'plain' | 'currency';

export interface TextTemplateElement {
  id: string;
  type: 'text';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fieldPath?: string;
  staticText?: string;
  format?: TemplateValueFormat;
  style?: TemplateElementStyle;
}

export interface ImageTemplateElement {
  id: string;
  type: 'image';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  source: 'logo';
}

export interface LineTemplateElement {
  id: string;
  type: 'line';
  xMm: number;
  yMm: number;
  widthMm: number;
  colorHex?: string;
}

export interface TemplateTableColumn {
  headerLabel: string;
  fieldPath: string;
  widthMm: number;
  align?: 'left' | 'center' | 'right';
  format?: TemplateValueFormat;
}

export interface TableTemplateElement {
  id: string;
  type: 'table';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rowSource: string;
  columns: TemplateTableColumn[];
  style?: TemplateElementStyle;
}

export type TemplateElement = TextTemplateElement | ImageTemplateElement | LineTemplateElement | TableTemplateElement;

export interface TemplateLayoutDocument {
  version: 1;
  pageSize: { widthMm: number; heightMm: number };
  elements: TemplateElement[];
}

export type TemplateFieldKind = 'text' | 'currency' | 'date' | 'image' | 'table';

export interface TemplateFieldCatalogEntry {
  path: string;
  label: string;
  kind: TemplateFieldKind;
  columns?: { path: string; label: string; kind: 'text' | 'currency' }[];
}

export interface PrintTemplateLayoutSummary {
  id: string;
  documentFamily: TemplateFamily;
  version: number;
  name: string | null;
  layout: TemplateLayoutDocument;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SaveTemplateLayoutInput {
  documentFamily: TemplateFamily;
  name: string | null;
  layout: TemplateLayoutDocument;
}

/** A real (or, absent any document of that family yet, placeholder) assembled *TemplateData object for the designer's live preview — shape varies by family, so it's deliberately loose here (the designer canvas only ever reads it via field paths, same as the print-path interpreter). */
export interface TemplatePreviewData {
  data: Record<string, unknown>;
  isPlaceholder: boolean;
}

/** Mirrors @mhts/core-audit's AuditChainVerificationResult — Phase 11's audit-hash-chain tamper check. */
export interface AuditChainVerificationResult {
  valid: boolean;
  rowsChecked: number;
  brokenAtId?: number;
  reason?: string;
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
  INVITE_USER: 'system:inviteUser',
  LIST_ROLES: 'system:listRoles',
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
  UPDATE_BUSINESS_PARTY_ADDRESS: 'salesPurchase:updateBusinessPartyAddress',
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
  LIST_OUTSTANDING_SALES_INVOICES: 'salesPurchase:listOutstandingSalesInvoices',
  LIST_OUTSTANDING_PURCHASE_INVOICES: 'salesPurchase:listOutstandingPurchaseInvoices',
  RECORD_SALES_RECEIPT: 'salesPurchase:recordSalesReceipt',
  RECORD_PURCHASE_PAYMENT: 'salesPurchase:recordPurchasePayment',
  GET_THEME_PREFERENCE: 'preference:getTheme',
  SET_THEME_PREFERENCE: 'preference:setTheme',
  BACKUP_COMPANY: 'backup:createBackup',
  RESTORE_COMPANY: 'backup:restore',
  GET_LICENSE_STATUS: 'license:getStatus',
  ACTIVATE_LICENSE: 'license:activate',
  LIST_ALL_PERMISSIONS: 'roles:listAllPermissions',
  LIST_ROLES_WITH_PERMISSIONS: 'roles:listWithPermissions',
  CREATE_ROLE: 'roles:create',
  UPDATE_ROLE_PERMISSIONS: 'roles:updatePermissions',
  CREATE_UNIT_OF_MEASURE: 'inventory:createUnitOfMeasure',
  LIST_UNITS_OF_MEASURE: 'inventory:listUnitsOfMeasure',
  CREATE_WAREHOUSE: 'inventory:createWarehouse',
  LIST_WAREHOUSES: 'inventory:listWarehouses',
  CREATE_ITEM: 'inventory:createItem',
  LIST_ITEMS: 'inventory:listItems',
  CANCEL_SALES_INVOICE: 'salesPurchase:cancelSalesInvoice',
  CANCEL_PURCHASE_INVOICE: 'salesPurchase:cancelPurchaseInvoice',
  CANCEL_STOCK_ADJUSTMENT: 'inventory:cancelStockAdjustment',
  LIST_BATCHES_FOR_ITEM: 'inventory:listBatchesForItem',
  RECORD_OPENING_STOCK: 'inventory:recordOpeningStock',
  POST_STOCK_ADJUSTMENT: 'inventory:postStockAdjustment',
  TRANSFER_STOCK: 'inventory:transferStock',
  LIST_STOCK_MOVEMENTS: 'inventory:listStockMovements',
  GET_STOCK_POSITION: 'inventory:getStockPosition',
  CREATE_OR_UPDATE_GST_RATE: 'gst:createOrUpdateRate',
  LIST_GST_RATES: 'gst:listRates',
  LIST_ACTIVE_GST_RATES: 'gst:listActiveRates',
  PREVIEW_GST: 'gst:preview',
  GET_GST_SUMMARY: 'gst:getSummary',
  GET_GSTR1: 'gst:getGstr1',
  GET_GSTR3B: 'gst:getGstr3b',
  GET_GSTR9: 'gst:getGstr9',
  GET_GSTR9C: 'gst:getGstr9c',
  EXPORT_CSV: 'export:csv',

  // Phase 5: Banking
  LIST_BANK_ACCOUNTS: 'banking:listBankAccounts',
  CREATE_BANK_ACCOUNT: 'banking:createBankAccount',
  RECORD_BANK_VOUCHER: 'banking:recordVoucher',
  UPDATE_INSTRUMENT_STATUS: 'banking:updateInstrumentStatus',
  LIST_PAYMENT_INSTRUMENTS: 'banking:listPaymentInstruments',
  LIST_RECONCILABLE_LINES: 'banking:listReconcilableLines',
  MARK_LINE_RECONCILED: 'banking:markLineReconciled',
  MARK_LINE_UNRECONCILED: 'banking:markLineUnreconciled',
  GET_RECONCILIATION_STATEMENT: 'banking:getReconciliationStatement',
  PICK_STATEMENT_FILE: 'banking:pickStatementFile',
  PREVIEW_STATEMENT_CSV: 'banking:previewStatementCsv',
  IMPORT_STATEMENT_FILE: 'banking:importStatementFile',
  LIST_STATEMENT_IMPORTS: 'banking:listStatementImports',
  GET_STATEMENT_IMPORT_LINES: 'banking:getStatementImportLines',
  RESOLVE_STATEMENT_LINE_MATCH: 'banking:resolveStatementLineMatch',

  // Phase 6: Expenses, Travel, Documents
  LIST_EMPLOYEES: 'expense:listEmployees',
  CREATE_EMPLOYEE: 'expense:createEmployee',
  LIST_EXPENSE_CLAIMS: 'expense:listExpenseClaims',
  CREATE_EXPENSE_CLAIM: 'expense:createExpenseClaim',
  SUBMIT_EXPENSE_CLAIM: 'expense:submitExpenseClaim',
  APPROVE_EXPENSE_CLAIM: 'expense:approveExpenseClaim',
  REJECT_EXPENSE_CLAIM: 'expense:rejectExpenseClaim',
  REIMBURSE_EXPENSE_CLAIM: 'expense:reimburseExpenseClaim',
  CANCEL_EXPENSE_CLAIM: 'expense:cancelExpenseClaim',
  LIST_OUTSTANDING_REIMBURSEMENTS: 'expense:listOutstandingReimbursements',

  PICK_ATTACHMENT_FILE: 'documents:pickAttachmentFile',
  UPLOAD_DOCUMENT: 'documents:uploadDocument',
  LIST_DOCUMENTS_FOR_ENTITY: 'documents:listDocumentsForEntity',
  DOWNLOAD_DOCUMENT: 'documents:downloadDocument',
  DELETE_DOCUMENT: 'documents:deleteDocument',
  SEARCH_DOCUMENTS: 'documents:searchDocuments',

  // Phase 7: Payroll
  LIST_EMPLOYEE_PAYROLL_PROFILES: 'payroll:listEmployeePayrollProfiles',
  UPDATE_EMPLOYEE_PAYROLL_PROFILE: 'payroll:updateEmployeePayrollProfile',
  CREATE_SALARY_COMPONENT: 'payroll:createSalaryComponent',
  LIST_SALARY_COMPONENTS: 'payroll:listSalaryComponents',
  ASSIGN_SALARY_STRUCTURE: 'payroll:assignSalaryStructure',
  LIST_SALARY_STRUCTURES_FOR_EMPLOYEE: 'payroll:listSalaryStructuresForEmployee',
  GET_COMPANY_PAYROLL_SETTINGS: 'payroll:getCompanyPayrollSettings',
  UPDATE_COMPANY_PAYROLL_SETTINGS: 'payroll:updateCompanyPayrollSettings',
  CREATE_OR_UPDATE_PAYROLL_RULE: 'payroll:createOrUpdateRule',
  LIST_ACTIVE_PAYROLL_RULES: 'payroll:listActiveRules',
  LIST_PAYROLL_RULE_VERSIONS: 'payroll:listRuleVersions',
  CREATE_LEAVE_TYPE: 'payroll:createLeaveType',
  LIST_LEAVE_TYPES: 'payroll:listLeaveTypes',
  APPLY_LEAVE: 'payroll:applyLeave',
  LIST_LEAVE_APPLICATIONS: 'payroll:listLeaveApplications',
  APPROVE_LEAVE: 'payroll:approveLeave',
  REJECT_LEAVE: 'payroll:rejectLeave',
  LIST_LEAVE_BALANCES: 'payroll:listLeaveBalances',
  MARK_ATTENDANCE: 'payroll:markAttendance',
  LIST_ATTENDANCE_FOR_EMPLOYEE: 'payroll:listAttendanceForEmployee',
  CREATE_PAYROLL_RUN: 'payroll:createPayrollRun',
  PROCESS_PAYROLL_RUN: 'payroll:processPayrollRun',
  OVERRIDE_PAYSLIP_TDS: 'payroll:overridePayslipTds',
  GET_PAYROLL_RUN: 'payroll:getPayrollRun',
  LIST_PAYROLL_RUNS: 'payroll:listPayrollRuns',
  POST_PAYROLL_RUN: 'payroll:postPayrollRun',
  DISBURSE_PAYSLIP: 'payroll:disbursePayslip',
  RUN_GRATUITY_PROVISIONING: 'payroll:runGratuityProvisioning',
  RECORD_SEPARATION: 'payroll:recordSeparation',
  SETTLE_GRATUITY: 'payroll:settleGratuity',
  LIST_GRATUITY_RECORDS: 'payroll:listGratuityRecords',

  // Phase 8 Increment 1: Advanced ERP
  CREATE_COST_CENTRE: 'accounting:createCostCentre',
  LIST_COST_CENTRES: 'accounting:listCostCentres',
  UPDATE_COST_CENTRE: 'accounting:updateCostCentre',
  GET_COST_CENTRE_REPORT: 'accounting:getCostCentreReport',
  CREATE_BUDGET: 'accounting:createBudget',
  LIST_BUDGETS: 'accounting:listBudgets',
  UPDATE_BUDGET_LINE: 'accounting:updateBudgetLine',
  GET_BUDGET_VS_ACTUAL: 'accounting:getBudgetVsActual',
  CREATE_ASSET_CLASS: 'fixedAssets:createAssetClass',
  LIST_ASSET_CLASSES: 'fixedAssets:listAssetClasses',
  ACQUIRE_FIXED_ASSET: 'fixedAssets:acquireFixedAsset',
  LIST_FIXED_ASSETS: 'fixedAssets:listFixedAssets',
  GET_ASSET_DEPRECIATION_SCHEDULE: 'fixedAssets:getAssetDepreciationSchedule',
  DISPOSE_FIXED_ASSET: 'fixedAssets:disposeFixedAsset',
  PREVIEW_DEPRECIATION_RUN: 'fixedAssets:previewDepreciationRun',
  POST_DEPRECIATION_RUN: 'fixedAssets:postDepreciationRun',
  CREATE_OR_UPDATE_FIXED_ASSET_RATE: 'fixedAssets:createOrUpdateFixedAssetRate',
  LIST_ACTIVE_FIXED_ASSET_RATES: 'fixedAssets:listActiveFixedAssetRates',
  LIST_FIXED_ASSET_RATE_VERSIONS: 'fixedAssets:listFixedAssetRateVersions',

  // Phase 8 Increment 2: Advanced ERP (Multi-Currency, Multi-Branch)
  CREATE_BRANCH: 'accounting:createBranch',
  LIST_BRANCHES: 'accounting:listBranches',
  UPDATE_BRANCH: 'accounting:updateBranch',
  RECORD_INTER_BRANCH_TRANSFER: 'accounting:recordInterBranchTransfer',
  GET_BRANCH_PROFIT_AND_LOSS: 'accounting:getBranchProfitAndLoss',
  GET_BRANCH_BALANCE_SHEET: 'accounting:getBranchBalanceSheet',
  SET_EXCHANGE_RATE: 'multiCurrency:setExchangeRate',
  LIST_ACTIVE_EXCHANGE_RATES: 'multiCurrency:listActiveExchangeRates',
  LIST_EXCHANGE_RATE_VERSIONS: 'multiCurrency:listExchangeRateVersions',
  PREVIEW_FX_REVALUATION: 'multiCurrency:previewFxRevaluation',
  POST_FX_REVALUATION: 'multiCurrency:postFxRevaluation',
  LIST_FX_REVALUATION_RUNS: 'multiCurrency:listFxRevaluationRuns',

  // Phase 8 Increment 3: Advanced ERP (Manufacturing)
  CREATE_BILL_OF_MATERIAL: 'manufacturing:createBillOfMaterial',
  LIST_BILLS_OF_MATERIAL: 'manufacturing:listBillsOfMaterial',
  POST_MANUFACTURING_JOURNAL: 'manufacturing:postManufacturingJournal',
  LIST_MANUFACTURING_JOURNALS: 'manufacturing:listManufacturingJournals',
  GET_MANUFACTURING_JOURNAL_MOVEMENTS: 'manufacturing:getManufacturingJournalMovements',

  // Phase 9 Increment 1: Print + Templates
  GET_COMPANY_LETTERHEAD_PROFILE: 'print:getCompanyLetterheadProfile',
  UPDATE_COMPANY_LETTERHEAD_PROFILE: 'print:updateCompanyLetterheadProfile',
  PICK_LOGO_FILE: 'print:pickLogoFile',
  UPLOAD_COMPANY_LOGO: 'print:uploadCompanyLogo',
  CLEAR_COMPANY_LOGO: 'print:clearCompanyLogo',
  PRINT_SALES_INVOICE: 'print:printSalesInvoice',
  SAVE_SALES_INVOICE_PDF: 'print:saveSalesInvoicePdf',
  PRINT_PAYSLIP: 'print:printPayslip',
  SAVE_PAYSLIP_PDF: 'print:savePayslipPdf',

  // Phase 9 Increment 2: Print + Templates
  PRINT_PURCHASE_INVOICE: 'print:printPurchaseInvoice',
  SAVE_PURCHASE_INVOICE_PDF: 'print:savePurchaseInvoicePdf',
  PRINT_SALES_ORDER: 'print:printSalesOrder',
  SAVE_SALES_ORDER_PDF: 'print:saveSalesOrderPdf',
  PRINT_PURCHASE_ORDER: 'print:printPurchaseOrder',
  SAVE_PURCHASE_ORDER_PDF: 'print:savePurchaseOrderPdf',
  PRINT_VOUCHER: 'print:printVoucher',
  SAVE_VOUCHER_PDF: 'print:saveVoucherPdf',
  PRINT_EXPENSE_CLAIM: 'print:printExpenseClaim',
  SAVE_EXPENSE_CLAIM_PDF: 'print:saveExpenseClaimPdf',
  LIST_PAYSLIPS_FOR_PRINT: 'print:listPayslipsForPrint',

  // Phase 9 Increment 3: Print + Templates (drag-and-drop template designer)
  GET_TEMPLATE_LAYOUT: 'print:getTemplateLayout',
  SAVE_TEMPLATE_LAYOUT: 'print:saveTemplateLayout',
  REVERT_TEMPLATE_LAYOUT: 'print:revertTemplateLayout',
  LIST_TEMPLATE_LAYOUT_VERSIONS: 'print:listTemplateLayoutVersions',
  GET_TEMPLATE_PREVIEW_DATA: 'print:getTemplatePreviewData',
  GET_TEMPLATE_FIELD_CATALOG: 'print:getTemplateFieldCatalog',

  // Phase 10 Increment 1: Installer + Update/Migration Pipeline
  CHECK_FOR_UPDATE: 'update:check',
  QUIT_AND_INSTALL: 'update:quitAndInstall',

  // Phase 10 Increment 3: Demo Mode
  GET_TRIAL_STATUS: 'trial:getStatus',
  CREATE_DEMO_COMPANY: 'system:createDemoCompany',

  // Phase 11: UAT, Security & Compliance Sign-off
  VERIFY_AUDIT_TRAIL: 'system:verifyAuditTrail',
} as const;

/** Plain `webContents.send`/`ipcRenderer.on` channel name — not an `invoke`-style request/response channel, so it deliberately isn't part of the `IPC` object above (nothing calls `ipcRenderer.invoke` with it). */
export const UPDATE_STATUS_EVENT = 'update:status';
