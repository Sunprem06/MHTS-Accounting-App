import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Receivables</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No outstanding receivables.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Customer</th>
              <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.partyId}>
                <td>{row.partyName}</td>
                <td style={{ textAlign: 'right', color: row.outstandingAmount < 0 ? 'crimson' : undefined }}>{row.outstandingAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
