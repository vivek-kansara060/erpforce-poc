import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, useToast } from '@/components/Dialogs';
import { Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TODAY, custName, type SalesOrder } from '@/modules/crm/data';
import { outstanding, runRentalInvoice } from '@/modules/crm/flow';
import { aed, useOrders } from '@/modules/crm/shared';
import { RENTAL_RULE } from '@/modules/accounting/billing';
import { totalsOf } from '@/modules/accounting/data';
import { nextRentalPeriod, previewRental, recordRun, rentalInvoicesOf } from '@/modules/accounting/engine';
import { R_ACC, useInvoices, useRentalRuns } from '@/modules/accounting/shared';

const TO_CONFIRM = 'Rule to be confirmed with client';
interface Row { id: string; so: SalesOrder; last?: string; start?: string; next?: { from: string; to: string }; due: boolean; preview?: number; lines: number }

/**
 * Invoicing Rental Order (existing Rental screen, now live). Rental invoices are raised only here (decision D3): Run Invoicing bills the next period of each
 * selected order once that period has ended. Invoices are created Pending and approved in Accounting (decision D4).
 */
export function RentalInvoicingList() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const inv = useInvoices();
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const rows: Row[] = useMemo(() => orders.rows.filter((o) => o.activity === 'Rental' && o.lines.some((l) => l.activity === 'Rental' && l.assigned.length)).map((o) => {
    const prior = rentalInvoicesOf(o.id);
    const next = nextRentalPeriod(o.id);
    const pv = next ? previewRental(o.id, next.from, next.to) : undefined;
    const start = o.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned).map((a) => a.start).sort()[0];
    return { id: o.id, so: o, last: prior.slice(-1)[0]?.number, start, next, due: !!next && next.to <= TODAY && !!pv?.lines.length, preview: pv?.lines.length ? totalsOf({ lines: pv.lines }).total : undefined, lines: pv?.lines.length ?? 0 };
  }), [orders.rows, inv.rows]);
  const chosen = rows.filter((r) => sel.includes(r.id));
  const run = () => {
    const done: { so: string; n: string; id: string }[] = [];
    const skipped: string[] = [];
    chosen.forEach((r) => {
      if (!r.due || !r.next) { skipped.push(`${r.so.number} (${r.next ? `period ends ${r.next.to}` : 'nothing to bill'})`); return; }
      const x = runRentalInvoice(r.so.id, r.next.from, r.next.to);
      if (x.number && x.invoiceId) done.push({ so: r.so.number, n: x.number, id: x.invoiceId }); else skipped.push(`${r.so.number} (${x.message})`);
    });
    recordRun({ soIds: chosen.map((r) => r.so.id), soNumbers: chosen.map((r) => r.so.number), invoiceIds: done.map((d) => d.id), status: done.length ? 'Processed' : 'Nothing to bill',
      message: `${done.length} invoice(s) raised${done.length ? `: ${done.map((d) => d.n).join(', ')}` : ''}${skipped.length ? `. Not due: ${skipped.join('; ')}` : ''}` });
    toast(`${done.length} invoice(s) raised, pending approval in Accounting${skipped.length ? `; ${skipped.length} order(s) not due yet` : ''}`, done.length ? 'success' : 'info');
    setSel([]); setAsk(false);
  };
  return (
    <Page>
      <PageTitle title="Invoicing Rental Order" subtitle="Rental orders with delivered assets and their next billing period. Select orders and Run Invoicing; an order is invoiced once its period has ended." change="changed" req={R_ACC.rental}
        right={<Button variant="contained" disabled={!sel.length} onClick={() => setAsk(true)}>Run Invoicing</Button>} />
      <DataTable<Row> rows={rows} selectable selected={sel} onSelect={setSel} searchPlaceholder="Search rental orders..." onRowClick={(r) => nav(`/crm/sales-orders/${r.so.id}`)}
        columns={[
          { key: 'number', label: 'Rental Order', render: (r) => r.so.number }, { key: 'date', label: 'Date', render: (r) => r.so.date }, { key: 'customer', label: 'Customer', render: (r) => custName(r.so.customerId) },
          { key: 'last', label: 'Invoice', render: (r) => r.last ?? '-' }, { key: 'start', label: 'Start Date', render: (r) => r.start ?? '-' }, { key: 'end', label: 'End Date', render: (r) => r.so.contractEnd ?? '-' },
          { key: 'next', label: 'Next Invoice Date', render: (r) => (r.next ? <Box><Text type="s4">{r.next.to}</Text><Text type="s5" color="theme.secondary.700">Period {r.next.from} to {r.next.to}</Text></Box> : '-') },
          { key: 'due', label: 'Status', change: 'new', req: R_ACC.rental, render: (r) => (r.due ? <StatusChip status="Due" tone="amber" /> : r.lines ? <StatusChip status="Not due yet" tone="grey" /> : <StatusChip status="Nothing to bill" tone="grey" />) },
          { key: 'preview', label: 'Next invoice (incl. VAT)', align: 'right', change: 'new', req: R_ACC.rental, render: (r) => (r.preview ? aed(r.preview) : '-') },
          { key: 'cycle', label: 'Billing Cycle', render: () => 'Monthly' }, { key: 'currency', label: 'Currency', render: (r) => r.so.currency },
          { key: 'narration', label: 'Narration', render: (r) => `${r.so.lines.reduce((n, l) => n + outstanding(l).length, 0)} asset(s) out` },
        ]} />
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{RENTAL_RULE} {TO_CONFIRM}.</Text>
      <AppDialog open={ask} title="Run Invoicing" onClose={() => setAsk(false)} maxWidth="md" confirmLabel="Run Invoicing" onConfirm={run}>
        <Alert severity="info" sx={{ mb: 1.5 }}>{RENTAL_RULE} {TO_CONFIRM}. Invoices are created Pending and approved in Accounting.</Alert>
        <DataTable hideToolbar rows={chosen} columns={[{ key: 'so', label: 'Rental Order', render: (r) => r.so.number }, { key: 'c', label: 'Customer', render: (r) => custName(r.so.customerId) }, { key: 'p', label: 'Period', render: (r) => (r.next ? `${r.next.from} to ${r.next.to}` : '-') },
          { key: 'l', label: 'Lines', align: 'right', render: (r) => r.lines }, { key: 't', label: 'Invoice (incl. VAT)', align: 'right', render: (r) => (r.preview ? aed(r.preview) : '-') }, { key: 'd', label: 'Result', render: (r) => (r.due ? 'Will be invoiced' : 'Skipped, period not ended') }]} />
      </AppDialog>
    </Page>
  );
}

export function PreviousJobs() {
  const nav = useNavigate();
  const runs = useRentalRuns();
  return (
    <Page>
      <PageTitle title="Previous Jobs" subtitle="Each invoicing run with the invoices it raised" change="changed" req={R_ACC.rental} />
      <DataTable rows={runs.rows} searchPlaceholder="Search runs..." emptyText="No run yet" onRowClick={(r) => r.invoiceIds[0] && nav(`/accounting/invoices/${r.invoiceIds[0]}`)}
        columns={[{ key: 'number', label: 'Job' }, { key: 'so', label: 'Rental Order', render: (r) => r.soNumbers.join(', ') }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Processed' ? 'green' : 'grey'} /> }, { key: 'runAt', label: 'Run At' }, { key: 'message', label: 'Message' }, { key: 'by', label: 'Run By' }]} />
    </Page>
  );
}
