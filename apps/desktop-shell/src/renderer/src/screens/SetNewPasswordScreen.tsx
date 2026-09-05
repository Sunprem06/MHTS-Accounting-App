import { useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  company: CompanySummary;
  onDone: (session: SessionInfo) => void;
  onBack: () => void;
}

/** Shown after a login whose temporary (admin-issued) password succeeded but must be replaced before a session starts. */
export function SetNewPasswordScreen({ company, onDone, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await window.mhts.changePassword({ companyId: company.id, email, currentPassword, newPassword });
    setSubmitting(false);
    if (result.ok && result.data) {
      onDone(result.data);
    } else {
      setError(result.error ?? 'Could not set new password');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Set a new password</h1>
      <p>
        An admin gave you a temporary password for <strong>{company.tradeName ?? company.legalName}</strong>. Enter it once
        more along with a permanent password of your own.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <br />
        <label>
          Temporary password
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <br />
        <label>
          New password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <br />
        <label>
          Confirm new password
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>
        <br />
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set password and sign in'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
