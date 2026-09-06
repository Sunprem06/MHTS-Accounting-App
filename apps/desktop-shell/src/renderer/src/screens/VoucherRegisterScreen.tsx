import { useEffect, useState } from 'react';
import type { SessionInfo, VoucherSummary } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function VoucherRegisterScreen({ session, onBack }: Props) {
  const [vouchers, setVouchers] = useState<VoucherSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canCreate = session.permissions.includes('ACCOUNTING.CREATE_VOUCHER');

  async function refresh() {
    const result = await window.mhts.listVouchers();
    if (result.ok && result.data) {
      setVouchers(result.data);
    } else {
      setError(result.error ?? 'Failed to load vouchers');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCancel(voucher: VoucherSummary) {
    if (!window.confirm('Cancel this voucher? A reversal voucher will be posted automatically — the original stays on record.')) {
      return;
    }
    setError(null);
    setCancellingId(voucher.id);
    // SALES_INVOICE/PURCHASE_INVOICE/STOCK_ADJUSTMENT vouchers can carry
    // stock movements — routing them through the plain cancelVoucher below
    // would post a correct GL reversal while silently leaving stock
    // completely out of sync. Route each to its stock-aware cancel path
    // instead; only voucher types that never touch stock (JOURNAL, PAYMENT,
    // RECEIPT, CONTRA) use the generic path.
    const result =
      voucher.voucherType === 'SALES_INVOICE'
        ? await window.mhts.cancelSalesInvoice(voucher.id)
        : voucher.voucherType === 'PURCHASE_INVOICE'
          ? await window.mhts.cancelPurchaseInvoice(voucher.id)
          : voucher.voucherType === 'STOCK_ADJUSTMENT'
            ? await window.mhts.cancelStockAdjustment(voucher.id)
            : await window.mhts.cancelVoucher(voucher.id);
    setCancellingId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to cancel voucher');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Voucher register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {vouchers === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'left' }}>No.</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Narration</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              {canCreate && <th />}
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <tr key={voucher.id} style={{ opacity: voucher.cancelledAt || voucher.reversesVoucherId ? 0.6 : 1 }}>
                <td>{voucher.voucherType}</td>
                <td>{voucher.voucherNumber}</td>
                <td>{voucher.voucherDate}</td>
                <td>{voucher.narration ?? ''}</td>
                <td style={{ textAlign: 'right' }}>{voucher.totalAmount.toFixed(2)}</td>
                <td>
                  {voucher.reversesVoucherId
                    ? 'Reversal'
                    : voucher.cancelledAt
                      ? 'Cancelled'
                      : 'Active'}
                </td>
                {canCreate && (
                  <td>
                    {!voucher.cancelledAt && !voucher.reversesVoucherId && (
                      <button type="button" disabled={cancellingId === voucher.id} onClick={() => handleCancel(voucher)}>
                        {cancellingId === voucher.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
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
