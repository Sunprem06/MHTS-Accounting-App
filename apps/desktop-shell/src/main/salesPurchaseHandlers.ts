import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import {
  createParty as coreCreateParty,
  listParties as coreListParties,
  createSalesInvoice as coreCreateSalesInvoice,
  listSalesInvoices as coreListSalesInvoices,
  cancelSalesInvoice as coreCancelSalesInvoice,
  createPurchaseInvoice as coreCreatePurchaseInvoice,
  listPurchaseInvoices as coreListPurchaseInvoices,
  cancelPurchaseInvoice as coreCancelPurchaseInvoice,
  createSalesOrder as coreCreateSalesOrder,
  listSalesOrders as coreListSalesOrders,
  confirmSalesOrder as coreConfirmSalesOrder,
  cancelSalesOrder as coreCancelSalesOrder,
  convertSalesOrderToInvoice as coreConvertSalesOrderToInvoice,
  createPurchaseOrder as coreCreatePurchaseOrder,
  listPurchaseOrders as coreListPurchaseOrders,
  confirmPurchaseOrder as coreConfirmPurchaseOrder,
  cancelPurchaseOrder as coreCancelPurchaseOrder,
  convertPurchaseOrderToInvoice as coreConvertPurchaseOrderToInvoice,
  listReceivables as coreListReceivables,
  listPayables as coreListPayables,
  listMsmeAgeing as coreListMsmeAgeing,
  listOutstandingSalesInvoices as coreListOutstandingSalesInvoices,
  listOutstandingPurchaseInvoices as coreListOutstandingPurchaseInvoices,
  recordSalesReceipt as coreRecordSalesReceipt,
  recordPurchasePayment as coreRecordPurchasePayment,
} from '@mhts/core-sales-purchase';
import type { DocumentLineInput as CoreDocumentLineInput } from '@mhts/core-sales-purchase';
import type { GstRegistrationType } from '@mhts/core-gst-engine';
import { session } from './session';
import type {
  CreatePartyInput,
  CreatePurchaseInvoiceInput,
  CreatePurchaseOrderInput,
  CreateSalesInvoiceInput,
  CreateSalesOrderInput,
  DocumentLineInput,
  InvoiceSummary,
  MsmeAgeingRow,
  OrderSummary,
  OutstandingInvoiceRow,
  PartyOutstandingRow,
  PartySummary,
  PurchaseInvoiceSummary,
  RecordPurchasePaymentInput,
  RecordSalesReceiptInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const THOUSANDTHS_PER_UNIT = 1000;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
const unitsToThousandths = (units: number): number => Math.round(units * THOUSANDTHS_PER_UNIT);

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

async function financialYearFor(systemDb: Kysely<SystemDatabase>, companyId: string, date: string): Promise<string> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return computeFinancialYearLabel(company.financial_year_start_month, new Date(date));
}

