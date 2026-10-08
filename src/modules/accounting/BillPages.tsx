import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { suppliers } from '@/mock-data/masters';
import { COL, TODAY, chItems, type CrossHire, type SalesOrder } from '@/modules/crm/data';
import { linkCrossHireBill } from '@/modules/crm/flow';
import { getCollection } from '@/store/store';
import { PrintDialog } from '@/modules/crm/ActionDialogs';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { lid } from './billing';
import { APPROVAL_STATUSES, EDITABLE, expenseAccountFor, expenseAccounts, totalsOf, type Bill, type ExpenseLine, type InvLine } from './data';
import { approveBill, billByRef, billDue, billTotal, createBill, deleteBill, isOverdue, rejectBill, submitBill, updateBill } from './engine';
import { ApprovalButtons, DocChips, ExpensesTable, LedgerDialog, LedgerTable, LinesTable, PaymentDialog, R_ACC, SourceLink, TotalsBox, money, sourcePath, useBills, useDebitNotes, useJournals, usePayments } from './shared';
import { discSpecs, headerSpecs } from './SalesInvoicePages';

export function BillList() {
  const nav = useNavigate();
  const toast = useToast();
  const b = useBills();
  return (
    <Page>
      <PageTitle title="Bills" />
      <DataTable<Bill> rows={b.rows} searchPlaceholder="Search bills..." filter={{ key: 'approval', options: APPROVAL_STATUSES, label: 'Status' }} onAdd={() => nav('/accounting/bills/add')} addLabel="Add Bill" onRowClick={(r) => nav(`/accounting/bills/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'supplierName', label: 'Supplier' }, { key: 'supplierInvoiceNo', label: 'Supplier Invoice No' },
          { key: 'payStatus', label: 'Payment Status', render: (r) => (r.approval === 'Approved' ? <DocChips approval="" payStatus={r.payStatus} /> : '-') }, { key: 'approval', label: 'Status', render: (r) => <DocChips approval={r.approval} /> },
          { key: 'total', label: 'Total Invoice Value', align: 'right', render: (r) => money(billTotal(r)) }, { key: 'date', label: 'Invoice Date' },
          { key: 'dueDate', label: 'Due Date', render: (r) => <Text type="s4" color={isOverdue(r) ? '#C64D4D' : undefined}>{r.dueDate}</Text> }, { key: 'amountPaid', label: 'Payment Amount', align: 'right', render: (r) => money(r.amountPaid) },
          { key: 'source', label: 'Source', change: 'new', req: R_ACC.bill, render: (r) => <SourceLink s={r.source} /> }, { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R_ACC.gl, render: (r) => r.costCentre ?? '-' }, { key: 'currency', label: 'Currency' },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`/accounting/bills/${r.id}`) },
          { label: 'Edit', hidden: (r) => !EDITABLE.includes(r.approval), onClick: (r) => nav(`/accounting/bills/${r.id}/edit`) },
          { label: 'Delete', danger: true, hidden: (r) => !EDITABLE.includes(r.approval) || r.amountPaid > 0, onClick: (r) => { const x = deleteBill(r.id); toast(x.message, x.ok ? 'success' : 'error'); } },
        ]} />
    </Page>
  );
}

const viewSpecs: Spec[] = [
  { key: 'number', label: 'ID' }, { key: 'date', label: 'Bill Date' }, { key: 'supplierName', label: 'Supplier' }, { key: 'supplierInvoiceNo', label: 'Supplier Invoice Number' },
  { key: 'supplierInvoiceDate', label: 'Supplier Invoice Date' }, { key: 'entity', label: 'Company' }, { key: 'paymentTerms', label: 'Payment Term' }, { key: 'dueDate', label: 'Due Date' },
  { key: 'currency', label: 'Currency' }, { key: 'orderRef', label: 'Order Reference' }, { key: 'activity', label: 'Activity Type', change: 'new', req: R_ACC.inv }, { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R_ACC.gl },
  { key: 'sourceText', label: 'Source Document', change: 'new', req: R_ACC.bill }, { key: 'narration', label: 'Narration' },
];

export function BillView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  useBills(); useJournals();
  const pays = usePayments().rows;
  const dns = useDebitNotes().rows;
  const b = billByRef(id);
  const [dlg, setDlg] = useState<'pay' | 'ledger' | 'print' | 'del' | null>(null);
  if (!b) return <Page><PageTitle title="Bill not found" right={<Button variant="outlined" onClick={() => nav('/accounting/bills')}>Back</Button>} /></Page>;
  const approved = b.approval === 'Approved';
  const due = billDue(b);
  const r = (x: { ok: boolean; message: string }) => toast(x.message, x.ok ? 'success' : 'error');
  const src = sourcePath(b.source);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Bills', to: '/accounting/bills' }, { label: b.number }]} status={<DocChips approval={b.approval} payStatus={b.payStatus} />}
        actions={<>
          {EDITABLE.includes(b.approval) && <Button variant="outlined" onClick={() => nav(`/accounting/bills/${b.id}/edit`)}>Edit</Button>}
          <ApprovalButtons approval={b.approval} onSubmit={(a) => r(submitBill(b.id, a))} onApprove={(how) => r(approveBill(b.id, how))} onReject={(n) => r(rejectBill(b.id, n))} />
          <MenuButton label="Create" items={[
            { label: 'Payment Entry', disabled: !approved || b.payStatus === 'Paid', onClick: () => setDlg('pay') },
            { label: 'Debit Note', disabled: !approved || due <= 0, onClick: () => nav(`/accounting/debit-notes/add?bill=${b.id}`) },
          ]} />
          <MenuButton label="View" items={[{ label: `Source: ${b.source.type}`, disabled: !src, onClick: () => src && nav(src) }, { label: 'Accounting Ledger', disabled: !b.journalId, onClick: () => setDlg('ledger') }, { label: 'Debit Notes', onClick: () => nav('/accounting/debit-notes') }]} />
          <MenuButton label="Actions" items={[{ label: 'Download / Print', onClick: () => setDlg('print') }, { label: 'Delete', disabled: !EDITABLE.includes(b.approval) || b.amountPaid > 0, onClick: () => setDlg('del') }]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {b.source.type !== 'Manual' && <Alert severity="info" sx={{ mb: 2 }}>Created from <SourceLink s={b.source} />. {approved ? 'Approved and posted.' : 'Pending approval by Accounts: no journal and no payment until it is approved.'}{!b.supplierInvoiceNo && ' Enter the supplier invoice number with Edit when the supplier invoice arrives.'}</Alert>}
        {isOverdue(b) && <Alert severity="error" sx={{ mb: 2 }}>Overdue since {b.dueDate}. Amount due {money(due)}.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView cols={4} specs={viewSpecs} f={{ ...b, sourceText: <SourceLink s={b.source} /> }} />
              <Section title="Items"><LinesTable lines={b.lines} /></Section>
              <Section title="Expenses"><ExpensesTable rows={b.expenses} /></Section>
              <TotalsBox doc={b} paid={b.amountPaid} />
            </>) },
          { label: 'Payments', change: 'new', req: R_ACC.pay, content: (
            <>
              <DataTable hideToolbar rows={pays.filter((p) => p.allocations.some((a) => a.docId === b.id))} emptyText="No payment yet" onRowClick={(p) => nav(`/accounting/payment-entries/${p.id}`)} columns={[
                { key: 'number', label: 'Entry' }, { key: 'date', label: 'Date' }, { key: 'method', label: 'Type' }, { key: 'amount', label: 'Applied', align: 'right', render: (p) => money(p.allocations.find((a) => a.docId === b.id)?.amount ?? 0) }, { key: 'approval', label: 'Status', render: (p) => <DocChips approval={p.approval} /> },
              ]} />
              <Text type="s4" weight="medium" sx={{ mt: 2 }}>Debit Notes</Text>
              <DataTable hideToolbar rows={dns.filter((n) => n.againstId === b.id)} emptyText="No debit note" onRowClick={(n) => nav(`/accounting/debit-notes/${n.id}`)} columns={[{ key: 'number', label: 'Debit Note' }, { key: 'date', label: 'Date' }, { key: 'reason', label: 'Reason' }, { key: 't', label: 'Amount', align: 'right', render: (n) => money(totalsOf({ lines: n.lines }).total) }, { key: 'approval', label: 'Status', render: (n) => <DocChips approval={n.approval} /> }]} />
            </>) },
          { label: 'Accounting Ledger', content: <LedgerTable journalId={b.journalId} /> },
          { label: 'Activity Log', content: <Timeline items={[...b.log].reverse()} /> },
        ]} />
      </Page>
      {dlg === 'pay' && <PaymentDialog open onClose={() => setDlg(null)} doc={b} kind="bill" />}
      <LedgerDialog open={dlg === 'ledger'} onClose={() => setDlg(null)} journalId={b.journalId} />
      <PrintDialog open={dlg === 'print'} onClose={() => setDlg(null)} doc="Bill" />
      <ConfirmDialog open={dlg === 'del'} title={`Delete ${b.number}`} description="The bill is removed. This is only possible before approval." confirmLabel="Delete" danger onClose={() => setDlg(null)} onConfirm={() => { const x = deleteBill(b.id); r(x); setDlg(null); if (x.ok) nav('/accounting/bills'); }} />
    </>
  );
}

const itemAcc = expenseAccounts.map((a) => `${a.code} ${a.name}`);
type Row = { item: string; desc: string; qty: any; unit: string; rate: any; discountPct: any; vatPct: string; account: string };
type ExRow = { account: string; desc: string; amount: any; vatPct: string };
const accText = (code: string) => itemAcc.find((a) => a.startsWith(code)) ?? code;

export function BillForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const existing = billByRef(id);
  // From a Cross Hire Order (Bill): supplier, rate and expenses come from the order; saving records the supplier invoice on the order.
  const ch = !existing ? getCollection<CrossHire>(COL.crossHire).find((x) => x.id === sp.get('crossHire')) : undefined;
  const chSo = ch ? getCollection<SalesOrder>(COL.orders).find((x) => x.id === ch.soId) : undefined;
  const [f, setF] = useState<Record<string, any>>(() => existing ? { ...existing } : { entity: 'Gulf Power Rentals LLC', date: TODAY, postingTime: '09:00', paymentTerms: '30 days', currency: 'AED', exchangeRate: 1, discountOn: 'None', discountPct: 0, roundOff: false, supplierInvoiceDate: TODAY, ...(ch ? { supplierId: ch.supplierId, supplierName: ch.supplier, paymentTerms: ch.paymentTerms ?? '30 days', orderRef: ch.number, activity: 'Rental', costCentre: chSo?.costCentre } : {}) });
  const [rows, setRows] = useState<Row[]>(() => (ch ? chItems(ch).map((it) => ({ item: `Cross-hire ${it.group} ${it.category}`, desc: `${ch.number}${ch.soNumber ? ` for ${ch.soNumber}` : ''}`, qty: it.qty, unit: 'Nos', rate: it.rate, discountPct: 0, vatPct: '5', account: accText('510100') })) : (existing?.lines ?? []).map((l) => ({ item: l.item, desc: l.desc, qty: l.qty, unit: l.unit, rate: l.rate, discountPct: l.discountPct, vatPct: String(l.vatPct), account: accText(l.account) }))));
  const [ex, setEx] = useState<ExRow[]>(() => (ch ? (ch.expenses ?? []).map((e) => ({ account: accText(expenseAccountFor(e.account)), desc: e.note || e.account, amount: e.amount, vatPct: '5' })) : (existing?.expenses ?? []).map((e) => ({ account: accText(e.account), desc: e.desc, amount: e.amount, vatPct: String(e.vatPct) }))));
  const [err, setErr] = useState<Record<string, string>>({});
  if (id && !existing) return <Page><PageTitle title="Bill not found" /></Page>;
  if (existing && !EDITABLE.includes(existing.approval)) return <Page><PageTitle title={`${existing.number} is approved and cannot be edited`} subtitle="Raise a Debit Note to correct an approved bill." right={<Button variant="outlined" onClick={() => nav(`/accounting/bills/${existing.id}`)}>Back</Button>} /></Page>;
  const set = (k: string, v: any) => setF((x) => { const n = { ...x, [k]: v }; if (k === 'supplierId') { const s = suppliers.find((y) => y.id === v); n.supplierName = s?.name ?? ''; n.paymentTerms = s?.creditPeriod ? `${s.creditPeriod} days` : x.paymentTerms; } return n; });
  const lines: InvLine[] = rows.filter((r) => r.item.trim()).map((r) => ({ id: lid(), item: r.item, desc: r.desc || r.item, qty: Number(r.qty) || 0, unit: r.unit || 'Nos', rate: Number(r.rate) || 0, discountPct: Number(r.discountPct) || 0, vatPct: Number(r.vatPct) || 0, account: String(r.account).slice(0, 6) || '510500', costCentre: f.costCentre || undefined, activity: f.activity || undefined, tag: 'manual' }));
  const expenses: ExpenseLine[] = ex.filter((e) => Number(e.amount) > 0).map((e) => ({ id: lid(), account: String(e.account).slice(0, 6) || '510500', desc: e.desc, amount: Number(e.amount), vatPct: Number(e.vatPct) || 0, costCentre: f.costCentre || undefined }));
  const specs: Spec[] = [
    { key: 'supplierId', label: 'Supplier', type: 'select', required: true, options: suppliers.filter((s) => s.active || s.id === f.supplierId).map((s) => ({ value: s.id, label: s.name })) },
    { key: 'supplierInvoiceNo', label: 'Supplier Invoice Number', required: true, hint: 'The supplier\'s own number; the bill also carries our internal number (Req, Vendor Bill)' }, { key: 'supplierInvoiceDate', label: 'Supplier Invoice Date', type: 'date', required: true },
    ...headerSpecs('bill'),
  ];
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (!f.supplierId && !f.supplierName) e.supplierId = 'Supplier is required';
    if (!draft && !String(f.supplierInvoiceNo ?? '').trim()) e.supplierInvoiceNo = 'Supplier Invoice Number is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    if (!lines.length && !expenses.length) { toast('Add at least one item or expense', 'error'); return; }
    const data = { ...f, lines, expenses, discountPct: Number(f.discountPct) || 0, exchangeRate: Number(f.exchangeRate) || 1, activity: f.activity || undefined, costCentre: f.costCentre || undefined };
    if (existing) { const x = updateBill(existing.id, data); toast(x.message, x.ok ? 'success' : 'error'); nav(`/accounting/bills/${existing.id}`); return; }
    const b = createBill({ ...data, source: ch ? { type: 'Cross Hire', id: ch.id, number: ch.number, soId: ch.soId } : { type: 'Manual', id: '', number: '' } } as any, { draft });
    if (ch && !draft) linkCrossHireBill(ch.id, b);
    toast(`${b.number} ${draft ? 'saved as draft' : 'created, pending approval'}`);
    nav(`/accounting/bills/${b.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Bills', to: '/accounting/bills' }, { label: existing ? `Edit ${existing.number}` : 'New Bill' }]}
        actions={<><Button variant="outlined" onClick={() => nav(existing ? `/accounting/bills/${existing.id}` : '/accounting/bills')}>Discard</Button>{!existing && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        {ch && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from cross-hire order {ch.number} ({ch.qty ?? 1} unit(s) in {chItems(ch).length} item(s) at the agreed rate per unit, and its expenses). Enter the supplier's invoice number and date; saving records the supplier invoice on the order.</Alert>}
        <SpecForm specs={specs} f={f} set={set} err={err} />
        <Section title="Items">
          <RowsEditor<Row> cols={[{ key: 'item', label: 'Item', width: 200 }, { key: 'desc', label: 'Description', width: 200 }, { key: 'qty', label: 'Quantity', width: 80 }, { key: 'unit', label: 'UOM', width: 80 }, { key: 'rate', label: 'Rate', width: 100 }, { key: 'discountPct', label: 'Discount %', width: 80 }, { key: 'vatPct', label: 'VAT %', type: 'select', options: ['5', '0'], width: 80 }, { key: 'account', label: 'Expense Account', type: 'select', options: itemAcc, width: 240 }]}
            rows={rows} onChange={setRows} blank={{ item: '', desc: '', qty: 1, unit: 'Nos', rate: 0, discountPct: 0, vatPct: '5', account: accText('510500') }} addLabel="Add Item" empty="No items" />
        </Section>
        <Section title="Expenses" hint="GL expense lines without an item (existing bill form)">
          <RowsEditor<ExRow> cols={[{ key: 'account', label: 'Account', type: 'select', options: itemAcc, width: 260 }, { key: 'desc', label: 'Narration', width: 260 }, { key: 'amount', label: 'Amount', width: 120 }, { key: 'vatPct', label: 'VAT %', type: 'select', options: ['5', '0'], width: 80 }]}
            rows={ex} onChange={setEx} blank={{ account: accText('510300'), desc: '', amount: 0, vatPct: '5' }} addLabel="Add Expense" empty="No expenses" />
        </Section>
        <Section title="Discounts"><SpecForm specs={discSpecs} f={f} set={set} cols={3} /></Section>
        <TotalsBox doc={{ lines, expenses, discountOn: f.discountOn, discountPct: Number(f.discountPct) || 0, roundOff: !!f.roundOff }} />
      </Page>
    </>
  );
}
