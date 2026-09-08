import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { BrowserWindow, dialog } from 'electron';
import { machineIdSync } from 'node-machine-id';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { verifyLicenseFile, LicenseError } from '@mhts/core-licensing';
import type { LicensePayload } from '@mhts/core-licensing';
import type { AppPaths } from './db';
import type { LicenseStatus } from '../shared/ipc';
import { activateOnline, checkinOnline } from './licensePortalClient';

function licenseFilePath(paths: AppPaths): string {
  return join(paths.userDataDir, 'license.lic');
}

/** For the offline-activation UI: the customer reads this and shares it with support so staff can provision a matching offline activation package. */
export function getMachineId(): string {
  return machineIdSync();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long a portal-registered activation can go without a successful
 * checkin before continued use starts soft-blocking (see `login()` in
 * handlers.ts). Deliberately generous — a customer online even once a
 * month never notices — while still eventually closing the whole-folder-
 * clone gap this initiative exists to close.
 */
const GRACE_PERIOD_DAYS = 30;

function daysSince(isoTimestamp: string): number {
  return Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / MS_PER_DAY);
}

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

    // Only activations that went through the portal (online, or the offline
    // fallback package which is still portal-provisioned) carry an
    // activation_token — a bare offline signature check with zero portal
    // involvement can't exist for a NEW activation going forward, but this
    // guard also means the check is a no-op for anything that predates it.
    const activation = await systemDb.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirst();
    if (activation?.activation_token && (!activation.last_validated_at || daysSince(activation.last_validated_at) > GRACE_PERIOD_DAYS)) {
      return {
        valid: false,
        graceExpired: true,
        reason: `This installation hasn't reconnected to verify its license in over ${GRACE_PERIOD_DAYS} days. Connect to the internet to continue.`,
      };
    }

    return { valid: true, payload, expiresInDays: daysUntilExpiry(payload) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Best-effort re-validation with the portal — called fire-and-forget at app
 * startup (see index.ts) and from the Company List screen's manual
 * "Reconnect now" button. Never throws: any unreachable-portal outcome is a
 * silent no-op (last_validated_at stays as-is, the grace period handles the
 * rest); an explicit revoked/invalid_token/not_found response forces the
 * grace check to fail immediately rather than waiting out the window, since
 * that's the portal actively saying this copy isn't authoritative anymore.
 */
export async function attemptOnlineCheckin(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const activation = await systemDb.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirst();
  if (!activation?.activation_token) {
    return;
  }

  const result = await checkinOnline(activation.license_id, activation.machine_id, activation.activation_token);
  if (!result.reached) {
    return;
  }

  if (result.data.ok) {
    await systemDb.updateTable('license_activation').set({ last_validated_at: new Date().toISOString() }).where('id', '=', 'default').execute();
  } else {
    await systemDb.updateTable('license_activation').set({ last_validated_at: new Date(0).toISOString() }).where('id', '=', 'default').execute();
  }
}

/**
 * Primary path: activates online against the licensing portal using the
 * activation code the customer received at purchase. On success, the
 * portal hands back the same kind of Ed25519-signed license.lic contents
 * the offline path below expects — verified and bound completely locally,
 * exactly as before. The private signing key never touches the portal; it
 * only stores and returns whatever staff pasted in from an offline
 * `scripts/generate-license.mjs` run.
 */
export async function activateLicenseOnline(systemDb: Kysely<SystemDatabase>, paths: AppPaths, activationCode: string): Promise<LicenseStatus> {
  const machineId = machineIdSync();
  const result = await activateOnline(activationCode, machineId, hostname());
  if (!result.reached) {
    return { valid: false, reason: result.reason };
  }

  try {
    const payload = await verifyAndBind(systemDb, result.data.licenseFileContents);
    writeFileSync(licenseFilePath(paths), result.data.licenseFileContents);
    await systemDb.updateTable('license_activation').set({ activation_token: result.data.activationToken, last_validated_at: new Date().toISOString() }).where('id', '=', 'default').execute();
    return { valid: true, payload, expiresInDays: daysUntilExpiry(payload) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Offline/no-signal-at-install fallback: picks a license file via the
 * native dialog, verifies + binds it locally exactly like the online path.
 * Requires an `activationToken` pasted in alongside the file — support
 * provisions this out-of-band (staff already hold the customer's machine
 * id, so they can call the SAME portal endpoint on the customer's behalf
 * and hand back both pieces by email/USB). This is what closes the "just
 * keep using the file-picker forever, no portal involvement at all" hole:
 * the token is still checked against the portal on this install's first
 * later `attemptOnlineCheckin` — a fabricated or mismatched token gets
 * rejected then, even though it can't be verified at the moment of offline
 * activation itself.
 */
export async function activateLicenseOffline(systemDb: Kysely<SystemDatabase>, paths: AppPaths, activationToken: string): Promise<LicenseStatus> {
  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'], filters: [{ name: 'MHTS License File', extensions: ['lic', 'json'] }] })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'MHTS License File', extensions: ['lic', 'json'] }] });
  if (result.canceled || result.filePaths.length === 0) {
    return checkLicenseStatus(systemDb, paths);
  }
  if (!activationToken) {
    return { valid: false, reason: 'An activation token from MHTSdigiXR support is required alongside the license file for offline activation.' };
  }

  const fileContents = readFileSync(result.filePaths[0], 'utf8');
  try {
    const payload = await verifyAndBind(systemDb, fileContents);
    writeFileSync(licenseFilePath(paths), fileContents);
    await systemDb.updateTable('license_activation').set({ activation_token: activationToken, last_validated_at: new Date().toISOString() }).where('id', '=', 'default').execute();
    return { valid: true, payload, expiresInDays: daysUntilExpiry(payload) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
