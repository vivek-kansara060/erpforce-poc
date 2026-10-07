/**
 * Accounting engine of the POC: every invoice, bill, payment, note and journal is created and changed here. CRM, Rental and Inventory call these functions
 * instead of writing invoice numbers on their own records. It writes only the accounting collections; back-links on source documents are written by the
 * caller (crm/flow.ts, inventory pages). It must not import crm/flow.ts (flow imports this file).
 */
import { getCollection, setCollection } from '@/store/store';
import { customers, suppliers } from '@/mock-data/masters';
import { ACTOR, COL, TODAY, assetById, assetLabel, cust, custName, hasWaiver, log, type Delivery, type JobCard, type SalesOrder, type Trip, type TripExpense } from '@/modules/crm/data';
import { advanceJournal, buildRentalLines, headerFromOrder, lid, linesFromJobCard, linesFromOrder, nextPeriodFor, noteJournal, paymentJournal, purchaseJournal, salesJournal, type RentalBuild } from './billing';
import {
  ACC, COLA, EDITABLE, dueDateFor, expenseAccountFor, tripExpenseAccount, nextBillNo, nextCreditNo, nextDebitNo, nextInvoiceNo, nextJournalNo, nextPaymentNo, nextRunNo, payStatusOf, round2, totalsOf, uid, vatPctOf,
  type Allocation, type Bill, type InvLine, type Journal, type JournalLine, type JournalType, type NoteDoc, type PaymentEntry, type RentalRun, type SalesInvoice, type SourceRef,
} from './data';
import { seedAccounting } from './seed';

const all = <T,>(name: string): T[] => { seedAccounting(); return getCollection<T>(name); };
const put = <T extends { id: string }>(name: string, row: T) => setCollection(name, [row, ...all<T>(name)]);
const patch = <T extends { id: string }>(name: string, id: string, fn: (r: T) => T) => setCollection(name, all<T>(name).map((r) => (r.id === id ? fn(r) : r)));
const now = () => new Date().toTimeString().slice(0, 5);
export const ok = (message: string) => ({ ok: true as const, message });
export const fail = (message: string) => ({ ok: false as const, message });
export type Result = ReturnType<typeof ok> | ReturnType<typeof fail>;

/* ------------------------------------------------------------------ reads */
export const invoices = () => all<SalesInvoice>(COLA.invoices);
export const bills = () => all<Bill>(COLA.bills);
export const payments = () => all<PaymentEntry>(COLA.payments);
export const creditNotes = () => all<NoteDoc>(COLA.creditNotes);
export const debitNotes = () => all<NoteDoc>(COLA.debitNotes);
export const journals = () => all<Journal>(COLA.journals);
export const rentalRuns = () => all<RentalRun>(COLA.rentalRuns);
/** Lookup by id or by number (older links and seeds carry the number). */
export const invoiceByRef = (ref?: string) => (ref ? invoices().find((i) => i.id === ref || i.number === ref) : undefined);
export const billByRef = (ref?: string) => (ref ? bills().find((b) => b.id === ref || b.number === ref) : undefined);
export const paymentByRef = (ref?: string) => (ref ? payments().find((p) => p.id === ref || p.number === ref) : undefined);
export const journalByRef = (ref?: string) => (ref ? journals().find((j) => j.id === ref || j.number === ref) : undefined);
export const invoicesOfOrder = (soId: string) => invoices().filter((i) => i.soId === soId || i.source.soId === soId);
export const invoicesOfSource = (type: SourceRef['type'], id: string) => invoices().filter((i) => i.source.type === type && i.source.id === id);
export const billsOfSource = (type: SourceRef['type'], id: string) => bills().filter((b) => b.source.type === type && b.source.id === id);
export const rentalInvoicesOf = (soId: string) => invoices().filter((i) => i.isRental && i.soId === soId).sort((a, b) => ((a.periodFrom ?? '') < (b.periodFrom ?? '') ? -1 : 1));

