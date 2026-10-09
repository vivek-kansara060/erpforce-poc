import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { employees } from '@/mock-data/masters';
import { DataTable } from '@/components/DataTable';
import { Timeline } from '@/components/Flow';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, SelectInput } from '@/components/Form';
import { EmailDialog, PrintDialog } from './ActionDialogs';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow, Panel, TabPanels } from '@/components/Widgets';
import { invoiceByRef, paymentStatusOf, pendingCollectionFor } from '@/modules/accounting/engine';
import { PaymentDialog, useInvoices, usePayments } from '@/modules/accounting/shared';
import { AMC_LIKE, custName, docTotals, liveItems, vanLocationsFor, type JobCard, type SalesOrder } from './data';
import { closeOrder, completeJobCard, confirmOrder, createJobCard, draftJobCard, getOrder, invoiceJobCard, jobCardCost, jobCardFoc, jobCardMaterialVat, jobCardTotal, saveJobCard, stockAt } from './flow';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from './FormKit';
import { R, aed, useJobCards, useOrders } from './shared';

const R_AMC = 'CRM > AMC Orders and Job Cards (meeting 5 Oct)';
const contractValue = (o: SalesOrder) => docTotals(o.lines, o.discountPct, o.vatType).sub;
/** Payment of a job card is read from its invoice in Accounting (older seeded cards fall back to their stored status). */
const jcPay = (j?: JobCard) => (!j?.invoiceRef ? '-' : j.invoiceId || invoiceByRef(j.invoiceRef) ? paymentStatusOf(j.invoiceId ?? j.invoiceRef) : j.paymentStatus ?? 'Unpaid');
const payChip = (s: string) => (s === '-' ? '-' : <StatusChip status={s} tone={s === 'Paid' ? 'green' : s === 'Partially Paid' ? 'blue' : 'amber'} />);
const amcStats = (o: SalesOrder, jcs: JobCard[]) => {
  const mine = jcs.filter((j) => j.soId === o.id);
  const invoiced = mine.filter((j) => j.status === 'Invoiced');
  const revenue = invoiced.reduce((s, j) => s + jobCardTotal(j), 0);
  const cost = mine.filter((j) => j.status !== 'Open').reduce((s, j) => s + jobCardCost(j), 0);
  const foc = mine.filter((j) => j.status !== 'Open').reduce((s, j) => s + jobCardFoc(j), 0);
  return { mine, invoiced, revenue, cost, foc, done: (o.visitPlan ?? []).filter((v) => v.done).length };
};

