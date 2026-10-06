import dayjs from 'dayjs';
import { getCollection, nextNumber, seedCollection, setCollection } from '@/store/store';
import { customers } from '@/mock-data/masters';
import { currentLocation, heavySeed, itemSeed, locationStockSeed, type ItemRec, type LocationStock } from '@/modules/inventory/data';
import { billDisputeCharge, billFromCrossHire, billFromTrip, invoiceFromDamage, invoiceFromJobCard, invoiceFromOrderLines, invoiceRentalPeriod } from '@/modules/accounting/engine';
import {
  ACTOR, COL, TODAY, vanLocationsFor, assetById, availability, custName, fleetRows, isRentalLine, log, mkLine, nowStamp, patchAsset,
  amcLine, docTotals, hasWaiver, isPeriodic, masterValues, planVisits, plusYear, yearEnd, type ActivityType, TRIP_SEED_N, fleetStatus, isOpenTrip, tripTotal, type Trip, type TripExpense, type TripKind,
  type CrossHire, type CrossHireRequest, type CrossHireRfq, type RfqResponse, type Delivery, type DoItem, type JobCard, type Extension, type HeavyRec, type Lead, type Line, type LogItem, type Opportunity, type Quotation, type Replacement, type ReturnEntry, type SalesOrder,
} from './data';

/* Small collection helpers (modules share the same in-memory collections through the store). */
const all = <T,>(name: string) => getCollection<T>(name);
const put = <T extends { id: string }>(name: string, row: T) => setCollection(name, [row, ...all<T>(name)]);
const patch = <T extends { id: string }>(name: string, id: string, fn: (r: T) => T) => setCollection(name, all<T>(name).map((r) => (r.id === id ? fn(r) : r)));
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
    if (outstanding(l).length) return deliveredQty(l) >= l.qty ? 'On Hire' : 'Partially Delivered';
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
    id, number: nextNumber('OP', 30), date: TODAY, customerId: customer?.id ?? 'c1', contact: l.contact, project: '', owner: l.owner, title: `${l.activity}: ${l.company}`, activity: l.activity, stage: 'Enquiry', rating: 'Warm',
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
    : [act === 'Rental' ? mkLine({ activity: 'Rental', item: '', group: 'Generator', frequency: 'Monthly', start: TODAY, end }) : act === 'AMC' ? amcLine(o.estimated || 0) : mkLine({ activity: act, item: '' })];
  const quote: Quotation = {
    id, number: nextNumber('QT', 90), date: TODAY, oppId: o.id, customerId: o.customerId, activity: act, entity: masterValues('entity')[0], paymentTerms: '30 days', currency: 'AED',
    contractType: act === 'Rental' ? 'Open PO' : undefined, contractStart: act === 'Rental' ? TODAY : undefined, contractEnd: act === 'Rental' ? end : undefined,
    amcStart: act === 'AMC' ? TODAY : undefined, amcEnd: act === 'AMC' ? plusYear(TODAY) : undefined, visits: act === 'AMC' ? 4 : undefined, amcValue: act === 'AMC' ? o.estimated || 0 : undefined,
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
  put(COL.quotes, { ...q, id, number: nextNumber('QT', 90), version: q.version + 1, prevId: q.id, status: 'Draft', date: TODAY, salesOrderId: undefined, log: [log(`Revision ${q.version + 1} created`, `From ${q.number}; previous version retained in full`)] });
  patch<Quotation>(COL.quotes, q.id, (x) => ({ ...x, status: 'Revised', log: [log('Superseded by a revision'), ...x.log] }));
  patch<Opportunity>(COL.opps, q.oppId, (x) => ({ ...x, quotationId: id }));
  return id;
}

