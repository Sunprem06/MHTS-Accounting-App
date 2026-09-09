import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <BarChart3 size={18} style={{ color: 'var(--accent)' }} /> Stock summary
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {rows === null ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No stock on hand.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Batch</th>
                <th className="num">Quantity</th>
                <th className="num">Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.itemName}</td>
                  <td>{row.warehouseName}</td>
                  <td>{row.batchNumber ?? '—'}</td>
                  <td className="num">{row.quantityUnits}</td>
                  <td className="num">{row.valueRupees.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num">{totalValue.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
