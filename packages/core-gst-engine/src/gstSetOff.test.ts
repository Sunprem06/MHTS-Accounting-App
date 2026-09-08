import { describe, expect, it } from 'vitest';
import { computeGstSetOff } from './gstSetOff';

const zero = { outputIgst: 0, outputCgst: 0, outputSgst: 0, outputCess: 0, inputIgst: 0, inputCgst: 0, inputSgst: 0, inputCess: 0 };

describe('core-gst-engine: computeGstSetOff', () => {
  it('with no credit at all, the full output liability is payable', () => {
    const result = computeGstSetOff({ ...zero, outputCgst: 900_00, outputSgst: 900_00 });
    expect(result.netCgstPayable).toBe(900_00);
    expect(result.netSgstPayable).toBe(900_00);
  });

  it('with credit exactly equal to liability, net payable is zero and nothing carries forward', () => {
    const result = computeGstSetOff({ ...zero, outputCgst: 500_00, outputSgst: 500_00, inputCgst: 500_00, inputSgst: 500_00 });
    expect(result.netCgstPayable).toBe(0);
    expect(result.netSgstPayable).toBe(0);
    expect(result.carryForwardCgst).toBe(0);
    expect(result.carryForwardSgst).toBe(0);
  });

  it('IGST credit exhausts IGST liability first, then spills into CGST, then SGST (the documented order)', () => {
    const result = computeGstSetOff({
      ...zero,
      outputIgst: 100_00,
      outputCgst: 200_00,
      outputSgst: 200_00,
      inputIgst: 400_00, // more than enough to cover IGST + CGST + SGST liability
    });
    expect(result.netIgstPayable).toBe(0);
    expect(result.netCgstPayable).toBe(0);
    // IGST credit (400) covers IGST (100) + CGST (200) fully, leaving only 100 for SGST's 200 liability.
    expect(result.netSgstPayable).toBe(100_00);
    expect(result.carryForwardIgst).toBe(0); // the full 400 credit was consumed: 100 + 200 + 100
  });

  it('CGST credit only spills into IGST liability, never into SGST liability', () => {
    const result = computeGstSetOff({ ...zero, outputIgst: 50_00, outputSgst: 100_00, inputCgst: 200_00 });
    expect(result.netIgstPayable).toBe(0); // 200 cgst credit covers 0 cgst liability, spills 200 into igst (only 50 needed)
    expect(result.netSgstPayable).toBe(100_00); // untouched — CGST credit never crosses into SGST
    expect(result.carryForwardCgst).toBe(200_00 - 50_00);
  });

  it('SGST credit only spills into IGST liability, never into CGST liability', () => {
    const result = computeGstSetOff({ ...zero, outputIgst: 50_00, outputCgst: 100_00, inputSgst: 200_00 });
    expect(result.netIgstPayable).toBe(0);
    expect(result.netCgstPayable).toBe(100_00); // untouched
    expect(result.carryForwardSgst).toBe(200_00 - 50_00);
  });

  it('cess never cross-utilizes with CGST/SGST/IGST — cess credit only offsets cess liability', () => {
    const result = computeGstSetOff({ ...zero, outputIgst: 100_00, outputCess: 50_00, inputCess: 100_00 });
    expect(result.netIgstPayable).toBe(100_00); // cess credit did NOT help pay IGST
    expect(result.netCessPayable).toBe(0);
    expect(result.carryForwardCess).toBe(50_00);
  });

  it('a liability never goes negative even with excess credit — the leftover becomes carry-forward, not a refund figure', () => {
    const result = computeGstSetOff({ ...zero, outputCgst: 100_00, inputCgst: 1_000_00 });
    expect(result.netCgstPayable).toBe(0);
    expect(result.carryForwardCgst).toBe(900_00);
  });

  it('a fully no-op call (all zeros) returns all-zero output without throwing', () => {
    const result = computeGstSetOff(zero);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});
