import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { ChangeTag } from '@/components/ChangeTag';
import { neutral, primaryGreen } from '@/theme/color';
import { FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ToggleInput, CheckInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { TabPanels, Panel } from '@/components/Widgets';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { fmtNum } from '@/mock-data/masters';
import { PRODUCT_CLASSIFICATIONS, TRACKING_METHODS, ITEM_TYPES, UOMS, itemSeed, heavySeed, heavyCodes, stockStatusOf, attributesFor, categorySeed, nextItemCode, locationStockSeed, type LocationStock, type ItemRec, type CategoryRec, type HeavyRec } from './data';
import { CategorySelect, SubCategorySelect } from './Masters';
import { AttributeFields, AttributeValues, validateAttrs, FileList, PhotoBox, PhotoInput, REQ_ITEM, REQ_HE, SerializedFields, SerializedView, requireFields, validateSerialized, aed, type Errors } from './shared';

const useItems = () => useCollection<ItemRec>('items', itemSeed);
const isSerialized = (t?: string) => t === 'Serialized';
const TRACK_LABEL: Record<string, string> = { Serialized: 'Serialized', Quantity: 'Quantity', Length: 'Length (or applicable UOM)' };

/* ------------------------------------------------------------------ list */
interface Row { id: string; kind: 'item' | 'heavy'; assetId?: string; code: string; sku: string; name: string; type: string; classification: string; category: string; subCategory: string; minStock?: number; status: string; stockStatus?: string }
export const HEAVY_PATH = '/inventory/items/heavy';

export function ItemList() {
  const nav = useNavigate();
  const toast = useToast();
  const items = useItems();
  const heavy = useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
  const [type, setType] = useState('All');
  const [del, setDel] = useState<Row | null>(null);
  const rows: Row[] = [
    ...items.rows.map((r): Row => ({ id: r.id, kind: 'item', code: r.code, sku: r.sku, name: r.name, type: r.type, classification: r.classification, category: r.category, subCategory: r.subCategory ?? '', minStock: r.minStock, status: r.status })),
    ...heavy.rows.map((r): Row => ({ id: r.id, kind: 'heavy', assetId: r.assetId, code: r.code, sku: '-', name: r.name, type: 'Heavy Equipment Fixed Asset', classification: r.classification, category: r.category, subCategory: r.subCategory, status: r.status, stockStatus: stockStatusOf(r) })),
  ];
  const view = type === 'All' ? rows : rows.filter((r) => r.type === type);
  const open = (r: Row) => nav(r.kind === 'heavy' ? `${HEAVY_PATH}/${r.id}` : `/inventory/items/${r.id}`);
  const edit = (r: Row) => nav(r.kind === 'heavy' ? `${HEAVY_PATH}/${r.id}/edit` : `/inventory/items/${r.id}/edit`);
  const heavyView = type === 'Heavy Equipment Fixed Asset';
  const cols: Column<Row>[] = heavyView
    ? [
        { key: 'assetId', label: 'Serialized ID', change: 'new', req: REQ_HE },
        { key: 'category', label: 'Category', change: 'new', req: REQ_HE },
        { key: 'subCategory', label: 'Sub-Category', change: 'new', req: REQ_HE },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        { key: 'stockStatus', label: 'Stock Status', change: 'new', req: REQ_HE, render: (r) => <StatusChip status={r.stockStatus ?? '-'} tone={r.stockStatus === 'In Stock' ? 'green' : 'amber'} /> },
      ]
    : [
        { key: 'code', label: 'Item Code', width: 120, change: 'new', req: REQ_ITEM },
        { key: 'sku', label: 'SKU', width: 120 },
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'classification', label: 'Product Classification', change: 'new', req: REQ_ITEM },
        { key: 'category', label: 'Category', change: 'new', req: REQ_ITEM },
        { key: 'minStock', label: 'Reorder Level', align: 'right', render: (r) => (r.minStock === undefined ? '-' : fmtNum(r.minStock)) },
        { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
      ];
  return (
    <Page>
      <PageTitle title="Items" />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        {['All', ...ITEM_TYPES].map((t) => (
          <Box key={t} onClick={() => setType(t)} sx={{ cursor: 'pointer', px: 1.25, py: 0.4, borderRadius: '1.5rem', fontSize: 12, fontWeight: 500, bgcolor: type === t ? primaryGreen[200] : neutral[200], color: type === t ? primaryGreen[900] : neutral[800], '&:hover': { bgcolor: type === t ? primaryGreen[200] : neutral[300] } }}>
            {t}{t === 'Heavy Equipment Fixed Asset' && <ChangeTag kind="new" req={REQ_HE} />}
          </Box>
        ))}
      </Box>
      <DataTable<Row>
        key={heavyView ? 'heavy' : 'all'}
        rows={view} columns={cols}
        searchPlaceholder="Search items..."
        onAdd={() => nav(heavyView ? `${HEAVY_PATH}/add` : '/inventory/items/add')} addLabel={heavyView ? 'Add Heavy Equipment Fixed Asset' : 'Add Item'}
        onRowClick={open}
        actions={[
          { label: 'View', onClick: open },
          { label: 'Edit', onClick: edit },
          { label: 'Duplicate', hidden: (r) => r.kind === 'heavy', onClick: (r) => { const src = items.get(r.id); if (src) { items.add({ ...src, id: `i${Date.now()}`, code: nextItemCode(items.rows.map((x) => x.code), heavyCodes()), sku: `${src.sku}-COPY`, name: `${src.name} (Copy)` }); toast('Item duplicated'); } } },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <ConfirmDialog open={!!del} danger title="Delete item" description={`Delete ${del?.name}? This cannot be undone.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { (del.kind === 'heavy' ? heavy : items).remove(del.id); toast('Item deleted'); } }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ form */
const blank = { type: 'Inventory', sku: '', name: '', classification: '', category: '', subCategory: '', tracking: '', unit: '', costingMethod: 'Average Cost', traceability: 'No Tracking', useBins: false, price: '', costPrice: '', minStock: '', reorderQty: '', status: 'Active',
  brand: '', model: '', engineNo: '', capacity: '', purchaseDate: '', assetValue: '', nbv: '', deprPct: '', deprAmount: '', capex: '', image: undefined as string | undefined, attachments: [] as string[], attrs: {} as Record<string, string> };

export function ItemForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const items = useItems();
  const cats = useCollection<CategoryRec>('inventory.categories', categorySeed);
  const existing = id ? items.get(id) : undefined;
  const code = existing?.code ?? nextItemCode(items.rows.map((r) => r.code), heavyCodes());
  const [f, setF] = useState<Record<string, any>>(() => (existing ? { ...blank, ...Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v === undefined || v === null ? '' : typeof v === 'number' ? String(v) : v])), attrs: existing.attrs ?? {}, attachments: existing.attachments ?? [] } : blank));
  const [errors, setErrors] = useState<Errors>({});
  const [leave, setLeave] = useState(false);
  const upd = (p: Record<string, any>) => setF((x) => ({ ...x, ...p }));
  const set = (k: string) => (v: any) => upd({ [k]: v });
  const serial = isSerialized(f.tracking);
  const attrDefs = attributesFor(cats.rows, f.category, f.subCategory);

  const save = (draft: boolean) => {
    const e = requireFields(f, ['name', 'sku', 'type', 'classification', 'category', 'tracking', 'unit'], { classification: 'Product Classification', tracking: 'Tracking Method', unit: 'UOM' });
    if (serial) Object.assign(e, validateSerialized(f));
    Object.assign(e, validateAttrs(attrDefs, f.attrs));
    setErrors(e);
    if (Object.keys(e).length && !draft) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    if (Object.keys(e).length && draft && (e.name || e.sku)) { toast('Name and SKU are required to save a draft', 'error'); return; }
    const n = (k: string) => (f[k] === '' || f[k] === undefined ? undefined : Number(f[k]));
    const rec: ItemRec = {
      id: existing?.id ?? `i${Date.now()}`, code, name: f.name, type: f.type, sku: f.sku, classification: f.classification, category: f.category, subCategory: f.subCategory || undefined, tracking: f.tracking, unit: f.unit,
      price: n('price') ?? 0, stock: existing?.stock ?? 0, minStock: n('minStock'), reorderQty: n('reorderQty'), spare: existing?.spare, status: draft ? 'Inactive' : f.status,
      costingMethod: f.costingMethod, traceability: f.traceability, useBins: f.useBins, costPrice: n('costPrice'),
      ...(serial ? { brand: f.brand, model: f.model, engineNo: f.engineNo, capacity: f.capacity, purchaseDate: f.purchaseDate, assetValue: n('assetValue'), nbv: n('nbv'), deprPct: n('deprPct'), deprAmount: n('deprAmount'), capex: n('capex') } : {}),
      image: f.image, attachments: f.attachments, attrs: f.attrs,
    };
    if (existing) items.update(existing.id, rec); else items.add(rec);
    toast(draft ? 'Item saved as draft' : existing ? 'Item updated' : 'Item created');
    nav(`/inventory/items/${rec.id}`);
  };

  const basic = (
    <>
      <FormGrid>
        <SelectInput label="Type" required value={f.type} options={existing ? ITEM_TYPES.filter((t) => t !== 'Heavy Equipment Fixed Asset') : ITEM_TYPES} error={errors.type}
          onChange={(v) => { if (v === 'Heavy Equipment Fixed Asset') { toast('Heavy Equipment Fixed Assets are created in the Heavy Equipment Fixed Asset form'); nav(`${HEAVY_PATH}/add`); return; } set('type')(v); }} />
        <TextInput label="Item Code" change="new" req={REQ_ITEM} value={code} disabled hint="Auto-generated" />
        <TextInput label="SKU" required value={f.sku} onChange={set('sku')} error={errors.sku} />
        <TextInput label="Name" required value={f.name} onChange={set('name')} error={errors.name} />
        <SelectInput label="Product Classification" required change="new" req={REQ_ITEM} value={f.classification}
          options={PRODUCT_CLASSIFICATIONS.filter((c) => c !== 'Rental' || f.classification === 'Rental')} onChange={set('classification')} error={errors.classification}
          hint="Rental equipment is added as a Heavy Equipment Fixed Asset" />
        <SelectInput label="Tracking Method" required change="new" req={REQ_ITEM} value={f.tracking} options={TRACKING_METHODS} onChange={set('tracking')} error={errors.tracking} />
        <CategorySelect value={f.category} req={REQ_ITEM} onChange={(v) => upd({ category: v, subCategory: '' })} error={errors.category} />
        <SubCategorySelect category={f.category} value={f.subCategory} req={REQ_ITEM} onChange={set('subCategory')} />
        <SelectInput label="UOM" required value={f.unit} options={UOMS} onChange={set('unit')} error={errors.unit}
          hint={f.tracking === 'Length' ? 'Select the applicable UOM, e.g. Meter' : undefined} />
        <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
      </FormGrid>
      <AttributeFields defs={attrDefs} values={f.attrs} onChange={set('attrs')} errors={errors} />
      {serial ? (
        <FormSection title="Equipment and Asset Details" change="new" req={REQ_ITEM} right={<Text type="s5" color="theme.secondary.700">Mandatory for serialized items</Text>}>
          <SerializedFields f={f} upd={upd} errors={errors} req={REQ_ITEM} />
        </FormSection>
      ) : f.tracking ? (
        <Box sx={{ mt: 3 }}><Text type="s5" color="theme.secondary.700">Brand, Model, Engine Number, Capacity and asset value details are not applicable to quantity-tracked items.</Text></Box>
      ) : null}
      <FormSection title="Photo and Attachments" change="new" req={REQ_ITEM}>
        <FormGrid>
          <PhotoInput value={f.image} onChange={set('image')} change="new" req={REQ_ITEM} />
          <FileInput label="Attachments" multiple change="new" req={REQ_ITEM} value={f.attachments} onChange={set('attachments')} />
        </FormGrid>
      </FormSection>
    </>
  );

  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: existing ? `Edit ${existing.code}` : 'Add Item' }]}
        actions={<><Button variant="text" onClick={() => setLeave(true)}>Cancel</Button><Button variant="outlined" onClick={() => save(true)}>Save as draft</Button><Button variant="contained" onClick={() => save(false)}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: basic },
          { label: 'Inventory', content: (
            <FormGrid>
              <SelectInput label="Costing Method" value={f.costingMethod} options={['Average Cost', 'FIFO', 'Standard Cost']} onChange={set('costingMethod')} />
              <SelectInput label="Traceability" value={f.traceability} options={['Lot Tracking', 'Serial Number Tracking', 'No Tracking']} onChange={set('traceability')} />
              <NumberInput label="Reorder Point" value={f.minStock} onChange={set('minStock')} />
              <NumberInput label="Reorder Quantity" value={f.reorderQty} onChange={set('reorderQty')} />
              <CheckInput label="Use Bins" checked={f.useBins} onChange={set('useBins')} />
            </FormGrid>
          ) },
          { label: 'Pricing and Accounts', content: (
            <FormGrid>
              <NumberInput label="Sales Price (AED)" value={f.price} onChange={set('price')} />
              <NumberInput label="Cost Price (AED)" value={f.costPrice} onChange={set('costPrice')} />
              <SelectInput label="Income Account" value="400100 Sales Revenue" options={['400100 Sales Revenue', '400200 Rental Revenue']} />
              <SelectInput label="Inventory Account" value="130100 Inventory" options={['130100 Inventory', '120100 Fixed Assets: Plant & Machinery']} />
            </FormGrid>
          ) },
        ]} />
      </Page>
      <ConfirmDialog open={leave} info title="Discard changes" description="Leave this form? Unsaved changes will be lost." confirmLabel="Leave" onClose={() => setLeave(false)} onConfirm={() => nav('/inventory/items')} />
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function ItemView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const items = useItems();
  const cats = useCollection<CategoryRec>('inventory.categories', categorySeed);
  const locStock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const r = items.get(id);
  if (!r) return <Page><PageTitle title="Item not found" right={<Button variant="outlined" onClick={() => nav('/inventory/items')}>Back to Items</Button>} /></Page>;
  const serial = isSerialized(r.tracking);
  const stockRows = locStock.rows.filter((x) => x.itemId === r.id);
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: r.code }]}
        status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => { items.update(r.id, { status: r.status === 'Active' ? 'Inactive' : 'Active' }); toast(`Item marked ${r.status === 'Active' ? 'Inactive' : 'Active'}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          <Button variant="contained" onClick={() => nav(`/inventory/items/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3 }}>
          <PhotoBox src={r.image} size={132} />
          <Box sx={{ flex: 1 }}>
            <Text type="h3" weight="medium" sx={{ mb: 2 }}>{r.name}</Text>
            <ValueGrid cols={4}>
              <ValueField label="Item Code" value={r.code} change="new" req={REQ_ITEM} />
              <ValueField label="SKU" value={r.sku} />
              <ValueField label="Type" value={r.type} />
              <ValueField label="Product Classification" value={r.classification} change="new" req={REQ_ITEM} />
              <ValueField label="Tracking Method" value={TRACK_LABEL[r.tracking]} change="new" req={REQ_ITEM} />
              <ValueField label="Category" value={r.category} change="new" req={REQ_ITEM} />
              <ValueField label="Sub-Category" value={r.subCategory} change="new" req={REQ_ITEM} />
              <ValueField label="UOM" value={r.unit} />
            </ValueGrid>
          </Box>
        </Box>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              {attributesFor(cats.rows, r.category, r.subCategory).length > 0 && <Panel title="Category Attributes" change="new" req={REQ_ITEM} sx={{ mb: 2 }}><AttributeValues defs={attributesFor(cats.rows, r.category, r.subCategory)} values={r.attrs} /></Panel>}
              {serial ? <Panel title="Equipment and Asset Details" change="new" req={REQ_ITEM}><SerializedView r={r} req={REQ_ITEM} /></Panel> : <Text type="s5" color="theme.secondary.700">Equipment and asset details are not applicable to quantity-tracked items.</Text>}
              <Panel title="Attachments" change="new" req={REQ_ITEM} sx={{ mt: 2 }}><FileList names={r.attachments} /></Panel>
            </>
          ) },
          { label: 'Inventory', content: (
            <>
              <ValueGrid cols={4}>
                <ValueField label="Costing Method" value={r.costingMethod} />
                <ValueField label="Traceability" value={r.traceability} />
                <ValueField label="Reorder Point" value={r.minStock === undefined ? undefined : fmtNum(r.minStock)} />
                <ValueField label="Reorder Quantity" value={r.reorderQty === undefined ? undefined : fmtNum(r.reorderQty)} />
                <ValueField label="Use Bins" value={r.useBins ? 'Yes' : 'No'} />
                <ValueField label="Stock on Hand (all locations)" value={`${fmtNum(r.stock)} ${r.unit}`} />
              </ValueGrid>
              {stockRows.length > 0 && (
                <Panel title="Location wise stock" sx={{ mt: 2 }}>
                  <DataTable<LocationStock> hideToolbar rows={stockRows} pageSize={10} columns={[
                    { key: 'location', label: 'Location' },
                    { key: 'qty', label: `Quantity (${r.unit})`, align: 'right', render: (x) => fmtNum(x.qty) },
                  ]} />
                </Panel>
              )}
            </>
          ) },
          { label: 'Pricing and Accounts', content: (
            <ValueGrid cols={4}>
              <ValueField label="Sales Price" value={aed(r.price)} />
              <ValueField label="Cost Price" value={aed(r.costPrice)} />
            </ValueGrid>
          ) },
        ]} />
      </Page>
    </>
  );
}
