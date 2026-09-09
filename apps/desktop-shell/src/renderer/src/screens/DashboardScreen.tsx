import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Factory,
  FileSearch,
  GitBranch,
  Landmark,
  LogOut,
  Package,
  Percent,
  PiggyBank,
  Printer,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onLogout: () => void;
  onManageUsers: () => void;
  onChartOfAccounts: () => void;
  onJournalVoucher: () => void;
  onPaymentVoucher: () => void;
  onReceiptVoucher: () => void;
  onContraVoucher: () => void;
  onVoucherRegister: () => void;
  onTrialBalance: () => void;
  onProfitAndLoss: () => void;
  onBalanceSheet: () => void;
  onParties: () => void;
  onNewSalesInvoice: () => void;
  onNewPurchaseInvoice: () => void;
  onSalesInvoiceRegister: () => void;
  onPurchaseInvoiceRegister: () => void;
  onNewSalesOrder: () => void;
  onNewPurchaseOrder: () => void;
  onSalesOrderRegister: () => void;
  onPurchaseOrderRegister: () => void;
  onReceivables: () => void;
  onPayables: () => void;
  onMsmeAgeing: () => void;
  onCustomerReceipt: () => void;
  onSupplierPayment: () => void;
  onBackup: () => void;
  onVerifyAuditTrail: () => void;
  onManageRoles: () => void;
  onManageUnits: () => void;
  onManageWarehouses: () => void;
  onManageItems: () => void;
  onRecordOpeningStock: () => void;
  onStockAdjustment: () => void;
  onStockTransfer: () => void;
  onStockSummary: () => void;
  onStockMovementRegister: () => void;
  onStockValuationVsLedger: () => void;
  onManageGstRates: () => void;
  onGstSummary: () => void;
  onGstReturns: () => void;
  onBankAccounts: () => void;
  onBankReconciliation: () => void;
  onBankStatementImport: () => void;
  onChequeRegister: () => void;
  onEmployees: () => void;
  onNewExpenseClaim: () => void;
  onExpenseClaimRegister: () => void;
  onOutstandingReimbursements: () => void;
  onDocumentSearch: () => void;
  onEmployeePayrollProfile: () => void;
  onSalaryComponents: () => void;
  onSalaryStructure: () => void;
  onPayrollSettings: () => void;
  onManagePayrollRules: () => void;
  onAttendance: () => void;
  onLeave: () => void;
  onPayrollRuns: () => void;
  onGratuity: () => void;
  onCostCentres: () => void;
  onBudgets: () => void;
  onAssetClasses: () => void;
  onFixedAssetRegister: () => void;
  onRunDepreciation: () => void;
  onManageFixedAssetRates: () => void;
  onBranches: () => void;
  onInterBranchTransfer: () => void;
  onBranchReports: () => void;
  onManageExchangeRates: () => void;
  onRunFxRevaluation: () => void;
  onBillsOfMaterial: () => void;
  onManufacturingJournal: () => void;
  onManufacturingJournalRegister: () => void;
  onCompanyLetterhead: () => void;
  onPrintCentre: () => void;
  onTemplateDesigner: () => void;
}

interface NavItem {
  label: string;
  onClick: () => void;
  show: boolean;
}

interface NavSection {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface KpiSummary {
  totalSales: number;
  totalPurchases: number;
  receivables: number;
  payables: number;
  stockValue: number;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function KpiCard({
  label,
  value,
  loading,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'accent';
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-muted)', fontSize: 13, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            padding: 6,
            borderRadius: 'var(--radius-sm)',
            background: `var(--${tone}-soft)`,
            color: `var(--${tone})`,
          }}
        >
          <Icon size={15} />
        </span>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {loading ? <RefreshCw size={18} className="spin" style={{ color: 'var(--fg-muted)' }} /> : formatInr(value)}
      </div>
    </div>
  );
}

