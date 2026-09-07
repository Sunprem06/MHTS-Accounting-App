import { Fragment, useEffect, useState } from 'react';
import type { PurchaseInvoiceSummary, SessionInfo } from '../../../shared/ipc';
import { AttachmentsPanel } from './AttachmentsPanel';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function PurchaseInvoiceRegisterScreen({ session, onBack }: Props) {
  const [invoices, setInvoices] = useState<PurchaseInvoiceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const canCreate = session.permissions.includes('PURCHASE.CREATE_INVOICE');
  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');

  async function refresh() {
    const result = await window.mhts.listPurchaseInvoices();
    if (result.ok && result.data) {
      setInvoices(result.data);
    } else {
      setError(result.error ?? 'Failed to load purchase invoices');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCancel(voucherId: string) {
    if (!window.confirm('Cancel this invoice? A reversal voucher will be posted automatically — the original stays on record.')) {
      return;
    }
    setError(null);
    setCancellingId(voucherId);
    const result = await window.mhts.cancelPurchaseInvoice(voucherId);
    setCancellingId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to cancel invoice');
    }
  }

  async function handlePrint(invoiceId: string) {
    setError(null);
    setPrintingId(invoiceId);
    const result = await window.mhts.printPurchaseInvoice(invoiceId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to print invoice');
    }
  }

  async function handleSavePdf(invoiceId: string) {
    setError(null);
    setPrintingId(invoiceId);
    const result = await window.mhts.savePurchaseInvoicePdf(invoiceId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save invoice as PDF');
    }
  }

  const isOverdue = (invoice: PurchaseInvoiceSummary) => !invoice.cancelledAt && invoice.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Purchase invoice register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {invoices === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>No.</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Supplier</th>
              <th style={{ textAlign: 'right' }}>Total (₹)</th>
              <th style={{ textAlign: 'left' }}>TDS</th>
              <th style={{ textAlign: 'right' }}>Net payable (₹)</th>
              <th style={{ textAlign: 'left' }}>Due date</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th />
              {canPrint && <th />}
              {canCreate && <th />}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <Fragment key={invoice.id}>
                <tr style={{ opacity: invoice.cancelledAt ? 0.6 : 1 }}>
                  <td>{invoice.voucherNumber}</td>
                  <td>{invoice.invoiceDate}</td>
                  <td>
                    {invoice.partyName}
                    {invoice.isMsmeVendor ? ' (MSME)' : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>{invoice.totalAmount.toFixed(2)}</td>
                  <td>{invoice.tdsSection ? `${invoice.tdsSection}: ₹${invoice.tdsAmount.toFixed(2)}` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{invoice.netPayable.toFixed(2)}</td>
                  <td style={{ color: isOverdue(invoice) ? 'crimson' : undefined }}>{invoice.dueDate}</td>
                  <td>{invoice.cancelledAt ? 'Cancelled' : 'Active'}</td>
                  <td>
                    <button type="button" onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>
                      {expandedId === invoice.id ? 'Hide' : 'Attachments'}
                    </button>
                  </td>
                  {canPrint && (
                    <td>
                      <button type="button" disabled={printingId === invoice.id} onClick={() => handlePrint(invoice.id)}>
                        {printingId === invoice.id ? 'Working…' : 'Print'}
                      </button>{' '}
                      <button type="button" disabled={printingId === invoice.id} onClick={() => handleSavePdf(invoice.id)}>
                        Save PDF
                      </button>
                    </td>
                  )}
                  {canCreate && (
                    <td>
                      {!invoice.cancelledAt && (
                        <button type="button" disabled={cancellingId === invoice.voucherId} onClick={() => handleCancel(invoice.voucherId)}>
                          {cancellingId === invoice.voucherId ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {expandedId === invoice.id && (
                  <tr>
                    <td colSpan={9 + (canPrint ? 1 : 0) + (canCreate ? 1 : 0)}>
                      <AttachmentsPanel session={session} entityType="PurchaseInvoice" entityId={invoice.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