/** Phase 4 (GST) — the company's own state_code, used to decide intra- vs inter-state place of supply. Resolved here (not inside core-sales-purchase) same as financialYearFor, since it's a system-DB lookup by companyId. */
async function companyStateCodeFor(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<string | null> {
  const company = await systemDb.selectFrom('company').select('state_code').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.state_code;
}

/** Phase 4 increment 2 (composition scheme) — see companyStateCodeFor's identical reasoning. */
async function companyGstRegistrationTypeFor(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<GstRegistrationType> {
  const company = await systemDb.selectFrom('company').select('gst_registration_type').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.gst_registration_type as GstRegistrationType;
}

function toCoreLines(lines: DocumentLineInput[]): CoreDocumentLineInput[] {
  return lines.map((line) => ({
    description: line.description,
    ledgerId: line.ledgerId,
    amount: rupeesToPaise(line.amountRupees),
    taxLedgerId: line.taxLedgerId,
    taxAmount: line.taxAmountRupees !== undefined ? rupeesToPaise(line.taxAmountRupees) : undefined,
    hsnSacCode: line.hsnSacCode,
    itcEligible: line.itcEligible,
    itcIneligibilityReason: line.itcIneligibilityReason,
    isReverseCharge: line.isReverseCharge,
    lineNarration: line.lineNarration,
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    quantityThousandths: line.quantityUnits !== undefined ? unitsToThousandths(line.quantityUnits) : undefined,
    ratePaise: line.ratePerUnitRupees !== undefined ? rupeesToPaise(line.ratePerUnitRupees) : undefined,
    batchId: line.batchId,
    batchNumber: line.batchNumber,
    expiryDate: line.expiryDate,
    manufactureDate: line.manufactureDate,
    foreignAmount: line.foreignAmountUnits !== undefined ? rupeesToPaise(line.foreignAmountUnits) : undefined,
  }));
}

export async function createParty(input: CreatePartyInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.MANAGE_PARTIES');
  return coreCreateParty(
    companyDb,
    {
      partyType: input.partyType,
      name: input.name,
      gstin: input.gstin,
      stateCode: input.stateCode,
      isMsmeUdyamRegistered: input.isMsmeUdyamRegistered,
      udyamRegistrationNumber: input.udyamRegistrationNumber,
      creditPeriodDays: input.creditPeriodDays,
    },
    info.userId,
  );
}

export async function listParties(): Promise<PartySummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('SALES.MANAGE_PARTIES');
  return coreListParties(companyDb);
}

function invoiceToRupees<T extends { taxableAmount: number; taxAmount: number; totalAmount: number }>(invoice: T): T {
  return { ...invoice, taxableAmount: paiseToRupees(invoice.taxableAmount), taxAmount: paiseToRupees(invoice.taxAmount), totalAmount: paiseToRupees(invoice.totalAmount) };
}

export async function createSalesInvoice(systemDb: Kysely<SystemDatabase>, input: CreateSalesInvoiceInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_INVOICE');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.invoiceDate);
  const companyStateCode = await companyStateCodeFor(systemDb, info.companyId);
  const companyGstRegistrationType = await companyGstRegistrationTypeFor(systemDb, info.companyId);
  return coreCreateSalesInvoice(
    companyDb,
    systemDb,
    {
      partyId: input.partyId,
      financialYear,
      invoiceDate: input.invoiceDate,
      narration: input.narration,
      companyStateCode,
      companyGstRegistrationType,
      currency: input.currency,
      exchangeRateMicros: input.exchangeRate !== undefined ? Math.round(input.exchangeRate * 1_000_000) : undefined,
      branchId: input.branchId,
      lines: toCoreLines(input.lines),
    },
    info.userId,
  );
}

export async function listSalesInvoices(): Promise<InvoiceSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('SALES.VIEW_REPORTS');
  const invoices = await coreListSalesInvoices(companyDb);
  return invoices.map(invoiceToRupees);
}

export async function cancelSalesInvoice(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_INVOICE');
  const reversalDate = new Date().toISOString().slice(0, 10);
  const reversalFinancialYear = await financialYearFor(systemDb, info.companyId, reversalDate);
  return coreCancelSalesInvoice(companyDb, voucherId, reversalFinancialYear, reversalDate, info.userId);
}

export async function createPurchaseInvoice(systemDb: Kysely<SystemDatabase>, input: CreatePurchaseInvoiceInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_INVOICE');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.invoiceDate);
  const companyStateCode = await companyStateCodeFor(systemDb, info.companyId);
  const companyGstRegistrationType = await companyGstRegistrationTypeFor(systemDb, info.companyId);
  return coreCreatePurchaseInvoice(
    companyDb,
    systemDb,
    {
      partyId: input.partyId,
      financialYear,
      invoiceDate: input.invoiceDate,
      narration: input.narration,
      tdsSection: input.tdsSection,
      companyStateCode,
      companyGstRegistrationType,
      currency: input.currency,
      exchangeRateMicros: input.exchangeRate !== undefined ? Math.round(input.exchangeRate * 1_000_000) : undefined,
      branchId: input.branchId,
      lines: toCoreLines(input.lines),
    },
    info.userId,
  );
}

