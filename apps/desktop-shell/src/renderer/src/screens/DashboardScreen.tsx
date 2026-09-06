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
          {session.permissions.includes('GST.VIEW_REPORTS') && <button onClick={onGstSummary}>GST summary</button>}
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
