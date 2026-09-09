import { useEffect, useState } from 'react';
import { ArrowLeft, ListTree } from 'lucide-react';
import type { BillOfMaterialSummary, ItemSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

interface DraftLine {
  componentItemId: string;
  quantityUnits: string;
}

const emptyLine: DraftLine = { componentItemId: '', quantityUnits: '' };

/** Creating a BOM here always makes a new active version — any existing active BOM for the same output item is superseded (deactivated), never edited in place. */
export function BillOfMaterialsScreen({ session, onBack }: Props) {
  const [boms, setBoms] = useState<BillOfMaterialSummary[] | null>(null);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [outputItemId, setOutputItemId] = useState('');
  const [outputQuantityUnits, setOutputQuantityUnits] = useState('1');
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);

  const canManage = session.permissions.includes('MANUFACTURING.MANAGE_BOM');

  async function refresh() {
    const result = await window.mhts.listBillsOfMaterial();
    if (result.ok && result.data) {
      setBoms(result.data);
    } else {
      setError(result.error ?? 'Failed to load bills of material');
    }
  }

  useEffect(() => {
    refresh();
    window.mhts.listItems().then((r) => {
      if (r.ok && r.data) setItems(r.data.filter((i) => i.itemType === 'STOCKABLE'));
    });
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createBillOfMaterial({
      outputItemId,
      outputQuantityUnits: Number(outputQuantityUnits),
      lines: lines.map((line) => ({ componentItemId: line.componentItemId, quantityUnits: Number(line.quantityUnits) })),
    });
    setSubmitting(false);
    if (result.ok) {
      setOutputItemId('');
      setOutputQuantityUnits('1');
      setLines([{ ...emptyLine }]);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create bill of material');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ListTree size={18} style={{ color: 'var(--accent)' }} /> Bills of material
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {boms === null ? (
          <p className="empty-state">Loading…</p>
        ) : boms.length === 0 ? (
          <p className="empty-state">No bills of material yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Output item</th>
                <th className="num">Output qty</th>
                <th>Components</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {boms.map((bom) => (
                <tr key={bom.id} style={{ opacity: bom.isActive ? 1 : 0.6 }}>
                  <td>{bom.outputItemName}</td>
                  <td className="num">{bom.outputQuantityUnits}</td>
                  <td>{bom.lines.map((line) => `${line.componentItemName} (${line.quantityUnits})`).join(', ')}</td>
                  <td>
                    <span className={`badge ${bom.isActive ? 'badge-success' : 'badge-muted'}`}>{bom.isActive ? 'Active' : 'Superseded'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New bill of material</h2>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: -6 }}>
            Creating a new version for an output item supersedes its existing active bill of material — versions are never edited in place.
          </p>
          <div className="field-row">
            <label className="field" style={{ flex: 2 }}>
              Output item
              <select value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)} required>
                <option value="" disabled>
                  Select item
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} — {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Output quantity
              <input type="number" step="0.001" min="0" value={outputQuantityUnits} onChange={(e) => setOutputQuantityUnits(e.target.value)} required style={{ width: 120 }} />
            </label>
          </div>

          <h2 style={{ fontSize: 14 }}>Components</h2>
          {lines.map((line, index) => (
            <div key={index} className="field-row" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 2, marginBottom: 0 }}>
                Component
                <select value={line.componentItemId} onChange={(e) => updateLine(index, { componentItemId: e.target.value })} required>
                  <option value="" disabled>
                    Select component
                  </option>
                  {items
                    .filter((item) => item.id !== outputItemId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.itemCode} — {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                Quantity
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Quantity"
                  value={line.quantityUnits}
                  onChange={(e) => updateLine(index, { quantityUnits: e.target.value })}
                  required
                  style={{ width: 120 }}
                />
              </label>
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(index)} style={{ marginBottom: 0 }}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine}>
            Add component
          </button>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save bill of material'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