export async function listPurchaseInvoices(): Promise<PurchaseInvoiceSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PURCHASE.VIEW_REPORTS');
  const invoices = await coreListPurchaseInvoices(companyDb);
  return invoices.map((invoice) => ({ ...invoiceToRupees(invoice), tdsAmount: paiseToRupees(invoice.tdsAmount), netPayable: paiseToRupees(invoice.netPayable) }));
}

export async function cancelPurchaseInvoice(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_INVOICE');
  const reversalDate = new Date().toISOString().slice(0, 10);
  const reversalFinancialYear = await financialYearFor(systemDb, info.companyId, reversalDate);
  return coreCancelPurchaseInvoice(companyDb, voucherId, reversalFinancialYear, reversalDate, info.userId);
}

function orderToRupees(order: OrderSummary): OrderSummary {
  return { ...order, taxableAmount: paiseToRupees(order.taxableAmount), taxAmount: paiseToRupees(order.taxAmount), totalAmount: paiseToRupees(order.totalAmount) };
}

export async function createSalesOrder(systemDb: Kysely<SystemDatabase>, input: CreateSalesOrderInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_ORDER');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.orderDate);
  return coreCreateSalesOrder(companyDb, { partyId: input.partyId, financialYear, orderDate: input.orderDate, narration: input.narration, lines: toCoreLines(input.lines) }, info.userId);
}

export async function listSalesOrders(): Promise<OrderSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('SALES.VIEW_REPORTS');
  const orders = await coreListSalesOrders(companyDb);
  return orders.map(orderToRupees);
}

export async function confirmSalesOrder(orderId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_ORDER');
  return coreConfirmSalesOrder(companyDb, orderId, info.userId);
}

export async function cancelSalesOrder(orderId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_ORDER');
  return coreCancelSalesOrder(companyDb, orderId, info.userId);
}

export async function convertSalesOrder(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_ORDER');
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const financialYear = await financialYearFor(systemDb, info.companyId, invoiceDate);
  const companyStateCode = await companyStateCodeFor(systemDb, info.companyId);
  const companyGstRegistrationType = await companyGstRegistrationTypeFor(systemDb, info.companyId);
  return coreConvertSalesOrderToInvoice(companyDb, systemDb, orderId, invoiceDate, financialYear, companyStateCode, companyGstRegistrationType, info.userId);
}

export async function createPurchaseOrder(systemDb: Kysely<SystemDatabase>, input: CreatePurchaseOrderInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_ORDER');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.orderDate);
  return coreCreatePurchaseOrder(
    companyDb,
    { partyId: input.partyId, financialYear, orderDate: input.orderDate, narration: input.narration, tdsSection: input.tdsSection, lines: toCoreLines(input.lines) },
    info.userId,
  );
}

export async function listPurchaseOrders(): Promise<OrderSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PURCHASE.VIEW_REPORTS');
  const orders = await coreListPurchaseOrders(companyDb);
  return orders.map(orderToRupees);
}

export async function confirmPurchaseOrder(orderId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_ORDER');
  return coreConfirmPurchaseOrder(companyDb, orderId, info.userId);
}

export async function cancelPurchaseOrder(orderId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_ORDER');
  return coreCancelPurchaseOrder(companyDb, orderId, info.userId);
}

export async function convertPurchaseOrder(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_ORDER');
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const financialYear = await financialYearFor(systemDb, info.companyId, invoiceDate);
  const companyStateCode = await companyStateCodeFor(systemDb, info.companyId);
  const companyGstRegistrationType = await companyGstRegistrationTypeFor(systemDb, info.companyId);
  return coreConvertPurchaseOrderToInvoice(companyDb, systemDb, orderId, invoiceDate, financialYear, companyStateCode, companyGstRegistrationType, info.userId);
}

export async function listReceivables(): Promise<PartyOutstandingRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('SALES.VIEW_REPORTS');
  const rows = await coreListReceivables(companyDb);
  return rows.map((row) => ({ ...row, outstandingAmount: paiseToRupees(row.outstandingAmount) }));
}

