import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowLeft } from 'lucide-react';
import type { PartyOutstandingRow } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function ReceivablesScreen({ onBack }: Props) {
  const [rows, setRows] = useState<PartyOutstandingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listReceivables();
      if (result.ok && result.data) {
        setRows(result.data);
      } else {
        setError(result.error ?? 'Failed to load receivables');
      }
    })();
  }, []);

  const total = rows?.reduce((sum, row) => sum + row.outstandingAmount, 0) ?? 0;

  return (
    <div className="page">
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ArrowDownToLine size={18} style={{ color: 'var(--accent)' }} /> Receivables
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {rows === null ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No outstanding receivables.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.partyId}>
                  <td>{row.partyName}</td>
                  <td className="num" style={{ color: row.outstandingAmount < 0 ? 'var(--danger)' : undefined }}>
                    {row.outstandingAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
