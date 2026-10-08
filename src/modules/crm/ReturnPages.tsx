import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import dayjs from 'dayjs';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { customers } from '@/mock-data/masters';
import { DEPARTMENTS, FAULT_ATTRIBUTION, RETURN_METHODS, RMA_STATUSES, TODAY, assetById, custName, hasWaiver, lineTotal, masterValues, yards, type ReturnEntry, type ReturnGrn, type ReturnGrnItem, type ReturnItem } from './data';
import { applyOffHire, createReturn, createReturnGrn, decideReturn, deleteReturn, deleteReturnGrn, failedCollection, getOrder, invoiceDamage, outstanding, saveReturn, saveReturnGrn, submitReturn, validateReturnGrn } from './flow';
import { Section, SpecForm, SpecView, type Spec } from './FormKit';
import { customerAddresses, useAddressAutofill, type AddressCfg } from './addressKit';
import { invoiceByRef } from '@/modules/accounting/engine';
import { useInvoices } from '@/modules/accounting/shared';
import { R, TO_CONFIRM, aed, useDeliveries, useMaster, useOrders, useReturns, useTrips } from './shared';
import { TransportSection, TripsTable, blankTransport, toTransportInput, validateTransport } from '@/modules/rental/FleetPages';
import { neutral } from '@/theme/color';

const BASE = '/crm/customer-returns';
const EDITABLE = ['Draft', 'Pending', 'Rejected'];
const tone = (s: string) => (s === 'Return Completed' || s === 'Validated' || s === 'Passed' ? 'green' : s === 'Rejected' || s === 'Damage Found' ? 'red' : s === 'Draft' ? 'grey' : 'amber');
const label = (a?: ReturnType<typeof assetById>) => (a ? `${a.assetId} - ${a.name}` : '-');
/** Inspection Status of the whole return (NEW): from the yard inspections on its Goods Receipts. */
export const inspectionOf = (r: ReturnEntry) => {
  const its = r.grns.flatMap((g) => g.items);
  if (!its.length || its.every((i) => i.inspection === 'Pending Inspection')) return 'Pending Inspection';
  return its.some((i) => i.inspection === 'Damage Found') ? 'Damage Found' : its.every((i) => i.inspection === 'Passed') ? 'Passed' : 'Pending Inspection';
};

