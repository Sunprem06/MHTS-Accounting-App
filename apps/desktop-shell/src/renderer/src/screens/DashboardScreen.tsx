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
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>{session.companyName}</h1>
      <p>
        Signed in as <strong>{session.userName}</strong> ({session.email})
      </p>
      <p>
        Role: <strong>{session.roleName}</strong>
      </p>
      <p>Permissions granted to this role:</p>
      <ul>
        {session.permissions.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      {session.permissions.includes('ACCOUNTING.CREATE_VOUCHER') && (
        <p>
          <button onClick={onPaymentVoucher}>Payment</button>{' '}
          <button onClick={onReceiptVoucher}>Receipt</button>{' '}
          <button onClick={onContraVoucher}>Contra</button>{' '}
          <button onClick={onJournalVoucher}>Journal</button>
        </p>
      )}
      {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && (
        <p>
          <button onClick={onChartOfAccounts}>Chart of accounts</button>{' '}
          <button onClick={onVoucherRegister}>Voucher register</button>{' '}
          <button onClick={onTrialBalance}>Trial balance</button>{' '}
          <button onClick={onProfitAndLoss}>Profit &amp; Loss</button>{' '}
          <button onClick={onBalanceSheet}>Balance sheet</button>
        </p>
      )}
      {(session.permissions.includes('SALES.MANAGE_PARTIES') || session.permissions.includes('PURCHASE.VIEW_REPORTS')) && (
        <p>
          <button onClick={onParties}>Customers &amp; suppliers</button>
        </p>
      )}
      {session.permissions.includes('SALES.CREATE_INVOICE') && (
        <p>
          <button onClick={onNewSalesInvoice}>New sales invoice</button>{' '}
          <button onClick={onSalesInvoiceRegister}>Sales invoice register</button>{' '}
          <button onClick={onCustomerReceipt}>Customer receipt</button>
        </p>
      )}
      {session.permissions.includes('SALES.CREATE_ORDER') && (
        <p>
          <button onClick={onNewSalesOrder}>New sales order</button>{' '}
          <button onClick={onSalesOrderRegister}>Sales order register</button>
        </p>
      )}
      {session.permissions.includes('PURCHASE.CREATE_INVOICE') && (
        <p>
          <button onClick={onNewPurchaseInvoice}>New purchase invoice</button>{' '}
          <button onClick={onPurchaseInvoiceRegister}>Purchase invoice register</button>{' '}
          <button onClick={onSupplierPayment}>Supplier payment</button>
        </p>
      )}
      {session.permissions.includes('PURCHASE.CREATE_ORDER') && (
        <p>
          <button onClick={onNewPurchaseOrder}>New purchase order</button>{' '}
          <button onClick={onPurchaseOrderRegister}>Purchase order register</button>
        </p>
      )}
      {session.permissions.includes('SALES.VIEW_REPORTS') && (
        <p>
          <button onClick={onReceivables}>Receivables</button>
        </p>
      )}
      {session.permissions.includes('PURCHASE.VIEW_REPORTS') && (
        <p>
          <button onClick={onPayables}>Payables</button>{' '}
          <button onClick={onMsmeAgeing}>MSME ageing (43B(h))</button>
        </p>
      )}
      {(session.permissions.includes('INVENTORY.MANAGE_ITEMS') ||
        session.permissions.includes('INVENTORY.MANAGE_WAREHOUSES') ||
        session.permissions.includes('INVENTORY.MANAGE_UNITS')) && (
        <p>
          {session.permissions.includes('INVENTORY.MANAGE_UNITS') && <button onClick={onManageUnits}>Units of measure</button>}{' '}
          {session.permissions.includes('INVENTORY.MANAGE_WAREHOUSES') && <button onClick={onManageWarehouses}>Warehouses</button>}{' '}
          {session.permissions.includes('INVENTORY.MANAGE_ITEMS') && <button onClick={onManageItems}>Items</button>}
        </p>
      )}
      {(session.permissions.includes('INVENTORY.RECORD_OPENING_STOCK') || session.permissions.includes('INVENTORY.ADJUST_STOCK') || session.permissions.includes('INVENTORY.TRANSFER_STOCK')) && (
        <p>
          {session.permissions.includes('INVENTORY.RECORD_OPENING_STOCK') && <button onClick={onRecordOpeningStock}>Record opening stock</button>}{' '}
          {session.permissions.includes('INVENTORY.ADJUST_STOCK') && <button onClick={onStockAdjustment}>Stock adjustment</button>}{' '}
          {session.permissions.includes('INVENTORY.TRANSFER_STOCK') && <button onClick={onStockTransfer}>Stock transfer</button>}
        </p>
      )}
      {session.permissions.includes('INVENTORY.VIEW_REPORTS') && (
        <p>
          <button onClick={onStockSummary}>Stock summary</button>{' '}
          <button onClick={onStockMovementRegister}>Stock movement register</button>{' '}
          <button onClick={onStockValuationVsLedger}>Stock valuation vs. ledger</button>
        </p>
      )}
      {(session.permissions.includes('GST.MANAGE_RATES') || session.permissions.includes('GST.VIEW_REPORTS')) && (
        <p>
          {session.permissions.includes('GST.MANAGE_RATES') && <button onClick={onManageGstRates}>Manage GST rates</button>}{' '}
          {session.permissions.includes('GST.VIEW_REPORTS') && <button onClick={onGstSummary}>GST summary</button>}{' '}
          {session.permissions.includes('GST.VIEW_REPORTS') && <button onClick={onGstReturns}>GST returns (GSTR-1/3B/9/9C)</button>}
        </p>
      )}
      {(session.permissions.includes('BANKING.MANAGE_BANK_ACCOUNTS') ||
        session.permissions.includes('BANKING.VIEW_REPORTS') ||
        session.permissions.includes('BANKING.IMPORT_STATEMENT')) && (
        <p>
          {session.permissions.includes('BANKING.MANAGE_BANK_ACCOUNTS') && <button onClick={onBankAccounts}>Bank accounts</button>}{' '}
          {session.permissions.includes('BANKING.VIEW_REPORTS') && <button onClick={onBankReconciliation}>Bank reconciliation</button>}{' '}
          {session.permissions.includes('BANKING.IMPORT_STATEMENT') && <button onClick={onBankStatementImport}>Import bank statement</button>}{' '}
          {session.permissions.includes('BANKING.VIEW_REPORTS') && <button onClick={onChequeRegister}>Cheque register</button>}
        </p>
      )}
      {(session.permissions.includes('EXPENSE.MANAGE_EMPLOYEES') ||
        session.permissions.includes('EXPENSE.CREATE_CLAIM') ||
        session.permissions.includes('EXPENSE.VIEW_REPORTS')) && (
        <p>
          {session.permissions.includes('EXPENSE.MANAGE_EMPLOYEES') && <button onClick={onEmployees}>Employees</button>}{' '}
          {session.permissions.includes('EXPENSE.CREATE_CLAIM') && <button onClick={onNewExpenseClaim}>New expense claim</button>}{' '}
          {session.permissions.includes('EXPENSE.VIEW_REPORTS') && <button onClick={onExpenseClaimRegister}>Expense claim register</button>}{' '}
          {session.permissions.includes('EXPENSE.VIEW_REPORTS') && <button onClick={onOutstandingReimbursements}>Outstanding reimbursements</button>}
        </p>
      )}
      {session.permissions.includes('DOCUMENTS.VIEW') && (
        <p>
          <button onClick={onDocumentSearch}>Document search</button>
        </p>
      )}
      {(session.permissions.includes('PAYROLL.MANAGE_EMPLOYEE_PROFILE') ||
        session.permissions.includes('PAYROLL.MANAGE_SALARY_STRUCTURE') ||
        session.permissions.includes('PAYROLL.MANAGE_RULES') ||
        session.permissions.includes('PAYROLL.MANAGE_ATTENDANCE') ||
        session.permissions.includes('PAYROLL.APPLY_LEAVE') ||
        session.permissions.includes('PAYROLL.RUN_PAYROLL') ||
        session.permissions.includes('PAYROLL.MANAGE_GRATUITY') ||
        session.permissions.includes('PAYROLL.VIEW_REPORTS')) && (
        <p>
          {session.permissions.includes('PAYROLL.MANAGE_EMPLOYEE_PROFILE') && <button onClick={onEmployeePayrollProfile}>Employee payroll profiles</button>}{' '}
          {session.permissions.includes('PAYROLL.MANAGE_SALARY_STRUCTURE') && <button onClick={onSalaryComponents}>Salary components</button>}{' '}
          {session.permissions.includes('PAYROLL.MANAGE_SALARY_STRUCTURE') && <button onClick={onSalaryStructure}>Salary structure (CTC)</button>}{' '}
          {session.permissions.includes('PAYROLL.MANAGE_RULES') && <button onClick={onPayrollSettings}>Payroll settings</button>}{' '}
          {session.permissions.includes('PAYROLL.MANAGE_RULES') && <button onClick={onManagePayrollRules}>Manage payroll rules</button>}{' '}
          {session.permissions.includes('PAYROLL.MANAGE_ATTENDANCE') && <button onClick={onAttendance}>Attendance</button>}{' '}
          {(session.permissions.includes('PAYROLL.APPLY_LEAVE') || session.permissions.includes('PAYROLL.APPROVE_LEAVE')) && <button onClick={onLeave}>Leave</button>}{' '}
          {(session.permissions.includes('PAYROLL.RUN_PAYROLL') || session.permissions.includes('PAYROLL.VIEW_REPORTS')) && <button onClick={onPayrollRuns}>Payroll runs</button>}{' '}
          {(session.permissions.includes('PAYROLL.MANAGE_GRATUITY') || session.permissions.includes('PAYROLL.VIEW_REPORTS')) && <button onClick={onGratuity}>Gratuity</button>}
        </p>
      )}
      {(session.permissions.includes('ACCOUNTING.MANAGE_COST_CENTRES') ||
        session.permissions.includes('ACCOUNTING.VIEW_REPORTS') ||
        session.permissions.includes('ACCOUNTING.MANAGE_BUDGETS') ||
        session.permissions.includes('FIXED_ASSETS.MANAGE_ASSET_CLASSES') ||
        session.permissions.includes('FIXED_ASSETS.MANAGE_ASSETS') ||
        session.permissions.includes('FIXED_ASSETS.RUN_DEPRECIATION')) && (
        <p>
          {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && <button onClick={onCostCentres}>Cost centres</button>}{' '}
          {session.permissions.includes('ACCOUNTING.MANAGE_BUDGETS') && <button onClick={onBudgets}>Budgets</button>}{' '}
          {session.permissions.includes('FIXED_ASSETS.MANAGE_ASSET_CLASSES') && <button onClick={onAssetClasses}>Fixed asset classes</button>}{' '}
          {session.permissions.includes('FIXED_ASSETS.MANAGE_ASSETS') && <button onClick={onFixedAssetRegister}>Fixed asset register</button>}{' '}
          {session.permissions.includes('FIXED_ASSETS.RUN_DEPRECIATION') && <button onClick={onRunDepreciation}>Run depreciation</button>}{' '}
          {session.permissions.includes('FIXED_ASSETS.MANAGE_ASSET_CLASSES') && <button onClick={onManageFixedAssetRates}>Manage fixed asset rates</button>}
        </p>
      )}
      {(session.permissions.includes('ACCOUNTING.MANAGE_BRANCHES') ||
        session.permissions.includes('ACCOUNTING.VIEW_REPORTS') ||
        session.permissions.includes('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES') ||
        session.permissions.includes('MULTI_CURRENCY.RUN_REVALUATION')) && (
        <p>
          {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && <button onClick={onBranches}>Branches</button>}{' '}
          {session.permissions.includes('ACCOUNTING.MANAGE_BRANCHES') && <button onClick={onInterBranchTransfer}>Inter-branch transfer</button>}{' '}
          {session.permissions.includes('ACCOUNTING.VIEW_REPORTS') && <button onClick={onBranchReports}>Branch-wise reports</button>}{' '}
          {session.permissions.includes('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES') && <button onClick={onManageExchangeRates}>Manage exchange rates</button>}{' '}
          {session.permissions.includes('MULTI_CURRENCY.RUN_REVALUATION') && <button onClick={onRunFxRevaluation}>Run FX revaluation</button>}
        </p>
      )}
      {(session.permissions.includes('MANUFACTURING.MANAGE_BOM') || session.permissions.includes('MANUFACTURING.POST_JOURNAL')) && (
        <p>
          {session.permissions.includes('MANUFACTURING.MANAGE_BOM') && <button onClick={onBillsOfMaterial}>Bills of material</button>}{' '}
          {session.permissions.includes('MANUFACTURING.POST_JOURNAL') && <button onClick={onManufacturingJournal}>Manufacturing journal</button>}{' '}
          {session.permissions.includes('MANUFACTURING.POST_JOURNAL') && <button onClick={onManufacturingJournalRegister}>Manufacturing journal register</button>}
        </p>
      )}
      {(session.permissions.includes('PRINT.MANAGE_LETTERHEAD') || session.permissions.includes('PRINT.PRINT_DOCUMENTS')) && (
        <p>
          {session.permissions.includes('PRINT.MANAGE_LETTERHEAD') && <button onClick={onCompanyLetterhead}>Company letterhead</button>}{' '}
          {session.permissions.includes('PRINT.PRINT_DOCUMENTS') && <button onClick={onPrintCentre}>Print Centre</button>}{' '}
          {session.permissions.includes('PRINT.MANAGE_LETTERHEAD') && <button onClick={onTemplateDesigner}>Template designer</button>}
        </p>
      )}
      <p>
        {session.permissions.includes('SYSTEM.MANAGE_USERS') && <button onClick={onManageUsers}>Manage users</button>}{' '}
        {session.permissions.includes('SYSTEM.MANAGE_ROLES') && <button onClick={onManageRoles}>Manage roles</button>}{' '}
        {session.permissions.includes('SYSTEM.MANAGE_COMPANY') && <button onClick={onBackup}>Backup &amp; restore</button>}{' '}
        <button onClick={onLogout}>Sign out</button>
      </p>
    </div>
  );
}
