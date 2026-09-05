import { useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  company: CompanySummary;
  onLoggedIn: (session: SessionInfo) => void;
  onBack: () => void;
}

export function LoginScreen({ company, onLoggedIn, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.login({ companyId: company.id, email, password });
    setSubmitting(false);
    if (result.ok && result.data) {
      onLoggedIn(result.data);
    } else {
      setError(result.error ?? 'Login failed');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400 }}>
      <h1>{company.tradeName ?? company.legalName}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <br />
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <br />
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
