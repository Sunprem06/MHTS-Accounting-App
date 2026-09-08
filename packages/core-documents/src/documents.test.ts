import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { attachDocument, deleteDocument, getDocumentData, listDocumentsForEntity, searchDocuments } from './documents';

describe('core-documents: attach/list/get/delete/search (smoke)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
  });

  afterEach(async () => {
    await handle.close();
  });

  it('a byte-for-byte round-trip: the exact bytes attached are the exact bytes read back', async () => {
    const originalBytes = Buffer.from([0, 1, 2, 255, 254, 253, 10, 13]); // deliberately includes null/high bytes and CR/LF, since this is stored as a BLOB
    const documentId = await attachDocument(companyDb, { entityType: 'Voucher', entityId: 'v1', fileName: 'receipt.pdf', mimeType: 'application/pdf', fileData: originalBytes }, null);

    const data = await getDocumentData(companyDb, documentId);
    expect(data.fileData.equals(originalBytes)).toBe(true);
    expect(data.fileName).toBe('receipt.pdf');
    expect(data.mimeType).toBe('application/pdf');
  });

  it('listDocumentsForEntity is scoped to the exact (entityType, entityId) pair, not just entityType', async () => {
    await attachDocument(companyDb, { entityType: 'Voucher', entityId: 'v1', fileName: 'a.pdf', mimeType: 'application/pdf', fileData: Buffer.from('a') }, null);
    await attachDocument(companyDb, { entityType: 'Voucher', entityId: 'v2', fileName: 'b.pdf', mimeType: 'application/pdf', fileData: Buffer.from('b') }, null);

    const forV1 = await listDocumentsForEntity(companyDb, 'Voucher', 'v1');
    expect(forV1).toHaveLength(1);
    expect(forV1[0].fileName).toBe('a.pdf');
  });

  it('deleteDocument removes it from both listDocumentsForEntity and getDocumentData', async () => {
    const documentId = await attachDocument(companyDb, { entityType: 'Voucher', entityId: 'v1', fileName: 'a.pdf', mimeType: 'application/pdf', fileData: Buffer.from('a') }, null);
    await deleteDocument(companyDb, documentId, null);

    await expect(getDocumentData(companyDb, documentId)).rejects.toThrow();
    expect(await listDocumentsForEntity(companyDb, 'Voucher', 'v1')).toHaveLength(0);
  });

  it('searchDocuments matches on filename/description substring, is entity-agnostic across types, and an unmatched term returns empty', async () => {
    await attachDocument(companyDb, { entityType: 'Voucher', entityId: 'v1', fileName: 'december-invoice.pdf', mimeType: 'application/pdf', fileData: Buffer.from('x'), description: 'Q3 travel receipt' }, null);
    await attachDocument(companyDb, { entityType: 'Party', entityId: 'p1', fileName: 'contract.pdf', mimeType: 'application/pdf', fileData: Buffer.from('y') }, null);

    const byFileName = await searchDocuments(companyDb, { query: 'invoice' });
    expect(byFileName).toHaveLength(1);

    const byDescription = await searchDocuments(companyDb, { query: 'travel' });
    expect(byDescription).toHaveLength(1);

    const noMatch = await searchDocuments(companyDb, { query: 'nonexistent-term-xyz' });
    expect(noMatch).toHaveLength(0);
  });
});
