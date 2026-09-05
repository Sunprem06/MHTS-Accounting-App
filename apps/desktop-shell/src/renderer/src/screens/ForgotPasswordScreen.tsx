import { useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  company: CompanySummary;
  onReset: (session: SessionInfo) => void;
  onBack: () => void;
}

export function ForgotPasswordScreen({ company, onReset, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
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
    const result = await window.mhts.resetPassword({ companyId: company.id, email, recoveryKey, newPassword });
    setSubmitting(false);
    if (result.ok && result.data) {
      onReset(result.data);
    } else {
      setError(result.error ?? 'Password reset failed');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Reset password</h1>
      <p>
        Recovering access to <strong>{company.tradeName ?? company.legalName}</strong>. Enter the recovery key shown when
        this company was created, and choose a new password.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Your email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <br />
        <label>
          Recovery key
          <input
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-..."
            required
          />
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
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
