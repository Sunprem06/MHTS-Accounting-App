import { useEffect, useMemo, useState } from 'react';
import type { BillOfMaterialSummary, ItemBatchSummary, ItemSummary, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

/** Posts one consume/produce entry: components are consumed at whatever they actually cost to hold (FIFO/weighted-average, same as a sale), and the output is produced at exactly that total cost — no overhead/wastage absorption this pass. */
export function ManufacturingJournalScreen({ onCreated, onBack }: Props) {
  const [boms, setBoms] = useState<BillOfMaterialSummary[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [componentBatches, setComponentBatches] = useState<Record<string, ItemBatchSummary[]>>({});

  const [bomId, setBomId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantityProducedUnits, setQuantityProducedUnits] = useState('');
  const [outputBatchNumber, setOutputBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [componentBatchIds, setComponentBatchIds] = useState<Record<string, string>>({});
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [bomsResult, itemsResult, warehousesResult] = await Promise.all([window.mhts.listBillsOfMaterial(), window.mhts.listItems(), window.mhts.listWarehouses()]);
      if (bomsResult.ok && bomsResult.data) {
        const active = bomsResult.data.filter((bom) => bom.isActive);
        setBoms(active);
        setBomId(active[0]?.id ?? '');
      }
      if (itemsResult.ok && itemsResult.data) setItems(itemsResult.data);
      if (warehousesResult.ok && warehousesResult.data) {
        setWarehouses(warehousesResult.data);
        setWarehouseId(warehousesResult.data[0]?.id ?? '');
      }
    })();
  }, []);

  const selectedBom = boms.find((b) => b.id === bomId);
  const outputItem = items.find((i) => i.id === selectedBom?.outputItemId);
  const scale = selectedBom && quantityProducedUnits ? Number(quantityProducedUnits) / selectedBom.outputQuantityUnits : 0;

  const batchTrackedComponents = useMemo(
    () => (selectedBom?.lines ?? []).filter((line) => items.find((i) => i.id === line.componentItemId)?.isBatchTracked),
    [selectedBom, items],
  );

  useEffect(() => {
    setComponentBatchIds({});
    batchTrackedComponents.forEach((line) => {
      if (!componentBatches[line.componentItemId]) {
        window.mhts.listBatchesForItem(line.componentItemId).then((r) => {
          if (r.ok && r.data) setComponentBatches((prev) => ({ ...prev, [line.componentItemId]: r.data! }));
        });
      }
    });
  }, [bomId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const line of batchTrackedComponents) {
      if (!componentBatchIds[line.componentItemId]) {
        setError(`A batch must be selected for component "${line.componentItemName}"`);
        return;
      }
    }

    setSubmitting(true);
    const result = await window.mhts.postManufacturingJournal({
      bomId,
      warehouseId,
      quantityProducedUnits: Number(quantityProducedUnits),
      outputBatchNumber: outputItem?.isBatchTracked ? outputBatchNumber : undefined,
      expiryDate: outputItem?.isBatchTracked ? expiryDate || undefined : undefined,
      manufactureDate: outputItem?.isBatchTracked ? manufactureDate || undefined : undefined,
      componentBatchIds: batchTrackedComponents.length > 0 ? componentBatchIds : undefined,
      journalDate,
      narration: narration || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to post manufacturing journal');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1>Manufacturing journal</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {boms.length === 0 ? (
        <p>No active bills of material — create one first.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>
            Bill of material
            <select value={bomId} onChange={(e) => setBomId(e.target.value)} required>
              {boms.map((bom) => (
                <option key={bom.id} value={bom.id}>
                  {bom.outputItemName} (yields {bom.outputQuantityUnits})
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
          <label>
            Quantity to produce
            <input type="number" step="0.001" min="0" value={quantityProducedUnits} onChange={(e) => setQuantityProducedUnits(e.target.value)} required style={{ width: 100 }} />
          </label>{' '}
          <label>
            Date
            <input type="date" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} required />
          </label>

          {selectedBom && quantityProducedUnits && (
            <>
              <h3>Components to be consumed</h3>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Component</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'left' }}>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBom.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.componentItemName}</td>
                      <td style={{ textAlign: 'right' }}>{(line.quantityUnits * scale).toFixed(3)}</td>
                      <td>
                        {items.find((i) => i.id === line.componentItemId)?.isBatchTracked ? (
                          <select value={componentBatchIds[line.componentItemId] ?? ''} onChange={(e) => setComponentBatchIds((prev) => ({ ...prev, [line.componentItemId]: e.target.value }))} required>
                            <option value="" disabled>
                              Select batch
                            </option>
                            {(componentBatches[line.componentItemId] ?? []).map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.batchNumber}
                              </option>
                            ))}
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {outputItem?.isBatchTracked && (
            <>
              <h3>Output batch</h3>
              <label>
                Batch number
                <input value={outputBatchNumber} onChange={(e) => setOutputBatchNumber(e.target.value)} required />
              </label>{' '}
              <label>
                Manufacture date
                <input type="date" value={manufactureDate} onChange={(e) => setManufactureDate(e.target.value)} />
              </label>{' '}
              <label>
                Expiry date
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </label>
            </>
          )}

          <br />
          <label>
            Narration
            <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
          </label>
          <br />
          <button type="submit" disabled={submitting || !bomId || !warehouseId}>
            {submitting ? 'Posting…' : 'Post journal'}
          </button>{' '}
          <button type="button" onClick={onBack} disabled={submitting}>
            Back
          </button>
        </form>
      )}
      {boms.length === 0 && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
    </div>
  );
}