export function orderFromQuotation(q: Quotation): string {
  const id = uid('so');
  const opp = all<Opportunity>(COL.opps).find((o) => o.id === q.oppId);
  const order: SalesOrder = {
    id, number: nextNumber('SO', 55), date: TODAY, quoteId: q.id, oppId: q.oppId, customerId: q.customerId, owner: opp?.owner ?? q.preparedBy, title: opp?.title ?? q.description, reference: opp?.lpo ?? '', status: 'Confirmed',
    activity: q.activity, entity: q.entity, paymentTerms: q.paymentTerms, currency: q.currency, contractType: q.contractType, contractStart: q.contractStart, contractEnd: q.contractEnd, billingStructure: q.billingStructure,
    amcStart: q.amcStart, amcEnd: q.amcEnd, visits: q.visits, visitPlan: q.activity === 'AMC' ? planVisits(q.amcStart, q.amcEnd, q.visits, docTotals(q.lines, q.discountPct, q.vatType).sub) : undefined,
    lpo: '', lpoDate: '', lpoExpiry: q.contractEnd ?? q.amcEnd ?? '', site: opp?.site ?? '', costCentre: q.costCentre ?? '', deliveryMethod: 'Own Fleet', vatType: q.vatType, discountPct: q.discountPct, terms: q.terms,
    lines: q.lines.map((l) => ({ ...l, id: uid('ln'), assigned: [], crossHire: [], fulfilment: undefined })), docs: [], damageCharges: [], logisticsCost: 0,
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
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number; serviceLineIds?: string[];
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
  const o = getOrder(i.soId)!;
  const id = uid('dl');
  const rentalItems = i.items.filter((it) => getLine(o, it.lineId)?.activity === 'Rental');
  const first = rentalItems[0] ?? i.items[0];
  const firstLine = getLine(o, first.lineId);
  const hold = rentalItems.length > 0 && i.rentalStart.slice(0, 10) > i.date.slice(0, 10);
  const saleItems = i.items.filter((it) => getLine(o, it.lineId)?.activity === 'Fixed Asset Trading');
  const allAssets = [...rentalItems, ...saleItems].flatMap((it) => it.assetIds);
  const d: Delivery = { id, number: i.number || nextNumber('DO', 132), soId: o.id, soNumber: o.number, lineId: first.lineId, customerId: o.customerId, date: i.date, type: i.type, assetIds: allAssets, accessories: i.accessories ?? [], description: i.description,
    transport: i.transport, extCost: i.extCost, conditionFiles: i.conditionFiles, signature: i.signature, foc: i.foc, status: i.status, closed: false, driver: i.driver, vehicle: i.vehicleId ?? i.vehicle, narration: i.narration,
    rentalStart: i.rentalStart, startReason: i.startReason, startBy: i.startBy, waitingCharge: i.waitingCharge, requestedSub: firstLine?.category, deliveredSub: first.deliveredSub ?? firstLine?.category, serviceLineIds: i.serviceLineIds, siteReady: !hold,
    items: i.items, reference: i.reference, poNumber: i.poNumber, poDate: i.poDate, location: i.location, operationType: 'Delivery', project: i.project ?? o.costCentre, supplierDoNo: i.supplierDoNo, transportedBy: i.transportedBy, vehicleNumber: (i.vehicleId ? assetById(i.vehicleId)?.plateNumber : undefined) ?? i.vehicleNumber, iqama: i.iqama, mobile: i.mobile, department: i.department, salesperson: i.salesperson };
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
      const ch = all<CrossHire>(COL.crossHire).find((c) => c.assetId === hid && c.stage < 2);
      if (ch) patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 2, soId: o.id, soNumber: o.number, lineId: first.lineId, history: [...c.history, log(`Allocated to ${o.number}`, `Delivery ${d.number}`)] }));
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
export function raiseCrossHire(soId: string, lineId: string, supplierId?: string, supplier?: string, rate = 0): string {
  const o = getOrder(soId)!;
  const l = getLine(o, lineId)!;
  const id = uid('chr');
  const rec: CrossHireRequest = { id, number: nextNumber('CHR', 7), date: TODAY, soId, soNumber: o.number, lineId, group: l.group ?? '', category: l.category ?? '', qty: l.qty, frequency: l.frequency ?? 'Monthly', rate, vendorId: supplierId, vendor: supplier,
    company: o.entity, representative: o.owner, currency: o.currency, narration: `No owned ${l.group} ${l.category} unit available for ${o.number}`, location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Pending',
    log: [log(`Request raised from ${o.number}`, `${l.group} ${l.category}, quantity ${l.qty}`)] };
  put(COL.chRequests, rec);
  saveOrder(soId, (x) => ({ ...mapLine(x, lineId, (ln) => ({ ...ln, crossHire: [...ln.crossHire, id] })), log: [log(`Cross-Hire request ${rec.number} raised`, `${l.group} ${l.category}`, 'blue'), ...x.log] }));
  return id;
}
export function saveChRequest(r: CrossHireRequest) { patch<CrossHireRequest>(COL.chRequests, r.id, () => r); }
export function submitChRequest(id: string) { patch<CrossHireRequest>(COL.chRequests, id, (r) => ({ ...r, status: 'In Progress', log: [...r.log, log('Submitted and approved', undefined, 'green')] })); }
const chReqs = (ids: string[]) => ids.map((i) => all<CrossHireRequest>(COL.chRequests).find((r) => r.id === i)).filter(Boolean) as CrossHireRequest[];

