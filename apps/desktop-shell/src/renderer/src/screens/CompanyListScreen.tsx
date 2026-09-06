import { useEffect, useState } from 'react';
import type { CompanySummary, LicenseStatus } from '../../../shared/ipc';
import brandConfig from '../brand.config.json';

interface Props {
  companies: CompanySummary[];
  error: string | null;
  onSelectCompany: (company: CompanySummary) => void;
  onCreateNew: () => void;
}

export function CompanyListScreen({ companies, error, onSelectCompany, onCreateNew }: Props) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [activating, setActivating] = useState(false);

  async function refreshLicense() {
    const result = await window.mhts.getLicenseStatus();
    if (result.ok && result.data) {
      setLicense(result.data);
    }
  }

  useEffect(() => {
    refreshLicense();
  }, []);

  async function handleActivate() {
    setActivating(true);
    const result = await window.mhts.activateLicense();
    setActivating(false);
    if (result.ok && result.data) {
      setLicense(result.data);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>{brandConfig.appName}</h1>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {license && (
        <div style={{ padding: 12, marginBottom: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }}>
          {license.valid && license.payload ? (
            <span>
              Licensed to <strong>{license.payload.issuedTo}</strong> ({license.payload.edition}
              {license.payload.expiresAt ? `, expires ${license.payload.expiresAt}` : ', perpetual'})
            </span>
          ) : (
            <span>
              No valid license activated{license.reason ? ` — ${license.reason}` : ''}. Existing companies still open normally; a license is only needed to create a new one.
            </span>
          )}{' '}
          <button type="button" onClick={handleActivate} disabled={activating}>
            {activating ? 'Activating…' : license.valid ? 'Activate a different license' : 'Activate license'}
          </button>
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
                <br />
                <small>{company.legalName} · {company.entityType}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onCreateNew} disabled={license !== null && !license.valid} title={license && !license.valid ? 'Activate a license first' : undefined}>
        + New Company
      </button>
    </div>
  );
}
