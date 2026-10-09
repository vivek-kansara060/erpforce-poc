import dayjs from 'dayjs';
import { getCollection, nextNumber, seedCollection, setCollection } from '@/store/store';
import { customers } from '@/mock-data/masters';
import { currentLocation, heavySeed, itemSeed, locationStockSeed, type ItemRec, type LocationStock } from '@/modules/inventory/data';
import { billCrossHirePeriod, billDisputeCharge, invoiceAdditionalCharge, billFromCrossHire, billTripCharge, postDeliveryExpense, postTripExpense, reverseJournal, voidTripBill, invoiceFromDamage, invoiceAccumulated, invoiceFromJobCard, invoiceFromOrderLines, invoiceRentalPeriod } from '@/modules/accounting/engine';
import {
  ACTOR, COL, TODAY, vanLocationsFor, assetById, availability, custName, fleetRows, isRentalLine, log, mkLine, nowStamp, patchAsset,
  AMC_LIKE, amcLine, docTotals, expenseGross, hasWaiver, isPeriodic, masterValues, planVisits, plusYear, yearEnd, type ActivityType, TRIP_SEED_N, vehicleFreeOn, isOpenTrip, tripTotal, type Trip, type TripExpense, type TripKind,
  type AdditionalCharge, type ReplacementOutcome, type ReturnItem, type ReturnGrn, type ReturnGrnItem, type CrossHireReqItem, reqItems, chItems, type CrossHire, type CrossUnit, unitsOf, type CrossHireGrn, type RfqItem, type CrossHireRequest, type CrossHireRfq, type RfqResponse, type Delivery, type DoItem, type JobCard, type Extension, type HeavyRec, type Lead, type Line, type LogItem, type Opportunity, type Quotation, type Replacement, type ReturnEntry, type SalesOrder,
} from './data';

/* Small collection helpers (modules share the same in-memory collections through the store). */
const all = <T,>(name: string) => getCollection<T>(name);
const put = <T extends { id: string }>(name: string, row: T) => setCollection(name, [row, ...all<T>(name)]);
const patch = <T extends { id: string }>(name: string, id: string, fn: (r: T) => T) => setCollection(name, all<T>(name).map((r) => (r.id === id ? fn(r) : r)));
/** The order follows its units: stage is the earliest unit, receiving counts assets against the units ordered, the order closes when every unit is back with the supplier. */
function syncUnits(c: CrossHire, units: CrossUnit[]): CrossHire {
  const n = c.qty ?? 1;
  const stage = units.length ? Math.min(...units.map((u) => u.stage)) : c.stage;
  const closed = units.length >= n && units.every((u) => u.stage >= 4);
  const disputes = units.reduce((t, u) => t + (u.dispute ?? 0), 0);
  return { ...c, units, stage, assetId: units[0]?.assetId ?? c.assetId, dispute: disputes || undefined, condition: [...units].reverse().find((u) => u.condition)?.condition ?? c.condition, reissueRef: [...units].reverse().find((u) => u.reissueRef)?.reissueRef ?? c.reissueRef,
    receiving: units.length >= n ? 'Fully Received' : units.length ? 'Partially Received' : c.receiving,
    status: closed ? 'Closed' : units.length && ['Approved', 'Received', 'Billed'].includes(c.status ?? '') ? (c.billing === 'Fully Billed' ? 'Billed' : 'Received') : c.status };
}
const patchUnit = (chId: string, assetId: string | undefined, fn: (u: CrossUnit) => CrossUnit, entry?: LogItem, extra?: Partial<CrossHire>) =>
  patch<CrossHire>(COL.crossHire, chId, (c) => syncUnits({ ...c, ...extra, history: entry ? [...c.history, entry] : c.history }, unitsOf(c).map((u) => (u.assetId === assetId ? fn(u) : u))));
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Where an asset is right now (the last Movement History entry), so a new movement starts from the real place. */
const whereIs = (assetId: string, fallback = 'Jebel Ali Main Yard') => { const a = assetById(assetId); const at = a ? currentLocation(a) : '-'; return at && at !== '-' ? at : fallback; };

export const getOrder = (id?: string) => all<SalesOrder>(COL.orders).find((o) => o.id === id);
export const getLine = (so: SalesOrder | undefined, lineId?: string) => so?.lines.find((l) => l.id === lineId);

/* ------------------------------------------------------------------ line state helpers */
export const deliveredQty = (l: Line) => l.assigned.filter((a) => a.state !== 'Replaced').length;
export const outstanding = (l: Line) => l.assigned.filter((a) => a.state === 'On Hire' || a.state === 'Hold');
export const lineState = (l: Line): string => {
  if (l.activity === 'Fixed Asset Trading') return deliveredQty(l) >= l.qty ? 'Sold and delivered' : 'Pending Delivery';
  if (l.activity === 'Rental') {
    if (outstanding(l).some((a) => a.state === 'Hold')) return 'On Hold';
    if (outstanding(l).length) return deliveredQty(l) >= l.qty ? (outstanding(l).some((a) => a.extendedTo) ? 'Extended' : 'On Hire') : 'Partially Delivered';
    if (l.assigned.some((a) => a.state === 'Returned')) return 'Returned';
    return 'Pending Delivery';
  }
  return l.fulfilment ?? 'Pending';
};
/** Sales Order status follows its lines. AMC visits and Service charge lines on a Rental order are not deliveries and do not drive it. */
export function recalcStatus(so: SalesOrder): string {
  if (['Draft', 'Pending', 'Closed', 'Cancelled', 'Rejected'].includes(so.status)) return so.status;
  const lines = so.lines.filter((l) => l.activity !== 'AMC' && l.activity !== 'Service');
  const asset = (l: Line) => l.activity === 'Rental' || l.activity === 'Fixed Asset Trading';
  const done = (l: Line) => (asset(l) ? deliveredQty(l) >= l.qty : !!l.fulfilment);
  const any = lines.some((l) => (asset(l) ? deliveredQty(l) > 0 : !!l.fulfilment));
  if (!any) return 'Confirmed';
  return lines.every(done) ? 'Fully Delivered' : 'Partially Delivered';
}
function saveOrder(id: string, fn: (o: SalesOrder) => SalesOrder) {
  patch<SalesOrder>(COL.orders, id, (o) => { const n = fn(o); return { ...n, status: recalcStatus(n) }; });
}
const addLog = (soId: string, item: LogItem) => saveOrder(soId, (o) => ({ ...o, log: [item, ...o.log] }));
const mapLine = (o: SalesOrder, lineId: string, fn: (l: Line) => Line): SalesOrder => ({ ...o, lines: o.lines.map((l) => (l.id === lineId ? fn(l) : l)) });
export const days = (a: string, b: string = TODAY) => dayjs(b).diff(dayjs(a), 'day');

/* ------------------------------------------------------------------ Master sales flow */
export function convertLead(l: Lead): { ok: boolean; message: string; id?: string } {
  if (!l.activity) return { ok: false, message: 'An Activity Type is required before a Lead can be converted' };
  if (l.opportunityId) return { ok: false, message: 'A Lead converts into exactly one Opportunity and this one is already converted' };
  const customer = customers.find((c) => c.name === l.company);
  const id = uid('op');
  const opp: Opportunity = {
    id, number: nextNumber('OP', 48), date: TODAY, customerId: customer?.id ?? 'c1', contact: l.contact, project: '', owner: l.owner, title: `${l.activity}: ${l.company}`, activity: l.activity, stage: 'Enquiry', rating: 'Warm',
    lines: [], estimated: 0, probability: l.probability ?? 30, expectedClose: dayjs(TODAY).add(30, 'day').format('YYYY-MM-DD'), leadId: l.id, approvalRequired: false, source: l.source,
  };
  put(COL.opps, opp);
  patch<Lead>(COL.leads, l.id, (x) => ({ ...x, status: 'Converted', opportunityId: id, comms: [{ when: nowStamp(), title: `Converted to Opportunity ${opp.number}`, by: ACTOR }, ...x.comms] }));
  return { ok: true, message: `Opportunity ${opp.number} created with Customer, Contact and Activity Type carried forward`, id };
}

/** Opportunity duplicate check (decision 3): Title, Project, Customer and Contact Person all the same. */
export function duplicateOpportunity(o: Pick<Opportunity, 'id' | 'title' | 'project' | 'customerId' | 'contact'>): Opportunity | undefined {
  const n = (s?: string) => (s ?? '').trim().toLowerCase();
  return all<Opportunity>(COL.opps).find((x) => x.id !== o.id && n(x.title) === n(o.title) && n(x.project) === n(o.project) && x.customerId === o.customerId && n(x.contact) === n(o.contact));
}

export function quoteFromOpportunity(o: Opportunity): string {
  const id = uid('qt');
  const act = o.activity as ActivityType;
  const end = yearEnd();
  const lines = o.lines.length
    ? o.lines.map((l) => ({ ...l, id: uid('ln'), assigned: [], crossHire: [], ...(l.activity === 'Rental' ? { frequency: 'Monthly', start: TODAY, end, item: `Rental ${l.group} ${l.category} Monthly`, desc: l.desc || l.item } : {}) }))
    : [act === 'Rental' ? mkLine({ activity: 'Rental', item: '', group: 'Generator', frequency: 'Monthly', start: TODAY, end }) : act === 'AMC' ? amcLine(o.estimated || 0) : act === 'Service' ? mkLine({ activity: 'Service', item: '' }) : mkLine({ activity: act, item: '' })];
  const quote: Quotation = {
    id, number: nextNumber('QT', 108), date: TODAY, oppId: o.id, customerId: o.customerId, activity: act, entity: masterValues('entity')[0], paymentTerms: '30 days', currency: 'AED',
    contractType: act === 'Rental' ? 'Open PO' : undefined, contractStart: act === 'Rental' ? TODAY : undefined, contractEnd: act === 'Rental' ? end : undefined,
    amcStart: AMC_LIKE.includes(act) ? TODAY : undefined, amcEnd: AMC_LIKE.includes(act) ? plusYear(TODAY) : undefined, visits: act === 'AMC' ? 4 : undefined, amcValue: AMC_LIKE.includes(act) ? o.estimated || 0 : undefined,
    description: o.title, validUntil: dayjs(TODAY).add(30, 'day').format('YYYY-MM-DD'), status: 'Draft', version: 1,
    preparedBy: o.owner, designation: 'Sales Representative', mobile: '+971 50 400 1101', email: 'sales@gulfpowerrentals.ae', template: '',
    terms: 'Payment: as per the payment terms from invoice date. Fuel is not included in the rental rate and is billed separately.', vatType: 'Standard (With VAT)', discountPct: 0, lines, pushToOpp: false,
    log: [log('Quotation created', `From Opportunity ${o.number}`)],
  };
  put(COL.quotes, quote);
  patch<Opportunity>(COL.opps, o.id, (x) => ({ ...x, quotationId: id, stage: 'Quoted' }));
  return id;
}

export function reviseQuotation(q: Quotation): string {
  const id = uid('qt');
  put(COL.quotes, { ...q, id, number: nextNumber('QT', 108), version: q.version + 1, prevId: q.id, status: 'Draft', date: TODAY, salesOrderId: undefined, log: [log(`Revision ${q.version + 1} created`, `From ${q.number}; previous version retained in full`)] });
  patch<Quotation>(COL.quotes, q.id, (x) => ({ ...x, status: 'Revised', log: [log('Superseded by a revision'), ...x.log] }));
  patch<Opportunity>(COL.opps, q.oppId, (x) => ({ ...x, quotationId: id }));
  return id;
}

export function orderFromQuotation(q: Quotation): string {
  const id = uid('so');
  const opp = all<Opportunity>(COL.opps).find((o) => o.id === q.oppId);
  const order: SalesOrder = {
    id, number: nextNumber('SO', 88), date: TODAY, quoteId: q.id, oppId: q.oppId, customerId: q.customerId, owner: opp?.owner ?? q.preparedBy, title: opp?.title ?? q.description, reference: opp?.lpo ?? '', status: 'Confirmed',
    activity: q.activity, entity: q.entity, paymentTerms: q.paymentTerms, currency: q.currency, contractType: q.contractType, contractStart: q.contractStart, contractEnd: q.contractEnd, billingStructure: q.billingStructure,
    amcStart: q.amcStart, amcEnd: q.amcEnd, visits: q.visits, amcScope: q.amcScope, amcValue: AMC_LIKE.includes(q.activity) ? docTotals(q.lines, q.discountPct, q.vatType).sub : undefined,
    visitPlan: AMC_LIKE.includes(q.activity) ? planVisits(q.amcStart, q.amcEnd, q.visits, docTotals(q.lines, q.discountPct, q.vatType).sub) : undefined,
    lpo: '', lpoDate: '', lpoExpiry: q.contractEnd ?? q.amcEnd ?? '', site: opp?.site ?? '', costCentre: q.costCentre ?? '', deliveryMethod: 'Own Fleet', vatType: q.vatType, discountPct: q.discountPct, terms: q.terms,
    lines: q.lines.map((l) => ({ ...l, id: uid('ln'), assigned: [], crossHire: [], fulfilment: undefined })), docs: [], damageCharges: [], logisticsCost: 0, ...(q.activity === 'Rental' ? { billingCycle: 'Monthly', invoicingType: 'Automatic' } : {}),
    log: [log(`Sales Order created from ${q.number}`, 'Commercial terms are frozen; only a formal revision can change them')],
  };
  put(COL.orders, order);
  patch<Quotation>(COL.quotes, q.id, (x) => ({ ...x, status: 'Converted to Sales Order', salesOrderId: id, log: [log(`Converted to ${order.number}`), ...x.log] }));
  patch<Opportunity>(COL.opps, q.oppId, (x) => ({ ...x, stage: 'Won' }));
  return id;
}

