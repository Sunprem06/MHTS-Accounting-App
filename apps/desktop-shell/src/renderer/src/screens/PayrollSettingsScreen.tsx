import { useEffect, useState } from 'react';
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
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <p>{error ?? 'Loading…'}</p>
      </div>
    );
  }

  const app = settings.resolvedApplicability;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1>Payroll settings</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {app && (
        <p style={{ fontSize: 12, color: '#666' }}>
          {app.activeEmployeeCount} active employee(s). PF requires {app.pfThreshold}+, ESI requires {app.esiThreshold}+, Gratuity requires {app.gratuityThreshold}+ (once
          crossed, gratuity stays applicable even if headcount later drops).
        </p>
      )}

      <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 12 }}>Provident Fund</td>
            <td>
              <select value={settings.pfApplicability} disabled={!canManage} onChange={(e) => update({ pfApplicability: e.target.value as ApplicabilityMode })}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </td>
            <td style={{ paddingLeft: 12 }}>{app && (app.pfApplies ? 'Currently applies' : 'Currently does not apply')}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>ESI</td>
            <td>
              <select value={settings.esiApplicability} disabled={!canManage} onChange={(e) => update({ esiApplicability: e.target.value as ApplicabilityMode })}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </td>
            <td style={{ paddingLeft: 12 }}>{app && (app.esiApplies ? 'Currently applies' : 'Currently does not apply')}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>Gratuity</td>
            <td>
              <select value={settings.gratuityApplicability} disabled={!canManage} onChange={(e) => update({ gratuityApplicability: e.target.value as ApplicabilityMode })}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </td>
            <td style={{ paddingLeft: 12 }}>{app && (app.gratuityApplies ? 'Currently applies' : 'Currently does not apply')}</td>
          </tr>
        </tbody>
      </table>

      <label>
        Professional Tax state jurisdiction (e.g. MH, KA — blank = none configured, resolves to ₹0)
        <input defaultValue={settings.ptJurisdiction ?? ''} disabled={!canManage} onBlur={(e) => update({ ptJurisdiction: e.target.value.toUpperCase() || null })} style={{ marginLeft: 8, width: 80 }} />
      </label>
      <br />
      <br />
      <label>
        Salary TDS regime
        <select value={settings.tdsRegime} disabled={!canManage} onChange={(e) => update({ tdsRegime: e.target.value as TdsRegime })} style={{ marginLeft: 8 }}>
          <option value="NEW">New (auto-estimated from slabs)</option>
          <option value="OLD">Old (manual entry only — see Manage Payroll Rules)</option>
        </select>
      </label>
      {saving && <p>Saving…</p>}

      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
