import { useEffect, useState } from 'react';
import type { PartySummary, PartyType, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function PartiesScreen({ session, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [partyType, setPartyType] = useState<PartyType>('CUSTOMER');
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [isMsme, setIsMsme] = useState(false);
  const [udyamNumber, setUdyamNumber] = useState('');
  const [creditPeriodDays, setCreditPeriodDays] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setGstin('');
      setStateCode('');
      setIsMsme(false);
      setUdyamNumber('');
      setCreditPeriodDays('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create party');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Customers &amp; Suppliers</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {parties === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'left' }}>GSTIN</th>
              <th style={{ textAlign: 'left' }}>MSME</th>
              <th style={{ textAlign: 'left' }}>Credit period</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => (
              <tr key={party.id}>
                <td>{party.name}</td>
                <td>{party.partyType}</td>
                <td>{party.gstin ?? '—'}</td>
                <td>{party.isMsmeUdyamRegistered ? `Yes (${party.udyamRegistrationNumber ?? 'no number'})` : 'No'}</td>
                <td>{party.creditPeriodDays ? `${party.creditPeriodDays} days` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New customer / supplier</h2>
          <label>
            Type
            <select value={partyType} onChange={(e) => setPartyType(e.target.value as PartyType)}>
              <option value="CUSTOMER">Customer</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="BOTH">Both</option>
            </select>
          </label>{' '}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <br />
          <label>
            GSTIN
            <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
          </label>{' '}
          <label>
            State code
            <input value={stateCode} onChange={(e) => setStateCode(e.target.value)} style={{ width: 60 }} />
          </label>{' '}
          <label>
            Credit period (days)
            <input type="number" min="0" value={creditPeriodDays} onChange={(e) => setCreditPeriodDays(e.target.value)} style={{ width: 60 }} />
          </label>
          <br />
          <label>
            <input type="checkbox" checked={isMsme} onChange={(e) => setIsMsme(e.target.checked)} /> Udyam-registered MSME (Section 43B(h))
          </label>{' '}
          {isMsme && (
            <label>
              Udyam registration number
              <input value={udyamNumber} onChange={(e) => setUdyamNumber(e.target.value)} />
            </label>
          )}
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add party'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
