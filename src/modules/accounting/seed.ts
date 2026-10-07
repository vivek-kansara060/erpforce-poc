/**
 * Accounting seed, built from the RAW CRM / Inventory seed constants as of the demo base day (30 Sep 2026). seedCollection then shifts every date by the
 * demo offset, exactly like the CRM seeds, so the history lines up with the shifted orders. Never build this from getCollection (that would shift twice).
 */
import { custName, deliverySeed, jobCardSeed, orderSeed, crossHireSeed, type LogItem, type SalesOrder } from '@/modules/crm/data';
import { disposalSeed, heavySeed } from '@/modules/inventory/data';
import { suppliers } from '@/mock-data/masters';
import { seedCollection } from '@/store/store';
import { buildRentalLines, headerFromOrder, lid, linesFromJobCard, linesFromOrder, nextPeriodFor, noteJournal, paymentJournal, purchaseJournal, salesJournal } from './billing';
import {
  COLA, SEED_MAX, addDays, dueDateFor, expenseAccountFor, payStatusOf, round2, seriesNo, totalsOf, vatPctOf,
  type Bill, type InvLine, type Journal, type JournalLine, type JournalType, type NoteDoc, type PaymentEntry, type RentalRun, type SalesInvoice,
} from './data';

const ASOF = '2026-09-30';
const FIN = 'Priya Menon';
const lg = (when: string, title: string, detail?: string, tone?: LogItem['tone'], by = FIN): LogItem => ({ when, title, detail, by, tone });
const assetLabelRaw = (id: string) => { const h = heavySeed.find((x) => x.id === id); return h ? `${h.assetId} - ${h.name}` : id; };

interface Built { invoices: SalesInvoice[]; bills: Bill[]; payments: PaymentEntry[]; creditNotes: NoteDoc[]; debitNotes: NoteDoc[]; journals: Journal[]; rentalRuns: RentalRun[]; failures: { id: string; soId: string; from: string; to: string; error: string; jobId?: string }[] }

