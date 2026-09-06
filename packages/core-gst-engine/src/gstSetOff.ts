import type { GstSetOffInput, GstSetOffResult } from './types';

/**
 * Net GST payable after utilizing available input tax credit — the standard
 * (Rule 88A-style) set-off order, not a cash-minimizing optimizer (the real
 * rule gives some discretion in how IGST credit is split between CGST and
 * SGST liability; this always exhausts IGST liability first, then CGST,
 * then SGST). Good enough for a "roughly how much do I owe this period"
 * figure — verify against an actual GSTR-3B computation before relying on
 * this for a real filing.
 *
 * Order applied:
 * 1. IGST credit -> IGST liability, then any remainder -> CGST liability, then SGST liability.
 * 2. CGST credit -> CGST liability (whatever step 1 left), then any remainder -> IGST liability.
 * 3. SGST credit -> SGST liability (whatever step 1 left), then any remainder -> IGST liability.
 * 4. Cess credit -> Cess liability only — cess never cross-utilizes with CGST/SGST/IGST.
 *
 * Every step only ever subtracts min(credit, liability), so a liability
 * never goes negative (it becomes 0, the credit absorbs the rest) and a
 * credit never goes negative (it becomes 0, the liability absorbs the
 * rest) — the leftover on whichever side still has something left over
 * becomes this function's payable or carry-forward figure.
 */
export function computeGstSetOff(input: GstSetOffInput): GstSetOffResult {
  let igstLiability = input.outputIgst;
  let cgstLiability = input.outputCgst;
  let sgstLiability = input.outputSgst;
  let cessLiability = input.outputCess;
  let igstCredit = input.inputIgst;
  let cgstCredit = input.inputCgst;
  let sgstCredit = input.inputSgst;
  let cessCredit = input.inputCess;

  // 1. IGST credit: IGST liability first, then spills into CGST, then SGST.
  const igstToIgst = Math.min(igstCredit, igstLiability);
  igstLiability -= igstToIgst;
  igstCredit -= igstToIgst;

  const igstToCgst = Math.min(igstCredit, cgstLiability);
  cgstLiability -= igstToCgst;
  igstCredit -= igstToCgst;

  const igstToSgst = Math.min(igstCredit, sgstLiability);
  sgstLiability -= igstToSgst;
  igstCredit -= igstToSgst;

  // 2. CGST credit: CGST liability first, then spills into whatever IGST liability remains.
  const cgstToCgst = Math.min(cgstCredit, cgstLiability);
  cgstLiability -= cgstToCgst;
  cgstCredit -= cgstToCgst;

  const cgstToIgst = Math.min(cgstCredit, igstLiability);
  igstLiability -= cgstToIgst;
  cgstCredit -= cgstToIgst;

  // 3. SGST credit: SGST liability first, then spills into whatever IGST liability remains.
  const sgstToSgst = Math.min(sgstCredit, sgstLiability);
  sgstLiability -= sgstToSgst;
  sgstCredit -= sgstToSgst;

  const sgstToIgst = Math.min(sgstCredit, igstLiability);
  igstLiability -= sgstToIgst;
  sgstCredit -= sgstToIgst;

  // 4. Cess: no cross-utilization with CGST/SGST/IGST.
  const cessToCess = Math.min(cessCredit, cessLiability);
  cessLiability -= cessToCess;
  cessCredit -= cessToCess;

  return {
    netIgstPayable: igstLiability,
    netCgstPayable: cgstLiability,
    netSgstPayable: sgstLiability,
    netCessPayable: cessLiability,
    carryForwardIgst: igstCredit,
    carryForwardCgst: cgstCredit,
    carryForwardSgst: sgstCredit,
    carryForwardCess: cessCredit,
  };
}
