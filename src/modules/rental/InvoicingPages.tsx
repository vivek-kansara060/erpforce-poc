import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Tooltip } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { DateInput, FormGrid, MultiSelectInput, SelectInput, TextInput } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TODAY, custName, type SalesOrder } from '@/modules/crm/data';
import { outstanding } from '@/modules/crm/flow';
import { aed, useOrders } from '@/modules/crm/shared';
import { RENTAL_RULE } from '@/modules/accounting/billing';
import { type JobLine, type RentalRun } from '@/modules/accounting/data';
import { accumulateSchedules, dueSchedules, jobLinesOf, processAutomatic, retryJobLine, submitSchedules, type Sched } from '@/modules/accounting/schedule';
import { R_ACC, useInvoices, useRentalRuns } from '@/modules/accounting/shared';
import { cycleOf } from '@/modules/accounting/billing';

const TO_CONFIRM = 'Rule to be confirmed with client';
const kindChip = (s: { kind: string; status: string }) => (
  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}><StatusChip status={s.kind === 'initial' ? 'Initial' : 'Recurring'} tone={s.kind === 'initial' ? 'blue' : 'amber'} />{s.status === 'failed' && <StatusChip status="Failed" tone="red" />}</Box>
);

/**
 * Invoicing Rental Order (existing ERP): one row per invoice schedule that is due on or before the Next Invoice Date, filtered by customer and subsidiary.
 * Submit raises one invoice per order and period as a job; Accumulate Orders puts one customer's schedules on a single invoice.
 */
export function RentalInvoicingList() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const inv = useInvoices();
  const runs = useRentalRuns();
  const [upTo, setUpTo] = useState(TODAY);
  const [cust, setCust] = useState<string[]>([]);
  const [ent, setEnt] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const [acc, setAcc] = useState(false);
  const rows = useMemo(() => dueSchedules({ upTo, customerIds: cust, entities: ent }), [upTo, cust, ent, tick, orders.rows, inv.rows, runs.rows]);
  const customerOpts = [...new Map(orders.rows.filter((o) => o.activity === 'Rental').map((o) => [o.customerId, { value: o.customerId, label: custName(o.customerId) }])).values()];
  const entityOpts = [...new Set(orders.rows.filter((o) => o.activity === 'Rental').map((o) => o.entity))];
  const chosen = rows.filter((r) => sel.includes(r.id));
  const submit = () => {
    const run = submitSchedules(chosen);
    toast(`${run.message}${run.status === 'Processed' ? ', pending approval in Accounting' : '. See Previous Jobs'}`, run.status === 'Failed' ? 'error' : 'success');
    setSel([]); setAsk(false); setTick(tick + 1);
  };
  return (
    <Page>
      <PageTitle title="Invoicing Rental Order" subtitle="Invoice schedules due on or before the Next Invoice Date. Select the schedules and Submit, or Accumulate Orders of one customer on a single invoice." change="changed" req={R_ACC.rental}
        right={<Box sx={{ display: 'flex', gap: 1 }}><Button variant="outlined" onClick={() => setAcc(true)}>Accumulate Orders</Button><Button variant="outlined" onClick={() => { setTick(tick + 1); setSel([]); }}>Refresh</Button><Button variant="contained" disabled={!sel.length} onClick={() => setAsk(true)}>Submit</Button></Box>} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr 2fr' }, gap: 2, mb: 2 }}>
        <DateInput label="Next Invoice Date" required value={upTo} onChange={(v) => { setUpTo(v || TODAY); setSel([]); }} hint="Schedules whose invoice date is on or before this date" />
        <MultiSelectInput label="Customer" value={cust} options={customerOpts} onChange={(v) => { setCust(v); setSel([]); }} />
        <MultiSelectInput label="Subsidiary" value={ent} options={entityOpts} onChange={(v) => { setEnt(v); setSel([]); }} />
      </Box>
      <DataTable<Sched> rows={rows} selectable selected={sel} onSelect={setSel} searchPlaceholder="Search rental orders..." emptyText="No invoice schedule is due on this date" onRowClick={(r) => nav(`/crm/sales-orders/${r.soId}`)}
        columns={[
          { key: 'soNumber', label: 'Rental Order' }, { key: 'date', label: 'Date', render: (r) => orders.get(r.soId)?.date }, { key: 'customer', label: 'Customer' },
          { key: 'inv', label: 'Invoice', change: 'new', req: R_ACC.rental, render: kindChip }, { key: 'from', label: 'Start Date' }, { key: 'to', label: 'End Date' }, { key: 'invoiceDate', label: 'Next Invoice Date' },
          { key: 'cycle', label: 'Billing Cycle' }, { key: 'mode', label: 'Invoicing Type', change: 'new', req: R_ACC.rental, render: (r) => <StatusChip status={r.mode} tone={r.mode === 'Automatic' ? 'blue' : 'grey'} /> },
          { key: 'amount', label: 'Next invoice (incl. VAT)', align: 'right', change: 'new', req: R_ACC.rental, render: (r) => (r.amount ? aed(r.amount) : '-') }, { key: 'currency', label: 'Currency' },
          { key: 'narration', label: 'Narration', render: (r) => (r.error ? <Tooltip title={r.error}><span><Text type="s5" color="#C64D4D">Failed: {r.error.slice(0, 40)}...</Text></span></Tooltip> : `${(orders.get(r.soId) as SalesOrder | undefined)?.lines.reduce((n, l) => n + outstanding(l).length, 0) ?? 0} asset(s) out`) },
        ]} />
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{RENTAL_RULE} {TO_CONFIRM}.</Text>
      <ConfirmDialog open={ask} info title="Submit Orders" description={`Are you sure you want to proceed for ${chosen.length} order(s)? One invoice is raised for each order and period, Pending approval in Accounting, and the run is saved in Previous Jobs.`} confirmLabel="Proceed" onClose={() => setAsk(false)} onConfirm={submit} />
      {acc && <AccumulateDialog onClose={() => setAcc(false)} onDone={(msg) => { toast(msg); setAcc(false); setTick(tick + 1); setSel([]); }} />}
    </Page>
  );
}

