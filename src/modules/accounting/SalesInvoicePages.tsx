import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { Timeline } from '@/components/Flow';
import { FormGrid, NumberInput, SelectInput } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { customers } from '@/mock-data/masters';
import { ACTIVITY_TYPES, COST_CENTRES, DEPARTMENTS, TODAY, VAT_TYPES, cust, yards } from '@/modules/crm/data';
import { EmailDialog, PrintDialog } from '@/modules/crm/ActionDialogs';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { headerFromOrder, lid } from './billing';
import { APPROVAL_STATUSES, EDITABLE, dueDateFor, incomeAccounts, totalsOf, vatPctOf, type InvLine, type SalesInvoice } from './data';
import {
  advanceLeft, approveInvoice, creditWarning, deleteInvoice, duplicateInvoice, invoiceByRef, invoiceDue, invoiceTotal, isOverdue, logInvoice, rejectInvoice, submitInvoice, unappliedAdvances, applyAdvance, createInvoice, updateInvoice,
} from './engine';
import { ApprovalButtons, DocChips, LedgerDialog, LedgerTable, LinesTable, PaymentDialog, R_ACC, SourceLink, TotalsBox, money, sourcePath, useCreditNotes, useInvoices, useJournals, usePayments } from './shared';
import { getCollection } from '@/store/store';
import { COL, type SalesOrder } from '@/modules/crm/data';
import { linkOrderLinesToInvoice } from '@/modules/crm/flow';
import { invoiceableLines } from '@/modules/crm/ActionDialogs';
import { linesFromOrder } from './billing';

