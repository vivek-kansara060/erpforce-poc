import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { CheckInput, FieldError, FileInput, FormGrid, HelpTip, SelectInput, ValueField, ValueGrid } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { certSeed, type CertRec } from '@/modules/inventory/data';
import { certStatus } from '@/modules/inventory/AssetPages';
import { AMC_LIKE, CROSS_STAGES, chItemRate, chItems, costForSo, reqItems, unitsOf, LPO_NOTICE_DAYS, SO_STATUSES, TODAY, cust, log, assetById, availability, custName, docTotals, lineTotal, periods, type CrossHire, type Line, type OrderRevision, type SalesOrder } from './data';
import { NEXT_STEP, billCrossHireFromOrder, extendOrder, crossHireGap, jobCardsOf, closeOrder, confirmOrder, days, deliveredQty, invoiceDamage, lineState, outstanding, releaseDueHolds, releaseHold } from './flow';
import { billTotal, billsOfSource, invoiceByRef, invoiceDue, invoiceTotal, invoicesOfOrder, nextRentalPeriod, advanceLeft } from '@/modules/accounting/engine';
import { lineGross as accLineGross, lineVat as accLineVat } from '@/modules/accounting/data';
import { useBills, useInvoices, usePayments } from '@/modules/accounting/shared';
import { ReissueDialog, ReturnToSupplierDialog } from '@/modules/rental/CrossHirePages';
import { ChangeTag } from '@/components/ChangeTag';
import { ActivityChip, R, R8, TO_CONFIRM, aed, useChRequests, useCrossHire, useDeliveries, useFleet, useOpps, useOrders, usePricing, useQuotes, useReplacements, useTrips } from './shared';
import { TripsTable } from '@/modules/rental/FleetPages';
import { schedulesOf } from '@/modules/accounting/schedule';
import { cycleOf } from '@/modules/accounting/billing';
import { ItemsTable } from './Items';
import { type RowMenuItem } from './shared';
import { CommercialTabs, Totals, commercialErrors, withHeaderCascade } from './CommercialTabs';
import { Section, SpecForm, SpecView, type Spec } from './FormKit';
import { AdvanceDialog, EmailDialog, ExpiryDialog, NextStepDialog, PrintDialog, invoiceableLines } from './ActionDialogs';

const R_SEP = R8('Category and Subcategory shown separately, as on the Sales Order');
const R_EXT = R8('Extension as a revision of the Sales Order');
const R_UNITS = R8('Return to Supplier and Re-Issue from the Sales Order');
const R_BILL = R8('Cross-Hire Bill from the Sales Order, entered by hand for each period');
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
          { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R.meet, render: (r) => r.costCentre || '-' },
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
  transactionType: 'Credit', postingTime: '09:00', exchangeRate: 1, location: 'Jebel Ali Main Yard', salesperson: so.owner, discountOn: 'Gross Amount', ...(so.activity === 'Rental' ? { billingCycle: 'Monthly', invoicingType: 'Automatic' } : {}), ...so,
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

/** Status of one unit on the order: a unit still out after an extension is Extended (to its new end), returned units stay Returned. */
export const assetState = (a: { state: string; extendedTo?: string }) => ((a.state === 'On Hire' || a.state === 'Hold') && a.extendedTo ? `Extended to ${a.extendedTo}` : a.state);
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
    return { id: `${l.id}-${a.assetId}-${a.start}`, asset: `${asset?.assetId} - ${asset?.name}`, delivered: a.start, cycle: hold ? `Starts ${a.start} (Hold)` : `${a.start}, ${FREQ_TEXT(l)}`, state: assetState(a), invoiced, received, billedTo: billedTo ?? '-', next: out && next ? next.from : '-', stop: a.stop ?? '-' };
  }));
  return (
    <Box>
      <DataTable hideToolbar rows={rows} pageSize={20} emptyText="No asset has been delivered yet" columns={[
        { key: 'asset', label: 'Asset' }, { key: 'delivered', label: 'Rental Start' }, { key: 'cycle', label: 'Invoice Cycle' }, { key: 'stop', label: 'Billing Stopped' },
        { key: 'state', label: 'Status', change: 'changed', req: R8('Extended unit shown as Extended, returned units stay Returned'), render: (r) => <StatusChip status={r.state === 'Returned' ? 'Off Hire' : r.state} tone={r.state === 'Replaced' ? 'grey' : r.state.startsWith('Extended') ? 'blue' : undefined} /> },
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
    return { id: `${l.id}${a.assetId}${a.start}`, quote: quoteNo ?? '-', so: so.number, dn: d?.number ?? '-', group: l.group, requested: l.category, delivered: h ? h.subCategory : '-', asset: h?.assetId ?? '-', state: assetState(a), differs: h && h.subCategory !== l.category ? 'Yes' : 'No' };
  }));
  return (
    <DataTable hideToolbar rows={rows} emptyText="Nothing delivered yet" columns={[
      { key: 'quote', label: 'Quotation' }, { key: 'so', label: 'Sales Order' }, { key: 'dn', label: 'Delivery Order' }, { key: 'group', label: 'Category', change: 'changed', req: R_SEP }, { key: 'requested', label: 'Requested Subcategory', change: 'changed', req: R_SEP }, { key: 'delivered', label: 'Delivered Subcategory', change: 'changed', req: R_SEP },
      { key: 'asset', label: 'Asset ID' }, { key: 'differs', label: 'Differs', render: (r) => <StatusChip status={r.differs} tone={r.differs === 'Yes' ? 'amber' : 'green'} /> }, { key: 'state', label: 'Status', change: 'changed', req: R8('Extended unit shown as Extended, returned units stay Returned') },
    ]} />
  );
}

