import dayjs from 'dayjs';
import { getCollection, nextNumber, setCollection } from '@/store/store';
import { customers } from '@/mock-data/masters';
import { heavySeed } from '@/modules/inventory/data';
import {
  ACTOR, COL, TODAY, assetById, availability, custName, fleetRows, isRentalLine, log, mkLine, nowStamp, patchAsset,
  hasWaiver, isPeriodic, masterValues, planVisits, plusYear, yearEnd, type ActivityType,
  type CrossHire, type Delivery, type DoItem, type Extension, type HeavyRec, type Lead, type Line, type LogItem, type Opportunity, type Quotation, type Replacement, type ReturnEntry, type SalesOrder,
} from './data';

/* Small collection helpers (modules share the same in-memory collections through the store). */
const all = <T,>(name: string) => getCollection<T>(name);
const put = <T extends { id: string }>(name: string, row: T) => setCollection(name, [row, ...all<T>(name)]);
const patch = <T extends { id: string }>(name: string, id: string, fn: (r: T) => T) => setCollection(name, all<T>(name).map((r) => (r.id === id ? fn(r) : r)));
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const getOrder = (id?: string) => all<SalesOrder>(COL.orders).find((o) => o.id === id);
export const getLine = (so: SalesOrder | undefined, lineId?: string) => so?.lines.find((l) => l.id === lineId);