/** Next step per line kind after the Sales Order: Trading/Fuel Trading -> Stock/Invoice, a Service charge -> Charge/Invoice, AMC -> Visit/Billing. */
export const NEXT_STEP: Record<string, { label: string; done: string; options?: string[] }> = {
  Trading: { label: 'Issue Stock / Invoice', done: 'Stock issued and invoiced' },
  'Fuel Trading': { label: 'Issue Stock / Invoice', done: 'Fuel issued and invoiced' },
  Service: { label: 'Charge / Invoice', done: 'Charged and invoiced' },
  AMC: { label: 'Record Visit / Billing', done: 'Visit recorded', options: ['Scheduled visit (non-chargeable)', 'Consumable (chargeable)', 'Additional task (chargeable)'] },
  Other: { label: 'Charge / Invoice', done: 'Charged and invoiced' },
  Rental: { label: 'Charge / Invoice', done: 'Charged and invoiced' },
  'Fixed Asset Trading': { label: 'Invoice', done: 'Asset sale invoiced' },
};
/** Invoice step of a non-rental line: a real sales invoice in Accounting, created Pending (decision D4). Returns the invoice number. */
export function fulfilLine(soId: string, lineId: string, detail?: string): string {
  return invoiceOrderLines(soId, [lineId], detail) ?? '';
}
/** One sales invoice for several Sales Order lines (Create, Invoice). Each line is marked with its next-step state and the invoice number. */
export function invoiceOrderLines(soId: string, lineIds: string[], detail?: string): string | undefined {
  const o = getOrder(soId);
  if (!o) return undefined;
  const inv = invoiceFromOrderLines(soId, lineIds);
  if (!inv) return undefined;
  const ls = o.lines.filter((l) => lineIds.includes(l.id));
  saveOrder(soId, (x) => ({
    ...x, lines: x.lines.map((ln) => (lineIds.includes(ln.id) ? { ...ln, fulfilment: (NEXT_STEP[ln.activity] ?? NEXT_STEP.Service).done, fulfilmentRef: inv.number } : ln)),
    log: [log(`Invoice ${inv.number} raised, pending approval`, `${ls.map((l) => l.item).join(', ')}${detail ? ` (${detail})` : ''}`, 'blue'), ...x.log],
  }));
  return inv.number;
}
/** An invoice typed on the Accounting invoice form from a Sales Order: its lines are marked invoiced on the order. */
export function linkOrderLinesToInvoice(soId: string, lineIds: string[], inv: { number: string }) {
  const o = getOrder(soId);
  if (!o) return;
  const ls = o.lines.filter((l) => lineIds.includes(l.id));
  saveOrder(soId, (x) => ({
    ...x, lines: x.lines.map((ln) => (lineIds.includes(ln.id) ? { ...ln, fulfilment: (NEXT_STEP[ln.activity] ?? NEXT_STEP.Service).done, fulfilmentRef: inv.number } : ln)),
    log: [log(`Invoice ${inv.number} raised, pending approval`, ls.map((l) => l.item).join(', '), 'blue'), ...x.log],
  }));
}
/** A bill typed on the Accounting bill form from a Cross Hire Order: the order records the supplier invoice and is Billed. */
export function linkCrossHireBill(chId: string, bill: { number: string; supplierInvoiceNo: string }) {
  patch<CrossHire>(COL.crossHire, chId, (c) => ({ ...c, supplierInvoice: bill.supplierInvoiceNo || c.supplierInvoice, billing: 'Fully Billed', status: c.stage >= 1 && c.status === 'Received' ? 'Billed' : c.status,
    history: [...c.history, log(`Bill ${bill.number} raised`, `Supplier invoice ${bill.supplierInvoiceNo || 'not entered yet'}. Pending approval in Accounting`, 'blue')] }));
}
/** Rental run (Rental > Invoicing Rental Order): one invoice for the period; first and final one-time services are marked invoiced on the order. */
export function runRentalInvoice(soId: string, from: string, to: string): { number?: string; invoiceId?: string; message: string } {
  const r = invoiceRentalPeriod(soId, from, to);
  if (!r.invoice) return { message: r.message };
  const inv = r.invoice;
  saveOrder(soId, (x) => ({
    ...x, lines: x.lines.map((ln) => (r.oneTimeLineIds.includes(ln.id) ? { ...ln, fulfilment: NEXT_STEP.Service.done, fulfilmentRef: inv.number } : ln)),
    log: [log(`Rental invoice ${inv.number} raised, pending approval`, `Billing period ${from} to ${to}`, 'blue'), ...x.log],
  }));
  return { number: inv.number, invoiceId: inv.id, message: r.message };
}
/** Accumulate Orders: one invoice for the due periods of several orders; the one-time charges billed on it are marked on each order. */
export function runAccumulatedRental(items: { soId: string; from: string; to: string }[], title: string): { number?: string; invoiceId?: string; message: string } {
  const r = invoiceAccumulated(items, title);
  if (!r.invoice) return { message: r.message };
  const inv = r.invoice;
  Object.entries(r.oneTime).forEach(([soId, ids]) => saveOrder(soId, (x) => ({
    ...x, lines: x.lines.map((ln) => (ids.includes(ln.id) ? { ...ln, fulfilment: NEXT_STEP.Service.done, fulfilmentRef: inv.number } : ln)),
    log: [log(`Rental invoice ${inv.number} raised on an accumulated invoice, pending approval`, `${title}`, 'blue'), ...x.log],
  })));
  return { number: inv.number, invoiceId: inv.id, message: r.message };
}
/** Damage or failed-collection charge on the order: its own sales invoice (blocked when a damage waiver was paid). */
export function invoiceDamage(soId: string, idx: number): { ok: boolean; message: string; invoiceId?: string } {
  const existing = getOrder(soId)?.damageCharges[idx]?.invoiceId;
  if (existing) return { ok: false, message: 'This charge is already invoiced', invoiceId: existing };
  const r = invoiceFromDamage(soId, idx);
  if (!r.ok || !r.invoice) return { ok: false, message: r.message };
  const inv = r.invoice;
  saveOrder(soId, (x) => ({ ...x, damageCharges: x.damageCharges.map((c, k) => (k === idx ? { ...c, invoiceId: inv.id } : c)), log: [log(`Charge invoiced: ${inv.number}`, 'Pending approval in Accounting', 'blue'), ...x.log] }));
  return { ok: true, message: `${inv.number} raised, pending approval in Accounting`, invoiceId: inv.id };
}

/* ------------------------------------------------------------------ Rental: delivery */
export interface DeliveryInput {
  soId: string; date: string; type: string; items: DoItem[]; description: string; transport: string; extCost: number; conditionFiles: string[];
  signature: string; foc: boolean; status: string; number?: string; driver?: string; vehicle?: string; narration?: string;
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number; serviceLineIds?: string[]; additional?: AdditionalCharge;
  reference?: string; project?: string; poNumber?: string; poDate?: string; location?: string; transportedBy?: string; vehicleNumber?: string; iqama?: string; mobile?: string; department?: string; salesperson?: string; accessories?: string[]; supplierDoNo?: string;
  /** Own Fleet: the delivery vehicle (a Heavy Equipment Fixed Asset ticked as Delivery fleet vehicle), picked from Fleet Availability. */
  vehicleId?: string;
}
/**
 * One Delivery Order covers any number of Sales Order items. Rental items assign the exact serialized assets (billing starts on the Rental Start Date; when that is
 * after the delivery date the assets wait on Hold), other items are marked delivered and can then be invoiced.
 */
/** Free-of-charge extras added while delivering (a barricade, 500 m of cable...). They become zero-priced lines on the Sales Order so they stay traceable. */
export function addFocLines(soId: string, lines: Line[]) {
  if (!lines.length) return;
  saveOrder(soId, (x) => ({ ...x, lines: [...x.lines, ...lines], log: [log(`${lines.length} FOC item(s) added at delivery`, lines.map((l) => `${l.item} x ${l.qty}`).join(', '), 'blue'), ...x.log] }));
}
export function createDelivery(i: DeliveryInput): Delivery {
  // The vehicle is re-checked here, before anything is saved, so a stale screen can never double-book it.
  assertTransport({ transport: i.transport as Trip['transport'], vehicleId: i.vehicleId, transporter: i.transportedBy, charge: i.extCost }, i.date);
  const o = getOrder(i.soId)!;
  const id = uid('dl');
  const rentalItems = i.items.filter((it) => getLine(o, it.lineId)?.activity === 'Rental');
  const first = rentalItems[0] ?? i.items[0];
  const firstLine = getLine(o, first.lineId);
  const hold = rentalItems.length > 0 && i.rentalStart.slice(0, 10) > i.date.slice(0, 10);
  const saleItems = i.items.filter((it) => getLine(o, it.lineId)?.activity === 'Fixed Asset Trading');
  const allAssets = [...rentalItems, ...saleItems].flatMap((it) => it.assetIds);
  const d: Delivery = { id, number: i.number || nextNumber('DO', 161), soId: o.id, soNumber: o.number, lineId: first.lineId, customerId: o.customerId, date: i.date, type: i.type, assetIds: allAssets, accessories: i.accessories ?? [], description: i.description,
    transport: i.transport, extCost: i.extCost, conditionFiles: i.conditionFiles, signature: i.signature, foc: i.foc, status: i.status === 'Dispatched' ? 'Packed' : i.status, closed: false, driver: i.driver, vehicle: i.vehicleId ?? i.vehicle, narration: i.narration,
    rentalStart: i.rentalStart, startReason: i.startReason, startBy: i.startBy, waitingCharge: i.waitingCharge, requestedSub: firstLine?.category, deliveredSub: first.deliveredSub ?? firstLine?.category, serviceLineIds: i.serviceLineIds, siteReady: !hold,
    items: i.items, reference: i.reference, poNumber: i.poNumber, poDate: i.poDate, location: i.location, operationType: 'Delivery', project: i.project ?? o.costCentre, supplierDoNo: i.supplierDoNo, transportedBy: i.transportedBy, vehicleNumber: (i.vehicleId ? assetById(i.vehicleId)?.plateNumber : undefined) ?? i.vehicleNumber, iqama: i.iqama, mobile: i.mobile, department: i.department, salesperson: i.salesperson };
  // 8 Oct call: the days before the Invoice Start Date are billed by an additional invoice when the user says so.
  const addInv = i.additional ? invoiceAdditionalCharge(o.id, { kind: 'Delivery', docId: id, docNumber: d.number, ...i.additional }) : undefined;
  if (i.additional && addInv) { d.additional = i.additional; d.additionalInvoiceId = addInv.id; }
  put(COL.deliveries, d);
  const dest = `Client: ${custName(o.customerId)}`;
  const soldIds = saleItems.flatMap((it) => it.assetIds);
  allAssets.forEach((hid) => {
    const a = assetById(hid)!;
    if (soldIds.includes(hid)) {
      patchAsset(hid, { assetStatus: 'Disposed', status: 'Inactive' }, { title: 'Sold to a client', detail: `Fixed Asset Trading, delivery ${d.number}. The asset leaves the active fleet` }, { type: 'Delivery', from: whereIs(hid, i.location), to: dest, reference: d.number, customer: custName(o.customerId), project: o.costCentre });
      return;
    }
    patchAsset(hid, { assetStatus: hold ? 'Hold' : 'On Hire', crossHireIdle: false }, { title: 'Asset Status changed', detail: `${a.assetStatus} to ${hold ? 'Hold' : 'On Hire'} (${d.number})` }, { type: 'Delivery', from: whereIs(hid, i.location), to: dest, reference: d.number, customer: custName(o.customerId), project: o.costCentre });
    if (a.ownership === 'Cross-Hired') {
      const ch = all<CrossHire>(COL.crossHire).find((c) => unitsOf(c).some((u) => u.assetId === hid && u.stage < 2));
      if (ch) patchUnit(ch.id, hid, (u) => ({ ...u, stage: 2, soId: o.id, soNumber: o.number, lineId: first.lineId }), log(`${assetById(hid)?.assetId} allocated to ${o.number}`, `Delivery ${d.number}`));
    }
  });
  const notes: LogItem[] = [];
  saveOrder(o.id, (x) => {
    let lines = x.lines;
    i.items.forEach((it) => {
      const l = getLine(x, it.lineId)!;
      if (l.activity === 'Rental') {
        lines = lines.map((y) => (y.id === it.lineId ? { ...y, assigned: [...y.assigned, ...it.assetIds.map((hid) => ({ assetId: hid, deliveryId: id, start: i.rentalStart.slice(0, 10), state: (hold ? 'Hold' : 'On Hire') as 'Hold' | 'On Hire' }))] } : y));
        if (it.deliveredSub && it.deliveredSub !== l.category) notes.push(log('Allocation differs from the request', `Requested ${l.group} ${l.category}, delivered ${l.group} ${it.deliveredSub}. Client documents keep the requested spec`, 'amber'));
      } else if (l.activity === 'Fixed Asset Trading') {
        lines = lines.map((y) => (y.id === it.lineId ? { ...y, assigned: [...y.assigned, ...it.assetIds.map((hid) => ({ assetId: hid, deliveryId: id, start: i.date.slice(0, 10), state: 'Sold' as const }))] } : y));
        if (it.deliveredSub && it.deliveredSub !== l.category) notes.push(log('Allocation differs from the request', `Requested ${l.group} ${l.category}, delivered ${l.group} ${it.deliveredSub}`, 'amber'));
      } else {
        lines = lines.map((y) => (y.id === it.lineId ? { ...y, fulfilment: 'Delivered', fulfilmentRef: d.number } : y));
      }
    });
    return {
      ...x, lines,
      damageCharges: i.waitingCharge ? [...x.damageCharges, { assetId: allAssets[0], amount: i.waitingCharge, note: `Waiting period lump sum (${d.number})`, date: TODAY }] : x.damageCharges,
      log: [
        log(`Delivery ${d.number}: ${i.items.length} item(s)${allAssets.length ? `, ${allAssets.map((h) => assetById(h)?.assetId).join(', ')} ${hold ? 'on Hold' : 'on hire'}` : ''}`, hold ? `Rental starts ${i.rentalStart.slice(0, 10)}. ${i.startReason} (${i.startBy})${i.waitingCharge ? `, waiting charge AED ${i.waitingCharge}` : ''}` : allAssets.length ? 'Exact serialized asset assigned. Billing starts on the Rental Start Date' : 'Stock delivered', hold ? 'amber' : 'green'),
        ...(i.additional && addInv ? [log(`Additional invoice ${addInv.number} raised for ${i.additional.days} day(s) before invoice start`, 'Pending approval', 'blue')] : []),
        ...notes, ...x.log],
    };
  });
  // The trip carries the transport cost to the order (an external transporter's charge is posted once, by the trip).
  createTrip({ kind: 'Delivery', doc: { id: d.id, number: d.number }, soId: o.id, date: i.date, transport: i.transport as Trip['transport'], vehicleId: i.vehicleId, driver: i.driver, mobile: i.mobile, transporter: i.transportedBy, charge: i.extCost });
  return d;
}

