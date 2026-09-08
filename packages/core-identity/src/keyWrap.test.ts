import { describe, expect, it } from 'vitest';
import {
  formatRecoveryKey,
  generateDataKey,
  generateRecoveryKey,
  parseRecoveryKey,
  unwrapDataKey,
  unwrapWithRawKey,
  wrapDataKey,
  wrapWithRawKey,
} from './keyWrap';

/**
 * The DEK wrap/unwrap paths are the literal enforcement of Rule #3 (per-company
 * encrypted DB, no plaintext key on disk) — a bug here either locks a real
 * user out of their own company forever, or fails to fail closed on a wrong
 * password/recovery key (a real confidentiality break). Highest-priority
 * security test file in the suite alongside password.test.ts.
 */
describe('core-identity: DEK wrap/unwrap (password path)', () => {
  it('round-trips: unwrapping with the correct password recovers the exact original DEK', () => {
    const dek = generateDataKey();
    const wrapped = wrapDataKey(dek, 'my-login-password');
    const recovered = unwrapDataKey(wrapped, 'my-login-password');
    expect(recovered.equals(dek)).toBe(true);
  });

  it('fails closed (throws, does not return garbage) when unwrapping with the wrong password', () => {
    const dek = generateDataKey();
    const wrapped = wrapDataKey(dek, 'correct-password');
    expect(() => unwrapDataKey(wrapped, 'wrong-password')).toThrow();
  });

  it('two DEKs wrapped under the same password produce different wrapped output (random IV)', () => {
    const dek = generateDataKey();
    const wrappedA = wrapDataKey(dek, 'same-password');
    const wrappedB = wrapDataKey(dek, 'same-password');
    expect(wrappedA.wrappedKeyHex).not.toBe(wrappedB.wrappedKeyHex);
    expect(wrappedA.ivHex).not.toBe(wrappedB.ivHex);
  });
});

describe('core-identity: DEK wrap/unwrap (recovery-key path)', () => {
  it('round-trips: unwrapping with the correct recovery key recovers the exact original DEK', () => {
    const dek = generateDataKey();
    const recoveryKey = generateRecoveryKey();
    const wrapped = wrapWithRawKey(dek, recoveryKey);
    const recovered = unwrapWithRawKey(wrapped, recoveryKey);
    expect(recovered.equals(dek)).toBe(true);
  });

  it('fails closed when unwrapping with the wrong recovery key', () => {
    const dek = generateDataKey();
    const wrapped = wrapWithRawKey(dek, generateRecoveryKey());
    expect(() => unwrapWithRawKey(wrapped, generateRecoveryKey())).toThrow();
  });

  it('formatRecoveryKey/parseRecoveryKey round-trip exactly, ignoring separators/case', () => {
    const recoveryKey = generateRecoveryKey();
    const formatted = formatRecoveryKey(recoveryKey);
    expect(formatted).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4})*$/);
    expect(parseRecoveryKey(formatted).equals(recoveryKey)).toBe(true);
    expect(parseRecoveryKey(formatted.toUpperCase()).equals(recoveryKey)).toBe(true);
    expect(parseRecoveryKey(formatted.replace(/-/g, ' ')).equals(recoveryKey)).toBe(true);
  });

  it('parseRecoveryKey rejects a malformed input rather than silently truncating/padding', () => {
    expect(() => parseRecoveryKey('not-hex-at-all')).toThrow();
    expect(() => parseRecoveryKey('a1b2')).toThrow(); // too short
  });

  it('the password path and the recovery-key path are independently sufficient — either one alone unwraps the same DEK', () => {
    const dek = generateDataKey();
    const passwordWrapped = wrapDataKey(dek, 'the-password');
    const recoveryKey = generateRecoveryKey();
    const recoveryWrapped = wrapWithRawKey(dek, recoveryKey);

    expect(unwrapDataKey(passwordWrapped, 'the-password').equals(dek)).toBe(true);
    expect(unwrapWithRawKey(recoveryWrapped, recoveryKey).equals(dek)).toBe(true);
  });
});
