/**
 * Thin HTTPS client for the MHTS ERP licensing portal (the new
 * /api/erp-licenses/* endpoints on MHTSdigiXR-Web-Accounting-App —
 * see the Phase Tracker's session 29 handoff for the full design).
 *
 * Every call here returns a `reached: false` result — never throws — for
 * ANY failure to get a real response: no internet, DNS failure, timeout, or
 * a non-2xx status. That's deliberate: the caller (licenseHandlers.ts)
 * treats "couldn't reach the portal" identically regardless of cause, and
 * lets the grace period do the rest.
 */

const DEFAULT_PORTAL_BASE_URL = 'https://mhtsdigixr.com/accounting/api/erp-licenses';
const REQUEST_TIMEOUT_MS = 5000;

function portalBaseUrl(): string {
  return process.env.MHTS_LICENSE_PORTAL_URL || DEFAULT_PORTAL_BASE_URL;
}

export type PortalResult<T> = { reached: true; data: T } | { reached: false; reason: string };

async function postJson<T>(path: string, body: unknown): Promise<PortalResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${portalBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await response.json().catch(() => null);
    if (!response.ok) {
      return { reached: false, reason: (json && typeof json.message === 'string' && json.message) || `The licensing portal returned an error (${response.status}).` };
    }
    return { reached: true, data: json as T };
  } catch {
    return { reached: false, reason: "Couldn't reach the licensing portal — check your internet connection." };
  } finally {
    clearTimeout(timeout);
  }
}

export interface ActivateOnlineResponse {
  licenseFileContents: string;
  activationToken: string;
}

/** POST /api/erp-licenses/activate — the one-time online activation call. */
export function activateOnline(activationCode: string, machineId: string, machineLabel: string): Promise<PortalResult<ActivateOnlineResponse>> {
  return postJson<ActivateOnlineResponse>('/activate', { activationCode, machineId, machineLabel });
}

export interface CheckinOnlineResponse {
  ok: boolean;
  status: 'active' | 'revoked' | 'invalid_token' | 'not_found' | 'invalid_request';
}

/** POST /api/erp-licenses/checkin — the periodic re-validation call that keeps the grace period alive. */
export function checkinOnline(licenseId: string, machineId: string, activationToken: string): Promise<PortalResult<CheckinOnlineResponse>> {
  return postJson<CheckinOnlineResponse>('/checkin', { licenseId, machineId, activationToken });
}
