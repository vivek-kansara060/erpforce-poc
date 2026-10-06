import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { CheckInput, FormGrid, FormSection, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { Panel } from '@/components/Widgets';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { suppliers } from '@/mock-data/masters';
import { LOCATION_TYPES, itemSeed, locationSeed, locationStockSeed, qtyWithUnit, type ItemRec, type LocationRec, type LocationStock } from './data';
import { aed, requireFields, type Errors } from './shared';

const REQ = 'Location & Warehouse Master';
const REQ_SIMPLE = 'Location & Warehouse Master (2 Oct call: Parent Location, Company and address fields removed)';
const REQ_STOCK = 'Location & Warehouse Master > Stock Held, Consumption, Remaining (system-derived, with units)';
const useLocs = () => useCollection<LocationRec>('locations', locationSeed);
const SUPPLIER_HELD = 'Supplier-Held Location';

/** Read-only stock at one location, per item and always with its unit. Supplier-Held Locations also show what was consumed. */
function LocationStockTable({ location, supplierHeld }: { location: string; supplierHeld: boolean }) {
  const items = useCollection<ItemRec>('items', itemSeed);
  const stock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const rows = stock.rows.filter((r) => r.location === location).flatMap((r) => {
    const it = items.get(r.itemId);
    if (!it) return [];
    const consumed = r.consumed ?? 0;
    return [{ id: r.id, item: `${it.code} - ${it.name}`, held: qtyWithUnit(r.qty + consumed, it.unit), consumed: qtyWithUnit(consumed, it.unit), remaining: qtyWithUnit(r.qty, it.unit), value: aed(r.qty * it.price) }];
  });
  return (
    <Panel title={supplierHeld ? 'Stock, Consumption and Remaining at this Location' : 'Stock at this Location'} change="new" req={REQ_STOCK} sx={{ mt: 3 }}>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>Calculated by the system from receipts, deliveries and counts. These figures cannot be edited here.</Text>
      <DataTable hideToolbar rows={rows} pageSize={50} emptyText="No stock held at this location" columns={supplierHeld ? [
        { key: 'item', label: 'Item' }, { key: 'held', label: 'Stock Held', align: 'right' }, { key: 'consumed', label: 'Consumed', align: 'right' },
        { key: 'remaining', label: 'Remaining', align: 'right' }, { key: 'value', label: 'Remaining Value', align: 'right' },
      ] : [
        { key: 'item', label: 'Item' }, { key: 'remaining', label: 'Quantity on Hand', align: 'right' }, { key: 'value', label: 'Value', align: 'right' },
      ]} />
    </Panel>
  );
}

export function LocationList() {
  const nav = useNavigate();
  const toast = useToast();
  const locs = useLocs();
  const [del, setDel] = useState<LocationRec | null>(null);
  return (
    <Page>
      <PageTitle title="Location" />
      <DataTable<LocationRec>
        rows={locs.rows} searchPlaceholder="Search locations..." filter={{ key: 'type', options: LOCATION_TYPES }}
        onAdd={() => nav('/inventory/locations/add')} addLabel="Add Location" onRowClick={(r) => nav(`/inventory/locations/${r.id}`)}
        columns={[
          { key: 'code', label: 'Location Code', change: 'new', req: REQ },
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Location Type', change: 'new', req: REQ },
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
  const [f, setF] = useState<Record<string, any>>(() => ({ name: existing?.name ?? '', shortName: existing?.shortName ?? '', type: existing?.type ?? '', supplierId: existing?.supplierId ?? '', inventoryAvailable: existing ? existing.inventoryAvailable : true, status: existing?.status ?? 'Active' }));
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const held = f.type === SUPPLIER_HELD;
  const save = () => {
    const e = requireFields(f, ['name', 'type', ...(held ? ['supplierId'] : [])], { type: 'Location Type', supplierId: 'Linked Supplier' });
    if (!e.name && locs.rows.some((l) => l.id !== existing?.id && l.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A location with this name already exists';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: LocationRec = { id: existing?.id ?? `l${Date.now()}`, code, name: f.name.trim(), shortName: f.shortName.trim(), type: f.type, supplierId: held ? f.supplierId : undefined, inventoryAvailable: !!f.inventoryAvailable, status: f.status };
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
          <SelectInput label="Location Type" required change="new" req={REQ} value={f.type} options={LOCATION_TYPES} onChange={(v) => setF((x) => ({ ...x, type: v, supplierId: '' }))} error={errors.type}
            hint="A client project site is not a location, it is tracked in Movement History" />
          {held && <SelectInput label="Linked Supplier" required change="new" req={REQ} value={f.supplierId} options={sup.rows.map((s: any) => ({ value: s.id, label: s.name }))} onChange={set('supplierId')} error={errors.supplierId} hint="Supplier whose premises hold the business's own stock" />}
          <CheckInput label="Inventory Available" checked={f.inventoryAvailable} onChange={set('inventoryAvailable')} />
          <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
        </FormGrid>
        {held && !existing && <FormSection title="Stock at this Location" change="new" req={REQ_STOCK}><Text type="s5" color="theme.secondary.700">Stock held, consumption and remaining quantity are calculated by the system once stock is received at this location. They are not entered here.</Text></FormSection>}
        {existing && <LocationStockTable location={existing.name} supplierHeld={held} />}
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
  const held = r.type === SUPPLIER_HELD;
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
          <ValueField label="Inventory Available" value={r.inventoryAvailable ? 'Yes' : 'No'} />
        </ValueGrid>
        <LocationStockTable location={r.name} supplierHeld={held} />
      </Page>
    </>
  );
}
