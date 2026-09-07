import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../shared/ipc';

/** Renders nothing until an update is actually downloading or ready — never interrupts the app, matches the offline-first "updates are opportunistic" principle. */
export function UpdateStatusBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => window.mhts.onUpdateStatus(setStatus), []);

  if (!status || status.state === 'checking' || status.state === 'not-available' || status.state === 'error') {
    return null;
  }

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: '#1f2937', color: '#fff', padding: '12px 16px', borderRadius: 8, fontFamily: 'sans-serif', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', maxWidth: 320 }}>
      {status.state === 'available' && <span>A new version{status.version ? ` (${status.version})` : ''} is available — downloading…</span>}
      {status.state === 'downloading' && <span>Downloading update{status.percent != null ? `… ${status.percent}%` : '…'}</span>}
      {status.state === 'downloaded' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Update{status.version ? ` ${status.version}` : ''} is ready to install.</span>
          <button
            type="button"
            onClick={() => window.mhts.quitAndInstall()}
            style={{ background: '#fff', color: '#1f2937', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
          >
            Restart &amp; Install
          </button>
        </div>
      )}
    </div>
  );
}
