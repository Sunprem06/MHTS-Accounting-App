import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ArrowLeftRight size={18} style={{ color: 'var(--accent)' }} /> Stock transfer
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Moves stock between warehouses at its captured historical cost — no ledger impact, since it&apos;s the same Stock-in-Hand ledger overall.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <label className="field" style={{ maxWidth: 320 }}>
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
          <div className="field-row">
            <label className="field">
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
            </label>
            <label className="field">
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
          </div>
          {selectedItem?.isBatchTracked && (
            <label className="field" style={{ maxWidth: 260 }}>
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
          <div className="field-row">
            <label className="field">
              Quantity ({selectedItem?.unitName ?? 'units'})
              <input type="number" step="0.001" min="0" value={quantityUnits} onChange={(e) => setQuantityUnits(e.target.value)} required style={{ width: 140 }} />
            </label>
            <label className="field">
              Date
              <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
            </label>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || !itemId || !fromWarehouseId || !toWarehouseId}>
            {submitting ? 'Saving…' : 'Transfer stock'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
