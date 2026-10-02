import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FileInput, FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { Panel } from '@/components/Widgets';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { FREQUENCIES, PRICING_ACTIVITIES, pricingSeed, type PricingActivity, type PricingRec } from './data';
import { CategorySelect, SubCategorySelect } from './Masters';
import { aed, isBlank, type Errors } from './shared';

const REQ_PRICING = 'Heavy Equipment Pricing > Rental and Trading Pricing (2 Oct call)';
const REQ_PREVIEW = 'Heavy Equipment Pricing > Billing Frequency Preview (POC review aid)';
const REQ_BULK = 'Pricing & Rate Management > Bulk Price Update Upload';
const BASE = '/inventory/pricing';
const usePricing = () => useCollection<PricingRec>('inventory.pricing', pricingSeed);
const labelOf = (r: Pick<PricingRec, 'category' | 'subCategory'>) => `${r.category}${r.subCategory ? ` / ${r.subCategory}` : ''}`;
/** Rental frequencies not yet priced for this Category / Sub-Category. */
const unusedFrequencies = (rows: PricingRec[], category: string, subCategory: string, exceptId?: string) =>
  FREQUENCIES.filter((fq) => !rows.some((p) => p.id !== exceptId && p.activity === 'Rental' && p.category === category && p.subCategory === subCategory && p.frequency === fq));

/* ------------------------------------------------------------------ billing frequency preview (rental only) */
/** Days each billing frequency stands for in the preview: 1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months, 1 year = 12 months. */
const FREQ_DAYS: Record<string, number> = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Yearly: 360 };
const fmtN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** How a frequency's price is derived from the set price, in words (e.g. "600 × 7 days", "18,000 ÷ 30 days"). */
function howDerived(price: number, from: number, to: number) {
  if (from === to) return 'Price you entered';
  if (to % from === 0) return `${fmtN(price)} × ${to / from}${from === 1 ? ' days' : ''}`;
  if (from % to === 0) return `${fmtN(price)} ÷ ${from / to}${to === 1 ? ' days' : ''}`;
  return `${fmtN(price)} ÷ ${from} days × ${to} days`;
}

