import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { SystemDatabase } from '@mhts/db-schema';
import type { LicensePayload } from '@mhts/core-licensing';
import type { AppPaths } from './db';

/**
 * The embedded LICENSE_PUBLIC_KEY_PEM's matching private key deliberately
 * doesn't exist in this repo (see core-licensing/license.ts's own doc
 * comment), so a genuinely-signed test license file can't be constructed
 * here either — the same constraint license.test.ts already documents.
 * Mocking `verifyLicenseFile` isolates the NEW online-activation/grace-
 * period logic (this file's actual subject) from that unrelated, already-
 * separately-tested signature-verification concern.
 */
vi.mock('@mhts/core-licensing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mhts/core-licensing')>();
  return { ...actual, verifyLicenseFile: vi.fn() };
});
vi.mock('./licensePortalClient', () => ({
  activateOnline: vi.fn(),
  checkinOnline: vi.fn(),
}));

import { verifyLicenseFile } from '@mhts/core-licensing';
import { activateOnline, checkinOnline } from './licensePortalClient';
import { checkLicenseStatus, activateLicenseOnline, attemptOnlineCheckin } from './licenseHandlers';

const mockVerifyLicenseFile = vi.mocked(verifyLicenseFile);
const mockActivateOnline = vi.mocked(activateOnline);
const mockCheckinOnline = vi.mocked(checkinOnline);

const TEST_PAYLOAD: LicensePayload = {
  licenseId: 'lic-test-001',
  issuedTo: 'Test Traders',
  brand: 'MHTSdigiXR',
  edition: 'PRO',
  maxCompanies: null,
  issuedAt: '2026-01-01',
  expiresAt: null,
};

