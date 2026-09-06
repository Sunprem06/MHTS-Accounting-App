import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const INVENTORY_PERMISSIONS = [
  { code: 'INVENTORY.MANAGE_ITEMS', description: 'Create and edit items and item batches' },
  { code: 'INVENTORY.MANAGE_WAREHOUSES', description: 'Create and edit warehouses' },
  { code: 'INVENTORY.MANAGE_UNITS', description: 'Create and edit units of measure' },
  { code: 'INVENTORY.RECORD_OPENING_STOCK', description: 'Record opening stock quantities and values' },
  { code: 'INVENTORY.ADJUST_STOCK', description: 'Post stock adjustments (damage, physical count corrections)' },
  { code: 'INVENTORY.TRANSFER_STOCK', description: 'Transfer stock between warehouses' },
  { code: 'INVENTORY.VIEW_REPORTS', description: 'View stock summary, movement register and valuation reports' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantInventoryPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of INVENTORY_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
