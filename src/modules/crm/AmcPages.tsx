import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { employees, itemMaster } from '@/mock-data/masters';
import { DataTable } from '@/components/DataTable';
import { Timeline } from '@/components/Flow';
import { useToast } from '@/components/Dialogs';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow, Panel, TabPanels } from '@/components/Widgets';
import { ALL_LOCATIONS, custName, docTotals, type JobCard, type SalesOrder } from './data';
import { completeJobCard, createJobCard, getOrder, invoiceJobCard, jobCardCost, jobCardTotal, saveJobCard } from './flow';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from './FormKit';
import { R, aed, useJobCards, useOrders, useServiceCharges } from './shared';

const R_AMC = 'CRM > AMC Orders and Job Cards (meeting 5 Oct)';
const contractValue = (o: SalesOrder) => docTotals(o.lines, o.discountPct, o.vatType).sub;
const amcStats = (o: SalesOrder, jcs: JobCard[]) => {
  const mine = jcs.filter((j) => j.soId === o.id);
  const invoiced = mine.filter((j) => j.status === 'Invoiced');
  const revenue = invoiced.reduce((s, j) => s + jobCardTotal(j), 0);
  const cost = mine.filter((j) => j.status !== 'Open').reduce((s, j) => s + jobCardCost(j), 0);
  return { mine, revenue, cost, done: (o.visitPlan ?? []).filter((v) => v.done).length };
};

