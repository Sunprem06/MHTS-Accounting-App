// Phase 0 (Foundation): offline license verification, pulled forward per the
// Blueprint. Signing (which needs the private key) is deliberately NOT part
// of this package — see scripts/generate-license.mjs.
export { LICENSE_PUBLIC_KEY_PEM, verifyLicenseFile, LicenseError } from './license';
export type { LicensePayload, LicenseFile } from './license';
