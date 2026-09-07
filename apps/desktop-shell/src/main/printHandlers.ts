import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import {
  getCompanyLetterheadProfile as coreGetCompanyLetterheadProfile,
  getCompanyLogo,
  updateCompanyLetterheadProfile as coreUpdateCompanyLetterheadProfile,
  setCompanyLogo,
  clearCompanyLogo as coreClearCompanyLogo,
} from '@mhts/core-company-profile';
import { getSalesInvoiceForPrint, getPurchaseInvoiceForPrint, getSalesOrderForPrint, getPurchaseOrderForPrint, listSalesInvoices, listPurchaseInvoices, listSalesOrders, listPurchaseOrders } from '@mhts/core-sales-purchase';
import { getVoucherForPrint, listVouchers } from '@mhts/core-accounting';
import { getExpenseClaimForPrint, listExpenseClaims } from '@mhts/core-expense';
import { getPayslipForPrint, listPayslipsForPrint as corePayrollListPayslipsForPrint } from '@mhts/core-payroll-engine';
import { saveTemplateLayoutVersion, getActiveTemplateLayout, listTemplateLayoutVersions as coreListTemplateLayoutVersions, revertTemplateLayout as coreRevertTemplateLayout } from '@mhts/core-print-templates';
import type { PrintTemplateLayoutSummary as CorePrintTemplateLayoutSummary, TemplateFamily } from '@mhts/core-print-templates';
import { renderSalesInvoiceHtml, renderPurchaseInvoiceHtml, renderOrderHtml, renderVoucherHtml, renderExpenseClaimHtml, renderPayslipHtml, renderCustomLayoutHtml, TEMPLATE_FIELD_CATALOG } from '@mhts/print-templates';
import type {
  DocumentLayout,
  InvoiceTemplateData,
  PurchaseInvoiceTemplateData,
  OrderTemplateData,
  VoucherTemplateData,
  ExpenseClaimTemplateData,
  LetterheadForPrint,
  PayslipTemplateData,
  PrintableVoucherType,
  TemplateLayoutDocument,
} from '@mhts/print-templates';
import { session } from './session';
import type {
  CompanyLetterheadProfile,
  PayslipPrintListItem,
  PickedLogoFile,
  PrintDocumentResult,
  PrintTemplateLayoutSummary,
  SaveTemplateLayoutInput,
  TemplateFieldCatalogEntry,
  TemplatePreviewData,
  UpdateCompanyLetterheadProfileInput,
  UploadCompanyLogoInput,
} from '../shared/ipc';

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

const LOGO_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export async function getCompanyLetterheadProfile(): Promise<CompanyLetterheadProfile> {
  const { companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  return coreGetCompanyLetterheadProfile(companyDb);
}

export async function updateCompanyLetterheadProfile(input: UpdateCompanyLetterheadProfileInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  await coreUpdateCompanyLetterheadProfile(companyDb, input, info.userId);
}

/** Native open-file dialog restricted to image extensions — the user's own click IS the consent for which file gets read, same reasoning as documentHandlers.ts's pickAttachmentFile. */
export async function pickLogoFile(): Promise<PickedLogoFile | null> {
  requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const imageFilters = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }];
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'], filters: imageFilters })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: imageFilters });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = basename(filePath);
  const mimeType = LOGO_MIME_TYPES_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream';
  const fileDataBase64 = readFileSync(filePath).toString('base64');
  return { fileName, mimeType, fileDataBase64 };
}

export async function uploadCompanyLogo(input: UploadCompanyLogoInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  await setCompanyLogo(companyDb, Buffer.from(input.fileDataBase64, 'base64'), input.mimeType, info.userId);
}

export async function clearCompanyLogo(): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  await coreClearCompanyLogo(companyDb, info.userId);
}

