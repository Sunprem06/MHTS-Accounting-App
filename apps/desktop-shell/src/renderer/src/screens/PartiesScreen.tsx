import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import type { PartySummary, PartyType, SessionInfo } from '../../../shared/ipc';
import { AttachmentsPanel } from './AttachmentsPanel';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function PartiesScreen({ session, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [partyType, setPartyType] = useState<PartyType>('CUSTOMER');
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [isMsme, setIsMsme] = useState(false);
  const [udyamNumber, setUdyamNumber] = useState('');
  const [creditPeriodDays, setCreditPeriodDays] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const canManage = session.permissions.includes('SALES.MANAGE_PARTIES');

  async function refresh() {
    const result = await window.mhts.listParties();
    if (result.ok && result.data) {
      setParties(result.data);
    } else {
      setError(result.error ?? 'Failed to load parties');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createParty({
      partyType,
      name,
      gstin: gstin || undefined,
      stateCode: stateCode || undefined,
      isMsmeUdyamRegistered: isMsme,
      udyamRegistrationNumber: isMsme ? udyamNumber || undefined : undefined,
      creditPeriodDays: creditPeriodDays ? Number(creditPeriodDays) : undefined,
      address: address || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setGstin('');
      setStateCode('');
      setIsMsme(false);
      setUdyamNumber('');
      setCreditPeriodDays('');
      setAddress('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create party');
    }
  }

  async function handleSaveAddress(partyId: string) {
    setError(null);
    setSavingAddress(true);
    const result = await window.mhts.updateBusinessPartyAddress({ partyId, address: addressDraft || null });
    setSavingAddress(false);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to save address');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Users size={18} style={{ color: 'var(--accent)' }} /> Customers &amp; suppliers
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {parties === null ? (
          <p className="empty-state">Loading…</p>
        ) : parties.length === 0 ? (
          <p className="empty-state">No customers or suppliers yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>GSTIN</th>
                <th>MSME</th>
                <th>Credit period</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <Fragment key={party.id}>
                  <tr>
                    <td>{party.name}</td>
                    <td>{party.partyType}</td>
                    <td>{party.gstin ?? '—'}</td>
                    <td>
                      {party.isMsmeUdyamRegistered ? (
                        <span className="badge badge-success">{party.udyamRegistrationNumber ?? 'Yes'}</span>
                      ) : (
                        <span className="badge badge-muted">No</span>
                      )}
                    </td>
                    <td>{party.creditPeriodDays ? `${party.creditPeriodDays} days` : '—'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setAddressDraft(party.address ?? '');
                          setExpandedId(expandedId === party.id ? null : party.id);
                        }}
                      >
                        {expandedId === party.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === party.id && (
                    <tr>
                      <td colSpan={6}>
                        {canManage && (
                          <div style={{ marginBottom: 12 }}>
                            <label className="field">
                              Address (Bill To, shown on printed invoices)
                              <textarea value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} rows={2} />
                            </label>
                            <button type="button" disabled={savingAddress} onClick={() => handleSaveAddress(party.id)}>
                              {savingAddress ? 'Saving…' : 'Save address'}
                            </button>
                          </div>
                        )}
                        <AttachmentsPanel session={session} entityType="BusinessParty" entityId={party.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New customer / supplier</h2>
          <div className="field-row">
            <label className="field">
              Type
              <select value={partyType} onChange={(e) => setPartyType(e.target.value as PartyType)}>
                <option value="CUSTOMER">Customer</option>
                <option value="SUPPLIER">Supplier</option>
                <option value="BOTH">Both</option>
              </select>
            </label>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              GSTIN
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </label>
            <label className="field">
              State code
              <input value={stateCode} onChange={(e) => setStateCode(e.target.value)} style={{ width: 70 }} />
            </label>
            <label className="field">
              Credit period (days)
              <input type="number" min="0" value={creditPeriodDays} onChange={(e) => setCreditPeriodDays(e.target.value)} style={{ width: 90 }} />
            </label>
          </div>
          <label className="field">
            Address (Bill To, shown on printed invoices)
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isMsme} onChange={(e) => setIsMsme(e.target.checked)} />
            Udyam-registered MSME (Section 43B(h))
          </label>
          {isMsme && (
            <label className="field">
              Udyam registration number
              <input value={udyamNumber} onChange={(e) => setUdyamNumber(e.target.value)} />
            </label>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add party'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