/* ------------------------------------------------------------------ list */
export function ReturnList() {
  const nav = useNavigate();
  const toast = useToast();
  const rets = useReturns();
  const [del, setDel] = useState<ReturnEntry | null>(null);
  return (
    <Page>
      <PageTitle title="Customer Returns" />
      <DataTable<ReturnEntry> rows={rets.rows} searchPlaceholder="Search customer returns..." filter={{ key: 'status', options: RMA_STATUSES, label: 'RMA Status' }} onAdd={() => nav(`${BASE}/add`)} addLabel="Add Customer Return" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        actions={[
          { label: 'Edit', hidden: (r) => !EDITABLE.includes(r.status), onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Duplicate', onClick: (r) => nav(`${BASE}/add?copy=${r.id}`) },
          { label: 'Delete', danger: true, hidden: (r) => r.status !== 'Draft', onClick: (r) => setDel(r) },
        ]}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer', render: (r) => custName(r.customerId) }, { key: 'salesperson', label: 'Salesperson' }, { key: 'soNumber', label: 'Sales Order' }, { key: 'entity', label: 'Entity' },
          { key: 'status', label: 'RMA Status', render: (r) => <StatusChip status={r.status} tone={tone(r.status)} /> },
          { key: 'method', label: 'Return Method', change: 'new', req: R.ret }, { key: 'timestamp', label: 'Return Entry Timestamp', change: 'new', req: R.ret, render: (r) => r.timestamp.replace('T', ' ') },
          { key: 'insp', label: 'Inspection Status', change: 'new', req: R.ret, render: (r) => <StatusChip status={inspectionOf(r)} tone={tone(inspectionOf(r))} /> },
        ]} />
      <ConfirmDialog open={!!del} title="Delete Customer Returns" description={`Delete Customer Returns: ${del?.number} ?`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { deleteReturn(del.id); toast('Deleted'); } setDel(null); }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ the existing form: Customer Returns, Classification, Items, Attachment, with the rental return added */
type Row = { id: string; lineId: string; deliveryId: string; assetId: string; narration?: string };
const mkRow = (lineId: string, deliveryId: string, assetId: string): Row => ({ id: `ri${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, lineId, deliveryId, assetId });

const summaryRows = (f: Record<string, any>): [string, any][] => [['ID', f.number ?? 'Auto-generated'], ['Date', f.date], ['Customer', f.customerId ? custName(f.customerId) : '-'], ['Shipping Address', f.shippingAddress], ['Operation Type', 'Return'], ['Salesperson', f.salesperson], ['Entity', f.entity], ['Reference Number', f.reference], ['Currency', f.currency], ['Exchange Rate', f.exchangeRate], ['Narration', f.narration]];
function SummaryRows({ f }: { f: Record<string, any> }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, columnGap: 4 }}>{summaryRows(f).map(([k, v]) => <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}><Text type="s5" color="theme.secondary.700">{k}</Text><Text type="s4" sx={{ textAlign: 'right' }}>{v ?? '-'}</Text></Box>)}</Box>;
}
/** The existing right-hand Summary and Activity panel. Below 1536 px the summary is shown above the form instead, so the page never scrolls sideways; Activity stays as a panel. */
function SummaryPanel({ f, tabs }: { f: Record<string, any>; tabs?: { label: string; content: React.ReactNode }[] }) {
  return (
    <Box sx={{ display: { xs: tabs ? 'block' : 'none', xl: 'block' }, border: `1px solid ${neutral[200]}`, borderRadius: '8px', p: 2, alignSelf: 'start', position: { xl: 'sticky' }, top: 90, minWidth: 0 }}>
      <TabPanels tabs={[{ label: 'Summary', content: <Box sx={{ display: { xs: 'none', xl: 'block' } }}>{summaryRows(f).map(([k, v]) => <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}><Text type="s5" color="theme.secondary.700">{k}</Text><Text type="s4" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v ?? '-'}</Text></Box>)}</Box> }, ...(tabs ?? [])]} />
    </Box>
  );
}

export function ReturnForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const rets = useReturns();
  const orders = useOrders();
  const dels = useDeliveries();
  const SITE = useMaster('siteChecklist').values;
  const existing = rets.get(id);
  const copy = rets.get(sp.get('copy') ?? undefined);
  const src = existing ?? copy;
  const so0 = orders.get(sp.get('so') ?? src?.soId);
  const locked = !!existing && existing.status !== 'Draft';
  const soOutstanding = (soId?: string) => (orders.get(soId)?.lines ?? []).flatMap((l) => outstanding(l).map((a) => ({ l, a })));
  const initialRows = (): Row[] => {
    if (src) return src.items.map((i) => (copy ? mkRow(i.lineId, i.deliveryId, i.assetId) : { ...i }));
    const line = sp.get('line'); const delivery = sp.get('delivery');
    return soOutstanding(so0?.id).filter((x) => (!line || x.l.id === line) && (!delivery || x.a.deliveryId === delivery)).map((x) => mkRow(x.l.id, x.a.deliveryId, x.a.assetId));
  };
  const [f, setF] = useState<Record<string, any>>(() => ({
    date: TODAY, soId: so0?.id ?? '', customerId: so0?.customerId ?? '', shippingAddress: so0?.site ?? '', salesperson: so0?.owner ?? 'Ahmed Al Khouri', entity: so0?.entity ?? masterValues('entity')[0], reference: '', currency: so0?.currency ?? 'AED', exchangeRate: 1, narration: '',
    location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], method: '', timestamp: `${TODAY}T${dayjs().format('HH:mm')}`, checks: [] as string[], photos: [] as string[], fuelNote: '', deliveryId: sp.get('delivery') ?? '',
    ...(src ? { ...src, checks: src.siteChecklist, date: copy ? TODAY : src.date, timestamp: copy ? `${TODAY}T${dayjs().format('HH:mm')}` : src.timestamp, number: copy ? undefined : src.number } : {}),
  }));
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [err, setErr] = useState<Record<string, string>>({});
  const [tp, setTp] = useState(blankTransport);
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, ...(k === 'customerId' ? { soId: '' } : {}), ...(k === 'soId' ? { shippingAddress: orders.get(v)?.site ?? '', salesperson: orders.get(v)?.owner ?? x.salesperson, entity: orders.get(v)?.entity ?? x.entity, currency: orders.get(v)?.currency ?? x.currency } : {}) }));
  const changeSo = (v: string) => { set('soId', v); setRows([]); };
  // Shipping Address follows the customer (its addresses and the site of the order), like the existing form; the first is filled in.
  const retCfg: AddressCfg = { party: 'customer', partyId: (g) => g.customerId, entity: (g) => g.entity, sites: (g) => (g.soSite ? [g.soSite] : []) };
  useAddressAutofill({ ...f, soSite: orders.get(f.soId)?.site }, set, retCfg, !locked);
  const so = orders.get(f.soId);
  const outs = soOutstanding(f.soId);
  const customerOpts = [...new Map(orders.rows.filter((o) => o.activity === 'Rental').map((o) => [o.customerId, { value: o.customerId, label: custName(o.customerId) }])).values()];
  const soOpts = orders.rows.filter((o) => o.activity === 'Rental' && (!f.customerId || o.customerId === f.customerId) && o.lines.some((l) => outstanding(l).length)).map((o) => ({ value: o.id, label: `${o.number}${o.title ? ` - ${o.title}` : ''}` }));
  const pickOpts = (cur: Row | null) => outs.filter((x) => !rows.some((r) => r.assetId === x.a.assetId && r !== cur)).map((x) => ({ value: `${x.l.id}|${x.a.assetId}|${x.a.deliveryId}`, label: `${label(assetById(x.a.assetId))} (${x.l.group} ${x.l.category})` }));
  const specs: Spec[] = [
    { key: 'entity', label: 'Entity', type: 'master', master: 'entity', required: true },
    { key: 'number', label: 'ID', type: 'readonly', value: (g) => g.number ?? 'Auto-generated' },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'customerId', label: 'Customer', type: 'select', options: customerOpts, required: true, disabled: !!so0 || !!existing },
    { key: 'soId', label: 'Sales Order', type: 'select', options: soOpts, required: true, disabled: !!so0 || !!existing, onChangeKey: 'soId' } as Spec,
    { key: 'shippingAddress', label: 'Shipping Address', type: 'select', options: (g) => customerAddresses(g.customerId, g.soSite ? [g.soSite] : []).map((a) => a.label), hint: 'Addresses of the customer and the site of the order' },
    { key: 'operationType', label: 'Operation Type', type: 'readonly', value: () => 'Return' },
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'reference', label: 'Reference Number' }, { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
    { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', required: true, disabled: (g) => g.currency === 'AED', value: (g) => (g.currency === 'AED' ? 1 : g.exchangeRate) },
    { key: 'narration', label: 'Narration', type: 'textarea', full: true },
  ];
  const rental: Spec[] = [
    { key: 'method', label: 'Return Method', type: 'select', options: RETURN_METHODS, required: true, change: 'new', req: R.ret, hint: 'Self-Return: the client brings it to our yard. Company Collection: we collect it from the site with a trip', disabled: locked },
    { key: 'timestamp', label: 'Return Entry Timestamp (Off-Hire)', type: 'datetime', required: true, change: 'new', req: R.ret, hint: 'Saving the return stops the rental billing clock at this time. Can be set earlier or later than today', disabled: locked },
    { key: 'fuelNote', label: 'Fuel Note', change: 'new', req: R.ret, hint: 'Reference only. Fuel is never billed as part of rental', disabled: locked },
  ];
  const saveIt = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (draft) { if (!f.soId) e.soId = 'Please fill atleast one field'; } else {
      if (!f.date) e.date = 'Date is required'; if (!f.soId) e.soId = 'Sales Order is required'; if (!f.entity) e.entity = 'Company is required'; if (!f.currency) e.currency = 'Currency is required'; if (f.currency !== 'AED' && !(Number(f.exchangeRate) > 0)) e.exchangeRate = 'Exchange Rate is required'; if (!f.location) e.location = 'Location is required';
      if (!rows.length || rows.some((r) => !r.assetId)) e.items = rows.length ? 'Select an asset on every item row' : 'Please add atleast one Item';
      if (!locked) {
        if (!f.method) e.method = 'Return Method is required';
        if (f.checks.length < SITE.length) e.checks = 'The Pre-Return Site Checklist must be completed before Off-Hire is confirmed';
        if (!f.photos.length) e.photos = 'Photos are mandatory at Return';
        if (f.method === 'Company Collection') Object.assign(e, validateTransport(tp, f.timestamp));
      }
    }
    setErr(e);
    if (Object.keys(e).length) { toast(e.soId === 'Please fill atleast one field' ? e.soId : 'Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const header = { date: f.date, shippingAddress: f.shippingAddress, salesperson: f.salesperson, entity: f.entity, reference: f.reference, currency: f.currency, exchangeRate: Number(f.exchangeRate) || 1, narration: f.narration, location: f.location, department: f.department, attachments: f.attachments ?? [] };
    const rental2 = { method: f.method, timestamp: f.timestamp, siteChecklist: f.checks, photos: f.photos, fuelNote: f.fuelNote, transport: f.method === 'Company Collection' ? toTransportInput(tp) : undefined };
    const items = rows.filter((r) => r.assetId).map((r) => ({ lineId: r.lineId, assetId: r.assetId, narration: r.narration }));
    if (existing) {
      if (existing.status === 'Draft') {
        saveReturn(existing.id, { ...header, ...rental2, items: rows.filter((r) => r.assetId).map((r) => ({ ...r })) as ReturnItem[], status: draft ? 'Draft' : 'Pending' });
        if (!draft) applyOffHire(existing.id);
      } else saveReturn(existing.id, header);
      toast(draft ? 'Saved as draft' : 'Customer Returns saved Successfully.');
      nav(`${BASE}/${existing.id}`); return;
    }
    const r = createReturn({ soId: f.soId, deliveryId: f.deliveryId || undefined, ...header, items, ...rental2, transport: rental2.transport, draft });
    toast(draft ? 'Saved as draft' : `${r.number} saved. The assets are Off Hire and rental billing has stopped`);
    nav(`${BASE}/${r.id}`);
  };
  const lineOf = (lineId: string) => so?.lines.find((l) => l.id === lineId);
  const amounts = (r: Row) => { const l = lineOf(r.lineId); const rate = l?.price ?? 0; const net = rate * (1 - (l?.discount ?? 0) / 100); return { rate, gross: rate, net, tax: net * 0.05, total: net * 1.05 }; };
  const itemCols = [
    { key: 'item', label: 'Item', render: (r: Row) => { const l = lineOf(r.lineId); return l ? `${l.group} ${l.category}` : '-'; } },
    { key: 'asset', label: 'Asset ID', change: 'new' as const, req: R.rreturn, render: (r: Row) => assetById(r.assetId)?.assetId },
    { key: 'do', label: 'Delivery Order', change: 'new' as const, req: R.meet, render: (r: Row) => dels.get(r.deliveryId)?.number ?? '-' },
    { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'desc', label: 'Description', render: (r: Row) => assetById(r.assetId)?.name }, { key: 'qty', label: 'Quantity', align: 'right' as const, render: () => 1 },
    { key: 'rate', label: 'Rate', align: 'right' as const, render: (r: Row) => aed(amounts(r).rate) }, { key: 'gross', label: 'Gross Amount', align: 'right' as const, render: (r: Row) => aed(amounts(r).gross) },
    { key: 'tax', label: 'Tax Amount', align: 'right' as const, render: (r: Row) => aed(amounts(r).tax) }, { key: 'total', label: 'Total Amount', align: 'right' as const, render: (r: Row) => aed(amounts(r).total) },
    { key: 'loc', label: 'Location', render: () => f.location }, { key: 'dep', label: 'Department', render: () => f.department ?? '-' }, { key: 'nar', label: 'Narration', render: (r: Row) => r.narration || '-' },
  ];
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: BASE }, { label: existing ? 'Edit Customer Return' : 'Add Customer Return' }]}
        actions={<>{(!existing || existing.status === 'Draft') && <Button variant="outlined" onClick={() => saveIt(true)}>Save as Draft</Button>}<Button variant="outlined" onClick={() => nav(existing ? `${BASE}/${existing.id}` : BASE)}>Discard</Button><Button variant="contained" onClick={() => saveIt(false)}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        {locked && <Alert severity="info" sx={{ mb: 2 }}>Billing has already stopped for this return, so its assets and return details are locked. Header details can still be edited.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 300px' }, gap: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: { xl: 'none' } }}><Section title="Summary"><SummaryRows f={f} /></Section></Box>
            <Section title="Customer Returns">
              <SpecForm specs={specs.map((s) => (s.key === 'soId' ? { ...s, onChangeKey: undefined } : s))} f={{ ...f, soSite: so?.site }} set={(k, v) => (k === 'soId' ? changeSo(v) : set(k, v))} err={err} />
            </Section>
            <Section title="Classification"><SpecForm specs={[{ key: 'location', label: 'Location', type: 'select', options: yards(), required: true }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }]} f={f} set={set} err={err} /></Section>
            <Section title="Rental Return" change="new" req={R.ret} hint="Added to the existing Customer Return for rental assets: how it comes back, when billing stops, the site check and the photos">
              <SpecForm specs={rental} f={f} set={set} err={err} cols={3} />
              <Text type="s3" weight="medium" sx={{ mt: 2 }}>Pre-Return Site Checklist</Text>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {SITE.map((c) => <FormControlLabel key={c} control={<Checkbox size="small" disabled={locked} checked={f.checks.includes(c)} onChange={(e) => set('checks', e.target.checked ? [...f.checks, c] : f.checks.filter((x: string) => x !== c))} />} label={<Text type="s3">{c}</Text>} />)}
              </Box>
              {err.checks && <Text type="s5" color="#C64D4D">{err.checks}</Text>}
              <Text type="s5" color="theme.secondary.700">Light check at the client site before Off-Hire. Checklist content {TO_CONFIRM.toLowerCase()}.</Text>
              <Box sx={{ mt: 2 }}><FileInput label="Return Photo Attachments" required change="new" req={R.rreturn} multiple value={f.photos} onChange={(v) => set('photos', v)} error={err.photos} disabled={locked} hint="Mandatory at Return (optional at Delivery)" /></Box>
              {f.method === 'Company Collection' && !locked && <Box sx={{ mt: 2 }}><Text type="s3" weight="medium" sx={{ mb: 1 }}>Collection Transport</Text><TransportSection value={tp} onChange={setTp} errors={err} date={f.timestamp} /></Box>}
            </Section>
            <Section title="Items">
              {err.items && <Text type="s5" color="#C64D4D">{err.items}</Text>}
              {!locked && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}><Button size="small" variant="outlined" disabled={!so || !pickOpts(null).length} onClick={() => setRows([...rows, { id: `ri${Date.now().toString(36)}${rows.length}`, lineId: '', deliveryId: '', assetId: '' }])}>+ Add</Button></Box>}
              {locked ? <DataTable hideToolbar rows={rows} columns={itemCols} /> : (
                <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px', maxWidth: '100%' }}>
                  <Table size="small">
                    <TableHead><TableRow sx={{ bgcolor: neutral[100] }}>{['Item', 'Asset ID', 'Delivery Order', 'UoM', 'Quantity', 'Rate', 'Gross Amount', 'Tax Amount', 'Total Amount', 'Narration', ''].map((h) => <TableCell key={h} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</TableCell>)}</TableRow></TableHead>
                    <TableBody>
                      {rows.length === 0 && <TableRow><TableCell colSpan={11}><Text type="s4" color="theme.secondary.700">{so ? 'Please add atleast one Item' : 'Select the Sales Order first'}</Text></TableCell></TableRow>}
                      {rows.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{lineOf(r.lineId) ? `${lineOf(r.lineId)!.group} ${lineOf(r.lineId)!.category}` : '-'}</TableCell>
                          <TableCell sx={{ py: 0.5, minWidth: 260 }}>
                            <Select size="small" displayEmpty fullWidth value={r.assetId ? `${r.lineId}|${r.assetId}|${r.deliveryId}` : ''} sx={{ fontSize: 13 }} error={!!err.items && !r.assetId}
                              onChange={(e) => { const [lineId, assetId, deliveryId] = String(e.target.value).split('|'); setRows(rows.map((x, j) => (j === i ? { ...x, lineId, assetId, deliveryId } : x))); }}>
                              <MenuItem value="" disabled>Select the asset</MenuItem>
                              {pickOpts(r).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                            </Select>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{dels.get(r.deliveryId)?.number ?? '-'}</TableCell><TableCell>Nos</TableCell><TableCell align="right">1</TableCell>
                          <TableCell align="right">{r.assetId ? aed(amounts(r).rate) : '-'}</TableCell><TableCell align="right">{r.assetId ? aed(amounts(r).gross) : '-'}</TableCell><TableCell align="right">{r.assetId ? aed(amounts(r).tax) : '-'}</TableCell><TableCell align="right">{r.assetId ? aed(amounts(r).total) : '-'}</TableCell>
                          <TableCell sx={{ py: 0.5 }}><TextField size="small" value={r.narration ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, narration: e.target.value } : x)))} sx={{ width: 180 }} /></TableCell>
                          <TableCell><IconButton size="small" onClick={() => setRows(rows.filter((_, j) => j !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Only assets still out against the Sales Order are offered. One fixed asset is one unit, so the quantity is always 1. The Delivery Order closes automatically once its assets are returned.</Text>
            </Section>
            <Section title="Attachment"><FileInput label="Attach your file here" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
          </Box>
          <SummaryPanel f={f} />
        </Box>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function ReturnView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const rets = useReturns();
  useInvoices();
  const dels = useDeliveries();
  const trips = useTrips();
  const orders = useOrders();
  const r = rets.get(id);
  const [fail, setFail] = useState<{ open: boolean; by: string; amount: string; note: string }>({ open: false, by: '', amount: '', note: '' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [ask, setAsk] = useState<'accept' | 'reject' | 'delete' | null>(null);
  if (!r) return <Page><PageTitle title="Return not found" right={<Button variant="outlined" onClick={() => nav(BASE)}>Back</Button>} /></Page>;
  const waiver = hasWaiver(orders.get(r.soId)?.lines ?? []);
  const rTrips = trips.rows.filter((t) => t.docId === r.id);
  const ct = rTrips.find((t) => t.status !== 'Cancelled');
  const received = new Set(r.grns.flatMap((g) => g.items.map((i) => i.itemId)));
  const toReceive = r.items.filter((i) => !received.has(i.id));
  const charges = orders.get(r.soId)?.damageCharges ?? [];
  const mine = r.items.map((i) => i.assetId);
  const chargeIdx = charges.findIndex((c) => mine.includes(c.assetId) && !c.invoiceId);
  const chargeInv = invoiceByRef(charges.find((c) => mine.includes(c.assetId) && c.invoiceId)?.invoiceId);
  const grnItems = r.grns.flatMap((g) => g.items);
  const specs: Spec[] = [
    { key: 'entity', label: 'Entity' }, { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' }, { key: 'soNumber', label: 'Sales Order' }, { key: 'shippingAddress', label: 'Shipping Address' }, { key: 'operationType', label: 'Operation Type' }, { key: 'salesperson', label: 'Salesperson' },
    { key: 'reference', label: 'Reference Number' }, { key: 'currency', label: 'Currency' }, { key: 'exchangeRate', label: 'Exchange Rate' }, { key: 'narration', label: 'Narration' },
  ];
  const view = { ...r, customer: custName(r.customerId) };
  const rentalSpecs: Spec[] = [
    { key: 'method', label: 'Return Method', change: 'new', req: R.ret }, { key: 'ts', label: 'Return Entry Timestamp', change: 'new', req: R.ret, value: () => r.timestamp.replace('T', ' ') },
    { key: 'billing', label: 'Billing', change: 'new', req: R.ret, value: () => (r.status === 'Draft' ? 'Running (not yet saved as a return)' : `Stopped at ${r.timestamp.replace('T', ' ')}`) },
    { key: 'insp', label: 'Inspection Status', change: 'new', req: R.ret, value: () => inspectionOf(r) }, { key: 'fuel', label: 'Fuel Note', value: () => r.fuelNote || '-' }, { key: 'waiver', label: 'Damage Waiver on order', change: 'new', req: R.meet, value: () => (waiver ? 'Yes' : 'No') },
    { key: 'coll', label: 'Collection', value: () => (r.collection ? `Failed, ${r.collection.by === 'Client' ? `charged to client AED ${r.collection.amount}` : 'company loss'}` : r.collected ? `Collected ${r.collected}` : r.method === 'Company Collection' ? 'Pending' : 'Not applicable') },
    { key: 'dinv', label: 'Damage Invoice', change: 'new', req: R.meet, value: () => (chargeInv ? `${chargeInv.number} (${chargeInv.approval === 'Approved' ? chargeInv.payStatus : chargeInv.approval})` : '-') },
  ];
  const itemRows = r.items.map((i) => ({ ...i }));
  const l = (lineId: string) => orders.get(r.soId)?.lines.find((x) => x.id === lineId);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: BASE }, { label: `ID: ${r.number}` }]} status={<StatusChip status={r.status} tone={tone(r.status)} />}
        actions={<>
          {r.status !== 'Return Completed' && EDITABLE.includes(r.status) && <MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${BASE}/${r.id}/edit`) }, { label: 'Delete', disabled: r.status !== 'Draft', onClick: () => setAsk('delete') }, { label: 'Print Collection Note', onClick: () => setNoteOpen(true) }]} />}
          {(!EDITABLE.includes(r.status) || r.status === 'Return Completed') && <Button variant="outlined" onClick={() => setNoteOpen(true)}>Print Collection Note</Button>}
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${r.soId}`)}>View Sales Order</Button>
          {r.grns.length > 0 && ['Pending Receipt', 'Pending Credit', 'Return Completed'].includes(r.status) && <Button variant="outlined" onClick={() => nav(`${BASE}/${r.id}/grn`)}>View GRN</Button>}
          {(r.status === 'Pending' || r.status === 'Rejected') && <MenuButton label={r.status === 'Rejected' ? 'Re-Submit' : 'Submit'} variant="contained" items={[{ label: 'Submit for Approval', onClick: () => { submitReturn(r.id, false); toast('Submitted for approval'); } }, { label: 'Quick Approval', onClick: () => { submitReturn(r.id, true); toast('Approved. Ready to Receive'); } }]} />}
          {r.status === 'Pending Approval' && <MenuButton label="Accept" variant="contained" items={[{ label: 'Accept', onClick: () => setAsk('accept') }, { label: 'Reject', onClick: () => setAsk('reject') }]} />}
          {r.status === 'Pending Receipt' && r.method === 'Company Collection' && !r.collection && !r.collected && !received.size && <Button variant="outlined" color="error" onClick={() => setFail({ ...fail, open: true })}>Collection Failed</Button>}
          {r.status === 'Pending Receipt' && toReceive.length > 0 && <Button variant="contained" onClick={() => nav(`${BASE}/${r.id}/grn/add`)}>Receive</Button>}
          {chargeIdx >= 0 && <Button variant="contained" onClick={() => { const x = invoiceDamage(r.soId, chargeIdx); toast(x.message, x.ok ? 'success' : 'error'); }}>Raise Damage Invoice</Button>}
          {chargeInv && <Button variant="outlined" onClick={() => nav(`/accounting/invoices/${chargeInv.id}`)}>View Damage Invoice</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 300px' }, gap: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: { xl: 'none' } }}><Section title="Summary"><SummaryRows f={r} /></Section></Box>
            <Section title="Basic Details"><SpecView specs={specs} f={view} cols={4} /></Section>
            <Section title="Classification"><ValueGrid cols={4}><ValueField label="Location" value={r.location} /><ValueField label="Department" value={r.department} /></ValueGrid></Section>
            <Section title="Rental Return" change="new" req={R.ret}>
              <SpecView specs={rentalSpecs} f={r} cols={4} />
              <Box sx={{ mt: 2 }}>
                <TabPanels tabs={[
                  { label: 'Checklists', content: <Box><Text type="s3" weight="medium">Pre-Return Site Checklist</Text>{r.siteChecklist.map((c) => <Text key={c} type="s4">- {c}</Text>)}{grnItems.map((g) => (<Box key={g.itemId} sx={{ mt: 2 }}><Text type="s3" weight="medium">Operations Return Checklist (Yard), {assetById(g.assetId)?.assetId}</Text>{g.yardChecklist.length ? g.yardChecklist.map((c) => <Text key={c} type="s4">- {c}</Text>) : <Text type="s4">Pending inspection</Text>}</Box>))}</Box> },
                  { label: 'Trips', content: <TripsTable rows={rTrips} empty={r.method === 'Company Collection' ? 'No trip recorded for this collection' : 'Self-Return: the client brings it, no trip'} /> },
                  { label: 'Photos', content: <Text type="s4">{r.photos.join(', ') || 'None'}</Text> },
                ]} />
              </Box>
            </Section>
            <Section title="Items">
              <DataTable hideToolbar rows={itemRows} columns={[
                { key: 'item', label: 'Item', render: (i) => { const x = l(i.lineId); return x ? `${x.group} ${x.category}` : '-'; } }, { key: 'asset', label: 'Asset ID', change: 'new', req: R.rreturn, render: (i) => label(assetById(i.assetId)) },
                { key: 'do', label: 'Delivery Order', change: 'new', req: R.meet, render: (i) => dels.get(i.deliveryId)?.number ?? '-' }, { key: 'uom', label: 'Unit of Measurement', render: () => 'Nos' }, { key: 'qty', label: 'Quantity', align: 'right', render: () => 1 },
                { key: 'rate', label: 'Rate', align: 'right', render: (i) => aed(l(i.lineId)?.price ?? 0) }, { key: 'status', label: 'Asset Status', render: (i) => <StatusChip status={assetById(i.assetId)?.assetStatus ?? '-'} /> },
                { key: 'recv', label: 'Received', render: (i) => (received.has(i.id) ? 'Yes' : 'No') }, { key: 'nar', label: 'Narration', render: (i) => i.narration || '-' },
              ]} />
            </Section>
            <Section title="Attachment"><Text type="s4">{r.attachments.join(', ') || 'No file attached'}</Text></Section>
          </Box>
          <SummaryPanel f={{ ...r }} tabs={[{ label: 'Activity', content: <Timeline items={[...r.log].reverse()} /> }]} />
        </Box>
      </Page>
      <ConfirmDialog open={ask === 'accept' || ask === 'reject'} title={ask === 'accept' ? 'Approved request' : 'Rejected request'} description={`Are you sure you want to ${ask === 'accept' ? 'approve' : 'reject'} ${r.number}?`} confirmLabel="Submit" onClose={() => setAsk(null)}
        onConfirm={() => { decideReturn(r.id, ask === 'accept'); toast(ask === 'accept' ? 'Approved. Ready to Receive' : 'Rejected'); setAsk(null); }} />
      <ConfirmDialog open={ask === 'delete'} title="Delete Customer Returns" description={`Delete Customer Returns: ${r.number} ?`} danger confirmLabel="Delete" onClose={() => setAsk(null)} onConfirm={() => { deleteReturn(r.id); toast('Deleted'); nav(BASE); }} />
      <AppDialog open={fail.open} title="Collection failed" onClose={() => setFail({ ...fail, open: false })} confirmLabel="Save" confirmDisabled={!fail.by || !fail.note.trim() || (fail.by === 'Client' && !Number(fail.amount))}
        onConfirm={() => { failedCollection(r, fail.by, Number(fail.amount) || 0, fail.note); toast(fail.by === 'Client' ? 'Charge added to the Sales Order' : 'Recorded as a company loss'); setFail({ open: false, by: '', amount: '', note: '' }); }}>
        <FormGrid cols={1}>
          <SelectInput label="Responsible" required value={fail.by} options={FAULT_ATTRIBUTION} onChange={(v) => setFail({ ...fail, by: v })} hint="Client: charge the client. Company: our logistics problem, booked as a loss" />
          {fail.by === 'Client' && <NumberInput label="Charge to client (AED)" required value={fail.amount} onChange={(v) => setFail({ ...fail, amount: v })} />}
          <TextInput label="Note" required multiline rows={2} value={fail.note} onChange={(v) => setFail({ ...fail, note: v })} />
        </FormGrid>
      </AppDialog>
      <AppDialog open={noteOpen} title="Collection Note" onClose={() => setNoteOpen(false)} maxWidth="md" confirmLabel="Print" onConfirm={() => { window.print(); setNoteOpen(false); }}>
        <Box sx={{ border: '1px solid #D3D3D4', borderRadius: '6px', p: 2 }}>
          <Text type="s2" weight="medium">Gulf Power Rentals LLC: Equipment Collection Note</Text>
          <Text type="s4" sx={{ mt: 1 }}>Customer Return: {r.number} &nbsp; Sales Order: {r.soNumber}</Text>
          <Text type="s4">Customer: {custName(r.customerId)}</Text>
          {r.items.map((i) => <Text key={i.id} type="s4">Asset: {label(assetById(i.assetId))} &nbsp; Delivery Order: {dels.get(i.deliveryId)?.number ?? '-'}</Text>)}
          <Text type="s4">Off-Hire date and time: {r.timestamp.replace('T', ' ')}</Text>
          <Text type="s4" sx={{ mt: 3 }}>Client name and signature: ______________________ &nbsp; Date: ____________</Text>
          <Text type="s4" sx={{ mt: 2 }}>Collected by (driver): {ct ? <u>{ct.transport === 'Own Fleet' ? ct.driver || '-' : ct.transporter}</u> : '______________________'} &nbsp; Vehicle: {ct ? <u>{ct.transport === 'Own Fleet' ? ct.plate : 'External transporter'}</u> : '____________'}</Text>
        </Box>
      </AppDialog>
    </>
  );
}

/* ------------------------------------------------------------------ Goods Receipt (GRN) of a Customer Return */
export function ReturnGrnList() {
  const { id } = useParams();
  const nav = useNavigate();
  const r = useReturns().get(id);
  if (!r) return <Page><PageTitle title="Return not found" /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: BASE }, { label: `ID: ${r.number}`, to: `${BASE}/${r.id}` }, { label: 'Goods Receipt' }]} />
      <Page>
        <PageTitle title="Goods Receipt" />
        <DataTable<ReturnGrn> hideToolbar rows={r.grns} emptyText="No goods receipt yet. Use Receive on the Customer Return" onRowClick={(g) => nav(`${BASE}/${r.id}/grn/${g.id}`)}
          columns={[{ key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer', render: () => custName(r.customerId) }, { key: 'entity', label: 'Entity', render: () => r.entity }, { key: 'currency', label: 'Currency', render: () => r.currency }, { key: 'status', label: 'Status', render: (g) => <StatusChip status={g.status} tone={tone(g.status)} /> }]} />
      </Page>
    </>
  );
}

const nowLocal = () => `${TODAY}T${dayjs().format('HH:mm')}`;
/** Receive: the same header as the return, with the assets being received. Reached Yard and the yard are the rental additions. */
export function ReturnGrnForm() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const r = useReturns().get(id);
  const g0 = r?.grns.find((x) => x.id === gid);
  const [yard, setYard] = useState<Record<string, { yard: string; reached: string }>>({});
  if (!r) return <Page><PageTitle title="Return not found" /></Page>;
  const received = new Set(r.grns.filter((x) => x.id !== g0?.id).flatMap((x) => x.items.map((i) => i.itemId)));
  const items = g0 ? r.items.filter((i) => g0.items.some((x) => x.itemId === i.id)) : r.items.filter((i) => !received.has(i.id));
  const val = (i: ReturnItem) => yard[i.id] ?? { yard: g0?.items.find((x) => x.itemId === i.id)?.yard ?? r.location, reached: (g0?.items.find((x) => x.itemId === i.id)?.reachedYard ?? r.collected ?? nowLocal()).replace(' ', 'T') };
  const save = () => {
    if (!items.length) { toast('Nothing left to receive', 'error'); return; }
    const picked = items.map((i) => ({ itemId: i.id, yard: val(i).yard, reachedYard: val(i).reached.replace('T', ' ') }));
    if (g0) { saveReturnGrn(r.id, g0.id, (g) => ({ ...g, items: g.items.map((x) => ({ ...x, ...(picked.find((p) => p.itemId === x.itemId) ?? {}) })) })); toast('Goods Receipt Note saved successfully.'); nav(`${BASE}/${r.id}/grn/${g0.id}`); return; }
    const ng = createReturnGrn(r.id, picked);
    toast('Goods Receipt Note saved successfully.'); nav(`${BASE}/${r.id}/grn/${ng}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: BASE }, { label: `ID: ${r.number}`, to: `${BASE}/${r.id}` }, { label: 'Goods Receipt', to: `${BASE}/${r.id}/grn` }, { label: g0 ? `Edit ${g0.number}` : 'Add GRN' }]}
        actions={<><Button variant="outlined" onClick={() => nav(`${BASE}/${r.id}`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Section title="Customer Returns"><ValueGrid cols={4}><ValueField label="ID" value={r.number} /><ValueField label="Date" value={r.date} /><ValueField label="Customer" value={custName(r.customerId)} /><ValueField label="Sales Order" value={r.soNumber} /><ValueField label="Entity" value={r.entity} /><ValueField label="Currency" value={r.currency} /><ValueField label="Return Method" change="new" req={R.ret} value={r.method} /><ValueField label="Return Entry Timestamp" change="new" req={R.ret} value={r.timestamp.replace('T', ' ')} /></ValueGrid></Section>
        <Section title="Items">
          <DataTable hideToolbar rows={items} columns={[
            { key: 'item', label: 'Item', render: (i) => label(assetById(i.assetId)) }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'qty', label: 'Quantity', align: 'right', render: () => 1 }, { key: 'rem', label: 'Remaining', align: 'right', render: () => 0 },
            { key: 'yard', label: 'Yard', change: 'new', req: R.rreturn, render: (i) => <Box sx={{ width: 220 }}><SelectInput label="" value={val(i).yard} options={yards()} onChange={(v) => setYard({ ...yard, [i.id]: { ...val(i), yard: v } })} /></Box> },
            { key: 'reached', label: 'Reached Yard', change: 'new', req: R.rreturn, render: (i) => <TextField size="small" type="datetime-local" value={val(i).reached} onChange={(e) => setYard({ ...yard, [i.id]: { ...val(i), reached: e.target.value } })} InputLabelProps={{ shrink: true }} /> },
          ]} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Off-Hire assets go to the Yard first, never straight to Ready for Hire. Validate the receipt after inspecting each asset in the yard.</Text>
        </Section>
      </Page>
    </>
  );
}

