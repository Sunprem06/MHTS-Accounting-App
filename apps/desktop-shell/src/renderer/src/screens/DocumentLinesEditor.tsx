import { useState } from 'react';
import type { DocumentLineInput, ItemBatchSummary, ItemSummary, LedgerAccountSummary, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  lines: DocumentLineInput[];
  ledgers: LedgerAccountSummary[];
  /** "Income ledger" for sales, "Expense ledger" for purchase. */
  ledgerLabel: string;
  onChange: (lines: DocumentLineInput[]) => void;
  /** Phase 3 (Inventory) — when provided, each line can be toggled into "stock item" mode (item + warehouse + quantity + rate, auto-computing amount) instead of a plain description+ledger+amount line. Omit to keep a screen exactly as it was before Phase 3 (e.g. a document type with no stock concept). */
  items?: ItemSummary[];
  warehouses?: WarehouseSummary[];
  /** 'purchase' locks a stock item line's ledger to Stock-in-Hand (required by createPurchaseInvoiceInTransaction); 'sales' leaves the income ledger free. */
  mode?: 'sales' | 'purchase';
  stockInHandLedgerId?: string;
}

/**
 * Shared by sales/purchase invoice and order screens (four otherwise-near-
 * duplicate forms) — one line per taxable item, with tax manually entered
 * against any ledger under Duties & Taxes (GST auto-computation lands in
 * Phase 4; this pass posts real, correct amounts from whatever the user
 * types, per CLAUDE.md Rule #2).
 */