/**
 * Ends the Hold on a delivered asset. Billing starts on the planned Rental Start Date agreed at delivery; if the site is ready
 * earlier and the hold is released before that date, billing starts on the release day instead.
 */
export function releaseHold(soId: string, lineId: string, assetId: string, auto = false) {
  const planned = getLine(getOrder(soId), lineId)?.assigned.find((a) => a.assetId === assetId && a.state === 'Hold')?.start ?? TODAY;
  const start = TODAY < planned ? TODAY : planned;
  const why = auto ? 'Rental Start Date reached' : 'Site ready';
  patchAsset(assetId, { assetStatus: 'On Hire' }, { title: 'Hold released', detail: `${why}, invoicing cycle starts ${start}` });
  saveOrder(soId, (o) => ({ ...mapLine(o, lineId, (l) => ({ ...l, assigned: l.assigned.map((a) => (a.assetId === assetId && a.state === 'Hold' ? { ...a, state: 'On Hire' as const, start } : a)) })), log: [log(`Hold released: ${assetById(assetId)?.assetId ?? assetId}`, `${why}. Invoicing cycle starts ${start}`, 'green'), ...o.log] }));
}
/** Releases every hold whose Rental Start Date has arrived, so nobody has to remember to do it by hand. */
export function releaseDueHolds(soId?: string) {
  all<SalesOrder>(COL.orders).filter((o) => !soId || o.id === soId).forEach((o) => o.lines.forEach((l) => l.assigned
    .filter((a) => a.state === 'Hold' && a.start <= TODAY).forEach((a) => releaseHold(o.id, l.id, a.assetId, true))));
}

/* ------------------------------------------------------------------ Rental: cross-hire lifecycle */
/** Step 1 (existing ERP): a Cross Hire Request is raised from the Rental Order. The supplier and rate are optional here; the RFQ award or the order fixes them. */
/**
 * Units of a rental line that nothing covers yet: still to deliver, less Ready for Hire units of the Category (owned or cross-hired), less requests, RFQs and orders already
 * raised for the line and not yet received. A Cross Hire Request is raised for this gap only.
 */
export function crossHireGap(o: SalesOrder, l: Line): number {
  const remaining = l.qty - deliveredQty(l);
  const av = availability(l.group, l.category);
  const mine = all<CrossHireRequest>(COL.chRequests).flatMap((r) => reqItems(r).filter((i) => i.lineId === l.id).map((i) => ({ r, i })));
  const rfqs = all<CrossHireRfq>(COL.chRfqs);
  const open = mine.filter(({ r, i }) => ['Draft', 'Pending', 'In Progress'].includes(r.status) && !i.orderId && !i.rfqId).reduce((n, { i }) => n + i.qty, 0);
  const viaRfq = mine.filter(({ i }) => !i.orderId && i.rfqId && rfqs.some((x) => x.id === i.rfqId && !['Cancelled', 'Order'].includes(x.status))).reduce((n, { i }) => n + i.qty, 0);
  const ordered = all<CrossHire>(COL.crossHire).filter((c) => !['Cancelled', 'Rejected', 'Closed'].includes(c.status ?? '')).reduce((n, c) => n + chItems(c).filter((i) => i.lineId === l.id).reduce((m, i) => m + Math.max(0, i.qty - unitsOf(c).filter((u) => { const a = assetById(u.assetId); return a?.category === i.group && a?.subCategory === i.category; }).length), 0), 0);
  return Math.max(0, remaining - av.owned.length - av.cross.length - open - viaRfq - ordered);
}
/** One Cross Hire Request for the selected equipment lines of a Sales Order: one item per line (Category, Subcategory and the units not covered yet). */
export function raiseCrossHire(soId: string, lineIds: string | string[], supplierId?: string, supplier?: string, rate = 0): string {
  const o = getOrder(soId)!;
  const ls = (Array.isArray(lineIds) ? lineIds : [lineIds]).map((x) => getLine(o, x)!).filter(Boolean);
  const items: CrossHireReqItem[] = ls.map((l) => ({ lineId: l.id, group: l.group ?? '', category: l.category ?? '', qty: Math.max(1, crossHireGap(o, l)), frequency: l.frequency ?? 'Monthly', rate }));
  const first = items[0];
  const what = items.map((i) => `${i.group} ${i.category} x ${i.qty}`).join(', ');
  const id = uid('chr');
  const rec: CrossHireRequest = { id, number: nextNumber('CHR', 8), date: TODAY, soId, soNumber: o.number, lineId: first.lineId, group: first.group, category: first.category, qty: items.reduce((n, i) => n + i.qty, 0), frequency: first.frequency, rate, vendorId: supplierId, vendor: supplier, items,
    company: o.entity, representative: o.owner, currency: o.currency, narration: `No owned unit available for ${o.number}: ${what}`, location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Pending', raisedBy: ACTOR, raisedRole: 'General Manager',
    log: [log(`Request raised from ${o.number}`, what)] };
  put(COL.chRequests, rec);
  saveOrder(soId, (x) => ({ ...x, lines: x.lines.map((ln) => (items.some((i) => i.lineId === ln.id) ? { ...ln, crossHire: [...ln.crossHire, id] } : ln)), log: [log(`Cross-Hire request ${rec.number} raised`, what, 'blue'), ...x.log] }));
  return id;
}
/** An order or an RFQ covers the items of its Category and Subcategory; the request is Completed once every item is covered. */
function coverRequestItems(requestIds: string[], covers: (i: CrossHireReqItem) => boolean, mark: Partial<CrossHireReqItem>, entry: LogItem) {
  requestIds.forEach((rid) => patch<CrossHireRequest>(COL.chRequests, rid, (r) => {
    const items = reqItems(r).map((i) => (covers(i) ? { ...i, ...mark } : i));
    const done = items.every((i) => i.orderId || i.rfqId);
    return { ...r, items, status: done ? 'Completed' : r.status, orderId: mark.orderId ?? r.orderId, rfqId: mark.rfqId ?? r.rfqId, log: [...r.log, entry] };
  }));
}
export function saveChRequest(r: CrossHireRequest) { patch<CrossHireRequest>(COL.chRequests, r.id, () => r); }
export function submitChRequest(id: string) { patch<CrossHireRequest>(COL.chRequests, id, (r) => ({ ...r, status: 'In Progress', log: [...r.log, log('Submitted and approved', undefined, 'green')] })); }
const chReqs = (ids: string[]) => ids.map((i) => all<CrossHireRequest>(COL.chRequests).find((r) => r.id === i)).filter(Boolean) as CrossHireRequest[];

/** Step 2: Create > RFQ from one or more In Progress requests (from the request view or the Process Cross Hire screen). */
export function createChRfq(i: { requestIds: string[]; vendorIds: string[]; orderDeadline: string; expectedDate: string; narration?: string; paymentTerms?: string; items?: RfqItem[]; status?: CrossHireRfq['status']; form?: Record<string, any>; reference?: string; group?: string; category?: string; start?: string; end?: string }): string {
  const rs = chReqs(i.requestIds);
  const first = rs[0];
  const id = uid('rfq');
  const rec: CrossHireRfq = { id, number: nextNumber('RFQ', 13), date: TODAY, requestIds: i.requestIds, soNumbers: [...new Set(rs.map((r) => r.soNumber))], group: first?.group ?? i.items?.[0]?.group ?? i.group ?? '', category: first?.category ?? i.items?.[0]?.category ?? i.category ?? '', qty: (i.items ?? []).reduce((t, x) => t + x.qty, 0) || rs.reduce((t, r) => t + r.qty, 0), vendorIds: i.vendorIds,
    orderDeadline: i.orderDeadline, expectedDate: i.expectedDate, currency: first?.currency ?? 'AED', paymentTerms: i.paymentTerms ?? 'Net 30', narration: i.narration ?? '', start: i.start, end: i.end, items: i.items, form: i.form, reference: i.reference, status: i.status ?? 'Open', responses: [], log: [log('RFQ created', `From ${rs.map((r) => r.number).join(', ') || 'a manual entry'}`)] };
  put(COL.chRfqs, rec);
  const cats = i.items?.map((x) => `${x.group}|${x.category}`);
  coverRequestItems(i.requestIds, (it) => !cats || cats.includes(`${it.group}|${it.category}`), { rfqId: id }, log(`RFQ ${rec.number} created`));
  return id;
}
export function saveChRfq(id: string, p: Partial<CrossHireRfq>) { patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, ...p, log: [...r.log, log('RFQ edited')] })); }
export function cancelChRfq(id: string) { patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: 'Cancelled', log: [...r.log, log('RFQ cancelled', undefined, 'red')] })); }
export function deleteChRfq(id: string) { setCollection(COL.chRfqs, all<CrossHireRfq>(COL.chRfqs).filter((r) => r.id !== id)); }
export function deleteChResponse(id: string, vendorId: string) {
  patch<CrossHireRfq>(COL.chRfqs, id, (r) => { const left = r.responses.filter((x) => x.vendorId !== vendorId); return { ...r, responses: left, awardedVendorId: r.awardedVendorId === vendorId ? undefined : r.awardedVendorId, status: !left.length && (r.status === 'Response Received' || r.status === 'Pending Order') ? 'RFQ Sent' : r.status, log: [...r.log, log('Response deleted')] }; });
}
export function sendChRfq(id: string) { patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: 'RFQ Sent', log: [...r.log, log(`RFQ sent to ${r.vendorIds.length} supplier(s)`)] })); }
export function addChResponse(id: string, resp: RfqResponse) {
  patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: 'Response Received', responses: [...r.responses.filter((x) => x.vendorId !== resp.vendorId), resp], log: [...r.log, log(`Response received from ${resp.vendor}`, `Rate AED ${resp.rate}, lead time ${resp.leadTime} days`)] }));
}
export function awardChRfq(id: string, vendorId: string, comment: string) {
  patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: r.status === 'Order' ? r.status : 'Pending Order', awardedVendorId: vendorId, awardComment: comment, log: [...r.log, log(`Awarded to ${r.responses.find((x) => x.vendorId === vendorId)?.vendor}`, comment || undefined, 'green')] }));
}

