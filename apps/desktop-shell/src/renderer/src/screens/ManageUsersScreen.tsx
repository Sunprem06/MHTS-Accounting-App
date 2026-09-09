import { useEffect, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import type { CompanyUserSummary, RoleSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ManageUsersScreen({ session, onBack }: Props) {
  const [users, setUsers] = useState<CompanyUserSummary[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [issuedFor, setIssuedFor] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  const canReset = session.permissions.includes('SYSTEM.RESET_USER_PASSWORD');
  const canManage = session.permissions.includes('SYSTEM.MANAGE_USERS');

  async function refreshUsers() {
    const result = await window.mhts.listCompanyUsers();
    if (result.ok && result.data) {
      setUsers(result.data);
    } else {
      setError(result.error ?? 'Failed to load users');
    }
  }

  useEffect(() => {
    refreshUsers();
    if (canManage) {
      (async () => {
        const result = await window.mhts.listRoles();
        if (result.ok && result.data) {
          setRoles(result.data);
          setInviteRoleId(result.data[0]?.id ?? '');
        }
      })();
    }
    // Deliberately runs once on mount only.
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssuedFor(null);
    setInviting(true);
    const result = await window.mhts.inviteUser({ email: inviteEmail, name: inviteName, roleId: inviteRoleId });
    setInviting(false);
    if (result.ok && result.data) {
      setIssuedFor({ email: inviteEmail, temporaryPassword: result.data.temporaryPassword });
      setInviteEmail('');
      setInviteName('');
      await refreshUsers();
    } else {
      setError(result.error ?? 'Failed to invite user');
    }
  }

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
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Users size={18} style={{ color: 'var(--accent)' }} /> Manage users
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {issuedFor && (
        <div className="card" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning)' }}>
          <p style={{ marginTop: 0 }}>
            Temporary password for <strong>{issuedFor.email}</strong> — share it with them now, it won't be shown again:
          </p>
          <pre style={{ fontSize: 16, userSelect: 'all', margin: '8px 0' }}>{issuedFor.temporaryPassword}</pre>
          <p style={{ marginBottom: 0, fontSize: 13, color: 'var(--fg-muted)' }}>They'll be asked to set their own password the moment they sign in with it.</p>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        {users === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
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
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="card">
          <h2>Invite a user</h2>
          <div className="field-row">
            <label className="field">
              Email
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </label>
            <label className="field">
              Name (only used if this email is new)
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </label>
            <label className="field">
              Role
              <select value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)} required>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={inviting || !inviteRoleId}>
              {inviting ? 'Inviting…' : 'Invite user'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
