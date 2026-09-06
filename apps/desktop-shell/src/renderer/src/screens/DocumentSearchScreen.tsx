import { useState } from 'react';
import type { DocumentSummary } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

/** Plain filename/description substring search — not full-text content extraction/OCR, which is out of scope for this pass. */
export function DocumentSearchScreen({ onBack }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    const result = await window.mhts.searchDocuments({ query });
    setLoading(false);
    if (result.ok && result.data) {
      setResults(result.data);
    } else {
      setError(result.error ?? 'Search failed');
    }
  }

  async function handleDownload(documentId: string) {
    setError(null);
    const result = await window.mhts.downloadDocument(documentId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to download document');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Document search</h1>
      <form onSubmit={handleSearch}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by filename or description…" style={{ width: 320 }} />{' '}
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {results && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>File</th>
              <th style={{ textAlign: 'left' }}>Attached to</th>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ textAlign: 'left' }}>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={5}>No matching documents.</td>
              </tr>
            ) : (
              results.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.fileName}</td>
                  <td>
                    {doc.entityType} ({doc.entityId.slice(0, 8)}…)
                  </td>
                  <td>{doc.description ?? ''}</td>
                  <td>{doc.uploadedAt}</td>
                  <td>
                    <button type="button" onClick={() => handleDownload(doc.id)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