export function InvoiceList() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const so = sp.get('so');
  const inv = useInvoices();
  const rows = so ? inv.rows.filter((i) => i.soId === so || i.source.soId === so) : inv.rows;
  return (
    <Page>
      <PageTitle title="Invoices" subtitle={so ? `Filtered by ${rows[0]?.soNumber ?? 'the order'}` : undefined} right={so ? <Button variant="outlined" onClick={() => setSp({})}>Clear filter</Button> : undefined} />
      <DataTable<SalesInvoice> rows={rows} searchPlaceholder="Search invoices..." filter={{ key: 'approval', options: APPROVAL_STATUSES, label: 'Status' }} onAdd={() => nav('/accounting/invoices/add')} addLabel="Add Invoice" onRowClick={(r) => nav(`/accounting/invoices/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'partyName', label: 'Customer' },
          { key: 'source', label: 'Source', change: 'new', req: R_ACC.inv, render: (r) => <SourceLink s={r.source} /> },
          { key: 'activity', label: 'Activity Type', change: 'new', req: R_ACC.inv, render: (r) => r.activity ?? '-' },
          { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R_ACC.gl, render: (r) => r.costCentre ?? '-' },
          { key: 'payStatus', label: 'Payment Status', render: (r) => (r.approval === 'Approved' ? <DocChips approval="" payStatus={r.payStatus} /> : '-') },
          { key: 'approval', label: 'Status', render: (r) => <DocChips approval={r.approval} /> },
          { key: 'total', label: 'Total Invoice Value', align: 'right', render: (r) => money(invoiceTotal(r)) },
          { key: 'due', label: 'Amount Due', align: 'right', render: (r) => money(invoiceDue(r)) },
          { key: 'dueDate', label: 'Due Date', render: (r) => <Text type="s4" color={isOverdue(r) ? '#C64D4D' : undefined}>{r.dueDate}</Text> },
          { key: 'currency', label: 'Currency' }, { key: 'entity', label: 'Company' },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`/accounting/invoices/${r.id}`) },
          { label: 'Edit', hidden: (r) => !EDITABLE.includes(r.approval), onClick: (r) => nav(`/accounting/invoices/${r.id}/edit`) },
          { label: 'Duplicate', onClick: (r) => { const d = duplicateInvoice(r.id); if (d) { toast(`${d.number} created as a copy`); nav(`/accounting/invoices/${d.id}`); } } },
          { label: 'Delete', danger: true, hidden: (r) => !EDITABLE.includes(r.approval) || r.amountPaid > 0, onClick: (r) => { const x = deleteInvoice(r.id); toast(x.message, x.ok ? 'success' : 'error'); } },
        ]} />
    </Page>
  );
}

/** Entity, Activity Type and Customer moved to the front per client feedback (8 Oct); Posting Time removed (not needed). Every other field keeps its place. */
const viewSpecs: Spec[] = [
  { key: 'entity', label: 'Company' }, { key: 'activity', label: 'Activity Type', change: 'new', req: R_ACC.inv }, { key: 'partyName', label: 'Customer' },
  { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' },
  { key: 'paymentTerms', label: 'Payment Term' }, { key: 'dueDate', label: 'Due Date' }, { key: 'transactionType', label: 'Transaction Type' },
  { key: 'currency', label: 'Currency' }, { key: 'exchangeRate', label: 'Exchange Rate' }, { key: 'salesperson', label: 'Salesperson' }, { key: 'lpo', label: 'LPO / PO Number' },
  { key: 'vatType', label: 'VAT Type' }, { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R_ACC.gl },
  { key: 'sourceText', label: 'Source Document', change: 'new', req: R_ACC.inv }, { key: 'period', label: 'Rental Period', change: 'new', req: R_ACC.rental, show: (f) => !!f.isRental }, { key: 'narration', label: 'Narration' },
];

export function InvoiceView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  useInvoices(); useJournals();
  const pays = usePayments().rows;
  const cns = useCreditNotes().rows;
  const i = invoiceByRef(id);
  const [dlg, setDlg] = useState<'pay' | 'adv' | 'ledger' | 'mail' | 'print' | 'del' | null>(null);
  const [adv, setAdv] = useState({ id: '', amount: '' });
  if (!i) return <Page><PageTitle title="Invoice not found" right={<Button variant="outlined" onClick={() => nav('/accounting/invoices')}>Back</Button>} /></Page>;
  const total = invoiceTotal(i);
  const due = invoiceDue(i);
  const approved = i.approval === 'Approved';
  const advances = unappliedAdvances(i.customerId);
  const warn = !approved ? creditWarning(i.customerId, total) : undefined;
  const r = (x: { ok: boolean; message: string }) => toast(x.message, x.ok ? 'success' : 'error');
  const src = sourcePath(i.source);
  const payRows = pays.filter((p) => p.allocations.some((a) => a.docId === i.id) || (p.advanceUsed > 0 && p.log.some((l) => l.title === `Applied to ${i.number}`)));
  const notes = cns.filter((n) => n.againstId === i.id);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Invoices', to: '/accounting/invoices' }, { label: i.number }]} status={<DocChips approval={i.approval} payStatus={i.payStatus} />}
        actions={<>
          {EDITABLE.includes(i.approval) && <Button variant="outlined" onClick={() => nav(`/accounting/invoices/${i.id}/edit`)}>Edit</Button>}
          <ApprovalButtons approval={i.approval} onSubmit={(a) => r(submitInvoice(i.id, a))} onApprove={(how) => r(approveInvoice(i.id, how))} onReject={(n) => r(rejectInvoice(i.id, n))} />
          <MenuButton label="Create" items={[
            { label: 'Collection Entry', disabled: !approved || i.payStatus === 'Paid', onClick: () => setDlg('pay') },
            { label: 'Apply Payment (advance)', disabled: !approved || i.payStatus === 'Paid' || !advances.length, onClick: () => { setAdv({ id: advances[0]?.id ?? '', amount: '' }); setDlg('adv'); } },
            { label: 'Credit Note', disabled: !approved || due <= 0, onClick: () => nav(`/accounting/credit-notes/add?invoice=${i.id}`) },
          ]} />
          <MenuButton label="View" items={[
            { label: `Source: ${i.source.type}`, disabled: !src, onClick: () => src && nav(src) },
            { label: 'Accounting Ledger', disabled: !i.journalId, onClick: () => setDlg('ledger') },
            { label: 'Customer SOA', disabled: !i.customerId, onClick: () => nav(`/accounting/reports/customer-soa?customer=${i.customerId}`) },
          ]} />
          <MenuButton label="Actions" items={[
            { label: 'Send Email', onClick: () => setDlg('mail') }, { label: 'Download / Print', onClick: () => setDlg('print') },
            { label: 'Duplicate', onClick: () => { const d = duplicateInvoice(i.id); if (d) { toast(`${d.number} created as a copy`); nav(`/accounting/invoices/${d.id}`); } } },
            { label: 'Payment Request', disabled: !isOverdue(i), onClick: () => { logInvoice(i.id, 'Payment request emailed', `Reminder for AED ${due} overdue since ${i.dueDate}`); toast(`Payment reminder emailed to ${i.partyName}`); } },
            { label: 'Delete', disabled: !EDITABLE.includes(i.approval) || i.amountPaid > 0, onClick: () => setDlg('del') },
          ]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {i.source.type !== 'Manual' && <Alert severity="info" sx={{ mb: 2 }}>Created from <SourceLink s={i.source} />. {approved ? 'Approved and posted.' : 'Pending approval: no journal is posted and no payment can be recorded until it is approved.'}</Alert>}
        {warn && <Alert severity="warning" sx={{ mb: 2 }}>{warn}. Warning only (rule to be confirmed with client).</Alert>}
        {isOverdue(i) && <Alert severity="error" sx={{ mb: 2 }}>Overdue since {i.dueDate}. Amount due {money(due)}.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView cols={4} specs={viewSpecs} f={{ ...i, sourceText: <SourceLink s={i.source} />, period: i.periodFrom ? `${i.periodFrom} to ${i.periodTo}` : '-' }} />
              <Section title="Classification"><SpecView cols={4} specs={[{ key: 'location', label: 'Location' }, { key: 'department', label: 'Department' }]} f={i} /></Section>
              <Section title="Items"><LinesTable lines={i.lines} showPeriod={i.isRental} /></Section>
              <Section title="Discounts"><SpecView cols={4} specs={[{ key: 'discountOn', label: 'Additional Discount On' }, { key: 'discountPct', label: 'Additional Discount %' }, { key: 'roundOff', label: 'Round Off', type: 'check' }]} f={i} /></Section>
              <TotalsBox doc={i} paid={i.amountPaid} />
            </>) },
          { label: 'Address and Contact', content: <SpecView cols={4} specs={[{ key: 'contactPerson', label: 'Contact Person' }, { key: 'billingAddress', label: 'Billing Address' }, { key: 'shippingAddress', label: 'Shipping Address' }, { key: 'placeOfSupply', label: 'Place of Supply' }]} f={i} /> },
          { label: 'Payments', change: 'new', req: R_ACC.pay, content: (
            <>
              <DataTable hideToolbar rows={payRows} emptyText="No collection yet" onRowClick={(p) => nav(`/accounting/payment-entries/${p.id}`)} columns={[
                { key: 'number', label: 'Entry' }, { key: 'date', label: 'Date' }, { key: 'method', label: 'Type' }, { key: 'isAdvance', label: 'Advance', render: (p) => (p.isAdvance ? 'Yes' : 'No') },
                { key: 'amount', label: 'Applied to this invoice', align: 'right', render: (p) => money(p.allocations.find((a) => a.docId === i.id)?.amount ?? Number(p.log.find((l) => l.title === `Applied to ${i.number}`)?.detail?.replace('AED ', '') ?? 0)) }, { key: 'approval', label: 'Status', render: (p) => <DocChips approval={p.approval} /> },
              ]} />
              <Text type="s4" weight="medium" sx={{ mt: 2 }}>Credit Notes</Text>
              <DataTable hideToolbar rows={notes} emptyText="No credit note" onRowClick={(n) => nav(`/accounting/credit-notes/${n.id}`)} columns={[{ key: 'number', label: 'Credit Note' }, { key: 'date', label: 'Date' }, { key: 'reason', label: 'Reason' }, { key: 't', label: 'Amount', align: 'right', render: (n) => money(totalsOf({ lines: n.lines }).total) }, { key: 'approval', label: 'Status', render: (n) => <DocChips approval={n.approval} /> }]} />
            </>) },
          { label: 'Accounting Ledger', content: <LedgerTable journalId={i.journalId} /> },
          { label: 'Activity Log', content: <Timeline items={[...i.log].reverse()} /> },
        ]} />
      </Page>
      {dlg === 'pay' && <PayDialogLazy invoice={i} onClose={() => setDlg(null)} />}
      <LedgerDialog open={dlg === 'ledger'} onClose={() => setDlg(null)} journalId={i.journalId} />
      <PrintDialog open={dlg === 'print'} onClose={() => setDlg(null)} doc="Sales Invoice" />
      <EmailDialog open={dlg === 'mail'} onClose={() => setDlg(null)} docNo={i.number} customerId={i.customerId ?? ''} onSent={(l) => logInvoice(i.id, l.title, l.detail)} />
      <ConfirmDialog open={dlg === 'del'} title={`Delete ${i.number}`} description="The invoice is removed. This is only possible before approval." confirmLabel="Delete" danger onClose={() => setDlg(null)} onConfirm={() => { const x = deleteInvoice(i.id); r(x); setDlg(null); if (x.ok) nav('/accounting/invoices'); }} />
      <AppDialog open={dlg === 'adv'} title="Apply Payment (advance)" onClose={() => setDlg(null)} confirmLabel="Apply" confirmDisabled={!adv.id}
        onConfirm={() => { r(applyAdvance(i.id, adv.id, Number(adv.amount) || due)); setDlg(null); }}>
        <FormGrid cols={1}>
          <SelectInput label="Advance" required value={adv.id} options={advances.map((p) => ({ value: p.id, label: `${p.number}, ${p.soNumber ?? ''} available ${money(advanceLeft(p))}` }))} onChange={(v) => setAdv({ ...adv, id: v })} />
          <NumberInput label="Amount to apply" value={adv.amount} onChange={(v) => setAdv({ ...adv, amount: v })} hint={`Up to the amount due (${money(due)}) and the advance available`} />
        </FormGrid>
      </AppDialog>
    </>
  );
}
function PayDialogLazy({ invoice, onClose }: { invoice: SalesInvoice; onClose: () => void }) { return <PaymentDialog open onClose={onClose} doc={invoice} kind="invoice" />; }

/* ------------------------------------------------------------------ form (manual invoice, and edit before approval) */
const accOpts = incomeAccounts.map((a) => `${a.code} ${a.name}`);
type Row = { item: string; desc: string; qty: any; unit: string; rate: any; discountPct: any; vatPct: string; account: string };
const toRow = (l: InvLine): Row => ({ item: l.item, desc: l.desc, qty: l.qty, unit: l.unit, rate: l.rate, discountPct: l.discountPct, vatPct: String(l.vatPct), account: `${l.account} ${incomeAccounts.find((a) => a.code === l.account)?.name ?? ''}`.trim() });
/** Invoice header: Entity, Activity Type and Customer moved to the front per client feedback (8 Oct), Posting Time removed. Bill keeps its existing field order unchanged. */
export const headerSpecs = (kind: 'invoice' | 'bill'): Spec[] => [
  { key: 'entity', label: 'Company', type: 'master', master: 'entity', required: true },
  ...(kind === 'invoice'
    ? [{ key: 'activity', label: 'Activity Type', type: 'select', options: ['', ...ACTIVITY_TYPES], change: 'new', req: R_ACC.inv, hint: 'Inherited from the source document; drives reporting only, not posting' } as Spec,
       { key: 'customerId', label: 'Customer', type: 'select', options: [{ value: '', label: 'Not in the customer list' }, ...customers.map((c) => ({ value: c.id, label: c.name }))] } as Spec,
       { key: 'partyName', label: 'Party Name', required: true, show: (f) => !f.customerId, hint: 'For a buyer who is not a customer (for example a scrap buyer)' } as Spec]
    : []),
  { key: 'date', label: kind === 'invoice' ? 'Date' : 'Bill Date', type: 'date', required: true },
  ...(kind === 'bill' ? [{ key: 'postingTime', label: 'Posting Time', required: true } as Spec] : []),
  { key: 'paymentTerms', label: 'Payment Term', type: 'master', master: 'paymentTerms', required: true }, { key: 'dueDate', label: 'Due Date', type: 'readonly', value: (f) => dueDateFor(f.date || TODAY, f.paymentTerms) },
  ...(kind === 'invoice' ? [{ key: 'transactionType', label: 'Transaction Type', type: 'select', options: ['Credit', 'Cash'], required: true, hint: 'Cash: a collection is created automatically when the invoice is approved' } as Spec] : []),
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true }, { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', disabled: (f) => f.currency === 'AED' },
  ...(kind === 'invoice' ? [{ key: 'salesperson', label: 'Salesperson' } as Spec, { key: 'lpo', label: 'LPO / PO Number' } as Spec, { key: 'vatType', label: 'VAT Type', type: 'select', options: VAT_TYPES, required: true } as Spec] : []),
  ...(kind === 'bill' ? [{ key: 'activity', label: 'Activity Type', type: 'select', options: ['', ...ACTIVITY_TYPES], change: 'new', req: R_ACC.inv, hint: 'Inherited from the source document; drives reporting only, not posting' } as Spec] : []),
  { key: 'costCentre', label: 'Cost Centre / Project', type: 'select', options: ['', ...COST_CENTRES], change: 'new', req: R_ACC.gl, hint: 'Optional at header level; a line can carry its own' },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const classSpecs: Spec[] = [{ key: 'location', label: 'Location', type: 'select', options: yards }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
export const discSpecs: Spec[] = [{ key: 'discountOn', label: 'Apply Additional Discount On', type: 'select', options: ['None', 'Net Amount', 'Gross Amount'] }, { key: 'discountPct', label: 'Additional Discount Percentage', type: 'number', show: (f) => f.discountOn !== 'None' }, { key: 'roundOff', label: 'Round Off', type: 'check' }];
const addrSpecs: Spec[] = [{ key: 'contactPerson', label: 'Contact Person' }, { key: 'billingAddress', label: 'Billing Address' }, { key: 'shippingAddress', label: 'Shipping Address' }, { key: 'placeOfSupply', label: 'Place of Supply' }];
export const rowsToLines = (rows: Row[], f: Record<string, any>): InvLine[] => rows.filter((r) => r.item.trim()).map((r) => ({
  id: lid(), item: r.item.trim(), desc: r.desc || r.item, qty: Number(r.qty) || 0, unit: r.unit || 'Nos', rate: Number(r.rate) || 0, discountPct: Number(r.discountPct) || 0, vatPct: Number(r.vatPct) || 0,
  account: String(r.account).slice(0, 6) || '410500', activity: f.activity || undefined, costCentre: f.costCentre || undefined, tag: 'manual',
}));

export function InvoiceForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const existing = invoiceByRef(id);
  const [f, setF] = useState<Record<string, any>>(() => {
    if (existing) return { ...existing };
    const o = getCollection<SalesOrder>(COL.orders).find((x) => x.id === sp.get('so'));
    return { entity: 'Gulf Power Rentals LLC', date: TODAY, postingTime: '09:00', paymentTerms: '30 days', transactionType: 'Credit', currency: 'AED', exchangeRate: 1, vatType: VAT_TYPES[0], discountOn: 'None', discountPct: 0, roundOff: false, customerId: '', partyName: '', ...(o ? headerFromOrder(o) : {}) };
  });
  // From a Sales Order (Create > Invoice, or the line's Invoice step): the invoiceable lines come in as rows and are marked invoiced when the invoice is saved.
  const fromSo = !existing ? getCollection<SalesOrder>(COL.orders).find((x) => x.id === sp.get('so')) : undefined;
  const wanted = sp.get('lines')?.split(',').filter(Boolean);
  const soLines = fromSo ? invoiceableLines(fromSo.lines).filter((l) => !wanted || wanted.includes(l.id)) : [];
  const [rows, setRows] = useState<Row[]>(() => (existing ? existing.lines.map(toRow) : fromSo ? linesFromOrder(fromSo, soLines).map(toRow) : []));
  const [err, setErr] = useState<Record<string, string>>({});
  if (id && !existing) return <Page><PageTitle title="Invoice not found" /></Page>;
  if (existing && !EDITABLE.includes(existing.approval)) return <Page><PageTitle title={`${existing.number} is approved and cannot be edited`} subtitle="Raise a Credit Note to correct an approved invoice." right={<Button variant="outlined" onClick={() => nav(`/accounting/invoices/${existing.id}`)}>Back</Button>} /></Page>;
  const set = (k: string, v: any) => setF((x) => {
    const n = { ...x, [k]: v };
    if (k === 'customerId') { const c = cust(v); n.partyName = c?.name ?? ''; n.paymentTerms = c ? `${c.creditTerms} days` : x.paymentTerms; n.contactPerson = c?.contact ?? x.contactPerson; }
    if (k === 'vatType') setRows((rs) => rs.map((r) => ({ ...r, vatPct: String(vatPctOf(v)) })));
    return n;
  });
  const lines = rowsToLines(rows, f);
  const party = f.customerId ? cust(f.customerId)?.name ?? '' : String(f.partyName ?? '').trim();
  const warn = creditWarning(f.customerId, totalsOf({ lines, discountOn: f.discountOn, discountPct: Number(f.discountPct), roundOff: f.roundOff }).total);
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (!party) e.partyName = 'Select a customer or enter the party name';
    if (!f.date) e.date = 'Date is required';
    if (!f.paymentTerms) e.paymentTerms = 'Payment Term is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    if (!lines.length || lines.some((l) => l.qty <= 0)) { toast('Add at least one item with a quantity above zero', 'error'); return; }
    const data = { ...f, partyName: party, customerId: f.customerId || undefined, discountPct: Number(f.discountPct) || 0, exchangeRate: Number(f.exchangeRate) || 1, lines, activity: f.activity || undefined, costCentre: f.costCentre || undefined };
    if (existing) { const x = updateInvoice(existing.id, data); toast(x.message, x.ok ? 'success' : 'error'); nav(`/accounting/invoices/${existing.id}`); return; }
    const created = createInvoice({ ...data, source: fromSo ? { type: 'Sales Order', id: fromSo.id, number: fromSo.number, soId: fromSo.id, lineIds: soLines.map((l) => l.id) } : { type: 'Manual', id: '', number: '' } } as any, { draft });
    if (fromSo && !draft) linkOrderLinesToInvoice(fromSo.id, soLines.map((l) => l.id), created);
    toast(`${created.number} ${draft ? 'saved as draft' : 'created, pending approval'}`);
    nav(`/accounting/invoices/${created.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Invoices', to: '/accounting/invoices' }, { label: existing ? `Edit ${existing.number}` : 'New Invoice' }]}
        actions={<><Button variant="outlined" onClick={() => nav(existing ? `/accounting/invoices/${existing.id}` : '/accounting/invoices')}>Discard</Button>{!existing && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>{existing ? 'Update' : 'Save'}</Button></>} />
      <Page sx={{ pt: 2 }}>
        {fromSo && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from {fromSo.number}: {soLines.length} line(s) at the Sales Order price. Remove a row to leave it out; saving marks the lines invoiced on the order.</Alert>}
        {warn && <Alert severity="warning" sx={{ mb: 2 }}>{warn}. Warning only (rule to be confirmed with client).</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={headerSpecs('invoice')} f={f} set={set} err={err} />
              <Section title="Classification"><SpecForm specs={classSpecs} f={f} set={set} /></Section>
              <Section title="Items">
                <RowsEditor<Row> cols={[{ key: 'item', label: 'Item', width: 200 }, { key: 'desc', label: 'Description', width: 220 }, { key: 'qty', label: 'Quantity', width: 80 }, { key: 'unit', label: 'UOM', width: 80 }, { key: 'rate', label: 'Rate', width: 100 },
                  { key: 'discountPct', label: 'Discount %', width: 80 }, { key: 'vatPct', label: 'VAT %', type: 'select', options: ['5', '0'], width: 80 }, { key: 'account', label: 'Income Account', type: 'select', options: accOpts, width: 240 }]}
                  rows={rows} onChange={setRows} blank={{ item: '', desc: '', qty: 1, unit: 'Nos', rate: 0, discountPct: 0, vatPct: String(vatPctOf(f.vatType)), account: accOpts.find((a) => a.startsWith('410500'))! }} addLabel="Add Item" empty="No items yet" />
              </Section>
              <Section title="Discounts"><SpecForm specs={discSpecs} f={f} set={set} cols={3} /></Section>
              <TotalsBox doc={{ lines, discountOn: f.discountOn, discountPct: Number(f.discountPct) || 0, roundOff: !!f.roundOff, currency: f.currency }} />
            </>) },
          { label: 'Address and Contact', content: <SpecForm specs={addrSpecs} f={f} set={set} /> },
        ]} />
        <Box sx={{ mt: 2 }}><Text type="s5" color="theme.secondary.700">Saved invoices are Pending until approved in Accounting. The journal is posted on approval.</Text></Box>
      </Page>
    </>
  );
}
