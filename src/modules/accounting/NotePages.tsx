import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/components/Dialogs';
import { Timeline } from '@/components/Flow';
import { DateInput, FormGrid, SelectInput, ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { TabPanels } from '@/components/Widgets';
import { TODAY } from '@/modules/crm/data';
import { RowsEditor, Section } from '@/modules/crm/FormKit';
import { lid } from './billing';
import { APPROVAL_STATUSES, DEBIT_REASONS, NOTE_REASONS, totalsOf, type InvLine, type NoteDoc } from './data';
import { approveNote, rejectNote, billByRef, billDue, createNote, invoiceByRef, invoiceDue, noteByRef } from './engine';
import { ApprovalButtons, DocChips, LedgerTable, LinesTable, R_ACC, TotalsBox, money, useBills, useCreditNotes, useDebitNotes, useInvoices, useJournals } from './shared';

type Kind = 'Credit' | 'Debit';
const base = (k: Kind) => (k === 'Credit' ? 'credit-notes' : 'debit-notes');
const title = (k: Kind) => (k === 'Credit' ? 'Credit Notes' : 'Debit Notes');

export function NoteList({ kind }: { kind: Kind }) {
  const nav = useNavigate();
  const rows = (kind === 'Credit' ? useCreditNotes : useDebitNotes)().rows;
  return (
    <Page>
      <PageTitle title={title(kind)} subtitle={kind === 'Credit' ? 'Raised from an approved invoice (Create, Credit Note)' : 'Supplier credit, raised from an approved bill (Create, Debit Note)'} />
      <DataTable<NoteDoc> rows={rows} searchPlaceholder="Search..." filter={{ key: 'approval', options: APPROVAL_STATUSES, label: 'Status' }} onRowClick={(r) => nav(`/accounting/${base(kind)}/${r.id}`)}
        columns={[{ key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'partyName', label: kind === 'Credit' ? 'Customer' : 'Supplier' }, { key: 'againstNumber', label: kind === 'Credit' ? 'Invoice' : 'Bill' }, { key: 'reason', label: 'Reason' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(totalsOf({ lines: r.lines }).total) }, { key: 'approval', label: 'Status', render: (r) => <DocChips approval={r.approval} /> }]} />
    </Page>
  );
}

export function NoteView({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  (kind === 'Credit' ? useCreditNotes : useDebitNotes)(); useJournals(); useInvoices(); useBills();
  const n = noteByRef(kind, id);
  if (!n) return <Page><PageTitle title="Note not found" right={<Button variant="outlined" onClick={() => nav(`/accounting/${base(kind)}`)}>Back</Button>} /></Page>;
  const r = (x: { ok: boolean; message: string }) => toast(x.message, x.ok ? 'success' : 'error');
  return (
    <>
      <FormHeader crumbs={[{ label: title(kind), to: `/accounting/${base(kind)}` }, { label: n.number }]} status={<DocChips approval={n.approval} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/accounting/${kind === 'Credit' ? 'invoices' : 'bills'}/${n.againstId}`)}>View {kind === 'Credit' ? 'Invoice' : 'Bill'}</Button>
          <ApprovalButtons simple approval={n.approval} onApprove={() => r(approveNote(kind, n.id))} onReject={(note) => r(rejectNote(kind, n.id, note))} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {n.approval !== 'Approved' && <Alert severity="info" sx={{ mb: 2 }}>Pending approval. On approval the journal is posted and {n.againstNumber} is settled by this amount.</Alert>}
        <ValueGrid>
          <ValueField label="ID" value={n.number} /><ValueField label="Date" value={n.date} /><ValueField label={kind === 'Credit' ? 'Customer' : 'Supplier'} value={n.partyName} /><ValueField label={kind === 'Credit' ? 'Against Invoice' : 'Against Bill'} value={n.againstNumber} />
          <ValueField label="Reason" value={n.reason} /><ValueField label="Cost Centre / Project" change="new" req={R_ACC.gl} value={n.costCentre} />
        </ValueGrid>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Items', content: <><LinesTable lines={n.lines} /><TotalsBox doc={{ lines: n.lines }} /></> },
            { label: 'Accounting Ledger', content: <LedgerTable journalId={n.journalId} /> },
            { label: 'Activity Log', content: <Timeline items={[...n.log].reverse()} /> },
          ]} />
        </Box>
      </Page>
    </>
  );
}

type Row = { item: string; desc: string; qty: any; rate: any; vatPct: string; account: string; unit: string };
export function NoteForm({ kind }: { kind: Kind }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  useInvoices(); useBills();
  const ref = sp.get(kind === 'Credit' ? 'invoice' : 'bill') ?? undefined;
  const doc = kind === 'Credit' ? invoiceByRef(ref) : billByRef(ref);
  const [f, setF] = useState({ date: TODAY, reason: '' });
  const [rows, setRows] = useState<Row[]>(() => (doc?.lines ?? []).map((l) => ({ item: l.item, desc: l.desc, qty: l.qty, rate: l.rate, vatPct: String(l.vatPct), account: l.account, unit: l.unit })));
  if (!doc) return <Page><PageTitle title={`Open an approved ${kind === 'Credit' ? 'invoice' : 'bill'} and use Create, ${kind} Note`} right={<Button variant="outlined" onClick={() => nav(`/accounting/${kind === 'Credit' ? 'invoices' : 'bills'}`)}>Back</Button>} /></Page>;
  const due = kind === 'Credit' ? invoiceDue(doc as any) : billDue(doc as any);
  const lines: InvLine[] = rows.filter((r) => r.item && Number(r.qty) > 0 && Number(r.rate) > 0).map((r) => ({ id: lid(), item: r.item, desc: r.desc, qty: Number(r.qty), unit: r.unit, rate: Number(r.rate), discountPct: 0, vatPct: Number(r.vatPct) || 0, account: r.account, costCentre: doc.costCentre, tag: 'manual' }));
  const total = totalsOf({ lines }).total;
  const save = () => {
    if (!f.reason) { toast('Select the reason', 'error'); return; }
    const x = createNote(kind, doc.id, lines, f.reason, f.date);
    toast(x.message, x.ok ? 'success' : 'error');
    if (x.ok && x.note) nav(`/accounting/${base(kind)}/${x.note.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: title(kind), to: `/accounting/${base(kind)}` }, { label: `New ${kind} Note against ${doc.number}` }]} actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid cols={3}>
          <DateInput label="Date" required value={f.date} onChange={(v) => setF({ ...f, date: v })} />
          <SelectInput label="Reason" required value={f.reason} options={kind === 'Credit' ? NOTE_REASONS : DEBIT_REASONS} onChange={(v) => setF({ ...f, reason: v })} hint={kind === 'Debit' ? 'Supplier credit note, recorded as a Debit Note' : undefined} />
          <ValueField label="Amount due on the document" value={money(due)} />
        </FormGrid>
        <Section title="Lines" hint="Copied from the document. Reduce the quantity or rate to the amount being credited; remove the lines that are not affected.">
          <RowsEditor<Row> cols={[{ key: 'item', label: 'Item', width: 200 }, { key: 'desc', label: 'Description', width: 260 }, { key: 'qty', label: 'Quantity', width: 90 }, { key: 'rate', label: 'Rate', width: 110 }, { key: 'vatPct', label: 'VAT %', type: 'select', options: ['5', '0'], width: 80 }]}
            rows={rows} onChange={setRows} blank={{ item: '', desc: '', qty: 1, rate: 0, vatPct: '5', account: doc.lines[0]?.account ?? '410500', unit: 'Nos' }} addLabel="Add Line" />
        </Section>
        {total > due + 0.005 && <Alert severity="error" sx={{ mt: 2 }}>The note total ({money(total)}) is more than the amount due ({money(due)}).</Alert>}
        <TotalsBox doc={{ lines }} />
      </Page>
    </>
  );
}
