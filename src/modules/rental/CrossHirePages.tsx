import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { CheckInput, DateInput, FileInput, FormGrid, MultiSelectInput, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { ChangeTag } from '@/components/ChangeTag';
import { suppliers } from '@/mock-data/masters';
import {
  COL, reqItems, chItems, itemReceived, CH_ORDER_STATUSES, ownedEquivalent, unitsOf, CH_REQUEST_STATUSES, CH_TYPES, CROSS_STAGES, DEPARTMENTS, TODAY, stockLocations, assetById, availability, fleetRows, isLive, masterValues, type CrossHire, type CrossHireRequest, type CrossHireRfq, type RfqResponse,
} from '@/modules/crm/data';
import { addChExpense, billCrossHire, createChRfq, createHireOrder, decideChOrder, deleteChOrder, markChShipped, raiseCrossHire, reissueCrossHire, setChOrderStatus, submitChOrder, returnToSupplier, returnToUs, sendChRfq, submitChRequest, saveChRequest } from '@/modules/crm/flow';
import { SpecForm, type Spec } from '@/modules/crm/FormKit';
import { R, aed, useChRequests, useChRfqs, useCrossHire, useMaster, useOrders } from '@/modules/crm/shared';
import { getCollection } from '@/store/store';
import { billTotal, billsOfSource } from '@/modules/accounting/engine';
import { useBills } from '@/modules/accounting/shared';

const HIRE_SUPPLIERS = suppliers.filter((s) => s.type === 'Cross-Hire Company');
const supOpts = HIRE_SUPPLIERS.map((s) => ({ value: s.id, label: s.name }));
const R_CH = 'Existing ERP Cross Hire (Requests, Process, Request for Quote, Orders) combined with Procurement > Cross-Hire Suppliers';

const onHand = (g: string, c: string) => fleetRows().filter((a) => isLive(a) && !a.deliveryFleet && a.category === g && a.subCategory === c && a.ownership !== 'Cross-Hired').length;

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
          { key: 'cat', label: 'Category + Subcategory', change: 'new', req: R_CH, render: (r) => [...new Set(reqItems(r).map((i) => `${i.group} ${i.category}`))].join(', ') }, { key: 'qty', label: 'Quantity', align: 'right' },
          { key: 'vendor', label: 'Vendor Name', render: (r) => r.vendor ?? '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]} />
    </Page>
  );
}

