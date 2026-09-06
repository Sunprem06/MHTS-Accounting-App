import { useEffect, useState } from 'react';
import type { InstrumentStatus, PaymentInstrumentSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const STATUSES: InstrumentStatus[] = ['PENDING', 'PRESENTED', 'CLEARED', 'BOUNCED', 'CANCELLED'];

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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Cheque / instrument register</h1>
      <p>
        <label>
          Status{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InstrumentStatus | '')}>
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {instruments === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Voucher</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Instrument</th>
              <th style={{ textAlign: 'left' }}>Cheque no.</th>
              <th style={{ textAlign: 'left' }}>UTR</th>
              <th style={{ textAlign: 'left' }}>Status</th>
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
                <td>{instrument.instrumentStatus}</td>
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

      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