/** Step 3: the Cross Hire Order (Hire Order). Created from a request, from several requests (Process screen) or from an awarded RFQ. */
export function createHireOrder(i: { requestIds: string[]; rfqId?: string; supplierId: string; supplier: string; rate: number; type: 'Inventory' | 'Dropship'; start?: string; end?: string; qty?: number }): string {
  const rs = chReqs(i.requestIds);
  const first = rs[0];
  const o = getOrder(first?.soId);
  const l = o && first ? getLine(o, first.lineId) : undefined;
  const id = uid('ch');
  const number = nextNumber('CH', 20);
  const qty = i.qty ?? (rs.reduce((t, r) => t + r.qty, 0) || 1);
  const rec: CrossHire = { id, number, soId: first?.soId ?? '', soNumber: [...new Set(rs.map((r) => r.soNumber))].join(', '), lineId: first?.lineId ?? '', group: first?.group ?? '', category: first?.category ?? '', supplierId: i.supplierId, supplier: i.supplier, rate: i.rate * qty, stage: 0,
    revenue: l ? l.price * qty : 0, date: TODAY, type: i.type, requestIds: i.requestIds, rfqId: i.rfqId, status: 'Pending', grns: [], receiving: 'Pending Receiving', billing: 'Pending Billing', expenses: [], qty, confirmationDate: TODAY, expectedReceipt: TODAY, paymentTerms: 'Net 30', startDate: i.start ?? l?.start, endDate: i.end ?? l?.end,
    history: [log('Request', `${rs.map((r) => r.number).join(', ') || 'Order'} ${i.rfqId ? 'via RFQ award' : 'direct order'}; ${i.type}`), log('Order created', `${number} with ${i.supplier} at AED ${i.rate} per unit`, 'blue')] };
  put(COL.crossHire, rec);
  rs.forEach((r) => patch<CrossHireRequest>(COL.chRequests, r.id, (x) => ({ ...x, status: 'Completed', orderId: id, vendorId: i.supplierId, vendor: i.supplier, rate: i.rate, log: [...x.log, log(`Order ${number} created`, i.supplier)] })));
  if (i.rfqId) patch<CrossHireRfq>(COL.chRfqs, i.rfqId, (r) => ({ ...r, status: 'Order', orderId: id, log: [...r.log, log(`Order ${number} created`)] }));
  if (first) addLog(first.soId, log(`Cross-hire order ${number}`, `${i.supplier}, ${i.type}`, 'blue'));
  return id;
}
/** Approval of a Cross Hire Order, as in the existing ERP: Submit for Approval (or Quick Approval), then the approver accepts or rejects; a rejected order can be re-submitted. */
export function submitChOrder(id: string, quick: boolean) {
  patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, status: quick ? 'Approved' : 'Pending Approval', approvedBy: quick ? ACTOR : undefined, history: [...c.history, quick ? log('Quick approval', `Approved by ${ACTOR}`, 'green') : log('Submitted for approval', 'Waiting for the approver', 'amber')] }));
}
export function decideChOrder(id: string, approve: boolean) {
  patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, status: approve ? 'Approved' : 'Rejected', approvedBy: approve ? ACTOR : undefined, history: [...c.history, approve ? log('Order approved', `By ${ACTOR}. A Goods Receipt can now be created`, 'green') : log('Order rejected', `By ${ACTOR}`, 'red')] }));
}
export function setChOrderStatus(id: string, status: 'Cancelled' | 'Closed') { patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, status, history: [...c.history, log(status === 'Cancelled' ? 'Order cancelled' : 'Order closed', undefined, status === 'Cancelled' ? 'red' : 'grey')] })); }
export function deleteChOrder(id: string) { setCollection(COL.crossHire, all<CrossHire>(COL.crossHire).filter((c) => c.id !== id)); }
export function saveChOrder(id: string, p: Partial<CrossHire>) { patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, ...p, history: [...c.history, log('Order edited')] })); }
/** A Cross Hire Order typed in the order form (not from a request): Category, Subcategory and a number of units. The Rental Order it serves is optional; units are bound to a Sales Order at delivery. */
export function createChOrderFromForm(i: { supplierId: string; supplier: string; soId?: string; items: { group: string; category: string; qty: number; rate: number; lineId?: string }[]; type: 'Inventory' | 'Dropship'; draft: boolean; rfqId?: string; requestIds?: string[]; form: Record<string, any> }): string {
  const o = i.soId ? getOrder(i.soId) : undefined;
  const items = i.items.map((x, k) => ({ id: uid(`chi${k}`), group: x.group, category: x.category, qty: x.qty, rate: x.rate, lineId: x.lineId ?? o?.lines.find((l) => l.activity === 'Rental' && l.group === x.group && l.category === x.category)?.id }));
  const first = items[0];
  const qty = items.reduce((n, x) => n + x.qty, 0);
  const revenue = items.reduce((n, x) => n + (o?.lines.find((l) => l.id === x.lineId)?.price ?? 0) * x.qty, 0);
  const id = uid('ch');
  const number = nextNumber('CH', 10);
  const what = items.map((x) => `${x.qty} x ${x.group} ${x.category} at AED ${x.rate}`).join(', ');
  const rec: CrossHire = { id, number, soId: o?.id ?? '', soNumber: o?.number ?? '', project: o?.costCentre, customerId: o?.customerId, site: o?.site, lineId: first.lineId ?? '', group: first.group, category: first.category, supplierId: i.supplierId, supplier: i.supplier, rate: items.reduce((n, x) => n + x.qty * x.rate, 0), stage: 0, revenue, date: i.form.date ?? TODAY,
    type: i.type, requestIds: i.requestIds ?? [], rfqId: i.rfqId, status: i.draft ? 'Draft' : 'Pending', grns: [], units: [], items, receiving: 'Pending Receiving', billing: 'Pending Billing', expenses: [], qty, confirmationDate: i.form.confirmationDate, expectedReceipt: i.form.expectedReceipt,
    paymentTerms: i.form.paymentTerms, startDate: i.form.startDate, endDate: i.form.endDate, form: i.form,
    history: [log('Order created', `${number} with ${i.supplier}: ${what}; ${i.draft ? 'saved as draft' : 'saved'}`, 'blue')] };
  put(COL.crossHire, rec);
  coverRequestItems(i.requestIds ?? [], (it) => items.some((x) => x.group === it.group && x.category === it.category), { orderId: id }, log(`Order ${number} created`, i.supplier));
  if (i.rfqId) patch<CrossHireRfq>(COL.chRfqs, i.rfqId, (r) => ({ ...r, status: 'Order', orderId: id, log: [...r.log, log(`Order ${number} created`)] }));
  if (o) addLog(o.id, log(`Cross-hire order ${number}`, `${i.supplier}, ${i.type}`, 'blue'));
  return id;
}
export function addChExpense(id: string, e: { account: string; amount: number; note: string }) { patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, expenses: [...(c.expenses ?? []), e], history: [...c.history, log(`Expense added: ${e.account}`, `AED ${e.amount}`)] })); }
/** Dropship: the supplier ships straight to the client site, so there is no goods receipt and no register entry. */
export function markChShipped(ch: CrossHire) { patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 2, status: 'Shipped', receiving: 'Not applicable (Dropship)', history: [...c.history, log('Marked shipped to the client site', 'Dropship: no goods receipt, no register entry', 'blue')] })); }
/** Goods Receipt Note created from the approved order (Receive). It is a separate form; the assets received are traced on it and Validate puts them on the register. */
export function createGrn(chId: string, g: Omit<CrossHireGrn, 'id' | 'number' | 'traces' | 'validated' | 'qty'>): string {
  const id = uid('grn');
  patch<CrossHire>(COL.crossHire, chId, (c) => {
    const grn: CrossHireGrn = { ...g, id, number: nextNumber('GRN', 20), qty: 0, traces: [], validated: false };
    return { ...c, grns: [...(c.grns ?? []), grn], history: [...c.history, log(`Goods Receipt ${grn.number} created`, 'Trace the assets received', 'blue')] };
  });
  return id;
}
export function saveGrn(chId: string, grnId: string, p: Partial<CrossHireGrn>) { patch<CrossHire>(COL.crossHire, chId, (c) => ({ ...c, grns: (c.grns ?? []).map((g) => (g.id === grnId ? { ...g, ...p, qty: (p.traces ?? g.traces).length } : g)) })); }
export function deleteGrn(chId: string, grnId: string) { patch<CrossHire>(COL.crossHire, chId, (c) => ({ ...c, grns: (c.grns ?? []).filter((g) => g.id !== grnId) })); }
/** Validate: the inventory adjustment of the existing ERP. Each traced asset goes on the Fixed Asset Register as Cross-Hired (no depreciation), Ready for Hire. 1 fixed asset = 1 unit. */
export function validateGrn(ch: CrossHire, grnId: string) {
  const g = (ch.grns ?? []).find((x) => x.id === grnId);
  if (!g || !g.traces.length) return;
  const tpl = heavySeed.find((h) => h.id === 'he27')!;
  const base = fleetRows().length;
  const made: HeavyRec[] = g.traces.map((t, i) => {
    const n = base + i;
    const assetId = `AST-${1100 + n}`;
    return { ...tpl, id: uid('he'), code: `ITM-${String(100 + n).padStart(4, '0')}`, assetId, brand: t.brand ?? '', model: t.model ?? '', name: `${t.brand ? `${t.brand}${t.model ? ` ${t.model}` : ''} ` : 'Diesel '}${t.group} ${t.category} ${ch.supplier.split(' ')[0]} Cross-Hire`, category: t.group, subCategory: t.category, capacity: t.category, supplier: ch.supplier, ownership: 'Cross-Hired',
      assetStatus: t.condition === 'Damaged' ? 'Under Maintenance' : 'Ready for Hire', crossHireIdle: false, assetValue: 0, nbv: 0, deprPct: 0, deprAmount: 0, capex: 0, utilization: 0, idleDays: 0, profitability: 0, purchaseDate: TODAY, putToUseDate: TODAY, usefulLifeYears: 0, engineNo: t.serial, image: undefined, attachments: [],
      movements: [{ id: uid('m'), entryNo: `MV-26-${9100 + n}`, date: `${TODAY}T${dayjs().format('HH:mm')}`, type: 'Cross-Hire Stage Change', from: `Supplier: ${ch.supplier}`, to: g.location || 'Jebel Ali Main Yard', reference: g.number, by: ACTOR }],
      audit: [{ when: nowStamp(), title: 'Cross-hired asset received', detail: `${ch.number}, ${g.number} from ${ch.supplier}. No depreciation is posted. Condition ${t.condition ?? 'OK'}${t.remarks ? `. ${t.remarks}` : ''}`, by: ACTOR }], insurance: [] };
  });
  setCollection(COL.fleet, [...made, ...fleetRows()]);
  patch<CrossHire>(COL.crossHire, ch.id, (c) => syncUnits({ ...c, grns: (c.grns ?? []).map((x) => (x.id === grnId ? { ...x, validated: true } : x)),
    history: [...c.history, log(`${g.number} validated: ${made.length} asset(s) received into our custody`, made.map((m) => `${m.assetId} (serial ${m.engineNo})`).join(', '), 'green')] }, [...unitsOf(c), ...made.map((m) => ({ assetId: m.id, stage: 1, grnId }))]));
}
/** Used by the Replacement fallback, where the unit is received and billed in one step: an automatic Goods Receipt, validated, and the supplier bill. */
export function receiveCrossHire(ch: CrossHire, supplierInvoice: string, supplierInvoiceDate: string = TODAY) {
  const gid = createGrn(ch.id, { date: TODAY, receivedBy: ACTOR, narration: 'Received for a replacement', transportedBy: ch.supplier, driver: '', driverId: '', vehicle: '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [] });
  saveGrn(ch.id, gid, { traces: [{ serial: `XH-${Date.now().toString().slice(-6)}`, group: ch.group, category: ch.category }] });
  validateGrn(all<CrossHire>(COL.crossHire).find((c) => c.id === ch.id)!, gid);
  billCrossHire(all<CrossHire>(COL.crossHire).find((c) => c.id === ch.id)!, supplierInvoice, supplierInvoiceDate);
}
/** Dropship (or a bill not raised on receipt): the supplier invoice is entered here and a Pending bill is created. */
export function billCrossHire(ch: CrossHire, supplierInvoice: string, supplierInvoiceDate: string = TODAY): string {
  const bill = billFromCrossHire(ch, supplierInvoice, supplierInvoiceDate);
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, supplierInvoice, billing: 'Fully Billed', status: c.stage >= 1 && c.status === 'Received' ? 'Billed' : c.status, history: [...c.history, log(`Bill ${bill.number} raised`, `Supplier invoice ${supplierInvoice}. Pending approval in Accounting`, 'blue')] }));
  return bill.number;
}
/** Cross-Hire Bill from the Sales Order (8 Oct call): the supplier's bill for one period is entered by hand, one Pending bill per period. The order is Partially Billed until the final bill. */
export function billCrossHireFromOrder(i: { chId: string; soId: string; supplierInvoiceNo: string; supplierInvoiceDate: string; from: string; to: string; final: boolean;
  lines: { assetId?: string; group: string; category: string; days: number; rate: number; amount: number }[]; expenses: { account: string; amount: number; note: string }[] }): { number: string; id: string } {
  const ch = all<CrossHire>(COL.crossHire).find((c) => c.id === i.chId)!;
  const o = getOrder(i.soId)!;
  const bill = billCrossHirePeriod(ch, { ...i, soNumber: o.number });
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, supplierInvoice: i.supplierInvoiceNo, billing: i.final ? 'Fully Billed' : 'Partially Billed', status: i.final && c.stage >= 1 && c.status === 'Received' ? 'Billed' : c.status,
    history: [...c.history, log(`Bill ${bill.number} raised`, `${i.final ? 'Final' : 'Periodic'} bill, ${i.from} to ${i.to}, supplier invoice ${i.supplierInvoiceNo}. Pending approval in Accounting`, 'blue')] }));
  addLog(o.id, log(`Cross-hire bill ${bill.number} for ${ch.number}, ${i.from} to ${i.to}`, 'Pending approval', 'blue'));
  return { number: bill.number, id: bill.id };
}
const pickUnit = (ch: CrossHire, stage: number, assetId?: string) => unitsOf(ch).find((u) => (assetId ? u.assetId === assetId : u.stage === stage));
export function returnToUs(ch: CrossHire, notes: string, files: string[], checks: string[] = [], assetId?: string) {
  const u = pickUnit(ch, 2, assetId);
  if (!u) { patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 3, condition: { notes, files, checks }, history: [...c.history, log('Returned to us', `Condition check completed (${checks.length} checks)${notes ? `: ${notes}` : ''}`, 'amber')] })); return; }
  patchAsset(u.assetId, { assetStatus: 'Yard', crossHireIdle: true }, { title: 'Returned to us', detail: notes }, { type: 'Cross-Hire Stage Change', from: whereIs(u.assetId, 'Client site'), to: 'Jebel Ali Main Yard', reference: ch.number });
  patchUnit(ch.id, u.assetId, (x) => ({ ...x, stage: 3, condition: { notes, files, checks } }), log(`${assetById(u.assetId)?.assetId} returned to us`, `Condition check completed (${checks.length} checks)${notes ? `: ${notes}` : ''}`, 'amber'));
}
/**
 * After Return to Us the unit may go to another client project instead of straight back to the supplier (Re-Issue Reference). It is Ready for Hire again and
 * back at stage Received, so the next Delivery Order allocates it to the new order.
 */
