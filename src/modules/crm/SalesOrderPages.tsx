import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, FormGrid, SelectInput } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { certSeed, type CertRec } from '@/modules/inventory/data';
import { certStatus } from '@/modules/inventory/AssetPages';
import { LPO_NOTICE_DAYS, SO_STATUSES, TODAY, cust, log, assetById, availability, custName, docTotals, periods, type Line, type SalesOrder } from './data';
import { NEXT_STEP, jobCardsOf, closeOrder, confirmOrder, days, deliveredQty, lineState, outstanding, releaseDueHolds, releaseHold } from './flow';
import { ActivityChip, R, aed, useChRequests, useDeliveries, useFleet, useOpps, useOrders, usePricing, useQuotes, useTrips } from './shared';
import { TripsTable } from '@/modules/rental/FleetPages';
import { ItemsTable } from './Items';
import { type RowMenuItem } from './shared';
import { CommercialTabs, Totals, commercialErrors, withHeaderCascade } from './CommercialTabs';
import { Section, SpecForm, SpecView } from './FormKit';
import { CrossHireDialog, EmailDialog, ExpiryDialog, NextStepDialog, PrintDialog } from './ActionDialogs';

const deliveryStatus = (so: SalesOrder) => {
  const rl = so.lines.filter((l) => l.activity === 'Rental' || l.activity === 'Trading' || l.activity === 'Fuel Trading');
  if (!rl.length) return '-';
  const done = rl.filter((l) => (l.activity === 'Rental' ? deliveredQty(l) >= l.qty : !!l.fulfilment)).length;
  return done === 0 ? 'Pending delivery' : done === rl.length ? 'Fully delivered' : 'Partially delivered';
};

export function SalesOrderList() {
  const nav = useNavigate();
  const orders = useOrders();
  const quotes = useQuotes();
  const toast = useToast();
  const [pick, setPick] = useState(false);
  const [qid, setQid] = useState('');
  const approved = quotes.rows.filter((q) => q.status === 'Approved');
  return (
    <Page>
      <PageTitle title="Sales Orders" />
      <DataTable<SalesOrder> rows={orders.rows} searchPlaceholder="Search sales orders..." filter={{ key: 'status', options: SO_STATUSES }} onAdd={() => setPick(true)} addLabel="Add Sales Order" onRowClick={(r) => nav(`/crm/sales-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) },
          { key: 'activity', label: 'Activity Type', change: 'new', req: R.meet, render: (r) => <ActivityChip activity={r.activity} /> },
          { key: 'status', label: 'Sales Order Status', change: 'changed', req: R.so, render: (r) => <StatusChip status={r.status} /> },
          { key: 'delivery', label: 'Delivery Status', render: (r) => (deliveryStatus(r) === '-' ? '-' : <StatusChip status={deliveryStatus(r)} />) },
          { key: 'owner', label: 'Salesperson' }, { key: 'entity', label: 'Entity' },
          { key: 'end', label: 'Contract / LPO End', change: 'new', req: R.meet, render: (r) => r.contractEnd ?? r.amcEnd ?? r.lpoExpiry ?? '-' },
          { key: 'total', label: 'Total Amount', align: 'right', render: (r) => aed(docTotals(r.lines, r.discountPct, r.vatType).total) },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/sales-orders/${r.id}`) }, { label: 'Edit', onClick: (r) => nav(`/crm/sales-orders/${r.id}/edit`) }]} />
      <AppDialog open={pick} title="Create Sales Order from a Quotation" onClose={() => setPick(false)} confirmLabel="Open Quotation" confirmDisabled={!qid}
        onConfirm={() => { setPick(false); nav(`/crm/quotations/${qid}`); toast('Use Create Order on the approved Quotation', 'info'); }}>
        <SelectInput label="Approved Quotation" required value={qid} options={approved.map((q) => ({ value: q.id, label: `${q.number} - ${custName(q.customerId)}` }))} onChange={setQid} hint="A Sales Order is always generated from an approved Quotation, once the LPO is received" />
      </AppDialog>
    </Page>
  );
}

