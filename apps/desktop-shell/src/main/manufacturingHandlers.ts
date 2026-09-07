import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import {
  createBillOfMaterial as coreCreateBillOfMaterial,
  listBillsOfMaterial as coreListBillsOfMaterial,
  postManufacturingJournal as corePostManufacturingJournal,
  listManufacturingJournals as coreListManufacturingJournals,
  getManufacturingJournalMovements as coreGetManufacturingJournalMovements,
} from '@mhts/core-manufacturing';
import { session } from './session';
import type {
  BillOfMaterialSummary,
  CreateBillOfMaterialInput,
  ManufacturingJournalMovementSummary,
  ManufacturingJournalSummary,
  PostManufacturingJournalInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const THOUSANDTHS_PER_UNIT = 1000;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
const unitsToThousandths = (units: number): number => Math.round(units * THOUSANDTHS_PER_UNIT);
const thousandthsToUnits = (thousandths: number): number => thousandths / THOUSANDTHS_PER_UNIT;

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

export async function createBillOfMaterial(input: CreateBillOfMaterialInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('MANUFACTURING.MANAGE_BOM');
  return coreCreateBillOfMaterial(
    companyDb,
    {
      outputItemId: input.outputItemId,
      outputQuantityThousandths: unitsToThousandths(input.outputQuantityUnits),
      lines: input.lines.map((line) => ({ componentItemId: line.componentItemId, quantityThousandths: unitsToThousandths(line.quantityUnits) })),
    },
    info.userId,
  );
}

export async function listBillsOfMaterial(): Promise<BillOfMaterialSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('MANUFACTURING.MANAGE_BOM');
  const boms = await coreListBillsOfMaterial(companyDb);
  return boms.map((bom) => ({
    ...bom,
    outputQuantityUnits: thousandthsToUnits(bom.outputQuantityThousandths),
    lines: bom.lines.map((line) => ({ ...line, quantityUnits: thousandthsToUnits(line.quantityThousandths) })),
  }));
}

export async function postManufacturingJournal(systemDb: Kysely<SystemDatabase>, input: PostManufacturingJournalInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('MANUFACTURING.POST_JOURNAL');
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', info.companyId).executeTakeFirstOrThrow();
  const financialYear = computeFinancialYearLabel(company.financial_year_start_month, new Date(input.journalDate));

  const result = await corePostManufacturingJournal(
    companyDb,
    {
      bomId: input.bomId,
      warehouseId: input.warehouseId,
      quantityProducedThousandths: unitsToThousandths(input.quantityProducedUnits),
      outputBatchNumber: input.outputBatchNumber,
      expiryDate: input.expiryDate,
      manufactureDate: input.manufactureDate,
      componentBatchIds: input.componentBatchIds,
      financialYear,
      journalDate: input.journalDate,
      narration: input.narration,
    },
    info.userId,
  );
  return result.journalId;
}

export async function listManufacturingJournals(): Promise<ManufacturingJournalSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('MANUFACTURING.POST_JOURNAL');
  const rows = await coreListManufacturingJournals(companyDb);
  return rows.map((row) => ({ ...row, quantityProducedUnits: thousandthsToUnits(row.quantityProducedThousandths), totalCost: paiseToRupees(row.totalCostPaise) }));
}

export async function getManufacturingJournalMovements(journalId: string): Promise<ManufacturingJournalMovementSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('MANUFACTURING.POST_JOURNAL');
  const rows = await coreGetManufacturingJournalMovements(companyDb, journalId);
  return rows.map((row) => ({ ...row, quantityUnits: thousandthsToUnits(row.quantityThousandths), ratePerUnit: paiseToRupees(row.ratePaise), value: paiseToRupees(row.valuePaise) }));
}
