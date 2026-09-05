import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('company')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('legal_name', 'text', (col) => col.notNull())
    .addColumn('trade_name', 'text')
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('gstin', 'text')
    .addColumn('pan', 'text')
    .addColumn('tan', 'text')
    .addColumn('cin', 'text')
    .addColumn('state_code', 'text')
    .addColumn('financial_year_start_month', 'integer', (col) => col.notNull().defaultTo(4))
    .addColumn('base_currency', 'text', (col) => col.notNull().defaultTo('INR'))
    .addColumn('db_file_path', 'text', (col) => col.notNull().unique())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('app_user')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('company_access')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('app_user_id', 'text', (col) => col.notNull().references('app_user.id'))
    .addColumn('company_id', 'text', (col) => col.notNull().references('company.id'))
    .addColumn('role_id', 'text', (col) => col.notNull())
    .addColumn('granted_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('revoked_at', 'text')
    .execute();

  await db.schema
    .createIndex('company_access_user_company_idx')
    .on('company_access')
    .columns(['app_user_id', 'company_id'])
    .execute();

  await db.schema
    .createTable('rule_set')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('rule_type', 'text', (col) => col.notNull())
    .addColumn('jurisdiction', 'text')
    .addColumn('effective_from', 'text', (col) => col.notNull())
    .addColumn('effective_to', 'text')
    .addColumn('rule_payload', 'text', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('source_reference', 'text')
    .addColumn('superseded_by_id', 'text')
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('rule_set_lookup_idx')
    .on('rule_set')
    .columns(['rule_type', 'jurisdiction', 'effective_from'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('rule_set').execute();
  await db.schema.dropTable('company_access').execute();
  await db.schema.dropTable('app_user').execute();
  await db.schema.dropTable('company').execute();
}