const soForm = (so: SalesOrder, oppNo = '', quoteNo = ''): Record<string, any> => ({
  transactionType: 'Credit', postingTime: '09:00', exchangeRate: 1, location: 'Jebel Ali Main Yard', salesperson: so.owner, discountOn: 'Gross Amount', ...so,
  oppNo, quoteNo, contactPerson: so.contactPerson ?? cust(so.customerId)?.contact ?? '', deliveryCommitment: so.deliveryCommitment ?? so.lines.find((l) => l.deliveryDate)?.deliveryDate,
});
const deliverySpecs = [{ key: 'deliveryDate', label: 'Delivery Date', type: 'date' as const }, { key: 'deliveryMethod', label: 'Delivery Method', type: 'select' as const, options: ['Own Fleet', 'External Transporter'], hint: 'Informational here, finalised at the Delivery Order' }, { key: 'site', label: 'Location / Site' }];

/** Existing Sales Order form. Commercial terms of confirmed items are frozen; header details stay editable (number, date, LPO, expiry, site). */
export function SalesOrderForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const opps = useOpps();
  const quotes = useQuotes();
  const fleet = useFleet();
  const pricing = usePricing();
  const so = orders.get(id);
  const [f, setF] = useState<Record<string, any>>(() => (so ? soForm(so, opps.get(so.oppId)?.number, quotes.get(so.quoteId)?.number) : {}));
  const [err, setErr] = useState<Record<string, string>>({});
  if (!so) return <Page><PageTitle title="Sales Order not found" /></Page>;
  const set = (k: string, v: any) => setF((x) => withHeaderCascade(x, k, v));
  const save = () => {
    const e = commercialErrors(f);
    if (!String(f.lpo ?? '').trim()) e.lpo = 'PO Number is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const { oppNo, quoteNo, ...rest } = f;
    void oppNo; void quoteNo;
    orders.update(so.id, { ...rest, discountPct: Number(f.discountPct) || 0, log: [log('Sales Order edited', 'Header changes recorded in the audit trail'), ...so.log] });
    toast('Sales Order updated');
    nav(`/crm/sales-orders/${so.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Sales Orders', to: '/crm/sales-orders' }, { label: `Edit ${so.number}` }]} actions={<><Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${so.id}`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Price, quantity, Activity Type and Contract Type of confirmed items are frozen. Use Extend, Replacement or a formal revision to change them.</Alert>
        <CommercialTabs kind="order" f={f} set={set} err={err}
          belowGeneral={<Section title="Delivery"><SpecForm specs={deliverySpecs} f={f} set={set} /></Section>}
          items={<><ItemsTable lines={so.lines} header={so.activity} vatType={so.vatType} locked fleet={fleet.rows} pricing={pricing.rows} mode="order" /><Totals lines={so.lines} discountPct={Number(f.discountPct) || 0} vatType={so.vatType} currency={so.currency} /></>} />
      </Page>
    </>
  );
}

const FREQ_TEXT = (l: Line) => (l.frequency ? l.frequency.toLowerCase() : 'period');
function Ledger({ so }: { so: SalesOrder }) {
  const rows = so.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned.map((a) => {
    const asset = assetById(a.assetId);
    const hold = a.state === 'Hold';
    const until = a.stop ?? TODAY;
    const billed = hold || l.foc || until < a.start ? 0 : Math.round(periods(l.frequency, a.start, until) * l.price);
    return { id: `${l.id}-${a.assetId}-${a.start}`, asset: `${asset?.assetId} - ${asset?.name}`, delivered: a.start, cycle: hold ? `Starts ${a.start} (Hold)` : `${a.start}, ${FREQ_TEXT(l)}`, state: a.state, invoiced: billed, received: Math.round(billed * 0.8), stop: a.stop ?? '-' };
  }));
  return (
    <Box>
      <DataTable hideToolbar rows={rows} pageSize={20} emptyText="No asset has been delivered yet" columns={[
        { key: 'asset', label: 'Asset' }, { key: 'delivered', label: 'Rental Start' }, { key: 'cycle', label: 'Invoice Cycle' }, { key: 'stop', label: 'Billing Stopped' },
        { key: 'state', label: 'Status', render: (r) => <StatusChip status={r.state === 'Returned' ? 'Off Hire' : r.state} tone={r.state === 'Replaced' ? 'grey' : undefined} /> },
        { key: 'invoiced', label: 'Invoiced to date', align: 'right', render: (r) => aed(r.invoiced) }, { key: 'received', label: 'Received to date', align: 'right', render: (r) => aed(r.received) },
      ]} />
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Live view of what is out on this project. Billing runs per delivery from its own Rental Start Date until its own return, at the line's frequency. Received amounts are sample figures.</Text>
    </Box>
  );
}

