import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { SERVICE_BILLING, SERVICE_TYPES, type ServiceCharge } from './data';
import { R, useMaster, useServiceCharges } from './shared';

/** Every dropdown in CRM is backed by a master with a list view (5 Oct: "where is the list?"). */
export const MASTER_LABELS: Record<string, { label: string; used: string }> = {
  entity: { label: 'Entity', used: 'Lead, Opportunity, Quotation, Sales Order' },
  leadSource: { label: 'Lead Source', used: 'Lead, Opportunity' },
  lostReason: { label: 'Lost Reason', used: 'Lead' },
  industry: { label: 'Industry', used: 'Lead, Opportunity' },
  paymentTerms: { label: 'Payment Terms', used: 'Quotation, Sales Order' },
  currency: { label: 'Currency', used: 'Lead, Opportunity, Quotation, Sales Order' },
  docTemplate: { label: 'Document Template', used: 'Quotation' },
  delayReason: { label: 'Reason for a later Rental Start', used: 'Delivery Order' },
  siteChecklist: { label: 'Pre-Return Site Checklist', used: 'Customer Returns' },
  yardChecklist: { label: 'Yard Inspection Checklist', used: 'Customer Returns' },
  replacementReason: { label: 'Replacement Reason', used: 'Rental, Replacement Orders' },
};

function MasterRows({ k }: { k: string }) {
  const m = useMaster(k);
  const toast = useToast();
  const [dlg, setDlg] = useState<{ idx: number; value: string } | null>(null);
  const [del, setDel] = useState<number | null>(null);
  return (
    <>
      <DataTable searchPlaceholder="Search values..." rows={m.values.map((v, i) => ({ id: String(i), i, value: v }))} onAdd={() => setDlg({ idx: -1, value: '' })} addLabel="Add Value"
        columns={[{ key: 'value', label: MASTER_LABELS[k]?.label ?? k }]} actions={[{ label: 'Edit', onClick: (r) => setDlg({ idx: r.i, value: r.value }) }, { label: 'Delete', danger: true, onClick: (r) => setDel(r.i) }]} />
      <AppDialog open={!!dlg} title={dlg && dlg.idx < 0 ? 'Add value' : 'Edit value'} onClose={() => setDlg(null)} confirmLabel="Save" confirmDisabled={!dlg?.value.trim()}
        onConfirm={() => { if (!dlg) return; m.replace(dlg.idx < 0 ? [...m.values, dlg.value.trim()] : m.values.map((v, i) => (i === dlg.idx ? dlg.value.trim() : v))); toast('Master updated'); setDlg(null); }}>
        <TextInput label="Value" required value={dlg?.value} onChange={(v) => dlg && setDlg({ ...dlg, value: v })} />
      </AppDialog>
      <ConfirmDialog open={del !== null} danger title="Delete value" description="Documents that already use this value keep it." confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del !== null) m.replace(m.values.filter((_, i) => i !== del)); setDel(null); toast('Value deleted'); }} />
    </>
  );
}

function MasterCount({ k }: { k: string }) { return <span>{useMaster(k).values.length}</span>; }

export function MastersIndex() {
  const nav = useNavigate();
  const sv = useServiceCharges();
  const keys = Object.keys(MASTER_LABELS);
  const rows = [{ id: 'service-charges', label: 'Service Charges', used: 'Quotation, Sales Order (service items, waivers), AMC job cards', count: sv.rows.length }, ...keys.map((k) => ({ id: k, label: MASTER_LABELS[k].label, used: MASTER_LABELS[k].used, count: -1 }))];
  return (
    <Page>
      <PageTitle title="Masters" subtitle="Every list used in the CRM screens. Values can also be added from the dropdown itself with Create New." change="new" req={R.meet} />
      <DataTable hideToolbar rows={rows} onRowClick={(r) => nav(`/crm/masters/${r.id}`)} columns={[{ key: 'label', label: 'Master' }, { key: 'used', label: 'Used on' }, { key: 'count', label: 'Values', align: 'right', render: (r) => (r.count >= 0 ? r.count : <MasterCount k={r.id} />) }]} />
    </Page>
  );
}

export function MasterView() {
  const { key } = useParams();
  const nav = useNavigate();
  if (key === 'service-charges') return <ServiceChargePage />;
  if (!key || !MASTER_LABELS[key]) return <Page><PageTitle title="Master not found" right={<Button variant="outlined" onClick={() => nav('/crm/masters')}>Back</Button>} /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Masters', to: '/crm/masters' }, { label: MASTER_LABELS[key].label }]} />
      <Page sx={{ pt: 2 }}><MasterRows k={key} /></Page>
    </>
  );
}

/** Service master: name, type (waiver, insurance, charge), billing (one-time, recurring, lump sum) and default price. Frequency is taken from the quotation. */
function ServiceChargePage() {
  const sv = useServiceCharges();
  const toast = useToast();
  const [d, setD] = useState<ServiceCharge | null>(null);
  const isNew = d && !sv.get(d.id);
  const save = () => { if (!d) return; if (isNew) sv.add(d); else sv.update(d.id, d); toast(isNew ? 'Service charge added' : 'Service charge updated'); setD(null); };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Masters', to: '/crm/masters' }, { label: 'Service Charges' }]} />
      <Page sx={{ pt: 2 }}>
        <PageTitle title="Service Charges" subtitle="Used for service lines on Quotations and Sales Orders. The billing type is set here, so it is not asked again on the document." />
        <DataTable<ServiceCharge> rows={sv.rows} searchPlaceholder="Search service charges..." onAdd={() => setD({ id: `sv${Date.now()}`, name: '', type: 'Charge', billing: 'One-time', price: 0, desc: '', source: 'CRM' })} addLabel="Add Service Charge"
          columns={[{ key: 'name', label: 'Service' }, { key: 'type', label: 'Type' }, { key: 'billing', label: 'Billing', render: (r) => <StatusChip status={r.billing} tone="grey" /> }, { key: 'price', label: 'Default price (AED)', align: 'right' }, { key: 'desc', label: 'Description' }, { key: 'source', label: 'Source' }]}
          actions={[{ label: 'Edit', onClick: setD }, { label: 'Delete', danger: true, onClick: (r) => { sv.remove(r.id); toast('Service charge deleted'); } }]} />
      </Page>
      <AppDialog open={!!d} title={isNew ? 'Add Service Charge' : 'Edit Service Charge'} onClose={() => setD(null)} confirmLabel="Save" confirmDisabled={!d?.name.trim()} onConfirm={save}>
        {d && (
          <FormGrid>
            <TextInput label="Service" required value={d.name} onChange={(v) => setD({ ...d, name: v })} />
            <SelectInput label="Type" required value={d.type} options={SERVICE_TYPES} onChange={(v) => setD({ ...d, type: v })} hint="A waiver blocks the damage charge at return" />
            <SelectInput label="Billing" required value={d.billing} options={SERVICE_BILLING} onChange={(v) => setD({ ...d, billing: v })} hint="Recurring follows the frequency of the quotation" />
            <NumberInput label="Default price (AED)" value={d.price} onChange={(v) => setD({ ...d, price: Number(v) })} />
            <TextInput label="Description" multiline rows={2} value={d.desc} onChange={(v) => setD({ ...d, desc: v })} full />
          </FormGrid>
        )}
      </AppDialog>
    </>
  );
}