/* ------------------------------------------------------------------ line state helpers */
export const deliveredQty = (l: Line) => l.assigned.filter((a) => a.state !== 'Replaced').length;
export const outstanding = (l: Line) => l.assigned.filter((a) => a.state === 'On Hire' || a.state === 'Hold');
export const lineState = (l: Line): string => {
  if (isRentalLine(l) && l.activity === 'Rental') {
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
  const lines = so.lines.filter((l) => l.activity !== 'AMC' && !(so.activity === 'Rental' && l.activity === 'Service'));
  const done = (l: Line) => (l.activity === 'Rental' ? deliveredQty(l) >= l.qty : !!l.fulfilment);
  const any = lines.some((l) => (l.activity === 'Rental' ? deliveredQty(l) > 0 : !!l.fulfilment));
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
    id, number: nextNumber('OP', 28), date: TODAY, customerId: customer?.id ?? 'c1', contact: l.contact, project: '', owner: l.owner, title: `${l.activity}: ${l.company}`, activity: l.activity, stage: 'Enquiry', rating: 'Warm',
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
    : [act === 'Rental' ? mkLine({ activity: 'Rental', item: '', group: 'Generator', frequency: 'Monthly', start: TODAY, end }) : mkLine({ activity: act, item: '' })];
  const quote: Quotation = {
    id, number: nextNumber('QT', 88), date: TODAY, oppId: o.id, customerId: o.customerId, activity: act, entity: masterValues('entity')[0], paymentTerms: '30 days', currency: 'AED',
    contractType: act === 'Rental' ? 'Open PO' : undefined, contractStart: act === 'Rental' ? TODAY : undefined, contractEnd: act === 'Rental' ? end : undefined,
    amcStart: act === 'AMC' ? TODAY : undefined, amcEnd: act === 'AMC' ? plusYear(TODAY) : undefined, visits: act === 'AMC' ? 4 : undefined,
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
  put(COL.quotes, { ...q, id, number: nextNumber('QT', 88), version: q.version + 1, prevId: q.id, status: 'Draft', date: TODAY, salesOrderId: undefined, log: [log(`Revision ${q.version + 1} created`, `From ${q.number}; previous version retained in full`)] });
  patch<Quotation>(COL.quotes, q.id, (x) => ({ ...x, status: 'Revised', log: [log('Superseded by a revision'), ...x.log] }));
  patch<Opportunity>(COL.opps, q.oppId, (x) => ({ ...x, quotationId: id }));
  return id;
}

export function orderFromQuotation(q: Quotation): string {
  const id = uid('so');
  const opp = all<Opportunity>(COL.opps).find((o) => o.id === q.oppId);
  const order: SalesOrder = {
    id, number: nextNumber('SO', 54), date: TODAY, quoteId: q.id, oppId: q.oppId, customerId: q.customerId, owner: opp?.owner ?? q.preparedBy, title: opp?.title ?? q.description, reference: opp?.lpo ?? '', status: 'Confirmed',
    activity: q.activity, entity: q.entity, paymentTerms: q.paymentTerms, currency: q.currency, contractType: q.contractType, contractStart: q.contractStart, contractEnd: q.contractEnd, billingStructure: q.billingStructure,
    amcStart: q.amcStart, amcEnd: q.amcEnd, visits: q.visits, visitPlan: q.activity === 'AMC' ? planVisits(q.amcStart, q.amcEnd, q.visits) : undefined,
    lpo: opp?.lpo ?? '', lpoDate: opp?.lpoDate ?? '', lpoExpiry: q.contractEnd ?? q.amcEnd ?? '', site: opp?.site ?? '', costCentre: '', deliveryMethod: 'Own Fleet', vatType: q.vatType, discountPct: q.discountPct, terms: q.terms,
    lines: q.lines.map((l) => ({ ...l, id: uid('ln'), assigned: [], crossHire: [], fulfilment: undefined })), docs: [], damageCharges: [], logisticsCost: 0,
    log: [log(`Sales Order created from ${q.number}`, 'Commercial terms are frozen; only a formal revision can change them')],
  };
  put(COL.orders, order);
  patch<Quotation>(COL.quotes, q.id, (x) => ({ ...x, status: 'Converted to Sales Order', salesOrderId: id, log: [log(`Converted to ${order.number}`), ...x.log] }));
  patch<Opportunity>(COL.opps, q.oppId, (x) => ({ ...x, stage: 'Won' }));
  return id;
}

/** Non-rental branches after the Sales Order: Trading/Fuel Trading -> Stock/Invoice, Service -> Charge/Invoice, AMC -> Visit/Billing. */
export const NEXT_STEP: Record<string, { label: string; done: string; options?: string[] }> = {
  Trading: { label: 'Issue Stock / Invoice', done: 'Stock issued and invoiced' },
  'Fuel Trading': { label: 'Issue Stock / Invoice', done: 'Fuel issued and invoiced' },
  Service: { label: 'Charge / Invoice', done: 'Charged and invoiced' },
  AMC: { label: 'Record Visit / Billing', done: 'Visit recorded', options: ['Scheduled visit (non-chargeable)', 'Consumable (chargeable)', 'Additional task (chargeable)'] },
  Other: { label: 'Charge / Invoice', done: 'Charged and invoiced' },
};
export function fulfilLine(soId: string, lineId: string, detail?: string): string {
  const o = getOrder(soId)!;
  const l = getLine(o, lineId)!;
  const step = NEXT_STEP[l.activity];
  const nonBill = detail?.includes('non-chargeable');
  const ref = l.activity === 'AMC' ? (nonBill ? `VISIT-26-${String(Math.floor(Math.random() * 90) + 10).padStart(5, '0')}` : nextNumber('INV', 415)) : nextNumber('INV', 415);
  saveOrder(soId, (x) => ({ ...mapLine(x, lineId, (ln) => ({ ...ln, fulfilment: step.done, fulfilmentRef: ref })), log: [log(`${l.activity} line: ${step.done}`, `${l.item}${detail ? ` (${detail})` : ''}, ref ${ref}`, 'green'), ...x.log] }));
  return ref;
}

/* ------------------------------------------------------------------ Rental: delivery */
export interface DeliveryInput {
  soId: string; date: string; type: string; items: DoItem[]; description: string; transport: string; extCost: number; conditionFiles: string[];
  signature: string; foc: boolean; status: string; number?: string; driver?: string; vehicle?: string; narration?: string;
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number; serviceLineIds?: string[];
  reference?: string; poNumber?: string; poDate?: string; location?: string; transportedBy?: string; vehicleNumber?: string; iqama?: string; mobile?: string; department?: string; salesperson?: string; accessories?: string[];
}
/**
 * One Delivery Order covers any number of Sales Order items. Rental items assign the exact serialized assets (billing starts on the Rental Start Date; when that is
 * after the delivery date the assets wait on Hold), other items are marked delivered and can then be invoiced.
 */
export function createDelivery(i: DeliveryInput): Delivery {
  const o = getOrder(i.soId)!;
  const id = uid('dl');
  const rentalItems = i.items.filter((it) => getLine(o, it.lineId)?.activity === 'Rental');
  const first = rentalItems[0] ?? i.items[0];
  const firstLine = getLine(o, first.lineId);
  const hold = rentalItems.length > 0 && i.rentalStart.slice(0, 10) > i.date.slice(0, 10);
  const allAssets = rentalItems.flatMap((it) => it.assetIds);
  const d: Delivery = { id, number: i.number || nextNumber('DO', 132), soId: o.id, soNumber: o.number, lineId: first.lineId, customerId: o.customerId, date: i.date, type: i.type, assetIds: allAssets, accessories: i.accessories ?? [], description: i.description,
    transport: i.transport, extCost: i.extCost, conditionFiles: i.conditionFiles, signature: i.signature, foc: i.foc, status: i.status, closed: false, driver: i.driver, vehicle: i.vehicle, narration: i.narration,
    rentalStart: i.rentalStart, startReason: i.startReason, startBy: i.startBy, waitingCharge: i.waitingCharge, requestedSub: firstLine?.category, deliveredSub: first.deliveredSub ?? firstLine?.category, serviceLineIds: i.serviceLineIds, siteReady: !hold,
    items: i.items, reference: i.reference, poNumber: i.poNumber, poDate: i.poDate, location: i.location, operationType: 'Delivery', transportedBy: i.transportedBy, vehicleNumber: i.vehicleNumber, iqama: i.iqama, mobile: i.mobile, department: i.department, salesperson: i.salesperson };
  put(COL.deliveries, d);
  const dest = `Client: ${custName(o.customerId)}`;
  allAssets.forEach((hid) => {
    const a = assetById(hid)!;
    patchAsset(hid, { assetStatus: hold ? 'Hold' : 'On Hire', crossHireIdle: false }, { title: 'Asset Status changed', detail: `${a.assetStatus} to ${hold ? 'Hold' : 'On Hire'} (${d.number})` }, { type: 'Delivery', from: 'Jebel Ali Main Yard', to: dest, reference: d.number });
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
      } else {
        lines = lines.map((y) => (y.id === it.lineId ? { ...y, fulfilment: 'Delivered', fulfilmentRef: d.number } : y));
      }
    });
    return {
      ...x, lines,
      logisticsCost: x.logisticsCost + (i.transport === 'External Transporter' ? i.extCost : 0),
      damageCharges: i.waitingCharge ? [...x.damageCharges, { assetId: allAssets[0], amount: i.waitingCharge, note: `Waiting period lump sum (${d.number})`, date: TODAY }] : x.damageCharges,
      log: [
        log(`Delivery ${d.number}: ${i.items.length} item(s)${allAssets.length ? `, ${allAssets.map((h) => assetById(h)?.assetId).join(', ')} ${hold ? 'on Hold' : 'on hire'}` : ''}`, hold ? `Rental starts ${i.rentalStart.slice(0, 10)}. ${i.startReason} (${i.startBy})${i.waitingCharge ? `, waiting charge AED ${i.waitingCharge}` : ''}` : allAssets.length ? 'Exact serialized asset assigned. Billing starts on the Rental Start Date' : 'Stock delivered', hold ? 'amber' : 'green'),
        ...notes, ...x.log],
    };
  });
  return d;
}

