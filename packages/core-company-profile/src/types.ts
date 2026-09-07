/** 'CLASSIC' | 'MODERN' — see @mhts/print-templates for the actual HTML/CSS each one renders. Config-based rebranding (Phase 9 Increment 1): a company picks a layout and fills in branding fields, no code touched. */
export type DocumentLayout = 'CLASSIC' | 'MODERN';

export const DOCUMENT_LAYOUTS: readonly DocumentLayout[] = ['CLASSIC', 'MODERN'];

export interface CompanyLetterheadProfileSummary {
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  bankBranch: string | null;
  footerNote: string | null;
  hasLogo: boolean;
  invoiceLayout: DocumentLayout;
  payslipLayout: DocumentLayout;
  accentColorHex: string | null;
  updatedAt: string;
}

export interface UpdateCompanyLetterheadProfileInput {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  footerNote?: string | null;
  invoiceLayout?: DocumentLayout;
  payslipLayout?: DocumentLayout;
  accentColorHex?: string | null;
}
