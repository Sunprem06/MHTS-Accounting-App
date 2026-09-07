import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { seedDefaultTdsRates } from '@mhts/core-sales-purchase';
import { seedDefaultGstRates } from '@mhts/core-gst-engine';
import { seedDefaultPayrollRules } from '@mhts/core-payroll-engine';
import { seedDefaultFixedAssetRules } from '@mhts/core-fixed-assets';
import { resolveAppPaths, openAndMigrateSystemDb } from './db';
import {
  listCompanies,
  createCompany,
  login,
  changePassword,
  resetPassword,
  adminResetPassword,
  listCompanyUsers,
  inviteUser,
  listRoles,
} from './handlers';
import {
  listAccountGroups,
  listLedgers,
  createLedger,
  createVoucher,
  listVouchers,
  cancelVoucher,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
} from './accountingHandlers';
import {
  createParty,
  listParties,
  createSalesInvoice,
  listSalesInvoices,
  cancelSalesInvoice,
  createPurchaseInvoice,
  listPurchaseInvoices,
  cancelPurchaseInvoice,
  createSalesOrder,
  listSalesOrders,
  confirmSalesOrder,
  cancelSalesOrder,
  convertSalesOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  convertPurchaseOrder,
  listReceivables,
  listPayables,
  listMsmeAgeing,
  listOutstandingSalesInvoices,
  listOutstandingPurchaseInvoices,
  recordSalesReceipt,
  recordPurchasePayment,
} from './salesPurchaseHandlers';
import { getThemePreference, setThemePreference } from './preferenceHandlers';
import { backupCompany, restoreCompany } from './backupHandlers';
import { checkLicenseStatus, activateLicense } from './licenseHandlers';
import { listAllPermissions, listRolesWithPermissions, createRole, updateRolePermissions } from './roleHandlers';
import {
  createUnitOfMeasure,
  listUnitsOfMeasure,
  createWarehouse,
  listWarehouses,
  createItem,
  listItems,
  listBatchesForItem,
  recordOpeningStock,
  postStockAdjustment,
  cancelStockAdjustment,
  transferStock,
  listStockMovements,
  getStockPosition,
} from './inventoryHandlers';
import { createOrUpdateGstRate, listGstRates, listActiveGstRates, previewGst, getGstSummary, getGstr1, getGstr3b, getGstr9, getGstr9c } from './gstHandlers';
import { exportCsv } from './csvExport';
import {
  listBankAccounts,
  createBankAccount,
  recordBankVoucher,
  updateInstrumentStatus,
  listPaymentInstruments,
  listReconcilableLines,
  markLineReconciled,
  markLineUnreconciled,
  getReconciliationStatement,
  pickStatementFile,
  previewStatementCsv,
  importStatementFile,
  listStatementImports,
  getStatementImportLines,
  resolveStatementLineMatch,
} from './bankingHandlers';
import {
  listEmployees,
  createEmployee,
  listExpenseClaims,
  createExpenseClaim,
  submitExpenseClaim,
  approveExpenseClaim,
  rejectExpenseClaim,
  cancelExpenseClaim,
  reimburseExpenseClaim,
  listOutstandingReimbursements,
} from './expenseHandlers';
import { pickAttachmentFile, uploadDocument, listDocumentsForEntity, downloadDocument, deleteDocument, searchDocuments } from './documentHandlers';
import {
  listEmployeePayrollProfiles,
  updateEmployeePayrollProfile,
  createSalaryComponent,
  listSalaryComponents,
  assignSalaryStructure,
  listSalaryStructuresForEmployee,
  getCompanyPayrollSettings,
  updateCompanyPayrollSettings,
  createOrUpdatePayrollRule,
  listActivePayrollRules,
  listPayrollRuleVersions,
  createLeaveType,
  listLeaveTypes,
  applyLeave,
  listLeaveApplications,
  approveLeave,
  rejectLeave,
  listLeaveBalances,
  markAttendance,
  listAttendanceForEmployee,
  createPayrollRun,
  processPayrollRun,
  overridePayslipTds,
  getPayrollRun,
  listPayrollRuns,
  postPayrollRun,
  disbursePayslip,
  runGratuityProvisioning,
  recordSeparation,
  settleGratuity,
  listGratuityRecords,
} from './payrollHandlers';
import {
  createCostCentre,
  listCostCentres,
  updateCostCentre,
  getCostCentreReport,
  createBudget,
  listBudgets,
  updateBudgetLine,
  getBudgetVsActual,
} from './costCentreBudgetHandlers';
import {
  createAssetClass,
  listAssetClasses,
  acquireFixedAsset,
  listFixedAssets,
  getAssetDepreciationSchedule,
  disposeFixedAsset,
  previewDepreciationRun,
  postDepreciationRun,
  createOrUpdateFixedAssetRate,
  listActiveFixedAssetRates,
  listFixedAssetRateVersions,
} from './fixedAssetsHandlers';
import { session } from './session';
import {
  IPC,
  type IpcResult,
  type AdminResetPasswordInput,
  type ChangePasswordInput,
  type CreateCompanyInput,
  type CreateLedgerInput,
  type CreatePartyInput,
  type InviteUserInput,
  type CreatePurchaseInvoiceInput,
  type CreatePurchaseOrderInput,
  type CreateSalesInvoiceInput,
  type CreateRoleInput,
  type CreateSalesOrderInput,
  type CreateUnitOfMeasureInput,
  type CreateWarehouseInput,
  type CreateItemInput,
  type RecordOpeningStockInput,
  type PostStockAdjustmentInput,
  type TransferStockInput,
  type StockPositionQuery,
  type CreateVoucherInput,
  type LoginInput,
  type ProfitAndLossInput,
  type RecordPurchasePaymentInput,
  type RecordSalesReceiptInput,
  type ResetPasswordInput,
  type ThemePreference,
  type UpdateRolePermissionsInput,
  type CreateOrUpdateGstRateInput,
  type GstRatePreviewInput,
  type GstSummaryInput,
  type GstReturnPeriodInput,
  type GstFinancialYearInput,
  type ExportCsvInput,
  type CreateBankAccountInput,
  type RecordBankVoucherInput,
  type UpdateInstrumentStatusInput,
  type ListReconcilableLinesInput,
  type MarkReconciledInput,
  type GetReconciliationStatementInput,
  type ImportStatementFileInput,
  type ResolveStatementLineMatchInput,
  type InstrumentStatus,
  type CreateEmployeeInput,
  type CreateExpenseClaimInput,
  type RejectExpenseClaimInput,
  type ReimburseExpenseClaimInput,
  type UploadDocumentInput,
  type SearchDocumentsInput,
  type ListDocumentsForEntityInput,
  type UpdateEmployeePayrollProfileInput,
  type SalaryComponentDefinitionInput,
  type AssignSalaryStructureInput,
  type UpdateCompanyPayrollSettingsInput,
  type CreateOrUpdatePayrollRuleInput,
  type LeaveTypeInput,
  type ApplyLeaveInput,
  type RejectLeaveInput,
  type ListAttendanceForEmployeeInput,
  type MarkAttendanceInput,
  type CreatePayrollRunInput,
  type OverridePayslipTdsInput,
  type DisbursePayslipInput,
  type RunGratuityProvisioningInput,
  type RecordSeparationInput,
  type SettleGratuityInput,
  type CreateCostCentreInput,
  type UpdateCostCentreInput,
  type CostCentreReportInput,
  type CreateBudgetInput,
  type UpdateBudgetLineInput,
  type CreateAssetClassInput,
  type AcquireFixedAssetInput,
  type DisposeFixedAssetInput,
  type RunDepreciationInput,
  type CreateOrUpdateFixedAssetRateInput,
} from '../shared/ipc';

