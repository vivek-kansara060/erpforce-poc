import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { CheckInput, FormGrid, FormSection, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { Panel } from '@/components/Widgets';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { useCollection } from '@/store/store';
import { suppliers } from '@/mock-data/masters';
import { COMPANY, LOCATION_TYPES, locationSeed, type LocationRec } from './data';
import { aed, requireFields, type Errors } from './shared';

const REQ = 'Location & Warehouse Master';
const useLocs = () => useCollection<LocationRec>('locations', locationSeed);
const STATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const fmtQty = (n?: number) => (n === undefined ? '-' : n.toLocaleString('en-US'));

export function LocationList() {
  const nav = useNavigate();
  const toast = useToast();
  const locs = useLocs();
  const [del, setDel] = useState<LocationRec | null>(null);
  return (
    <Page>
      <PageTitle title="Location" />
      <DataTable<LocationRec>
        rows={locs.rows} searchPlaceholder="Search locations..."
        onAdd={() => nav('/inventory/locations/add')} addLabel="Add Location" onRowClick={(r) => nav(`/inventory/locations/${r.id}`)}
        columns={[
          { key: 'code', label: 'Location Code', change: 'new', req: REQ },
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Location Type', change: 'new', req: REQ },
          { key: 'address1', label: 'Address', render: (r) => [r.address1, r.city].filter(Boolean).join(', ') || '-' },
          { key: 'company', label: 'Company' },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status ?? 'Active'} /> },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`/inventory/locations/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`/inventory/locations/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete location" description={`Delete ${del?.name}? This cannot be undone.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { locs.remove(del.id); toast('Location deleted'); } }} />
    </Page>
  );
}

export function LocationForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const locs = useLocs();
  const sup = useCollection('suppliers', suppliers);
  const existing = id ? locs.get(id) : undefined;
  const code = existing?.code ?? `LOC-${String(locs.rows.reduce((m, l) => Math.max(m, Number(l.code.replace(/\D/g, '')) || 0), 0) + 1).padStart(4, '0')}`;
  const [f, setF] = useState<Record<string, any>>(() => ({ name: '', shortName: '', type: '', supplierId: '', parent: '', company: COMPANY, address1: '', zipcode: '', country: 'United Arab Emirates', state: '', city: '', summary: '', inventoryAvailable: true, status: 'Active', ...Object.fromEntries(Object.entries(existing ?? {}).map(([k, v]) => [k, v ?? ''])) }));
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const held = f.type === 'Supplier-Held Location';
  const save = () => {
    const e = requireFields(f, ['name', 'type', ...(held ? ['supplierId'] : [])], { type: 'Location Type', supplierId: 'Linked Supplier' });
    if (!e.name && locs.rows.some((l) => l.id !== existing?.id && l.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A location with this name already exists';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: LocationRec = { ...(existing ?? { stockHeld: undefined }), id: existing?.id ?? `l${Date.now()}`, code, name: f.name.trim(), shortName: f.shortName, type: f.type, supplierId: held ? f.supplierId : undefined, parent: f.parent, company: f.company, address1: f.address1, zipcode: f.zipcode, country: f.country, state: f.state, city: f.city, summary: f.summary, inventoryAvailable: !!f.inventoryAvailable, status: f.status } as LocationRec;
    if (existing) locs.update(rec.id, rec); else locs.add(rec);
    toast(existing ? 'Location updated' : 'Location created');
    nav(`/inventory/locations/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Location', to: '/inventory/locations' }, { label: existing ? `Edit ${existing.name}` : 'Add Location' }]}
        actions={<><Button variant="outlined" onClick={() => nav('/inventory/locations')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid>
          <TextInput label="Name" required value={f.name} onChange={set('name')} error={errors.name} />
          <TextInput label="Short Name" value={f.shortName} onChange={set('shortName')} />
          <TextInput label="Location Code" change="new" req={REQ} value={code} disabled hint="Auto-generated" />
          <SelectInput label="Location Type" required change="new" req={REQ} value={f.type} options={LOCATION_TYPES} onChange={(v) => setF((x) => ({ ...x, type: v, supplierId: '' }))} error={errors.type}
            hint="A client project site is not a location, it is tracked in Movement History" />
          {held && <SelectInput label="Linked Supplier" required change="new" req={REQ} value={f.supplierId} options={sup.rows.map((s: any) => ({ value: s.id, label: s.name }))} onChange={set('supplierId')} error={errors.supplierId} hint="Supplier whose premises hold the business's own stock" />}
          <SelectInput label="Parent Location" value={f.parent} options={locs.rows.filter((l) => l.id !== existing?.id).map((l) => l.name)} onChange={set('parent')} />
          <TextInput label="Company" value={f.company} disabled />
          <CheckInput label="Inventory Available" checked={f.inventoryAvailable} onChange={set('inventoryAvailable')} />
          <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
        </FormGrid>
        {held && (
          <FormSection title="Stock at this Location" change="new" req={REQ}>
            <FormGrid cols={3}>
              <TextInput label="Stock Held" value={fmtQty(existing?.stockHeld)} disabled hint="Calculated by the system" />
              <TextInput label="Consumption" value={fmtQty(existing?.consumed)} disabled hint="Calculated by the system" />
              <TextInput label="Remaining Value" value={existing?.remainingValue === undefined ? '-' : aed(existing.remainingValue)} disabled hint="Calculated by the system" />
            </FormGrid>
          </FormSection>
        )}
        <FormSection title="Address">
          <FormGrid>
            <TextInput label="Address" value={f.address1} onChange={set('address1')} full />
            <TextInput label="Zipcode" value={f.zipcode} onChange={set('zipcode')} />
            <SelectInput label="Country" value={f.country} options={['United Arab Emirates']} onChange={set('country')} />
            <SelectInput label="State" value={f.state} options={STATES} onChange={set('state')} />
            <TextInput label="City" value={f.city} onChange={set('city')} />
            <TextInput label="Summary" value={f.summary} onChange={set('summary')} multiline rows={2} full />
          </FormGrid>
        </FormSection>
      </Page>
    </>
  );
}

export function LocationView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const locs = useLocs();
  const sup = useCollection('suppliers', suppliers);
  const r = locs.get(id);
  if (!r) return <Page><PageTitle title="Location not found" right={<Button variant="outlined" onClick={() => nav('/inventory/locations')}>Back to Location</Button>} /></Page>;
  const held = r.type === 'Supplier-Held Location';
  const status = r.status ?? 'Active';
  return (
    <>
      <FormHeader crumbs={[{ label: 'Location', to: '/inventory/locations' }, { label: r.code }]} status={<StatusChip status={status} />}
        actions={<><Button variant="outlined" onClick={() => { locs.update(r.id, { status: status === 'Active' ? 'Inactive' : 'Active' }); toast('Status updated'); }}>{status === 'Active' ? 'Deactivate' : 'Activate'}</Button><Button variant="contained" onClick={() => nav(`/inventory/locations/${r.id}/edit`)}>Edit</Button></>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Name" value={r.name} />
          <ValueField label="Short Name" value={r.shortName} />
          <ValueField label="Location Code" value={r.code} change="new" req={REQ} />
          <ValueField label="Location Type" value={r.type} change="new" req={REQ} />
          {held && <ValueField label="Linked Supplier" value={(sup.rows as any[]).find((s) => s.id === r.supplierId)?.name} change="new" req={REQ} />}
          <ValueField label="Parent Location" value={r.parent} />
          <ValueField label="Company" value={r.company} />
          <ValueField label="Inventory Available" value={r.inventoryAvailable ? 'Yes' : 'No'} />
          <ValueField label="Address" value={r.address1} />
          <ValueField label="City" value={r.city} />
          <ValueField label="State" value={r.state} />
          <ValueField label="Country" value={r.country} />
          <ValueField label="Summary" value={r.summary} />
        </ValueGrid>
        {held && (
          <Panel title="Stock at this Location" change="new" req={REQ} sx={{ mt: 3 }}>
            <ValueGrid cols={4}>
              <ValueField label="Stock Held" value={fmtQty(r.stockHeld)} />
              <ValueField label="Consumption" value={fmtQty(r.consumed)} />
              <ValueField label="Remaining Stock" value={r.stockHeld !== undefined ? fmtQty(r.stockHeld - (r.consumed ?? 0)) : undefined} />
              <ValueField label="Remaining Value" value={r.remainingValue === undefined ? undefined : aed(r.remainingValue)} />
            </ValueGrid>
          </Panel>
        )}
      </Page>
    </>
  );
}
