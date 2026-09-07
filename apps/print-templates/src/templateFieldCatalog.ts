import type { TemplateFamily, TemplateFieldCatalogEntry } from './templateLayoutTypes';

/**
 * Fixed metadata about the *TemplateData interfaces in types.ts — the
 * designer's field palette is built from this, not from the database. It
 * only changes when a TemplateData interface itself changes (a code
 * change), so — unlike GST rates/TDS thresholds — it doesn't belong behind
 * core-rules-engine's versioned rule_set; a plain exported const is the
 * right fit, the same way this package's own DocumentLayout constant is.
 */

const LETTERHEAD_FIELDS: TemplateFieldCatalogEntry[] = [
  { path: 'letterhead.companyName', label: 'Company name', kind: 'text' },
  { path: 'letterhead.gstin', label: 'Company GSTIN', kind: 'text' },
  { path: 'letterhead.pan', label: 'Company PAN', kind: 'text' },
  { path: 'letterhead.address', label: 'Company address', kind: 'text' },
  { path: 'letterhead.phone', label: 'Company phone', kind: 'text' },
  { path: 'letterhead.email', label: 'Company email', kind: 'text' },
  { path: 'letterhead.website', label: 'Company website', kind: 'text' },
  { path: 'letterhead.bankAccountName', label: 'Bank account name', kind: 'text' },
  { path: 'letterhead.bankAccountNumber', label: 'Bank account number', kind: 'text' },
  { path: 'letterhead.bankIfsc', label: 'Bank IFSC', kind: 'text' },
  { path: 'letterhead.bankName', label: 'Bank name', kind: 'text' },
  { path: 'letterhead.bankBranch', label: 'Bank branch', kind: 'text' },
  { path: 'letterhead.footerNote', label: 'Footer note', kind: 'text' },
  { path: 'letterhead.logoDataUrl', label: 'Company logo', kind: 'image' },
  { path: 'letterhead.accentColorHex', label: 'Accent color', kind: 'text' },
];

const INVOICE_LINE_COLUMNS: TemplateFieldCatalogEntry['columns'] = [
  { path: 'description', label: 'Description', kind: 'text' },
  { path: 'hsnSacCode', label: 'HSN/SAC', kind: 'text' },
  { path: 'itemName', label: 'Item name', kind: 'text' },
  { path: 'quantity', label: 'Quantity', kind: 'text' },
  { path: 'unitSymbol', label: 'Unit', kind: 'text' },
  { path: 'rate', label: 'Rate', kind: 'currency' },
  { path: 'taxableAmount', label: 'Taxable amount', kind: 'currency' },
  { path: 'gstRatePercent', label: 'GST rate %', kind: 'text' },
  { path: 'cgstAmount', label: 'CGST', kind: 'currency' },
  { path: 'sgstAmount', label: 'SGST', kind: 'currency' },
  { path: 'igstAmount', label: 'IGST', kind: 'currency' },
  { path: 'cessAmount', label: 'Cess', kind: 'currency' },
  { path: 'manualTaxAmount', label: 'Manual tax', kind: 'currency' },
];

const SALES_INVOICE_FIELDS: TemplateFieldCatalogEntry[] = [
  ...LETTERHEAD_FIELDS,
  { path: 'voucherNumber', label: 'Invoice number', kind: 'text' },
  { path: 'financialYear', label: 'Financial year', kind: 'text' },
  { path: 'invoiceDate', label: 'Invoice date', kind: 'date' },
  { path: 'narration', label: 'Narration', kind: 'text' },
  { path: 'partyName', label: 'Customer name', kind: 'text' },
  { path: 'partyGstin', label: 'Customer GSTIN', kind: 'text' },
  { path: 'partyAddress', label: 'Customer address', kind: 'text' },
  { path: 'currency', label: 'Currency', kind: 'text' },
  { path: 'lines', label: 'Line items', kind: 'table', columns: INVOICE_LINE_COLUMNS },
  { path: 'taxableAmount', label: 'Total taxable amount', kind: 'currency' },
  { path: 'cgstAmount', label: 'Total CGST', kind: 'currency' },
  { path: 'sgstAmount', label: 'Total SGST', kind: 'currency' },
  { path: 'igstAmount', label: 'Total IGST', kind: 'currency' },
  { path: 'cessAmount', label: 'Total cess', kind: 'currency' },
  { path: 'totalAmount', label: 'Grand total', kind: 'currency' },
];

