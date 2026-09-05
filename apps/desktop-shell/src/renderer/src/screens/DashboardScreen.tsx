import type { SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onLogout: () => void;
  onManageUsers: () => void;
  onChartOfAccounts: () => void;
  onNewVoucher: () => void;
  onTrialBalance: () => void;
}

export function DashboardScreen({
  session,
  onLogout,
  onManageUsers,
  onChartOfAccounts,
  onNewVoucher,
  onTrialBalance,
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
      <p>
        {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && (
          <>
            <button onClick={onChartOfAccounts}>Chart of accounts</button>{' '}
            <button onClick={onTrialBalance}>Trial balance</button>{' '}
          </>
        )}
        {session.permissions.includes('ACCOUNTING.CREATE_VOUCHER') && <button onClick={onNewVoucher}>New voucher</button>}
      </p>
      <p>
        {session.permissions.includes('SYSTEM.MANAGE_USERS') && <button onClick={onManageUsers}>Manage users</button>}{' '}
        <button onClick={onLogout}>Sign out</button>
      </p>
    </div>
  );
}