const requestSpecs = (soOpts: { value: string; label: string }[], lineOpts: { value: string; label: string }[]): Spec[] => [
  { key: 'company', label: 'Entity', type: 'master', master: 'entity', required: true },
  { key: 'number', label: 'ID', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'soId', label: 'Rental Order ID', type: 'select', options: soOpts, required: true, hint: 'Rental Sales Orders from CRM' },
  { key: 'lineIds', label: 'Equipment line(s)', type: 'multi', options: lineOpts, required: true, change: 'new', req: R_CH, hint: 'Category and Subcategory come from the order line. One request is raised for each line, for the units not covered by stock or open requests' },
  { key: 'representative', label: 'Purchase Representative', type: 'select', options: ['Leena Thomas', 'Yousef Karim', 'Omar Farouk', 'Bilal Ahmed'] },
  { key: 'vendorId', label: 'Vendor', type: 'select', options: supOpts, hint: 'Optional. The RFQ award or the order fixes the supplier' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
  { key: 'location', label: 'Location', type: 'select', options: stockLocations },
  { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
  { key: 'attachments', label: 'Attachment', type: 'file', full: true },
];

export function ChRequestForm() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const [sp] = useSearchParams();
  const [f, setF] = useState<Record<string, any>>({ date: TODAY, company: masterValues('entity')[0], currency: 'AED', representative: 'Bilal Ahmed', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], soId: sp.get('so') ?? '', lineIds: sp.get('lines')?.split(',').filter(Boolean) ?? [] });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, ...(k === 'soId' ? { lineIds: [] } : {}) }));
  const rentals = orders.rows.filter((o) => o.activity === 'Rental');
  const so = rentals.find((o) => o.id === f.soId);
  const lines = (so?.lines ?? []).filter((l) => l.activity === 'Rental');
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    ['soId', 'company', 'currency', 'date'].forEach((k) => { if (!f[k]) e[k] = 'This field is required'; });
    if (!(f.lineIds ?? []).length) e.lineIds = 'Select at least one equipment line';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const rid = raiseCrossHire(f.soId, f.lineIds as string[], f.vendorId || undefined, HIRE_SUPPLIERS.find((x) => x.id === f.vendorId)?.name);
    const rec = getCollection<CrossHireRequest>(COL.chRequests).find((r) => r.id === rid)!;
    saveChRequest({ ...rec, date: f.date, company: f.company, representative: f.representative, currency: f.currency, narration: f.narration || rec.narration, location: f.location, department: f.department, attachments: f.attachments ?? [], status: draft ? 'Draft' : 'Pending' });
    toast(draft ? 'Request saved as draft' : 'Cross Hire Request saved');
    nav(`/rental/cross-hire/${rid}`);
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
  const r = reqs.get(id);
  if (!r) return <Page><PageTitle title="Request not found" right={<Button variant="outlined" onClick={() => nav('/rental/cross-hire')}>Back</Button>} /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Cross Hire Requests', to: '/rental/cross-hire' }, { label: r.number }]} status={<StatusChip status={r.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${r.soId}`)}>View Sales Order</Button>
          {(r.status === 'Draft' || r.status === 'Pending') && <Button variant="contained" onClick={() => { submitChRequest(r.id); toast('Request submitted and approved'); }}>Submit</Button>}
          {r.status === 'In Progress' && <MenuButton label="Create" variant="contained" items={[{ label: 'Order', onClick: () => nav(`/rental/cross-hire-orders/add?requests=${r.id}`) }, { label: 'RFQ', onClick: () => nav(`/rental/cross-hire-rfq/add?requests=${r.id}`) }]} />}
          {r.status === 'Completed' && r.orderId && <Button variant="contained" onClick={() => nav(`/rental/cross-hire-orders/${r.orderId}`)}>View Order</Button>}
          {r.status === 'Completed' && r.rfqId && <Button variant="outlined" onClick={() => nav(`/rental/cross-hire-rfq/${r.rfqId}`)}>View RFQ</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="Entity" value={r.company} /><ValueField label="ID" value={r.number} /><ValueField label="Date" value={r.date} /><ValueField label="Rental Order ID" value={r.soNumber} />
          <ValueField label="Raised By" change="new" req={R_CH} value={r.raisedBy} /><ValueField label="Purchase Representative" value={r.representative} /><ValueField label="Vendor" value={r.vendor ?? 'Decided at RFQ or order'} /><ValueField label="Currency" value={r.currency} /><ValueField label="Narration" value={r.narration} />
        </ValueGrid>
        <Panel title="Items" sx={{ mt: 3 }}>
          <DataTable hideToolbar rows={reqItems(r).map((i) => ({ ...i, id: i.lineId }))} columns={[
            { key: 'g', label: 'Category', change: 'new', req: R_CH, render: (x) => x.group }, { key: 'c', label: 'Subcategory', change: 'new', req: R_CH, render: (x) => x.category }, { key: 'u', label: 'UOM', render: () => 'Nos' },
            { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'oh', label: 'On Hand', align: 'right', render: (x) => onHand(x.group, x.category) }, { key: 'av', label: 'Available', align: 'right', render: (x) => availability(x.group, x.category).owned.length },
            { key: 'f', label: 'Rental Duration Type', render: (x) => x.frequency }, { key: 'rate', label: 'Rate', align: 'right', render: (x) => (x.rate ? aed(x.rate) : '-') },
            { key: 'cov', label: 'Covered by', render: (x) => (x.orderId ? 'Order' : x.rfqId ? 'RFQ' : '-') },
          ]} />
        </Panel>
        <Panel title="Classification" sx={{ mt: 2 }}><ValueGrid><ValueField label="Location" value={r.location} /><ValueField label="Department" value={r.department} /></ValueGrid></Panel>
        <Box sx={{ mt: 3 }}><TabPanels tabs={[{ label: 'Activity', content: <Timeline items={[...r.log].reverse()} /> }]} /></Box>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ 2. Process Cross Hire */
type ProcRow = { id: string; r: CrossHireRequest; i: ReturnType<typeof reqItems>[number] };
export function ChProcess() {
  const reqs = useChRequests();
  const [sel, setSel] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [type, setType] = useState<Record<string, 'Inventory' | 'Dropship'>>({});
  const nav = useNavigate();
  const toast = useToast();
  // One row per item of an In Progress request (the existing screen groups the requests by item).
  const rows: ProcRow[] = reqs.rows.filter((r) => r.status === 'In Progress').flatMap((r) => reqItems(r).filter((i) => !i.orderId && !i.rfqId).map((i) => ({ id: `${r.id}|${i.lineId}`, r, i })));
  const chosen = rows.filter((x) => sel.includes(x.id));
  const types = [...new Set(chosen.map((x) => type[x.id] ?? 'Inventory'))];
  const qOf = (x: ProcRow) => qty[x.id] ?? x.i.qty;
  const totalQty = chosen.reduce((t, x) => t + qOf(x), 0);
  const go = (k: 'order' | 'rfq') => {
    if (!chosen.length) { toast('Select at least one item', 'error'); return; }
    if (k === 'order' && types.length > 1) { toast('Selected rows have different Cross Hire Types. Create the orders separately', 'error'); return; }
    if (chosen.some((x) => !qOf(x))) { toast('Please fill all the required fields', 'error'); return; }
    // Like the existing ERP, Create opens the Order or RFQ form, prefilled from the selected rows.
    const ids = [...new Set(chosen.map((x) => x.r.id))].join(',');
    nav(k === 'order' ? `/rental/cross-hire-orders/add?requests=${ids}&rows=${chosen.map((x) => `${x.r.id}|${x.i.lineId}|${qOf(x)}`).join(',')}&type=${types[0] ?? 'Inventory'}` : `/rental/cross-hire-rfq/add?requests=${ids}&rows=${chosen.map((x) => x.id).join(',')}`);
  };
  return (
    <Page>
      <PageTitle title="Process Cross Hire" subtitle="Items of In Progress requests. Fill the Cross Hire Quantity and Type, select the rows, then create one Order or one RFQ for the rows selected." change="changed" req={R_CH}
        right={<MenuButton label="Create" variant="contained" items={[{ label: 'Cross Hire Order', onClick: () => go('order') }, { label: 'RFQ', onClick: () => go('rfq') }]} />} />
      <DataTable<ProcRow> rows={rows} selectable selected={sel} onSelect={setSel} hideToolbar emptyText="No In Progress cross hire requests to process"
        columns={[
          { key: 'item', label: 'Item', render: (x) => `${x.i.group} ${x.i.category}` }, { key: 'uom', label: 'UOM', render: () => 'Nos' }, { key: 'req', label: 'Request', render: (x) => x.r.number }, { key: 'soNumber', label: 'Rental Order ID', render: (x) => x.r.soNumber },
          { key: 'qty', label: 'Request Quantity', align: 'right', render: (x) => x.i.qty }, { key: 'oh', label: 'On Hand', align: 'right', render: (x) => onHand(x.i.group, x.i.category) },
          { key: 'av', label: 'Available', align: 'right', render: (x) => availability(x.i.group, x.i.category).owned.length },
          { key: 'cq', label: 'Cross Hire Quantity', render: (x) => <Box sx={{ width: 110 }}><NumberInput label="" value={qOf(x)} onChange={(v) => setQty({ ...qty, [x.id]: Number(v) })} /></Box> },
          { key: 'ct', label: 'Cross Hire Type', render: (x) => <Box sx={{ width: 150 }}><SelectInput label="" value={type[x.id] ?? 'Inventory'} options={CH_TYPES} onChange={(v) => setType({ ...type, [x.id]: v as 'Inventory' | 'Dropship' })} /></Box> },
          { key: 'vendor', label: 'Vendor', render: (x) => x.r.vendor ?? '-' },
        ]} />
      <Text type="s4" color="theme.secondary.700" sx={{ mt: 1 }}>Total : {rows.length}. Selected cross hire quantity: {totalQty}</Text>
    </Page>
  );
}

/* ------------------------------------------------------------------ 4. Orders (Hire Orders), the five stages are tracked here */
const orderStatus = (c: CrossHire) => c.status ?? 'Approved';
const orderCost = (c: CrossHire) => c.rate + (c.dispute ?? 0) + (c.expenses ?? []).reduce((t, e) => t + e.amount, 0);
const EDITABLE = ['Draft', 'Pending', 'Pending Approval', 'Rejected'];
const DELETABLE = [...EDITABLE, 'Cancelled'];
export function ChOrderList() {
  const nav = useNavigate();
  const toast = useToast();
  const ch = useCrossHire();
  const [del, setDel] = useState<CrossHire | null>(null);
  useBills();
  const billingOf = (r: CrossHire) => (billsOfSource('Cross Hire', r.id).length ? 'Fully Billed' : 'Pending Billing');
  const shown = (r: CrossHire) => ['Approved', 'Received', 'Billed', 'Shipped', 'Closed'].includes(orderStatus(r));
  return (
    <Page>
      <PageTitle title="Orders" subtitle="Cross Hire Orders (Hire Orders). Created here or from a request or an awarded RFQ, approved, then received on a Goods Receipt." change="changed" req={R.cross} />
      <DataTable<CrossHire & { stageName: string }> rows={ch.rows.map((r) => ({ ...r, stageName: CROSS_STAGES[r.stage] }))} searchPlaceholder="Search orders..." filter={{ key: 'status', options: CH_ORDER_STATUSES }} onAdd={() => nav('/rental/cross-hire-orders/add')} addLabel="Add New" onRowClick={(r) => nav(`/rental/cross-hire-orders/${r.id}`)}
        actions={[{ label: 'Edit', hidden: (r) => !EDITABLE.includes(orderStatus(r)), onClick: (r) => nav(`/rental/cross-hire-orders/${r.id}/edit`) }, { label: 'Delete', danger: true, hidden: (r) => !DELETABLE.includes(orderStatus(r)), onClick: (r) => setDel(r) }]}
        columns={[
          { key: 'number', label: 'Hire Order No.' }, { key: 'date', label: 'Date' }, { key: 'reference', label: 'Reference No.', render: (r) => r.form?.reference ?? '-' }, { key: 'supplier', label: 'Vendor' },
          { key: 'rep', label: 'Purchase Representative', render: (r) => r.form?.representative ?? '-' }, { key: 'company', label: 'Entity', render: (r) => r.form?.company ?? masterValues('entity')[0] },
          { key: 'expected', label: 'Expected Receipt Date', render: (r) => r.expectedReceipt ?? '-' }, { key: 'total', label: 'Total Value', align: 'right', render: (r) => aed(orderCost(r)) },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={orderStatus(r)} /> },
          { key: 'billing', label: 'Billing Status', render: (r) => (shown(r) ? <StatusChip status={billingOf(r)} /> : '-') }, { key: 'rec', label: 'Receiving Status', render: (r) => (shown(r) ? <StatusChip status={r.receiving ?? 'Pending Receiving'} /> : '-') },
          { key: 'so', label: 'Rental Order(s)', change: 'new', req: R.cross, render: (r) => r.soNumber }, { key: 'stageName', label: 'Lifecycle Stage', change: 'new', req: R.cross, render: (r) => <StatusChip status={r.stageName} /> },
        ]} />
      <ConfirmDialog open={!!del} title="Delete Orders" description={`Delete ${del?.number} ?`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { deleteChOrder(del.id); toast('Order deleted'); } setDel(null); }} />
    </Page>
  );
}

