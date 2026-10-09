import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, IconButton, Slider, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { DataTable } from '@/components/DataTable';
import { Timeline } from '@/components/Flow';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, FormGrid, MultiSelectInput, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { suppliers } from '@/mock-data/masters';
import { reqItems, CH_RFQ_STATUSES, DEPARTMENTS, RENTAL_DURATIONS, TODAY, categoryOptions, groupOptions, masterValues, stockLocations, type CrossHireRequest, type CrossHireRfq, type RfqItem, type RfqResponse } from '@/modules/crm/data';
import { addChResponse, awardChRfq, cancelChRfq, createChRfq, deleteChResponse, deleteChRfq, saveChRfq, sendChRfq } from '@/modules/crm/flow';
import { Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { addressSpecs, useAddressAutofill, type AddressCfg } from '@/modules/crm/addressKit';
import { R8, aed, useChRequests, useChRfqs, useCrossHire } from '@/modules/crm/shared';
import { neutral } from '@/theme/color';

const HIRE_SUPPLIERS = suppliers.filter((s) => s.type === 'Cross-Hire Company');
const supOpts = HIRE_SUPPLIERS.map((s) => ({ value: s.id, label: s.name }));
const R_CH = 'Existing ERP Cross Hire Request for Quote; Procurement > Cross-Hire Suppliers';
const R_SEP = R8('Category and Subcategory shown separately, as on the Sales Order');
const BASE = '/rental/cross-hire-rfq';

/** Items of an RFQ: the ones typed in the form, else derived from the requests it was raised from. */
export function rfqItems(r: CrossHireRfq, reqs: CrossHireRequest[] = []): RfqItem[] {
  if (r.items?.length) return r.items;
  const own = r.requestIds.map((i) => reqs.find((q) => q.id === i)).filter(Boolean) as CrossHireRequest[];
  if (!own.length) return [{ id: r.id, group: r.group, category: r.category, uom: 'Nos', description: `${r.group} ${r.category}`, specification: '', duration: 'Monthly', qty: r.qty, estYear: r.qty * 2, location: 'Jebel Ali Main Yard', department: 'Operations', narration: r.narration }];
  return own.flatMap((q) => reqItems(q).map((it) => ({ id: `${q.id}|${it.lineId}`, group: it.group, category: it.category, uom: 'Nos', description: `${it.group} ${it.category}`, specification: '', duration: it.frequency, qty: it.qty, estYear: it.qty * 2, location: q.location, department: q.department, narration: q.narration })));
}
const tenderNo = (r: CrossHireRfq, v: string) => `${r.number}-${r.vendorIds.indexOf(v) + 1}`;
const respNo = (r: CrossHireRfq, x: RfqResponse) => x.number ?? `RES-${r.number.slice(-5)}-${r.vendorIds.indexOf(x.vendorId) + 1}`;
const vendorNames = (r: CrossHireRfq) => r.vendorIds.map((v) => HIRE_SUPPLIERS.find((s) => s.id === v)?.name ?? v);
const EDITABLE = ['Draft', 'Open', 'Response Received', 'Pending Order', 'RFQ Sent'];

/* ------------------------------------------------------------------ list */
export function ChRfqList() {
  const nav = useNavigate();
  const toast = useToast();
  const rfqs = useChRfqs();
  const [del, setDel] = useState<CrossHireRfq | null>(null);
  return (
    <Page>
      <PageTitle title="Request for Quote" subtitle="Call for tender to Cross-Hire Company suppliers. Record their responses, then Analyze and Award and create the order." change="changed" req={R_CH} />
      <DataTable<CrossHireRfq> rows={rfqs.rows} searchPlaceholder="Search RFQs..." filter={{ key: 'status', options: CH_RFQ_STATUSES }} onAdd={() => nav(`${BASE}/add`)} addLabel="Add New" onRowClick={(r) => nav(`${BASE}/${r.id}`)}
        actions={[
          { label: 'Edit', hidden: (r) => r.status === 'Cancelled' || r.status === 'Order', onClick: (r) => nav(`${BASE}/${r.id}/edit`) },
          { label: 'Duplicate', onClick: (r) => nav(`${BASE}/add?copy=${r.id}`) },
          { label: 'Delete', danger: true, onClick: (r) => setDel(r) },
        ]}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'reference', label: 'Reference No.', render: (r) => r.reference ?? '-' },
          { key: 'vendor', label: 'Vendor', render: (r) => vendorNames(r).join(', ') || '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
      <ConfirmDialog open={!!del} title="Delete Request for Quote" description={`Delete ${del?.number} ?`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { deleteChRfq(del.id); toast('Deleted'); } setDel(null); }} />
    </Page>
  );
}

