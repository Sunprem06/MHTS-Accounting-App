import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { upsertReconciliationInTransaction } from './reconciliation';
import type { ImportStatementResult, MatchStatus, ParsedStatementLine, StatementColumnMapping, StatementDirection, StatementImportSummary, StatementLineSummary } from './types';

/** better-sqlite3 cannot bind raw JS booleans as query parameters — same convention as core-sales-purchase's gstReturns.ts/receivablesPayables.ts. */
const IS_FALSE = 0 as unknown as boolean;

/**
 * Small RFC4180-aware CSV splitter — handles quoted fields containing
 * commas/newlines and doubled-quote escaping. No npm dependency: real bank
 * exports are simple enough that a ~40-line parser covers them, and it
 * keeps this a pure, dependency-free core-* function (Rule #1 — file
 * reading itself stays in the Electron main process, this only ever sees
 * already-read text).
 */
export function parseBankStatementCsv(csvText: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  const [headers, ...dataRows] = nonEmptyRows;
  return { headers: headers ?? [], rows: dataRows };
}

function normalizeStatementDate(raw: string, format: StatementColumnMapping['dateFormat']): string {
  const trimmed = raw.trim();
  if (format === 'YYYY-MM-DD') {
    return trimmed;
  }
  const parts = trimmed.split(/[/\-.]/);
  if (parts.length !== 3) {
    throw new Error(`Cannot parse statement date "${raw}" with format ${format}`);
  }
  const [a, b, c] = parts;
  const year = c.length === 2 ? `20${c}` : c;
  if (format === 'DD/MM/YYYY') {
    return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`; // MM/DD/YYYY
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[,\s]/g, '')) || 0;
}

/**
 * Normalizes either common Indian-bank CSV shape (a single Amount + Dr/Cr
 * column, or separate Withdrawal/Deposit columns) to the same
 * ParsedStatementLine shape, in the BANK's own direction terminology (see
 * types.ts's STATEMENT_DIRECTIONS doc comment).
 */
export function mapStatementRows(rows: string[][], mapping: StatementColumnMapping): ParsedStatementLine[] {
  const lines: ParsedStatementLine[] = [];

  for (const row of rows) {
    const rawDate = row[mapping.dateColumnIndex];
    if (!rawDate || !rawDate.trim()) {
      continue;
    }
    const description = (row[mapping.descriptionColumnIndex] ?? '').trim();
    const statementDate = normalizeStatementDate(rawDate, mapping.dateFormat);

    let amountPaise = 0;
    let direction: StatementDirection;

    if (mapping.amountMode === 'single-with-type') {
      const amountRaw = row[mapping.amountColumnIndex ?? -1] ?? '0';
      const typeRaw = (row[mapping.typeColumnIndex ?? -1] ?? '').trim().toUpperCase();
      amountPaise = Math.round(Math.abs(parseAmount(amountRaw)) * 100);
      direction = typeRaw.startsWith('CR') ? 'CREDIT' : 'DEBIT';
    } else {
      const debitValue = parseAmount(row[mapping.debitColumnIndex ?? -1] ?? '');
      const creditValue = parseAmount(row[mapping.creditColumnIndex ?? -1] ?? '');
      if (creditValue > 0) {
        amountPaise = Math.round(creditValue * 100);
        direction = 'CREDIT';
      } else {
        amountPaise = Math.round(debitValue * 100);
        direction = 'DEBIT';
      }
    }

    if (amountPaise <= 0) {
      continue; // a blank/zero row — not a real movement
    }

    lines.push({ statementDate, description, amountPaise, direction });
  }

  return lines;
}

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const MATCH_WINDOW_DAYS = 7;

/**
 * Candidate voucher_line rows this statement line could correspond to:
 * exact amount match (paise, never fuzzy — "to the paisa" is the whole
 * point), correct direction (statement CREDIT ⇒ our debit_amount, DEBIT ⇒
 * our credit_amount — see types.ts's STATEMENT_DIRECTIONS comment), unreconciled,
 * within a date window (a cheque can clear days after being written).
 */
async function findMatchCandidates(
  db: Kysely<CompanyDatabase>,
  bankLedgerId: string,
  amountPaise: number,
  direction: StatementDirection,
  statementDate: string,
): Promise<string[]> {
  const fromDate = shiftDate(statementDate, -MATCH_WINDOW_DAYS);
  const toDate = shiftDate(statementDate, MATCH_WINDOW_DAYS);

  let query = db
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .leftJoin('bank_reconciliation', 'bank_reconciliation.voucher_line_id', 'voucher_line.id')
    .select(['voucher_line.id as id'])
    .where('voucher_line.ledger_id', '=', bankLedgerId)
    .where('voucher.voucher_date', '>=', fromDate)
    .where('voucher.voucher_date', '<=', toDate)
    .where(({ eb, or }) => or([eb('bank_reconciliation.is_reconciled', 'is', null), eb('bank_reconciliation.is_reconciled', '=', IS_FALSE)]));

  query = direction === 'CREDIT' ? query.where('voucher_line.debit_amount', '=', amountPaise) : query.where('voucher_line.credit_amount', '=', amountPaise);

  const rows = await query.execute();
  return rows.map((row) => row.id);
}

/**
 * Persists one imported statement (batch + lines) and attempts to
 * auto-reconcile confident (single-candidate) matches — all as ONE
 * transaction (Rule #4): the import record, every line, and any
 * reconciliation it triggers either all land or none do.
 */
export async function importStatementLines(
  companyDb: Kysely<CompanyDatabase>,
  bankAccountId: string,
  parsedLines: ParsedStatementLine[],
  fileName: string,
  actorUserId: string | null,
): Promise<ImportStatementResult> {
  const bankAccount = await companyDb.selectFrom('bank_account').select('ledger_account_id').where('id', '=', bankAccountId).executeTakeFirstOrThrow();
  const bankLedgerId = bankAccount.ledger_account_id;
  const importId = randomUUID();

  const lines = await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('bank_statement_import')
      .values({
        id: importId,
        bank_account_id: bankAccountId,
        file_name: fileName,
        imported_by: actorUserId,
        total_lines: parsedLines.length,
        matched_lines: 0,
        unmatched_lines: 0,
      })
      .execute();

    const summaries: StatementLineSummary[] = [];
    let matchedCount = 0;

    for (const parsed of parsedLines) {
      const duplicate = await trx
        .selectFrom('bank_statement_line')
        .select('id')
        .where('bank_account_id', '=', bankAccountId)
        .where('statement_date', '=', parsed.statementDate)
        .where('amount_paise', '=', parsed.amountPaise)
        .where('description', '=', parsed.description)
        .executeTakeFirst();

      const candidates = await findMatchCandidates(trx, bankLedgerId, parsed.amountPaise, parsed.direction, parsed.statementDate);
      const matchStatus: MatchStatus = candidates.length === 1 ? 'MATCHED' : 'UNMATCHED';
      const matchedVoucherLineId = matchStatus === 'MATCHED' ? candidates[0] : null;

      const lineId = randomUUID();
      await trx
        .insertInto('bank_statement_line')
        .values({
          id: lineId,
          import_id: importId,
          bank_account_id: bankAccountId,
          statement_date: parsed.statementDate,
          description: parsed.description,
          amount_paise: parsed.amountPaise,
          direction: parsed.direction,
          match_status: matchStatus,
          matched_voucher_line_id: matchedVoucherLineId,
          is_likely_duplicate: duplicate ? 1 : 0,
        })
        .execute();

      if (matchedVoucherLineId) {
        await upsertReconciliationInTransaction(trx, matchedVoucherLineId, true, parsed.statementDate, 'IMPORT', actorUserId);
        matchedCount++;
      }

      summaries.push({
        id: lineId,
        importId,
        statementDate: parsed.statementDate,
        description: parsed.description,
        amountPaise: parsed.amountPaise,
        direction: parsed.direction,
        matchStatus,
        matchedVoucherLineId,
        isLikelyDuplicate: Boolean(duplicate),
        candidateVoucherLineIds: matchStatus === 'UNMATCHED' ? candidates : undefined,
      });
    }

    await trx
      .updateTable('bank_statement_import')
      .set({ matched_lines: matchedCount, unmatched_lines: parsedLines.length - matchedCount })
      .where('id', '=', importId)
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'BankStatementImport',
      entityId: importId,
      afterData: { bankAccountId, fileName, totalLines: parsedLines.length, matchedLines: matchedCount },
    });

    return summaries;
  });

  const matchedLines = lines.filter((line) => line.matchStatus === 'MATCHED').length;
  return {
    import: {
      id: importId,
      bankAccountId,
      fileName,
      importedAt: new Date().toISOString(),
      totalLines: parsedLines.length,
      matchedLines,
      unmatchedLines: parsedLines.length - matchedLines,
    },
    lines,
  };
}

/** Manual confirm/override for an ambiguous or unmatched statement line — pass null to mark it IGNORED (no corresponding ledger entry, e.g. a bank fee never recorded). Un-reconciles any previous match first, so re-pointing a line never leaves two voucher lines both claiming the same statement line. */
export async function resolveStatementLineMatch(companyDb: Kysely<CompanyDatabase>, statementLineId: string, voucherLineId: string | null, actorUserId: string | null): Promise<void> {
  await companyDb.transaction().execute(async (trx) => {
    const line = await trx.selectFrom('bank_statement_line').selectAll().where('id', '=', statementLineId).executeTakeFirstOrThrow();

    if (line.matched_voucher_line_id && line.matched_voucher_line_id !== voucherLineId) {
      await upsertReconciliationInTransaction(trx, line.matched_voucher_line_id, false, null, null, actorUserId);
    }
    if (voucherLineId) {
      await upsertReconciliationInTransaction(trx, voucherLineId, true, line.statement_date, 'IMPORT', actorUserId);
    }

    await trx
      .updateTable('bank_statement_line')
      .set({ match_status: voucherLineId ? 'MATCHED' : 'IGNORED', matched_voucher_line_id: voucherLineId })
      .where('id', '=', statementLineId)
      .execute();

    const siblingLines = await trx.selectFrom('bank_statement_line').select('match_status').where('import_id', '=', line.import_id).execute();
    const matchedCount = siblingLines.filter((sibling) => sibling.match_status === 'MATCHED').length;
    await trx
      .updateTable('bank_statement_import')
      .set({ matched_lines: matchedCount, unmatched_lines: siblingLines.length - matchedCount })
      .where('id', '=', line.import_id)
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'BankStatementLine',
      entityId: statementLineId,
      beforeData: { matchedVoucherLineId: line.matched_voucher_line_id },
      afterData: { matchedVoucherLineId: voucherLineId },
    });
  });
}

export async function listStatementImports(companyDb: Kysely<CompanyDatabase>, bankAccountId: string): Promise<StatementImportSummary[]> {
  return companyDb
    .selectFrom('bank_statement_import')
    .select([
      'id',
      'bank_account_id as bankAccountId',
      'file_name as fileName',
      'imported_at as importedAt',
      'total_lines as totalLines',
      'matched_lines as matchedLines',
      'unmatched_lines as unmatchedLines',
    ])
    .where('bank_account_id', '=', bankAccountId)
    .orderBy('imported_at', 'desc')
    .execute();
}

export async function getStatementImportLines(companyDb: Kysely<CompanyDatabase>, importId: string): Promise<StatementLineSummary[]> {
  const importRow = await companyDb.selectFrom('bank_statement_import').select('bank_account_id').where('id', '=', importId).executeTakeFirstOrThrow();
  const bankAccount = await companyDb.selectFrom('bank_account').select('ledger_account_id').where('id', '=', importRow.bank_account_id).executeTakeFirstOrThrow();

  const rows = await companyDb.selectFrom('bank_statement_line').selectAll().where('import_id', '=', importId).orderBy('statement_date', 'desc').execute();

  const summaries: StatementLineSummary[] = [];
  for (const row of rows) {
    const isUnmatched = row.match_status === 'UNMATCHED';
    summaries.push({
      id: row.id,
      importId: row.import_id,
      statementDate: row.statement_date,
      description: row.description,
      amountPaise: row.amount_paise,
      direction: row.direction as StatementDirection,
      matchStatus: row.match_status as MatchStatus,
      matchedVoucherLineId: row.matched_voucher_line_id,
      isLikelyDuplicate: Boolean(row.is_likely_duplicate),
      candidateVoucherLineIds: isUnmatched
        ? await findMatchCandidates(companyDb, bankAccount.ledger_account_id, row.amount_paise, row.direction as StatementDirection, row.statement_date)
        : undefined,
    });
  }
  return summaries;
}
