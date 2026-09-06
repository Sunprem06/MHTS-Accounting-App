import { useState } from 'react';

interface Props {
  onBack: () => void;
  /** Restoring closes the current session (the file it was reading from just changed underneath it) — the caller must send the user back to the company list to log in again. */
  onRestored: () => void;
}

export function BackupScreen({ onBack, onRestored }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleBackup() {
    setError(null);
    setMessage(null);
    setBusy(true);
    const result = await window.mhts.backupCompany();
    setBusy(false);
    if (result.ok) {
      setMessage(result.data ? `Backup saved to ${result.data}` : 'Backup cancelled.');
    } else {
      setError(result.error ?? 'Failed to create backup');
    }
  }

  async function handleRestore() {
    if (!window.confirm('Restoring will REPLACE all of this company\'s current data with the backup file you choose. This cannot be undone. Continue?')) {
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    const result = await window.mhts.restoreCompany();
    setBusy(false);
    if (result.ok && result.data) {
      if (result.data.restored) {
        onRestored();
      } else {
        setMessage('Restore cancelled.');
      }
    } else {
      setError(result.error ?? 'Failed to restore backup');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Backup &amp; restore</h1>
      <p>Backs up this company's encrypted database file exactly as-is — a backup file is exactly as protected as the live data, never stored in the clear.</p>
      {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <p>
        <button type="button" onClick={handleBackup} disabled={busy}>
          {busy ? 'Working…' : 'Create backup'}
        </button>
      </p>
      <p>
        <button type="button" onClick={handleRestore} disabled={busy}>
          {busy ? 'Working…' : 'Restore from backup…'}
        </button>
      </p>
      <p>
        <button type="button" onClick={onBack} disabled={busy}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