/** Step 2: Create > RFQ from one or more In Progress requests (from the request view or the Process Cross Hire screen). */
export function createChRfq(i: { requestIds: string[]; vendorIds: string[]; orderDeadline: string; expectedDate: string; narration?: string; paymentTerms?: string }): string {
  const rs = chReqs(i.requestIds);
  const first = rs[0];
  const id = uid('rfq');
  const rec: CrossHireRfq = { id, number: nextNumber('RFQ', 12), date: TODAY, requestIds: i.requestIds, soNumbers: [...new Set(rs.map((r) => r.soNumber))], group: first?.group ?? '', category: first?.category ?? '', qty: rs.reduce((t, r) => t + r.qty, 0), vendorIds: i.vendorIds,
    orderDeadline: i.orderDeadline, expectedDate: i.expectedDate, currency: first?.currency ?? 'AED', paymentTerms: i.paymentTerms ?? 'Net 30', narration: i.narration ?? '', status: 'Open', responses: [], log: [log('RFQ created', `From ${rs.map((r) => r.number).join(', ') || 'a manual entry'}`)] };
  put(COL.chRfqs, rec);
  rs.forEach((r) => patch<CrossHireRequest>(COL.chRequests, r.id, (x) => ({ ...x, status: 'Completed', rfqId: id, log: [...x.log, log(`RFQ ${rec.number} created`)] })));
  return id;
}
export function sendChRfq(id: string) { patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: 'RFQ Sent', log: [...r.log, log(`RFQ sent to ${r.vendorIds.length} supplier(s)`)] })); }
export function addChResponse(id: string, resp: RfqResponse) {
  patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, status: 'Response Received', responses: [...r.responses.filter((x) => x.vendorId !== resp.vendorId), resp], log: [...r.log, log(`Response received from ${resp.vendor}`, `Rate AED ${resp.rate}, lead time ${resp.leadTime} days`)] }));
}
export function awardChRfq(id: string, vendorId: string, comment: string) {
  patch<CrossHireRfq>(COL.chRfqs, id, (r) => ({ ...r, awardedVendorId: vendorId, awardComment: comment, log: [...r.log, log(`Awarded to ${r.responses.find((x) => x.vendorId === vendorId)?.vendor}`, comment || undefined, 'green')] }));
}

