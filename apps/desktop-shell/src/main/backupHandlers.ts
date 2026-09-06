import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { BrowserWindow, dialog } from 'electron';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { openExistingCompanyDb } from './db';
import { session } from './session';

/**
 * On-demand backup: the company's encrypted DB file is copied byte-for-byte
 * (never decrypted to disk — SQLCipher's own file bytes are what's on the
 * export, so a stolen backup file is exactly as protected as the live one).
 * The native save dialog IS the user's consent for where the copy lands —
 * this only runs when the user clicks "Create backup" and picks a folder
 * themselves, never silently.
 */
export async function backupCompany(systemDb: Kysely<SystemDatabase>): Promise<string | null> {
  const actingSession = session.get();
  if (!actingSession) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.MANAGE_COMPANY')) {
    throw new Error('You do not have permission to back up this company');
  }

  const company = await systemDb.selectFrom('company').select('db_file_path').where('id', '=', actingSession.companyId).executeTakeFirstOrThrow();

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const defaultName = `${actingSession.companyName.replace(/[^a-z0-9-_ ]/gi, '_')}-backup-${new Date().toISOString().slice(0, 10)}.db`;
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, { defaultPath: defaultName, filters: [{ name: 'MHTS Company Backup', extensions: ['db'] }] })
    : await dialog.showSaveDialog({ defaultPath: defaultName, filters: [{ name: 'MHTS Company Backup', extensions: ['db'] }] });
  if (result.canceled || !result.filePath) {
    return null;
  }

  copyFileSync(company.db_file_path, result.filePath);
  return result.filePath;
}

/**
 * Restores THIS SAME company (its system-DB entry, and therefore its
 * DEK-wrap, is untouched — this is a same-company rollback to an earlier
 * snapshot, not a cross-install migration) from a previously exported backup
 * file. Deliberately cautious given how hard-to-reverse a bad restore would
 * be:
 *   1. Captures the already-unwrapped session DEK and closes the live
 *      Company DB connection FIRST — copying over a file SQLite still has
 *      open is asking for corruption.
 *   2. Makes its own safety copy of the current (pre-restore) file before
 *      overwriting anything.
 *   3. Copies the chosen backup file into place, then immediately tries to
 *      open it with the captured DEK and run a trivial query — if that
 *      fails (wrong file, wrong company, corrupt export), the pre-restore
 *      safety copy is put back and the user's real data is never left in a
 *      broken state.
 * The session is cleared either way (the DEK it held may no longer be
 * valid against the new file) — the caller must log in again afterward.
 */
export async function restoreCompany(systemDb: Kysely<SystemDatabase>): Promise<{ restored: boolean }> {
  const actingSession = session.get();
  const actingDek = session.getDek();
  if (!actingSession || !actingDek) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.MANAGE_COMPANY')) {
    throw new Error('You do not have permission to restore this company');
  }

  const company = await systemDb.selectFrom('company').select('db_file_path').where('id', '=', actingSession.companyId).executeTakeFirstOrThrow();
  const dbFilePath = company.db_file_path;

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'], filters: [{ name: 'MHTS Company Backup', extensions: ['db'] }] })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'MHTS Company Backup', extensions: ['db'] }] });
  if (result.canceled || result.filePaths.length === 0) {
    return { restored: false };
  }
  const backupFilePath = result.filePaths[0];

  await session.clear(); // close the live connection before touching its file

  const preRestoreSafetyPath = `${dbFilePath}.pre-restore-${randomUUID()}.bak`;
  copyFileSync(dbFilePath, preRestoreSafetyPath);

  try {
    copyFileSync(backupFilePath, dbFilePath);

    const verifyDb = openExistingCompanyDb(dbFilePath, actingDek);
    try {
      await sql`SELECT 1`.execute(verifyDb);
    } finally {
      await verifyDb.destroy();
    }

    unlinkSync(preRestoreSafetyPath);
    return { restored: true };
  } catch (error) {
    // Put the user's real data back exactly as it was — never leave them worse off than before the attempt.
    copyFileSync(preRestoreSafetyPath, dbFilePath);
    if (existsSync(preRestoreSafetyPath)) {
      unlinkSync(preRestoreSafetyPath);
    }
    throw new Error(`Restore failed and was rolled back — the backup file may not match this company. (${error instanceof Error ? error.message : String(error)})`);
  }
}
