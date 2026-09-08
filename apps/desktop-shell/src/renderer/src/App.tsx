import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary, SessionInfo } from '../../shared/ipc';
import { CompanyListScreen } from './screens/CompanyListScreen';
import { CreateCompanyScreen } from './screens/CreateCompanyScreen';
import { RecoveryKeyScreen } from './screens/RecoveryKeyScreen';
import { LoginScreen } from './screens/LoginScreen';
import { PasswordHelpScreen } from './screens/PasswordHelpScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { SetNewPasswordScreen } from './screens/SetNewPasswordScreen';
import { SetupWizardScreen } from './screens/SetupWizardScreen';
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
import { UpdateStatusBanner } from './UpdateStatusBanner';
import { BackupScreen } from './screens/BackupScreen';
import { ManageRolesScreen } from './screens/ManageRolesScreen';
import { ManageUnitsScreen } from './screens/ManageUnitsScreen';
import { ManageWarehousesScreen } from './screens/ManageWarehousesScreen';
import { ManageItemsScreen } from './screens/ManageItemsScreen';
import { RecordOpeningStockScreen } from './screens/RecordOpeningStockScreen';
import { StockAdjustmentScreen } from './screens/StockAdjustmentScreen';
import { StockTransferScreen } from './screens/StockTransferScreen';
import { StockSummaryScreen } from './screens/StockSummaryScreen';
import { StockMovementRegisterScreen } from './screens/StockMovementRegisterScreen';
import { StockValuationVsLedgerScreen } from './screens/StockValuationVsLedgerScreen';
import { ManageGstRatesScreen } from './screens/ManageGstRatesScreen';
import { GstSummaryScreen } from './screens/GstSummaryScreen';
import { GstReturnsScreen } from './screens/GstReturnsScreen';
import { BankAccountsScreen } from './screens/BankAccountsScreen';
import { BankReconciliationScreen } from './screens/BankReconciliationScreen';
import { BankStatementImportScreen } from './screens/BankStatementImportScreen';
import { ChequeRegisterScreen } from './screens/ChequeRegisterScreen';
import { EmployeesScreen } from './screens/EmployeesScreen';
import { NewExpenseClaimScreen } from './screens/NewExpenseClaimScreen';
import { ExpenseClaimRegisterScreen } from './screens/ExpenseClaimRegisterScreen';
import { OutstandingReimbursementsScreen } from './screens/OutstandingReimbursementsScreen';
import { DocumentSearchScreen } from './screens/DocumentSearchScreen';
import { EmployeePayrollProfileScreen } from './screens/EmployeePayrollProfileScreen';
import { SalaryComponentsScreen } from './screens/SalaryComponentsScreen';
import { SalaryStructureScreen } from './screens/SalaryStructureScreen';
import { PayrollSettingsScreen } from './screens/PayrollSettingsScreen';
import { ManagePayrollRulesScreen } from './screens/ManagePayrollRulesScreen';
import { CostCentresScreen } from './screens/CostCentresScreen';
import { BudgetsScreen } from './screens/BudgetsScreen';
import { FixedAssetClassesScreen } from './screens/FixedAssetClassesScreen';
import { FixedAssetRegisterScreen } from './screens/FixedAssetRegisterScreen';
import { RunDepreciationScreen } from './screens/RunDepreciationScreen';
import { ManageFixedAssetRatesScreen } from './screens/ManageFixedAssetRatesScreen';
import { BranchesScreen } from './screens/BranchesScreen';
import { InterBranchTransferScreen } from './screens/InterBranchTransferScreen';
import { BranchReportsScreen } from './screens/BranchReportsScreen';
import { ManageExchangeRatesScreen } from './screens/ManageExchangeRatesScreen';
import { RunFxRevaluationScreen } from './screens/RunFxRevaluationScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { LeaveScreen } from './screens/LeaveScreen';
import { PayrollRunScreen } from './screens/PayrollRunScreen';
import { GratuityScreen } from './screens/GratuityScreen';
import { BillOfMaterialsScreen } from './screens/BillOfMaterialsScreen';
import { CompanyLetterheadScreen } from './screens/CompanyLetterheadScreen';
import { PrintCentreScreen } from './screens/PrintCentreScreen';
import { TemplateDesignerScreen } from './screens/TemplateDesignerScreen';
import { ManufacturingJournalScreen } from './screens/ManufacturingJournalScreen';
import { ManufacturingJournalRegisterScreen } from './screens/ManufacturingJournalRegisterScreen';

