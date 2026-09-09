import { useEffect, useState } from 'react';
import type { DocumentSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  entityType: string;
  entityId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Generic, entity-agnostic attachment list/upload/download/delete — any entity_type/entity_id pair is attachable with zero schema changes, which is what actually satisfies "every transaction type can carry an attached document." */
export function AttachmentsPanel({ session, entityType, entityId }: Props) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canUpload = session.permissions.includes('DOCUMENTS.UPLOAD');
  const canView = session.permissions.includes('DOCUMENTS.VIEW');
  const canDelete = session.permissions.includes('DOCUMENTS.DELETE');

  async function refresh() {
    const result = await window.mhts.listDocumentsForEntity({ entityType, entityId });
    if (result.ok && result.data) {
      setDocuments(result.data);
    } else {
      setError(result.error ?? 'Failed to load attachments');
    }
  }

  useEffect(() => {
    refresh();
  }, [entityType, entityId]);

  async function handleUpload() {
    setError(null);
    const picked = await window.mhts.pickAttachmentFile();
    if (!picked.ok) {
      setError(picked.error ?? 'Failed to read file');
      return;
    }
    if (!picked.data) {
      return; // cancelled
    }
    setBusy(true);
    const result = await window.mhts.uploadDocument({
      entityType,
      entityId,
      fileName: picked.data.fileName,
      mimeType: picked.data.mimeType,
      fileDataBase64: picked.data.fileDataBase64,
    });
    setBusy(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to attach document');
    }
  }

  async function handleDownload(documentId: string) {
    setError(null);
    const result = await window.mhts.downloadDocument(documentId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to download document');
    }
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm('Delete this attachment? This cannot be undone.')) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await window.mhts.deleteDocument(documentId);
    setBusy(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to delete document');
    }
  }

  if (!canView) {
    return null;
  }

  return (
    <div className="card" style={{ marginTop: 12, fontSize: 13 }}>
      <strong>Attachments</strong>
      {error && <p className="error-text">{error}</p>}
      {documents === null ? (
        <p className="empty-state">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="empty-state">No attachments yet.</p>
      ) : (
        <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
          {documents.map((doc) => (
            <li key={doc.id} style={{ padding: '2px 0' }}>
              {doc.fileName} ({formatSize(doc.fileSizeBytes)}){doc.description ? ` — ${doc.description}` : ''}{' '}
              <button type="button" onClick={() => handleDownload(doc.id)}>
                Download
              </button>{' '}
              {canDelete && (
                <button type="button" disabled={busy} onClick={() => handleDelete(doc.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <button type="button" disabled={busy} onClick={handleUpload}>
          {busy ? 'Working…' : 'Attach a file…'}
        </button>
      )}
    </div>
  );
}