/** Company-identity fields (legal name/GSTIN/PAN/state) live in the system DB's `company` registry (see companyStateCodeFor in salesPurchaseHandlers.ts for the identical lookup pattern); presentation-only fields (address/logo/bank/footer/layout) live in the company DB's letterhead profile. A printed document needs both. */
async function letterheadForPrint(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string): Promise<LetterheadForPrint> {
  const company = await systemDb.selectFrom('company').select(['legal_name', 'trade_name', 'gstin', 'pan', 'state_code']).where('id', '=', companyId).executeTakeFirstOrThrow();
  const [profile, logo] = await Promise.all([coreGetCompanyLetterheadProfile(companyDb), getCompanyLogo(companyDb)]);
  return {
    companyName: company.trade_name || company.legal_name,
    gstin: company.gstin,
    pan: company.pan,
    stateCode: company.state_code,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    bankAccountName: profile.bankAccountName,
    bankAccountNumber: profile.bankAccountNumber,
    bankIfsc: profile.bankIfsc,
    bankName: profile.bankName,
    bankBranch: profile.bankBranch,
    footerNote: profile.footerNote,
    logoDataUrl: logo ? `data:${logo.mimeType};base64,${logo.data.toString('base64')}` : null,
    accentColorHex: profile.accentColorHex,
  };
}

/**
 * Phase 9 Increment 3 (Print + Templates) — every document family checks
 * for an active drag-and-drop-designed layout before falling back to its
 * own fixed CLASSIC/MODERN builder. `data` is passed through untyped to
 * renderCustomLayoutHtml on purpose — a saved TemplateLayoutDocument can
 * reference any field templateFieldCatalog.ts exposed at design time across
 * 6 structurally different *TemplateData shapes, so there is no single TS
 * interface to type this interpreter boundary against.
 */
async function renderWithOptionalCustomLayout(companyDb: Kysely<CompanyDatabase>, family: TemplateFamily, data: unknown, title: string, renderDefault: () => string): Promise<string> {
  const custom = await getActiveTemplateLayout(companyDb, family);
  if (custom) {
    return renderCustomLayoutHtml(data, custom.layout as TemplateLayoutDocument, title);
  }
  return renderDefault();
}

async function buildSalesInvoiceHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, invoiceId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, invoice] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getSalesInvoiceForPrint(companyDb, invoiceId),
  ]);

  const data: InvoiceTemplateData = {
    letterhead,
    voucherNumber: invoice.voucherNumber,
    financialYear: invoice.financialYear,
    invoiceDate: invoice.invoiceDate,
    narration: invoice.narration,
    cancelled: invoice.cancelledAt !== null,
    partyName: invoice.partyName,
    partyGstin: invoice.partyGstin,
    partyStateCode: invoice.partyStateCode,
    partyAddress: invoice.partyAddress,
    currency: invoice.currency,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      hsnSacCode: l.hsnSacCode,
      itemName: l.itemName,
      quantity: l.quantityThousandths !== null ? l.quantityThousandths / 1000 : null,
      unitSymbol: l.unitSymbol,
      rate: l.ratePaise !== null ? l.ratePaise / 100 : null,
      taxableAmount: l.taxableAmount / 100,
      gstRatePercent: l.gstRatePercent,
      cgstAmount: l.cgstAmount / 100,
      sgstAmount: l.sgstAmount / 100,
      igstAmount: l.igstAmount / 100,
      cessAmount: l.cessAmount / 100,
      manualTaxAmount: l.manualTaxAmount / 100,
    })),
    taxableAmount: invoice.taxableAmount / 100,
    cgstAmount: invoice.cgstAmount / 100,
    sgstAmount: invoice.sgstAmount / 100,
    igstAmount: invoice.igstAmount / 100,
    cessAmount: invoice.cessAmount / 100,
    manualTaxAmount: invoice.manualTaxAmount / 100,
    totalAmount: invoice.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'SALES_INVOICE', data, `Invoice ${invoice.voucherNumber}`, () => renderSalesInvoiceHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `Invoice-${invoice.voucherNumber}`, data: data as unknown as Record<string, unknown> };
}

async function buildPurchaseInvoiceHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, invoiceId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, invoice] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getPurchaseInvoiceForPrint(companyDb, invoiceId),
  ]);

  const data: PurchaseInvoiceTemplateData = {
    letterhead,
    voucherNumber: invoice.voucherNumber,
    financialYear: invoice.financialYear,
    invoiceDate: invoice.invoiceDate,
    narration: invoice.narration,
    cancelled: invoice.cancelledAt !== null,
    partyName: invoice.partyName,
    partyGstin: invoice.partyGstin,
    partyStateCode: invoice.partyStateCode,
    partyAddress: invoice.partyAddress,
    currency: invoice.currency,
    isMsmeVendor: invoice.isMsmeVendor,
    dueDate: invoice.dueDate,
    tdsSection: invoice.tdsSection,
    tdsAmount: invoice.tdsAmount / 100,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      hsnSacCode: l.hsnSacCode,
      itemName: l.itemName,
      quantity: l.quantityThousandths !== null ? l.quantityThousandths / 1000 : null,
      unitSymbol: l.unitSymbol,
      rate: l.ratePaise !== null ? l.ratePaise / 100 : null,
      taxableAmount: l.taxableAmount / 100,
      gstRatePercent: l.gstRatePercent,
      cgstAmount: l.cgstAmount / 100,
      sgstAmount: l.sgstAmount / 100,
      igstAmount: l.igstAmount / 100,
      cessAmount: l.cessAmount / 100,
      manualTaxAmount: l.manualTaxAmount / 100,
    })),
    taxableAmount: invoice.taxableAmount / 100,
    cgstAmount: invoice.cgstAmount / 100,
    sgstAmount: invoice.sgstAmount / 100,
    igstAmount: invoice.igstAmount / 100,
    cessAmount: invoice.cessAmount / 100,
    manualTaxAmount: invoice.manualTaxAmount / 100,
    totalAmount: invoice.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'PURCHASE_INVOICE', data, `Purchase Invoice ${invoice.voucherNumber}`, () => renderPurchaseInvoiceHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `PurchaseInvoice-${invoice.voucherNumber}`, data: data as unknown as Record<string, unknown> };
}

async function buildSalesOrderHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, orderId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, order] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getSalesOrderForPrint(companyDb, orderId),
  ]);

  const data: OrderTemplateData = {
    letterhead,
    kind: 'SALES_ORDER',
    orderNumber: order.orderNumber,
    financialYear: order.financialYear,
    orderDate: order.orderDate,
    narration: order.narration,
    status: order.status,
    convertedToInvoiceId: order.convertedToInvoiceId,
    partyName: order.partyName,
    partyGstin: order.partyGstin,
    partyStateCode: order.partyStateCode,
    partyAddress: order.partyAddress,
    lines: order.lines.map((l) => ({
      description: l.description,
      hsnSacCode: l.hsnSacCode,
      itemName: l.itemName,
      quantity: l.quantityThousandths !== null ? l.quantityThousandths / 1000 : null,
      unitSymbol: l.unitSymbol,
      rate: l.ratePaise !== null ? l.ratePaise / 100 : null,
      amount: l.amount / 100,
      taxAmount: l.taxAmount / 100,
    })),
    taxableAmount: order.taxableAmount / 100,
    taxAmount: order.taxAmount / 100,
    totalAmount: order.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'ORDER', data, `Sales Order ${order.orderNumber}`, () => renderOrderHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `SalesOrder-${order.orderNumber}`, data: data as unknown as Record<string, unknown> };
}

async function buildPurchaseOrderHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, orderId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, order] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getPurchaseOrderForPrint(companyDb, orderId),
  ]);

  const data: OrderTemplateData = {
    letterhead,
    kind: 'PURCHASE_ORDER',
    orderNumber: order.orderNumber,
    financialYear: order.financialYear,
    orderDate: order.orderDate,
    narration: order.narration,
    status: order.status,
    convertedToInvoiceId: order.convertedToInvoiceId,
    partyName: order.partyName,
    partyGstin: order.partyGstin,
    partyStateCode: order.partyStateCode,
    partyAddress: order.partyAddress,
    lines: order.lines.map((l) => ({
      description: l.description,
      hsnSacCode: l.hsnSacCode,
      itemName: l.itemName,
      quantity: l.quantityThousandths !== null ? l.quantityThousandths / 1000 : null,
      unitSymbol: l.unitSymbol,
      rate: l.ratePaise !== null ? l.ratePaise / 100 : null,
      amount: l.amount / 100,
      taxAmount: l.taxAmount / 100,
    })),
    taxableAmount: order.taxableAmount / 100,
    taxAmount: order.taxAmount / 100,
    totalAmount: order.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'ORDER', data, `Purchase Order ${order.orderNumber}`, () => renderOrderHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `PurchaseOrder-${order.orderNumber}`, data: data as unknown as Record<string, unknown> };
}

const PRINTABLE_VOUCHER_TYPES: readonly PrintableVoucherType[] = ['JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA'];

