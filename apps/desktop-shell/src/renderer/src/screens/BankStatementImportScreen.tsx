import { useEffect, useState } from 'react';
import type {
  BankAccountSummary,
  ReconcilableLineRow,
  SessionInfo,
  StatementColumnMapping,
  StatementImportSummary,
  StatementLineSummary,
  StatementPreview,
} from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function defaultMapping(): StatementColumnMapping {
  return {
    dateColumnIndex: 0,
    descriptionColumnIndex: 1,
    amountMode: 'separate-debit-credit',
    debitColumnIndex: 2,
    creditColumnIndex: 3,
    dateFormat: 'DD/MM/YYYY',
  };
}

export function BankStatementImportScreen({ session, onBack }: Props) {
  const [accounts, setAccounts] = useState<BankAccountSummary[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [candidateLines, setCandidateLines] = useState<ReconcilableLineRow[]>([]);

  const [pickedFile, setPickedFile] = useState<{ fileName: string; csvText: string } | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [mapping, setMapping] = useState<StatementColumnMapping>(defaultMapping());

  const [pastImports, setPastImports] = useState<StatementImportSummary[]>([]);
  const [viewingLines, setViewingLines] = useState<StatementLineSummary[] | null>(null);
  const [viewingImportId, setViewingImportId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canImport = session.permissions.includes('BANKING.IMPORT_STATEMENT');
  const selectedAccount = accounts.find((account) => account.id === bankAccountId);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listBankAccounts();
      if (result.ok && result.data) {
        setAccounts(result.data);
        setBankAccountId(result.data[0]?.id ?? '');
      }
    })();
  }, []);

  useEffect(() => {
    if (!bankAccountId) {
      return;
    }
    (async () => {
      const [importsResult, account] = await Promise.all([window.mhts.listStatementImports(bankAccountId), Promise.resolve(accounts.find((a) => a.id === bankAccountId))]);
      if (importsResult.ok && importsResult.data) {
        setPastImports(importsResult.data);
      }
      if (account) {
        const linesResult = await window.mhts.listReconcilableLines({ bankLedgerId: account.ledgerAccountId });
        if (linesResult.ok && linesResult.data) {
          setCandidateLines(linesResult.data);
        }
      }
    })();
    setViewingLines(null);
    setViewingImportId(null);
    setPickedFile(null);
    setPreview(null);
  }, [bankAccountId, accounts.length]);

  function candidateLabel(voucherLineId: string): string {
    const line = candidateLines.find((l) => l.voucherLineId === voucherLineId);
    if (!line) {
      return voucherLineId;
    }
    const amount = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
    return `${line.voucherType} #${line.voucherNumber} — ${line.voucherDate} — ₹${amount.toFixed(2)}`;
  }

  async function handlePickFile() {
    setError(null);
    const result = await window.mhts.pickStatementFile();
    if (!result.ok) {
      setError(result.error ?? 'Failed to read file');
      return;
    }
    if (!result.data) {
      return; // cancelled
    }
    setPickedFile(result.data);
    const previewResult = await window.mhts.previewStatementCsv(result.data.csvText);
    if (previewResult.ok && previewResult.data) {
      setPreview(previewResult.data);
    } else {
      setError(previewResult.error ?? 'Failed to parse CSV');
    }
  }

  async function handleImport() {
    if (!pickedFile || !bankAccountId) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await window.mhts.importStatementFile({ bankAccountId, fileName: pickedFile.fileName, csvText: pickedFile.csvText, mapping });
    setBusy(false);
    if (result.ok && result.data) {
      setViewingImportId(result.data.import.id);
      setViewingLines(result.data.lines);
      setPickedFile(null);
      setPreview(null);
      const importsResult = await window.mhts.listStatementImports(bankAccountId);
      if (importsResult.ok && importsResult.data) {
        setPastImports(importsResult.data);
      }
    } else {
      setError(result.error ?? 'Failed to import statement');
    }
  }

  async function handleViewImport(importId: string) {
    setError(null);
    setViewingImportId(importId);
    const result = await window.mhts.getStatementImportLines(importId);
    if (result.ok && result.data) {
      setViewingLines(result.data);
    } else {
      setError(result.error ?? 'Failed to load import lines');
    }
  }

  async function handleResolve(statementLineId: string, voucherLineId: string | null) {
    setError(null);
    const result = await window.mhts.resolveStatementLineMatch({ statementLineId, voucherLineId });
    if (result.ok && viewingImportId) {
      await handleViewImport(viewingImportId);
    } else if (!result.ok) {
      setError(result.error ?? 'Failed to resolve match');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 960 }}>
      <h1>Bank statement import</h1>
      <p>
        <label>
          Bank account{' '}
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.ledgerName} ({account.bankName})
              </option>
            ))}
          </select>
        </label>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {canImport && (
        <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 24 }}>
          <h2>Import a statement file</h2>
          <button type="button" onClick={handlePickFile} disabled={!bankAccountId}>
            Choose CSV file…
          </button>
          {pickedFile && <span style={{ marginLeft: 8 }}>{pickedFile.fileName}</span>}

          {preview && (
            <div style={{ marginTop: 16 }}>
              <h3>Column mapping</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: 12 }}>
                <thead>
                  <tr>
                    {preview.headers.map((header, i) => (
                      <th key={i} style={{ textAlign: 'left', border: '1px solid #ddd' }}>
                        [{i}] {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} style={{ border: '1px solid #ddd' }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <label>
                Date column{' '}
                <select value={mapping.dateColumnIndex} onChange={(e) => setMapping((m) => ({ ...m, dateColumnIndex: Number(e.target.value) }))}>
                  {preview.headers.map((header, i) => (
                    <option key={i} value={i}>
                      [{i}] {header}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <label>
                Date format{' '}
                <select value={mapping.dateFormat} onChange={(e) => setMapping((m) => ({ ...m, dateFormat: e.target.value as StatementColumnMapping['dateFormat'] }))}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </label>{' '}
              <label>
                Description column{' '}
                <select value={mapping.descriptionColumnIndex} onChange={(e) => setMapping((m) => ({ ...m, descriptionColumnIndex: Number(e.target.value) }))}>
                  {preview.headers.map((header, i) => (
                    <option key={i} value={i}>
                      [{i}] {header}
                    </option>
                  ))}
                </select>
              </label>
              <br />
              <label>
                Amount layout{' '}
                <select value={mapping.amountMode} onChange={(e) => setMapping((m) => ({ ...m, amountMode: e.target.value as StatementColumnMapping['amountMode'] }))}>
                  <option value="separate-debit-credit">Separate Withdrawal/Deposit columns</option>
                  <option value="single-with-type">Single Amount + Dr/Cr column</option>
                </select>
              </label>
              <br />
              {mapping.amountMode === 'separate-debit-credit' ? (
                <>
                  <label>
                    Withdrawal (debit) column{' '}
                    <select value={mapping.debitColumnIndex ?? ''} onChange={(e) => setMapping((m) => ({ ...m, debitColumnIndex: Number(e.target.value) }))}>
                      {preview.headers.map((header, i) => (
                        <option key={i} value={i}>
                          [{i}] {header}
                        </option>
                      ))}
                    </select>
                  </label>{' '}
                  <label>
                    Deposit (credit) column{' '}
                    <select value={mapping.creditColumnIndex ?? ''} onChange={(e) => setMapping((m) => ({ ...m, creditColumnIndex: Number(e.target.value) }))}>
                      {preview.headers.map((header, i) => (
                        <option key={i} value={i}>
                          [{i}] {header}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Amount column{' '}
                    <select value={mapping.amountColumnIndex ?? ''} onChange={(e) => setMapping((m) => ({ ...m, amountColumnIndex: Number(e.target.value) }))}>
                      {preview.headers.map((header, i) => (
                        <option key={i} value={i}>
                          [{i}] {header}
                        </option>
                      ))}
                    </select>
                  </label>{' '}
                  <label>
                    Dr/Cr type column{' '}
                    <select value={mapping.typeColumnIndex ?? ''} onChange={(e) => setMapping((m) => ({ ...m, typeColumnIndex: Number(e.target.value) }))}>
                      {preview.headers.map((header, i) => (
                        <option key={i} value={i}>
                          [{i}] {header}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <p>
                <button type="button" onClick={handleImport} disabled={busy}>
                  {busy ? 'Importing…' : 'Import'}
                </button>
              </p>
            </div>
          )}
        </div>
      )}

      {viewingLines && (
        <div style={{ marginBottom: 24 }}>
          <h2>Import result {viewingImportId ? `(${viewingImportId})` : ''}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Description</th>
                <th style={{ textAlign: 'left' }}>Dir.</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Matched to / resolve</th>
              </tr>
            </thead>
            <tbody>
              {viewingLines.map((line) => (
                <tr key={line.id} style={{ background: line.isLikelyDuplicate ? '#fff8e1' : undefined }}>
                  <td>{line.statementDate}</td>
                  <td>{line.description}</td>
                  <td>{line.direction}</td>
                  <td style={{ textAlign: 'right' }}>{line.amount.toFixed(2)}</td>
                  <td>
                    {line.matchStatus}
                    {line.isLikelyDuplicate ? ' (possible duplicate)' : ''}
                  </td>
                  <td>
                    {line.matchStatus === 'MATCHED' && line.matchedVoucherLineId ? (
                      <>
                        {candidateLabel(line.matchedVoucherLineId)}{' '}
                        {canImport && (
                          <button type="button" onClick={() => handleResolve(line.id, null)}>
                            Unmatch
                          </button>
                        )}
                      </>
                    ) : canImport ? (
                      <>
                        <select defaultValue="" onChange={(e) => e.target.value && handleResolve(line.id, e.target.value)}>
                          <option value="">
                            {line.candidateVoucherLineIds && line.candidateVoucherLineIds.length > 0 ? 'Choose a match…' : 'No candidates found'}
                          </option>
                          {(line.candidateVoucherLineIds ?? []).map((id) => (
                            <option key={id} value={id}>
                              {candidateLabel(id)}
                            </option>
                          ))}
                        </select>{' '}
                        <button type="button" onClick={() => handleResolve(line.id, null)}>
                          Ignore
                        </button>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Past imports</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>File</th>
            <th style={{ textAlign: 'left' }}>Imported</th>
            <th style={{ textAlign: 'right' }}>Lines</th>
            <th style={{ textAlign: 'right' }}>Matched</th>
            <th style={{ textAlign: 'right' }}>Unmatched</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pastImports.map((imp) => (
            <tr key={imp.id}>
              <td>{imp.fileName}</td>
              <td>{imp.importedAt}</td>
              <td style={{ textAlign: 'right' }}>{imp.totalLines}</td>
              <td style={{ textAlign: 'right' }}>{imp.matchedLines}</td>
              <td style={{ textAlign: 'right' }}>{imp.unmatchedLines}</td>
              <td>
                <button type="button" onClick={() => handleViewImport(imp.id)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedAccount && (
        <p style={{ marginTop: 8, color: '#666' }}>
          Matching is exact-amount and direction-aware within a 7-day window; ambiguous or unmatched lines are left for manual resolution above — never guessed.
        </p>
      )}

      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