/* ------------------------------------------------------------------ add / edit / duplicate form */
const basicSpecs: Spec[] = [
  { key: 'company', label: 'Entity', type: 'master', master: 'entity', required: true },
  { key: 'number', label: 'ID', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'orderDeadline', label: 'Order Deadline', type: 'date' }, { key: 'expectedDate', label: 'Expected Required Date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', required: true, disabled: (f) => f.currency === 'AED', value: (f) => (f.currency === 'AED' ? 1 : f.exchangeRate) },
  { key: 'location', label: 'Location', type: 'select', options: stockLocations },
  { key: 'representative', label: 'Purchase Representative', type: 'select', options: ['Leena Thomas', 'Yousef Karim', 'Omar Farouk', 'Bilal Ahmed'] },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'master', master: 'paymentTerms' }, { key: 'reference', label: 'Reference No.' },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const periodSpecs: Spec[] = [
  { key: 'start', label: 'Select Start Date & Time', type: 'date' }, { key: 'end', label: 'Select End Date & Time', type: 'date' },
  { key: 'total', label: 'Total Period', type: 'readonly', value: (f) => (f.start && f.end ? `${Math.max(0, Math.round((new Date(f.end).getTime() - new Date(f.start).getTime()) / 86400000))} day(s)` : '-') },
];
/** Address & Contact of the existing RFQ: the (first) vendor's addresses and contacts, and the Entity's locations. */
const rfqAddrCfg: AddressCfg = { party: 'supplier', partyId: (f) => f.vendorFirst, entity: (f) => f.company };
const rfqAddr = addressSpecs(rfqAddrCfg);

const blankItem = (): RfqItem => ({ id: `it${Date.now()}`, group: 'Generator', category: '', uom: 'Nos', description: '', specification: '', duration: 'Monthly', qty: 1, estYear: 1, location: 'Jebel Ali Main Yard', department: 'Operations', narration: '' });
function ItemsTable({ items, onEdit, onDelete, awarded }: { items: RfqItem[]; onEdit?: (i: RfqItem) => void; onDelete?: (i: RfqItem) => void; awarded?: boolean }) {
  return (
    <DataTable hideToolbar rows={items} emptyText="No item" columns={[
      ...(awarded !== undefined ? [{ key: 'aw', label: 'Awarded', render: () => <StatusChip status={awarded ? 'Awarded' : 'Not awarded'} tone={awarded ? 'green' : 'grey'} /> }] : []),
      { key: 'grp', label: 'Category', change: 'changed', req: R_SEP, render: (i: RfqItem) => i.group }, { key: 'cat', label: 'Subcategory', change: 'changed', req: R_SEP, render: (i: RfqItem) => i.category }, { key: 'uom', label: 'UoM' }, { key: 'description', label: 'Description' }, { key: 'specification', label: 'Specification', render: (i: RfqItem) => i.specification || '-' },
      { key: 'duration', label: 'Requested Rental Duration' }, { key: 'qty', label: 'Requested Quantity', align: 'right' }, { key: 'estYear', label: 'Estimated Order Quantity Per Year', align: 'right' },
      { key: 'location', label: 'Location' }, { key: 'department', label: 'Department' }, { key: 'narration', label: 'Narration', render: (i: RfqItem) => i.narration || '-' },
      ...(onEdit ? [{ key: 'x', label: '', render: (i: RfqItem) => <><IconButton size="small" onClick={() => onEdit(i)}><EditOutlinedIcon fontSize="small" /></IconButton><IconButton size="small" onClick={() => onDelete?.(i)}><DeleteOutlineIcon fontSize="small" /></IconButton></> }] : []),
    ]} />
  );
}

