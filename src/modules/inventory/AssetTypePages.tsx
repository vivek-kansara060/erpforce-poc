import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FormGrid, TextInput, ToggleInput } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { useCollection } from '@/store/store';
import { assetTypeSeed, heavySeed, type AssetTypeRec, type HeavyRec } from './data';
import { AddableSelect, QuickAddDialog, type Errors } from './shared';

const REQ_AT = 'Asset Type Master (2 Oct call: client-specific asset types, not a fixed list)';
const BASE = '/inventory/asset-types';
export const useAssetTypes = () => useCollection<AssetTypeRec>('inventory.assetTypes', assetTypeSeed);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Asset Type dropdown with "+ Add" (used on the Heavy Equipment Fixed Asset form). */
export function AssetTypeSelect({ value, onChange, error, req = REQ_AT }: { value: string; onChange: (v: string) => void; error?: string; req?: string }) {
  const types = useAssetTypes();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const names = types.rows.filter((t) => t.status === 'Active').map((t) => t.name);
  const options = value && !names.includes(value) ? [...names, value] : names;
  return (
    <>
      <AddableSelect label="Asset Type" required change="new" req={req} value={value} options={options} onChange={onChange} error={error} onAdd={() => setOpen(true)} />
      <QuickAddDialog open={open} title="Add Asset Type" label="Asset Type Name" onClose={() => setOpen(false)}
        onSave={(name) => {
          if (types.rows.some((t) => same(t.name, name))) return 'An asset type with this name already exists';
          types.add({ id: `at${Date.now()}`, name, description: '', status: 'Active' });
          onChange(name);
          toast(`Asset Type ${name} added`);
          return undefined;
        }} />
    </>
  );
}

export function AssetTypeList() {
  const nav = useNavigate();
  const toast = useToast();
  const types = useAssetTypes();
  const heavy = useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
  const [del, setDel] = useState<AssetTypeRec | null>(null);
  const inUse = (name: string) => heavy.rows.filter((h) => h.assetType === name).length;
  return (
    <Page>
      <PageTitle title="Asset Type" subtitle="Client-specific asset types used on Heavy Equipment Fixed Assets." change="new" req={REQ_AT} />
      <DataTable<AssetTypeRec>
        rows={types.rows} searchPlaceholder="Search asset types..."
        onAdd={() => nav(`${BASE}/add`)} addLabel="Add Asset Type" onRowClick={(r) => nav(`${BASE}/${r.id}/edit`)}
        columns={[
          { key: 'name', label: 'Asset Type' },
          { key: 'description', label: 'Description', render: (r) => r.description || '-' },
          { key: 'used', label: 'Assets Using It', align: 'right', sortable: false, render: (r) => inUse(r.name) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]}
        actions={[
          { label: 'Edit', onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Deactivate', hidden: (r) => r.status === 'Inactive', onClick: (r) => { types.update(r.id, { status: 'Inactive' }); toast(`${r.name} marked Inactive`); } },
          { label: 'Activate', hidden: (r) => r.status === 'Active', onClick: (r) => { types.update(r.id, { status: 'Active' }); toast(`${r.name} marked Active`); } },
          { label: 'Delete', danger: true, onClick: (r) => (inUse(r.name) ? toast(`${r.name} is used by ${inUse(r.name)} asset(s). Deactivate it instead.`, 'error') : setDel(r)) },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete asset type" description={`Delete ${del?.name}? This cannot be undone.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { types.remove(del.id); toast('Asset type deleted'); } }} />
    </Page>
  );
}

export function AssetTypeForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const types = useAssetTypes();
  const heavy = useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
  const existing = id ? types.get(id) : undefined;
  const [f, setF] = useState({ name: existing?.name ?? '', description: existing?.description ?? '', active: existing ? existing.status === 'Active' : true });
  const [errors, setErrors] = useState<Errors>({});
  if (id && !existing) return <Page><PageTitle title="Asset type not found" right={<Button variant="outlined" onClick={() => nav(BASE)}>Back to Asset Type</Button>} /></Page>;
  const save = () => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = 'Asset Type is required';
    else if (types.rows.some((t) => t.id !== existing?.id && same(t.name, f.name))) e.name = 'An asset type with this name already exists';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: AssetTypeRec = { id: existing?.id ?? `at${Date.now()}`, name: f.name.trim(), description: f.description.trim(), status: f.active ? 'Active' : 'Inactive' };
    if (existing) {
      types.update(rec.id, rec);
      // Renaming keeps the assets that use this type pointing at it.
      if (existing.name !== rec.name) heavy.replace(heavy.rows.map((h) => (h.assetType === existing.name ? { ...h, assetType: rec.name } : h)));
    } else types.add(rec);
    toast(existing ? 'Asset type updated' : 'Asset type created');
    nav(BASE);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Asset Type', to: BASE }, { label: existing ? `Edit ${existing.name}` : 'Add Asset Type' }]}
        actions={<><Button variant="outlined" onClick={() => nav(BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 900 }}>
          <FormGrid>
            <TextInput label="Asset Type" required change="new" req={REQ_AT} value={f.name} onChange={(v) => setF({ ...f, name: v })} error={errors.name} hint="e.g. Power Equipment, Vehicles" />
            <ToggleInput label="Status" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
            <TextInput label="Description" change="new" req={REQ_AT} value={f.description} onChange={(v) => setF({ ...f, description: v })} multiline rows={2} full />
          </FormGrid>
        </Box>
      </Page>
    </>
  );
}
