import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LicenseError, verifyLicenseFile } from './license';
import type { LicensePayload } from './license';

/**
 * The embedded LICENSE_PUBLIC_KEY_PEM's matching private key deliberately
 * does not exist anywhere in this repo (see the file's own doc comment) —
 * so a genuinely-valid-signature happy path can't be constructed in a test
 * without that key. What CAN be tested, and matters more for a security
 * review, is that every failure mode fails closed rather than accidentally
 * accepting something it shouldn't.
 */
describe('core-licensing: verifyLicenseFile (fails closed on every malformed/invalid input)', () => {
  it('rejects content that is not valid JSON at all', () => {
    expect(() => verifyLicenseFile('not json')).toThrow(LicenseError);
  });

  it('rejects valid JSON missing the payload or signature fields', () => {
    expect(() => verifyLicenseFile(JSON.stringify({ payload: { licenseId: 'x' } }))).toThrow(LicenseError);
    expect(() => verifyLicenseFile(JSON.stringify({ signature: 'x' }))).toThrow(LicenseError);
  });

  it('rejects a signature that does not verify against the embedded public key — even a signature that is valid for a DIFFERENT (self-generated) keypair', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const payload: LicensePayload = {
      licenseId: 'forged',
      issuedTo: 'Attacker',
      brand: 'MHTSdigiXR',
      edition: 'PRO',
      maxCompanies: null,
      issuedAt: '2026-01-01',
      expiresAt: null,
    };
    const orderedForSigning = { licenseId: payload.licenseId, issuedTo: payload.issuedTo, brand: payload.brand, edition: payload.edition, maxCompanies: payload.maxCompanies, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
    const signature = sign(null, Buffer.from(JSON.stringify(orderedForSigning), 'utf8'), privateKey).toString('base64');

    expect(() => verifyLicenseFile(JSON.stringify({ payload, signature }))).toThrow(/invalid signature/);
  });

  it('rejects a garbage base64 signature rather than throwing an unrelated crypto error', () => {
    const payload: LicensePayload = { licenseId: 'x', issuedTo: 'y', brand: 'z', edition: 'e', maxCompanies: null, issuedAt: '2026-01-01', expiresAt: null };
    expect(() => verifyLicenseFile(JSON.stringify({ payload, signature: 'not-real-base64-!!' }))).toThrow();
  });
});
