import { useEffect, useState } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import type { ItemSummary, ItemType, LedgerAccountSummary, SessionInfo, UnitOfMeasureSummary, ValuationMethod } from '../../../shared/ipc';
import { GstHsnPicker } from './GstHsnPicker';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ManageItemsScreen({ session, onBack }: Props) {
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [units, setUnits] = useState<UnitOfMeasureSummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<ItemType>('STOCKABLE');
  const [unitId, setUnitId] = useState('');
  const [hsnSacCode, setHsnSacCode] = useState('');
  const [isBatchTracked, setIsBatchTracked] = useState(false);
  const [valuationMethod, setValuationMethod] = useState<ValuationMethod>('FIFO');
  const [defaultSalesLedgerId, setDefaultSalesLedgerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('INVENTORY.MANAGE_ITEMS');
  const isStockable = itemType === 'STOCKABLE';

  async function refresh() {
    const [itemsResult, unitsResult, ledgersResult] = await Promise.all([window.mhts.listItems(), window.mhts.listUnitsOfMeasure(), window.mhts.listLedgers()]);
    if (itemsResult.ok && itemsResult.data) {
      setItems(itemsResult.data);
    } else {
      setError(itemsResult.error ?? 'Failed to load items');
    }
    if (unitsResult.ok && unitsResult.data) {
      setUnits(unitsResult.data);
      if (!unitId && unitsResult.data.length > 0) {
        setUnitId(unitsResult.data[0].id);
      }
    }
    if (ledgersResult.ok && ledgersResult.data) {
      setLedgers(ledgersResult.data);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createItem({
      itemCode,
      name,
      itemType,
      unitId: isStockable ? unitId || undefined : undefined,
      hsnSacCode: hsnSacCode || undefined,
      isBatchTracked: isStockable ? isBatchTracked : undefined,
      valuationMethod: isStockable ? valuationMethod : undefined,
      defaultSalesLedgerId: defaultSalesLedgerId || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      setItemCode('');
      setName('');
      setHsnSacCode('');
      setIsBatchTracked(false);
      setDefaultSalesLedgerId('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create item');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Package size={18} style={{ color: 'var(--accent)' }} /> Items
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {items === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Unit</th>
                <th>Valuation</th>
                <th>Batch tracked</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.itemCode}</td>
                  <td>{item.name}</td>
                  <td>{item.itemType}</td>
                  <td>{item.unitName ?? '—'}</td>
                  <td>{item.valuationMethod ?? '—'}</td>
                  <td>{item.isBatchTracked ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New item</h2>
          <div className="field-row">
            <label className="field">
              Item code
              <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} required />
            </label>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Type
              <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>
                <option value="STOCKABLE">Stockable</option>
                <option value="SERVICE">Service</option>
              </select>
            </label>
          </div>
          {isStockable && (
            <div className="field-row">
              <label className="field">
                Unit
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                  <option value="">Select…</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Valuation method
                <select value={valuationMethod} onChange={(e) => setValuationMethod(e.target.value as ValuationMethod)}>
                  <option value="FIFO">FIFO</option>
                  <option value="WEIGHTED_AVERAGE">Weighted Average</option>
                </select>
              </label>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingBottom: 8 }}>
                <input type="checkbox" checked={isBatchTracked} onChange={(e) => setIsBatchTracked(e.target.checked)} />
                Batch tracked
              </label>
            </div>
          )}
          <div className="field-row">
            <label className="field">
              HSN/SAC code
              <GstHsnPicker value={hsnSacCode || undefined} onChange={(code) => setHsnSacCode(code ?? '')} />
            </label>
            <label className="field">
              Default sales ledger
              <select value={defaultSalesLedgerId} onChange={(e) => setDefaultSalesLedgerId(e.target.value)}>
                <option value="">None</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting || (isStockable && !unitId)}>
              {submitting ? 'Adding…' : 'Add item'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
