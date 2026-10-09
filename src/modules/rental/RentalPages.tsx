import { useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Radio, Select } from '@mui/material';
import { neutral } from '@/theme/color';
import { DataTable } from '@/components/DataTable';
import { AppDialog, MenuButton, useToast } from '@/components/Dialogs';
import { CheckInput, DateInput, FieldError, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { CROSS_STAGES, DELIVERY_STATUSES, ESCALATION_DAYS, EXPIRY_NOTICE_DAYS, TODAY, categoryOptions, groupOptions, masterValues, assetById, availability, custName, docTotals, type CrossHire, type Replacement, type ReplacementOutcome, type SalesOrder, REPLACEMENT_OUTCOMES, tripTotal } from '@/modules/crm/data';
import { deliveredQty, getOrder, outstanding, receiveCrossHire, replaceAsset, returnToSupplier, returnToUs } from '@/modules/crm/flow';
import { R, R8, R9, TO_CONFIRM, aed, useCrossHire, useDeliveries, useExtensions, useFleet, useOrders, usePricing, useReplacements, useReturns, useTrips } from '@/modules/crm/shared';
import { expiryRows, expiryText } from '@/modules/crm/reports';
import { TransportSection, TripsTable, blankTransport, toTransportInput, validateTransport } from './FleetPages';

/* ------------------------------------------------------------------ Replacements */
export function ReplacementList() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const reps = useReplacements();
  const orders = useOrders();
  const dels = useDeliveries();
  const rets = useReturns();
  const [fc, setFc] = useState('');
  const [fd, setFd] = useState('');
  const soFilter = sp.get('so') ?? '';
  // The list holds the text of every column, so the search finds a Sales Order, a customer, an asset, a Delivery Order or a reason.
  const all = reps.rows.map((r) => {
    const o = orders.get(r.soId);
    const d = dels.get(r.deliveryId);
    const l = o?.lines.find((x) => x.id === r.lineId);
    return { id: r.id, number: r.number, soId: r.soId, soNumber: o?.number ?? '-', customer: o ? custName(o.customerId) : '-', group: r.group ?? l?.group ?? '-', category: r.category ?? l?.category ?? '-', out: assetById(r.oldAssetId)?.assetId ?? '-', in: assetById(r.newAssetId)?.assetId ?? '-',
      reason: r.reason, doId: r.deliveryId, doNumber: d?.number ?? '-', doStatus: d?.status ?? '-', adj: r.priceAdjust, date: r.date, retId: r.returnId, retNumber: rets.get(r.returnId)?.number ?? '-', retStatus: rets.get(r.returnId)?.status ?? '-' };
  });
  const rows = all.filter((r) => (!soFilter || r.soId === soFilter) && (!fc || r.customer === fc) && (!fd || r.doStatus === fd));
  const link = (text: string, to?: string) => (to && text !== '-' ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); nav(to); }}>{text}</Box> : text);
  const pick = (value: string, set: (v: string) => void, all: string, opts: string[]) => (
    <Select size="small" displayEmpty value={value} onChange={(e) => set(String(e.target.value))} sx={{ minWidth: 170, bgcolor: neutral[200], borderRadius: '0.5rem', '& fieldset': { border: 'none' }, fontSize: 13 }}>
      <MenuItem value="">{all}</MenuItem>{opts.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </Select>
  );
  return (
    <Page>
      <PageTitle title="Replacement Orders" subtitle="Started from the Sales Order: line menu Replace asset, or Create, Replacement" change="changed" req={R.repl} />
      {soFilter && <Alert severity="info" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={() => setSp({})}>Show all</Button>}>Showing the replacements of {orders.get(soFilter)?.number ?? 'this Sales Order'}.</Alert>}
      <DataTable rows={rows} searchPlaceholder="Search replacements, orders, assets, customers..." filter={{ key: 'reason', options: masterValues('replacementReason'), label: 'Reason' }} onRowClick={(r) => nav(`/crm/replacements/${r.id}`)}
        toolbarRight={<>{pick(fc, setFc, 'All customers', [...new Set(all.map((r) => r.customer))].sort())}{pick(fd, setFd, 'All delivery statuses', DELIVERY_STATUSES)}</>}
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/replacements/${r.id}`) }, { label: 'View Sales Order', onClick: (r) => nav(`/crm/sales-orders/${r.soId}`) }, { label: 'View Delivery Order', hidden: (r) => !r.doId, onClick: (r) => nav(`/crm/delivery-orders/${r.doId}`) }, { label: 'View Collection', hidden: (r) => !r.retId, onClick: (r) => nav(`/crm/customer-returns/${r.retId}`) }]}
        columns={[
          { key: 'number', label: 'Replacement' }, { key: 'soNumber', label: 'Sales Order', change: 'changed', req: R8('Replacement Orders list: working search, filters, links to the Sales Order and Delivery Order, view page'), render: (r) => link(r.soNumber, `/crm/sales-orders/${r.soId}`) }, { key: 'customer', label: 'Customer' },
          { key: 'group', label: 'Category' }, { key: 'category', label: 'Subcategory' },
          { key: 'out', label: 'Asset Out', change: 'new', req: R.repl }, { key: 'in', label: 'Asset In', change: 'new', req: R.repl },
          { key: 'reason', label: 'Reason', change: 'new', req: R.repl },
          { key: 'doNumber', label: 'Delivery Order', change: 'new', req: R8('Replacement gets its own Delivery Order'), render: (r) => link(r.doNumber, r.doId ? `/crm/delivery-orders/${r.doId}` : undefined) },
          { key: 'doStatus', label: 'Delivery Status', render: (r) => (r.doStatus === '-' ? '-' : <StatusChip status={r.doStatus} />) },
          { key: 'retNumber', label: 'Collection', change: 'new', req: R_LEGS, render: (r) => (r.retId ? <Box>{link(r.retNumber, `/crm/customer-returns/${r.retId}`)}<Box><StatusChip status={r.retStatus} /></Box></Box> : 'Before 9 Oct, no collection') },
          { key: 'adj', label: 'Price Adjustment', align: 'right', render: (r) => aed(r.adj) }, { key: 'date', label: 'Date' },
        ]} />
    </Page>
  );
}

const R_LEGS = R9('Replacement is a delivery and a collection: the faulty unit comes back like a return, billing is not stopped');
const R_CTX = R9('Replacement shows the Sales Order details, the asset being replaced and the price list rate');
export function ReplacementForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const orders = useOrders();
  const fleet = useFleet();
  const dels = useDeliveries();
  const pricing = usePricing();
  const rets = useReturns();
  const now = `${TODAY}T${dayjs().format('HH:mm')}`;
  const [f, setF] = useState<Record<string, any>>({ soId: sp.get('so') ?? '', key: '', reason: '', group: '', category: '', newId: '', priceAdjust: '', adjTouched: false, notified: false, dDate: now, dStatus: 'Packed', dRef: '', cMode: 'Same vehicle', cDate: now, outcome: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [errC, setErrC] = useState<Record<string, string>>({});
  const [tp, setTp] = useState(blankTransport);
  const [ctp, setCtp] = useState(blankTransport);
  const set = (k: string) => (v: any) => { setErr((e) => ({ ...e, [k]: '' })); setF((x) => ({ ...x, [k]: v })); };
  const so = orders.get(f.soId);
  const outs = (so?.lines ?? []).flatMap((l) => outstanding(l).filter((a) => a.state === 'On Hire').map((a) => ({ l, a })));
  const keyOf = (o: { l: { id: string }; a: { assetId: string } }) => `${o.l.id}|${o.a.assetId}`;
  const lineOuts = sp.get('line') ? outs.filter((o) => o.l.id === sp.get('line')) : outs;
  const pick = outs.find((o) => keyOf(o) === f.key) ?? (lineOuts.length === 1 ? lineOuts[0] : undefined);
  // 8 Oct call: only the Subcategory can be changed, the Category stays that of the line.
  const grp = pick?.l.group ?? '';
  const cat = f.category || pick?.l.category || '';
  const av = pick ? availability(grp, cat, fleet.rows) : { owned: [], cross: [] };
  const choices = [...av.owned, ...av.cross];
  const differs = !!pick && (grp !== pick.l.group || cat !== pick.l.category);
  // 9 Oct call: show the price list rate of the chosen Subcategory next to the rate on the line.
  const priced = pricing.rows.filter((p) => p.activity === 'Rental' && p.category === grp && p.subCategory === cat);
  const price = priced.find((p) => p.frequency === pick?.l.frequency) ?? priced[0];
  const lineRate = pick?.l.price ?? 0;
  const diff = price && pick ? price.price - lineRate : 0;
  const adj = f.adjTouched ? f.priceAdjust : differs && price ? String(diff) : f.priceAdjust;
  const outcome = f.outcome || (f.reason === 'Breakdown' ? 'Under Maintenance - Critical' : 'Under Maintenance - Routine');
  const save = () => {
    const e: Record<string, string> = {};
    if (!so) e.soId = 'Select a Rental Order';
    if (!pick) e.key = 'Select the asset to replace';
    if (!f.reason) e.reason = 'Replacement Reason is required';
    if (!f.newId) e.newId = 'Select the replacement asset';
    if (!f.dDate) e.dDate = 'Delivery Date & Time is required';
    Object.assign(e, validateTransport(tp, f.dDate));
    const ec: Record<string, string> = f.cMode === 'Separate trip' ? validateTransport(ctp, f.cDate) : {};
    if (f.cMode === 'Separate trip' && !f.cDate) e.cDate = 'Collection Date & Time is required';
    // One trip per vehicle per day: a separate own-fleet collection on the same day needs another vehicle.
    if (f.cMode === 'Separate trip' && ctp.transport === 'Own Fleet' && tp.transport === 'Own Fleet' && ctp.vehicleId && ctp.vehicleId === tp.vehicleId && f.cDate.slice(0, 10) === f.dDate.slice(0, 10)) ec.vehicleId = 'This vehicle already does the delivery that day. Choose Same vehicle as the delivery, or another vehicle';
    setErr(e); setErrC(ec);
    if (Object.keys(e).length || Object.keys(ec).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    try {
      const x = replaceAsset({ soId: so!.id, lineId: pick!.l.id, oldId: pick!.a.assetId, newId: f.newId, reason: f.reason, priceAdjust: Number(adj) || 0, notified: f.notified, transport: toTransportInput(tp), group: grp, category: cat,
        delivery: { date: f.dDate, status: f.dStatus, reference: f.dRef || undefined }, priceListRate: price?.price,
        collection: { mode: f.cMode, date: f.cMode === 'Separate trip' ? f.cDate : undefined, transport: f.cMode === 'Separate trip' ? toTransportInput(ctp) : undefined, outcome: outcome as ReplacementOutcome } });
      toast(`${x.number}: Delivery Order ${dels.get(x.deliveryId)?.number ?? ''} for the new unit and collection ${rets.get(x.returnId)?.number ?? ''} for the old one. Billing is not paused`);
      nav(`/crm/replacements/${x.id}`);
    } catch (ex) { toast((ex as Error).message, 'error'); }
  };
  if (!sp.get('so')) {
    return (
      <>
        <FormHeader crumbs={[{ label: 'Replacement Orders', to: '/crm/replacements' }, { label: 'Add Replacement' }]} />
        <Page sx={{ pt: 2 }}>
          <Alert severity="info" action={<Button size="small" color="inherit" onClick={() => nav('/crm/sales-orders')}>Open Sales Orders</Button>}>Replacements are started from the Sales Order: open the order, then use Replace asset on the line, or Replacement in the Create menu.</Alert>
        </Page>
      </>
    );
  }
  return (
    <>
      <FormHeader crumbs={[{ label: 'Replacement Orders', to: '/crm/replacements' }, { label: 'Add Replacement' }]} actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="contained" onClick={save}>Save Replacement</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>A replacement is a delivery and a collection. The new unit goes out on its own Delivery Order; the faulty unit comes back on a collection, like a customer return, and is inspected at the yard. Billing is not stopped: the line keeps billing through the new unit.</Alert>
        <FormSection title="Sales Order" change="new" req={R_CTX}>
          <ValueGrid cols={4}>
            <ValueField label="Sales Order" value={so ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/crm/sales-orders/${so.id}`)}>{so.number}</Box> : '-'} />
            <ValueField label="Customer" value={so ? custName(so.customerId) : '-'} /><ValueField label="Project / Cost Centre" value={so?.costCentre || '-'} /><ValueField label="Activity Type" value={so?.activity} />
            <ValueField label="Site" value={so?.site || '-'} /><ValueField label="LPO" value={so?.lpo || '-'} /><ValueField label="Contract End" value={so?.contractEnd ?? '-'} /><ValueField label="Salesperson" value={so?.owner} />
          </ValueGrid>
        </FormSection>
        <FormSection title="Asset to replace" change="changed" req={R_CTX} hint="Only the units on hire on this order">
          <FieldError label="Asset to replace" error={err.key} />
          <DataTable hideToolbar rows={outs.map((o) => ({ id: keyOf(o), o, h: assetById(o.a.assetId) }))} emptyText="No unit of this order is on hire" onRowClick={(r) => setF((x) => ({ ...x, key: r.id, category: '', newId: '', adjTouched: false }))}
            rowSx={(r) => (pick && r.id === keyOf(pick) ? { bgcolor: '#EEF4FF' } : undefined)}
            columns={[
              { key: 'sel', label: '', render: (r) => <Radio size="small" checked={!!pick && r.id === keyOf(pick)} /> },
              { key: 'asset', label: 'Asset ID', render: (r) => r.h?.assetId ?? '-' }, { key: 'name', label: 'Asset Name', render: (r) => r.h?.name ?? '-' },
              { key: 'g', label: 'Category', render: (r) => r.o.l.group ?? '-' }, { key: 's', label: 'Subcategory', render: (r) => r.h?.subCategory ?? r.o.l.category ?? '-' },
              { key: 'do', label: 'Delivery Order', render: (r) => dels.get(r.o.a.deliveryId)?.number ?? '-' }, { key: 'since', label: 'On hire since', render: (r) => r.o.a.start },
              { key: 'rate', label: 'Current Rate', align: 'right', render: (r) => `${aed(r.o.l.price)} / ${(r.o.l.frequency ?? 'period').toLowerCase()}` },
            ]} />
          <Box sx={{ mt: 2 }}><FormGrid>
            <SelectInput label="Replacement Reason" required change="new" req={R.repl} value={f.reason} options={masterValues('replacementReason')} onChange={set('reason')} error={err.reason} hint="Admin-extendable list" />
          </FormGrid></Box>
        </FormSection>
        {pick && (
          <FormSection title="Replacement unit" change="changed" req={R8('Replacement: choose Category and Subcategory')}>
            <FormGrid>
              <SelectInput label="Category" required disabled change="changed" req={R8('Replacement: choose the Subcategory')} value={grp} options={groupOptions()} hint="Locked to the Category of the Sales Order line" />
              <SelectInput label="Subcategory" required change="changed" req={R8('Replacement: choose Category and Subcategory')} value={cat} options={grp ? categoryOptions(grp) : []} onChange={(v) => setF((x) => ({ ...x, category: v, newId: '', adjTouched: false }))} hint={`The line asks for ${pick.l.group} ${pick.l.category}`} />
              {choices.length > 0 && <SelectInput label="Replacement Asset (Ready for Hire)" required value={f.newId} options={choices.map((a) => ({ value: a.id, label: `${a.assetId} - ${a.name}${a.ownership === 'Cross-Hired' ? ' (Cross-Hired)' : ''}` }))} onChange={set('newId')} error={err.newId} hint={`${av.owned.length} owned and ${av.cross.length} cross-hired unit(s) available`} />}
              <TextInput label="Price list rate" disabled change="new" req={R_CTX} value={price ? `${aed(price.price)} / ${(price.frequency ?? 'period').toLowerCase()}` : 'No pricing line'} hint={`Inventory, Heavy Equipment Pricing for ${grp} ${cat}`} />
              <TextInput label="Current line rate" disabled change="new" req={R_CTX} value={`${aed(lineRate)} / ${(pick.l.frequency ?? 'period').toLowerCase()}`} />
              <NumberInput label="Price Adjustment (optional, AED)" change="changed" req={R_CTX} value={adj} onChange={(v) => setF((x) => ({ ...x, priceAdjust: v, adjTouched: true }))} hint={differs && price ? 'Prefilled with the price list difference because the Subcategory differs. Editable' : 'A replacement is rarely price-neutral by assumption, the option must exist'} />
            </FormGrid>
            {differs && <Alert severity="warning" sx={{ mt: 2 }}>Replacing with {grp} {cat} against a line for {pick.l.group} {pick.l.category}. This is logged as an allocation change; client documents keep the requested spec.</Alert>}
            {choices.length === 0 && <Alert severity="warning" sx={{ mt: 2 }} action={<Button size="small" color="inherit" onClick={() => nav(`/rental/cross-hire/add?so=${so?.id}&lines=${pick?.l.id}`)}>Raise Cross-Hire</Button>}>No owned {grp} {cat} unit is Ready for Hire. Source the replacement through Cross-Hire.</Alert>}
            <FieldError label="Replacement Asset" error={choices.length === 0 ? err.newId : undefined} />
          </FormSection>
        )}
        {pick && (
          <FormSection title="Delivery of the replacement unit" change="changed" req={R_LEGS} hint="A Delivery Order is created for the replacement unit">
            <FormGrid>
              <DateInput label="Delivery Date & Time" required value={f.dDate} onChange={set('dDate')} error={err.dDate} />
              <TextInput label="Delivery Status" disabled value="Packed" hint="Always Packed when created. The trip then dispatches and delivers it" />
              <TextInput label="Reference Number" value={f.dRef} onChange={set('dRef')} />
            </FormGrid>
            <Box sx={{ mt: 2 }}><Text type="s3" weight="medium" sx={{ mb: 1 }}>Delivery Transport</Text><TransportSection value={tp} onChange={setTp} errors={err} date={f.dDate} /></Box>
          </FormSection>
        )}
        {pick && (
          <FormSection title="Collection of the faulty unit" change="new" req={R_LEGS} hint="The faulty unit follows the return flow: Off Hire - In Transit, Goods Receipt at the yard, yard inspection, then the status chosen here. Billing is not stopped">
            <FormGrid>
              <SelectInput label="Collection by" required change="new" req={R_LEGS} value={f.cMode} options={['Same vehicle as the delivery', 'Separate trip'].map((v) => ({ value: v === 'Separate trip' ? v : 'Same vehicle', label: v }))} onChange={set('cMode')} hint="Same vehicle: it brings the faulty unit back on the way. Separate: another vehicle or an external transporter, at any time" />
              {f.cMode === 'Separate trip' && <DateInput label="Collection Date & Time" required value={f.cDate} onChange={set('cDate')} error={err.cDate} />}
              <SelectInput label="Resulting status of the faulty asset" required change="changed" req={R9('Faulty asset after replacement: maintenance or straight back to stock')} value={outcome} options={[...REPLACEMENT_OUTCOMES]} onChange={set('outcome')} hint="Applied when the unit is validated at the yard. Ready for Hire when nothing is wrong (for example only noise). Damage found at the inspection always sends it to Critical maintenance" />
              <CheckInput label="Customer notified of the replacement" change="new" req={R.repl} checked={f.notified} onChange={set('notified')} />
            </FormGrid>
            {f.cMode === 'Separate trip' && <Box sx={{ mt: 2 }}><Text type="s3" weight="medium" sx={{ mb: 1 }}>Collection Transport</Text><TransportSection value={ctp} onChange={setCtp} errors={errC} date={f.cDate} hint="An external transporter's charge goes to the trip expenses and the order's logistics cost" /></Box>}
            {f.cMode === 'Same vehicle' && <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>One Replacement trip is created for the Delivery Order and the collection together.</Text>}
          </FormSection>
        )}
      </Page>
    </>
  );
}

