import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { CYCLE_DURATIONS, START_OPTIONS, cycleSeed, COL, type CycleRec, type SalesOrder } from '@/modules/crm/data';
import { SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { useOrders } from '@/modules/crm/shared';
import { useCollection } from '@/store/store';
import { periodsOf } from '@/modules/accounting/billing';

const BASE = '/rental/billing-cycle';
const REQ = 'Existing ERP Rental > Settings > Billing Cycle; Rental > Rental Invoicing & Billing Cycle';
const useCycles = () => useCollection<CycleRec>(COL.billingCycles, cycleSeed);

const specs: Spec[] = [
  { key: 'company', label: 'Entity', type: 'master', master: 'entity', hint: 'Optional: limits the cycle to one entity' },
  { key: 'name', label: 'Name', required: true },
  { key: 'count', label: 'Count', type: 'number', required: true, hint: 'How many Durations make one invoice period (2 and Month: invoiced every 2 months)' },
  { key: 'duration', label: 'Duration', type: 'select', options: [...CYCLE_DURATIONS], required: true },
  { key: 'invoicingType', label: 'Invoicing Type', type: 'select', options: ['Manual', 'Automatic'], required: true, hint: 'Copied to a Sales Order that picks the cycle, and can be changed there. Automatic: the system raises the invoice on its date. Manual: someone submits it in Invoicing Rental Order' },
  { key: 'startOption', label: 'Invoice Start Date', type: 'radio', options: START_OPTIONS, required: true, hint: 'Where the schedule starts: the first delivery, the date the order was created, or a fixed date' },
  { key: 'customStart', label: 'Custom Invoice Start Date', type: 'date', required: true, show: (f) => f.startOption === 'custom' },
  { key: 'maxSchedule', label: 'Max Schedule Count', type: 'number', hint: 'How many invoices ahead are scheduled at one time (the schedule is extended as invoices are raised)' },
  { key: 'initialEnabled', label: 'Enable Initial Invoicing', type: 'check', hint: 'Bills the first days separately before the cycle starts' },
  { key: 'initialDays', label: 'Initial Invoice Count (days)', type: 'number', required: true, show: (f) => !!f.initialEnabled },
  { key: 'prorated', label: 'Prorated', type: 'radio', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], disabled: (f) => !(f.initialEnabled && ['Month', 'Calendar Month'].includes(f.duration)),
    hint: 'Only for a monthly cycle with Initial Invoicing: the first invoice runs to the end of the month, the rest of the initial days follows' },
];
const asForm = (c?: CycleRec): Record<string, any> => (c ? { ...c, prorated: String(!!c.prorated) } : { count: 1, duration: 'Month', invoicingType: 'Manual', startOption: 'delivery', maxSchedule: 12, initialEnabled: false, prorated: 'false' });

export function BillingCycleList() {
  const nav = useNavigate();
  const cycles = useCycles();
  return (
    <Page>
      <PageTitle title="Billing Cycle" subtitle="The cycle a rental Sales Order is invoiced on. It sets the invoice schedule." change="changed" req={REQ} />
      <DataTable<CycleRec> rows={cycles.rows} searchPlaceholder="Search billing cycles..." onAdd={() => nav(`${BASE}/add`)} addLabel="Add New" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        actions={[{ label: 'Edit', onClick: (r) => nav(`${BASE}/${r.id}/edit`) }]}
        columns={[
          { key: 'name', label: 'Name' }, { key: 'count', label: 'Count', align: 'right' }, { key: 'duration', label: 'Duration' }, { key: 'company', label: 'Entity', render: (r) => r.company ?? 'All' },
          { key: 'invoicingType', label: 'Invoicing Type', render: (r) => <StatusChip status={r.invoicingType} tone={r.invoicingType === 'Automatic' ? 'blue' : 'grey'} /> },
          { key: 'start', label: 'Invoice Start Date', change: 'new', req: REQ, render: (r) => START_OPTIONS.find((o) => o.value === r.startOption)?.label },
          { key: 'max', label: 'Max Schedule Count', align: 'right', render: (r) => r.maxSchedule ?? '-' },
          { key: 'ini', label: 'Initial Invoice', render: (r) => (r.initialEnabled ? `${r.initialDays} day(s)` : 'No') }, { key: 'prorated', label: 'Prorated', render: (r) => (r.prorated ? 'Yes' : 'No') },
        ]} />
    </Page>
  );
}

