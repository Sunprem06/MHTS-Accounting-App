import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';

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

export interface PermissionSummary {
  code: string;
  description: string | null;
}

export interface RoleWithPermissionsSummary {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissionCodes: string[];
}

/** Every permission code any module has granted at company creation — each module inserts its own rows into this shared table (grantAccountingPermissions, grantSalesPurchasePermissions, ...), so this table is always the complete, current list. */
export async function listAllPermissions(companyDb: Kysely<CompanyDatabase>): Promise<PermissionSummary[]> {
  const rows = await companyDb.selectFrom('permission').select(['code', 'description']).orderBy('code').execute();
  return rows;
}

export async function listRolesWithPermissions(companyDb: Kysely<CompanyDatabase>): Promise<RoleWithPermissionsSummary[]> {
  const roles = await companyDb.selectFrom('role').selectAll().orderBy('name').execute();
  return Promise.all(
    roles.map(async (role) => ({
      id: role.id,
      name: role.name,
      isSystemRole: Boolean(role.is_system_role),
      permissionCodes: await resolvePermissions(companyDb, role.id),
    })),
  );
}

async function permissionIdsForCodes(companyDb: Kysely<CompanyDatabase>, codes: string[]): Promise<string[]> {
  if (codes.length === 0) {
    return [];
  }
  const rows = await companyDb.selectFrom('permission').select('id').where('code', 'in', codes).execute();
  if (rows.length !== new Set(codes).size) {
    throw new Error('One or more permission codes do not exist');
  }
  return rows.map((row) => row.id);
}

/** Creates a new, non-system role with the given permission set — atomic (role + role_permission rows together), auditable. */
export async function createRole(companyDb: Kysely<CompanyDatabase>, name: string, permissionCodes: string[], actorUserId: string | null): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Role name is required');
  }
  const existing = await companyDb.selectFrom('role').select('id').where('name', '=', trimmedName).executeTakeFirst();
  if (existing) {
    throw new Error('A role with this name already exists');
  }

  const permissionIds = await permissionIdsForCodes(companyDb, permissionCodes);
  const roleId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    await trx.insertInto('role').values({ id: roleId, name: trimmedName, is_system_role: 0 }).execute();
    for (const permissionId of permissionIds) {
      await trx.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
    }
    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'Role', entityId: roleId, afterData: { name: trimmedName, permissionCodes } });
  });

  return roleId;
}

/** Replaces a non-system role's entire permission set. System roles (the seeded Admin) are never editable here — changing what "Admin" grants is exactly the kind of mistake that could lock every user in a company out of managing it. */
export async function updateRolePermissions(companyDb: Kysely<CompanyDatabase>, roleId: string, permissionCodes: string[], actorUserId: string | null): Promise<void> {
  const role = await companyDb.selectFrom('role').selectAll().where('id', '=', roleId).executeTakeFirst();
  if (!role) {
    throw new Error('Role not found');
  }
  if (role.is_system_role) {
    throw new Error('The built-in Admin role cannot be edited');
  }

  const permissionIds = await permissionIdsForCodes(companyDb, permissionCodes);
  const before = await resolvePermissions(companyDb, roleId);

  await companyDb.transaction().execute(async (trx) => {
    await trx.deleteFrom('role_permission').where('role_id', '=', roleId).execute();
    for (const permissionId of permissionIds) {
      await trx.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
    }
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'Role', entityId: roleId, beforeData: { permissionCodes: before }, afterData: { permissionCodes } });
  });
}
