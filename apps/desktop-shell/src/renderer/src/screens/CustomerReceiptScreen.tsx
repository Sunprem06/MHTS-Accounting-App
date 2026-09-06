import { useEffect, useState } from 'react';
import type { LedgerAccountSummary, OutstandingInvoiceRow, PartySummary } from '../../../shared/ipc';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

/** Receipt applied against specific sales invoices (bill-wise allocation) — for an advance not tied to any invoice, use the generic Receipt voucher instead. */
export function CustomerReceiptScreen({ onCreated, onBack }: Props) {
  const [customers, setCustomers] = useState<PartySummary[]>([]);
  const [depositLedgers, setDepositLedgers] = useState<LedgerAccountSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [depositLedgerId, setDepositLedgerId] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [invoices, setInvoices] = useState<OutstandingInvoiceRow[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [partiesResult, ledgersResult] = await Promise.all([window.mhts.listParties(), window.mhts.listLedgers()]);
      if (partiesResult.ok && partiesResult.data) {
        const list = partiesResult.data.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
        setCustomers(list);
        setPartyId(list[0]?.id ?? '');
      }
      if (ledgersResult.ok && ledgersResult.data) {
        const cashBank = ledgersResult.data.filter((l) => l.groupName === 'Cash-in-Hand' || l.groupName === 'Bank Accounts');
        setDepositLedgers(cashBank.length > 0 ? cashBank : ledgersResult.data);
        setDepositLedgerId((cashBank[0] ?? ledgersResult.data[0])?.id ?? '');
      }
    })();
  }, []);

  useEffect(() => {
    if (!partyId) {
      setInvoices([]);
      return;
    }
    (async () => {
      const result = await window.mhts.listOutstandingSalesInvoices(partyId);
      if (result.ok && result.data) {
        setInvoices(result.data);
        setAmounts({});
      }
    })();
  }, [partyId]);

  const total = Object.values(amounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const settlements = invoices.filter((inv) => (amounts[inv.invoiceId] ?? 0) > 0).map((inv) => ({ invoiceId: inv.invoiceId, amountRupees: Number(amounts[inv.invoiceId]) }));
    if (settlements.length === 0) {
      setError('Enter an amount against at least one invoice.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.recordSalesReceipt({ partyId, depositLedgerId, receiptDate, narration: narration || undefined, settlements });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to record receipt');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Customer receipt</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Customer
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Deposit to
          <select value={depositLedgerId} onChange={(e) => setDepositLedgerId(e.target.value)} required>
            {depositLedgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Date
          <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>

        <h2 style={{ marginTop: 16 }}>Outstanding invoices</h2>
        {invoices.length === 0 ? (
          <p>No outstanding invoices for this customer.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Invoice No.</th>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                <th style={{ textAlign: 'right' }}>Apply (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <td>{invoice.voucherNumber}</td>
                  <td>{invoice.invoiceDate}</td>
                  <td style={{ textAlign: 'right' }}>{invoice.outstandingAmount.toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={invoice.outstandingAmount}
                      value={amounts[invoice.invoiceId] || ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [invoice.invoiceId]: Number(e.target.value) || 0 }))}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  Total
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || total <= 0} style={{ marginTop: 16 }}>
          {submitting ? 'Saving…' : 'Save receipt'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
