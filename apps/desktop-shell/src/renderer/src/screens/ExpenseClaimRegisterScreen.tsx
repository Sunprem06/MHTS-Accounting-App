import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
import type { ExpenseClaimSummary, ExpenseClaimStatus, LedgerAccountSummary, PaymentInstrumentInput, SessionInfo } from '../../../shared/ipc';
import { PaymentInstrumentFields } from './PaymentInstrumentFields';
import { AttachmentsPanel } from './AttachmentsPanel';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const BANK_ACCOUNTS_GROUP = 'Bank Accounts';

function statusBadgeClass(status: ExpenseClaimStatus): string {
  switch (status) {
    case 'APPROVED':
    case 'REIMBURSED':
      return 'badge-success';
    case 'SUBMITTED':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

export function ExpenseClaimRegisterScreen({ session, onBack }: Props) {
  const [claims, setClaims] = useState<ExpenseClaimSummary[] | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reimbursingClaimId, setReimbursingClaimId] = useState<string | null>(null);
  const [paymentLedgerId, setPaymentLedgerId] = useState('');
  const [amountRupees, setAmountRupees] = useState(0);
  const [instrument, setInstrument] = useState<PaymentInstrumentInput | null>(null);

  const canCreate = session.permissions.includes('EXPENSE.CREATE_CLAIM');
  const canApprove = session.permissions.includes('EXPENSE.APPROVE_CLAIM');
  const canReimburse = session.permissions.includes('EXPENSE.REIMBURSE_CLAIM');
  const canRecordInstrument = session.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT');
  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');
  const paymentLedgerIsBank = ledgers.find((l) => l.id === paymentLedgerId)?.groupName === BANK_ACCOUNTS_GROUP;

  async function refresh() {
    const [claimsResult, ledgersResult] = await Promise.all([window.mhts.listExpenseClaims(), window.mhts.listLedgers()]);
    if (claimsResult.ok && claimsResult.data) {
      setClaims(claimsResult.data);
    } else {
      setError(claimsResult.error ?? 'Failed to load expense claims');
    }
    if (ledgersResult.ok && ledgersResult.data) {
      setLedgers(ledgersResult.data);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(claimId: string) {
    setBusyId(claimId);
    setError(null);
    const result = await window.mhts.submitExpenseClaim(claimId);
    setBusyId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to submit claim');
    }
  }

  async function handleApprove(claimId: string) {
    setBusyId(claimId);
    setError(null);
    const result = await window.mhts.approveExpenseClaim(claimId);
    setBusyId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to approve claim');
    }
  }

  async function handleReject(claimId: string) {
    const reason = window.prompt('Reason for rejecting this claim:');
    if (!reason) {
      return;
    }
    setBusyId(claimId);
    setError(null);
    const result = await window.mhts.rejectExpenseClaim({ expenseClaimId: claimId, reason });
    setBusyId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to reject claim');
    }
  }

  async function handleCancel(claimId: string) {
    if (!window.confirm('Cancel this approved claim? A reversal voucher will be posted automatically. This only works if no reimbursement has been recorded yet.')) {
      return;
    }
    setBusyId(claimId);
    setError(null);
    const result = await window.mhts.cancelExpenseClaim(claimId);
    setBusyId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to cancel claim');
    }
  }

  function openReimburseForm(claim: ExpenseClaimSummary) {
    setReimbursingClaimId(claim.id);
    setAmountRupees(claim.totalAmount);
    setPaymentLedgerId(ledgers.find((l) => l.name === 'Cash')?.id ?? ledgers[0]?.id ?? '');
    setInstrument(null);
    setError(null);
  }

  async function handleReimburse(e: React.FormEvent) {
    e.preventDefault();
    if (!reimbursingClaimId) {
      return;
    }
    setError(null);
    setBusyId(reimbursingClaimId);
    const result = await window.mhts.reimburseExpenseClaim({
      expenseClaimId: reimbursingClaimId,
      paymentLedgerId,
      paymentDate: new Date().toISOString().slice(0, 10),
      amountRupees,
      instrument: paymentLedgerIsBank ? (instrument ?? undefined) : undefined,
    });
    setBusyId(null);
    if (result.ok) {
      setReimbursingClaimId(null);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to record reimbursement');
    }
  }

  async function handlePrint(claimId: string) {
    setError(null);
    setPrintingId(claimId);
    const result = await window.mhts.printExpenseClaim(claimId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to print claim');
    }
  }

  async function handleSavePdf(claimId: string) {
    setError(null);
    setPrintingId(claimId);
    const result = await window.mhts.saveExpenseClaimPdf(claimId);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save claim as PDF');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Receipt size={18} style={{ color: 'var(--accent)' }} /> Expense claim register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {claims === null ? (
          <p className="empty-state">Loading…</p>
        ) : claims.length === 0 ? (
          <p className="empty-state">No expense claims yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Employee</th>
                <th>Date</th>
                <th>Purpose</th>
                <th className="num">Amount (₹)</th>
                <th>Status</th>
                <th />
                {canPrint && <th />}
                <th />
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <Fragment key={claim.id}>
                  <tr style={{ opacity: busyId === claim.id ? 0.5 : 1 }}>
                    <td>{claim.claimNumber}</td>
                    <td>{claim.employeeName}</td>
                    <td>{claim.claimDate}</td>
                    <td>{claim.purpose ?? ''}</td>
                    <td className="num">{claim.totalAmount.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(claim.status)}`}>{claim.status}</span>
                      {claim.status === 'REJECTED' && claim.rejectedReason ? ` (${claim.rejectedReason})` : ''}
                    </td>
                    <td>
                      {canCreate && claim.status === 'DRAFT' && (
                        <button type="button" disabled={busyId === claim.id} onClick={() => handleSubmit(claim.id)}>
                          Submit
                        </button>
                      )}{' '}
                      {canApprove && claim.status === 'SUBMITTED' && (
                        <>
                          <button type="button" disabled={busyId === claim.id} onClick={() => handleApprove(claim.id)}>
                            Approve
                          </button>{' '}
                          <button type="button" disabled={busyId === claim.id} onClick={() => handleReject(claim.id)}>
                            Reject
                          </button>
                        </>
                      )}{' '}
                      {canReimburse && claim.status === 'APPROVED' && (
                        <button type="button" disabled={busyId === claim.id} onClick={() => openReimburseForm(claim)}>
                          Reimburse
                        </button>
                      )}{' '}
                      {canApprove && claim.status === 'APPROVED' && (
                        <button type="button" disabled={busyId === claim.id} onClick={() => handleCancel(claim.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                    {canPrint && (
                      <td>
                        <button type="button" disabled={printingId === claim.id} onClick={() => handlePrint(claim.id)}>
                          {printingId === claim.id ? 'Working…' : 'Print'}
                        </button>{' '}
                        <button type="button" disabled={printingId === claim.id} onClick={() => handleSavePdf(claim.id)}>
                          Save PDF
                        </button>
                      </td>
                    )}
                    <td>
                      <button type="button" onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}>
                        {expandedId === claim.id ? 'Hide' : 'Attachments'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === claim.id && (
                    <tr>
                      <td colSpan={8 + (canPrint ? 1 : 0)}>
                        <AttachmentsPanel session={session} entityType="ExpenseClaim" entityId={claim.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reimbursingClaimId && (
        <form onSubmit={handleReimburse} className="card" style={{ maxWidth: 460 }}>
          <h2>Record reimbursement</h2>
          <div className="field-row">
            <label className="field">
              Paid from
              <select value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)} required>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Amount (₹)
              <input type="number" step="0.01" min="0" value={amountRupees || ''} onChange={(e) => setAmountRupees(Number(e.target.value) || 0)} required />
            </label>
          </div>

          {paymentLedgerIsBank && canRecordInstrument && <PaymentInstrumentFields value={instrument} onChange={setInstrument} />}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busyId === reimbursingClaimId}>
              {busyId === reimbursingClaimId ? 'Saving…' : 'Record reimbursement'}
            </button>
            <button type="button" onClick={() => setReimbursingClaimId(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