const PURCHASE_INVOICE_FIELDS: TemplateFieldCatalogEntry[] = [
  ...SALES_INVOICE_FIELDS.filter((f) => f.path !== 'partyGstin' && f.path !== 'partyName' && f.path !== 'partyAddress'),
  { path: 'partyName', label: 'Supplier name', kind: 'text' },
  { path: 'partyGstin', label: 'Supplier GSTIN', kind: 'text' },
  { path: 'partyAddress', label: 'Supplier address', kind: 'text' },
  { path: 'isMsmeVendor', label: 'MSME vendor?', kind: 'text' },
  { path: 'dueDate', label: 'Due date', kind: 'date' },
  { path: 'tdsSection', label: 'TDS section', kind: 'text' },
  { path: 'tdsAmount', label: 'TDS amount', kind: 'currency' },
];

const ORDER_LINE_COLUMNS: TemplateFieldCatalogEntry['columns'] = [
  { path: 'description', label: 'Description', kind: 'text' },
  { path: 'hsnSacCode', label: 'HSN/SAC', kind: 'text' },
  { path: 'itemName', label: 'Item name', kind: 'text' },
  { path: 'quantity', label: 'Quantity', kind: 'text' },
  { path: 'unitSymbol', label: 'Unit', kind: 'text' },
  { path: 'rate', label: 'Rate', kind: 'currency' },
  { path: 'amount', label: 'Amount', kind: 'currency' },
  { path: 'taxAmount', label: 'Tax amount', kind: 'currency' },
];

const ORDER_FIELDS: TemplateFieldCatalogEntry[] = [
  ...LETTERHEAD_FIELDS,
  { path: 'kind', label: 'Order type (Sales/Purchase)', kind: 'text' },
  { path: 'orderNumber', label: 'Order number', kind: 'text' },
  { path: 'financialYear', label: 'Financial year', kind: 'text' },
  { path: 'orderDate', label: 'Order date', kind: 'date' },
  { path: 'narration', label: 'Narration', kind: 'text' },
  { path: 'status', label: 'Status', kind: 'text' },
  { path: 'partyName', label: 'Party name', kind: 'text' },
  { path: 'partyGstin', label: 'Party GSTIN', kind: 'text' },
  { path: 'partyAddress', label: 'Party address', kind: 'text' },
  { path: 'lines', label: 'Line items', kind: 'table', columns: ORDER_LINE_COLUMNS },
  { path: 'taxableAmount', label: 'Total taxable amount', kind: 'currency' },
  { path: 'taxAmount', label: 'Total tax', kind: 'currency' },
  { path: 'totalAmount', label: 'Grand total', kind: 'currency' },
];

const VOUCHER_LINE_COLUMNS: TemplateFieldCatalogEntry['columns'] = [
  { path: 'ledgerName', label: 'Ledger', kind: 'text' },
  { path: 'debitAmount', label: 'Debit', kind: 'currency' },
  { path: 'creditAmount', label: 'Credit', kind: 'currency' },
  { path: 'lineNarration', label: 'Line narration', kind: 'text' },
  { path: 'costCentreName', label: 'Cost centre', kind: 'text' },
  { path: 'branchName', label: 'Branch', kind: 'text' },
];

