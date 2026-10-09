import { useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Select } from '@mui/material';
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
import { CROSS_STAGES, DELIVERY_STATUSES, ESCALATION_DAYS, EXPIRY_NOTICE_DAYS, FAULT_ATTRIBUTION, TODAY, categoryOptions, groupOptions, masterValues, assetById, availability, custName, docTotals, type CrossHire, type Replacement, type SalesOrder } from '@/modules/crm/data';
import { deliveredQty, getOrder, outstanding, receiveCrossHire, replaceAsset, returnToSupplier, returnToUs } from '@/modules/crm/flow';
import { R, R8, TO_CONFIRM, aed, useCrossHire, useDeliveries, useExtensions, useFleet, useOrders, useReplacements, useTrips } from '@/modules/crm/shared';
import { ExpiryDialog } from '@/modules/crm/ActionDialogs';
import { expiryRows, expiryText } from '@/modules/crm/reports';
import { TransportSection, TripsTable, blankTransport, toTransportInput, validateTransport } from './FleetPages';

/* ------------------------------------------------------------------ Replacements */
export function ReplacementList() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const reps = useReplacements();
  const orders = useOrders();
  const dels = useDeliveries();
  const [fc, setFc] = useState('');
  const [fd, setFd] = useState('');
  const soFilter = sp.get('so') ?? '';
  // The list holds the text of every column, so the search finds a Sales Order, a customer, an asset, a Delivery Order or a reason.
  const all = reps.rows.map((r) => {
    const o = orders.get(r.soId);
    const d = dels.get(r.deliveryId);
    const l = o?.lines.find((x) => x.id === r.lineId);
    return { id: r.id, number: r.number, soId: r.soId, soNumber: o?.number ?? '-', customer: o ? custName(o.customerId) : '-', group: r.group ?? l?.group ?? '-', category: r.category ?? l?.category ?? '-', out: assetById(r.oldAssetId)?.assetId ?? '-', in: assetById(r.newAssetId)?.assetId ?? '-',
      reason: r.reason, doId: r.deliveryId, doNumber: d?.number ?? '-', doStatus: d?.status ?? '-', adj: r.priceAdjust, date: r.date };
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
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/replacements/${r.id}`) }, { label: 'View Sales Order', onClick: (r) => nav(`/crm/sales-orders/${r.soId}`) }, { label: 'View Delivery Order', hidden: (r) => !r.doId, onClick: (r) => nav(`/crm/delivery-orders/${r.doId}`) }]}
        columns={[
          { key: 'number', label: 'Replacement' }, { key: 'soNumber', label: 'Sales Order', change: 'changed', req: R8('Replacement Orders list: working search, filters, links to the Sales Order and Delivery Order, view page'), render: (r) => link(r.soNumber, `/crm/sales-orders/${r.soId}`) }, { key: 'customer', label: 'Customer' },
          { key: 'group', label: 'Category' }, { key: 'category', label: 'Subcategory' },
          { key: 'out', label: 'Asset Out', change: 'new', req: R.repl }, { key: 'in', label: 'Asset In', change: 'new', req: R.repl },
          { key: 'reason', label: 'Reason', change: 'new', req: R.repl },
          { key: 'doNumber', label: 'Delivery Order', change: 'new', req: R8('Replacement gets its own Delivery Order'), render: (r) => link(r.doNumber, r.doId ? `/crm/delivery-orders/${r.doId}` : undefined) },
          { key: 'doStatus', label: 'Delivery Status', render: (r) => (r.doStatus === '-' ? '-' : <StatusChip status={r.doStatus} />) },
          { key: 'adj', label: 'Price Adjustment', align: 'right', render: (r) => aed(r.adj) }, { key: 'date', label: 'Date' },
        ]} />
    </Page>
  );
}

export function ReplacementForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const orders = useOrders();
  const fleet = useFleet();
  const dels = useDeliveries();
  const [f, setF] = useState<Record<string, any>>({ soId: sp.get('so') ?? '', key: '', reason: '', group: '', category: '', newId: '', priceAdjust: '', notified: false, dDate: `${TODAY}T${dayjs().format('HH:mm')}`, dStatus: 'Packed', dRef: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [tp, setTp] = useState(blankTransport);
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const so = orders.get(f.soId);
  const outs = (so?.lines ?? []).flatMap((l) => outstanding(l).filter((a) => a.state === 'On Hire').map((a) => ({ l, a })));
  const pick = outs.find((o) => `${o.l.id}|${o.a.assetId}` === f.key) ?? (outs.length === 1 && sp.get('line') ? outs[0] : undefined);
  // 8 Oct call: Category and Subcategory can be chosen (200 KVA not available, 250 KVA is); they start as those of the line.
  // 8 Oct call: only the Subcategory can be changed, the Category stays that of the line.
  const grp = pick?.l.group ?? '';
  const cat = f.category || pick?.l.category || '';
  const av = pick ? availability(grp, cat, fleet.rows) : { owned: [], cross: [] };
  const choices = [...av.owned, ...av.cross];
  const differs = !!pick && (grp !== pick.l.group || cat !== pick.l.category);
  const save = () => {
    const e: Record<string, string> = {};
    if (!so) e.soId = 'Select a Rental Order';
    if (!pick) e.key = 'Select the asset to replace';
    if (!f.reason) e.reason = 'Replacement Reason is required';
    if (!f.newId) e.newId = 'Select the replacement asset';
    if (!f.dDate) e.dDate = 'Delivery Date & Time is required';
    Object.assign(e, validateTransport(tp));
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const r = replaceAsset({ soId: so!.id, lineId: pick!.l.id, oldId: pick!.a.assetId, newId: f.newId, reason: f.reason, priceAdjust: Number(f.priceAdjust) || 0, notified: f.notified, transport: toTransportInput(tp), group: grp, category: cat, delivery: { date: f.dDate, status: f.dStatus, reference: f.dRef || undefined } });
    toast(`${r.number}: asset swapped, Delivery Order ${dels.get(r.deliveryId)?.number ?? ''} created. Old asset moved to Under Maintenance, billing cycle not paused`);
    nav('/crm/replacements');
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
        <Alert severity="info" sx={{ mb: 2 }}>Replacement is started from the Sales Order, never from the Delivery Order. Only assets currently outstanding are shown. The old asset and the new asset are recorded against the same project in one transaction.</Alert>
        <FormGrid>
          <SelectInput label="Rental Order" required change="new" req={R.repl} disabled value={f.soId} options={orders.rows.filter((o) => o.lines.some((l) => outstanding(l).length)).map((o) => ({ value: o.id, label: `${o.number} - ${custName(o.customerId)}` }))} onChange={(v) => setF((x) => ({ ...x, soId: v, key: '', newId: '' }))} error={err.soId} />
          <SelectInput label="Asset to replace (outstanding only)" required change="new" req={R.repl} value={pick ? `${pick.l.id}|${pick.a.assetId}` : ''} options={outs.map((o) => ({ value: `${o.l.id}|${o.a.assetId}`, label: `${assetById(o.a.assetId)?.assetId} - ${assetById(o.a.assetId)?.name}` }))} onChange={(v) => setF((x) => ({ ...x, key: v, category: '', newId: '' }))} error={err.key} />
          <SelectInput label="Replacement Reason" required change="new" req={R.repl} value={f.reason} options={masterValues('replacementReason')} onChange={set('reason')} error={err.reason} hint="Admin-extendable list" />
        </FormGrid>
        {pick && (
          <FormSection title="Replacement unit" change="changed" req={R8('Replacement: choose Category and Subcategory')}>
            <FormGrid>
              <SelectInput label="Category" required disabled change="changed" req={R8('Replacement: choose the Subcategory')} value={grp} options={groupOptions()} hint="Locked to the Category of the Sales Order line" />
              <SelectInput label="Subcategory" required change="changed" req={R8('Replacement: choose Category and Subcategory')} value={cat} options={grp ? categoryOptions(grp) : []} onChange={(v) => setF((x) => ({ ...x, category: v, newId: '' }))} hint={`The line asks for ${pick.l.group} ${pick.l.category}`} />
            </FormGrid>
            {differs && <Alert severity="warning" sx={{ mt: 2 }}>Replacing with {grp} {cat} against a line for {pick.l.group} {pick.l.category}. This is logged as an allocation change; client documents keep the requested spec.</Alert>}
            {choices.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 2 }} action={<Button size="small" color="inherit" onClick={() => nav(`/rental/cross-hire/add?so=${so?.id}&lines=${pick?.l.id}`)}>Raise Cross-Hire</Button>}>No owned {grp} {cat} unit is Ready for Hire. Source the replacement through Cross-Hire.</Alert>
            ) : (
              <SelectInput label="Replacement Asset (Ready for Hire)" required value={f.newId} options={choices.map((a) => ({ value: a.id, label: `${a.assetId} - ${a.name}${a.ownership === 'Cross-Hired' ? ' (Cross-Hired)' : ''}` }))} onChange={set('newId')} error={err.newId} hint={`${av.owned.length} owned and ${av.cross.length} cross-hired unit(s) available`} />
            )}
          </FormSection>
        )}
        {pick && (
          <FormSection title="Delivery Order" change="new" req={R8('Replacement gets its own Delivery Order')} hint="A Delivery Order is created for the replacement unit">
            <FormGrid>
              <DateInput label="Delivery Date & Time" required value={f.dDate} onChange={set('dDate')} error={err.dDate} />
              <TextInput label="Delivery Status" disabled value="Packed" hint="Always Packed when created. The trip then dispatches and delivers it" />
              <TextInput label="Reference Number" value={f.dRef} onChange={set('dRef')} />
            </FormGrid>
          </FormSection>
        )}
        <FormSection title="Commercial and notification">
          <FormGrid>
            <NumberInput label="Price Adjustment (optional, AED)" change="new" req={R.repl} value={f.priceAdjust} onChange={set('priceAdjust')} hint="A replacement is rarely price-neutral by assumption, the option must exist" />
            <CheckInput label="Customer notified of the replacement" change="new" req={R.repl} checked={f.notified} onChange={set('notified')} />
            <TextInput label="Resulting status of the faulty asset" disabled value="Under Maintenance" hint="Always Under Maintenance first. Disposal is a separate manual decision, the system never auto-disposes" />
          </FormGrid>
        </FormSection>
        <FormSection title="Transport" change="new" req={R.fleet} hint="One Replacement trip carries the new unit out and brings the old unit back.">
          <TransportSection value={tp} onChange={setTp} errors={err} />
        </FormSection>
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
  const r = reps.get(id);
  if (!r) return <Page><PageTitle title="Replacement Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/replacements')}>Back</Button>} /></Page>;
  const so = orders.get(r.soId);
  const line = so?.lines.find((l) => l.id === r.lineId);
  const d = dels.get(r.deliveryId);
  const out = assetById(r.oldAssetId);
  const inn = assetById(r.newAssetId);
  const myTrips = trips.rows.filter((t) => d && t.docId === d.id);
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
          <DataTable hideToolbar rows={[assetRow('Out (to maintenance)', out), assetRow('In (on hire)', inn)]} columns={[{ key: 'kind', label: 'Direction' }, { key: 'asset', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'sub', label: 'Category and Subcategory' }, { key: 'own', label: 'Ownership' }, { key: 'status', label: 'Asset Status now', render: (x) => <StatusChip status={x.status} /> }]} />
        </Panel>
        {d && (
          <Panel title="Delivery Order and trip" sx={{ mt: 2 }}>
            <ValueGrid><ValueField label="Delivery Order" value={link(d.number, `/crm/delivery-orders/${d.id}`)} /><ValueField label="Date" value={d.date.replace('T', ' ')} /><ValueField label="Status" value={<StatusChip status={d.status} />} /><ValueField label="Transport" value={d.transport} /></ValueGrid>
            <Box sx={{ mt: 2 }}><TripsTable rows={myTrips} empty="No trip arranged for this Delivery Order" /></Box>
          </Panel>
        )}
        <Panel title="Activity" sx={{ mt: 2 }}><Timeline items={(so?.log ?? []).filter((l) => l.title.includes(r.number) || (l.detail ?? '').includes(r.number))} /></Panel>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Renewals and Expiry */
interface Handling { id: string; fault: string; treatment: string }
export function RenewalsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const exts = useExtensions();
  const handling = useCollection<Handling>('rental.overdueHandling', []);
  const [notified, setNotified] = useState<string[]>([]);
  const [dlg, setDlg] = useState<{ soId: string; lineId: string } | null>(null);
  const [od, setOd] = useState<{ id: string; fault: string; treatment: string } | null>(null);
  const rows = expiryRows({ orders: orders.rows });
  return (
    <Page>
      <PageTitle title="Renewals and Expiry" subtitle={`Contracts nearing their end date (notice ${EXPIRY_NOTICE_DAYS} days) and overdue on-hire assets. Escalation to a manager after ${ESCALATION_DAYS} overdue days. Both settings are admin-configurable.`} change="new" req={R.exp} />
      <TabPanels tabs={[
        { label: 'Contracts', content: (
          <DataTable hideToolbar rows={rows} pageSize={15} filter={{ key: 'state', options: ['Overdue', 'Expiring', 'Active'] }} onRowClick={(r) => nav(`/crm/sales-orders/${r.so.id}`)}
            rowSx={(r) => (r.state === 'Overdue' ? { bgcolor: '#FFF5F5' } : undefined)}
            columns={[
              { key: 'so', label: 'Sales Order', render: (r) => r.so.number }, { key: 'c', label: 'Customer', render: (r) => custName(r.so.customerId) }, { key: 'item', label: 'Line', render: (r) => r.line.item },
              { key: 'assets', label: 'Assets', render: (r) => outstanding(r.line).map((a) => assetById(a.assetId)?.assetId).join(', ') }, { key: 'end', label: 'Contract End', render: (r) => r.line.contractEnd },
              { key: 'left', label: 'Expiry', change: 'changed', req: R8('Expiry shown with its unit: In 8 days, 15 days overdue'), render: (r) => expiryText(r.left) },
              { key: 'state', label: 'State', render: (r) => <StatusChip status={r.state === 'Overdue' && -r.left > ESCALATION_DAYS ? 'Overdue, escalated' : r.state} /> },
              { key: 'fault', label: 'Fault Attribution', render: (r) => (r.state === 'Overdue' ? handling.get(r.line.id)?.fault ?? 'Not set' : '-') },
              { key: 'act', label: 'Action', render: (r) => (
                <Box onClick={(e) => e.stopPropagation()}><MenuButton label="Actions" variant="outlined" items={[
                  { label: notified.includes(r.line.id) ? 'Notified' : 'Notify', disabled: r.state === 'Active' || notified.includes(r.line.id), onClick: () => { setNotified([...notified, r.line.id]); toast(`Notification sent to the Service Desk, Sales and ${custName(r.so.customerId)}`); } },
                  { label: 'Overdue handling (fault attribution)', disabled: r.state !== 'Overdue', onClick: () => setOd({ id: r.line.id, fault: handling.get(r.line.id)?.fault ?? '', treatment: handling.get(r.line.id)?.treatment ?? '' }) },
                  { label: 'Client confirmation: extend or return', onClick: () => setDlg({ soId: r.so.id, lineId: r.line.id }) },
                ]} /></Box>) },
            ]} />
        ) },
        { label: 'Extension requests', content: (
          <DataTable hideToolbar rows={exts.rows} emptyText="No requests yet" columns={[
            { key: 'number', label: 'Request' }, { key: 'so', label: 'Sales Order', render: (r) => getOrder(r.soId)?.number }, { key: 'kind', label: 'Type', render: (r) => <StatusChip status={r.kind} tone="grey" /> },
            { key: 'rev', label: 'Revision', change: 'new', req: R8('Extension as a revision of the Sales Order'), render: (r) => (r.revision ? `Rev ${r.revision}` : '-') }, { key: 'old', label: 'Old end', render: (r) => r.oldEnd }, { key: 'new', label: 'New end', render: (r) => r.newEnd }, { key: 'chg', label: 'Changes', change: 'new', req: R8('Extension as a revision of the Sales Order'), render: (r) => r.changes || '-' }, { key: 'by', label: 'Confirmed by client', render: (r) => r.clientConfirmedBy }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          ]} />
        ) },
      ]} />
      <ExpiryDialog open={!!dlg} onClose={() => setDlg(null)} soId={dlg?.soId} lineId={dlg?.lineId} />
      <AppDialog open={!!od} title="Overdue on-hire handling" onClose={() => setOd(null)} confirmLabel="Save" confirmDisabled={!od?.fault} onConfirm={() => { if (od) { if (handling.get(od.id)) handling.update(od.id, od); else handling.add(od); toast('Overdue handling saved'); setOd(null); } }}>
        <Alert severity="info" sx={{ mb: 2 }}>The internal alert always fires. The commercial response stays flexible and is decided case by case.</Alert>
        <FormGrid cols={1}>
          <SelectInput label="Fault Attribution" required change="new" req={R.exp} value={od?.fault} options={FAULT_ATTRIBUTION} onChange={(v) => od && setOd({ ...od, fault: v })} hint="Company: no charge, for example the business's own logistics could not collect on time" />
          <SelectInput label="Overdue Billing Treatment" change="new" req={R.exp} value={od?.treatment} options={['Same Rate', 'Penalty Rate', 'Hold Billing']} onChange={(v) => od && setOd({ ...od, treatment: v })} />
        </FormGrid>
      </AppDialog>
    </Page>
  );
}
