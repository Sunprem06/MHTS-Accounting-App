import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { seedDefaultTdsRates } from '@mhts/core-sales-purchase';
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
