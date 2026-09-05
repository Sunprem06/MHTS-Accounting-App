import type { SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onLogout: () => void;
  onManageUsers: () => void;
  onChartOfAccounts: () => void;
  onJournalVoucher: () => void;
  onPaymentVoucher: () => void;
  onReceiptVoucher: () => void;
  onContraVoucher: () => void;
  onVoucherRegister: () => void;
  onTrialBalance: () => void;
  onProfitAndLoss: () => void;
  onBalanceSheet: () => void;
}

export function DashboardScreen({
  session,
  onLogout,
  onManageUsers,
  onChartOfAccounts,
  onJournalVoucher,
  onPaymentVoucher,
  onReceiptVoucher,
  onContraVoucher,
  onVoucherRegister,
  onTrialBalance,
  onProfitAndLoss,
  onBalanceSheet,
}: Props) {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>{session.companyName}</h1>
      <p>
        Signed in as <strong>{session.userName}</strong> ({session.email})
      </p>
      <p>
        Role: <strong>{session.roleName}</strong>
      </p>
      <p>Permissions granted to this role:</p>
      <ul>
        {session.permissions.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      {session.permissions.includes('ACCOUNTING.CREATE_VOUCHER') && (
        <p>
          <button onClick={onPaymentVoucher}>Payment</button>{' '}
          <button onClick={onReceiptVoucher}>Receipt</button>{' '}
          <button onClick={onContraVoucher}>Contra</button>{' '}
          <button onClick={onJournalVoucher}>Journal</button>
        </p>
      )}
      {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && (
        <p>
          <button onClick={onChartOfAccounts}>Chart of accounts</button>{' '}
          <button onClick={onVoucherRegister}>Voucher register</button>{' '}
          <button onClick={onTrialBalance}>Trial balance</button>{' '}
          <button onClick={onProfitAndLoss}>Profit &amp; Loss</button>{' '}
          <button onClick={onBalanceSheet}>Balance sheet</button>
        </p>
      )}
      <p>
        {session.permissions.includes('SYSTEM.MANAGE_USERS') && <button onClick={onManageUsers}>Manage users</button>}{' '}
        <button onClick={onLogout}>Sign out</button>
      </p>
    </div>
  );
}
