import { useEffect, useState } from 'react';
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
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <p>You do not have permission to manage the company letterhead.</p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Company letterhead</h1>
      <p style={{ color: '#666', fontSize: 13 }}>These details appear on every printed Sales Invoice and Payslip — re-brandable here without any code change.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {profile === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <strong>Logo</strong>
            <div style={{ marginTop: 4 }}>
              {profile.hasLogo ? <span style={{ color: '#2a7a2a' }}>Logo uploaded.</span> : <span style={{ color: '#666' }}>No logo uploaded.</span>}{' '}
              <button type="button" disabled={logoBusy} onClick={handlePickLogo}>
                {logoBusy ? 'Working…' : profile.hasLogo ? 'Replace logo…' : 'Upload logo…'}
              </button>{' '}
              {profile.hasLogo && (
                <button type="button" disabled={logoBusy} onClick={handleClearLogo}>
                  Remove logo
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSave}>
            <label>
              Address
              <br />
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} style={{ width: '100%' }} />
            </label>
            <br />
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>{' '}
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>{' '}
            <label>
              Website
              <input value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <h3>Bank details (shown on invoices)</h3>
            <label>
              Account name
              <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
            </label>{' '}
            <label>
              Bank name
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </label>{' '}
            <label>
              Branch
              <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
            </label>
            <br />
            <label>
              Account number
              <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </label>{' '}
            <label>
              IFSC
              <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
            </label>
            <h3>Footer note</h3>
            <textarea value={footerNote} onChange={(e) => setFooterNote(e.target.value)} rows={2} style={{ width: '100%' }} placeholder="e.g. Terms &amp; conditions, thank-you note…" />
            <h3>Layout &amp; branding</h3>
            <label>
              Invoice layout
              <select value={invoiceLayout} onChange={(e) => setInvoiceLayout(e.target.value as DocumentLayout)}>
                {LAYOUT_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Payslip layout
              <select value={payslipLayout} onChange={(e) => setPayslipLayout(e.target.value as DocumentLayout)}>
                {LAYOUT_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Accent color
              <input type="color" value={accentColorHex || '#1a56db'} onChange={(e) => setAccentColorHex(e.target.value)} />
            </label>
            <br />
            <br />
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
