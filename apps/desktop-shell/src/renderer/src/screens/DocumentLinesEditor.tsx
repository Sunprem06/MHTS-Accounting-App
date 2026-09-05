import type { DocumentLineInput, LedgerAccountSummary } from '../../../shared/ipc';

interface Props {
  lines: DocumentLineInput[];
  ledgers: LedgerAccountSummary[];
  /** "Income ledger" for sales, "Expense ledger" for purchase. */
  ledgerLabel: string;
  onChange: (lines: DocumentLineInput[]) => void;
}

/**
 * Shared by sales/purchase invoice and order screens (four otherwise-near-
 * duplicate forms) — one line per taxable item, with tax manually entered
 * against any ledger under Duties & Taxes (GST auto-computation lands in
 * Phase 4; this pass posts real, correct amounts from whatever the user
 * types, per CLAUDE.md Rule #2).
 */
export function DocumentLinesEditor({ lines, ledgers, ledgerLabel, onChange }: Props) {
  const taxLedgers = ledgers.filter((l) => l.groupName === 'Duties & Taxes');

  function update(index: number, patch: Partial<DocumentLineInput>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function addLine() {
    onChange([...lines, { description: '', ledgerId: ledgers[0]?.id ?? '', amountRupees: 0 }]);
  }
  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  const taxableTotal = lines.reduce((sum, l) => sum + (Number(l.amountRupees) || 0), 0);
  const taxTotal = lines.reduce((sum, l) => sum + (Number(l.taxAmountRupees) || 0), 0);

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Description</th>
            <th style={{ textAlign: 'left' }}>{ledgerLabel}</th>
            <th style={{ textAlign: 'right' }}>Amount (₹)</th>
            <th style={{ textAlign: 'left' }}>Tax ledger</th>
            <th style={{ textAlign: 'right' }}>Tax (₹)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td>
                <input value={line.description} onChange={(e) => update(index, { description: e.target.value })} required />
              </td>
              <td>
                <select value={line.ledgerId} onChange={(e) => update(index, { ledgerId: e.target.value })} required>
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
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
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
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 8 }}>
              Total: ₹{(taxableTotal + taxTotal).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
