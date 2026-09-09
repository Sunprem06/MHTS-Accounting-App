import { useEffect, useState } from 'react';
import type { ExpenseClaimLineFormInput, LedgerAccountSummary } from '../../../shared/ipc';

interface Props {
  lines: ExpenseClaimLineFormInput[];
  onChange: (lines: ExpenseClaimLineFormInput[]) => void;
}

function emptyLine(expenseLedgerId: string): ExpenseClaimLineFormInput {
  return { expenseLedgerId, description: '', expenseDate: new Date().toISOString().slice(0, 10), amountRupees: 0 };
}

/** Not a reuse of DocumentLinesEditor (sales/purchase's tax/HSN/stock-coupled line editor) — an expense line only needs an EXPENSE-nature ledger, description, date and amount. */
export function ExpenseLinesEditor({ lines, onChange }: Props) {
  const [expenseLedgers, setExpenseLedgers] = useState<LedgerAccountSummary[]>([]);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        const filtered = result.data.filter((ledger) => ledger.nature === 'EXPENSE');
        setExpenseLedgers(filtered);
        if (lines.length === 0 && filtered[0]) {
          onChange([emptyLine(filtered[0].id)]);
        }
      }
    })();
  }, []);

  function updateLine(index: number, patch: Partial<ExpenseClaimLineFormInput>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.amountRupees) || 0), 0);

  return (
    <table className="data-table" style={{ marginTop: 16 }}>
      <thead>
        <tr>
          <th>Expense ledger</th>
          <th>Description</th>
          <th>Date</th>
          <th className="num">Amount (₹)</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={index}>
            <td>
              <select value={line.expenseLedgerId} onChange={(e) => updateLine(index, { expenseLedgerId: e.target.value })} required>
                <option value="" disabled>
                  Select ledger
                </option>
                {expenseLedgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} required style={{ width: '100%' }} />
            </td>
            <td>
              <input type="date" value={line.expenseDate} onChange={(e) => updateLine(index, { expenseDate: e.target.value })} required />
            </td>
            <td>
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.amountRupees || ''}
                onChange={(e) => updateLine(index, { amountRupees: Number(e.target.value) || 0 })}
                className="num"
                style={{ width: 100 }}
              />
            </td>
            <td>
              {lines.length > 1 && (
                <button type="button" onClick={() => onChange(lines.filter((_, i) => i !== index))}>
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>
            <button type="button" onClick={() => onChange([...lines, emptyLine(expenseLedgers[0]?.id ?? '')])}>
              + Add line
            </button>
          </td>
          <td />
          <td />
          <td className="num" style={{ fontWeight: 600 }}>
            ₹{total.toFixed(2)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
