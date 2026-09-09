import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpFromLine } from 'lucide-react';
import type { PartyOutstandingRow } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function PayablesScreen({ onBack }: Props) {
  const [rows, setRows] = useState<PartyOutstandingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listPayables();
      if (result.ok && result.data) {
        setRows(result.data);
      } else {
        setError(result.error ?? 'Failed to load payables');
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
          <ArrowUpFromLine size={18} style={{ color: 'var(--accent)' }} /> Payables
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {rows === null ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No outstanding payables.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>MSME</th>
                <th className="num">Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.partyId}>
                  <td>{row.partyName}</td>
                  <td>
                    <span className={`badge ${row.isMsmeUdyamRegistered ? 'badge-success' : 'badge-muted'}`}>
                      {row.isMsmeUdyamRegistered ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="num" style={{ color: row.outstandingAmount < 0 ? 'var(--danger)' : undefined }}>
                    {row.outstandingAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td />
                <td className="num">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
