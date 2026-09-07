import { useEffect, useState } from 'react';
import type { OrderSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function PurchaseOrderRegisterScreen({ session, onBack }: Props) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const canManage = session.permissions.includes('PURCHASE.CREATE_ORDER');
  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');

  async function refresh() {
    const result = await window.mhts.listPurchaseOrders();
    if (result.ok && result.data) {
      setOrders(result.data);
    } else {
      setError(result.error ?? 'Failed to load purchase orders');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function withBusy(orderId: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusyId(orderId);
    const result = await action();
    setBusyId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Action failed');
    }
  }

  async function handlePrint(orderId: string) {
    setError(null);
    setPrintingId(orderId);
    const result = await window.mhts.printPurchaseOrder(orderId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to print order');
    }
  }

  async function handleSavePdf(orderId: string) {
    setError(null);
    setPrintingId(orderId);
    const result = await window.mhts.savePurchaseOrderPdf(orderId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save order as PDF');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Purchase order register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {orders === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>No.</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Supplier</th>
              <th style={{ textAlign: 'right' }}>Total (₹)</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              {canPrint && <th />}
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ opacity: order.status === 'CANCELLED' ? 0.6 : 1 }}>
                <td>{order.orderNumber}</td>
                <td>{order.orderDate}</td>
                <td>{order.partyName}</td>
                <td style={{ textAlign: 'right' }}>{order.totalAmount.toFixed(2)}</td>
                <td>{order.status}</td>
                {canPrint && (
                  <td>
                    <button type="button" disabled={printingId === order.id} onClick={() => handlePrint(order.id)}>
                      {printingId === order.id ? 'Working…' : 'Print'}
                    </button>{' '}
                    <button type="button" disabled={printingId === order.id} onClick={() => handleSavePdf(order.id)}>
                      Save PDF
                    </button>
                  </td>
                )}
                {canManage && (
                  <td>
                    {order.status === 'DRAFT' && (
                      <>
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.confirmPurchaseOrder(order.id))}>
                          Confirm
                        </button>{' '}
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.cancelPurchaseOrder(order.id))}>
                          Cancel
                        </button>
                      </>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <>
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.convertPurchaseOrder(order.id))}>
                          Convert to invoice
                        </button>{' '}
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.cancelPurchaseOrder(order.id))}>
                          Cancel
                        </button>
                      </>
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
