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
  InvoiceForPrint,
  InvoiceForPrintLine,
  PurchaseInvoiceSummary,
  PurchaseInvoiceForPrint,
  PurchaseInvoiceForPrintLine,
  CreateSalesOrderInput,
  CreatePurchaseOrderInput,
  OrderSummary,
  OrderForPrint,
  OrderForPrintLine,
  PartyOutstandingRow,
  MsmeAgeingRow,
} from './types';

export { SALES_PURCHASE_PERMISSIONS, grantSalesPurchasePermissions, seedSalesPurchaseLedgers, createParty, listParties, updateBusinessPartyAddress } from './parties';

export { seedDefaultTdsRates, resolveTdsRate, computeTdsAmount, cumulativeTaxableThisFinancialYear } from './tds';

export { createSalesInvoice, listSalesInvoices, cancelSalesInvoice, getSalesInvoiceForPrint } from './salesInvoices';
export { createPurchaseInvoice, listPurchaseInvoices, computeDueDate, cancelPurchaseInvoice, getPurchaseInvoiceForPrint } from './purchaseInvoices';

export { createSalesOrder, listSalesOrders, confirmSalesOrder, cancelSalesOrder, convertSalesOrderToInvoice, getSalesOrderForPrint } from './salesOrders';
export { createPurchaseOrder, listPurchaseOrders, confirmPurchaseOrder, cancelPurchaseOrder, convertPurchaseOrderToInvoice, getPurchaseOrderForPrint } from './purchaseOrders';

export { listReceivables, listPayables, listMsmeAgeing } from './receivablesPayables';

export { listOutstandingSalesInvoices, listOutstandingPurchaseInvoices, recordSalesReceipt, recordPurchasePayment } from './settlements';
export type { OutstandingInvoiceRow, SettlementLineInput, RecordSalesReceiptInput, RecordPurchasePaymentInput } from './settlements';

export { computeGstr1Data, computeGstr3bData, computeGstr9Data, computeGstr9cData } from './gstReturns';
export type { DateRange, Gstr1B2bInvoiceRow, Gstr1B2cSummaryRow, Gstr1HsnSummaryRow, Gstr1Data, Gstr3bData, Gstr9Data, Gstr9cData } from './gstReturns';