/** Step 3: the Cross Hire Order (Hire Order). Created from a request, from several requests (Process screen) or from an awarded RFQ. */
export function createHireOrder(i: { requestIds: string[]; rfqId?: string; supplierId: string; supplier: string; rate: number; type: 'Inventory' | 'Dropship'; start?: string; end?: string; qty?: number }): string {
  const rs = chReqs(i.requestIds);
  const first = rs[0];
  const o = getOrder(first?.soId);
  const l = o && first ? getLine(o, first.lineId) : undefined;
  const id = uid('ch');
  const number = nextNumber('CH', 10);
  const qty = i.qty ?? (rs.reduce((t, r) => t + r.qty, 0) || 1);
  const rec: CrossHire = { id, number, soId: first?.soId ?? '', soNumber: [...new Set(rs.map((r) => r.soNumber))].join(', '), lineId: first?.lineId ?? '', group: first?.group ?? '', category: first?.category ?? '', supplierId: i.supplierId, supplier: i.supplier, rate: i.rate * qty, stage: 0,
    revenue: l ? l.price * qty : 0, date: TODAY, type: i.type, requestIds: i.requestIds, rfqId: i.rfqId, status: 'Approved', receiving: 'Pending Receiving', billing: 'Pending Billing', expenses: [], qty, confirmationDate: TODAY, expectedReceipt: TODAY, paymentTerms: 'Net 30', startDate: i.start ?? l?.start, endDate: i.end ?? l?.end,
    history: [log('Request', `${rs.map((r) => r.number).join(', ') || 'Order'} ${i.rfqId ? 'via RFQ award' : 'direct order'}; ${i.type}`), log('Order created', `${number} with ${i.supplier} at AED ${i.rate} per unit`, 'blue')] };
  put(COL.crossHire, rec);
  rs.forEach((r) => patch<CrossHireRequest>(COL.chRequests, r.id, (x) => ({ ...x, status: 'Completed', orderId: id, vendorId: i.supplierId, vendor: i.supplier, rate: i.rate, log: [...x.log, log(`Order ${number} created`, i.supplier)] })));
  if (i.rfqId) patch<CrossHireRfq>(COL.chRfqs, i.rfqId, (r) => ({ ...r, status: 'Order', orderId: id, log: [...r.log, log(`Order ${number} created`)] }));
  if (first) addLog(first.soId, log(`Cross-hire order ${number}`, `${i.supplier}, ${i.type}`, 'blue'));
  return id;
}
export function addChExpense(id: string, e: { account: string; amount: number; note: string }) { patch<CrossHire>(COL.crossHire, id, (c) => ({ ...c, expenses: [...(c.expenses ?? []), e], history: [...c.history, log(`Expense added: ${e.account}`, `AED ${e.amount}`)] })); }
/** Dropship: the supplier ships straight to the client site, so there is no goods receipt and no register entry. */
export function markChShipped(ch: CrossHire) { patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 2, status: 'Shipped', receiving: 'Not applicable (Dropship)', history: [...c.history, log('Marked shipped to the client site', 'Dropship: no goods receipt, no register entry', 'blue')] })); }
export function receiveCrossHire(ch: CrossHire, supplierInvoice: string, supplierInvoiceDate: string = TODAY) {
  const tpl = heavySeed.find((h) => h.id === 'he27')!;
  const n = fleetRows().length;
  const assetId = `AST-${1100 + n}`;
  const a: HeavyRec = { ...tpl, id: uid('he'), code: `ITM-${String(100 + n).padStart(4, '0')}`, assetId, name: `Diesel ${ch.group} ${ch.category} ${ch.supplier.split(' ')[0]} Cross-Hire`, category: ch.group, subCategory: ch.category, capacity: ch.category, supplier: ch.supplier, ownership: 'Cross-Hired',
    assetStatus: 'Ready for Hire', crossHireIdle: false, assetValue: 0, nbv: 0, deprPct: 0, deprAmount: 0, capex: 0, utilization: 0, idleDays: 0, profitability: 0, purchaseDate: TODAY, putToUseDate: TODAY, usefulLifeYears: 0, engineNo: `XH-${Date.now().toString().slice(-6)}`, image: undefined, attachments: [],
    movements: [{ id: uid('m'), entryNo: `MV-26-${9100 + n}`, date: `${TODAY}T${dayjs().format('HH:mm')}`, type: 'Cross-Hire Stage Change', from: `Supplier: ${ch.supplier}`, to: 'Jebel Ali Main Yard', reference: ch.number, by: ACTOR }],
    audit: [{ when: nowStamp(), title: 'Cross-hired asset received', detail: `${ch.number} from ${ch.supplier}. No depreciation is posted`, by: ACTOR }], insurance: [] };
  setCollection(COL.fleet, [a, ...fleetRows()]);
  const bill = billFromCrossHire(ch, supplierInvoice, supplierInvoiceDate);
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 1, status: 'Received', receiving: 'Fully Received', billing: 'Fully Billed', assetId: a.id, supplierInvoice, history: [...c.history, log(`Received into our custody as ${assetId}`, `Supplier invoice ${supplierInvoice}`), log(`Bill ${bill.number} raised`, 'Pending approval in Accounting', 'blue')] }));
}
/** Dropship (or a bill not raised on receipt): the supplier invoice is entered here and a Pending bill is created. */
export function billCrossHire(ch: CrossHire, supplierInvoice: string, supplierInvoiceDate: string = TODAY): string {
  const bill = billFromCrossHire(ch, supplierInvoice, supplierInvoiceDate);
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, supplierInvoice, billing: 'Fully Billed', history: [...c.history, log(`Bill ${bill.number} raised`, `Supplier invoice ${supplierInvoice}. Pending approval in Accounting`, 'blue')] }));
  return bill.number;
}
export function returnToUs(ch: CrossHire, notes: string, files: string[]) {
  if (ch.assetId) patchAsset(ch.assetId, { assetStatus: 'Yard', crossHireIdle: true }, { title: 'Returned to us', detail: notes }, { type: 'Cross-Hire Stage Change', from: whereIs(ch.assetId, 'Client site'), to: 'Jebel Ali Main Yard', reference: ch.number });
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 3, condition: { notes, files }, history: [...c.history, log('Returned to us', `Condition check completed: ${notes}`, 'amber')] }));
}
export function returnToSupplier(ch: CrossHire, dispute: number, reissueRef?: string) {
  if (ch.assetId) patchAsset(ch.assetId, { assetStatus: 'Off Hire', status: 'Inactive', crossHireIdle: false }, { title: 'Returned to supplier', detail: dispute ? `Supplier dispute charge AED ${dispute}` : undefined }, { type: 'Cross-Hire Stage Change', from: whereIs(ch.assetId), to: `Supplier: ${ch.supplier}`, reference: ch.number });
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 4, status: 'Closed', dispute: dispute || undefined, reissueRef, history: [...c.history, log('Returned to supplier', dispute ? `Dispute charge AED ${dispute} recorded and traced to ${c.soNumber}` : 'Loop closed', 'green')] }));
  if (dispute) {
    const b = billDisputeCharge(ch, dispute);
    patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, history: [...c.history, log(`Supplementary bill ${b.number} raised`, `Dispute charge AED ${dispute}, pending approval in Accounting`, 'blue')] }));
    addLog(ch.soId, log(`Cross-hire dispute charge AED ${dispute}`, `${ch.number}, rolled into the order's profitability. Bill ${b.number}`, 'red'));
  }
}

