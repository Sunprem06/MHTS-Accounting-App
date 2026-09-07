import { useEffect, useState } from 'react';
import type { CostCentreSummary, LedgerAccountSummary, VoucherLineInput } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

function emptyLine(): VoucherLineInput {
  return { ledgerId: '', debitRupees: 0, creditRupees: 0 };
}

/** For adjustments not involving Cash/Bank directly. Payment/Receipt/Contra have their own dedicated, auto-balancing screens. */
export function JournalVoucherScreen({ onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreSummary[]>([]);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<VoucherLineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setLines([
          { ...emptyLine(), ledgerId: result.data[0]?.id ?? '' },
          { ...emptyLine(), ledgerId: result.data[0]?.id ?? '' },
        ]);
      }
    })();
    window.mhts.listCostCentres().then((r) => r.ok && r.data && setCostCentres(r.data));
  }, []);

  function updateLine(index: number, patch: Partial<VoucherLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitRupees) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditRupees) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createVoucher({
      voucherType: 'JOURNAL',
      voucherDate,
      narration: narration || undefined,
      lines: lines.map((line) => ({
        ledgerId: line.ledgerId,
        debitRupees: Number(line.debitRupees) || 0,
        creditRupees: Number(line.creditRupees) || 0,
        costCentreId: line.costCentreId || undefined,
      })),
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create voucher');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Journal voucher</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Date
          <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>

        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Ledger</th>
              <th style={{ textAlign: 'right' }}>Debit (₹)</th>
              <th style={{ textAlign: 'right' }}>Credit (₹)</th>
              <th style={{ textAlign: 'left' }}>Cost centre</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select value={line.ledgerId} onChange={(e) => updateLine(index, { ledgerId: e.target.value })} required>
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
                    value={line.debitRupees || ''}
                    onChange={(e) => updateLine(index, { debitRupees: Number(e.target.value) || 0, creditRupees: 0 })}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.creditRupees || ''}
                    onChange={(e) => updateLine(index, { creditRupees: Number(e.target.value) || 0, debitRupees: 0 })}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </td>
                <td>
                  <select value={line.costCentreId ?? ''} onChange={(e) => updateLine(index, { costCentreId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {costCentres.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {lines.length > 2 && (
                    <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
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
                <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                  + Add line
                </button>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{totalDebit.toFixed(2)}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{totalCredit.toFixed(2)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>

        {!balanced && <p style={{ color: totalDebit === 0 ? undefined : 'crimson' }}>Debits and credits must be equal and non-zero to save.</p>}
        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || !balanced}>
          {submitting ? 'Saving…' : 'Save voucher'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