/** Replacement Order view (client feedback 9 Oct): what went out, what came in, its Delivery Order and trips, with a way back to the Sales Order. */
export function ReplacementView() {
  const { id } = useParams();
  const nav = useNavigate();
  const reps = useReplacements();
  const orders = useOrders();
  const dels = useDeliveries();
  const trips = useTrips();
  const ch = useCrossHire();
  const rets = useReturns();
  const r = reps.get(id);
  if (!r) return <Page><PageTitle title="Replacement Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/replacements')}>Back</Button>} /></Page>;
  const so = orders.get(r.soId);
  const line = so?.lines.find((l) => l.id === r.lineId);
  const d = dels.get(r.deliveryId);
  const out = assetById(r.oldAssetId);
  const inn = assetById(r.newAssetId);
  const myTrips = trips.rows.filter((t) => d && t.docId === d.id);
  const ret = rets.get(r.returnId);
  const collTrips = trips.rows.filter((t) => ret && (t.docId === ret.id || t.alsoDoc?.id === ret.id));
  const legCost = [...new Map([...myTrips, ...collTrips].map((t) => [t.id, t])).values()].reduce((n, t) => n + tripTotal(t), 0);
  const link = (text: string, to: string) => <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(to)}>{text}</Box>;
  const R_VIEW = R8('Replacement Orders list: working search, filters, links to the Sales Order and Delivery Order, view page');
  const assetRow = (kind: string, a: ReturnType<typeof assetById>) => ({ id: kind, kind, asset: a ? link(a.assetId, `/inventory/items/heavy/${a.id}`) : '-', name: a?.name ?? '-', sub: a ? `${a.category} ${a.subCategory}` : '-', own: a?.ownership ?? '-', status: a?.assetStatus ?? '-' });
  return (
    <>
      <FormHeader crumbs={[{ label: 'Replacement Orders', to: '/crm/replacements' }, { label: r.number }]} status={d ? <StatusChip status={d.status} /> : undefined}
        actions={<><Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${r.soId}`)}>View Sales Order</Button>{d && <Button variant="outlined" onClick={() => nav(`/crm/delivery-orders/${d.id}`)}>View Delivery Order</Button>}</>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid>
          <ValueField label="Replacement" change="new" req={R_VIEW} value={r.number} /><ValueField label="Date" value={r.date} /><ValueField label="Sales Order" change="new" req={R_VIEW} value={so ? link(so.number, `/crm/sales-orders/${so.id}`) : '-'} /><ValueField label="Customer" value={so ? custName(so.customerId) : '-'} />
          <ValueField label="Project" value={so?.costCentre} /><ValueField label="Order Line" value={line?.item} /><ValueField label="Category" value={r.group ?? line?.group} /><ValueField label="Subcategory (asked)" value={line?.category} />
          <ValueField label="Subcategory (replacement)" value={r.category ?? line?.category} /><ValueField label="Reason" value={r.reason} /><ValueField label="Price Adjustment" value={aed(r.priceAdjust)} /><ValueField label="Customer notified" value={r.notified ? 'Yes' : 'No'} />
          <ValueField label="Delivery Order" change="new" req={R8('Replacement gets its own Delivery Order')} value={d ? link(d.number, `/crm/delivery-orders/${d.id}`) : 'Delivered under the order line'} /><ValueField label="Raised by" value={r.by} /><ValueField label="Cross-Hire" value={r.crossHireId ? ch.get(r.crossHireId)?.number : 'Not needed'} />
        </ValueGrid>
        <Panel title="Assets" sx={{ mt: 3 }}>
          <DataTable hideToolbar rows={[assetRow(ret ? 'Out (collected)' : 'Out (to maintenance)', out), assetRow('In (on hire)', inn)]} columns={[{ key: 'kind', label: 'Direction' }, { key: 'asset', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'sub', label: 'Category and Subcategory' }, { key: 'own', label: 'Ownership' }, { key: 'status', label: 'Asset Status now', render: (x) => <StatusChip status={x.status} /> }]} />
        </Panel>
        {d && (
          <Panel title="Delivery Order and trip" sx={{ mt: 2 }}>
            <ValueGrid><ValueField label="Delivery Order" value={link(d.number, `/crm/delivery-orders/${d.id}`)} /><ValueField label="Date" value={d.date.replace('T', ' ')} /><ValueField label="Status" value={<StatusChip status={d.status} />} /><ValueField label="Transport" value={d.transport} /></ValueGrid>
            <Box sx={{ mt: 2 }}><TripsTable rows={myTrips} empty="No trip arranged for this Delivery Order" /></Box>
          </Panel>
        )}
        <Panel title="Collection of the faulty unit" change="new" req={R_LEGS} sx={{ mt: 2 }}>
          {ret ? <>
            <ValueGrid>
              <ValueField label="Collection" value={link(ret.number, `/crm/customer-returns/${ret.id}`)} /><ValueField label="Status" value={<StatusChip status={ret.status} />} /><ValueField label="Collection by" value={r.collectionMode === 'Separate trip' ? 'Separate trip' : 'Same vehicle as the delivery'} />
              <ValueField label="Collected" value={ret.collected ?? 'Not yet'} /><ValueField label="Resulting status chosen" value={r.outcome ?? '-'} /><ValueField label="Asset Status now" value={out ? <StatusChip status={out.assetStatus} /> : '-'} />
              <ValueField label="Billing" value="Not stopped, the line bills through the new unit" /><ValueField label="Price list rate" value={r.priceListRate !== undefined ? aed(r.priceListRate) : '-'} />
            </ValueGrid>
            {r.collectionMode === 'Separate trip' && <Box sx={{ mt: 2 }}><TripsTable rows={collTrips.filter((t) => t.docId === ret.id)} empty="No trip arranged for the collection" /></Box>}
            <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Logistics cost of this replacement (both legs): {aed(legCost)}</Text>
            <Text type="s5" color="theme.secondary.700">Trip expenses, including an external transporter's charge, are on the trips and roll into the order's Logistics Cost.</Text>
          </> : <Text type="s4" color="theme.secondary.700">This replacement was recorded before the collection leg existed (9 Oct): the old unit went straight to maintenance.</Text>}
        </Panel>
        <Panel title="Activity" sx={{ mt: 2 }}><Timeline items={(so?.log ?? []).filter((l) => l.title.includes(r.number) || (l.detail ?? '').includes(r.number))} /></Panel>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Renewals and Expiry */
/** 9 Oct call: the follow-up call is operational, not financial. Rental keeps billing until the material is returned, so there is no fault attribution or billing treatment here. */
const WINDOWS = [{ value: '7', label: 'Next 7 days' }, { value: '14', label: 'Next 14 days' }, { value: '30', label: 'Next 30 days' }, { value: 'overdue', label: 'Overdue only' }, { value: 'all', label: 'All live contracts' }];
const R_REN = R9('Renewals: follow-up only, one week by default, Extend and Return open their page');
export function RenewalsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const exts = useExtensions();
  const [notified, setNotified] = useState<string[]>([]);
  const [win, setWin] = useState(String(EXPIRY_NOTICE_DAYS));
  const all = expiryRows({ orders: orders.rows });
  const rows = all.filter((r) => (win === 'all' ? true : win === 'overdue' ? r.left < 0 : r.left <= Number(win)));
  return (
    <Page>
      <PageTitle title="Renewals and Expiry" subtitle={`Contracts ending in the selected window and overdue on-hire assets, for the follow-up call. Rental keeps billing until the material is returned. Escalation to a manager after ${ESCALATION_DAYS} overdue days.`} change="changed" req={R_REN} />
      <TabPanels tabs={[
        { label: 'Contracts', content: (
          <DataTable hideToolbar={false} searchPlaceholder="Search orders, customers, assets..." rows={rows.map((r) => ({ ...r, soNumber: r.so.number, customer: custName(r.so.customerId) }))} pageSize={15} filter={{ key: 'state', options: ['Overdue', 'Expiring', 'Active'] }} onRowClick={(r) => nav(`/crm/sales-orders/${r.so.id}`)}
            emptyText="No contract ends in this window"
            toolbarRight={<Select size="small" value={win} onChange={(e) => setWin(String(e.target.value))} sx={{ minWidth: 170, bgcolor: neutral[200], borderRadius: '0.5rem', '& fieldset': { border: 'none' }, fontSize: 13 }}>{WINDOWS.map((w) => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}</Select>}
            rowSx={(r) => (r.state === 'Overdue' ? { bgcolor: '#FFF5F5' } : undefined)}
            columns={[
              { key: 'soNumber', label: 'Sales Order' }, { key: 'customer', label: 'Customer' }, { key: 'item', label: 'Line', render: (r) => r.line.item },
              { key: 'assets', label: 'Assets', render: (r) => outstanding(r.line).map((a) => assetById(a.assetId)?.assetId).join(', ') }, { key: 'end', label: 'Contract End', render: (r) => r.line.contractEnd },
              { key: 'left', label: 'Expiry', render: (r) => expiryText(r.left) },
              { key: 'state', label: 'State', change: 'changed', req: R_REN, render: (r) => <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><StatusChip status={r.state === 'Overdue' && -r.left > ESCALATION_DAYS ? 'Overdue, escalated' : r.state} />{r.state === 'Overdue' && <StatusChip status="Still billing" tone="grey" />}</Box> },
              { key: 'act', label: 'Action', change: 'changed', req: R_REN, render: (r) => (
                <Box onClick={(e) => e.stopPropagation()}><MenuButton label="Actions" variant="outlined" items={[
                  { label: notified.includes(r.so.id) ? 'Notified' : 'Notify', disabled: r.state === 'Active' || notified.includes(r.so.id), onClick: () => { setNotified([...notified, r.so.id]); toast(`Notification sent to the Service Desk, Sales and ${custName(r.so.customerId)}`); } },
                  { label: 'Extend', onClick: () => nav(`/crm/sales-orders/${r.so.id}/extend`) },
                  { label: 'Return', onClick: () => nav(`/crm/customer-returns/add?so=${r.so.id}`) },
                ]} /></Box>) },
            ]} />
        ) },
        { label: 'Extensions', content: (
          <DataTable hideToolbar rows={exts.rows} emptyText="No extension yet" onRowClick={(r) => nav(`/crm/sales-orders/${r.soId}`)} columns={[
            { key: 'number', label: 'Request' }, { key: 'so', label: 'Sales Order', render: (r) => getOrder(r.soId)?.number }, { key: 'kind', label: 'Type', render: (r) => <StatusChip status={r.kind} tone="grey" /> },
            { key: 'rev', label: 'Update', change: 'changed', req: R9('Extension saved as an update of the Sales Order'), render: (r) => (r.revision ? `Update ${r.revision}` : '-') }, { key: 'old', label: 'Old end', render: (r) => r.oldEnd }, { key: 'new', label: 'New end', render: (r) => r.newEnd }, { key: 'chg', label: 'Changes', render: (r) => r.changes || '-' }, { key: 'by', label: 'Confirmed by client', render: (r) => r.clientConfirmedBy }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          ]} />
        ) },
      ]} />
    </Page>
  );
}