/** AMC Orders: the AMC Sales Orders, listed like the Rental Orders. AMC has no Delivery Order, each visit has a Job Card. */
export function AmcList() {
  const nav = useNavigate();
  const orders = useOrders();
  const jcs = useJobCards();
  const rows = orders.rows.filter((o) => o.activity === 'AMC');
  return (
    <Page>
      <PageTitle title="AMC Orders" subtitle="AMC Sales Orders. Each planned visit has a Job Card, an AMC order is a project (cost centre)." change="new" req={R_AMC} />
      <DataTable<SalesOrder> rows={rows} searchPlaceholder="Search AMC orders..." onAdd={() => nav('/crm/quotations/add')} addLabel="Add AMC Order" onRowClick={(r) => nav(`/crm/amc-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) }, { key: 'item', label: 'AMC Item', render: (r) => r.lines[0]?.item },
          { key: 'period', label: 'AMC Period', render: (r) => `${r.amcStart} to ${r.amcEnd}` },
          { key: 'visits', label: 'Visits done', align: 'right', render: (r) => `${amcStats(r, jcs.rows).done} of ${r.visits}` },
          { key: 'value', label: 'Contract Value', align: 'right', render: (r) => aed(contractValue(r)) }, { key: 'billed', label: 'Invoiced', align: 'right', render: (r) => aed(amcStats(r, jcs.rows).revenue) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
    </Page>
  );
}

export function AmcView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const jcs = useJobCards();
  const o = orders.get(id);
  if (!o || o.activity !== 'AMC') return <Page><PageTitle title="AMC order not found" right={<Button variant="outlined" onClick={() => nav('/crm/amc-orders')}>Back</Button>} /></Page>;
  const st = amcStats(o, jcs.rows);
  const value = contractValue(o);
  const plan = o.visitPlan ?? [];
  const jcOf = (idx: number) => st.mine.find((j) => j.visitIdx === idx);
  const f = { ...o, customerName: custName(o.customerId), item: o.lines[0]?.item, period: `${o.amcStart} to ${o.amcEnd}`, value: aed(value), project: o.costCentre || '-' };
  return (
    <>
      <FormHeader crumbs={[{ label: 'AMC Orders', to: '/crm/amc-orders' }, { label: o.number }]} status={<StatusChip status={o.status} />}
        actions={<><Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${o.id}`)}>View Sales Order</Button><Button variant="outlined" onClick={() => window.print()}>Print consolidated report</Button></>} />
      <Page sx={{ pt: 2 }}>
        <KpiRow>
          <KpiCard title="Contract value" value={aed(value)} sub={`${o.visits} visits, ${aed(value / (o.visits || 1))} each`} />
          <KpiCard title="Invoiced" value={aed(st.revenue)} sub={`${st.mine.filter((j) => j.status === 'Invoiced').length} job card(s) invoiced`} tint="#E8F5F0" />
          <KpiCard title="Consumables cost" value={aed(st.cost)} sub="Materials consumed on visits" tint="#FFF3CC" />
          <KpiCard title="Profit to date" value={aed(st.revenue - st.cost)} sub="Invoiced less cost" />
        </KpiRow>
        <Panel title="Project / Cost Centre" change="new" req={R_AMC}>
          <SpecView cols={4} f={f} specs={[{ key: 'customerName', label: 'Customer' }, { key: 'item', label: 'AMC Item' }, { key: 'period', label: 'AMC Period' }, { key: 'project', label: 'Cost Centre / Project' }, { key: 'lpo', label: 'LPO' }, { key: 'entity', label: 'Entity' }, { key: 'site', label: 'Site' }, { key: 'status', label: 'Order Status' }]} />
        </Panel>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Planned visits', change: 'new', req: R_AMC, content: (
              <DataTable hideToolbar rows={plan.map((v, i) => ({ id: String(i), i, ...v }))} columns={[
                { key: 'n', label: 'Visit', render: (r) => r.i + 1 }, { key: 'date', label: 'Planned Date' }, { key: 'amount', label: 'Visit value (contract split)', align: 'right', render: (r) => aed(r.amount) },
                { key: 'jc', label: 'Job Card', render: (r) => jcOf(r.i)?.number ?? '-' }, { key: 'st', label: 'Status', render: (r) => <StatusChip status={jcOf(r.i)?.status ?? 'Planned'} /> }, { key: 'inv', label: 'Invoice', render: (r) => jcOf(r.i)?.invoiceRef ?? '-' },
                { key: 'act', label: '', render: (r) => <Button size="small" variant={jcOf(r.i) ? 'outlined' : 'contained'} onClick={() => { const jid = createJobCard(o.id, r.i); if (!jcOf(r.i)) toast('Job card created for the visit'); nav(`/crm/job-cards/${jid}`); }}>{jcOf(r.i) ? 'Open Job Card' : 'Create Job Card'}</Button> },
              ]} />) },
            { label: 'Consolidated report', change: 'new', req: R_AMC, content: (
              <Box>
                <DataTable hideToolbar rows={plan.map((v, i) => { const j = jcOf(i); return { id: String(i), visit: i + 1, planned: v.date, jc: j?.number ?? '-', done: j?.doneOn ?? '-', cons: j ? j.materials.map((m) => `${m.qty} ${m.unit} ${m.item}`).join(', ') || '-' : '-', svc: j ? j.services.map((m) => m.name).join(', ') || '-' : '-', cost: j ? jobCardCost(j) : 0, billed: j && j.status === 'Invoiced' ? jobCardTotal(j) : 0, inv: j?.invoiceRef ?? '-' }; })}
                  columns={[{ key: 'visit', label: 'Visit' }, { key: 'planned', label: 'Planned' }, { key: 'jc', label: 'Job Card' }, { key: 'done', label: 'Done On' }, { key: 'cons', label: 'Consumables used' }, { key: 'svc', label: 'Services' }, { key: 'cost', label: 'Cost', align: 'right', render: (r) => aed(r.cost) }, { key: 'inv', label: 'Invoice' }, { key: 'billed', label: 'Invoiced', align: 'right', render: (r) => aed(r.billed) }]} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 1.5 }}><Text type="s3" weight="medium">Total invoiced {aed(st.revenue)}</Text><Text type="s3" weight="medium">Total cost {aed(st.cost)}</Text><Text type="s3" weight="medium">Profit {aed(st.revenue - st.cost)}</Text></Box>
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>For the client: planned visit dates, job cards, consumables used, cost and sales invoices raised. Cost uses the cost entered on each material line.</Text>
              </Box>) },
            { label: 'Activity log', content: <Timeline items={o.log} /> },
          ]} />
        </Box>
      </Page>
    </>
  );
}

