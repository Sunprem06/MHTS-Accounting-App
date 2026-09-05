import type { SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onLogout: () => void;
  onManageUsers: () => void;
}

export function DashboardScreen({ session, onLogout, onManageUsers }: Props) {
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
      {session.permissions.includes('SYSTEM.MANAGE_USERS') && <button onClick={onManageUsers}>Manage users</button>}{' '}
      <button onClick={onLogout}>Sign out</button>
    </div>
  );
}