export async function listPayables(): Promise<PartyOutstandingRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('PURCHASE.VIEW_REPORTS');
  const rows = await coreListPayables(companyDb);
  return rows.map((row) => ({ ...row, outstandingAmount: paiseToRupees(row.outstandingAmount) }));
}

export async function listMsmeAgeing(asOfDate: string): Promise<MsmeAgeingRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('PURCHASE.VIEW_REPORTS');
  const rows = await coreListMsmeAgeing(companyDb, asOfDate);
  return rows.map((row) => ({ ...row, estimatedOutstanding: paiseToRupees(row.estimatedOutstanding) }));
}

function outstandingInvoiceToRupees(row: Awaited<ReturnType<typeof coreListOutstandingSalesInvoices>>[number]): OutstandingInvoiceRow {
  return {
    invoiceId: row.invoiceId,
    voucherId: row.voucherId,
    voucherNumber: row.voucherNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    partyId: row.partyId,
    partyName: row.partyName,
    netAmount: paiseToRupees(row.netAmount),
    settledAmount: paiseToRupees(row.settledAmount),
    outstandingAmount: paiseToRupees(row.outstandingAmount),
    currency: row.currency,
    exchangeRate: row.exchangeRateMicros !== null ? row.exchangeRateMicros / 1_000_000 : null,
    outstandingForeignAmountUnits: row.outstandingForeignAmount !== null ? paiseToRupees(row.outstandingForeignAmount) : null,
  };
}

export async function listOutstandingSalesInvoices(partyId: string): Promise<OutstandingInvoiceRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('SALES.CREATE_INVOICE');
  const rows = await coreListOutstandingSalesInvoices(companyDb, partyId);
  return rows.map(outstandingInvoiceToRupees);
}

export async function listOutstandingPurchaseInvoices(partyId: string): Promise<OutstandingInvoiceRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_INVOICE');
  const rows = await coreListOutstandingPurchaseInvoices(companyDb, partyId);
  return rows.map(outstandingInvoiceToRupees);
}

export async function recordSalesReceipt(systemDb: Kysely<SystemDatabase>, input: RecordSalesReceiptInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('SALES.CREATE_INVOICE');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.receiptDate);
  return coreRecordSalesReceipt(
    companyDb,
    {
      partyId: input.partyId,
      depositLedgerId: input.depositLedgerId,
      receiptDate: input.receiptDate,
      financialYear,
      narration: input.narration,
      settlements: input.settlements.map((s) => ({
        invoiceId: s.invoiceId,
        amount: rupeesToPaise(s.amountRupees),
        foreignAmount: s.foreignAmountUnits !== undefined ? rupeesToPaise(s.foreignAmountUnits) : undefined,
        settlementExchangeRateMicros: s.settlementExchangeRate !== undefined ? Math.round(s.settlementExchangeRate * 1_000_000) : undefined,
      })),
    },
    info.userId,
  );
}

export async function recordPurchasePayment(systemDb: Kysely<SystemDatabase>, input: RecordPurchasePaymentInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PURCHASE.CREATE_INVOICE');
  const financialYear = await financialYearFor(systemDb, info.companyId, input.paymentDate);
  return coreRecordPurchasePayment(
    companyDb,
    {
      partyId: input.partyId,
      paymentLedgerId: input.paymentLedgerId,
      paymentDate: input.paymentDate,
      financialYear,
      narration: input.narration,
      settlements: input.settlements.map((s) => ({
        invoiceId: s.invoiceId,
        amount: rupeesToPaise(s.amountRupees),
        foreignAmount: s.foreignAmountUnits !== undefined ? rupeesToPaise(s.foreignAmountUnits) : undefined,
        settlementExchangeRateMicros: s.settlementExchangeRate !== undefined ? Math.round(s.settlementExchangeRate * 1_000_000) : undefined,
      })),
    },
    info.userId,
  );
}
