import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, FormGrid, SelectInput, ValueField, ValueGrid } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { certSeed, type CertRec } from '@/modules/inventory/data';
import { certStatus } from '@/modules/inventory/AssetPages';
import { CROSS_STAGES, costForSo, reqItems, unitsOf, LPO_NOTICE_DAYS, SO_STATUSES, TODAY, cust, log, assetById, availability, custName, docTotals, lineTotal, periods, type Line, type SalesOrder } from './data';
import { NEXT_STEP, crossHireGap, jobCardsOf, closeOrder, confirmOrder, days, deliveredQty, invoiceDamage, lineState, outstanding, releaseDueHolds, releaseHold } from './flow';
import { invoiceByRef, invoiceDue, invoiceTotal, invoicesOfOrder, nextRentalPeriod, advanceLeft } from '@/modules/accounting/engine';
import { lineGross as accLineGross, lineVat as accLineVat } from '@/modules/accounting/data';
import { useInvoices, usePayments } from '@/modules/accounting/shared';
import { ActivityChip, R, aed, useChRequests, useCrossHire, useDeliveries, useFleet, useOpps, useOrders, usePricing, useQuotes, useTrips } from './shared';
import { TripsTable } from '@/modules/rental/FleetPages';
import { schedulesOf } from '@/modules/accounting/schedule';
import { cycleOf } from '@/modules/accounting/billing';
import { ItemsTable } from './Items';
import { type RowMenuItem } from './shared';
import { CommercialTabs, Totals, commercialErrors, withHeaderCascade } from './CommercialTabs';
import { Section, SpecForm, SpecView } from './FormKit';
import { AdvanceDialog, EmailDialog, ExpiryDialog, NextStepDialog, PrintDialog, invoiceableLines } from './ActionDialogs';

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