async function buildVoucherHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, voucherId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, voucher] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getVoucherForPrint(companyDb, voucherId),
  ]);

  if (!PRINTABLE_VOUCHER_TYPES.includes(voucher.voucherType as PrintableVoucherType)) {
    throw new Error(`Printing is not available for a ${voucher.voucherType} voucher — only Journal/Payment/Receipt/Contra vouchers use this generic print path`);
  }

  const data: VoucherTemplateData = {
    letterhead,
    voucherType: voucher.voucherType as PrintableVoucherType,
    voucherNumber: voucher.voucherNumber,
    financialYear: voucher.financialYear,
    voucherDate: voucher.voucherDate,
    narration: voucher.narration,
    cancelled: voucher.cancelledAt !== null,
    lines: voucher.lines.map((l) => ({
      ledgerName: l.ledgerName,
      debitAmount: l.debitAmount / 100,
      creditAmount: l.creditAmount / 100,
      lineNarration: l.lineNarration,
      costCentreName: l.costCentreName,
      branchName: l.branchName,
    })),
    totalAmount: voucher.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'VOUCHER', data, `${data.voucherType} ${voucher.voucherNumber}`, () => renderVoucherHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `Voucher-${voucher.voucherNumber}`, data: data as unknown as Record<string, unknown> };
}

async function buildExpenseClaimHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, expenseClaimId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, claim] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getExpenseClaimForPrint(companyDb, expenseClaimId),
  ]);

  const data: ExpenseClaimTemplateData = {
    letterhead,
    employeeName: claim.employeeName,
    claimNumber: claim.claimNumber,
    financialYear: claim.financialYear,
    claimDate: claim.claimDate,
    purpose: claim.purpose,
    status: claim.status,
    rejectedReason: claim.rejectedReason,
    lines: claim.lines.map((l) => ({
      expenseLedgerName: l.expenseLedgerName,
      description: l.description,
      expenseDate: l.expenseDate,
      amount: l.amount / 100,
      lineNarration: l.lineNarration,
    })),
    totalAmount: claim.totalAmount / 100,
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'EXPENSE_CLAIM', data, `Expense Claim ${claim.claimNumber}`, () => renderExpenseClaimHtml(data, profile.invoiceLayout as DocumentLayout));
  return { html, fileNameBase: `ExpenseClaim-${claim.claimNumber}`, data: data as unknown as Record<string, unknown> };
}

async function buildPayslipHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, payslipId: string): Promise<{ html: string; fileNameBase: string; data: Record<string, unknown> }> {
  const [letterhead, profile, payslip] = await Promise.all([
    letterheadForPrint(systemDb, companyDb, companyId),
    coreGetCompanyLetterheadProfile(companyDb),
    getPayslipForPrint(companyDb, payslipId),
  ]);

  const data: PayslipTemplateData = {
    letterhead,
    employeeName: payslip.employeeName,
    employeeCode: payslip.employeeCode,
    designation: payslip.designation,
    pan: payslip.pan,
    bankAccountNumber: payslip.bankAccountNumber,
    bankIfsc: payslip.bankIfsc,
    uan: payslip.uan,
    financialYear: payslip.financialYear,
    periodMonth: payslip.periodMonth,
    periodYear: payslip.periodYear,
    paidDays: payslip.paidDays / 10,
    lopDays: payslip.lopDays / 10,
    grossEarnings: payslip.grossEarnings / 100,
    totalDeductions: payslip.totalDeductions / 100,
    netPay: payslip.netPay / 100,
    lines: payslip.lines.map((l) => ({ lineType: l.lineType, label: l.label, amount: l.amount / 100 })),
  };

  const html = await renderWithOptionalCustomLayout(companyDb, 'PAYSLIP', data, `Payslip ${payslip.employeeCode} ${payslip.periodMonth}/${payslip.periodYear}`, () => renderPayslipHtml(data, profile.payslipLayout as DocumentLayout));
  return { html, fileNameBase: `Payslip-${payslip.employeeCode}-${payslip.periodMonth}-${payslip.periodYear}`, data: data as unknown as Record<string, unknown> };
}

