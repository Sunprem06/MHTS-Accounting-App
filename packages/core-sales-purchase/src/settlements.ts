import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { convertForeignToBase, createVoucherInTransaction, foreignAmountForBase } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { getMultiCurrencyLedgerIds } from '@mhts/core-multi-currency';
import { writeAuditLog } from '@mhts/core-audit';

export interface OutstandingInvoiceRow {
  invoiceId: string;
  voucherId: string;
  voucherNumber: number;
  invoiceDate: string;
  /** Only meaningful for purchase invoices — null for sales invoices, which have no due date. */
  dueDate: string | null;
  partyId: string;
  partyName: string;
  /** Paise. Net of TDS for purchase invoices. */
  netAmount: number;
  /** Paise. Sum of prior settlements against non-cancelled vouchers. */
  settledAmount: number;
  /** Paise. netAmount - settledAmount. Only invoices with outstandingAmount > 0 are returned. */
  outstandingAmount: number;
  /** Phase 8 Increment 2 (multi-currency). Null for a base-currency invoice. */
  currency: string | null;
  exchangeRateMicros: number | null;
  /** Foreign-currency minor units, only when currency is set — re-derived from netAmount at the invoice's own rate the same round-trip-safe way the invoice's own party-ledger line was tagged, so the two always agree. */
  outstandingForeignAmount: number | null;
}