/** AMC Orders: the AMC Sales Orders, listed like the Rental Orders. AMC has no Delivery Order, each visit has a Job Card. */
export function AmcList() {
  const nav = useNavigate();
  const orders = useOrders();
  const jcs = useJobCards();
  useInvoices(); usePayments();
  const rows = orders.rows.filter((o) => AMC_LIKE.includes(o.activity));
  return (
    <Page>
      <PageTitle title="AMC Orders" subtitle="AMC Sales Orders. Each planned visit has a Job Card; an AMC order is a project (cost centre). A Service order has no visit and no job card: it is executed and invoiced from the Sales Order." change="new" req={R_AMC} />
      <DataTable<SalesOrder> rows={rows} searchPlaceholder="Search AMC orders..." onAdd={() => nav('/crm/quotations/add?activity=AMC')} addLabel="Add AMC Order" onRowClick={(r) => nav(`/crm/amc-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) }, { key: 'project', label: 'Project', change: 'new', req: R_AMC, render: (r) => r.costCentre || '-' }, { key: 'item', label: 'Scope', render: (r) => (r.amcScope || r.lines[0]?.desc || '-') },
          { key: 'period', label: 'AMC Period', render: (r) => `${r.amcStart} to ${r.amcEnd}` },
          { key: 'visits', label: 'Visits done', align: 'right', render: (r) => `${amcStats(r, jcs.rows).done} of ${r.visits}` },
          { key: 'value', label: 'Contract Value', align: 'right', render: (r) => aed(contractValue(r)) }, { key: 'billed', label: 'Invoiced', align: 'right', render: (r) => aed(amcStats(r, jcs.rows).revenue) },
          { key: 'foc', label: 'Free of cost', align: 'right', change: 'new', req: R_AMC, render: (r) => aed(amcStats(r, jcs.rows).foc) },
          { key: 'paid', label: 'Payment', change: 'new', req: R_AMC, render: (r) => { const m = amcStats(r, jcs.rows).invoiced; return m.length ? `${m.filter((j) => jcPay(j) === 'Paid').length} of ${m.length} paid` : '-'; } },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
    </Page>
  );
}

/** Generate, Invoice from the AMC order or the job card: shows what will be invoiced; the invoice is created Pending (decision D4). */
function JobCardInvoiceDialog({ candidates, onClose }: { candidates: JobCard[]; onClose: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const [id, setId] = useState(candidates[0]?.id ?? '');
  const jc = candidates.find((j) => j.id === id);
  return (
    <AppDialog open title="Generate Invoice" onClose={onClose} confirmLabel="Generate Invoice" confirmDisabled={!jc}
      onConfirm={() => { if (!jc) return; const inv = invoiceJobCard(jc); toast(`Invoice ${inv.number} raised against ${jc.number}, pending approval in Accounting`); onClose(); nav(`/accounting/invoices/${inv.id}`); }}>
      {candidates.length > 1 && <SelectInput label="Job Card" required value={id} options={candidates.map((j) => ({ value: j.id, label: `${j.number}, visit ${j.visitIdx + 1}, done ${j.doneOn ?? '-'}` }))} onChange={setId} />}
      {jc && (
        <Box sx={{ mt: 1 }}>
          {[['Visit value (contract split)', jc.visitFoc ? 0 : jc.visitAmount], ['Materials', jc.materials.reduce((s, m) => s + (m.foc ? 0 : m.qty * m.price), 0)], ...(jobCardMaterialVat(jc) > 0 ? [['Material VAT', jobCardMaterialVat(jc)]] : []), ['Services', jc.services.reduce((s, m) => s + (m.foc ? 0 : m.amount), 0)]].map(([k, v]) => <Box key={String(k)} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}><Text type="s4">{k}</Text><Text type="s4">{aed(Number(v))}</Text></Box>)}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid #D3D3D4' }}><Text type="s3" weight="medium">Invoice amount</Text><Text type="s3" weight="medium">{aed(jobCardTotal(jc))}</Text></Box>
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>FOC lines are not invoiced. The invoice is created Pending and is approved in Accounting before payment can be recorded.</Text>
        </Box>
      )}
    </AppDialog>
  );
}

/** AMC order view: read-only like the Sales Order view, with Generate, View and Actions menus. The form is only used to create and edit the order. */
export function AmcView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const jcs = useJobCards();
  useInvoices(); usePayments();
  const [dlg, setDlg] = useState<'invoice' | 'mail' | 'print' | 'close' | null>(null);
  const o = orders.get(id);
  if (!o || !AMC_LIKE.includes(o.activity)) return <Page><PageTitle title="AMC order not found" right={<Button variant="outlined" onClick={() => nav('/crm/amc-orders')}>Back</Button>} /></Page>;
  const st = amcStats(o, jcs.rows);
  const value = contractValue(o);
  const plan = o.visitPlan ?? [];
  const months = Math.max(1, Math.round(((new Date(o.amcEnd ?? o.amcStart ?? '').getTime() - new Date(o.amcStart ?? '').getTime()) / 86400000 + 1) / 30.4));
  const jcOf = (idx: number) => st.mine.find((j) => j.visitIdx === idx);
  const nextVisit = plan.findIndex((_, i) => !jcOf(i));
  const toInvoice = st.mine.filter((j) => j.status === 'Completed');
  const f = { ...o, customerName: custName(o.customerId), item: (o.amcScope || o.lines[0]?.desc || '-'), period: `${o.amcStart} to ${o.amcEnd}`, value: aed(value), project: o.costCentre || '-' };
  return (
    <>
      <FormHeader crumbs={[{ label: 'AMC Orders', to: '/crm/amc-orders' }, { label: o.number }]} status={<StatusChip status={o.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${o.id}/edit`)}>Edit</Button>
          {o.status === 'Pending' && <Button variant="outlined" onClick={() => { confirmOrder(o); toast('AMC order confirmed'); }}>Confirm</Button>}
          <MenuButton label="Generate" variant="contained" items={[
            { label: nextVisit < 0 ? 'Job Card (every visit has one)' : `Job Card (visit ${nextVisit + 1})`, disabled: nextVisit < 0, onClick: () => nav(`/crm/job-cards/add?so=${o.id}&visit=${nextVisit}`) },
            { label: toInvoice.length ? `Invoice (${toInvoice.length} completed job card${toInvoice.length > 1 ? 's' : ''})` : 'Invoice (no completed job card)', disabled: !toInvoice.length, onClick: () => setDlg('invoice') },
          ]} />
          <MenuButton label="View" items={[
            { label: 'Sales Order', onClick: () => nav(`/crm/sales-orders/${o.id}`) }, { label: 'Quotation', disabled: !o.quoteId, onClick: () => nav(`/crm/quotations/${o.quoteId}`) },
            { label: 'Opportunity', disabled: !o.oppId, onClick: () => nav(`/crm/opportunities/${o.oppId}`) }, { label: 'Invoices', onClick: () => nav(`/accounting/invoices?so=${o.id}`) },
          ]} />
          <MenuButton label="Actions" items={[
            { label: 'Send by Email', onClick: () => setDlg('mail') }, { label: 'Print', onClick: () => setDlg('print') }, { label: 'Print consolidated report', onClick: () => window.print() },
            { label: 'Close', disabled: ['Closed', 'Cancelled'].includes(o.status), onClick: () => setDlg('close') },
          ]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        <KpiRow>
          <KpiCard title="Contract value" value={aed(value)} sub={`${o.visits} visits, ${aed(value / (o.visits || 1))} each`} />
          <KpiCard title="Invoiced" value={aed(st.revenue)} sub={`${st.invoiced.length} job card(s) invoiced`} tint="#E8F5F0" />
          <KpiCard title="Free of cost" value={aed(st.foc)} sub="FOC visits, materials and services (not billed)" />
          <KpiCard title="Consumables cost" value={aed(st.cost)} sub="Materials consumed on visits" tint="#FFF3CC" />
          <KpiCard title="Profit to date" value={aed(st.revenue - st.cost)} sub="Invoiced less cost" />
        </KpiRow>
        <Panel title="Project Details" change="new" req={R_AMC}>
          <SpecView cols={4} f={f} specs={[{ key: 'project', label: 'Project' }, { key: 'customerName', label: 'Customer' }, { key: 'item', label: 'Scope' }, { key: 'period', label: 'AMC Period' }, { key: 'lpo', label: 'LPO' }, { key: 'entity', label: 'Entity' }, { key: 'site', label: 'Site' }, { key: 'status', label: 'Order Status' }]} />
        </Panel>
        <Alert severity="info" sx={{ mt: 2 }}>Value split: {aed(value)} over {months} month(s) is {aed(value / months)} a month. With {o.visits} planned visit(s) each visit is billed {aed(value / (o.visits || 1))}, so every Job Card invoice carries its visit value, unless the visit is marked FOC on its job card.</Alert>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Planned visits', change: 'new', req: R_AMC, content: (
              <DataTable hideToolbar rows={plan.map((v, i) => ({ id: String(i), i, ...v }))} columns={[
                { key: 'n', label: 'Visit', render: (r) => r.i + 1 }, { key: 'date', label: 'Planned Date' }, { key: 'actual', label: 'Actual Date', change: 'new', req: R_AMC, render: (r) => jcOf(r.i)?.doneOn ?? '-' }, { key: 'amount', label: 'Visit value (contract split)', align: 'right', render: (r) => (jcOf(r.i)?.visitFoc ? <>{aed(r.amount)} <StatusChip status="FOC" tone="grey" /></> : aed(r.amount)) },
                { key: 'jc', label: 'Job Card', render: (r) => jcOf(r.i)?.number ?? '-' }, { key: 'st', label: 'Status', render: (r) => <StatusChip status={jcOf(r.i)?.status ?? 'Planned'} /> }, { key: 'inv', label: 'Invoice', render: (r) => jcOf(r.i)?.invoiceRef ?? '-' }, { key: 'pay', label: 'Payment', change: 'new', req: R_AMC, render: (r) => payChip(jcPay(jcOf(r.i))) },
                { key: 'act', label: '', render: (r) => (jcOf(r.i) ? <Button size="small" variant="outlined" onClick={() => nav(`/crm/job-cards/${jcOf(r.i)!.id}`)}>Open Job Card</Button> : <Button size="small" variant="contained" onClick={() => nav(`/crm/job-cards/add?so=${o.id}&visit=${r.i}`)}>Create Job Card</Button>) },
              ]} />) },
            { label: 'Consolidated report', change: 'new', req: R_AMC, content: (
              <Box>
                <DataTable hideToolbar rows={plan.map((v, i) => { const j = jcOf(i); return { id: String(i), visit: i + 1, planned: v.date, jc: j?.number ?? '-', done: j?.doneOn ?? '-', cons: j ? j.materials.map((m) => `${m.qty} ${m.unit} ${m.item}${m.foc ? ' (FOC)' : ''}`).join(', ') || '-' : '-', svc: j ? j.services.map((m) => `${m.name}${m.foc ? ' (FOC)' : ''}`).join(', ') || '-' : '-', cost: j ? jobCardCost(j) : 0, foc: j ? jobCardFoc(j) : 0, focVisit: !!j?.visitFoc, billed: j && j.status === 'Invoiced' ? jobCardTotal(j) : 0, inv: j?.invoiceRef ?? '-' }; })}
                  columns={[{ key: 'visit', label: 'Visit' }, { key: 'planned', label: 'Planned' }, { key: 'jc', label: 'Job Card' }, { key: 'done', label: 'Done On' }, { key: 'cons', label: 'Consumables used' }, { key: 'svc', label: 'Services' }, { key: 'foc', label: 'Free of cost', align: 'right', render: (r) => (r.foc ? `${aed(r.foc)}${r.focVisit ? ' (FOC visit)' : ''}` : '-') }, { key: 'cost', label: 'Cost', align: 'right', render: (r) => aed(r.cost) }, { key: 'inv', label: 'Invoice' }, { key: 'billed', label: 'Invoiced', align: 'right', render: (r) => aed(r.billed) }]} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 1.5 }}><Text type="s3" weight="medium">Total invoiced {aed(st.revenue)}</Text><Text type="s3" weight="medium">Free of cost {aed(st.foc)}</Text><Text type="s3" weight="medium">Total cost {aed(st.cost)}</Text><Text type="s3" weight="medium">Profit {aed(st.revenue - st.cost)}</Text></Box>
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>For the client: planned visit dates, job cards, consumables used, cost and sales invoices raised. Cost uses the cost entered on each material line.</Text>
              </Box>) },
            { label: 'Activity log', content: <Timeline items={o.log} /> },
          ]} />
        </Box>
      </Page>
      {dlg === 'invoice' && <JobCardInvoiceDialog candidates={toInvoice} onClose={() => setDlg(null)} />}
      <PrintDialog open={dlg === 'print'} onClose={() => setDlg(null)} doc="AMC Order" />
      <EmailDialog open={dlg === 'mail'} onClose={() => setDlg(null)} docNo={o.number} customerId={o.customerId} onSent={(l) => orders.update(o.id, { log: [l, ...o.log] })} />
      <ConfirmDialog open={dlg === 'close'} title="Close AMC Order" description="The order is closed. Job cards and invoices stay as they are." confirmLabel="Close order" onClose={() => setDlg(null)} onConfirm={() => { const x = closeOrder(o); toast(x.message, x.ok ? 'success' : 'error'); setDlg(null); }} />
    </>
  );
}