/* ------------------------------------------------------------------ balances */
export const invoiceTotal = (i: SalesInvoice) => totalsOf(i).total;
export const billTotal = (b: Bill) => totalsOf(b).total;
export const invoiceDue = (i: SalesInvoice) => round2(invoiceTotal(i) - i.amountPaid);
export const billDue = (b: Bill) => round2(billTotal(b) - b.amountPaid);
/** Payment state of an invoice for display on its source document (job card, Sales Order); '-' when there is none. */
export function paymentStatusOf(ref?: string): string {
  const i = invoiceByRef(ref);
  if (!i) return '-';
  return i.approval === 'Approved' ? i.payStatus : `${i.approval} approval`;
}
export const openArOf = (customerId: string) => round2(invoices().filter((i) => i.customerId === customerId && i.approval === 'Approved').reduce((s, i) => s + invoiceDue(i), 0));
export const isOverdue = (i: { dueDate: string; payStatus: string; approval: string }) => i.approval === 'Approved' && i.payStatus !== 'Paid' && i.dueDate < TODAY;
/** Credit limit is a warning only (Req L345: hard block or warning to be confirmed). */
export function creditWarning(customerId: string | undefined, amount: number): string | undefined {
  const c = customerId ? cust(customerId) : undefined;
  if (!c || !c.creditLimit) return undefined;
  const exposure = openArOf(c.id) + amount;
  return exposure > c.creditLimit ? `${c.name}: open receivables plus this invoice (AED ${round2(exposure).toLocaleString('en-US')}) exceed the credit limit of AED ${c.creditLimit.toLocaleString('en-US')}` : undefined;
}
export const unappliedAdvances = (partyId?: string) => payments().filter((p) => p.direction === 'Receive' && p.isAdvance && p.approval === 'Approved' && p.partyId === partyId && advanceLeft(p) > 0.5);
export const advanceLeft = (p: PaymentEntry) => round2(p.amount - p.allocations.reduce((s, a) => s + a.amount, 0) - p.advanceUsed);
export const pendingCollectionFor = (invoiceId: string) => payments().find((p) => p.approval !== 'Approved' && p.approval !== 'Rejected' && p.allocations.some((a) => a.docId === invoiceId));

/* ------------------------------------------------------------------ journals */
function postJournal(type: JournalType, refType: string, refId: string, refNumber: string, narration: string, lines: JournalLine[], date = TODAY): string {
  const j: Journal = { id: uid('jv'), number: nextJournalNo(), postingDate: date, journalType: type, refType, refId, refNumber, status: 'Posted', currency: 'AED', narration, createdBy: ACTOR, lines };
  put(COLA.journals, j);
  return j.id;
}

/* ------------------------------------------------------------------ sales invoices */
export type InvoiceInput = Omit<SalesInvoice, 'id' | 'number' | 'approval' | 'payStatus' | 'amountPaid' | 'dueDate' | 'log' | 'creditNoteIds' | 'journalId' | 'postingTime' | 'exchangeRate' | 'discountOn' | 'discountPct' | 'roundOff' | 'attachments' | 'transactionType' | 'paymentTerms' | 'entity' | 'currency' | 'vatType'>
  & Partial<Pick<SalesInvoice, 'postingTime' | 'exchangeRate' | 'discountOn' | 'discountPct' | 'roundOff' | 'attachments' | 'transactionType' | 'paymentTerms' | 'entity' | 'currency' | 'vatType' | 'dueDate'>>;
