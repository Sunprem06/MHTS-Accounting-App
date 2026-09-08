import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import {
  setExchangeRate as coreSetExchangeRate,
  listActiveExchangeRates as coreListActiveExchangeRates,
  listExchangeRateVersions as coreListExchangeRateVersions,
  previewFxRevaluation as corePreviewFxRevaluation,
  postFxRevaluation as corePostFxRevaluation,
  listFxRevaluationRuns as coreListFxRevaluationRuns,
} from '@mhts/core-multi-currency';
import { requireSessionWithCompanyDb } from './session';
import type { ExchangeRateVersionSummary, FxRevaluationPreviewResult, FxRevaluationRunResult, RunFxRevaluationInput, SetExchangeRateInput } from '../shared/ipc';

const MICROS_PER_UNIT = 1_000_000;
const PAISE_PER_RUPEE = 100;
const microsToRate = (micros: number): number => micros / MICROS_PER_UNIT;
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

function toIpcRateVersion(row: Awaited<ReturnType<typeof coreListActiveExchangeRates>>[number]): ExchangeRateVersionSummary {
  return { id: row.id, currency: row.currency, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, version: row.version, rate: microsToRate(row.rateMicros), sourceReference: row.sourceReference };
}

export async function setExchangeRate(systemDb: Kysely<SystemDatabase>, input: SetExchangeRateInput): Promise<string> {
  const { info } = requireSessionWithCompanyDb('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES');
  return coreSetExchangeRate(systemDb, { currency: input.currency, effectiveFrom: input.effectiveFrom, rateMicros: Math.round(input.rate * MICROS_PER_UNIT), sourceReference: input.sourceReference }, info.userId);
}

export async function listActiveExchangeRates(systemDb: Kysely<SystemDatabase>): Promise<ExchangeRateVersionSummary[]> {
  requireSessionWithCompanyDb('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES');
  const rows = await coreListActiveExchangeRates(systemDb);
  return rows.map(toIpcRateVersion);
}

export async function listExchangeRateVersions(systemDb: Kysely<SystemDatabase>, currency: string): Promise<ExchangeRateVersionSummary[]> {
  requireSessionWithCompanyDb('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES');
  const rows = await coreListExchangeRateVersions(systemDb, currency);
  return rows.map(toIpcRateVersion);
}

function toIpcLineDetail(line: { ledgerId: string; ledgerName: string; currency: string; foreignBalance: number; baseBalanceBefore: number; baseBalanceAfter: number; adjustmentAmount: number }) {
  return {
    ledgerId: line.ledgerId,
    ledgerName: line.ledgerName,
    currency: line.currency,
    foreignBalanceUnits: paiseToRupees(line.foreignBalance),
    baseBalanceBeforeRupees: paiseToRupees(line.baseBalanceBefore),
    baseBalanceAfterRupees: paiseToRupees(line.baseBalanceAfter),
    adjustmentAmountRupees: paiseToRupees(line.adjustmentAmount),
  };
}

export async function previewFxRevaluation(systemDb: Kysely<SystemDatabase>, input: RunFxRevaluationInput): Promise<FxRevaluationPreviewResult> {
  const { companyDb } = requireSessionWithCompanyDb('MULTI_CURRENCY.RUN_REVALUATION');
  const result = await corePreviewFxRevaluation(companyDb, systemDb, input.asOfDate);
  return { asOfDate: result.asOfDate, lines: result.lines.map(toIpcLineDetail), totalAdjustmentMagnitudeRupees: paiseToRupees(result.totalAdjustmentMagnitude) };
}

export async function postFxRevaluation(systemDb: Kysely<SystemDatabase>, input: RunFxRevaluationInput): Promise<FxRevaluationRunResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('MULTI_CURRENCY.RUN_REVALUATION');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.asOfDate));
  const result = await corePostFxRevaluation(companyDb, systemDb, { asOfDate: input.asOfDate, financialYear }, info.userId);
  return { id: result.id, runDate: result.runDate, financialYear: result.financialYear, voucherId: result.voucherId, lines: result.lines.map(toIpcLineDetail) };
}

export async function listFxRevaluationRuns(): Promise<{ id: string; runDate: string; financialYear: string; voucherId: string | null }[]> {
  const { companyDb } = requireSessionWithCompanyDb('MULTI_CURRENCY.RUN_REVALUATION');
  return coreListFxRevaluationRuns(companyDb);
}
