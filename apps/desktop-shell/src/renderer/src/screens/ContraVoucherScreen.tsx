import { useEffect, useState } from 'react';
import type { LedgerAccountSummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

/** A transfer between the business's own Cash/Bank ledgers — no external party, so just two ledgers and one amount. */
export function ContraVoucherScreen({ onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [fromLedgerId, setFromLedgerId] = useState('');
  const [toLedgerId, setToLedgerId] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [amountRupees, setAmountRupees] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setFromLedgerId(result.data.find((l) => l.name === 'Cash')?.id ?? result.data[0]?.id ?? '');
        setToLedgerId(result.data[1]?.id ?? result.data[0]?.id ?? '');
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountRupees <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (fromLedgerId === toLedgerId) {
      setError('"From" and "To" must be different ledgers.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createVoucher({
      voucherType: 'CONTRA',
      voucherDate,
      narration: narration || undefined,
      lines: [
        { ledgerId: toLedgerId, debitRupees: amountRupees, creditRupees: 0 },
        { ledgerId: fromLedgerId, debitRupees: 0, creditRupees: amountRupees },
      ],
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create contra voucher');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Contra voucher</h1>
      <form onSubmit={handleSubmit}>
        <label>
          From
          <select value={fromLedgerId} onChange={(e) => setFromLedgerId(e.target.value)} required>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          To
          <select value={toLedgerId} onChange={(e) => setToLedgerId(e.target.value)} required>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Amount (₹)
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountRupees || ''}
            onChange={(e) => setAmountRupees(Number(e.target.value) || 0)}
            required
          />
        </label>
        <br />
        <label>
          Date
          <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>
        <br />
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting || amountRupees <= 0}>
          {submitting ? 'Saving…' : 'Save contra'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