const jcSpecs = (f: Record<string, any>): Spec[] => [
  { key: 'number', label: 'ID', type: 'readonly' }, { key: 'entity', label: 'Entity', type: 'readonly' }, { key: 'soNumber', label: 'AMC Order', type: 'readonly' }, { key: 'customerName', label: 'Customer', type: 'readonly' },
  { key: 'item', label: 'AMC Item', type: 'readonly' }, { key: 'visitNo', label: 'Visit', type: 'readonly' }, { key: 'plannedDate', label: 'Planned Date', type: 'readonly' },
  { key: 'technician', label: 'Technician', type: 'select', options: employees.filter((e) => ['Service Technician', 'Yard Supervisor', 'Sales Representative'].includes(e.designation)).map((e) => e.name), required: true },
  { key: 'location', label: 'Consume from location', type: 'select', options: ALL_LOCATIONS, hint: 'A van or car location tagged to the technician (Inventory locations)' },
  { key: 'visitAmount', label: 'Visit value (contract split)', type: 'readonly', value: () => aed(f.visitAmount) },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

/** Job Card: one per AMC visit, copied from the Manufacturing job card without routing. Materials and services are recorded and an invoice is raised against it. */
export function JobCardPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const jcs = useJobCards();
  const svc = useServiceCharges().rows;
  const jc = jcs.get(id);
  const [f, setF] = useState<JobCard | undefined>(jc);
  if (!jc || !f) return <Page><PageTitle title="Job card not found" right={<Button variant="outlined" onClick={() => nav('/crm/amc-orders')}>Back</Button>} /></Page>;
  const so = getOrder(jc.soId);
  const locked = f.status === 'Invoiced';
  const set = (k: string, v: any) => setF((x) => ({ ...x!, [k]: v }));
  const view = { ...f, entity: so?.entity, customerName: custName(f.customerId), visitNo: `${f.visitIdx + 1} of ${so?.visits ?? '-'}` };
  const spare = itemMaster.filter((i) => i.spare || i.category === 'Consumable' || i.category === 'Spare Part').map((i) => i.name);
  const save = () => { saveJobCard(f); toast('Job card saved'); };
  return (
    <>
      <FormHeader crumbs={[{ label: 'AMC Orders', to: '/crm/amc-orders' }, { label: so?.number ?? jc.soNumber, to: `/crm/amc-orders/${jc.soId}` }, { label: jc.number }]} status={<StatusChip status={f.status} />}
        actions={<>
          {!locked && <Button variant="outlined" onClick={save}>Save</Button>}
          {f.status === 'Open' && <Button variant="contained" onClick={() => { if (!f.technician) { toast('Select the technician first', 'error'); return; } saveJobCard(f); completeJobCard(f); setF({ ...f, status: 'Completed', doneOn: new Date().toISOString().slice(0, 10) }); toast('Visit completed'); }}>Complete Visit</Button>}
          {f.status === 'Completed' && <Button variant="contained" onClick={() => { saveJobCard(f); const ref = invoiceJobCard(f); setF({ ...f, status: 'Invoiced', invoiceRef: ref }); toast(`Invoice ${ref} raised against the job card`); }}>Create Invoice</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        {locked && <Alert severity="info" sx={{ mb: 2 }}>This job card is invoiced ({f.invoiceRef}) and cannot be changed.</Alert>}
        <SpecForm specs={jcSpecs(f)} f={view} set={set} locked={locked} />
        <Section title="Materials consumed" change="new" req={R_AMC}>
          <RowsEditor locked={locked} cols={[{ key: 'item', label: 'Material', type: 'select', options: spare, width: 260 }, { key: 'qty', label: 'Quantity', width: 90 }, { key: 'unit', label: 'UoM', width: 90 }, { key: 'price', label: 'Billed price', width: 110 }, { key: 'cost', label: 'Cost', width: 110 }]}
            rows={f.materials.map((m) => ({ ...m, qty: m.qty as any, price: m.price as any, cost: (m.cost ?? '') as any }))} blank={{ item: '', qty: 1 as any, unit: 'Nos', price: 0 as any, cost: '' as any }} addLabel="Add Material" empty="No materials"
            onChange={(r) => set('materials', r.map((m) => { const im = itemMaster.find((i) => i.name === m.item); const price = Number(m.price) || im?.price || 0; return { item: m.item, qty: Number(m.qty) || 0, unit: m.unit || im?.unit || 'Nos', price, cost: m.cost === '' || m.cost === undefined ? Math.round(price * 0.7 * 100) / 100 : Number(m.cost) }; }))} />
        </Section>
        <Section title="Services performed" change="new" req={R_AMC}>
          <RowsEditor locked={locked} cols={[{ key: 'name', label: 'Service', type: 'select', options: svc.map((s) => s.name), width: 280 }, { key: 'amount', label: 'Amount', width: 120 }]}
            rows={f.services.map((s) => ({ ...s, amount: s.amount as any }))} blank={{ name: '', amount: 0 as any }} addLabel="Add Service" empty="No additional services"
            onChange={(r) => set('services', r.map((s) => ({ name: s.name, amount: Number(s.amount) || svc.find((x) => x.name === s.name)?.price || 0 })))} />
        </Section>
        <Box sx={{ ml: 'auto', width: 340, mt: 2 }}>
          {[['Visit value (contract split)', f.visitAmount], ['Materials', f.materials.reduce((s, m) => s + m.qty * m.price, 0)], ['Services', f.services.reduce((s, m) => s + m.amount, 0)]].map(([k, v]) => <Box key={String(k)} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s4">{k}</Text><Text type="s4">{aed(Number(v))}</Text></Box>)}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid #D3D3D4' }}><Text type="s3" weight="medium">Invoice total</Text><Text type="s3" weight="medium">{aed(jobCardTotal(f))}</Text></Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s5" color="theme.secondary.700">Cost of materials</Text><Text type="s5" color="theme.secondary.700">{aed(jobCardCost(f))}</Text></Box>
        </Box>
        <Section title="Job card log"><Timeline items={f.log} /></Section>
      </Page>
    </>
  );
}
export { R };
