import { useEffect, useState } from 'react';
import type { CompanySummary, LicenseStatus, SessionInfo, TrialStatus } from '../../../shared/ipc';
import brandConfig from '../brand.config.json';

interface Props {
  companies: CompanySummary[];
  error: string | null;
  onSelectCompany: (company: CompanySummary) => void;
  onCreateNew: () => void;
  onDemoReady: (session: SessionInfo) => void;
}

export function CompanyListScreen({ companies, error, onSelectCompany, onCreateNew, onDemoReady }: Props) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [activating, setActivating] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function refreshLicense() {
    const result = await window.mhts.getLicenseStatus();
    if (result.ok && result.data) {
      setLicense(result.data);
    }
  }

  async function refreshTrial() {
    const result = await window.mhts.getTrialStatus();
    if (result.ok && result.data) {
      setTrial(result.data);
    }
  }

  useEffect(() => {
    refreshLicense();
    refreshTrial();
  }, []);

  async function handleActivate() {
    setActivating(true);
    const result = await window.mhts.activateLicense();
    setActivating(false);
    if (result.ok && result.data) {
      setLicense(result.data);
    }
  }

  async function handleTryDemo() {
    const existingDemo = companies.find((c) => c.isDemo);
    if (existingDemo && !window.confirm('This replaces your current demo company (and all its sample data) with a fresh one. Continue?')) {
      return;
    }
    setDemoError(null);
    setCreatingDemo(true);
    const result = await window.mhts.createDemoCompany();
    setCreatingDemo(false);
    if (result.ok && result.data) {
      onDemoReady(result.data);
    } else {
      setDemoError(result.error ?? 'Failed to create demo company');
    }
  }

  const canCreateNew = license === null || license.valid || (trial?.active ?? false);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>{brandConfig.appName}</h1>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {demoError && <p style={{ color: 'var(--danger)' }}>{demoError}</p>}

      {license && (
        <div style={{ padding: 12, marginBottom: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }}>
          {license.valid && license.payload ? (
            <span>
              Licensed to <strong>{license.payload.issuedTo}</strong> ({license.payload.edition}
              {license.payload.expiresAt ? `, expires ${license.payload.expiresAt}` : ', perpetual'})
            </span>
          ) : trial?.active ? (
            <span>
              You're on a free trial — <strong>{trial.daysRemaining} day{trial.daysRemaining === 1 ? '' : 's'} left</strong>. You can create companies freely until then; activate a license anytime to continue afterward.
            </span>
          ) : (
            <span>
              No valid license activated{license.reason ? ` — ${license.reason}` : ''}. Existing companies still open normally; a license is only needed to create a new one.
            </span>
          )}{' '}
          <button type="button" onClick={handleActivate} disabled={activating}>
            {activating ? 'Activating…' : license.valid ? 'Activate a different license' : 'Activate license'}
          </button>
          {license.valid && license.expiresInDays != null && license.expiresInDays <= 30 && (
            <p style={{ color: 'var(--danger)', margin: '8px 0 0' }}>
              {license.expiresInDays <= 0 ? 'This license expires today.' : `This license expires in ${license.expiresInDays} day${license.expiresInDays === 1 ? '' : 's'}.`} Renew soon to
              keep creating new companies without interruption.
            </p>
          )}
        </div>
      )}

      {companies.length === 0 ? (
        <p>No companies yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {companies.map((company) => (
            <li key={company.id} style={{ marginBottom: 8 }}>
              <button style={{ width: '100%', textAlign: 'left', padding: 12 }} onClick={() => onSelectCompany(company)}>
                <strong>{company.tradeName ?? company.legalName}</strong>
                {company.isDemo && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>Demo</span>}
                <br />
                <small>{company.legalName} · {company.entityType}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onCreateNew} disabled={!canCreateNew} title={!canCreateNew ? 'Activate a license first' : undefined}>
        + New Company
      </button>{' '}
      <button type="button" onClick={handleTryDemo} disabled={creatingDemo}>
        {creatingDemo ? 'Setting up demo…' : 'Try Demo'}
      </button>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Try Demo creates a sandbox company pre-loaded with sample data, no license needed — logs you straight in. Clicking it again always resets to a fresh demo.
      </p>
    </div>
  );
}
