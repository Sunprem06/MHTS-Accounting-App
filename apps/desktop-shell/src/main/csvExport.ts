import { writeFileSync } from 'node:fs';
import { BrowserWindow, dialog } from 'electron';
import { session } from './session';
import type { ExportCsvInput } from '../shared/ipc';

/** Builds a plain CSV string from column headers + rows — no library needed for this simple, non-quoting-edge-case-heavy use (GST report values are numbers/short codes/plain names, never containing a comma or newline that would need real CSV quoting). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

/**
 * Exports a plain CSV via the native save dialog — same pattern as
 * backupCompany's dialog.showSaveDialog. This is a reference file for
 * manual filing or handing to a CA, NOT a GSTN-portal-upload-ready format
 * (see the GST Returns screen's own on-screen caption) — a deliberate scope
 * choice, not an oversight (matching the GST portal's exact offline-utility
 * JSON schema is separate, precision-heavy work).
 */
export async function exportCsv(input: ExportCsvInput): Promise<boolean> {
  const actingSession = session.get();
  if (!actingSession) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('GST.VIEW_REPORTS')) {
    throw new Error('You do not have permission to export this report');
  }

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, { defaultPath: input.defaultFileName, filters: [{ name: 'CSV', extensions: ['csv'] }] })
    : await dialog.showSaveDialog({ defaultPath: input.defaultFileName, filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (result.canceled || !result.filePath) {
    return false;
  }

  writeFileSync(result.filePath, input.csvContent, 'utf-8');
  return true;
}