type View =
  | { name: 'loading' }
  | { name: 'companyList' }
  | { name: 'createCompany' }
  | { name: 'recoveryKey'; company: CompanySummary; recoveryKey: string; fromCreation?: boolean }
  | { name: 'login'; company: CompanySummary; fromCreation?: boolean }
  | { name: 'passwordHelp'; company: CompanySummary }
  | { name: 'forgotPassword'; company: CompanySummary }
  | { name: 'setNewPassword'; company: CompanySummary; fromCreation?: boolean }
  | { name: 'setupWizard'; companyName: string }
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
  | { name: 'manageRoles' }
  | { name: 'manageUnits' }
  | { name: 'manageWarehouses' }
  | { name: 'manageItems' }
  | { name: 'recordOpeningStock' }
  | { name: 'stockAdjustment' }
  | { name: 'stockTransfer' }
  | { name: 'stockSummary' }
  | { name: 'stockMovementRegister' }
  | { name: 'stockValuationVsLedger' }
  | { name: 'manageGstRates' }
  | { name: 'gstSummary' }
  | { name: 'gstReturns' }
  | { name: 'bankAccounts' }
  | { name: 'bankReconciliation' }
  | { name: 'bankStatementImport' }
  | { name: 'chequeRegister' }
  | { name: 'employees' }
  | { name: 'newExpenseClaim' }
  | { name: 'expenseClaimRegister' }
  | { name: 'outstandingReimbursements' }
  | { name: 'documentSearch' }
  | { name: 'employeePayrollProfile' }
  | { name: 'salaryComponents' }
  | { name: 'salaryStructure' }
  | { name: 'payrollSettings' }
  | { name: 'managePayrollRules' }
  | { name: 'attendance' }
  | { name: 'leave' }
  | { name: 'payrollRuns' }
  | { name: 'gratuity' }
  | { name: 'costCentres' }
  | { name: 'budgets' }
  | { name: 'assetClasses' }
  | { name: 'fixedAssetRegister' }
  | { name: 'runDepreciation' }
  | { name: 'manageFixedAssetRates' }
  | { name: 'branches' }
  | { name: 'interBranchTransfer' }
  | { name: 'branchReports' }
  | { name: 'manageExchangeRates' }
  | { name: 'runFxRevaluation' }
  | { name: 'billsOfMaterial' }
  | { name: 'manufacturingJournal' }
  | { name: 'manufacturingJournalRegister' }
  | { name: 'companyLetterhead' }
  | { name: 'printCentre' }
  | { name: 'templateDesigner' };

