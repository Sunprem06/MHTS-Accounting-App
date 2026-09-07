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
import { getSalesInvoiceForPrint } from '@mhts/core-sales-purchase';
import { getPayslipForPrint } from '@mhts/core-payroll-engine';
import { renderSalesInvoiceHtml, renderPayslipHtml } from '@mhts/print-templates';
import type { DocumentLayout, InvoiceTemplateData, LetterheadForPrint, PayslipTemplateData } from '@mhts/print-templates';
import { session } from './session';
import type { CompanyLetterheadProfile, PickedLogoFile, PrintDocumentResult, UpdateCompanyLetterheadProfileInput, UploadCompanyLogoInput } from '../shared/ipc';

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

async function buildSalesInvoiceHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, invoiceId: string): Promise<{ html: string; fileNameBase: string }> {
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

  return { html: renderSalesInvoiceHtml(data, profile.invoiceLayout as DocumentLayout), fileNameBase: `Invoice-${invoice.voucherNumber}` };
}

async function buildPayslipHtml(systemDb: Kysely<SystemDatabase>, companyDb: Kysely<CompanyDatabase>, companyId: string, payslipId: string): Promise<{ html: string; fileNameBase: string }> {
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

  return { html: renderPayslipHtml(data, profile.payslipLayout as DocumentLayout), fileNameBase: `Payslip-${payslip.employeeCode}-${payslip.periodMonth}-${payslip.periodYear}` };
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
