import { useState } from 'react';

interface Props {
  companyName: string;
  recoveryKey: string;
  onContinue: () => void;
}

export function RecoveryKeyScreen({ companyName, recoveryKey, onContinue }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      // Clipboard access can be denied by the OS; the key is still shown on screen to copy manually.
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Save your recovery key</h1>
      <p>
        This is the only way to recover <strong>{companyName}</strong>'s data if every user forgets their password.
        We do not store it — if you lose it <em>and</em> forget your password, this company's data cannot be recovered by
        anyone, including us.
      </p>
      <pre
        style={{
          padding: 16,
          background: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 16,
          userSelect: 'all',
          wordBreak: 'break-all',
        }}
      >
        {recoveryKey}
      </pre>
      <button type="button" onClick={copyToClipboard}>
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </button>
      <p style={{ marginTop: 16 }}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I have saved this
          recovery key somewhere safe (e.g. a password manager or printed and locked away).
        </label>
      </p>
      <button type="button" disabled={!confirmed} onClick={onContinue}>
        Continue to sign in
      </button>
    </div>
  );
}
