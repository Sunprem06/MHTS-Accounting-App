import { useEffect, useState } from 'react';
import type { AccountType, BankAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const ACCOUNT_TYPES: AccountType[] = ['SAVINGS', 'CURRENT', 'CC', 'OD'];

export function BankAccountsScreen({ session, onBack }: Props) {
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Bank accounts</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {accounts === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Bank</th>
              <th style={{ textAlign: 'left' }}>Account No.</th>
              <th style={{ textAlign: 'left' }}>IFSC</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} style={{ opacity: account.isActive ? 1 : 0.6 }}>
                <td>{account.ledgerName}</td>
                <td>{account.bankName}</td>
                <td>{account.accountNumber}</td>
                <td>{account.ifscCode}</td>
                <td>{account.accountType}</td>
                <td style={{ textAlign: 'right' }}>{account.currentBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New bank account</h2>
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Bank name
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          </label>
          <br />
          <label>
            Account number
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          </label>{' '}
          <label>
            IFSC code
            <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} required style={{ width: 120 }} />
          </label>{' '}
          <label>
            Branch
            <input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </label>
          <br />
          <label>
            Account type
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Opening balance (₹)
            <input type="number" step="0.01" value={openingBalanceRupees} onChange={(e) => setOpeningBalanceRupees(e.target.value)} style={{ width: 100 }} />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add bank account'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