export function DocumentLinesEditor({ lines, ledgers, ledgerLabel, onChange, items, warehouses, mode, stockInHandLedgerId }: Props) {
  const taxLedgers = ledgers.filter((l) => l.groupName === 'Duties & Taxes');
  const stockableItems = (items ?? []).filter((i) => i.itemType === 'STOCKABLE');
  const supportsStockItems = stockableItems.length > 0 && (warehouses?.length ?? 0) > 0;
  const [batchesByItem, setBatchesByItem] = useState<Record<string, ItemBatchSummary[]>>({});

  function update(index: number, patch: Partial<DocumentLineInput>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function addLine() {
    onChange([...lines, { description: '', ledgerId: ledgers[0]?.id ?? '', amountRupees: 0 }]);
  }
  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  async function toggleStockItem(index: number, isStockItem: boolean) {
    if (!isStockItem) {
      update(index, { itemId: undefined, warehouseId: undefined, quantityUnits: undefined, ratePerUnitRupees: undefined, batchId: undefined, batchNumber: undefined, expiryDate: undefined, manufactureDate: undefined });
      return;
    }
    const firstItem = stockableItems[0];
    const firstWarehouse = warehouses?.[0];
    if (!firstItem || !firstWarehouse) return;
    update(index, {
      itemId: firstItem.id,
      description: lines[index].description || firstItem.name,
      warehouseId: firstWarehouse.id,
      quantityUnits: 0,
      ratePerUnitRupees: 0,
      amountRupees: 0,
      ledgerId: mode === 'purchase' && stockInHandLedgerId ? stockInHandLedgerId : lines[index].ledgerId,
    });
    if (firstItem.isBatchTracked) await ensureBatchesLoaded(firstItem.id);
  }

  async function ensureBatchesLoaded(itemId: string) {
    if (batchesByItem[itemId]) return;
    const result = await window.mhts.listBatchesForItem(itemId);
    if (result.ok && result.data) {
      setBatchesByItem((prev) => ({ ...prev, [itemId]: result.data! }));
    }
  }

  async function handleItemChange(index: number, itemId: string) {
    const item = stockableItems.find((i) => i.id === itemId);
    update(index, { itemId, description: lines[index].description || item?.name || '', batchId: undefined, batchNumber: undefined });
    if (item?.isBatchTracked) await ensureBatchesLoaded(itemId);
  }

  function updateQuantityOrRate(index: number, quantityUnits: number, ratePerUnitRupees: number) {
    update(index, { quantityUnits, ratePerUnitRupees, amountRupees: Math.round(quantityUnits * ratePerUnitRupees * 100) / 100 });
  }

  const taxableTotal = lines.reduce((sum, l) => sum + (Number(l.amountRupees) || 0), 0);
  const taxTotal = lines.reduce((sum, l) => sum + (Number(l.taxAmountRupees) || 0), 0);

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {supportsStockItems && <th style={{ textAlign: 'left' }}>Stock item</th>}
            <th style={{ textAlign: 'left' }}>Description</th>
            <th style={{ textAlign: 'left' }}>{ledgerLabel}</th>
            <th style={{ textAlign: 'right' }}>Amount (₹)</th>
            <th style={{ textAlign: 'left' }}>Tax ledger</th>
            <th style={{ textAlign: 'right' }}>Tax (₹)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const selectedItem = line.itemId ? stockableItems.find((i) => i.id === line.itemId) : undefined;
            const isStockItem = Boolean(line.itemId);
            const itemBatches = selectedItem ? (batchesByItem[selectedItem.id] ?? []) : [];

            return (
              <tr key={index}>
                {supportsStockItems && (
                  <td>
                    <input type="checkbox" checked={isStockItem} onChange={(e) => toggleStockItem(index, e.target.checked)} />
                  </td>
                )}
                <td>
                  <input value={line.description} onChange={(e) => update(index, { description: e.target.value })} required />
                  {isStockItem && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <select value={line.itemId} onChange={(e) => handleItemChange(index, e.target.value)}>
                        {stockableItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.itemCode} — {item.name}
                          </option>
                        ))}
                      </select>{' '}
                      <select value={line.warehouseId ?? ''} onChange={(e) => update(index, { warehouseId: e.target.value })}>
                        {(warehouses ?? []).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>{' '}
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={`Qty (${selectedItem?.unitName ?? 'units'})`}
                        value={line.quantityUnits || ''}
                        onChange={(e) => updateQuantityOrRate(index, Number(e.target.value) || 0, line.ratePerUnitRupees ?? 0)}
                        style={{ width: 90 }}
                      />{' '}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Rate/unit (₹)"
                        value={line.ratePerUnitRupees || ''}
                        onChange={(e) => updateQuantityOrRate(index, line.quantityUnits ?? 0, Number(e.target.value) || 0)}
                        style={{ width: 90 }}
                      />
                      {selectedItem?.isBatchTracked && mode === 'purchase' && (
                        <>
                          {' '}
                          <input placeholder="Batch number" value={line.batchNumber ?? ''} onChange={(e) => update(index, { batchNumber: e.target.value })} style={{ width: 90 }} />{' '}
                          <input type="date" value={line.expiryDate ?? ''} onChange={(e) => update(index, { expiryDate: e.target.value || undefined })} title="Expiry date" />
                        </>
                      )}
                      {selectedItem?.isBatchTracked && mode === 'sales' && (
                        <>
                          {' '}
                          <select value={line.batchId ?? ''} onChange={(e) => update(index, { batchId: e.target.value || undefined })}>
                            <option value="" disabled>
                              Select batch
                            </option>
                            {itemBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.batchNumber}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <select value={line.ledgerId} onChange={(e) => update(index, { ledgerId: e.target.value })} disabled={isStockItem && mode === 'purchase'} required>
                    <option value="" disabled>
                      Select ledger
                    </option>
                    {ledgers.map((ledger) => (
                      <option key={ledger.id} value={ledger.id}>
                        {ledger.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.amountRupees || ''}
                    onChange={(e) => update(index, { amountRupees: Number(e.target.value) || 0 })}
                    readOnly={isStockItem}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </td>
                <td>
                  <select value={line.taxLedgerId ?? ''} onChange={(e) => update(index, { taxLedgerId: e.target.value || undefined })}>
                    <option value="">None</option>
                    {taxLedgers.map((ledger) => (
                      <option key={ledger.id} value={ledger.id}>
                        {ledger.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.taxAmountRupees || ''}
                    onChange={(e) => update(index, { taxAmountRupees: Number(e.target.value) || 0 })}
                    style={{ width: 80, textAlign: 'right' }}
                  />
                </td>
                <td>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(index)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={supportsStockItems ? 3 : 2}>
              <button type="button" onClick={addLine}>
                + Add line
              </button>
            </td>
            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{taxableTotal.toFixed(2)}</td>
            <td />
            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{taxTotal.toFixed(2)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={supportsStockItems ? 7 : 6} style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 8 }}>
              Total: ₹{(taxableTotal + taxTotal).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
