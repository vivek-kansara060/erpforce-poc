/**
 * Invoice schedules and invoicing jobs of rental orders (existing ERP: Scheduled Invoices tab, Invoicing Rental Order, Previous Jobs).
 * The schedule of an order is derived from its Billing Cycle and its deliveries (billing.ts, periodsOf); invoiced periods come from the invoices themselves,
 * so a schedule can never disagree with the ledger. Only failures and jobs are stored.
 */
import dayjs from 'dayjs';
import { getCollection, setCollection } from '@/store/store';
import { COL, TODAY, custName, seedAll, type SalesOrder } from '@/modules/crm/data';
import { runAccumulatedRental, runRentalInvoice } from '@/modules/crm/flow';
import { cycleOf, periodsOf, type Period } from './billing';
import { COLA, type JobLine, type RentalRun } from './data';
import { invoiceByRef, invoiceTotal, patchRun, previewRental, recordRun, rentalInvoicesOf, rentalRuns } from './engine';
import { totalsOf } from './data';

export type SchedStatus = 'pending' | 'queued' | 'processed' | 'failed' | 'cancelled';
export interface Sched {
  id: string; soId: string; soNumber: string; customerId: string; customer: string; entity: string; currency: string; cycle: string; mode: string;
  kind: Period['kind']; from: string; to: string; invoiceDate: string; days: number; status: SchedStatus; invoiceId?: string; invoiceNumber?: string; error?: string; amount?: number; hasLines?: boolean;
}
interface Failure { id: string; soId: string; from: string; to: string; error: string; jobId?: string }

const orders = () => { seedAll(); return getCollection<SalesOrder>(COL.orders); };
const failures = () => { rentalRuns(); return getCollection<Failure>(COLA.schedFail); };
const days = (a: string, b: string) => dayjs(b).diff(dayjs(a), 'day') + 1;
const hasDelivered = (o: SalesOrder) => o.activity === 'Rental' && o.lines.some((l) => l.activity === 'Rental' && l.assigned.length > 0);

/** The schedule of one order: invoiced periods (processed), then the periods ahead up to the cycle's Max Schedule Count (pending or failed). */
export function schedulesOf(soId: string, withAmounts = true): Sched[] {
  const o = orders().find((x) => x.id === soId);
  if (!o || !hasDelivered(o)) return [];
  const cycle = cycleOf(o.billingCycle);
  const periods = periodsOf(o, cycle, 80);
  const invs = rentalInvoicesOf(o.id);
  const fails = failures();
  const maxAhead = cycle.maxSchedule && cycle.maxSchedule > 0 ? cycle.maxSchedule : 12;
  const base = { soId: o.id, soNumber: o.number, customerId: o.customerId, customer: custName(o.customerId), entity: o.entity, currency: o.currency, cycle: cycle.name, mode: o.invoicingType ?? cycle.invoicingType };
  const out: Sched[] = [];
  let ahead = 0;
  for (const p of periods) {
    const inv = invs.find((i) => (i.soPeriods ? i.soPeriods.some((x) => x.soId === o.id && x.from === p.from) : i.periodFrom === p.from));
    const row: Sched = { ...base, id: `${o.id}|${p.from}`, kind: p.kind, from: p.from, to: p.to, invoiceDate: p.to, days: days(p.from, p.to), status: 'pending' };
    if (inv) {
      out.push({ ...row, status: 'processed', invoiceId: inv.id, invoiceNumber: inv.number, amount: invoiceTotal(inv), hasLines: true });
      continue;
    }
    if (ahead >= maxAhead) break;
    ahead += 1;
    const f = fails.find((x) => x.soId === o.id && x.from === p.from);
    const pv = withAmounts ? previewRental(o.id, p.from, p.to) : undefined;
    out.push({ ...row, status: f ? 'failed' : 'pending', error: f?.error, amount: pv?.lines.length ? totalsOf({ lines: pv.lines }).total : undefined, hasLines: withAmounts ? !!pv?.lines.length : undefined });
  }
  return out;
}

/** Schedules due for invoicing on or before `upTo` (existing ERP: the Next Invoice Date filter): pending or failed, with something to bill. */
export function dueSchedules(f: { upTo: string; customerIds?: string[]; entities?: string[] } = { upTo: TODAY }): Sched[] {
  return orders().filter((o) => hasDelivered(o) && (!f.customerIds?.length || f.customerIds.includes(o.customerId)) && (!f.entities?.length || f.entities.includes(o.entity)))
    .flatMap((o) => schedulesOf(o.id)).filter((s) => (s.status === 'pending' || s.status === 'failed') && s.invoiceDate <= f.upTo && s.hasLines);
}

const setFailure = (s: { soId: string; from: string; to: string }, error: string | undefined, jobId?: string) => {
  const id = `${s.soId}|${s.from}`;
  const rest = failures().filter((x) => x.id !== id);
  setCollection(COLA.schedFail, error ? [{ id, soId: s.soId, from: s.from, to: s.to, error, jobId }, ...rest] : rest);
};

