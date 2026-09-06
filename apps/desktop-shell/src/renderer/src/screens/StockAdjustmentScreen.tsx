import { useEffect, useState } from 'react';
import type { ItemBatchSummary, ItemSummary, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function StockAdjustmentScreen({ onCreated, onBack }: Props) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [batches, setBatches] = useState<ItemBatchSummary[]>([]);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [direction, setDirection] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_OUT');
  const [quantityUnits, setQuantityUnits] = useState('');
  const [ratePerUnitRupees, setRatePerUnitRupees] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
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

  useEffect(() => {
    (async () => {
      setBatchId('');
      if (selectedItem?.isBatchTracked) {
        const result = await window.mhts.listBatchesForItem(selectedItem.id);
        if (result.ok && result.data) setBatches(result.data);
      } else {
        setBatches([]);
      }
    })();
  }, [selectedItem?.id, selectedItem?.isBatchTracked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.postStockAdjustment({
      itemId,
      warehouseId,
      batchId: selectedItem?.isBatchTracked ? batchId || undefined : undefined,
      direction,
      quantityUnits: Number(quantityUnits),
      ratePerUnitRupees: direction === 'ADJUSTMENT_IN' ? Number(ratePerUnitRupees) : undefined,
      movementDate,
      narration: narration || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to post stock adjustment');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Stock adjustment</h1>
      <p>Posts a real voucher (Dr/Cr Inventory Adjustments and Stock-in-Hand) alongside the stock movement — this is an in-period value change, unlike opening stock.</p>
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
        </label>{' '}
        <label>
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT')}>
            <option value="ADJUSTMENT_OUT">Reduce stock (damage/loss)</option>
            <option value="ADJUSTMENT_IN">Increase stock (found/correction)</option>
          </select>
        </label>
        <br />
        {selectedItem?.isBatchTracked && (
          <label>
            Batch
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
              <option value="" disabled>
                Select batch
              </option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batchNumber}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Quantity ({selectedItem?.unitName ?? 'units'})
          <input type="number" step="0.001" min="0" value={quantityUnits} onChange={(e) => setQuantityUnits(e.target.value)} required style={{ width: 100 }} />
        </label>{' '}
        {direction === 'ADJUSTMENT_IN' && (
          <label>
            Rate per unit (₹)
            <input type="number" step="0.01" min="0" value={ratePerUnitRupees} onChange={(e) => setRatePerUnitRupees(e.target.value)} required style={{ width: 100 }} />
          </label>
        )}{' '}
        <label>
          Date
          <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>
        <br />
        <button type="submit" disabled={submitting || !itemId || !warehouseId}>
          {submitting ? 'Saving…' : 'Post adjustment'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
