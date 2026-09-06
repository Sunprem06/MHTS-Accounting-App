import { useEffect, useState } from 'react';
import type { ItemBatchSummary, ItemSummary, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function StockTransferScreen({ onCreated, onBack }: Props) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [batches, setBatches] = useState<ItemBatchSummary[]>([]);
  const [itemId, setItemId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantityUnits, setQuantityUnits] = useState('');
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
        setFromWarehouseId(warehousesResult.data[0]?.id ?? '');
        setToWarehouseId(warehousesResult.data[1]?.id ?? warehousesResult.data[0]?.id ?? '');
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
    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination warehouse must be different.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.transferStock({
      itemId,
      fromWarehouseId,
      toWarehouseId,
      batchId: selectedItem?.isBatchTracked ? batchId || undefined : undefined,
      quantityUnits: Number(quantityUnits),
      movementDate,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to transfer stock');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Stock transfer</h1>
      <p>Moves stock between warehouses at its captured historical cost — no ledger impact, since it&apos;s the same Stock-in-Hand ledger overall.</p>
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
        </label>
        <br />
        <label>
          From warehouse
          <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
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
          To warehouse
          <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
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
        <label>
          Date
          <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
        </label>
        <br />
        <button type="submit" disabled={submitting || !itemId || !fromWarehouseId || !toWarehouseId}>
          {submitting ? 'Saving…' : 'Transfer stock'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
