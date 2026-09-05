import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from './ledgerBalances';
import { computeProfitAndLoss } from './profitAndLoss';
import type { BalanceSheet, BalanceSheetRow } from './types';

/**
 * Assets = Liabilities + Equity, as of a date. Since this phase doesn't
 * implement period-closing entries into a real retained-earnings ledger, net
 * profit/loss since inception is added as a synthetic "Current Earnings"
 * line under Equity — the standard mechanic for an interim (not yet closed)
 * balance sheet to actually balance.
 */
export async function computeBalanceSheet(companyDb: Kysely<CompanyDatabase>, asOfDate: string): Promise<BalanceSheet> {
  const balances = await computeLedgerBalances(companyDb, { natures: ['ASSET', 'LIABILITY', 'EQUITY'], toDate: asOfDate });

  const assetRows: BalanceSheetRow[] = [];
  const liabilityRows: BalanceSheetRow[] = [];
  const equityRows: BalanceSheetRow[] = [];
  let totalAssets = 0;
  let totalLiabilitiesAndEquity = 0;

  for (const balance of balances) {
    if (balance.nature === 'ASSET') {
      const row: BalanceSheetRow = { ledgerId: balance.ledgerId, ledgerName: balance.ledgerName, groupName: balance.groupName, nature: 'ASSET', amount: balance.netSigned };
      assetRows.push(row);
      totalAssets += row.amount;
    } else {
      // Liabilities and Equity are credit-normal — flip to a credit-positive presentation.
      const amount = -balance.netSigned;
      const row: BalanceSheetRow = { ledgerId: balance.ledgerId, ledgerName: balance.ledgerName, groupName: balance.groupName, nature: balance.nature, amount };
      if (balance.nature === 'LIABILITY') {
        liabilityRows.push(row);
      } else {
        equityRows.push(row);
      }
      totalLiabilitiesAndEquity += amount;
    }
  }

  const profitAndLoss = await computeProfitAndLoss(companyDb, { toDate: asOfDate });
  totalLiabilitiesAndEquity += profitAndLoss.netProfit;

  return {
    asOfDate,
    assetRows,
    liabilityRows,
    equityRows,
    currentEarnings: profitAndLoss.netProfit,
    totalAssets,
    totalLiabilitiesAndEquity,
  };
}