/** Cross Hire requests and orders of a Rental order with their cost, which rolls into the order's profitability (Rental > Cross-Hire, Cost Roll-Up). */
function OrderCrossHire({ so }: { so: SalesOrder }) {
  const nav = useNavigate();
  const reqs = useChRequests().rows.filter((r) => r.soId === so.id);
  const hires = useCrossHire().rows.filter((c) => c.soId === so.id || unitsOf(c).some((u) => u.soId === so.id));
  const cost = hires.reduce((n, c) => n + costForSo(c, so.id), 0);
  const [act, setAct] = useState<{ kind: 'supplier' | 'reissue'; ch: CrossHire; assetId: string } | null>(null);
  useBills();
  // Every unit of a cross-hire order that was delivered on this Sales Order (8 Oct call: return to supplier from the order, not only from the Cross-Hire order).
  const units = hires.flatMap((c) => unitsOf(c).filter((u) => u.soId === so.id).map((u) => ({ id: u.assetId, c, u, h: assetById(u.assetId) })));
  const bills = hires.flatMap((c) => billsOfSource('Cross Hire', c.id).map((b) => ({ ...b, chNumber: c.number })));
  return (
    <Box>
      <Text type="s4" weight="medium" sx={{ mb: 1 }}>Cross-hired units on this order<ChangeTag kind="new" req={R_UNITS} /></Text>
      <DataTable hideToolbar rows={units} emptyText="No cross-hired unit has been delivered on this order" onRowClick={(r) => nav(`/inventory/items/heavy/${r.id}`)}
        actions={[
          { label: 'Return to Supplier', hidden: (r) => r.u.stage !== 3, onClick: (r) => setAct({ kind: 'supplier', ch: r.c, assetId: r.id }) },
          { label: 'Re-Issue to another project', hidden: (r) => r.u.stage !== 3, onClick: (r) => setAct({ kind: 'reissue', ch: r.c, assetId: r.id }) },
          { label: 'Open asset', onClick: (r) => nav(`/inventory/items/heavy/${r.id}`) },
        ]}
        columns={[
          { key: 'a', label: 'Asset ID', render: (r) => r.h?.assetId ?? '-' }, { key: 'g', label: 'Category', render: (r) => r.h?.category ?? '-' }, { key: 's', label: 'Subcategory', render: (r) => r.h?.subCategory ?? '-' },
          { key: 'b', label: 'Brand', render: (r) => r.h?.brand || '-' }, { key: 'm', label: 'Model', render: (r) => r.h?.model || '-' }, { key: 'sup', label: 'Supplier', render: (r) => r.c.supplier }, { key: 'ch', label: 'Cross Hire Order', render: (r) => r.c.number },
          { key: 'st', label: 'Lifecycle Stage', render: (r) => <StatusChip status={CROSS_STAGES[r.u.stage]} /> }, { key: 'as', label: 'Asset Status', render: (r) => (r.h ? <StatusChip status={r.h.assetStatus} /> : '-') },
        ]} />
      <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Requests</Text>
      <DataTable hideToolbar rows={reqs} emptyText="No cross-hire request. Use Cross Hire on a line when no owned unit is Ready for Hire" onRowClick={(r) => nav(`/rental/cross-hire/${r.id}`)}
        columns={[{ key: 'number', label: 'Request' }, { key: 'date', label: 'Date' }, { key: 'grp', label: 'Category', change: 'changed', req: R_SEP, render: (r) => [...new Set(reqItems(r).map((i) => i.group))].join(', ') }, { key: 'cat', label: 'Subcategory', change: 'changed', req: R_SEP, render: (r) => [...new Set(reqItems(r).map((i) => i.category))].join(', ') }, { key: 'qty', label: 'Qty', align: 'right' }, { key: 'by', label: 'Raised By', render: (r) => r.raisedBy ?? '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }]} />
      <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Orders</Text>
      <DataTable hideToolbar rows={hires} emptyText="No cross-hire order yet" onRowClick={(c) => nav(`/rental/cross-hire-orders/${c.id}`)}
        columns={[{ key: 'number', label: 'Hire Order' }, { key: 'supplier', label: 'Supplier' }, { key: 'stage', label: 'Lifecycle Stage', render: (c) => CROSS_STAGES[c.stage] }, { key: 'rate', label: 'Agreed Rate', align: 'right', render: (c) => aed(c.rate) }, { key: 'units', label: 'Units delivered here', align: 'right', render: (c) => unitsOf(c).filter((u) => u.soId === so.id).length }, { key: 'mine', label: 'Cost for this order', align: 'right', render: (c) => aed(costForSo(c, so.id)) }]} />
      <Text type="s4" weight="medium" sx={{ mt: 2, mb: 1 }}>Supplier bills<ChangeTag kind="new" req={R_BILL} /></Text>
      <DataTable hideToolbar rows={bills} emptyText="No supplier bill yet. Create, Cross-Hire Bill when the supplier's bill arrives" onRowClick={(b) => nav(`/accounting/bills/${b.id}`)}
        columns={[
          { key: 'number', label: 'Bill' }, { key: 'ch', label: 'Cross Hire Order', render: (b) => b.chNumber }, { key: 'period', label: 'Period', render: (b) => (b.lines[0]?.periodFrom ? `${b.lines[0].periodFrom} to ${b.lines[0].periodTo}` : '-') },
          { key: 'inv', label: 'Supplier Invoice', render: (b) => b.supplierInvoiceNo || '-' }, { key: 't', label: 'Total (incl. VAT)', align: 'right', render: (b) => aed(billTotal(b)) },
          { key: 'a', label: 'Status', render: (b) => <StatusChip status={b.approval} /> }, { key: 'p', label: 'Payment', render: (b) => (b.approval === 'Approved' ? <StatusChip status={b.payStatus} /> : '-') },
        ]} />
      <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Cross-hire cost rolled into this order: {aed(cost)}</Text>
      <Text type="s5" color="theme.secondary.700">Supplier rate, expenses and any supplier dispute charge. It feeds the Order Profitability report. The cost uses the agreed rate, not the supplier bills entered by hand.</Text>
      {act?.kind === 'supplier' && <ReturnToSupplierDialog ch={act.ch} assetId={act.assetId} open onClose={() => setAct(null)} />}
      {act?.kind === 'reissue' && <ReissueDialog ch={act.ch} assetId={act.assetId} open onClose={() => setAct(null)} />}
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
  const crossHires = useCrossHire().rows;
  const allReps = useReplacements().rows;
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const so = orders.get(id);
  const [dlg, setDlg] = useState<{ kind: 'expiry' | 'step' | 'advance'; lineId?: string } | null>(null);
  const [revView, setRevView] = useState<OrderRevision | null>(null);
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
    if (l.activity === 'Rental') {
      // One status chip, as in the existing ERP; a replaced line gets a small chip beside it whose hover text lists the replacements and whose click opens them.
      const mine = reps.filter((r) => r.lineId === l.id);
      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <StatusChip status={lineState(l)} />
            {mine.length > 0 && (
              <Tooltip arrow placement="top" title={<>{mine.map((r) => <div key={r.id}>{assetById(r.oldAssetId)?.assetId} replaced by {assetById(r.newAssetId)?.assetId} ({r.number})</div>)}</>}>
                <Box component="span" sx={{ cursor: 'pointer' }} onClick={() => nav(mine.length === 1 ? `/crm/replacements/${mine[0].id}` : `/crm/replacements?so=${so.id}`)}><StatusChip status={`${mine.length} replaced`} tone="amber" /></Box>
              </Tooltip>
            )}
          </Box>
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 0.25, whiteSpace: 'nowrap' }}>{outstanding(l).length} out, {l.assigned.filter((a) => a.state === 'Returned').length} returned, {Math.max(0, l.qty - deliveredQty(l))} to deliver</Text>
        </Box>
      );
    }
    if (l.activity === 'AMC') return <StatusChip status="AMC" tone="grey" />;
    if (l.activity === 'Service' && l.billing === 'Recurring') return <Text type="s5">Billed with each rental cycle</Text>;
    if (l.fulfilment) return <Box><StatusChip status={l.fulfilment} /><Text type="s5" color="theme.secondary.700">{l.fulfilmentRef}</Text></Box>;
    return <StatusChip status="Pending" tone="amber" />;
  };
  /** Cross Hire exists only on a Rental order (7 Oct): no option, action or tab for any other Activity Type. */
  const isRental = so.activity === 'Rental';
  const reps = allReps.filter((r) => r.soId === so.id);
  const hasCrossHire = crossHires.some((c) => c.soId === so.id || unitsOf(c).some((u) => u.soId === so.id));
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
        ...(out.length > 0 ? [{ label: 'Replace asset', onClick: () => nav(`/crm/replacements/add?so=${so.id}&line=${l.id}`) }, { label: 'Return asset', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}&line=${l.id}`) }] : []),
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
      <FormHeader crumbs={[{ label: 'Sales Orders', to: '/crm/sales-orders' }, { label: (so.revision ?? 0) > 0 ? `${so.number} (Rev ${so.revision})` : so.number }]} status={<StatusChip status={so.status} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${so.id}/edit`)}>Edit</Button>
          {so.status === 'Pending' && <Button variant="outlined" onClick={() => { confirmOrder(so); toast('Sales Order confirmed'); }}>Confirm</Button>}
          {so.activity === 'Rental' && rentalOut > 0 && <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${so.id}/extend`)}>Extend</Button>}
          <MenuButton label="Create" variant="outlined" items={[
            { label: 'Delivery', disabled: AMC_LIKE.includes(so.activity) || so.activity === 'Service', onClick: () => nav(`/crm/delivery-orders/add?so=${so.id}`) },
            { label: 'Advance', onClick: () => setDlg({ kind: 'advance' }) },
            { label: 'Invoice', disabled: !invoiceableLines(so.lines).length, onClick: () => nav(`/accounting/invoices/add?so=${so.id}`) },
            { label: 'Return (Customer Returns)', onClick: () => nav(`/crm/customer-returns/add?so=${so.id}`), disabled: rentalOut === 0 },
            { label: 'Replacement', onClick: () => nav(`/crm/replacements/add?so=${so.id}`), disabled: rentalOut === 0 },
            ...(isRental ? [{ label: 'Cross-Hire Bill', disabled: !hasCrossHire, onClick: () => nav(`/crm/sales-orders/${so.id}/cross-hire-bill`) }] : []),
          ]} />
          <MenuButton label="View" variant="outlined" items={[{ label: 'Opportunity', onClick: () => nav(`/crm/opportunities/${so.oppId}`), disabled: !so.oppId }, { label: 'Quotation', onClick: () => nav(`/crm/quotations/${so.quoteId}`), disabled: !so.quoteId }, { label: 'Delivery Orders', onClick: () => nav('/crm/delivery-orders') }, ...(isRental ? [{ label: 'Replacement Orders', disabled: !reps.length, onClick: () => nav(`/crm/replacements?so=${so.id}`) }] : []), { label: 'Invoices', onClick: () => nav(`/accounting/invoices?so=${so.id}`) }]} />
          <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} doc="Sales Order" /><MenuButton label="Actions" variant="outlined" items={[{ label: 'Send by Email', onClick: () => setMail(true) }, { label: 'Print', onClick: () => setPrintOpen(true) }, { label: 'Close', disabled: ['Closed', 'Cancelled'].includes(so.status), onClick: () => setCloseAsk(true) }]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {lpoLeft !== undefined && lpoLeft <= LPO_NOTICE_DAYS && !['Closed', 'Cancelled'].includes(so.status) && (
          <Alert severity={lpoLeft < 0 ? 'error' : 'warning'} sx={{ mb: 2 }} action={so.activity === 'Rental' ? <Button color="inherit" size="small" onClick={() => nav(`/crm/sales-orders/${so.id}/extend`)}>Extend</Button> : undefined}>
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
            <ItemsTable lines={so.lines} header={so.activity} vatType={so.vatType} locked fleet={fleet.rows} pricing={pricing.rows} mode="order" selectable={isRental} selected={sel} onSelect={setSel} extra={{ label: 'Status', render: lineStatus, change: 'changed', req: R8('Sales Order shows allocated, returned and pending') }} rowActions={lineActions} />
            <Totals lines={so.lines} discountPct={so.discountPct} vatType={so.vatType} currency={so.currency} shipping={(so.shippingCost ?? 0) + (so.handlingCost ?? 0)} />
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>After the Sales Order: Rental, Deliver / Return. Trading and Fuel Trading, Stock / Invoice. A service charge, Charge / Invoice. AMC, Visit / Billing. Assets out: {rentalOut}. Logistics cost: {aed(so.logisticsCost)}.</Text>
          </>} />
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Traceability', change: 'new', req: R.meet, hidden: so.activity !== 'Rental', content: <Traceability so={so} quoteNo={quotes.get(so.quoteId)?.number} /> },
            { label: 'Scheduled Invoices', change: 'new', req: R.ledger, hidden: so.activity !== 'Rental', content: <OrderSchedules so={so} /> },
            { label: 'Asset Ledger', change: 'changed', req: R.ledger, hidden: so.activity !== 'Rental', content: <Ledger so={so} /> },
            { label: 'AMC Visits', change: 'new', req: R.meet, hidden: !AMC_LIKE.includes(so.activity), content: (
              <DataTable hideToolbar rows={(so.visitPlan ?? []).map((v, i) => ({ id: String(i), i, ...v }))} columns={[
                { key: 'n', label: 'Visit', render: (r) => r.i + 1 }, { key: 'date', label: 'Planned Date' }, { key: 'amount', label: 'Visit value', align: 'right', render: (r) => (jobCardsOf(so.id).find((j) => j.visitIdx === r.i)?.visitFoc ? `${aed(r.amount)} (FOC)` : aed(r.amount)) }, { key: 'done', label: 'Done On', render: (r) => r.done ?? '-' }, { key: 'ref', label: 'Reference', render: (r) => r.ref ?? '-' },
                { key: 'act', label: '', render: (r) => <Button size="small" variant="outlined" onClick={() => nav(`/crm/amc-orders/${so.id}`)}>Job Card</Button> },
              ]} />) },
            { label: 'Compliance Status', change: 'new', req: R.so, hidden: so.activity !== 'Rental', content: compliance.length ? <DataTable hideToolbar rows={compliance.flatMap((c) => (c.certs.length ? c.certs.map((x) => ({ id: x.id, asset: `${c.h.assetId} - ${c.h.name}`, type: x.type, expiry: x.expiry, status: certStatus(x).label })) : [{ id: c.h.id, asset: `${c.h.assetId} - ${c.h.name}`, type: 'No certificate on record', expiry: '-', status: '-' }]))}
              columns={[{ key: 'asset', label: 'Asset' }, { key: 'type', label: 'Certificate' }, { key: 'expiry', label: 'Expiry' }, { key: 'status', label: 'Status', render: (r) => (r.status === '-' ? '-' : <StatusChip status={r.status} />) }]} /> : <Text type="s4">No assets are out against this order.</Text> },
            { label: 'Deliveries', hidden: so.activity !== 'Rental', content: <DataTable hideToolbar rows={myDels} emptyText="No deliveries yet" onRowClick={(d) => nav(`/crm/delivery-orders/${d.id}`)} columns={[{ key: 'number', label: 'Delivery Order' }, { key: 'date', label: 'Date' }, { key: 'rentalStart', label: 'Rental Start' }, { key: 'assets', label: 'Assets', render: (d) => d.assetIds.map((h) => assetById(h)?.assetId).join(', ') }, { key: 'status', label: 'Status', render: (d) => <StatusChip status={d.status} /> }, { key: 'closed', label: 'DO Closure', change: 'new', req: R.rreturn, render: (d) => (d.closed ? 'Closed on return' : 'Open') }]} /> },
            { label: 'Replacements', change: 'new', req: R8('Replaced items and their Replacement Orders shown on the Sales Order'), hidden: !reps.length, content: <DataTable hideToolbar rows={reps} onRowClick={(r) => nav(`/crm/replacements/${r.id}`)} columns={[{ key: 'number', label: 'Replacement' }, { key: 'date', label: 'Date' }, { key: 'out', label: 'Asset Out', render: (r) => assetById(r.oldAssetId)?.assetId }, { key: 'in', label: 'Asset In', render: (r) => assetById(r.newAssetId)?.assetId }, { key: 'sub', label: 'Subcategory', render: (r) => r.category ?? so.lines.find((l) => l.id === r.lineId)?.category }, { key: 'reason', label: 'Reason' }, { key: 'do', label: 'Delivery Order', render: (r) => { const d = dels.get(r.deliveryId); return d ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); nav(`/crm/delivery-orders/${d.id}`); }}>{d.number}</Box> : '-'; } }]} /> },
            { label: 'Cross Hire', change: 'new', req: R.cross, hidden: !isRental, content: <OrderCrossHire so={so} /> },
            { label: 'Revisions', change: 'new', req: R_EXT, hidden: !(so.revisions ?? []).length, content: <DataTable hideToolbar rows={[...(so.revisions ?? [])].reverse().map((v) => ({ ...v, id: String(v.rev) }))} onRowClick={(v) => setRevView(v)} columns={[{ key: 'rev', label: 'Revision', render: (v) => `Revision ${v.rev}` }, { key: 'date', label: 'Date' }, { key: 'by', label: 'By' }, { key: 'contractEnd', label: 'Contract End', render: (v) => v.contractEnd ?? '-' }, { key: 'note', label: 'Note' }]} /> },
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
      <RevisionDialog so={so} rev={revView} onClose={() => setRevView(null)} />
      <NextStepDialog open={dlg?.kind === 'step'} onClose={() => setDlg(null)} soId={so.id} lineId={dlg?.lineId} />
      <AdvanceDialog open={dlg?.kind === 'advance'} onClose={() => setDlg(null)} soId={so.id} onDone={(l) => orders.update(so.id, { log: [l, ...so.log] })} />
      <EmailDialog open={mail} onClose={() => setMail(false)} docNo={so.number} customerId={so.customerId} onSent={(l) => orders.update(so.id, { log: [l, ...so.log] })} />
    </>
  );
}

/* ------------------------------------------------------------------ Cross-Hire Bill (8 Oct call): the supplier's bill for one period, entered by hand */
const CH_BILL_STATUSES = ['Approved', 'Received', 'Billed', 'Shipped', 'Closed'];
const BASIS: Record<string, number> = { Monthly: 30, Weekly: 7, Daily: 1 };
const nextPeriodEnd = (from: string, duration: string) => {
  const end = duration === 'Weekly' ? dayjs(from).add(6, 'day') : duration === 'Daily' ? dayjs(from) : dayjs(from).add(1, 'month').subtract(1, 'day');
  return end.isAfter(dayjs(TODAY)) ? TODAY : end.format('YYYY-MM-DD');
};
type BillRow = { id: string; assetId?: string; group: string; category: string; brand: string; model: string; rate: number; qty: number };

export function SalesOrderCrossHireBill() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const so = useOrders().get(id);
  const hires = useCrossHire().rows;
  useBills();
  const eligible = so ? hires.filter((c) => (c.soId === so.id || unitsOf(c).some((u) => u.soId === so.id)) && CH_BILL_STATUSES.includes(c.status ?? 'Approved') && c.billing !== 'Fully Billed') : [];
  /** Day after the last period already billed for the order, else the order's start; the period runs one billing duration of the order, up to today. */
  const periodFor = (chId: string) => {
    const c = hires.find((x) => x.id === chId);
    if (!c) return { from: '', to: '' };
    const last = billsOfSource('Cross Hire', c.id).flatMap((b) => b.lines.map((l) => l.periodTo ?? '')).filter(Boolean).sort().pop();
    const from = last ? dayjs(last).add(1, 'day').format('YYYY-MM-DD') : (c.startDate ?? TODAY);
    return { from, to: nextPeriodEnd(from, c.form?.duration ?? 'Monthly') };
  };
  const first = eligible.find((c) => c.id === sp.get('ch')) ?? (eligible.length === 1 ? eligible[0] : undefined);
  const [f, setF] = useState<Record<string, any>>(() => ({ chId: first?.id ?? '', supplierInvoiceNo: '', supplierInvoiceDate: TODAY, billType: 'Periodic', ...(first ? periodFor(first.id) : { from: '', to: '' }) }));
  const [sel, setSel] = useState<string[] | null>(null);
  const [dayOver, setDayOver] = useState<Record<string, number>>({});
  const [amtOver, setAmtOver] = useState<Record<string, number>>({});
  const [exp, setExp] = useState<boolean | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const clearAssets = () => setErr((e) => (e.assets ? { ...e, assets: '' } : e));
  if (!so) return <Page><PageTitle title="Sales Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/sales-orders')}>Back</Button>} /></Page>;
  const c = hires.find((x) => x.id === f.chId);
  const set = (k: string, v: any) => {
    setErr((e) => ({ ...e, [k]: '' }));
    if (k === 'chId') { setF((x) => ({ ...x, chId: v, ...periodFor(v) })); setSel(null); setDayOver({}); setAmtOver({}); setExp(null); return; }
    if (k === 'from' || k === 'to') { setDayOver({}); setAmtOver({}); }
    setF((x) => ({ ...x, [k]: v }));
  };
  const duration: string = c?.form?.duration ?? 'Monthly';
  const unit = duration === 'Weekly' ? 'week' : duration === 'Daily' ? 'day' : 'month';
  const basis = BASIS[duration] ?? 30;
  const dropship = c?.type === 'Dropship';
  const rows: BillRow[] = !c ? [] : dropship
    ? chItems(c).map((i) => ({ id: i.id, group: i.group, category: i.category, brand: '', model: '', rate: i.rate, qty: i.qty }))
    : unitsOf(c).filter((u) => u.soId === so.id).map((u) => { const h = assetById(u.assetId); return { id: u.assetId, assetId: u.assetId, group: h?.category ?? c.group, category: h?.subCategory ?? c.category, brand: h?.brand ?? '', model: h?.model ?? '', rate: chItemRate(c, h?.category, h?.subCategory), qty: 1 }; });
  const selIds = sel ?? rows.map((r) => r.id);
  const span = f.from && f.to ? Math.max(0, dayjs(f.to).diff(dayjs(f.from), 'day') + 1) : 0;
  const daysOf = (r: BillRow) => dayOver[r.id] ?? span;
  const amountOf = (r: BillRow) => amtOver[r.id] ?? Math.round((r.rate * r.qty * daysOf(r) * 100) / basis) / 100;
  const chosen = rows.filter((r) => selIds.includes(r.id));
  const total = chosen.reduce((n, r) => n + amountOf(r), 0);
  const hasBill = !!c && billsOfSource('Cross Hire', c.id).length > 0;
  const withExp = exp ?? !hasBill;
  const expTotal = (c?.expenses ?? []).reduce((n, e) => n + e.amount, 0);
  const specs: Spec[] = [
    { key: 'soNumber', label: 'Sales Order', type: 'readonly' }, { key: 'project', label: 'Project (Cost Centre)', type: 'readonly' },
    { key: 'chId', label: 'Cross Hire Order', type: 'select', required: true, options: eligible.map((x) => ({ value: x.id, label: `${x.number} - ${x.supplier}` })), hint: 'Orders of this Sales Order that are not Fully Billed yet' },
    { key: 'supplier', label: 'Supplier', type: 'readonly' },
    { key: 'supplierInvoiceNo', label: 'Supplier Invoice Number', required: true }, { key: 'supplierInvoiceDate', label: 'Supplier Invoice Date', type: 'date', required: true },
    { key: 'billType', label: 'Bill Type', type: 'select', required: true, options: ['Periodic', 'Final'], hint: 'Final marks the order Fully Billed' },
    { key: 'from', label: 'Billing Period From', type: 'date', required: true }, { key: 'to', label: 'Billing Period To', type: 'date', required: true },
  ];
  const save = () => {
    const e: Record<string, string> = {};
    ['chId', 'supplierInvoiceNo', 'supplierInvoiceDate', 'billType', 'from', 'to'].forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    if (f.from && f.to && f.to < f.from) e.to = 'Period end must not be before its start';
    if (c && !chosen.length) e.assets = 'Select at least one cross-hired asset';
    else if (chosen.some((r) => !(daysOf(r) > 0) || !(amountOf(r) > 0))) e.assets = 'Every selected asset needs its days and an amount';
    setErr(e);
    if (Object.keys(e).length || !c) { toast('Please complete the mandatory fields', 'error'); return; }
    const b = billCrossHireFromOrder({ chId: c.id, soId: so.id, supplierInvoiceNo: f.supplierInvoiceNo.trim(), supplierInvoiceDate: f.supplierInvoiceDate, from: f.from, to: f.to, final: f.billType === 'Final',
      lines: chosen.map((r) => ({ assetId: r.assetId, group: r.group, category: r.category, days: daysOf(r), rate: r.rate, amount: amountOf(r) })), expenses: withExp ? (c.expenses ?? []) : [] });
    toast(`${b.number} created, pending approval`);
    nav(`/accounting/bills/${b.id}`);
  };
  const view = { ...f, soNumber: so.number, project: so.costCentre || '-', supplier: c?.supplier ?? '-' };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Sales Orders', to: '/crm/sales-orders' }, { label: so.number, to: `/crm/sales-orders/${so.id}` }, { label: 'Cross-Hire Bill' }]}
        actions={<><Button variant="text" onClick={() => nav(`/crm/sales-orders/${so.id}`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Enter the supplier's bill when it arrives. There is no schedule and nothing is raised automatically.</Alert>
        {!eligible.length && <Alert severity="warning" sx={{ mb: 2 }}>This Sales Order has no cross-hire order waiting for a bill (an order must be approved and not Fully Billed).</Alert>}
        <Section title="Bill details" change="new" req={R_BILL}><SpecForm specs={specs} f={view} set={set} err={err} /></Section>
        <Section title="Cross-hired assets" change="new" req={R_BILL} hint={`Only the assets cross-hired for this order. Agreed rate is per ${unit}; the amount is rate x days / ${basis} and can be edited`}>
          <FieldError label="Cross-hired assets" error={err.assets} />
          <DataTable<BillRow> hideToolbar pageSize={50} rows={rows} selectable selected={selIds} onSelect={(v) => { clearAssets(); setSel(v); }} emptyText={c ? 'No unit of this order has been delivered on this Sales Order' : 'Choose the Cross Hire Order'}
            columns={[
              { key: 'a', label: 'Asset ID', render: (r) => (r.assetId ? assetById(r.assetId)?.assetId ?? '-' : `Dropship, ${r.qty} unit(s)`) }, { key: 'g', label: 'Category', render: (r) => r.group }, { key: 'c', label: 'Subcategory', render: (r) => r.category },
              { key: 'b', label: 'Brand', render: (r) => r.brand || '-' }, { key: 'm', label: 'Model', render: (r) => r.model || '-' },
              { key: 'r', label: `Agreed Rate (per ${unit})`, align: 'right', render: (r) => aed(r.rate) },
              { key: 'd', label: 'Days', render: (r) => <TextField size="small" type="number" value={daysOf(r)} onChange={(e) => { clearAssets(); setDayOver({ ...dayOver, [r.id]: Number(e.target.value) }); }} sx={{ width: 90 }} inputProps={{ min: 0 }} /> },
              { key: 'am', label: 'Amount (AED)', render: (r) => <TextField size="small" type="number" value={amountOf(r)} onChange={(e) => { clearAssets(); setAmtOver({ ...amtOver, [r.id]: Number(e.target.value) }); }} sx={{ width: 130 }} inputProps={{ min: 0, step: 'any' }} /> },
            ]} />
          <Text type="s4" weight="medium" sx={{ mt: 1.5 }}>Total before VAT: {aed(total + (withExp ? expTotal : 0))}</Text>
        </Section>
        <Section title="Expenses" change="new" req={R_BILL}>
          <CheckInput label={`Add this order's expenses (${aed(expTotal)}) to this bill`} checked={withExp} disabled={!expTotal} onChange={setExp} hint={hasBill ? 'A bill already exists for this order, so the expenses are not added again by default' : undefined} />
        </Section>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Extend (8 Oct call): extension is a revision of the same Sales Order */

export function SalesOrderExtend() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const quotes = useQuotes();
  const opps = useOpps();
  const so = orders.get(id);
  const [ends, setEnds] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [f, setF] = useState<Record<string, any>>({ by: '', lpo: '', lpoExpiry: '', note: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const clearGrid = () => setErr((e) => (e.grid ? { ...e, grid: '' } : e));
  if (!so) return <Page><PageTitle title="Sales Order not found" right={<Button variant="outlined" onClick={() => nav('/crm/sales-orders')}>Back</Button>} /></Page>;
  const rows = so.lines.filter((l) => l.activity === 'Rental' || (l.activity === 'Service' && l.billing === 'Recurring'));
  const outOf = (l: Line) => (l.activity === 'Rental' ? outstanding(l).length : 0);
  const rental = rows.filter((l) => l.activity === 'Rental' && outOf(l) > 0);
  const curEnd = (l: Line) => l.end ?? so.contractEnd ?? '';
  const contractNewEnd = rental.map((l) => ends[l.id] ?? '').filter(Boolean).sort().pop() ?? '';
  /** A recurring service line follows the new contract end unless it is given its own. */
  const endOf = (l: Line) => (l.activity === 'Rental' ? ends[l.id] ?? '' : ends[l.id] ?? contractNewEnd);
  const priceOf = (l: Line) => (prices[l.id] === undefined || prices[l.id] === '' ? l.price : Number(prices[l.id]));
  const rateChanged = rows.some((l) => (l.activity !== 'Rental' || outOf(l) > 0) && priceOf(l) !== l.price);
  const set = (k: string, v: any) => { setErr((e) => ({ ...e, [k]: '' })); setF((x) => ({ ...x, [k]: v })); };
  const save = () => {
    const e: Record<string, string> = {};
    if (!rental.length) e.grid = 'Nothing is on hire on this order, so there is nothing to extend';
    else if (rental.some((l) => !endOf(l) || endOf(l) <= curEnd(l))) e.grid = 'Every line with units still out needs a New End after its Current End';
    else if (rows.some((l) => (l.activity !== 'Rental' || outOf(l) > 0) && !(priceOf(l) >= 0))) e.grid = 'A New Rate cannot be negative';
    if (!f.by.trim()) e.by = 'This field is required';
    if (rateChanged && !f.note.trim()) e.note = 'A note is required when a rate changes';
    if (f.lpoExpiry && contractNewEnd && f.lpoExpiry < contractNewEnd) e.lpoExpiry = 'The LPO expiry should not be before the new contract end';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const lines = rows.filter((l) => l.activity !== 'Rental' || outOf(l) > 0).map((l) => ({ lineId: l.id, newEnd: endOf(l) && endOf(l) > curEnd(l) ? endOf(l) : undefined, newPrice: priceOf(l) !== l.price ? priceOf(l) : undefined }));
    const x = extendOrder({ soId: so.id, lines, lpo: f.lpo.trim() || undefined, lpoExpiry: f.lpoExpiry || undefined, confirmedBy: f.by.trim(), note: f.note.trim() });
    toast(`Revision ${x.revision} saved. ${so.number} now ends on ${x.newEnd}`);
    nav(`/crm/sales-orders/${so.id}`);
  };
  const specs: Spec[] = [
    { key: 'newEnd', label: 'New Contract End', type: 'readonly', change: 'new', req: R_EXT, value: () => contractNewEnd || '-', hint: 'The latest New End of the lines that are still out' },
    { key: 'by', label: 'Client confirmed by', required: true, change: 'new', req: R_EXT },
    { key: 'lpo', label: 'New LPO Number', change: 'new', req: R_EXT, hint: 'Optional' }, { key: 'lpoExpiry', label: 'LPO Expiry', type: 'date', change: 'new', req: R_EXT, hint: 'Optional. When empty the LPO expiry moves to the new contract end if it is earlier' },
    { key: 'note', label: 'Note', type: 'textarea', required: rateChanged, change: 'new', req: R_EXT, hint: 'Required when a rate changes' },
  ];
  return (
    <>
      <FormHeader crumbs={[{ label: 'Sales Orders', to: '/crm/sales-orders' }, { label: so.number, to: `/crm/sales-orders/${so.id}` }, { label: 'Extend' }]}
        actions={<><Button variant="text" onClick={() => nav(`/crm/sales-orders/${so.id}`)}>Discard</Button><Button variant="contained" onClick={save}>Save Revision</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Extension revises this Sales Order (Revision {(so.revision ?? 0) + 1}). The current version is kept under Revisions. Only the lines that still have units out are extended; returned units stay returned.</Alert>
        <CommercialTabs kind="order" f={soForm(so, opps.get(so.oppId)?.number, quotes.get(so.quoteId)?.number)} set={() => undefined} locked
          items={<>
            <Section title="Extension" change="new" req={R_EXT}>
              <FieldError label="Extension" error={err.grid} />
              <TableContainer sx={{ border: '1px solid #EEEFF1', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead><TableRow sx={{ bgcolor: '#FBFBFB' }}>{['Item', 'Category', 'Subcategory', 'Units out', 'Current End', 'New End', 'Current Rate', 'New Rate', 'Frequency'].map((h) => <TableCell key={h} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{h}{h === 'New Rate' && <HelpTip hint={`Applies to the extension period only, from the day after the current end. ${TO_CONFIRM}`} />}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {rows.length === 0 && <TableRow><TableCell colSpan={9}><Text type="s4" color="theme.secondary.700">This order has no rental or recurring service line.</Text></TableCell></TableRow>}
                    {rows.map((l) => {
                      const out = outOf(l);
                      const live = l.activity !== 'Rental' || out > 0;
                      return (
                        <TableRow key={l.id}>
                          <TableCell sx={{ fontSize: 13 }}>{l.item}</TableCell><TableCell sx={{ fontSize: 13 }}>{l.group ?? '-'}</TableCell><TableCell sx={{ fontSize: 13 }}>{l.category ?? '-'}</TableCell>
                          <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>{l.activity === 'Rental' ? `${out} of ${l.qty} still out` : '-'}</TableCell>
                          <TableCell sx={{ fontSize: 13 }}>{curEnd(l) || '-'}</TableCell>
                          <TableCell sx={{ py: 0.5, minWidth: 170 }}>{live ? <TextField size="small" type="date" value={endOf(l)} onChange={(e) => { clearGrid(); setEnds({ ...ends, [l.id]: e.target.value }); }} InputLabelProps={{ shrink: true }} /> : <Text type="s5" color="theme.secondary.700">Not extended, nothing on hire</Text>}</TableCell>
                          <TableCell sx={{ fontSize: 13 }} align="right">{aed(l.price)}</TableCell>
                          <TableCell sx={{ py: 0.5 }} align="right">{live ? <TextField size="small" type="number" value={prices[l.id] ?? l.price} onChange={(e) => { clearGrid(); setPrices({ ...prices, [l.id]: e.target.value }); }} sx={{ width: 120 }} inputProps={{ min: 0, step: 'any' }} /> : '-'}</TableCell>
                          <TableCell sx={{ fontSize: 13 }}>{l.frequency ?? '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>New Rate applies to the extension period only, from the day after the current end; the periods before keep their rate. {TO_CONFIRM}.</Text>
              <Box sx={{ mt: 2 }}><SpecForm specs={specs} f={f} set={set} err={err} cols={2} /></Box>
            </Section>
          </>} />
      </Page>
    </>
  );
}

/** An earlier version of the order next to the current values; what changed is in bold. */
function RevisionDialog({ so, rev, onClose }: { so: SalesOrder; rev: OrderRevision | null; onClose: () => void }) {
  if (!rev) return null;
  const rows = rev.lines.map((l) => ({ id: l.id, then: l, now: so.lines.find((x) => x.id === l.id) }));
  const b = (changed: boolean, v: React.ReactNode) => <Text type="s4" weight={changed ? 'bold' : 'normal'} component="span">{v}</Text>;
  return (
    <AppDialog open title={`Revision ${rev.rev} of ${so.number}`} onClose={onClose} maxWidth="md">
      <Text type="s4" sx={{ mb: 1 }}>Saved {rev.date} by {rev.by}. {rev.note}</Text>
      <ValueGrid cols={3}>
        <ValueField label="Contract End" value={<>{b(rev.contractEnd !== so.contractEnd, rev.contractEnd ?? '-')} (now {so.contractEnd ?? '-'})</>} />
        <ValueField label="LPO" value={<>{b(rev.lpo !== so.lpo, rev.lpo ?? '-')} (now {so.lpo || '-'})</>} />
        <ValueField label="LPO Expiry" value={<>{b(rev.lpoExpiry !== so.lpoExpiry, rev.lpoExpiry ?? '-')} (now {so.lpoExpiry || '-'})</>} />
      </ValueGrid>
      <Box sx={{ mt: 2 }}>
        <DataTable hideToolbar rows={rows} columns={[
          { key: 'item', label: 'Item', render: (r) => r.then.item },
          { key: 'end', label: 'End then', render: (r) => b(r.then.end !== r.now?.end, r.then.end ?? '-') }, { key: 'endNow', label: 'End now', render: (r) => r.now?.end ?? '-' },
          { key: 'rate', label: 'Rate then', align: 'right', render: (r) => b(r.then.price !== r.now?.price, aed(r.then.price)) }, { key: 'rateNow', label: 'Rate now', align: 'right', render: (r) => (r.now ? aed(r.now.price) : '-') },
        ]} />
      </Box>
    </AppDialog>
  );
}
