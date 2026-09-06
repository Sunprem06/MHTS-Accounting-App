// Phase 5 (Banking): bank accounts, cheque/UTR tracking, reconciliation,
// bank statement CSV import. Pure TypeScript, zero Electron/UI dependency
// (Rule #1) — enforced by Nx module boundaries.
export { ACCOUNT_TYPES, INSTRUMENT_TYPES, INSTRUMENT_STATUSES, STATEMENT_DIRECTIONS, MATCH_STATUSES, MATCHED_VIA } from './types';
export type {
  AccountType,
  InstrumentType,
  InstrumentStatus,
  StatementDirection,
  MatchStatus,
  MatchedVia,
  BankAccountSummary,
  CreateBankAccountInput,
  PaymentInstrumentInput,
  PaymentInstrumentSummary,
  ReconcilableLineRow,
  BankReconciliationStatement,
  ParsedStatementLine,
  StatementColumnMapping,
  StatementImportSummary,
  StatementLineSummary,
  ImportStatementResult,
} from './types';

export { BANKING_PERMISSIONS, grantBankingPermissions } from './permissions';

export { createBankAccount, listBankAccounts, getBankAccountByLedgerId } from './bankAccounts';

export { attachPaymentInstrumentInTransaction, recordVoucherWithInstrument, updateInstrumentStatus, listPaymentInstruments } from './paymentInstruments';

export {
  listReconcilableLines,
  markLineReconciled,
  markLineUnreconciled,
  upsertReconciliationInTransaction,
  computeBankReconciliationStatement,
} from './reconciliation';

export {
  parseBankStatementCsv,
  mapStatementRows,
  importStatementLines,
  resolveStatementLineMatch,
  listStatementImports,
  getStatementImportLines,
} from './statementImport';
