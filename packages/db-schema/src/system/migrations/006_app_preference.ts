import { Kysely, sql } from 'kysely';

/** Singleton table (one row, id 'default') for installation-wide UI preferences — currently just the theme. Same pattern as security_policy: a dedicated typed table per concern, not a generic key-value blob. */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('app_preference')
    .addColumn('id', 'text', (col) => col.primaryKey())
    /** 'LIGHT' | 'DARK' | 'SYSTEM' — validated in application code, not a DB CHECK. */
    .addColumn('theme', 'text', (col) => col.notNull().defaultTo('SYSTEM'))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.insertInto('app_preference').values({ id: 'default' }).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('app_preference').execute();
}
