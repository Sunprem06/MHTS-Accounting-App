import { useState } from 'react';
import type { CreateCompanyInput, CreateCompanyResult } from '../../../shared/ipc';

interface Props {
  onCreated: (result: CreateCompanyResult) => void;
  onCancel: () => void;
}

const ENTITY_TYPES = ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LTD', 'PUBLIC_LTD', 'OPC'];

const initialForm: CreateCompanyInput = {
  legalName: '',
  tradeName: '',
  entityType: 'PRIVATE_LTD',
  stateCode: '',
  gstRegistrationType: 'REGULAR',
  financialYearStartMonth: 4,
  baseCurrency: 'INR',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export function CreateCompanyScreen({ onCreated, onCancel }: Props) {
  const [form, setForm] = useState<CreateCompanyInput>(initialForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof CreateCompanyInput>(key: K, value: CreateCompanyInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.legalName || !form.adminName || !form.adminEmail || !form.adminPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.adminPassword.length < 8) {
      setError('Admin password must be at least 8 characters.');
      return;
    }
    if (form.adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await window.mhts.createCompany(form);
    setSubmitting(false);
    if (result.ok && result.data) {
      onCreated(result.data);
    } else {
      setError(result.error ?? 'Failed to create company');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>New Company</h1>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ marginBottom: 16 }}>
          <legend>Company</legend>
          <label>
            Legal name*
            <input value={form.legalName} onChange={(e) => set('legalName', e.target.value)} required />
          </label>
          <br />
          <label>
            Trade name
            <input value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} />
          </label>
          <br />
          <label>
            Entity type
            <select value={form.entityType} onChange={(e) => set('entityType', e.target.value)}>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <br />
          <label>
            State code
            <input value={form.stateCode} onChange={(e) => set('stateCode', e.target.value)} placeholder="e.g. IN-TN" />
          </label>
          <br />
          <label>
            GST registration
            <select value={form.gstRegistrationType} onChange={(e) => set('gstRegistrationType', e.target.value as CreateCompanyInput['gstRegistrationType'])}>
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITION">Composition scheme</option>
            </select>
          </label>
          {form.gstRegistrationType === 'COMPOSITION' && (
            <p style={{ fontSize: 12, color: '#8a6d00' }}>
              A composition dealer cannot collect GST from customers or claim input tax credit — sales invoices will always post at zero
              tax. This can't be changed after the company is created in this version.
            </p>
          )}
          <br />
          <label>
            Financial year start month
            <input
              type="number"
              min={1}
              max={12}
              value={form.financialYearStartMonth}
              onChange={(e) => set('financialYearStartMonth', Number(e.target.value))}
            />
          </label>
          <br />
          <label>
            Base currency
            <input value={form.baseCurrency} onChange={(e) => set('baseCurrency', e.target.value)} />
          </label>
        </fieldset>

        <fieldset style={{ marginBottom: 16 }}>
          <legend>Admin account</legend>
          <label>
            Name*
            <input value={form.adminName} onChange={(e) => set('adminName', e.target.value)} required />
          </label>
          <br />
          <label>
            Email*
            <input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} required />
          </label>
          <br />
          <label>
            Password*
            <input
              type="password"
              value={form.adminPassword}
              onChange={(e) => set('adminPassword', e.target.value)}
              required
            />
          </label>
          <br />
          <label>
            Confirm password*
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
        </fieldset>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Company'}
        </button>{' '}
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </form>
    </div>
  );
}
