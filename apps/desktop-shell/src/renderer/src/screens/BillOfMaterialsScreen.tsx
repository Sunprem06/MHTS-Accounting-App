import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Bills of material</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {boms === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Output item</th>
              <th style={{ textAlign: 'right' }}>Output qty</th>
              <th style={{ textAlign: 'left' }}>Components</th>
              <th style={{ textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {boms.map((bom) => (
              <tr key={bom.id} style={{ opacity: bom.isActive ? 1 : 0.6 }}>
                <td>{bom.outputItemName}</td>
                <td style={{ textAlign: 'right' }}>{bom.outputQuantityUnits}</td>
                <td>{bom.lines.map((line) => `${line.componentItemName} (${line.quantityUnits})`).join(', ')}</td>
                <td>{bom.isActive ? 'Active' : 'Superseded'}</td>
              </tr>
            ))}
            {boms.length === 0 && (
              <tr>
                <td colSpan={4}>No bills of material yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate}>
          <h2>New bill of material</h2>
          <p style={{ fontSize: 12, color: '#666' }}>Creating a new version for an output item supersedes its existing active bill of material — versions are never edited in place.</p>
          <label>
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
          </label>{' '}
          <label>
            Output quantity
            <input type="number" step="0.001" min="0" value={outputQuantityUnits} onChange={(e) => setOutputQuantityUnits(e.target.value)} required style={{ width: 100 }} />
          </label>

          <h3>Components</h3>
          {lines.map((line, index) => (
            <p key={index}>
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
              </select>{' '}
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Quantity"
                value={line.quantityUnits}
                onChange={(e) => updateLine(index, { quantityUnits: e.target.value })}
                required
                style={{ width: 100 }}
              />{' '}
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(index)}>
                  Remove
                </button>
              )}
            </p>
          ))}
          <button type="button" onClick={addLine}>
            Add component
          </button>
          <p>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save bill of material'}
            </button>
          </p>
        </form>
      )}

      <p />
      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
