import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import dayjs from 'dayjs';
import { employees, locations } from '@/mock-data/masters';
import { DataTable } from '@/components/DataTable';
import { AppDialog, useToast } from '@/components/Dialogs';
import { MultiSelectInput, SelectInput, TextInput } from '@/components/Form';
import { SignaturePad } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { neutral } from '@/theme/color';
import { allLocations, liveItems, DELIVERY_STATUSES, DELIVERY_TYPES, DEPARTMENTS, FAULT_ATTRIBUTION, TODAY, TRANSPORT_TYPES, assetById, availability, categoryOptions, custName, nowStamp, type Delivery, type DoItem, type Line } from './data';
import { createDelivery, deliveredQty, getOrder } from './flow';
import { Section, SpecForm, SpecView, type Spec } from './FormKit';
import { Note, R, aed, useDeliveries, useFleet, useOrders } from './shared';

const stockOf = (l: Line) => liveItems().find((i) => i.name === l.item)?.stock ?? 0;
/** Lines still to be delivered: rental by unit, other items until a delivery is recorded. */
const serial = (l: Line) => l.activity === 'Rental' || l.activity === 'Fixed Asset Trading';
const remainingOf = (l: Line) => (serial(l) ? l.qty - deliveredQty(l) : l.activity === 'Trading' || l.activity === 'Fuel Trading' ? (l.fulfilment ? 0 : l.qty) : 0);
const supplierHeld = (name?: string) => locations.find((x) => x.name === name)?.type === 'Supplier-Held Location';

