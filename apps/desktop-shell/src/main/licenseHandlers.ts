import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import { machineIdSync } from 'node-machine-id';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { verifyLicenseFile, LicenseError } from '@mhts/core-licensing';
import type { LicensePayload } from '@mhts/core-licensing';
import type { AppPaths } from './db';
import type { LicenseStatus } from '../shared/ipc';

function licenseFilePath(paths: AppPaths): string {
  return join(paths.userDataDir, 'license.lic');
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Null for a perpetual license (no expiresAt). Not itself a validity check — checkLicenseStatus already fails once actually past expiry; this is purely for the UI's "renew soon" reminder. */
function daysUntilExpiry(payload: LicensePayload): number | null {
  if (!payload.expiresAt) {
    return null;
  }
  const today = new Date().toISOString().slice(0, 10);
  const diffMs = new Date(`${payload.expiresAt}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(diffMs / MS_PER_DAY);
}

/**
 * Verifies the signature/expiry (core-licensing) AND the local machine
 * binding (this file): if a binding record already exists for the SAME
 * licenseId, its machine_id must match this machine's — a different machine
 * id means the license (and this system DB) was copied elsewhere. A binding
 * for a DIFFERENT licenseId just means a new/renewed license was loaded;
 * that overwrites the record rather than failing (a legitimate upgrade, not
 * a bypass).
 */
async function verifyAndBind(systemDb: Kysely<SystemDatabase>, fileContents: string): Promise<LicensePayload> {
  const payload = verifyLicenseFile(fileContents);
  const machineId = machineIdSync();

  const existing = await systemDb.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirst();
  if (existing && existing.license_id === payload.licenseId && existing.machine_id !== machineId) {
    throw new LicenseError('This license is already activated on a different machine.');
  }

  if (!existing) {
    await systemDb.insertInto('license_activation').values({ id: 'default', license_id: payload.licenseId, machine_id: machineId }).execute();
  } else if (existing.license_id !== payload.licenseId) {
    await systemDb.updateTable('license_activation').set({ license_id: payload.licenseId, machine_id: machineId, activated_at: new Date().toISOString() }).where('id', '=', 'default').execute();
  }

  return payload;
}

/** Called at app startup — never prompts, just reports whatever's currently on file (or nothing). */
export async function checkLicenseStatus(systemDb: Kysely<SystemDatabase>, paths: AppPaths): Promise<LicenseStatus> {
  const filePath = licenseFilePath(paths);
  if (!existsSync(filePath)) {
    return { valid: false, reason: 'No license has been activated on this installation yet.' };
  }
  try {
    const payload = await verifyAndBind(systemDb, readFileSync(filePath, 'utf8'));
    return { valid: true, payload, expiresInDays: daysUntilExpiry(payload) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** User-initiated: picks a license file via the native dialog, verifies + binds it, and copies it into place only once it checks out. */
export async function activateLicense(systemDb: Kysely<SystemDatabase>, paths: AppPaths): Promise<LicenseStatus> {
  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'], filters: [{ name: 'MHTS License File', extensions: ['lic', 'json'] }] })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'MHTS License File', extensions: ['lic', 'json'] }] });
  if (result.canceled || result.filePaths.length === 0) {
    return checkLicenseStatus(systemDb, paths);
  }

  const fileContents = readFileSync(result.filePaths[0], 'utf8');
  try {
    const payload = await verifyAndBind(systemDb, fileContents);
    writeFileSync(licenseFilePath(paths), fileContents);
    return { valid: true, payload, expiresInDays: daysUntilExpiry(payload) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