/* ------------------------------------------------------------------ Rental: replacement */
export function replaceAsset(i: { soId: string; lineId: string; oldId: string; newId: string; reason: string; priceAdjust: number; notified: boolean; crossHireId?: string; transport?: TransportInput }): Replacement {
  const o = getOrder(i.soId)!;
  const oldA = assetById(i.oldId)!;
  const newA = assetById(i.newId)!;
  const old = getLine(o, i.lineId)!.assigned.find((a) => a.assetId === i.oldId && a.state !== 'Replaced')!;
  const dest = `Client: ${custName(o.customerId)}`;
  const rec: Replacement = { id: uid('rp'), number: nextNumber('RP', 4), soId: o.id, lineId: i.lineId, oldAssetId: i.oldId, newAssetId: i.newId, reason: i.reason, priceAdjust: i.priceAdjust, notified: i.notified, date: TODAY, crossHireId: i.crossHireId, by: ACTOR };
  put(COL.replacements, rec);
  patchAsset(i.oldId, { assetStatus: 'Under Maintenance' }, { title: 'Replaced and sent to maintenance', detail: `${rec.number}: ${i.reason}` }, { type: 'Sent for Repair', from: dest, to: 'Workshop: Al Masaood Service Centre', reference: rec.number });
  patchAsset(i.newId, { assetStatus: 'On Hire', crossHireIdle: false }, { title: 'Asset Status changed', detail: `Ready for Hire to On Hire (${rec.number})` }, { type: 'Delivery', from: whereIs(i.newId), to: dest, reference: rec.number });
  const ch = all<CrossHire>(COL.crossHire).find((c) => c.assetId === i.newId && c.stage < 2);
  if (ch) patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 2, history: [...c.history, log(`Allocated to ${o.number} as a replacement`, rec.number)] }));
  saveOrder(o.id, (x) => ({
    ...mapLine(x, i.lineId, (l) => ({ ...l, assigned: [...l.assigned.map((a) => (a === old || (a.assetId === i.oldId && a.state === 'On Hire') ? { ...a, state: 'Replaced' as const, stop: TODAY } : a)), { assetId: i.newId, deliveryId: old.deliveryId, start: TODAY, state: 'On Hire' as const }] })),
    log: [log(`Replacement ${rec.number}: ${oldA.assetId} out, ${newA.assetId} in`, `${i.reason}. The invoice cycle is not paused by a replacement${i.priceAdjust ? `; price adjustment AED ${i.priceAdjust}` : ''}`, 'blue'), ...x.log],
  }));
  // One trip carries the new unit out and the old unit back.
  if (i.transport) createTrip({ kind: 'Replacement', doc: { id: rec.id, number: rec.number }, soId: o.id, date: `${TODAY}T${dayjs().format('HH:mm')}`, ...i.transport });
  return rec;
}

/* ------------------------------------------------------------------ Rental: expiry, extension, early termination */
/** Extension revises the SAME Sales Order header end date (decision 2) and the LPO expiry when it is earlier. */
export function applyExtension(i: { soId: string; lineId?: string; kind: 'Extension' | 'Early Termination'; newEnd: string; note: string; confirmedBy: string }): Extension {
  const o = getOrder(i.soId)!;
  const oldEnd = o.contractEnd ?? '';
  const rec: Extension = { id: uid('ex'), number: nextNumber('EX', 7), soId: i.soId, lineId: i.lineId, kind: i.kind, oldEnd, newEnd: i.newEnd, date: TODAY, note: i.note, clientConfirmedBy: i.confirmedBy,
    status: i.kind === 'Extension' ? 'Applied' : 'Pending Finance Adjustment' };
  put(COL.extensions, rec);
  const ext = i.kind === 'Extension';
  saveOrder(i.soId, (x) => ({
    ...x,
    contractEnd: ext ? i.newEnd : x.contractEnd,
    lpoExpiry: ext && (!x.lpoExpiry || x.lpoExpiry < i.newEnd) ? i.newEnd : x.lpoExpiry,
    lines: ext ? x.lines.map((l) => (isPeriodic(l) && (!l.end || l.end === oldEnd) ? { ...l, end: i.newEnd } : l)) : x.lines,
    log: [log(ext ? `Extension ${rec.number}: end date ${oldEnd} to ${i.newEnd}` : `Early Termination ${rec.number} requested`, ext ? 'The existing Sales Order is revised, no new order is created' : 'Finance decides the commercial adjustment manually (full committed amount or pro-rated)', ext ? 'green' : 'amber'), ...x.log],
  }));
  return rec;
}

/** AMC visit against the planned schedule: the scheduled visit is never billed, consumables and additional tasks are. */

