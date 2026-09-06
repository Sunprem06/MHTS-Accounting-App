import { useEffect, useState } from 'react';
import type { ItemSummary, ItemType, LedgerAccountSummary, SessionInfo, UnitOfMeasureSummary, ValuationMethod } from '../../../shared/ipc';

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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 760 }}>
      <h1>Items</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {items === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'left' }}>Unit</th>
              <th style={{ textAlign: 'left' }}>Valuation</th>
              <th style={{ textAlign: 'left' }}>Batch tracked</th>
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

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New item</h2>
          <label>
            Item code
            <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} required />
          </label>{' '}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Type
            <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>
              <option value="STOCKABLE">Stockable</option>
              <option value="SERVICE">Service</option>
            </select>
          </label>
          <br />
          {isStockable && (
            <>
              <label>
                Unit
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                  <option value="">Select…</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </label>{' '}
              <label>
                Valuation method
                <select value={valuationMethod} onChange={(e) => setValuationMethod(e.target.value as ValuationMethod)}>
                  <option value="FIFO">FIFO</option>
                  <option value="WEIGHTED_AVERAGE">Weighted Average</option>
                </select>
              </label>{' '}
              <label>
                <input type="checkbox" checked={isBatchTracked} onChange={(e) => setIsBatchTracked(e.target.checked)} /> Batch tracked
              </label>
              <br />
            </>
          )}
          <label>
            HSN/SAC code
            <input value={hsnSacCode} onChange={(e) => setHsnSacCode(e.target.value)} />
          </label>{' '}
          <label>
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
          <br />
          <button type="submit" disabled={submitting || (isStockable && !unitId)}>
            {submitting ? 'Adding…' : 'Add item'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
