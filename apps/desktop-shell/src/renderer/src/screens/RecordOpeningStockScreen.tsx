import { useEffect, useState } from 'react';
import type { ItemSummary, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function RecordOpeningStockScreen({ onCreated, onBack }: Props) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityUnits, setQuantityUnits] = useState('');
  const [ratePerUnitRupees, setRatePerUnitRupees] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [itemsResult, warehousesResult] = await Promise.all([window.mhts.listItems(), window.mhts.listWarehouses()]);
      if (itemsResult.ok && itemsResult.data) {
        const stockable = itemsResult.data.filter((i) => i.itemType === 'STOCKABLE');
        setItems(stockable);
        setItemId(stockable[0]?.id ?? '');
      }
      if (warehousesResult.ok && warehousesResult.data) {
        setWarehouses(warehousesResult.data);
        setWarehouseId(warehousesResult.data[0]?.id ?? '');
      }
    })();
  }, []);

  const selectedItem = items.find((i) => i.id === itemId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.recordOpeningStock({
      itemId,
      warehouseId,
      batchNumber: selectedItem?.isBatchTracked ? batchNumber : undefined,
      expiryDate: selectedItem?.isBatchTracked ? expiryDate || undefined : undefined,
      quantityUnits: Number(quantityUnits),
      ratePerUnitRupees: Number(ratePerUnitRupees),
      movementDate,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to record opening stock');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Record opening stock</h1>
      <p>Sets an item&apos;s starting quantity/value in a warehouse. This does not post to the ledger — reconcile the Stock-in-Hand ledger&apos;s own opening balance separately, the same way any other ledger&apos;s opening balance is entered.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Item
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
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
          Warehouse
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            <option value="" disabled>
              Select warehouse
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        {selectedItem?.isBatchTracked && (
          <>
            <label>
              Batch number
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required />
            </label>{' '}
            <label>
              Expiry date
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </label>
            <br />
          </>
        )}
        <label>
          Quantity ({selectedItem?.unitName ?? 'units'})
          <input type="number" step="0.001" min="0" value={quantityUnits} onChange={(e) => setQuantityUnits(e.target.value)} required style={{ width: 100 }} />
        </label>{' '}
        <label>
          Rate per unit (₹)
          <input type="number" step="0.01" min="0" value={ratePerUnitRupees} onChange={(e) => setRatePerUnitRupees(e.target.value)} required style={{ width: 100 }} />
        </label>{' '}
        <label>
          As of date
          <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
        </label>
        <br />
        <button type="submit" disabled={submitting || !itemId || !warehouseId}>
          {submitting ? 'Saving…' : 'Record opening stock'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
