import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { TextInput } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { R, useMaster, useServiceCharges } from './shared';

/** Every dropdown in CRM is backed by a master with a list view (5 Oct: "where is the list?"). */
export const MASTER_LABELS: Record<string, { label: string; used: string }> = {
  entity: { label: 'Entity', used: 'Lead, Opportunity, Quotation, Sales Order' },
  leadSource: { label: 'Lead Source', used: 'Lead, Opportunity' },
  lostReason: { label: 'Lost Reason', used: 'Lead' },
  industry: { label: 'Industry', used: 'Lead, Opportunity' },
  paymentTerms: { label: 'Payment Terms', used: 'Quotation, Sales Order' },
  currency: { label: 'Currency', used: 'Lead, Opportunity, Quotation, Sales Order' },
  docTemplate: { label: 'Document Template', used: 'Every printout: Lead, Opportunity, Quotation, Sales Order, Delivery Order' },
  delayReason: { label: 'Reason for a later Rental Start', used: 'Delivery Order' },
  siteChecklist: { label: 'Pre-Return Site Checklist', used: 'Customer Returns' },
  yardChecklist: { label: 'Yard Inspection Checklist', used: 'Customer Returns' },
  replacementReason: { label: 'Replacement Reason', used: 'Rental, Replacement Orders' },
  maintenanceRoutine: { label: 'Routine Maintenance Checklist', used: 'Heavy Equipment Fixed Asset: Complete Maintenance' },
  maintenanceCritical: { label: 'Critical Maintenance Checklist', used: 'Heavy Equipment Fixed Asset: Complete Maintenance' },
  tripExpenseTypes: { label: 'Trip Expense Types', used: 'Rental, Fleet Management: Trips (Complete Trip, Add Expense)' },
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
      <AppDialog open={!!dlg} title={dlg && dlg.idx < 0 ? 'Add value' : 'Edit value'} onClose={() => setDlg(null)} confirmLabel={dlg && dlg.idx < 0 ? 'Save' : 'Update'} confirmDisabled={!dlg?.value.trim()}
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
  const rows = [{ id: 'service-charges', label: 'Service Items (Inventory, Type = Service)', used: 'Quotation, Sales Order (service lines, waivers), AMC job cards. Managed in Inventory > Items', count: sv.rows.length }, ...keys.map((k) => ({ id: k, label: MASTER_LABELS[k].label, used: MASTER_LABELS[k].used, count: -1 }))];
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
  if (key === 'service-charges') return <Navigate to="/inventory/items" replace />;
  if (!key || !MASTER_LABELS[key]) return <Page><PageTitle title="Master not found" right={<Button variant="outlined" onClick={() => nav('/crm/masters')}>Back</Button>} /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Masters', to: '/crm/masters' }, { label: MASTER_LABELS[key].label }]} />
      <Page sx={{ pt: 2 }}><MasterRows k={key} /></Page>
    </>
  );
}
