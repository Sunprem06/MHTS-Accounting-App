import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Manufacturing journal register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {journals === null ? (
          <p className="empty-state">Loading…</p>
        ) : journals.length === 0 ? (
          <p className="empty-state">No manufacturing journals posted yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Output item</th>
                <th>Warehouse</th>
                <th className="num">Qty produced</th>
                <th className="num">Total cost (₹)</th>
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
                    <td className="num">{journal.quantityProducedUnits}</td>
                    <td className="num">{journal.totalCost.toFixed(2)}</td>
                    <td>
                      <button type="button" onClick={() => toggle(journal.id)}>
                        {expandedId === journal.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === journal.id && movements && (
                    <tr>
                      <td colSpan={6}>
                        <table className="data-table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Movement</th>
                              <th className="num">Quantity</th>
                              <th className="num">Rate (₹)</th>
                              <th className="num">Value (₹)</th>
                              <th>Batch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movements.map((m, i) => (
                              <tr key={i}>
                                <td>{m.itemName}</td>
                                <td>
                                  <span className={`badge ${m.movementType === 'MANUFACTURING_CONSUME' ? 'badge-warning' : 'badge-success'}`}>
                                    {m.movementType === 'MANUFACTURING_CONSUME' ? 'Consumed' : 'Produced'}
                                  </span>
                                </td>
                                <td className="num">{m.quantityUnits}</td>
                                <td className="num">{m.ratePerUnit.toFixed(2)}</td>
                                <td className="num">{m.value.toFixed(2)}</td>
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
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
