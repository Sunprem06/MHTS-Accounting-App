import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { resolveAppPaths, openAndMigrateSystemDb } from './db';
import { listCompanies, createCompany, login, resetPassword } from './handlers';
import { session } from './session';
import { IPC, type IpcResult, type CreateCompanyInput, type LoginInput, type ResetPasswordInput } from '../shared/ipc';

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

  handle(IPC.LIST_COMPANIES, () => listCompanies(systemDb));
  handleWithArg(IPC.CREATE_COMPANY, (input: CreateCompanyInput) => createCompany(systemDb, paths, input));
  handleWithArg(IPC.LOGIN, (input: LoginInput) => login(systemDb, input));
  handleWithArg(IPC.RESET_PASSWORD, (input: ResetPasswordInput) => resetPassword(systemDb, input));
  handle(IPC.LOGOUT, async () => {
    await session.clear();
  });
  handle(IPC.GET_SESSION, async () => session.get());

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