const jcSpecs = (f: Record<string, any>, editing: boolean): Spec[] => [
  { key: 'number', label: 'ID', type: 'readonly' }, { key: 'entity', label: 'Entity', type: 'readonly' }, { key: 'soNumber', label: 'AMC Order', type: 'readonly' }, { key: 'customerName', label: 'Customer', type: 'readonly' },
  { key: 'project', label: 'Project', type: 'readonly', change: 'new', req: R_AMC }, { key: 'item', label: 'Scope', type: 'readonly' }, { key: 'visitNo', label: 'Visit', type: 'readonly' }, { key: 'plannedDate', label: 'Planned Date', type: 'readonly' }, { key: 'actualDate', label: 'Actual Date', type: 'readonly', change: 'new', req: R_AMC, hint: 'Taken from the job card date when the visit is completed' },
  { key: 'technician', label: 'Technician', type: editing ? 'select' : 'readonly', options: employees.filter((e) => ['Service Technician', 'Yard Supervisor'].includes(e.designation)).map((e) => e.name), required: true },
  { key: 'location', label: 'Consume from location', type: editing ? 'select' : 'readonly', options: () => vanLocationsFor(f.technician), change: 'changed', req: R_AMC, hint: 'Service vans (Employee locations) assigned to the technician. Materials are drawn from here' },
  { key: 'visitAmount', label: 'Visit value (contract split)', type: 'readonly', value: () => aed(f.visitAmount) },
  { key: 'visitFoc', label: 'FOC visit (visit value not billed)', type: editing ? 'check' : 'readonly', value: editing ? undefined : () => (f.visitFoc ? 'Yes' : 'No'), change: 'new', req: R_AMC, hint: 'Chargeable Override (Project Team): this visit\'s share of the Contract Value is not invoiced. Materials and services follow their own FOC tick' },
  { key: 'activities', label: 'Job Activities', type: editing ? 'textarea' : 'readonly', full: true, change: 'new', req: R_AMC, hint: 'General description of the standard process done on the visit, even with no materials or services' },
  { key: 'notes', label: 'Notes', type: editing ? 'textarea' : 'readonly', full: true },
];
const jcView = (f: JobCard) => { const so = getOrder(f.soId); return { ...f, item: so?.amcScope || so?.lines[0]?.desc || '-', entity: so?.entity, project: so?.costCentre ?? '-', actualDate: f.doneOn ?? 'Set from today when the visit is completed', customerName: custName(f.customerId), visitNo: `${f.visitIdx + 1} of ${so?.visits ?? '-'}` }; };
function JcTotals({ f }: { f: JobCard }) {
  return (
    <Box sx={{ ml: 'auto', width: 340, mt: 2 }}>
      {[['Visit value (contract split)', f.visitFoc ? 0 : f.visitAmount], ['Materials', f.materials.reduce((s, m) => s + (m.foc ? 0 : m.qty * m.price), 0)], ...(jobCardMaterialVat(f) > 0 ? [['Material VAT', jobCardMaterialVat(f)]] : []), ['Services', f.services.reduce((s, m) => s + (m.foc ? 0 : m.amount), 0)], ...(jobCardFoc(f) > 0 ? [['Free of cost (not billed)', jobCardFoc(f)]] : [])].map(([k, v]) => <Box key={String(k)} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s4">{k}</Text><Text type="s4">{aed(Number(v))}</Text></Box>)}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid #D3D3D4' }}><Text type="s3" weight="medium">Invoice total</Text><Text type="s3" weight="medium">{aed(jobCardTotal(f))}</Text></Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s5" color="theme.secondary.700">Cost of materials</Text><Text type="s5" color="theme.secondary.700">{aed(jobCardCost(f))}</Text></Box>
    </Box>
  );
}

/** Job Card view: read-only, with Complete Visit, Generate (Invoice), View and Actions. The form opens only to create a job card or through Actions, Edit. */
export function JobCardView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const jcs = useJobCards();
  useInvoices(); usePayments();
  const jc = jcs.get(id);
  const [dlg, setDlg] = useState<'print' | 'upload' | 'invoice' | 'pay' | 'mail' | null>(null);
  const [upload, setUpload] = useState<string[]>([]);
  if (!jc) return <Page><PageTitle title="Job card not found" right={<Button variant="outlined" onClick={() => nav('/crm/amc-orders')}>Back</Button>} /></Page>;
  const so = getOrder(jc.soId);
  const inv = invoiceByRef(jc.invoiceId ?? jc.invoiceRef);
  const pay = jcPay(jc);
  const canPay = !!inv && inv.approval === 'Approved' && inv.payStatus !== 'Paid' && !pendingCollectionFor(inv.id);
  const amcItems = new Set(liveItems().filter((i) => i.classification === 'AMC').map((i) => i.name));
  const vanStock = stockAt(jc.location).filter((s) => amcItems.has(s.name));
  const short = jc.status === 'Open' ? jc.materials.filter((m) => m.item && m.qty > (vanStock.find((s) => s.name === m.item)?.qty ?? 0)) : [];
  const complete = () => {
    if (!jc.technician) { toast('Select the technician first (Actions, Edit)', 'error'); return; }
    if (jc.materials.length && !jc.location) { toast('Select the van the materials come from (Actions, Edit)', 'error'); return; }
    if (short.length) { toast(`Not enough stock in ${jc.location}: ${short.map((m) => m.item).join(', ')}`, 'error'); return; }
    completeJobCard(jc); toast('Visit completed. The actual date is today');
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'AMC Orders', to: '/crm/amc-orders' }, { label: so?.number ?? jc.soNumber, to: `/crm/amc-orders/${jc.soId}` }, { label: jc.number }]}
        status={<Box sx={{ display: 'flex', gap: 1 }}><StatusChip status={jc.status} />{jc.status === 'Invoiced' && payChip(pay)}</Box>}
        actions={<>
          {jc.status === 'Open' && <Button variant="contained" onClick={complete}>Complete Visit</Button>}
          <MenuButton label="Generate" variant={jc.status === 'Completed' ? 'contained' : 'outlined'} items={[{ label: 'Invoice', disabled: jc.status !== 'Completed', onClick: () => setDlg('invoice') }]} />
          <MenuButton label="View" items={[{ label: 'AMC Order', onClick: () => nav(`/crm/amc-orders/${jc.soId}`) }, { label: 'Sales Order', onClick: () => nav(`/crm/sales-orders/${jc.soId}`) }, { label: 'Invoice', disabled: !inv, onClick: () => inv && nav(`/accounting/invoices/${inv.id}`) }]} />
          <MenuButton label="Actions" items={[
            { label: 'Edit', disabled: jc.status === 'Invoiced', onClick: () => nav(`/crm/job-cards/${jc.id}/edit`) },
            { label: 'Print', onClick: () => setDlg('print') }, { label: 'Send by Email', onClick: () => setDlg('mail') },
            { label: 'Upload signed copy', onClick: () => { setUpload(jc.signedCopy ?? []); setDlg('upload'); } },
            { label: 'Record Payment', disabled: !canPay, onClick: () => setDlg('pay') },
          ]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {jc.status === 'Invoiced' && <Alert severity="info" sx={{ mb: 2 }}>This job card is invoiced ({jc.invoiceRef}, payment {pay}) and cannot be changed.</Alert>}
        {short.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>More than the van holds: {short.map((m) => m.item).join(', ')}. Edit the job card before completing the visit.</Alert>}
        <SpecView cols={4} specs={jcSpecs(jc, false)} f={jcView(jc)} />
        {jc.signedCopy && jc.signedCopy.length > 0 && <Alert severity="success" sx={{ mt: 2 }}>Signed copy uploaded: {jc.signedCopy.join(', ')}</Alert>}
        <Section title="Scope of Work" change="new" req={R_AMC} hint="Carried from the quotation this contract was raised from; read-only on the job card">
          <Text type="s4">{so?.amcScope || 'Not specified on the order'}</Text>
        </Section>
        <Section title="Materials consumed (optional)" change="new" req={R_AMC}>
          <DataTable hideToolbar rows={jc.materials.map((m, i) => ({ id: String(i), ...m }))} emptyText="No materials" columns={[{ key: 'item', label: 'Material' }, { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'unit', label: 'UoM' }, { key: 'price', label: 'Billed price', align: 'right', render: (m) => aed(m.foc ? 0 : m.price) }, { key: 'vat', label: 'VAT %', align: 'right', change: 'new', req: R_AMC, render: (m) => `${m.vat ?? 0}%` }, { key: 'foc', label: 'FOC', render: (m) => (m.foc ? 'Yes' : 'No') }, { key: 'cost', label: 'Cost', align: 'right', render: (m) => aed(m.cost ?? Math.round(m.price * 0.7 * 100) / 100) }]} />
        </Section>
        <JcTotals f={jc} />
        <Section title="Accounting and inventory entries" change="new" req={R_AMC}>
          <DataTable hideToolbar emptyText="No consumption on this job card" rows={jc.materials.map((m, i) => ({ id: String(i), item: m.item, qty: `${m.qty} ${m.unit}`, cost: m.qty * (m.cost ?? Math.round(m.price * 0.7 * 100) / 100) }))}
            columns={[{ key: 'item', label: 'Material' }, { key: 'qty', label: 'Inventory ledger (out)' }, { key: 'dr', label: 'Journal debit', render: () => 'Cost of Materials Consumed' }, { key: 'cr', label: 'Journal credit', render: () => 'Inventory' }, { key: 'cost', label: 'Amount', align: 'right', render: (r) => aed(r.cost) }]} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Posted by Accounting and the Inventory ledger when the visit is completed. Shown here for reference only.</Text>
        </Section>
        <Section title="Job card log"><Timeline items={jc.log} /></Section>
      </Page>
      {dlg === 'invoice' && <JobCardInvoiceDialog candidates={[jc]} onClose={() => setDlg(null)} />}
      {dlg === 'pay' && inv && <PaymentDialog open onClose={() => setDlg(null)} doc={inv} kind="invoice" />}
      <PrintDialog open={dlg === 'print'} onClose={() => setDlg(null)} doc="Job Card" />
      <EmailDialog open={dlg === 'mail'} onClose={() => setDlg(null)} docNo={jc.number} customerId={jc.customerId} onSent={(l) => saveJobCard({ ...jc, log: [...jc.log, l] })} />
      <AppDialog open={dlg === 'upload'} title="Upload signed job card" onClose={() => setDlg(null)} confirmLabel="Save" onConfirm={() => { saveJobCard({ ...jc, signedCopy: upload }); toast('Signed copy saved'); setDlg(null); }}>
        <FileInput label="Signed job card" multiple value={upload} onChange={setUpload} hint="Print the job card, get it signed by the client and upload the scan here" />
      </AppDialog>
    </>
  );
}

