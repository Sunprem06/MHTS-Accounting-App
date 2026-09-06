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
import { JournalVoucherScreen } from './screens/JournalVoucherScreen';
import { PaymentVoucherScreen } from './screens/PaymentVoucherScreen';
import { ReceiptVoucherScreen } from './screens/ReceiptVoucherScreen';
import { ContraVoucherScreen } from './screens/ContraVoucherScreen';
import { VoucherRegisterScreen } from './screens/VoucherRegisterScreen';
import { TrialBalanceScreen } from './screens/TrialBalanceScreen';
import { ProfitAndLossScreen } from './screens/ProfitAndLossScreen';
import { BalanceSheetScreen } from './screens/BalanceSheetScreen';
import { PartiesScreen } from './screens/PartiesScreen';
import { NewSalesInvoiceScreen } from './screens/NewSalesInvoiceScreen';
import { NewPurchaseInvoiceScreen } from './screens/NewPurchaseInvoiceScreen';
import { SalesInvoiceRegisterScreen } from './screens/SalesInvoiceRegisterScreen';
import { PurchaseInvoiceRegisterScreen } from './screens/PurchaseInvoiceRegisterScreen';
import { NewSalesOrderScreen } from './screens/NewSalesOrderScreen';
import { NewPurchaseOrderScreen } from './screens/NewPurchaseOrderScreen';
import { SalesOrderRegisterScreen } from './screens/SalesOrderRegisterScreen';
import { PurchaseOrderRegisterScreen } from './screens/PurchaseOrderRegisterScreen';
import { ReceivablesScreen } from './screens/ReceivablesScreen';
import { PayablesScreen } from './screens/PayablesScreen';
import { MsmeAgeingScreen } from './screens/MsmeAgeingScreen';
import { CustomerReceiptScreen } from './screens/CustomerReceiptScreen';
import { SupplierPaymentScreen } from './screens/SupplierPaymentScreen';
import { ThemeToggle } from './ThemeToggle';
import { BackupScreen } from './screens/BackupScreen';
import { ManageRolesScreen } from './screens/ManageRolesScreen';

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
  | { name: 'journalVoucher' }
  | { name: 'paymentVoucher' }
  | { name: 'receiptVoucher' }
  | { name: 'contraVoucher' }
  | { name: 'voucherRegister' }
  | { name: 'trialBalance' }
  | { name: 'profitAndLoss' }
  | { name: 'balanceSheet' }
  | { name: 'parties' }
  | { name: 'newSalesInvoice' }
  | { name: 'newPurchaseInvoice' }
  | { name: 'salesInvoiceRegister' }
  | { name: 'purchaseInvoiceRegister' }
  | { name: 'newSalesOrder' }
  | { name: 'newPurchaseOrder' }
  | { name: 'salesOrderRegister' }
  | { name: 'purchaseOrderRegister' }
  | { name: 'receivables' }
  | { name: 'payables' }
  | { name: 'msmeAgeing' }
  | { name: 'customerReceipt' }
  | { name: 'supplierPayment' }
  | { name: 'backup' }
  | { name: 'manageRoles' };

export function App() {
  return (
    <>
      <ThemeToggle />
      <AppRoutes />
    </>
  );
}

/** The routing logic itself, unchanged below — split out only so ThemeToggle can be rendered once, above every screen, without threading it through each one individually. */
function AppRoutes() {
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

  if (view.name === 'journalVoucher') {
    return <JournalVoucherScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'paymentVoucher') {
    return <PaymentVoucherScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'receiptVoucher') {
    return <ReceiptVoucherScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'contraVoucher') {
    return <ContraVoucherScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'voucherRegister') {
    return <VoucherRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
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

  if (view.name === 'parties') {
    return <PartiesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newSalesInvoice') {
    return <NewSalesInvoiceScreen onCreated={() => setView({ name: 'salesInvoiceRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newPurchaseInvoice') {
    return <NewPurchaseInvoiceScreen onCreated={() => setView({ name: 'purchaseInvoiceRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'salesInvoiceRegister') {
    return <SalesInvoiceRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'purchaseInvoiceRegister') {
    return <PurchaseInvoiceRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newSalesOrder') {
    return <NewSalesOrderScreen onCreated={() => setView({ name: 'salesOrderRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newPurchaseOrder') {
    return <NewPurchaseOrderScreen onCreated={() => setView({ name: 'purchaseOrderRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'salesOrderRegister') {
    return <SalesOrderRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'purchaseOrderRegister') {
    return <PurchaseOrderRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'receivables') {
    return <ReceivablesScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'payables') {
    return <PayablesScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'msmeAgeing') {
    return <MsmeAgeingScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'customerReceipt') {
    return <CustomerReceiptScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'supplierPayment') {
    return <SupplierPaymentScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'backup') {
    return (
      <BackupScreen
        onBack={() => setView({ name: 'dashboard' })}
        onRestored={async () => {
          setSession(null);
          await refreshCompanies();
          setView({ name: 'companyList' });
        }}
      />
    );
  }

  if (view.name === 'manageRoles') {
    return <ManageRolesScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  return (
    <DashboardScreen
      session={session!}
      onManageUsers={() => setView({ name: 'manageUsers' })}
      onChartOfAccounts={() => setView({ name: 'chartOfAccounts' })}
      onJournalVoucher={() => setView({ name: 'journalVoucher' })}
      onPaymentVoucher={() => setView({ name: 'paymentVoucher' })}
      onReceiptVoucher={() => setView({ name: 'receiptVoucher' })}
      onContraVoucher={() => setView({ name: 'contraVoucher' })}
      onVoucherRegister={() => setView({ name: 'voucherRegister' })}
      onTrialBalance={() => setView({ name: 'trialBalance' })}
      onProfitAndLoss={() => setView({ name: 'profitAndLoss' })}
      onBalanceSheet={() => setView({ name: 'balanceSheet' })}
      onParties={() => setView({ name: 'parties' })}
      onNewSalesInvoice={() => setView({ name: 'newSalesInvoice' })}
      onNewPurchaseInvoice={() => setView({ name: 'newPurchaseInvoice' })}
      onSalesInvoiceRegister={() => setView({ name: 'salesInvoiceRegister' })}
      onPurchaseInvoiceRegister={() => setView({ name: 'purchaseInvoiceRegister' })}
      onNewSalesOrder={() => setView({ name: 'newSalesOrder' })}
      onNewPurchaseOrder={() => setView({ name: 'newPurchaseOrder' })}
      onSalesOrderRegister={() => setView({ name: 'salesOrderRegister' })}
      onPurchaseOrderRegister={() => setView({ name: 'purchaseOrderRegister' })}
      onReceivables={() => setView({ name: 'receivables' })}
      onPayables={() => setView({ name: 'payables' })}
      onMsmeAgeing={() => setView({ name: 'msmeAgeing' })}
      onCustomerReceipt={() => setView({ name: 'customerReceipt' })}
      onSupplierPayment={() => setView({ name: 'supplierPayment' })}
      onBackup={() => setView({ name: 'backup' })}
      onManageRoles={() => setView({ name: 'manageRoles' })}
      onLogout={async () => {
        await window.mhts.logout();
        setSession(null);
        await refreshCompanies();
        setView({ name: 'companyList' });
      }}
    />
  );
}
