import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { clearCompanyLogo, getCompanyLetterheadProfile, getCompanyLogo, seedDefaultCompanyLetterheadProfile, setCompanyLogo, updateCompanyLetterheadProfile } from './companyProfile';

describe('core-company-profile: letterhead profile + logo blob (smoke)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedDefaultCompanyLetterheadProfile(companyDb);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('the seeded singleton profile is readable immediately after seeding', async () => {
    const profile = await getCompanyLetterheadProfile(companyDb);
    expect(profile).toBeDefined();
  });

  it('updateCompanyLetterheadProfile only changes the fields provided, leaving others untouched', async () => {
    await updateCompanyLetterheadProfile(companyDb, { address: '123 Main St', phone: '9999999999' }, null);
    const afterFirstUpdate = await getCompanyLetterheadProfile(companyDb);
    expect(afterFirstUpdate.address).toBe('123 Main St');
    expect(afterFirstUpdate.phone).toBe('9999999999');

    await updateCompanyLetterheadProfile(companyDb, { email: 'test@example.com' }, null);
    const afterSecondUpdate = await getCompanyLetterheadProfile(companyDb);
    expect(afterSecondUpdate.address).toBe('123 Main St'); // untouched by the second, narrower update
    expect(afterSecondUpdate.email).toBe('test@example.com');
  });

  it('a logo blob round-trips byte-for-byte, including its mime type', async () => {
    const logoBytes = Buffer.from([137, 80, 78, 71, 0, 1, 254, 255]); // PNG-magic-ish bytes with edge values
    await setCompanyLogo(companyDb, logoBytes, 'image/png', null);

    const logo = await getCompanyLogo(companyDb);
    expect(logo).not.toBeNull();
    expect(logo!.data.equals(logoBytes)).toBe(true);
    expect(logo!.mimeType).toBe('image/png');
  });

  it('no logo initially resolves to null, not an error', async () => {
    expect(await getCompanyLogo(companyDb)).toBeNull();
  });

  it('clearCompanyLogo removes a previously-set logo', async () => {
    await setCompanyLogo(companyDb, Buffer.from('logo-bytes'), 'image/png', null);
    await clearCompanyLogo(companyDb, null);
    expect(await getCompanyLogo(companyDb)).toBeNull();
  });
});
