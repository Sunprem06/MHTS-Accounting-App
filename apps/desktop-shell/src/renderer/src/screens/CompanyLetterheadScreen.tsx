import { useEffect, useState } from 'react';
import { ArrowLeft, FileSignature } from 'lucide-react';
import type { CompanyLetterheadProfile, DocumentLayout, SessionInfo, UpdateCompanyLetterheadProfileInput } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const LAYOUT_OPTIONS: DocumentLayout[] = ['CLASSIC', 'MODERN'];

export function CompanyLetterheadScreen({ session, onBack }: Props) {
  const [profile, setProfile] = useState<CompanyLetterheadProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [invoiceLayout, setInvoiceLayout] = useState<DocumentLayout>('CLASSIC');
  const [payslipLayout, setPayslipLayout] = useState<DocumentLayout>('CLASSIC');
  const [accentColorHex, setAccentColorHex] = useState('');

  const canManage = session.permissions.includes('PRINT.MANAGE_LETTERHEAD');

  async function refresh() {
    const result = await window.mhts.getCompanyLetterheadProfile();
    if (result.ok && result.data) {
      const p = result.data;
      setProfile(p);
      setAddress(p.address ?? '');
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
      setWebsite(p.website ?? '');
      setBankAccountName(p.bankAccountName ?? '');
      setBankAccountNumber(p.bankAccountNumber ?? '');
      setBankIfsc(p.bankIfsc ?? '');
      setBankName(p.bankName ?? '');
      setBankBranch(p.bankBranch ?? '');
      setFooterNote(p.footerNote ?? '');
      setInvoiceLayout(p.invoiceLayout);
      setPayslipLayout(p.payslipLayout);
      setAccentColorHex(p.accentColorHex ?? '');
    } else {
      setError(result.error ?? 'Failed to load company letterhead profile');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const input: UpdateCompanyLetterheadProfileInput = {
      address: address || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      bankAccountName: bankAccountName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankIfsc: bankIfsc || null,
      bankName: bankName || null,
      bankBranch: bankBranch || null,
      footerNote: footerNote || null,
      invoiceLayout,
      payslipLayout,
      accentColorHex: accentColorHex || null,
    };
    const result = await window.mhts.updateCompanyLetterheadProfile(input);
    setSaving(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to save');
    }
  }

  async function handlePickLogo() {
    setError(null);
    const picked = await window.mhts.pickLogoFile();
    if (!picked.ok) {
      setError(picked.error ?? 'Failed to read file');
      return;
    }
    if (!picked.data) {
      return; // cancelled
    }
    setLogoBusy(true);
    const result = await window.mhts.uploadCompanyLogo({ fileDataBase64: picked.data.fileDataBase64, mimeType: picked.data.mimeType });
    setLogoBusy(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to upload logo');
    }
  }

  async function handleClearLogo() {
    setError(null);
    setLogoBusy(true);
    const result = await window.mhts.clearCompanyLogo();
    setLogoBusy(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to clear logo');
    }
  }

  if (!canManage) {
    return (
      <div className="page">
        <p className="empty-state">You do not have permission to manage the company letterhead.</p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <FileSignature size={18} style={{ color: 'var(--accent)' }} /> Company letterhead
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        These details appear on every printed Sales Invoice and Payslip — re-brandable here without any code change.
      </p>

      {error && <p className="error-text">{error}</p>}

      {profile === null ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <form onSubmit={handleSave}>
          <div className="card">
            <h2>Logo</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${profile.hasLogo ? 'badge-success' : 'badge-muted'}`}>{profile.hasLogo ? 'Logo uploaded' : 'No logo uploaded'}</span>
              <button type="button" disabled={logoBusy} onClick={handlePickLogo}>
                {logoBusy ? 'Working…' : profile.hasLogo ? 'Replace logo…' : 'Upload logo…'}
              </button>
              {profile.hasLogo && (
                <button type="button" disabled={logoBusy} onClick={handleClearLogo}>
                  Remove logo
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="field-row">
              <label className="field">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                Website
                <input value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            <label className="field">
              Address
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
            </label>
          </div>

          <div className="card">
            <h2>Bank details (shown on invoices)</h2>
            <div className="field-row">
              <label className="field">
                Account name
                <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
              </label>
              <label className="field">
                Bank name
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </label>
              <label className="field">
                Branch
                <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                Account number
                <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
              </label>
              <label className="field">
                IFSC
                <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="card">
            <h2>Footer note</h2>
            <textarea value={footerNote} onChange={(e) => setFooterNote(e.target.value)} rows={2} placeholder="e.g. Terms & conditions, thank-you note…" />
          </div>

          <div className="card">
            <h2>Layout &amp; branding</h2>
            <div className="field-row">
              <label className="field">
                Invoice layout
                <select value={invoiceLayout} onChange={(e) => setInvoiceLayout(e.target.value as DocumentLayout)}>
                  {LAYOUT_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Payslip layout
                <select value={payslipLayout} onChange={(e) => setPayslipLayout(e.target.value as DocumentLayout)}>
                  {LAYOUT_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Accent color
                <input type="color" value={accentColorHex || '#1a56db'} onChange={(e) => setAccentColorHex(e.target.value)} style={{ width: 60, padding: 2 }} />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
