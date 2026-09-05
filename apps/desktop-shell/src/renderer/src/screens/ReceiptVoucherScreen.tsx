import { useEffect, useState } from 'react';
import type { LedgerAccountSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

interface ParticularLine {
  ledgerId: string;
  amountRupees: number;
}

function emptyParticular(): ParticularLine {
  return { ledgerId: '', amountRupees: 0 };
}

/** Money coming in: one "Received into" ledger (Cash/Bank) is debited automatically for the total; one or more "Received from" lines are credited — no manual balancing needed. */
export function ReceiptVoucherScreen({ onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [receivedIntoLedgerId, setReceivedIntoLedgerId] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [particulars, setParticulars] = useState<ParticularLine[]>([emptyParticular()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setReceivedIntoLedgerId(result.data.find((l) => l.name === 'Cash')?.id ?? result.data[0]?.id ?? '');
        setParticulars([{ ...emptyParticular(), ledgerId: result.data[0]?.id ?? '' }]);
      }
    })();
  }, []);

  function updateParticular(index: number, patch: Partial<ParticularLine>) {
    setParticulars((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const total = particulars.reduce((sum, p) => sum + (Number(p.amountRupees) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (total <= 0) {
      setError('Enter at least one amount greater than zero.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createVoucher({
      voucherType: 'RECEIPT',
      voucherDate,
      narration: narration || undefined,
      lines: [
        { ledgerId: receivedIntoLedgerId, debitRupees: total, creditRupees: 0 },
        ...particulars.map((p) => ({ ledgerId: p.ledgerId, debitRupees: 0, creditRupees: Number(p.amountRupees) || 0 })),
      ],
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create receipt voucher');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Receipt voucher</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Received into
          <select value={receivedIntoLedgerId} onChange={(e) => setReceivedIntoLedgerId(e.target.value)} required>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>{' '}
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
              <th style={{ textAlign: 'left' }}>Received from</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {particulars.map((line, index) => (
              <tr key={index}>
                <td>
                  <select value={line.ledgerId} onChange={(e) => updateParticular(index, { ledgerId: e.target.value })} required>
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
                    onChange={(e) => updateParticular(index, { amountRupees: Number(e.target.value) || 0 })}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </td>
                <td>
                  {particulars.length > 1 && (
                    <button type="button" onClick={() => setParticulars((prev) => prev.filter((_, i) => i !== index))}>
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
                <button type="button" onClick={() => setParticulars((prev) => [...prev, emptyParticular()])}>
                  + Add line
                </button>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{total.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || total <= 0}>
          {submitting ? 'Saving…' : 'Save receipt'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
