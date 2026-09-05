import { useEffect, useState } from 'react';
import type { OrderSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function SalesOrderRegisterScreen({ session, onBack }: Props) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = session.permissions.includes('SALES.CREATE_ORDER');

  async function refresh() {
    const result = await window.mhts.listSalesOrders();
    if (result.ok && result.data) {
      setOrders(result.data);
    } else {
      setError(result.error ?? 'Failed to load sales orders');
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

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Sales order register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {orders === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>No.</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Customer</th>
              <th style={{ textAlign: 'right' }}>Total (₹)</th>
              <th style={{ textAlign: 'left' }}>Status</th>
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
                {canManage && (
                  <td>
                    {order.status === 'DRAFT' && (
                      <>
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.confirmSalesOrder(order.id))}>
                          Confirm
                        </button>{' '}
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.cancelSalesOrder(order.id))}>
                          Cancel
                        </button>
                      </>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <>
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.convertSalesOrder(order.id))}>
                          Convert to invoice
                        </button>{' '}
                        <button type="button" disabled={busyId === order.id} onClick={() => withBusy(order.id, () => window.mhts.cancelSalesOrder(order.id))}>
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
