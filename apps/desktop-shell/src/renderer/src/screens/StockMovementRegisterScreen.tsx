import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Stock movement register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {movements === null ? (
        <p>Loading…</p>
      ) : movements.length === 0 ? (
        <p>No stock movements recorded yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Item</th>
              <th style={{ textAlign: 'left' }}>Warehouse</th>
              <th style={{ textAlign: 'left' }}>Batch</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>Rate (₹)</th>
              <th style={{ textAlign: 'right' }}>Value (₹)</th>
              <th style={{ textAlign: 'left' }}>Reference</th>
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
                <td style={{ textAlign: 'right' }}>{m.quantityUnits}</td>
                <td style={{ textAlign: 'right' }}>{m.ratePerUnitRupees.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{m.valueRupees.toFixed(2)}</td>
                <td>{m.referenceType ?? '—'}</td>
              </tr>
            ))}
          </tbody>
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