describe('licenseHandlers: online activation + grace-period re-validation', () => {
  let system: TempDbHandle<SystemDatabase>;
  let paths: AppPaths;
  let userDataDir: string;

  beforeEach(async () => {
    system = await createTempSystemDb();
    userDataDir = mkdtempSync(join(tmpdir(), 'mhts-license-test-'));
    paths = { userDataDir, systemDbPath: '', systemKeyPath: '', companiesDir: '' };
    mockVerifyLicenseFile.mockReset().mockReturnValue(TEST_PAYLOAD);
    mockActivateOnline.mockReset();
    mockCheckinOnline.mockReset();
  });

  afterEach(async () => {
    await system.close();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  function writeLicenseFile() {
    writeFileSync(join(userDataDir, 'license.lic'), JSON.stringify({ payload: TEST_PAYLOAD, signature: 'irrelevant-mocked' }));
  }

  describe('checkLicenseStatus', () => {
    it('reports invalid with no graceExpired flag when no license file exists at all', async () => {
      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(false);
      expect(status.graceExpired).toBeUndefined();
    });

    it('reports valid for a license never registered with the portal (no activation_token) — the grace check is a no-op', async () => {
      writeLicenseFile();
      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(true);
      expect(status.payload?.licenseId).toBe('lic-test-001');
    });

    it('reports valid for a portal-registered activation checked in recently', async () => {
      writeLicenseFile();
      await activateLicenseOnlineSetup();
      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(true);
    });

    it('reports invalid with graceExpired: true once a portal-registered activation is stale beyond the grace window', async () => {
      writeLicenseFile();
      await activateLicenseOnlineSetup();
      const staleDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      await system.db.updateTable('license_activation').set({ last_validated_at: staleDate }).where('id', '=', 'default').execute();

      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(false);
      expect(status.graceExpired).toBe(true);
      expect(status.reason).toContain('30 days');
    });

    it('reports invalid with graceExpired: true when a portal-registered activation has never once checked in (last_validated_at null)', async () => {
      writeLicenseFile();
      await activateLicenseOnlineSetup();
      await system.db.updateTable('license_activation').set({ last_validated_at: null }).where('id', '=', 'default').execute();

      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(false);
      expect(status.graceExpired).toBe(true);
    });

    async function activateLicenseOnlineSetup() {
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: JSON.stringify({ payload: TEST_PAYLOAD, signature: 'x' }), activationToken: 'token-abc' } });
      const result = await activateLicenseOnline(system.db, paths, 'CODE123');
      expect(result.valid).toBe(true);
    }
  });

  describe('activateLicenseOnline', () => {
    it('returns invalid with the portal-supplied reason when the portal is unreachable — never throws', async () => {
      mockActivateOnline.mockResolvedValue({ reached: false, reason: "Couldn't reach the licensing portal — check your internet connection." });
      const status = await activateLicenseOnline(system.db, paths, 'CODE123');
      expect(status.valid).toBe(false);
      expect(status.reason).toMatch(/internet/i);
    });

    it('writes the license file and binds machine+token on a successful activation', async () => {
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: JSON.stringify({ payload: TEST_PAYLOAD, signature: 'x' }), activationToken: 'token-xyz' } });
      const status = await activateLicenseOnline(system.db, paths, 'CODE123');
      expect(status.valid).toBe(true);

      const row = await system.db.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirstOrThrow();
      expect(row.activation_token).toBe('token-xyz');
      expect(row.license_id).toBe('lic-test-001');
      expect(row.last_validated_at).not.toBeNull();
    });

    it('surfaces the local verify/bind failure (e.g. a bad signature) rather than silently reporting success', async () => {
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: 'not json at all', activationToken: 'token-xyz' } });
      mockVerifyLicenseFile.mockImplementation(() => {
        throw new Error('This is not a valid license file (not JSON).');
      });
      const status = await activateLicenseOnline(system.db, paths, 'CODE123');
      expect(status.valid).toBe(false);
      expect(status.reason).toMatch(/not a valid license file/);
    });
  });

  describe('attemptOnlineCheckin', () => {
    it('is a no-op when this activation never went through the portal (no activation_token)', async () => {
      writeLicenseFile();
      await checkLicenseStatus(system.db, paths); // creates the license_activation row with no activation_token
      await attemptOnlineCheckin(system.db);
      expect(mockCheckinOnline).not.toHaveBeenCalled();
    });

    it('leaves last_validated_at untouched when the portal is unreachable', async () => {
      writeLicenseFile();
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: JSON.stringify({ payload: TEST_PAYLOAD, signature: 'x' }), activationToken: 'token-abc' } });
      await activateLicenseOnline(system.db, paths, 'CODE123');
      const before = await system.db.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirstOrThrow();

      mockCheckinOnline.mockResolvedValue({ reached: false, reason: 'offline' });
      await attemptOnlineCheckin(system.db);

      const after = await system.db.selectFrom('license_activation').selectAll().where('id', '=', 'default').executeTakeFirstOrThrow();
      expect(after.last_validated_at).toBe(before.last_validated_at);
    });

    it('refreshes last_validated_at on a successful checkin', async () => {
      writeLicenseFile();
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: JSON.stringify({ payload: TEST_PAYLOAD, signature: 'x' }), activationToken: 'token-abc' } });
      await activateLicenseOnline(system.db, paths, 'CODE123');
      await system.db.updateTable('license_activation').set({ last_validated_at: new Date(0).toISOString() }).where('id', '=', 'default').execute();

      mockCheckinOnline.mockResolvedValue({ reached: true, data: { ok: true, status: 'active' } });
      await attemptOnlineCheckin(system.db);

      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(true);
      expect(status.graceExpired).toBeUndefined();
    });

    it('forces the grace check to fail immediately on an explicit revoked response, rather than waiting out the window', async () => {
      writeLicenseFile();
      mockActivateOnline.mockResolvedValue({ reached: true, data: { licenseFileContents: JSON.stringify({ payload: TEST_PAYLOAD, signature: 'x' }), activationToken: 'token-abc' } });
      await activateLicenseOnline(system.db, paths, 'CODE123'); // just activated — last_validated_at is "now", well within grace

      mockCheckinOnline.mockResolvedValue({ reached: true, data: { ok: false, status: 'revoked' } });
      await attemptOnlineCheckin(system.db);

      const status = await checkLicenseStatus(system.db, paths);
      expect(status.valid).toBe(false);
      expect(status.graceExpired).toBe(true);
    });
  });
});