export function releaseHold(soId: string, lineId: string, assetId: string) {
  patchAsset(assetId, { assetStatus: 'On Hire' }, { title: 'Hold released', detail: 'Site ready, invoicing cycle started' });
  saveOrder(soId, (o) => ({ ...mapLine(o, lineId, (l) => ({ ...l, assigned: l.assigned.map((a) => (a.assetId === assetId && a.state === 'Hold' ? { ...a, state: 'On Hire' as const, start: TODAY } : a)) })), log: [log('Hold released', 'Invoicing cycle started from today', 'green'), ...o.log] }));
}

/* ------------------------------------------------------------------ Rental: cross-hire lifecycle */
export function raiseCrossHire(soId: string, lineId: string, supplierId: string, supplier: string, rate: number): string {
  const o = getOrder(soId)!;
  const l = getLine(o, lineId)!;
  const id = uid('ch');
  const rec: CrossHire = { id, number: nextNumber('CH', 7), soId, soNumber: o.number, lineId, group: l.group ?? '', category: l.category ?? '', supplierId, supplier, rate, stage: 0, revenue: l.price * l.qty, date: TODAY,
    history: [log('Request raised', `No owned ${l.group} ${l.category} unit available for ${o.number}`)] };
  put(COL.crossHire, rec);
  saveOrder(soId, (x) => ({ ...mapLine(x, lineId, (ln) => ({ ...ln, crossHire: [...ln.crossHire, id] })), log: [log(`Cross-Hire ${rec.number} requested`, `${l.group} ${l.category} from ${supplier}`, 'blue'), ...x.log] }));
  return id;
}
export function receiveCrossHire(ch: CrossHire, supplierInvoice: string) {
  const tpl = heavySeed.find((h) => h.id === 'he27')!;
  const n = fleetRows().length;
  const assetId = `AST-${1100 + n}`;
  const a: HeavyRec = { ...tpl, id: uid('he'), code: `ITM-${String(100 + n).padStart(4, '0')}`, assetId, name: `Diesel ${ch.group} ${ch.category} ${ch.supplier.split(' ')[0]} Cross-Hire`, category: ch.group, subCategory: ch.category, capacity: ch.category, supplier: ch.supplier, ownership: 'Cross-Hired',
    assetStatus: 'Ready for Hire', crossHireIdle: false, assetValue: 0, nbv: 0, deprPct: 0, deprAmount: 0, capex: 0, utilization: 0, idleDays: 0, profitability: 0, purchaseDate: TODAY, putToUseDate: TODAY, usefulLifeYears: 0, engineNo: `XH-${Date.now().toString().slice(-6)}`, image: undefined, attachments: [],
    movements: [{ id: uid('m'), entryNo: `MV-26-${9100 + n}`, date: `${TODAY}T${dayjs().format('HH:mm')}`, type: 'Cross-Hire Stage Change', from: `Supplier: ${ch.supplier}`, to: 'Jebel Ali Main Yard', reference: ch.number, by: ACTOR }],
    audit: [{ when: nowStamp(), title: 'Cross-hired asset received', detail: `${ch.number} from ${ch.supplier}. No depreciation is posted`, by: ACTOR }], insurance: [] };
  setCollection(COL.fleet, [a, ...fleetRows()]);
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 1, assetId: a.id, supplierInvoice, history: [...c.history, log(`Received into our custody as ${assetId}`, `Supplier invoice ${supplierInvoice}`)] }));
}
export function returnToUs(ch: CrossHire, notes: string, files: string[]) {
  if (ch.assetId) patchAsset(ch.assetId, { assetStatus: 'Yard', crossHireIdle: true }, { title: 'Returned to us', detail: notes }, { type: 'Cross-Hire Stage Change', from: 'Client site', to: 'Jebel Ali Main Yard', reference: ch.number });
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 3, condition: { notes, files }, history: [...c.history, log('Returned to us', `Condition check completed: ${notes}`, 'amber')] }));
}
export function returnToSupplier(ch: CrossHire, dispute: number, reissueRef?: string) {
  if (ch.assetId) patchAsset(ch.assetId, { assetStatus: 'Off Hire', status: 'Inactive', crossHireIdle: false }, { title: 'Returned to supplier', detail: dispute ? `Supplier dispute charge AED ${dispute}` : undefined }, { type: 'Cross-Hire Stage Change', from: 'Jebel Ali Main Yard', to: `Supplier: ${ch.supplier}`, reference: ch.number });
  patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 4, dispute: dispute || undefined, reissueRef, history: [...c.history, log('Returned to supplier', dispute ? `Dispute charge AED ${dispute} recorded and traced to ${c.soNumber}` : 'Loop closed', 'green')] }));
  if (dispute) addLog(ch.soId, log(`Cross-hire dispute charge AED ${dispute}`, `${ch.number}, rolled into the order's profitability`, 'red'));
}

