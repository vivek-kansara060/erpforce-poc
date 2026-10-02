import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { FormGrid, FormSection, NumberInput, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { Panel } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { ATTRIBUTE_TYPES, BRANDS, DEPRECIATION_METHODS, categoryOptions, categorySeed, isTopCategory, subCategoriesOf, type AttributeDef, type CategoryRec } from './data';
import { AddableSelect, QuickAddDialog, type Errors } from './shared';

const REQ_CAT = 'Category & Sub-Category Master';
const REQ_SIMPLE = 'Category & Sub-Category Master (2 Oct call: separate Category and Sub-Category masters, no Level or Category Type)';
const CAT_BASE = '/inventory/categories';
const SUB_BASE = '/inventory/sub-categories';
const useCats = () => useCollection<CategoryRec>('inventory.categories', categorySeed);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* ------------------------------------------------------------------ dropdowns with "+ Add" (used by the item, asset and pricing forms) */
export function CategorySelect({ value, onChange, error, disabled, hint, label = 'Category', required = true, change = 'new', req = REQ_CAT }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; hint?: string; label?: string; required?: boolean; change?: 'new' | 'changed'; req?: string }) {
  const cats = useCats();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddableSelect label={label} required={required} change={change} req={req} value={value} options={categoryOptions(cats.rows, value)} onChange={onChange} disabled={disabled} error={error} hint={hint} onAdd={() => setOpen(true)} />
      <QuickAddDialog open={open} title="Add Category" label="Category Name" onClose={() => setOpen(false)}
        onSave={(name) => {
          if (cats.rows.some((c) => isTopCategory(c) && same(c.name, name))) return 'A category with this name already exists';
          cats.add({ id: `cat${Date.now()}`, name, parent: '-', status: 'Active', uniqueItems: 1, attributes: [] });
          onChange(name);
          toast(`Category ${name} added`);
          return undefined;
        }} />
    </>
  );
}

export function SubCategorySelect({ category, value, onChange, disabled, error, label = 'Sub-Category', change = 'new', req = REQ_CAT }: { category: string; value: string; onChange: (v: string) => void; disabled?: boolean; error?: string; label?: string; change?: 'new' | 'changed'; req?: string }) {
  const cats = useCats();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const subs = subCategoriesOf(cats.rows, category);
  const options = value && !subs.includes(value) ? [...subs, value] : subs;
  return (
    <>
      <AddableSelect label={label} change={change} req={req} value={value} options={options} onChange={onChange} disabled={disabled || !category} error={error}
        hint={!category ? 'Select a Category first' : subs.length === 0 ? 'No sub-categories yet, use + Add' : 'Optional, depends on Category'} onAdd={() => setOpen(true)} />
      <QuickAddDialog open={open} title="Add Sub-Category" label="Sub-Category Name" context={`Under Category: ${category}`} onClose={() => setOpen(false)}
        onSave={(name) => {
          if (cats.rows.some((c) => c.parent === category && same(c.name, name))) return `A sub-category with this name already exists under ${category}`;
          cats.add({ id: `cat${Date.now()}`, name, parent: category, status: 'Active', uniqueItems: 1, attributes: [] });
          onChange(name);
          toast(`Sub-Category ${name} added under ${category}`);
          return undefined;
        }} />
    </>
  );
}

