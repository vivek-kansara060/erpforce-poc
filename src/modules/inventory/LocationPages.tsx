import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { CheckInput, FormGrid, FormSection, MultiSelectInput, NumberInput, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { Panel } from '@/components/Widgets';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { suppliers, systemUsers } from '@/mock-data/masters';
import { LOCATION_TYPES, itemSeed, locationSeed, locationStockSeed, qtyWithUnit, type ItemRec, type LocationRec, type LocationStock } from './data';
import { aed, requireFields, type Errors } from './shared';

const REQ = 'Location & Warehouse Master';
const REQ_SIMPLE = 'Location & Warehouse Master (2 Oct call: Parent Location, Company and address fields removed)';
const REQ_STOCK = 'Location & Warehouse Master > Stock Held, Consumption, Remaining (system-derived, with units)';
const useLocs = () => useCollection<LocationRec>('locations', locationSeed);
const SUPPLIER_HELD = 'Supplier-Held Location';
const EMPLOYEE = 'Employee';
const REQ_EMP = 'Location Type Employee (5 Oct call): a service van assigned to user accounts, stock drawn from it on AMC visits';
const userNames = (ids?: string[]) => (ids ?? []).map((id) => systemUsers.find((u) => u.id === id)?.name ?? id).join(', ');

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
          { key: 'users', label: 'Assigned Users', change: 'new', req: REQ_EMP, render: (r) => (r.type === EMPLOYEE ? userNames(r.userIds) : '-') },
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
  const [f, setF] = useState<Record<string, any>>(() => ({ name: existing?.name ?? '', shortName: existing?.shortName ?? '', type: existing?.type ?? '', supplierId: existing?.supplierId ?? '', userIds: existing?.userIds ?? [], inventoryAvailable: existing ? existing.inventoryAvailable : true, status: existing?.status ?? 'Active' }));
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const held = f.type === SUPPLIER_HELD;
  const emp = f.type === EMPLOYEE;
  const save = () => {
    const e = requireFields(f, ['name', 'type', ...(held ? ['supplierId'] : [])], { type: 'Location Type', supplierId: 'Linked Supplier' });
    if (emp && !f.userIds.length) e.userIds = 'Assign at least one user';
    if (!e.name && locs.rows.some((l) => l.id !== existing?.id && l.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A location with this name already exists';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: LocationRec = { id: existing?.id ?? `l${Date.now()}`, code, name: f.name.trim(), shortName: f.shortName.trim(), type: f.type, supplierId: held ? f.supplierId : undefined, userIds: emp ? f.userIds : undefined, inventoryAvailable: !!f.inventoryAvailable, status: f.status };
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
          <SelectInput label="Location Type" required change="new" req={REQ} value={f.type} options={LOCATION_TYPES} onChange={(v) => setF((x) => ({ ...x, type: v, supplierId: '', userIds: [] }))} error={errors.type}
            hint="A client project site is not a location, it is tracked in Movement History" />
          {held && <SelectInput label="Linked Supplier" required change="new" req={REQ} value={f.supplierId} options={sup.rows.map((s: any) => ({ value: s.id, label: s.name }))} onChange={set('supplierId')} error={errors.supplierId} hint="Supplier whose premises hold the business's own stock" />}
          {emp && <MultiSelectInput label="Assigned Users" required change="new" req={REQ_EMP} value={f.userIds} options={systemUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} onChange={set('userIds')} error={errors.userIds} hint="ERP user accounts who carry and use this stock, e.g. the technicians of a service van" />}
          <CheckInput label="Inventory Available" checked={f.inventoryAvailable} onChange={set('inventoryAvailable')} />
          <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
        </FormGrid>
        {held && !existing && <FormSection title="Stock at this Location" change="new" req={REQ_STOCK}><Text type="s5" color="theme.secondary.700">Stock held, consumption and remaining quantity are calculated by the system once stock is received at this location. They are not entered here.</Text></FormSection>}
        {existing && <LocationStockTable location={existing.name} supplierHeld={held} />}
      </Page>
    </>
  );
}

/**
 * Transfer stock in (5 Oct call): fill a service van from a yard. The existing ERP does this on its Stock Transfer screen;
 * here it is one action on the van so the whole story can be shown. Quantities move between the two locations' stock rows.
 */
function TransferInDialog({ to, onClose }: { to: LocationRec; onClose: () => void }) {
  const toast = useToast();
  const locs = useLocs();
  const items = useCollection<ItemRec>('items', itemSeed);
  const stock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const sources = locs.rows.filter((l) => l.status === 'Active' && l.type !== EMPLOYEE && l.id !== to.id).map((l) => l.name);
  const [from, setFrom] = useState(sources[0] ?? '');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const avail = stock.rows.filter((r) => r.location === from && r.qty > 0 && items.get(r.itemId)?.tracking !== 'Serialized');
  const row = avail.find((r) => r.itemId === itemId);
  const it = items.get(itemId);
  const confirm = () => {
    const e = requireFields({ from, itemId, qty }, ['from', 'itemId', 'qty'], { from: 'From Location', itemId: 'Item', qty: 'Quantity' });
    if (!e.qty && !(Number(qty) > 0)) e.qty = 'Must be greater than 0';
    if (!e.qty && row && Number(qty) > row.qty) e.qty = `Only ${qtyWithUnit(row.qty, it?.unit ?? 'Nos')} at ${from}`;
    setErrors(e);
    if (Object.keys(e).length || !row) return;
    const q = Number(qty);
    const dest = stock.rows.find((r) => r.location === to.name && r.itemId === itemId);
    stock.replace([
      ...stock.rows.map((r) => (r.id === row.id ? { ...r, qty: r.qty - q } : dest && r.id === dest.id ? { ...r, qty: r.qty + q } : r)),
      ...(dest ? [] : [{ id: `ls-${itemId}-${to.id}-${Date.now()}`, itemId, location: to.name, qty: q }]),
    ]);
    toast(`${qtyWithUnit(q, it?.unit ?? 'Nos')} ${it?.name} moved from ${from} to ${to.name}`);
    onClose();
  };
  return (
    <AppDialog open title={`Transfer stock in: ${to.name}`} onClose={onClose} confirmLabel="Transfer" onConfirm={confirm}>
      <FormGrid>
        <SelectInput label="From Location" required value={from} options={sources} onChange={(v) => { setFrom(v); setItemId(''); }} error={errors.from} />
        <SelectInput label="Item" required value={itemId} options={avail.map((r) => ({ value: r.itemId, label: `${items.get(r.itemId)?.name} (${qtyWithUnit(r.qty, items.get(r.itemId)?.unit ?? 'Nos')} available)` }))} onChange={setItemId} error={errors.itemId} />
        <NumberInput label={`Quantity${it ? ` (${it.unit})` : ''}`} required value={qty} onChange={setQty} error={errors.qty} />
      </FormGrid>
    </AppDialog>
  );
}

export function LocationView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const locs = useLocs();
  const sup = useCollection('suppliers', suppliers);
  const r = locs.get(id);
  const [transfer, setTransfer] = useState(false);
  if (!r) return <Page><PageTitle title="Location not found" right={<Button variant="outlined" onClick={() => nav('/inventory/locations')}>Back to Location</Button>} /></Page>;
  const held = r.type === SUPPLIER_HELD;
  const status = r.status ?? 'Active';
  return (
    <>
      <FormHeader crumbs={[{ label: 'Location', to: '/inventory/locations' }, { label: r.code }]} status={<StatusChip status={status} />}
        actions={<>{r.type === EMPLOYEE && status === 'Active' && <Button variant="outlined" onClick={() => setTransfer(true)}>Transfer stock in</Button>}<Button variant="outlined" onClick={() => { locs.update(r.id, { status: status === 'Active' ? 'Inactive' : 'Active' }); toast('Status updated'); }}>{status === 'Active' ? 'Deactivate' : 'Activate'}</Button><Button variant="contained" onClick={() => nav(`/inventory/locations/${r.id}/edit`)}>Edit</Button></>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Name" value={r.name} />
          <ValueField label="Short Name" value={r.shortName} />
          <ValueField label="Location Code" value={r.code} change="new" req={REQ} />
          <ValueField label="Location Type" value={r.type} change="new" req={REQ} />
          {held && <ValueField label="Linked Supplier" value={(sup.rows as any[]).find((s) => s.id === r.supplierId)?.name} change="new" req={REQ} />}
          {r.type === EMPLOYEE && <ValueField label="Assigned Users" value={userNames(r.userIds)} change="new" req={REQ_EMP} />}
          <ValueField label="Inventory Available" value={r.inventoryAvailable ? 'Yes' : 'No'} />
        </ValueGrid>
        <LocationStockTable location={r.name} supplierHeld={held} />
        {transfer && <TransferInDialog to={r} onClose={() => setTransfer(false)} />}
      </Page>
    </>
  );
}
