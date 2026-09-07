import { useEffect, useState } from 'react';
import type { BranchSummary, LedgerAccountSummary, PaymentInstrumentInput, SessionInfo } from '../../../shared/ipc';
import { PaymentInstrumentFields } from './PaymentInstrumentFields';

interface Props {
  session: SessionInfo;
  onCreated: () => void;
  onBack: () => void;
}

const BANK_ACCOUNTS_GROUP = 'Bank Accounts';

/**
 * A transfer between the business's own Cash/Bank ledgers — no external
 * party, so just two ledgers and one amount. Each side can optionally carry
 * a branch tag (unlike cost centres, Contra is not excluded — a branch is a
 * balance-sheet dimension too, so a branch's own Cash/Bank movement still
 * matters even though Contra never touches P&L). Foreign-currency support is
 * deliberately out of scope here — Contra's single-amount-both-sides shape
 * doesn't map cleanly onto per-line FX the way Journal/Payment/Receipt's
 * independent line amounts do.
 */
export function ContraVoucherScreen({ session, onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [fromLedgerId, setFromLedgerId] = useState('');
  const [toLedgerId, setToLedgerId] = useState('');
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [amountRupees, setAmountRupees] = useState(0);
  const [instrument, setInstrument] = useState<PaymentInstrumentInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const eitherSideIsBank =
    ledgers.find((l) => l.id === fromLedgerId)?.groupName === BANK_ACCOUNTS_GROUP || ledgers.find((l) => l.id === toLedgerId)?.groupName === BANK_ACCOUNTS_GROUP;
  const canRecordInstrument = session.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setFromLedgerId(result.data.find((l) => l.name === 'Cash')?.id ?? result.data[0]?.id ?? '');
        setToLedgerId(result.data[1]?.id ?? result.data[0]?.id ?? '');
      }
    })();
    window.mhts.listBranches().then((r) => r.ok && r.data && setBranches(r.data));
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
    const result = await window.mhts.recordBankVoucher({
      voucherType: 'CONTRA',
      voucherDate,
      narration: narration || undefined,
      lines: [
        { ledgerId: toLedgerId, debitRupees: amountRupees, creditRupees: 0, branchId: toBranchId || undefined },
        { ledgerId: fromLedgerId, debitRupees: 0, creditRupees: amountRupees, branchId: fromBranchId || undefined },
      ],
      instrument: eitherSideIsBank ? instrument : null,
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
        </label>{' '}
        <label>
          From branch
          <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
            <option value="">—</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
        </label>{' '}
        <label>
          To branch
          <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
            <option value="">—</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
        {eitherSideIsBank && canRecordInstrument && <PaymentInstrumentFields value={instrument} onChange={setInstrument} />}
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
