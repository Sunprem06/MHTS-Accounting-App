import { createPublicKey, verify } from 'node:crypto';

/**
 * Public half of the Ed25519 keypair used to sign license files (Blueprint
 * §2: "Ed25519-signed offline license files... validated locally"). This is
 * meant to be public — embedding it here is what lets the app verify a
 * license completely offline, no server round-trip. The PRIVATE key that
 * signs license files is deliberately NOT part of this package (or anywhere
 * in this repo) — see the Phase Tracker's Key Decisions Log for where it's
 * kept and how a real license file gets produced (scripts/generate-license.mjs,
 * a standalone vendor-only tool, never bundled into the shipped app).
 */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAUD0IwY8MlXi7GEPfEzEl296bSUeLFYwl4UbtcH8ne2E=
-----END PUBLIC KEY-----
`;

/**
 * Deliberately NOT machine-bound inside the signed payload — the app never
 * holds the private key, so it can't re-sign a license to stamp a machine ID
 * into it after the fact. Hardware binding is instead enforced locally (see
 * @mhts/desktop-shell's licenseHandlers.ts): the first successful
 * verification on a machine records that machine's id locally; a later
 * verification on a DIFFERENT machine, for the SAME licenseId, is rejected.
 * This still satisfies the intent (a license can't just be copied to a
 * second machine and used there), without needing a phone-home service to
 * do the (re-)signing.
 */
export interface LicensePayload {
  licenseId: string;
  issuedTo: string;
  /** e.g. 'MHTSdigiXR', 'KoodaldigiXS', or a reseller's own brand — drives white-label plumbing alongside brand.config.json. */
  brand: string;
  edition: string;
  /** Null = unlimited. */
  maxCompanies: number | null;
  issuedAt: string;
  /** Null = perpetual. */
  expiresAt: string | null;
}

export interface LicenseFile {
  payload: LicensePayload;
  /** Base64 Ed25519 signature over JSON.stringify(payload) (stable key order — see signing tooling). */
  signature: string;
}

export class LicenseError extends Error {}

function canonicalPayloadBytes(payload: LicensePayload): Buffer {
  // Fixed key order so the exact same bytes get signed and verified — JSON.stringify on an object
  // literal with a fixed property order is stable across Node versions/engines, unlike Object.keys order
  // for objects built up dynamically.
  const ordered: LicensePayload = {
    licenseId: payload.licenseId,
    issuedTo: payload.issuedTo,
    brand: payload.brand,
    edition: payload.edition,
    maxCompanies: payload.maxCompanies,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

/**
 * Verifies a license file's signature and expiry. Does NOT check machine
 * binding — that's a separate, local, stateful check (needs the system DB)
 * layered on top by the caller.
 */
export function verifyLicenseFile(fileContents: string, asOfDate: string = new Date().toISOString().slice(0, 10)): LicensePayload {
  let parsed: LicenseFile;
  try {
    parsed = JSON.parse(fileContents);
  } catch {
    throw new LicenseError('This is not a valid license file (not JSON).');
  }
  if (!parsed.payload || !parsed.signature) {
    throw new LicenseError('This is not a valid license file (missing payload or signature).');
  }

  const publicKey = createPublicKey(LICENSE_PUBLIC_KEY_PEM);
  const signatureValid = verify(null, canonicalPayloadBytes(parsed.payload), publicKey, Buffer.from(parsed.signature, 'base64'));
  if (!signatureValid) {
    throw new LicenseError('This license file has an invalid signature — it may be corrupted or tampered with.');
  }

  if (parsed.payload.expiresAt && parsed.payload.expiresAt < asOfDate) {
    throw new LicenseError(`This license expired on ${parsed.payload.expiresAt}.`);
  }

  return parsed.payload;
}