export function buildAccountingSeed(): Built {
  const invoices: SalesInvoice[] = [];
  const bills: Bill[] = [];
  const payments: PaymentEntry[] = [];
  const creditNotes: NoteDoc[] = [];
  const debitNotes: NoteDoc[] = [];
  const pending: { date: string; type: JournalType; refType: string; refId: string; refNumber: string; narration: string; lines: JournalLine[]; set: (id: string) => void }[] = [];
  let payN = 30;

  const base = { postingTime: '09:00', exchangeRate: 1, discountOn: 'None' as const, discountPct: 0, roundOff: false, attachments: [] as string[] };
  const inv = (o: Partial<SalesInvoice> & Pick<SalesInvoice, 'id' | 'number' | 'date' | 'partyName' | 'lines' | 'source'>): SalesInvoice => {
    const r: SalesInvoice = {
      ...base, entity: 'Gulf Power Rentals LLC', currency: 'AED', paymentTerms: '30 days', transactionType: 'Credit', vatType: 'Standard (With VAT)', dueDate: '', approval: 'Approved', approver: 'Ahmed Al Khouri',
      payStatus: 'Unpaid', amountPaid: 0, creditNoteIds: [], log: [], ...o,
    };
    r.dueDate = r.dueDate || dueDateFor(r.date, r.paymentTerms);
    r.log = [lg(`${r.date} 10:00`, 'Invoice created', `From ${r.source.type} ${r.source.number}`), lg(`${r.date} 12:00`, 'Approved (Quick Approval)', undefined, 'green', 'Ahmed Al Khouri'), ...r.log];
    invoices.push(r);
    pending.push({ date: r.date, type: 'Sales', refType: 'Sales Invoice', refId: r.id, refNumber: r.number, narration: `Sales invoice ${r.number}, ${r.partyName}`, lines: salesJournal(r), set: (j) => { r.journalId = j; } });
    return r;
  };
  /** Collection allocated in full or part to one invoice. */
  const collect = (r: SalesInvoice, date: string, share = 1) => {
    const total = totalsOf(r).total;
    const amount = round2(total * share);
    payN += 1;
    const p: PaymentEntry = {
      id: `pay-${payN}`, number: seriesNo('PAY', payN), direction: 'Receive', date, partyType: 'Customer', partyId: r.customerId, partyName: r.partyName, method: 'Bank', bankAccount: 'Emirates NBD Current 1015-447821-01',
      reference: `TT-${r.number.slice(-5)}`, amount, isAdvance: false, advanceUsed: 0, soId: r.soId, soNumber: r.soNumber, allocations: [{ docType: 'invoice', docId: r.id, docNumber: r.number, amount }], approval: 'Approved',
      log: [lg(`${date} 11:00`, 'Collection received', `Bank transfer, ${r.number}`), lg(`${date} 11:30`, 'Approved', undefined, 'green')],
    };
    payments.push(p);
    r.amountPaid = round2(r.amountPaid + amount);
    r.payStatus = payStatusOf(total - r.amountPaid, total);
    r.log.push(lg(`${date} 11:30`, `Collection ${p.number} applied`, `AED ${amount}`, 'green'));
    pending.push({ date, type: 'Cash Receipt Voucher', refType: 'Collection', refId: p.id, refNumber: p.number, narration: `Collection ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
  };

  /* -------- rental history: every full monthly period that ended before the demo day, numbered INV-26-00300 upward in date order */
  const rentalBuilt: { o: SalesOrder; r: SalesInvoice }[] = [];
  const drafts: { o: SalesOrder; from: string; to: string; lines: InvLine[] }[] = [];
  for (const o of orderSeed.filter((x) => x.activity === 'Rental')) {
    const prior: SalesInvoice[] = [];
    for (let guard = 0; guard < 24; guard += 1) {
      const p = nextPeriodFor(o, prior);
      if (!p || p.to >= ASOF) break;
      const b = buildRentalLines(o, deliverySeed, prior, p.from, p.to, assetLabelRaw);
      if (!b.lines.length) break;
      const stub = { isRental: true, periodFrom: p.from, periodTo: p.to, lines: b.lines } as SalesInvoice;
      prior.push(stub);
      drafts.push({ o, from: p.from, to: p.to, lines: b.lines });
    }
  }
  drafts.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0)).forEach((d, i) => {
    const n = 300 + i;
    const r = inv({ id: `inv-${n}`, number: seriesNo('INV', n), date: addDays(d.to, 1), ...headerFromOrder(d.o), lines: d.lines, isRental: true, periodFrom: d.from, periodTo: d.to,
      narration: 'Rental invoice for the billing period', source: { type: 'Rental Cycle', id: d.o.id, number: d.o.number, soId: d.o.id } });
    rentalBuilt.push({ o: d.o, r });
  });
  // Payment pattern: older invoices paid, the newest per order open; a few overdue and one part-paid so every ageing bucket has data.
  const byOrder = new Map<string, SalesInvoice[]>();
  rentalBuilt.forEach(({ o, r }) => byOrder.set(o.id, [...(byOrder.get(o.id) ?? []), r]));
  byOrder.forEach((list, soId) => list.forEach((r, i) => {
    const newest = i === list.length - 1;
    if (soId === 'so5' && i === list.length - 2) { collect(r, addDays(r.dueDate, 3), 0.5); return; }
    if ((soId === 'so1' && i === 2) || (soId === 'so3' && i === 1)) return;
    if (!newest && r.dueDate <= '2026-09-15') collect(r, addDays(r.dueDate, -4));
  }));

  /* -------- invoice numbers already referenced by the CRM and Inventory seeds */
  const order = (id: string) => orderSeed.find((o) => o.id === id)!;
  const lineOf = (soId: string, lineId: string) => order(soId).lines.filter((l) => l.id === lineId);
  const fromLine = (n: number, soId: string, lineId: string, date: string) => {
    const o = order(soId);
    const r = inv({ id: `inv-${n}`, number: seriesNo('INV', n), date, ...headerFromOrder(o), lines: linesFromOrder(o, lineOf(soId, lineId)), source: { type: 'Sales Order', id: o.id, number: o.number, soId: o.id, lineIds: [lineId] } });
    collect(r, addDays(date, 20));
  };
  fromLine(402, 'so1', 'so1d', '2026-04-12');
  fromLine(415, 'so2', 'so2c', '2026-07-04');
  fromLine(344, 'so9', 'so9d', '2026-06-01');
  for (const [n, jcId, paid] of [[371, 'jc2', true], [396, 'jc3', false]] as const) {
    const jc = jobCardSeed.find((j) => j.id === jcId)!;
    const o = order(jc.soId);
    const r = inv({ id: `inv-${n}`, number: seriesNo('INV', n), date: jc.doneOn ?? jc.plannedDate, ...headerFromOrder(o), lines: linesFromJobCard(jc, o), narration: `AMC visit ${jc.visitIdx + 1}, job card ${jc.number}`,
      source: { type: 'Job Card', id: jc.id, number: jc.number, soId: o.id } });
    if (paid) collect(r, jobCardSeed.find((j) => j.id === 'jc3')!.plannedDate);
  }
  for (const d of disposalSeed.filter((x) => x.outcome?.invoiceRef)) {
    const out = d.outcome!;
    const n = Number(out.invoiceRef!.slice(-5));
    const h = heavySeed.find((x) => x.assetId === d.assetId);
    const r = inv({ id: `inv-${n}`, number: out.invoiceRef!, date: out.date, partyName: out.buyer ?? '-', customerId: out.buyer?.startsWith('Khalid') ? 'c9' : undefined, paymentTerms: 'Immediate',
      lines: [{ id: lid(), item: d.method === 'Scrap' ? 'Scrap sale' : 'Sale of fixed asset', desc: `${d.assetId}${h ? ` - ${h.name}` : ''}, disposal ${d.number}`, account: '410700', qty: 1, unit: 'Nos', rate: out.saleValue ?? 0, discountPct: 0, vatPct: 5, activity: 'Fixed Asset Trading', tag: 'asset-sale' }],
      activity: 'Fixed Asset Trading', narration: `Disposal ${d.number} (${d.method})`, source: { type: 'Asset Disposal', id: d.id, number: d.number } });
    collect(r, addDays(out.date, 2));
  }

  /* -------- advance received against SO-26-00052, not yet applied */
  payN += 1;
  const adv: PaymentEntry = { id: `pay-${payN}`, number: seriesNo('PAY', payN), direction: 'Receive', date: '2026-09-18', partyType: 'Customer', partyId: 'c8', partyName: custName('c8'), method: 'Bank', bankAccount: 'Emirates NBD Current 1015-447821-01',
    reference: 'TT-PMD-77101', amount: 20000, isAdvance: true, advanceUsed: 0, soId: 'so4', soNumber: 'SO-26-00052', allocations: [], approval: 'Approved', narration: 'Mobilisation advance as per LPO-PMD-7710',
    log: [lg('2026-09-18 10:00', 'Advance received', 'Against SO-26-00052'), lg('2026-09-18 10:30', 'Approved', undefined, 'green')] };
  payments.push(adv);
  pending.push({ date: adv.date, type: 'Cash Receipt Voucher', refType: 'Collection', refId: adv.id, refNumber: adv.number, narration: `Advance ${adv.number}, ${adv.partyName}`, lines: paymentJournal(adv), set: (j) => { adv.journalId = j; } });

  /* -------- credit note on the newest Sharjah Cement invoice (rate correction) */
  const so5Last = (byOrder.get('so5') ?? []).slice(-1)[0];
  if (so5Last) {
    const cn: NoteDoc = { id: 'crn-8', number: seriesNo('CRN', 8), kind: 'Credit', date: addDays(so5Last.date, 4), partyId: so5Last.customerId, partyName: so5Last.partyName, reason: 'Rate correction', againstId: so5Last.id, againstNumber: so5Last.number,
      lines: [{ id: lid(), item: 'Standby days not chargeable', desc: 'Two standby days during the kiln stoppage, agreed with the client', account: '410100', qty: 1, unit: 'Lump sum', rate: 3000, discountPct: 0, vatPct: 5, activity: 'Rental', costCentre: so5Last.costCentre }],
      approval: 'Approved', costCentre: so5Last.costCentre, log: [lg(`${addDays(so5Last.date, 4)} 10:00`, 'Credit note created'), lg(`${addDays(so5Last.date, 4)} 12:00`, 'Approved', undefined, 'green')] };
    creditNotes.push(cn);
    so5Last.creditNoteIds.push(cn.id);
    so5Last.amountPaid = round2(so5Last.amountPaid + totalsOf({ lines: cn.lines }).total);
    so5Last.payStatus = payStatusOf(totalsOf(so5Last).total - so5Last.amountPaid, totalsOf(so5Last).total);
    pending.push({ date: cn.date, type: 'Credit Note', refType: 'Credit Note', refId: cn.id, refNumber: cn.number, narration: `Credit note ${cn.number} against ${cn.againstNumber}`, lines: noteJournal(cn), set: (j) => { cn.journalId = j; } });
  }

  /* -------- bills from cross-hire orders */
  const billOf = (n: number, chId: string, date: string, paid: boolean) => {
    const ch = crossHireSeed.find((c) => c.id === chId)!;
    const o = order(ch.soId);
    const sup = suppliers.find((s) => s.id === ch.supplierId);
    const b: Bill = {
      ...base, id: `bill-${n}`, number: seriesNo('BILL', n), date, dueDate: dueDateFor(date, ch.paymentTerms ?? `${sup?.creditPeriod ?? 30} days`), paymentTerms: ch.paymentTerms ?? `${sup?.creditPeriod ?? 30} days`, entity: 'Gulf Power Rentals LLC', currency: 'AED',
      supplierId: ch.supplierId, supplierName: ch.supplier, supplierInvoiceNo: ch.supplierInvoice ?? '', supplierInvoiceDate: date, orderRef: ch.number,
      lines: [{ id: lid(), item: `Cross-hire ${ch.group} ${ch.category}`, desc: `${ch.number} for ${ch.soNumber}`, account: '510100', qty: ch.qty ?? 1, unit: 'Nos', rate: ch.rate, discountPct: 0, vatPct: 5, activity: 'Rental', costCentre: o.costCentre, tag: 'cross-hire' }],
      expenses: (ch.expenses ?? []).map((e) => ({ id: lid(), account: expenseAccountFor(e.account), desc: e.note || e.account, amount: e.amount, vatPct: 5, costCentre: o.costCentre })),
      approval: 'Approved', approver: 'Ahmed Al Khouri', payStatus: 'Unpaid', amountPaid: 0, activity: 'Rental', costCentre: o.costCentre, source: { type: 'Cross Hire', id: ch.id, number: ch.number, soId: o.id }, debitNoteIds: [],
      log: [lg(`${date} 10:00`, 'Bill created', `From cross-hire order ${ch.number}, supplier invoice ${ch.supplierInvoice}`), lg(`${date} 12:00`, 'Approved', undefined, 'green', 'Ahmed Al Khouri')],
    };
    bills.push(b);
    pending.push({ date, type: 'Purchases', refType: 'Bill', refId: b.id, refNumber: b.number, narration: `Bill ${b.number}, ${b.supplierName}`, lines: purchaseJournal(b), set: (j) => { b.journalId = j; } });
    if (paid) {
      const total = totalsOf(b).total;
      const pd = addDays(b.dueDate, -2);
      payN += 1;
      const p: PaymentEntry = { id: `pay-${payN}`, number: seriesNo('PAY', payN), direction: 'Send', date: pd, partyType: 'Supplier', partyId: b.supplierId, partyName: b.supplierName, method: 'Bank', bankAccount: 'Emirates NBD Current 1015-447821-01',
        reference: `OUT-${b.number.slice(-5)}`, amount: total, isAdvance: false, advanceUsed: 0, allocations: [{ docType: 'bill', docId: b.id, docNumber: b.number, amount: total }], approval: 'Approved',
        log: [lg(`${pd} 11:00`, 'Payment made', `Bank transfer, ${b.number}`), lg(`${pd} 11:30`, 'Approved', undefined, 'green')] };
      payments.push(p);
      b.amountPaid = total; b.payStatus = 'Paid';
      pending.push({ date: pd, type: 'Payment', refType: 'Payment', refId: p.id, refNumber: p.number, narration: `Payment ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
    }
    return b;
  };
  billOf(21, 'ch1', '2026-05-02', true);
  billOf(22, 'ch2', '2026-06-10', true);
  const b23 = billOf(23, 'ch5', '2026-09-28', false);
  const dn: NoteDoc = { id: 'dbn-3', number: seriesNo('DBN', 3), kind: 'Debit', date: '2026-09-29', partyId: b23.supplierId, partyName: b23.supplierName, reason: 'Unit breakdown downtime', againstId: b23.id, againstNumber: b23.number,
    lines: [{ id: lid(), item: 'Breakdown downtime', desc: 'Two days off hire, alternator fault on arrival', account: '510100', qty: 1, unit: 'Lump sum', rate: 900, discountPct: 0, vatPct: 5, costCentre: b23.costCentre }],
    approval: 'Approved', costCentre: b23.costCentre, log: [lg('2026-09-29 10:00', 'Debit note created'), lg('2026-09-29 12:00', 'Approved', undefined, 'green')] };
  debitNotes.push(dn);
  b23.debitNoteIds.push(dn.id);
  b23.amountPaid = totalsOf({ lines: dn.lines }).total;
  b23.payStatus = payStatusOf(totalsOf(b23).total - b23.amountPaid, totalsOf(b23).total);
  pending.push({ date: dn.date, type: 'Debit Note', refType: 'Debit Note', refId: dn.id, refNumber: dn.number, narration: `Debit note ${dn.number} against ${dn.againstNumber}`, lines: noteJournal(dn), set: (j) => { dn.journalId = j; } });

  /* -------- journals numbered in posting order */
  const journals: Journal[] = pending.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((p, i) => {
    const n = 200 + i;
    const id = `jv-${n}`;
    p.set(id);
    return { id, number: seriesNo('JV', n), postingDate: p.date, journalType: p.type, refType: p.refType, refId: p.refId, refNumber: p.refNumber, status: 'Posted', currency: 'AED', narration: p.narration, createdBy: 'System (on approval)', lines: p.lines };
  });

  /* -------- Previous Jobs: the monthly invoicing runs that raised the rental history */
  const runs = new Map<string, SalesInvoice[]>();
  rentalBuilt.forEach(({ r }) => runs.set(r.date.slice(0, 7), [...(runs.get(r.date.slice(0, 7)) ?? []), r]));
  const rentalRuns: RentalRun[] = [...runs.entries()].sort().slice(-4).map(([, list], i) => {
    const n = 9 + i;
    const at = list.map((r) => r.date).sort().pop()!;
    return { id: `run-${n}`, number: seriesNo('RUN', n), runAt: `${at} 06:00`, soIds: [...new Set(list.map((r) => r.soId!))], soNumbers: [...new Set(list.map((r) => r.soNumber!))], invoiceIds: list.map((r) => r.id), status: 'Processed', message: `${list.length} invoice(s) raised`, by: 'System (scheduled run)' };
  });

  /* -------- one failed job line: SO-26-00046 was submitted but its invoice could not be saved, so its period is still waiting (Retry) */
  const failures: Built['failures'] = [];
  const so2Prior = rentalBuilt.filter((x) => x.o.id === 'so2').map((x) => x.r);
  const so2Next = nextPeriodFor(order('so2'), so2Prior);
  if (so2Next) {
    const n = 9 + rentalRuns.length;
    const err = 'Customer credit approval is pending in Accounting, the invoice could not be saved';
    rentalRuns.push({ id: `run-${n}`, number: seriesNo('RUN', n), runAt: `${ASOF} 07:30`, soIds: ['so2'], soNumbers: ['SO-26-00046'], invoiceIds: [], status: 'Failed', message: '0 of 1 invoice(s) raised', by: FIN, mode: 'Manual',
      lines: [{ soId: 'so2', soNumber: 'SO-26-00046', from: so2Next.from, to: so2Next.to, kind: 'recurring', status: 'failed', error: err }] });
    failures.push({ id: `so2|${so2Next.from}`, soId: 'so2', from: so2Next.from, to: so2Next.to, error: err, jobId: `run-${n}` });
  }

  SEED_MAX.PAY = Math.max(SEED_MAX.PAY, payN);
  SEED_MAX.JV = Math.max(400, 200 + journals.length);
  SEED_MAX.RUN = Math.max(SEED_MAX.RUN, 8 + rentalRuns.length);
  return { invoices, bills, payments, creditNotes, debitNotes, journals, rentalRuns, failures };
}

let seeded = false;
/** Seeds every accounting collection once (first caller wins). */
export function seedAccounting() {
  if (seeded) return;
  seeded = true;
  const b = buildAccountingSeed();
  seedCollection(COLA.invoices, b.invoices); seedCollection(COLA.bills, b.bills); seedCollection(COLA.payments, b.payments);
  seedCollection(COLA.creditNotes, b.creditNotes); seedCollection(COLA.debitNotes, b.debitNotes); seedCollection(COLA.journals, b.journals); seedCollection(COLA.rentalRuns, b.rentalRuns); seedCollection(COLA.schedFail, b.failures);
}
export { vatPctOf };
