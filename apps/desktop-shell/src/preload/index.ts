import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AccountGroupSummary,
  type AdminResetPasswordInput,
  type AdminResetPasswordResult,
  type BalanceSheetResult,
  type ChangePasswordInput,
  type CompanySummary,
  type CompanyUserSummary,
  type CreateCompanyInput,
  type CreateCompanyResult,
  type CreateLedgerInput,
  type CreateVoucherInput,
  type IpcResult,
  type LedgerAccountSummary,
  type LoginInput,
  type LoginResult,
  type ProfitAndLossInput,
  type ProfitAndLossResult,
  type ResetPasswordInput,
  type SessionInfo,
  type TrialBalanceResult,
  type VoucherSummary,
} from '../shared/ipc';

const api = {
  listCompanies: (): Promise<IpcResult<CompanySummary[]>> => ipcRenderer.invoke(IPC.LIST_COMPANIES),
  createCompany: (input: CreateCompanyInput): Promise<IpcResult<CreateCompanyResult>> =>
    ipcRenderer.invoke(IPC.CREATE_COMPANY, input),
  listCompanyUsers: (): Promise<IpcResult<CompanyUserSummary[]>> => ipcRenderer.invoke(IPC.LIST_COMPANY_USERS),
  login: (input: LoginInput): Promise<IpcResult<LoginResult>> => ipcRenderer.invoke(IPC.LOGIN, input),
  changePassword: (input: ChangePasswordInput): Promise<IpcResult<SessionInfo>> =>
    ipcRenderer.invoke(IPC.CHANGE_PASSWORD, input),
  resetPassword: (input: ResetPasswordInput): Promise<IpcResult<SessionInfo>> =>
    ipcRenderer.invoke(IPC.RESET_PASSWORD, input),
  adminResetPassword: (input: AdminResetPasswordInput): Promise<IpcResult<AdminResetPasswordResult>> =>
    ipcRenderer.invoke(IPC.ADMIN_RESET_PASSWORD, input),
  logout: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.LOGOUT),
  getSession: (): Promise<IpcResult<SessionInfo | null>> => ipcRenderer.invoke(IPC.GET_SESSION),
  listAccountGroups: (): Promise<IpcResult<AccountGroupSummary[]>> => ipcRenderer.invoke(IPC.LIST_ACCOUNT_GROUPS),
  listLedgers: (): Promise<IpcResult<LedgerAccountSummary[]>> => ipcRenderer.invoke(IPC.LIST_LEDGERS),
  createLedger: (input: CreateLedgerInput): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.CREATE_LEDGER, input),
  createVoucher: (input: CreateVoucherInput): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.CREATE_VOUCHER, input),
  listVouchers: (): Promise<IpcResult<VoucherSummary[]>> => ipcRenderer.invoke(IPC.LIST_VOUCHERS),
  cancelVoucher: (voucherId: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.CANCEL_VOUCHER, voucherId),
  getTrialBalance: (): Promise<IpcResult<TrialBalanceResult>> => ipcRenderer.invoke(IPC.GET_TRIAL_BALANCE),
  getProfitAndLoss: (input: ProfitAndLossInput): Promise<IpcResult<ProfitAndLossResult>> =>
    ipcRenderer.invoke(IPC.GET_PROFIT_AND_LOSS, input),
  getBalanceSheet: (asOfDate: string): Promise<IpcResult<BalanceSheetResult>> =>
    ipcRenderer.invoke(IPC.GET_BALANCE_SHEET, asOfDate),
};

export type MhtsApi = typeof api;

contextBridge.exposeInMainWorld('mhts', api);
