import dayjs from 'dayjs';
import { costCentres, customers, equipmentGroups, locations } from '@/mock-data/masters';
import { FREQUENCIES, heavySeed, pricingSeed, TODAY, type HeavyRec, type PricingRec } from '@/modules/inventory/data';
import { getCollection, seedCollection, setCollection } from '@/store/store';

export { FREQUENCIES, TODAY };
export type { HeavyRec, PricingRec };
/** Fixed Asset Trading (sell a serialized asset) is added; Fuel Trading and Trading are separate, as agreed on 5 Oct. */
export const ACTIVITY_TYPES = ['Rental', 'Fixed Asset Trading', 'Trading', 'Fuel Trading', 'AMC', 'Service', 'Other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/* ------------------------------------------------------------------ collection names */
export const COL = {
  leads: 'crm.leads', opps: 'crm.opportunities', quotes: 'crm.quotations', orders: 'crm.salesOrders', deliveries: 'crm.deliveries',
  returns: 'crm.returns', masters: 'crm.masters', serviceCharges: 'crm.serviceCharges', jobCards: 'crm.jobCards', replacements: 'rental.replacements', extensions: 'rental.extensions', crossHire: 'rental.crossHire',
  /* read only from CRM: owned by Inventory */
  fleet: 'inventory.heavyEquipment', pricing: 'inventory.pricing',
} as const;
export const ACTOR = 'Ahmed Al Khouri';

/* ------------------------------------------------------------------ fixed picklists (statuses and system values; editable lists are masters below) */
export const LEAD_STATUSES = ['New', 'Cold call', 'Contacted', 'Contact in progress', 'Follow up', 'Negotiating', 'Quotation sent', 'Qualified', 'Unqualified', 'Not qualified', 'Converted', 'Lost'];
export const OPP_STAGES = ['Enquiry', 'Qualified', 'Quoted', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const RATINGS = ['Cold', 'Warm', 'Hot'];
export const QUOTE_STATUSES = ['Draft', 'Submitted for Approval', 'Under review', 'Approved', 'Rejected', 'Revised', 'Converted to Sales Order', 'Expired', 'Cancelled', 'Closed'];
export const SO_STATUSES = ['Draft', 'Pending', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Closed', 'Cancelled', 'Rejected'];
export const CATEGORY_LABEL = 'Category';
export const SUBCATEGORY_LABEL = 'Subcategory';
export const CONTRACT_TYPES = ['Open PO', 'Closed', 'Project'];
export const BILLING_STRUCTURES = ['Milestone', 'Lump Sum'];
export const LINE_TYPES = ['Individual', 'Package'];
export const VAT_TYPES = ['Standard (With VAT)', 'Export (Zero-Rated)'];
export const TRANSACTION_TYPES = ['Cash', 'Credit'];
export const YARDS = ['Jebel Ali Main Yard', 'Sharjah Yard', 'Abu Dhabi Mussafah Yard'];
export const LEAD_PROBABILITY: Record<string, number> = { 'Cold call': 10, 'Quotation sent': 30, 'Contact in progress': 70, 'Follow up': 80, Converted: 100, Lost: 0, Negotiating: 50, 'Not qualified': 0, New: 10, Contacted: 30, Qualified: 50, Unqualified: 0 };
export const OPP_PROBABILITY: Record<string, number> = { Enquiry: 10, Qualified: 30, Quoted: 40, Proposal: 50, Negotiation: 70, Won: 100, Lost: 0 };
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const WIN_LOSS_REASONS = ['Customer Not Ready', 'Good Lead', 'Install Base', 'Lost To Competition', 'Lost To Internal Development', 'Lost To No Decision', 'No Bandwidth', 'No Budget'];
export const FOLLOW_TYPES = ['Call', 'Email', 'Personal Meeting'];
export const ADDRESS_TYPES = ['Delivery', 'Shipping', 'Office', 'Other'];
export const RECURRING = ['', 'Weekly', '2 Weeks', 'Monthly', 'Quarterly', 'Yearly'];
export const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIF', 'DAP', 'DDP'];
export const DISCOUNT_ON = ['Gross Amount', 'Proportional Allocation'];
export const DEPARTMENTS = ['Sales', 'Operations', 'Logistics', 'Workshop', 'Finance'];
/** Own yards first, then supplier-held locations (fuel stock held at a supplier). */
export const ALL_LOCATIONS = locations.map((l) => l.name);
export const COST_CENTRES = costCentres.filter((c) => c.active).map((c) => c.name);
export const SERVICE_BILLING = ['One-time', 'Recurring', 'Lump sum'];
export const SERVICE_TYPES = ['Charge', 'Waiver', 'Insurance', 'Other'];
export const FUEL_UNITS = ['Litre', 'Gallon'];
export const DELIVERY_TYPES = ['Full', 'Partial'];
export const TRANSPORT_TYPES = ['Own Fleet', 'External Transporter'];
export const DELIVERY_STATUSES = ['Picked', 'Packed', 'Dispatched', 'Delivered', 'Acknowledged'];
export const RETURN_METHODS = ['Self-Return', 'Company Collection'];
export const FAULT_ATTRIBUTION = ['Company', 'Client'];
export const CROSS_STAGES = ['Request', 'Received', 'Allocated', 'Returned to Us', 'Returned to Supplier'];
export const SALESPEOPLE = ['Leena Thomas', 'Yousef Karim', 'Omar Farouk'];
/** Activity Types that a header Activity Type allows on its lines (decision 1: Rental may also carry Service and Fuel Trading lines). */
export const LINE_ACTIVITIES: Record<string, string[]> = { Rental: ['Rental', 'Service'], 'Fixed Asset Trading': ['Fixed Asset Trading', 'Service'] };
export const lineActivitiesFor = (header: string) => LINE_ACTIVITIES[header] ?? [header];
/** Admin-configurable in the real system. */
export const EXPIRY_NOTICE_DAYS = 14;
export const LPO_NOTICE_DAYS = 7;
export const ESCALATION_DAYS = 5;

/* ------------------------------------------------------------------ masters (decision: nothing hard-coded, every list has a "+" to add a value) */
export const MASTER_SEED: Record<string, string[]> = {
  entity: ['Gulf Power Rentals LLC', 'Gulf Power Rentals LLC - Abu Dhabi Branch', 'Gulf Power Trading FZE'],
  leadSource: ['Search engine', 'Lead recall', 'Newsletter', 'Facebook', 'Twitter', 'Linkedin', 'Website', 'WhatsApp', 'Email', 'Phone', 'Walk-in', 'Referral', 'Trade Show', 'Other'],
  lostReason: ['Price', 'Competitor', 'No Stock', 'Client Went Cold', 'Other'],
  paymentTerms: ['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days'],
  currency: ['AED', 'USD', 'SAR', 'EUR'],
  docTemplate: ['Standard Rental Quotation', 'Trading Quotation', 'Fuel Trading Quotation', 'AMC Proposal', 'Service Quotation'],
  delayReason: ['Site not ready for deployment', 'Awaiting client permit', 'Power room not complete', 'Other'],
  siteChecklist: ['Equipment shut down and isolated', 'Cables and accessories collected', 'Visible damage photographed', 'Client representative informed'],
  yardChecklist: ['Engine and alternator visual check', 'Fluid levels and leaks', 'Control panel and breakers', 'Fuel tank and day tank', 'Body and canopy condition', 'Accessories reconciled with delivery'],
  replacementReason: ['Breakdown', 'Customer request', 'Upgrade'],
  industry: ['Construction', 'Utilities', 'Hospitality', 'Oil & Gas', 'Events', 'Logistics', 'Manufacturing', 'Real Estate'],
};
export interface MasterRec { id: string; values: string[] }
export const masterSeed: MasterRec[] = Object.entries(MASTER_SEED).map(([id, values]) => ({ id, values }));
export const masterValues = (key: string) => getCollection<MasterRec>(COL.masters).find((m) => m.id === key)?.values ?? MASTER_SEED[key] ?? [];

/* ------------------------------------------------------------------ types */
export interface LogItem { when: string; title: string; detail?: string; by: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'grey' }
export interface Assignment { assetId: string; deliveryId: string; start: string; stop?: string; state: 'On Hire' | 'Hold' | 'Returned' | 'Replaced' | 'Sold' }
/**
 * One line. `activity` is the line kind: on a Rental document it is Rental, Service or Fuel Trading; elsewhere it equals the header Activity Type.
 * `group` holds the Category (e.g. Generator) and `category` the Subcategory (e.g. 500 KVA).
 */
export interface Line {
  id: string; activity: ActivityType; lineType: string; item: string; group?: string; category?: string; allocationTag?: string;
  pricingId?: string; frequency?: string; start?: string; end?: string; deliveryDate?: string; billing?: string;
  serviceId?: string; serviceType?: string; costCentre?: string;
  unit: string; qty: number; price: number; foc: boolean; desc: string; discount?: number;
  /** existing item-table columns */
  shipDate?: string; location?: string; department?: string; narration?: string; replacementCost?: number; discountedItem?: boolean;
  assigned: Assignment[]; fulfilment?: string; fulfilmentRef?: string; crossHire: string[];
}
/** Header commercial fields shared by Quotation and Sales Order (decision 2: Contract Type and End Date sit in the header). */
export interface Commercial {
  activity: ActivityType; entity: string; customerId: string; paymentTerms: string; currency: string;
  contractType?: string; contractStart?: string; contractEnd?: string; billingStructure?: string;
  costCentre?: string;
  amcStart?: string; amcEnd?: string; visits?: number; vatType: string; discountPct: number; terms: string; lines: Line[];
  /** existing ERP header fields kept */
  transactionType?: string; exchangeRate?: number; salesperson?: string; referenceNo?: string; narration?: string; location?: string; emails?: LogItem[];
  postingTime?: string; deliveryCommitment?: string; recurring?: string; untilDate?: string; vatNumber?: string; crn?: string; quotePercentage?: number; department?: string;
  contactPerson?: string; shippingAddress?: string; billingAddress?: string; placeOfSupply?: string; shippingRule?: string; shippingCost?: number; handlingCost?: number; incoterm?: string;
  discountOn?: string; roundOff?: string; attachments?: string[];
}
export interface Addr { type: string; addressee: string; line1: string; city: string; state: string; country: string; zip: string; phone: string; defaultShipping?: boolean; defaultBilling?: boolean }
export interface ContactRow { name: string; email: string; code: string; phone: string }
export interface FollowUp { type: string; date: string; remind: string; desc: string }
export interface Lead {
  id: string; number: string; date: string; source: string; activity: string; company: string; contact: string; phone: string; email: string; owner: string; status: string;
  lostReason?: string; nextFollowUp?: string; tags: string; priority: string; leadType: string; reference?: string; vat?: string; probability?: number; narration?: string; comms: LogItem[]; opportunityId?: string;
  /** existing Lead form fields */
  firstName?: string; middleName?: string; lastName?: string; entity?: string; website?: string; currency?: string; crn?: string; responsible?: string; industry?: string; annualRevenue?: number;
  location?: string; department?: string; recordStatus?: string; attachments?: string[]; followUps?: FollowUp[]; addresses?: Addr[]; contacts?: ContactRow[];
}
export interface Opportunity {
  id: string; number: string; date: string; customerId: string; contact: string; project: string; owner: string; title: string; activity: string; stage: string; rating: string;
  lines: Line[]; estimated: number; probability: number; expectedClose: string; leadId?: string; quotationId?: string; source?: string; lpo?: string; lpoDate?: string; site?: string;
  approvalRequired: boolean; nextAction?: string; comments?: string; lostReason?: string;
  /** existing Opportunity form fields */
  phone?: string; emailId?: string; website?: string; entity?: string; currency?: string; vat?: string; crn?: string; reference?: string; priority?: string; winLossReason?: string;
  industry?: string; narration?: string; location?: string; department?: string; recordStatus?: string; attachments?: string[]; followUps?: FollowUp[]; addresses?: Addr[]; contacts?: ContactRow[];
}
export interface Quotation extends Commercial {
  id: string; number: string; date: string; oppId: string; description: string; validUntil: string; status: string; version: number; prevId?: string;
  preparedBy: string; designation: string; mobile: string; email: string; template: string; pushToOpp: boolean; salesOrderId?: string; log: LogItem[];
}
export interface Visit { date: string; done?: string; ref?: string; type?: string; amount?: number; jobCardId?: string }
export interface ServiceCharge { id: string; name: string; type: string; billing: string; price: number; desc: string; source: 'CRM' | 'Inventory' }
export interface JobCard {
  id: string; number: string; soId: string; soNumber: string; customerId: string; visitIdx: number; plannedDate: string; doneOn?: string; technician: string; location: string; item: string;
  materials: { item: string; qty: number; unit: string; price: number; cost?: number }[]; services: { name: string; amount: number }[]; notes: string; visitAmount: number;
  status: 'Open' | 'Completed' | 'Invoiced'; invoiceRef?: string; log: LogItem[];
}
export interface SalesOrder extends Commercial {
  id: string; number: string; date: string; quoteId?: string; oppId?: string; owner: string; title: string; reference: string; status: string;
  lpo: string; lpoDate: string; lpoExpiry: string; site: string; costCentre: string; deliveryMethod: string; log: LogItem[]; docs: string[];
  damageCharges: { assetId: string; amount: number; note: string; date: string }[]; logisticsCost: number; visitPlan?: Visit[]; deliveryDate?: string; poExpiry?: string;
}
export interface DoItem { lineId: string; qty: number; assetIds: string[]; deliveredSub?: string; package?: string }
export interface Delivery {
  id: string; number: string; soId: string; soNumber: string; lineId: string; customerId: string; date: string; type: string; assetIds: string[]; accessories: string[]; description: string;
  transport: string; extCost: number; conditionFiles: string[]; signature: string; foc: boolean; status: string; closed: boolean; driver?: string; vehicle?: string; narration?: string; supplierDoNo?: string;
  /** Rental (invoice) Start Date, defaults to the delivery date (decision 7). */
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number;
  requestedSub?: string; deliveredSub?: string; serviceLineIds?: string[];
  /** existing Delivery Order form fields; items = one row per Sales Order line delivered */
  items?: DoItem[]; reference?: string; poNumber?: string; poDate?: string; location?: string; operationType?: string; transportedBy?: string; vehicleNumber?: string; iqama?: string; mobile?: string; department?: string; salesperson?: string;
  /** existing Delivery Order form fields; items = one row per Sales Order line delivered */
  /** kept for older records */
  siteReady?: boolean; holdReason?: string; holdBy?: string;
}
export interface ReturnEntry {
  id: string; number: string; soId: string; soNumber: string; customerId: string; lineId: string; deliveryId: string; assetId: string; method: string; timestamp: string;
  siteChecklist: string[]; photos: string[]; fuelNote: string; stage: number; reachedYard?: string; yardChecklist: string[]; inspection: 'Pending Inspection' | 'Passed' | 'Damage Found';
  damageCharge?: number; damageNote?: string; waiverApplied?: boolean; outcome?: string; collection?: { by: string; amount: number; note: string }; log: LogItem[];
}
export interface Replacement {
  id: string; number: string; soId: string; lineId: string; oldAssetId: string; newAssetId: string; reason: string; priceAdjust: number; notified: boolean; date: string; crossHireId?: string; by: string;
}
export interface Extension { id: string; number: string; soId: string; lineId?: string; kind: 'Extension' | 'Early Termination'; oldEnd: string; newEnd: string; date: string; note: string; status: string; clientConfirmedBy: string }
export interface CrossHire {
  id: string; number: string; soId: string; soNumber: string; lineId: string; group: string; category: string; supplierId: string; supplier: string; rate: number; stage: number; assetId?: string;
  history: LogItem[]; condition?: { notes: string; files: string[] }; reissueRef?: string; supplierInvoice?: string; dispute?: number; revenue: number; date: string;
}

/* ------------------------------------------------------------------ helpers */
export const cust = (id: string) => customers.find((c) => c.id === id);
export const custName = (id: string) => cust(id)?.name ?? '-';
const MONTHS: Record<string, number> = { Monthly: 1, Quarterly: 3, Yearly: 12 };
/** Billing periods between two dates for a frequency (25 Sep to 25 Oct = 30 days, 4.29 weeks, 1 month). Rule to be confirmed with client. */
export function periods(freq?: string, start?: string, end?: string): number {
  if (!freq || !start || !end || end < start) return 1;
  const a = dayjs(start); const b = dayjs(end);
  const n = freq === 'Daily' ? b.diff(a, 'day') : freq === 'Weekly' ? b.diff(a, 'week', true) : b.diff(a, 'month', true) / (MONTHS[freq] ?? 1);
  return Math.max(Math.round(n * 100) / 100, 1);
}
export const isPeriodic = (l: Line) => l.activity === 'Rental' || (l.activity === 'Service' && l.billing === 'Recurring');
export const linePeriods = (l: Line) => (isPeriodic(l) ? periods(l.frequency, l.start, l.end) : 1);
export const lineGross = (l: Line) => (l.foc ? 0 : l.qty * l.price * linePeriods(l));
export const lineTaxable = (l: Line) => lineGross(l) * (1 - (l.discount ?? 0) / 100);
export const lineVat = (l: Line, vatType: string) => (vatType.startsWith('Export') ? 0 : lineTaxable(l) * 0.05);
export const lineTotal = lineTaxable;
export const docTotals = (lines: Line[], discountPct: number, vatType: string) => {
  const sub = lines.reduce((s, l) => s + lineTaxable(l), 0);
  const disc = (sub * discountPct) / 100;
  const net = sub - disc;
  const vat = vatType.startsWith('Export') ? 0 : net * 0.05;
  return { sub, disc, vat, total: net + vat };
};
/** A line that needs Category + Subcategory (equipment). */
/** Equipment lines need Category + Subcategory: rental and fixed asset sale. */
export const isRentalLine = (l: Line) => l.activity === 'Rental' || l.activity === 'Fixed Asset Trading';
export const hasWaiver = (lines: Line[]) => lines.some((l) => l.activity === 'Service' && (l.serviceType === 'Waiver' || /damage waiver/i.test(l.item)) && !l.foc);
export const nowStamp = () => `${TODAY} ${dayjs().format('HH:mm')}`;
export const log = (title: string, detail?: string, tone?: LogItem['tone']): LogItem => ({ when: nowStamp(), title, detail, by: ACTOR, tone });
export const groupOptions = equipmentGroups.map((g) => g.group);
export const categoryOptions = (group?: string) => equipmentGroups.find((g) => g.group === group)?.categories ?? [];
export const yearEnd = (from: string = TODAY) => `${from.slice(0, 4)}-12-31`;
export const plusYear = (d: string) => dayjs(d).add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD');
export const mkLine = (over: Partial<Line> & Pick<Line, 'activity' | 'item'>): Line => ({
  id: `ln${Math.random().toString(36).slice(2, 9)}`, lineType: 'Individual', unit: 'Nos', qty: 1, price: 0, foc: false, desc: '', assigned: [], crossHire: [], ...over,
});
/** Pricing lines from Inventory > Heavy Equipment Pricing (read only, decision 4). */
export function pricingRows(): PricingRec[] { seedCollection(COL.pricing, pricingSeed); return getCollection<PricingRec>(COL.pricing); }
export const pricingName = (p: PricingRec) => `Rental ${p.category} ${p.subCategory} ${p.frequency}`;
/** Evenly spread AMC visit dates between start and end. */
export function planVisits(start?: string, end?: string, visits?: number, total = 0) {
  if (!start || !end || !visits) return [] as Visit[];
  const days = dayjs(end).diff(dayjs(start), 'day');
  return Array.from({ length: visits }, (_, i): Visit => ({ date: dayjs(start).add(Math.round((days / visits) * i + days / visits / 2), 'day').format('YYYY-MM-DD'), amount: Math.round((total / visits) * 100) / 100 }));
}

/* ------------------------------------------------------------------ fleet (Fixed Asset Register) access */
export function fleetRows(): HeavyRec[] {
  seedCollection(COL.fleet, heavySeed);
  return getCollection<HeavyRec>(COL.fleet);
}
export const assetById = (id: string) => fleetRows().find((a) => a.id === id);
export const assetByAssetId = (assetId: string) => fleetRows().find((a) => a.assetId === assetId);
export const assetLabel = (a?: HeavyRec) => (a ? `${a.assetId} - ${a.name}` : '-');
export const isLive = (a: HeavyRec) => a.status === 'Active' && a.assetStatus !== 'Disposed';
/** Units that can go out on a delivery: Ready for Hire units of the Category + Subcategory (owned fleet and received cross-hired units). */
export function availability(group?: string, category?: string, rows: HeavyRec[] = fleetRows()) {
  const ready = rows.filter((a) => isLive(a) && a.category === group && a.subCategory === category && a.assetStatus === 'Ready for Hire');
  return { owned: ready.filter((a) => a.ownership !== 'Cross-Hired'), cross: ready.filter((a) => a.ownership === 'Cross-Hired') };
}
export function patchAsset(id: string, patch: Partial<HeavyRec>, audit?: { title: string; detail?: string }, movement?: { type: string; from: string; to: string; reference: string }) {
  const rows = fleetRows();
  setCollection(COL.fleet, rows.map((a) => {
    if (a.id !== id) return a;
    const when = `${TODAY} ${dayjs().format('HH:mm')}`;
    const mv = movement ? [...a.movements, { id: `m${Date.now()}${a.movements.length}`, entryNo: `MV-26-${String(9000 + a.movements.length)}`, date: `${TODAY}T${dayjs().format('HH:mm')}`, type: movement.type, from: movement.from, to: movement.to, reference: movement.reference, by: ACTOR }] : a.movements;
    return { ...a, ...patch, movements: mv, audit: audit ? [...a.audit, { when, title: audit.title, detail: audit.detail, by: ACTOR }] : a.audit };
  }));
}

/* ------------------------------------------------------------------ seed data */
const L = (id: string, over: Partial<Line> & Pick<Line, 'activity' | 'item'>): Line => ({ lineType: 'Individual', unit: 'Nos', qty: 1, price: 0, foc: false, desc: over.desc ?? over.item, assigned: [], crossHire: [], ...over, id });
/** A rental equipment line priced Monthly between two dates. */
const R = (id: string, group: string, category: string, price: number, start: string, end: string, over: Partial<Line> = {}): Line =>
  L(id, { activity: 'Rental', item: `Rental ${group} ${category} Monthly`, group, category, frequency: 'Monthly', start, end, unit: 'Nos', price, pricingId: pricingSeed.find((p) => p.category === group && p.subCategory === category && p.frequency === 'Monthly')?.id, desc: `${group} ${category}, rental, monthly billing`, ...over });
export const serviceSeed: ServiceCharge[] = [
  { id: 'sv1', name: 'Delivery Charge', type: 'Charge', billing: 'One-time', price: 1500, desc: 'Delivery of equipment to site, billed on the first invoice', source: 'CRM' },
  { id: 'sv2', name: 'Return Charge', type: 'Charge', billing: 'One-time', price: 2000, desc: 'Collection of equipment from site, billed on the final invoice', source: 'CRM' },
  { id: 'sv3', name: 'Transportation', type: 'Charge', billing: 'One-time', price: 1200, desc: 'Transport service charge', source: 'CRM' },
  { id: 'sv4', name: 'Damage Waiver (Monthly)', type: 'Waiver', billing: 'Recurring', price: 150, desc: 'Damage waiver billed with every rental cycle; if paid, damage is not invoiced at return', source: 'CRM' },
  { id: 'sv5', name: 'Damage Waiver (Lump Sum)', type: 'Waiver', billing: 'Lump sum', price: 400, desc: 'One-time damage waiver for the whole contract', source: 'CRM' },
  { id: 'sv6', name: 'Equipment Insurance (Monthly)', type: 'Insurance', billing: 'Recurring', price: 300, desc: 'Insurance cover billed with every rental cycle', source: 'CRM' },
  { id: 'sv7', name: 'Operator Charge (Monthly)', type: 'Charge', billing: 'Recurring', price: 4500, desc: 'Operator provided with the equipment', source: 'CRM' },
  { id: 'sv8', name: 'Generator Installation & Commissioning', type: 'Charge', billing: 'One-time', price: 3500, desc: 'From the Inventory service items', source: 'Inventory' },
];
const S = (id: string, item: string, price: number, billing: 'One-time' | 'Recurring' | 'Lump sum', over: Partial<Line> = {}): Line => {
  const m = serviceSeed.find((x) => x.name === item);
  return L(id, { activity: 'Service', item, unit: 'Nos', price, billing, serviceId: m?.id, serviceType: m?.type, desc: m?.desc ?? item, ...over });
};
const lg = (when: string, title: string, by = 'Leena Thomas', detail?: string, tone?: LogItem['tone']): LogItem => ({ when, title, detail, by, tone });
const TERMS = 'Payment: as per the payment terms from invoice date. Fuel is not included in the rental rate and is billed separately. Transport as agreed on the order.';
const ENT = MASTER_SEED.entity[0];

export const leadSeed: Lead[] = [
  { id: 'ld1', number: 'LD-26-00031', date: '2026-09-02', source: 'Referral', activity: 'Rental', company: 'Al Safa Power Utilities', contact: 'Nadia Rahman', phone: '+971 58 620 3312', email: 'nadia@alsafapower.ae', owner: 'Yousef Karim', status: 'Converted', opportunityId: 'op5', nextFollowUp: '2026-10-03', tags: 'Utility, Abu Dhabi', priority: 'High', leadType: 'Company', reference: 'RFQ-ASP-118', vat: '100742016600003', probability: 60, comms: [lg('2026-09-03 10:20', 'Phone call: requirement discussed', 'Yousef Karim', '2 x 1000 KVA for 6 months, fuel supply requested')] },
  { id: 'ld2', number: 'LD-26-00032', date: '2026-09-05', source: 'Website', activity: 'Rental', company: 'Desert Pearl Hotels', contact: 'Imran Qureshi', phone: '+971 56 447 9021', email: 'imran@desertpearl.ae', owner: 'Leena Thomas', status: 'Contacted', nextFollowUp: '2026-10-01', tags: 'Hospitality', priority: 'Medium', leadType: 'Company', probability: 40, comms: [lg('2026-09-06 09:00', 'Email sent: rate card')] },
  { id: 'ld3', number: 'LD-26-00033', date: '2026-09-09', source: 'WhatsApp', activity: 'Service', company: 'Emirates Infrastructure LLC', contact: 'Rashid Al Mansoori', phone: '+971 50 214 7781', email: 'rashid@emiratesinfra.ae', owner: 'Leena Thomas', status: 'New', nextFollowUp: '2026-10-02', tags: 'Existing customer', priority: 'Medium', leadType: 'Company', probability: 30, comms: [] },
  { id: 'ld4', number: 'LD-26-00034', date: '2026-08-21', source: 'Trade Show', activity: 'AMC', company: 'Blue Crest Logistics', contact: 'Arun Shetty', phone: '+971 55 889 1204', email: 'arun@bluecrest.ae', owner: 'Yousef Karim', status: 'Lost', lostReason: 'Competitor', tags: 'Logistics', priority: 'Low', leadType: 'Company', probability: 0, comms: [lg('2026-09-01 15:30', 'Client chose incumbent AMC provider', 'Yousef Karim')] },
  { id: 'ld5', number: 'LD-26-00035', date: '2026-08-04', source: 'Referral', activity: 'Rental', company: 'Palm Marina Development', contact: 'Daniel Foster', phone: '+971 52 905 7714', email: 'daniel@palmmarina.ae', owner: 'Leena Thomas', status: 'Converted', tags: 'Marina Tower 3', priority: 'High', leadType: 'Company', probability: 80, opportunityId: 'op4', comms: [lg('2026-08-06 11:00', 'Site visit completed', 'Leena Thomas')] },
];

const O = (o: Omit<Opportunity, 'lines' | 'approvalRequired'> & Partial<Opportunity>): Opportunity => ({ lines: [], approvalRequired: false, ...o });
export const oppSeed: Opportunity[] = [
  O({ id: 'op1', number: 'OP-26-00021', date: '2026-08-10', customerId: 'c5', contact: 'Sergei Petrov', project: 'Route 2020 Depot', owner: 'Leena Thomas', title: 'Rent 500 KVA and 1000 KVA for Route 2020 Depot', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 380000, probability: 100, expectedClose: '2026-08-30', quotationId: 'qt1', lpo: 'LPO-DMW-5521', lpoDate: '2026-08-28', site: 'Route 2020 Depot, Jebel Ali', lines: [L('op1a', { activity: 'Rental', item: 'Generator 500 KVA', group: 'Generator', category: '500 KVA', price: 52000 }), L('op1b', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', price: 98000 })] }),
  O({ id: 'op2', number: 'OP-26-00022', date: '2026-08-18', customerId: 'c2', contact: 'Vikram Nair', project: 'Yas Island Villas Phase 2', owner: 'Yousef Karim', title: 'Rent 200 KVA with POD for Yas Island Villas', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 210000, probability: 100, expectedClose: '2026-09-01', quotationId: 'qt2', site: 'Yas Island, Abu Dhabi' }),
  O({ id: 'op3', number: 'OP-26-00023', date: '2026-09-04', customerId: 'c3', contact: 'Maha Saleh', project: 'Expo Winter Festival', owner: 'Omar Farouk', title: 'Rent 500 KVA for Expo winter festival', activity: 'Rental', stage: 'Won', rating: 'Warm', estimated: 96000, probability: 100, expectedClose: '2026-09-12', quotationId: 'qt3', site: 'Expo City, Dubai' }),
  O({ id: 'op4', number: 'OP-26-00024', date: '2026-08-06', customerId: 'c8', contact: 'Daniel Foster', project: 'Marina Tower 3', owner: 'Leena Thomas', title: 'Rent 1500 KVA and 100 KVA for Marina Tower 3', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 540000, probability: 100, expectedClose: '2026-09-15', leadId: 'ld5', quotationId: 'qt4', approvalRequired: true, site: 'Dubai Marina' }),
  O({ id: 'op5', number: 'OP-26-00025', date: '2026-09-12', customerId: 'c7', contact: 'Nadia Rahman', project: 'Mussafah Substation', owner: 'Yousef Karim', title: 'Rent 2 x 1000 KVA for Al Safa substation', activity: 'Rental', stage: 'Quoted', rating: 'Hot', estimated: 320000, probability: 60, expectedClose: '2026-10-20', leadId: 'ld1', quotationId: 'qt6', site: 'Mussafah, Abu Dhabi', nextAction: 'Follow up on revised discount', lines: [L('op5a', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', qty: 2, price: 98000 })] }),
  O({ id: 'op6', number: 'OP-26-00026', date: '2026-09-18', customerId: 'c4', contact: 'Imran Qureshi', project: 'Resort Backup Power', owner: 'Leena Thomas', title: 'Rent 100 KVA for resort backup', activity: 'Rental', stage: 'Enquiry', rating: 'Warm', estimated: 45000, probability: 30, expectedClose: '2026-11-05', lines: [L('op6a', { activity: 'Rental', item: 'Generator 100 KVA', group: 'Generator', category: '100 KVA', price: 18500 })] }),
  O({ id: 'op7', number: 'OP-26-00027', date: '2026-09-10', customerId: 'c8', contact: 'Daniel Foster', project: 'Marina Tower 3', owner: 'Leena Thomas', title: 'AMC for Marina Tower 3 standby generator', activity: 'AMC', stage: 'Won', rating: 'Hot', estimated: 24000, probability: 100, expectedClose: '2026-09-25', quotationId: 'qt7' }),
  O({ id: 'op8', number: 'OP-26-00028', date: '2026-09-14', customerId: 'c1', contact: 'Rashid Al Mansoori', project: 'Al Maktoum Airport Expansion', owner: 'Leena Thomas', title: 'Supply ATS panel and filters to Al Maktoum site', activity: 'Trading', stage: 'Won', rating: 'Warm', estimated: 66100, probability: 100, expectedClose: '2026-09-28', quotationId: 'qt8' }),
];

const q = (id: string, number: string, oppId: string, customerId: string, status: string, activity: ActivityType, lines: Line[], over: Partial<Quotation> = {}): Quotation => ({
  id, number, date: '2026-08-20', oppId, customerId, activity, entity: ENT, paymentTerms: '30 days', currency: 'AED', description: '', validUntil: '2026-09-20', status, version: 1,
  preparedBy: 'Leena Thomas', designation: 'Sales Representative', mobile: '+971 50 400 1101', email: 'leena@gulfpowerrentals.ae',
  costCentre: 'Dubai Branch', template: activity === 'Rental' ? 'Standard Rental Quotation' : activity === 'AMC' ? 'AMC Proposal' : 'Trading Quotation', terms: TERMS, vatType: VAT_TYPES[0], discountPct: 0, lines, pushToOpp: true,
  log: [lg('2026-08-20 09:00', 'Quotation created', 'Leena Thomas')], ...over,
});
const so1Lines = [R('so1a', 'Generator', '500 KVA', 52000, '2026-04-12', '2026-10-08'), R('so1b', 'Generator', '1000 KVA', 98000, '2026-05-18', '2026-10-08'), S('so1d', 'Delivery Charge', 1500, 'One-time')];
const so2Lines = [R('so2a', 'Generator', '200 KVA', 29500, '2026-07-04', '2026-12-31'), R('so2b', 'POD', '20 ft POD', 7500, '2026-07-06', '2026-12-31'), S('so2c', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so2d', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-07-04', end: '2026-12-31' })];
const so3Lines = [R('so3a', 'Generator', '500 KVA', 48000, '2026-05-06', '2026-10-25', { allocationTag: 'Requested 500 KVA, reserved cross-hire unit' })];
const so4Lines = [R('so4a', 'Generator', '1500 KVA', 145000, '2026-10-05', '2027-03-31', { item: 'Generator 1500 KVA Monthly', pricingId: undefined }), R('so4b', 'Generator', '100 KVA', 18500, '2026-10-05', '2027-03-31'), S('so4c', 'Delivery Charge', 2000, 'One-time'), S('so4d', 'Return Charge', 2000, 'One-time')];
const so5Lines = [R('so5a', 'Generator', '500 KVA', 50000, '2026-02-20', '2026-09-22')];
const so6Lines = [L('so6a', { activity: 'AMC', item: 'AMC Scheduled Visit (Generator)', unit: 'Visit', qty: 4, price: 6000, desc: 'Annual maintenance of the 1500 KVA standby generator at Marina Tower 3: four scheduled visits, consumables and extra work billed against each job card' })];
const so7Lines = [L('so7a', { activity: 'Trading', item: 'ATS Panel 630A', unit: 'Nos', qty: 1, price: 61000 }), L('so7b', { activity: 'Trading', item: 'Oil Filter (Cummins C-Series)', unit: 'Nos', qty: 60, price: 85 })];
const qLines = (ls: Line[], p: string) => ls.map((l) => ({ ...l, id: `${p}${l.id.slice(3)}`, assigned: [] }));

export const quoteSeed: Quotation[] = [
  q('qt1', 'QT-26-00081', 'op1', 'c5', 'Converted to Sales Order', 'Rental', qLines(so1Lines, 'qt1'), { contractType: 'Closed', contractStart: '2026-04-12', contractEnd: '2026-10-08', salesOrderId: 'so1' }),
  q('qt2', 'QT-26-00082', 'op2', 'c2', 'Converted to Sales Order', 'Rental', qLines(so2Lines, 'qt2'), { contractType: 'Open PO', contractStart: '2026-07-04', contractEnd: '2026-12-31', salesOrderId: 'so2', preparedBy: 'Yousef Karim' }),
  q('qt3', 'QT-26-00083', 'op3', 'c3', 'Converted to Sales Order', 'Rental', qLines(so3Lines, 'qt3'), { contractType: 'Closed', contractStart: '2026-05-06', contractEnd: '2026-10-25', salesOrderId: 'so3', preparedBy: 'Omar Farouk' }),
  q('qt4', 'QT-26-00084', 'op4', 'c8', 'Converted to Sales Order', 'Rental', qLines(so4Lines, 'qt4'), { contractType: 'Project', contractStart: '2026-10-05', contractEnd: '2027-03-31', billingStructure: 'Milestone', salesOrderId: 'so4' }),
  q('qt5', 'QT-26-00087', 'op5', 'c7', 'Revised', 'Rental', [R('qt5a', 'Generator', '1000 KVA', 98000, '2026-10-15', '2027-03-31', { qty: 2 })], { date: '2026-09-22', validUntil: '2026-10-22', contractType: 'Closed', contractStart: '2026-10-15', contractEnd: '2027-03-31', preparedBy: 'Yousef Karim' }),
  q('qt6', 'QT-26-00088', 'op5', 'c7', 'Submitted for Approval', 'Rental', [R('qt6a', 'Generator', '1000 KVA', 94000, '2026-10-15', '2027-03-31', { qty: 2 })],
    { date: '2026-09-28', validUntil: '2026-10-28', discountPct: 12, version: 2, prevId: 'qt5', contractType: 'Closed', contractStart: '2026-10-15', contractEnd: '2027-03-31', preparedBy: 'Yousef Karim', log: [lg('2026-09-28 11:10', 'Revision created from QT-26-00087', 'Yousef Karim'), lg('2026-09-28 11:12', 'Discount changed 0% to 12%', 'Yousef Karim')] }),
  q('qt7', 'QT-26-00085', 'op7', 'c8', 'Converted to Sales Order', 'AMC', qLines(so6Lines, 'qt7'), { date: '2026-09-18', contractType: 'Closed', amcStart: '2026-10-01', amcEnd: '2027-09-30', visits: 4, salesOrderId: 'so6' }),
  q('qt8', 'QT-26-00086', 'op8', 'c1', 'Converted to Sales Order', 'Trading', qLines(so7Lines, 'qt8'), { date: '2026-09-20', salesOrderId: 'so7' }),
];

const asg = (assetId: string, deliveryId: string, start: string, over: Partial<Assignment> = {}): Assignment => ({ assetId, deliveryId, start, state: 'On Hire', ...over });
const withAsg = (ls: Line[], map: Record<string, Assignment[]>, extra: Record<string, Partial<Line>> = {}) => ls.map((l) => ({ ...l, assigned: map[l.id] ?? [], ...(extra[l.id] ?? {}) }));
const so = (o: Omit<SalesOrder, 'entity' | 'paymentTerms' | 'currency' | 'vatType' | 'discountPct' | 'terms' | 'docs' | 'damageCharges' | 'logisticsCost' | 'deliveryMethod'> & Partial<SalesOrder>): SalesOrder => ({
  entity: ENT, paymentTerms: '30 days', currency: 'AED', vatType: VAT_TYPES[0], discountPct: 0, terms: TERMS, docs: [], damageCharges: [], logisticsCost: 0, deliveryMethod: 'Own Fleet', ...o,
});
export const orderSeed: SalesOrder[] = [
  so({ id: 'so1', number: 'SO-26-00041', date: '2026-08-30', quoteId: 'qt1', oppId: 'op1', customerId: 'c5', owner: 'Leena Thomas', title: 'Rent 500 KVA and 1000 KVA for Route 2020 Depot', reference: 'LPO-DMW-5521', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-04-12', contractEnd: '2026-10-08',
    lpo: 'LPO-DMW-5521', lpoDate: '2026-08-28', lpoExpiry: '2026-10-08', site: 'Route 2020 Depot, Jebel Ali', costCentre: 'SO-26-00041 Route 2020 Depot (Dubai Metro Works JV)', docs: ['LPO-DMW-5521.pdf', 'QT-26-00081.pdf'],
    lines: withAsg(so1Lines, { so1a: [asg('he15', 'dl1', '2026-04-12')], so1b: [asg('he18', 'dl2', '2026-05-18')] }, { so1d: { fulfilment: 'Charged and invoiced', fulfilmentRef: 'INV-26-00402' } }),
    log: [lg('2026-09-10 12:00', 'Extension EX-26-00007: end date 2026-09-08 to 2026-10-08', 'Leena Thomas', 'The existing Sales Order is revised, no new order is created', 'green'), lg('2026-08-30 10:00', 'Sales Order created from QT-26-00081', 'Leena Thomas')] }),
  so({ id: 'so2', number: 'SO-26-00046', date: '2026-09-01', quoteId: 'qt2', oppId: 'op2', customerId: 'c2', owner: 'Yousef Karim', title: 'Rent 200 KVA with POD for Yas Island Villas', reference: 'LPO-GBC-2209', status: 'Fully Delivered', activity: 'Rental', contractType: 'Open PO', contractStart: '2026-07-04', contractEnd: '2026-12-31',
    lpo: 'LPO-GBC-2209', lpoDate: '2026-08-31', lpoExpiry: '2026-12-31', site: 'Yas Island, Abu Dhabi', costCentre: 'SO-26-00046 Yas Island Villas Phase 2', deliveryMethod: 'External Transporter', logisticsCost: 2800, docs: ['LPO-GBC-2209.pdf'],
    lines: withAsg(so2Lines, { so2a: [asg('he14', 'dl3', '2026-06-01', { state: 'Replaced', stop: '2026-07-04' }), asg('he13', 'dl3', '2026-07-04')], so2b: [asg('he24', 'dl4', '2026-07-06')] }, { so2c: { fulfilment: 'Charged and invoiced', fulfilmentRef: 'INV-26-00415' } }),
    log: [lg('2026-09-01 09:30', 'Sales Order created from QT-26-00082', 'Yousef Karim')] }),
  so({ id: 'so3', number: 'SO-26-00044', date: '2026-09-12', quoteId: 'qt3', oppId: 'op3', customerId: 'c3', owner: 'Omar Farouk', title: 'Rent 500 KVA for Expo winter festival', reference: 'LPO-ANE-0912', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-05-06', contractEnd: '2026-10-25',
    lpo: 'LPO-ANE-0912', lpoDate: '2026-09-11', lpoExpiry: '2026-10-25', site: 'Expo City, Dubai', costCentre: 'Dubai Branch',
    lines: withAsg(so3Lines, { so3a: [asg('he27', 'dl5', '2026-05-06')] }, { so3a: { crossHire: ['ch1'] } }),
    log: [lg('2026-09-12 14:00', 'Sales Order created from QT-26-00083', 'Omar Farouk'), lg('2026-05-06 09:00', 'Cross-hired AST-1027 allocated', 'Bilal Ahmed')] }),
  so({ id: 'so4', number: 'SO-26-00052', date: '2026-09-16', quoteId: 'qt4', oppId: 'op4', customerId: 'c8', owner: 'Leena Thomas', title: 'Rent 1500 KVA and 100 KVA for Marina Tower 3', reference: 'LPO-PMD-7710', status: 'Confirmed', activity: 'Rental', contractType: 'Project', contractStart: '2026-10-05', contractEnd: '2027-03-31', billingStructure: 'Milestone',
    lpo: 'LPO-PMD-7710', lpoDate: '2026-09-14', lpoExpiry: '2027-04-30', site: 'Dubai Marina', costCentre: 'Dubai Branch', docs: ['LPO-PMD-7710.pdf'], lines: withAsg(so4Lines, {}),
    log: [lg('2026-09-16 10:15', 'Sales Order created from QT-26-00084', 'Leena Thomas')] }),
  so({ id: 'so5', number: 'SO-26-00048', date: '2026-02-18', customerId: 'c6', owner: 'Yousef Karim', title: 'Rent 500 KVA for Kiln 4 shutdown', reference: 'LPO-SCC-3318', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-02-20', contractEnd: '2026-09-22',
    lpo: 'LPO-SCC-3318', lpoDate: '2026-02-16', lpoExpiry: '2026-09-30', site: 'Sharjah Cement, Kiln 4', costCentre: 'Dubai Branch', logisticsCost: 1500,
    lines: withAsg(so5Lines, { so5a: [asg('he16', 'dl6', '2026-02-20')] }), log: [lg('2026-02-18 09:00', 'Sales Order created', 'Yousef Karim')] }),
  so({ id: 'so6', number: 'SO-26-00053', date: '2026-09-25', quoteId: 'qt7', oppId: 'op7', customerId: 'c8', owner: 'Leena Thomas', title: 'AMC for Marina Tower 3 standby generator', reference: 'LPO-PMD-7790', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2026-10-01', amcEnd: '2027-09-30', visits: 4,
    lpo: 'LPO-PMD-7790', lpoDate: '2026-09-24', lpoExpiry: '2027-09-30', site: 'Dubai Marina', costCentre: 'Dubai Branch', lines: withAsg(so6Lines, {}), visitPlan: planVisits('2026-10-01', '2027-09-30', 4, 24000),
    log: [lg('2026-09-25 10:00', 'Sales Order created from QT-26-00085', 'Leena Thomas')] }),
  so({ id: 'so7', number: 'SO-26-00054', date: '2026-09-28', quoteId: 'qt8', oppId: 'op8', customerId: 'c1', owner: 'Leena Thomas', title: 'Supply ATS panel and filters to Al Maktoum site', reference: 'LPO-EIL-4410', status: 'Confirmed', activity: 'Trading',
    lpo: 'LPO-EIL-4410', lpoDate: '2026-09-27', lpoExpiry: '2026-12-31', site: 'Al Maktoum Airport Expansion', costCentre: 'SO-26-00044 Al Maktoum Airport Expansion', lines: withAsg(so7Lines, {}),
    log: [lg('2026-09-28 11:00', 'Sales Order created from QT-26-00086', 'Leena Thomas')] }),
];

const dl = (id: string, number: string, s: SalesOrder, lineId: string, assetId: string, date: string, over: Partial<Delivery> = {}): Delivery => {
  const l = s.lines.find((x) => x.id === lineId);
  return { id, number, soId: s.id, soNumber: s.number, lineId, customerId: s.customerId, date, type: 'Full', assetIds: [assetId], accessories: [], description: '', transport: 'Own Fleet', extCost: 0, conditionFiles: [],
    signature: 'E-signature', foc: false, status: 'Acknowledged', closed: false, rentalStart: date, requestedSub: l?.category, deliveredSub: l?.category, ...over };
};
const sx = (id: string) => orderSeed.find((o) => o.id === id)!;
export const deliverySeed: Delivery[] = [
  dl('dl1', 'DO-26-00102', sx('so1'), 'so1a', 'he15', '2026-04-12'),
  dl('dl2', 'DO-26-00108', sx('so1'), 'so1b', 'he18', '2026-05-18', { type: 'Partial' }),
  dl('dl3', 'DO-26-00131', sx('so2'), 'so2a', 'he13', '2026-07-04', { transport: 'External Transporter', extCost: 1400 }),
  dl('dl4', 'DO-26-00132', sx('so2'), 'so2b', 'he24', '2026-07-06', { transport: 'External Transporter', extCost: 1400 }),
  dl('dl5', 'DO-26-00079', sx('so3'), 'so3a', 'he27', '2026-05-06'),
  dl('dl6', 'DO-26-00044', sx('so5'), 'so5a', 'he16', '2026-02-20'),
];

/** No closed returns are seeded: every unit currently out is still on hire. Raise one from a Sales Order to see the Return flow. */
export const returnSeed: ReturnEntry[] = [];
export const replacementSeed: Replacement[] = [
  { id: 'rp1', number: 'RP-26-00004', soId: 'so2', lineId: 'so2a', oldAssetId: 'he14', newAssetId: 'he13', reason: 'Breakdown', priceAdjust: 0, notified: true, date: '2026-07-04', by: 'Bilal Ahmed' },
];
export const extensionSeed: Extension[] = [
  { id: 'ex1', number: 'EX-26-00007', soId: 'so1', kind: 'Extension', oldEnd: '2026-09-08', newEnd: '2026-10-08', date: '2026-09-10', note: 'Client extended the hire by one month', status: 'Applied', clientConfirmedBy: 'Sergei Petrov' },
];
export const crossHireSeed: CrossHire[] = [
  { id: 'ch1', number: 'CH-26-00007', soId: 'so3', soNumber: 'SO-26-00044', lineId: 'so3a', group: 'Generator', category: '500 KVA', supplierId: 's5', supplier: 'Falcon Equipment Hire LLC', rate: 36000, stage: 2, assetId: 'he27', revenue: 48000, date: '2026-05-02', supplierInvoice: 'FAL-INV-9921',
    history: [lg('2026-05-02 10:00', 'Request raised: no owned 500 KVA unit available', 'Bilal Ahmed'), lg('2026-05-02 16:00', 'Received from Falcon Equipment Hire LLC', 'Sanjay Kumar'), lg('2026-05-06 09:00', 'Allocated to SO-26-00044', 'Bilal Ahmed')] },
  { id: 'ch2', number: 'CH-26-00006', soId: 'so2', soNumber: 'SO-26-00046', lineId: 'so2a', group: 'Generator', category: '200 KVA', supplierId: 's6', supplier: 'Gulf Genset Rentals', rate: 21000, stage: 3, assetId: 'he28', revenue: 29500, date: '2026-06-10', supplierInvoice: 'GGR-2210',
    condition: { notes: 'Minor scratches on canopy, no functional damage', files: ['yard-condition-ch200.jpg'] },
    history: [lg('2026-06-10 09:00', 'Request raised', 'Bilal Ahmed'), lg('2026-06-10 15:00', 'Received at Sharjah Yard', 'Sanjay Kumar'), lg('2026-06-12 10:00', 'Allocated to SO-26-00046', 'Bilal Ahmed'), lg('2026-09-20 12:00', 'Returned to us, idle at Sharjah Yard', 'Sanjay Kumar', 'Condition check completed', 'amber')] },
];


/* Fuel Trading and Fixed Asset Trading examples (separate documents, never mixed into a Rental document). */
oppSeed.push(
  O({ id: 'op9', number: 'OP-26-00029', date: '2026-09-20', customerId: 'c5', contact: 'Sergei Petrov', project: 'Route 2020 Depot', owner: 'Leena Thomas', title: 'Supply diesel to Route 2020 Depot', activity: 'Fuel Trading', stage: 'Won', rating: 'Hot', estimated: 57000, probability: 100, expectedClose: '2026-09-30', quotationId: 'qt9', site: 'Route 2020 Depot, Jebel Ali' }),
  O({ id: 'op10', number: 'OP-26-00030', date: '2026-09-26', customerId: 'c4', contact: 'Imran Qureshi', project: 'Resort Backup Power', owner: 'Omar Farouk', title: 'Sale of one 500 KVA generator to Desert Pearl Hotels', activity: 'Fixed Asset Trading', stage: 'Quoted', rating: 'Warm', estimated: 380000, probability: 50, expectedClose: '2026-11-15', quotationId: 'qt10' }),
);
quoteSeed.push(
  q('qt9', 'QT-26-00089', 'op9', 'c5', 'Converted to Sales Order', 'Fuel Trading', [L('qt9a', { activity: 'Fuel Trading', item: 'Diesel (Bulk)', unit: 'Litre', qty: 20000, price: 2.85, location: 'ENOC Al Quoz Depot (Fuel Stock)' })], { date: '2026-09-21', validUntil: '2026-10-21', salesOrderId: 'so8', template: 'Fuel Trading Quotation' }),
  q('qt10', 'QT-26-00090', 'op10', 'c4', 'Approved', 'Fixed Asset Trading', [L('qt10a', { activity: 'Fixed Asset Trading', item: 'Generator 500 KVA (sale)', group: 'Generator', category: '500 KVA', unit: 'Nos', qty: 1, price: 380000, desc: 'Diesel generator 500 KVA, ex-fleet, with service history' })], { date: '2026-09-26', validUntil: '2026-10-26', preparedBy: 'Omar Farouk', template: 'Trading Quotation' }),
);
orderSeed.push(
  so({ id: 'so8', number: 'SO-26-00055', date: '2026-09-29', quoteId: 'qt9', oppId: 'op9', customerId: 'c5', owner: 'Leena Thomas', title: 'Supply diesel to Route 2020 Depot', reference: 'LPO-DMW-5560', status: 'Confirmed', activity: 'Fuel Trading',
    lpo: 'LPO-DMW-5560', lpoDate: '2026-09-28', lpoExpiry: '2026-12-31', site: 'Route 2020 Depot, Jebel Ali', costCentre: 'SO-26-00041 Route 2020 Depot (Dubai Metro Works JV)', lines: [L('so8a', { activity: 'Fuel Trading', item: 'Diesel (Bulk)', unit: 'Litre', qty: 20000, price: 2.85, location: 'ENOC Al Quoz Depot (Fuel Stock)' })],
    log: [lg('2026-09-29 10:00', 'Sales Order created from QT-26-00089', 'Leena Thomas')] }),
);

export const jobCardSeed: JobCard[] = [
  { id: 'jc1', number: 'JC-26-00118', soId: 'so6', soNumber: 'SO-26-00053', customerId: 'c8', visitIdx: 0, plannedDate: '2026-11-16', technician: 'Rajesh Pillai', location: 'Jebel Ali Main Yard', item: 'AMC Annual Contract (Generator 1500 KVA)',
    materials: [], services: [], notes: 'Draft job card for the first planned visit', visitAmount: 6000, status: 'Open', log: [lg('2026-09-30 09:00', 'Job card created for visit 1', 'Leena Thomas')] },
];

/** Seeds every collection once (first caller wins, so safe to call from any screen). */
export function seedAll() {
  seedCollection(COL.fleet, heavySeed); seedCollection(COL.pricing, pricingSeed); seedCollection(COL.masters, masterSeed);
  seedCollection(COL.leads, leadSeed); seedCollection(COL.opps, oppSeed); seedCollection(COL.quotes, quoteSeed); seedCollection(COL.orders, orderSeed);
  seedCollection(COL.deliveries, deliverySeed); seedCollection(COL.returns, returnSeed); seedCollection(COL.replacements, replacementSeed);
  seedCollection(COL.extensions, extensionSeed); seedCollection(COL.crossHire, crossHireSeed); seedCollection(COL.serviceCharges, serviceSeed); seedCollection(COL.jobCards, jobCardSeed);
}
seedAll();
