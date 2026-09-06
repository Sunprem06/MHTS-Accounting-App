// Phase 2 (Sales + Purchase): customers/suppliers, sales & purchase orders and
// invoices posted through the unchanged Phase 1 double-entry engine, vendor
// TDS (rate resolved from the versioned rule_set table, never hardcoded —
// CLAUDE.md Rule #2), and Section 43B(h) MSME ageing. Pure TypeScript, zero
// Electron/UI dependency (Rule #1).
export { PARTY_TYPES, ORDER_STATUSES, TDS_SECTIONS } from './types';
export type {
  PartyType,
  OrderStatus,
  TdsSectionCode,
  TdsRatePayload,
  BusinessPartySummary,
  CreatePartyInput,
  DocumentLineInput,
  CreateSalesInvoiceInput,
  CreatePurchaseInvoiceInput,
  InvoiceSummary,
  PurchaseInvoiceSummary,
  CreateSalesOrderInput,
  CreatePurchaseOrderInput,
  OrderSummary,
  PartyOutstandingRow,
  MsmeAgeingRow,
} from './types';

export { SALES_PURCHASE_PERMISSIONS, grantSalesPurchasePermissions, seedSalesPurchaseLedgers, createParty, listParties } from './parties';

export { seedDefaultTdsRates, resolveTdsRate, computeTdsAmount, cumulativeTaxableThisFinancialYear } from './tds';

export { createSalesInvoice, listSalesInvoices, cancelSalesInvoice } from './salesInvoices';
export { createPurchaseInvoice, listPurchaseInvoices, computeDueDate, cancelPurchaseInvoice } from './purchaseInvoices';

export { createSalesOrder, listSalesOrders, confirmSalesOrder, cancelSalesOrder, convertSalesOrderToInvoice } from './salesOrders';
export { createPurchaseOrder, listPurchaseOrders, confirmPurchaseOrder, cancelPurchaseOrder, convertPurchaseOrderToInvoice } from './purchaseOrders';

export { listReceivables, listPayables, listMsmeAgeing } from './receivablesPayables';

export { listOutstandingSalesInvoices, listOutstandingPurchaseInvoices, recordSalesReceipt, recordPurchasePayment } from './settlements';
export type { OutstandingInvoiceRow, SettlementLineInput, RecordSalesReceiptInput, RecordPurchasePaymentInput } from './settlements';
