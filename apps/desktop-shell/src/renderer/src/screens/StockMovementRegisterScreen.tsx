import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import type { StockMovementSummary } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function StockMovementRegisterScreen({ onBack }: Props) {
  const [movements, setMovements] = useState<StockMovementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listStockMovements();
      if (result.ok && result.data) {
        setMovements(result.data);
      } else {
        setError(result.error ?? 'Failed to load stock movement register');
      }
    })();
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Stock movement register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {movements === null ? (
          <p className="empty-state">Loading…</p>
        ) : movements.length === 0 ? (
          <p className="empty-state">No stock movements recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Batch</th>
                <th>Type</th>
                <th className="num">Quantity</th>
                <th className="num">Rate (₹)</th>
                <th className="num">Value (₹)</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.movementDate}</td>
                  <td>{m.itemName}</td>
                  <td>{m.warehouseName}</td>
                  <td>{m.batchNumber ?? '—'}</td>
                  <td>{m.movementType}</td>
                  <td className="num">{m.quantityUnits}</td>
                  <td className="num">{m.ratePerUnitRupees.toFixed(2)}</td>
                  <td className="num">{m.valueRupees.toFixed(2)}</td>
                  <td>{m.referenceType ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