export function ReturnGrnView() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const r = useReturns().get(id);
  const g = r?.grns.find((x) => x.id === gid);
  const YARD_CHECKLIST = useMaster('yardChecklist').values;
  const [insp, setInsp] = useState<{ itemId: string; res: string; checks: string[]; amount: string; note: string; serial: boolean } | null>(null);
  const [del, setDel] = useState(false);
  const orders = useOrders();
  const waiver = useMemo(() => hasWaiver(orders.get(r?.soId)?.lines ?? []), [orders.rows, r?.soId]);
  if (!r || !g) return <Page><PageTitle title="Goods Receipt not found" /></Page>;
  const done = g.status === 'Validated';
  const upd = (itemId: string, p: Partial<ReturnGrnItem>) => saveReturnGrn(r.id, g.id, (x) => ({ ...x, items: x.items.map((i) => (i.itemId === itemId ? { ...i, ...p } : i)) }));
  const validate = () => {
    if (g.items.some((i) => i.inspection === 'Pending Inspection' || !i.tracked)) { toast('Record the yard inspection of every asset, with its serial number confirmed, to validate', 'error'); return; }
    validateReturnGrn(r.id, g.id); toast('Validated. The assets are in the yard and their status follows the inspection');
  };
  const inspAsset = insp ? assetById(g.items.find((i) => i.itemId === insp.itemId)?.assetId ?? '') : undefined;
  const okInspect = insp && insp.serial && (insp.res === 'Passed' ? insp.checks.length === YARD_CHECKLIST.length : (waiver || Number(insp.amount) > 0) && insp.note.trim());
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: BASE }, { label: `ID: ${r.number}`, to: `${BASE}/${r.id}` }, { label: 'Goods Receipt', to: `${BASE}/${r.id}/grn` }, { label: g.number }]} status={<StatusChip status={g.status} tone={tone(g.status)} />}
        actions={<>
          {!done && <MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${BASE}/${r.id}/grn/${g.id}/edit`) }, { label: 'Delete', onClick: () => setDel(true) }]} />}
          <Button variant="outlined" onClick={() => nav(`${BASE}/${r.id}`)}>View RMA</Button>
          {!done && <Button variant="contained" onClick={validate}>Validate</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <Section title="Customer Returns"><ValueGrid cols={4}><ValueField label="Goods Receipt No." value={g.number} /><ValueField label="Date" value={g.date} /><ValueField label="Customer" value={custName(r.customerId)} /><ValueField label="Return" value={r.number} /><ValueField label="Entity" value={r.entity} /><ValueField label="Currency" value={r.currency} /></ValueGrid></Section>
        <Section title="Items">
          <DataTable hideToolbar rows={g.items.map((i) => ({ ...i, id: i.itemId }))} columns={[
            { key: 'asset', label: 'Item', render: (i) => label(assetById(i.assetId)) }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'qty', label: 'Quantity', align: 'right', render: () => 1 },
            { key: 'yard', label: 'Yard', change: 'new', req: R.rreturn }, { key: 'reached', label: 'Reached Yard', change: 'new', req: R.rreturn },
            { key: 'serial', label: 'Serial Number', render: (i) => assetById(i.assetId)?.engineNo ?? '-' },
            { key: 'insp', label: 'Inspection Status', change: 'new', req: R.ret, render: (i) => (done ? <StatusChip status={i.inspection} tone={tone(i.inspection)} /> : <Button size="small" variant="outlined" onClick={() => setInsp({ serial: i.tracked, itemId: i.itemId, res: i.inspection === 'Damage Found' ? 'Damage Found' : 'Passed', checks: i.yardChecklist, amount: i.damageCharge ? String(i.damageCharge) : '', note: i.damageNote ?? '' })}>{i.inspection === 'Pending Inspection' ? 'Inspect' : i.inspection}</Button>) },
            { key: 'out', label: 'Outcome', render: (i) => i.outcome ?? '-' }, { key: 'dmg', label: 'Damage Charge', render: (i) => (i.waiverApplied ? 'Covered by damage waiver' : i.damageCharge ? aed(i.damageCharge) : '-') },
          ]} />
        </Section>
      </Page>
      <AppDialog open={!!insp} title="Yard inspection" onClose={() => setInsp(null)} maxWidth="md" confirmLabel="Save inspection" confirmDisabled={!okInspect}
        onConfirm={() => { if (!insp) return; upd(insp.itemId, { tracked: true, inspection: insp.res as 'Passed' | 'Damage Found', yardChecklist: insp.checks, damageCharge: insp.res === 'Damage Found' && !waiver ? Number(insp.amount) : undefined, damageNote: insp.res === 'Damage Found' ? insp.note : undefined }); setInsp(null); }}>
        {insp && <FormGrid cols={1}>
          <FormControlLabel sx={{ display: 'flex', bgcolor: '#F6F8F7', borderRadius: '8px', px: 1, mr: 0 }} control={<Checkbox size="small" checked={insp.serial} onChange={(e) => setInsp({ ...insp, serial: e.target.checked })} />} label={<Text type="s3">Serial number <b>{inspAsset?.engineNo ?? '-'}</b> ({inspAsset?.assetId}) matches the nameplate of the unit received</Text>} />
          <SelectInput label="Inspection Status" required value={insp.res} options={['Passed', 'Damage Found']} onChange={(v) => setInsp({ ...insp, res: v })} />
          <Box>{YARD_CHECKLIST.map((c) => <FormControlLabel key={c} sx={{ display: 'flex' }} control={<Checkbox size="small" checked={insp.checks.includes(c)} onChange={(e) => setInsp({ ...insp, checks: e.target.checked ? [...insp.checks, c] : insp.checks.filter((x) => x !== c) })} />} label={<Text type="s3">{c}</Text>} />)}
            <Text type="s5" color="theme.secondary.700">Operations Return Checklist, admin-configurable. {insp.res === 'Passed' ? 'Every item must be complete before the asset can become Ready for Hire.' : ''}</Text></Box>
          {insp.res === 'Damage Found' && waiver && <Alert severity="info">The client paid a damage waiver on {r.soNumber}. A damage invoice is not allowed; the repair cost is borne by the company.</Alert>}
          {insp.res === 'Damage Found' && <>{!waiver && <NumberInput label="Damage Charge (AED)" required value={insp.amount} onChange={(v) => setInsp({ ...insp, amount: v })} hint="Decided manually by an authorised user" />}<TextInput label="Justification" required multiline rows={2} value={insp.note} onChange={(v) => setInsp({ ...insp, note: v })} hint="Retained permanently against the originating order" /></>}
        </FormGrid>}
      </AppDialog>
      <ConfirmDialog open={del} title="Delete Goods Receipt" description={`Delete ${g.number}?`} danger confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => { deleteReturnGrn(r.id, g.id); toast('Deleted'); nav(`${BASE}/${r.id}`); }} />
    </>
  );
}
