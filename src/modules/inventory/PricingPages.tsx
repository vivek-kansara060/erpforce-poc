import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FileInput, FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { FREQUENCIES, PRICING_ACTIVITIES, pricingSeed, type PricingActivity, type PricingRec } from './data';
import { CategorySelect, SubCategorySelect } from './Masters';
import { aed, isBlank, num, type Errors } from './shared';

const REQ_PRICING = 'Heavy Equipment Pricing > Rental and Trading Pricing (2 Oct call)';
const REQ_ALL = 'Meeting 5 Oct: one pricing record per billing frequency, with an Add button to copy a record for another frequency';
const REQ_BULK = 'Pricing & Rate Management > Bulk Price Update Upload';
const BASE = '/inventory/pricing';
const usePricing = () => useCollection<PricingRec>('inventory.pricing', pricingSeed);
const labelOf = (r: Pick<PricingRec, 'category' | 'subCategory'>) => `${r.category}${r.subCategory ? ` / ${r.subCategory}` : ''}`;

/* ------------------------------------------------------------------ bulk upload (POC: the file is not processed) */
function BulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [activity, setActivity] = useState<string>('Rental');
  const [file, setFile] = useState<string[]>([]);
  const cols = activity === 'Rental' ? 'Category, Sub-Category, Billing Frequency, Price (AED), Description (one row per frequency)' : 'Category, Sub-Category, Sales Price (AED), Description';
  const close = () => { setFile([]); onClose(); };
  return (
    <AppDialog open={open} title="Bulk Upload Prices" onClose={close} confirmLabel="Upload"
      onConfirm={() => { if (!file.length) { toast('Choose a spreadsheet to upload', 'error'); return; } toast(`${file[0]} received. POC: the file is not processed; in the live system each row is validated, then added or updates the matching price.`, 'info'); close(); }}>
      <FormGrid cols={1}>
        <SelectInput label="Activity Type" required change="new" req={REQ_BULK} value={activity} options={[...PRICING_ACTIVITIES]} onChange={setActivity} hint="One upload covers either rental or fixed asset trading prices" />
        <Box>
          <Text type="s5" weight="medium" color="theme.secondary.800">Spreadsheet columns</Text>
          <Text type="s5" color="theme.secondary.700">{cols}</Text>
          <Button size="small" variant="text" sx={{ px: 0 }} onClick={() => toast('Template downloaded (POC: no file generated)', 'info')}>Download template</Button>
        </Box>
        <FileInput label="Spreadsheet (.xlsx or .csv)" required change="new" req={REQ_BULK} value={file} onChange={setFile} />
      </FormGrid>
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ list */
export function PricingList() {
  const nav = useNavigate();
  const toast = useToast();
  const pricing = usePricing();
  const [del, setDel] = useState<PricingRec | null>(null);
  const [bulk, setBulk] = useState(false);
  return (
    <Page>
      <PageTitle title="Heavy Equipment Pricing" change="changed" req={REQ_ALL} subtitle="One row per price. A rental price exists for each billing frequency; use Add Frequency on a row to copy it for weekly, monthly and so on. A fixed asset trading price is a single sales price." />
      <DataTable<PricingRec>
        rows={pricing.rows} searchPlaceholder="Search pricing..." filter={{ key: 'activity', options: [...PRICING_ACTIVITIES] }}
        toolbarRight={<Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulk(true)}>Bulk Upload</Button>}
        onAdd={() => nav(`${BASE}/add`)} addLabel="Add Price" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        columns={[
          { key: 'activity', label: 'Activity Type', change: 'changed', req: REQ_PRICING },
          { key: 'category', label: 'Category' },
          { key: 'subCategory', label: 'Sub-Category' },
          { key: 'frequency', label: 'Billing Frequency', change: 'changed', req: REQ_ALL, render: (r) => r.frequency ?? '-' },
          { key: 'price', label: 'Price (AED)', align: 'right', render: (r) => aed(r.price) },
          { key: 'description', label: 'Description', change: 'new', req: REQ_PRICING },
        ]}
        actions={[
          { label: 'Add Frequency', hidden: (r) => r.activity !== 'Rental', onClick: (r) => nav(`${BASE}/add?from=${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <BulkUploadDialog open={bulk} onClose={() => setBulk(false)} />
      <ConfirmDialog open={!!del} danger title="Delete price" description={`Delete the ${del?.activity === 'Rental' ? `${del?.frequency} rental` : 'fixed asset trading'} price for ${del ? labelOf(del) : ''}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { pricing.remove(del.id); toast('Price deleted'); } }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ add / edit */
export function PricingForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const pricing = usePricing();
  const existing = id ? pricing.get(id) : undefined;
  const from = pricing.get(sp.get('from') ?? '');
  // "Add Frequency": the record is copied, the next unused frequency is chosen and only the price needs changing.
  const nextFreq = from ? FREQUENCIES.find((fq) => !pricing.rows.some((p) => p.activity === from.activity && p.category === from.category && p.subCategory === from.subCategory && p.frequency === fq)) ?? '' : '';
  const base = existing ?? from;
  const [f, setF] = useState(() => ({
    activity: (base?.activity ?? '') as string, category: base?.category ?? '', subCategory: base?.subCategory ?? '', description: base?.description ?? '',
    frequency: existing ? existing.frequency ?? '' : nextFreq, price: existing ? String(existing.price) : '',
  }));
  const [err, setErr] = useState<Errors>({});
  const rental = f.activity === 'Rental';
  const trading = f.activity === 'Fixed Asset Trading';
  const save = () => {
    const e: Errors = {};
    if (isBlank(f.activity)) e.activity = 'Activity Type is required';
    if (isBlank(f.category)) e.category = 'Category is required';
    if (rental && isBlank(f.frequency)) e.frequency = 'Billing Frequency is required';
    if (isBlank(f.price) || num(f.price) <= 0) e.price = `${trading ? 'Sales Price' : 'Price'} must be greater than 0`;
    if (!Object.keys(e).length && pricing.rows.some((p) => p.id !== existing?.id && p.activity === f.activity && p.category === f.category && p.subCategory === f.subCategory && (!rental || p.frequency === f.frequency)))
      e.category = rental ? `A ${f.frequency} rental price already exists for this Category and Sub-Category` : 'A fixed asset trading price already exists for this Category and Sub-Category';
    setErr(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: PricingRec = { id: existing?.id ?? `pr${Date.now()}`, activity: f.activity as PricingActivity, category: f.category, subCategory: f.subCategory, description: f.description.trim(), price: num(f.price), ...(rental ? { frequency: f.frequency } : {}) };
    if (existing) pricing.update(rec.id, rec); else pricing.add(rec);
    toast(existing ? 'Price updated' : 'Price added');
    nav(`${BASE}/${rec.id}`);
  };
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: existing ? 'Edit Price' : from ? 'Add Frequency' : 'Add Price' }]}
        actions={<><Button variant="outlined" onClick={() => nav(BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          {from && !existing && <Alert severity="info" sx={{ mb: 2 }}>Copied from the {from.frequency} price. Everything is filled in, the frequency is set to the next one, only the price needs to change.</Alert>}
          <FormGrid>
            <SelectInput label="Activity Type" required change="changed" req={REQ_PRICING} value={f.activity} options={[...PRICING_ACTIVITIES]} disabled={!!existing || !!from} error={err.activity}
              onChange={(v) => setF({ ...f, activity: v })} hint="Rental has one record per billing frequency; Fixed Asset Trading is a single sales price" />
            <Box />
            <CategorySelect value={f.category} req={REQ_PRICING} onChange={(v) => setF({ ...f, category: v, subCategory: '' })} error={err.category} disabled={!!from} />
            <SubCategorySelect category={f.category} value={f.subCategory} req={REQ_PRICING} onChange={(v) => setF({ ...f, subCategory: v })} disabled={!!from} />
            {rental && <SelectInput label="Billing Frequency" required change="changed" req={REQ_ALL} value={f.frequency} options={FREQUENCIES} onChange={(v) => setF({ ...f, frequency: v })} error={err.frequency} />}
            {(rental || trading) && <NumberInput label={trading ? 'Sales Price (AED)' : 'Price (AED)'} required change="new" req={REQ_PRICING} value={f.price} onChange={(v) => setF({ ...f, price: v })} error={err.price} />}
            {(rental || trading) && <TextInput label="Description" change="new" req={REQ_PRICING} value={f.description} onChange={(v) => setF({ ...f, description: v })} multiline rows={2} full placeholder={trading ? 'e.g. New 100 KVA diesel generator, sale price' : 'e.g. Rental 100 KVA generator'} />}
          </FormGrid>
        </Box>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function PricingView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const pricing = usePricing();
  const r = pricing.get(id);
  const [del, setDel] = useState(false);
  if (!r) return <Page><PageTitle title="Price not found" right={<Button variant="outlined" onClick={() => nav(BASE)}>Back to Heavy Equipment Pricing</Button>} /></Page>;
  const rental = r.activity === 'Rental';
  const siblings = pricing.rows.filter((p) => p.activity === r.activity && p.category === r.category && p.subCategory === r.subCategory);
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: `${labelOf(r)} (${r.activity}${rental ? `, ${r.frequency}` : ''})` }]}
        actions={<>
          {rental && <Button variant="outlined" onClick={() => nav(`${BASE}/add?from=${r.id}`)}>Add Frequency</Button>}
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="contained" onClick={() => nav(`${BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <ValueGrid cols={4}>
            <ValueField label="Activity Type" value={r.activity} change="changed" req={REQ_PRICING} />
            <ValueField label="Category" value={r.category} change="new" req={REQ_PRICING} />
            <ValueField label="Sub-Category" value={r.subCategory || undefined} change="new" req={REQ_PRICING} />
            {rental && <ValueField label="Billing Frequency" value={r.frequency} change="changed" req={REQ_ALL} />}
            <ValueField label={rental ? 'Price' : 'Sales Price'} value={aed(r.price)} change="new" req={REQ_PRICING} />
            <ValueField label="Description" value={r.description} change="new" req={REQ_PRICING} />
          </ValueGrid>
          <Text type="s4" weight="medium" sx={{ mt: 3, mb: 1 }}>All prices for {labelOf(r)}</Text>
          <DataTable hideToolbar rows={siblings} onRowClick={(x) => nav(`${BASE}/${x.id}`)} columns={[{ key: 'frequency', label: 'Billing Frequency', render: (x) => x.frequency ?? 'Sales price' }, { key: 'price', label: 'Price', align: 'right', render: (x) => aed(x.price) }, { key: 'description', label: 'Description' }]} />
        </Box>
      </Page>
      <ConfirmDialog open={del} danger title="Delete price" description={`Delete the ${rental ? `${r.frequency} rental` : 'fixed asset trading'} price for ${labelOf(r)}?`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { pricing.remove(r.id); toast('Price deleted'); nav(BASE); }} />
    </>
  );
}
