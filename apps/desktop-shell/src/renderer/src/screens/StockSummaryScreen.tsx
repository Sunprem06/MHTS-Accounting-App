import { useEffect, useState } from 'react';
import type { StockPositionRow } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function StockSummaryScreen({ onBack }: Props) {
  const [rows, setRows] = useState<StockPositionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.getStockPosition({});
      if (result.ok && result.data) {
        setRows(result.data);
      } else {
        setError(result.error ?? 'Failed to load stock summary');
      }
    })();
  }, []);

  const totalValue = (rows ?? []).reduce((sum, row) => sum + row.valueRupees, 0);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Stock summary</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No stock on hand.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Item</th>
              <th style={{ textAlign: 'left' }}>Warehouse</th>
              <th style={{ textAlign: 'left' }}>Batch</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.itemName}</td>
                <td>{row.warehouseName}</td>
                <td>{row.batchNumber ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{row.quantityUnits}</td>
                <td style={{ textAlign: 'right' }}>{row.valueRupees.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan={4}>Total</td>
              <td style={{ textAlign: 'right' }}>{totalValue.toFixed(2)}</td>
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
