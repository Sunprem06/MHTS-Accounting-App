import type { CompanySummary } from '../../../shared/ipc';

interface Props {
  companies: CompanySummary[];
  error: string | null;
  onSelectCompany: (company: CompanySummary) => void;
  onCreateNew: () => void;
}

export function CompanyListScreen({ companies, error, onSelectCompany, onCreateNew }: Props) {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>MHTS ERP</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
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
      <button onClick={onCreateNew}>+ New Company</button>
    </div>
  );
}
