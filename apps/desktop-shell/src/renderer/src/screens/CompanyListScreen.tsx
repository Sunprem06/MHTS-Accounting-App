import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  KeyRound,
  Plus,
  Quote,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import type { CompanySummary, LicenseStatus, SessionInfo, TrialStatus } from '../../../shared/ipc';
import brandConfig from '../brand.config.json';

const logoDataUri = brandConfig.logoDataUri as string | null;
const quotes = brandConfig.quotes as string[];

interface Props {
  companies: CompanySummary[];
  error: string | null;
  onSelectCompany: (company: CompanySummary) => void;
  onCreateNew: () => void;
  onDemoReady: (session: SessionInfo) => void;
}

/** Same quote all day (changes daily), not re-randomized on every screen visit. */
function dailyQuote(): string {
  if (quotes.length === 0) return '';
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  return quotes[dayOfYear % quotes.length];
}

export function CompanyListScreen({ companies, error, onSelectCompany, onCreateNew, onDemoReady }: Props) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [showActivateForm, setShowActivateForm] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [showOfflineFallback, setShowOfflineFallback] = useState(false);
  const [offlineToken, setOfflineToken] = useState('');
  const [machineId, setMachineId] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const quote = useMemo(dailyQuote, []);

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

  async function handleActivateOnline() {
    setActivating(true);
    setActivateError(null);
    const result = await window.mhts.activateLicenseOnline(activationCode);
    setActivating(false);
    if (result.ok && result.data) {
      if (result.data.valid) {
        setLicense(result.data);
        setShowActivateForm(false);
        setActivationCode('');
      } else {
        setActivateError(result.data.reason ?? 'Activation failed');
      }
    } else {
      setActivateError(result.error ?? 'Activation failed');
    }
  }

  async function handleActivateOffline() {
    setActivating(true);
    setActivateError(null);
    const result = await window.mhts.activateLicense(offlineToken);
    setActivating(false);
    if (result.ok && result.data) {
      if (result.data.valid) {
        setLicense(result.data);
        setShowActivateForm(false);
        setShowOfflineFallback(false);
        setOfflineToken('');
      } else {
        setActivateError(result.data.reason ?? 'Activation failed');
      }
    } else {
      setActivateError(result.error ?? 'Activation failed');
    }
  }

  async function handleShowOfflineFallback() {
    setShowOfflineFallback(true);
    if (!machineId) {
      const result = await window.mhts.getMachineId();
      if (result.ok && result.data) {
        setMachineId(result.data);
      }
    }
  }

  async function handleRecheck() {
    setRechecking(true);
    const result = await window.mhts.recheckLicense();
    setRechecking(false);
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

  // Drives the status card's color/icon — one source of truth so the border, icon,
  // and soft background always agree with each other.
  const statusTone: 'success' | 'accent' | 'warning' =
    license?.valid && license.payload ? 'success' : license?.graceExpired ? 'warning' : trial?.active ? 'accent' : 'warning';
  const toneVars = {
    success: { fg: 'var(--success)', bg: 'var(--success-soft)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  }[statusTone];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header / hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft), var(--bg))',
          borderBottom: '1px solid var(--border)',
          padding: '36px 40px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 720, margin: '0 auto' }}>
          {logoDataUri ? (
            <img src={logoDataUri} alt={brandConfig.appName} style={{ width: 52, height: 52, borderRadius: 'var(--radius-sm)', objectFit: 'contain', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                boxShadow: 'var(--shadow-md)',
                flexShrink: 0,
              }}
            >
              {brandConfig.shortName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>{brandConfig.appName}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--fg-muted)' }}>{brandConfig.tagline}</p>
          </div>
        </div>
        {quote && (
          <div style={{ maxWidth: 720, margin: '18px auto 0', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
            <Quote size={14} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
            <span>{quote}</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 40px 48px' }}>
        {error && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', marginBottom: 16, background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 13.5, color: 'var(--danger)' }}>
            <TriangleAlert size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
        {demoError && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', marginBottom: 16, background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 13.5, color: 'var(--danger)' }}>
            <TriangleAlert size={16} style={{ flexShrink: 0 }} />
            {demoError}
          </div>
        )}

        {license && (
          <div style={{ padding: 18, marginBottom: 24, background: toneVars.bg, border: `1px solid ${toneVars.fg}33`, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ color: toneVars.fg, flexShrink: 0, marginTop: 1 }}>
                {statusTone === 'success' ? <ShieldCheck size={20} /> : statusTone === 'accent' ? <Timer size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
                {license.valid && license.payload ? (
                  <span>
                    Licensed to <strong>{license.payload.issuedTo}</strong> ({license.payload.edition}
                    {license.payload.expiresAt ? `, expires ${license.payload.expiresAt}` : ', perpetual'})
                  </span>
                ) : license.graceExpired ? (
                  <span>{license.reason}</span>
                ) : trial?.active ? (
                  <span>
                    You're on a free trial — <strong>{trial.daysRemaining} day{trial.daysRemaining === 1 ? '' : 's'} left</strong>. You can create companies freely until then; activate a license anytime to continue afterward.
                  </span>
                ) : (
                  <span>
                    No valid license activated{license.reason ? ` — ${license.reason}` : ''}. Existing companies still open normally; a license is only needed to create a new one.
                  </span>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {license.valid && license.payload && (
                    <button type="button" onClick={handleRecheck} disabled={rechecking} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                      <RefreshCw size={13} className={rechecking ? 'spin' : undefined} />
                      {rechecking ? 'Checking…' : 'Reconnect now'}
                    </button>
                  )}
                  <button type="button" onClick={() => setShowActivateForm((v) => !v)} disabled={activating} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <KeyRound size={13} />
                    {license.valid ? 'Activate a different license' : 'Activate license'}
                  </button>
                </div>

                {license.valid && license.expiresInDays != null && license.expiresInDays <= 30 && (
                  <p style={{ color: 'var(--danger)', margin: '10px 0 0', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TriangleAlert size={13} style={{ flexShrink: 0 }} />
                    {license.expiresInDays <= 0 ? 'This license expires today.' : `This license expires in ${license.expiresInDays} day${license.expiresInDays === 1 ? '' : 's'}.`} Renew soon to keep creating new companies without interruption.
                  </p>
                )}

                {showActivateForm && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${toneVars.fg}33` }}>
                    {!showOfflineFallback ? (
                      <>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12.5, fontWeight: 600 }}>Activation code (from your MHTSdigiXR purchase)</label>
                        <input
                          type="text"
                          value={activationCode}
                          onChange={(e) => setActivationCode(e.target.value)}
                          placeholder="e.g. Ab3xY..."
                          style={{ width: '100%', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" className="btn-primary" onClick={handleActivateOnline} disabled={activating || !activationCode}>
                            {activating ? 'Activating…' : 'Activate online'}
                          </button>
                          <button type="button" onClick={handleShowOfflineFallback} style={{ fontSize: 12 }}>
                            No internet? Use an offline activation file
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 12 }}>
                          Your machine ID: <code>{machineId ?? '…'}</code> — share this with MHTSdigiXR support to get an offline activation file and matching token.
                        </p>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12.5, fontWeight: 600 }}>Activation token (from support)</label>
                        <input
                          type="text"
                          value={offlineToken}
                          onChange={(e) => setOfflineToken(e.target.value)}
                          placeholder="Paste the token support sent you"
                          style={{ width: '100%', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" className="btn-primary" onClick={handleActivateOffline} disabled={activating || !offlineToken}>
                            {activating ? 'Activating…' : 'Choose license file & activate'}
                          </button>
                          <button type="button" onClick={() => setShowOfflineFallback(false)} style={{ fontSize: 12 }}>
                            Back to online activation
                          </button>
                        </div>
                      </>
                    )}
                    {activateError && (
                      <p style={{ color: 'var(--danger)', margin: '10px 0 0', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TriangleAlert size={13} style={{ flexShrink: 0 }} />
                        {activateError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--fg-muted)', margin: '0 0 12px' }}>Your companies</h2>

        {companies.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--fg-muted)', fontSize: 14, marginBottom: 24 }}>
            No companies yet — create your first one below.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => onSelectCompany(company)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-sm)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14.5 }}>{company.tradeName ?? company.legalName}</strong>
                    {company.isDemo && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        <Sparkles size={10} /> Demo
                      </span>
                    )}
                  </div>
                  <small style={{ color: 'var(--fg-muted)' }}>
                    {company.legalName} · {company.entityType}
                  </small>
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onCreateNew}
            disabled={!canCreateNew}
            title={!canCreateNew ? 'Activate a license first' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Plus size={16} /> New Company
          </button>
          <button type="button" onClick={handleTryDemo} disabled={creatingDemo} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Sparkles size={16} /> {creatingDemo ? 'Setting up demo…' : 'Try Demo'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 10 }}>
          Try Demo creates a sandbox company pre-loaded with sample data, no license needed — logs you straight in. Clicking it again always resets to a fresh demo.
        </p>
      </div>
    </div>
  );
}
