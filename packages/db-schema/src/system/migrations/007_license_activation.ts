import { Kysely, sql } from 'kysely';

/**
 * Local hardware-binding record (Blueprint §2: Ed25519 license files +
 * node-machine-id binding, validated locally). The signed license file
 * itself carries no machine id (the app never holds the private key needed
 * to re-sign one in) — instead, the first successful verification of a
 * given licenseId on this install records the current machine's id here;
 * every later check compares against it. A different machineId for the
 * SAME licenseId means the license (and this system DB) was copied to a
 * second machine — rejected. Loading a DIFFERENT (still valid) licenseId
 * overwrites this row, which is the legitimate "license was renewed/
 * upgraded" path, not a bypass.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('license_activation')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('license_id', 'text', (col) => col.notNull())
    .addColumn('machine_id', 'text', (col) => col.notNull())
    .addColumn('activated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('license_activation').execute();
}