export function BillingCycleForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cycles = useCycles();
  const c = cycles.get(id);
  const [f, setF] = useState<Record<string, any>>(() => asForm(c));
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => {
    const n = { ...x, [k]: v };
    if (!n.initialEnabled || !['Month', 'Calendar Month'].includes(n.duration)) n.prorated = 'false';
    return n;
  });
  const save = () => {
    const e: Record<string, string> = {};
    if (!String(f.name ?? '').trim()) e.name = 'Name is required';
    else if (cycles.rows.some((x) => x.name.toLowerCase() === f.name.trim().toLowerCase() && x.id !== c?.id)) e.name = 'A billing cycle with this name exists';
    if (!(Number(f.count) > 0)) e.count = 'Count must be above zero';
    if (f.startOption === 'custom' && !f.customStart) e.customStart = 'Custom Invoice Start Date is required';
    if (f.initialEnabled && !(Number(f.initialDays) >= 1)) e.initialDays = 'Initial Invoice Count must be 1 or more';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const rec: CycleRec = { id: c?.id ?? `bc${Date.now()}`, name: f.name.trim(), count: Number(f.count), duration: f.duration, company: f.company || undefined, invoicingType: f.invoicingType, startOption: f.startOption, customStart: f.startOption === 'custom' ? f.customStart : undefined,
      maxSchedule: f.maxSchedule === '' || f.maxSchedule === undefined ? undefined : Number(f.maxSchedule), initialEnabled: !!f.initialEnabled, initialDays: f.initialEnabled ? Number(f.initialDays) : undefined, prorated: f.prorated === 'true' };
    if (c) cycles.update(c.id, rec); else cycles.add(rec);
    toast('Billing cycle saved'); nav(`${BASE}/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Billing Cycle', to: BASE }, { label: c ? `Edit ${c.name}` : 'Add New' }]} actions={<><Button variant="text" onClick={() => nav(BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}><SpecForm specs={specs} f={f} set={set} err={err} /></Page>
    </>
  );
}

export function BillingCycleView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cycles = useCycles();
  const orders = useOrders();
  const [del, setDel] = useState(false);
  const c = cycles.get(id);
  if (!c) return <Page><PageTitle title="Billing cycle not found" right={<Button variant="outlined" onClick={() => nav(BASE)}>Back</Button>} /></Page>;
  const used = orders.rows.filter((o: SalesOrder) => o.activity === 'Rental' && o.billingCycle === c.name);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Billing Cycle', to: BASE }, { label: c.name }]} actions={<MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${BASE}/${c.id}/edit`) }, { label: 'Delete', disabled: used.length > 0, onClick: () => setDel(true) }]} />} />
      <Page sx={{ pt: 2 }}>
        <SpecView specs={specs.filter((s) => s.key !== 'prorated').concat({ key: 'prorated', label: 'Prorated' })} f={{ ...c, prorated: c.prorated ? 'Yes' : 'No', startOption: c.startOption }} cols={4} />
        <Text type="s4" weight="medium" sx={{ mt: 3, mb: 1 }}>Used by {used.length} Sales Order(s)</Text>
        <DataTable hideToolbar rows={used} emptyText="No Sales Order uses this cycle" onRowClick={(o) => nav(`/crm/sales-orders/${o.id}`)} columns={[
          { key: 'number', label: 'Sales Order' }, { key: 'invoicingType', label: 'Invoicing Type', render: (o) => o.invoicingType ?? c.invoicingType }, { key: 'sched', label: 'First periods', render: (o) => periodsOf(o, c, 3).map((p) => `${p.from} to ${p.to}`).join(', ') || 'Starts at the first delivery' },
        ]} />
      </Page>
      <ConfirmDialog open={del} title="Delete Billing Cycle" description={`Delete ${c.name}?`} danger confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => { cycles.remove(c.id); toast('Deleted'); nav(BASE); }} />
    </>
  );
}