/** Quote, SO and DO numbers with requested vs delivered subcategory per asset (22 Sep). */
function Traceability({ so, quoteNo }: { so: SalesOrder; quoteNo?: string }) {
  const dels = useDeliveries();
  const rows = so.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned.map((a) => {
    const d = dels.get(a.deliveryId);
    const h = assetById(a.assetId);
    return { id: `${l.id}${a.assetId}${a.start}`, quote: quoteNo ?? '-', so: so.number, dn: d?.number ?? '-', requested: `${l.group} ${l.category}`, delivered: h ? `${h.category} ${h.subCategory}` : '-', asset: h?.assetId ?? '-', state: a.state, differs: h && h.subCategory !== l.category ? 'Yes' : 'No' };
  }));
  return (
    <DataTable hideToolbar rows={rows} emptyText="Nothing delivered yet" columns={[
      { key: 'quote', label: 'Quotation' }, { key: 'so', label: 'Sales Order' }, { key: 'dn', label: 'Delivery Order' }, { key: 'requested', label: 'Requested' }, { key: 'delivered', label: 'Delivered' },
      { key: 'asset', label: 'Asset ID' }, { key: 'differs', label: 'Differs', render: (r) => <StatusChip status={r.differs} tone={r.differs === 'Yes' ? 'amber' : 'green'} /> }, { key: 'state', label: 'Status' },
    ]} />
  );
}