/** Read-only preview of the set price converted into every billing frequency. Nothing here is saved. */
function FrequencyPreview({ price, frequency }: { price: number; frequency?: string }) {
  const from = frequency ? FREQ_DAYS[frequency] : undefined;
  const ready = !!from && price > 0;
  const rows = FREQUENCIES.map((fq) => ({ id: fq, frequency: fq, price: ready ? round2((price / from!) * FREQ_DAYS[fq]) : 0, how: ready ? howDerived(price, from!, FREQ_DAYS[fq]) : '', set: fq === frequency }));
  return (
    <Panel title="Billing Frequency Preview" change="new" req={REQ_PREVIEW} sx={{ mt: 3 }}>
      {!ready ? <Text type="s5" color="theme.secondary.700">Enter a rental price and select a billing frequency to see the preview.</Text> : (
        <>
          <DataTable<(typeof rows)[number]> rows={rows} hideToolbar columns={[
            { key: 'frequency', label: 'Billing Frequency', render: (r) => <Text type="s4" weight={r.set ? 'medium' : undefined}>{r.frequency}{r.set ? ' (set)' : ''}</Text> },
            { key: 'price', label: 'Price', align: 'right', render: (r) => <Text type="s4" weight={r.set ? 'medium' : undefined}>{aed(r.price)}</Text> },
            { key: 'how', label: 'How it is worked out', render: (r) => r.how },
          ]} />
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, mt: '2px', color: 'text.secondary' }} />
            <Box>
              <Text type="s5" color="theme.secondary.700">Preview only. Actual invoices follow the rental dates on the order.</Text>
              <Text type="s5" color="theme.secondary.700">
                Converted using 1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months and 1 year = 12 months (360 days), and rounded to 2 decimals.
                Because of this, figures can differ by a few fils from what you get by multiplying a rounded figure back (for example AED 14 monthly is AED 0.47 daily, but 0.47 × 30 = AED 14.10).
                Real calendar months (28 to 31 days) and years (365 days) are not reflected here.
              </Text>
            </Box>
          </Box>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ bulk upload (POC: the file is not processed) */
function BulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [activity, setActivity] = useState<string>('Rental');
  const [file, setFile] = useState<string[]>([]);
  const cols = activity === 'Rental' ? 'Category, Sub-Category, Billing Frequency, Rental Price (AED), Description' : 'Category, Sub-Category, Sales Price (AED), Description';
  const close = () => { setFile([]); onClose(); };
  return (
    <AppDialog open={open} title="Bulk Upload Prices" onClose={close} confirmLabel="Upload"
      onConfirm={() => { if (!file.length) { toast('Choose a spreadsheet to upload', 'error'); return; } toast(`${file[0]} received. POC: the file is not processed; in the live system each row is validated, then added or updates the matching price.`, 'info'); close(); }}>
      <FormGrid cols={1}>
        <SelectInput label="Activity Type" required change="new" req={REQ_BULK} value={activity} options={[...PRICING_ACTIVITIES]} onChange={setActivity} hint="One upload covers either rental or trading prices" />
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
      <PageTitle title="Heavy Equipment Pricing" change="new" req={REQ_PRICING} subtitle="Rental prices are kept per billing frequency. Trading prices are a single sales price." />
      <DataTable<PricingRec>
        rows={pricing.rows} searchPlaceholder="Search pricing..." filter={{ key: 'activity', options: [...PRICING_ACTIVITIES] }}
        toolbarRight={<Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulk(true)}>Bulk Upload</Button>}
        onAdd={() => nav(`${BASE}/add`)} addLabel="Add Price" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        columns={[
          { key: 'activity', label: 'Activity Type', change: 'new', req: REQ_PRICING },
          { key: 'category', label: 'Category' },
          { key: 'subCategory', label: 'Sub-Category' },
          { key: 'frequency', label: 'Billing Frequency', render: (r) => (r.activity === 'Rental' ? r.frequency : '-') },
          { key: 'price', label: 'Price', align: 'right', render: (r) => aed(r.price) },
          { key: 'description', label: 'Description', change: 'new', req: REQ_PRICING },
        ]}
        actions={[
          { label: 'Add Another Frequency', hidden: (r) => r.activity !== 'Rental', onClick: (r) => nav(`${BASE}/add?from=${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <BulkUploadDialog open={bulk} onClose={() => setBulk(false)} />
      <ConfirmDialog open={!!del} danger title="Delete price" description={`Delete the ${del?.activity === 'Rental' ? `${del?.frequency} rental` : 'trading'} price for ${del ? labelOf(del) : ''}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { pricing.remove(del.id); toast('Price deleted'); } }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ add / edit */
export function PricingForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const pricing = usePricing();
  const existing = id ? pricing.get(id) : undefined;
  // "Add Another Frequency": start from an existing rental price, keep its Category / Sub-Category and offer the next frequency not priced yet.
  const from = !existing && params.get('from') ? pricing.get(params.get('from') ?? undefined) : undefined;
  const [f, setF] = useState(() => {
    if (existing) return { activity: existing.activity as string, category: existing.category, subCategory: existing.subCategory, frequency: existing.frequency ?? '', price: String(existing.price), description: existing.description };
    if (from) return { activity: 'Rental', category: from.category, subCategory: from.subCategory, frequency: unusedFrequencies(pricing.rows, from.category, from.subCategory)[0] ?? '', price: '', description: '' };
    return { activity: '', category: '', subCategory: '', frequency: '', price: '', description: '' };
  });
  const [err, setErr] = useState<Errors>({});
  const rental = f.activity === 'Rental';
  const trading = f.activity === 'Trading';
  const save = () => {
    const e: Errors = {};
    if (isBlank(f.activity)) e.activity = 'Activity Type is required';
    if (isBlank(f.category)) e.category = 'Category is required';
    if (rental && isBlank(f.frequency)) e.frequency = 'Billing Frequency is required for a rental price';
    if (isBlank(f.price) || Number(f.price) <= 0) e.price = `${trading ? 'Sales Price' : 'Rental Price'} must be greater than 0`;
    if (!Object.keys(e).length) {
      const clash = pricing.rows.some((p) => p.id !== existing?.id && p.activity === f.activity && p.category === f.category && p.subCategory === f.subCategory && (trading || p.frequency === f.frequency));
      if (clash) e[rental ? 'frequency' : 'category'] = rental ? 'A rental price already exists for this Category, Sub-Category and Billing Frequency' : 'A trading price already exists for this Category and Sub-Category';
    }
    setErr(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: PricingRec = { id: existing?.id ?? `pr${Date.now()}`, activity: f.activity as PricingActivity, category: f.category, subCategory: f.subCategory, price: Number(f.price), frequency: rental ? f.frequency : undefined, description: f.description.trim() };
    if (existing) pricing.update(rec.id, rec); else pricing.add(rec);
    toast(existing ? 'Price updated' : 'Price added');
    nav(`${BASE}/${rec.id}`);
  };
  const freqOptions = rental && f.category ? FREQUENCIES.filter((fq) => fq === f.frequency || unusedFrequencies(pricing.rows, f.category, f.subCategory, existing?.id).includes(fq)) : FREQUENCIES;
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: existing ? 'Edit Price' : from ? `Add Frequency for ${labelOf(from)}` : 'Add Price' }]}
        actions={<><Button variant="outlined" onClick={() => nav(BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          {from && <Text type="s5" color="theme.secondary.700" sx={{ mb: 2 }}>Category, Sub-Category and the next unpriced billing frequency are filled in from {labelOf(from)} ({from.frequency}). Enter the price and description.</Text>}
          <FormGrid>
            <SelectInput label="Activity Type" required change="new" req={REQ_PRICING} value={f.activity} options={[...PRICING_ACTIVITIES]} disabled={!!existing || !!from} error={err.activity}
              onChange={(v) => setF({ ...f, activity: v, frequency: v === 'Rental' ? f.frequency : '' })} hint="Rental prices are per billing frequency; Trading is a single sales price" />
            <Box />
            <CategorySelect value={f.category} req={REQ_PRICING} disabled={!!from} onChange={(v) => setF({ ...f, category: v, subCategory: '' })} error={err.category} />
            <SubCategorySelect category={f.category} value={f.subCategory} req={REQ_PRICING} disabled={!!from} onChange={(v) => setF({ ...f, subCategory: v })} />
            {rental && <SelectInput label="Billing Frequency" required change="new" req={REQ_PRICING} value={f.frequency} options={freqOptions} onChange={(v) => setF({ ...f, frequency: v })} error={err.frequency}
              hint={f.category && freqOptions.length === 0 ? 'Every billing frequency is already priced for this Category and Sub-Category' : 'Each billing frequency is a separate price'} />}
            {(rental || trading) && <NumberInput label={trading ? 'Sales Price (AED)' : 'Rental Price (AED)'} required change="new" req={REQ_PRICING} value={f.price} onChange={(v) => setF({ ...f, price: v })} error={err.price} />}
            {(rental || trading) && <TextInput label="Description" change="new" req={REQ_PRICING} value={f.description} onChange={(v) => setF({ ...f, description: v })} multiline rows={2} full placeholder={trading ? 'e.g. New 100 KVA diesel generator, sale price' : 'e.g. Rental 100 KVA generator, monthly rate'} />}
          </FormGrid>
          {rental && <FrequencyPreview price={Number(f.price) || 0} frequency={f.frequency} />}
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
  const left = rental ? unusedFrequencies(pricing.rows, r.category, r.subCategory) : [];
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: `${labelOf(r)} (${rental ? r.frequency : 'Trading'})` }]}
        actions={<>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          {rental && <Button variant="outlined" onClick={() => (left.length ? nav(`${BASE}/add?from=${r.id}`) : toast('Every billing frequency is already priced for this Category and Sub-Category', 'info'))}>Add Another Frequency</Button>}
          <Button variant="contained" onClick={() => nav(`${BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <ValueGrid cols={4}>
            <ValueField label="Activity Type" value={r.activity} change="new" req={REQ_PRICING} />
            <ValueField label="Category" value={r.category} change="new" req={REQ_PRICING} />
            <ValueField label="Sub-Category" value={r.subCategory || undefined} change="new" req={REQ_PRICING} />
            {rental && <ValueField label="Billing Frequency" value={r.frequency} change="new" req={REQ_PRICING} />}
            <ValueField label={rental ? 'Rental Price' : 'Sales Price'} value={aed(r.price)} change="new" req={REQ_PRICING} />
            <ValueField label="Description" value={r.description} change="new" req={REQ_PRICING} />
          </ValueGrid>
          {rental && <FrequencyPreview price={r.price} frequency={r.frequency} />}
        </Box>
      </Page>
      <ConfirmDialog open={del} danger title="Delete price" description={`Delete the ${rental ? `${r.frequency} rental` : 'trading'} price for ${labelOf(r)}?`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { pricing.remove(r.id); toast('Price deleted'); nav(BASE); }} />
    </>
  );
}