export function reissueCrossHire(ch: CrossHire, soId: string, assetId?: string) {
  const o = getOrder(soId);
  const u = pickUnit(ch, 3, assetId);
  if (!o || !u) return;
  patchAsset(u.assetId, { assetStatus: 'Ready for Hire', crossHireIdle: false }, { title: 'Re-issued', detail: `Offered to ${o.number} instead of going back to the supplier` });
  patchUnit(ch.id, u.assetId, (x) => ({ ...x, stage: 1, soId: undefined, soNumber: undefined, reissueRef: o.number }), log(`${assetById(u.assetId)?.assetId} re-issued to ${o.number}`, 'Ready for Hire again; allocate it with a Delivery Order', 'blue'));
  addLog(o.id, log(`Cross-hired unit offered to this order`, `${ch.number}, ${ch.group} ${ch.category}, re-issued from ${ch.soNumber}`, 'blue'));
}
export function returnToSupplier(ch: CrossHire, dispute: number, reissueRef?: string, assetId?: string) {
  const u = pickUnit(ch, 3, assetId) ?? (unitsOf(ch).length ? undefined : undefined);
  if (u) {
    patchAsset(u.assetId, { assetStatus: 'Off Hire', status: 'Inactive', crossHireIdle: false }, { title: 'Returned to supplier', detail: dispute ? `Supplier dispute charge AED ${dispute}` : undefined }, { type: 'Cross-Hire Stage Change', from: whereIs(u.assetId), to: `Supplier: ${ch.supplier}`, reference: ch.number });
    patchUnit(ch.id, u.assetId, (x) => ({ ...x, stage: 4, dispute: dispute || undefined, reissueRef: reissueRef ?? x.reissueRef }), log(`${assetById(u.assetId)?.assetId} returned to supplier`, dispute ? `Dispute charge AED ${dispute} recorded and traced to ${u.soNumber ?? ch.soNumber}` : 'Loop closed', 'green'));
  } else {
    patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 4, status: 'Closed', dispute: dispute || undefined, reissueRef: reissueRef ?? c.reissueRef, history: [...c.history, log('Returned to supplier', dispute ? `Dispute charge AED ${dispute} recorded and traced to ${c.soNumber}` : 'Loop closed', 'green')] }));
  }
  if (dispute) {
    const b = billDisputeCharge(ch, dispute);
    patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, history: [...c.history, log(`Supplementary bill ${b.number} raised`, `Dispute charge AED ${dispute}, pending approval in Accounting`, 'blue')] }));
    const so = u?.soId ?? ch.soId;
    if (so) addLog(so, log(`Cross-hire dispute charge AED ${dispute}`, `${ch.number}, rolled into the order's profitability. Bill ${b.number}`, 'red'));
  }
}

/**
 * Replacement (8 Oct call, F12): started from the Sales Order. The new unit may be of another Category or Subcategory than the line (for example 250 KVA when 200 KVA is not
 * available) and gets its own Delivery Order. The old unit goes to maintenance, Critical after a breakdown, Routine otherwise (F10).
 */
export function replaceAsset(i: { soId: string; lineId: string; oldId: string; newId: string; reason: string; priceAdjust: number; notified: boolean; crossHireId?: string; transport?: TransportInput; group?: string; category?: string; delivery?: { date: string; status: string; reference?: string };
  collection?: { mode: 'Same vehicle' | 'Separate trip'; date?: string; transport?: TransportInput; outcome: ReplacementOutcome }; priceListRate?: number }): Replacement {
  if (i.transport) assertTransport(i.transport, i.delivery?.date ?? TODAY);
  if (i.collection?.mode === 'Separate trip' && i.collection.transport) assertTransport(i.collection.transport, i.collection.date ?? TODAY);
  const o = getOrder(i.soId)!;
  const oldA = assetById(i.oldId)!;
  const newA = assetById(i.newId)!;
  const line = getLine(o, i.lineId)!;
  const old = line.assigned.find((a) => a.assetId === i.oldId && a.state !== 'Replaced')!;
  const dest = `Client: ${custName(o.customerId)}`;
  const group = i.group ?? line.group;
  const category = i.category ?? line.category;
  const rid = uid('rp');
  const number = nextNumber('RP', 7);
  // The Delivery Order of the replacement unit.
  const did = uid('dl');
  const dd = i.delivery ?? { date: `${TODAY}T${dayjs().format('HH:mm')}`, status: 'Dispatched' };
  const d: Delivery = { id: did, number: nextNumber('DO', 161), soId: o.id, soNumber: o.number, lineId: i.lineId, customerId: o.customerId, date: dd.date, type: 'Partial', assetIds: [i.newId], accessories: [], description: `Replacement ${number}: ${oldA.assetId} out, ${newA.assetId} in`,
    transport: i.transport?.transport ?? 'Own Fleet', extCost: i.transport?.charge ?? 0, conditionFiles: [], signature: '', foc: false, status: dd.status === 'Dispatched' ? 'Packed' : dd.status, closed: false, driver: i.transport?.driver, vehicle: i.transport?.vehicleId, rentalStart: TODAY,
    requestedSub: line.category, deliveredSub: category, siteReady: true, items: [{ lineId: i.lineId, qty: 1, assetIds: [i.newId], deliveredSub: category }], reference: dd.reference, location: whereIs(i.newId), operationType: 'Replacement', project: o.costCentre, transportedBy: i.transport?.transporter,
    vehicleNumber: i.transport?.vehicleId ? assetById(i.transport.vehicleId)?.plateNumber : undefined, mobile: i.transport?.mobile, salesperson: o.owner, replacementId: rid };
  put(COL.deliveries, d);
  const outcome: ReplacementOutcome = i.collection?.outcome ?? (i.reason === 'Breakdown' ? 'Under Maintenance - Critical' : 'Under Maintenance - Routine');
  const mode = i.collection?.mode ?? 'Same vehicle';
  // 9 Oct call: the faulty unit comes back through a collection like a customer return (Collection Note, trip, Goods Receipt, yard inspection), but billing is not stopped.
  const retId = uid('rt');
  const collDate = mode === 'Separate trip' && i.collection?.date ? i.collection.date : dd.date;
  const ret: ReturnEntry = { id: retId, number: rmaNo(), date: TODAY, customerId: o.customerId, soId: o.id, soNumber: o.number, source: 'sales order', shippingAddress: o.site, operationType: 'Replacement', salesperson: o.owner, entity: o.entity, reference: number,
    currency: o.currency, exchangeRate: 1, narration: `Collection of ${oldA.assetId} for replacement ${number}`, location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Pending Receipt', approver: ACTOR,
    items: [{ id: uid('ri0'), lineId: i.lineId, deliveryId: old.deliveryId, assetId: i.oldId, narration: i.reason }], grns: [], method: 'Company Collection', timestamp: collDate, offHireDate: TODAY, siteChecklist: [], photos: [], fuelNote: '',
    transport: mode === 'Separate trip' ? i.collection?.transport : i.transport, replacementId: rid, keepBilling: true,
    log: [log('Collection for a replacement', `${number}: ${oldA.assetId} replaced by ${newA.assetId}. Billing is not stopped, the line keeps billing through ${newA.assetId}`, 'blue')] };
  put(COL.returns, ret);
  const rec: Replacement = { id: rid, number, soId: o.id, lineId: i.lineId, oldAssetId: i.oldId, newAssetId: i.newId, reason: i.reason, priceAdjust: i.priceAdjust, notified: i.notified, date: TODAY, crossHireId: i.crossHireId, by: ACTOR, deliveryId: did, group, category,
    returnId: retId, collectionMode: mode, outcome, priceListRate: i.priceListRate };
  put(COL.replacements, rec);
  patchAsset(i.oldId, { assetStatus: 'Off Hire - In Transit' }, { title: 'Replaced, to be collected', detail: `${rec.number}: ${i.reason}. Collection ${ret.number}, then ${outcome} after the yard inspection` });
  const chOld = all<CrossHire>(COL.crossHire).find((c) => unitsOf(c).some((u) => u.assetId === i.oldId && u.stage === 2));
  if (chOld) patchUnit(chOld.id, i.oldId, (u) => ({ ...u, stage: 3, condition: { notes: `Replacement ${rec.number}: collection ${ret.number}, yard inspection pending`, files: [], checks: [] } }), log(`${oldA.assetId} replaced, coming back to us`, `Collection ${ret.number}`, 'amber'));
  patchAsset(i.newId, { assetStatus: 'On Hire', crossHireIdle: false }, { title: 'Asset Status changed', detail: `Ready for Hire to On Hire (${rec.number}, ${d.number})` }, { type: 'Delivery', from: whereIs(i.newId), to: dest, reference: d.number, customer: custName(o.customerId), project: o.costCentre });
  const ch = all<CrossHire>(COL.crossHire).find((c) => unitsOf(c).some((u) => u.assetId === i.newId && u.stage < 2));
  if (ch) patchUnit(ch.id, i.newId, (u) => ({ ...u, stage: 2, soId: o.id, soNumber: o.number, lineId: i.lineId }), log(`${assetById(i.newId)?.assetId} allocated to ${o.number} as a replacement`, rec.number));
  const differs = category !== line.category || group !== line.group;
  saveOrder(o.id, (x) => ({
    ...mapLine(x, i.lineId, (l) => ({ ...l, assigned: [...l.assigned.map((a) => (a === old || (a.assetId === i.oldId && a.state === 'On Hire') ? { ...a, state: 'Replaced' as const, stop: TODAY } : a)), { assetId: i.newId, deliveryId: did, start: TODAY, state: 'On Hire' as const, extendedTo: old.extendedTo, extRev: old.extRev }] })),
    log: [log(`Replacement ${rec.number}: ${oldA.assetId} out, ${newA.assetId} in`, `${i.reason}. Delivery Order ${d.number} for the new unit, collection ${ret.number} for the old one (${mode === 'Same vehicle' ? 'same vehicle' : 'separate trip'}). The invoice cycle is not paused by a replacement${i.priceAdjust ? `; price adjustment AED ${i.priceAdjust}` : ''}`, 'blue'),
      ...(differs ? [log('Allocation differs from the request', `Requested ${line.group} ${line.category}, delivered ${group} ${category}. Client documents keep the requested spec`, 'amber')] : []), ...x.log],
  }));
  // The original Delivery Order closes when the replaced unit was the last one still out on it.
  const after = getOrder(o.id)!;
  if (!after.lines.some((ln) => ln.assigned.some((a) => a.deliveryId === old.deliveryId && (a.state === 'On Hire' || a.state === 'Hold')))) patch<Delivery>(COL.deliveries, old.deliveryId, (x) => ({ ...x, closed: true }));
  // 9 Oct call: two legs. Same vehicle: one Replacement trip carries the new unit out and brings the old one back, linked to both documents. Separate: a trip for each.
  if (i.transport) {
    const tr = createTrip({ kind: 'Replacement', doc: { id: d.id, number: d.number }, soId: o.id, date: dd.date, ...i.transport });
    if (mode === 'Same vehicle') patch<Trip>(COL.trips, tr.id, (x) => ({ ...x, alsoDoc: { id: ret.id, number: ret.number }, log: [...x.log, log('Also collects', `${oldA.assetId} on ${ret.number}, on the way back`)] }));
  }
  if (mode === 'Separate trip' && i.collection?.transport) createTrip({ kind: 'Collection', doc: { id: ret.id, number: ret.number }, soId: o.id, date: collDate, ...i.collection.transport });
  return rec;
}

/* ------------------------------------------------------------------ Rental: expiry, extension, early termination */
/**
 * Extension is a revision of the SAME Sales Order (8 Oct call, F13): the current version is kept under Revisions, then the new end dates and rates are applied to the lines
 * that are still out. A new rate applies to the extension period only: the old rate is kept as rate history up to the current end date, billing splits a period at that date,
 * and the units still out are marked Extended (returned units are not touched).
 */
export function extendOrder(i: { soId: string; lines: { lineId: string; newEnd?: string; newPrice?: number }[]; lpo?: string; lpoExpiry?: string; confirmedBy: string; note: string }): Extension {
  const o = getOrder(i.soId)!;
  const oldEnd = o.contractEnd ?? '';
  const rev = (o.revision ?? 0) + 1;
  const touched = i.lines.filter((x) => x.newEnd || x.newPrice !== undefined);
  const newEnd = i.lines.map((x) => x.newEnd ?? '').sort().pop() || oldEnd;
  const changes = touched.map((x) => {
    const l = getLine(o, x.lineId)!;
    const parts = [x.newEnd && x.newEnd !== l.end ? `end ${l.end ?? (oldEnd || '-')} to ${x.newEnd}` : '', x.newPrice !== undefined && x.newPrice !== l.price ? `rate ${l.price} to ${x.newPrice}` : ''].filter(Boolean);
    return parts.length ? `${l.group ? `${l.group} ${l.category}` : l.item}: ${parts.join(', ')}` : '';
  }).filter(Boolean).join('; ');
  const rateChanged = touched.some((x) => x.newPrice !== undefined && x.newPrice !== getLine(o, x.lineId)!.price);
  const rec: Extension = { id: uid('ex'), number: nextNumber('EX', 11), soId: i.soId, kind: 'Extension', oldEnd, newEnd, date: TODAY, note: i.note, clientConfirmedBy: i.confirmedBy, status: 'Applied', revision: rev, changes };
  put(COL.extensions, rec);
  saveOrder(i.soId, (x) => ({
    ...x,
    revision: rev,
    revisions: [...(x.revisions ?? []), { rev: rev - 1, date: TODAY, by: ACTOR, note: i.note || `Extended to ${newEnd}`, contractEnd: x.contractEnd, lpo: x.lpo, lpoExpiry: x.lpoExpiry, lines: x.lines.filter((l) => l.activity === 'Rental' || (l.activity === 'Service' && l.billing === 'Recurring')).map((l) => ({ id: l.id, item: l.item, end: l.end, price: l.price })) }],
    contractEnd: newEnd,
    lpo: i.lpo || x.lpo,
    lpoExpiry: i.lpoExpiry || (!x.lpoExpiry || x.lpoExpiry < newEnd ? newEnd : x.lpoExpiry),
    lines: x.lines.map((l) => {
      const t = touched.find((y) => y.lineId === l.id);
      if (!t) return l;
      const repriced = t.newPrice !== undefined && t.newPrice !== l.price;
      const until = l.end ?? oldEnd;
      return { ...l, end: t.newEnd ?? l.end, price: t.newPrice ?? l.price, rateHistory: repriced && until ? [...(l.rateHistory ?? []), { until, price: l.price }] : l.rateHistory,
        assigned: t.newEnd ? l.assigned.map((a) => (a.state === 'On Hire' || a.state === 'Hold' ? { ...a, extendedTo: t.newEnd, extRev: rev } : a)) : l.assigned };
    }),
    log: [log(`Update ${rev}: extended to ${newEnd}${rateChanged ? ', rate changes ' + changes : ''}`, `${rec.number}. Confirmed by ${i.confirmedBy}. The previous version is kept under Update History, no new order is created${rateChanged ? '. The new rate applies to the extension period only' : ''}`, 'green'), ...x.log],
  }));
  return rec;
}
/** AMC visit against the planned schedule: the scheduled visit is never billed, consumables and additional tasks are. */

