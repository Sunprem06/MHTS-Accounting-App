import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../shared/ipc';
import { CompanyListScreen } from './screens/CompanyListScreen';
import { CreateCompanyScreen } from './screens/CreateCompanyScreen';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';

type View =
  | { name: 'loading' }
  | { name: 'companyList' }
  | { name: 'createCompany' }
  | { name: 'login'; company: CompanySummary }
  | { name: 'dashboard' };

export function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCompanies = useCallback(async () => {
    const result = await window.mhts.listCompanies();
    if (result.ok && result.data) {
      setCompanies(result.data);
    } else {
      setError(result.error ?? 'Failed to load companies');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const existing = await window.mhts.getSession();
      if (existing.ok && existing.data) {
        setSession(existing.data);
        setView({ name: 'dashboard' });
        return;
      }
      await refreshCompanies();
      setView({ name: 'companyList' });
    })();
  }, [refreshCompanies]);

  if (view.name === 'loading') {
    return <p style={{ padding: 24, fontFamily: 'sans-serif' }}>Loading…</p>;
  }

  if (view.name === 'companyList') {
    return (
      <CompanyListScreen
        companies={companies}
        error={error}
        onSelectCompany={(company) => setView({ name: 'login', company })}
        onCreateNew={() => setView({ name: 'createCompany' })}
      />
    );
  }

  if (view.name === 'createCompany') {
    return (
      <CreateCompanyScreen
        onCancel={() => setView({ name: 'companyList' })}
        onCreated={async (company) => {
          await refreshCompanies();
          setView({ name: 'login', company });
        }}
      />
    );
  }

  if (view.name === 'login') {
    return (
      <LoginScreen
        company={view.company}
        onBack={() => setView({ name: 'companyList' })}
        onLoggedIn={(info) => {
          setSession(info);
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  return (
    <DashboardScreen
      session={session!}
      onLogout={async () => {
        await window.mhts.logout();
        setSession(null);
        await refreshCompanies();
        setView({ name: 'companyList' });
      }}
    />
  );
}