/* ------------------------------------------------------------------ attributes editor (shared by both forms) */
function AttributesEditor({ attributes, onChange, error, req }: { attributes: AttributeDef[]; onChange: (a: AttributeDef[]) => void; error?: string; req: string }) {
  const setAttr = (i: number, p: Partial<AttributeDef>) => onChange(attributes.map((a, n) => (n === i ? { ...a, ...p } : a)));
  return (
    <FormSection title="Attributes" change="changed" req={req} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onChange([...attributes, { id: `at${Date.now()}`, name: '', type: 'Text', options: '', required: false }])}>Add Attribute</Button>}>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Attributes defined here become extra fields on every item in this category, without a code change.</Text>
      {attributes.length === 0 && <Text type="s5" color="theme.secondary.700">No attributes added</Text>}
      {error && <Text type="s5" color="#C64D4D" sx={{ mb: 1 }}>{error}</Text>}
      {attributes.map((a, i) => (
        <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr auto 40px', gap: 2, alignItems: 'end', mb: 1.5 }}>
          <TextInput label="Attribute Name" value={a.name} onChange={(v) => setAttr(i, { name: v })} />
          <SelectInput label="Field Type" value={a.type} options={ATTRIBUTE_TYPES} onChange={(v) => setAttr(i, { type: v })} />
          <TextInput label="Values" value={a.options} disabled={a.type !== 'Picklist'} placeholder={a.type === 'Picklist' ? 'Comma separated' : 'Not applicable'} onChange={(v) => setAttr(i, { options: v })} />
          <FormControlLabel sx={{ mb: 0.5 }} control={<Checkbox size="small" checked={a.required} onChange={(e) => setAttr(i, { required: e.target.checked })} />} label={<Text type="s3">Required</Text>} />
          <IconButton size="small" sx={{ mb: 0.5 }} onClick={() => onChange(attributes.filter((_, n) => n !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
    </FormSection>
  );
}
const attributeError = (attributes: AttributeDef[]) =>
  attributes.some((a) => !a.name.trim()) ? 'Every attribute needs a name' : attributes.some((a) => a.type === 'Picklist' && !a.options.trim()) ? 'Picklist attributes need at least one value' : undefined;

function AttributesTable({ attributes }: { attributes: AttributeDef[] }) {
  return (
    <Panel title="Attributes" change="changed" req={`${REQ_CAT} > Custom Attributes`} sx={{ mt: 3 }}>
      {attributes.length === 0 ? <Text type="s5" color="theme.secondary.700">No attributes defined</Text> : (
        <DataTable<AttributeDef> rows={attributes} hideToolbar columns={[
          { key: 'name', label: 'Attribute' }, { key: 'type', label: 'Field Type' }, { key: 'options', label: 'Values', render: (a) => a.options || '-' },
          { key: 'required', label: 'Required', change: 'new', req: `${REQ_CAT} > Custom Attributes`, render: (a) => (a.required ? 'Yes' : 'No') },
        ]} />
      )}
    </Panel>
  );
}

/* ================================================================== Category */
export function CategoryList() {
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const [del, setDel] = useState<CategoryRec | null>(null);
  const rows = cats.rows.filter(isTopCategory);
  return (
    <Page>
      <PageTitle title="Item Category" subtitle="Categories such as Generator or Cable. Sizes and types such as 100 KVA are kept in Item Sub-Category." change="changed" req={REQ_SIMPLE} />
      <DataTable<CategoryRec>
        rows={rows} searchPlaceholder="Search categories..." pageSize={12}
        onAdd={() => nav(`${CAT_BASE}/add`)} addLabel="Add Category" onRowClick={(r) => nav(`${CAT_BASE}/${r.id}`)}
        columns={[
          { key: 'name', label: 'Category Name' },
          { key: 'sub', label: 'Sub-Categories', sortable: false, align: 'right', render: (r) => cats.rows.filter((c) => c.parent === r.name).length },
          { key: 'description', label: 'Description', render: (r) => r.description || '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`${CAT_BASE}/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${CAT_BASE}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete category" description={`Delete ${del?.name} and its sub-categories? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={() => { if (del) { cats.replace(cats.rows.filter((c) => c.id !== del.id && c.parent !== del.name)); toast('Category deleted'); } }} />
    </Page>
  );
}

export function CategoryForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const existing = id ? cats.get(id) : undefined;
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '', brand: existing?.brand ?? '', description: existing?.description ?? '', skuPrefix: existing?.skuPrefix ?? '',
    uniqueItems: String(existing?.uniqueItems ?? 1), active: existing ? existing.status === 'Active' : true, depMethod: existing?.depMethod ?? '', attributes: existing?.attributes ?? ([] as AttributeDef[]),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const skuPreview = f.skuPrefix && Number.isInteger(Number(f.uniqueItems || 1)) ? `${f.skuPrefix}-${String(Number(f.uniqueItems || 1)).padStart(5, '0')}` : '-';
  const save = () => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = 'Category Name is required';
    else if (cats.rows.some((c) => isTopCategory(c) && same(c.name, f.name) && c.id !== existing?.id)) e.name = 'A category with this name already exists';
    const ae = attributeError(f.attributes);
    if (ae) e.attributes = ae;
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: CategoryRec = { id: existing?.id ?? `cat${Date.now()}`, name: f.name.trim(), parent: '-', status: f.active ? 'Active' : 'Inactive', brand: f.brand || undefined, description: f.description || undefined, skuPrefix: f.skuPrefix || undefined, uniqueItems: Number(f.uniqueItems) || 1, attributes: f.attributes, depMethod: f.depMethod || undefined };
    // Renaming a category keeps its sub-categories attached to it.
    if (existing) cats.replace(cats.rows.map((c) => (c.id === rec.id ? rec : c.parent === existing.name ? { ...c, parent: rec.name } : c)));
    else cats.add(rec);
    toast(existing ? 'Category updated' : 'Category created');
    nav(`${CAT_BASE}/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Item Category', to: CAT_BASE }, { label: existing ? `Edit ${existing.name}` : 'Add Category' }]}
        actions={<><Button variant="outlined" onClick={() => nav(CAT_BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            <TextInput label="Category Name" required value={f.name} onChange={set('name')} error={errors.name} />
            <SelectInput label="Brand" value={f.brand} options={BRANDS} onChange={set('brand')} />
            <TextInput label="Description" value={f.description} onChange={set('description')} full multiline rows={2} />
            <TextInput label="SKU Prefix" value={f.skuPrefix} onChange={set('skuPrefix')} />
            <NumberInput label="Unique Items" value={f.uniqueItems} onChange={set('uniqueItems')} />
            <ToggleInput label="Status" checked={f.active} onChange={set('active')} change="changed" req={`${REQ_CAT} > Active / Inactive`} />
            <SelectInput label="Depreciation Method Override" change="new" req="Depreciation & Valuation > Method Override (per Category)" value={f.depMethod} options={DEPRECIATION_METHODS} onChange={set('depMethod')} hint="Optional, overrides the system default (Straight line) for this category" />
          </FormGrid>
          <Box sx={{ mt: 2 }}>
            <Text type="s4" weight="medium" color="theme.secondary.700">SKU Preview</Text>
            <Text type="s4">{skuPreview}</Text>
          </Box>
          <AttributesEditor attributes={f.attributes} onChange={set('attributes')} error={errors.attributes} req={`${REQ_CAT} > Custom Attributes`} />
        </Box>
      </Page>
    </>
  );
}

export function CategoryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const r = cats.get(id);
  const [del, setDel] = useState(false);
  if (!r || !isTopCategory(r)) return <Page><PageTitle title="Category not found" right={<Button variant="outlined" onClick={() => nav(CAT_BASE)}>Back to Item Category</Button>} /></Page>;
  const subs = cats.rows.filter((c) => c.parent === r.name);
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Item Category', to: CAT_BASE }, { label: r.name }]}
        status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="outlined" onClick={() => { cats.update(r.id, { status: flip }); toast(`Category marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          <Button variant="contained" onClick={() => nav(`${CAT_BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Category Name" value={r.name} />
          <ValueField label="Brand" value={r.brand} />
          <ValueField label="Description" value={r.description} />
          <ValueField label="SKU Prefix" value={r.skuPrefix} />
          <ValueField label="Unique Items" value={r.uniqueItems === undefined ? undefined : String(r.uniqueItems)} />
          <ValueField label="Status" value={<StatusChip status={r.status} />} />
          <ValueField label="Depreciation Method Override" value={r.depMethod} change="new" req="Depreciation & Valuation > Method Override (per Category)" />
        </ValueGrid>
        <Panel title="Sub-Categories" change="changed" req={REQ_SIMPLE} sx={{ mt: 3 }} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => nav(`${SUB_BASE}/add?category=${encodeURIComponent(r.name)}`)}>Add Sub-Category</Button>}>
          {subs.length === 0 ? <Text type="s5" color="theme.secondary.700">No sub-categories yet</Text> : (
            <DataTable<CategoryRec> rows={subs} hideToolbar onRowClick={(s) => nav(`${SUB_BASE}/${s.id}`)} columns={[
              { key: 'name', label: 'Sub-Category Name' }, { key: 'status', label: 'Status', render: (s) => <StatusChip status={s.status} /> },
            ]} />
          )}
        </Panel>
        <AttributesTable attributes={r.attributes} />
      </Page>
      <ConfirmDialog open={del} danger title="Delete category" description={`Delete ${r.name} and its sub-categories? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { cats.replace(cats.rows.filter((c) => c.id !== r.id && c.parent !== r.name)); toast('Category deleted'); nav(CAT_BASE); }} />
    </>
  );
}

/* ================================================================== Sub-Category */
export function SubCategoryList() {
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const [del, setDel] = useState<CategoryRec | null>(null);
  const rows = cats.rows.filter((c) => !isTopCategory(c));
  const parents = Array.from(new Set(rows.map((r) => r.parent)));
  return (
    <Page>
      <PageTitle title="Item Sub-Category" subtitle="Each sub-category belongs to one category, for example Generator > 100 KVA." change="new" req={REQ_SIMPLE} />
      <DataTable<CategoryRec>
        rows={rows} searchPlaceholder="Search sub-categories..." pageSize={12} filter={{ key: 'parent', options: parents, label: 'Category' }}
        onAdd={() => nav(`${SUB_BASE}/add`)} addLabel="Add Sub-Category" onRowClick={(r) => nav(`${SUB_BASE}/${r.id}`)}
        columns={[
          { key: 'name', label: 'Sub-Category Name' },
          { key: 'parent', label: 'Category' },
          { key: 'description', label: 'Description', render: (r) => r.description || '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`${SUB_BASE}/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${SUB_BASE}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete sub-category" description={`Delete ${del?.name} under ${del?.parent}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={() => { if (del) { cats.remove(del.id); toast('Sub-category deleted'); } }} />
    </Page>
  );
}

export function SubCategoryForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const existing = id ? cats.get(id) : undefined;
  const [f, setF] = useState(() => ({
    parent: existing && !isTopCategory(existing) ? existing.parent : params.get('category') ?? '', name: existing?.name ?? '', description: existing?.description ?? '', skuPrefix: existing?.skuPrefix ?? '',
    active: existing ? existing.status === 'Active' : true, attributes: existing?.attributes ?? ([] as AttributeDef[]),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const e: Errors = {};
    if (!f.parent) e.parent = 'Category is required';
    if (!f.name.trim()) e.name = 'Sub-Category Name is required';
    else if (f.parent && cats.rows.some((c) => c.parent === f.parent && same(c.name, f.name) && c.id !== existing?.id)) e.name = `A sub-category with this name already exists under ${f.parent}`;
    const ae = attributeError(f.attributes);
    if (ae) e.attributes = ae;
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: CategoryRec = { id: existing?.id ?? `cat${Date.now()}`, name: f.name.trim(), parent: f.parent, status: f.active ? 'Active' : 'Inactive', description: f.description || undefined, skuPrefix: f.skuPrefix || undefined, uniqueItems: existing?.uniqueItems ?? 1, attributes: f.attributes };
    if (existing) cats.update(rec.id, rec); else cats.add(rec);
    toast(existing ? 'Sub-category updated' : 'Sub-category created');
    nav(`${SUB_BASE}/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Item Sub-Category', to: SUB_BASE }, { label: existing ? `Edit ${existing.name}` : 'Add Sub-Category' }]}
        actions={<><Button variant="outlined" onClick={() => nav(SUB_BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            <CategorySelect value={f.parent} onChange={set('parent')} error={errors.parent} req={REQ_SIMPLE} hint="The category this sub-category belongs to" />
            <TextInput label="Sub-Category Name" required value={f.name} onChange={set('name')} error={errors.name} hint="e.g. 100 KVA, 4 Core 185 mm" />
            <TextInput label="Description" value={f.description} onChange={set('description')} full multiline rows={2} />
            <TextInput label="SKU Prefix" value={f.skuPrefix} onChange={set('skuPrefix')} />
            <ToggleInput label="Status" checked={f.active} onChange={set('active')} />
          </FormGrid>
          <AttributesEditor attributes={f.attributes} onChange={set('attributes')} error={errors.attributes} req={`${REQ_CAT} > Custom Attributes`} />
        </Box>
      </Page>
    </>
  );
}

export function SubCategoryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const r = cats.get(id);
  const [del, setDel] = useState(false);
  if (!r || isTopCategory(r)) return <Page><PageTitle title="Sub-category not found" right={<Button variant="outlined" onClick={() => nav(SUB_BASE)}>Back to Item Sub-Category</Button>} /></Page>;
  const parent = cats.rows.find((c) => isTopCategory(c) && c.name === r.parent);
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Item Sub-Category', to: SUB_BASE }, { label: `${r.parent} / ${r.name}` }]}
        status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="outlined" onClick={() => { cats.update(r.id, { status: flip }); toast(`Sub-category marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          <Button variant="contained" onClick={() => nav(`${SUB_BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Sub-Category Name" value={r.name} />
          <ValueField label="Category" value={parent ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`${CAT_BASE}/${parent.id}`)}>{r.parent}</Box> : r.parent} change="new" req={REQ_SIMPLE} />
          <ValueField label="Description" value={r.description} />
          <ValueField label="SKU Prefix" value={r.skuPrefix} />
          <ValueField label="Status" value={<StatusChip status={r.status} />} />
        </ValueGrid>
        <AttributesTable attributes={r.attributes} />
      </Page>
      <ConfirmDialog open={del} danger title="Delete sub-category" description={`Delete ${r.name} under ${r.parent}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { cats.remove(r.id); toast('Sub-category deleted'); nav(SUB_BASE); }} />
    </>
  );
}