export function DashboardScreen({
  session,
  onLogout,
  onManageUsers,
  onChartOfAccounts,
  onJournalVoucher,
  onPaymentVoucher,
  onReceiptVoucher,
  onContraVoucher,
  onVoucherRegister,
  onTrialBalance,
  onProfitAndLoss,
  onBalanceSheet,
  onParties,
  onNewSalesInvoice,
  onNewPurchaseInvoice,
  onSalesInvoiceRegister,
  onPurchaseInvoiceRegister,
  onNewSalesOrder,
  onNewPurchaseOrder,
  onSalesOrderRegister,
  onPurchaseOrderRegister,
  onReceivables,
  onPayables,
  onMsmeAgeing,
  onCustomerReceipt,
  onSupplierPayment,
  onBackup,
  onVerifyAuditTrail,
  onManageRoles,
  onManageUnits,
  onManageWarehouses,
  onManageItems,
  onRecordOpeningStock,
  onStockAdjustment,
  onStockTransfer,
  onStockSummary,
  onStockMovementRegister,
  onStockValuationVsLedger,
  onManageGstRates,
  onGstSummary,
  onGstReturns,
  onBankAccounts,
  onBankReconciliation,
  onBankStatementImport,
  onChequeRegister,
  onEmployees,
  onNewExpenseClaim,
  onExpenseClaimRegister,
  onOutstandingReimbursements,
  onDocumentSearch,
  onEmployeePayrollProfile,
  onSalaryComponents,
  onSalaryStructure,
  onPayrollSettings,
  onManagePayrollRules,
  onAttendance,
  onLeave,
  onPayrollRuns,
  onGratuity,
  onCostCentres,
  onBudgets,
  onAssetClasses,
  onFixedAssetRegister,
  onRunDepreciation,
  onManageFixedAssetRates,
  onBranches,
  onInterBranchTransfer,
  onBranchReports,
  onManageExchangeRates,
  onRunFxRevaluation,
  onBillsOfMaterial,
  onManufacturingJournal,
  onManufacturingJournalRegister,
  onCompanyLetterhead,
  onPrintCentre,
  onTemplateDesigner,
}: Props) {
  const perms = session.permissions;
  const has = (code: string) => perms.includes(code);

  const canViewSalesReports = has('SALES.VIEW_REPORTS');
  const canViewPurchaseReports = has('PURCHASE.VIEW_REPORTS');
  const canViewInventoryReports = has('INVENTORY.VIEW_REPORTS');
  const showKpiRow = canViewSalesReports || canViewPurchaseReports || canViewInventoryReports;

  const [kpi, setKpi] = useState<KpiSummary>({ totalSales: 0, totalPurchases: 0, receivables: 0, payables: 0, stockValue: 0 });
  const [kpiLoading, setKpiLoading] = useState(showKpiRow);

  useEffect(() => {
    if (!showKpiRow) return;
    let cancelled = false;

    async function loadKpis() {
      setKpiLoading(true);
      const [salesRes, purchaseRes, receivablesRes, payablesRes, stockRes] = await Promise.all([
        canViewSalesReports ? window.mhts.listSalesInvoices() : null,
        canViewPurchaseReports ? window.mhts.listPurchaseInvoices() : null,
        canViewSalesReports ? window.mhts.listReceivables() : null,
        canViewPurchaseReports ? window.mhts.listPayables() : null,
        canViewInventoryReports ? window.mhts.getStockPosition({}) : null,
      ]);
      if (cancelled) return;

      setKpi({
        totalSales:
          salesRes?.ok && salesRes.data ? salesRes.data.filter((row) => !row.cancelledAt).reduce((sum, row) => sum + row.totalAmount, 0) : 0,
        totalPurchases:
          purchaseRes?.ok && purchaseRes.data
            ? purchaseRes.data.filter((row) => !row.cancelledAt).reduce((sum, row) => sum + row.totalAmount, 0)
            : 0,
        receivables: receivablesRes?.ok && receivablesRes.data ? receivablesRes.data.reduce((sum, row) => sum + row.outstandingAmount, 0) : 0,
        payables: payablesRes?.ok && payablesRes.data ? payablesRes.data.reduce((sum, row) => sum + row.outstandingAmount, 0) : 0,
        stockValue: stockRes?.ok && stockRes.data ? stockRes.data.reduce((sum, row) => sum + row.valueRupees, 0) : 0,
      });
      setKpiLoading(false);
    }

    loadKpis();
    return () => {
      cancelled = true;
    };
  }, [showKpiRow, canViewSalesReports, canViewPurchaseReports, canViewInventoryReports]);

  const sections: NavSection[] = useMemo(
    () => [
      {
        title: 'Vouchers',
        icon: Receipt,
        items: [
          { label: 'Payment', onClick: onPaymentVoucher, show: has('ACCOUNTING.CREATE_VOUCHER') },
          { label: 'Receipt', onClick: onReceiptVoucher, show: has('ACCOUNTING.CREATE_VOUCHER') },
          { label: 'Contra', onClick: onContraVoucher, show: has('ACCOUNTING.CREATE_VOUCHER') },
          { label: 'Journal', onClick: onJournalVoucher, show: has('ACCOUNTING.CREATE_VOUCHER') },
        ],
      },
      {
        title: 'Accounting reports',
        icon: BookOpen,
        items: [
          { label: 'Chart of accounts', onClick: onChartOfAccounts, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Voucher register', onClick: onVoucherRegister, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Trial balance', onClick: onTrialBalance, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Profit & Loss', onClick: onProfitAndLoss, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Balance sheet', onClick: onBalanceSheet, show: has('ACCOUNTING.VIEW_REPORTS') },
        ],
      },
      {
        title: 'Customers & suppliers',
        icon: Users,
        items: [{ label: 'Customers & suppliers', onClick: onParties, show: has('SALES.MANAGE_PARTIES') || has('PURCHASE.VIEW_REPORTS') }],
      },
      {
        title: 'Sales',
        icon: ShoppingCart,
        items: [
          { label: 'New sales invoice', onClick: onNewSalesInvoice, show: has('SALES.CREATE_INVOICE') },
          { label: 'Sales invoice register', onClick: onSalesInvoiceRegister, show: has('SALES.CREATE_INVOICE') },
          { label: 'Customer receipt', onClick: onCustomerReceipt, show: has('SALES.CREATE_INVOICE') },
          { label: 'New sales order', onClick: onNewSalesOrder, show: has('SALES.CREATE_ORDER') },
          { label: 'Sales order register', onClick: onSalesOrderRegister, show: has('SALES.CREATE_ORDER') },
          { label: 'Receivables', onClick: onReceivables, show: canViewSalesReports },
        ],
      },
      {
        title: 'Purchase',
        icon: Truck,
        items: [
          { label: 'New purchase invoice', onClick: onNewPurchaseInvoice, show: has('PURCHASE.CREATE_INVOICE') },
          { label: 'Purchase invoice register', onClick: onPurchaseInvoiceRegister, show: has('PURCHASE.CREATE_INVOICE') },
          { label: 'Supplier payment', onClick: onSupplierPayment, show: has('PURCHASE.CREATE_INVOICE') },
          { label: 'New purchase order', onClick: onNewPurchaseOrder, show: has('PURCHASE.CREATE_ORDER') },
          { label: 'Purchase order register', onClick: onPurchaseOrderRegister, show: has('PURCHASE.CREATE_ORDER') },
          { label: 'Payables', onClick: onPayables, show: canViewPurchaseReports },
          { label: 'MSME ageing (43B(h))', onClick: onMsmeAgeing, show: canViewPurchaseReports },
        ],
      },
      {
        title: 'Inventory setup',
        icon: Package,
        items: [
          { label: 'Units of measure', onClick: onManageUnits, show: has('INVENTORY.MANAGE_UNITS') },
          { label: 'Warehouses', onClick: onManageWarehouses, show: has('INVENTORY.MANAGE_WAREHOUSES') },
          { label: 'Items', onClick: onManageItems, show: has('INVENTORY.MANAGE_ITEMS') },
        ],
      },
      {
        title: 'Stock operations',
        icon: ClipboardList,
        items: [
          { label: 'Record opening stock', onClick: onRecordOpeningStock, show: has('INVENTORY.RECORD_OPENING_STOCK') },
          { label: 'Stock adjustment', onClick: onStockAdjustment, show: has('INVENTORY.ADJUST_STOCK') },
          { label: 'Stock transfer', onClick: onStockTransfer, show: has('INVENTORY.TRANSFER_STOCK') },
        ],
      },
      {
        title: 'Stock reports',
        icon: BarChart3,
        items: [
          { label: 'Stock summary', onClick: onStockSummary, show: canViewInventoryReports },
          { label: 'Stock movement register', onClick: onStockMovementRegister, show: canViewInventoryReports },
          { label: 'Stock valuation vs. ledger', onClick: onStockValuationVsLedger, show: canViewInventoryReports },
        ],
      },
      {
        title: 'GST',
        icon: Percent,
        items: [
          { label: 'Manage GST rates', onClick: onManageGstRates, show: has('GST.MANAGE_RATES') },
          { label: 'GST summary', onClick: onGstSummary, show: has('GST.VIEW_REPORTS') },
          { label: 'GST returns (GSTR-1/3B/9/9C)', onClick: onGstReturns, show: has('GST.VIEW_REPORTS') },
        ],
      },
      {
        title: 'Banking',
        icon: Landmark,
        items: [
          { label: 'Bank accounts', onClick: onBankAccounts, show: has('BANKING.MANAGE_BANK_ACCOUNTS') },
          { label: 'Bank reconciliation', onClick: onBankReconciliation, show: has('BANKING.VIEW_REPORTS') },
          { label: 'Import bank statement', onClick: onBankStatementImport, show: has('BANKING.IMPORT_STATEMENT') },
          { label: 'Cheque register', onClick: onChequeRegister, show: has('BANKING.VIEW_REPORTS') },
        ],
      },
      {
        title: 'Expense & HR',
        icon: Wallet,
        items: [
          { label: 'Employees', onClick: onEmployees, show: has('EXPENSE.MANAGE_EMPLOYEES') },
          { label: 'New expense claim', onClick: onNewExpenseClaim, show: has('EXPENSE.CREATE_CLAIM') },
          { label: 'Expense claim register', onClick: onExpenseClaimRegister, show: has('EXPENSE.VIEW_REPORTS') },
          { label: 'Outstanding reimbursements', onClick: onOutstandingReimbursements, show: has('EXPENSE.VIEW_REPORTS') },
        ],
      },
      {
        title: 'Documents',
        icon: FileSearch,
        items: [{ label: 'Document search', onClick: onDocumentSearch, show: has('DOCUMENTS.VIEW') }],
      },
      {
        title: 'Payroll',
        icon: UserCog,
        items: [
          { label: 'Employee payroll profiles', onClick: onEmployeePayrollProfile, show: has('PAYROLL.MANAGE_EMPLOYEE_PROFILE') },
          { label: 'Salary components', onClick: onSalaryComponents, show: has('PAYROLL.MANAGE_SALARY_STRUCTURE') },
          { label: 'Salary structure (CTC)', onClick: onSalaryStructure, show: has('PAYROLL.MANAGE_SALARY_STRUCTURE') },
          { label: 'Payroll settings', onClick: onPayrollSettings, show: has('PAYROLL.MANAGE_RULES') },
          { label: 'Manage payroll rules', onClick: onManagePayrollRules, show: has('PAYROLL.MANAGE_RULES') },
          { label: 'Attendance', onClick: onAttendance, show: has('PAYROLL.MANAGE_ATTENDANCE') },
          { label: 'Leave', onClick: onLeave, show: has('PAYROLL.APPLY_LEAVE') || has('PAYROLL.APPROVE_LEAVE') },
          { label: 'Payroll runs', onClick: onPayrollRuns, show: has('PAYROLL.RUN_PAYROLL') || has('PAYROLL.VIEW_REPORTS') },
          { label: 'Gratuity', onClick: onGratuity, show: has('PAYROLL.MANAGE_GRATUITY') || has('PAYROLL.VIEW_REPORTS') },
        ],
      },
      {
        title: 'Cost centres & fixed assets',
        icon: PiggyBank,
        items: [
          { label: 'Cost centres', onClick: onCostCentres, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Budgets', onClick: onBudgets, show: has('ACCOUNTING.MANAGE_BUDGETS') },
          { label: 'Fixed asset classes', onClick: onAssetClasses, show: has('FIXED_ASSETS.MANAGE_ASSET_CLASSES') },
          { label: 'Fixed asset register', onClick: onFixedAssetRegister, show: has('FIXED_ASSETS.MANAGE_ASSETS') },
          { label: 'Run depreciation', onClick: onRunDepreciation, show: has('FIXED_ASSETS.RUN_DEPRECIATION') },
          { label: 'Manage fixed asset rates', onClick: onManageFixedAssetRates, show: has('FIXED_ASSETS.MANAGE_ASSET_CLASSES') },
        ],
      },
      {
        title: 'Branches & multi-currency',
        icon: GitBranch,
        items: [
          { label: 'Branches', onClick: onBranches, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Inter-branch transfer', onClick: onInterBranchTransfer, show: has('ACCOUNTING.MANAGE_BRANCHES') },
          { label: 'Branch-wise reports', onClick: onBranchReports, show: has('ACCOUNTING.VIEW_REPORTS') },
          { label: 'Manage exchange rates', onClick: onManageExchangeRates, show: has('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES') },
          { label: 'Run FX revaluation', onClick: onRunFxRevaluation, show: has('MULTI_CURRENCY.RUN_REVALUATION') },
        ],
      },
      {
        title: 'Manufacturing',
        icon: Factory,
        items: [
          { label: 'Bills of material', onClick: onBillsOfMaterial, show: has('MANUFACTURING.MANAGE_BOM') },
          { label: 'Manufacturing journal', onClick: onManufacturingJournal, show: has('MANUFACTURING.POST_JOURNAL') },
          { label: 'Manufacturing journal register', onClick: onManufacturingJournalRegister, show: has('MANUFACTURING.POST_JOURNAL') },
        ],
      },
      {
        title: 'Print',
        icon: Printer,
        items: [
          { label: 'Company letterhead', onClick: onCompanyLetterhead, show: has('PRINT.MANAGE_LETTERHEAD') },
          { label: 'Print Centre', onClick: onPrintCentre, show: has('PRINT.PRINT_DOCUMENTS') },
          { label: 'Template designer', onClick: onTemplateDesigner, show: has('PRINT.MANAGE_LETTERHEAD') },
        ],
      },
      {
        title: 'System',
        icon: Settings,
        items: [
          { label: 'Manage users', onClick: onManageUsers, show: has('SYSTEM.MANAGE_USERS') },
          { label: 'Manage roles', onClick: onManageRoles, show: has('SYSTEM.MANAGE_ROLES') },
          { label: 'Backup & restore', onClick: onBackup, show: has('SYSTEM.MANAGE_COMPANY') },
          { label: 'Verify audit trail', onClick: onVerifyAuditTrail, show: has('SYSTEM.VIEW_AUDIT_LOG') },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perms],
  );

  const visibleSections = sections.filter((section) => section.items.some((item) => item.show));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{session.companyName}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <ShieldCheck size={13} />
            {session.userName} ({session.email}) &middot; {session.roleName}
          </div>
        </div>
        <button onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <div style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
        {showKpiRow && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {canViewSalesReports && <KpiCard label="Total Sales" value={kpi.totalSales} loading={kpiLoading} icon={TrendingUp} tone="success" />}
            {canViewPurchaseReports && (
              <KpiCard label="Total Purchases" value={kpi.totalPurchases} loading={kpiLoading} icon={ShoppingCart} tone="accent" />
            )}
            {canViewSalesReports && (
              <KpiCard label="Receivables" value={kpi.receivables} loading={kpiLoading} icon={ArrowDownToLine} tone="success" />
            )}
            {canViewPurchaseReports && (
              <KpiCard label="Payables" value={kpi.payables} loading={kpiLoading} icon={ArrowUpFromLine} tone="warning" />
            )}
            {canViewInventoryReports && <KpiCard label="Stock Value" value={kpi.stockValue} loading={kpiLoading} icon={Boxes} tone="accent" />}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {visibleSections.map((section) => (
            <section
              key={section.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
                <section.icon size={17} style={{ color: 'var(--accent)' }} />
                {section.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {section.items
                  .filter((item) => item.show)
                  .map((item) => (
                    <button key={item.label} onClick={item.onClick}>
                      {item.label}
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
