import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

/**
 * Phase 0 (Foundation) permission set — system-level, not accounting/tax/payroll
 * logic, so this is a plain seed list rather than a RuleSet row (CLAUDE.md Rule #2
 * governs GST/payroll rates and statutory formulas, not RBAC permission codes).
 * Later phases add their own permission codes via their own migrations/seeds.
 */
export const FOUNDATION_PERMISSIONS = [
  { code: 'SYSTEM.MANAGE_COMPANY', description: 'Create and edit company profile' },
  { code: 'SYSTEM.MANAGE_USERS', description: 'Invite users and assign roles' },
  { code: 'SYSTEM.MANAGE_ROLES', description: 'Manage roles and their permissions' },
  { code: 'SYSTEM.VIEW_AUDIT_LOG', description: 'View the append-only audit trail' },
  { code: 'SYSTEM.RESET_USER_PASSWORD', description: "Reset another user's password within this company, offline" },
] as const;

/** Seeds the company DB's permission table (idempotent-ish: only called once, at company creation) and an Admin role with all of them. Returns the new role's id. */
export async function seedAdminRole(companyDb: Kysely<CompanyDatabase>): Promise<string> {
  const roleId = randomUUID();
  await companyDb
    .insertInto('role')
    // better-sqlite3 can only bind numbers/strings/bigints/buffers/null — not JS booleans.
    .values({ id: roleId, name: 'Admin', is_system_role: 1 })
    .execute();

  for (const permission of FOUNDATION_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }

  return roleId;
}

export async function resolvePermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<string[]> {
  const rows = await companyDb
    .selectFrom('role_permission')
    .innerJoin('permission', 'permission.id', 'role_permission.permission_id')
    .where('role_permission.role_id', '=', roleId)
    .select('permission.code')
    .execute();
  return rows.map((row) => row.code);
}
