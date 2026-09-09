import { useEffect, useState } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import type { ApplicabilityMode, CompanyPayrollSettingsSummary, SessionInfo, TdsRegime } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const MODES: ApplicabilityMode[] = ['AUTO', 'ALWAYS', 'NEVER'];

/**
 * Directly answers "does a shop this size even need PF/ESI/Gratuity" — AUTO
 * compares the company's live headcount against each scheme's RuleSet
 * threshold (Manage Payroll Rules); ALWAYS/NEVER are explicit overrides for
 * voluntary coverage or a company that already knows it's exempt. Gratuity's
 * AUTO is sticky: once it flips on it stays on even if headcount later
 * drops (see @mhts/core-payroll-engine's companySettings.ts).
 */
export function PayrollSettingsScreen({ session, onBack }: Props) {
  const [settings, setSettings] = useState<CompanyPayrollSettingsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = session.permissions.includes('PAYROLL.MANAGE_RULES');

  async function refresh() {
    const result = await window.mhts.getCompanyPayrollSettings();
    if (result.ok && result.data) {
      setSettings(result.data);
    } else {
      setError(result.error ?? 'Failed to load payroll settings');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function update(patch: Partial<CompanyPayrollSettingsSummary>) {
    if (!settings) return;
    setError(null);
    setSaving(true);
    const result = await window.mhts.updateCompanyPayrollSettings(patch);
    setSaving(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update payroll settings');
    }
  }

  if (!settings) {
    return (
      <div className="page">
        <p className="empty-state">{error ?? 'Loading…'}</p>
      </div>
    );
  }

  const app = settings.resolvedApplicability;

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Settings size={18} style={{ color: 'var(--accent)' }} /> Payroll settings
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {app && (
        <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
          {app.activeEmployeeCount} active employee(s). PF requires {app.pfThreshold}+, ESI requires {app.esiThreshold}+, Gratuity requires {app.gratuityThreshold}+ (once
          crossed, gratuity stays applicable even if headcount later drops).
        </p>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Scheme</th>
              <th>Applicability</th>
              <th>Current status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Provident Fund</td>
              <td>
                <select value={settings.pfApplicability} disabled={!canManage} onChange={(e) => update({ pfApplicability: e.target.value as ApplicabilityMode })}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td>{app && <span className={`badge ${app.pfApplies ? 'badge-success' : 'badge-muted'}`}>{app.pfApplies ? 'Applies' : 'Does not apply'}</span>}</td>
            </tr>
            <tr>
              <td>ESI</td>
              <td>
                <select value={settings.esiApplicability} disabled={!canManage} onChange={(e) => update({ esiApplicability: e.target.value as ApplicabilityMode })}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td>{app && <span className={`badge ${app.esiApplies ? 'badge-success' : 'badge-muted'}`}>{app.esiApplies ? 'Applies' : 'Does not apply'}</span>}</td>
            </tr>
            <tr>
              <td>Gratuity</td>
              <td>
                <select value={settings.gratuityApplicability} disabled={!canManage} onChange={(e) => update({ gratuityApplicability: e.target.value as ApplicabilityMode })}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td>{app && <span className={`badge ${app.gratuityApplies ? 'badge-success' : 'badge-muted'}`}>{app.gratuityApplies ? 'Applies' : 'Does not apply'}</span>}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="field-row">
          <label className="field">
            Professional Tax state jurisdiction (blank = none configured, resolves to ₹0)
            <input defaultValue={settings.ptJurisdiction ?? ''} disabled={!canManage} onBlur={(e) => update({ ptJurisdiction: e.target.value.toUpperCase() || null })} style={{ width: 100 }} placeholder="e.g. MH" />
          </label>
          <label className="field">
            Salary TDS regime
            <select value={settings.tdsRegime} disabled={!canManage} onChange={(e) => update({ tdsRegime: e.target.value as TdsRegime })}>
              <option value="NEW">New (auto-estimated from slabs)</option>
              <option value="OLD">Old (manual entry only — see Manage Payroll Rules)</option>
            </select>
          </label>
        </div>
        {saving && <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 0 }}>Saving…</p>}
      </div>
    </div>
  );
}
