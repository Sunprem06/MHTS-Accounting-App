import { useEffect, useState } from 'react';
import { ArrowLeft, Wallet } from 'lucide-react';
import type { LedgerAccountSummary, OutstandingInvoiceRow, PartySummary } from '../../../shared/ipc';
import { foreignUnitsToBaseRupees } from '../fx';

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
  /** Only meaningful for an FX invoice — foreign amount applied and the actual settlement-day rate (may differ from the invoice's own booking rate, producing a realized gain/loss). */
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
    const result = await window.mhts.recordSalesReceipt({ partyId, depositLedgerId, receiptDate, narration: narration || undefined, settlements });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to record receipt');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Wallet size={18} style={{ color: 'var(--accent)' }} /> Customer receipt
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field-row">
            <label className="field">
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
            </label>
            <label className="field">
              Deposit to
              <select value={depositLedgerId} onChange={(e) => setDepositLedgerId(e.target.value)} required>
                {depositLedgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Date
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            Narration
            <input value={narration} onChange={(e) => setNarration(e.target.value)} />
          </label>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h2>Outstanding invoices</h2>
          {invoices.length === 0 ? (
            <p className="empty-state">No outstanding invoices for this customer.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th className="num">Outstanding (₹)</th>
                  <th className="num">Apply (₹)</th>
                  <th>Foreign settlement</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoiceId}>
                    <td>{invoice.voucherNumber}</td>
                    <td>{invoice.invoiceDate}</td>
                    <td className="num">{invoice.outstandingAmount.toFixed(2)}</td>
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
                        <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                  <td colSpan={2}>Total</td>
                  <td className="num">₹{total.toFixed(2)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || total <= 0}>
            {submitting ? 'Saving…' : 'Save receipt'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
