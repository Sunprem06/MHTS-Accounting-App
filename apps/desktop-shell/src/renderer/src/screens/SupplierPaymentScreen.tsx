import { useEffect, useState } from 'react';
import type { LedgerAccountSummary, OutstandingInvoiceRow, PartySummary } from '../../../shared/ipc';
import { foreignUnitsToBaseRupees } from '../fx';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

/** Payment applied against specific purchase invoices (bill-wise allocation) — for a payment not tied to any invoice, use the generic Payment voucher instead. */
export function SupplierPaymentScreen({ onCreated, onBack }: Props) {
  const [suppliers, setSuppliers] = useState<PartySummary[]>([]);
  const [paymentLedgers, setPaymentLedgers] = useState<LedgerAccountSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [paymentLedgerId, setPaymentLedgerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [invoices, setInvoices] = useState<OutstandingInvoiceRow[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [foreignAmounts, setForeignAmounts] = useState<Record<string, number>>({});
  const [settlementRates, setSettlementRates] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function applyForeignAmount(invoice: OutstandingInvoiceRow, foreignAmountUnits: number) {
    setForeignAmounts((prev) => ({ ...prev, [invoice.invoiceId]: foreignAmountUnits }));
    if (invoice.exchangeRate) {
      setAmounts((prev) => ({ ...prev, [invoice.invoiceId]: foreignUnitsToBaseRupees(foreignAmountUnits, invoice.exchangeRate!) }));
    }
  }

  useEffect(() => {
    (async () => {
      const [partiesResult, ledgersResult] = await Promise.all([window.mhts.listParties(), window.mhts.listLedgers()]);
      if (partiesResult.ok && partiesResult.data) {
        const list = partiesResult.data.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
        setSuppliers(list);
        setPartyId(list[0]?.id ?? '');
      }
      if (ledgersResult.ok && ledgersResult.data) {
        const cashBank = ledgersResult.data.filter((l) => l.groupName === 'Cash-in-Hand' || l.groupName === 'Bank Accounts');
        setPaymentLedgers(cashBank.length > 0 ? cashBank : ledgersResult.data);
        setPaymentLedgerId((cashBank[0] ?? ledgersResult.data[0])?.id ?? '');
      }
    })();
  }, []);

  useEffect(() => {
    if (!partyId) {
      setInvoices([]);
      return;
    }
    (async () => {
      const result = await window.mhts.listOutstandingPurchaseInvoices(partyId);
      if (result.ok && result.data) {
        setInvoices(result.data);
        setAmounts({});
        setForeignAmounts({});
        setSettlementRates(Object.fromEntries(result.data.filter((inv) => inv.exchangeRate !== null).map((inv) => [inv.invoiceId, inv.exchangeRate!])));
      }
    })();
  }, [partyId]);

  const total = Object.values(amounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const settlements = invoices
      .filter((inv) => (amounts[inv.invoiceId] ?? 0) > 0)
      .map((inv) => ({
        invoiceId: inv.invoiceId,
        amountRupees: Number(amounts[inv.invoiceId]),
        foreignAmountUnits: inv.currency ? foreignAmounts[inv.invoiceId] : undefined,
        settlementExchangeRate: inv.currency ? settlementRates[inv.invoiceId] : undefined,
      }));
    if (settlements.length === 0) {
      setError('Enter an amount against at least one invoice.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.recordPurchasePayment({ partyId, paymentLedgerId, paymentDate, narration: narration || undefined, settlements });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to record payment');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Supplier payment</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Supplier
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            <option value="" disabled>
              Select supplier
            </option>
            {suppliers.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
                {party.isMsmeUdyamRegistered ? ' (MSME)' : ''}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Pay from
          <select value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)} required>
            {paymentLedgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Date
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>

        <h2 style={{ marginTop: 16 }}>Outstanding invoices</h2>
        {invoices.length === 0 ? (
          <p>No outstanding invoices for this supplier.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Invoice No.</th>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Due date</th>
                <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                <th style={{ textAlign: 'right' }}>Apply (₹)</th>
                <th style={{ textAlign: 'left' }}>Foreign settlement</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <td>{invoice.voucherNumber}</td>
                  <td>{invoice.invoiceDate}</td>
                  <td>{invoice.dueDate}</td>
                  <td style={{ textAlign: 'right' }}>{invoice.outstandingAmount.toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={invoice.outstandingAmount}
                      value={amounts[invoice.invoiceId] || ''}
                      disabled={Boolean(invoice.currency)}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [invoice.invoiceId]: Number(e.target.value) || 0 }))}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    {invoice.currency && (
                      <span style={{ fontSize: 12 }}>
                        {invoice.currency}{' '}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invoice.outstandingForeignAmountUnits ?? undefined}
                          value={foreignAmounts[invoice.invoiceId] || ''}
                          onChange={(e) => applyForeignAmount(invoice, Number(e.target.value) || 0)}
                          style={{ width: 90 }}
                          placeholder={`of ${invoice.outstandingForeignAmountUnits?.toFixed(2)}`}
                        />{' '}
                        @ rate{' '}
                        <input
                          type="number"
                          step="0.0001"
                          value={settlementRates[invoice.invoiceId] || ''}
                          onChange={(e) => setSettlementRates((prev) => ({ ...prev, [invoice.invoiceId]: Number(e.target.value) || 0 }))}
                          style={{ width: 80 }}
                        />{' '}
                        (booked @ {invoice.exchangeRate?.toFixed(4)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  Total
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || total <= 0} style={{ marginTop: 16 }}>
          {submitting ? 'Saving…' : 'Save payment'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
