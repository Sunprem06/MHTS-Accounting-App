import { listAllPermissions as coreListAllPermissions, listRolesWithPermissions as coreListRolesWithPermissions, createRole as coreCreateRole, updateRolePermissions as coreUpdateRolePermissions } from '@mhts/core-identity';
import { session } from './session';
import type { CreateRoleInput, PermissionSummary, RoleWithPermissionsSummary, UpdateRolePermissionsInput } from '../shared/ipc';

function requireManageRoles() {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes('SYSTEM.MANAGE_ROLES')) {
    throw new Error('You do not have permission to manage roles for this company');
  }
  return { info, companyDb };
}

export async function listAllPermissions(): Promise<PermissionSummary[]> {
  const { companyDb } = requireManageRoles();
  return coreListAllPermissions(companyDb);
}

export async function listRolesWithPermissions(): Promise<RoleWithPermissionsSummary[]> {
  const { companyDb } = requireManageRoles();
  return coreListRolesWithPermissions(companyDb);
}

export async function createRole(input: CreateRoleInput): Promise<string> {
  const { info, companyDb } = requireManageRoles();
  return coreCreateRole(companyDb, input.name, input.permissionCodes, info.userId);
}

export async function updateRolePermissions(input: UpdateRolePermissionsInput): Promise<void> {
  const { info, companyDb } = requireManageRoles();
  return coreUpdateRolePermissions(companyDb, input.roleId, input.permissionCodes, info.userId);
}