export function ChOrderView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const all = useCrossHire();
  useBills();
  const c = all.get(id);
  const [dlg, setDlg] = useState<'return' | 'supplier' | 'reissue' | null>(null);
  const [tgt, setTgt] = useState('');
  const [ask, setAsk] = useState<'accept' | 'reject' | 'cancel' | 'close' | 'delete' | null>(null);
  const yardChecklist = useMaster('yardChecklist').values;
  const reissueOpts = useOrders().rows.filter((o) => o.activity === 'Rental' && !['Closed', 'Cancelled', 'Rejected'].includes(o.status));
  const [v, setV] = useState({ inv: '', invDate: TODAY, notes: '', files: [] as string[], checks: [] as string[], dispute: '', reissue: '', account: '', amount: '', note: '' });
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" right={<Button variant="outlined" onClick={() => nav('/rental/cross-hire-orders')}>Back</Button>} /></Page>;
  const dropship = c.type === 'Dropship';
  const units = unitsOf(c);
  const nUnits = c.qty ?? 1;
  const cost = orderCost(c);
  const margin = c.revenue - cost;
  const owned = ownedEquivalent(c);
  const myBills = billsOfSource('Cross Hire', c.id);
  const billing = myBills.length ? 'Fully Billed' : 'Pending Billing';
  const st = orderStatus(c);
  const base = `/rental/cross-hire-orders/${c.id}`;
  const live = ['Approved', 'Received', 'Billed', 'Shipped'].includes(st);
  const actionItems = [
    { label: 'Edit', disabled: !EDITABLE.includes(st), onClick: () => nav(`${base}/edit`) },
    { label: 'Cancel', disabled: !['Draft', 'Pending', 'Pending Approval'].includes(st), onClick: () => setAsk('cancel') },
    { label: 'Close', disabled: !['Approved', 'Received', 'Billed'].includes(st), onClick: () => setAsk('close') },
    { label: 'Delete', disabled: !DELETABLE.includes(st), onClick: () => setAsk('delete') },
  ];
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: c.number }]} status={<StatusChip status={st} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${c.soId}`)}>View Sales Order</Button>
          <MenuButton label="Actions" items={actionItems} />
          {st === 'Pending' && <MenuButton label="Submit" variant="contained" items={[{ label: 'Submit for Approval', onClick: () => { submitChOrder(c.id, false); toast('Order has been submitted for approval'); } }, { label: 'Quick Approval', onClick: () => { submitChOrder(c.id, true); toast('Order has been approved successfully.'); } }]} />}
          {st === 'Pending Approval' && <MenuButton label="Accept" variant="contained" items={[{ label: 'Accept', onClick: () => setAsk('accept') }, { label: 'Reject', onClick: () => setAsk('reject') }]} />}
          {st === 'Rejected' && <MenuButton label="Re-Submit" variant="contained" items={[{ label: 'Submit for Approval', onClick: () => { submitChOrder(c.id, false); toast('Order has been submitted for approval'); } }, { label: 'Quick Approval', onClick: () => { submitChOrder(c.id, true); toast('Order has been approved successfully.'); } }]} />}
          {live && !myBills.length && <Button variant="outlined" onClick={() => nav(`/accounting/bills/add?crossHire=${c.id}`)}>Bill</Button>}
          {['Approved', 'Received', 'Billed'].includes(st) && !dropship && units.length < nUnits && <Button variant="contained" onClick={() => nav(`${base}/grns/add`)}>Receive</Button>}
          {st === 'Approved' && c.stage === 0 && dropship && <Button variant="contained" onClick={() => { markChShipped(c); toast('Marked shipped to the client site'); }}>Mark Shipped</Button>}
          {units.some((u) => u.stage === 1) && <Button variant="contained" onClick={() => nav(c.soId && c.lineId ? `/crm/delivery-orders/add?so=${c.soId}&line=${c.lineId}` : '/crm/delivery-orders')}>Allocate through Delivery</Button>}
          <MenuButton label="View" items={[{ label: 'GRN', disabled: dropship, onClick: () => nav(`${base}/grns`) }, { label: 'Bill', disabled: !myBills[0], onClick: () => nav(`/accounting/bills/${myBills[0].id}`) }]} />
          {dropship && c.stage === 2 && <Button variant="contained" onClick={() => { setTgt(''); setDlg('supplier'); }}>Return to Supplier</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <LifecycleStepper steps={CROSS_STAGES} current={c.stage} />
        {dropship && <Alert severity="info" sx={{ mt: 2 }}>Dropship: the supplier ships straight to the client site, so there is no goods receipt, no Return to Us and no Fixed Asset Register entry.</Alert>}
        <ValueGrid>
          <ValueField label="Hire Order Number" value={c.number} /><ValueField label="Date" value={c.date} /><ValueField label="Rental Order (demand)" value={c.soNumber || 'Not tied to an order'} /><ValueField label="Supplier" value={c.supplier} />
          <ValueField label="Cross Hire Type" value={c.type ?? 'Inventory'} /><ValueField label="Items" change="changed" req={R.cross} value={chItems(c).map((i) => `${i.group} ${i.category} x ${i.qty}`).join(', ')} /><ValueField label="Units" change="changed" req={R.cross} value={`${nUnits} ordered, ${units.length} received`} /><ValueField label="Agreed Rate (total)" change="new" req={R_CH} value={aed(c.rate)} />
          <ValueField label="Confirmation Date" value={c.confirmationDate} /><ValueField label="Expected Receipt Date" value={c.expectedReceipt} /><ValueField label="Payment Terms" value={c.paymentTerms} /><ValueField label="Rental Period" value={c.startDate ? `${c.startDate}${c.endDate ? ` to ${c.endDate}` : ''}` : undefined} />
          <ValueField label="Receiving Status" value={c.receiving} /><ValueField label="Billing Status" change="changed" req={R.cross} value={billing} /><ValueField label="Request(s)" value={c.requestIds?.length ? 'Linked' : 'Direct'} />
          <ValueField label="Lifecycle Stage" change="new" req={R.cross} value={CROSS_STAGES[c.stage]} />
          <ValueField label="Assets (Fixed Asset Register)" change="new" req={R.cross} value={dropship ? 'Not applicable (Dropship)' : units.length ? units.map((u) => assetById(u.assetId)?.assetId).join(', ') : 'Not received yet'} /><ValueField label="Depreciation" change="new" req={R.cross} value="Not posted (cross-hired asset)" />
          <ValueField label="Supplier Invoice Reference" change="new" req={R.cross} value={c.supplierInvoice} /><ValueField label="Condition Check (on Return to Us)" change="new" req={R.cross} value={c.condition ? `${c.condition.checks?.length ? `${c.condition.checks.length} of ${yardChecklist.length} checks. ` : ''}${c.condition.notes}${c.condition.files.length ? ` (${c.condition.files.length} attachment(s))` : ''}` : undefined} /><ValueField label="Supplier dispute charge" change="new" req={R.cross} value={c.dispute ? aed(c.dispute) : undefined} /><ValueField label="Re-Issue Reference" change="new" req={R.cross} value={c.reissueRef ?? 'Not re-issued'} />
        </ValueGrid>
        <Panel title="Profitability (rolls into the originating Sales Order)" sx={{ mt: 3 }} change="new" req={R.cross}>
          <ValueGrid><ValueField label="Vendor Cost (incl. expenses and dispute)" value={aed(cost)} /><ValueField label="Customer Revenue" value={aed(c.revenue)} /><ValueField label="Profit" value={aed(margin)} /><ValueField label="Margin %" value={c.revenue ? `${Math.round((margin / c.revenue) * 100)}%` : '-'} /></ValueGrid>
          <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Buy vs hire (if the business owned an equivalent unit)<ChangeTag kind="new" req={R.cross} /></Text>
          {owned ? <ValueGrid>
            <ValueField label="Owned cost per month (estimate)" value={aed(owned.monthly)} /><ValueField label={`Owned cost for ${owned.months} month(s)`} value={aed(owned.cost)} />
            <ValueField label="Margin if owned" value={aed(owned.margin)} /><ValueField label="Difference to cross-hire margin" value={<span style={{ color: owned.margin - margin >= 0 ? '#0A6C3D' : '#C64D4D', fontWeight: 600 }}>{aed(owned.margin - margin)}</span>} />
          </ValueGrid> : <Text type="s5" color="theme.secondary.700">No owned unit of the ordered Categories on the register to compare with.</Text>}
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Estimate from the average purchase value of the owned units of this Category and Subcategory over their useful life, for the hire period of this order. It supports the decision to buy or keep cross-hiring; the exact method is to be confirmed with the client.</Text>
        </Panel>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Item Entries', content: <DataTable hideToolbar rows={chItems(c)} columns={[{ key: 'item', label: 'Item', render: (x) => `${x.group} ${x.category}` }, { key: 'u', label: 'UOM', render: () => 'Nos' }, { key: 'q', label: 'Quantity', align: 'right', render: (x) => x.qty }, { key: 'recv', label: 'Received', align: 'right', render: (x) => itemReceived(c, x) }, { key: 'r', label: 'Rental Rate', align: 'right', render: (x) => aed(x.rate) }, { key: 't', label: 'Total Amount', align: 'right', render: (x) => aed(x.rate * x.qty) }]} /> },
            { label: 'Units', change: 'new', req: R.cross, content: (
              <>
                <DataTable hideToolbar rows={units.map((u) => ({ ...u, id: u.assetId }))} emptyText={dropship ? 'Dropship: the supplier delivers to the client site, no asset enters the register' : 'No asset received yet. Receive creates a Goods Receipt where the assets are defined'}
                  actions={[
                    { label: 'Record Return to Us', hidden: (u) => u.stage !== 2, onClick: (u) => { setTgt(u.assetId); setDlg('return'); } },
                    { label: 'Re-Issue to another project', hidden: (u) => u.stage !== 3, onClick: (u) => { setTgt(u.assetId); setDlg('reissue'); } },
                    { label: 'Return to Supplier', hidden: (u) => u.stage !== 3, onClick: (u) => { setTgt(u.assetId); setDlg('supplier'); } },
                  ]}
                  columns={[
                    { key: 'a', label: 'Asset ID', render: (u) => assetById(u.assetId)?.assetId ?? '-' }, { key: 'sn', label: 'Serial Number', render: (u) => assetById(u.assetId)?.engineNo ?? '-' },
                    { key: 'cat', label: 'Received as', render: (u) => { const h = assetById(u.assetId); return h ? `${h.category} ${h.subCategory}` : '-'; } },
                    { key: 'st', label: 'Lifecycle Stage', render: (u) => <StatusChip status={CROSS_STAGES[u.stage]} /> }, { key: 'so', label: 'Sales Order', render: (u) => u.soNumber ?? 'Not delivered yet' },
                    { key: 'cc', label: 'Condition Check', render: (u) => (u.condition ? `${u.condition.checks?.length ?? 0} checks` : '-') }, { key: 'rf', label: 'Re-Issue Reference', render: (u) => u.reissueRef ?? '-' }, { key: 'ds', label: 'Dispute Charge', align: 'right', render: (u) => (u.dispute ? aed(u.dispute) : '-') },
                  ]} />
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>The order is by Category and Subcategory. Each asset received is one unit and moves through the lifecycle on its own; it is bound to a Sales Order at the Delivery Order.</Text>
              </>) },
            { label: 'Bills', change: 'new', req: R.cross, content: <DataTable hideToolbar rows={myBills} emptyText={dropship ? 'No bill yet. Create, Bill when the supplier invoice arrives' : 'The bill is created when the unit is received'} onRowClick={(b) => nav(`/accounting/bills/${b.id}`)} columns={[{ key: 'number', label: 'Bill' }, { key: 'supplierInvoiceNo', label: 'Supplier Invoice' }, { key: 'date', label: 'Date' }, { key: 't', label: 'Total (incl. VAT)', align: 'right', render: (b) => aed(billTotal(b)) }, { key: 'a', label: 'Status', render: (b) => <StatusChip status={b.approval} /> }, { key: 'p', label: 'Payment', render: (b) => (b.approval === 'Approved' ? <StatusChip status={b.payStatus} /> : '-') }]} /> },
            { label: 'Stage history', content: <Timeline items={[...c.history].reverse()} /> },
          ]} />
        </Box>
      </Page>
      <ConfirmDialog open={ask === 'accept' || ask === 'reject'} title={ask === 'accept' ? 'Approved request' : 'Rejected request'} description={`Are you sure you want to ${ask === 'accept' ? 'approve' : 'reject'} ${c.number}?`} confirmLabel="Submit" onClose={() => setAsk(null)}
        onConfirm={() => { decideChOrder(c.id, ask === 'accept'); toast(ask === 'accept' ? 'Order has been approved successfully.' : 'Order has been rejected successfully.'); setAsk(null); }} />
      <ConfirmDialog open={ask === 'cancel' || ask === 'close'} title={ask === 'cancel' ? 'Cancel Order' : 'Close Order'} description={`${ask === 'cancel' ? 'Cancel' : 'Close'} ${c.number}?`} confirmLabel="Yes" onClose={() => setAsk(null)}
        onConfirm={() => { setChOrderStatus(c.id, ask === 'cancel' ? 'Cancelled' : 'Closed'); setAsk(null); }} />
      <ConfirmDialog open={ask === 'delete'} title="Delete Orders" description={`Delete ${c.number} ?`} danger confirmLabel="Delete" onClose={() => setAsk(null)} onConfirm={() => { deleteChOrder(c.id); toast('Order deleted'); nav('/rental/cross-hire-orders'); }} />
      <AppDialog open={dlg === 'return'} title="Return to Us: condition check" onClose={() => setDlg(null)} confirmLabel="Save" confirmDisabled={v.checks.length < yardChecklist.length && !v.notes.trim()} onConfirm={() => { returnToUs(c, v.notes, v.files, v.checks, tgt || undefined); toast('Returned to us. The unit is flagged as Cross-Hire idle at our location'); setDlg(null); }}>
        <Text type="s3" weight="medium" sx={{ mb: 0.5 }}>Yard checklist<ChangeTag kind="new" req={R.cross} /></Text>
        <FormGrid cols={1}>{yardChecklist.map((k) => <CheckInput key={k} label={k} checked={v.checks.includes(k)} onChange={(on) => setV({ ...v, checks: on ? [...v.checks, k] : v.checks.filter((x) => x !== k) })} />)}</FormGrid>
        <FormGrid cols={1}><TextInput label="Condition inspection notes" required={v.checks.length < yardChecklist.length} multiline rows={3} value={v.notes} onChange={(x) => setV({ ...v, notes: x })} hint="Same inspection process as an owned asset returned by a customer. Notes are required when a check is not ticked" /><FileInput label="Attachments" multiple value={v.files} onChange={(x) => setV({ ...v, files: x })} /></FormGrid>
      </AppDialog>
      <AppDialog open={dlg === 'reissue'} title="Re-Issue to another project" onClose={() => setDlg(null)} confirmLabel="Re-Issue" confirmDisabled={!v.reissue} onConfirm={() => { reissueCrossHire(c, v.reissue, tgt || undefined); toast('Unit is Ready for Hire again. Allocate it with a Delivery Order'); setV({ ...v, reissue: '' }); setDlg(null); }}>
        <Alert severity="info" sx={{ mb: 2 }}>The unit has passed the Return to Us condition check. Instead of going back to the supplier it is offered to another client project; its supplier and rate stay as agreed.</Alert>
        <FormGrid cols={1}><SelectInput label="Re-Issue Reference (Sales Order)" required change="new" req={R.cross} value={v.reissue} options={reissueOpts.filter((o) => o.id !== (units.find((u) => u.assetId === tgt)?.soId ?? c.soId)).map((o) => ({ value: o.id, label: `${o.number} - ${o.title}` }))} onChange={(x) => setV({ ...v, reissue: x })} hint="The rental order that will use the unit next" /></FormGrid>
      </AppDialog>
      <AppDialog open={dlg === 'supplier'} title="Return to Supplier" onClose={() => setDlg(null)} confirmLabel="Close the loop" onConfirm={() => { returnToSupplier(c, Number(v.dispute) || 0, undefined, tgt || undefined); toast('Returned to supplier'); setDlg(null); }}>
        <FormGrid cols={1}><NumberInput label="Supplier dispute / additional charge (AED, if any)" value={v.dispute} onChange={(x) => setV({ ...v, dispute: x })} hint="Traced back to the client project so its true profitability is visible" /></FormGrid>
      </AppDialog>
    </>
  );
}