const VOUCHER_FIELDS: TemplateFieldCatalogEntry[] = [
  ...LETTERHEAD_FIELDS,
  { path: 'voucherType', label: 'Voucher type', kind: 'text' },
  { path: 'voucherNumber', label: 'Voucher number', kind: 'text' },
  { path: 'financialYear', label: 'Financial year', kind: 'text' },
  { path: 'voucherDate', label: 'Voucher date', kind: 'date' },
  { path: 'narration', label: 'Narration', kind: 'text' },
  { path: 'lines', label: 'Ledger lines', kind: 'table', columns: VOUCHER_LINE_COLUMNS },
  { path: 'totalAmount', label: 'Total amount', kind: 'currency' },
];

const EXPENSE_CLAIM_LINE_COLUMNS: TemplateFieldCatalogEntry['columns'] = [
  { path: 'expenseLedgerName', label: 'Expense ledger', kind: 'text' },
  { path: 'description', label: 'Description', kind: 'text' },
  { path: 'expenseDate', label: 'Expense date', kind: 'text' },
  { path: 'amount', label: 'Amount', kind: 'currency' },
  { path: 'lineNarration', label: 'Line narration', kind: 'text' },
];

const EXPENSE_CLAIM_FIELDS: TemplateFieldCatalogEntry[] = [
  ...LETTERHEAD_FIELDS,
  { path: 'employeeName', label: 'Employee name', kind: 'text' },
  { path: 'claimNumber', label: 'Claim number', kind: 'text' },
  { path: 'financialYear', label: 'Financial year', kind: 'text' },
  { path: 'claimDate', label: 'Claim date', kind: 'date' },
  { path: 'purpose', label: 'Purpose', kind: 'text' },
  { path: 'status', label: 'Status', kind: 'text' },
  { path: 'lines', label: 'Expense lines', kind: 'table', columns: EXPENSE_CLAIM_LINE_COLUMNS },
  { path: 'totalAmount', label: 'Total amount', kind: 'currency' },
];

const PAYSLIP_LINE_COLUMNS: TemplateFieldCatalogEntry['columns'] = [
  { path: 'lineType', label: 'Type (Earning/Deduction/Employer contribution)', kind: 'text' },
  { path: 'label', label: 'Label', kind: 'text' },
  { path: 'amount', label: 'Amount', kind: 'currency' },
];

const PAYSLIP_FIELDS: TemplateFieldCatalogEntry[] = [
  ...LETTERHEAD_FIELDS,
  { path: 'employeeName', label: 'Employee name', kind: 'text' },
  { path: 'employeeCode', label: 'Employee code', kind: 'text' },
  { path: 'designation', label: 'Designation', kind: 'text' },
  { path: 'pan', label: 'PAN', kind: 'text' },
  { path: 'bankAccountNumber', label: 'Bank account number', kind: 'text' },
  { path: 'bankIfsc', label: 'Bank IFSC', kind: 'text' },
  { path: 'uan', label: 'UAN', kind: 'text' },
  { path: 'financialYear', label: 'Financial year', kind: 'text' },
  { path: 'periodMonth', label: 'Period month', kind: 'text' },
  { path: 'periodYear', label: 'Period year', kind: 'text' },
  { path: 'paidDays', label: 'Paid days', kind: 'text' },
  { path: 'lopDays', label: 'LOP days', kind: 'text' },
  { path: 'lines', label: 'Earning/deduction lines', kind: 'table', columns: PAYSLIP_LINE_COLUMNS },
  { path: 'grossEarnings', label: 'Gross earnings', kind: 'currency' },
  { path: 'totalDeductions', label: 'Total deductions', kind: 'currency' },
  { path: 'netPay', label: 'Net pay', kind: 'currency' },
];

export const TEMPLATE_FIELD_CATALOG: Record<TemplateFamily, TemplateFieldCatalogEntry[]> = {
  SALES_INVOICE: SALES_INVOICE_FIELDS,
  PURCHASE_INVOICE: PURCHASE_INVOICE_FIELDS,
  ORDER: ORDER_FIELDS,
  VOUCHER: VOUCHER_FIELDS,
  EXPENSE_CLAIM: EXPENSE_CLAIM_FIELDS,
  PAYSLIP: PAYSLIP_FIELDS,
};
