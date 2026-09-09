import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 1160 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <FileText size={18} style={{ color: 'var(--accent)' }} /> Purchase invoice register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {invoices === null ? (
          <p className="empty-state">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="empty-state">No purchase invoices yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th className="num">Total (₹)</th>
                <th>TDS</th>
                <th className="num">Net payable (₹)</th>
                <th>Due date</th>
                <th>Status</th>
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
                    <td className="num">{invoice.totalAmount.toFixed(2)}</td>
                    <td>{invoice.tdsSection ? `${invoice.tdsSection}: ₹${invoice.tdsAmount.toFixed(2)}` : '—'}</td>
                    <td className="num">{invoice.netPayable.toFixed(2)}</td>
                    <td style={{ color: isOverdue(invoice) ? 'var(--danger)' : undefined }}>{invoice.dueDate}</td>
                    <td>
                      <span className={`badge ${invoice.cancelledAt ? 'badge-muted' : 'badge-success'}`}>
                        {invoice.cancelledAt ? 'Cancelled' : 'Active'}
                      </span>
                    </td>
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
      </div>
    </div>
  );
}
