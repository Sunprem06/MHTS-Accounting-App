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
export type VoucherType = 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'STOCK_ADJUSTMENT';

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
  /** Phase 4 (GST) — mutually exclusive with taxLedgerId/taxAmountRupees. See core-sales-purchase's DocumentLineInput. */
  hsnSacCode?: string;
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
}

export interface SettlementLineInput {
  invoiceId: string;
  amountRupees: number;
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
} as const;
