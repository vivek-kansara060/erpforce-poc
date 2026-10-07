import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { MenuButton, useToast } from '@/components/Dialogs';
import { Timeline } from '@/components/Flow';
import { CheckInput, DateInput, FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { customers, suppliers } from '@/mock-data/masters';
import { TODAY } from '@/modules/crm/data';
import { PrintDialog } from '@/modules/crm/ActionDialogs';
import { Section } from '@/modules/crm/FormKit';
import { APPROVAL_STATUSES, BANK_ACCOUNTS, round2, type PaymentEntry } from './data';
import { advanceLeft, approvePayment, createPayment, openDocsOf, paymentByRef, paymentErrors, rejectPayment } from './engine';
import { ApprovalButtons, DocChips, LedgerTable, R_ACC, money, useBills, useInvoices, useJournals, usePayments } from './shared';

const isReceive = (d: string) => d === 'Receive';
export function PaymentEntryList({ direction }: { direction: 'Receive' | 'Send' }) {
  const nav = useNavigate();
  const p = usePayments();
  const rows = p.rows.filter((x) => x.direction === direction);
  const base = isReceive(direction) ? 'collections' : 'payments';
  return (
    <Page>
      <PageTitle title={isReceive(direction) ? 'Collection' : 'Payment'} />
      <DataTable<PaymentEntry> rows={rows} searchPlaceholder="Search..." filter={{ key: 'approval', options: APPROVAL_STATUSES, label: 'Status' }} onAdd={() => nav(`/accounting/${base}/add`)} addLabel={isReceive(direction) ? 'Add Collection' : 'Add Payment'} onRowClick={(r) => nav(`/accounting/payment-entries/${r.id}`)}
        columns={[
          { key: 'number', label: 'Series' }, { key: 'date', label: 'Date' }, { key: 'journal', label: 'Journal Type', render: () => (isReceive(direction) ? 'Cash Receipt Voucher' : 'Payment') }, { key: 'method', label: 'Type' },
          { key: 'partyName', label: 'Party' }, { key: 'amount', label: 'Total', align: 'right', render: (r) => money(r.amount) }, { key: 'approval', label: 'Approval Status', render: (r) => <DocChips approval={r.approval} /> },
          { key: 'partyType', label: 'Party Type' }, { key: 'isAdvance', label: 'Advance', render: (r) => (r.isAdvance ? 'Yes' : 'No') }, { key: 'bankAccount', label: 'Bank / Account' }, { key: 'reference', label: 'Reference' },
          { key: 'so', label: 'Sales Order', change: 'new', req: R_ACC.pay, render: (r) => r.soNumber ?? '-' },
        ]} />
    </Page>
  );
}

export function PaymentEntryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  usePayments(); useInvoices(); useBills(); useJournals();
  const p = paymentByRef(id);
  const [print, setPrint] = useState(false);
  if (!p) return <Page><PageTitle title="Entry not found" right={<Button variant="outlined" onClick={() => nav('/accounting/collections')}>Back</Button>} /></Page>;
  const recv = isReceive(p.direction);
  const r = (x: { ok: boolean; message: string }) => toast(x.message, x.ok ? 'success' : 'error');
  const base = recv ? 'collections' : 'payments';
  const left = p.isAdvance ? advanceLeft(p) : 0;
  return (
    <>
      <FormHeader crumbs={[{ label: recv ? 'Collection' : 'Payment', to: `/accounting/${base}` }, { label: p.number }]} status={<DocChips approval={p.approval} />}
        actions={<>
          <ApprovalButtons simple approval={p.approval} onApprove={() => r(approvePayment(p.id))} onReject={(n) => r(rejectPayment(p.id, n))} />
          <MenuButton label="Actions" items={[{ label: 'Print receipt', onClick: () => setPrint(true) }, ...(p.soId ? [{ label: 'View Sales Order', onClick: () => nav(`/crm/sales-orders/${p.soId}`) }] : [])]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {p.approval !== 'Approved' && <Alert severity="info" sx={{ mb: 2 }}>Pending approval. The invoices below change, and the journal is posted, only when this entry is approved (existing ERP behaviour).</Alert>}
        <ValueGrid>
          <ValueField label="Series" value={p.number} /><ValueField label="Date" value={p.date} /><ValueField label="Payment Type" value={recv ? 'Receive' : 'Send'} /><ValueField label="Party" value={p.partyName} />
          <ValueField label="Type" value={p.method} /><ValueField label="Bank / Account" value={p.bankAccount} /><ValueField label="Reference" value={p.reference} /><ValueField label="Amount" value={money(p.amount)} />
          {p.method === 'Cheque' && <><ValueField label="Cheque Number" value={p.chequeNo} /><ValueField label="Cheque Date" value={p.chequeDate} /></>}
          <ValueField label="Advance" value={p.isAdvance ? 'Yes' : 'No'} />{p.isAdvance && <ValueField label="Advance not yet applied" value={money(left)} />}
          <ValueField label="Sales Order" change="new" req={R_ACC.pay} value={p.soNumber} /><ValueField label="Narration" value={p.narration} />
        </ValueGrid>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Allocations', content: <DataTable hideToolbar rows={p.allocations.map((a, i) => ({ id: String(i), ...a }))} emptyText={p.isAdvance ? 'Advance: not allocated. Apply it from the invoice (Create, Apply Payment)' : 'No allocation'} onRowClick={(a) => nav(`/accounting/${a.docType === 'invoice' ? 'invoices' : 'bills'}/${a.docId}`)}
              columns={[{ key: 'docNumber', label: recv ? 'Invoice' : 'Bill' }, { key: 'amount', label: 'Allocated', align: 'right', render: (a) => money(a.amount) }]} /> },
            { label: 'Accounting Ledger', content: <LedgerTable journalId={p.journalId} /> },
            { label: 'Activity Log', content: <Timeline items={[...p.log].reverse()} /> },
          ]} />
        </Box>
      </Page>
      <PrintDialog open={print} onClose={() => setPrint(false)} doc={recv ? 'Receipt Voucher' : 'Payment Voucher'} />
    </>
  );
}

