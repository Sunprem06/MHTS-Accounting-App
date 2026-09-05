import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AdminResetPasswordInput,
  type AdminResetPasswordResult,
  type ChangePasswordInput,
  type CompanySummary,
  type CompanyUserSummary,
  type CreateCompanyInput,
  type CreateCompanyResult,
  type IpcResult,
  type LoginInput,
  type LoginResult,
  type ResetPasswordInput,
  type SessionInfo,
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
};

export type MhtsApi = typeof api;

contextBridge.exposeInMainWorld('mhts', api);
