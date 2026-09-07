import { Fragment, useEffect, useState } from 'react';
import type { ManufacturingJournalMovementSummary, ManufacturingJournalSummary } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function ManufacturingJournalRegisterScreen({ onBack }: Props) {
  const [journals, setJournals] = useState<ManufacturingJournalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<ManufacturingJournalMovementSummary[] | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listManufacturingJournals();
      if (result.ok && result.data) {
        setJournals(result.data);
      } else {
        setError(result.error ?? 'Failed to load manufacturing journals');
      }
    })();
  }, []);

  async function toggle(journalId: string) {
    if (expandedId === journalId) {
      setExpandedId(null);
      setMovements(null);
      return;
    }
    const result = await window.mhts.getManufacturingJournalMovements(journalId);
    if (result.ok && result.data) {
      setMovements(result.data);
      setExpandedId(journalId);
    } else {
      setError(result.error ?? 'Failed to load journal components');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Manufacturing journal register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {journals === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Output item</th>
              <th style={{ textAlign: 'left' }}>Warehouse</th>
              <th style={{ textAlign: 'right' }}>Qty produced</th>
              <th style={{ textAlign: 'right' }}>Total cost (₹)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {journals.map((journal) => (
              <Fragment key={journal.id}>
                <tr>
                  <td>{journal.journalDate}</td>
                  <td>{journal.outputItemName}</td>
                  <td>{journal.warehouseName}</td>
                  <td style={{ textAlign: 'right' }}>{journal.quantityProducedUnits}</td>
                  <td style={{ textAlign: 'right' }}>{journal.totalCost.toFixed(2)}</td>
                  <td>
                    <button type="button" onClick={() => toggle(journal.id)}>
                      {expandedId === journal.id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expandedId === journal.id && movements && (
                  <tr>
                    <td colSpan={6}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Item</th>
                            <th style={{ textAlign: 'left' }}>Movement</th>
                            <th style={{ textAlign: 'right' }}>Quantity</th>
                            <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                            <th style={{ textAlign: 'right' }}>Value (₹)</th>
                            <th style={{ textAlign: 'left' }}>Batch</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((m, i) => (
                            <tr key={i}>
                              <td>{m.itemName}</td>
                              <td>{m.movementType === 'MANUFACTURING_CONSUME' ? 'Consumed' : 'Produced'}</td>
                              <td style={{ textAlign: 'right' }}>{m.quantityUnits}</td>
                              <td style={{ textAlign: 'right' }}>{m.ratePerUnit.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{m.value.toFixed(2)}</td>
                              <td>{m.batchNumber ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {journals.length === 0 && (
              <tr>
                <td colSpan={6}>No manufacturing journals posted yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p />
      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
