import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import type { OrderSummary, OrderStatus, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'badge-success';
    case 'DRAFT':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

export function SalesOrderRegisterScreen({ session, onBack }: Props) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const canManage = session.permissions.includes('SALES.CREATE_ORDER');
  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');

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

  async function handlePrint(orderId: string) {
    setError(null);
    setPrintingId(orderId);
    const result = await window.mhts.printSalesOrder(orderId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to print order');
    }
  }

  async function handleSavePdf(orderId: string) {
    setError(null);
    setPrintingId(orderId);
    const result = await window.mhts.saveSalesOrderPdf(orderId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save order as PDF');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Sales order register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {orders === null ? (
          <p className="empty-state">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="empty-state">No sales orders yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Total (₹)</th>
                <th>Status</th>
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
                  <td className="num">{order.totalAmount.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
                  </td>
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
      </div>
    </div>
  );
}
