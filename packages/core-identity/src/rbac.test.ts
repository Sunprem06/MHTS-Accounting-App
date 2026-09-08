import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { FOUNDATION_PERMISSIONS, createRole, listAllPermissions, listRolesWithPermissions, resolvePermissions, seedAdminRole, updateRolePermissions } from './rbac';

describe('core-identity: RBAC (seedAdminRole / resolvePermissions / createRole / updateRolePermissions)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let adminRoleId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    // seedAdminRole is also what populates the `permission` table itself
    // (there's no separate "seed permissions" step) — every test needs this
    // to run first, even ones not directly exercising the Admin role.
    adminRoleId = await seedAdminRole(companyDb);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('seedAdminRole grants every foundation permission to the new Admin role', async () => {
    const permissions = await resolvePermissions(companyDb, adminRoleId);
    for (const permission of FOUNDATION_PERMISSIONS) {
      expect(permissions).toContain(permission.code);
    }
  });

  it('a freshly created custom role with an empty permission list resolves to zero permissions', async () => {
    const roleId = await createRole(companyDb, 'Read-Only Auditor', [], null);
    const permissions = await resolvePermissions(companyDb, roleId);
    expect(permissions).toEqual([]);
  });

  it('createRole with a specific permission subset resolves to exactly that subset, nothing more', async () => {
    const somePermissionCode = FOUNDATION_PERMISSIONS[0].code;
    const roleId = await createRole(companyDb, 'Limited Role', [somePermissionCode], null);
    const permissions = await resolvePermissions(companyDb, roleId);
    expect(permissions).toEqual([somePermissionCode]);
  });

  it('createRole rejects a duplicate role name', async () => {
    await createRole(companyDb, 'Duplicate Name', [], null);
    await expect(createRole(companyDb, 'Duplicate Name', [], null)).rejects.toThrow(/already exists/);
  });

  it('createRole rejects an unknown permission code rather than silently ignoring it', async () => {
    await expect(createRole(companyDb, 'Bad Role', ['NOT.A.REAL.PERMISSION'], null)).rejects.toThrow(/do not exist/);
  });

  it('updateRolePermissions replaces the role\'s permission set entirely, not additively', async () => {
    const roleId = await createRole(companyDb, 'Evolving Role', [FOUNDATION_PERMISSIONS[0].code], null);
    await updateRolePermissions(companyDb, roleId, [FOUNDATION_PERMISSIONS[1].code], null);
    const permissions = await resolvePermissions(companyDb, roleId);
    expect(permissions).toEqual([FOUNDATION_PERMISSIONS[1].code]);
    expect(permissions).not.toContain(FOUNDATION_PERMISSIONS[0].code);
  });

  it('the built-in Admin (system) role can never be edited — protects against a company locking itself out', async () => {
    await expect(updateRolePermissions(companyDb, adminRoleId, [], null)).rejects.toThrow(/cannot be edited/);
  });

  it('listAllPermissions returns every foundation permission after seeding', async () => {
    const all = await listAllPermissions(companyDb);
    const codes = all.map((p) => p.code);
    for (const permission of FOUNDATION_PERMISSIONS) {
      expect(codes).toContain(permission.code);
    }
  });

  it('listRolesWithPermissions lists both the seeded Admin role and a custom role, each with its own permission set', async () => {
    await createRole(companyDb, 'Custom Role', [FOUNDATION_PERMISSIONS[0].code], null);
    const roles = await listRolesWithPermissions(companyDb);
    const names = roles.map((r) => r.name);
    expect(names).toContain('Admin');
    expect(names).toContain('Custom Role');
  });

  it('two independently created roles never share resolved permissions unless explicitly assigned the same ones', async () => {
    const roleA = await createRole(companyDb, 'Role A', [FOUNDATION_PERMISSIONS[0].code], null);
    const roleB = await createRole(companyDb, 'Role B', [FOUNDATION_PERMISSIONS[1].code], null);
    const permsA = await resolvePermissions(companyDb, roleA);
    const permsB = await resolvePermissions(companyDb, roleB);
    expect(permsA).not.toEqual(permsB);
  });
});
