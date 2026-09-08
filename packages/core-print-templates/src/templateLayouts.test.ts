import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { getActiveTemplateLayout, listTemplateLayoutVersions, revertTemplateLayout, saveTemplateLayoutVersion } from './templateLayouts';

describe('core-print-templates: saveTemplateLayoutVersion (append-only supersede, same pattern as bill_of_material/salary_structure)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
  });

  afterEach(async () => {
    await handle.close();
  });

  it('no active layout initially — falls back to null (the caller falls through to the default CLASSIC/MODERN renderer)', async () => {
    expect(await getActiveTemplateLayout(companyDb, 'SALES_INVOICE')).toBeNull();
  });

  it('saving a layout makes it the active one, with the exact layout payload round-tripping', async () => {
    const layout = { elements: [{ type: 'text', field: 'invoiceNumber' }] };
    await saveTemplateLayoutVersion(companyDb, { documentFamily: 'SALES_INVOICE', name: 'My Custom Layout', layout }, null);

    const active = await getActiveTemplateLayout(companyDb, 'SALES_INVOICE');
    expect(active).not.toBeNull();
    expect(active!.layout).toEqual(layout);
    expect(active!.name).toBe('My Custom Layout');
  });

  it('a second save SUPERSEDES the first — never edits in place, both versions remain in history', async () => {
    await saveTemplateLayoutVersion(companyDb, { documentFamily: 'SALES_INVOICE', name: 'v1', layout: { v: 1 } }, null);
    await saveTemplateLayoutVersion(companyDb, { documentFamily: 'SALES_INVOICE', name: 'v2', layout: { v: 2 } }, null);

    const active = await getActiveTemplateLayout(companyDb, 'SALES_INVOICE');
    expect(active!.name).toBe('v2');

    const versions = await listTemplateLayoutVersions(companyDb, 'SALES_INVOICE');
    expect(versions).toHaveLength(2);
  });

  it('document families are independent — saving one never affects another', async () => {
    await saveTemplateLayoutVersion(companyDb, { documentFamily: 'SALES_INVOICE', name: 'invoice layout', layout: { v: 1 } }, null);
    expect(await getActiveTemplateLayout(companyDb, 'VOUCHER')).toBeNull();
  });

  it('revertTemplateLayout supersedes the active version with no replacement — falls back to null (default renderer)', async () => {
    await saveTemplateLayoutVersion(companyDb, { documentFamily: 'SALES_INVOICE', name: 'v1', layout: { v: 1 } }, null);
    await revertTemplateLayout(companyDb, 'SALES_INVOICE', null);
    expect(await getActiveTemplateLayout(companyDb, 'SALES_INVOICE')).toBeNull();
  });

  it('reverting an already-untouched family is a safe no-op, not an error', async () => {
    await expect(revertTemplateLayout(companyDb, 'PAYSLIP', null)).resolves.not.toThrow();
  });
});
