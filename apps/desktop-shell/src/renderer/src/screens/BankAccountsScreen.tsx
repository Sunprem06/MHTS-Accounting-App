import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, Landmark } from 'lucide-react';
import type { AccountType, BankAccountSummary, SessionInfo } from '../../../shared/ipc';
import { AttachmentsPanel } from './AttachmentsPanel';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const ACCOUNT_TYPES: AccountType[] = ['SAVINGS', 'CURRENT', 'CC', 'OD'];

export function BankAccountsScreen({ session, onBack }: Props) {
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CURRENT');
  const [openingBalanceRupees, setOpeningBalanceRupees] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('BANKING.MANAGE_BANK_ACCOUNTS');

  async function refresh() {
    const result = await window.mhts.listBankAccounts();
    if (result.ok && result.data) {
      setAccounts(result.data);
    } else {
      setError(result.error ?? 'Failed to load bank accounts');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createBankAccount({
      name,
      accountNumber,
      ifscCode,
      bankName,
      branchName: branchName || undefined,
      accountType,
      openingBalanceRupees: openingBalanceRupees ? Number(openingBalanceRupees) : undefined,
      openingBalanceSide: 'DEBIT',
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setAccountNumber('');
      setIfscCode('');
      setBankName('');
      setBranchName('');
      setOpeningBalanceRupees('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create bank account');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Landmark size={18} style={{ color: 'var(--accent)' }} /> Bank accounts
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {accounts === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Bank</th>
                <th>Account No.</th>
                <th>IFSC</th>
                <th>Type</th>
                <th className="num">Balance (₹)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <Fragment key={account.id}>
                  <tr style={{ opacity: account.isActive ? 1 : 0.6 }}>
                    <td>{account.ledgerName}</td>
                    <td>{account.bankName}</td>
                    <td>{account.accountNumber}</td>
                    <td>{account.ifscCode}</td>
                    <td>{account.accountType}</td>
                    <td className="num">{account.currentBalance.toFixed(2)}</td>
                    <td>
                      <button type="button" onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}>
                        {expandedId === account.id ? 'Hide' : 'Attachments'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === account.id && (
                    <tr>
                      <td colSpan={7}>
                        <AttachmentsPanel session={session} entityType="BankAccount" entityId={account.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New bank account</h2>
          <div className="field-row">
            <label className="field">
              Display name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Bank name
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} required />
            </label>
            <label className="field">
              Branch
              <input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              Account number
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
            </label>
            <label className="field">
              IFSC code
              <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} required style={{ width: 140 }} />
            </label>
            <label className="field">
              Account type
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Opening balance (₹)
              <input type="number" step="0.01" value={openingBalanceRupees} onChange={(e) => setOpeningBalanceRupees(e.target.value)} style={{ width: 140 }} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add bank account'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