/* ------------------------------------------------------------------ Rental: replacement */
export function replaceAsset(i: { soId: string; lineId: string; oldId: string; newId: string; reason: string; priceAdjust: number; notified: boolean; crossHireId?: string }): Replacement {
  const o = getOrder(i.soId)!;
  const oldA = assetById(i.oldId)!;
  const newA = assetById(i.newId)!;
  const old = getLine(o, i.lineId)!.assigned.find((a) => a.assetId === i.oldId && a.state !== 'Replaced')!;
  const dest = `Client: ${custName(o.customerId)}`;
  const rec: Replacement = { id: uid('rp'), number: nextNumber('RP', 4), soId: o.id, lineId: i.lineId, oldAssetId: i.oldId, newAssetId: i.newId, reason: i.reason, priceAdjust: i.priceAdjust, notified: i.notified, date: TODAY, crossHireId: i.crossHireId, by: ACTOR };
  put(COL.replacements, rec);
  patchAsset(i.oldId, { assetStatus: 'Under Maintenance' }, { title: 'Replaced and sent to maintenance', detail: `${rec.number}: ${i.reason}` }, { type: 'Sent for Repair', from: dest, to: 'Workshop: Al Masaood Service Centre', reference: rec.number });
  patchAsset(i.newId, { assetStatus: 'On Hire', crossHireIdle: false }, { title: 'Asset Status changed', detail: `Ready for Hire to On Hire (${rec.number})` }, { type: 'Delivery', from: 'Jebel Ali Main Yard', to: dest, reference: rec.number });
  const ch = all<CrossHire>(COL.crossHire).find((c) => c.assetId === i.newId && c.stage < 2);
  if (ch) patch<CrossHire>(COL.crossHire, ch.id, (c) => ({ ...c, stage: 2, history: [...c.history, log(`Allocated to ${o.number} as a replacement`, rec.number)] }));
  saveOrder(o.id, (x) => ({
    ...mapLine(x, i.lineId, (l) => ({ ...l, assigned: [...l.assigned.map((a) => (a === old || (a.assetId === i.oldId && a.state === 'On Hire') ? { ...a, state: 'Replaced' as const, stop: TODAY } : a)), { assetId: i.newId, deliveryId: old.deliveryId, start: TODAY, state: 'On Hire' as const }] })),
    log: [log(`Replacement ${rec.number}: ${oldA.assetId} out, ${newA.assetId} in`, `${i.reason}. The invoice cycle is not paused by a replacement${i.priceAdjust ? `; price adjustment AED ${i.priceAdjust}` : ''}`, 'blue'), ...x.log],
  }));
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
export function recordVisit(soId: string, idx: number, type: string): string {
  const nonBill = type.includes('non-chargeable');
  const ref = nonBill ? nextNumber('JC', 120) : nextNumber('INV', 415);
  saveOrder(soId, (x) => ({ ...x, visitPlan: (x.visitPlan ?? []).map((v, k) => (k === idx ? { ...v, done: TODAY, ref, type } : v)), log: [log(`AMC visit ${idx + 1} recorded`, `${type}, ref ${ref}`, 'green'), ...x.log] }));
  return ref;
}

/* ------------------------------------------------------------------ Rental: return and inspection */
export function raiseReturn(i: { soId: string; lineId: string; assetId: string; method: string; timestamp: string; siteChecklist: string[]; photos: string[]; fuelNote: string }): ReturnEntry {
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
  return rec;
}
export function reachYard(r: ReturnEntry, yard: string) {
  patchAsset(r.assetId, { assetStatus: 'Yard' }, { title: 'Reached the yard', detail: `${r.number}: awaiting inspection` }, { type: 'Return', from: `Client: ${custName(r.customerId)}`, to: yard, reference: r.number });
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
  patchAsset(r.assetId, { assetStatus: 'Under Maintenance' }, { title: 'Damage found at inspection', detail: `${r.number}: Yard to Under Maintenance` }, { type: 'Sent for Repair', from: 'Jebel Ali Main Yard', to: 'Workshop: Al Masaood Service Centre', reference: r.number });
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
}

/** Close is blocked while any linked delivery is still unreturned. */
export function closeOrder(o: SalesOrder): { ok: boolean; message: string } {
  const out = o.lines.flatMap((l) => outstanding(l));
  if (out.length) return { ok: false, message: `${out.length} delivered asset(s) are still unreturned, so the order cannot be closed` };
  saveOrder(o.id, (x) => ({ ...x, status: 'Closed', log: [log('Sales Order closed'), ...x.log] }));
  return { ok: true, message: 'Sales Order closed' };
}
export const confirmOrder = (o: SalesOrder) => saveOrder(o.id, (x) => ({ ...x, status: 'Confirmed', log: [log('Sales Order confirmed', 'Commercial terms frozen'), ...x.log] }));

export { availability };
