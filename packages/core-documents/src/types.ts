export interface DocumentSummary {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  description: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface DocumentData {
  id: string;
  fileName: string;
  mimeType: string;
  fileData: Buffer;
}

export interface AttachDocumentInput {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileData: Buffer;
  description?: string;
}

export interface SearchDocumentsQuery {
  query: string;
  entityType?: string;
}
