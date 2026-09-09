import { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import type { SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

type DocType = 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'EXPENSE_CLAIM' | 'PAYSLIP';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  SALES_INVOICE: 'Sales Invoice',
  PURCHASE_INVOICE: 'Purchase Invoice',
  SALES_ORDER: 'Sales Order',
  PURCHASE_ORDER: 'Purchase Order',
  JOURNAL: 'Journal Voucher',
  PAYMENT: 'Payment Voucher',
  RECEIPT: 'Receipt Voucher',
  CONTRA: 'Contra Voucher',
  EXPENSE_CLAIM: 'Expense Claim',
  PAYSLIP: 'Payslip',
};

const DOC_TYPE_ORDER: DocType[] = ['SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_ORDER', 'PURCHASE_ORDER', 'JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA', 'EXPENSE_CLAIM', 'PAYSLIP'];

const VOUCHER_TYPE_TO_DOC_TYPE: Record<string, DocType | undefined> = { JOURNAL: 'JOURNAL', PAYMENT: 'PAYMENT', RECEIPT: 'RECEIPT', CONTRA: 'CONTRA' };

interface PrintCentreRow {
  docType: DocType;
  id: string;
  number: string;
  date: string;
  partyOrEmployee: string;
  /** Rupees. */
  amount: number;
  status: string;
}

const PRINT_ACTIONS: Record<DocType, { print: (id: string) => Promise<{ ok: boolean; error?: string }>; savePdf: (id: string) => Promise<{ ok: boolean; error?: string }> }> = {
  SALES_INVOICE: { print: (id) => window.mhts.printSalesInvoice(id), savePdf: (id) => window.mhts.saveSalesInvoicePdf(id) },
  PURCHASE_INVOICE: { print: (id) => window.mhts.printPurchaseInvoice(id), savePdf: (id) => window.mhts.savePurchaseInvoicePdf(id) },
  SALES_ORDER: { print: (id) => window.mhts.printSalesOrder(id), savePdf: (id) => window.mhts.saveSalesOrderPdf(id) },
  PURCHASE_ORDER: { print: (id) => window.mhts.printPurchaseOrder(id), savePdf: (id) => window.mhts.savePurchaseOrderPdf(id) },
  JOURNAL: { print: (id) => window.mhts.printVoucher(id), savePdf: (id) => window.mhts.saveVoucherPdf(id) },
  PAYMENT: { print: (id) => window.mhts.printVoucher(id), savePdf: (id) => window.mhts.saveVoucherPdf(id) },
  RECEIPT: { print: (id) => window.mhts.printVoucher(id), savePdf: (id) => window.mhts.saveVoucherPdf(id) },
  CONTRA: { print: (id) => window.mhts.printVoucher(id), savePdf: (id) => window.mhts.saveVoucherPdf(id) },
  EXPENSE_CLAIM: { print: (id) => window.mhts.printExpenseClaim(id), savePdf: (id) => window.mhts.saveExpenseClaimPdf(id) },
  PAYSLIP: { print: (id) => window.mhts.printPayslip(id), savePdf: (id) => window.mhts.savePayslipPdf(id) },
};

/**
 * Phase 9 Increment 2 (Print + Templates) — a central register of every
 * printable document across the app, aggregated client-side from each
 * document type's own existing list IPC call (no new cross-cutting backend
 * query — every list* call here already exists and is used by that
 * document's own dedicated register screen). Journal/Payment/Receipt/Contra
 * vouchers come from the one listVouchers call, filtered to just those four
 * types (every other voucher type either has its own row here already, via
 * a different list call, or has no print path at all).
 */
export function PrintCentreScreen({ session, onBack }: Props) {
  const [rows, setRows] = useState<PrintCentreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocType | 'ALL'>('ALL');

  async function refresh() {
    setError(null);
    const [salesInvoices, purchaseInvoices, salesOrders, purchaseOrders, vouchers, expenseClaims, payslips] = await Promise.all([
      window.mhts.listSalesInvoices(),
      window.mhts.listPurchaseInvoices(),
      window.mhts.listSalesOrders(),
      window.mhts.listPurchaseOrders(),
      window.mhts.listVouchers(),
      window.mhts.listExpenseClaims(),
      window.mhts.listPayslipsForPrint(),
    ]);

    const collected: PrintCentreRow[] = [];
    const errors: string[] = [];

    if (salesInvoices.ok && salesInvoices.data) {
      collected.push(
        ...salesInvoices.data.map((i) => ({ docType: 'SALES_INVOICE' as const, id: i.id, number: String(i.voucherNumber), date: i.invoiceDate, partyOrEmployee: i.partyName, amount: i.totalAmount, status: i.cancelledAt ? 'Cancelled' : 'Active' })),
      );
    } else errors.push(salesInvoices.error ?? 'Failed to load sales invoices');

    if (purchaseInvoices.ok && purchaseInvoices.data) {
      collected.push(
        ...purchaseInvoices.data.map((i) => ({ docType: 'PURCHASE_INVOICE' as const, id: i.id, number: String(i.voucherNumber), date: i.invoiceDate, partyOrEmployee: i.partyName, amount: i.totalAmount, status: i.cancelledAt ? 'Cancelled' : 'Active' })),
      );
    } else errors.push(purchaseInvoices.error ?? 'Failed to load purchase invoices');

    if (salesOrders.ok && salesOrders.data) {
      collected.push(
        ...salesOrders.data.map((o) => ({ docType: 'SALES_ORDER' as const, id: o.id, number: String(o.orderNumber), date: o.orderDate, partyOrEmployee: o.partyName, amount: o.totalAmount, status: o.status })),
      );
    } else errors.push(salesOrders.error ?? 'Failed to load sales orders');

    if (purchaseOrders.ok && purchaseOrders.data) {
      collected.push(
        ...purchaseOrders.data.map((o) => ({ docType: 'PURCHASE_ORDER' as const, id: o.id, number: String(o.orderNumber), date: o.orderDate, partyOrEmployee: o.partyName, amount: o.totalAmount, status: o.status })),
      );
    } else errors.push(purchaseOrders.error ?? 'Failed to load purchase orders');

    if (vouchers.ok && vouchers.data) {
      for (const v of vouchers.data) {
        const docType = VOUCHER_TYPE_TO_DOC_TYPE[v.voucherType];
        if (!docType) continue;
        collected.push({ docType, id: v.id, number: String(v.voucherNumber), date: v.voucherDate, partyOrEmployee: v.narration ?? '', amount: v.totalAmount, status: v.cancelledAt ? 'Cancelled' : v.reversesVoucherId ? 'Reversal' : 'Active' });
      }
    } else errors.push(vouchers.error ?? 'Failed to load vouchers');

    if (expenseClaims.ok && expenseClaims.data) {
      collected.push(
        ...expenseClaims.data.map((c) => ({ docType: 'EXPENSE_CLAIM' as const, id: c.id, number: String(c.claimNumber), date: c.claimDate, partyOrEmployee: c.employeeName, amount: c.totalAmount / 100, status: c.status })),
      );
    } else errors.push(expenseClaims.error ?? 'Failed to load expense claims');

    if (payslips.ok && payslips.data) {
      collected.push(
        ...payslips.data.map((p) => ({
          docType: 'PAYSLIP' as const,
          id: p.id,
          number: `${p.periodMonth}/${p.periodYear}`,
          date: `${p.financialYear}`,
          partyOrEmployee: `${p.employeeName} (${p.employeeCode})`,
          amount: p.netPay,
          status: p.runStatus,
        })),
      );
    } else errors.push(payslips.error ?? 'Failed to load payslips');

    setRows(collected);
    if (errors.length > 0) {
      setError(errors.join('; '));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handlePrint(row: PrintCentreRow) {
    setError(null);
    setPrintingId(row.id);
    const result = await PRINT_ACTIONS[row.docType].print(row.id);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? `Failed to print ${DOC_TYPE_LABELS[row.docType]}`);
    }
  }

  async function handleSavePdf(row: PrintCentreRow) {
    setError(null);
    setPrintingId(row.id);
    const result = await PRINT_ACTIONS[row.docType].savePdf(row.id);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? `Failed to save ${DOC_TYPE_LABELS[row.docType]} as PDF`);
    }
  }

  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');
  const visibleRows = rows === null ? null : filter === 'ALL' ? rows : rows.filter((r) => r.docType === filter);
  const sortedRows = visibleRows === null ? null : [...visibleRows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (!canPrint) {
    return (
      <div className="page">
        <p className="empty-state">You do not have permission to print documents.</p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Printer size={18} style={{ color: 'var(--accent)' }} /> Print Centre
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Every printable document in one place — browse and reprint anything without hunting through its own register screen.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <label className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
          Document type
          <select value={filter} onChange={(e) => setFilter(e.target.value as DocType | 'ALL')}>
            <option value="ALL">All</option>
            {DOC_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        {sortedRows === null ? (
          <p className="empty-state">Loading…</p>
        ) : sortedRows.length === 0 ? (
          <p className="empty-state">No documents found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>No.</th>
                <th>Date</th>
                <th>Party / Employee</th>
                <th className="num">Amount (₹)</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={`${row.docType}-${row.id}`}>
                  <td>{DOC_TYPE_LABELS[row.docType]}</td>
                  <td>{row.number}</td>
                  <td>{row.date}</td>
                  <td>{row.partyOrEmployee}</td>
                  <td className="num">{row.amount.toFixed(2)}</td>
                  <td>{row.status}</td>
                  <td>
                    <button type="button" disabled={printingId === row.id} onClick={() => handlePrint(row)}>
                      {printingId === row.id ? 'Working…' : 'Print'}
                    </button>{' '}
                    <button type="button" disabled={printingId === row.id} onClick={() => handleSavePdf(row)}>
                      Save PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
