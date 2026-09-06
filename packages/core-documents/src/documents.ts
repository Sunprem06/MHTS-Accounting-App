import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import type { AttachDocumentInput, DocumentData, DocumentSummary, SearchDocumentsQuery } from './types';

/** The composable half — usable inside a caller's own transaction (e.g. a future flow that wants to attach a document in the same transaction as some other write), same reasoning as core-accounting's createVoucherInTransaction. */
export async function attachDocumentInTransaction(trx: Transaction<CompanyDatabase>, input: AttachDocumentInput, actorUserId: string | null): Promise<string> {
  if (!input.fileName.trim()) {
    throw new Error('File name is required');
  }
  if (input.fileData.length === 0) {
    throw new Error('Cannot attach an empty file');
  }

  const id = randomUUID();
  await trx
    .insertInto('document_attachment')
    .values({
      id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.fileData.length,
      file_data: input.fileData,
      description: input.description ?? null,
      uploaded_by: actorUserId,
    })
    .execute();

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'DocumentAttachment',
    entityId: id,
    afterData: { entityType: input.entityType, entityId: input.entityId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.fileData.length },
  });

  return id;
}

/** Standalone entry point — opens its own transaction, the primary path for a user-driven upload. */
export async function attachDocument(companyDb: Kysely<CompanyDatabase>, input: AttachDocumentInput, actorUserId: string | null): Promise<string> {
  return companyDb.transaction().execute((trx) => attachDocumentInTransaction(trx, input, actorUserId));
}

/** Metadata only — file_data is deliberately excluded so a list view never pulls blob content over the wire. */
export async function listDocumentsForEntity(companyDb: Kysely<CompanyDatabase>, entityType: string, entityId: string): Promise<DocumentSummary[]> {
  const rows = await companyDb
    .selectFrom('document_attachment')
    .select([
      'id',
      'entity_type as entityType',
      'entity_id as entityId',
      'file_name as fileName',
      'mime_type as mimeType',
      'file_size_bytes as fileSizeBytes',
      'description',
      'uploaded_by as uploadedBy',
      'uploaded_at as uploadedAt',
    ])
    .where('entity_type', '=', entityType)
    .where('entity_id', '=', entityId)
    .orderBy('uploaded_at', 'desc')
    .execute();
  return rows;
}

/** Fetches the actual file bytes — a separate call from the list, so blobs only ever load when actually needed (download/view). */
export async function getDocumentData(companyDb: Kysely<CompanyDatabase>, documentId: string): Promise<DocumentData> {
  const row = await companyDb
    .selectFrom('document_attachment')
    .select(['id', 'file_name as fileName', 'mime_type as mimeType', 'file_data as fileData'])
    .where('id', '=', documentId)
    .executeTakeFirst();
  if (!row) {
    throw new Error('Document not found');
  }
  return row;
}

/** Hard delete — Rule #5's append-only requirement governs audit_log specifically, not general business records — but every mutation in this codebase gets an audit entry, including this one. */
export async function deleteDocument(companyDb: Kysely<CompanyDatabase>, documentId: string, actorUserId: string | null): Promise<void> {
  await companyDb.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('document_attachment')
      .select(['id', 'entity_type', 'entity_id', 'file_name'])
      .where('id', '=', documentId)
      .executeTakeFirst();
    if (!existing) {
      throw new Error('Document not found');
    }

    await trx.deleteFrom('document_attachment').where('id', '=', documentId).execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'DELETE',
      entityType: 'DocumentAttachment',
      entityId: documentId,
      beforeData: { entityType: existing.entity_type, entityId: existing.entity_id, fileName: existing.file_name },
    });
  });
}

/** Plain filename/description substring search — deliberately NOT full-text content extraction/OCR, which is out of scope for this pass. */
export async function searchDocuments(companyDb: Kysely<CompanyDatabase>, query: SearchDocumentsQuery): Promise<DocumentSummary[]> {
  const term = `%${query.query.trim()}%`;
  let dbQuery = companyDb
    .selectFrom('document_attachment')
    .select([
      'id',
      'entity_type as entityType',
      'entity_id as entityId',
      'file_name as fileName',
      'mime_type as mimeType',
      'file_size_bytes as fileSizeBytes',
      'description',
      'uploaded_by as uploadedBy',
      'uploaded_at as uploadedAt',
    ])
    .where(({ eb, or }) => or([eb('file_name', 'like', term), eb('description', 'like', term)]))
    .orderBy('uploaded_at', 'desc');

  if (query.entityType) {
    dbQuery = dbQuery.where('entity_type', '=', query.entityType);
  }

  return dbQuery.execute();
}