/** A hidden, sandboxed BrowserWindow used purely as an HTML->print/PDF renderer — never shown, never navigable by the user, destroyed immediately after use. */
async function renderInHiddenWindow(html: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

async function printHtml(html: string): Promise<PrintDocumentResult> {
  const win = await renderInHiddenWindow(html);
  try {
    const saved = await new Promise<boolean>((resolve) => {
      win.webContents.print({ printBackground: true }, (ok) => resolve(ok));
    });
    return { saved };
  } finally {
    win.destroy();
  }
}

/** Native save-file dialog — mirrors backupHandlers.ts's/csvExport.ts's save pattern. */
async function saveHtmlAsPdf(html: string, defaultFileNameBase: string): Promise<PrintDocumentResult> {
  const win = await renderInHiddenWindow(html);
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally {
    win.destroy();
  }

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const saveOptions = { defaultPath: `${defaultFileNameBase}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] };
  const result = parentWindow ? await dialog.showSaveDialog(parentWindow, saveOptions) : await dialog.showSaveDialog(saveOptions);
  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  writeFileSync(result.filePath, pdfBuffer);
  return { saved: true, filePath: result.filePath };
}

export async function printSalesInvoice(systemDb: Kysely<SystemDatabase>, invoiceId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildSalesInvoiceHtml(systemDb, companyDb, info.companyId, invoiceId);
  return printHtml(html);
}

export async function saveSalesInvoicePdf(systemDb: Kysely<SystemDatabase>, invoiceId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildSalesInvoiceHtml(systemDb, companyDb, info.companyId, invoiceId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printPayslip(systemDb: Kysely<SystemDatabase>, payslipId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildPayslipHtml(systemDb, companyDb, info.companyId, payslipId);
  return printHtml(html);
}

export async function savePayslipPdf(systemDb: Kysely<SystemDatabase>, payslipId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildPayslipHtml(systemDb, companyDb, info.companyId, payslipId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printPurchaseInvoice(systemDb: Kysely<SystemDatabase>, invoiceId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildPurchaseInvoiceHtml(systemDb, companyDb, info.companyId, invoiceId);
  return printHtml(html);
}

export async function savePurchaseInvoicePdf(systemDb: Kysely<SystemDatabase>, invoiceId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildPurchaseInvoiceHtml(systemDb, companyDb, info.companyId, invoiceId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printSalesOrder(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildSalesOrderHtml(systemDb, companyDb, info.companyId, orderId);
  return printHtml(html);
}

export async function saveSalesOrderPdf(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildSalesOrderHtml(systemDb, companyDb, info.companyId, orderId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printPurchaseOrder(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildPurchaseOrderHtml(systemDb, companyDb, info.companyId, orderId);
  return printHtml(html);
}

export async function savePurchaseOrderPdf(systemDb: Kysely<SystemDatabase>, orderId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildPurchaseOrderHtml(systemDb, companyDb, info.companyId, orderId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printVoucher(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildVoucherHtml(systemDb, companyDb, info.companyId, voucherId);
  return printHtml(html);
}

export async function saveVoucherPdf(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildVoucherHtml(systemDb, companyDb, info.companyId, voucherId);
  return saveHtmlAsPdf(html, fileNameBase);
}

export async function printExpenseClaim(systemDb: Kysely<SystemDatabase>, expenseClaimId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html } = await buildExpenseClaimHtml(systemDb, companyDb, info.companyId, expenseClaimId);
  return printHtml(html);
}

export async function saveExpenseClaimPdf(systemDb: Kysely<SystemDatabase>, expenseClaimId: string): Promise<PrintDocumentResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const { html, fileNameBase } = await buildExpenseClaimHtml(systemDb, companyDb, info.companyId, expenseClaimId);
  return saveHtmlAsPdf(html, fileNameBase);
}

/** Phase 9 Increment 2 (Print + Templates) — a flat cross-run payslip listing for the Print Centre register. Read-only, so it only needs PRINT.PRINT_DOCUMENTS (same permission every print/save action here requires), not a payroll-specific one. */
export async function listPayslipsForPrint(): Promise<PayslipPrintListItem[]> {
  const { companyDb } = requireSessionWithCompanyDb('PRINT.PRINT_DOCUMENTS');
  const rows = await corePayrollListPayslipsForPrint(companyDb);
  return rows.map((r) => ({ ...r, netPay: r.netPay / 100 }));
}

// --- Phase 9 Increment 3: Print + Templates (drag-and-drop template designer) ---

function toIpcLayoutSummary(summary: CorePrintTemplateLayoutSummary): PrintTemplateLayoutSummary {
  return { ...summary, layout: summary.layout as TemplateLayoutDocument };
}

export async function getTemplateLayout(documentFamily: TemplateFamily): Promise<PrintTemplateLayoutSummary | null> {
  const { companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  const layout = await getActiveTemplateLayout(companyDb, documentFamily);
  return layout ? toIpcLayoutSummary(layout) : null;
}

export async function saveTemplateLayout(input: SaveTemplateLayoutInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  await saveTemplateLayoutVersion(companyDb, input, info.userId);
}

export async function revertTemplateLayout(documentFamily: TemplateFamily): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  await coreRevertTemplateLayout(companyDb, documentFamily, info.userId);
}

export async function listTemplateLayoutVersions(documentFamily: TemplateFamily): Promise<PrintTemplateLayoutSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  const rows = await coreListTemplateLayoutVersions(companyDb, documentFamily);
  return rows.map(toIpcLayoutSummary);
}

/** Fixed metadata, not company data — no DB lookup needed beyond the permission check (same "designer is a MANAGE_LETTERHEAD action" gate as the other 4 handlers above). */
export async function getTemplateFieldCatalog(documentFamily: TemplateFamily): Promise<TemplateFieldCatalogEntry[]> {
  requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');
  return TEMPLATE_FIELD_CATALOG[documentFamily];
}

/** A minimal, clearly-labelled placeholder — used only when the company has no real document of a family yet, so the designer canvas still has something to show. Never used for an actual print/PDF. */
function placeholderDataFor(family: TemplateFamily, letterhead: LetterheadForPrint): Record<string, unknown> {
  const sampleLine = { description: 'Sample item', hsnSacCode: '1234', itemName: 'Sample item', quantity: 2, unitSymbol: 'PCS', rate: 500, taxableAmount: 1000, gstRatePercent: 18, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, cessAmount: 0, manualTaxAmount: 0 };
  const common = { letterhead, financialYear: '2026-27', narration: 'Sample narration' };
  switch (family) {
    case 'SALES_INVOICE':
      return {
        ...common,
        voucherNumber: 1,
        invoiceDate: '2026-04-01',
        cancelled: false,
        partyName: 'Sample Customer',
        partyGstin: null,
        partyStateCode: null,
        partyAddress: 'Sample address',
        currency: null,
        lines: [sampleLine],
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        cessAmount: 0,
        manualTaxAmount: 0,
        totalAmount: 1180,
      };
    case 'PURCHASE_INVOICE':
      return {
        ...common,
        voucherNumber: 1,
        invoiceDate: '2026-04-01',
        cancelled: false,
        partyName: 'Sample Supplier',
        partyGstin: null,
        partyStateCode: null,
        partyAddress: 'Sample address',
        currency: null,
        isMsmeVendor: false,
        dueDate: '2026-04-30',
        tdsSection: null,
        tdsAmount: 0,
        lines: [sampleLine],
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        cessAmount: 0,
        manualTaxAmount: 0,
        totalAmount: 1180,
      };
    case 'ORDER':
      return {
        ...common,
        kind: 'SALES_ORDER',
        orderNumber: 1,
        orderDate: '2026-04-01',
        status: 'OPEN',
        convertedToInvoiceId: null,
        partyName: 'Sample Party',
        partyGstin: null,
        partyStateCode: null,
        partyAddress: 'Sample address',
        lines: [{ description: 'Sample item', hsnSacCode: '1234', itemName: 'Sample item', quantity: 2, unitSymbol: 'PCS', rate: 500, amount: 1000, taxAmount: 180 }],
        taxableAmount: 1000,
        taxAmount: 180,
        totalAmount: 1180,
      };
    case 'VOUCHER':
      return {
        ...common,
        voucherType: 'JOURNAL',
        voucherNumber: 1,
        voucherDate: '2026-04-01',
        cancelled: false,
        lines: [
          { ledgerName: 'Sample Debit Ledger', debitAmount: 1000, creditAmount: 0, lineNarration: null, costCentreName: null, branchName: null },
          { ledgerName: 'Sample Credit Ledger', debitAmount: 0, creditAmount: 1000, lineNarration: null, costCentreName: null, branchName: null },
        ],
        totalAmount: 1000,
      };
    case 'EXPENSE_CLAIM':
      return {
        ...common,
        employeeName: 'Sample Employee',
        claimNumber: 1,
        claimDate: '2026-04-01',
        purpose: 'Sample purpose',
        status: 'SUBMITTED',
        rejectedReason: null,
        lines: [{ expenseLedgerName: 'Sample Expense Ledger', description: 'Sample expense', expenseDate: '2026-04-01', amount: 500, lineNarration: null }],
        totalAmount: 500,
      };
    case 'PAYSLIP':
      return {
        ...common,
        employeeName: 'Sample Employee',
        employeeCode: 'EMP001',
        designation: 'Sample Designation',
        pan: null,
        bankAccountNumber: null,
        bankIfsc: null,
        uan: null,
        periodMonth: 4,
        periodYear: 2026,
        paidDays: 30,
        lopDays: 0,
        grossEarnings: 50000,
        totalDeductions: 5000,
        netPay: 45000,
        lines: [
          { lineType: 'EARNING', label: 'Basic', amount: 25000 },
          { lineType: 'EARNING', label: 'HRA', amount: 25000 },
          { lineType: 'DEDUCTION', label: 'PF', amount: 5000 },
        ],
      };
  }
}

/**
 * The designer's live-preview data source — reuses the exact same assembly
 * (getXForPrint + letterheadForPrint) every buildXHtml function already
 * uses, against whichever real document of that family was created most
 * recently. Falls back to a placeholder only when the company has none yet
 * (preview-only; never used for an actual print/PDF).
 */
export async function getTemplatePreviewData(systemDb: Kysely<SystemDatabase>, documentFamily: TemplateFamily): Promise<TemplatePreviewData> {
  const { info, companyDb } = requireSessionWithCompanyDb('PRINT.MANAGE_LETTERHEAD');

  switch (documentFamily) {
    case 'SALES_INVOICE': {
      const rows = await listSalesInvoices(companyDb);
      if (rows.length === 0) break;
      const { data } = await buildSalesInvoiceHtml(systemDb, companyDb, info.companyId, rows[0].id);
      return { data, isPlaceholder: false };
    }
    case 'PURCHASE_INVOICE': {
      const rows = await listPurchaseInvoices(companyDb);
      if (rows.length === 0) break;
      const { data } = await buildPurchaseInvoiceHtml(systemDb, companyDb, info.companyId, rows[0].id);
      return { data, isPlaceholder: false };
    }
    case 'ORDER': {
      const salesRows = await listSalesOrders(companyDb);
      if (salesRows.length > 0) {
        const { data } = await buildSalesOrderHtml(systemDb, companyDb, info.companyId, salesRows[0].id);
        return { data, isPlaceholder: false };
      }
      const purchaseRows = await listPurchaseOrders(companyDb);
      if (purchaseRows.length > 0) {
        const { data } = await buildPurchaseOrderHtml(systemDb, companyDb, info.companyId, purchaseRows[0].id);
        return { data, isPlaceholder: false };
      }
      break;
    }
    case 'VOUCHER': {
      const rows = await listVouchers(companyDb);
      const printable = rows.find((r) => (PRINTABLE_VOUCHER_TYPES as readonly string[]).includes(r.voucherType));
      if (!printable) break;
      const { data } = await buildVoucherHtml(systemDb, companyDb, info.companyId, printable.id);
      return { data, isPlaceholder: false };
    }
    case 'EXPENSE_CLAIM': {
      const rows = await listExpenseClaims(companyDb);
      if (rows.length === 0) break;
      const { data } = await buildExpenseClaimHtml(systemDb, companyDb, info.companyId, rows[0].id);
      return { data, isPlaceholder: false };
    }
    case 'PAYSLIP': {
      const rows = await corePayrollListPayslipsForPrint(companyDb);
      if (rows.length === 0) break;
      const { data } = await buildPayslipHtml(systemDb, companyDb, info.companyId, rows[0].id);
      return { data, isPlaceholder: false };
    }
  }

  const letterhead = await letterheadForPrint(systemDb, companyDb, info.companyId);
  return { data: placeholderDataFor(documentFamily, letterhead), isPlaceholder: true };
}