/** Accumulate Orders: pick one customer, tick their due schedules, enter the nature of goods title: one invoice. */
function AccumulateDialog({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const toast = useToast();
  const orders = useOrders();
  const due = useMemo(() => dueSchedules({ upTo: TODAY }), []);
  const [customerId, setCustomerId] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const customers = [...new Map(due.map((d) => [d.customerId, { value: d.customerId, label: d.customer }])).values()];
  const rows = due.filter((d) => d.customerId === customerId);
  const chosen = rows.filter((r) => sel.includes(r.id));
  const dupOrder = new Set(chosen.map((c) => c.soId)).size !== chosen.length;
  void orders;
  return (
    <AppDialog open title="Accumulate Orders" onClose={onClose} maxWidth="lg" confirmLabel="Generate Invoice" confirmDisabled={!chosen.length || !title.trim() || dupOrder}
      onConfirm={() => { const run = accumulateSchedules(chosen, title.trim()); if (run.status === 'Failed') toast(run.message, 'error'); else onDone(`${run.message}. The invoice is Pending approval in Accounting`); }}>
      <Alert severity="info" sx={{ mb: 2 }}>One invoice for the selected schedules of one customer. Each order keeps its own ledger and next period.</Alert>
      <FormGrid cols={2}>
        <SelectInput label="Customer" required value={customerId} options={customers} onChange={(v) => { setCustomerId(v); setSel([]); }} />
        <TextInput label="Nature of goods title" required value={title} onChange={setTitle} hint="Shown on the accumulated invoice" />
      </FormGrid>
      <Box sx={{ mt: 2 }}>
        <DataTable<Sched> hideToolbar rows={rows} selectable selected={sel} onSelect={setSel} emptyText={customerId ? 'No schedule of this customer is due' : 'Choose a customer'}
          columns={[{ key: 'soNumber', label: 'Rental Order' }, { key: 'inv', label: 'Invoice', render: kindChip }, { key: 'from', label: 'Start Date' }, { key: 'to', label: 'End Date' }, { key: 'invoiceDate', label: 'Invoice Date' }, { key: 'amount', label: 'Amount (incl. VAT)', align: 'right', render: (r) => (r.amount ? aed(r.amount) : '-') }]} />
      </Box>
      {dupOrder && <Alert severity="warning" sx={{ mt: 1 }}>Select one schedule per order.</Alert>}
    </AppDialog>
  );
}

const jobStatusTone = (s: string) => (s === 'Processed' || s === 'processed' ? 'green' : s === 'Failed' || s === 'failed' ? 'red' : s === 'Partially Processed' ? 'amber' : s === 'queued' ? 'amber' : 'grey');
const customersOf = (r: RentalRun, orders: SalesOrder[]) => [...new Set(jobLinesOf(r).map((l) => orders.find((o) => o.id === l.soId)?.customerId).filter(Boolean).map((c) => custName(c!)))];

/** Previous Jobs (existing ERP): every submit, accumulate and scheduler run, with its status. A job opens into one line per order and period. */
export function PreviousJobs() {
  const nav = useNavigate();
  const toast = useToast();
  const runs = useRentalRuns();
  const orders = useOrders();
  useInvoices();
  return (
    <Page>
      <PageTitle title="Previous Jobs" subtitle="Each invoicing run: Submit, Accumulate Orders, or the scheduler for Automatic orders" change="changed" req={R_ACC.rental}
        right={<Button variant="outlined" onClick={() => { const r = processAutomatic(); toast(r ? `${r.number}: ${r.message}` : 'The scheduler found no Automatic schedule that is due', r ? 'success' : 'info'); }}>Run scheduler now</Button>} />
      <DataTable<RentalRun> rows={runs.rows} searchPlaceholder="Search jobs..." emptyText="No job yet" filter={{ key: 'status', options: ['Processed', 'Partially Processed', 'Failed'] }} onRowClick={(r) => nav(`/rental/previous-jobs/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'runAt', label: 'Date' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} tone={jobStatusTone(r.status)} /> },
          { key: 'customer', label: 'Customer', render: (r) => customersOf(r, orders.rows).join(', ') || 'All Customers' },
          { key: 'type', label: 'Type', change: 'new', req: R_ACC.rental, render: (r) => (r.accumulated ? 'Accumulated' : (r.mode ?? (r.by.startsWith('System') ? 'Automatic' : 'Manual'))) },
          { key: 'orders', label: 'Orders', render: (r) => r.soNumbers.join(', ') }, { key: 'by', label: 'Run By' },
        ]} />
    </Page>
  );
}

/** One job: a line per order and period with its status and invoice; failed lines can be retried. */
export function PreviousJobView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const runs = useRentalRuns();
  const orders = useOrders();
  useInvoices();
  const run = runs.get(id);
  if (!run) return <Page><PageTitle title="Job not found" right={<Button variant="outlined" onClick={() => nav('/rental/previous-jobs')}>Back</Button>} /></Page>;
  const lines = jobLinesOf(run).map((l, i) => ({ ...l, id: `${i}`, idx: i }));
  const ord = (soId: string) => orders.get(soId);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Previous Jobs', to: '/rental/previous-jobs' }, { label: run.number }]} status={<StatusChip status={run.status} tone={jobStatusTone(run.status)} />} />
      <Page sx={{ pt: 2 }}>
        <Text type="s4" color="theme.secondary.700" sx={{ mb: 1 }}>Run {run.runAt} by {run.by}. {run.message}.{run.accumulated ? ` Accumulated on one invoice: ${run.title}.` : ''}</Text>
        <DataTable<JobLine & { id: string; idx: number }> rows={lines} searchPlaceholder="Search..." filter={{ key: 'status', options: ['processed', 'failed', 'queued', 'cancelled', 'pending'] }}
          columns={[
            { key: 'soNumber', label: 'Rental Order' }, { key: 'date', label: 'Date', render: (l) => ord(l.soId)?.date ?? '-' }, { key: 'customer', label: 'Customer', render: (l) => (ord(l.soId) ? custName(ord(l.soId)!.customerId) : '-') },
            { key: 'from', label: 'Start Date' }, { key: 'to', label: 'End Date' }, { key: 'cycle', label: 'Billing Cycle', render: (l) => cycleOf(ord(l.soId)?.billingCycle).name }, { key: 'currency', label: 'Currency', render: (l) => ord(l.soId)?.currency ?? 'AED' },
            { key: 'status', label: 'Status', render: (l) => <StatusChip status={l.status} tone={jobStatusTone(l.status)} /> },
            { key: 'invoice', label: 'Invoice', render: (l) => (l.invoiceId ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/accounting/invoices/${l.invoiceId}`)}>{l.invoiceNumber}</Box> : '-') },
            { key: 'narration', label: 'Narration', render: (l) => l.error ?? (l.status === 'processed' ? 'Invoice raised, pending approval in Accounting' : '-') },
            { key: 'retry', label: '', render: (l) => (l.status === 'failed' ? <Button size="small" variant="outlined" onClick={() => { const r = retryJobLine(run.id, l.idx); toast(r.message, r.ok ? 'success' : 'error'); }}>Retry</Button> : null) },
          ]} />
      </Page>
    </>
  );
}