/** Generated invoices are always Pending (decision D4); only the manual form can save a Draft. */
export function createInvoice(d: InvoiceInput, opts: { draft?: boolean } = {}): SalesInvoice {
  const date = d.date || TODAY;
  const terms = d.paymentTerms ?? (d.customerId ? `${cust(d.customerId)?.creditTerms ?? 30} days` : '30 days');
  const inv: SalesInvoice = {
    postingTime: now(), exchangeRate: 1, discountOn: 'None', discountPct: 0, roundOff: false, attachments: [], transactionType: 'Credit', entity: 'Gulf Power Rentals LLC', currency: 'AED', vatType: 'Standard (With VAT)',
    ...d, paymentTerms: terms, date, dueDate: d.dueDate || dueDateFor(date, terms), id: uid('inv'), number: nextInvoiceNo(), approval: opts.draft ? 'Draft' : 'Pending', payStatus: 'Unpaid', amountPaid: 0, creditNoteIds: [],
    log: [log(opts.draft ? 'Saved as draft' : 'Invoice created', d.source.type === 'Manual' ? 'Entered manually' : `From ${d.source.type} ${d.source.number}. Pending approval`, 'blue')],
  };
  const warn = creditWarning(inv.customerId, invoiceTotal(inv));
  if (warn) inv.log.push(log('Credit limit exceeded (warning only)', warn, 'amber'));
  put(COLA.invoices, inv);
  return inv;
}
export function updateInvoice(id: string, p: Partial<SalesInvoice>): Result {
  const i = invoiceByRef(id);
  if (!i || !EDITABLE.includes(i.approval)) return fail('Only a Draft, Pending or Rejected invoice can be edited');
  patch<SalesInvoice>(COLA.invoices, i.id, (x) => ({ ...x, ...p, dueDate: p.date || p.paymentTerms ? dueDateFor(p.date ?? x.date, p.paymentTerms ?? x.paymentTerms) : x.dueDate, log: [...x.log, log('Invoice edited')] }));
  return ok('Invoice updated');
}
export function submitInvoice(id: string, approver: string): Result {
  patch<SalesInvoice>(COLA.invoices, id, (x) => ({ ...x, approval: 'Submitted', approver, log: [...x.log, log('Submitted for approval', `Approver: ${approver}`, 'blue')] }));
  return ok(`Submitted to ${approver}`);
}
export function approveInvoice(id: string, how = 'Approved'): Result {
  const i = invoiceByRef(id);
  if (!i) return fail('Invoice not found');
  if (i.approval === 'Approved') return fail('Already approved');
  if (!i.lines.length) return fail('An invoice needs at least one line');
  const j = postJournal('Sales', 'Sales Invoice', i.id, i.number, `Sales invoice ${i.number}, ${i.partyName}`, salesJournal(i), i.date > TODAY ? i.date : TODAY);
  patch<SalesInvoice>(COLA.invoices, i.id, (x) => ({ ...x, approval: 'Approved', approver: x.approver ?? ACTOR, journalId: j, log: [...x.log, log(how, `Journal ${journalByRef(j)?.number} posted`, 'green')] }));
  // Existing ERP: a Cash invoice is settled by an automatic collection on approval.
  if (i.transactionType === 'Cash') {
    const p = createPayment({ direction: 'Receive', partyType: 'Customer', partyId: i.customerId, partyName: i.partyName, method: 'Cash', bankAccount: 'Cash in Hand (Jebel Ali Office)', amount: invoiceTotal(i), isAdvance: false, soId: i.soId, soNumber: i.soNumber,
      allocations: [{ docType: 'invoice', docId: i.id, docNumber: i.number, amount: invoiceTotal(i) }], narration: 'Cash invoice settled on approval' });
    approvePayment(p.id);
  }
  return ok(`${i.number} approved and posted`);
}
export function rejectInvoice(id: string, note: string): Result {
  patch<SalesInvoice>(COLA.invoices, id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Rejected', note, 'red')] }));
  return ok('Invoice rejected');
}
export function deleteInvoice(id: string): Result {
  const i = invoiceByRef(id);
  if (!i) return fail('Invoice not found');
  if (!EDITABLE.includes(i.approval) || i.amountPaid > 0) return fail('An approved or paid invoice cannot be deleted. Raise a Credit Note instead');
  setCollection(COLA.invoices, invoices().filter((x) => x.id !== i.id));
  return ok(`${i.number} deleted`);
}
export function duplicateInvoice(id: string): SalesInvoice | undefined {
  const i = invoiceByRef(id);
  if (!i) return undefined;
  const { id: _i, number: _n, approval: _a, payStatus: _p, amountPaid: _m, log: _l, creditNoteIds: _c, journalId: _j, dueDate: _d, ...rest } = i;
  void _i; void _n; void _a; void _p; void _m; void _l; void _c; void _j; void _d;
  return createInvoice({ ...rest, date: TODAY, lines: i.lines.map((l) => ({ ...l, id: lid() })), source: { type: 'Manual', id: i.id, number: i.number } });
}
export const logInvoice = (id: string, title: string, detail?: string) => patch<SalesInvoice>(COLA.invoices, id, (x) => ({ ...x, log: [...x.log, log(title, detail, 'blue')] }));

/* ------------------------------------------------------------------ bills */
export type BillInput = Omit<Bill, 'id' | 'number' | 'approval' | 'payStatus' | 'amountPaid' | 'dueDate' | 'log' | 'debitNoteIds' | 'journalId' | 'postingTime' | 'exchangeRate' | 'discountOn' | 'discountPct' | 'roundOff' | 'attachments' | 'paymentTerms' | 'entity' | 'currency'>
  & Partial<Pick<Bill, 'postingTime' | 'exchangeRate' | 'discountOn' | 'discountPct' | 'roundOff' | 'attachments' | 'paymentTerms' | 'entity' | 'currency' | 'dueDate'>>;
export function createBill(d: BillInput, opts: { draft?: boolean } = {}): Bill {
  const date = d.date || TODAY;
  const sup = suppliers.find((s) => s.id === d.supplierId);
  const terms = d.paymentTerms ?? `${sup?.creditPeriod || 30} days`;
  const b: Bill = {
    postingTime: now(), exchangeRate: 1, discountOn: 'None', discountPct: 0, roundOff: false, attachments: [], entity: 'Gulf Power Rentals LLC', currency: 'AED',
    ...d, paymentTerms: terms, date, dueDate: d.dueDate || dueDateFor(date, terms), id: uid('bill'), number: nextBillNo(), approval: opts.draft ? 'Draft' : 'Pending', payStatus: 'Unpaid', amountPaid: 0, debitNoteIds: [],
    log: [log(opts.draft ? 'Saved as draft' : 'Bill created', d.source.type === 'Manual' ? 'Entered manually' : `From ${d.source.type} ${d.source.number}. Pending approval`, 'blue')],
  };
  put(COLA.bills, b);
  return b;
}
export function updateBill(id: string, p: Partial<Bill>): Result {
  const b = billByRef(id);
  if (!b || !EDITABLE.includes(b.approval)) return fail('Only a Draft, Pending or Rejected bill can be edited');
  patch<Bill>(COLA.bills, b.id, (x) => ({ ...x, ...p, dueDate: p.date || p.paymentTerms ? dueDateFor(p.date ?? x.date, p.paymentTerms ?? x.paymentTerms) : x.dueDate, log: [...x.log, log('Bill edited')] }));
  return ok('Bill updated');
}
export function submitBill(id: string, approver: string): Result {
  patch<Bill>(COLA.bills, id, (x) => ({ ...x, approval: 'Submitted', approver, log: [...x.log, log('Submitted for approval', `Approver: ${approver}`, 'blue')] }));
  return ok(`Submitted to ${approver}`);
}
export function approveBill(id: string, how = 'Approved'): Result {
  const b = billByRef(id);
  if (!b) return fail('Bill not found');
  if (b.approval === 'Approved') return fail('Already approved');
  const j = postJournal('Purchases', 'Bill', b.id, b.number, `Bill ${b.number}, ${b.supplierName}`, purchaseJournal(b));
  patch<Bill>(COLA.bills, b.id, (x) => ({ ...x, approval: 'Approved', approver: x.approver ?? ACTOR, journalId: j, log: [...x.log, log(how, `Journal ${journalByRef(j)?.number} posted`, 'green')] }));
  return ok(`${b.number} approved and posted`);
}
export function rejectBill(id: string, note: string): Result {
  patch<Bill>(COLA.bills, id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Rejected', note, 'red')] }));
  return ok('Bill rejected');
}
export function deleteBill(id: string): Result {
  const b = billByRef(id);
  if (!b) return fail('Bill not found');
  if (!EDITABLE.includes(b.approval) || b.amountPaid > 0) return fail('An approved or paid bill cannot be deleted. Raise a Debit Note instead');
  setCollection(COLA.bills, bills().filter((x) => x.id !== b.id));
  return ok(`${b.number} deleted`);
}

/* ------------------------------------------------------------------ collections and payments */
export type PaymentInput = Omit<PaymentEntry, 'id' | 'number' | 'approval' | 'advanceUsed' | 'log' | 'journalId' | 'date'> & { date?: string };
/** Collections and Payments are created Pending and change the invoice only when approved (decision D5, existing ERP). */
export function createPayment(d: PaymentInput, opts: { approve?: boolean } = {}): PaymentEntry {
  const p: PaymentEntry = { ...d, date: d.date || TODAY, id: uid('pay'), number: nextPaymentNo(), approval: 'Pending', advanceUsed: 0,
    log: [log(d.direction === 'Receive' ? (d.isAdvance && !d.allocations.length ? 'Advance collection created' : 'Collection created') : 'Payment created', `${d.method}, AED ${d.amount}. Pending approval`, 'blue')] };
  put(COLA.payments, p);
  if (opts.approve) approvePayment(p.id);
  return p;
}
export function paymentErrors(d: Pick<PaymentEntry, 'amount' | 'isAdvance' | 'allocations' | 'partyName'>): string | undefined {
  if (!d.partyName) return 'Select the party';
  if (!(d.amount > 0)) return 'Enter an amount greater than zero';
  const alloc = round2(d.allocations.reduce((s, a) => s + a.amount, 0));
  if (alloc > d.amount + 0.005) return 'The allocated total is more than the amount';
  if (alloc < d.amount - 0.005 && !d.isAdvance) return 'Allocate the full amount, or tick Advance for the unallocated part';
  for (const a of d.allocations) {
    const due = a.docType === 'invoice' ? (invoiceByRef(a.docId) ? invoiceDue(invoiceByRef(a.docId)!) : 0) : (billByRef(a.docId) ? billDue(billByRef(a.docId)!) : 0);
    if (a.amount > due + 0.005) return `${a.docNumber}: allocation is more than the amount due (AED ${due})`;
  }
  return undefined;
}
function settle(docType: 'invoice' | 'bill', id: string, amount: number, note: string) {
  if (docType === 'invoice') patch<SalesInvoice>(COLA.invoices, id, (x) => { const paid = round2(x.amountPaid + amount); const t = invoiceTotal(x); return { ...x, amountPaid: paid, payStatus: payStatusOf(t - paid, t), log: [...x.log, log(note, `AED ${amount}`, 'green')] }; });
  else patch<Bill>(COLA.bills, id, (x) => { const paid = round2(x.amountPaid + amount); const t = billTotal(x); return { ...x, amountPaid: paid, payStatus: payStatusOf(t - paid, t), log: [...x.log, log(note, `AED ${amount}`, 'green')] }; });
}
export function approvePayment(id: string): Result {
  const p = paymentByRef(id);
  if (!p) return fail('Entry not found');
  if (p.approval === 'Approved') return fail('Already approved');
  const err = paymentErrors(p);
  if (err) return fail(err);
  const j = postJournal(p.direction === 'Receive' ? 'Cash Receipt Voucher' : 'Payment', p.direction === 'Receive' ? 'Collection' : 'Payment', p.id, p.number, `${p.direction === 'Receive' ? 'Collection' : 'Payment'} ${p.number}, ${p.partyName}`, paymentJournal(p), p.date);
  patch<PaymentEntry>(COLA.payments, p.id, (x) => ({ ...x, approval: 'Approved', journalId: j, log: [...x.log, log('Approved', `Journal ${journalByRef(j)?.number} posted`, 'green')] }));
  p.allocations.forEach((a) => settle(a.docType, a.docId, a.amount, `${p.direction === 'Receive' ? 'Collection' : 'Payment'} ${p.number} applied`));
  return ok(`${p.number} approved`);
}
export function rejectPayment(id: string, note: string): Result {
  patch<PaymentEntry>(COLA.payments, id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Rejected', note, 'red')] }));
  return ok('Entry rejected');
}
/** Apply Payment (existing ERP): use an approved advance against an approved invoice. */
export function applyAdvance(invoiceId: string, paymentId: string, amount: number): Result {
  const i = invoiceByRef(invoiceId);
  const p = paymentByRef(paymentId);
  if (!i || !p) return fail('Not found');
  if (i.approval !== 'Approved') return fail('Approve the invoice first');
  const amt = round2(Math.min(amount, advanceLeft(p), invoiceDue(i)));
  if (!(amt > 0)) return fail('Nothing to apply');
  postJournal('Cash Receipt Voucher', 'Advance applied', i.id, i.number, `Advance ${p.number} applied to ${i.number}`, advanceJournal(i.partyName, amt, i.number));
  patch<PaymentEntry>(COLA.payments, p.id, (x) => ({ ...x, advanceUsed: round2(x.advanceUsed + amt), log: [...x.log, log(`Applied to ${i.number}`, `AED ${amt}`, 'green')] }));
  settle('invoice', i.id, amt, `Advance ${p.number} applied`);
  return ok(`AED ${amt} of ${p.number} applied to ${i.number}`);
}

/* ------------------------------------------------------------------ credit and debit notes */
export function createNote(kind: 'Credit' | 'Debit', againstId: string, lines: InvLine[], reason: string, date = TODAY): { ok: boolean; message: string; note?: NoteDoc } {
  const doc = kind === 'Credit' ? invoiceByRef(againstId) : billByRef(againstId);
  if (!doc) return fail('Document not found');
  if (doc.approval !== 'Approved') return fail('Only an approved document can be credited');
  if (!lines.length) return fail('Add at least one line');
  const t = totalsOf({ lines }).total;
  const due = kind === 'Credit' ? invoiceDue(doc as SalesInvoice) : billDue(doc as Bill);
  if (t > due + 0.005) return fail(`The note total (AED ${t}) is more than the amount due (AED ${due})`);
  const party = kind === 'Credit' ? (doc as SalesInvoice).partyName : (doc as Bill).supplierName;
  const partyId = kind === 'Credit' ? (doc as SalesInvoice).customerId : (doc as Bill).supplierId;
  const n: NoteDoc = { id: uid(kind === 'Credit' ? 'crn' : 'dbn'), number: kind === 'Credit' ? nextCreditNo() : nextDebitNo(), kind, date, partyId, partyName: party, reason, againstId: doc.id, againstNumber: doc.number, lines, approval: 'Pending', costCentre: doc.costCentre,
    log: [log(`${kind} note created`, `Against ${doc.number}. Pending approval`, 'blue')] };
  put(kind === 'Credit' ? COLA.creditNotes : COLA.debitNotes, n);
  return { ok: true, message: `${n.number} created`, note: n };
}
export function approveNote(kind: 'Credit' | 'Debit', id: string): Result {
  const col = kind === 'Credit' ? COLA.creditNotes : COLA.debitNotes;
  const n = all<NoteDoc>(col).find((x) => x.id === id || x.number === id);
  if (!n) return fail('Note not found');
  if (n.approval === 'Approved') return fail('Already approved');
  const j = postJournal(kind === 'Credit' ? 'Credit Note' : 'Debit Note', `${kind} Note`, n.id, n.number, `${kind} note ${n.number} against ${n.againstNumber}`, noteJournal(n));
  patch<NoteDoc>(col, n.id, (x) => ({ ...x, approval: 'Approved', journalId: j, log: [...x.log, log('Approved', `Journal ${journalByRef(j)?.number} posted. ${x.againstNumber} settled`, 'green')] }));
  const t = totalsOf({ lines: n.lines }).total;
  if (kind === 'Credit') patch<SalesInvoice>(COLA.invoices, n.againstId, (x) => ({ ...x, creditNoteIds: [...x.creditNoteIds, n.id] }));
  else patch<Bill>(COLA.bills, n.againstId, (x) => ({ ...x, debitNoteIds: [...x.debitNoteIds, n.id] }));
  settle(kind === 'Credit' ? 'invoice' : 'bill', n.againstId, t, `${kind} note ${n.number} settled`);
  return ok(`${n.number} approved`);
}
export function rejectNote(kind: 'Credit' | 'Debit', id: string, note: string): Result {
  patch<NoteDoc>(kind === 'Credit' ? COLA.creditNotes : COLA.debitNotes, id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Rejected', note, 'red')] }));
  return ok('Note rejected');
}
export const noteByRef = (kind: 'Credit' | 'Debit', ref?: string) => (ref ? (kind === 'Credit' ? creditNotes() : debitNotes()).find((n) => n.id === ref || n.number === ref) : undefined);

/* ------------------------------------------------------------------ generators from source documents (always Pending, D4) */
const orders = () => getCollection<SalesOrder>(COL.orders);
const deliveries = () => getCollection<Delivery>(COL.deliveries);
const orderOf = (id?: string) => orders().find((o) => o.id === id);

/** Sales Order lines other than Rental and AMC, one invoice. */
export function invoiceFromOrderLines(soId: string, lineIds: string[]): SalesInvoice | undefined {
  const o = orderOf(soId);
  if (!o) return undefined;
  const ls = o.lines.filter((l) => lineIds.includes(l.id));
  if (!ls.length) return undefined;
  return createInvoice({ ...headerFromOrder(o), date: TODAY, lines: linesFromOrder(o, ls), narration: `${o.number}: ${ls.map((l) => l.item).join(', ')}`, source: { type: 'Sales Order', id: o.id, number: o.number, soId: o.id, lineIds } });
}
const assetLabelLive = (id: string) => assetLabel(assetById(id));
export const nextRentalPeriod = (soId: string) => { const o = orderOf(soId); return o ? nextPeriodFor(o, rentalInvoicesOf(soId)) : undefined; };
/** Preview of the next rental invoice of an order (no write). */
export function previewRental(soId: string, from: string, to: string): RentalBuild | undefined {
  const o = orderOf(soId);
  return o ? buildRentalLines(o, deliveries(), rentalInvoicesOf(soId), from, to, assetLabelLive) : undefined;
}
export function invoiceRentalPeriod(soId: string, from: string, to: string): { invoice?: SalesInvoice; oneTimeLineIds: string[]; message: string } {
  const o = orderOf(soId);
  if (!o) return { oneTimeLineIds: [], message: 'Order not found' };
  const b = buildRentalLines(o, deliveries(), rentalInvoicesOf(soId), from, to, assetLabelLive);
  if (!b.lines.length) return { oneTimeLineIds: [], message: b.message };
  const invoice = createInvoice({ ...headerFromOrder(o), date: TODAY, lines: b.lines, isRental: true, periodFrom: from, periodTo: to, narration: `Rental invoice${b.isFinal ? ' (final)' : ''} for the billing period`,
    source: { type: 'Rental Cycle', id: o.id, number: o.number, soId: o.id, lineIds: b.oneTimeLineIds } });
  return { invoice, oneTimeLineIds: b.oneTimeLineIds, message: `${invoice.number} raised for ${o.number}` };
}
export function recordRun(r: Omit<RentalRun, 'id' | 'number' | 'runAt' | 'by'>): RentalRun {
  const run: RentalRun = { ...r, id: uid('run'), number: nextRunNo(), runAt: `${TODAY} ${now()}`, by: ACTOR };
  put(COLA.rentalRuns, run);
  return run;
}
export function invoiceFromJobCard(jc: JobCard): SalesInvoice {
  const o = orderOf(jc.soId);
  return createInvoice({ ...(o ? headerFromOrder(o) : { partyName: custName(jc.customerId), customerId: jc.customerId }), activity: 'AMC', date: TODAY, lines: linesFromJobCard(jc, o), narration: `AMC visit ${jc.visitIdx + 1}, job card ${jc.number}`,
    source: { type: 'Job Card', id: jc.id, number: jc.number, soId: jc.soId } });
}
/** Damage or failed-collection charge on a Sales Order. Refused when the client paid a damage waiver (call 22 Sep). */
export function invoiceFromDamage(soId: string, idx: number): { ok: boolean; message: string; invoice?: SalesInvoice } {
  const o = orderOf(soId);
  const c = o?.damageCharges[idx];
  if (!o || !c) return fail('Charge not found');
  if (hasWaiver(o.lines) && !/failed collection/i.test(c.note)) return fail('A damage waiver was paid on this order, a damage invoice is not allowed');
  const invoice = createInvoice({ ...headerFromOrder(o), date: TODAY, lines: [{ id: lid(), item: /failed collection/i.test(c.note) ? 'Failed collection charge' : 'Damage charge', desc: `${assetLabelLive(c.assetId)}: ${c.note}`, account: '410600', qty: 1, unit: 'Lump sum', rate: c.amount, discountPct: 0, vatPct: vatPctOf(o.vatType), activity: o.activity, costCentre: o.costCentre, assetId: c.assetId, tag: 'damage' }],
    narration: `Charge on ${o.number}`, source: { type: 'Damage Charge', id: `${o.id}#${idx}`, number: o.number, soId: o.id } });
  return { ok: true, message: `${invoice.number} raised`, invoice };
}
export function invoiceFromDisposal(i: { disposalId: string; number: string; assetId: string; assetName?: string; method: string; buyer: string; customerId?: string; amount: number; date: string }): SalesInvoice {
  return createInvoice({ customerId: i.customerId, partyName: i.buyer, paymentTerms: 'Immediate', date: i.date, activity: 'Fixed Asset Trading',
    lines: [{ id: lid(), item: i.method === 'Scrap' ? 'Scrap sale' : 'Sale of fixed asset', desc: `${i.assetId}${i.assetName ? ` - ${i.assetName}` : ''}, disposal ${i.number}`, account: '410700', qty: 1, unit: 'Nos', rate: i.amount, discountPct: 0, vatPct: 5, activity: 'Fixed Asset Trading', tag: 'asset-sale' }],
    narration: `Disposal ${i.number} (${i.method})`, source: { type: 'Asset Disposal', id: i.disposalId, number: i.number } });
}
/** Advance received against a Sales Order: a Pending advance Collection (D5). */
export function advanceCollection(i: { soId: string; amount: number; method: PaymentEntry['method']; bankAccount: string; reference?: string; date?: string }): PaymentEntry | undefined {
  const o = orderOf(i.soId);
  if (!o) return undefined;
  return createPayment({ direction: 'Receive', partyType: 'Customer', partyId: o.customerId, partyName: custName(o.customerId), method: i.method, bankAccount: i.bankAccount, reference: i.reference, amount: i.amount, isAdvance: true, soId: o.id, soNumber: o.number, allocations: [], date: i.date, narration: `Advance against ${o.number}` });
}
interface CrossHireLike { id: string; number: string; soId: string; soNumber: string; group: string; category: string; supplierId: string; supplier: string; rate: number; qty?: number; startDate?: string; endDate?: string; paymentTerms?: string; expenses?: { account: string; amount: number; note: string }[] }
export function billFromCrossHire(ch: CrossHireLike, supplierInvoiceNo: string, supplierInvoiceDate: string): Bill {
  const o = orderOf(ch.soId);
  return createBill({ supplierId: ch.supplierId, supplierName: ch.supplier, supplierInvoiceNo, supplierInvoiceDate, date: TODAY, orderRef: ch.number, activity: 'Rental', costCentre: o?.costCentre, paymentTerms: ch.paymentTerms,
    lines: [{ id: lid(), item: `Cross-hire ${ch.group} ${ch.category}`, desc: `${ch.number} for ${ch.soNumber}`, account: '510100', qty: ch.qty ?? 1, unit: 'Nos', rate: ch.rate, discountPct: 0, vatPct: 5, activity: 'Rental', costCentre: o?.costCentre, tag: 'cross-hire' }],
    expenses: (ch.expenses ?? []).map((e) => ({ id: lid(), account: expenseAccountFor(e.account), desc: e.note || e.account, amount: e.amount, vatPct: 5, costCentre: o?.costCentre })),
    narration: `Cross-hire order ${ch.number}`, source: { type: 'Cross Hire', id: ch.id, number: ch.number, soId: ch.soId } });
}
export function billDisputeCharge(ch: CrossHireLike, amount: number): Bill {
  const o = orderOf(ch.soId);
  return createBill({ supplierId: ch.supplierId, supplierName: ch.supplier, supplierInvoiceNo: `${ch.number}-DSP`, supplierInvoiceDate: TODAY, date: TODAY, orderRef: ch.number, activity: 'Rental', costCentre: o?.costCentre, paymentTerms: ch.paymentTerms,
    lines: [{ id: lid(), item: 'Supplier dispute / additional charge', desc: `${ch.number}, charged on return to supplier`, account: '510500', qty: 1, unit: 'Lump sum', rate: amount, discountPct: 0, vatPct: 5, activity: 'Rental', costCentre: o?.costCentre, tag: 'cross-hire' }],
    expenses: [], narration: `Supplementary bill for ${ch.number}`, source: { type: 'Cross Hire', id: ch.id, number: ch.number, soId: ch.soId } });
}
/** An external transporter's Transport Charge is billed to the transporter (a supplier): one Pending bill per charge, so a charge added after completion gets its own bill. */
export function billTripCharge(t: Trip, e: Pick<TripExpense, 'amount' | 'note'>): Bill {
  const sup = suppliers.find((s) => s.name === t.transporter);
  return createBill({ supplierId: sup?.id, supplierName: t.transporter ?? 'External transporter', supplierInvoiceNo: '', supplierInvoiceDate: TODAY, date: TODAY, orderRef: t.number, costCentre: t.costCentre,
    lines: [{ id: lid(), item: `Transport charge, ${t.kind.toLowerCase()}`, desc: `${t.number} for ${t.docNumber}${e.note ? `, ${e.note}` : ''}`, account: tripExpenseAccount('Transport Charge'), qty: 1, unit: 'Trip', rate: e.amount, discountPct: 0, vatPct: 5, costCentre: t.costCentre, tag: 'transport' as const }],
    expenses: [], narration: `Trip ${t.number}`, source: { type: 'Trip', id: t.id, number: t.number, soId: t.soId } });
}
/** Own-fleet cost (Salik, fuel, parking...) posted to the ledger when it is added: Dr the expense account, Cr Accrued Trip Expenses, both on the order's cost centre. */
export function postTripExpense(t: Trip, e: Pick<TripExpense, 'type' | 'amount' | 'note'>): string {
  const memo = `${t.number}: ${e.type}${e.note ? `, ${e.note}` : ''}`;
  return postJournal('Trip Expense', 'Trip', t.id, t.number, `Trip expense ${t.number} for ${t.docNumber}, ${e.type}`, [
    { account: tripExpenseAccount(e.type), debit: e.amount, credit: 0, costCentre: t.costCentre, memo },
    { account: ACC.tripAccrual, debit: 0, credit: e.amount, costCentre: t.costCentre, memo },
  ]);
}
/** A posted journal is never edited: removing or cancelling an expense posts the opposite journal. */
export function reverseJournal(journalId: string, why: string): string | undefined {
  const j = journalByRef(journalId);
  if (!j) return undefined;
  return postJournal('Trip Expense', j.refType, j.refId, j.refNumber, `Reversal of ${j.number}: ${why}`, j.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })));
}
/** A trip cost is taken back: a bill that is not yet approved is rejected, an approved one gets a Pending Debit Note for the full amount. */
export function voidTripBill(billId: string, why: string): { ok: boolean; message: string } {
  const b = billByRef(billId);
  if (!b) return fail('Bill not found');
  if (b.approval !== 'Approved') {
    patch<Bill>(COLA.bills, b.id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Voided', why, 'red')] }));
    return ok(`${b.number} voided`);
  }
  const r = createNote('Debit', b.id, b.lines, 'Other');
  return r.ok ? ok(`Debit Note ${r.note?.number} raised against ${b.number}, pending approval`) : fail(`${b.number} is approved and cannot be reversed automatically: ${r.message}`);
}

/* ------------------------------------------------------------------ allocations helper for the payment forms */
export function openDocsOf(direction: 'Receive' | 'Send', partyId?: string, partyName?: string): { doc: SalesInvoice | Bill; due: number; type: Allocation['docType'] }[] {
  if (direction === 'Receive') return invoices().filter((i) => i.approval === 'Approved' && i.payStatus !== 'Paid' && (partyId ? i.customerId === partyId : i.partyName === partyName)).sort((a, b) => (a.date < b.date ? -1 : 1)).map((i) => ({ doc: i, due: invoiceDue(i), type: 'invoice' as const }));
  return bills().filter((b) => b.approval === 'Approved' && b.payStatus !== 'Paid' && (partyId ? b.supplierId === partyId : b.supplierName === partyName)).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ doc: b, due: billDue(b), type: 'bill' as const }));
}
export { customers, suppliers };
