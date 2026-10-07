/**
 * Pure builders (no store access): rental billing, invoice lines from source documents and journal lines. Used by the engine at runtime and by the seed,
 * so seeded history and new invoices follow exactly the same rules.
 */
import dayjs from 'dayjs';
import { custName, cust, type Delivery, type JobCard, type Line, type SalesOrder } from '@/modules/crm/data';
import {
  ACC, addDays, bankAccountCode, daysBetween, incomeAccountFor, lineAmount, lineDisc, lineGross, lineVat, maxDate, minDate, round2, totalsOf, vatPctOf,
  type Bill, type InvLine, type JournalLine, type NoteDoc, type PaymentEntry, type SalesInvoice,
} from './data';

let seq = 0;
export const lid = () => `il${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/* ------------------------------------------------------------------ header copied from the Sales Order */
export function headerFromOrder(o: SalesOrder) {
  const c = cust(o.customerId);
  return {
    customerId: o.customerId, partyName: custName(o.customerId), entity: o.entity, paymentTerms: o.paymentTerms || '30 days', currency: o.currency || 'AED', exchangeRate: o.exchangeRate || 1,
    transactionType: (o.transactionType === 'Cash' ? 'Cash' : 'Credit') as 'Cash' | 'Credit', salesperson: o.salesperson ?? o.owner, lpo: o.lpo, soId: o.id, soNumber: o.number,
    contactPerson: o.contactPerson ?? c?.contact, billingAddress: o.billingAddress ?? o.site, shippingAddress: o.shippingAddress ?? o.site, placeOfSupply: o.placeOfSupply ?? (o.site?.includes('Abu Dhabi') ? 'Abu Dhabi' : o.site?.includes('Sharjah') ? 'Sharjah' : 'Dubai'),
    vatType: o.vatType, activity: o.activity, costCentre: o.costCentre, location: o.location ?? 'Jebel Ali Main Yard', department: o.department ?? 'Sales',
  };
}

/** Sales Order lines other than Rental and AMC: one invoice line each, at the Sales Order price (invoices always take the SO price). */
export function linesFromOrder(o: SalesOrder, lines: Line[]): InvLine[] {
  const vat = vatPctOf(o.vatType);
  return lines.map((l) => ({
    id: lid(), item: l.item, desc: l.desc || l.item, account: incomeAccountFor(l.activity), qty: l.qty, unit: l.unit, rate: l.foc ? 0 : l.price, discountPct: l.discount ?? 0, vatPct: vat,
    activity: l.activity, costCentre: l.costCentre ?? o.costCentre, soLineId: l.id, tag: l.activity === 'Fixed Asset Trading' ? 'asset-sale' : l.activity === 'Service' || l.activity === 'Other' ? 'one-time-service' : 'goods',
  }));
}

/** AMC job card: the visit share of the Contract Value plus non-FOC materials and services. FOC lines are not on the invoice. */
export function linesFromJobCard(jc: JobCard, o?: SalesOrder): InvLine[] {
  const vat = vatPctOf(o?.vatType);
  const cc = o?.costCentre;
  const out: InvLine[] = [];
  if (!jc.visitFoc && jc.visitAmount) out.push({ id: lid(), item: `AMC visit ${jc.visitIdx + 1}`, desc: `${o?.amcScope ? 'AMC visit' : jc.item}, ${jc.number}, contract value share`, account: '410400', qty: 1, unit: 'Visit', rate: jc.visitAmount, discountPct: 0, vatPct: vat, activity: 'AMC', costCentre: cc, tag: 'visit' });
  jc.materials.filter((m) => !m.foc && m.item && m.qty > 0).forEach((m) => out.push({ id: lid(), item: m.item, desc: `${m.item}, consumed on ${jc.number}`, account: '410200', qty: m.qty, unit: m.unit, rate: m.price, discountPct: 0, vatPct: vat, activity: 'AMC', costCentre: cc, tag: 'material' }));
  jc.services.filter((s) => !s.foc && s.name).forEach((s) => out.push({ id: lid(), item: s.name, desc: `${s.name}, ${jc.number}`, account: '410400', qty: 1, unit: 'Job', rate: s.amount, discountPct: 0, vatPct: vat, activity: 'AMC', costCentre: cc, tag: 'service' }));
  return out;
}

/* ------------------------------------------------------------------ rental billing */
export const RENTAL_RULE = 'Monthly cycle anchored on the first Rental Start of the order; partial periods are pro-rated by days in the period. Billing stops on the off-hire day.';
const qtyFor = (freq: string | undefined, days: number, periodDays: number) => {
  switch (freq) {
    case 'Daily': return days;
    case 'Weekly': return round4(days / 7);
    case 'Quarterly': return round4(days / periodDays / 3);
    case 'Yearly': return round4(days / periodDays / 12);
    default: return round4(days / periodDays);
  }
};
const unitFor = (freq?: string) => ({ Daily: 'Day', Weekly: 'Week', Quarterly: 'Quarter', Yearly: 'Year' } as Record<string, string>)[freq ?? ''] ?? 'Month';

export interface RentalBuild { lines: InvLine[]; oneTimeLineIds: string[]; isFinal: boolean; message: string }
/** Earliest Rental Start of any assignment on the order (the cycle anchor). */
export const firstRentalStart = (o: SalesOrder) => o.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned).map((a) => a.start).sort()[0];
/** Next billing period of the order: the day after the last billed period, else the first Rental Start; one month long. */
export function nextPeriodFor(o: SalesOrder, prior: SalesInvoice[]): { from: string; to: string } | undefined {
  const lastTo = prior.filter((i) => i.isRental && i.periodTo).map((i) => i.periodTo!).sort().pop();
  const from = lastTo ? addDays(lastTo, 1) : firstRentalStart(o);
  if (!from) return undefined;
  return { from, to: dayjs(from).add(1, 'month').subtract(1, 'day').format('YYYY-MM-DD') };
}

/**
 * One invoice for one period of a Rental Sales Order. Each delivered asset is billed from its own Rental Start (Hold excluded until then) to its off-hire
 * day; recurring services (damage waiver) follow the rental; one-time services go on the first invoice, return or collection charges on the final one;
 * a waiting charge from the Delivery Order is billed once. Descriptions carry no dates (seed dates are shifted to the demo day; text is not), the period
 * columns show them.
 */
export function buildRentalLines(o: SalesOrder, deliveries: Delivery[], prior: SalesInvoice[], from: string, to: string, assetLabel: (id: string) => string): RentalBuild {
  const vat = vatPctOf(o.vatType);
  const periodDays = daysBetween(from, to) + 1;
  const priorLines = prior.flatMap((i) => i.lines);
  const priorTo = (key: (l: InvLine) => boolean) => priorLines.filter(key).map((l) => l.periodTo ?? '').sort().pop();
  const lines: InvLine[] = [];
  let lastRentalEnd = '';
  let firstRentalFrom = '';
  for (const l of o.lines.filter((x) => x.activity === 'Rental')) {
    for (const a of l.assigned) {
      if (a.state === 'Sold') continue;
      const done = priorTo((p) => p.tag === 'rental' && p.soLineId === l.id && p.assetId === a.assetId && p.deliveryId === a.deliveryId);
      let start = maxDate(from, a.start);
      if (done) start = maxDate(start, addDays(done, 1));
      const end = a.stop ? minDate(to, addDays(a.stop, -1)) : to;
      if (start > end) continue;
      const days = daysBetween(start, end) + 1;
      if (!firstRentalFrom || start < firstRentalFrom) firstRentalFrom = start;
      if (end > lastRentalEnd) lastRentalEnd = end;
      lines.push({
        id: lid(), item: l.item, desc: `${assetLabel(a.assetId)} (${days} of ${periodDays} days)`, account: '410100', qty: qtyFor(l.frequency, days, periodDays), unit: unitFor(l.frequency),
        rate: l.foc ? 0 : l.price, discountPct: l.discount ?? 0, vatPct: vat, activity: 'Rental', costCentre: l.costCentre ?? o.costCentre,
        periodFrom: start, periodTo: end, days, periodDays, assetId: a.assetId, deliveryId: a.deliveryId, soLineId: l.id, tag: 'rental',
      });
    }
  }
  const oneTimeLineIds: string[] = [];
  const stillOut = o.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned).some((a) => a.state !== 'Sold' && a.state !== 'Replaced' && (!a.stop || a.stop > addDays(to, 1)));
  const isFinal = lines.length > 0 && !stillOut;
  const firstInvoice = !prior.some((i) => i.isRental);
  if (lines.length) {
    for (const l of o.lines.filter((x) => x.activity === 'Service')) {
      if (l.billing === 'Recurring') {
        const done = priorTo((p) => p.tag === 'recurring-service' && p.soLineId === l.id);
        let start = maxDate(maxDate(from, l.start ?? from), firstRentalFrom);
        if (done) start = maxDate(start, addDays(done, 1));
        const end = minDate(minDate(to, l.end ?? to), lastRentalEnd);
        if (start > end) continue;
        const days = daysBetween(start, end) + 1;
        lines.push({ id: lid(), item: l.item, desc: `${l.desc || l.item} (${days} of ${periodDays} days)`, account: '410500', qty: round4(l.qty * qtyFor(l.frequency ?? 'Monthly', days, periodDays)), unit: unitFor(l.frequency ?? 'Monthly'),
          rate: l.foc ? 0 : l.price, discountPct: l.discount ?? 0, vatPct: vat, activity: 'Service', costCentre: l.costCentre ?? o.costCentre, periodFrom: start, periodTo: end, days, periodDays, soLineId: l.id, tag: 'recurring-service' });
        continue;
      }
      if (l.foc || l.fulfilmentRef || priorLines.some((p) => p.soLineId === l.id)) continue;
      const isReturn = /return|collection/i.test(l.item);
      if (isReturn ? !isFinal : !firstInvoice) continue;
      oneTimeLineIds.push(l.id);
      lines.push({ id: lid(), item: l.item, desc: `${l.desc || l.item}${isReturn ? ' (final invoice)' : ' (first invoice)'}`, account: '410500', qty: l.qty, unit: l.unit, rate: l.price, discountPct: l.discount ?? 0, vatPct: vat,
        activity: 'Service', costCentre: l.costCentre ?? o.costCentre, soLineId: l.id, tag: 'one-time-service' });
    }
    for (const d of deliveries.filter((x) => x.soId === o.id && (x.waitingCharge ?? 0) > 0)) {
      if (priorLines.some((p) => p.tag === 'waiting-charge' && p.deliveryId === d.id)) continue;
      lines.push({ id: lid(), item: 'Waiting charge', desc: `Waiting charge, ${d.number}, site not ready (${d.startBy ?? 'Client'})`, account: '410500', qty: 1, unit: 'Lump sum', rate: d.waitingCharge!, discountPct: 0, vatPct: vat,
        activity: 'Service', costCentre: o.costCentre, deliveryId: d.id, tag: 'waiting-charge' });
    }
  }
  const message = lines.length ? `${lines.filter((l) => l.tag === 'rental').length} asset line(s) for ${from} to ${to}` : `Nothing to bill for ${from} to ${to}`;
  return { lines, oneTimeLineIds, isFinal, message };
}

/* ------------------------------------------------------------------ journal lines (existing ERP posting rules) */
function balance(lines: JournalLine[]): JournalLine[] {
  const out = lines.filter((l) => round2(l.debit) !== 0 || round2(l.credit) !== 0).map((l) => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) }));
  const diff = round2(out.reduce((s, l) => s + l.debit - l.credit, 0));
  if (diff !== 0) out.push({ account: ACC.roundOff, debit: diff < 0 ? -diff : 0, credit: diff > 0 ? diff : 0, memo: 'Rounding' });
  return out;
}
/** Sales invoice: Dr Receivable, Dr Sales Discount, Cr income per line, Cr Output VAT, round off either side. */
export function salesJournal(inv: SalesInvoice): JournalLine[] {
  const t = totalsOf(inv);
  const p = inv.partyName;
  return balance([
    { account: ACC.ar, party: p, debit: t.total, credit: 0, costCentre: inv.costCentre },
    ...(t.itemDisc + t.addDisc ? [{ account: ACC.discount, party: p, debit: t.itemDisc + t.addDisc, credit: 0, costCentre: inv.costCentre }] : []),
    ...inv.lines.map((l) => ({ account: l.account, party: p, debit: 0, credit: lineAmount(l), costCentre: l.costCentre ?? inv.costCentre, memo: l.item })),
    { account: ACC.outputVat, party: p, debit: 0, credit: t.vat },
  ]);
}
/** Bill: Dr expense per line and expense entry, Dr Input VAT, Cr Payable. */
export function purchaseJournal(b: Bill): JournalLine[] {
  const t = totalsOf(b);
  const p = b.supplierName;
  return balance([
    ...b.lines.map((l) => ({ account: l.account, party: p, debit: lineGross(l), credit: 0, costCentre: l.costCentre ?? b.costCentre, memo: l.item })),
    ...b.expenses.map((e) => ({ account: e.account, party: p, debit: e.amount, credit: 0, costCentre: e.costCentre ?? b.costCentre, memo: e.desc })),
    ...(t.addDisc ? [{ account: ACC.discount, party: p, debit: 0, credit: t.addDisc }] : []),
    { account: ACC.inputVat, party: p, debit: t.vat, credit: 0 },
    { account: ACC.ap, party: p, debit: 0, credit: t.total, costCentre: b.costCentre },
  ]);
}
/** Collection: Dr bank, Cr Receivable per allocation, Cr Customer Advances for the rest. Payment: Dr Payable, Cr bank. */
export function paymentJournal(p: PaymentEntry): JournalLine[] {
  const bank = bankAccountCode(p.bankAccount);
  const alloc = p.allocations.reduce((s, a) => s + a.amount, 0);
  if (p.direction === 'Receive') {
    return balance([
      { account: bank, party: p.partyName, debit: p.amount, credit: 0 },
      ...p.allocations.map((a) => ({ account: ACC.ar, party: p.partyName, debit: 0, credit: a.amount, memo: a.docNumber })),
      ...(p.amount - alloc > 0 ? [{ account: ACC.advances, party: p.partyName, debit: 0, credit: p.amount - alloc, memo: 'Advance' }] : []),
    ]);
  }
  return balance([
    ...p.allocations.map((a) => ({ account: ACC.ap, party: p.partyName, debit: a.amount, credit: 0, memo: a.docNumber })),
    ...(p.amount - alloc > 0 ? [{ account: ACC.ap, party: p.partyName, debit: p.amount - alloc, credit: 0, memo: 'Advance to supplier' }] : []),
    { account: bank, party: p.partyName, debit: 0, credit: p.amount },
  ]);
}
export const advanceJournal = (party: string, amount: number, invNo: string): JournalLine[] => balance([
  { account: ACC.advances, party, debit: amount, credit: 0, memo: `Applied to ${invNo}` }, { account: ACC.ar, party, debit: 0, credit: amount, memo: invNo },
]);
/** Credit note: Dr income and Output VAT, Cr Receivable. Debit note: Dr Payable, Cr expense and Input VAT. */
export function noteJournal(n: NoteDoc): JournalLine[] {
  const t = totalsOf({ lines: n.lines });
  const p = n.partyName;
  if (n.kind === 'Credit') return balance([...n.lines.map((l) => ({ account: l.account, party: p, debit: lineGross(l), credit: 0, costCentre: l.costCentre ?? n.costCentre, memo: l.item })), { account: ACC.outputVat, party: p, debit: t.vat, credit: 0 }, { account: ACC.ar, party: p, debit: 0, credit: t.total }]);
  return balance([{ account: ACC.ap, party: p, debit: t.total, credit: 0 }, ...n.lines.map((l) => ({ account: l.account, party: p, debit: 0, credit: lineGross(l), costCentre: l.costCentre ?? n.costCentre, memo: l.item })), { account: ACC.inputVat, party: p, debit: 0, credit: t.vat }]);
}
export { lineDisc, lineVat };
