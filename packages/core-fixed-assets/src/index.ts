// Phase 8 Increment 1 (Advanced ERP): Fixed Assets, dual depreciation.
// Pure TypeScript, zero Electron/UI dependency (Rule #1) — enforced by Nx module boundaries.
export { ASSET_STATUSES, DEPRECIATION_BOOKS } from './types';
export type {
  AssetStatus,
  DepreciationBook,
  Schedule2RatePayload,
  ItWdvBlockRatePayload,
  AssetClassSummary,
  CreateAssetClassInput,
  FixedAssetSummary,
  AcquireFixedAssetInput,
  AssetDepreciationEntrySummary,
  DisposeFixedAssetInput,
} from './types';
export {
  schedule2RuleType,
  itWdvBlockRuleType,
  seedDefaultFixedAssetRules,
  resolveSchedule2Rate,
  resolveItWdvBlockRate,
  createOrUpdateFixedAssetRate,
  listActiveFixedAssetRates,
  listFixedAssetRateVersions,
} from './rules';
export type { CreateOrUpdateFixedAssetRateInput, FixedAssetRateVersionSummary } from './rules';
export { computeSchedule2Depreciation, computeItWdvBlockDepreciation, daysBetweenInclusive } from './depreciationMath';
export type { DepreciationResult } from './depreciationMath';
export { createAssetClass, listAssetClasses } from './assetClasses';
export { acquireFixedAsset, listFixedAssets, getAssetDepreciationSchedule } from './fixedAssets';
export { previewDepreciationRun, postDepreciationRun } from './depreciation';
export type { AssetDepreciationPreviewLine } from './depreciation';
export { disposeFixedAsset } from './disposal';
export { FIXED_ASSETS_PERMISSIONS, grantFixedAssetsPermissions } from './permissions';
export { seedFixedAssetLedgers, getFixedAssetLedgerIds, DEPRECIATION_EXPENSE_LEDGER, PROFIT_LOSS_ON_ASSET_SALE_LEDGER } from './ledgers';
export type { FixedAssetLedgerIds } from './ledgers';