export function ChRfqForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const rfqs = useChRfqs();
  const reqs = useChRequests();
  const src = rfqs.get(id ?? sp.get('copy') ?? undefined);
  // Create > RFQ on a request or on Process Cross Hire opens this form prefilled from the selected requests.
  const reqIds = !src ? (sp.get('requests') ?? '').split(',').filter(Boolean) : [];
  const rowSel = sp.get('rows')?.split(',').filter(Boolean);
  const fromReqs = reqIds.map((x) => reqs.get(x)).filter(Boolean) as NonNullable<ReturnType<typeof reqs.get>>[];
  const editing = !!id && !!src;
  const [f, setF] = useState<Record<string, any>>(() => ({ date: TODAY, company: masterValues('entity')[0], currency: 'AED', paymentTerms: '30 days', representative: 'Bilal Ahmed', location: 'Jebel Ali Main Yard',
    ...(src ? { ...src.form, number: editing ? src.number : undefined, date: editing ? src.date : TODAY, orderDeadline: src.orderDeadline, expectedDate: src.expectedDate, currency: src.currency, paymentTerms: src.paymentTerms, reference: src.reference, narration: src.narration, start: src.start, end: src.end } : {}) }));
  const [items, setItems] = useState<RfqItem[]>(() => (src ? rfqItems(src, reqs.rows) : fromReqs.flatMap((q) => reqItems(q).filter((it) => !rowSel || rowSel.includes(`${q.id}|${it.lineId}`)).map((it) => ({ id: `${q.id}|${it.lineId}`, group: it.group, category: it.category, uom: 'Nos', description: `${it.group} ${it.category}`, specification: '', duration: it.frequency, qty: it.qty, estYear: it.qty * 2, location: q.location, department: q.department, narration: q.narration })))));
  const [vendors, setVendors] = useState<string[]>(src?.vendorIds ?? []);
  const [item, setItem] = useState<RfqItem | null>(null);
  const [tender, setTender] = useState<string[] | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const addrF = { ...f, vendorFirst: vendors[0] };
  useAddressAutofill(addrF, set, rfqAddrCfg);
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    ['date', 'currency', 'company'].forEach((k) => { if (!f[k]) e[k] = 'This field is required'; });
    if (!draft && !items.length) e.items = 'Add at least one item';
    if (!draft && !vendors.length) e.vendors = 'Add at least one vendor in Call For Tender';
    setErr(e);
    if (Object.keys(e).length) { toast(e.items ?? e.vendors ?? 'Please complete the mandatory fields', 'error'); return; }
    const common = { orderDeadline: f.orderDeadline ?? '', expectedDate: f.expectedDate ?? '', paymentTerms: f.paymentTerms, narration: f.narration ?? '', start: f.start, end: f.end, reference: f.reference, items, form: f };
    if (editing && src) {
      saveChRfq(src.id, { ...common, vendorIds: vendors, date: f.date, currency: f.currency, group: items[0]?.group ?? src.group, category: items[0]?.category ?? src.category, qty: items.reduce((n, x) => n + x.qty, 0), status: draft ? 'Draft' : src.status === 'Draft' ? 'Open' : src.status });
      toast('Request for Quote saved'); nav(`${BASE}/${src.id}`); return;
    }
    const nid = createChRfq({ ...common, requestIds: fromReqs.map((q) => q.id), vendorIds: vendors, status: draft ? 'Draft' : 'Open', group: items[0]?.group, category: items[0]?.category });
    toast(draft ? 'Saved as draft' : 'Request for Quote saved'); nav(`${BASE}/${nid}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: editing ? `Edit ${src!.number}` : 'Add New' }]}
        actions={<><Button variant="text" onClick={() => nav(BASE)}>Discard</Button>{(!editing || src!.status === 'Draft') && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        {fromReqs.length > 0 && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from {fromReqs.map((q) => q.number).join(', ')}. Add the suppliers in Call For Tender, then Save.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={basicSpecs} f={f} set={set} err={err} />
              <Section title="Rental Period"><SpecForm specs={periodSpecs} f={f} set={set} cols={3} /></Section>
              <Section title="Items">
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}><Button size="small" variant="outlined" onClick={() => setItem(blankItem())}>Add</Button></Box>
                {err.items && <Text type="s5" color="#C64D4D">{err.items}</Text>}
                <ItemsTable items={items} onEdit={(i) => setItem(i)} onDelete={(i) => setItems(items.filter((x) => x.id !== i.id))} />
              </Section>
              <Section title="Call For Tender">
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}><Button size="small" variant="outlined" onClick={() => setTender(vendors)}>Add</Button></Box>
                {err.vendors && <Text type="s5" color="#C64D4D">{err.vendors}</Text>}
                <DataTable hideToolbar rows={vendors.map((v) => ({ id: v, vendor: HIRE_SUPPLIERS.find((s) => s.id === v)?.name ?? v }))} emptyText="No vendor" columns={[{ key: 'vendor', label: 'Vendor' }, { key: 'x', label: '', render: (r) => <IconButton size="small" onClick={() => setVendors(vendors.filter((v) => v !== r.id))}><DeleteOutlineIcon fontSize="small" /></IconButton> }]} />
              </Section>
              <Section title="Attachment"><FileInput label="Attach your file here" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecForm specs={rfqAddr} f={addrF} set={set} /> },
        ]} />
      </Page>
      <AppDialog open={!!item} title="Add Item" onClose={() => setItem(null)} confirmLabel="Save" confirmDisabled={!item?.category || !(item?.qty > 0)}
        onConfirm={() => { if (!item) return; setItems(items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, { ...item, description: item.description || `${item.group} ${item.category}` }]); setItem(null); }}>
        {item && <FormGrid cols={2}>
          <SelectInput label="Category" required value={item.group} options={groupOptions()} onChange={(v) => setItem({ ...item, group: v, category: '' })} />
          <SelectInput label="Subcategory" required value={item.category} options={categoryOptions(item.group)} onChange={(v) => setItem({ ...item, category: v })} />
          <TextInput label="Specification" value={item.specification} onChange={(v) => setItem({ ...item, specification: v })} /><TextInput label="Description" value={item.description} onChange={(v) => setItem({ ...item, description: v })} />
          <SelectInput label="Requested Rental Duration" value={item.duration} options={RENTAL_DURATIONS} onChange={(v) => setItem({ ...item, duration: v })} />
          <NumberInput label="Requested Quantity" required value={item.qty} onChange={(v) => setItem({ ...item, qty: Number(v) })} /><NumberInput label="Estimated Order Quantity Per Year" value={item.estYear} onChange={(v) => setItem({ ...item, estYear: Number(v) })} />
          <SelectInput label="Location" value={item.location} options={stockLocations()} onChange={(v) => setItem({ ...item, location: v })} /><SelectInput label="Department" value={item.department} options={DEPARTMENTS} onChange={(v) => setItem({ ...item, department: v })} />
          <TextInput label="Narration" value={item.narration} onChange={(v) => setItem({ ...item, narration: v })} />
        </FormGrid>}
      </AppDialog>
      <AppDialog open={!!tender} title="Call For Tender" onClose={() => setTender(null)} confirmLabel="Save" onConfirm={() => { setVendors(tender ?? []); setTender(null); }}>
        {tender && <FormGrid cols={1}><MultiSelectInput label="Vendor" required value={tender} options={supOpts} onChange={setTender} hint="Suppliers of type Cross-Hire Company" /></FormGrid>}
      </AppDialog>
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function ChRfqView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const rfqs = useChRfqs();
  const reqs = useChRequests();
  const r = rfqs.get(id);
  const [ask, setAsk] = useState<'cancel' | 'delete' | null>(null);
  if (!r) return <Page><PageTitle title="RFQ not found" right={<Button variant="outlined" onClick={() => nav(BASE)}>Back</Button>} /></Page>;
  const items = rfqItems(r, reqs.rows);
  const awardedName = r.responses.find((x) => x.vendorId === r.awardedVendorId)?.vendor;
  const f = { ...r.form, ...r, company: r.form?.company ?? r.company ?? masterValues('entity')[0], location: r.form?.location ?? 'Jebel Ali Main Yard', representative: r.form?.representative ?? 'Bilal Ahmed' };
  const st = r.status;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: r.number }]} status={<StatusChip status={st} />}
        actions={<>
          {['Open', 'Draft', 'Response Received', 'Cancelled', 'Pending Order', 'Order', 'RFQ Sent'].includes(st) && <MenuButton label="Actions" items={[
            { label: 'Edit', disabled: !EDITABLE.includes(st), onClick: () => nav(`${BASE}/${r.id}/edit`) },
            { label: st === 'Open' ? 'Print RFQ' : 'Print', disabled: !['Open', 'Response Received', 'Pending Order', 'RFQ Sent'].includes(st), onClick: () => toast('Print opens the RFQ for the suppliers', 'info') },
            { label: 'Send Email', disabled: !['Open', 'Response Received', 'Pending Order', 'RFQ Sent'].includes(st), onClick: () => { if (st === 'Open') sendChRfq(r.id); toast(`RFQ emailed to ${r.vendorIds.length} supplier(s)`); } },
            { label: 'Cancel', disabled: !['Draft', 'Open', 'RFQ Sent'].includes(st), onClick: () => setAsk('cancel') },
            { label: 'Delete', onClick: () => setAsk('delete') },
          ]} />}
          {r.responses.length > 0 && ['Open', 'Response Received', 'Pending Order', 'RFQ Sent'].includes(st) && <Button variant="outlined" onClick={() => nav(`${BASE}/${r.id}/responses`)}>Response</Button>}
          {['Open', 'Response Received', 'Order', 'Pending Order', 'RFQ Sent'].includes(st) && <MenuButton label="Create" variant="contained" items={[
            { label: 'Order', disabled: st === 'Order', onClick: () => { if (!r.awardedVendorId) { toast('Analyze and award a vendor first', 'error'); return; } nav(`/rental/cross-hire-orders/add?rfq=${r.id}`); } },
            { label: 'Response', disabled: !['Open', 'Response Received', 'RFQ Sent'].includes(st), onClick: () => nav(`${BASE}/${r.id}/responses/add`) },
          ]} />}
          {st === 'Order' && <MenuButton label="View" items={[{ label: 'Orders', disabled: !r.orderId, onClick: () => nav(`/rental/cross-hire-orders/${r.orderId}`) }, { label: 'Response', onClick: () => nav(`${BASE}/${r.id}/responses`) }]} />}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={basicSpecs.filter((s) => s.key !== 'narration').map((s) => (s.key === 'number' ? { ...s, type: 'text' as const } : s))} f={f} />
              <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>Narration: {r.narration || '-'}</Text>
              <Section title="Rental Period"><SpecView specs={periodSpecs} f={f} cols={3} /></Section>
              <Section title="Items"><ItemsTable items={items} awarded={!!r.awardedVendorId} />{awardedName && <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Awarded to {awardedName}{r.awardComment ? `: ${r.awardComment}` : ''}</Text>}</Section>
              <Section title="Call For Tender">
                {['RFQ Sent', 'Response Received', 'Pending Order', 'Order', 'Cancelled'].includes(st) && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}><Button size="small" variant="contained" onClick={() => nav(`${BASE}/${r.id}/analyze`)}>Analyze & Award</Button></Box>}
                <DataTable hideToolbar rows={r.vendorIds.map((v) => ({ id: v, vendor: HIRE_SUPPLIERS.find((s) => s.id === v)?.name ?? v, no: tenderNo(r, v), got: r.responses.some((x) => x.vendorId === v) }))} emptyText="No vendor" columns={[
                  { key: 'vendor', label: 'Vendor' }, { key: 'no', label: 'RFQ ID' }, { key: 'exp', label: 'Expected Required Date', render: () => r.expectedDate || '-' },
                  { key: 'st', label: 'Status', render: (x) => <StatusChip status={x.got ? 'Response Received' : st === 'Draft' ? 'Draft' : st === 'Open' ? 'Open' : 'RFQ Sent'} /> },
                ]} />
              </Section>
            </>) },
          { label: 'Address & Contact', content: <SpecView specs={rfqAddr} f={r.form ?? {}} /> },
          { label: 'Activity', content: <Timeline items={[...r.log].reverse()} /> },
        ]} />
      </Page>
      <ConfirmDialog open={ask === 'cancel'} title="Cancel Request for Quote" description={`Are you sure you want to Cancel ${r.number}?`} confirmLabel="Save" onClose={() => setAsk(null)} onConfirm={() => { cancelChRfq(r.id); setAsk(null); }} />
      <ConfirmDialog open={ask === 'delete'} title="Delete Request for Quote" description={`Delete ${r.number} ?`} danger confirmLabel="Delete" onClose={() => setAsk(null)} onConfirm={() => { deleteChRfq(r.id); toast('Deleted'); nav(BASE); }} />
    </>
  );
}

/* ------------------------------------------------------------------ responses (separate pages) */
export function ChResponseList() {
  const { id } = useParams();
  const nav = useNavigate();
  const r = useChRfqs().get(id);
  if (!r) return <Page><PageTitle title="RFQ not found" /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: 'Request for Quote Details', to: `${BASE}/${r.id}` }, { label: 'Responses' }]} />
      <Page>
        <PageTitle title="Responses" />
        <DataTable<RfqResponse & { id: string }> rows={r.responses.map((x) => ({ ...x, id: x.vendorId }))} emptyText="No response yet" searchPlaceholder="Search responses..." onAdd={['Open', 'Response Received', 'RFQ Sent'].includes(r.status) ? () => nav(`${BASE}/${r.id}/responses/add`) : undefined} addLabel="Add New" onRowClick={(x) => nav(`${BASE}/${r.id}/responses/${x.vendorId}`)}
          columns={[
            { key: 'n', label: 'ID', render: (x) => respNo(r, x) }, { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor' }, { key: 'rep', label: 'Purchase Representative', render: () => r.form?.representative ?? 'Bilal Ahmed' },
            { key: 'company', label: 'Entity', render: () => r.form?.company ?? masterValues('entity')[0] }, { key: 'dl', label: 'Order Deadline', render: () => r.orderDeadline || '-' }, { key: 'exp', label: 'Expected Required Date', render: () => r.expectedDate || '-' }, { key: 'cur', label: 'Currency', render: () => r.currency },
          ]} />
      </Page>
    </>
  );
}

const responseSpecs = (vendorOpts: { value: string; label: string }[], fixedVendor: boolean): Spec[] => [
  { key: 'company', label: 'Entity', type: 'readonly' },
  { key: 'number', label: 'ID', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'vendorId', label: 'Vendor', type: 'select', options: vendorOpts, required: true, disabled: fixedVendor },
  { key: 'orderDeadline', label: 'Order Deadline', type: 'date', disabled: true }, { key: 'expectedDate', label: 'Expected Required Date', type: 'date', disabled: true },
  { key: 'currency', label: 'Currency', type: 'readonly' }, { key: 'exchangeRate', label: 'Exchange Rate', type: 'readonly', value: () => 1 },
  { key: 'representative', label: 'Purchase Representative', type: 'readonly' },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'master', master: 'paymentTerms', required: true },
  { key: 'leadTime', label: 'Lead Time (days)', type: 'number' }, { key: 'reference', label: 'Reference No.' }, { key: 'incoterm', label: 'Incoterms' },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const respItemSpecs: Spec[] = [
  { key: 'vendorUom', label: 'Vendor UoM', type: 'select', options: ['Nos'] }, { key: 'vendorDuration', label: 'Vendor Rental Duration Type', type: 'select', options: RENTAL_DURATIONS },
  { key: 'rate', label: 'Rate (per unit)', type: 'number', required: true }, { key: 'moq', label: 'Minimum Order Quantity', type: 'number' },
  { key: 'condition', label: 'Condition' }, { key: 'specification', label: 'Specification' },
];

export function ChResponseForm() {
  const { id, vid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const reqs = useChRequests();
  const r = useChRfqs().get(id);
  const x0 = r?.responses.find((x) => x.vendorId === vid);
  const [f, setF] = useState<Record<string, any>>(() => ({ date: TODAY, paymentTerms: r?.paymentTerms ?? '30 days', moq: 1, vendorUom: 'Nos', vendorDuration: 'Monthly', orderDeadline: r?.orderDeadline, expectedDate: r?.expectedDate, ...x0 }));
  const [err, setErr] = useState<Record<string, string>>({});
  if (!r) return <Page><PageTitle title="RFQ not found" /></Page>;
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const items = rfqItems(r, reqs.rows);
  const view = { ...f, currency: r.currency, company: r.form?.company ?? masterValues('entity')[0], representative: r.form?.representative ?? 'Bilal Ahmed', number: x0 ? respNo(r, x0) : undefined };
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.vendorId) e.vendorId = 'Select the vendor';
    if (!(Number(f.rate) > 0)) e.rate = 'Rate is required';
    if (!f.paymentTerms) e.paymentTerms = 'This field is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    addChResponse(r.id, { vendorId: f.vendorId, vendor: HIRE_SUPPLIERS.find((s) => s.id === f.vendorId)?.name ?? '', rate: Number(f.rate), leadTime: Number(f.leadTime) || 0, moq: Number(f.moq) || 1, date: f.date, paymentTerms: f.paymentTerms, incoterm: f.incoterm, reference: f.reference, narration: f.narration, condition: f.condition, specification: f.specification, vendorUom: f.vendorUom, vendorDuration: f.vendorDuration });
    toast('Response for quote saved successfully.'); nav(`${BASE}/${r.id}/responses`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: r.number, to: `${BASE}/${r.id}` }, { label: 'Responses', to: `${BASE}/${r.id}/responses` }, { label: x0 ? 'Edit' : 'Add New' }]} actions={<><Button variant="text" onClick={() => nav(`${BASE}/${r.id}/responses`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Section title="Basic Detail"><SpecForm specs={responseSpecs(supOpts.filter((o) => r.vendorIds.includes(o.value)), !!x0)} f={view} set={set} err={err} /></Section>
        <Section title="Items">
          <DataTable hideToolbar rows={items} columns={[
            { key: 'grp', label: 'Category', change: 'changed', req: R_SEP, render: (i) => i.group }, { key: 'cat', label: 'Subcategory', change: 'changed', req: R_SEP, render: (i) => i.category }, { key: 'u', label: 'Requested UoM', render: (i) => i.uom }, { key: 'd', label: 'Requested Rental Duration', render: (i) => i.duration },
            { key: 'q', label: 'Requested Quantity', align: 'right', render: (i) => i.qty }, { key: 'e', label: 'Estimated Order Quantity Per Year', align: 'right', render: (i) => i.estYear },
          ]} />
          <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Vendor response</Text>
          <SpecForm specs={respItemSpecs} f={f} set={set} err={err} cols={3} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>The rate, minimum order quantity and lead time apply to the items of this RFQ.</Text>
        </Section>
        <Section title="Attachment"><FileInput label="Attachment" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
      </Page>
    </>
  );
}

export function ChResponseView() {
  const { id, vid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const r = useChRfqs().get(id);
  const x = r?.responses.find((y) => y.vendorId === vid);
  const [del, setDel] = useState(false);
  if (!r || !x) return <Page><PageTitle title="Response not found" /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: r.number, to: `${BASE}/${r.id}` }, { label: 'Responses', to: `${BASE}/${r.id}/responses` }, { label: respNo(r, x) }]}
        actions={<MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${BASE}/${r.id}/responses/${x.vendorId}/edit`) }, { label: 'Delete', onClick: () => setDel(true) }]} />} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="ID" value={respNo(r, x)} /><ValueField label="Date" value={x.date} /><ValueField label="Vendor" value={x.vendor} /><ValueField label="Order Deadline" value={r.orderDeadline} />
          <ValueField label="Expected Required Date" value={r.expectedDate} /><ValueField label="Currency" value={r.currency} /><ValueField label="Entity" value={r.form?.company ?? masterValues('entity')[0]} /><ValueField label="Payment Terms" value={x.paymentTerms ?? r.paymentTerms} />
          <ValueField label="Lead Time" value={`${x.leadTime} day(s)`} /><ValueField label="Reference No." value={x.reference} /><ValueField label="Incoterms" value={x.incoterm} /><ValueField label="Narration" value={x.narration} />
        </ValueGrid>
        <Section title="Items">
          <DataTable hideToolbar rows={[{ id: 'r' }]} columns={[
            { key: 'aw', label: 'Awarded', render: () => <StatusChip status={r.awardedVendorId === x.vendorId ? 'Awarded' : 'Not awarded'} tone={r.awardedVendorId === x.vendorId ? 'green' : 'grey'} /> }, { key: 'g', label: 'Category', change: 'changed', req: R_SEP, render: () => r.group }, { key: 'i', label: 'Subcategory', change: 'changed', req: R_SEP, render: () => r.category },
            { key: 'vu', label: 'Vendor UoM', render: () => x.vendorUom ?? 'Nos' }, { key: 'vd', label: 'Vendor Rental Duration Type', render: () => x.vendorDuration ?? 'Monthly' }, { key: 'c', label: 'Condition', render: () => x.condition ?? '-' },
            { key: 'rate', label: 'Rate', align: 'right', render: () => aed(x.rate) }, { key: 'q', label: 'Requested Quantity', align: 'right', render: () => r.qty }, { key: 'm', label: 'Minimum Order Quantity', align: 'right', render: () => x.moq },
          ]} />
        </Section>
      </Page>
      <ConfirmDialog open={del} title="Delete Response" description={`Delete ${respNo(r, x)} ?`} danger confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => { deleteChResponse(r.id, x.vendorId); toast('Deleted'); nav(`${BASE}/${r.id}/responses`); }} />
    </>
  );
}

