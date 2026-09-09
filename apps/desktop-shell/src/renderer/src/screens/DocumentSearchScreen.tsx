import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Search size={18} style={{ color: 'var(--accent)' }} /> Document search
        </h1>
      </div>

      <form onSubmit={handleSearch} className="card">
        <div className="field-row">
          <label className="field" style={{ flex: 1 }}>
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by filename or description…" />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      {results && (
        <div className="card" style={{ overflowX: 'auto' }}>
          {results.length === 0 ? (
            <p className="empty-state">No matching documents.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Attached to</th>
                  <th>Description</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((doc) => (
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