/* ------------------------------------------------------------------ Customer Returns (RMA): entry, approval, Goods Receipt, validation */
const rmaNo = () => nextNumber('RMA', 132);
const getReturn = (id?: string) => all<ReturnEntry>(COL.returns).find((r) => r.id === id);
export interface ReturnInput {
  soId: string; deliveryId?: string; date: string; shippingAddress?: string; salesperson?: string; entity?: string; reference?: string; currency?: string; exchangeRate?: number; narration?: string; location: string; department?: string; attachments?: string[];
  items: { lineId: string; assetId: string; narration?: string; files?: string[] }[]; method: string; timestamp: string; siteChecklist: string[]; photos: string[]; fuelNote: string; transport?: TransportInput; draft: boolean;
  /** Invoice End Date (Off-Hire) and the lump sum for the days between it and the return date (8 Oct call). */
  offHireDate?: string; additional?: AdditionalCharge;
}
export function createReturn(i: ReturnInput): ReturnEntry {
  const o = getOrder(i.soId)!;
  const items: ReturnItem[] = i.items.map((it, k) => {
    const l = getLine(o, it.lineId)!;
    const as = l.assigned.find((a) => a.assetId === it.assetId && (a.state === 'On Hire' || a.state === 'Hold'))!;
    return { id: uid(`ri${k}`), lineId: it.lineId, deliveryId: as.deliveryId, assetId: it.assetId, narration: it.narration, files: it.files };
  });
  const rec: ReturnEntry = { id: uid('rt'), number: rmaNo(), date: i.date, customerId: o.customerId, soId: o.id, soNumber: o.number, source: i.deliveryId ? 'delivery' : 'sales order', deliveryId: i.deliveryId, shippingAddress: i.shippingAddress ?? o.site, operationType: 'Return',
    salesperson: i.salesperson ?? o.owner, entity: i.entity ?? o.entity, reference: i.reference, currency: i.currency ?? o.currency, exchangeRate: i.exchangeRate ?? 1, narration: i.narration, location: i.location, department: i.department, attachments: i.attachments ?? [],
    status: i.draft ? 'Draft' : 'Pending', items, grns: [], method: i.method, timestamp: i.timestamp, offHireDate: i.offHireDate, additional: i.additional, siteChecklist: i.siteChecklist, photos: i.photos, fuelNote: i.fuelNote,
    transport: i.method === 'Company Collection' ? i.transport : undefined, log: [log(i.draft ? 'Customer return saved as draft' : 'Customer return saved', `${items.length} asset(s) of ${o.number}`)] };
  put(COL.returns, rec);
  if (!i.draft) applyOffHire(rec.id);
  return getReturn(rec.id)!;
}
/** Saving a return (not as a draft) is the Return Entry: the assets go Off Hire and rental billing stops at the Return Entry Timestamp; a Company Collection creates its trip. */
export function applyOffHire(id: string) {
  const r = getReturn(id);
  if (!r) return;
  const o = getOrder(r.soId)!;
  // 8 Oct call: billing stops at the Invoice End Date (Off-Hire), which may differ from the return date.
  const stop = r.offHireDate ?? r.timestamp.slice(0, 10);
  r.items.forEach((it) => {
    patchAsset(it.assetId, { assetStatus: 'Off Hire - In Transit' }, { title: 'Asset Status changed', detail: `On Hire to Off Hire - In Transit (${r.number}). Rental invoicing stops ${stop}` });
    saveOrder(o.id, (x) => ({
      ...mapLine(x, it.lineId, (ln) => ({ ...ln, assigned: ln.assigned.map((a) => (a.assetId === it.assetId && (a.state === 'On Hire' || a.state === 'Hold') ? { ...a, state: 'Returned' as const, stop } : a)) })),
      log: [log(`Return ${r.number}: ${assetById(it.assetId)?.assetId} off hire`, `Billing stops at ${stop}`, 'amber'), ...x.log],
    }));
    // The originating Delivery Order closes automatically once none of its assets is still out.
    const after = getOrder(o.id)!;
    if (!after.lines.some((ln) => ln.assigned.some((a) => a.deliveryId === it.deliveryId && (a.state === 'On Hire' || a.state === 'Hold')))) patch<Delivery>(COL.deliveries, it.deliveryId, (x) => ({ ...x, closed: true }));
    // Recording the customer return IS the Return to Us of a cross-hired unit.
    const ch = all<CrossHire>(COL.crossHire).find((x) => unitsOf(x).some((u) => u.assetId === it.assetId && u.stage === 2));
    if (ch) patchUnit(ch.id, it.assetId, (u) => ({ ...u, stage: 3, condition: { notes: `Customer return ${r.number}: yard inspection pending`, files: [], checks: [] } }), log(`${assetById(it.assetId)?.assetId} returned to us`, `Customer return ${r.number} (${r.method}), billing stopped. Yard inspection pending`, 'amber'));
  });
  if (r.method === 'Company Collection' && r.transport) createTrip({ kind: 'Collection', doc: { id: r.id, number: r.number }, soId: o.id, date: r.timestamp, ...r.transport });
  const addInv = r.additional && !r.additionalInvoiceId ? invoiceAdditionalCharge(o.id, { kind: 'Return', docId: r.id, docNumber: r.number, ...r.additional }) : undefined;
  if (addInv) addLog(o.id, log(`Additional invoice ${addInv.number} raised for ${r.additional!.days} day(s) after invoice end`, 'Pending approval', 'blue'));
  patch<ReturnEntry>(COL.returns, id, (x) => ({ ...x, additionalInvoiceId: addInv?.id ?? x.additionalInvoiceId, log: [...x.log, log('Return entry raised', `Off-Hire. Billing stops at ${stop}${addInv ? `. Additional invoice ${addInv.number} raised, pending approval` : ''}`, 'amber')] }));
}
export function saveReturn(id: string, p: Partial<ReturnEntry>) { patch<ReturnEntry>(COL.returns, id, (r) => ({ ...r, ...p, log: [...r.log, log('Customer return edited')] })); }
export function deleteReturn(id: string) { setCollection(COL.returns, all<ReturnEntry>(COL.returns).filter((r) => r.id !== id)); }
/** Approval of the existing ERP: Submit for Approval or Quick Approval, then the approver accepts or rejects; a rejected return is re-submitted. */
export function submitReturn(id: string, quick: boolean) {
  patch<ReturnEntry>(COL.returns, id, (r) => ({ ...r, status: quick ? 'Pending Receipt' : 'Pending Approval', approver: quick ? ACTOR : undefined, log: [...r.log, quick ? log('Quick approval', `Approved by ${ACTOR}. Ready to Receive`, 'green') : log('Submitted for approval', 'Waiting for the approver', 'amber')] }));
}
export function decideReturn(id: string, approve: boolean) {
  patch<ReturnEntry>(COL.returns, id, (r) => ({ ...r, status: approve ? 'Pending Receipt' : 'Rejected', approver: approve ? ACTOR : undefined, log: [...r.log, approve ? log('Approved', `By ${ACTOR}. Ready to Receive`, 'green') : log('Rejected', `By ${ACTOR}`, 'red')] }));
}
/** Receive: a Goods Receipt for the assets of the return that are not on one yet. */
export function createReturnGrn(id: string, items: { itemId: string; yard: string; reachedYard: string }[]): string {
  const gid = uid('rg');
  patch<ReturnEntry>(COL.returns, id, (r) => {
    const g: ReturnGrn = { id: gid, number: nextNumber('GRN', 20), date: TODAY, status: 'Pending', items: items.map((x) => ({ itemId: x.itemId, assetId: r.items.find((i) => i.id === x.itemId)?.assetId ?? '', yard: x.yard, reachedYard: x.reachedYard, tracked: false, inspection: 'Pending Inspection', yardChecklist: [] })) };
    return { ...r, grns: [...r.grns, g], log: [...r.log, log(`Goods Receipt ${g.number} created`, `${g.items.length} asset(s) received`, 'blue')] };
  });
  // 8 Oct call: on receipt the asset is at the yard and under Yard Inspection (it was Off Hire - In Transit until now).
  const r2 = getReturn(id)!;
  items.forEach((x) => {
    const it = r2.items.find((i) => i.id === x.itemId);
    if (it) patchAsset(it.assetId, { assetStatus: 'Yard Inspection' }, { title: 'Reached the yard', detail: `${r2.number}: yard inspection` }, { type: 'Return', from: `Client: ${custName(r2.customerId)}`, to: x.yard, reference: r2.number, customer: custName(r2.customerId), project: getOrder(r2.soId)?.costCentre });
  });
  return gid;
}
export function saveReturnGrn(id: string, gid: string, fn: (g: ReturnGrn) => ReturnGrn) { patch<ReturnEntry>(COL.returns, id, (r) => ({ ...r, grns: r.grns.map((g) => (g.id === gid ? fn(g) : g)) })); }
export function deleteReturnGrn(id: string, gid: string) { patch<ReturnEntry>(COL.returns, id, (r) => ({ ...r, grns: r.grns.filter((g) => g.id !== gid) })); }
/**
 * Validate the Goods Receipt (8 Oct call, F10): every returned OWN asset goes to maintenance, Routine when the inspection passed and Critical when damage was found
 * (the damage charge to the client is unchanged). A cross-hired asset is not maintained by us: it stays at the yard, idle, for Return to Supplier (the charge to the client still applies).
 * When every asset is received the return is Completed. The asset reached the yard, as Yard Inspection, when the Goods Receipt was created.
 */
export function validateReturnGrn(id: string, gid: string) {
  const r = getReturn(id);
  const g = r?.grns.find((x) => x.id === gid);
  if (!r || !g) return;
  const waiver = hasWaiver(getOrder(r.soId)?.lines ?? []);
  const done: ReturnGrnItem[] = g.items.map((it) => {
    const a = assetById(it.assetId)!;
    const cross = a.ownership === 'Cross-Hired';
    const damaged = it.inspection !== 'Passed';
    const chOf = all<CrossHire>(COL.crossHire).find((c) => unitsOf(c).some((u) => u.assetId === it.assetId && u.stage === 3));
    if (chOf) patchUnit(chOf.id, it.assetId, (u) => ({ ...u, condition: { notes: `${r.number}: ${it.inspection === 'Passed' ? 'inspection passed' : `damage found, ${it.damageNote ?? ''}`}`, files: [], checks: it.yardChecklist } }));
    const repl = r.replacementId ? all<Replacement>(COL.replacements).find((x) => x.id === r.replacementId) : undefined;
    if (!cross && !damaged && repl?.outcome === 'Ready for Hire') {
      patchAsset(it.assetId, { assetStatus: 'Ready for Hire', crossHireIdle: false, maintenanceType: undefined }, { title: 'Inspection passed', detail: `${r.number}: no fault found, back to stock as chosen on ${repl.number}` });
      return { ...it, outcome: 'Ready for Hire' };
    }
    if (!cross && !damaged && repl?.outcome === 'Under Maintenance - Critical') {
      patchAsset(it.assetId, { assetStatus: 'Under Maintenance', crossHireIdle: false, maintenanceType: 'Critical', maintenanceRef: repl.number }, { title: 'Inspection passed', detail: `${r.number}: Under Maintenance (Critical) as chosen on ${repl.number}` }, { type: 'Sent for Repair', from: it.yard, to: 'Workshop: Al Masaood Service Centre', reference: repl.number });
      return { ...it, outcome: 'Critical Maintenance' };
    }
    if (cross) patchAsset(it.assetId, { assetStatus: 'Yard', crossHireIdle: true }, { title: damaged ? 'Damage found at inspection' : 'Inspection passed', detail: `${r.number}: stays at the yard, idle, for Return to Supplier. No maintenance for a cross-hired asset` });
    else if (!damaged) patchAsset(it.assetId, { assetStatus: 'Under Maintenance', crossHireIdle: false, maintenanceType: 'Routine', maintenanceRef: r.number }, { title: 'Inspection passed', detail: `${r.number}: Yard Inspection to Under Maintenance (Routine)` }, { type: 'Sent for Maintenance', from: it.yard, to: `${it.yard} (maintenance bay)`, reference: r.number });
    else patchAsset(it.assetId, { assetStatus: 'Under Maintenance', crossHireIdle: false, maintenanceType: 'Critical', maintenanceRef: r.number }, { title: 'Damage found at inspection', detail: `${r.number}: Yard Inspection to Under Maintenance (Critical)` }, { type: 'Sent for Repair', from: it.yard, to: 'Workshop: Al Masaood Service Centre', reference: r.number });
    if (!damaged) return { ...it, outcome: cross ? 'Awaiting Return to Supplier' : 'Routine Maintenance' };
    saveOrder(r.soId, (o) => ({
      ...o,
      damageCharges: waiver ? o.damageCharges : [...o.damageCharges, { assetId: it.assetId, amount: it.damageCharge ?? 0, note: it.damageNote ?? '', date: TODAY }],
      log: [log(waiver ? 'Damage covered by damage waiver' : `Damage charge AED ${it.damageCharge}`, `${a.assetId}: ${it.damageNote}${waiver ? '. Damage invoice blocked because a waiver was paid' : '. Linked permanently to this order'}`, 'red'), ...o.log],
    }));
    return { ...it, waiverApplied: waiver, damageCharge: waiver ? 0 : it.damageCharge, outcome: cross ? 'Awaiting Return to Supplier' : 'Critical Maintenance' };
  });
  patch<ReturnEntry>(COL.returns, id, (x) => {
    const grns = x.grns.map((y) => (y.id === gid ? { ...y, status: 'Validated' as const, items: done } : y));
    const received = new Set(grns.filter((y) => y.status === 'Validated').flatMap((y) => y.items.map((i) => i.itemId)));
    const complete = x.items.every((i) => received.has(i.id));
    return { ...x, grns, status: complete ? 'Return Completed' : x.status, log: [...x.log, log(`${g.number} validated`, done.map((d) => `${assetById(d.assetId)?.assetId}: ${d.outcome}`).join(', '), 'green'), ...(complete ? [log('Return completed', 'Every asset is received and inspected', 'green')] : [])] };
  });
}