/** Non-cancelled sales invoices with a remaining balance — what a Customer Receipt screen offers to settle against. */
export async function listOutstandingSalesInvoices(companyDb: Kysely<CompanyDatabase>, partyId?: string): Promise<OutstandingInvoiceRow[]> {
  let query = companyDb
    .selectFrom('sales_invoice')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'sales_invoice.party_id')
    .leftJoin('sales_invoice_line', 'sales_invoice_line.sales_invoice_id', 'sales_invoice.id')
    .select(({ fn }) => [
      'sales_invoice.id as invoiceId',
      'sales_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'sales_invoice.invoice_date as invoiceDate',
      'sales_invoice.party_id as partyId',
      'business_party.name as partyName',
      'sales_invoice.currency as currency',
      'sales_invoice.exchange_rate_micros as exchangeRateMicros',
      fn.sum<number>('sales_invoice_line.amount').as('taxableAmount'),
      fn.sum<number>('sales_invoice_line.tax_amount').as('taxAmount'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('sales_invoice.id');
  if (partyId) {
    query = query.where('sales_invoice.party_id', '=', partyId);
  }
  const invoices = await query.execute();

  const settled = await companyDb
    .selectFrom('sales_invoice_settlement')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice_settlement.voucher_id')
    .select(({ fn }) => [
      'sales_invoice_settlement.sales_invoice_id as invoiceId',
      fn.sum<number>('sales_invoice_settlement.amount_applied').as('settled'),
      fn.sum<number>('sales_invoice_settlement.foreign_amount_applied').as('settledForeign'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('sales_invoice_settlement.sales_invoice_id')
    .execute();
  const settledByInvoice = new Map(settled.map((row) => [row.invoiceId, { settled: Number(row.settled ?? 0), settledForeign: Number(row.settledForeign ?? 0) }]));

  return invoices
    .map((row) => {
      const netAmount = Number(row.taxableAmount ?? 0) + Number(row.taxAmount ?? 0);
      const settledInfo = settledByInvoice.get(row.invoiceId) ?? { settled: 0, settledForeign: 0 };
      const netForeignAmount = row.exchangeRateMicros ? foreignAmountForBase(netAmount, row.exchangeRateMicros) : null;
      return {
        invoiceId: row.invoiceId,
        voucherId: row.voucherId,
        voucherNumber: row.voucherNumber,
        invoiceDate: row.invoiceDate,
        dueDate: null,
        partyId: row.partyId,
        partyName: row.partyName,
        netAmount,
        settledAmount: settledInfo.settled,
        outstandingAmount: netAmount - settledInfo.settled,
        currency: row.currency,
        exchangeRateMicros: row.exchangeRateMicros,
        outstandingForeignAmount: netForeignAmount !== null ? netForeignAmount - settledInfo.settledForeign : null,
      };
    })
    .filter((row) => row.outstandingAmount > 0)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.voucherNumber - b.voucherNumber);
}

/** Non-cancelled purchase invoices with a remaining balance (net of TDS) — what a Supplier Payment screen offers to settle against. */
export async function listOutstandingPurchaseInvoices(companyDb: Kysely<CompanyDatabase>, partyId?: string): Promise<OutstandingInvoiceRow[]> {
  let query = companyDb
    .selectFrom('purchase_invoice')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'purchase_invoice.party_id')
    .leftJoin('purchase_invoice_line', 'purchase_invoice_line.purchase_invoice_id', 'purchase_invoice.id')
    .select(({ fn }) => [
      'purchase_invoice.id as invoiceId',
      'purchase_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'purchase_invoice.invoice_date as invoiceDate',
      'purchase_invoice.due_date as dueDate',
      'purchase_invoice.party_id as partyId',
      'business_party.name as partyName',
      'purchase_invoice.tds_amount as tdsAmount',
      'purchase_invoice.currency as currency',
      'purchase_invoice.exchange_rate_micros as exchangeRateMicros',
      fn.sum<number>('purchase_invoice_line.amount').as('taxableAmount'),
      fn.sum<number>('purchase_invoice_line.tax_amount').as('taxAmount'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('purchase_invoice.id');
  if (partyId) {
    query = query.where('purchase_invoice.party_id', '=', partyId);
  }
  const invoices = await query.execute();

  const settled = await companyDb
    .selectFrom('purchase_invoice_settlement')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice_settlement.voucher_id')
    .select(({ fn }) => [
      'purchase_invoice_settlement.purchase_invoice_id as invoiceId',
      fn.sum<number>('purchase_invoice_settlement.amount_applied').as('settled'),
      fn.sum<number>('purchase_invoice_settlement.foreign_amount_applied').as('settledForeign'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('purchase_invoice_settlement.purchase_invoice_id')
    .execute();
  const settledByInvoice = new Map(settled.map((row) => [row.invoiceId, { settled: Number(row.settled ?? 0), settledForeign: Number(row.settledForeign ?? 0) }]));

  return invoices
    .map((row) => {
      const netAmount = Number(row.taxableAmount ?? 0) + Number(row.taxAmount ?? 0) - row.tdsAmount;
      const settledInfo = settledByInvoice.get(row.invoiceId) ?? { settled: 0, settledForeign: 0 };
      const netForeignAmount = row.exchangeRateMicros ? foreignAmountForBase(netAmount, row.exchangeRateMicros) : null;
      return {
        invoiceId: row.invoiceId,
        voucherId: row.voucherId,
        voucherNumber: row.voucherNumber,
        invoiceDate: row.invoiceDate,
        dueDate: row.dueDate,
        partyId: row.partyId,
        partyName: row.partyName,
        netAmount,
        settledAmount: settledInfo.settled,
        outstandingAmount: netAmount - settledInfo.settled,
        currency: row.currency,
        exchangeRateMicros: row.exchangeRateMicros,
        outstandingForeignAmount: netForeignAmount !== null ? netForeignAmount - settledInfo.settledForeign : null,
      };
    })
    .filter((row) => row.outstandingAmount > 0)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.voucherNumber - b.voucherNumber);
}

export interface SettlementLineInput {
  invoiceId: string;
  /** Paise. Must not exceed that invoice's current outstanding amount. This is the invoice's ORIGINAL booked base-currency value for the portion settled — it's what clears AR/AP, regardless of any rate movement. */
  amount: number;
  /**
   * Phase 8 Increment 2 (multi-currency) — required together, only when
   * settling against an FX-denominated invoice. foreignAmount is how much
   * of the invoice's foreign-currency balance this settles; must satisfy
   * convertForeignToBase(foreignAmount, <the invoice's own rate>) === amount
   * (validated against the invoice actually resolved server-side, not
   * trusted blindly from the caller). settlementExchangeRateMicros is
   * the ACTUAL rate this settlement happened at (screen pre-fills it from
   * resolveExchangeRate for the settlement date, but the user can override
   * it — real settlement rates vary by bank/dealer on the day) — the
   * difference between the two produces a realized gain/loss line on the
   * same settlement voucher.
   */
  foreignAmount?: number;
  settlementExchangeRateMicros?: number;
}

export interface RecordSalesReceiptInput {
  partyId: string;
  /** Cash/Bank ledger the money lands in. */
  depositLedgerId: string;
  receiptDate: string;
  financialYear: string;
  narration?: string;
  settlements: SettlementLineInput[];
}

export interface RecordPurchasePaymentInput {
  partyId: string;
  /** Cash/Bank ledger the money leaves from. */
  paymentLedgerId: string;
  paymentDate: string;
  financialYear: string;
  narration?: string;
  settlements: SettlementLineInput[];
}

interface ResolvedSettlementLine {
  invoiceId: string;
  /** Paise. The booked value this clears against AR/AP. */
  amount: number;
  /** Paise. What actually lands in/leaves the deposit/payment ledger — equals amount for a base-currency invoice. */
  actualCash: number;
  /** actualCash - amount. Zero for a base-currency invoice. */
  realizedGainLoss: number;
  foreignAmountApplied: number | null;
  /** The invoice's own currency/booking rate — carried onto the party-ledger settlement line too (not just the invoice's own line), so the ledger's foreign_amount balance nets down correctly when settled — otherwise a period-end revaluation would keep treating an already-settled invoice's foreign amount as still-open exposure. Null for a base-currency invoice. */
  currency: string | null;
  bookingExchangeRateMicros: number | null;
}

/**
 * Validates every settlement line against the invoice it targets (amount
 * within the outstanding balance; for an FX invoice, foreignAmount/
 * settlementExchangeRateMicros are required and internally consistent) and
 * resolves each into what actually clears AR/AP vs. what actually moves in
 * the deposit/payment ledger — see SettlementLineInput's doc comment for the
 * realized-gain/loss mechanics.
 */
function resolveSettlements(settlements: SettlementLineInput[], outstandingByInvoice: Map<string, OutstandingInvoiceRow>): { lines: ResolvedSettlementLine[]; totalBooked: number; totalActualCash: number } {
  if (settlements.length === 0) {
    throw new Error('Select at least one invoice to settle');
  }

  let totalBooked = 0;
  let totalActualCash = 0;
  const lines: ResolvedSettlementLine[] = settlements.map((line) => {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error('Every settlement amount must be a positive whole-paise amount');
    }
    const invoice = outstandingByInvoice.get(line.invoiceId);
    if (!invoice) {
      throw new Error('One of the selected invoices is not an outstanding invoice for this party');
    }
    if (line.amount > invoice.outstandingAmount) {
      throw new Error(`Settlement amount exceeds the invoice's remaining outstanding balance (₹${(invoice.outstandingAmount / 100).toFixed(2)})`);
    }

    let actualCash = line.amount;
    let foreignAmountApplied: number | null = null;
    if (invoice.currency) {
      if (line.foreignAmount === undefined || line.settlementExchangeRateMicros === undefined) {
        throw new Error(`Invoice ${invoice.voucherNumber} is in ${invoice.currency} — foreignAmount and settlementExchangeRateMicros are required to settle it`);
      }
      if (convertForeignToBase(line.foreignAmount, invoice.exchangeRateMicros!) !== line.amount) {
        throw new Error(`Settlement amount does not match the foreign amount converted at the invoice's own booking rate (invoice ${invoice.voucherNumber})`);
      }
      if (invoice.outstandingForeignAmount !== null && line.foreignAmount > invoice.outstandingForeignAmount) {
        throw new Error(`Settlement foreign amount exceeds the invoice's remaining outstanding foreign balance (invoice ${invoice.voucherNumber})`);
      }
      actualCash = convertForeignToBase(line.foreignAmount, line.settlementExchangeRateMicros);
      foreignAmountApplied = line.foreignAmount;
    }

    totalBooked += line.amount;
    totalActualCash += actualCash;
    return {
      invoiceId: line.invoiceId,
      amount: line.amount,
      actualCash,
      realizedGainLoss: actualCash - line.amount,
      foreignAmountApplied,
      currency: invoice.currency,
      bookingExchangeRateMicros: invoice.exchangeRateMicros,
    };
  });

  return { lines, totalBooked, totalActualCash };
}

/**
 * Builds the party-ledger settlement line(s): one per FX settlement (tagged
 * with that invoice's own currency/booking rate, so the ledger's running
 * foreign_amount balance nets down correctly when settled — otherwise a
 * later period-end revaluation would keep treating an already-settled
 * invoice's foreign amount as still-open exposure), plus ONE combined line
 * for every base-currency settlement's total (unchanged from before FX
 * existed).
 */
function buildPartyLedgerLines(partyLedgerId: string, lines: ResolvedSettlementLine[], side: 'debit' | 'credit'): VoucherLineInput[] {
  const result: VoucherLineInput[] = [];
  let nonFxTotal = 0;
  for (const line of lines) {
    if (line.currency && line.bookingExchangeRateMicros !== null) {
      result.push({
        ledgerId: partyLedgerId,
        debitAmount: side === 'debit' ? line.amount : 0,
        creditAmount: side === 'credit' ? line.amount : 0,
        foreignCurrency: line.currency,
        foreignAmount: line.foreignAmountApplied!,
        exchangeRateMicros: line.bookingExchangeRateMicros,
      });
    } else {
      nonFxTotal += line.amount;
    }
  }
  if (nonFxTotal > 0) {
    result.push({ ledgerId: partyLedgerId, debitAmount: side === 'debit' ? nonFxTotal : 0, creditAmount: side === 'credit' ? nonFxTotal : 0 });
  }
  return result;
}

/**
 * Records a customer receipt applied against one or more specific sales
 * invoices — a real RECEIPT voucher (Dr deposit ledger, Cr the customer's
 * ledger) plus the settlement rows linking it to those invoices, atomically
 * (Rule #4). This is additive: the existing generic ReceiptVoucherScreen
 * still works unchanged for receipts that aren't tied to a specific invoice
 * (e.g. an advance) — bill-wise allocation is an option, not a requirement.
 */
export async function recordSalesReceipt(companyDb: Kysely<CompanyDatabase>, input: RecordSalesReceiptInput, actorUserId: string | null): Promise<string> {
  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'CUSTOMER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a customer');
  }

  const outstanding = await listOutstandingSalesInvoices(companyDb, input.partyId);
  const outstandingByInvoice = new Map(outstanding.map((row) => [row.invoiceId, row]));
  const { lines, totalBooked, totalActualCash } = resolveSettlements(input.settlements, outstandingByInvoice);
  const netRealizedGainLoss = totalActualCash - totalBooked;

  const voucherLines: VoucherLineInput[] = [
    { ledgerId: input.depositLedgerId, debitAmount: totalActualCash, creditAmount: 0 },
    ...buildPartyLedgerLines(party.ledger_account_id, lines, 'credit'),
  ];
  if (netRealizedGainLoss !== 0) {
    const { realizedForexGainLossLedgerId } = await getMultiCurrencyLedgerIds(companyDb);
    // A gain (received more base-currency than booked) credits the ledger; a loss debits it.
    voucherLines.push(
      netRealizedGainLoss > 0
        ? { ledgerId: realizedForexGainLossLedgerId, debitAmount: 0, creditAmount: netRealizedGainLoss }
        : { ledgerId: realizedForexGainLossLedgerId, debitAmount: -netRealizedGainLoss, creditAmount: 0 },
    );
  }

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'RECEIPT', financialYear: input.financialYear, voucherDate: input.receiptDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );

    for (const line of lines) {
      await trx
        .insertInto('sales_invoice_settlement')
        .values({ id: randomUUID(), sales_invoice_id: line.invoiceId, voucher_id: voucherId, amount_applied: line.amount, foreign_amount_applied: line.foreignAmountApplied })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'SalesInvoiceSettlement',
      entityId: voucherId,
      afterData: { partyId: input.partyId, totalBooked, totalActualCash, settlements: input.settlements },
    });

    return voucherId;
  });
}

/** Mirror of recordSalesReceipt: a real PAYMENT voucher (Dr the supplier's ledger, Cr payment ledger) plus settlement rows against one or more purchase invoices. */
export async function recordPurchasePayment(companyDb: Kysely<CompanyDatabase>, input: RecordPurchasePaymentInput, actorUserId: string | null): Promise<string> {
  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'SUPPLIER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a supplier');
  }

  const outstanding = await listOutstandingPurchaseInvoices(companyDb, input.partyId);
  const outstandingByInvoice = new Map(outstanding.map((row) => [row.invoiceId, row]));
  const { lines, totalBooked, totalActualCash } = resolveSettlements(input.settlements, outstandingByInvoice);
  const netRealizedGainLoss = totalActualCash - totalBooked;

  const voucherLines: VoucherLineInput[] = [
    ...buildPartyLedgerLines(party.ledger_account_id, lines, 'debit'),
    { ledgerId: input.paymentLedgerId, debitAmount: 0, creditAmount: totalActualCash },
  ];
  if (netRealizedGainLoss !== 0) {
    const { realizedForexGainLossLedgerId } = await getMultiCurrencyLedgerIds(companyDb);
    // Paying MORE base-currency than booked is a loss (debit); paying less is a gain (credit) — opposite sign convention to recordSalesReceipt's, since this side pays out instead of receiving.
    voucherLines.push(
      netRealizedGainLoss > 0
        ? { ledgerId: realizedForexGainLossLedgerId, debitAmount: netRealizedGainLoss, creditAmount: 0 }
        : { ledgerId: realizedForexGainLossLedgerId, debitAmount: 0, creditAmount: -netRealizedGainLoss },
    );
  }

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYMENT', financialYear: input.financialYear, voucherDate: input.paymentDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );

    for (const line of lines) {
      await trx
        .insertInto('purchase_invoice_settlement')
        .values({ id: randomUUID(), purchase_invoice_id: line.invoiceId, voucher_id: voucherId, amount_applied: line.amount, foreign_amount_applied: line.foreignAmountApplied })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'PurchaseInvoiceSettlement',
      entityId: voucherId,
      afterData: { partyId: input.partyId, totalBooked, totalActualCash, settlements: input.settlements },
    });

    return voucherId;
  });
}
