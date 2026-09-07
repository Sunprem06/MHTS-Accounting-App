import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { TEMPLATE_FAMILIES } from './types';
import type { PrintTemplateLayoutSummary, SaveTemplateLayoutInput, TemplateFamily } from './types';

// better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans — same cast as core-manufacturing's billOfMaterials.ts.
const IS_ACTIVE = 1 as unknown as boolean;
const IS_INACTIVE = 0 as unknown as boolean;

function toSummary(row: { id: string; document_family: string; version: number; name: string | null; layout_json: string; is_active: boolean; created_by: string | null; created_at: string }): PrintTemplateLayoutSummary {
  return {
    id: row.id,
    documentFamily: row.document_family as TemplateFamily,
    version: row.version,
    name: row.name,
    layout: JSON.parse(row.layout_json),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Creates a new layout version for a document family, deactivating any
 * existing active layout for that family first — append-only supersede-on-
 * new-version, same pattern as bill_of_material/salary_structure/asset_class
 * (never edit a version in place). `input.layout` is stored as opaque JSON;
 * this package never validates its internal shape (that's @mhts/print-
 * templates's job when it renders).
 */
export async function saveTemplateLayoutVersion(companyDb: Kysely<CompanyDatabase>, input: SaveTemplateLayoutInput, actorUserId: string | null): Promise<string> {
  if (!TEMPLATE_FAMILIES.includes(input.documentFamily)) {
    throw new Error(`Unknown document family: ${input.documentFamily}`);
  }

  return companyDb.transaction().execute(async (trx) => {
    const previous = await trx.selectFrom('print_template_layout').select(['version']).where('document_family', '=', input.documentFamily).orderBy('version', 'desc').executeTakeFirst();

    await trx.updateTable('print_template_layout').set({ is_active: IS_INACTIVE }).where('document_family', '=', input.documentFamily).where('is_active', '=', IS_ACTIVE).execute();

    const id = randomUUID();
    const nextVersion = (previous?.version ?? 0) + 1;
    await trx
      .insertInto('print_template_layout')
      .values({
        id,
        document_family: input.documentFamily,
        version: nextVersion,
        name: input.name,
        layout_json: JSON.stringify(input.layout),
        is_active: IS_ACTIVE,
        created_by: actorUserId,
      })
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'PrintTemplateLayout',
      entityId: id,
      afterData: { documentFamily: input.documentFamily, version: nextVersion, name: input.name },
    });

    return id;
  });
}

export async function getActiveTemplateLayout(companyDb: Kysely<CompanyDatabase>, documentFamily: TemplateFamily): Promise<PrintTemplateLayoutSummary | null> {
  const row = await companyDb.selectFrom('print_template_layout').selectAll().where('document_family', '=', documentFamily).where('is_active', '=', IS_ACTIVE).executeTakeFirst();
  return row ? toSummary(row) : null;
}

export async function listTemplateLayoutVersions(companyDb: Kysely<CompanyDatabase>, documentFamily: TemplateFamily): Promise<PrintTemplateLayoutSummary[]> {
  const rows = await companyDb.selectFrom('print_template_layout').selectAll().where('document_family', '=', documentFamily).orderBy('version', 'desc').execute();
  return rows.map(toSummary);
}

/** Deactivates the family's active custom layout with no replacement — the print path then falls back to the family's CLASSIC/MODERN choice again. A no-op (not an error) if the family has no active custom layout. */
export async function revertTemplateLayout(companyDb: Kysely<CompanyDatabase>, documentFamily: TemplateFamily, actorUserId: string | null): Promise<void> {
  return companyDb.transaction().execute(async (trx) => {
    const active = await trx.selectFrom('print_template_layout').select(['id']).where('document_family', '=', documentFamily).where('is_active', '=', IS_ACTIVE).executeTakeFirst();
    if (!active) {
      return;
    }
    await trx.updateTable('print_template_layout').set({ is_active: IS_INACTIVE }).where('id', '=', active.id).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'PrintTemplateLayout', entityId: active.id, afterData: { reverted: true } });
  });
}
