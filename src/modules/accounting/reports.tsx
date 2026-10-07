import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Card, CardActionArea } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { DataTable } from '@/components/DataTable';
import { SelectInput } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { customers } from '@/mock-data/masters';
import { TODAY } from '@/modules/crm/data';
import { COA, accLabel, daysBetween, round2 } from './data';
import { billDue, billTotal, invoiceDue, invoiceTotal, isOverdue } from './engine';
import { DocChips, R_ACC, money, useBills, useCreditNotes, useInvoices, useJournals, usePayments } from './shared';
import { totalsOf } from './data';

export const REPORTS = [
  { slug: 'aged-receivable', title: 'Aged Receivable', purpose: 'Open customer invoices by days past due.' },
  { slug: 'aged-payable', title: 'Aged Payable', purpose: 'Open supplier bills by days past due.' },
  { slug: 'customer-soa', title: 'Customer SOA', purpose: 'Statement of account per customer: invoices, collections and credit notes with the running balance.' },
  { slug: 'general-ledger', title: 'General Ledger', purpose: 'Every posted journal line of an account with its running balance.' },
];
const BUCKETS = [['Current', -99999, 0], ['1-30', 1, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['91-120', 91, 120], ['121-180', 121, 180], ['181-365', 181, 365], ['365+', 366, 99999]] as const;

export function ReportsIndex() {
  const nav = useNavigate();
  return (
    <Page>
      <PageTitle title="Reports" subtitle="Existing accounting reports rebuilt on the POC invoices, bills and journals" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {REPORTS.map((r) => <Card key={r.slug} variant="outlined"><CardActionArea sx={{ p: 2 }} onClick={() => nav(`/accounting/reports/${r.slug}`)}><Text type="s3" weight="medium">{r.title}</Text><Text type="s5" color="theme.secondary.700">{r.purpose}</Text></CardActionArea></Card>)}
      </Box>
    </Page>
  );
}

function Shell({ title, purpose, filter, children }: { title: string; purpose: string; filter?: ReactNode; children: ReactNode }) {
  return (
    <>
      <FormHeader crumbs={[{ label: 'Reports', to: '/accounting/reports' }, { label: title }]} />
      <Page>
        <PageTitle title={title} subtitle={purpose} change="changed" req={R_ACC.inv} right={<Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>Print</Button>} />
        {filter && <Box sx={{ maxWidth: 420, mb: 2 }}>{filter}</Box>}
        {children}
      </Page>
    </>
  );
}

export function ReportPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const inv = useInvoices().rows;
  const bl = useBills().rows;
  const pays = usePayments().rows;
  const cns = useCreditNotes().rows;
  const jv = useJournals().rows;
  const def = REPORTS.find((r) => r.slug === slug);
  const aged = useMemo(() => {
    const rec = slug === 'aged-receivable';
    const docs = rec ? inv.filter((i) => i.approval === 'Approved' && i.payStatus !== 'Paid').map((i) => ({ party: i.partyName, due: invoiceDue(i), dueDate: i.dueDate })) : bl.filter((b) => b.approval === 'Approved' && b.payStatus !== 'Paid').map((b) => ({ party: b.supplierName, due: billDue(b), dueDate: b.dueDate }));
    const by = new Map<string, Record<string, number>>();
    docs.forEach((d) => {
      const late = daysBetween(d.dueDate, TODAY);
      const b = BUCKETS.find(([, lo, hi]) => late >= lo && late <= hi)![0];
      const row = by.get(d.party) ?? {};
      row[b] = round2((row[b] ?? 0) + d.due); row.Total = round2((row.Total ?? 0) + d.due);
      by.set(d.party, row);
    });
    return [...by.entries()].map(([party, r]) => ({ id: party, party, ...r }));
  }, [slug, inv, bl]);
  if (!def) return <Page><PageTitle title="Report not found" /></Page>;
  if (slug === 'aged-receivable' || slug === 'aged-payable') {
    const tot = (k: string) => money(aged.reduce((s, r: any) => s + (r[k] ?? 0), 0));
    return (
      <Shell title={def.title} purpose={`${def.purpose} As of ${TODAY}.`}>
        <DataTable hideToolbar pageSize={50} rows={aged} emptyText="Nothing open" columns={[{ key: 'party', label: slug === 'aged-receivable' ? 'Customer' : 'Supplier' }, ...BUCKETS.map(([b]) => ({ key: b, label: b, align: 'right' as const, render: (r: any) => (r[b] ? money(r[b]) : '-') })), { key: 'Total', label: 'Total', align: 'right', render: (r: any) => money(r.Total) }]} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, mt: 1, flexWrap: 'wrap' }}>{BUCKETS.map(([b]) => <Text key={b} type="s5">{b}: {tot(b)}</Text>)}<Text type="s4" weight="medium">Total {tot('Total')}</Text></Box>
      </Shell>
    );
  }
  if (slug === 'customer-soa') {
    const c = sp.get('customer') ?? '';
    const name = customers.find((x) => x.id === c)?.name;
    const rows = !c ? [] : [
      ...inv.filter((i) => i.customerId === c && i.approval === 'Approved').map((i) => ({ date: i.date, doc: i.number, ref: i.soNumber ?? i.source.number, debit: invoiceTotal(i), credit: 0, to: `/accounting/invoices/${i.id}` })),
      ...pays.filter((p) => p.direction === 'Receive' && p.partyId === c && p.approval === 'Approved').map((p) => ({ date: p.date, doc: p.number, ref: p.isAdvance ? 'Advance' : p.allocations.map((a) => a.docNumber).join(', '), debit: 0, credit: p.amount, to: `/accounting/payment-entries/${p.id}` })),
      ...cns.filter((n) => n.partyId === c && n.approval === 'Approved').map((n) => ({ date: n.date, doc: n.number, ref: n.againstNumber, debit: 0, credit: totalsOf({ lines: n.lines }).total, to: `/accounting/credit-notes/${n.id}` })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let run = 0;
    const withBal = rows.map((r, i) => { run = round2(run + r.debit - r.credit); return { id: String(i), ...r, bal: run }; });
    return (
      <Shell title={def.title} purpose={def.purpose} filter={<SelectInput label="Customer" value={c} options={customers.map((x) => ({ value: x.id, label: x.name }))} onChange={(v) => setSp({ customer: v })} />}>
        {!c ? <Text type="s4">Select a customer.</Text> : <>
          <DataTable hideToolbar pageSize={100} rows={withBal} emptyText="No transactions" onRowClick={(r) => nav(r.to)} columns={[{ key: 'date', label: 'Date' }, { key: 'doc', label: 'Document' }, { key: 'ref', label: 'Reference' }, { key: 'debit', label: 'Debit', align: 'right', render: (r) => (r.debit ? money(r.debit) : '-') }, { key: 'credit', label: 'Credit', align: 'right', render: (r) => (r.credit ? money(r.credit) : '-') }, { key: 'bal', label: 'Balance', align: 'right', render: (r) => money(r.bal) }]} />
          <Text type="s4" weight="medium" sx={{ mt: 1, textAlign: 'right' }}>{name}: closing balance {money(run)} (positive = owed to us; an unapplied advance makes it lower)</Text>
        </>}
      </Shell>
    );
  }
  const acc = sp.get('account') ?? '';
  let bal = 0;
  const gl = !acc ? [] : jv.flatMap((j) => j.lines.filter((l) => l.account === acc).map((l) => ({ date: j.postingDate, jv: j.number, ref: `${j.refType} ${j.refNumber}`, party: l.party ?? '-', cc: l.costCentre ?? '-', debit: l.debit, credit: l.credit, id: j.id })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((r, i) => { bal = round2(bal + r.debit - r.credit); return { ...r, key: String(i), bal }; });
  return (
    <Shell title={def.title} purpose={def.purpose} filter={<SelectInput label="Account" value={acc} options={COA.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} onChange={(v) => setSp({ account: v })} />}>
      {!acc ? <Text type="s4">Select an account.</Text> : <>
        <DataTable hideToolbar pageSize={100} rowKey={(r) => r.key} rows={gl} emptyText="No postings" onRowClick={(r) => nav(`/accounting/journals/${r.id}`)} columns={[{ key: 'date', label: 'Posting Date' }, { key: 'jv', label: 'Journal' }, { key: 'ref', label: 'Reference' }, { key: 'party', label: 'Party' }, { key: 'cc', label: 'Cost Centre', change: 'new', req: R_ACC.gl }, { key: 'debit', label: 'Debit', align: 'right', render: (r) => (r.debit ? money(r.debit) : '-') }, { key: 'credit', label: 'Credit', align: 'right', render: (r) => (r.credit ? money(r.credit) : '-') }, { key: 'bal', label: 'Balance', align: 'right', render: (r) => money(r.bal) }]} />
        <Text type="s4" weight="medium" sx={{ mt: 1, textAlign: 'right' }}>{accLabel(acc)}: closing balance {money(bal)}</Text>
      </>}
    </Shell>
  );
}

/** Existing financial summary cards, fed by the POC documents. */
export function AccountingDashboard() {
  const nav = useNavigate();
  const inv = useInvoices().rows;
  const bl = useBills().rows;
  const pays = usePayments().rows;
  const ar = inv.filter((i) => i.approval === 'Approved').reduce((s, i) => s + invoiceDue(i), 0);
  const overdue = inv.filter(isOverdue).reduce((s, i) => s + invoiceDue(i), 0);
  const ap = bl.filter((b) => b.approval === 'Approved').reduce((s, b) => s + billDue(b), 0);
  const month = TODAY.slice(0, 7);
  const collected = pays.filter((p) => p.direction === 'Receive' && p.approval === 'Approved' && p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
  const pending = inv.filter((i) => i.approval !== 'Approved').length + bl.filter((b) => b.approval !== 'Approved').length + pays.filter((p) => p.approval !== 'Approved' && p.approval !== 'Rejected').length;
  return (
    <Page>
      <PageTitle title="Accounting & Finance" change="changed" req={R_ACC.meet} />
      <KpiRow>
        <KpiCard title="Receivables outstanding" value={money(ar)} sub="Approved invoices not yet paid" onClick={() => nav('/accounting/reports/aged-receivable')} />
        <KpiCard title="Overdue receivables" value={money(overdue)} sub="Past the due date" tint="#FDECEC" onClick={() => nav('/accounting/reports/aged-receivable')} />
        <KpiCard title="Payables outstanding" value={money(ap)} sub="Approved bills not yet paid" onClick={() => nav('/accounting/reports/aged-payable')} />
        <KpiCard title="Collected this month" value={money(collected)} sub="Approved collections" tint="#E8F5F0" onClick={() => nav('/accounting/collections')} />
        <KpiCard title="Waiting for approval" value={String(pending)} sub="Invoices, bills and entries" tint="#FFF3CC" />
      </KpiRow>
      <Panel title="Latest invoices" sx={{ mt: 3 }}>
        <DataTable hideToolbar rows={[...inv].sort((a, b) => (a.number < b.number ? 1 : -1)).slice(0, 8)} onRowClick={(r) => nav(`/accounting/invoices/${r.id}`)} columns={[{ key: 'number', label: 'Invoice' }, { key: 'date', label: 'Date' }, { key: 'partyName', label: 'Customer' }, { key: 'source', label: 'Source', render: (r) => r.source.type }, { key: 't', label: 'Total', align: 'right', render: (r) => money(invoiceTotal(r)) }, { key: 's', label: 'Status', render: (r) => <DocChips approval={r.approval} payStatus={r.payStatus} /> }]} />
      </Panel>
      <Panel title="Latest bills" sx={{ mt: 3 }}>
        <DataTable hideToolbar rows={[...bl].sort((a, b) => (a.number < b.number ? 1 : -1)).slice(0, 5)} onRowClick={(r) => nav(`/accounting/bills/${r.id}`)} columns={[{ key: 'number', label: 'Bill' }, { key: 'date', label: 'Date' }, { key: 'supplierName', label: 'Supplier' }, { key: 'source', label: 'Source', render: (r) => r.source.type }, { key: 't', label: 'Total', align: 'right', render: (r) => money(billTotal(r)) }, { key: 's', label: 'Status', render: (r) => <DocChips approval={r.approval} payStatus={r.payStatus} /> }]} />
      </Panel>
    </Page>
  );
}