export function App() {
  return (
    <>
      <ThemeToggle />
      <UpdateStatusBanner />
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
          setView({ name: 'recoveryKey', company: result.company, recoveryKey: result.recoveryKey, fromCreation: true });
        }}
      />
    );
  }

  if (view.name === 'recoveryKey') {
    return (
      <RecoveryKeyScreen
        companyName={view.company.tradeName ?? view.company.legalName}
        recoveryKey={view.recoveryKey}
        onContinue={() => setView({ name: 'login', company: view.company, fromCreation: view.fromCreation })}
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
            setView({ name: 'setNewPassword', company: view.company, fromCreation: view.fromCreation });
          } else {
            setSession(result.session);
            if (view.fromCreation) {
              setView({ name: 'setupWizard', companyName: view.company.tradeName ?? view.company.legalName });
            } else {
              setView({ name: 'dashboard' });
            }
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
          if (view.fromCreation) {
            setView({ name: 'setupWizard', companyName: view.company.tradeName ?? view.company.legalName });
          } else {
            setView({ name: 'dashboard' });
          }
        }}
      />
    );
  }

  if (view.name === 'setupWizard') {
    return (
      <SetupWizardScreen
        companyName={view.companyName}
        onGoToInvoice={() => setView({ name: 'newSalesInvoice' })}
        onSkipToDashboard={() => setView({ name: 'dashboard' })}
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
    return <PaymentVoucherScreen session={session!} onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'receiptVoucher') {
    return <ReceiptVoucherScreen session={session!} onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'contraVoucher') {
    return <ContraVoucherScreen session={session!} onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
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

  if (view.name === 'manageUnits') {
    return <ManageUnitsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manageWarehouses') {
    return <ManageWarehousesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manageItems') {
    return <ManageItemsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'recordOpeningStock') {
    return <RecordOpeningStockScreen onCreated={() => setView({ name: 'stockSummary' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'stockAdjustment') {
    return <StockAdjustmentScreen onCreated={() => setView({ name: 'stockMovementRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'stockTransfer') {
    return <StockTransferScreen onCreated={() => setView({ name: 'stockMovementRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'stockSummary') {
    return <StockSummaryScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'stockMovementRegister') {
    return <StockMovementRegisterScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'stockValuationVsLedger') {
    return <StockValuationVsLedgerScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manageGstRates') {
    return <ManageGstRatesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'gstSummary') {
    return <GstSummaryScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'gstReturns') {
    return <GstReturnsScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'bankAccounts') {
    return <BankAccountsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'bankReconciliation') {
    return <BankReconciliationScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'bankStatementImport') {
    return <BankStatementImportScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'chequeRegister') {
    return <ChequeRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'employees') {
    return <EmployeesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'newExpenseClaim') {
    return <NewExpenseClaimScreen onCreated={() => setView({ name: 'expenseClaimRegister' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'expenseClaimRegister') {
    return <ExpenseClaimRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'outstandingReimbursements') {
    return <OutstandingReimbursementsScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'documentSearch') {
    return <DocumentSearchScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'employeePayrollProfile') {
    return <EmployeePayrollProfileScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'salaryComponents') {
    return <SalaryComponentsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'salaryStructure') {
    return <SalaryStructureScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'payrollSettings') {
    return <PayrollSettingsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'managePayrollRules') {
    return <ManagePayrollRulesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'attendance') {
    return <AttendanceScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'leave') {
    return <LeaveScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'payrollRuns') {
    return <PayrollRunScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'gratuity') {
    return <GratuityScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'costCentres') {
    return <CostCentresScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'budgets') {
    return <BudgetsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'assetClasses') {
    return <FixedAssetClassesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'fixedAssetRegister') {
    return <FixedAssetRegisterScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'runDepreciation') {
    return <RunDepreciationScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manageFixedAssetRates') {
    return <ManageFixedAssetRatesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'branches') {
    return <BranchesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'interBranchTransfer') {
    return <InterBranchTransferScreen session={session!} onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'branchReports') {
    return <BranchReportsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manageExchangeRates') {
    return <ManageExchangeRatesScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'runFxRevaluation') {
    return <RunFxRevaluationScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'billsOfMaterial') {
    return <BillOfMaterialsScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manufacturingJournal') {
    return <ManufacturingJournalScreen onCreated={() => setView({ name: 'dashboard' })} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'manufacturingJournalRegister') {
    return <ManufacturingJournalRegisterScreen onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'companyLetterhead') {
    return <CompanyLetterheadScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'printCentre') {
    return <PrintCentreScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
  }

  if (view.name === 'templateDesigner') {
    return <TemplateDesignerScreen session={session!} onBack={() => setView({ name: 'dashboard' })} />;
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
      onManageUnits={() => setView({ name: 'manageUnits' })}
      onManageWarehouses={() => setView({ name: 'manageWarehouses' })}
      onManageItems={() => setView({ name: 'manageItems' })}
      onRecordOpeningStock={() => setView({ name: 'recordOpeningStock' })}
      onStockAdjustment={() => setView({ name: 'stockAdjustment' })}
      onStockTransfer={() => setView({ name: 'stockTransfer' })}
      onStockSummary={() => setView({ name: 'stockSummary' })}
      onStockMovementRegister={() => setView({ name: 'stockMovementRegister' })}
      onStockValuationVsLedger={() => setView({ name: 'stockValuationVsLedger' })}
      onManageGstRates={() => setView({ name: 'manageGstRates' })}
      onGstSummary={() => setView({ name: 'gstSummary' })}
      onGstReturns={() => setView({ name: 'gstReturns' })}
      onBankAccounts={() => setView({ name: 'bankAccounts' })}
      onBankReconciliation={() => setView({ name: 'bankReconciliation' })}
      onBankStatementImport={() => setView({ name: 'bankStatementImport' })}
      onChequeRegister={() => setView({ name: 'chequeRegister' })}
      onEmployees={() => setView({ name: 'employees' })}
      onNewExpenseClaim={() => setView({ name: 'newExpenseClaim' })}
      onExpenseClaimRegister={() => setView({ name: 'expenseClaimRegister' })}
      onOutstandingReimbursements={() => setView({ name: 'outstandingReimbursements' })}
      onDocumentSearch={() => setView({ name: 'documentSearch' })}
      onEmployeePayrollProfile={() => setView({ name: 'employeePayrollProfile' })}
      onSalaryComponents={() => setView({ name: 'salaryComponents' })}
      onSalaryStructure={() => setView({ name: 'salaryStructure' })}
      onPayrollSettings={() => setView({ name: 'payrollSettings' })}
      onManagePayrollRules={() => setView({ name: 'managePayrollRules' })}
      onAttendance={() => setView({ name: 'attendance' })}
      onLeave={() => setView({ name: 'leave' })}
      onPayrollRuns={() => setView({ name: 'payrollRuns' })}
      onGratuity={() => setView({ name: 'gratuity' })}
      onCostCentres={() => setView({ name: 'costCentres' })}
      onBudgets={() => setView({ name: 'budgets' })}
      onAssetClasses={() => setView({ name: 'assetClasses' })}
      onFixedAssetRegister={() => setView({ name: 'fixedAssetRegister' })}
      onRunDepreciation={() => setView({ name: 'runDepreciation' })}
      onManageFixedAssetRates={() => setView({ name: 'manageFixedAssetRates' })}
      onBranches={() => setView({ name: 'branches' })}
      onInterBranchTransfer={() => setView({ name: 'interBranchTransfer' })}
      onBranchReports={() => setView({ name: 'branchReports' })}
      onManageExchangeRates={() => setView({ name: 'manageExchangeRates' })}
      onRunFxRevaluation={() => setView({ name: 'runFxRevaluation' })}
      onBillsOfMaterial={() => setView({ name: 'billsOfMaterial' })}
      onManufacturingJournal={() => setView({ name: 'manufacturingJournal' })}
      onManufacturingJournalRegister={() => setView({ name: 'manufacturingJournalRegister' })}
      onCompanyLetterhead={() => setView({ name: 'companyLetterhead' })}
      onPrintCentre={() => setView({ name: 'printCentre' })}
      onTemplateDesigner={() => setView({ name: 'templateDesigner' })}
      onLogout={async () => {
        await window.mhts.logout();
        setSession(null);
        await refreshCompanies();
        setView({ name: 'companyList' });
      }}
    />
  );
}
