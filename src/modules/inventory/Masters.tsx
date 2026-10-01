import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ATTRIBUTE_TYPES, BRANDS, CATEGORY_TYPES, DEPRECIATION_METHODS, FREQUENCIES, categorySeed, categoryTypeOf, pricingSeed, subCategoriesOf, topCategories, type AttributeDef, type CategoryRec, type CategoryType, type PricingRec } from './data';
import { aed, isBlank, type Errors } from './shared';

const REQ_PRICING = 'Heavy Equipment Pricing > Category / Sub-Category Pricing';
const REQ_CAT = 'Category & Sub-Category Master';
const REQ_CAT_TYPE = 'Category & Sub-Category Master > Category Type (Normal / Heavy Equipment)';
const useCats = () => useCollection<CategoryRec>('inventory.categories', categorySeed);

/* ------------------------------------------------------------------ Item Category list (existing columns and actions) */
export function CategoryList() {
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const [del, setDel] = useState<CategoryRec | null>(null);
  return (
    <Page>
      <PageTitle title="Item Category" />
      <DataTable<CategoryRec>
        rows={cats.rows} searchPlaceholder="Search categories..." pageSize={12} filter={{ key: 'categoryType', options: [...CATEGORY_TYPES] }}
        onAdd={() => nav('/inventory/categories/add')} addLabel="Add Category" onRowClick={(r) => nav(`/inventory/categories/${r.id}`)}
        columns={[
          { key: 'name', label: 'Category Name' },
          { key: 'parent', label: 'Parent' },
          { key: 'categoryType', label: 'Category Type', change: 'new', req: REQ_CAT_TYPE, render: (r) => categoryTypeOf(r) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          { key: 'level', label: 'Level', align: 'right' },
          { key: 'sub', label: 'Sub Categories', sortable: false, align: 'right', render: (r) => (r.level === 1 ? cats.rows.filter((c) => c.parent === r.name).length : 0) },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`/inventory/categories/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`/inventory/categories/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete category" description={`Delete ${del?.name}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={() => { if (del) { cats.replace(cats.rows.filter((c) => c.id !== del.id && c.parent !== del.name)); toast('Category deleted'); } }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ Item Category form */
export function CategoryForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const existing = id ? cats.get(id) : undefined;
  const [f, setF] = useState(() => ({
    categoryType: (existing ? categoryTypeOf(existing) : 'Normal') as string,
    parent: existing && existing.parent !== '-' ? existing.parent : '', name: existing?.name ?? '', brand: existing?.brand ?? '', description: existing?.description ?? '', skuPrefix: existing?.skuPrefix ?? '',
    uniqueItems: String(existing?.uniqueItems ?? 1), active: existing ? existing.status === 'Active' : true, depMethod: existing?.depMethod ?? '', attributes: existing?.attributes ?? ([] as AttributeDef[]),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const level = f.parent ? 2 : 1;
  // A sub-category always follows its parent category's type.
  const parentRec = cats.rows.find((c) => c.level === 1 && c.name === f.parent);
  const effectiveType = (parentRec ? categoryTypeOf(parentRec) : f.categoryType) as CategoryType;
  const skuPreview = f.skuPrefix && Number.isInteger(Number(f.uniqueItems || 1)) ? `${f.skuPrefix}-${String(Number(f.uniqueItems || 1)).padStart(5, '0')}` : '-';
  const setAttr = (i: number, p: Partial<AttributeDef>) => set('attributes')(f.attributes.map((a, n) => (n === i ? { ...a, ...p } : a)));

  const save = () => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = 'Category Name is required';
    else if (cats.rows.some((c) => c.name.toLowerCase() === f.name.trim().toLowerCase() && c.id !== existing?.id)) e.name = 'A category with this name already exists';
    if (f.attributes.some((a) => !a.name.trim())) e.attributes = 'Every attribute needs a name';
    else if (f.attributes.some((a) => a.type === 'Picklist' && !a.options.trim())) e.attributes = 'Picklist attributes need at least one value';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: CategoryRec = { id: existing?.id ?? `cat${Date.now()}`, name: f.name.trim(), parent: f.parent || '-', level, categoryType: effectiveType, status: f.active ? 'Active' : 'Inactive', brand: f.brand || undefined, description: f.description || undefined, skuPrefix: f.skuPrefix || undefined, uniqueItems: Number(f.uniqueItems) || 1, attributes: f.attributes, depMethod: f.depMethod || undefined };
    if (existing) {
      cats.replace(cats.rows.map((c) => (c.id === rec.id ? rec : c.parent === existing.name ? { ...c, parent: rec.name, categoryType: rec.categoryType } : c)));
    } else cats.add(rec);
    toast(existing ? 'Category updated' : 'Category created');
    nav('/inventory/categories');
  };

  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Item Category', to: '/inventory/categories' }, { label: existing ? `Edit ${existing.name}` : 'Add Category' }]}
        actions={<><Button variant="outlined" onClick={() => nav('/inventory/categories')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            <SelectInput label="Parent Category" value={f.parent} options={topCategories(cats.rows).filter((c) => c !== existing?.name)} onChange={set('parent')} hint="Leave empty for a top-level category, select one to create a Sub-Category" />
            <TextInput label="Level" value={String(level)} disabled />
            <SelectInput label="Category Type" required change="new" req={REQ_CAT_TYPE} value={effectiveType} options={[...CATEGORY_TYPES]} disabled={!!f.parent} onChange={set('categoryType')}
              hint={f.parent ? 'A sub-category follows its parent category' : 'Heavy Equipment categories are offered in the Heavy Equipment Fixed Asset form, Normal categories in the standard Item form. Rule to be confirmed with client'} />
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
          <FormSection title="Attributes" change="changed" req={`${REQ_CAT} > Custom Attributes`} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => set('attributes')([...f.attributes, { id: `at${Date.now()}`, name: '', type: 'Text', options: '', required: false }])}>Add Attribute</Button>}>
            <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Attributes defined here become extra fields on every item in this category, without a code change.</Text>
            {f.attributes.length === 0 && <Text type="s5" color="theme.secondary.700">No attributes added</Text>}
            {errors.attributes && <Text type="s5" color="#C64D4D" sx={{ mb: 1 }}>{errors.attributes}</Text>}
            {f.attributes.map((a, i) => (
              <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr auto 40px', gap: 2, alignItems: 'end', mb: 1.5 }}>
                <TextInput label="Attribute Name" value={a.name} onChange={(v) => setAttr(i, { name: v })} />
                <SelectInput label="Field Type" value={a.type} options={ATTRIBUTE_TYPES} onChange={(v) => setAttr(i, { type: v })} />
                <TextInput label="Values" value={a.options} disabled={a.type !== 'Picklist'} placeholder={a.type === 'Picklist' ? 'Comma separated' : 'Not applicable'} onChange={(v) => setAttr(i, { options: v })} />
                <FormControlLabel sx={{ mb: 0.5 }} control={<Checkbox size="small" checked={a.required} onChange={(e) => setAttr(i, { required: e.target.checked })} />} label={<Text type="s3">Required</Text>} />
                <IconButton size="small" sx={{ mb: 0.5 }} onClick={() => set('attributes')(f.attributes.filter((_, n) => n !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Box>
            ))}
          </FormSection>
        </Box>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Item Category view */
export function CategoryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const r = cats.get(id);
  const [del, setDel] = useState(false);
  if (!r) return <Page><PageTitle title="Category not found" right={<Button variant="outlined" onClick={() => nav('/inventory/categories')}>Back to Item Category</Button>} /></Page>;
  const subs = subCategoriesOf(cats.rows, r.name);
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Item Category', to: '/inventory/categories' }, { label: r.name }]}
        status={<StatusChip status={r.status} />}
        actions={<><Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button><Button variant="contained" onClick={() => nav(`/inventory/categories/${r.id}/edit`)}>Edit</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Parent Category" value={r.parent === '-' ? undefined : r.parent} />
          <ValueField label="Level" value={String(r.level)} />
          <ValueField label="Category Type" value={categoryTypeOf(r)} change="new" req={REQ_CAT_TYPE} />
          <ValueField label="Category Name" value={r.name} />
          <ValueField label="Brand" value={r.brand} />
          <ValueField label="Description" value={r.description} />
          <ValueField label="SKU Prefix" value={r.skuPrefix} />
          <ValueField label="Unique Items" value={r.uniqueItems === undefined ? undefined : String(r.uniqueItems)} />
          <ValueField label="Status" value={<StatusChip status={r.status} />} />
          <ValueField label="Depreciation Method Override" value={r.depMethod} change="new" req="Depreciation & Valuation > Method Override (per Category)" />
          {r.level === 1 && <ValueField label="Sub Categories" value={subs.length ? subs.join(', ') : undefined} />}
        </ValueGrid>
        <Panel title="Attributes" change="changed" req={`${REQ_CAT} > Custom Attributes`} sx={{ mt: 3 }}>
          {r.attributes.length === 0 ? <Text type="s5" color="theme.secondary.700">No attributes defined</Text> : (
            <DataTable<AttributeDef> rows={r.attributes} hideToolbar columns={[
              { key: 'name', label: 'Attribute' }, { key: 'type', label: 'Field Type' }, { key: 'options', label: 'Values', render: (a) => a.options || '-' },
              { key: 'required', label: 'Required', change: 'new', req: `${REQ_CAT} > Custom Attributes`, render: (a) => (a.required ? 'Yes' : 'No') },
            ]} />
          )}
        </Panel>
      </Page>
      <ConfirmDialog open={del} danger title="Delete category" description={`Delete ${r.name}? Consider marking it Inactive instead to keep its history.`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { cats.replace(cats.rows.filter((c) => c.id !== r.id && c.parent !== r.name)); toast('Category deleted'); nav('/inventory/categories'); }} />
    </>
  );
}

/* ------------------------------------------------------------------ Heavy Equipment Pricing (new) */
export function PricingList() {
  const nav = useNavigate();
  const toast = useToast();
  const pricing = useCollection<PricingRec>('inventory.pricing', pricingSeed);
  const [del, setDel] = useState<PricingRec | null>(null);
  return (
    <Page>
      <PageTitle title="Heavy Equipment Pricing" change="new" req={REQ_PRICING} />
      <DataTable<PricingRec>
        rows={pricing.rows} searchPlaceholder="Search pricing..."
        onAdd={() => nav('/inventory/pricing/add')} addLabel="Add Price" onRowClick={(r) => nav(`/inventory/pricing/${r.id}/edit`)}
        columns={[
          { key: 'category', label: 'Category' },
          { key: 'subCategory', label: 'Sub-Category' },
          { key: 'price', label: 'Price', align: 'right', render: (r) => aed(r.price) },
          { key: 'frequency', label: 'Frequency' },
        ]}
        actions={[{ label: 'Edit', onClick: (r) => nav(`/inventory/pricing/${r.id}/edit`) }, { label: 'Delete', danger: true, onClick: setDel }]}
      />
      <ConfirmDialog open={!!del} danger title="Delete price" description={`Delete the ${del?.frequency} price for ${del?.category}${del?.subCategory ? ` / ${del.subCategory}` : ''}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { pricing.remove(del.id); toast('Price deleted'); } }} />
    </Page>
  );
}

export function PricingForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const cats = useCats();
  const pricing = useCollection<PricingRec>('inventory.pricing', pricingSeed);
  const existing = id ? pricing.get(id) : undefined;
  const [f, setF] = useState({ category: existing?.category ?? '', subCategory: existing?.subCategory ?? '', price: existing ? String(existing.price) : '', frequency: existing?.frequency ?? '' });
  const [err, setErr] = useState<Errors>({});
  const subs = subCategoriesOf(cats.rows, f.category);
  const save = () => {
    const e: Errors = {};
    if (isBlank(f.category)) e.category = 'Category is required';
    if (isBlank(f.price) || Number(f.price) <= 0) e.price = 'Price must be greater than 0';
    if (isBlank(f.frequency)) e.frequency = 'Frequency is required';
    if (!Object.keys(e).length && pricing.rows.some((p) => p.id !== existing?.id && p.category === f.category && p.subCategory === f.subCategory && p.frequency === f.frequency)) e.frequency = 'A price already exists for this Category, Sub-Category and Frequency';
    setErr(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: PricingRec = { id: existing?.id ?? `pr${Date.now()}`, category: f.category, subCategory: f.subCategory, price: Number(f.price), frequency: f.frequency };
    if (existing) pricing.update(rec.id, rec); else pricing.add(rec);
    toast(existing ? 'Price updated' : 'Price added');
    nav('/inventory/pricing');
  };
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: '/inventory/pricing' }, { label: existing ? 'Edit Price' : 'Add Price' }]}
        actions={<><Button variant="outlined" onClick={() => nav('/inventory/pricing')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            <SelectInput label="Category" required change="new" req={REQ_PRICING} value={f.category} options={topCategories(cats.rows)} onChange={(v) => setF({ ...f, category: v, subCategory: '' })} error={err.category} />
            <SelectInput label="Sub-Category" change="new" req={REQ_PRICING} value={f.subCategory} options={subs} disabled={!f.category || subs.length === 0} onChange={(v) => setF({ ...f, subCategory: v })} />
            <NumberInput label="Price (AED)" required change="new" req={REQ_PRICING} value={f.price} onChange={(v) => setF({ ...f, price: v })} error={err.price} />
            <SelectInput label="Frequency" required change="new" req={REQ_PRICING} value={f.frequency} options={FREQUENCIES} onChange={(v) => setF({ ...f, frequency: v })} error={err.frequency} />
          </FormGrid>
        </Box>
      </Page>
    </>
  );
}
