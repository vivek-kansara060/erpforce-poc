import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FileInput, FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { Panel } from '@/components/Widgets';
import { StatusChip } from '@/components/StatusChip';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { FREQUENCIES, PRICING_ACTIVITIES, deriveFrequencyPrices, pricingSeed, type PricingActivity, type PricingRec } from './data';
import { CategorySelect, SubCategorySelect } from './Masters';
import { aed, isBlank, num, type Errors } from './shared';

const REQ_PRICING = 'Heavy Equipment Pricing > Rental and Trading Pricing (2 Oct call)';
const REQ_ALL = 'Heavy Equipment Pricing > Rental price stored for every billing frequency, calculated values editable';
const REQ_BULK = 'Pricing & Rate Management > Bulk Price Update Upload';
const BASE = '/inventory/pricing';
const usePricing = () => useCollection<PricingRec>('inventory.pricing', pricingSeed);
const labelOf = (r: Pick<PricingRec, 'category' | 'subCategory'>) => `${r.category}${r.subCategory ? ` / ${r.subCategory}` : ''}`;
const NOTE = 'Other billing frequencies are calculated from the one you chose (1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months, 1 year = 12 months), rounded to 2 decimals, and can be changed. Changing the chosen price recalculates them.';
const priceTag = (r: PricingRec, fq: string) => (fq === r.frequency ? 'Entered' : r.edited?.includes(fq) ? 'Changed by hand' : 'Calculated');

