// Phase 8 Increment 3 (Advanced ERP): Manufacturing — core BOM + a single
// consume/produce voucher. Pure TypeScript, zero Electron/UI dependency
// (Rule #1) — enforced by Nx module boundaries.
export { createBillOfMaterial, listBillsOfMaterial } from './billOfMaterials';
export { postManufacturingJournalInTransaction, postManufacturingJournal, listManufacturingJournals, getManufacturingJournalMovements } from './manufacturingJournal';
export { MANUFACTURING_PERMISSIONS, grantManufacturingPermissions } from './permissions';
export type {
  BillOfMaterialLineInput,
  CreateBillOfMaterialInput,
  BillOfMaterialLineSummary,
  BillOfMaterialSummary,
  PostManufacturingJournalInput,
  ManufacturingJournalSummary,
  ManufacturingJournalMovementSummary,
} from './types';