export function SalesOrderView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const orders = useOrders();
  const quotes = useQuotes();
  const opps = useOpps();
  const fleet = useFleet();
  const pricing = usePricing();
  const dels = useDeliveries();
  const trips = useTrips();
  const chReqAll = useChRequests();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const so = orders.get(id);
  const [dlg, setDlg] = useState<{ kind: 'expiry' | 'cross' | 'step'; lineId?: string; lineIds?: string[] } | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [mail, setMail] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const compliance = useMemo(() => (so ? so.lines.flatMap((l) => outstanding(l).map((a) => assetById(a.assetId)).filter(Boolean).map((h) => ({ h: h!, certs: certs.rows.filter((c) => c.assetId === h!.assetId) }))) : []), [so, certs.rows, fleet.rows]);
  // A Hold ends by itself once its Rental Start Date arrives.
  useEffect(() => { if (id) releaseDueHolds(id); }, [id]);
  if (!so) return <Page><PageTitle title="Sales Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/sales-orders')}>Back</Button>} /></Page>;
  const myDels = dels.rows.filter((d) => d.soId === so.id);
  const soTrips = trips.rows.filter((t) => t.soId === so.id);
  const rentalOut = so.lines.reduce((n, l) => n + outstanding(l).length, 0);
  const lpoLeft = so.lpoExpiry ? -days(so.lpoExpiry) : undefined;
  /** What the line is doing now. Actions are not shown here, they are in the three-dots menu of the row. */
  const lineStatus = (l: Line) => {
    if (l.activity === 'Rental') return <StatusChip status={lineState(l)} />;
    if (l.activity === 'AMC') return <StatusChip status="AMC" tone="grey" />;
    if (l.activity === 'Service' && l.billing === 'Recurring') return <Text type="s5">Billed with each rental cycle</Text>;
    if (l.fulfilment) return <Box><StatusChip status={l.fulfilment} /><Text type="s5" color="theme.secondary.700">{l.fulfilmentRef}</Text></Box>;
    return <StatusChip status="Pending" tone="amber" />;
  };
  const canCrossHire = (l: Line) => {
    if (l.activity !== 'Rental' || l.qty - deliveredQty(l) <= 0) return false;
    const av = availability(l.group, l.category, fleet.rows);
    return av.owned.length === 0 && !chReqAll.rows.some((c) => c.lineId === l.id && (c.status === 'Pending' || c.status === 'In Progress'));
  };
  const lineActions = (l: Line): RowMenuItem[] => {
    if (l.activity === 'Rental') {
      const av = availability(l.group, l.category, fleet.rows);
      const remaining = l.qty - deliveredQty(l);
      const out = outstanding(l);
      return [
        ...(remaining > 0 ? [{ label: 'Deliver', disabled: av.owned.length + av.cross.length === 0, onClick: () => nav(`/crm/delivery-orders/add?so=${so.id}&line=${l.id}`) }] : []),
        ...(remaining > 0 ? [{ label: 'Cross Hire', disabled: !canCrossHire(l), onClick: () => setDlg({ kind: 'cross', lineIds: [l.id] }) }] : []),
        ...(out.some((a) => a.state === 'Hold') ? [{ label: 'Release Hold (site ready early)', onClick: () => out.filter((a) => a.state === 'Hold').forEach((a) => { releaseHold(so.id, l.id, a.assetId); toast('Hold released, invoicing starts today'); }) }] : []),
        ...(out.length > 0 ? [{ label: 'Replace asset', onClick: () => nav(`/rental/replacements/add?so=${so.id}&line=${l.id}`) }, { label: 'Return asset', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}&line=${l.id}`) }] : []),
      ];
    }
    if (l.activity === 'AMC') return [{ label: 'Open AMC Order', onClick: () => nav(`/crm/amc-orders/${so.id}`) }];
    if (l.activity === 'Service' && l.billing === 'Recurring') return [];
    if (l.fulfilment === 'Delivered') return [{ label: 'Invoice', onClick: () => setDlg({ kind: 'step', lineId: l.id }) }];
    if (l.fulfilment) return [];
    return [{ label: (NEXT_STEP[l.activity] ?? NEXT_STEP.Service).label, onClick: () => setDlg({ kind: 'step', lineId: l.id }) }];
  };
  const chosen = so.lines.filter((l) => sel.includes(l.id));
  const bulkCross = () => {
    if (!chosen.length) { toast('Select the equipment lines first', 'error'); return; }
    const bad = chosen.filter((l) => !canCrossHire(l));
    if (bad.length) { toast(`Cross Hire is not available for: ${bad.map((l) => l.item).join(', ')} (only rental lines with nothing Ready for Hire and no open request)`, 'error'); return; }
    setDlg({ kind: 'cross', lineIds: chosen.map((l) => l.id) });
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Sales Orders', to: '/crm/sales-orders' }, { label: so.number }]} status={<StatusChip status={so.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${so.id}/edit`)}>Edit</Button>
          {so.status === 'Pending' && <Button variant="outlined" onClick={() => { confirmOrder(so); toast('Sales Order confirmed'); }}>Confirm</Button>}
          {so.activity === 'Rental' && rentalOut > 0 && <Button variant="outlined" onClick={() => setDlg({ kind: 'expiry' })}>Extend / Terminate</Button>}
          <MenuButton label="Create" variant="outlined" items={[
            { label: 'Delivery', disabled: so.activity === 'AMC', onClick: () => nav(`/crm/delivery-orders/add?so=${so.id}`) },
            { label: 'Advance', onClick: () => { orders.update(so.id, { log: [log('Advance invoice raised', `Against ${so.number}`, 'blue'), ...so.log] }); toast('Advance invoice raised against the order'); } },
            { label: 'Invoice', disabled: !so.lines.some((l) => !['Rental', 'AMC'].includes(l.activity) && (!l.fulfilment || l.fulfilment === 'Delivered')), onClick: () => { const l = so.lines.find((x) => !['Rental', 'AMC'].includes(x.activity) && (!x.fulfilment || x.fulfilment === 'Delivered')); if (l) setDlg({ kind: 'step', lineId: l.id }); } },
            { label: 'Return (Customer Returns)', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}`), disabled: rentalOut === 0 },
            { label: 'Replacement', onClick: () => nav(`/rental/replacements/add?so=${so.id}`), disabled: rentalOut === 0 },
          ]} />
          <MenuButton label="View" variant="outlined" items={[{ label: 'Opportunity', onClick: () => nav(`/crm/opportunities/${so.oppId}`), disabled: !so.oppId }, { label: 'Quotation', onClick: () => nav(`/crm/quotations/${so.quoteId}`), disabled: !so.quoteId }, { label: 'Delivery Orders', onClick: () => nav('/crm/delivery-orders') }]} />
          <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} doc="Sales Order" /><MenuButton label="Actions" variant="outlined" items={[{ label: 'Send by Email', onClick: () => setMail(true) }, { label: 'Print', onClick: () => setPrintOpen(true) }, { label: 'Close', disabled: ['Closed', 'Cancelled'].includes(so.status), onClick: () => setCloseAsk(true) }]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {lpoLeft !== undefined && lpoLeft <= LPO_NOTICE_DAYS && !['Closed', 'Cancelled'].includes(so.status) && (
          <Alert severity={lpoLeft < 0 ? 'error' : 'warning'} sx={{ mb: 2 }} action={so.activity === 'Rental' ? <Button color="inherit" size="small" onClick={() => setDlg({ kind: 'expiry' })}>Extend</Button> : undefined}>
            LPO {so.lpo} {lpoLeft < 0 ? `expired ${-lpoLeft} day(s) ago` : `expires in ${lpoLeft} day(s)`} ({so.lpoExpiry}). Notice period {LPO_NOTICE_DAYS} days, admin-configurable. Without an extension, assets are returned as per the end date.
          </Alert>
        )}
        <CommercialTabs kind="order" f={soForm(so, opps.get(so.oppId)?.number, quotes.get(so.quoteId)?.number)} set={() => undefined} locked
          belowGeneral={<Section title="Delivery"><SpecView specs={deliverySpecs} f={so} cols={4} /></Section>}
          items={<>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Text type="s5" color="theme.secondary.700">{sel.length ? `${sel.length} line(s) selected` : 'Select lines for a bulk action. Each line also has its own actions in the three-dots menu.'}</Text>
              <MenuButton label="Bulk actions" variant="outlined" items={[{ label: 'Cross Hire (selected lines)', disabled: sel.length === 0, onClick: bulkCross }]} />
            </Box>
            <ItemsTable lines={so.lines} header={so.activity} vatType={so.vatType} locked fleet={fleet.rows} pricing={pricing.rows} mode="order" selectable selected={sel} onSelect={setSel} extra={{ label: 'Status', render: lineStatus }} rowActions={lineActions} />
            <Totals lines={so.lines} discountPct={so.discountPct} vatType={so.vatType} currency={so.currency} shipping={(so.shippingCost ?? 0) + (so.handlingCost ?? 0)} />
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>After the Sales Order: Rental, Deliver / Return. Trading and Fuel Trading, Stock / Invoice. A service charge, Charge / Invoice. AMC, Visit / Billing. Assets out: {rentalOut}. Logistics cost: {aed(so.logisticsCost)}.</Text>
          </>} />
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Traceability', change: 'new', req: R.meet, hidden: so.activity !== 'Rental', content: <Traceability so={so} quoteNo={quotes.get(so.quoteId)?.number} /> },
            { label: 'Asset Ledger', change: 'new', req: R.ledger, hidden: so.activity !== 'Rental', content: <Ledger so={so} /> },
            { label: 'AMC Visits', change: 'new', req: R.meet, hidden: so.activity !== 'AMC', content: (
              <DataTable hideToolbar rows={(so.visitPlan ?? []).map((v, i) => ({ id: String(i), i, ...v }))} columns={[
                { key: 'n', label: 'Visit', render: (r) => r.i + 1 }, { key: 'date', label: 'Planned Date' }, { key: 'amount', label: 'Visit value', align: 'right', render: (r) => (jobCardsOf(so.id).find((j) => j.visitIdx === r.i)?.visitFoc ? `${aed(r.amount)} (FOC)` : aed(r.amount)) }, { key: 'done', label: 'Done On', render: (r) => r.done ?? '-' }, { key: 'ref', label: 'Reference', render: (r) => r.ref ?? '-' },
                { key: 'act', label: '', render: (r) => <Button size="small" variant="outlined" onClick={() => nav(`/crm/amc-orders/${so.id}`)}>Job Card</Button> },
              ]} />) },
            { label: 'Compliance Status', change: 'new', req: R.so, hidden: so.activity !== 'Rental', content: compliance.length ? <DataTable hideToolbar rows={compliance.flatMap((c) => (c.certs.length ? c.certs.map((x) => ({ id: x.id, asset: `${c.h.assetId} - ${c.h.name}`, type: x.type, expiry: x.expiry, status: certStatus(x).label })) : [{ id: c.h.id, asset: `${c.h.assetId} - ${c.h.name}`, type: 'No certificate on record', expiry: '-', status: '-' }]))}
              columns={[{ key: 'asset', label: 'Asset' }, { key: 'type', label: 'Certificate' }, { key: 'expiry', label: 'Expiry' }, { key: 'status', label: 'Status', render: (r) => (r.status === '-' ? '-' : <StatusChip status={r.status} />) }]} /> : <Text type="s4">No assets are out against this order.</Text> },
            { label: 'Deliveries', hidden: so.activity !== 'Rental', content: <DataTable hideToolbar rows={myDels} emptyText="No deliveries yet" onRowClick={(d) => nav(`/crm/delivery-orders/${d.id}`)} columns={[{ key: 'number', label: 'Delivery Order' }, { key: 'date', label: 'Date' }, { key: 'rentalStart', label: 'Rental Start' }, { key: 'assets', label: 'Assets', render: (d) => d.assetIds.map((h) => assetById(h)?.assetId).join(', ') }, { key: 'status', label: 'Status', render: (d) => <StatusChip status={d.status} /> }, { key: 'closed', label: 'DO Closure', change: 'new', req: R.rreturn, render: (d) => (d.closed ? 'Closed on return' : 'Open') }]} /> },
            { label: 'Logistics', change: 'new', req: R.trip, hidden: !soTrips.length && so.activity !== 'Rental', content: (
              <>
                <TripsTable rows={soTrips} empty="No trips yet. A trip is created with each delivery, collection and replacement" />
                <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Logistics cost of this order: {aed(so.logisticsCost)}</Text>
                <Text type="s5" color="theme.secondary.700">The total of every trip expense (transporter charges, Salik, fuel and other vehicle costs). It feeds the Logistics Cost and Order Profitability reports.</Text>
              </>) },
            { label: 'Charges', change: 'new', req: R.meet, hidden: !so.damageCharges.length, content: <DataTable hideToolbar rows={so.damageCharges.map((c, i) => ({ id: String(i), ...c, asset: assetById(c.assetId)?.assetId }))} columns={[{ key: 'date', label: 'Date' }, { key: 'asset', label: 'Asset' }, { key: 'note', label: 'Charge' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => aed(r.amount) }]} /> },
            { label: 'Documents', change: 'new', req: R.so, content: <FileInput label="Upload DO / CN / Invoice / Credit Note / LPO / Quote" multiple value={so.docs} onChange={(n) => orders.update(so.id, { docs: n })} /> },
            { label: 'Activity Log', content: <Timeline items={so.log} /> },
          ]} />
        </Box>
      </Page>
      <ConfirmDialog open={closeAsk} title="Close Sales Order" description="An order cannot be closed while any delivered asset is unreturned." confirmLabel="Close order" onClose={() => setCloseAsk(false)} onConfirm={() => { const r = closeOrder(so); toast(r.message, r.ok ? 'success' : 'error'); setCloseAsk(false); }} />
      <ExpiryDialog open={dlg?.kind === 'expiry'} onClose={() => setDlg(null)} soId={so.id} />
      <CrossHireDialog open={dlg?.kind === 'cross'} onClose={() => { setDlg(null); setSel([]); }} soId={so.id} lineIds={dlg?.lineIds} />
      <NextStepDialog open={dlg?.kind === 'step'} onClose={() => setDlg(null)} soId={so.id} lineId={dlg?.lineId} />
      <EmailDialog open={mail} onClose={() => setMail(false)} docNo={so.number} customerId={so.customerId} onSent={(l) => orders.update(so.id, { log: [l, ...so.log] })} />
    </>
  );
}