export function PaymentEntryForm({ direction }: { direction: 'Receive' | 'Send' }) {
  const nav = useNavigate();
  const toast = useToast();
  useInvoices(); useBills();
  const recv = isReceive(direction);
  const [f, setF] = useState({ partyId: '', date: TODAY, method: 'Bank', bank: BANK_ACCOUNTS[0], ref: '', amount: '', isAdvance: false, chequeNo: '', chequeDate: '', narration: '' });
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const parties = recv ? customers.map((c) => ({ value: c.id, label: c.name })) : suppliers.map((s) => ({ value: s.id, label: s.name }));
  const partyName = parties.find((x) => x.value === f.partyId)?.label ?? '';
  const open = f.partyId ? openDocsOf(direction, f.partyId) : [];
  const allocations = open.filter((o) => Number(alloc[o.doc.id]) > 0).map((o) => ({ docType: o.type, docId: o.doc.id, docNumber: o.doc.number, amount: Number(alloc[o.doc.id]) }));
  const amount = Number(f.amount) || 0;
  const input = { direction, partyType: (recv ? 'Customer' : 'Supplier') as PaymentEntry['partyType'], partyId: f.partyId, partyName, method: f.method as PaymentEntry['method'], bankAccount: f.method === 'Cash' ? BANK_ACCOUNTS[2] : f.bank, reference: f.ref,
    chequeNo: f.chequeNo || undefined, chequeDate: f.chequeDate || undefined, amount, isAdvance: f.isAdvance, allocations, date: f.date, narration: f.narration };
  const err = f.partyId ? paymentErrors(input) : undefined;
  const oldestFirst = () => { let left = amount; const n: Record<string, string> = {}; open.forEach((o) => { const a = round2(Math.min(left, o.due)); if (a > 0) { n[o.doc.id] = String(a); left = round2(left - a); } }); setAlloc(n); };
  const save = (approve: boolean) => {
    if (!f.partyId) { toast('Select the party', 'error'); return; }
    if (err) { toast(err, 'error'); return; }
    const p = createPayment(input, { approve });
    toast(`${p.number} ${approve ? 'saved and approved' : 'saved, pending approval'}`);
    nav(`/accounting/payment-entries/${p.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: recv ? 'Collection' : 'Payment', to: `/accounting/${recv ? 'collections' : 'payments'}` }, { label: 'New' }]}
        actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="outlined" onClick={() => save(false)}>Save</Button><Button variant="contained" onClick={() => save(true)}>Save and Approve</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid cols={3}>
          <SelectInput label={recv ? 'Customer' : 'Supplier'} required value={f.partyId} options={parties} onChange={(v) => { setF({ ...f, partyId: v }); setAlloc({}); }} />
          <DateInput label="Date" required value={f.date} onChange={(v) => setF({ ...f, date: v })} />
          <NumberInput label="Amount" required value={f.amount} onChange={(v) => setF({ ...f, amount: v })} error={err} />
          <SelectInput label="Type" required value={f.method} options={['Bank', 'Cheque', 'Cash']} onChange={(v) => setF({ ...f, method: v })} />
          {f.method !== 'Cash' && <SelectInput label="Bank Account" required value={f.bank} options={BANK_ACCOUNTS.slice(0, 2)} onChange={(v) => setF({ ...f, bank: v })} />}
          {f.method === 'Cheque' && <><TextInput label="Cheque Number" value={f.chequeNo} onChange={(v) => setF({ ...f, chequeNo: v })} /><DateInput label="Cheque Date" value={f.chequeDate} onChange={(v) => setF({ ...f, chequeDate: v })} /></>}
          <TextInput label="Reference" value={f.ref} onChange={(v) => setF({ ...f, ref: v })} />
          <CheckInput label="Advance (amount not allocated to an invoice)" checked={f.isAdvance} onChange={(v) => setF({ ...f, isAdvance: v })} />
          <TextInput label="Narration" value={f.narration} onChange={(v) => setF({ ...f, narration: v })} />
        </FormGrid>
        <Section title={recv ? 'Allocate to invoices' : 'Allocate to bills'}>
          {!f.partyId ? <Text type="s4">Select the party to see the open documents.</Text> : (
            <>
              <Button size="small" variant="outlined" sx={{ mb: 1 }} disabled={!amount} onClick={oldestFirst}>Allocate oldest first</Button>
              <DataTable hideToolbar rows={open.map((o) => ({ id: o.doc.id, number: o.doc.number, date: o.doc.date, dueDate: o.doc.dueDate, due: o.due }))} emptyText="No approved open document for this party"
                columns={[{ key: 'number', label: recv ? 'Invoice' : 'Bill' }, { key: 'date', label: 'Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'due', label: 'Amount Due', align: 'right', render: (o) => money(o.due) },
                  { key: 'alloc', label: 'Allocate', render: (o) => <TextInput label="" value={alloc[o.id] ?? ''} onChange={(v) => setAlloc({ ...alloc, [o.id]: v })} /> }]} />
              <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Allocated {money(allocations.reduce((s, a) => s + a.amount, 0))} of {money(amount)}.</Text>
            </>)}
        </Section>
      </Page>
    </>
  );
}
