// Phase 8 Increment 2 (Advanced ERP): Multi-Currency.
// Pure TypeScript, zero Electron/UI dependency (Rule #1) — enforced by Nx module boundaries.
export type { ExchangeRatePayload, ExchangeRateVersionSummary, FxRevaluationLineDetail, FxRevaluationPreview, FxRevaluationRunSummary } from './types';
export { fxRateRuleType, resolveExchangeRate, setExchangeRate, listActiveExchangeRates, listExchangeRateVersions, seedDefaultExchangeRates } from './exchangeRates';
export type { SetExchangeRateInput } from './exchangeRates';
export { previewFxRevaluation, postFxRevaluation, listFxRevaluationRuns } from './revaluation';
export { seedMultiCurrencyLedgers, getMultiCurrencyLedgerIds, REALIZED_FOREX_GAIN_LOSS_LEDGER, UNREALIZED_FOREX_GAIN_LOSS_LEDGER } from './ledgers';
export type { MultiCurrencyLedgerIds } from './ledgers';
export { MULTI_CURRENCY_PERMISSIONS, grantMultiCurrencyPermissions } from './permissions';
