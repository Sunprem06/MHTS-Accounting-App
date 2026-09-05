import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../shared/ipc';
import { CompanyListScreen } from './screens/CompanyListScreen';
import { CreateCompanyScreen } from './screens/CreateCompanyScreen';
import { RecoveryKeyScreen } from './screens/RecoveryKeyScreen';
import { LoginScreen } from './screens/LoginScreen';
import { PasswordHelpScreen } from './screens/PasswordHelpScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { SetNewPasswordScreen } from './screens/SetNewPasswordScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ManageUsersScreen } from './screens/ManageUsersScreen';
import { ChartOfAccountsScreen } from './screens/ChartOfAccountsScreen';
import { NewVoucherScreen } from './screens/NewVoucherScreen';
import { TrialBalanceScreen } from './screens/TrialBalanceScreen';
import { ProfitAndLossScreen } from './screens/ProfitAndLossScreen';
import { BalanceSheetScreen } from './screens/BalanceSheetScreen';

type View =
  | { name: 'loading' }
  | { name: 'companyList' }
  | { name: 'createCompany' }
  | { name: 'recoveryKey'; company: CompanySummary; recoveryKey: string }
  | { name: 'login'; company: CompanySummary }
  | { name: 'passwordHelp'; company: CompanySummary }
  | { name: 'forgotPassword'; company: CompanySummary }
  | { name: 'setNewPassword'; company: CompanySummary }
  | { name: 'dashboard' }
  | { name: 'manageUsers' }
  | { name: 'chartOfAccounts' }
  | { name: 'newVoucher' }
  | { name: 'trialBalance' }
  | { name: 'profitAndLoss' }
  | { name: 'balanceSheet' };

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
        onCreated={async (result) => {
          await refreshCompanies();
          setView({ name: 'recoveryKey', company: result.company, recoveryKey: result.recoveryKey });
        }}
      />
    );
  }

  if (view.name === 'recoveryKey') {
    return (
      <RecoveryKeyScreen
        companyName={view.company.tradeName ?? view.company.legalName}
        recoveryKey={view.recoveryKey}
        onContinue={() => setView({ name: 'login', company: view.company })}
      />
    );
  }

  if (view.name === 'login') {
    return (
      <LoginScreen
        company={view.company}
        onBack={() => setView({ name: 'companyList' })}
        onForgotPassword={() => setView({ name: 'passwordHelp', company: view.company })}
        onLoginResult={(result) => {
          if (result.mustChangePassword) {
            setView({ name: 'setNewPassword', company: view.company });
          } else {
            setSession(result.session);
            setView({ name: 'dashboard' });
          }
        }}
      />
    );
  }

  if (view.name === 'passwordHelp') {
    return (
      <PasswordHelpScreen
        company={view.company}
        onBack={() => setView({ name: 'login', company: view.company })}
        onUseRecoveryKey={() => setView({ name: 'forgotPassword', company: view.company })}
      />
    );
  }

  if (view.name === 'forgotPassword') {
    return (
      <ForgotPasswordScreen
        company={view.company}
        onBack={() => setView({ name: 'login', company: view.company })}
        onReset={(info) => {
          setSession(info);
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  if (view.name === 'setNewPassword') {
    return (
      <SetNewPasswordScreen
        company={view.company}
        onBack={() => setView({ name: 'login', company: view.company })}
        onDone={(info) => {
          setSession(info);
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  if (view.name === 'manageUsers') {
    return <ManageUsersScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'chartOfAccounts') {
    return <ChartOfAccountsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newVoucher') {
    return <NewVoucherScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'trialBalance') {
    return <TrialBalanceScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'profitAndLoss') {
    return <ProfitAndLossScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'balanceSheet') {
    return <BalanceSheetScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  return (
    <DashboardScreen
      session={session!}
      onManageUsers={() => setView({ name: 'manageUsers' })}
      onChartOfAccounts={() => setView({ name: 'chartOfAccounts' })}
      onNewVoucher={() => setView({ name: 'newVoucher' })}
      onTrialBalance={() => setView({ name: 'trialBalance' })}
      onProfitAndLoss={() => setView({ name: 'profitAndLoss' })}
      onBalanceSheet={() => setView({ name: 'balanceSheet' })}
      onLogout={async () => {
        await window.mhts.logout();
        setSession(null);
        await refreshCompanies();
        setView({ name: 'companyList' });
      }}
    />
  );
}
