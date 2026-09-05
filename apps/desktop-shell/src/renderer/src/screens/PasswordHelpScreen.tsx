import { useState } from 'react';
import type { CompanySummary } from '../../../shared/ipc';

interface Props {
  company: CompanySummary;
  onUseRecoveryKey: () => void;
  onBack: () => void;
}

/**
 * Routes a locked-out user to whichever recovery path applies. We can't tell
 * pre-login whether another Admin actually exists for this company — role
 * and permission data lives inside the (encrypted) Company DB, which nothing
 * can open without a password — so both options are always offered, and the
 * "ask an admin" panel itself carries an explicit way out rather than ever
 * being a dead end.
 */
export function PasswordHelpScreen({ company, onUseRecoveryKey, onBack }: Props) {
  const [showAskAdminInstructions, setShowAskAdminInstructions] = useState(false);

  if (showAskAdminInstructions) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
        <h1>Ask a Company Admin</h1>
        <p>
          Ask anyone who is an Admin for <strong>{company.tradeName ?? company.legalName}</strong> to open MHTS ERP, go to{' '}
          <strong>Manage Users</strong>, and reset your password. They'll give you a temporary password — you'll be asked
          to set a permanent one the moment you sign in with it.
        </p>
        <button type="button" onClick={onBack}>
          Back to sign in
        </button>
        <p style={{ marginTop: 24 }}>
          No other Admin, or can't reach one right now?{' '}
          <button type="button" onClick={onUseRecoveryKey}>
            Use your recovery key instead
          </button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Forgot your password?</h1>
      <p>There are two ways back in — pick whichever applies to you.</p>
      <p>
        <button type="button" onClick={() => setShowAskAdminInstructions(true)}>
          Ask a Company Admin to reset it for me
        </button>
      </p>
      <p>
        <button type="button" onClick={onUseRecoveryKey}>
          I don't have access to another Admin — use my recovery key
        </button>
      </p>
      <button type="button" onClick={onBack}>
        Back to sign in
      </button>
    </div>
  );
}