export const soForm = (so: SalesOrder, oppNo = '', quoteNo = ''): Record<string, any> => ({
  transactionType: 'Credit', postingTime: '09:00', exchangeRate: 1, location: 'Jebel Ali Main Yard', salesperson: so.owner, discountOn: 'Gross Amount', ...(so.activity === 'Rental' ? { billingCycle: 'Monthly', invoicingType: 'Manual' } : {}), ...so,
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
    if (so.activity === 'Rental') { if (!f.billingCycle) e.billingCycle = 'Billing Cycle is required'; if (!f.invoicingType) e.invoicingType = 'Invoicing Type is required'; }
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
  const invs = useInvoices().rows.filter((i) => i.isRental && (i.soId === so.id || !!i.soIds?.includes(so.id)));
  const next = nextRentalPeriod(so.id);
  const lineTot = (l: { qty: number; rate: number; discountPct: number; vatPct: number }) => accLineGross(l as any) + accLineVat(l as any);
  const rows = so.lines.filter((l) => l.activity === 'Rental').flatMap((l) => l.assigned.map((a) => {
    const asset = assetById(a.assetId);
    const hold = a.state === 'Hold';
    const mine = invs.flatMap((i) => i.lines.filter((x) => x.tag === 'rental' && x.soLineId === l.id && x.assetId === a.assetId && x.deliveryId === a.deliveryId).map((x) => ({ x, i })));
    const invoiced = mine.reduce((s, m) => s + lineTot(m.x), 0);
    const received = mine.reduce((s, m) => { const t = invoiceTotal(m.i); return s + (t ? (lineTot(m.x) * m.i.amountPaid) / t : 0); }, 0);
    const billedTo = mine.map((m) => m.x.periodTo ?? '').sort().pop();
    const out = a.state === 'On Hire' || hold;
    return { id: `${l.id}-${a.assetId}-${a.start}`, asset: `${asset?.assetId} - ${asset?.name}`, delivered: a.start, cycle: hold ? `Starts ${a.start} (Hold)` : `${a.start}, ${FREQ_TEXT(l)}`, state: a.state, invoiced, received, billedTo: billedTo ?? '-', next: out && next ? next.from : '-', stop: a.stop ?? '-' };
  }));
  return (
    <Box>
      <DataTable hideToolbar rows={rows} pageSize={20} emptyText="No asset has been delivered yet" columns={[
        { key: 'asset', label: 'Asset' }, { key: 'delivered', label: 'Rental Start' }, { key: 'cycle', label: 'Invoice Cycle' }, { key: 'stop', label: 'Billing Stopped' },
        { key: 'state', label: 'Status', render: (r) => <StatusChip status={r.state === 'Returned' ? 'Off Hire' : r.state} tone={r.state === 'Replaced' ? 'grey' : undefined} /> },
        { key: 'billedTo', label: 'Invoiced up to', change: 'new', req: R.ledger }, { key: 'next', label: 'Next Invoice Date', change: 'new', req: R.ledger },
        { key: 'invoiced', label: 'Invoiced to date', align: 'right', render: (r) => aed(r.invoiced) }, { key: 'received', label: 'Received to date', align: 'right', render: (r) => aed(r.received) },
      ]} />
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Live view of what is out on this project. Billing runs per delivery from its own Rental Start Date until its own return. Invoiced and received come from the rental invoices in Accounting (including VAT); invoices are raised by the rental run in Rental, Invoicing Rental Order.</Text>
    </Box>
  );
}

/** Every invoice, advance and payment of the order (instruction 6 Oct: invoices connected to the order). */
function OrderInvoices({ so }: { so: SalesOrder }) {
  const nav = useNavigate();
  useInvoices();
  const pays = usePayments().rows.filter((p) => p.soId === so.id && p.isAdvance);
  const invs = invoicesOfOrder(so.id);
  const approved = invs.filter((i) => i.approval === 'Approved');
  const total = approved.reduce((s, i) => s + invoiceTotal(i), 0);
  const due = approved.reduce((s, i) => s + invoiceDue(i), 0);
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 4, mb: 1.5, flexWrap: 'wrap' }}>
        <Text type="s4">Approved invoices {aed(total)}</Text><Text type="s4">Paid and settled {aed(total - due)}</Text><Text type="s4" weight="medium">Outstanding {aed(due)}</Text>
        <Text type="s4">Pending approval {invs.length - approved.length}</Text>
      </Box>
      <DataTable hideToolbar rows={invs} emptyText="No invoice yet" onRowClick={(i) => nav(`/accounting/invoices/${i.id}`)} columns={[
        { key: 'number', label: 'Invoice' }, { key: 'date', label: 'Date' }, { key: 'type', label: 'Source', render: (i) => i.source.type }, { key: 'period', label: 'Period', render: (i) => (i.periodFrom ? `${i.periodFrom} to ${i.periodTo}` : '-') },
        { key: 't', label: 'Total (incl. VAT)', align: 'right', render: (i) => aed(invoiceTotal(i)) }, { key: 'd', label: 'Amount Due', align: 'right', render: (i) => aed(invoiceDue(i)) },
        { key: 'a', label: 'Status', render: (i) => <StatusChip status={i.approval} /> }, { key: 'p', label: 'Payment', render: (i) => (i.approval === 'Approved' ? <StatusChip status={i.payStatus} /> : '-') },
      ]} />
      {pays.length > 0 && <>
        <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Advances</Text>
        <DataTable hideToolbar rows={pays} onRowClick={(p) => nav(`/accounting/payment-entries/${p.id}`)} columns={[{ key: 'number', label: 'Collection' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', align: 'right', render: (p) => aed(p.amount) }, { key: 'left', label: 'Not yet applied', align: 'right', render: (p) => aed(advanceLeft(p)) }, { key: 'approval', label: 'Status', render: (p) => <StatusChip status={p.approval} /> }]} />
      </>}
    </Box>
  );
}

/** Scheduled Invoices (existing ERP rental order tab): the periods the Billing Cycle gives this order, with the invoice once it is raised. */
function OrderSchedules({ so }: { so: SalesOrder }) {
  const nav = useNavigate();
  useInvoices();
  const rows = schedulesOf(so.id);
  const cycle = cycleOf(so.billingCycle);
  const mode = so.invoicingType ?? cycle.invoicingType;
  return (
    <Box>
      <Text type="s4" sx={{ mb: 1 }}>Billing Cycle {cycle.name} ({cycle.count} {cycle.duration}), Invoicing Type {mode}. {rows.some((r) => r.status !== 'processed') ? '' : 'Nothing is scheduled yet: the schedule starts with the first delivery.'}</Text>
      <DataTable hideToolbar rows={rows} pageSize={20} emptyText="No asset has been delivered yet, so no invoice is scheduled" columns={[
        { key: 'n', label: 'Schedule ID', render: (r) => `SCH-${rows.indexOf(r) + 1}` }, { key: 'kind', label: 'Type', render: (r) => <StatusChip status={r.kind === 'initial' ? 'Initial' : 'Recurring'} tone={r.kind === 'initial' ? 'blue' : 'amber'} /> },
        { key: 'period', label: 'Period', render: (r) => `${r.from} to ${r.to}` }, { key: 'days', label: 'Days', align: 'right' }, { key: 'invoiceDate', label: 'Invoice Date' },
        { key: 'amount', label: 'Amount (incl. VAT)', align: 'right', render: (r) => (r.amount ? aed(r.amount) : '-') }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'processed' ? 'green' : r.status === 'failed' ? 'red' : 'amber'} /> },
        { key: 'inv', label: 'Invoice', render: (r) => (r.invoiceId ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/accounting/invoices/${r.invoiceId}`)}>{r.invoiceNumber}</Box> : r.error ?? '-') },
      ]} />
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Invoices are raised on their invoice date: by the system for an Automatic order, and by Submit in Rental, Invoicing Rental Order for a Manual order. Up to {cycle.maxSchedule ?? 12} periods are scheduled ahead. A period is billed per asset from its own Rental Start to its off-hire day.</Text>
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

/** Cross Hire requests and orders of a Rental order with their cost, which rolls into the order's profitability (Rental > Cross-Hire, Cost Roll-Up). */
function OrderCrossHire({ so }: { so: SalesOrder }) {
  const nav = useNavigate();
  const reqs = useChRequests().rows.filter((r) => r.soId === so.id);
  const hires = useCrossHire().rows.filter((c) => c.soId === so.id || unitsOf(c).some((u) => u.soId === so.id));
  const cost = hires.reduce((n, c) => n + costForSo(c, so.id), 0);
  return (
    <Box>
      <Text type="s4" weight="medium" sx={{ mb: 1 }}>Requests</Text>
      <DataTable hideToolbar rows={reqs} emptyText="No cross-hire request. Use Cross Hire on a line when no owned unit is Ready for Hire" onRowClick={(r) => nav(`/rental/cross-hire/${r.id}`)}
        columns={[{ key: 'number', label: 'Request' }, { key: 'date', label: 'Date' }, { key: 'cat', label: 'Category', render: (r) => [...new Set(reqItems(r).map((i) => `${i.group} ${i.category}`))].join(', ') }, { key: 'qty', label: 'Qty', align: 'right' }, { key: 'by', label: 'Raised By', render: (r) => r.raisedBy ?? '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }]} />
      <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Orders</Text>
      <DataTable hideToolbar rows={hires} emptyText="No cross-hire order yet" onRowClick={(c) => nav(`/rental/cross-hire-orders/${c.id}`)}
        columns={[{ key: 'number', label: 'Hire Order' }, { key: 'supplier', label: 'Supplier' }, { key: 'stage', label: 'Lifecycle Stage', render: (c) => CROSS_STAGES[c.stage] }, { key: 'rate', label: 'Agreed Rate', align: 'right', render: (c) => aed(c.rate) }, { key: 'units', label: 'Units delivered here', align: 'right', render: (c) => unitsOf(c).filter((u) => u.soId === so.id).length }, { key: 'mine', label: 'Cost for this order', align: 'right', render: (c) => aed(costForSo(c, so.id)) }]} />
      <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Cross-hire cost rolled into this order: {aed(cost)}</Text>
      <Text type="s5" color="theme.secondary.700">Supplier rate, expenses and any supplier dispute charge. It feeds the Order Profitability report.</Text>
    </Box>
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
  const [dlg, setDlg] = useState<{ kind: 'expiry' | 'step' | 'advance'; lineId?: string } | null>(null);
  useInvoices();
  const [sel, setSel] = useState<string[]>([]);
  const [mail, setMail] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const compliance = useMemo(() => (so ? so.lines.flatMap((l) => outstanding(l).map((a) => assetById(a.assetId)).filter(Boolean).map((h) => ({ h: h!, certs: certs.rows.filter((c) => c.assetId === h!.assetId) }))) : []), [so, certs.rows, fleet.rows]);
  // A Hold ends by itself once its Rental Start Date arrives.
  useEffect(() => { if (id) releaseDueHolds(id); }, [id]);
  if (!so) return <Page><PageTitle title="Sales Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/sales-orders')}>Back</Button>} /></Page>;
  const myDels = dels.rows.filter((d) => d.soId === so.id);
  const soTrips = trips.rows.filter((t) => t.soId === so.id);
  const quotedLines = so.lines.filter((l) => l.activity === 'Service' && !l.foc && /delivery|return|collection|transport|haulage|mobili[sz]ation/i.test(l.item));
  const quotedLogistics = quotedLines.reduce((n, l) => n + lineTotal(l), 0);
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
  /** Cross Hire exists only on a Rental order (7 Oct): no option, action or tab for any other Activity Type. */
  const isRental = so.activity === 'Rental';
  const canCrossHire = (l: Line) => isRental && l.activity === 'Rental' && l.qty - deliveredQty(l) > 0 && crossHireGap(so, l) > 0;
  const lineActions = (l: Line): RowMenuItem[] => {
    if (l.activity === 'Rental') {
      const av = availability(l.group, l.category, fleet.rows);
      const remaining = l.qty - deliveredQty(l);
      const out = outstanding(l);
      return [
        ...(remaining > 0 ? [{ label: 'Deliver', disabled: av.owned.length + av.cross.length === 0, onClick: () => nav(`/crm/delivery-orders/add?so=${so.id}&line=${l.id}`) }] : []),
        ...(remaining > 0 && isRental ? [{ label: 'Cross Hire', disabled: !canCrossHire(l), onClick: () => nav(`/rental/cross-hire/add?so=${so.id}&lines=${l.id}`) }] : []),
        ...(out.some((a) => a.state === 'Hold') ? [{ label: 'Release Hold (site ready early)', onClick: () => out.filter((a) => a.state === 'Hold').forEach((a) => { releaseHold(so.id, l.id, a.assetId); toast('Hold released, invoicing starts today'); }) }] : []),
        ...(out.length > 0 ? [{ label: 'Replace asset', onClick: () => nav(`/rental/replacements/add?so=${so.id}&line=${l.id}`) }, { label: 'Return asset', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}&line=${l.id}`) }] : []),
      ];
    }
    if (l.activity === 'AMC') return [{ label: 'Open AMC Order', onClick: () => nav(`/crm/amc-orders/${so.id}`) }];
    if (l.activity === 'Service' && l.billing === 'Recurring') return [];
    if (l.fulfilment === 'Delivered') return [{ label: 'Invoice', onClick: () => nav(`/accounting/invoices/add?so=${so.id}&lines=${l.id}`) }];
    if (l.fulfilment) return [];
    return [{ label: (NEXT_STEP[l.activity] ?? NEXT_STEP.Service).label, onClick: () => setDlg({ kind: 'step', lineId: l.id }) }];
  };
  const chosen = so.lines.filter((l) => sel.includes(l.id));
  const bulkCross = () => {
    if (!chosen.length) { toast('Select the equipment lines first', 'error'); return; }
    const bad = chosen.filter((l) => !canCrossHire(l));
    if (bad.length) { toast(`Cross Hire is not available for: ${bad.map((l) => l.item).join(', ')} (only rental lines with units not covered by a Ready for Hire unit or an open request, RFQ or order)`, 'error'); return; }
    nav(`/rental/cross-hire/add?so=${so.id}&lines=${chosen.map((l) => l.id).join(',')}`); setSel([]);
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
            { label: 'Advance', onClick: () => setDlg({ kind: 'advance' }) },
            { label: 'Invoice', disabled: !invoiceableLines(so.lines).length, onClick: () => nav(`/accounting/invoices/add?so=${so.id}`) },
            { label: 'Return (Customer Returns)', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}`), disabled: rentalOut === 0 },
            { label: 'Replacement', onClick: () => nav(`/rental/replacements/add?so=${so.id}`), disabled: rentalOut === 0 },
          ]} />
          <MenuButton label="View" variant="outlined" items={[{ label: 'Opportunity', onClick: () => nav(`/crm/opportunities/${so.oppId}`), disabled: !so.oppId }, { label: 'Quotation', onClick: () => nav(`/crm/quotations/${so.quoteId}`), disabled: !so.quoteId }, { label: 'Delivery Orders', onClick: () => nav('/crm/delivery-orders') }, { label: 'Invoices', onClick: () => nav(`/accounting/invoices?so=${so.id}`) }]} />
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
            {isRental && <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Text type="s5" color="theme.secondary.700">{sel.length ? `${sel.length} line(s) selected` : 'Select lines for a bulk action. Each line also has its own actions in the three-dots menu.'}</Text>
              <MenuButton label="Bulk actions" variant="outlined" items={[{ label: 'Cross Hire (selected lines)', disabled: sel.length === 0, onClick: bulkCross }]} />
            </Box>}
            <ItemsTable lines={so.lines} header={so.activity} vatType={so.vatType} locked fleet={fleet.rows} pricing={pricing.rows} mode="order" selectable={isRental} selected={sel} onSelect={setSel} extra={{ label: 'Status', render: lineStatus }} rowActions={lineActions} />
            <Totals lines={so.lines} discountPct={so.discountPct} vatType={so.vatType} currency={so.currency} shipping={(so.shippingCost ?? 0) + (so.handlingCost ?? 0)} />
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>After the Sales Order: Rental, Deliver / Return. Trading and Fuel Trading, Stock / Invoice. A service charge, Charge / Invoice. AMC, Visit / Billing. Assets out: {rentalOut}. Logistics cost: {aed(so.logisticsCost)}.</Text>
          </>} />
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Traceability', change: 'new', req: R.meet, hidden: so.activity !== 'Rental', content: <Traceability so={so} quoteNo={quotes.get(so.quoteId)?.number} /> },
            { label: 'Scheduled Invoices', change: 'new', req: R.ledger, hidden: so.activity !== 'Rental', content: <OrderSchedules so={so} /> },
            { label: 'Asset Ledger', change: 'changed', req: R.ledger, hidden: so.activity !== 'Rental', content: <Ledger so={so} /> },
            { label: 'AMC Visits', change: 'new', req: R.meet, hidden: so.activity !== 'AMC', content: (
              <DataTable hideToolbar rows={(so.visitPlan ?? []).map((v, i) => ({ id: String(i), i, ...v }))} columns={[
                { key: 'n', label: 'Visit', render: (r) => r.i + 1 }, { key: 'date', label: 'Planned Date' }, { key: 'amount', label: 'Visit value', align: 'right', render: (r) => (jobCardsOf(so.id).find((j) => j.visitIdx === r.i)?.visitFoc ? `${aed(r.amount)} (FOC)` : aed(r.amount)) }, { key: 'done', label: 'Done On', render: (r) => r.done ?? '-' }, { key: 'ref', label: 'Reference', render: (r) => r.ref ?? '-' },
                { key: 'act', label: '', render: (r) => <Button size="small" variant="outlined" onClick={() => nav(`/crm/amc-orders/${so.id}`)}>Job Card</Button> },
              ]} />) },
            { label: 'Compliance Status', change: 'new', req: R.so, hidden: so.activity !== 'Rental', content: compliance.length ? <DataTable hideToolbar rows={compliance.flatMap((c) => (c.certs.length ? c.certs.map((x) => ({ id: x.id, asset: `${c.h.assetId} - ${c.h.name}`, type: x.type, expiry: x.expiry, status: certStatus(x).label })) : [{ id: c.h.id, asset: `${c.h.assetId} - ${c.h.name}`, type: 'No certificate on record', expiry: '-', status: '-' }]))}
              columns={[{ key: 'asset', label: 'Asset' }, { key: 'type', label: 'Certificate' }, { key: 'expiry', label: 'Expiry' }, { key: 'status', label: 'Status', render: (r) => (r.status === '-' ? '-' : <StatusChip status={r.status} />) }]} /> : <Text type="s4">No assets are out against this order.</Text> },
            { label: 'Deliveries', hidden: so.activity !== 'Rental', content: <DataTable hideToolbar rows={myDels} emptyText="No deliveries yet" onRowClick={(d) => nav(`/crm/delivery-orders/${d.id}`)} columns={[{ key: 'number', label: 'Delivery Order' }, { key: 'date', label: 'Date' }, { key: 'rentalStart', label: 'Rental Start' }, { key: 'assets', label: 'Assets', render: (d) => d.assetIds.map((h) => assetById(h)?.assetId).join(', ') }, { key: 'status', label: 'Status', render: (d) => <StatusChip status={d.status} /> }, { key: 'closed', label: 'DO Closure', change: 'new', req: R.rreturn, render: (d) => (d.closed ? 'Closed on return' : 'Open') }]} /> },
            { label: 'Cross Hire', change: 'new', req: R.cross, hidden: !isRental, content: <OrderCrossHire so={so} /> },
            { label: 'Logistics', change: 'new', req: R.trip, hidden: !soTrips.length && so.activity !== 'Rental', content: (
              <>
                <TripsTable rows={soTrips} empty="No trips yet. A trip is created with each delivery, collection and replacement" />
                <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Logistics cost of this order: {aed(so.logisticsCost)}</Text>
                <Text type="s5" color="theme.secondary.700">The total of every trip expense (transporter charges, Salik, fuel and other vehicle costs). It feeds the Logistics Cost and Order Profitability reports.</Text>
                <Panel title="Quoted vs actual" change="new" req="Fleet review 7 Oct: the customer is charged only the Delivery and Return Charge lines of the order. The real trip cost is our cost, so this shows what is left" sx={{ mt: 2 }}>
                  <ValueGrid cols={4}>
                    <ValueField label="Quoted to customer (excl. VAT)" value={aed(quotedLogistics)} />
                    <ValueField label="Actual trip cost" value={aed(so.logisticsCost)} />
                    <ValueField label={quotedLogistics - so.logisticsCost >= 0 ? 'Left after trip cost' : 'Absorbed by the company'} value={<span style={{ color: quotedLogistics - so.logisticsCost >= 0 ? '#0A6C3D' : '#C64D4D', fontWeight: 600 }}>{aed(Math.abs(quotedLogistics - so.logisticsCost))}</span>} />
                    <ValueField label="Charge lines" value={quotedLines.map((l) => l.item).join(', ') || 'None quoted'} />
                  </ValueGrid>
                  <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Trip expenses are not added to the customer's invoice. Whether a client-caused delay or an overrun is re-billed is still to be confirmed with the client.</Text>
                </Panel>
              </>) },
            { label: 'Charges', change: 'new', req: R.meet, hidden: !so.damageCharges.length, content: <DataTable hideToolbar rows={so.damageCharges.map((c, i) => ({ id: String(i), idx: i, ...c, asset: assetById(c.assetId)?.assetId }))} columns={[{ key: 'date', label: 'Date' }, { key: 'asset', label: 'Asset' }, { key: 'note', label: 'Charge' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => aed(r.amount) },
              { key: 'inv', label: 'Invoice', change: 'new', req: R.meet, render: (r) => { const i = invoiceByRef(r.invoiceId); return i ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/accounting/invoices/${i.id}`)}>{i.number} ({i.approval === 'Approved' ? i.payStatus : i.approval})</Box> : 'Not invoiced'; } },
              { key: 'act', label: '', render: (r) => (r.invoiceId ? null : <Button size="small" variant="outlined" onClick={() => { const x = invoiceDamage(so.id, r.idx); toast(x.message, x.ok ? 'success' : 'error'); }}>Raise Invoice</Button>) }]} /> },
            { label: 'Invoices', change: 'new', req: R.so, content: <OrderInvoices so={so} /> },
            { label: 'Documents', change: 'new', req: R.so, content: <FileInput label="Upload DO / CN / Invoice / Credit Note / LPO / Quote" multiple value={so.docs} onChange={(n) => orders.update(so.id, { docs: n })} /> },
            { label: 'Activity Log', content: <Timeline items={so.log} /> },
          ]} />
        </Box>
      </Page>
      <ConfirmDialog open={closeAsk} title="Close Sales Order" description="An order cannot be closed while any delivered asset is unreturned." confirmLabel="Close order" onClose={() => setCloseAsk(false)} onConfirm={() => { const r = closeOrder(so); toast(r.message, r.ok ? 'success' : 'error'); setCloseAsk(false); }} />
      <ExpiryDialog open={dlg?.kind === 'expiry'} onClose={() => setDlg(null)} soId={so.id} />
      <NextStepDialog open={dlg?.kind === 'step'} onClose={() => setDlg(null)} soId={so.id} lineId={dlg?.lineId} />
      <AdvanceDialog open={dlg?.kind === 'advance'} onClose={() => setDlg(null)} soId={so.id} onDone={(l) => orders.update(so.id, { log: [l, ...so.log] })} />
      <EmailDialog open={mail} onClose={() => setMail(false)} docNo={so.number} customerId={so.customerId} onSent={(l) => orders.update(so.id, { log: [l, ...so.log] })} />
    </>
  );
}