/** Collection failed: charge the client or book it as a company loss. */
export function failedCollection(r: ReturnEntry, by: string, amount: number, note: string) {
  const assetId = r.items[0]?.assetId ?? '';
  patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, collection: { by, amount, note }, log: [...x.log, log('Collection failed', `${by === 'Client' ? `Charged to client AED ${amount}` : 'Company loss'}: ${note}`, 'red')] }));
  saveOrder(r.soId, (o) => ({ ...o, damageCharges: by === 'Client' && amount ? [...o.damageCharges, { assetId, amount, note: `Failed collection: ${note}`, date: TODAY }] : o.damageCharges, log: [log('Collection failed', `${by === 'Client' ? `Client charged AED ${amount}` : 'Booked as company loss'}. ${note}`, 'red'), ...o.log] }));
  // The collection trip shows on the Fleet Availability board as Stuck-Delayed with the same note and Responsible.
  all<Trip>(COL.trips).filter((t) => t.docId === r.id && isOpenTrip(t) && t.status !== 'Stuck-Delayed').forEach((t) => markStuck(t, note, by as 'Company' | 'Client'));
}

/* ------------------------------------------------------------------ Fleet Management: trips */
/** What a document (Delivery Order, Customer Return, Replacement) captures to create its trip. */
export interface TransportInput { transport: Trip['transport']; vehicleId?: string; driver?: string; mobile?: string; transporter?: string; charge?: number }
const tripNo = () => nextNumber('TRP', TRIP_SEED_N);
export const getTrip = (id?: string) => all<Trip>(COL.trips).find((t) => t.id === id);
export const tripsOfDoc = (docId: string) => all<Trip>(COL.trips).filter((t) => t.docId === docId);
export const tripsOfOrder = (soId: string) => all<Trip>(COL.trips).filter((t) => t.soId === soId);
const stamp = () => `${TODAY}T${dayjs().format('HH:mm')}`;
const saveTrip = (id: string, fn: (t: Trip) => Trip) => patch<Trip>(COL.trips, id, (t) => fn(t));
const tlog = (t: Trip, title: string, detail?: string, tone?: LogItem['tone']): LogItem[] => [...t.log, log(title, detail, tone)];
/** Every trip expense lands on the Sales Order's logistics cost (and so on its profitability); removing one takes it off again. */
const bookCost = (soId: string, delta: number, title: string, detail?: string, tone: LogItem['tone'] = 'blue') =>
  saveOrder(soId, (x) => ({ ...x, logisticsCost: Math.max(0, x.logisticsCost + delta), log: [log(title, detail, tone), ...x.log] }));
/** A vehicle can be picked for a trip only when it is free on that day (one trip per vehicle per day, a started trip blocks it until it ends). */
export const vehicleIsFree = (vehicleId?: string, exceptTripId?: string, date?: string) => {
  const a = assetById(vehicleId ?? '');
  return !!a && vehicleFreeOn(a, date, all<Trip>(COL.trips), exceptTripId);
};
/** Why a transport choice cannot be saved, or undefined when it can. Checked by the forms and again here, so a stale screen can never double-book a vehicle. */
export function transportError(i: TransportInput, date: string, exceptTripId?: string): string | undefined {
  if (i.transport === 'Own Fleet') {
    const a = assetById(i.vehicleId ?? '');
    if (!a) return 'Select a Free vehicle from the fleet';
    if (!vehicleIsFree(a.id, exceptTripId, date)) return `${a.plateNumber ?? a.assetId} is not Free on ${date.slice(0, 10)}. Select another vehicle`;
    return undefined;
  }
  if (!i.transporter?.trim()) return 'Select the supplier who transports';
  if (!(Number(i.charge) > 0)) return 'External Transport Cost is required for an external transporter';
  return undefined;
}
const assertTransport = (i: TransportInput, date: string) => { const e = transportError(i, date); if (e) throw new Error(e); };

/**
 * A new expense in Accounting. An own-fleet cost (Salik, fuel...) goes to the ledger now (Dr expense, Cr Accrued Trip Expenses). An external transporter's
 * Transport Charge is billed to the transporter: when the trip is completed, or at once if the trip is already completed.
 */
const postExpense = (t: Trip, e: TripExpense): TripExpense => {
  if (t.transport === 'External Transporter' && e.type === 'Transport Charge') return t.status === 'Completed' ? { ...e, billId: billTripCharge(t, e).id } : e;
  return { ...e, journalId: postTripExpense(t, e) };
};
/** Takes an expense back out of Accounting: its journal is reversed, its bill is voided (or debit-noted when already approved). */
const unpostExpense = (e: TripExpense, why: string): string[] => {
  const notes: string[] = [];
  if (e.journalId && reverseJournal(e.journalId, why)) notes.push('Ledger entry reversed');
  if (e.billId) notes.push(voidTripBill(e.billId, why).message);
  return notes;
};
/** Raises the bill for every Transport Charge of a completed external trip that is not billed yet. */
function billDueCharges(id: string) {
  const t = getTrip(id);
  if (!t || t.transport !== 'External Transporter' || t.status !== 'Completed') return;
  const raised: string[] = [];
  const expenses = t.expenses.map((e) => {
    if (e.type !== 'Transport Charge' || e.billId || !(e.amount > 0)) return e;
    const b = billTripCharge(t, e);
    raised.push(`${b.number} AED ${e.amount}`);
    return { ...e, billId: b.id };
  });
  if (raised.length) saveTrip(id, (x) => ({ ...x, expenses, log: tlog(x, `Bill raised to ${x.transporter}`, `${raised.join(', ')}. Pending approval in Accounting`, 'blue') }));
}

export function createTrip(i: { kind: TripKind; doc: { id: string; number: string }; soId: string; date: string } & TransportInput): Trip {
  assertTransport(i, i.date);
  const o = getOrder(i.soId)!;
  const v = i.vehicleId ? assetById(i.vehicleId) : undefined;
  const own = i.transport === 'Own Fleet';
  const charge = !own && i.charge ? i.charge : 0;
  const t: Trip = {
    id: uid('tr'), number: tripNo(), date: i.date, kind: i.kind, docId: i.doc.id, docNumber: i.doc.number, soId: o.id, soNumber: o.number, customerId: o.customerId, site: o.site, costCentre: o.costCentre,
    transport: i.transport, vehicleId: own ? i.vehicleId : undefined, plate: own ? v?.plateNumber : undefined, driver: own ? i.driver : undefined, mobile: own ? i.mobile : undefined, transporter: own ? undefined : i.transporter,
    status: 'Assigned', since: stamp(), expenses: charge ? [{ type: 'Transport Charge', amount: charge, date: TODAY, note: `Entered on ${i.doc.number}` }] : [], log: [],
  };
  t.log = [log('Trip created', own ? `${v?.plateNumber ?? '-'}${i.driver ? `, ${i.driver}` : ''} for ${i.doc.number}, planned ${i.date.replace('T', ' ')}` : `External transporter ${i.transporter ?? '-'} for ${i.doc.number}${charge ? `, Transport Charge AED ${charge}` : ''}`)];
  put(COL.trips, t);
  saveOrder(o.id, (x) => ({ ...x, logisticsCost: x.logisticsCost + charge, log: [log(`Trip ${t.number} (${i.kind}) for ${i.doc.number}`, own ? `Own fleet ${v?.plateNumber ?? '-'}${i.driver ? `, driver ${i.driver}` : ''}` : `${i.transporter ?? 'External transporter'}${charge ? `, Transport Charge AED ${charge}` : ''}`, 'blue'), ...x.log] }));
  return t;
}
/** A Delivery Order follows its trip: Packed until the trip starts, Dispatched while it runs, Delivered when it completes (the customer signature is still required). */
const syncDelivery = (t: Trip, status: string, why: string, requireSignature = false) => {
  if (t.kind !== 'Delivery' && t.kind !== 'Replacement') return;
  const d = all<Delivery>(COL.deliveries).find((x) => x.id === t.docId);
  if (!d || ['Delivered', 'Acknowledged'].includes(d.status)) return;
  if (requireSignature && !d.signature) { addLog(t.soId, log(`${d.number}: ${why}`, 'The Delivery Order is marked Delivered once the customer signature is captured', 'amber')); return; }
  patch<Delivery>(COL.deliveries, d.id, (x) => ({ ...x, status }));
  addLog(t.soId, log(`${d.number} is ${status}`, why, status === 'Delivered' ? 'green' : 'blue'));
};
export function startTrip(t: Trip) {
  const v = t.vehicleId ? assetById(t.vehicleId) : undefined;
  const origin = v ? whereIs(v.id) : undefined;
  saveTrip(t.id, (x) => ({ ...x, status: 'En Route', since: stamp(), origin, log: tlog(x, 'Trip started', undefined, 'blue') }));
  // The vehicle leaves its yard: Movement History of the delivery vehicle.
  if (v) patchAsset(v.id, {}, { title: 'Trip started', detail: `${t.number} for ${t.docNumber}` }, { type: 'Trip', from: origin!, to: `Client: ${custName(t.customerId)}${t.site ? `, ${t.site}` : ''}`, reference: t.number, customer: custName(t.customerId), project: t.costCentre });
  if (t.kind === 'Delivery' || t.kind === 'Replacement') {
    const d = all<Delivery>(COL.deliveries).find((x) => x.id === t.docId);
    if (d && ['Picked', 'Packed'].includes(d.status)) syncDelivery(t, 'Dispatched', `Trip ${t.number} started`);
  }
}
export function markStuck(t: Trip, reason: string, responsible: 'Company' | 'Client') {
  saveTrip(t.id, (x) => ({ ...x, status: 'Stuck-Delayed', since: stamp(), stuck: { reason, responsible, since: stamp() }, log: tlog(x, 'Marked Stuck-Delayed', `${reason}. Responsible: ${responsible}`, 'red') }));
  saveOrder(t.soId, (o) => ({ ...o, log: [log(`Trip ${t.number} is Stuck-Delayed`, `${reason}. Responsible: ${responsible}`, 'red'), ...o.log] }));
}
export const resumeTrip = (t: Trip) => saveTrip(t.id, (x) => ({ ...x, status: 'En Route', since: stamp(), stuck: undefined, log: tlog(x, 'Resumed', `Was stuck: ${x.stuck?.reason ?? '-'}`, 'blue') }));
export function addTripExpense(t: Trip, e: Omit<TripExpense, 'date'> & { date?: string }) {
  const cur = getTrip(t.id) ?? t;
  if (cur.status === 'Cancelled') return;
  const exp = postExpense(cur, { ...e, date: e.date ?? TODAY });
  saveTrip(t.id, (x) => ({ ...x, expenses: [...x.expenses, exp], log: tlog(x, `Expense added: ${exp.type}`, `AED ${exp.amount}${exp.note ? `, ${exp.note}` : ''}${exp.journalId ? '. Posted to the ledger' : exp.billId ? '. Billed to the transporter' : ''}`) }));
  bookCost(t.soId, expenseGross(exp), `Trip ${t.number}: ${exp.type} AED ${exp.amount}`, 'Added to the order logistics cost');
}
export function removeTripExpense(t: Trip, idx: number) {
  const exp = t.expenses[idx];
  if (!exp) return;
  const notes = unpostExpense(exp, `${t.number}: ${exp.type} removed`);
  saveTrip(t.id, (x) => ({ ...x, expenses: x.expenses.filter((_, k) => k !== idx), log: tlog(x, `Expense removed: ${exp.type}`, [`AED ${exp.amount}`, ...notes].join('. '), 'amber') }));
  bookCost(t.soId, -expenseGross(exp), `Trip ${t.number}: ${exp.type} AED ${exp.amount} removed`, 'Taken off the order logistics cost', 'amber');
}
/**
 * A trip-style expense charged directly against a Delivery Order (client review 8 Oct: an "Add Expense" that does not need an active trip, for example a
 * charge raised before dispatch or after the trip already completed). Posts the same way a trip expense does and adds to the Sales Order logistics cost.
 */
export function addDeliveryExpense(deliveryId: string, e: Omit<TripExpense, 'date'> & { date?: string }) {
  const d = all<Delivery>(COL.deliveries).find((x) => x.id === deliveryId);
  if (!d) return;
  const o = getOrder(d.soId);
  const exp: TripExpense = { ...e, date: e.date ?? TODAY };
  const posted: TripExpense = { ...exp, journalId: postDeliveryExpense(d, o?.costCentre, exp, o?.activity, o?.entity) };
  patch<Delivery>(COL.deliveries, d.id, (x) => ({ ...x, expenses: [...(x.expenses ?? []), posted] }));
  if (o) bookCost(o.id, expenseGross(posted), `${d.number}: ${posted.type} AED ${posted.amount}`, 'Added to the order logistics cost, no active trip required');
}
export function removeDeliveryExpense(deliveryId: string, idx: number) {
  const d = all<Delivery>(COL.deliveries).find((x) => x.id === deliveryId);
  const exp = d?.expenses?.[idx];
  if (!d || !exp) return;
  const notes = unpostExpense(exp, `${d.number}: ${exp.type} removed`);
  patch<Delivery>(COL.deliveries, d.id, (x) => ({ ...x, expenses: (x.expenses ?? []).filter((_, k) => k !== idx) }));
  const o = getOrder(d.soId);
  if (o) bookCost(o.id, -expenseGross(exp), `${d.number}: ${exp.type} AED ${exp.amount} removed`, notes.join('. ') || 'Taken off the order logistics cost', 'amber');
}
/**
 * Complete frees the vehicle (it goes back to where it left from) and closes the loop with the document: a Delivery Order becomes Delivered, a Collection puts the asset in the yard.
 * Expenses entered at the end of the trip (Salik, fuel...) are posted to the order and to Accounting.
 */