/* ------------------------------------------------------------------ Rental: return and inspection */
export function raiseReturn(i: { soId: string; lineId: string; assetId: string; method: string; timestamp: string; siteChecklist: string[]; photos: string[]; fuelNote: string; transport?: TransportInput }): ReturnEntry {
  const o = getOrder(i.soId)!;
  const l = getLine(o, i.lineId)!;
  const as = l.assigned.find((a) => a.assetId === i.assetId && (a.state === 'On Hire' || a.state === 'Hold'))!;
  const d = all<Delivery>(COL.deliveries).find((x) => x.id === as.deliveryId);
  const base = (d?.number ?? 'DO-26-00000').replace('DO', 'CN');
  const number = all<ReturnEntry>(COL.returns).some((r) => r.number === base) ? `${base}-${all<ReturnEntry>(COL.returns).filter((r) => r.number.startsWith(base)).length + 1}` : base;
  const rec: ReturnEntry = { id: uid('rt'), number, soId: o.id, soNumber: o.number, customerId: o.customerId, lineId: i.lineId, deliveryId: as.deliveryId, assetId: i.assetId, method: i.method, timestamp: i.timestamp, siteChecklist: i.siteChecklist,
    photos: i.photos, fuelNote: i.fuelNote, stage: 2, yardChecklist: [], inspection: 'Pending Inspection', log: [log('Return entry raised', `Off-Hire. Billing stops at ${i.timestamp.replace('T', ' ')}`, 'amber'), log('Site check completed', `${i.siteChecklist.length} of 4 checks`), log(i.method === 'Company Collection' ? 'Collection arranged' : 'Client self-return', undefined)] };
  put(COL.returns, rec);
  patchAsset(i.assetId, { assetStatus: 'Off Hire' }, { title: 'Asset Status changed', detail: `On Hire to Off Hire (${number}). Rental invoicing stopped` });
  saveOrder(o.id, (x) => ({
    ...mapLine(x, i.lineId, (ln) => ({ ...ln, assigned: ln.assigned.map((a) => (a === as ? { ...a, state: 'Returned' as const, stop: i.timestamp.slice(0, 10) } : a)) })),
    log: [log(`Return ${number}: ${assetById(i.assetId)?.assetId} off hire`, `Billing stopped at ${i.timestamp.replace('T', ' ')}`, 'amber'), ...x.log],
  }));
  // The originating Delivery Order closes automatically once none of its assets is still out.
  const after = getOrder(o.id)!;
  const stillOut = after.lines.some((ln) => ln.assigned.some((a) => a.deliveryId === as.deliveryId && (a.state === 'On Hire' || a.state === 'Hold')));
  if (!stillOut) patch<Delivery>(COL.deliveries, as.deliveryId, (x) => ({ ...x, closed: true }));
  // A Company Collection is a trip: our own vehicle or an external transporter.
  if (i.method === 'Company Collection' && i.transport) createTrip({ kind: 'Collection', doc: { id: rec.id, number: rec.number }, soId: o.id, date: i.timestamp, ...i.transport });
  return rec;
}
export function reachYard(r: ReturnEntry, yard: string) {
  patchAsset(r.assetId, { assetStatus: 'Yard' }, { title: 'Reached the yard', detail: `${r.number}: awaiting inspection` }, { type: 'Return', from: `Client: ${custName(r.customerId)}`, to: yard, reference: r.number, customer: custName(r.customerId), project: getOrder(r.soId)?.costCentre });
  patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, stage: 3, reachedYard: `${TODAY} ${dayjs().format('HH:mm')}`, log: [...x.log, log('Asset reached the yard', yard)] }));
}
export function inspect(r: ReturnEntry, result: 'Passed' | 'Damage Found', checklist: string[], damage?: { amount: number; note: string }) {
  const a = assetById(r.assetId)!;
  if (result === 'Passed') {
    patchAsset(r.assetId, { assetStatus: 'Ready for Hire', crossHireIdle: a.ownership === 'Cross-Hired' }, { title: 'Inspection passed', detail: `${r.number}: Yard to Ready for Hire` });
    patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, stage: 5, inspection: 'Passed', yardChecklist: checklist, outcome: 'Ready for Hire', log: [...x.log, log('Inspection passed', 'Operations Return Checklist complete. Asset is Ready for Hire', 'green')] }));
    return;
  }
  const waiver = hasWaiver(getOrder(r.soId)?.lines ?? []);
  patchAsset(r.assetId, { assetStatus: 'Under Maintenance' }, { title: 'Damage found at inspection', detail: `${r.number}: Yard to Under Maintenance` }, { type: 'Sent for Repair', from: whereIs(r.assetId), to: 'Workshop: Al Masaood Service Centre', reference: r.number });
  patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, stage: 5, inspection: 'Damage Found', yardChecklist: checklist, damageCharge: waiver ? 0 : damage?.amount, damageNote: damage?.note, waiverApplied: waiver, outcome: 'Repair / Maintenance',
    log: [...x.log, log('Damage found', waiver ? `Covered by the damage waiver paid on ${r.soNumber}: no damage invoice to the client, repair cost borne by the company. ${damage?.note ?? ''}` : `Charge AED ${damage?.amount}: ${damage?.note}`, 'red')] }));
  saveOrder(r.soId, (o) => ({
    ...o,
    damageCharges: waiver ? o.damageCharges : [...o.damageCharges, { assetId: r.assetId, amount: damage?.amount ?? 0, note: damage?.note ?? '', date: TODAY }],
    log: [log(waiver ? 'Damage covered by damage waiver' : `Damage charge AED ${damage?.amount}`, `${a.assetId}: ${damage?.note}${waiver ? '. Damage invoice blocked because a waiver was paid' : '. Linked permanently to this order'}`, 'red'), ...o.log],
  }));
}

