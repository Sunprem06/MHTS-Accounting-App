import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type CompanySummary,
  type CreateCompanyInput,
  type IpcResult,
  type LoginInput,
  type SessionInfo,
} from '../shared/ipc';

const api = {
  listCompanies: (): Promise<IpcResult<CompanySummary[]>> => ipcRenderer.invoke(IPC.LIST_COMPANIES),
  createCompany: (input: CreateCompanyInput): Promise<IpcResult<CompanySummary>> =>
    ipcRenderer.invoke(IPC.CREATE_COMPANY, input),
  login: (input: LoginInput): Promise<IpcResult<SessionInfo>> => ipcRenderer.invoke(IPC.LOGIN, input),
  logout: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.LOGOUT),
  getSession: (): Promise<IpcResult<SessionInfo | null>> => ipcRenderer.invoke(IPC.GET_SESSION),
};

export type MhtsApi = typeof api;

contextBridge.exposeInMainWorld('mhts', api);
