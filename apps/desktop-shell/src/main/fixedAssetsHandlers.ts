import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import {
  createAssetClass as coreCreateAssetClass,
  listAssetClasses as coreListAssetClasses,
  acquireFixedAsset as coreAcquireFixedAsset,
  listFixedAssets as coreListFixedAssets,
  getAssetDepreciationSchedule as coreGetAssetDepreciationSchedule,
  disposeFixedAsset as coreDisposeFixedAsset,
  previewDepreciationRun as corePreviewDepreciationRun,
  postDepreciationRun as corePostDepreciationRun,
  createOrUpdateFixedAssetRate as coreCreateOrUpdateFixedAssetRate,
  listActiveFixedAssetRates as coreListActiveFixedAssetRates,
  listFixedAssetRateVersions as coreListFixedAssetRateVersions,
} from '@mhts/core-fixed-assets';
import type { ItWdvBlockRatePayload, Schedule2RatePayload } from '@mhts/core-fixed-assets';
import { session } from './session';
import type {
  AcquireFixedAssetInput,
  AssetClassSummary,
  AssetDepreciationEntrySummary,
  CreateAssetClassInput,
  CreateOrUpdateFixedAssetRateInput,
  DepreciationPreviewLine,
  DisposeFixedAssetInput,
  FixedAssetRateVersionSummary,
  FixedAssetSummary,
  PostDepreciationResult,
  RunDepreciationInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

export async function createAssetClass(input: CreateAssetClassInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSET_CLASSES');
  return coreCreateAssetClass(companyDb, input);
}

export async function listAssetClasses(): Promise<AssetClassSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSETS');
  return coreListAssetClasses(companyDb);
}

export async function acquireFixedAsset(systemDb: Kysely<SystemDatabase>, input: AcquireFixedAssetInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSETS');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.purchaseDate));

  return coreAcquireFixedAsset(
    companyDb,
    {
      assetClassId: input.assetClassId,
      name: input.name,
      assetCode: input.assetCode,
      purchaseDate: input.purchaseDate,
      purchaseCostPaise: rupeesToPaise(input.purchaseCostRupees),
      salvageValuePaise: input.salvageValueRupees !== undefined ? rupeesToPaise(input.salvageValueRupees) : undefined,
      costCentreId: input.costCentreId,
      financialYear,
      paidFromLedgerId: input.paidFromLedgerId,
      narration: input.narration,
    },
    info.userId,
  );
}

export async function listFixedAssets(): Promise<FixedAssetSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSETS');
  const assets = await coreListFixedAssets(companyDb);
  return assets.map((asset) => ({ ...asset, purchaseCost: paiseToRupees(asset.purchaseCostPaise), salvageValue: paiseToRupees(asset.salvageValuePaise) }));
}

export async function getAssetDepreciationSchedule(assetId: string): Promise<AssetDepreciationEntrySummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSETS');
  const entries = await coreGetAssetDepreciationSchedule(companyDb, assetId);
  return entries.map((entry) => ({
    book: entry.book,
    financialYear: entry.financialYear,
    openingWdv: paiseToRupees(entry.openingWdvPaise),
    depreciationAmount: paiseToRupees(entry.depreciationAmountPaise),
    closingWdv: paiseToRupees(entry.closingWdvPaise),
    voucherId: entry.voucherId,
  }));
}

export async function disposeFixedAsset(systemDb: Kysely<SystemDatabase>, input: DisposeFixedAssetInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSETS');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.disposalDate));
  return coreDisposeFixedAsset(
    companyDb,
    {
      assetId: input.assetId,
      disposalDate: input.disposalDate,
      financialYear,
      saleProceedsPaise: rupeesToPaise(input.saleProceedsRupees),
      receiptLedgerId: input.receiptLedgerId,
      narration: input.narration,
    },
    info.userId,
  );
}

export async function previewDepreciationRun(systemDb: Kysely<SystemDatabase>, input: RunDepreciationInput): Promise<DepreciationPreviewLine[]> {
  const { info, companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.RUN_DEPRECIATION');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const preview = await corePreviewDepreciationRun(companyDb, systemDb, input.financialYear, startMonth);
  return preview.map((line) => ({
    assetId: line.assetId,
    assetName: line.assetName,
    assetCode: line.assetCode,
    schedule2Depreciation: paiseToRupees(line.schedule2DepreciationPaise),
    itWdvDepreciation: paiseToRupees(line.itWdvDepreciationPaise),
  }));
}

export async function postDepreciationRun(systemDb: Kysely<SystemDatabase>, input: RunDepreciationInput): Promise<PostDepreciationResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('FIXED_ASSETS.RUN_DEPRECIATION');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  return corePostDepreciationRun(companyDb, systemDb, input.financialYear, startMonth, info.userId);
}

export async function createOrUpdateFixedAssetRate(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdateFixedAssetRateInput): Promise<string> {
  const { info } = requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSET_CLASSES');
  // The renderer's rate-editor form (mirroring ManagePayrollRulesScreen's raw-JSON pattern) is
  // responsible for shaping the payload to match `book` — this boundary trusts that shape, same
  // as core-payroll-engine's createOrUpdatePayrollRule accepting an `unknown` IPC payload.
  return coreCreateOrUpdateFixedAssetRate(systemDb, { ...input, payload: input.payload as Schedule2RatePayload | ItWdvBlockRatePayload }, info.userId);
}

export async function listActiveFixedAssetRates(systemDb: Kysely<SystemDatabase>): Promise<FixedAssetRateVersionSummary[]> {
  requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSET_CLASSES');
  return coreListActiveFixedAssetRates(systemDb);
}

export async function listFixedAssetRateVersions(systemDb: Kysely<SystemDatabase>, ruleType: string): Promise<FixedAssetRateVersionSummary[]> {
  requireSessionWithCompanyDb('FIXED_ASSETS.MANAGE_ASSET_CLASSES');
  return coreListFixedAssetRateVersions(systemDb, ruleType);
}
