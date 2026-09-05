import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('role')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('is_system_role', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('permission')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('code', 'text', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .execute();

  await db.schema
    .createTable('role_permission')
    .addColumn('role_id', 'text', (col) => col.notNull().references('role.id'))
    .addColumn('permission_id', 'text', (col) => col.notNull().references('permission.id'))
    .addPrimaryKeyConstraint('role_permission_pk', ['role_id', 'permission_id'])
    .execute();

  await db.schema
    .createTable('audit_log')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('actor_user_id', 'text')
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'text', (col) => col.notNull())
    .addColumn('before_data', 'text')
    .addColumn('after_data', 'text')
    .addColumn('timestamp', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('prev_hash', 'text')
    .addColumn('hash', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('audit_log_entity_idx')
    .on('audit_log')
    .columns(['entity_type', 'entity_id'])
    .execute();

  // Rule #5: audit_log is append-only — no UI path, including Super Admin, may
  // hard-delete or edit rows. Enforced here at the DB level (not just app
  // convention) so even a raw-SQL slip or a future admin tool can't violate it.
  await sql`
    CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE is not permitted');
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER audit_log_no_delete
    BEFORE DELETE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: DELETE is not permitted');
    END
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS audit_log_no_delete`.execute(db);
  await sql`DROP TRIGGER IF EXISTS audit_log_no_update`.execute(db);
  await db.schema.dropTable('audit_log').execute();
  await db.schema.dropTable('role_permission').execute();
  await db.schema.dropTable('permission').execute();
  await db.schema.dropTable('role').execute();
}
