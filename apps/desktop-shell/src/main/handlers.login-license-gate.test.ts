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
 * Isolated test for `login()`'s license/trial gate: it now blocks opening an
 * EXISTING company exactly like `createCompany` blocks making a new one —
 * either a valid license or an active trial is required, not just the
 * narrower "grace period expired" case session 30 originally added. This
 * closes the real remaining gap: a whole-folder clone (or a company that
 * outlived its trial with no license ever bought) previously stayed usable
 * forever, since only NEW company creation was ever gated. Everything past
 * this gate (real password/DEK verification) is unrelated, pre-existing
 * logic this file doesn't attempt to re-test — a login with no matching
 * app_user always fails with the same INVALID_CREDENTIALS message
 * regardless, which is exactly what distinguishes "the gate let it through"
 * from "the gate blocked it" below without needing a full credential-setup
 * fixture.
 */
vi.mock('@mhts/core-licensing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mhts/core-licensing')>();
  return { ...actual, verifyLicenseFile: vi.fn() };
});

import { verifyLicenseFile } from '@mhts/core-licensing';
import { login } from './handlers';

const mockVerifyLicenseFile = vi.mocked(verifyLicenseFile);

const TEST_PAYLOAD: LicensePayload = {
  licenseId: 'lic-test-001',
  issuedTo: 'Test Traders',
  brand: 'MHTSdigiXR',
  edition: 'PRO',
  maxCompanies: null,
  issuedAt: '2026-01-01',
  expiresAt: null,
};

const INVALID_CREDENTIALS = 'Invalid email or password';

describe('handlers: login() license grace-period gate', () => {
  let system: TempDbHandle<SystemDatabase>;
  let paths: AppPaths;
  let userDataDir: string;

  beforeEach(async () => {
    system = await createTempSystemDb();
    userDataDir = mkdtempSync(join(tmpdir(), 'mhts-login-gate-test-'));
    paths = { userDataDir, systemDbPath: '', systemKeyPath: '', companiesDir: '' };
    mockVerifyLicenseFile.mockReset().mockReturnValue(TEST_PAYLOAD);
  });

  afterEach(async () => {
    await system.close();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  async function insertCompany(id: string, isDemo: boolean) {
    await system.db
      .insertInto('company')
      .values({
        id,
        legal_name: 'Test Co',
        trade_name: null,
        entity_type: 'PROPRIETORSHIP',
        gstin: null,
        pan: null,
        tan: null,
        cin: null,
        state_code: null,
        gst_registration_type: 'REGULAR',
        financial_year_start_month: 4,
        base_currency: 'INR',
        db_file_path: join(userDataDir, `${id}.db`),
        is_active: 1 as unknown as boolean,
        is_demo: (isDemo ? 1 : 0) as unknown as boolean,
      })
      .execute();
  }

  async function insertTrial(startedDaysAgo: number) {
    await system.db
      .insertInto('trial_activation')
      .values({ id: 'default', started_at: new Date(Date.now() - startedDaysAgo * 24 * 60 * 60 * 1000).toISOString() })
      .execute();
  }

  async function registerStaleGraceExpiredLicense() {
    writeFileSync(join(userDataDir, 'license.lic'), JSON.stringify({ payload: TEST_PAYLOAD, signature: 'irrelevant-mocked' }));
    // Bypass the network activation call entirely — insert the bound+stale state directly,
    // exactly what checkLicenseStatus's grace check reads.
    await system.db
      .insertInto('license_activation')
      .values({
        id: 'default',
        license_id: TEST_PAYLOAD.licenseId,
        machine_id: (await import('node-machine-id')).machineIdSync(),
        activation_token: 'token-abc',
        last_validated_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .execute();
  }

  it('blocks login for a whole-folder clone bound to a different machine, once the trial has also ended', async () => {
    await insertCompany('company-clone', false);
    await insertTrial(100);
    writeFileSync(join(userDataDir, 'license.lic'), JSON.stringify({ payload: TEST_PAYLOAD, signature: 'irrelevant-mocked' }));
    // Simulates copying the whole install folder (license.lic + system DB) onto a second
    // machine: the stored machine_id is whatever the ORIGINAL machine's real id was, which
    // will never match this test process's own real machineIdSync() value — exactly the
    // mismatch verifyAndBind is designed to catch.
    await system.db
      .insertInto('license_activation')
      .values({ id: 'default', license_id: TEST_PAYLOAD.licenseId, machine_id: 'some-other-machines-id', activation_token: 'token-abc', last_validated_at: new Date().toISOString() })
      .execute();

    await expect(login(system.db, paths, { companyId: 'company-clone', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(/valid license is required/i);
  });

  it('blocks login for a real company once its portal-registered license has gone past its grace period', async () => {
    await insertCompany('company-1', false);
    await registerStaleGraceExpiredLicense();

    await expect(login(system.db, paths, { companyId: 'company-1', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(/reconnect|30 days/i);
  });

  it('does NOT block login for a demo company even with a grace-expired license', async () => {
    await insertCompany('demo-1', true);
    await registerStaleGraceExpiredLicense();

    // Falls through to the (pre-existing, unrelated) credential check and fails there instead —
    // proves the license gate itself was skipped for the demo company.
    await expect(login(system.db, paths, { companyId: 'demo-1', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(INVALID_CREDENTIALS);
  });

  it('blocks login for a real company with no license at all once the trial has also ended', async () => {
    await insertCompany('company-2', false);
    await insertTrial(100);
    // No license.lic written at all, no license_activation row — checkLicenseStatus reports
    // invalid without graceExpired, so this exercises the broader "not valid AND trial not
    // active" branch rather than the grace-specific one.

    await expect(login(system.db, paths, { companyId: 'company-2', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(/valid license is required/i);
  });

  it('does NOT block login when there is no license at all but the trial is still active', async () => {
    await insertCompany('company-2b', false);
    await insertTrial(1);
    // Same "no license" state as above, but the trial window (created-during-trial company)
    // still covers it — falls through to the pre-existing credential check instead.

    await expect(login(system.db, paths, { companyId: 'company-2b', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(INVALID_CREDENTIALS);
  });

  it('does NOT block login when the portal-registered license is still within its grace period', async () => {
    await insertCompany('company-3', false);
    writeFileSync(join(userDataDir, 'license.lic'), JSON.stringify({ payload: TEST_PAYLOAD, signature: 'irrelevant-mocked' }));
    await system.db
      .insertInto('license_activation')
      .values({
        id: 'default',
        license_id: TEST_PAYLOAD.licenseId,
        machine_id: (await import('node-machine-id')).machineIdSync(),
        activation_token: 'token-abc',
        last_validated_at: new Date().toISOString(),
      })
      .execute();

    await expect(login(system.db, paths, { companyId: 'company-3', email: 'nobody@example.com', password: 'irrelevant' })).rejects.toThrow(INVALID_CREDENTIALS);
  });
});
