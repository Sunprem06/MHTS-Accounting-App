import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import {
  attachDocument as coreAttachDocument,
  listDocumentsForEntity as coreListDocumentsForEntity,
  getDocumentData,
  deleteDocument as coreDeleteDocument,
  searchDocuments as coreSearchDocuments,
} from '@mhts/core-documents';
import { session } from './session';
import type { DocumentSummary, DownloadDocumentResult, SearchDocumentsInput, UploadDocumentInput } from '../shared/ipc';

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function detectMimeType(fileName: string): string {
  return MIME_TYPES_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}

/** Native open-file dialog — the user's own click IS the consent for which file gets read, same reasoning as bankingHandlers.ts's pickStatementFile. No extension filter — an attachment can be any document type. */
export async function pickAttachmentFile(): Promise<{ fileName: string; mimeType: string; fileDataBase64: string } | null> {
  requireSessionWithCompanyDb('DOCUMENTS.UPLOAD');

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'] }) : await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = basename(filePath);
  const fileDataBase64 = readFileSync(filePath).toString('base64');
  return { fileName, mimeType: detectMimeType(fileName), fileDataBase64 };
}

export async function uploadDocument(input: UploadDocumentInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('DOCUMENTS.UPLOAD');
  return coreAttachDocument(
    companyDb,
    {
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileData: Buffer.from(input.fileDataBase64, 'base64'),
      description: input.description,
    },
    info.userId,
  );
}

export async function listDocumentsForEntity(entityType: string, entityId: string): Promise<DocumentSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('DOCUMENTS.VIEW');
  return coreListDocumentsForEntity(companyDb, entityType, entityId);
}

/** Native save-file dialog — mirrors backupHandlers.ts's save pattern. */
export async function downloadDocument(documentId: string): Promise<DownloadDocumentResult> {
  const { companyDb } = requireSessionWithCompanyDb('DOCUMENTS.VIEW');
  const document = await getDocumentData(companyDb, documentId);

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, { defaultPath: document.fileName })
    : await dialog.showSaveDialog({ defaultPath: document.fileName });
  if (result.canceled || !result.filePath) {
    return { fileName: document.fileName, saved: false };
  }

  writeFileSync(result.filePath, document.fileData);
  return { fileName: document.fileName, saved: true };
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('DOCUMENTS.DELETE');
  await coreDeleteDocument(companyDb, documentId, info.userId);
}

export async function searchDocuments(input: SearchDocumentsInput): Promise<DocumentSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('DOCUMENTS.VIEW');
  return coreSearchDocuments(companyDb, input);
}