/* ------------------------------------------------------------------ Analyze & Award (compare) */
type Tab = 'All' | 'Low Price' | 'Low MOQ' | 'Low Lead Time';
export function ChRfqAnalyze() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const r = useChRfqs().get(id);
  const reqs = useChRequests();
  const orders = useCrossHire().rows;
  const [selItem, setSelItem] = useState<string>('');
  const [tab, setTab] = useState<Tab>('All');
  const [showItemFilter, setShowItemFilter] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [fItem, setFItem] = useState('');
  const [asc, setAsc] = useState(true);
  const [flt, setFlt] = useState<{ moq: string; lead: string; min: string; max: string }>({ moq: '', lead: '', min: '', max: '' });
  const [applied, setApplied] = useState(flt);
  const [comment, setComment] = useState<{ vendorId: string; text: string } | null>(null);
  const [popup, setPopup] = useState<'assigned' | 'update' | null>(null);
  const [pending, setPending] = useState('');
  const [prev, setPrev] = useState<RfqResponse | null>(null);
  const items = useMemo(() => (r ? rfqItems(r, reqs.rows) : []), [r, reqs.rows]);
  if (!r) return <Page><PageTitle title="RFQ not found" /></Page>;
  const shownItems = items.filter((i) => !fItem || `${i.group} ${i.category}` === fItem).sort((a, b) => (asc ? 1 : -1) * `${a.group} ${a.category}`.localeCompare(`${b.group} ${b.category}`));
  const cur = items.find((i) => i.id === selItem) ?? shownItems[0];
  const prices = r.responses.map((x) => x.rate);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const lowMoq = r.responses.length ? Math.min(...r.responses.map((x) => x.moq)) : 0;
  const lowLead = r.responses.length ? Math.min(...r.responses.map((x) => x.leadTime)) : 0;
  let rows = r.responses.filter((x) => (!applied.moq || x.moq <= Number(applied.moq)) && (!applied.lead || x.leadTime <= Number(applied.lead)) && (!applied.min || x.rate >= Number(applied.min)) && (!applied.max || x.rate <= Number(applied.max)));
  rows = [...rows].sort((a, b) => (tab === 'Low Price' ? a.rate - b.rate : tab === 'Low MOQ' ? a.moq - b.moq : tab === 'Low Lead Time' ? a.leadTime - b.leadTime : 0));
  const locked = r.status === 'Order' || r.status === 'Cancelled';
  const tick = (vendorId: string) => {
    if (locked) return;
    if (!r.awardedVendorId) { setComment({ vendorId, text: '' }); return; }
    if (r.awardedVendorId === vendorId) { setPending(vendorId); setPopup('update'); return; }
    setPopup('assigned');
  };
  const prevOrders = prev ? orders.filter((o) => o.supplierId === prev.vendorId && o.group === r.group && o.category === r.category) : [];
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: BASE }, { label: r.number, to: `${BASE}/${r.id}` }, { label: 'Compare' }]} actions={<Button variant="text" onClick={() => nav(`${BASE}/${r.id}`)}>Back</Button>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '4fr 8fr' }, gap: 2 }}>
          <Box sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Text type="s2" weight="medium">Items List</Text>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<FilterListIcon />} onClick={() => setShowItemFilter(!showItemFilter)}>Filters</Button>
                <Button size="small" variant="outlined" onClick={() => setAsc(!asc)}>Sort {asc ? 'A-Z' : 'Z-A'}</Button>
              </Box>
            </Box>
            {showItemFilter && <Box sx={{ mb: 1 }}><SelectInput label="Item" value={fItem} options={['', ...items.map((i) => `${i.group} ${i.category}`)]} onChange={setFItem} /></Box>}
            {shownItems.map((i) => (
              <Box key={i.id} onClick={() => setSelItem(i.id)} sx={{ cursor: 'pointer', border: `1px solid ${cur?.id === i.id ? '#2EB273' : neutral[200]}`, bgcolor: cur?.id === i.id ? '#E8F5F0' : '#fff', borderRadius: '8px', p: 1.5, mb: 1 }}>
                <Text type="s3" weight="medium">{i.group} {i.category}</Text>
                <Text type="s5" color="theme.secondary.700">Responses Received: {r.responses.length}</Text>
                <Text type="s5" color="theme.secondary.700">Required Date: {r.expectedDate || '-'}</Text>
                <Text type="s5" color="theme.secondary.700">Requested UOM: {i.uom} | Requested Quantity: {i.qty}</Text>
              </Box>
            ))}
          </Box>
          <Box sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Text type="s2" weight="medium">Response Received{cur ? `: ${cur.group} ${cur.category}` : ''}</Text>
              <Button size="small" variant="outlined" startIcon={<FilterListIcon />} onClick={() => setShowFilter(!showFilter)}>Filter</Button>
            </Box>
            {showFilter && (
              <Box sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px', p: 2, mb: 1.5 }}>
                <FormGrid cols={3}>
                  <NumberInput label="Minimum Order Quantity (up to)" value={flt.moq} onChange={(v) => setFlt({ ...flt, moq: String(v) })} />
                  <NumberInput label="Lead Time (up to, days)" value={flt.lead} onChange={(v) => setFlt({ ...flt, lead: String(v) })} />
                  <Box><Text type="s5" weight="medium">Price range</Text><Slider size="small" min={Math.floor(lo * 0.9)} max={Math.ceil(hi * 1.1) || 1} value={[Number(flt.min) || Math.floor(lo * 0.9), Number(flt.max) || Math.ceil(hi * 1.1)]} onChange={(_, v) => setFlt({ ...flt, min: String((v as number[])[0]), max: String((v as number[])[1]) })} /><Text type="s5">{flt.min || '-'} to {flt.max || '-'}</Text></Box>
                </FormGrid>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => { const e = { moq: '', lead: '', min: '', max: '' }; setFlt(e); setApplied(e); }}>Clear</Button>
                  <Button size="small" variant="contained" onClick={() => setApplied(flt)}>Apply</Button>
                </Box>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              {(['All', 'Low Price', 'Low MOQ', 'Low Lead Time'] as Tab[]).map((t) => <Button key={t} size="small" variant={tab === t ? 'contained' : 'outlined'} onClick={() => setTab(t)}>{t}</Button>)}
            </Box>
            <DataTable<RfqResponse & { id: string }> hideToolbar rows={rows.map((x) => ({ ...x, id: x.vendorId }))} emptyText="No supplier has responded yet" columns={[
              { key: 'aw', label: 'Awarded', render: (x) => <Checkbox size="small" checked={r.awardedVendorId === x.vendorId} disabled={locked} onChange={() => tick(x.vendorId)} /> },
              { key: 'vendor', label: 'Vendor', render: (x) => <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>{x.vendor}
                {x.rate === lo && <Tooltip title="Lowest Price"><span><StatusChip status="Lowest Price" tone="green" /></span></Tooltip>}{x.moq === lowMoq && <Tooltip title="Lowest Minimum Order Quantity"><span><StatusChip status="Lowest MOQ" tone="green" /></span></Tooltip>}{x.leadTime === lowLead && <Tooltip title="Lowest lead time"><span><StatusChip status="Lowest Lead Time" tone="green" /></span></Tooltip>}</Box> },
              { key: 'no', label: 'RFQ ID', render: (x) => tenderNo(r, x.vendorId) }, { key: 'rate', label: 'Rate (per unit)', align: 'right', render: (x) => aed(x.rate) },
              { key: 'lead', label: 'Lead Time', align: 'right', render: (x) => `${x.leadTime} day(s)` }, { key: 'moq', label: 'Minimum Order Quantity', align: 'right' },
              { key: 'act', label: 'Action', render: (x) => <MenuButton label="" variant="text" items={[{ label: 'See Previous Prices', onClick: () => setPrev(x) }]} /> },
            ]} />
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Tick the vendor to award it. {r.awardedVendorId ? 'Create > Order on the RFQ makes the Cross Hire Order from the awarded response.' : ''}</Text>
            {r.awardedVendorId && r.status === 'Pending Order' && <Box sx={{ mt: 1 }}><Button variant="contained" size="small" onClick={() => nav(`/rental/cross-hire-orders/add?rfq=${r.id}`)}>Create Order</Button></Box>}
          </Box>
        </Box>
      </Page>
      <AppDialog open={!!comment} title="Add Comment" onClose={() => setComment(null)} confirmLabel="Save" onConfirm={() => { if (!comment) return; awardChRfq(r.id, comment.vendorId, comment.text); toast('Vendor awarded. RFQ status: Pending Order'); setComment(null); }}>
        {comment && <FormGrid cols={1}><TextInput label="Comment" multiline rows={3} value={comment.text} onChange={(v) => setComment({ ...comment, text: v })} /></FormGrid>}
      </AppDialog>
      <ConfirmDialog open={popup === 'update'} title="Update vendor" description="You have already selected the vendor for this item. Do you want to update the vendor details?" confirmLabel="Yes" onClose={() => setPopup(null)} onConfirm={() => { setPopup(null); setComment({ vendorId: pending, text: r.awardComment ?? '' }); }} />
      <AppDialog open={popup === 'assigned'} title="Vendor Already Assigned" onClose={() => setPopup(null)}><Alert severity="warning">You have already selected other vendor for this item</Alert></AppDialog>
      <AppDialog open={!!prev} title={`Previous prices: ${prev?.vendor ?? ''}`} onClose={() => setPrev(null)} maxWidth="md">
        <DataTable hideToolbar rows={prevOrders} emptyText="No earlier cross-hire order of this item with this vendor" columns={[{ key: 'number', label: 'Hire Order' }, { key: 'date', label: 'Date' }, { key: 'rate', label: 'Rate (per unit)', align: 'right', render: (o) => aed(o.rate / (o.qty ?? 1)) }]} />
      </AppDialog>
    </>
  );
}
