/**
 * The 6 groupings @mhts/print-templates already shares one renderer for
 * (ORDER covers both Sales + Purchase Order; VOUCHER covers Journal/Payment/
 * Receipt/Contra). Mirrored — not imported — in @mhts/print-templates's own
 * templateLayoutTypes.ts, same "kept as a plain string here so this package
 * stays dependency-free" reasoning as core-company-profile's DocumentLayout:
 * this is a `type:core` package and print-templates is tagged `type:app`,
 * so a core package structurally cannot depend on it (Nx module boundaries).
 */
export type TemplateFamily = 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'ORDER' | 'VOUCHER' | 'EXPENSE_CLAIM' | 'PAYSLIP';

export const TEMPLATE_FAMILIES: readonly TemplateFamily[] = ['SALES_INVOICE', 'PURCHASE_INVOICE', 'ORDER', 'VOUCHER', 'EXPENSE_CLAIM', 'PAYSLIP'];

export interface PrintTemplateLayoutSummary {
  id: string;
  documentFamily: TemplateFamily;
  version: number;
  name: string | null;
  /** JSON-parsed layout tree. Shape (TemplateLayoutDocument) is owned entirely by @mhts/print-templates — this package never inspects it, same "payload: unknown" precedent as core-rules-engine's rule_set. */
  layout: unknown;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SaveTemplateLayoutInput {
  documentFamily: TemplateFamily;
  name: string | null;
  layout: unknown;
}