function Note() {
  return (
    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <InfoOutlinedIcon sx={{ fontSize: 18, mt: '2px', color: 'text.secondary' }} />
      <Text type="s5" color="theme.secondary.700">{NOTE}</Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ bulk upload (POC: the file is not processed) */
function BulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [activity, setActivity] = useState<string>('Rental');
  const [file, setFile] = useState<string[]>([]);
  const cols = activity === 'Rental' ? `Category, Sub-Category, ${FREQUENCIES.map((f) => `${f} Price (AED)`).join(', ')}, Description` : 'Category, Sub-Category, Sales Price (AED), Description';
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
  const [freq, setFreq] = useState('Monthly');
  return (
    <Page>
      <PageTitle title="Heavy Equipment Pricing" change="new" req={REQ_PRICING} subtitle="A rental price holds a price for every billing frequency. A trading price is a single sales price." />
      <DataTable<PricingRec>
        rows={pricing.rows} searchPlaceholder="Search pricing..." filter={{ key: 'activity', options: [...PRICING_ACTIVITIES] }}
        toolbarRight={<>
          <Box sx={{ minWidth: 200 }}><SelectInput label="Show rental prices for" change="new" req={REQ_ALL} value={freq} options={FREQUENCIES} onChange={setFreq} /></Box>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulk(true)}>Bulk Upload</Button>
        </>}
        onAdd={() => nav(`${BASE}/add`)} addLabel="Add Price" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        columns={[
          { key: 'activity', label: 'Activity Type', change: 'new', req: REQ_PRICING },
          { key: 'category', label: 'Category' },
          { key: 'subCategory', label: 'Sub-Category' },
          { key: 'price', label: `Price (rental: ${freq})`, align: 'right', change: 'changed', req: REQ_ALL, sortable: false,
            render: (r) => (r.activity === 'Rental' ? aed(r.prices?.[freq]) : <>{aed(r.price)} <Text component="span" type="s5" color="theme.secondary.700">sales</Text></>) },
          { key: 'description', label: 'Description', change: 'new', req: REQ_PRICING },
        ]}
        actions={[
          { label: 'Edit', onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <BulkUploadDialog open={bulk} onClose={() => setBulk(false)} />
      <ConfirmDialog open={!!del} danger title="Delete price" description={`Delete the ${del?.activity === 'Rental' ? 'rental' : 'trading'} price for ${del ? labelOf(del) : ''}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { pricing.remove(del.id); toast('Price deleted'); } }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ add / edit */
const toStrings = (p?: Record<string, number>) => Object.fromEntries(FREQUENCIES.map((fq) => [fq, p?.[fq] === undefined ? '' : String(p[fq])]));

export function PricingForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const pricing = usePricing();
  const existing = id ? pricing.get(id) : undefined;
  const [f, setF] = useState(() => ({
    activity: (existing?.activity ?? '') as string, category: existing?.category ?? '', subCategory: existing?.subCategory ?? '', description: existing?.description ?? '',
    frequency: existing?.frequency ?? '', price: existing ? String(existing.price) : '', prices: toStrings(existing?.prices), edited: existing?.edited ?? ([] as string[]),
  }));
  const [err, setErr] = useState<Errors>({});
  const rental = f.activity === 'Rental';
  const trading = f.activity === 'Trading';
  /** Entering or changing the chosen frequency's price recalculates every other frequency (hand changes are replaced). */
  const recalc = (price: string, frequency: string) => setF((x) => ({ ...x, price, frequency, prices: frequency && num(price) > 0 ? toStrings(deriveFrequencyPrices(num(price), frequency)) : toStrings(), edited: [] }));
  const setOne = (fq: string, v: string) => setF((x) => ({ ...x, prices: { ...x.prices, [fq]: v }, edited: x.edited.includes(fq) ? x.edited : [...x.edited, fq] }));
  const save = () => {
    const e: Errors = {};
    if (isBlank(f.activity)) e.activity = 'Activity Type is required';
    if (isBlank(f.category)) e.category = 'Category is required';
    if (rental && isBlank(f.frequency)) e.frequency = 'Billing Frequency is required';
    if (isBlank(f.price) || num(f.price) <= 0) e.price = `${trading ? 'Sales Price' : 'Price'} must be greater than 0`;
    if (rental && !e.price && FREQUENCIES.some((fq) => !(num(f.prices[fq]) > 0))) e.prices = 'Every billing frequency needs a price greater than 0';
    if (!Object.keys(e).length && pricing.rows.some((p) => p.id !== existing?.id && p.activity === f.activity && p.category === f.category && p.subCategory === f.subCategory))
      e.category = `A ${rental ? 'rental' : 'trading'} price already exists for this Category and Sub-Category`;
    setErr(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: PricingRec = rental
      ? { id: existing?.id ?? `pr${Date.now()}`, activity: 'Rental', category: f.category, subCategory: f.subCategory, description: f.description.trim(), price: num(f.price), frequency: f.frequency, prices: Object.fromEntries(FREQUENCIES.map((fq) => [fq, num(f.prices[fq])])), edited: f.edited.filter((fq) => fq !== f.frequency) }
      : { id: existing?.id ?? `pr${Date.now()}`, activity: f.activity as PricingActivity, category: f.category, subCategory: f.subCategory, description: f.description.trim(), price: num(f.price) };
    if (existing) pricing.update(rec.id, rec); else pricing.add(rec);
    toast(existing ? 'Price updated' : 'Price added');
    nav(`${BASE}/${rec.id}`);
  };
  const rows = FREQUENCIES.map((fq) => ({ id: fq, fq }));
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: existing ? 'Edit Price' : 'Add Price' }]}
        actions={<><Button variant="outlined" onClick={() => nav(BASE)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <FormGrid>
            <SelectInput label="Activity Type" required change="new" req={REQ_PRICING} value={f.activity} options={[...PRICING_ACTIVITIES]} disabled={!!existing} error={err.activity}
              onChange={(v) => setF({ ...f, activity: v })} hint="Rental holds a price for every billing frequency; Trading is a single sales price" />
            <Box />
            <CategorySelect value={f.category} req={REQ_PRICING} onChange={(v) => setF({ ...f, category: v, subCategory: '' })} error={err.category} />
            <SubCategorySelect category={f.category} value={f.subCategory} req={REQ_PRICING} onChange={(v) => setF({ ...f, subCategory: v })} />
            {rental && <SelectInput label="Billing Frequency" required change="changed" req={REQ_ALL} value={f.frequency} options={FREQUENCIES} onChange={(v) => recalc(f.price, v)} error={err.frequency} hint="The frequency you enter the price for" />}
            {(rental || trading) && <NumberInput label={trading ? 'Sales Price (AED)' : `Price${f.frequency ? ` per ${f.frequency.replace('ly', '').replace('Dai', 'Day').toLowerCase()}` : ''} (AED)`} required change="new" req={REQ_PRICING} value={f.price} onChange={(v) => (rental ? recalc(v, f.frequency) : setF({ ...f, price: v }))} error={err.price} />}
            {(rental || trading) && <TextInput label="Description" change="new" req={REQ_PRICING} value={f.description} onChange={(v) => setF({ ...f, description: v })} multiline rows={2} full placeholder={trading ? 'e.g. New 100 KVA diesel generator, sale price' : 'e.g. Rental 100 KVA generator'} />}
          </FormGrid>
          {rental && (
            <Panel title="Price for Every Billing Frequency" change="new" req={REQ_ALL} sx={{ mt: 3 }}>
              {err.prices && <Text type="s5" color="#C64D4D" sx={{ mb: 1 }}>{err.prices}</Text>}
              {!(f.frequency && num(f.price) > 0) ? <Text type="s5" color="theme.secondary.700">Choose a billing frequency and enter its price; the other frequencies are filled in for you.</Text> : (
                <DataTable<(typeof rows)[number]> rows={rows} hideToolbar columns={[
                  { key: 'fq', label: 'Billing Frequency', render: (r) => <Text type="s4" weight={r.fq === f.frequency ? 'medium' : undefined}>{r.fq}</Text> },
                  { key: 'price', label: 'Price (AED)', align: 'right', sortable: false, render: (r) => (
                    <input type="number" min={0} step="any" value={r.fq === f.frequency ? f.price : f.prices[r.fq]} disabled={r.fq === f.frequency}
                      onChange={(e) => setOne(r.fq, e.target.value)} style={{ width: 150, padding: '6px 8px', textAlign: 'right', border: '1px solid #D3D3D4', borderRadius: 4, font: 'inherit', background: r.fq === f.frequency ? '#F4F5F7' : '#fff' }} />) },
                  { key: 'src', label: 'Source', sortable: false, render: (r) => <StatusChip status={r.fq === f.frequency ? 'Entered' : f.edited.includes(r.fq) ? 'Changed by hand' : 'Calculated'} tone={r.fq === f.frequency ? 'green' : f.edited.includes(r.fq) ? 'amber' : 'grey'} /> },
                ]} />
              )}
              <Note />
            </Panel>
          )}
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
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Heavy Equipment Pricing', to: BASE }, { label: `${labelOf(r)} (${r.activity})` }]}
        actions={<>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="contained" onClick={() => nav(`${BASE}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ maxWidth: 1100 }}>
          <ValueGrid cols={4}>
            <ValueField label="Activity Type" value={r.activity} change="new" req={REQ_PRICING} />
            <ValueField label="Category" value={r.category} change="new" req={REQ_PRICING} />
            <ValueField label="Sub-Category" value={r.subCategory || undefined} change="new" req={REQ_PRICING} />
            {!rental && <ValueField label="Sales Price" value={aed(r.price)} change="new" req={REQ_PRICING} />}
            {rental && <ValueField label="Price Entered For" value={`${r.frequency}: ${aed(r.price)}`} change="changed" req={REQ_ALL} />}
            <ValueField label="Description" value={r.description} change="new" req={REQ_PRICING} />
          </ValueGrid>
          {rental && (
            <Panel title="Price for Every Billing Frequency" change="new" req={REQ_ALL} sx={{ mt: 3 }}>
              <DataTable hideToolbar rows={FREQUENCIES.map((fq) => ({ id: fq, fq }))} columns={[
                { key: 'fq', label: 'Billing Frequency', render: (x: any) => <Text type="s4" weight={x.fq === r.frequency ? 'medium' : undefined}>{x.fq}</Text> },
                { key: 'price', label: 'Price', align: 'right', render: (x: any) => aed(r.prices?.[x.fq]) },
                { key: 'src', label: 'Source', render: (x: any) => <StatusChip status={priceTag(r, x.fq)} tone={priceTag(r, x.fq) === 'Entered' ? 'green' : priceTag(r, x.fq) === 'Changed by hand' ? 'amber' : 'grey'} /> },
              ]} />
              <Note />
            </Panel>
          )}
        </Box>
      </Page>
      <ConfirmDialog open={del} danger title="Delete price" description={`Delete the ${rental ? 'rental' : 'trading'} price for ${labelOf(r)}?`} confirmLabel="Delete" onClose={() => setDel(false)}
        onConfirm={() => { pricing.remove(r.id); toast('Price deleted'); nav(BASE); }} />
    </>
  );
}
