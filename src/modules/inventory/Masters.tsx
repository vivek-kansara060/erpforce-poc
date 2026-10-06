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
import { ATTRIBUTE_TYPES, brandSeed, DEPRECIATION_METHODS, categoryOptions, categorySeed, isTopCategory, subCategoriesOf, type AttributeDef, type BrandRec, type CategoryRec } from './data';
import { AddableSelect, QuickAddDialog, REQ_BRAND, type Errors } from './shared';
import { AppDialog } from '@/components/Dialogs';

const REQ_CAT = 'Category & Sub-Category Master';
const CAT_BASE = '/inventory/categories';
const SUB_BASE = '/inventory/sub-categories';
const baseOf = (r: Pick<CategoryRec, 'parent'>) => (isTopCategory(r) ? CAT_BASE : SUB_BASE);
const useCats = () => useCollection<CategoryRec>('inventory.categories', categorySeed);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* ------------------------------------------------------------------ dropdowns with "Create New" as their last row (used by the item, asset and pricing forms) */
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
        hint={!category ? 'Select a Category first' : subs.length === 0 ? 'No sub-categories yet, use Create New Sub-Category in the list' : 'Optional, depends on Category'} onAdd={() => setOpen(true)} />
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

/* ================================================================== Item Category and Item Sub-Category: two separate masters (5 Oct call) */
export function CategoryList({ sub = false }: { sub?: boolean }) {
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const [del, setDel] = useState<CategoryRec | null>(null);
  const base = sub ? SUB_BASE : CAT_BASE;
  const rows = cats.rows.filter((c) => (sub ? !isTopCategory(c) : isTopCategory(c)));
  return (
    <Page>
      <PageTitle title={sub ? 'Item Sub-Category' : 'Item Category'} subtitle={sub ? 'Sub-categories, each under a Category, for example 100 KVA under Generator. Brand is chosen on the asset, not here.' : 'Top-level categories such as Generator. Sub-categories have their own master.'} change="changed" req={REQ_CAT} />
      <DataTable<CategoryRec>
        rows={rows} searchPlaceholder={sub ? 'Search sub-categories...' : 'Search categories...'} pageSize={12}
        onAdd={() => nav(`${base}/add`)} addLabel={sub ? 'Add Sub-Category' : 'Add Category'} onRowClick={(r) => nav(`${base}/${r.id}`)}
        columns={[
          { key: 'name', label: sub ? 'Sub-Category Name' : 'Category Name' },
          ...(sub ? [{ key: 'parent', label: 'Category' }] : []),
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          ...(sub ? [] : [{ key: 'sub', label: 'Sub Categories', sortable: false, align: 'right' as const, render: (r: CategoryRec) => cats.rows.filter((c) => c.parent === r.name).length }]),
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`${base}/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${base}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete" description={`Delete ${del?.name}${del && isTopCategory(del) ? ' and its sub-categories' : ''}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={() => { if (del) { cats.replace(cats.rows.filter((c) => c.id !== del.id && !(isTopCategory(del) && c.parent === del.name))); toast('Deleted'); } }} />
    </Page>
  );
}
export const SubCategoryList = () => <CategoryList sub />;

export function CategoryForm({ sub: forceSub = false }: { sub?: boolean } = {}) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const existing = id ? cats.get(id) : undefined;
  const sub = forceSub || (!!existing && !isTopCategory(existing));
  const base = sub ? SUB_BASE : CAT_BASE;
  const [f, setF] = useState(() => ({
    parent: existing ? (isTopCategory(existing) ? '' : existing.parent) : params.get('parent') ?? '',
    name: existing?.name ?? '', brand: existing?.brand ?? '', description: existing?.description ?? '', skuPrefix: existing?.skuPrefix ?? '',
    uniqueItems: String(existing?.uniqueItems ?? 1), active: existing ? existing.status === 'Active' : true, depMethod: existing?.depMethod ?? '', attributes: existing?.attributes ?? ([] as AttributeDef[]),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const skuPreview = f.skuPrefix && Number.isInteger(Number(f.uniqueItems || 1)) ? `${f.skuPrefix}-${String(Number(f.uniqueItems || 1)).padStart(5, '0')}` : '-';
  // A category that already has sub-categories stays a top-level category.
  const hasChildren = !!existing && isTopCategory(existing) && cats.rows.some((c) => c.parent === existing.name);
  const parentOptions = cats.rows.filter((c) => isTopCategory(c) && c.id !== existing?.id && (c.status === 'Active' || c.name === f.parent)).map((c) => c.name);
  const save = () => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = sub ? 'Sub-Category Name is required' : 'Category Name is required';
    if (sub && !f.parent) e.parent = 'Select the Category this sub-category belongs to';
    else if (cats.rows.some((c) => c.id !== existing?.id && same(c.name, f.name) && (f.parent ? c.parent === f.parent : isTopCategory(c)))) e.name = f.parent ? `A sub-category with this name already exists under ${f.parent}` : 'A category with this name already exists';
    const ae = attributeError(f.attributes);
    if (ae) e.attributes = ae;
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: CategoryRec = { id: existing?.id ?? `cat${Date.now()}`, name: f.name.trim(), parent: f.parent || '-', status: f.active ? 'Active' : 'Inactive', brand: undefined, description: f.description || undefined, skuPrefix: f.skuPrefix || undefined, uniqueItems: Number(f.uniqueItems) || 1, attributes: f.attributes, depMethod: f.depMethod || undefined };
    // Renaming a category keeps its sub-categories attached to it.
    if (existing) cats.replace(cats.rows.map((c) => (c.id === rec.id ? rec : isTopCategory(existing) && c.parent === existing.name ? { ...c, parent: rec.name } : c)));
    else cats.add(rec);
    toast(existing ? 'Saved' : sub ? 'Sub-Category created' : 'Category created');
    nav(`${base}/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: sub ? 'Item Sub-Category' : 'Item Category', to: base }, { label: existing ? `Edit ${existing.name}` : sub ? 'Add Sub-Category' : 'Add Category' }]}
        actions={<><Button variant="outlined" onClick={() => nav(base)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            {sub
              ? <SelectInput label="Category" required value={f.parent} options={parentOptions} onChange={set('parent')} error={errors.parent} disabled={hasChildren} hint="The Category this sub-category belongs to" />
              : null}
            <TextInput label={sub ? 'Sub-Category Name' : 'Category Name'} required value={f.name} onChange={set('name')} error={errors.name} />
            <TextInput label="Description" value={f.description} onChange={set('description')} full multiline rows={2} />
            <TextInput label="SKU Prefix" value={f.skuPrefix} onChange={set('skuPrefix')} />
            <NumberInput label="Unique Items" value={f.uniqueItems} onChange={set('uniqueItems')} />
            <ToggleInput label="Status" checked={f.active} onChange={set('active')} change="changed" req={`${REQ_CAT} > Active / Inactive`} />
            {!sub && <SelectInput label="Depreciation Method Override" change="new" req="Depreciation & Valuation > Method Override (per Category)" value={f.depMethod} options={DEPRECIATION_METHODS} onChange={set('depMethod')} hint="Optional, overrides the system default (Straight line) for this category" />}
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
  if (!r) return <Page><PageTitle title="Category not found" right={<Button variant="outlined" onClick={() => nav(CAT_BASE)}>Back</Button>} /></Page>;
  const top = isTopCategory(r);
  const BASE = baseOf(r);
  const subs = cats.rows.filter((c) => top && c.parent === r.name);
  const parent = cats.rows.find((c) => isTopCategory(c) && c.name === r.parent);
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  return (
    <>
      <FormHeader
        crumbs={[{ label: top ? 'Item Category' : 'Item Sub-Category', to: BASE }, { label: top ? r.name : `${r.parent} / ${r.name}` }]}
        status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="outlined" onClick={() => { cats.update(r.id, { status: flip }); toast(`Category marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          <Button variant="contained" onClick={() => nav(`${BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Category" value={top ? undefined : parent ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`${CAT_BASE}/${parent.id}`)}>{r.parent}</Box> : r.parent} />
          <ValueField label={top ? 'Category Name' : 'Sub-Category Name'} value={r.name} />
          <ValueField label="Description" value={r.description} />
          <ValueField label="SKU Prefix" value={r.skuPrefix} />
          <ValueField label="Unique Items" value={r.uniqueItems === undefined ? undefined : String(r.uniqueItems)} />
          <ValueField label="Status" value={<StatusChip status={r.status} />} />
          {top && <ValueField label="Depreciation Method Override" value={r.depMethod} change="new" req="Depreciation & Valuation > Method Override (per Category)" />}
          {top && <ValueField label="Sub Categories" value={subs.length ? subs.map((x) => x.name).join(', ') : undefined} />}
        </ValueGrid>
        {top && (
          <Panel title="Sub-Categories" sx={{ mt: 3 }} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => nav(`${SUB_BASE}/add?parent=${encodeURIComponent(r.name)}`)}>Add Sub-Category</Button>}>
            {subs.length === 0 ? <Text type="s5" color="theme.secondary.700">No sub-categories yet</Text> : (
              <DataTable<CategoryRec> rows={subs} hideToolbar onRowClick={(x) => nav(`${SUB_BASE}/${x.id}`)} columns={[
                { key: 'name', label: 'Sub-Category Name' }, { key: 'status', label: 'Status', render: (x) => <StatusChip status={x.status} /> },
              ]} />
            )}
          </Panel>
        )}
        <AttributesTable attributes={r.attributes} />
      </Page>
      <ConfirmDialog open={del} danger title="Delete category" description={`Delete ${r.name}${top ? ' and its sub-categories' : ''}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { cats.replace(cats.rows.filter((c) => c.id !== r.id && !(top && c.parent === r.name))); toast('Category deleted'); nav(BASE); }} />
    </>
  );
}

export const SubCategoryForm = () => <CategoryForm sub />;

/* ================================================================== Brand master */
const useBrands = () => useCollection<BrandRec>('inventory.brands', brandSeed);
export function BrandList() {
  const toast = useToast();
  const brands = useBrands();
  const [dlg, setDlg] = useState<{ id?: string; name: string } | null>(null);
  const [err, setErr] = useState<string>();
  const [del, setDel] = useState<BrandRec | null>(null);
  const save = () => {
    if (!dlg) return;
    const name = dlg.name.trim();
    if (!name) { setErr('Brand Name is required'); return; }
    if (brands.rows.some((b) => b.id !== dlg.id && b.name.toLowerCase() === name.toLowerCase())) { setErr('This brand already exists'); return; }
    if (dlg.id) brands.update(dlg.id, { name }); else brands.add({ id: `br${Date.now()}`, name, status: 'Active' });
    toast(dlg.id ? 'Brand updated' : 'Brand added');
    setDlg(null); setErr(undefined);
  };
  return (
    <Page>
      <PageTitle title="Brand" subtitle="One global list of brands, chosen on each fixed asset and item, so reports and filters never depend on spelling." change="new" req={REQ_BRAND} />
      <DataTable<BrandRec> rows={brands.rows} searchPlaceholder="Search brands..." onAdd={() => { setErr(undefined); setDlg({ name: '' }); }} addLabel="Add Brand"
        columns={[{ key: 'name', label: 'Brand' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }]}
        actions={[
          { label: 'Edit', onClick: (r) => { setErr(undefined); setDlg({ id: r.id, name: r.name }); } },
          { label: 'Mark Inactive / Active', onClick: (r) => brands.update(r.id, { status: r.status === 'Active' ? 'Inactive' : 'Active' }) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]} />
      <AppDialog open={!!dlg} title={dlg?.id ? 'Edit Brand' : 'Add Brand'} onClose={() => setDlg(null)} confirmLabel="Save" maxWidth="xs" onConfirm={save}>
        <TextInput label="Brand Name" required value={dlg?.name} onChange={(v) => { setDlg(dlg ? { ...dlg, name: v } : dlg); setErr(undefined); }} error={err} />
      </AppDialog>
      <ConfirmDialog open={!!del} danger title="Delete brand" description={`Delete ${del?.name}? Assets that already use it keep the name.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { brands.remove(del.id); toast('Brand deleted'); } }} />
    </Page>
  );
}
