import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { getCompanyPayrollSettings, stickGratuityApplicabilityIfCrossed } from './companySettings';
import { countActiveEmployees } from './employees';
import { resolveEsiRule, resolveGratuityEligibilityRule, resolvePfRule } from './rules';
import type { ResolvedApplicability } from './types';

/**
 * Answers the "does a shop this size even need this scheme" question
 * directly: PF/ESI/Gratuity each have a statutory headcount threshold under
 * Indian law (20/10/10 employees respectively, by default) — a company
 * below it is exempt unless it opts in (ALWAYS) or has already crossed the
 * threshold at some point (gratuity's sticky rule — see companySettings.ts).
 * PT and salary TDS have NO headcount threshold, so they're not modeled here
 * at all; they're resolved unconditionally by their own compute functions.
 */
export async function resolveApplicability(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<ResolvedApplicability> {
  const settings = await getCompanyPayrollSettings(companyDb);
  const activeEmployeeCount = await countActiveEmployees(companyDb);

  const [pfRule, esiRule, gratuityRule] = await Promise.all([resolvePfRule(systemDb, asOfDate), resolveEsiRule(systemDb, asOfDate), resolveGratuityEligibilityRule(systemDb, asOfDate)]);

  const pfApplies = settings.pfApplicability === 'ALWAYS' || (settings.pfApplicability === 'AUTO' && activeEmployeeCount >= pfRule.applicabilityMinEmployees);
  const esiApplies = settings.esiApplicability === 'ALWAYS' || (settings.esiApplicability === 'AUTO' && activeEmployeeCount >= esiRule.applicabilityMinEmployees);
  const gratuityCrossedNow = activeEmployeeCount >= gratuityRule.applicabilityMinEmployees;
  const gratuityApplies = settings.gratuityApplicability === 'ALWAYS' || (settings.gratuityApplicability === 'AUTO' && gratuityCrossedNow);

  if (settings.gratuityApplicability === 'AUTO' && gratuityCrossedNow) {
    // Sticky rule: once crossed, persist ALWAYS so a later headcount dip never silently turns gratuity back off.
    await stickGratuityApplicabilityIfCrossed(companyDb);
  }

  return {
    pfApplies,
    esiApplies,
    gratuityApplies,
    activeEmployeeCount,
    pfThreshold: pfRule.applicabilityMinEmployees,
    esiThreshold: esiRule.applicabilityMinEmployees,
    gratuityThreshold: gratuityRule.applicabilityMinEmployees,
  };
}
