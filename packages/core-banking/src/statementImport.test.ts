import { describe, expect, it } from 'vitest';
import { mapStatementRows, parseBankStatementCsv } from './statementImport';
import type { StatementColumnMapping } from './types';

describe('core-banking: parseBankStatementCsv (RFC4180-aware splitter)', () => {
  it('splits a simple comma-separated file into headers + rows', () => {
    const { headers, rows } = parseBankStatementCsv('Date,Description,Amount\n01/12/2025,Salary,50000\n02/12/2025,Rent,-15000\n');
    expect(headers).toEqual(['Date', 'Description', 'Amount']);
    expect(rows).toEqual([
      ['01/12/2025', 'Salary', '50000'],
      ['02/12/2025', 'Rent', '-15000'],
    ]);
  });

  it('handles a quoted field containing a comma', () => {
    const { rows } = parseBankStatementCsv('Date,Description,Amount\n01/12/2025,"Payment, ref #123",1000\n');
    expect(rows[0]).toEqual(['01/12/2025', 'Payment, ref #123', '1000']);
  });

  it('handles doubled-quote escaping inside a quoted field', () => {
    const { rows } = parseBankStatementCsv('Date,Description\n01/12/2025,"He said ""hi"""\n');
    expect(rows[0][1]).toBe('He said "hi"');
  });

  it('handles a quoted field containing an embedded newline', () => {
    const { rows } = parseBankStatementCsv('Date,Description\n01/12/2025,"Line one\nLine two"\n');
    expect(rows[0][1]).toBe('Line one\nLine two');
  });

  it('handles CRLF line endings the same as LF', () => {
    const { rows } = parseBankStatementCsv('Date,Amount\r\n01/12/2025,100\r\n02/12/2025,200\r\n');
    expect(rows).toHaveLength(2);
  });

  it('skips blank rows', () => {
    const { rows } = parseBankStatementCsv('Date,Amount\n01/12/2025,100\n\n\n02/12/2025,200\n');
    expect(rows).toHaveLength(2);
  });
});

describe('core-banking: mapStatementRows', () => {
  const singleWithTypeMapping: StatementColumnMapping = {
    dateColumnIndex: 0,
    descriptionColumnIndex: 1,
    amountMode: 'single-with-type',
    amountColumnIndex: 2,
    typeColumnIndex: 3,
    dateFormat: 'DD/MM/YYYY',
  };

  it('single-with-type mode: a CR type produces a CREDIT line, DR produces DEBIT, amount always positive', () => {
    const lines = mapStatementRows(
      [
        ['01/12/2025', 'Salary', '50,000.00', 'CR'],
        ['02/12/2025', 'Rent', '15000', 'DR'],
      ],
      singleWithTypeMapping,
    );
    expect(lines).toEqual([
      { statementDate: '2025-12-01', description: 'Salary', amountPaise: 5_000_000, direction: 'CREDIT' },
      { statementDate: '2025-12-02', description: 'Rent', amountPaise: 1_500_000, direction: 'DEBIT' },
    ]);
  });

  const separateColumnsMapping: StatementColumnMapping = {
    dateColumnIndex: 0,
    descriptionColumnIndex: 1,
    amountMode: 'separate-debit-credit',
    debitColumnIndex: 2,
    creditColumnIndex: 3,
    dateFormat: 'DD/MM/YYYY',
  };

  it('separate-debit-credit mode: a value in the credit column produces CREDIT, debit column produces DEBIT', () => {
    const lines = mapStatementRows(
      [
        ['01/12/2025', 'Salary', '', '50000'],
        ['02/12/2025', 'Rent', '15000', ''],
      ],
      separateColumnsMapping,
    );
    expect(lines[0]).toMatchObject({ direction: 'CREDIT', amountPaise: 5_000_000 });
    expect(lines[1]).toMatchObject({ direction: 'DEBIT', amountPaise: 1_500_000 });
  });

  it('a blank/zero-amount row is silently dropped (not a real movement)', () => {
    const lines = mapStatementRows([['01/12/2025', 'Nothing happened', '', '']], separateColumnsMapping);
    expect(lines).toHaveLength(0);
  });

  it('a row with no date is skipped', () => {
    const lines = mapStatementRows([['', 'Missing date', '100', '']], separateColumnsMapping);
    expect(lines).toHaveLength(0);
  });

  it('normalizes DD/MM/YYYY, YYYY-MM-DD, and MM/DD/YYYY date formats to ISO', () => {
    const ddmm = mapStatementRows([['25/03/2025', 'x', '100', '']], { ...separateColumnsMapping, dateFormat: 'DD/MM/YYYY' });
    expect(ddmm[0].statementDate).toBe('2025-03-25');

    const mmdd = mapStatementRows([['03/25/2025', 'x', '100', '']], { ...separateColumnsMapping, dateFormat: 'MM/DD/YYYY' });
    expect(mmdd[0].statementDate).toBe('2025-03-25');

    const iso = mapStatementRows([['2025-03-25', 'x', '100', '']], { ...separateColumnsMapping, dateFormat: 'YYYY-MM-DD' });
    expect(iso[0].statementDate).toBe('2025-03-25');
  });

  it('handles a 2-digit year by assuming 20xx', () => {
    const lines = mapStatementRows([['25/03/25', 'x', '100', '']], { ...separateColumnsMapping, dateFormat: 'DD/MM/YYYY' });
    expect(lines[0].statementDate).toBe('2025-03-25');
  });

  it('strips thousands-separator commas from amounts', () => {
    const lines = mapStatementRows([['01/12/2025', 'Big deposit', '', '12,34,567.89']], separateColumnsMapping);
    expect(lines[0].amountPaise).toBe(1_234_567_89);
  });
});
