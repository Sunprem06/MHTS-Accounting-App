import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import type { InstrumentStatus, PaymentInstrumentSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const STATUSES: InstrumentStatus[] = ['PENDING', 'PRESENTED', 'CLEARED', 'BOUNCED', 'CANCELLED'];

function statusBadgeClass(status: InstrumentStatus): string {
  switch (status) {
    case 'CLEARED':
      return 'badge-success';
    case 'PENDING':
    case 'PRESENTED':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

export function ChequeRegisterScreen({ session, onBack }: Props) {
  const [statusFilter, setStatusFilter] = useState<InstrumentStatus | ''>('');
  const [instruments, setInstruments] = useState<PaymentInstrumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canUpdate = session.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT');

  async function refresh() {
    const result = await window.mhts.listPaymentInstruments(statusFilter || undefined);
    if (result.ok && result.data) {
      setInstruments(result.data);
    } else {
      setError(result.error ?? 'Failed to load payment instruments');
    }
  }

  useEffect(() => {
    refresh();
  }, [statusFilter]);

  async function handleStatusChange(voucherId: string, status: InstrumentStatus) {
    setError(null);
    setUpdatingId(voucherId);
    const result = await window.mhts.updateInstrumentStatus({ voucherId, status, statusDate: new Date().toISOString().slice(0, 10) });
    setUpdatingId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update instrument status');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardCheck size={18} style={{ color: 'var(--accent)' }} /> Cheque / instrument register
        </h1>
      </div>

      <div className="card">
        <label className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InstrumentStatus | '')}>
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {instruments === null ? (
          <p className="empty-state">Loading…</p>
        ) : instruments.length === 0 ? (
          <p className="empty-state">No payment instruments recorded.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>Instrument</th>
                <th>Cheque no.</th>
                <th>UTR</th>
                <th>Status</th>
                {canUpdate && <th />}
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => (
                <tr key={instrument.id}>
                  <td>
                    {instrument.voucherType} #{instrument.voucherNumber}
                  </td>
                  <td>{instrument.voucherDate}</td>
                  <td>{instrument.instrumentType}</td>
                  <td>{instrument.chequeNumber ?? '—'}</td>
                  <td>{instrument.utrReference ?? '—'}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(instrument.instrumentStatus)}`}>{instrument.instrumentStatus}</span>
                  </td>
                  {canUpdate && (
                    <td>
                      <select
                        value=""
                        disabled={updatingId === instrument.voucherId}
                        onChange={(e) => {
                          const value = e.target.value as InstrumentStatus;
                          if (value) {
                            handleStatusChange(instrument.voucherId, value);
                          }
                        }}
                      >
                        <option value="">Mark as…</option>
                        {STATUSES.filter((status) => status !== instrument.instrumentStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
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