const toLine = (s: Sched, r: { number?: string; invoiceId?: string; message: string }): JobLine => (r.number
  ? { soId: s.soId, soNumber: s.soNumber, from: s.from, to: s.to, kind: s.kind, status: 'processed', invoiceId: r.invoiceId, invoiceNumber: r.number }
  : { soId: s.soId, soNumber: s.soNumber, from: s.from, to: s.to, kind: s.kind, status: 'failed', error: r.message });
const statusOf = (lines: JobLine[]): RentalRun['status'] => (lines.every((l) => l.status === 'processed') ? 'Processed' : lines.some((l) => l.status === 'processed') ? 'Partially Processed' : 'Failed');

/** Submit (existing ERP: Invoicing Rental Order > Submit): one invoice per order and period, recorded as one job. */
export function submitSchedules(items: Sched[], by?: string, mode: 'Manual' | 'Automatic' = 'Manual'): RentalRun {
  const lines: JobLine[] = [];
  [...items].sort((a, b) => (a.soNumber + a.from).localeCompare(b.soNumber + b.from)).forEach((s) => {
    let r: { number?: string; invoiceId?: string; message: string };
    try { r = runRentalInvoice(s.soId, s.from, s.to); } catch (e) { r = { message: e instanceof Error ? e.message : 'Invoice could not be created' }; }
    lines.push(toLine(s, r));
  });
  const run = recordRun({ soIds: [...new Set(lines.map((l) => l.soId))], soNumbers: [...new Set(lines.map((l) => l.soNumber))], invoiceIds: lines.filter((l) => l.invoiceId).map((l) => l.invoiceId!), status: statusOf(lines), mode, by,
    message: `${lines.filter((l) => l.status === 'processed').length} of ${lines.length} invoice(s) raised`, lines });
  lines.forEach((l) => setFailure(l, l.status === 'failed' ? l.error ?? 'Failed' : undefined, run.id));
  return run;
}

/** Accumulate Orders: one invoice for one customer's due periods, with the nature of goods title. */
export function accumulateSchedules(items: Sched[], title: string, by?: string): RentalRun {
  const r = runAccumulatedRental(items.map((s) => ({ soId: s.soId, from: s.from, to: s.to })), title);
  const lines: JobLine[] = items.map((s) => toLine(s, r));
  const run = recordRun({ soIds: [...new Set(lines.map((l) => l.soId))], soNumbers: [...new Set(lines.map((l) => l.soNumber))], invoiceIds: r.invoiceId ? [r.invoiceId] : [], status: statusOf(lines), accumulated: true, title, mode: 'Manual', by,
    message: r.message, lines });
  lines.forEach((l) => setFailure(l, l.status === 'failed' ? l.error ?? 'Failed' : undefined, run.id));
  return run;
}

/** Retry of a failed line of a job (existing ERP: Previous Jobs > job > Retry). */
export function retryJobLine(runId: string, idx: number): { ok: boolean; message: string } {
  const run = rentalRuns().find((r) => r.id === runId);
  const line = run && jobLinesOf(run)[idx];
  if (!run || !line || line.status !== 'failed') return { ok: false, message: 'Only a failed line can be retried' };
  let r: { number?: string; invoiceId?: string; message: string };
  try { r = runRentalInvoice(line.soId, line.from, line.to); } catch (e) { r = { message: e instanceof Error ? e.message : 'Invoice could not be created' }; }
  const next: JobLine = r.number ? { ...line, status: 'processed', invoiceId: r.invoiceId, invoiceNumber: r.number, error: undefined } : { ...line, error: r.message };
  patchRun(run.id, (x) => { const ls = jobLinesOf(x).map((l, i) => (i === idx ? next : l)); return { ...x, lines: ls, status: statusOf(ls), invoiceIds: ls.filter((l) => l.invoiceId).map((l) => l.invoiceId!) }; });
  setFailure(line, r.number ? undefined : r.message, run.id);
  return r.number ? { ok: true, message: `${r.number} raised` } : { ok: false, message: r.message };
}

/** Lines of a job; runs recorded before jobs carried lines are read from their invoices. */
export function jobLinesOf(run: RentalRun): JobLine[] {
  if (run.lines) return run.lines;
  return run.invoiceIds.map((id) => invoiceByRef(id)).filter(Boolean).map((i) => ({ soId: i!.soId ?? '', soNumber: i!.soNumber ?? '', from: i!.periodFrom ?? '', to: i!.periodTo ?? '', kind: 'recurring' as const, status: 'processed' as const, invoiceId: i!.id, invoiceNumber: i!.number }));
}

/**
 * The scheduler (existing ERP: a queue that raises Automatic invoices on their invoice date). Every Automatic order with a schedule due today or earlier is
 * invoiced as one job run by the system. Manual orders are left for Invoicing Rental Order.
 */
export function processAutomatic(): RentalRun | undefined {
  const items = dueSchedules({ upTo: TODAY }).filter((s) => s.mode === 'Automatic' && s.status === 'pending');
  if (!items.length) return undefined;
  return submitSchedules(items, 'System (scheduler)', 'Automatic');
}
