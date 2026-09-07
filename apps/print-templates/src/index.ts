// Phase 9 Increment 1 (Print + Templates): document template designer, native
// print, PDF. Pure HTML/CSS string building — no DB or Electron access of
// its own (the caller in apps/desktop-shell assembles the data and handles
// the actual printToPDF/print-dialog/save-dialog dance).
export { renderSalesInvoiceHtml } from './invoiceTemplate';
export { renderPayslipHtml } from './payslipTemplate';
export type { DocumentLayout, LetterheadForPrint, InvoiceLineForPrint, InvoiceTemplateData, PayslipLineType, PayslipLineForPrint, PayslipTemplateData } from './types';
