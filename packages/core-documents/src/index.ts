// Phase 6 (Expenses, Travel, Documents): generic, entity-agnostic document
// attachment + search. Pure TypeScript, zero Electron/UI dependency (Rule
// #1). Deliberately has NO dependency on @mhts/core-accounting — any
// entity_type/entity_id pair is attachable with zero schema changes, which
// is what actually satisfies "every transaction type can carry an attached
// document."
export type { DocumentSummary, DocumentData, AttachDocumentInput, SearchDocumentsQuery } from './types';
export { DOCUMENTS_PERMISSIONS, grantDocumentsPermissions } from './permissions';
export { attachDocumentInTransaction, attachDocument, listDocumentsForEntity, getDocumentData, deleteDocument, searchDocuments } from './documents';