/** Job Card form: create a job card for a planned visit, or edit one that is not invoiced yet (decision D1). */
export function JobCardForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const jcs = useJobCards();
  const soId = sp.get('so') ?? '';
  const visit = Number(sp.get('visit') ?? -1);
  const existing = id ? jcs.get(id) : jcs.rows.find((j) => j.soId === soId && j.visitIdx === visit);
  const [f, setF] = useState<JobCard | undefined>(() => (id ? existing : existing ? undefined : draftJobCard(soId, visit)));
  if (!id && existing) return <Navigate to={`/crm/job-cards/${existing.id}`} replace />;
  if (id && existing?.status === 'Invoiced') return <Navigate to={`/crm/job-cards/${existing.id}`} replace />;
  if (!f) return <Page><PageTitle title="Job card not found" right={<Button variant="outlined" onClick={() => nav('/crm/amc-orders')}>Back</Button>} /></Page>;
  const so = getOrder(f.soId);
  const set = (k: string, v: any) => setF((x) => { const n = { ...x!, [k]: v }; if (k === 'technician') { const vans = vanLocationsFor(v); n.location = vans.includes(x!.location) ? x!.location : vans[0] ?? ''; } return n; });
  const amcItems = new Set(liveItems().filter((i) => i.classification === 'AMC').map((i) => i.name));
  const vanStock = stockAt(f.location).filter((s) => amcItems.has(s.name));
  const spare = [...new Set([...vanStock.map((s) => s.name), ...f.materials.map((m) => m.item).filter(Boolean)])];
  const back = () => nav(id ? `/crm/job-cards/${id}` : `/crm/amc-orders/${f.soId}`);
  const save = () => {
    if (!f.technician) { toast('Select the technician', 'error'); return; }
    if (id) { saveJobCard({ ...f, log: [...f.log, { when: new Date().toISOString().slice(0, 16).replace('T', ' '), title: 'Job card edited', by: 'Ahmed Al Khouri' }] }); toast('Job card saved'); nav(`/crm/job-cards/${id}`); return; }
    const { id: _i, number: _n, status: _s, log: _l, ...fields } = f;
    void _i; void _n; void _s; void _l;
    const nid = createJobCard(f.soId, f.visitIdx, fields);
    toast('Job card created. Complete the visit from its page');
    nav(`/crm/job-cards/${nid}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'AMC Orders', to: '/crm/amc-orders' }, { label: so?.number ?? f.soNumber, to: `/crm/amc-orders/${f.soId}` }, { label: id ? `Edit ${f.number}` : `New Job Card, visit ${f.visitIdx + 1}` }]}
        actions={<><Button variant="outlined" onClick={back}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <SpecForm specs={jcSpecs(f, true)} f={jcView(f)} set={set} />
        <Section title="Materials consumed (optional)" change="new" req={R_AMC} hint="Billed by default. Tick FOC (Chargeable Override, Project Team) to give a line free of cost (the billed price shows as 0); the material still leaves the van stock.">
          <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>{f.location ? `In ${f.location}: ${vanStock.map((s) => `${s.name} ${s.qty} ${s.unit}`).join(', ') || 'no stock'}` : 'Select the technician and their van to pick materials'}</Text>
          <RowsEditor cols={[{ key: 'item', label: 'Material', type: 'select', options: spare, width: 260 }, { key: 'qty', label: 'Quantity', width: 90 }, { key: 'unit', label: 'UoM', width: 90 }, { key: 'price', label: 'Billed price', width: 110 }, { key: 'vat', label: 'VAT %', width: 80 }, { key: 'foc', label: 'FOC', type: 'check', width: 60 }, { key: 'cost', label: 'Cost', width: 110 }]}
            rows={f.materials.map((m) => ({ ...m, qty: m.qty as any, price: (m.foc ? 0 : m.price) as any, vat: (m.vat ?? '') as any, foc: !!m.foc, cost: (m.cost ?? '') as any }))} blank={{ item: '', qty: 1 as any, unit: 'Nos', price: 0 as any, vat: '' as any, foc: false, cost: '' as any }} addLabel="Add Material" empty="No materials"
            onChange={(r) => set('materials', r.map((m) => { const im = liveItems().find((i) => i.name === m.item); const foc = !!m.foc; const rawPrice = Number(m.price) || im?.price || 0; return { item: m.item, qty: Number(m.qty) || 0, unit: m.unit || im?.unit || 'Nos', price: foc ? 0 : rawPrice, vat: Number(m.vat) || 0, foc: foc || undefined, cost: m.cost === '' || m.cost === undefined || !Number(m.cost) ? Math.round(rawPrice * 0.7 * 100) / 100 : Number(m.cost) }; }))} />
        </Section>
        <JcTotals f={f} />
      </Page>
    </>
  );
}
export { R };