/** Collection failed: charge the client or book it as a company loss. */
export function failedCollection(r: ReturnEntry, by: string, amount: number, note: string) {
  patch<ReturnEntry>(COL.returns, r.id, (x) => ({ ...x, collection: { by, amount, note }, log: [...x.log, log('Collection failed', `${by === 'Client' ? `Charged to client AED ${amount}` : 'Company loss'}: ${note}`, 'red')] }));
  saveOrder(r.soId, (o) => ({ ...o, damageCharges: by === 'Client' && amount ? [...o.damageCharges, { assetId: r.assetId, amount, note: `Failed collection: ${note}`, date: TODAY }] : o.damageCharges, log: [log('Collection failed', `${by === 'Client' ? `Client charged AED ${amount}` : 'Booked as company loss'}. ${note}`, 'red'), ...o.log] }));
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
/** A vehicle can be picked for a trip only when it is Free (one open trip per vehicle). */
export const vehicleIsFree = (vehicleId?: string, exceptTripId?: string) => {
  const a = assetById(vehicleId ?? '');
  if (!a) return false;
  const trips = all<Trip>(COL.trips).filter((t) => t.id !== exceptTripId);
  return fleetStatus(a, trips) === 'Free';
};
export function createTrip(i: { kind: TripKind; doc: { id: string; number: string }; soId: string; date: string } & TransportInput): Trip {
  const o = getOrder(i.soId)!;
  const v = i.vehicleId ? assetById(i.vehicleId) : undefined;
  const own = i.transport === 'Own Fleet';
  const charge = !own && i.charge ? i.charge : 0;
  const t: Trip = {
    id: uid('tr'), number: tripNo(), date: i.date, kind: i.kind, docId: i.doc.id, docNumber: i.doc.number, soId: o.id, soNumber: o.number, customerId: o.customerId, site: o.site, costCentre: o.costCentre,
    transport: i.transport, vehicleId: own ? i.vehicleId : undefined, plate: own ? v?.plateNumber : undefined, driver: own ? i.driver : undefined, mobile: own ? i.mobile : undefined, transporter: own ? undefined : i.transporter,
    status: 'Assigned', since: stamp(), expenses: charge ? [{ type: 'Transport Charge', amount: charge, date: TODAY, note: `Entered on ${i.doc.number}` }] : [], log: [],
  };
  t.log = [log('Trip created', own ? `${v?.plateNumber ?? '-'}${i.driver ? `, ${i.driver}` : ''} for ${i.doc.number}` : `External transporter ${i.transporter ?? '-'} for ${i.doc.number}${charge ? `, Transport Charge AED ${charge}` : ''}`)];
  put(COL.trips, t);
  saveOrder(o.id, (x) => ({ ...x, logisticsCost: x.logisticsCost + charge, log: [log(`Trip ${t.number} (${i.kind}) for ${i.doc.number}`, own ? `Own fleet ${v?.plateNumber ?? '-'}${i.driver ? `, driver ${i.driver}` : ''}` : `${i.transporter ?? 'External transporter'}${charge ? `, Transport Charge AED ${charge}` : ''}`, 'blue'), ...x.log] }));
  return t;
}
export const startTrip = (t: Trip) => saveTrip(t.id, (x) => ({ ...x, status: 'En Route', since: stamp(), log: tlog(x, 'Trip started', undefined, 'blue') }));
export function markStuck(t: Trip, reason: string, responsible: 'Company' | 'Client') {
  saveTrip(t.id, (x) => ({ ...x, status: 'Stuck-Delayed', since: stamp(), stuck: { reason, responsible, since: stamp() }, log: tlog(x, 'Marked Stuck-Delayed', `${reason}. Responsible: ${responsible}`, 'red') }));
  saveOrder(t.soId, (o) => ({ ...o, log: [log(`Trip ${t.number} is Stuck-Delayed`, `${reason}. Responsible: ${responsible}`, 'red'), ...o.log] }));
}
export const resumeTrip = (t: Trip) => saveTrip(t.id, (x) => ({ ...x, status: 'En Route', since: stamp(), stuck: undefined, log: tlog(x, 'Resumed', `Was stuck: ${x.stuck?.reason ?? '-'}`, 'blue') }));
export function addTripExpense(t: Trip, e: Omit<TripExpense, 'date'> & { date?: string }) {
  const exp: TripExpense = { ...e, date: e.date ?? TODAY };
  saveTrip(t.id, (x) => ({ ...x, expenses: [...x.expenses, exp], log: tlog(x, `Expense added: ${exp.type}`, `AED ${exp.amount}${exp.note ? `, ${exp.note}` : ''}`) }));
  bookCost(t.soId, exp.amount, `Trip ${t.number}: ${exp.type} AED ${exp.amount}`, 'Added to the order logistics cost');
}
export function removeTripExpense(t: Trip, idx: number) {
  const exp = t.expenses[idx];
  if (!exp) return;
  saveTrip(t.id, (x) => ({ ...x, expenses: x.expenses.filter((_, k) => k !== idx), log: tlog(x, `Expense removed: ${exp.type}`, `AED ${exp.amount}`, 'amber') }));
  bookCost(t.soId, -exp.amount, `Trip ${t.number}: ${exp.type} AED ${exp.amount} removed`, 'Taken off the order logistics cost', 'amber');
}
/** Complete frees the vehicle. Expenses entered at the end of the trip (Salik, fuel...) are posted to the order. */
export function completeTrip(t: Trip, expenses: Omit<TripExpense, 'date'>[] = []) {
  const add = expenses.filter((e) => e.type && e.amount > 0).map((e): TripExpense => ({ ...e, date: TODAY }));
  const total = add.reduce((s, e) => s + e.amount, 0);
  saveTrip(t.id, (x) => ({ ...x, status: 'Completed', since: stamp(), stuck: undefined, expenses: [...x.expenses, ...add], log: tlog(x, 'Trip completed', add.length ? add.map((e) => `${e.type} AED ${e.amount}`).join(', ') : undefined, 'green') }));
  if (total) bookCost(t.soId, total, `Trip ${t.number} completed`, `${add.map((e) => `${e.type} AED ${e.amount}`).join(', ')} added to the logistics cost`);
  // An external transporter bills us: its Transport Charge becomes a Pending bill to the transporter (a supplier).
  const done = getTrip(t.id);
  const bill = done ? billFromTrip(done) : undefined;
  if (bill) saveTrip(t.id, (x) => ({ ...x, log: tlog(x, `Bill ${bill.number} raised to ${x.transporter}`, 'Pending approval in Accounting', 'blue') }));
}
export const cancelTrip = (t: Trip, reason: string) => saveTrip(t.id, (x) => ({ ...x, status: 'Cancelled', since: stamp(), stuck: undefined, log: tlog(x, 'Trip cancelled', reason, 'red') }));
/** While Assigned, the dispatcher can change the vehicle or driver. */
export function reassignTrip(t: Trip, vehicleId: string, driver: string, mobile?: string) {
  const v = assetById(vehicleId);
  saveTrip(t.id, (x) => ({ ...x, vehicleId, plate: v?.plateNumber, driver, mobile, log: tlog(x, 'Vehicle / driver reassigned', `${v?.plateNumber ?? '-'}, ${driver || 'no driver'}`, 'blue') }));
}
/** Own vehicle not available: the job moves to an external transporter (a supplier) and the own vehicle is freed. */
export function switchToExternal(t: Trip, transporter: string, cost: number) {
  const expenses = [...t.expenses, ...(cost ? [{ type: 'Transport Charge', amount: cost, date: TODAY, note: 'Switched from own fleet' }] : [])];
  saveTrip(t.id, (x) => ({ ...x, transport: 'External Transporter', transporter, vehicleId: undefined, plate: undefined, driver: undefined, mobile: undefined, expenses, log: tlog(x, 'Switched to an external transporter', `${transporter}${cost ? `, Transport Charge AED ${cost}` : ''}. Own vehicle ${x.plate ?? ''} freed`, 'amber') }));
  bookCost(t.soId, cost, `Trip ${t.number} moved to ${transporter}`, cost ? `Transport Charge AED ${cost}` : 'Own vehicle freed', 'amber');
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
  const jc: JobCard = { ...base, ...fields, id, number: nextNumber('JC', 118), soId, visitIdx, status: 'Open', log: [log(`Job card created for visit ${visitIdx + 1}`)] };
  put(COL.jobCards, jc);
  saveOrder(soId, (x) => ({ ...x, visitPlan: (x.visitPlan ?? []).map((p, k) => (k === visitIdx ? { ...p, jobCardId: id } : p)), log: [log(`Job card ${jc.number} created`, `AMC visit ${visitIdx + 1}`, 'blue'), ...x.log] }));
  return id;
}
export const saveJobCard = (jc: JobCard) => patch<JobCard>(COL.jobCards, jc.id, () => jc);
/** FOC lines (Chargeable Override) are not billed. */
export const jobCardTotal = (jc: JobCard) => (jc.visitFoc ? 0 : jc.visitAmount) + jc.materials.reduce((s, m) => s + (m.foc ? 0 : m.qty * m.price), 0) + jc.services.reduce((s, m) => s + (m.foc ? 0 : m.amount), 0);
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
