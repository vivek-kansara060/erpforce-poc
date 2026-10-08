import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { COA, round2, type Journal, type JournalLine } from './data';
import { journalByRef } from './engine';
import { LedgerTable, R_ACC, money, useJournals } from './shared';

const refPath = (j: Journal) => {
  switch (j.refType) {
    case 'Sales Invoice': case 'Advance applied': return `/accounting/invoices/${j.refId}`;
    case 'Bill': return `/accounting/bills/${j.refId}`;
    case 'Collection': case 'Payment': return `/accounting/payment-entries/${j.refId}`;
    case 'Credit Note': return `/accounting/credit-notes/${j.refId}`;
    case 'Debit Note': return `/accounting/debit-notes/${j.refId}`;
    case 'Trip': return `/crm/trips/${j.refId}`;
    default: return undefined;
  }
};
const amountOf = (j: Journal) => round2(j.lines.reduce((s, l) => s + l.debit, 0));
/** The journal's own entity/activity when every line agrees on one; '-' when lines are mixed or carry none. */
const uniqueOf = (j: Journal, key: 'activity' | 'entity') => {
  const vals = [...new Set(j.lines.map((l: JournalLine) => l[key]).filter(Boolean))];
  return vals.length === 1 ? vals[0]! : '-';
};

export function JournalList() {
  const nav = useNavigate();
  const j = useJournals();
  return (
    <Page>
      <PageTitle title="Journal Entry" subtitle="Posted automatically when an invoice, bill, collection, payment or note is approved" change="changed" req={R_ACC.gl} />
      <DataTable<Journal> rows={j.rows} searchPlaceholder="Search journals..." filter={{ key: 'journalType', options: ['Sales', 'Purchases', 'Cash Receipt Voucher', 'Payment', 'Credit Note', 'Debit Note', 'Trip Expense'], label: 'Journal Type' }} onRowClick={(r) => nav(`/accounting/journals/${r.id}`)}
        columns={[
          { key: 'postingDate', label: 'Posting Date' }, { key: 'number', label: 'Series Number' }, { key: 'refType', label: 'Reference Type' }, { key: 'refNumber', label: 'Reference' },
          { key: 'entity', label: 'Entity', change: 'new', req: R_ACC.gl, render: (r) => uniqueOf(r, 'entity') }, { key: 'activity', label: 'Activity Type', change: 'new', req: R_ACC.gl, render: (r) => uniqueOf(r, 'activity') },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} tone="green" /> }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(amountOf(r)) },
          { key: 'createdBy', label: 'Created By' }, { key: 'journalType', label: 'Journal Type' }, { key: 'currency', label: 'Currency' }, { key: 'narration', label: 'Narration' },
        ]} />
    </Page>
  );
}

export function JournalView() {
  const { id } = useParams();
  const nav = useNavigate();
  useJournals();
  const j = journalByRef(id);
  if (!j) return <Page><PageTitle title="Journal not found" right={<Button variant="outlined" onClick={() => nav('/accounting/journals')}>Back</Button>} /></Page>;
  const to = refPath(j);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Journal Entry', to: '/accounting/journals' }, { label: j.number }]} status={<StatusChip status={j.status} tone="green" />}
        actions={to ? <Button variant="outlined" onClick={() => nav(to)}>View {j.refType} {j.refNumber}</Button> : undefined} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="Series Number" value={j.number} /><ValueField label="Posting Date" value={j.postingDate} /><ValueField label="Journal Type" value={j.journalType} /><ValueField label="Reference" value={`${j.refType} ${j.refNumber}`} />
          <ValueField label="Entity" change="new" req={R_ACC.gl} value={uniqueOf(j, 'entity')} /><ValueField label="Activity Type" change="new" req={R_ACC.gl} value={uniqueOf(j, 'activity')} />
          <ValueField label="Currency" value={j.currency} /><ValueField label="Created By" value={j.createdBy} /><ValueField label="Narration" value={j.narration} />
        </ValueGrid>
        <Box sx={{ mt: 3 }}><LedgerTable journalId={j.id} /></Box>
      </Page>
    </>
  );
}

export function CoaList() {
  const nav = useNavigate();
  const j = useJournals();
  const bal = (code: string) => round2(j.rows.flatMap((x) => x.lines).filter((l) => l.account === code).reduce((s, l) => s + l.debit - l.credit, 0));
  return (
    <Page>
      <PageTitle title="Chart of Accounts" subtitle="Accounts used by the POC postings. Click an account to open its General Ledger." />
      <DataTable rows={COA.map((a) => ({ id: a.code, ...a }))} pageSize={30} searchPlaceholder="Search accounts..." onRowClick={(r) => nav(`/accounting/reports/general-ledger?account=${r.code}`)}
        columns={[{ key: 'code', label: 'ID' }, { key: 'name', label: 'Account Name' }, { key: 'status', label: 'Status', render: () => <StatusChip status="Enabled" tone="green" /> }, { key: 'acode', label: 'Account Code', render: (r) => r.code }, { key: 'type', label: 'Account Type' },
          { key: 'bal', label: 'Balance (Dr + / Cr -)', align: 'right', change: 'new', req: R_ACC.gl, render: (r) => money(bal(r.code)) }]} />
    </Page>
  );
}
