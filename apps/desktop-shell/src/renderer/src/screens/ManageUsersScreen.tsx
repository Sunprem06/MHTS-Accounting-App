import { useEffect, useState } from 'react';
import type { CompanyUserSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ManageUsersScreen({ session, onBack }: Props) {
  const [users, setUsers] = useState<CompanyUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuedFor, setIssuedFor] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const canReset = session.permissions.includes('SYSTEM.RESET_USER_PASSWORD');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listCompanyUsers();
      if (result.ok && result.data) {
        setUsers(result.data);
      } else {
        setError(result.error ?? 'Failed to load users');
      }
    })();
  }, []);

  async function handleReset(email: string) {
    setError(null);
    setIssuedFor(null);
    setResettingEmail(email);
    const result = await window.mhts.adminResetPassword({ targetEmail: email });
    setResettingEmail(null);
    if (result.ok && result.data) {
      setIssuedFor({ email, temporaryPassword: result.data.temporaryPassword });
    } else {
      setError(result.error ?? 'Failed to reset password');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 560 }}>
      <h1>Manage users</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {issuedFor && (
        <div style={{ padding: 16, background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 4, marginBottom: 16 }}>
          <p>
            Temporary password for <strong>{issuedFor.email}</strong> — share it with them now, it won't be shown again:
          </p>
          <pre style={{ fontSize: 16, userSelect: 'all' }}>{issuedFor.temporaryPassword}</pre>
          <p>They'll be asked to set their own password the moment they sign in with it.</p>
        </div>
      )}
      {users === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Email</th>
              <th style={{ textAlign: 'left' }}>Role</th>
              {canReset && <th />}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.roleName}</td>
                {canReset && (
                  <td>
                    {user.email.toLowerCase() !== session.email.toLowerCase() && (
                      <button type="button" disabled={resettingEmail === user.email} onClick={() => handleReset(user.email)}>
                        {resettingEmail === user.email ? 'Resetting…' : 'Reset password'}
                      </button>
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