function handle<T>(channel: string, fn: () => Promise<T>): void {
  ipcMain.handle(channel, async (): Promise<IpcResult<T>> => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function handleWithArg<Arg, T>(channel: string, fn: (arg: Arg) => Promise<T>): void {
  ipcMain.handle(channel, async (_event, arg: Arg): Promise<IpcResult<T>> => {
    try {
      const data = await fn(arg);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function bootstrap(): Promise<void> {
  const paths = resolveAppPaths();
  const systemDb = await openAndMigrateSystemDb(paths);
  // Installation-wide reference data (rule_set is shared across every company in this
  // install — see @mhts/db-schema's system/types.ts) — seeded once here, idempotently,
  // never per-company (createCompany must not re-seed/duplicate/version-bump this).
  await seedDefaultTdsRates(systemDb);
  await seedDefaultGstRates(systemDb);
  await seedDefaultPayrollRules(systemDb);
  await seedDefaultFixedAssetRules(systemDb);

  handle(IPC.LIST_COMPANIES, () => listCompanies(systemDb));
  handleWithArg(IPC.CREATE_COMPANY, (input: CreateCompanyInput) => createCompany(systemDb, paths, input));
  handleWithArg(IPC.LOGIN, (input: LoginInput) => login(systemDb, input));
  handleWithArg(IPC.CHANGE_PASSWORD, (input: ChangePasswordInput) => changePassword(systemDb, input));
  handleWithArg(IPC.RESET_PASSWORD, (input: ResetPasswordInput) => resetPassword(systemDb, input));
  handleWithArg(IPC.ADMIN_RESET_PASSWORD, (input: AdminResetPasswordInput) => adminResetPassword(systemDb, input));
  handle(IPC.LIST_COMPANY_USERS, () => listCompanyUsers(systemDb));
  handleWithArg(IPC.INVITE_USER, (input: InviteUserInput) => inviteUser(systemDb, input));
  handle(IPC.LIST_ROLES, () => listRoles());
  handle(IPC.LOGOUT, async () => {
    await session.clear();
  });
  handle(IPC.GET_SESSION, async () => session.get());

  handle(IPC.LIST_ACCOUNT_GROUPS, () => listAccountGroups());
  handle(IPC.LIST_LEDGERS, () => listLedgers());
  handleWithArg(IPC.CREATE_LEDGER, (input: CreateLedgerInput) => createLedger(input));
  handleWithArg(IPC.CREATE_VOUCHER, (input: CreateVoucherInput) => createVoucher(systemDb, input));
  handle(IPC.LIST_VOUCHERS, () => listVouchers());
  handleWithArg(IPC.CANCEL_VOUCHER, (voucherId: string) => cancelVoucher(systemDb, voucherId));
  handle(IPC.GET_TRIAL_BALANCE, () => getTrialBalance());
  handleWithArg(IPC.GET_PROFIT_AND_LOSS, (input: ProfitAndLossInput) => getProfitAndLoss(input));
  handleWithArg(IPC.GET_BALANCE_SHEET, (asOfDate: string) => getBalanceSheet(asOfDate));

  handleWithArg(IPC.CREATE_PARTY, (input: CreatePartyInput) => createParty(input));
  handle(IPC.LIST_PARTIES, () => listParties());
  handleWithArg(IPC.CREATE_SALES_INVOICE, (input: CreateSalesInvoiceInput) => createSalesInvoice(systemDb, input));
  handle(IPC.LIST_SALES_INVOICES, () => listSalesInvoices());
  handleWithArg(IPC.CANCEL_SALES_INVOICE, (invoiceId: string) => cancelSalesInvoice(systemDb, invoiceId));
  handleWithArg(IPC.CREATE_PURCHASE_INVOICE, (input: CreatePurchaseInvoiceInput) => createPurchaseInvoice(systemDb, input));
  handle(IPC.LIST_PURCHASE_INVOICES, () => listPurchaseInvoices());
  handleWithArg(IPC.CANCEL_PURCHASE_INVOICE, (invoiceId: string) => cancelPurchaseInvoice(systemDb, invoiceId));
  handleWithArg(IPC.CREATE_SALES_ORDER, (input: CreateSalesOrderInput) => createSalesOrder(systemDb, input));
  handle(IPC.LIST_SALES_ORDERS, () => listSalesOrders());
  handleWithArg(IPC.CONFIRM_SALES_ORDER, (orderId: string) => confirmSalesOrder(orderId));
  handleWithArg(IPC.CANCEL_SALES_ORDER, (orderId: string) => cancelSalesOrder(orderId));
  handleWithArg(IPC.CONVERT_SALES_ORDER, (orderId: string) => convertSalesOrder(systemDb, orderId));
  handleWithArg(IPC.CREATE_PURCHASE_ORDER, (input: CreatePurchaseOrderInput) => createPurchaseOrder(systemDb, input));
  handle(IPC.LIST_PURCHASE_ORDERS, () => listPurchaseOrders());
  handleWithArg(IPC.CONFIRM_PURCHASE_ORDER, (orderId: string) => confirmPurchaseOrder(orderId));
  handleWithArg(IPC.CANCEL_PURCHASE_ORDER, (orderId: string) => cancelPurchaseOrder(orderId));
  handleWithArg(IPC.CONVERT_PURCHASE_ORDER, (orderId: string) => convertPurchaseOrder(systemDb, orderId));
  handle(IPC.LIST_RECEIVABLES, () => listReceivables());
  handle(IPC.LIST_PAYABLES, () => listPayables());
  handleWithArg(IPC.LIST_MSME_AGEING, (asOfDate: string) => listMsmeAgeing(asOfDate));
  handleWithArg(IPC.LIST_OUTSTANDING_SALES_INVOICES, (partyId: string) => listOutstandingSalesInvoices(partyId));
  handleWithArg(IPC.LIST_OUTSTANDING_PURCHASE_INVOICES, (partyId: string) => listOutstandingPurchaseInvoices(partyId));
  handleWithArg(IPC.RECORD_SALES_RECEIPT, (input: RecordSalesReceiptInput) => recordSalesReceipt(systemDb, input));
  handleWithArg(IPC.RECORD_PURCHASE_PAYMENT, (input: RecordPurchasePaymentInput) => recordPurchasePayment(systemDb, input));

  handle(IPC.GET_THEME_PREFERENCE, () => getThemePreference(systemDb));
  handleWithArg(IPC.SET_THEME_PREFERENCE, (theme: ThemePreference) => setThemePreference(systemDb, theme));

  handle(IPC.BACKUP_COMPANY, () => backupCompany(systemDb));
  handle(IPC.RESTORE_COMPANY, () => restoreCompany(systemDb));

  handle(IPC.GET_LICENSE_STATUS, () => checkLicenseStatus(systemDb, paths));
  handle(IPC.ACTIVATE_LICENSE, () => activateLicense(systemDb, paths));

  handle(IPC.LIST_ALL_PERMISSIONS, () => listAllPermissions());
  handle(IPC.LIST_ROLES_WITH_PERMISSIONS, () => listRolesWithPermissions());
  handleWithArg(IPC.CREATE_ROLE, (input: CreateRoleInput) => createRole(input));
  handleWithArg(IPC.UPDATE_ROLE_PERMISSIONS, (input: UpdateRolePermissionsInput) => updateRolePermissions(input));

  handleWithArg(IPC.CREATE_UNIT_OF_MEASURE, (input: CreateUnitOfMeasureInput) => createUnitOfMeasure(input));
  handle(IPC.LIST_UNITS_OF_MEASURE, () => listUnitsOfMeasure());
  handleWithArg(IPC.CREATE_WAREHOUSE, (input: CreateWarehouseInput) => createWarehouse(input));
  handle(IPC.LIST_WAREHOUSES, () => listWarehouses());
  handleWithArg(IPC.CREATE_ITEM, (input: CreateItemInput) => createItem(input));
  handle(IPC.LIST_ITEMS, () => listItems());
  handleWithArg(IPC.LIST_BATCHES_FOR_ITEM, (itemId: string) => listBatchesForItem(itemId));
  handleWithArg(IPC.RECORD_OPENING_STOCK, (input: RecordOpeningStockInput) => recordOpeningStock(input));
  handleWithArg(IPC.POST_STOCK_ADJUSTMENT, (input: PostStockAdjustmentInput) => postStockAdjustment(systemDb, input));
  handleWithArg(IPC.CANCEL_STOCK_ADJUSTMENT, (voucherId: string) => cancelStockAdjustment(systemDb, voucherId));
  handleWithArg(IPC.TRANSFER_STOCK, (input: TransferStockInput) => transferStock(input));
  handle(IPC.LIST_STOCK_MOVEMENTS, () => listStockMovements());
  handleWithArg(IPC.GET_STOCK_POSITION, (query: StockPositionQuery) => getStockPosition(query));

  handleWithArg(IPC.CREATE_OR_UPDATE_GST_RATE, (input: CreateOrUpdateGstRateInput) => createOrUpdateGstRate(systemDb, input));
  handleWithArg(IPC.LIST_GST_RATES, (hsnSacCode: string) => listGstRates(systemDb, hsnSacCode));
  handle(IPC.LIST_ACTIVE_GST_RATES, () => listActiveGstRates(systemDb));
  handleWithArg(IPC.PREVIEW_GST, (input: GstRatePreviewInput) => previewGst(systemDb, input));
  handleWithArg(IPC.GET_GST_SUMMARY, (input: GstSummaryInput) => getGstSummary(input));
  handleWithArg(IPC.GET_GSTR1, (input: GstReturnPeriodInput) => getGstr1(input));
  handleWithArg(IPC.GET_GSTR3B, (input: GstReturnPeriodInput) => getGstr3b(input));
  handleWithArg(IPC.GET_GSTR9, (input: GstFinancialYearInput) => getGstr9(systemDb, input));
  handleWithArg(IPC.GET_GSTR9C, (input: GstFinancialYearInput) => getGstr9c(systemDb, input));
  handleWithArg(IPC.EXPORT_CSV, (input: ExportCsvInput) => exportCsv(input));

  handle(IPC.LIST_BANK_ACCOUNTS, () => listBankAccounts());
  handleWithArg(IPC.CREATE_BANK_ACCOUNT, (input: CreateBankAccountInput) => createBankAccount(input));
  handleWithArg(IPC.RECORD_BANK_VOUCHER, (input: RecordBankVoucherInput) => recordBankVoucher(systemDb, input));
  handleWithArg(IPC.UPDATE_INSTRUMENT_STATUS, (input: UpdateInstrumentStatusInput) => updateInstrumentStatus(input));
  handleWithArg(IPC.LIST_PAYMENT_INSTRUMENTS, (status: InstrumentStatus | undefined) => listPaymentInstruments(status));
  handleWithArg(IPC.LIST_RECONCILABLE_LINES, (input: ListReconcilableLinesInput) => listReconcilableLines(input));
  handleWithArg(IPC.MARK_LINE_RECONCILED, (input: MarkReconciledInput) => markLineReconciled(input));
  handleWithArg(IPC.MARK_LINE_UNRECONCILED, (voucherLineId: string) => markLineUnreconciled(voucherLineId));
  handleWithArg(IPC.GET_RECONCILIATION_STATEMENT, (input: GetReconciliationStatementInput) => getReconciliationStatement(input));
  handle(IPC.PICK_STATEMENT_FILE, () => pickStatementFile());
  handleWithArg(IPC.PREVIEW_STATEMENT_CSV, (csvText: string) => previewStatementCsv(csvText));
  handleWithArg(IPC.IMPORT_STATEMENT_FILE, (input: ImportStatementFileInput) => importStatementFile(input));
  handleWithArg(IPC.LIST_STATEMENT_IMPORTS, (bankAccountId: string) => listStatementImports(bankAccountId));
  handleWithArg(IPC.GET_STATEMENT_IMPORT_LINES, (importId: string) => getStatementImportLines(importId));
  handleWithArg(IPC.RESOLVE_STATEMENT_LINE_MATCH, (input: ResolveStatementLineMatchInput) => resolveStatementLineMatch(input));

  handle(IPC.LIST_EMPLOYEES, () => listEmployees());
  handleWithArg(IPC.CREATE_EMPLOYEE, (input: CreateEmployeeInput) => createEmployee(input));
  handle(IPC.LIST_EXPENSE_CLAIMS, () => listExpenseClaims());
  handleWithArg(IPC.CREATE_EXPENSE_CLAIM, (input: CreateExpenseClaimInput) => createExpenseClaim(systemDb, input));
  handleWithArg(IPC.SUBMIT_EXPENSE_CLAIM, (expenseClaimId: string) => submitExpenseClaim(expenseClaimId));
  handleWithArg(IPC.APPROVE_EXPENSE_CLAIM, (expenseClaimId: string) => approveExpenseClaim(systemDb, expenseClaimId));
  handleWithArg(IPC.REJECT_EXPENSE_CLAIM, (input: RejectExpenseClaimInput) => rejectExpenseClaim(input));
  handleWithArg(IPC.CANCEL_EXPENSE_CLAIM, (expenseClaimId: string) => cancelExpenseClaim(systemDb, expenseClaimId));
  handleWithArg(IPC.REIMBURSE_EXPENSE_CLAIM, (input: ReimburseExpenseClaimInput) => reimburseExpenseClaim(systemDb, input));
  handleWithArg(IPC.LIST_OUTSTANDING_REIMBURSEMENTS, (employeeId: string | undefined) => listOutstandingReimbursements(employeeId));

  handle(IPC.PICK_ATTACHMENT_FILE, () => pickAttachmentFile());
  handleWithArg(IPC.UPLOAD_DOCUMENT, (input: UploadDocumentInput) => uploadDocument(input));
  handleWithArg(IPC.LIST_DOCUMENTS_FOR_ENTITY, ({ entityType, entityId }: ListDocumentsForEntityInput) => listDocumentsForEntity(entityType, entityId));
  handleWithArg(IPC.DOWNLOAD_DOCUMENT, (documentId: string) => downloadDocument(documentId));
  handleWithArg(IPC.DELETE_DOCUMENT, (documentId: string) => deleteDocument(documentId));
  handleWithArg(IPC.SEARCH_DOCUMENTS, (input: SearchDocumentsInput) => searchDocuments(input));

  handle(IPC.LIST_EMPLOYEE_PAYROLL_PROFILES, () => listEmployeePayrollProfiles());
  handleWithArg(IPC.UPDATE_EMPLOYEE_PAYROLL_PROFILE, (input: UpdateEmployeePayrollProfileInput) => updateEmployeePayrollProfile(input));
  handleWithArg(IPC.CREATE_SALARY_COMPONENT, (input: SalaryComponentDefinitionInput) => createSalaryComponent(input));
  handle(IPC.LIST_SALARY_COMPONENTS, () => listSalaryComponents());
  handleWithArg(IPC.ASSIGN_SALARY_STRUCTURE, (input: AssignSalaryStructureInput) => assignSalaryStructure(input));
  handleWithArg(IPC.LIST_SALARY_STRUCTURES_FOR_EMPLOYEE, (employeeId: string) => listSalaryStructuresForEmployee(systemDb, employeeId));
  handle(IPC.GET_COMPANY_PAYROLL_SETTINGS, () => getCompanyPayrollSettings(systemDb));
  handleWithArg(IPC.UPDATE_COMPANY_PAYROLL_SETTINGS, (input: UpdateCompanyPayrollSettingsInput) => updateCompanyPayrollSettings(input));
  handleWithArg(IPC.CREATE_OR_UPDATE_PAYROLL_RULE, (input: CreateOrUpdatePayrollRuleInput) => createOrUpdatePayrollRule(systemDb, input));
  handle(IPC.LIST_ACTIVE_PAYROLL_RULES, () => listActivePayrollRules(systemDb));
  handleWithArg(IPC.LIST_PAYROLL_RULE_VERSIONS, (ruleType: string) => listPayrollRuleVersions(systemDb, ruleType));
  handleWithArg(IPC.CREATE_LEAVE_TYPE, (input: LeaveTypeInput) => createLeaveType(input));
  handle(IPC.LIST_LEAVE_TYPES, () => listLeaveTypes());
  handleWithArg(IPC.APPLY_LEAVE, (input: ApplyLeaveInput) => applyLeave(input));
  handleWithArg(IPC.LIST_LEAVE_APPLICATIONS, (employeeId: string | undefined) => listLeaveApplications(employeeId));
  handleWithArg(IPC.APPROVE_LEAVE, (leaveApplicationId: string) => approveLeave(systemDb, leaveApplicationId));
  handleWithArg(IPC.REJECT_LEAVE, (input: RejectLeaveInput) => rejectLeave(input));
  handleWithArg(IPC.LIST_LEAVE_BALANCES, (employeeId: string) => listLeaveBalances(systemDb, employeeId));
  handleWithArg(IPC.MARK_ATTENDANCE, (input: MarkAttendanceInput) => markAttendance(input));
  handleWithArg(IPC.LIST_ATTENDANCE_FOR_EMPLOYEE, (input: ListAttendanceForEmployeeInput) => listAttendanceForEmployee(input));
  handleWithArg(IPC.CREATE_PAYROLL_RUN, (input: CreatePayrollRunInput) => createPayrollRun(systemDb, input));
  handleWithArg(IPC.PROCESS_PAYROLL_RUN, (payrollRunId: string) => processPayrollRun(systemDb, payrollRunId));
  handleWithArg(IPC.OVERRIDE_PAYSLIP_TDS, (input: OverridePayslipTdsInput) => overridePayslipTds(input));
  handleWithArg(IPC.GET_PAYROLL_RUN, (payrollRunId: string) => getPayrollRun(payrollRunId));
  handle(IPC.LIST_PAYROLL_RUNS, () => listPayrollRuns());
  handleWithArg(IPC.POST_PAYROLL_RUN, (payrollRunId: string) => postPayrollRun(payrollRunId));
  handleWithArg(IPC.DISBURSE_PAYSLIP, (input: DisbursePayslipInput) => disbursePayslip(systemDb, input));
  handleWithArg(IPC.RUN_GRATUITY_PROVISIONING, (input: RunGratuityProvisioningInput) => runGratuityProvisioning(systemDb, input));
  handleWithArg(IPC.RECORD_SEPARATION, (input: RecordSeparationInput) => recordSeparation(systemDb, input));
  handleWithArg(IPC.SETTLE_GRATUITY, (input: SettleGratuityInput) => settleGratuity(systemDb, input));
  handle(IPC.LIST_GRATUITY_RECORDS, () => listGratuityRecords());

  handleWithArg(IPC.CREATE_COST_CENTRE, (input: CreateCostCentreInput) => createCostCentre(input));
  handle(IPC.LIST_COST_CENTRES, () => listCostCentres());
  handleWithArg(IPC.UPDATE_COST_CENTRE, (input: UpdateCostCentreInput) => updateCostCentre(input));
  handleWithArg(IPC.GET_COST_CENTRE_REPORT, (input: CostCentreReportInput) => getCostCentreReport(input));
  handleWithArg(IPC.CREATE_BUDGET, (input: CreateBudgetInput) => createBudget(input));
  handle(IPC.LIST_BUDGETS, () => listBudgets());
  handleWithArg(IPC.UPDATE_BUDGET_LINE, (input: UpdateBudgetLineInput) => updateBudgetLine(input));
  handleWithArg(IPC.GET_BUDGET_VS_ACTUAL, (budgetId: string) => getBudgetVsActual(systemDb, budgetId));
  handleWithArg(IPC.CREATE_ASSET_CLASS, (input: CreateAssetClassInput) => createAssetClass(input));
  handle(IPC.LIST_ASSET_CLASSES, () => listAssetClasses());
  handleWithArg(IPC.ACQUIRE_FIXED_ASSET, (input: AcquireFixedAssetInput) => acquireFixedAsset(systemDb, input));
  handle(IPC.LIST_FIXED_ASSETS, () => listFixedAssets());
  handleWithArg(IPC.GET_ASSET_DEPRECIATION_SCHEDULE, (assetId: string) => getAssetDepreciationSchedule(assetId));
  handleWithArg(IPC.DISPOSE_FIXED_ASSET, (input: DisposeFixedAssetInput) => disposeFixedAsset(systemDb, input));
  handleWithArg(IPC.PREVIEW_DEPRECIATION_RUN, (input: RunDepreciationInput) => previewDepreciationRun(systemDb, input));
  handleWithArg(IPC.POST_DEPRECIATION_RUN, (input: RunDepreciationInput) => postDepreciationRun(systemDb, input));
  handleWithArg(IPC.CREATE_OR_UPDATE_FIXED_ASSET_RATE, (input: CreateOrUpdateFixedAssetRateInput) => createOrUpdateFixedAssetRate(systemDb, input));
  handle(IPC.LIST_ACTIVE_FIXED_ASSET_RATES, () => listActiveFixedAssetRates(systemDb));
  handleWithArg(IPC.LIST_FIXED_ASSET_RATE_VERSIONS, (ruleType: string) => listFixedAssetRateVersions(systemDb, ruleType));

  createWindow();
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error('Failed to start MHTS ERP shell:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
