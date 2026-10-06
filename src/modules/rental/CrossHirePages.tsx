import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, MenuButton, useToast } from '@/components/Dialogs';
import { DateInput, FileInput, FormGrid, MultiSelectInput, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { suppliers } from '@/mock-data/masters';
import {
  COL, CH_RFQ_STATUSES, CH_REQUEST_STATUSES, CH_TYPES, CROSS_STAGES, DEPARTMENTS, TODAY, allLocations, assetById, availability, fleetRows, isLive, masterValues, type CrossHire, type CrossHireRequest, type CrossHireRfq, type RfqResponse,
} from '@/modules/crm/data';
import { addChExpense, addChResponse, awardChRfq, createChRfq, createHireOrder, markChShipped, raiseCrossHire, receiveCrossHire, returnToSupplier, returnToUs, sendChRfq, submitChRequest, saveChRequest } from '@/modules/crm/flow';
import { SpecForm, type Spec } from '@/modules/crm/FormKit';
import { R, aed, useChRequests, useChRfqs, useCrossHire, useOrders } from '@/modules/crm/shared';
import { getCollection } from '@/store/store';

const HIRE_SUPPLIERS = suppliers.filter((s) => s.type === 'Cross-Hire Company');
const supOpts = HIRE_SUPPLIERS.map((s) => ({ value: s.id, label: s.name }));
const R_CH = 'Existing ERP Cross Hire (Requests, Process, Request for Quote, Orders) combined with Procurement > Cross-Hire Suppliers';

const onHand = (g: string, c: string) => fleetRows().filter((a) => isLive(a) && a.category === g && a.subCategory === c && a.ownership !== 'Cross-Hired').length;

/* ------------------------------------------------------------------ shared create dialogs (Create > Order, Create > RFQ) */
export function ChOrderDialog({ open, onClose, requestIds, rfq, qty, type }: { open: boolean; onClose: () => void; requestIds: string[]; rfq?: CrossHireRfq; qty?: number; type?: 'Inventory' | 'Dropship' }) {
  const nav = useNavigate();
  const toast = useToast();
  const reqs = useChRequests();
  const first = reqs.get(requestIds[0]);
  const award = rfq?.responses.find((r) => r.vendorId === rfq.awardedVendorId);
  const [sup, setSup] = useState(award?.vendorId ?? first?.vendorId ?? '');
  const [rate, setRate] = useState(String(award?.rate ?? (first?.rate || '')));
  const [t, setT] = useState<'Inventory' | 'Dropship'>(type ?? 'Inventory');
  return (
    <AppDialog open={open} title="Create Cross Hire Order" onClose={onClose} confirmLabel="Create Order" confirmDisabled={!sup || !Number(rate)}
      onConfirm={() => { const s = HIRE_SUPPLIERS.find((x) => x.id === sup)!; const id = createHireOrder({ requestIds, rfqId: rfq?.id, supplierId: s.id, supplier: s.name, rate: Number(rate), type: t, qty }); toast('Cross Hire Order created'); onClose(); nav(`/rental/cross-hire-orders/${id}`); }}>
      {rfq && <Alert severity="info" sx={{ mb: 2 }}>Supplier and rate come from the awarded response of {rfq.number}.</Alert>}
      <FormGrid cols={1}>
        <SelectInput label="Supplier" required value={sup} options={supOpts} onChange={setSup} hint="Suppliers of type Cross-Hire Company" disabled={!!award} />
        <NumberInput label="Agreed Rate (per unit, AED)" required change="new" req={R_CH} value={rate} onChange={setRate} hint="Negotiated per transaction" disabled={!!award} />
        <SelectInput label="Cross Hire Type" required value={t} options={CH_TYPES} onChange={(v) => setT(v as 'Inventory' | 'Dropship')} hint="Inventory: the unit comes to our yard first. Dropship: the supplier ships to the client site" disabled={!!type} />
      </FormGrid>
    </AppDialog>
  );
}

export function ChRfqDialog({ open, onClose, requestIds }: { open: boolean; onClose: () => void; requestIds: string[] }) {
  const nav = useNavigate();
  const toast = useToast();
  const reqs = useChRequests();
  const [ids, setIds] = useState<string[]>(requestIds);
  const [v, setV] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [expected, setExpected] = useState('');
  const pool = reqs.rows.filter((r) => r.status === 'In Progress' || requestIds.includes(r.id));
  return (
    <AppDialog open={open} title="Create Request for Quote" onClose={onClose} confirmLabel="Create RFQ" confirmDisabled={!ids.length || !v.length}
      onConfirm={() => { const id = createChRfq({ requestIds: ids, vendorIds: v, orderDeadline: deadline, expectedDate: expected }); toast('Request for Quote created'); onClose(); nav(`/rental/cross-hire-rfq/${id}`); }}>
      <FormGrid cols={1}>
        <MultiSelectInput label="Cross Hire Requests" required value={ids} options={pool.map((r) => ({ value: r.id, label: `${r.number}: ${r.group} ${r.category} for ${r.soNumber}` }))} onChange={setIds} disabled={requestIds.length > 0} />
        <MultiSelectInput label="Call For Tender (suppliers)" required value={v} options={supOpts} onChange={setV} hint="Cross-Hire Company suppliers who will quote" />
        <DateInput label="Order Deadline" value={deadline} onChange={setDeadline} />
        <DateInput label="Expected Required Date" value={expected} onChange={setExpected} />
      </FormGrid>
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ 1. Requests */
export function ChRequestList() {
  const nav = useNavigate();
  const reqs = useChRequests();
  return (
    <Page>
      <PageTitle title="Cross Hire Requests" subtitle="Raised from a Rental Order when no owned unit of the Category is Ready for Hire. Submit, then create an RFQ or an Order." change="changed" req={R.cross} />
      <DataTable<CrossHireRequest> rows={reqs.rows} searchPlaceholder="Search requests..." filter={{ key: 'status', options: CH_REQUEST_STATUSES }} onAdd={() => nav('/rental/cross-hire/add')} addLabel="Add New" onRowClick={(r) => nav(`/rental/cross-hire/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'soNumber', label: 'Rental Order ID' },
          { key: 'cat', label: 'Category + Subcategory', change: 'new', req: R_CH, render: (r) => `${r.group} ${r.category}` }, { key: 'qty', label: 'Quantity', align: 'right' },
          { key: 'vendor', label: 'Vendor Name', render: (r) => r.vendor ?? '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
    </Page>
  );
}

const requestSpecs = (soOpts: { value: string; label: string }[], lineOpts: { value: string; label: string }[]): Spec[] => [
  { key: 'number', label: 'ID', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'soId', label: 'Rental Order ID', type: 'select', options: soOpts, required: true, hint: 'Rental Sales Orders from CRM' },
  { key: 'lineId', label: 'Equipment line', type: 'select', options: lineOpts, required: true, change: 'new', req: R_CH, hint: 'Category and Subcategory come from the order line' },
  { key: 'company', label: 'Company', type: 'master', master: 'entity', required: true },
  { key: 'representative', label: 'Purchase Representative', type: 'select', options: ['Leena Thomas', 'Yousef Karim', 'Omar Farouk', 'Bilal Ahmed'] },
  { key: 'vendorId', label: 'Vendor', type: 'select', options: supOpts, hint: 'Optional. The RFQ award or the order fixes the supplier' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
  { key: 'location', label: 'Location', type: 'select', options: allLocations },
  { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
  { key: 'attachments', label: 'Attachment', type: 'file', full: true },
];

export function ChRequestForm() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const [f, setF] = useState<Record<string, any>>({ date: TODAY, company: masterValues('entity')[0], currency: 'AED', representative: 'Bilal Ahmed', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [] });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, ...(k === 'soId' ? { lineId: '' } : {}) }));
  const rentals = orders.rows.filter((o) => o.activity === 'Rental');
  const so = rentals.find((o) => o.id === f.soId);
  const lines = (so?.lines ?? []).filter((l) => l.activity === 'Rental');
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    ['soId', 'lineId', 'company', 'currency', 'date'].forEach((k) => { if (!f[k]) e[k] = 'This field is required'; });
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const id = raiseCrossHire(f.soId, f.lineId, f.vendorId || undefined, HIRE_SUPPLIERS.find((s) => s.id === f.vendorId)?.name);
    const rec = getCollection<CrossHireRequest>(COL.chRequests).find((r) => r.id === id)!;
    saveChRequest({ ...rec, date: f.date, company: f.company, representative: f.representative, currency: f.currency, narration: f.narration || rec.narration, location: f.location, department: f.department, attachments: f.attachments ?? [], status: draft ? 'Draft' : 'Pending' });
    toast(draft ? 'Request saved as draft' : 'Cross Hire Request saved');
    nav(`/rental/cross-hire/${id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Cross Hire Requests', to: '/rental/cross-hire' }, { label: 'Add New' }]} actions={<><Button variant="text" onClick={() => nav('/rental/cross-hire')}>Cancel</Button><Button variant="outlined" onClick={() => save(true)}>Save as draft</Button><Button variant="contained" onClick={() => save(false)}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <SpecForm specs={requestSpecs(rentals.map((o) => ({ value: o.id, label: o.number })), lines.map((l) => ({ value: l.id, label: `${l.group} ${l.category} x ${l.qty}` })))} f={f} set={set} err={err} />
      </Page>
    </>
  );
}

export function ChRequestView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const reqs = useChRequests();
  const [dlg, setDlg] = useState<'order' | 'rfq' | null>(null);
  const r = reqs.get(id);
  if (!r) return <Page><PageTitle title="Request not found" right={<Button variant="outlined" onClick={() => nav('/rental/cross-hire')}>Back</Button>} /></Page>;
  const avail = availability(r.group, r.category);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Cross Hire Requests', to: '/rental/cross-hire' }, { label: r.number }]} status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${r.soId}`)}>View Sales Order</Button>
          {(r.status === 'Draft' || r.status === 'Pending') && <Button variant="contained" onClick={() => { submitChRequest(r.id); toast('Request submitted and approved'); }}>Submit</Button>}
          {r.status === 'In Progress' && <MenuButton label="Create" variant="contained" items={[{ label: 'Order', onClick: () => setDlg('order') }, { label: 'RFQ', onClick: () => setDlg('rfq') }]} />}
          {r.status === 'Completed' && r.orderId && <Button variant="contained" onClick={() => nav(`/rental/cross-hire-orders/${r.orderId}`)}>View Order</Button>}
          {r.status === 'Completed' && r.rfqId && <Button variant="outlined" onClick={() => nav(`/rental/cross-hire-rfq/${r.rfqId}`)}>View RFQ</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="ID" value={r.number} /><ValueField label="Date" value={r.date} /><ValueField label="Rental Order ID" value={r.soNumber} /><ValueField label="Company" value={r.company} />
          <ValueField label="Purchase Representative" value={r.representative} /><ValueField label="Vendor" value={r.vendor ?? 'Decided at RFQ or order'} /><ValueField label="Currency" value={r.currency} /><ValueField label="Narration" value={r.narration} />
        </ValueGrid>
        <Panel title="Items" sx={{ mt: 3 }}>
          <DataTable hideToolbar rows={[r]} columns={[
            { key: 'g', label: 'Category', change: 'new', req: R_CH, render: (x) => x.group }, { key: 'c', label: 'Subcategory', change: 'new', req: R_CH, render: (x) => x.category }, { key: 'u', label: 'UOM', render: () => 'Nos' },
            { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'oh', label: 'On Hand', align: 'right', render: (x) => onHand(x.group, x.category) }, { key: 'av', label: 'Available', align: 'right', render: () => avail.owned.length },
            { key: 'f', label: 'Rental Duration Type', render: (x) => x.frequency }, { key: 'rate', label: 'Rate', align: 'right', render: (x) => (x.rate ? aed(x.rate) : '-') },
          ]} />
        </Panel>
        <Panel title="Classification" sx={{ mt: 2 }}><ValueGrid><ValueField label="Location" value={r.location} /><ValueField label="Department" value={r.department} /></ValueGrid></Panel>
        <Box sx={{ mt: 3 }}><TabPanels tabs={[{ label: 'Activity', content: <Timeline items={[...r.log].reverse()} /> }]} /></Box>
      </Page>
      {dlg === 'order' && <ChOrderDialog open onClose={() => setDlg(null)} requestIds={[r.id]} />}
      {dlg === 'rfq' && <ChRfqDialog open onClose={() => setDlg(null)} requestIds={[r.id]} />}
    </>
  );
}

/* ------------------------------------------------------------------ 2. Process Cross Hire */
export function ChProcess() {
  const reqs = useChRequests();
  const [sel, setSel] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [type, setType] = useState<Record<string, 'Inventory' | 'Dropship'>>({});
  const [dlg, setDlg] = useState<'order' | 'rfq' | null>(null);
  const toast = useToast();
  const rows = reqs.rows.filter((r) => r.status === 'In Progress');
  const chosen = rows.filter((r) => sel.includes(r.id));
  const types = [...new Set(chosen.map((r) => type[r.id] ?? 'Inventory'))];
  const totalQty = chosen.reduce((t, r) => t + (qty[r.id] ?? r.qty), 0);
  const go = (k: 'order' | 'rfq') => {
    if (!chosen.length) { toast('Select at least one request', 'error'); return; }
    if (k === 'order' && types.length > 1) { toast('Selected rows have different Cross Hire Types. Create the orders separately', 'error'); return; }
    if (chosen.some((r) => !(qty[r.id] ?? r.qty) || false)) { toast('Please fill all the required fields', 'error'); return; }
    setDlg(k);
  };
  return (
    <Page>
      <PageTitle title="Process Cross Hire" subtitle="In Progress requests grouped by item. Fill the Cross Hire Quantity and Type, select the rows, then create an Order or an RFQ." change="changed" req={R_CH}
        right={<MenuButton label="Create" variant="contained" items={[{ label: 'Cross Hire Order', onClick: () => go('order') }, { label: 'RFQ', onClick: () => go('rfq') }]} />} />
      <DataTable<CrossHireRequest> rows={rows} selectable selected={sel} onSelect={setSel} hideToolbar emptyText="No In Progress cross hire requests to process"
        columns={[
          { key: 'item', label: 'Item', render: (r) => `${r.group} ${r.category}` }, { key: 'uom', label: 'UOM', render: () => 'Nos' }, { key: 'soNumber', label: 'Rental Order ID' },
          { key: 'qty', label: 'Request Quantity', align: 'right' }, { key: 'oh', label: 'On Hand', align: 'right', render: (r) => onHand(r.group, r.category) },
          { key: 'av', label: 'Available', align: 'right', render: (r) => availability(r.group, r.category).owned.length },
          { key: 'cq', label: 'Cross Hire Quantity', render: (r) => <Box sx={{ width: 110 }}><NumberInput label="" value={qty[r.id] ?? r.qty} onChange={(v) => setQty({ ...qty, [r.id]: Number(v) })} /></Box> },
          { key: 'ct', label: 'Cross Hire Type', render: (r) => <Box sx={{ width: 150 }}><SelectInput label="" value={type[r.id] ?? 'Inventory'} options={CH_TYPES} onChange={(v) => setType({ ...type, [r.id]: v as 'Inventory' | 'Dropship' })} /></Box> },
          { key: 'vendor', label: 'Vendor', render: (r) => r.vendor ?? '-' },
        ]} />
      <Text type="s4" color="theme.secondary.700" sx={{ mt: 1 }}>Total : {rows.length}. Selected cross hire quantity: {totalQty}</Text>
      {dlg === 'order' && <ChOrderDialog open onClose={() => setDlg(null)} requestIds={sel} qty={totalQty} type={types[0]} />}
      {dlg === 'rfq' && <ChRfqDialog open onClose={() => setDlg(null)} requestIds={sel} />}
    </Page>
  );
}

/* ------------------------------------------------------------------ 3. Request for Quote */
export function ChRfqList() {
  const nav = useNavigate();
  const rfqs = useChRfqs();
  const [dlg, setDlg] = useState(false);
  return (
    <Page>
      <PageTitle title="Request for Quote" subtitle="Call for tender to Cross-Hire Company suppliers. Record their responses, compare and award, then create the order." change="changed" req={R_CH} />
      <DataTable<CrossHireRfq> rows={rfqs.rows} searchPlaceholder="Search RFQs..." filter={{ key: 'status', options: CH_RFQ_STATUSES }} onAdd={() => setDlg(true)} addLabel="Add New" onRowClick={(r) => nav(`/rental/cross-hire-rfq/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'so', label: 'Rental Order(s)', render: (r) => r.soNumbers.join(', ') || '-' }, { key: 'cat', label: 'Category + Subcategory', render: (r) => `${r.group} ${r.category}` },
          { key: 'v', label: 'Suppliers', align: 'right', render: (r) => r.vendorIds.length }, { key: 'resp', label: 'Responses', align: 'right', render: (r) => r.responses.length },
          { key: 'orderDeadline', label: 'Order Deadline' }, { key: 'expectedDate', label: 'Expected Required Date' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
      {dlg && <ChRfqDialog open onClose={() => setDlg(false)} requestIds={[]} />}
    </Page>
  );
}

type Sort = 'All' | 'Low Price' | 'Low MOQ' | 'Lead time';
export function ChRfqView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const rfqs = useChRfqs();
  const r = rfqs.get(id);
  const [resp, setResp] = useState<Partial<RfqResponse> | null>(null);
  const [award, setAward] = useState<{ vendorId: string; comment: string } | null>(null);
  const [order, setOrder] = useState(false);
  const [sort, setSort] = useState<Sort>('All');
  if (!r) return <Page><PageTitle title="RFQ not found" right={<Button variant="outlined" onClick={() => nav('/rental/cross-hire-rfq')}>Back</Button>} /></Page>;
  const rows = [...r.responses].sort((a, b) => (sort === 'Low Price' ? a.rate - b.rate : sort === 'Low MOQ' ? a.moq - b.moq : sort === 'Lead time' ? a.leadTime - b.leadTime : 0));
  const best = r.responses.length ? Math.min(...r.responses.map((x) => x.rate)) : 0;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Request for Quote', to: '/rental/cross-hire-rfq' }, { label: r.number }]} status={<StatusChip status={r.status} />}
        actions={<>
          {r.status === 'Open' && <Button variant="outlined" onClick={() => { sendChRfq(r.id); toast('RFQ sent to the suppliers'); }}>Send</Button>}
          {r.status !== 'Order' && <Button variant="outlined" onClick={() => setResp({ vendorId: '', date: TODAY, moq: 1 })}>Add Response</Button>}
          {r.status !== 'Order' && <Button variant="contained" disabled={!r.awardedVendorId} onClick={() => setOrder(true)}>Create Order</Button>}
          {r.status === 'Order' && r.orderId && <Button variant="contained" onClick={() => nav(`/rental/cross-hire-orders/${r.orderId}`)}>View Order</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="ID" value={r.number} /><ValueField label="Date" value={r.date} /><ValueField label="Rental Order(s)" value={r.soNumbers.join(', ')} /><ValueField label="Category + Subcategory" value={`${r.group} ${r.category}`} />
          <ValueField label="Quantity" value={String(r.qty)} /><ValueField label="Currency" value={r.currency} /><ValueField label="Payment Terms" value={r.paymentTerms} /><ValueField label="Order Deadline" value={r.orderDeadline} />
          <ValueField label="Expected Required Date" value={r.expectedDate} /><ValueField label="Rental Period" value={r.start && r.end ? `${r.start} to ${r.end}` : undefined} /><ValueField label="Narration" value={r.narration} />
          <ValueField label="Awarded to" change="new" req={R_CH} value={r.responses.find((x) => x.vendorId === r.awardedVendorId)?.vendor ?? 'Not awarded yet'} />
        </ValueGrid>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Compare responses', content: (
              <>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  {(['All', 'Low Price', 'Low MOQ', 'Lead time'] as Sort[]).map((s) => <Button key={s} size="small" variant={sort === s ? 'contained' : 'outlined'} onClick={() => setSort(s)}>{s}</Button>)}
                </Box>
                <DataTable<RfqResponse & { id: string }> hideToolbar rows={rows.map((x) => ({ ...x, id: x.vendorId }))} emptyText="No supplier has responded yet"
                  columns={[
                    { key: 'vendor', label: 'Vendor' }, { key: 'rate', label: 'Rate (per unit)', align: 'right', render: (x) => <span>{aed(x.rate)} {x.rate === best && <StatusChip status="Lowest" tone="green" />}</span> }, { key: 'leadTime', label: 'Lead time (days)', align: 'right' },
                    { key: 'moq', label: 'Minimum Order Quantity', align: 'right' }, { key: 'date', label: 'Response date' },
                    { key: 'award', label: 'Award', render: (x) => (r.awardedVendorId === x.vendorId ? <StatusChip status="Awarded" tone="green" /> : r.status === 'Order' ? '-' : <Button size="small" variant="outlined" onClick={() => setAward({ vendorId: x.vendorId, comment: '' })}>Award</Button>) },
                  ]} />
              </>
            ) },
            { label: 'Call for tender', content: <DataTable hideToolbar rows={r.vendorIds.map((v) => ({ id: v, name: HIRE_SUPPLIERS.find((s) => s.id === v)?.name ?? v, got: r.responses.some((x) => x.vendorId === v) }))} columns={[{ key: 'name', label: 'Vendor' }, { key: 'got', label: 'Response', render: (x) => <StatusChip status={x.got ? 'Received' : 'Pending'} tone={x.got ? 'green' : 'amber'} /> }]} /> },
            { label: 'Activity', content: <Timeline items={[...r.log].reverse()} /> },
          ]} />
        </Box>
      </Page>
      <AppDialog open={!!resp} title="Request for Quote Response" onClose={() => setResp(null)} confirmLabel="Save" confirmDisabled={!resp?.vendorId || !Number(resp?.rate)}
        onConfirm={() => { if (!resp?.vendorId) return; addChResponse(r.id, { vendorId: resp.vendorId, vendor: HIRE_SUPPLIERS.find((s) => s.id === resp.vendorId)?.name ?? '', rate: Number(resp.rate), leadTime: Number(resp.leadTime) || 0, moq: Number(resp.moq) || 1, date: resp.date ?? TODAY }); toast('Response saved. RFQ status: Response Received'); setResp(null); }}>
        {resp && <FormGrid cols={1}>
          <SelectInput label="Vendor" required value={resp.vendorId} options={supOpts.filter((o) => r.vendorIds.includes(o.value))} onChange={(v) => setResp({ ...resp, vendorId: v })} />
          <NumberInput label="Rate (per unit, AED)" required value={resp.rate} onChange={(v) => setResp({ ...resp, rate: Number(v) })} />
          <NumberInput label="Lead Time (days)" value={resp.leadTime} onChange={(v) => setResp({ ...resp, leadTime: Number(v) })} />
          <NumberInput label="Minimum Order Quantity" value={resp.moq} onChange={(v) => setResp({ ...resp, moq: Number(v) })} />
          <DateInput label="Response Date" value={resp.date} onChange={(v) => setResp({ ...resp, date: v })} />
        </FormGrid>}
      </AppDialog>
      <AppDialog open={!!award} title="Award vendor" onClose={() => setAward(null)} confirmLabel="Award" onConfirm={() => { if (!award) return; awardChRfq(r.id, award.vendorId, award.comment); toast('Vendor awarded'); setAward(null); }}>
        {award && <FormGrid cols={1}>
          {r.awardedVendorId && r.awardedVendorId !== award.vendorId && <Alert severity="warning">You have already selected the vendor for this item. Do you want to update the vendor details?</Alert>}
          <TextInput label="Add Comment" multiline rows={3} value={award.comment} onChange={(v) => setAward({ ...award, comment: v })} />
        </FormGrid>}
      </AppDialog>
      {order && <ChOrderDialog open onClose={() => setOrder(false)} requestIds={r.requestIds} rfq={r} qty={r.qty} />}
    </>
  );
}

/* ------------------------------------------------------------------ 4. Orders (Hire Orders), the five stages are tracked here */
const orderStatus = (c: CrossHire) => c.status ?? 'Approved';
const orderCost = (c: CrossHire) => c.rate + (c.dispute ?? 0) + (c.expenses ?? []).reduce((t, e) => t + e.amount, 0);
export function ChOrderList() {
  const nav = useNavigate();
  const ch = useCrossHire();
  return (
    <Page>
      <PageTitle title="Orders" subtitle="Cross Hire Orders (Hire Orders). Created from a request, the Process screen or an awarded RFQ." change="changed" req={R.cross} />
      <DataTable<CrossHire & { stageName: string }> rows={ch.rows.map((r) => ({ ...r, stageName: CROSS_STAGES[r.stage] }))} searchPlaceholder="Search orders..." filter={{ key: 'stageName', options: CROSS_STAGES, label: 'Stage' }} onRowClick={(r) => nav(`/rental/cross-hire-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'Hire Order Number' }, { key: 'so', label: 'Rental Order(s)', render: (r) => r.soNumber }, { key: 'supplier', label: 'Supplier' }, { key: 'type', label: 'Cross Hire Type', render: (r) => r.type ?? 'Inventory' },
          { key: 'cat', label: 'Category + Subcategory', render: (r) => `${r.group} ${r.category}` }, { key: 'dates', label: 'Dates', render: (r) => (r.startDate ? `${r.startDate}${r.endDate ? ` to ${r.endDate}` : ''}` : r.date) },
          { key: 'rec', label: 'Receiving Status', render: (r) => <StatusChip status={r.receiving ?? 'Pending Receiving'} /> }, { key: 'total', label: 'Total Value', align: 'right', render: (r) => aed(orderCost(r)) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={orderStatus(r)} /> },
          { key: 'stageName', label: 'Lifecycle Stage', change: 'new', req: R.cross, render: (r) => <StatusChip status={r.stageName} /> },
        ]} />
    </Page>
  );
}

export function ChOrderView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const all = useCrossHire();
  const c = all.get(id);
  const [dlg, setDlg] = useState<'receive' | 'return' | 'supplier' | 'expense' | null>(null);
  const [v, setV] = useState({ inv: '', notes: '', files: [] as string[], dispute: '', reissue: '', account: '', amount: '', note: '' });
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" right={<Button variant="outlined" onClick={() => nav('/rental/cross-hire-orders')}>Back</Button>} /></Page>;
  const dropship = c.type === 'Dropship';
  const a = assetById(c.assetId ?? '');
  const cost = orderCost(c);
  const margin = c.revenue - cost;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: c.number }]} status={<StatusChip status={orderStatus(c)} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${c.soId}`)}>View Sales Order</Button>
          {c.stage < 4 && <Button variant="outlined" onClick={() => setDlg('expense')}>Add Expense</Button>}
          {c.stage === 0 && !dropship && <Button variant="contained" onClick={() => setDlg('receive')}>Receive</Button>}
          {c.stage === 0 && dropship && <Button variant="contained" onClick={() => { markChShipped(c); toast('Marked shipped to the client site'); }}>Mark Shipped</Button>}
          {c.stage === 1 && <Button variant="contained" onClick={() => nav(`/crm/delivery-orders/add?so=${c.soId}&line=${c.lineId}`)}>Allocate through Delivery</Button>}
          {c.stage === 2 && !dropship && <Button variant="contained" onClick={() => setDlg('return')}>Record Return to Us</Button>}
          {(c.stage === 3 || (c.stage === 2 && dropship)) && <Button variant="contained" onClick={() => setDlg('supplier')}>Return to Supplier</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <LifecycleStepper steps={CROSS_STAGES} current={c.stage} />
        {dropship && <Alert severity="info" sx={{ mt: 2 }}>Dropship: the supplier ships straight to the client site, so there is no goods receipt, no Return to Us and no Fixed Asset Register entry.</Alert>}
        <ValueGrid>
          <ValueField label="Hire Order Number" value={c.number} /><ValueField label="Date" value={c.date} /><ValueField label="Rental Order(s)" value={c.soNumber} /><ValueField label="Supplier" value={c.supplier} />
          <ValueField label="Cross Hire Type" value={c.type ?? 'Inventory'} /><ValueField label="Group + Category" value={`${c.group} ${c.category}`} /><ValueField label="Quantity" value={String(c.qty ?? 1)} /><ValueField label="Agreed Rate (total)" change="new" req={R_CH} value={aed(c.rate)} />
          <ValueField label="Confirmation Date" value={c.confirmationDate} /><ValueField label="Expected Receipt Date" value={c.expectedReceipt} /><ValueField label="Payment Terms" value={c.paymentTerms} /><ValueField label="Rental Period" value={c.startDate ? `${c.startDate}${c.endDate ? ` to ${c.endDate}` : ''}` : undefined} />
          <ValueField label="Receiving Status" value={c.receiving} /><ValueField label="Billing Status" value={c.billing} /><ValueField label="Request(s)" value={c.requestIds?.length ? 'Linked' : 'Direct'} />
          <ValueField label="Lifecycle Stage" change="new" req={R.cross} value={CROSS_STAGES[c.stage]} />
          <ValueField label="Asset (Fixed Asset Register)" change="new" req={R.cross} value={a ? `${a.assetId}, ${a.assetStatus}, ownership ${a.ownership}` : dropship ? 'Not applicable (Dropship)' : 'Not received yet'} /><ValueField label="Depreciation" change="new" req={R.cross} value="Not posted (cross-hired asset)" />
          <ValueField label="Supplier Invoice Reference" change="new" req={R.cross} value={c.supplierInvoice} /><ValueField label="Condition Check (on Return to Us)" change="new" req={R.cross} value={c.condition?.notes} /><ValueField label="Supplier dispute charge" change="new" req={R.cross} value={c.dispute ? aed(c.dispute) : undefined} />
        </ValueGrid>
        <Panel title="Profitability (rolls into the originating Sales Order)" sx={{ mt: 3 }} change="new" req={R.cross}>
          <ValueGrid><ValueField label="Vendor Cost (incl. expenses and dispute)" value={aed(cost)} /><ValueField label="Customer Revenue" value={aed(c.revenue)} /><ValueField label="Profit" value={aed(margin)} /><ValueField label="Margin %" value={c.revenue ? `${Math.round((margin / c.revenue) * 100)}%` : '-'} /></ValueGrid>
        </Panel>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Item Entries', content: <DataTable hideToolbar rows={[c]} columns={[{ key: 'item', label: 'Item', render: (x) => `${x.group} ${x.category}` }, { key: 'u', label: 'UOM', render: () => 'Nos' }, { key: 'q', label: 'Quantity', align: 'right', render: (x) => x.qty ?? 1 }, { key: 'r', label: 'Rental Rate', align: 'right', render: (x) => aed(x.rate / (x.qty ?? 1)) }, { key: 't', label: 'Total Amount', align: 'right', render: (x) => aed(x.rate) }]} /> },
            { label: 'Expenses', content: <DataTable hideToolbar rows={(c.expenses ?? []).map((e, i) => ({ id: String(i), ...e }))} emptyText="No expenses" columns={[{ key: 'account', label: 'Account' }, { key: 'note', label: 'Narration' }, { key: 'amount', label: 'Total Amount', align: 'right', render: (x) => aed(x.amount) }]} /> },
            { label: 'Stage history', content: <Timeline items={[...c.history].reverse()} /> },
          ]} />
        </Box>
      </Page>
      <AppDialog open={dlg === 'receive'} title="Receive cross-hired unit" onClose={() => setDlg(null)} confirmLabel="Receive" confirmDisabled={!v.inv.trim()} onConfirm={() => { receiveCrossHire(c, v.inv); toast('Unit received and added to the Fixed Asset Register as Cross-Hired, Ready for Hire'); setDlg(null); }}>
        <TextInput label="Supplier Invoice Reference" required value={v.inv} onChange={(x) => setV({ ...v, inv: x })} hint="Cross-hire cost feeds into the supplier's invoice" />
      </AppDialog>
      <AppDialog open={dlg === 'return'} title="Return to Us: condition check" onClose={() => setDlg(null)} confirmLabel="Save" confirmDisabled={!v.notes.trim()} onConfirm={() => { returnToUs(c, v.notes, v.files); toast('Returned to us. The unit is flagged as Cross-Hire idle at our location'); setDlg(null); }}>
        <FormGrid cols={1}><TextInput label="Condition inspection notes" required multiline rows={3} value={v.notes} onChange={(x) => setV({ ...v, notes: x })} hint="Same inspection process as an owned asset returned by a customer" /><FileInput label="Attachments" multiple value={v.files} onChange={(x) => setV({ ...v, files: x })} /></FormGrid>
      </AppDialog>
      <AppDialog open={dlg === 'supplier'} title="Return to Supplier" onClose={() => setDlg(null)} confirmLabel="Close the loop" onConfirm={() => { returnToSupplier(c, Number(v.dispute) || 0, v.reissue || undefined); toast('Returned to supplier'); setDlg(null); }}>
        <FormGrid cols={1}><NumberInput label="Supplier dispute / additional charge (AED, if any)" value={v.dispute} onChange={(x) => setV({ ...v, dispute: x })} hint="Traced back to the client project so its true profitability is visible" /><TextInput label="Re-Issue Reference (optional)" value={v.reissue} onChange={(x) => setV({ ...v, reissue: x })} hint="If the unit was re-issued to another project first" /></FormGrid>
      </AppDialog>
      <AppDialog open={dlg === 'expense'} title="Expense Entry" onClose={() => setDlg(null)} confirmLabel="Add" confirmDisabled={!v.account || !Number(v.amount)} onConfirm={() => { addChExpense(c.id, { account: v.account, amount: Number(v.amount), note: v.note }); toast('Expense added'); setV({ ...v, account: '', amount: '', note: '' }); setDlg(null); }}>
        <FormGrid cols={1}><SelectInput label="Account" required value={v.account} options={['Transportation Expense', 'Loading and Unloading', 'Fuel Expense', 'Insurance Expense', 'Other Direct Expense']} onChange={(x) => setV({ ...v, account: x })} /><NumberInput label="Total Amount (AED)" required value={v.amount} onChange={(x) => setV({ ...v, amount: x })} /><TextInput label="Narration" value={v.note} onChange={(x) => setV({ ...v, note: x })} /></FormGrid>
      </AppDialog>
    </>
  );
}