export function DeliveryList() {
  const nav = useNavigate();
  const dels = useDeliveries();
  return (
    <Page>
      <PageTitle title="Delivery Orders" />
      <DataTable<Delivery> rows={dels.rows} searchPlaceholder="Search delivery orders..." filter={{ key: 'status', options: DELIVERY_STATUSES }} onAdd={() => nav('/crm/delivery-orders/add')} addLabel="Add Delivery Order" onRowClick={(r) => nav(`/crm/delivery-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date', render: (r) => r.date.replace('T', ' ') }, { key: 'soNumber', label: 'Sale Order' },
          { key: 'status', label: 'Status', change: 'changed', req: R.del, render: (r) => <StatusChip status={r.status} /> },
          { key: 'salesperson', label: 'Salesperson', render: (r) => r.salesperson ?? getOrder(r.soId)?.owner ?? '-' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) },
          { key: 'location', label: 'Location', render: (r) => r.location ?? 'Jebel Ali Main Yard' }, { key: 'supplierDoNo', label: "Supplier's DO No.", change: 'new', req: R.meet, render: (r) => r.supplierDoNo ?? '-' }, { key: 'company', label: 'Company', render: (r) => getOrder(r.soId)?.entity ?? '-' },
          { key: 'assets', label: 'Assigned Asset(s)', change: 'new', req: R.del, render: (r) => r.assetIds.map((h) => assetById(h)?.assetId).join(', ') || '-' },
          { key: 'type', label: 'Delivery Type', change: 'new', req: R.del }, { key: 'transport', label: 'Transport Type', change: 'new', req: R.del },
          { key: 'closed', label: 'DO Closure', change: 'new', req: R.rreturn, render: (r) => (r.closed ? 'Closed' : 'Open') },
        ]} />
    </Page>
  );
}

/** Header fields of the existing Delivery Order form, in order. */
const headerSpecs = (soOptions: { value: string; label: string }[]): Spec[] => [
  { key: 'number', label: 'ID', hint: 'Auto-generated on save, editable', change: 'changed', req: R.del },
  { key: 'date', label: 'Date Time', type: 'datetime', required: true, change: 'changed', req: R.del, hint: 'Actual dispatch date and time, editable' },
  { key: 'customerName', label: 'Customer', type: 'readonly' },
  { key: 'location', label: 'Location', type: 'select', options: allLocations, required: true, hint: 'Own yard, or a supplier yard for Fuel Trading' },
  { key: 'supplierDoNo', label: "Supplier's Delivery Order No.", required: true, change: 'new', req: R.meet, show: (f) => supplierHeld(f.location), hint: 'The supplier delivers on your behalf and shares their own DO, recorded here for tracking' },
  { key: 'soId', label: 'Sales Order', type: 'select', options: soOptions, required: true },
  { key: 'operationType', label: 'Operation Type', type: 'readonly' },
  { key: 'salesperson', label: 'Salesperson', type: 'readonly' },
  { key: 'entity', label: 'Company', type: 'readonly' },
  { key: 'reference', label: 'Reference Number' },
  { key: 'status', label: 'Status', type: 'select', options: DELIVERY_STATUSES, required: true, change: 'changed', req: R.del, hint: 'Acknowledged added to Picked, Packed, Dispatched, Delivered' },
  { key: 'type', label: 'Delivery Type', type: 'select', options: DELIVERY_TYPES, required: true, change: 'new', req: R.del, hint: 'Full or Partial supports staged delivery against one order' },
  { key: 'poNumber', label: 'PO Number' }, { key: 'poDate', label: 'PO Date', type: 'date' },
  { key: 'narration', label: 'Narration', type: 'textarea' },
];
const transportSpecs: Spec[] = [
  { key: 'transport', label: 'Transport Type', type: 'select', options: TRANSPORT_TYPES, required: true, change: 'new', req: R.del },
  { key: 'extCost', label: 'External Transport Cost (AED)', type: 'number', required: true, change: 'new', req: R.del, show: (f) => f.transport === 'External Transporter', hint: 'Posts to the same Order / Project cost centre' },
  { key: 'transportedBy', label: 'Transported By' },
  { key: 'driver', label: 'Driver', type: 'select', options: employees.filter((e) => e.designation === 'Driver' || e.designation === 'Service Desk Dispatcher').map((e) => e.name) },
  { key: 'vehicleNumber', label: 'Vehicle Number' }, { key: 'iqama', label: 'Iqama / Resident Number', hint: '10 digits' }, { key: 'mobile', label: 'Mobile Number' },
];

export function DeliveryForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const orders = useOrders();
  const fleet = useFleet();
  const initSo = orders.get(sp.get('so') ?? '');
  const quick = sp.get('quick') === '1';
  const pendingOf = (so?: typeof initSo) => (so?.lines ?? []).filter((l) => remainingOf(l) > 0);
  const autoItems = (so?: typeof initSo): Record<string, DoItem> => {
    const out: Record<string, DoItem> = {};
    pendingOf(so).forEach((l) => {
      if (sp.get('line') && sp.get('line') !== l.id && !quick) return;
      if (serial(l)) {
        if (quick || sp.get('line') === l.id) { const av = availability(l.group, l.category, fleet.rows); const ids = [...av.owned, ...av.cross].slice(0, remainingOf(l)).map((a) => a.id); out[l.id] = { lineId: l.id, qty: ids.length, assetIds: ids, deliveredSub: l.category }; }
      } else out[l.id] = { lineId: l.id, qty: remainingOf(l), assetIds: [] };
    });
    return out;
  };
  const [f, setF] = useState<Record<string, any>>(() => ({
    number: '', date: `${TODAY}T${dayjs().format('HH:mm')}`, soId: initSo?.id ?? '', location: 'Jebel Ali Main Yard', status: 'Dispatched', type: 'Full', reference: '', poNumber: initSo?.lpo ?? '', poDate: initSo?.lpoDate ?? '', narration: '', transport: 'Own Fleet', extCost: '', transportedBy: '', driver: '', vehicleNumber: '', iqama: '', mobile: '',
    department: '', description: '', conditionFiles: [] as string[], signed: false, manual: [] as string[], foc: false, rentalStart: TODAY, startReason: '', startBy: '', waitingCharge: '', serviceLineIds: [] as string[], items: autoItems(initSo),
  }));
  const [err, setErr] = useState<Record<string, string>>({});
  const [trace, setTrace] = useState<string | null>(null);
  const so = orders.get(f.soId);
  const pending = pendingOf(so);
  const set = (k: string, v: any) => setF((x) => (k === 'soId' ? { ...x, soId: v, items: autoItems(orders.get(v)), poNumber: orders.get(v)?.lpo ?? '', poDate: orders.get(v)?.lpoDate ?? '' } : { ...x, [k]: v }));
  const items = f.items as Record<string, DoItem>;
  const rentalSel = pending.filter((l) => l.activity === 'Rental' && (items[l.id]?.assetIds.length ?? 0) > 0);
  const supplierSite = supplierHeld(f.location);
  const late = rentalSel.length > 0 && f.rentalStart > f.date.slice(0, 10);
  const early = f.rentalStart < f.date.slice(0, 10);
  const view = { ...f, customerName: so ? custName(so.customerId) : '', operationType: 'Delivery', salesperson: so?.owner ?? '', entity: so?.entity ?? '' };
  const serviceLines = so ? so.lines.filter((l) => l.activity === 'Service') : [];
  const save = () => {
    const e: Record<string, string> = {};
    if (!so) e.soId = 'Select a confirmed Sales Order';
    const chosen = Object.values(items).filter((it) => it.qty > 0);
    if (so && !chosen.length) e.items = 'Select at least one item to deliver (use Trace Details for rental items)';
    chosen.forEach((it) => { const l = so!.lines.find((x) => x.id === it.lineId)!; if (it.qty > remainingOf(l)) e.items = `Only ${remainingOf(l)} of ${l.item} remain`; });
    if (f.transport === 'External Transporter' && !Number(f.extCost)) e.extCost = 'External Transport Cost is required for an external transporter';
    if (rentalSel.length) {
      if (!f.rentalStart) e.rentalStart = 'Rental Start Date is required';
      else if (early) e.rentalStart = 'Rental Start Date cannot be before the delivery date';
      if (late && (!f.startReason || !f.startBy)) e.late = 'A reason and who is responsible are required when the Rental Start Date differs from the delivery date';
    }
    if (supplierSite && !String(f.supplierDoNo ?? '').trim()) e.supplierDoNo = "Enter the supplier's Delivery Order number";
    if (f.iqama && !/^\d{10}$/.test(f.iqama)) e.iqama = 'Iqama / Resident Number must be 10 digits';
    if (['Delivered', 'Acknowledged'].includes(f.status) && !f.signed && !f.manual.length) e.signature = 'A Delivery Order cannot be completed without a customer e-signature or an attached manual confirmation';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const d = createDelivery({ soId: so!.id, date: f.date, type: f.type, items: chosen, description: f.description, transport: f.transport, extCost: Number(f.extCost) || 0, conditionFiles: f.conditionFiles,
      signature: f.signed ? 'E-signature' : f.manual.length ? 'Manual attachment' : '', foc: f.foc, status: f.status, number: f.number || undefined, driver: f.driver, narration: f.narration, rentalStart: rentalSel.length ? f.rentalStart : f.date.slice(0, 10),
      startReason: late ? f.startReason : undefined, startBy: late ? f.startBy : undefined, waitingCharge: late ? Number(f.waitingCharge) || undefined : undefined, serviceLineIds: f.serviceLineIds,
      supplierDoNo: supplierSite ? f.supplierDoNo : undefined, reference: f.reference, poNumber: f.poNumber, poDate: f.poDate, location: f.location, transportedBy: f.transportedBy, vehicleNumber: f.vehicleNumber, iqama: f.iqama, mobile: f.mobile, department: f.department, salesperson: so!.owner });
    toast(`${d.number} created. ${rentalSel.length ? (late ? `Assets are on Hold, billing starts ${f.rentalStart}` : 'Assets are On Hire and the billing cycle has started') : 'Stock delivered, ready to invoice'}`);
    nav(`/crm/delivery-orders/${d.id}`);
  };
  const soOptions = orders.rows.filter((o) => o.lines.some((l) => remainingOf(l) > 0) && !['Closed', 'Cancelled'].includes(o.status)).map((o) => ({ value: o.id, label: `${o.number} - ${custName(o.customerId)}` }));
  const traceLine = pending.find((l) => l.id === trace);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Delivery Orders', to: '/crm/delivery-orders' }, { label: 'Add Delivery Order' }]} actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        {quick && <Alert severity="info" sx={{ mb: 2 }}>Quick Delivery: every pending item is pre-filled with its full quantity and the first available assets. Review and save.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={headerSpecs(soOptions)} f={view} set={set} err={err} />
              <Section title="Items">
                <ItemsGrid pending={pending} items={items} fleetRows={fleet.rows} onTrace={setTrace} onQty={(id, q) => set('items', { ...items, [id]: { ...(items[id] ?? { lineId: id, assetIds: [] }), qty: q } })} />
                {err.items && <Text type="s5" color="#C64D4D">{err.items}</Text>}
                <Note>Only the items on the Sales Order can be delivered. Fuel level and Hour Meter are not captured here, that sits with Usage Readings.</Note>
              </Section>
              <Section title="Transportation"><SpecForm specs={transportSpecs} f={f} set={set} err={err} /></Section>
              {rentalSel.length > 0 && (
                <Section title="Rental Start" change="new" req={R.meet}>
                  <SpecForm specs={[
                    { key: 'rentalStart', label: 'Rental Start Date (Invoice Start)', type: 'date', required: true, hint: 'Defaults to the delivery date, editable. Billing for this delivery starts on this date' },
                    { key: 'startReason', label: 'Reason for the later start', type: 'master', master: 'delayReason', required: true, show: () => late },
                    { key: 'startBy', label: 'Delay is the responsibility of', type: 'select', options: FAULT_ATTRIBUTION, required: true, show: () => late, hint: 'Company: no penalty. Client: a waiting charge may apply' },
                    { key: 'waitingCharge', label: 'Lump sum for the waiting period (AED, optional)', type: 'number', show: () => late },
                  ]} f={f} set={set} err={err} />
                  {late && <Note>The assets stay on Hold until the Rental Start Date; invoicing does not start before it.</Note>}
                  {err.late && <Text type="s5" color="#C64D4D">{err.late}</Text>}
                </Section>
              )}
              <Section title="Classification"><SpecForm specs={[{ key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }]} f={f} set={set} /></Section>
              <Section title="Description and Attachments">
                <SpecForm specs={[
                  { key: 'description', label: 'Description', change: 'new', req: R.del, hint: 'Add or modify information. Not for additional items', full: true },
                  { key: 'serviceLineIds', label: 'Service lines delivered with this DO', type: 'multi', options: serviceLines.map((l) => ({ value: l.id, label: `${l.item} (${l.billing})` })), change: 'new', req: R.meet, hint: 'Picked from the Sales Order, for example delivery charge or damage waiver', show: () => serviceLines.length > 0 },
                  { key: 'conditionFiles', label: 'Delivery Condition Attachments', type: 'file', change: 'new', req: R.del, hint: 'Optional, not a gate to complete delivery' },
                  { key: 'foc', label: 'FOC (price is zero, asset still tracked)', type: 'check', change: 'new', req: R.del },
                ]} f={f} set={set} />
              </Section>
              <Section title="Customer Signature" change="new" req={R.del}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 2 }}>
                  <Box><Text type="s5" weight="medium" sx={{ mb: 0.5 }}>E-signature (preferred)</Text><SignaturePad onChange={(s) => set('signed', s)} /></Box>
                  <SpecForm specs={[{ key: 'manual', label: 'Manual fallback: signed printed form', type: 'file', hint: 'Where an e-signature is not possible on site' }]} f={f} set={set} cols={1} />
                </Box>
                {err.signature && <Text type="s5" color="#C64D4D">{err.signature}</Text>}
              </Section>
            </>) },
          { label: 'Package', content: <Text type="s4">Packages are packed and labelled in the existing Package flow (unchanged).</Text> },
          { label: 'Address and Contact', content: <Text type="s4">Shipping address and contact come from the Sales Order: {so ? `${so.shippingAddress ?? so.site}, ${so.contactPerson ?? '-'}` : 'select a Sales Order'}.</Text> },
          { label: 'Shipping', content: <Text type="s4">Transport details are captured under Transportation in Basic Details.</Text> },
          { label: 'Promotion', content: <Text type="s4">No promotion applies to a Delivery Order.</Text> },
        ]} />
      </Page>
      {traceLine && <TraceDialog line={traceLine} current={items[traceLine.id]} fleetRows={fleet.rows} onClose={() => setTrace(null)} onSave={(it) => { set('items', { ...items, [traceLine.id]: it }); setTrace(null); }} />}
    </>
  );
}

/** Existing DO item table: Item, UOM, Sales Order Line, Quantity, On Hand, Reserved, Remaining, Delivered Quantity, Location, Package, Trace Details. */
function ItemsGrid({ pending, items, fleetRows, onTrace, onQty }: { pending: Line[]; items: Record<string, DoItem>; fleetRows: any[]; onTrace: (id: string) => void; onQty: (id: string, q: number) => void }) {
  const head = ['Item', 'UOM', 'Sales Order Line', 'Quantity', 'On Hand', 'Reserved', 'Remaining', 'Delivered Quantity', 'Location', 'Package', 'Trace Details'];
  return (
    <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
      <Table size="small">
        <TableHead><TableRow sx={{ bgcolor: neutral[100] }}>{head.map((h) => <TableCell key={h} sx={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 13 }}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {pending.length === 0 && <TableRow><TableCell colSpan={head.length}><Text type="s4" color="theme.secondary.700">Select a Sales Order with items still to deliver.</Text></TableCell></TableRow>}
          {pending.map((l, n) => {
            const it = items[l.id];
            const rental = serial(l);
            const av = rental ? availability(l.group, l.category, fleetRows) : { owned: [], cross: [] };
            const onHand = rental ? av.owned.length + av.cross.length : stockOf(l);
            return (
              <TableRow key={l.id}>
                <TableCell sx={{ fontSize: 13 }}>{l.item}{rental && <Text type="s5" color="theme.secondary.700">{l.group} {l.category} (requested)</Text>}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{l.unit}</TableCell><TableCell sx={{ fontSize: 13 }}>{n + 1}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{l.qty}</TableCell><TableCell sx={{ fontSize: 13 }}>{onHand}</TableCell><TableCell sx={{ fontSize: 13 }}>0</TableCell><TableCell sx={{ fontSize: 13 }}>{remainingOf(l)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{rental ? (it?.qty ?? 0) : <input type="number" min={0} max={remainingOf(l)} value={it?.qty ?? 0} onChange={(e) => onQty(l.id, Number(e.target.value))} style={{ width: 70, padding: 4 }} />}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{l.location ?? 'Jebel Ali Main Yard'}</TableCell><TableCell sx={{ fontSize: 13 }}>-</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{rental ? <Button size="small" variant={it?.assetIds.length ? 'outlined' : 'contained'} onClick={() => onTrace(l.id)}>{it?.assetIds.length ? it.assetIds.map((h) => assetById(h)?.assetId).join(', ') : 'Trace'}</Button> : <Text type="s5" color="theme.secondary.700">Allocated from stock</Text>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Trace Details for a rental item: the exact serialized asset is chosen here, only Ready for Hire units, Category locked and Subcategory substitutable. */
function TraceDialog({ line, current, fleetRows, onClose, onSave }: { line: Line; current?: DoItem; fleetRows: any[]; onClose: () => void; onSave: (it: DoItem) => void }) {
  const [sub, setSub] = useState(current?.deliveredSub ?? line.category ?? '');
  const [ids, setIds] = useState<string[]>(current?.assetIds ?? []);
  const av = useMemo(() => availability(line.group, sub, fleetRows), [line, sub, fleetRows]);
  const reqAv = availability(line.group, line.category, fleetRows);
  const choices = [...av.owned, ...av.cross];
  const max = remainingOf(line);
  const differs = sub !== line.category;
  return (
    <AppDialog open title={`Trace Details: ${line.item}`} onClose={onClose} maxWidth="md" confirmLabel="Save" confirmDisabled={ids.length > max} onConfirm={() => onSave({ lineId: line.id, qty: ids.length, assetIds: ids, deliveredSub: sub })}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 2 }}>
        <TextInput label="Category" disabled value={line.group} hint="Locked to the Sales Order item" />
        <SelectInput label="Subcategory" required change="new" req={R.meet} value={sub} options={categoryOptions(line.group)} onChange={(v) => { setSub(v); setIds([]); }} hint={`Requested ${line.category}; change it to substitute`} />
      </Box>
      {differs && <Alert severity="warning" sx={{ mt: 2 }}>Delivering {line.group} {sub} against a request for {line.category}. {reqAv.owned.length + reqAv.cross.length > 0 ? `${reqAv.owned.length + reqAv.cross.length} unit(s) of the requested ${line.category} are Ready for Hire. ` : ''}This is logged as an allocation change; client documents keep the requested spec.</Alert>}
      <Box sx={{ mt: 2 }}>
        <MultiSelectInput label={`Assigned Asset(s), up to ${max}`} required value={ids} options={choices.map((a) => ({ value: a.id, label: `${a.assetId} - ${a.name}${a.ownership === 'Cross-Hired' ? ' (Cross-Hired)' : ''}` }))} onChange={setIds} error={ids.length > max ? `Only ${max} unit(s) remain` : undefined}
          hint="Only Ready for Hire units of this Category and Subcategory are listed" />
      </Box>
      {choices.length === 0 && <Alert severity="warning" sx={{ mt: 2 }}>No unit of {line.group} {sub} is Ready for Hire. Raise a Cross-Hire from the Sales Order.</Alert>}
    </AppDialog>
  );
}

export function DeliveryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const dels = useDeliveries();
  const orders = useOrders();
  const d = dels.get(id);
  const [sign, setSign] = useState<{ open: boolean; ok: boolean }>({ open: false, ok: false });
  if (!d) return <Page><PageTitle title="Delivery Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/delivery-orders')}>Back</Button>} /></Page>;
  const so = getOrder(d.soId) ?? orders.get(d.soId);
  const next = d.status === 'Dispatched' ? 'Delivered' : d.status === 'Delivered' ? 'Acknowledged' : undefined;
  const advance = () => {
    if (next && !d.signature) { setSign({ open: true, ok: false }); return; }
    if (next) { dels.update(d.id, { status: next }); toast(`Delivery marked ${next}`); }
  };
  const items = d.items ?? [{ lineId: d.lineId, qty: d.assetIds.length || 1, assetIds: d.assetIds, deliveredSub: d.deliveredSub }];
  const f = { ...d, customerName: custName(d.customerId), operationType: 'Delivery', salesperson: d.salesperson ?? so?.owner, entity: so?.entity, location: d.location ?? 'Jebel Ali Main Yard', soId: so?.number };
  const start = d.rentalStart ?? d.date.slice(0, 10);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Delivery Orders', to: '/crm/delivery-orders' }, { label: d.number }]} status={<StatusChip status={d.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${d.soId}`)}>View Sales Order</Button>
          <Button variant="outlined" onClick={() => toast('Delivery Order print generated', 'info')}>Print</Button>
          {next && <Button variant="contained" onClick={advance}>Mark {next}</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={headerSpecs([])} f={f} />
              <Section title="Items">
                <DataTable hideToolbar rows={items.map((it) => ({ id: it.lineId, ...it }))} columns={[
                  { key: 'item', label: 'Item', render: (r) => so?.lines.find((l) => l.id === r.lineId)?.item },
                  { key: 'qty', label: 'Delivered Quantity', align: 'right' },
                  { key: 'sub', label: 'Requested / Delivered', change: 'new', req: R.meet, render: (r) => { const l = so?.lines.find((x) => x.id === r.lineId); return l && (l.activity === 'Rental' || l.activity === 'Fixed Asset Trading') ? `${l.category} / ${r.deliveredSub ?? l.category}` : '-'; } },
                  { key: 'trace', label: 'Trace Details', change: 'new', req: R.del, render: (r) => r.assetIds.map((h: string) => assetById(h)?.assetId).join(', ') || '-' },
                ]} />
              </Section>
              <Section title="Transportation"><SpecView specs={transportSpecs} f={f} /></Section>
              <Section title="Rental Start" change="new" req={R.meet}>
                <SpecView f={{ rentalStart: start, later: d.startReason ? `${d.startReason} (${d.startBy})${d.waitingCharge ? `, waiting charge ${aed(d.waitingCharge)}` : ''}` : '-', billing: `Starts ${start}`, closure: d.closed ? 'Closed automatically on return' : 'Open' }}
                  specs={[{ key: 'rentalStart', label: 'Rental Start Date' }, { key: 'later', label: 'Later start' }, { key: 'billing', label: 'Billing' }, { key: 'closure', label: 'Delivery Order closure' }]} />
              </Section>
              <Section title="Other" change="new" req={R.del}>
                <SpecView f={{ description: d.description, sig: d.signature || 'Not captured', foc: d.foc, department: d.department }} specs={[{ key: 'description', label: 'Description' }, { key: 'sig', label: 'Customer Signature' }, { key: 'foc', label: 'FOC' }, { key: 'department', label: 'Department' }]} />
              </Section>
            </>) },
          { label: 'Package', content: <Text type="s4">Packages are packed and labelled in the existing Package flow (unchanged).</Text> },
          { label: 'Address and Contact', content: <Text type="s4">Shipping address and contact come from the Sales Order: {so?.shippingAddress ?? so?.site}, {so?.contactPerson ?? '-'}.</Text> },
          { label: 'Shipping', content: <SpecView specs={transportSpecs} f={f} /> },
          { label: 'Promotion', content: <Text type="s4">No promotion applies to a Delivery Order.</Text> },
        ]} />
      </Page>
      <AppDialog open={sign.open} title="Customer signature required" onClose={() => setSign({ open: false, ok: false })} confirmLabel="Save signature and continue" confirmDisabled={!sign.ok}
        onConfirm={() => { dels.update(d.id, { signature: 'E-signature', status: next! }); toast(`Signature captured, delivery marked ${next} (${nowStamp()})`); setSign({ open: false, ok: false }); }}>
        <Text type="s4" sx={{ mb: 1 }}>A Delivery Order cannot be completed without a customer e-signature or a manual confirmation record.</Text>
        <SignaturePad onChange={(ok) => setSign({ open: true, ok })} />
      </AppDialog>
    </>
  );
}
