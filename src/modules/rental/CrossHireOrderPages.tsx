import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import { Alert, Box, Button, Chip, IconButton, InputAdornment, LinearProgress, ToggleButton, ToggleButtonGroup, Tooltip, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { neutral } from '@/theme/color';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FieldError, FileInput, FormGrid, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { suppliers } from '@/mock-data/masters';
import { DEPARTMENTS, RENTAL_DURATIONS, TODAY, custName, categoryOptions, groupOptions, stockLocations, masterValues, unitsOf, fleetRows, chItems, reqItems, itemReceived, type CrossHire, type CrossHireGrn } from '@/modules/crm/data';
import { createChOrderFromForm, createGrn, deleteGrn, saveChOrder, saveGrn, validateGrn } from '@/modules/crm/flow';
import { Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { addressSpecs, useAddressAutofill, type AddressCfg } from '@/modules/crm/addressKit';
import { R8, aed, useChRequests, useChRfqs, useCrossHire, useOrders } from '@/modules/crm/shared';
import { rfqItems } from './CrossHireRfqPages';

const HIRE_SUPPLIERS = suppliers.filter((s) => s.type === 'Cross-Hire Company');
const supOpts = HIRE_SUPPLIERS.map((s) => ({ value: s.id, label: s.name }));
const R_CH = 'Existing ERP Cross Hire Orders and GRN; Rental > Cross-Hire (Rental Side)';
const R_CTX = R8('Sales Order context carried to the Cross-Hire order');
const R_SEP = R8('Category and Subcategory shown separately, as on the Sales Order');
const R_BM = R8('Optional Brand and Model when tracing a hired asset');

/* ------------------------------------------------------------------ Order add / edit form (existing ERP: Basic Details, Address & Contact) */
const orderSpecs = (soOpts: { value: string; label: string }[], fromRfq: boolean): Spec[] => [
  { key: 'company', label: 'Entity', type: 'master', master: 'entity', required: true },
  { key: 'number', label: 'Hire Order No.', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'soId', label: 'Rental Order ID (optional)', type: 'select', options: soOpts, disabled: fromRfq, hint: 'The demand this order is raised for. Units are bound to a Sales Order at the Delivery Order, not here' },
  { key: 'project', label: 'Project (Cost Centre)', type: 'readonly', change: 'new', req: R_CTX, hint: 'Fetched from the Sales Order' },
  { key: 'activity', label: 'Activity Type', type: 'readonly', change: 'new', req: R_CTX, hint: 'Fetched from the Sales Order' },
  { key: 'customer', label: 'Customer', type: 'readonly', change: 'new', req: R_CTX, hint: 'Fetched from the Sales Order' },
  { key: 'site', label: 'Delivery Site', type: 'readonly', change: 'new', req: R_CTX, show: (f) => f.type === 'Dropship', hint: 'Dropship: the supplier delivers straight to this site' },
  { key: 'supplierId', label: 'Supplier', type: 'select', options: supOpts, required: true, disabled: fromRfq, hint: 'Suppliers of type Cross-Hire Company' },
  { key: 'type', label: 'Cross Hire Type', type: 'select', options: ['Inventory', 'Dropship'], required: true },
  { key: 'confirmationDate', label: 'Confirmation Date', type: 'date', required: true },
  { key: 'expectedReceipt', label: 'Expected Receipt Date', type: 'date', required: true },
  { key: 'terms', label: 'Terms & Conditions' }, { key: 'agreement', label: 'Agreement' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', disabled: (f) => f.currency === 'AED', value: (f) => (f.currency === 'AED' ? 1 : f.exchangeRate) },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'master', master: 'paymentTerms', required: true },
  { key: 'representative', label: 'Purchase Representative', type: 'select', options: ['Leena Thomas', 'Yousef Karim', 'Omar Farouk', 'Bilal Ahmed'] },
  { key: 'reference', label: 'Reference Number' }, { key: 'incoterm', label: 'Incoterm' },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const rentalPeriodSpecs: Spec[] = [
  { key: 'startDate', label: 'Select Start Date & Time', type: 'date', required: true },
  { key: 'endDate', label: 'Select End Date & Time', type: 'date' },
  { key: 'totalPeriod', label: 'Total Period', type: 'readonly', value: (f) => (f.startDate && f.endDate ? `${Math.max(0, Math.round((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000))} day(s)` : '-') },
];
const itemSpecs: Spec[] = [
  { key: 'duration', label: 'Rental Duration Type', type: 'select', options: RENTAL_DURATIONS }, { key: 'location', label: 'Location', type: 'select', options: stockLocations },
];
type OItem = { id: string; group: string; category: string; qty: number | string; rate: number | string; lineId?: string };
const classSpecs: Spec[] = [{ key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
/** Address & Contact of the existing Cross Hire Order: the supplier's addresses and contacts, and the Entity's locations. */
const orderAddrCfg: AddressCfg = { party: 'supplier', partyId: (f) => f.supplierId, entity: (f) => f.company };
const orderAddr = addressSpecs(orderAddrCfg);

export function ChOrderForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const all = useCrossHire();
  const rfqs = useChRfqs();
  const existing = all.get(id);
  const rfq = rfqs.get(sp.get('rfq') ?? existing?.rfqId ?? undefined);
  // Create > Order on a request or on Process Cross Hire opens this form prefilled with the selected items; delete the rows you do not want to order now.
  const reqAll = useChRequests();
  const fromReqs = !existing && !rfq ? (sp.get('requests') ?? '').split(',').map((x) => reqAll.get(x)).filter(Boolean) as NonNullable<ReturnType<typeof reqAll.get>>[] : [];
  const r0 = fromReqs[0];
  const award = rfq?.responses.find((x) => x.vendorId === rfq.awardedVendorId);
  const rentals = orders.rows.filter((o) => o.activity === 'Rental');
  const so0 = rentals.find((o) => rfq?.soNumbers.includes(o.number) || o.id === r0?.soId);
  const reqRows = (sp.get('rows') ?? '').split(',').filter(Boolean).map((x) => x.split('|'));
  const initialItems = (): OItem[] => {
    if (existing) return chItems(existing).map((i) => ({ ...i }));
    if (rfq) return rfqItems(rfq, reqAll.rows).map((i) => ({ id: i.id, group: i.group, category: i.category, qty: i.qty, rate: award?.rate ?? '', lineId: reqAll.rows.filter((q) => rfq.requestIds.includes(q.id)).flatMap((q) => reqItems(q)).find((x) => x.group === i.group && x.category === i.category)?.lineId }));
    if (fromReqs.length) {
      const items = fromReqs.flatMap((q) => reqItems(q).filter((it) => !it.orderId && !it.rfqId).map((it) => ({ q, it, over: reqRows.find((x) => x[0] === q.id && x[1] === it.lineId) })).filter((x) => !reqRows.length || x.over));
      return items.map(({ q, it, over }) => ({ id: `${q.id}|${it.lineId}`, group: it.group, category: it.category, qty: Number(over?.[2]) || it.qty, rate: it.rate || q.rate || '', lineId: it.lineId }));
    }
    return [{ id: 'i0', group: '', category: '', qty: 1, rate: '' }];
  };
  const [items, setItems] = useState<OItem[]>(initialItems);
  const line0 = so0?.lines.find((l) => l.id === items[0]?.lineId);
  const [f, setF] = useState<Record<string, any>>(() => existing
    ? { ...existing.form, number: existing.number, date: existing.date, soId: existing.soId, supplierId: existing.supplierId, type: existing.type ?? 'Inventory', confirmationDate: existing.confirmationDate, expectedReceipt: existing.expectedReceipt, paymentTerms: existing.paymentTerms, startDate: existing.startDate, endDate: existing.endDate }
    : { date: TODAY, company: masterValues('entity')[0], currency: 'AED', type: sp.get('type') === 'Dropship' ? 'Dropship' : 'Inventory', paymentTerms: rfq?.paymentTerms ?? '30 days', representative: 'Bilal Ahmed', department: 'Operations', location: 'Jebel Ali Main Yard', duration: 'Monthly',
      confirmationDate: TODAY, expectedReceipt: rfq?.expectedDate ?? TODAY, startDate: rfq?.start ?? line0?.start ?? so0?.contractStart, endDate: rfq?.end ?? line0?.end ?? so0?.contractEnd, supplierId: award?.vendorId ?? r0?.vendorId ?? '', soId: so0?.id ?? '', narration: rfq ? `From ${rfq.number}, awarded to ${award?.vendor ?? ''}` : '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  useAddressAutofill(f, set, orderAddrCfg);
  const setItem = (i: number, p: Partial<OItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const total = items.reduce((n, i) => n + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  // Project, Activity Type, Customer and Site come from the selected Sales Order (read-only, 8 Oct call).
  const soSel = orders.get(f.soId);
  const ctxView = { ...f, project: soSel?.costCentre ?? '-', activity: soSel ? 'Rental' : '-', customer: soSel ? custName(soSel.customerId) : '-', site: soSel?.site ?? '-' };
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    (draft ? ['supplierId'] : ['date', 'supplierId', 'type', 'company', 'confirmationDate', 'expectedReceipt', 'currency', 'paymentTerms', 'startDate', 'supplierAddress', 'contactPerson', 'shippingAddress']).forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = 'End must be after start';
    const used = items.filter((i) => i.group && i.category);
    if (!draft || used.length) {
      if (!used.length) e.items = 'Please add atleast one Item';
      else if (used.some((i) => !(Number(i.qty) > 0) || (!draft && !(Number(i.rate) > 0)))) e.items = 'Every item needs its units and rate per unit';
      else if (new Set(used.map((i) => `${i.group}|${i.category}`)).size !== used.length) e.items = 'Each Category and Subcategory can be on one row only';
      else if (items.some((i) => !i.group || !i.category)) e.items = 'Choose the Category and Subcategory on every row, or delete the row';
    }
    setErr(e);
    if (Object.keys(e).length) { toast(e.items ?? 'Please complete the mandatory fields', 'error'); return; }
    const sup = HIRE_SUPPLIERS.find((s) => s.id === f.supplierId)!;
    const clean = used.map((i) => ({ group: i.group, category: i.category, qty: Number(i.qty), rate: Number(i.rate) || 0, lineId: i.lineId }));
    if (existing) {
      const so = orders.get(f.soId);
      const its = clean.map((c, k) => ({ id: `${existing.id}-i${k}`, ...c, lineId: c.lineId ?? so?.lines.find((l) => l.activity === 'Rental' && l.group === c.group && l.category === c.category)?.id }));
      saveChOrder(existing.id, { project: so?.costCentre, customerId: so?.customerId, site: so?.site, date: f.date, supplierId: sup.id, supplier: sup.name, type: f.type, items: its, group: its[0].group, category: its[0].category, qty: its.reduce((n, x) => n + x.qty, 0), rate: its.reduce((n, x) => n + x.qty * x.rate, 0), soId: f.soId ?? '', confirmationDate: f.confirmationDate, expectedReceipt: f.expectedReceipt, paymentTerms: f.paymentTerms, startDate: f.startDate, endDate: f.endDate, form: f, status: draft ? 'Draft' : existing.status === 'Draft' || existing.status === 'Rejected' ? 'Pending' : existing.status });
      toast('Order updated'); nav(`/rental/cross-hire-orders/${existing.id}`); return;
    }
    const nid = createChOrderFromForm({ supplierId: sup.id, supplier: sup.name, soId: f.soId || undefined, items: clean, type: f.type, draft, rfqId: rfq?.id, requestIds: rfq?.requestIds ?? fromReqs.map((r) => r.id), form: f });
    toast(draft ? 'Order saved as draft' : 'Order saved'); nav(`/rental/cross-hire-orders/${nid}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: existing ? `Edit ${existing.number}` : 'Add New' }]}
        actions={<><Button variant="text" onClick={() => nav(existing ? `/rental/cross-hire-orders/${existing.id}` : '/rental/cross-hire-orders')}>Discard</Button>{(!existing || existing.status === 'Draft') && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>{existing ? 'Save' : 'Submit'}</Button></>} />
      <Page sx={{ pt: 2 }}>
        {fromReqs.length > 0 && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from {fromReqs.map((r) => r.number).join(', ')}: the items of the request, with their units. Delete the rows you do not want to order now (the request stays In Progress for them), then enter the supplier and the rate per unit.</Alert>}
        {rfq && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from {rfq.number}: supplier, rate and rental period come from the awarded response. Delete the rows you do not want to order now.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={orderSpecs(rentals.map((o) => ({ value: o.id, label: o.number })), !!rfq && !!so0)} f={ctxView} set={set} err={err} />
              <Section title="Rental Period"><SpecForm specs={rentalPeriodSpecs} f={f} set={set} err={err} cols={3} /></Section>
              <Section title="Items" change="changed" req={R_CH}>
                <SpecForm specs={itemSpecs} f={f} set={set} err={err} cols={3} />
                <FieldError label="Items" error={err.items} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 1 }}><Button size="small" variant="outlined" onClick={() => setItems([...items, { id: `i${Date.now().toString(36)}${items.length}`, group: '', category: '', qty: 1, rate: '' }])}>+ Add</Button></Box>
                <TableContainer sx={{ border: '1px solid #E4E5E7', borderRadius: '8px', maxWidth: '100%' }}>
                  <Table size="small">
                    <TableHead><TableRow sx={{ bgcolor: '#F6F8F7' }}>{['Category', 'Subcategory', 'UoM', 'Units', 'Rate (per unit, AED)', 'Amount', ''].map((h) => <TableCell key={h} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</TableCell>)}</TableRow></TableHead>
                    <TableBody>
                      {items.length === 0 && <TableRow><TableCell colSpan={7}><Text type="s4" color="theme.secondary.700">No item left. Add a row.</Text></TableCell></TableRow>}
                      {items.map((it, i) => (
                        <TableRow key={it.id}>
                          <TableCell sx={{ py: 0.5, minWidth: 170 }}><Select size="small" displayEmpty fullWidth value={it.group} sx={{ fontSize: 13 }} onChange={(e) => setItem(i, { group: e.target.value, category: '' })}><MenuItem value="" disabled>Category</MenuItem>{groupOptions().map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</Select></TableCell>
                          <TableCell sx={{ py: 0.5, minWidth: 170 }}><Select size="small" displayEmpty fullWidth value={it.category} sx={{ fontSize: 13 }} onChange={(e) => setItem(i, { category: e.target.value })}><MenuItem value="" disabled>Subcategory</MenuItem>{(it.group ? categoryOptions(it.group) : []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select></TableCell>
                          <TableCell>Nos</TableCell>
                          <TableCell sx={{ py: 0.5 }}><TextField size="small" type="number" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} sx={{ width: 90 }} inputProps={{ min: 1 }} /></TableCell>
                          <TableCell sx={{ py: 0.5 }}><TextField size="small" type="number" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} sx={{ width: 130 }} /></TableCell>
                          <TableCell align="right">{aed((Number(it.qty) || 0) * (Number(it.rate) || 0))}</TableCell>
                          <TableCell><IconButton size="small" onClick={() => setItems(items.filter((_, j) => j !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} unit(s), total {aed(total)} before VAT. The assets themselves are defined on the Goods Receipt, one fixed asset is one unit.</Text>
              </Section>
              <Section title="Attachment"><FileInput label="Attachment" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
              <Section title="Classification"><SpecForm specs={classSpecs} f={f} set={set} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecForm specs={orderAddr} f={f} set={set} err={err} /> },
        ]} />
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Goods Receipt Note (separate form, created from the approved order) */
const grnStatus = (g: CrossHireGrn) => (g.validated ? 'Validated' : 'Pending');
const grnSpecs: Spec[] = [
  { key: 'company', label: 'Entity', type: 'readonly' },
  { key: 'number', label: 'Goods Receipt No.', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Receipt Date', type: 'date', required: true },
  { key: 'vendor', label: 'Vendor', type: 'readonly' },
  { key: 'soNumber', label: 'Rental Order', type: 'readonly', change: 'new', req: R_CTX },
  { key: 'project', label: 'Project', type: 'readonly', change: 'new', req: R_CTX },
  { key: 'currency', label: 'Currency', type: 'readonly' },
  { key: 'receivedBy', label: 'Received By', type: 'select', options: ['Sanjay Kumar', 'Bilal Ahmed', 'Omar Farouk'] },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const transportSpecs: Spec[] = [{ key: 'transportedBy', label: 'Transported By' }, { key: 'driver', label: 'Driver' }, { key: 'driverId', label: 'ID' }, { key: 'vehicle', label: 'Vehicle Number' }];
const grnClass: Spec[] = [{ key: 'location', label: 'Location', type: 'select', options: stockLocations }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
const grnAddr = addressSpecs(orderAddrCfg);

export function ChGrnList() {
  const { id } = useParams();
  const nav = useNavigate();
  const c = useCrossHire().get(id);
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: `/rental/cross-hire-orders/${c.id}` }, { label: 'Goods Receipt' }]} />
      <Page>
        <PageTitle title="Goods Receipt" subtitle="Goods Receipt Notes are created from the Receive button of an approved Inventory order" change="new" req={R_CH} />
        <DataTable<CrossHireGrn> hideToolbar rows={c.grns ?? []} emptyText="No goods receipt yet" onRowClick={(g) => nav(`/rental/cross-hire-orders/${c.id}/grns/${g.id}`)}
          columns={[{ key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor', render: () => c.supplier }, { key: 'company', label: 'Entity', render: () => c.form?.company ?? masterValues('entity')[0] }, { key: 'currency', label: 'Currency', render: () => c.form?.currency ?? 'AED' }, { key: 'status', label: 'Status', render: (g) => <StatusChip status={grnStatus(g)} /> }]} />
      </Page>
    </>
  );
}

export function ChGrnForm() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const c = useCrossHire().get(id);
  const orders = useOrders();
  const g0 = (c?.grns ?? []).find((x) => x.id === gid);
  const [f, setF] = useState<Record<string, any>>(() => ({ date: TODAY, receivedBy: 'Sanjay Kumar', transportedBy: c?.supplier ?? '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], ...g0 }));
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  // Address & Contact: the order's supplier and entity decide the options, and the first or default one is filled in.
  const setAddr = (k: string, v: any) => setF((x) => ({ ...x, address: { ...(x.address ?? {}), [k]: v } }));
  const addrF = { ...(f.address ?? {}), supplierId: c?.supplierId, company: c?.form?.company ?? masterValues('entity')[0] };
  useAddressAutofill(addrF, setAddr, orderAddrCfg, !!c);
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" /></Page>;
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.date) e.date = 'This field is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const { number, vendor, currency, company, ...rest } = f;
    void number; void vendor; void currency; void company;
    const { qty, traces, validated, ...head } = rest as any;
    void qty; void traces; void validated;
    const gid2 = g0 ? g0.id : createGrn(c.id, head);
    if (g0) saveGrn(c.id, g0.id, head);
    toast('Goods Receipt Note saved successfully. Add the assets received with Track Details, then Validate.');
    nav(`/rental/cross-hire-orders/${c.id}/grns/${gid2}`);
  };
  const view = { ...f, vendor: c.supplier, soNumber: c.soNumber || 'Not tied to an order', project: c.project ?? orders.get(c.soId)?.costCentre ?? '-', currency: c.form?.currency ?? 'AED', company: c.form?.company ?? masterValues('entity')[0] };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: `/rental/cross-hire-orders/${c.id}` }, { label: 'Goods Receipt', to: `/rental/cross-hire-orders/${c.id}/grns` }, { label: g0 ? `Edit ${g0.number}` : 'Add New' }]}
        actions={<><Button variant="text" onClick={() => nav(`/rental/cross-hire-orders/${c.id}/grns`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={grnSpecs} f={view} set={set} err={err} />
              <Section title="Items">
                <DataTable hideToolbar rows={chItems(c).map((i) => ({ ...i, id: i.id }))} columns={[
                  { key: 'grp', label: 'Category', change: 'changed', req: R_SEP, render: (i) => i.group }, { key: 'cat', label: 'Subcategory', change: 'changed', req: R_SEP, render: (i) => i.category }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'line', label: 'Order Line', render: () => c.number },
                  { key: 'ord', label: 'Units ordered', align: 'right', render: (i) => i.qty }, { key: 'got', label: 'Assets received', align: 'right', render: (i) => itemReceived(c, i) }, { key: 'rem', label: 'Remaining', align: 'right', render: (i) => Math.max(0, i.qty - itemReceived(c, i)) },
                ]} />
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>The assets received are added on the Goods Receipt page with Track Details, one serial number for each unit.</Text>
              </Section>
              <Section title="Transportation"><SpecForm specs={transportSpecs} f={f} set={set} cols={4} /></Section>
              <Section title="Classification"><SpecForm specs={grnClass} f={f} set={set} /></Section>
              <Section title="Attachment"><FileInput label="Attachment" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecForm specs={grnAddr} f={addrF} set={setAddr} /> },
        ]} />
      </Page>
    </>
  );
}

type Trace = CrossHireGrn['traces'][number];
const CONDITIONS: NonNullable<Trace['condition']>[] = ['OK', 'Needs check', 'Damaged'];
/** A new row takes the Category and Subcategory of the first item that still has units to come (rows already on the receipt count). */
const blankTrace = (c: CrossHire, taken: Trace[] = []): Trace => {
  const pick = chItems(c).find((i) => i.qty - itemReceived(c, i) - taken.filter((t) => t.group === i.group && t.category === i.category).length > 0) ?? chItems(c)[0];
  return { serial: '', group: pick.group, category: pick.category, condition: 'OK' };
};
const blanks = (c: CrossHire, n: number, taken: Trace[] = []): Trace[] => { const out: Trace[] = []; for (let k = 0; k < n; k += 1) out.push(blankTrace(c, [...taken, ...out])); return out; };
/** Per-row problems found while receiving: missing or duplicate serial (also against the register). */
const traceIssues = (rows: Trace[], validated = false) => rows.map((r, i) => {
  const sn = r.serial.trim();
  if (!sn) return 'Serial number missing';
  if (rows.some((x, j) => j !== i && x.serial.trim() === sn)) return 'Duplicate serial on this receipt';
  if (!validated && fleetRows().some((a) => a.engineNo === sn)) return 'Serial already on the register';
  return '';
});

/**
 * Track Details of one item of the Goods Receipt. A scan-first layout: progress against the units ordered at the top, one box to scan or type a serial number
 * (Enter adds it), and each asset as one compact line with its condition as a three-way switch, a photo, a note and a check. 1 fixed asset = 1 unit.
 */
const COND_TONE: Record<string, string> = { OK: '#2EB273', 'Needs check': '#D9A400', Damaged: '#C64D4D' };
function TraceDialog({ c, g, itemId, all, room, onClose, onSave }: { c: CrossHire; g: CrossHireGrn; itemId: string; all: Trace[]; room: number; onClose: () => void; onSave: (rows: Trace[]) => void }) {
  const items = chItems(c);
  const item = items.find((i) => i.id === itemId);
  const match = (t: Trace) => (item ? t.group === item.group && t.category === item.category : !items.some((i) => i.group === t.group && i.category === t.category));
  const outside = all.filter((t) => !match(t));
  const [mine, setMine] = useState<Trace[]>(() => all.filter(match));
  const [serial, setSerial] = useState('');
  const [bulk, setBulk] = useState(false);
  const [text, setText] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [chg, setChg] = useState<number | null>(null);
  const done = g.validated;
  const issues = traceIssues([...outside, ...mine], g.validated).slice(outside.length);
  const set = (i: number, p: Partial<Trace>) => setMine(mine.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const catOpts = [...items.map((i) => ({ v: `${i.group}|${i.category}`, l: `${i.group} ${i.category}` })), ...groupOptions().flatMap((gr) => categoryOptions(gr).map((ca) => ({ v: `${gr}|${ca}`, l: `${gr} ${ca} (not on the order)` }))).filter((o) => !items.some((i) => `${i.group}|${i.category}` === o.v))];
  const used = outside.length + mine.length;
  const fresh = (sn: string): Trace => ({ serial: sn, group: item?.group ?? mine[0]?.group ?? items[0].group, category: item?.category ?? mine[0]?.category ?? items[0].category, condition: 'OK' });
  const add = () => { const sn = serial.trim(); if (!sn || used >= room) return; setMine([...mine, fresh(sn)]); setSerial(''); };
  const addAll = () => {
    const list = text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, Math.max(0, room - used));
    setMine([...mine, ...list.map(fresh)]); setText(''); setBulk(false);
  };
  const bad = issues.some((x) => !!x);
  const ordered = item?.qty ?? 0;
  const got = item ? itemReceived(c, item) : 0;
  const pct = ordered ? Math.min(100, ((got + mine.length) / ordered) * 100) : 0;
  const stat = (k: string, v: string | number, hot?: boolean) => <Box sx={{ flex: 1, minWidth: 90, p: 1.25, borderRadius: '10px', bgcolor: hot ? '#E8F5F0' : '#F6F8F7' }}><Text type="s5" color="theme.secondary.700">{k}</Text><Text type="s2" weight="medium">{v}</Text></Box>;
  return (
    <AppDialog open title={`Track Details: ${item ? `Category ${item.group}, Subcategory ${item.category}` : 'Not on the order'}`} onClose={onClose} maxWidth="md" confirmLabel={done ? undefined : 'Save'} confirmDisabled={bad} onConfirm={done ? undefined : () => onSave([...outside, ...mine.filter((r) => r.serial.trim()).map((r) => ({ ...r, serial: r.serial.trim() }))])}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        {stat('Ordered', item ? ordered : '-')}{stat('Received so far', item ? got : '-')}{stat('On this receipt', mine.length, true)}{stat('Still to come', item ? Math.max(0, ordered - got - mine.length) : '-')}
      </Box>
      {item && <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3, mb: 2, bgcolor: '#E4E5E7', '& .MuiLinearProgress-bar': { bgcolor: '#2EB273' } }} />}
      {!done && (
        <Box sx={{ mb: 2 }}>
          {!bulk ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth size="small" autoFocus placeholder={used >= room ? 'All the units still to come are on this receipt' : 'Scan or type a serial number and press Enter'} value={serial} disabled={used >= room}
                onChange={(e) => setSerial(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlinedIcon fontSize="small" /></InputAdornment> }} />
              <Button variant="contained" disabled={!serial.trim() || used >= room} onClick={add}>Add</Button>
              <Button variant="text" onClick={() => setBulk(true)}>Paste several</Button>
            </Box>
          ) : (
            <Box>
              <TextField fullWidth multiline minRows={3} size="small" placeholder="Paste the serial numbers, separated by spaces, commas or new lines" value={text} onChange={(e) => setText(e.target.value)} />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}><Button variant="text" onClick={() => setBulk(false)}>Cancel</Button><Button variant="contained" disabled={!text.trim()} onClick={addAll}>Add all</Button></Box>
            </Box>
          )}
        </Box>
      )}
      {mine.length === 0 ? (
        <Box sx={{ border: '1px dashed #C9CACC', borderRadius: '10px', p: 4, textAlign: 'center' }}><Text type="s3" color="theme.secondary.700">{done ? 'No asset on this receipt' : 'No asset yet. Scan or type the first serial number above.'}</Text></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {mine.map((r, i) => {
            const cond = r.condition ?? 'OK';
            const diff = !items.some((x) => x.group === r.group && x.category === r.category);
            const err = issues[i] && r.serial ? issues[i] : '';
            return (
              <Box key={i} sx={{ border: '1px solid #E4E5E7', borderLeft: `4px solid ${err ? '#C64D4D' : COND_TONE[cond]}`, borderRadius: '10px', p: 1.25, bgcolor: cond === 'Damaged' ? '#FFF8F8' : '#fff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Text type="s5" color="theme.secondary.700" sx={{ width: 20 }}>{i + 1}</Text>
                  <Box sx={{ width: 190 }}>{done ? <Text type="s3" weight="medium">{r.serial}</Text> : <TextField size="small" variant="standard" value={r.serial} error={!!err} onChange={(e) => set(i, { serial: e.target.value })} inputProps={{ style: { fontWeight: 600 } }} />}</Box>
                  {(done || (!diff && chg !== i)) ? <Tooltip title={done ? '' : 'Received as a different Category? Click to change'}><Chip size="small" variant="outlined" label={`${r.group} ${r.category}`} onClick={done ? undefined : () => setChg(i)} /></Tooltip> : null}
                  {!done && (diff || chg === i) && <Select size="small" value={`${r.group}|${r.category}`} sx={{ fontSize: 12, minWidth: 190 }} onChange={(e) => { const [group, category] = String(e.target.value).split('|'); set(i, { group, category }); setChg(null); }}>{catOpts.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}</Select>}
                  {done ? (r.brand || r.model) && <Text type="s4" color="theme.secondary.700">{[r.brand, r.model].filter(Boolean).join(' ')}</Text> : (
                    <>
                      <TextField size="small" variant="standard" placeholder="Brand (optional)" value={r.brand ?? ''} onChange={(e) => set(i, { brand: e.target.value })} sx={{ width: 120 }} />
                      <TextField size="small" variant="standard" placeholder="Model (optional)" value={r.model ?? ''} onChange={(e) => set(i, { model: e.target.value })} sx={{ width: 120 }} />
                    </>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <ToggleButtonGroup exclusive size="small" value={cond} disabled={done} onChange={(_, v) => v && set(i, { condition: v })}>
                    {['OK', 'Needs check', 'Damaged'].map((k) => <ToggleButton key={k} value={k} sx={{ px: 1.25, py: 0.25, fontSize: 12, textTransform: 'none', '&.Mui-selected': { bgcolor: COND_TONE[k], color: '#fff', '&:hover': { bgcolor: COND_TONE[k] } } }}>{k}</ToggleButton>)}
                  </ToggleButtonGroup>
                  <Tooltip title={r.photo ?? 'Add a photo'}><span><IconButton size="small" component="label" disabled={done} color={r.photo ? 'success' : 'default'}><PhotoCameraOutlinedIcon fontSize="small" /><input hidden type="file" accept="image/*" onChange={(e) => set(i, { photo: e.target.files?.[0]?.name })} /></IconButton></span></Tooltip>
                  <Tooltip title={r.remarks || 'Add a remark'}><IconButton size="small" color={r.remarks ? 'primary' : 'default'} onClick={() => setOpen(open === i ? null : i)}><NotesOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                  {done ? <StatusChip status={fleetRows().find((a) => a.engineNo === r.serial)?.assetId ?? 'Registered'} tone="green" /> : err ? <Tooltip title={err}><ErrorOutlineIcon fontSize="small" sx={{ color: '#C64D4D' }} /></Tooltip> : <CheckCircleOutlineIcon fontSize="small" sx={{ color: '#2EB273' }} />}
                  {!done && <IconButton size="small" onClick={() => { setMine(mine.filter((_, j) => j !== i)); setOpen(null); }}><DeleteOutlineIcon fontSize="small" /></IconButton>}
                </Box>
                {err && <Text type="s5" color="#C64D4D" sx={{ ml: 4, mt: 0.25 }}>{err}</Text>}
                {(open === i || (done && r.remarks)) && <Box sx={{ ml: 4, mt: 1 }}>{done ? <Text type="s4">{r.remarks}</Text> : <TextField fullWidth size="small" placeholder="Remark on this asset" value={r.remarks ?? ''} onChange={(e) => set(i, { remarks: e.target.value })} />}</Box>}
              </Box>
            );
          })}
        </Box>
      )}
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1.5 }}>{mine.filter((r) => r.condition === 'Damaged').length} damaged. Validate puts each asset on the Fixed Asset Register as Cross-Hired; a damaged unit enters as Under Maintenance. Serial numbers must be new to the register. Brand and Model are optional, they help to recognise a hired unit among the owned ones.</Text>
    </AppDialog>
  );
}

export function ChGrnView() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const c = useCrossHire().get(id);
  const orders = useOrders();
  const g = (c?.grns ?? []).find((x) => x.id === gid);
  const room = c && g ? Math.max(0, (c.qty ?? 1) - unitsOf(c).length - (c.grns ?? []).filter((x) => x.id !== g.id && !x.validated).reduce((n, x) => n + x.traces.length, 0)) : 0;
  const [trk, setTrk] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!c || !g) return <Page><PageTitle title="Goods Receipt not found" /></Page>;
  const cur = g.traces;
  const issues = traceIssues(cur, g.validated);
  const base = `/rental/cross-hire-orders/${c.id}`;
  const clean = (r: Trace[]) => r.map((t) => ({ ...t, serial: t.serial.trim() }));
  const tryValidate = () => {
    if (!cur.length) { toast('Please add the tracking details to validate', 'error'); return; }
    if (issues.some(Boolean)) { toast('Fix the highlighted rows first', 'error'); return; }
    setPreview(true);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: base }, { label: 'Goods Receipt', to: `${base}/grns` }, { label: g.number }]} status={<StatusChip status={grnStatus(g)} />}
        actions={<>
          {!g.validated && <MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${base}/grns/${g.id}/edit`) }, { label: 'Delete', onClick: () => setDel(true) }]} />}
          {!g.validated && <Button variant="contained" onClick={tryValidate}>Validate</Button>}
          {g.validated && <Button variant="outlined" onClick={() => toast('Labels with QR code sent to the printer', 'info')}>Print Labels</Button>}
          {g.validated && <Button variant="outlined" onClick={() => nav(base)}>View Order</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={[...grnSpecs.filter((s) => s.key !== 'narration' && s.key !== 'number'), { key: 'narration', label: 'Narration' }]} f={{ ...g, vendor: c.supplier, soNumber: c.soNumber || 'Not tied to an order', project: c.project ?? orders.get(c.soId)?.costCentre ?? '-', currency: c.form?.currency ?? 'AED', company: c.form?.company ?? masterValues('entity')[0] }} />
              <Section title="Items">
                <DataTable hideToolbar rows={[...chItems(c).map((i) => ({ ...i, id: i.id, other: false })), ...(cur.some((t) => !chItems(c).some((i) => i.group === t.group && i.category === t.category)) ? [{ id: 'other', group: 'Not on the order', category: '', qty: 0, rate: 0, other: true }] : [])]} columns={[
                  { key: 'grp', label: 'Category', change: 'changed', req: R_SEP, render: (i) => i.group }, { key: 'cat', label: 'Subcategory', change: 'changed', req: R_SEP, render: (i) => (i.other ? '-' : i.category) }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'line', label: 'Order Line', render: () => c.number },
                  { key: 'ord', label: 'Units ordered', align: 'right', render: (i) => (i.other ? '-' : i.qty) }, { key: 'got', label: 'Assets received', align: 'right', render: (i) => (i.other ? '-' : itemReceived(c, i)) },
                  { key: 'rem', label: 'Remaining', align: 'right', render: (i) => (i.other ? '-' : Math.max(0, i.qty - itemReceived(c, i))) },
                  { key: 'this', label: 'On this receipt', change: 'changed', req: R_CH, align: 'right', render: (i) => cur.filter((t) => (i.other ? !chItems(c).some((x) => x.group === t.group && x.category === t.category) : t.group === i.group && t.category === i.category)).length },
                  { key: 'track', label: 'Track Details', render: (i) => { const n = cur.filter((t) => (i.other ? !chItems(c).some((x) => x.group === t.group && x.category === t.category) : t.group === i.group && t.category === i.category)).length; return <IconButton size="small" disabled={g.validated && !n} onClick={() => setTrk(i.id)}>{n ? <CheckCircleOutlineIcon sx={{ color: '#2EB273' }} /> : <AddCircleOutlineIcon />}</IconButton>; } },
                ]} />
              </Section>
              <Section title="Transportation"><SpecView specs={transportSpecs} f={g} /></Section>
              <Section title="Classification"><SpecView specs={grnClass} f={g} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecView specs={grnAddr} f={g.address ?? {}} /> },
        ]} />
      </Page>
      {trk && <TraceDialog c={c} g={g} itemId={trk} all={cur} room={room} onClose={() => setTrk(null)} onSave={(rows) => { saveGrn(c.id, g.id, { traces: rows }); setTrk(null); toast('Traceability is Completed.'); }} />}
      <ConfirmDialog open={preview} info title="Validate Goods Receipt" confirmLabel="Validate" onClose={() => setPreview(false)}
        description={`These ${cur.length} asset(s) will be added to the register as Cross-Hired (no depreciation): ${cur.map((t) => `${t.serial.trim()} as ${t.brand ? `${t.brand}${t.model ? ` ${t.model}` : ''} ` : ''}${t.group} ${t.category}${t.condition === 'Damaged' ? ' (Damaged, Under Maintenance)' : ''}`).join('; ')}.`}
        onConfirm={() => { saveGrn(c.id, g.id, { traces: clean(cur) }); validateGrn({ ...c, grns: (c.grns ?? []).map((x) => (x.id === g.id ? { ...x, traces: clean(cur) } : x)) }, g.id); setPreview(false); toast(`${cur.length} asset(s) validated and on the Fixed Asset Register`); }} />
      <ConfirmDialog open={del} title="Delete Goods Receipt" description={`Delete ${g.number}?`} danger confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => { deleteGrn(c.id, g.id); toast('Deleted'); nav(`${base}/grns`); }} />
    </>
  );
}
