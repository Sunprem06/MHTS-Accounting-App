import { useEffect, useState } from 'react';
import { ArrowLeft, FileCode } from 'lucide-react';
import type { PayrollRuleVersionSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const RULE_TYPES = [
  { value: 'PAYROLL.WAGE_DEFINITION_CAP', label: 'Wage definition cap (Labour Code)', example: '{ "allowanceCapPctOfTotalPay": 50 }' },
  { value: 'PAYROLL.PF', label: 'Provident Fund', example: '{ "employeeRatePercent": 12, "employerRatePercent": 12, "wageCeiling": 1500000, "applicabilityMinEmployees": 20 }' },
  { value: 'PAYROLL.ESI', label: 'ESI', example: '{ "employeeRatePercent": 0.75, "employerRatePercent": 3.25, "wageCeiling": 2100000, "applicabilityMinEmployees": 10 }' },
  { value: 'PAYROLL.PT', label: 'Professional Tax (needs a state jurisdiction)', example: '{ "slabs": [{ "aboveGrossThreshold": 1500000, "amount": 20000 }] }' },
  { value: 'PAYROLL.GRATUITY_ELIGIBILITY', label: 'Gratuity eligibility', example: '{ "minYearsPermanent": 5, "minYearsFixedTerm": 1, "applicabilityMinEmployees": 10 }' },
  {
    value: 'PAYROLL.TDS_SLAB_NEW_REGIME',
    label: 'Salary TDS — new regime slabs',
    example: '{ "standardDeduction": 7500000, "rebateThreshold": 120000000, "cessPercent": 4, "slabs": [{ "aboveAnnualIncome": 0, "ratePercent": 0 }] }',
  },
];

/**
 * Every PF/ESI/PT/wage-cap/gratuity/TDS-slab figure this app uses lives here
 * as a versioned, date-effective RuleSet row (Blueprint §3.2) — mirrors
 * ManageGstRatesScreen exactly, but generalized across six rule types with
 * genuinely different payload shapes instead of one fixed rate+cess form. A
 * raw JSON payload editor is a deliberate simplification for this admin-only
 * screen (amounts are in PAISE, e.g. Rs 15,000 = 1500000) rather than six
 * bespoke forms — the same tracked gap Phase 2's handoff already flagged
 * ("no admin UI for rate versions... worth solving once, generically").
 */
export function ManagePayrollRulesScreen({ session, onBack }: Props) {
  const [ruleType, setRuleType] = useState(RULE_TYPES[0].value);
  const [active, setActive] = useState<PayrollRuleVersionSummary[] | null>(null);
  const [history, setHistory] = useState<PayrollRuleVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [jurisdiction, setJurisdiction] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [payloadText, setPayloadText] = useState(RULE_TYPES[0].example);
  const [sourceReference, setSourceReference] = useState('');

  const canManage = session.permissions.includes('PAYROLL.MANAGE_RULES');

  async function refreshActive() {
    const result = await window.mhts.listActivePayrollRules();
    if (result.ok && result.data) {
      setActive(result.data);
    } else {
      setError(result.error ?? 'Failed to load payroll rules');
    }
  }

  async function refreshHistory(type: string) {
    const result = await window.mhts.listPayrollRuleVersions(type);
    if (result.ok && result.data) {
      setHistory(result.data);
    }
  }

  useEffect(() => {
    refreshActive();
  }, []);

  useEffect(() => {
    refreshHistory(ruleType);
    const example = RULE_TYPES.find((r) => r.value === ruleType)?.example ?? '{}';
    setPayloadText(example);
  }, [ruleType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError('Payload must be valid JSON');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createOrUpdatePayrollRule({
      ruleType,
      jurisdiction: ruleType === 'PAYROLL.PT' ? jurisdiction.toUpperCase() : undefined,
      effectiveFrom,
      payload,
      sourceReference: sourceReference || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      setSourceReference('');
      await refreshActive();
      await refreshHistory(ruleType);
    } else {
      setError(result.error ?? 'Failed to save payroll rule');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <FileCode size={18} style={{ color: 'var(--accent)' }} /> Manage payroll rules
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Every PF/ESI/PT/wage-cap/gratuity/TDS figure below is date-effective, versioned data — never a hardcoded constant. All amounts are in PAISE (Rs
        15,000 = 1500000). Simplified starter defaults were seeded at installation; verify with a CA before relying on these for a real filing.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Currently active rules</h2>
        {active === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Jurisdiction</th>
                <th>Effective from</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {active.map((rule) => (
                <tr key={rule.id}>
                  <td>{RULE_TYPES.find((r) => r.value === rule.ruleType)?.label ?? rule.ruleType}</td>
                  <td>{rule.jurisdiction ?? '—'}</td>
                  <td>{rule.effectiveFrom}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{JSON.stringify(rule.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className="card">
          <h2>Add a new dated version</h2>
          <div className="field-row">
            <label className="field" style={{ flex: 2 }}>
              Rule
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
                {RULE_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            {ruleType === 'PAYROLL.PT' && (
              <label className="field">
                State jurisdiction (e.g. MH)
                <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} required style={{ width: 100 }} />
              </label>
            )}
            <label className="field">
              Effective from
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            Payload (JSON, amounts in paise)
            <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={4} style={{ fontFamily: 'monospace' }} />
          </label>
          <label className="field">
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save new version'}
            </button>
          </div>
        </form>
      )}

      {history && history.length > 1 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h2>Version history for this rule</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>Effective from</th>
                <th>Effective to</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {history.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.jurisdiction ?? '—'}</td>
                  <td>{rule.effectiveFrom}</td>
                  <td>{rule.effectiveTo ?? '—'}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{JSON.stringify(rule.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