export function completeTrip(t: Trip, expenses: Omit<TripExpense, 'date'>[] = []) {
  const cur = getTrip(t.id) ?? t;
  const add = expenses.filter((e) => e.type && e.amount > 0).map((e) => postExpense(cur, { ...e, date: TODAY }));
  const total = add.reduce((s, e) => s + expenseGross(e), 0);
  saveTrip(t.id, (x) => ({ ...x, status: 'Completed', since: stamp(), stuck: undefined, expenses: [...x.expenses, ...add], log: tlog(x, 'Trip completed', add.length ? add.map((e) => `${e.type} AED ${e.amount}`).join(', ') : undefined, 'green') }));
  if (total) bookCost(t.soId, total, `Trip ${t.number} completed`, `${add.map((e) => `${e.type} AED ${e.amount}`).join(', ')} added to the logistics cost`);
  // An external transporter bills us: each Transport Charge becomes a Pending bill to the transporter (a supplier).
  billDueCharges(t.id);
  const v = cur.vehicleId ? assetById(cur.vehicleId) : undefined;
  if (v && cur.origin) patchAsset(v.id, {}, { title: 'Trip completed', detail: `${cur.number} for ${cur.docNumber}` }, { type: 'Trip', from: whereIs(v.id), to: cur.origin, reference: cur.number, customer: custName(cur.customerId), project: cur.costCentre });
  if (cur.kind === 'Delivery') syncDelivery(cur, 'Delivered', `Trip ${cur.number} completed`, true);
  // A replacement unit's Delivery Order has no customer signature step of its own.
  if (cur.kind === 'Replacement') syncDelivery(cur, 'Delivered', `Trip ${cur.number} completed`);
  if (cur.kind === 'Collection' || cur.alsoDoc) {
    const r = all<ReturnEntry>(COL.returns).find((x) => x.id === (cur.kind === 'Collection' ? cur.docId : cur.alsoDoc?.id));
    if (r && !r.collection && !r.collected) patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, collected: `${TODAY} ${dayjs().format('HH:mm')}`, log: [...x.log, log('Collection completed', `Trip ${cur.number}: the assets are on their way to the yard. Receive them with a Goods Receipt`, 'green')] }));
  }
}
/** Cancel frees the vehicle and takes everything the trip cost back out: the order's logistics cost, the ledger entries, and the transporter bill. */
export function cancelTrip(t: Trip, reason: string) {
  const cur = getTrip(t.id) ?? t;
  if (!isOpenTrip(cur)) return;
  const notes = cur.expenses.flatMap((e) => unpostExpense(e, `${cur.number} cancelled`));
  const total = tripTotal(cur);
  saveTrip(t.id, (x) => ({ ...x, status: 'Cancelled', since: stamp(), stuck: undefined, expenses: [], log: tlog(x, 'Trip cancelled', [reason, total ? `AED ${total} taken off ${cur.soNumber}` : '', ...notes].filter(Boolean).join('. '), 'red') }));
  if (total) bookCost(cur.soId, -total, `Trip ${cur.number} cancelled`, `AED ${total} taken off the logistics cost. ${reason}`, 'amber');
  if (cur.kind === 'Delivery') {
    const d = all<Delivery>(COL.deliveries).find((x) => x.id === cur.docId);
    if (d && !['Delivered', 'Acknowledged'].includes(d.status)) patch<Delivery>(COL.deliveries, d.id, (x) => ({ ...x, status: 'Packed' }));
    addLog(cur.soId, log(`${cur.docNumber} needs new transport`, `Trip ${cur.number} was cancelled: ${reason}. Arrange transport again on the Delivery Order`, 'amber'));
  } else addLog(cur.soId, log(`${cur.docNumber} needs new transport`, `Trip ${cur.number} (${cur.kind}) was cancelled: ${reason}`, 'amber'));
}
/** While Assigned, the dispatcher can change the vehicle or driver. Returns the reason when the change is not allowed. */
export function reassignTrip(t: Trip, vehicleId: string, driver: string, mobile?: string): string | undefined {
  const cur = getTrip(t.id) ?? t;
  if (cur.status !== 'Assigned' || cur.transport !== 'Own Fleet') return 'Only an Assigned own-fleet trip can be reassigned';
  const err = transportError({ transport: 'Own Fleet', vehicleId }, cur.date, cur.id);
  if (err) return err;
  const v = assetById(vehicleId);
  saveTrip(t.id, (x) => ({ ...x, vehicleId, plate: v?.plateNumber, driver, mobile, log: tlog(x, 'Vehicle / driver reassigned', `${v?.plateNumber ?? '-'}, ${driver || 'no driver'}`, 'blue') }));
  return undefined;
}
/** Own vehicle not available: the job moves to an external transporter (a supplier) and the own vehicle is freed. Returns the reason when the change is not allowed. */
export function switchToExternal(t: Trip, transporter: string, cost: number, driverName?: string): string | undefined {
  const cur = getTrip(t.id) ?? t;
  if (cur.status !== 'Assigned' || cur.transport !== 'Own Fleet') return 'Only an Assigned own-fleet trip can move to an external transporter';
  if (!transporter.trim()) return 'Select the supplier who transports';
  if (!(cost > 0)) return 'External Transport Cost is required for an external transporter';
  const expenses = [...cur.expenses, { type: 'Transport Charge', amount: cost, date: TODAY, note: 'Switched from own fleet' }];
  const driver = driverName?.trim() || undefined;
  saveTrip(t.id, (x) => ({ ...x, transport: 'External Transporter', transporter, transporterDriver: driver, vehicleId: undefined, plate: undefined, driver: undefined, mobile: undefined, expenses, log: tlog(x, 'Switched to an external transporter', `${transporter}${driver ? `, driver ${driver}` : ''}, Transport Charge AED ${cost}. Own vehicle ${x.plate ?? ''} freed`, 'amber') }));
  bookCost(t.soId, cost, `Trip ${t.number} moved to ${transporter}`, `Transport Charge AED ${cost}`, 'amber');
  return undefined;
}
/** A Delivery Order whose trip was cancelled gets a new trip (own vehicle or external transporter). Returns the reason when it cannot be saved. */
export function arrangeDeliveryTransport(deliveryId: string, i: TransportInput & { date: string }): string | undefined {
  const d = all<Delivery>(COL.deliveries).find((x) => x.id === deliveryId);
  if (!d) return 'Delivery Order not found';
  const err = transportError(i, i.date);
  if (err) return err;
  createTrip({ kind: 'Delivery', doc: { id: d.id, number: d.number }, soId: d.soId, ...i });
  return undefined;
}
export { tripTotal };

/** Close is blocked while any linked delivery is still unreturned. */
export function closeOrder(o: SalesOrder): { ok: boolean; message: string } {
  const out = o.lines.flatMap((l) => outstanding(l));
  if (out.length) return { ok: false, message: `${out.length} delivered asset(s) are still unreturned, so the order cannot be closed` };
  saveOrder(o.id, (x) => ({ ...x, status: 'Closed', log: [log('Sales Order closed'), ...x.log] }));
  return { ok: true, message: 'Sales Order closed' };
}
export const confirmOrder = (o: SalesOrder) => saveOrder(o.id, (x) => ({ ...x, status: 'Confirmed', log: [log('Sales Order confirmed', 'Commercial terms frozen'), ...x.log] }));

export { availability };

/* ------------------------------------------------------------------ AMC: job cards (one per visit), invoiced separately */
export const jobCardsOf = (soId: string) => all<JobCard>(COL.jobCards).filter((j) => j.soId === soId).sort((a, b) => a.visitIdx - b.visitIdx);
/** A new job card for a visit, not saved yet (the form saves it). */
export function draftJobCard(soId: string, visitIdx: number): JobCard | undefined {
  const o = getOrder(soId);
  const v = o?.visitPlan?.[visitIdx];
  if (!o || !v) return undefined;
  return { id: '', number: 'Assigned on save', soId, soNumber: o.number, customerId: o.customerId, visitIdx, plannedDate: v.date, technician: o.owner, location: vanLocationsFor(o.owner)[0] ?? '', item: o.lines[0]?.item ?? 'AMC',
    materials: [], services: [], notes: '', visitAmount: v.amount ?? 0, status: 'Open', log: [] };
}
/** Saves the job card of a visit (one per visit; an existing one is returned as is). */
export function createJobCard(soId: string, visitIdx: number, fields: Partial<JobCard> = {}): string {
  const existing = all<JobCard>(COL.jobCards).find((j) => j.soId === soId && j.visitIdx === visitIdx);
  if (existing) return existing.id;
  const base = draftJobCard(soId, visitIdx)!;
  const id = uid('jc');
  const jc: JobCard = { ...base, ...fields, id, number: nextNumber('JC', 126), soId, visitIdx, status: 'Open', log: [log(`Job card created for visit ${visitIdx + 1}`)] };
  put(COL.jobCards, jc);
  saveOrder(soId, (x) => ({ ...x, visitPlan: (x.visitPlan ?? []).map((p, k) => (k === visitIdx ? { ...p, jobCardId: id } : p)), log: [log(`Job card ${jc.number} created`, `AMC visit ${visitIdx + 1}`, 'blue'), ...x.log] }));
  return id;
}
export const saveJobCard = (jc: JobCard) => patch<JobCard>(COL.jobCards, jc.id, () => jc);
/** VAT on the material lines, each carrying its own rate (FOC lines are zero, both price and VAT). */
export const jobCardMaterialVat = (jc: JobCard) => jc.materials.reduce((s, m) => s + (m.foc ? 0 : (m.qty * m.price * (m.vat ?? 0)) / 100), 0);
/** FOC lines (Chargeable Override) are not billed; a FOC material line's price is zero, not just excluded here. */
export const jobCardTotal = (jc: JobCard) => (jc.visitFoc ? 0 : jc.visitAmount) + jc.materials.reduce((s, m) => s + (m.foc ? 0 : m.qty * m.price), 0) + jobCardMaterialVat(jc) + jc.services.reduce((s, m) => s + (m.foc ? 0 : m.amount), 0);
/** Value given free of cost on a job card: the visit share (FOC visit) plus FOC materials and services. */
export const jobCardFoc = (jc: JobCard) => (jc.visitFoc ? jc.visitAmount : 0) + jc.materials.reduce((s, m) => s + (m.foc ? m.qty * m.price : 0), 0) + jc.services.reduce((s, m) => s + (m.foc ? m.amount : 0), 0);
export const jobCardCost = (jc: JobCard) => jc.materials.reduce((s, m) => s + m.qty * (m.cost ?? Math.round(m.price * 0.7 * 100) / 100), 0);
/* Stock per location, kept in Inventory (collection inventory.locationStock). */
const LOC_STOCK = 'inventory.locationStock';
const stockRows = () => { seedCollection(LOC_STOCK, locationStockSeed); seedCollection('items', itemSeed); return { rows: all<LocationStock>(LOC_STOCK), items: all<ItemRec>('items') }; };
/** What a location (e.g. a technician's service van) holds right now, by item. */
export function stockAt(location?: string): { name: string; unit: string; qty: number }[] {
  if (!location) return [];
  const { rows, items } = stockRows();
  return rows.filter((r) => r.location === location && r.qty > 0).flatMap((r) => { const it = items.find((i) => i.id === r.itemId); return it ? [{ name: it.name, unit: it.unit, qty: r.qty }] : []; });
}
/** Materials used on a visit leave the van's stock (and the item's total). */
function consumeAt(location: string, materials: JobCard['materials']) {
  const { rows, items } = stockRows();
  const used = (name: string) => materials.filter((m) => m.item === name).reduce((s, m) => s + m.qty, 0);
  setCollection(LOC_STOCK, rows.map((r) => { const it = items.find((i) => i.id === r.itemId); const q = it && r.location === location ? used(it.name) : 0; return q ? { ...r, qty: Math.max(0, r.qty - q) } : r; }));
  setCollection('items', items.map((i) => { const q = used(i.name); return q ? { ...i, stock: Math.max(0, i.stock - q) } : i; }));
}
export function completeJobCard(jc: JobCard) {
  if (jc.location && jc.materials.length) consumeAt(jc.location, jc.materials);
  patch<JobCard>(COL.jobCards, jc.id, (x) => ({ ...x, status: 'Completed', doneOn: TODAY, log: [...x.log, log('Visit completed', jc.materials.length ? `Materials drawn from ${jc.location}; services recorded` : 'Materials and services recorded', 'green')] }));
  saveOrder(jc.soId, (o) => ({ ...o, visitPlan: (o.visitPlan ?? []).map((v, k) => (k === jc.visitIdx ? { ...v, done: TODAY, ref: jc.number, type: 'Job card' } : v)), log: [log(`AMC visit ${jc.visitIdx + 1} completed`, jc.number, 'green'), ...o.log] }));
}
/** Generate, Invoice: a real sales invoice in Accounting, created Pending (D4). The job card is locked once invoiced. */
export function invoiceJobCard(jc: JobCard): { number: string; id: string } {
  const inv = invoiceFromJobCard(jc);
  patch<JobCard>(COL.jobCards, jc.id, (x) => ({ ...x, status: 'Invoiced', invoiceRef: inv.number, invoiceId: inv.id, paymentStatus: undefined, log: [...x.log, log('Invoice raised', `${inv.number}, total AED ${jobCardTotal(jc)}${jobCardFoc(jc) ? `, free of cost AED ${jobCardFoc(jc)}${jc.visitFoc ? ' (FOC visit)' : ''}` : ''}. Pending approval in Accounting`, 'blue')] }));
  saveOrder(jc.soId, (o) => ({ ...o, log: [log(`Job card ${jc.number} invoiced`, `${inv.number}, AED ${jobCardTotal(jc)}`, 'blue'), ...o.log] }));
  return { number: inv.number, id: inv.id };
}
