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
          <button onClick={onSalesInvoiceRegister}>Sales invoice register</button>
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
          <button onClick={onPurchaseInvoiceRegister}>Purchase invoice register</button>
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
      <p>
        {session.permissions.includes('SYSTEM.MANAGE_USERS') && <button onClick={onManageUsers}>Manage users</button>}{' '}
        <button onClick={onLogout}>Sign out</button>
      </p>
    </div>
  );
}
