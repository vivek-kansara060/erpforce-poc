import dayjs from 'dayjs';
import { costCentres, customers, systemUsers } from '@/mock-data/masters';
import { FREQUENCIES, categorySeed, heavySeed, isTopCategory, itemSeed, locationSeed, pricingSeed, TODAY, type CategoryRec, type HeavyRec, type ItemRec, type LocationRec, type PricingRec } from '@/modules/inventory/data';
import { getCollection, seedCollection, setCollection } from '@/store/store';

export { FREQUENCIES, TODAY };
export type { HeavyRec, PricingRec };
/** Fixed Asset Trading (sell a serialized asset) is added; Fuel Trading and Trading are separate, as agreed on 5 Oct. */
export const ACTIVITY_TYPES = ['Rental', 'Fixed Asset Trading', 'Trading', 'Fuel Trading', 'AMC', 'Other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
/** A line is an Activity Type, or a Service charge. A service is a charge from the Inventory service master (delivery charge, labor, installation, waiver), never an Activity Type. */
export type LineKind = ActivityType | 'Service';

/* ------------------------------------------------------------------ collection names */
export const COL = {
  leads: 'crm.leads', opps: 'crm.opportunities', quotes: 'crm.quotations', orders: 'crm.salesOrders', deliveries: 'crm.deliveries',
  returns: 'crm.returns', masters: 'crm.masters', serviceCharges: 'crm.serviceCharges', jobCards: 'crm.jobCards', replacements: 'rental.replacements', extensions: 'rental.extensions', crossHire: 'rental.crossHire', chRequests: 'rental.chRequests', chRfqs: 'rental.chRfqs', trips: 'rental.trips',
  billingCycles: 'rental.billingCycles',
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
/**
 * Billing Cycle master of the existing Rental module (Settings > Billing Cycle). A cycle is Count x Duration. The Sales Order carries the cycle name; the schedule of
 * invoices is built from it (see accounting/billing.ts, periodsOf).
 */
export const CYCLE_DURATIONS = ['Day', 'Week', 'Month', 'Calendar Month', '3 Month', '6 Month', 'Year'] as const;
export type CycleDuration = (typeof CYCLE_DURATIONS)[number];
export const START_OPTIONS = [{ value: 'delivery', label: 'From delivery' }, { value: 'order_creation', label: 'From order creation' }, { value: 'custom', label: 'Custom date' }];
export interface CycleRec {
  id: string; name: string; count: number; duration: CycleDuration; company?: string; invoicingType: 'Automatic' | 'Manual';
  startOption: 'delivery' | 'order_creation' | 'custom'; customStart?: string; maxSchedule?: number; initialEnabled: boolean; initialDays?: number; prorated: boolean;
}
export const cycleSeed: CycleRec[] = [
  { id: 'bc1', name: 'Monthly', count: 1, duration: 'Month', invoicingType: 'Manual', startOption: 'delivery', maxSchedule: 12, initialEnabled: false, prorated: false },
  { id: 'bc2', name: '2 Months', count: 2, duration: 'Month', invoicingType: 'Manual', startOption: 'delivery', maxSchedule: 6, initialEnabled: false, prorated: false },
  { id: 'bc3', name: 'Quarterly', count: 1, duration: '3 Month', invoicingType: 'Manual', startOption: 'delivery', maxSchedule: 4, initialEnabled: false, prorated: false },
  { id: 'bc4', name: 'Weekly', count: 1, duration: 'Week', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 8, initialEnabled: false, prorated: false },
  { id: 'bc5', name: 'Calendar Month Prorated', count: 1, duration: 'Calendar Month', invoicingType: 'Manual', startOption: 'delivery', maxSchedule: 12, initialEnabled: true, initialDays: 1, prorated: true },
];
export const INVOICING_TYPES = ['Manual', 'Automatic'];
export const LINE_TYPES = ['Individual', 'Package'];
export const VAT_TYPES = ['Standard (With VAT)', 'Export (Zero-Rated)'];
export const TRANSACTION_TYPES = ['Cash', 'Credit'];
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
const liveLocations = (): LocationRec[] => { seedCollection('locations', locationSeed); return getCollection<LocationRec>('locations').filter((l) => l.status === 'Active'); };
/** Locations and Category / Subcategory are read live from Inventory (Locations, Item Category), so a change there shows here. */
export const yards = () => liveLocations().filter((l) => l.type === 'Own Yard').map((l) => l.name);
/** Where goods can be dispatched or held for sale: everything except Employee locations (service vans). */
export const stockLocations = () => liveLocations().filter((l) => l.type !== 'Employee').map((l) => l.name);
/** Employee locations (vans) assigned to the user account of this employee. */
export const vanLocationsFor = (employeeName?: string) => {
  const user = systemUsers.find((u) => u.name === employeeName);
  return user ? liveLocations().filter((l) => l.type === 'Employee' && (l.userIds ?? []).includes(user.id)).map((l) => l.name) : [];
};
export const isSupplierHeld = (name?: string) => liveLocations().find((l) => l.name === name)?.type === 'Supplier-Held Location';
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
  docTemplate: ['Standard (with letterhead)', 'Standard (no letterhead)', 'Detailed item format', 'Summary format', 'Standard Rental Quotation', 'Trading Quotation', 'Fuel Trading Quotation', 'AMC Proposal', 'Rental Agreement format'],
  delayReason: ['Site not ready for deployment', 'Awaiting client permit', 'Power room not complete', 'Other'],
  siteChecklist: ['Equipment shut down and isolated', 'Cables and accessories collected', 'Visible damage photographed', 'Client representative informed'],
  yardChecklist: ['Engine and alternator visual check', 'Fluid levels and leaks', 'Control panel and breakers', 'Fuel tank and day tank', 'Body and canopy condition', 'Accessories reconciled with delivery'],
  replacementReason: ['Breakdown', 'Customer request', 'Upgrade'],
  industry: ['Construction', 'Utilities', 'Hospitality', 'Oil & Gas', 'Events', 'Logistics', 'Manufacturing', 'Real Estate'],
  tripExpenseTypes: ['Transport Charge', 'Salik', 'Fuel', 'Driver Allowance', 'Parking', 'Other'],
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
  id: string; activity: LineKind; lineType: string; item: string; group?: string; category?: string; allocationTag?: string;
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
  amcStart?: string; amcEnd?: string; visits?: number;
  /** AMC: the contract value (before VAT) and its scope. An AMC has no item lines; the value is split across the planned visits. */
  amcValue?: number; amcScope?: string;
  vatType: string; discountPct: number; terms: string; lines: Line[];
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
export interface ServiceCharge { id: string; name: string; type: string; billing: string; price: number; desc: string; source: 'Inventory' }
export interface JobCard {
  id: string; number: string; soId: string; soNumber: string; customerId: string; visitIdx: number; plannedDate: string; doneOn?: string; technician: string; location: string; item: string;
  /** foc: Chargeable Override (Free of Cost), set by the Project Team per line. The line is not billed, but materials still leave the van stock. */
  materials: { item: string; qty: number; unit: string; price: number; cost?: number; foc?: boolean }[]; services: { name: string; amount: number; foc?: boolean }[]; notes: string; visitAmount: number;
  /** FOC visit: this visit's share of the Contract Value is not invoiced (the other visits keep their share). */
  visitFoc?: boolean;
  status: 'Open' | 'Completed' | 'Invoiced'; invoiceRef?: string; log: LogItem[];
  /** The sales invoice in Accounting raised from this job card; its payment status is read from the invoice. */
  invoiceId?: string;
  /** General Job Activities (the standard monthly process), signed copy upload and payment status of the invoice */
  activities?: string; signedCopy?: string[]; paymentStatus?: 'Unpaid' | 'Paid';
}
export interface SalesOrder extends Commercial {
  id: string; number: string; date: string; quoteId?: string; oppId?: string; owner: string; title: string; reference: string; status: string;
  lpo: string; lpoDate: string; lpoExpiry: string; site: string; costCentre: string; deliveryMethod: string; log: LogItem[]; docs: string[];
  damageCharges: { assetId: string; amount: number; note: string; date: string; invoiceId?: string }[]; logisticsCost: number;
  /** Rental only (Billing section, as in the existing Rental Order): the cycle the Rental invoicing run follows, and whether the run is started by hand or automatically. */
  billingCycle?: string; invoicingType?: string; visitPlan?: Visit[]; deliveryDate?: string; poExpiry?: string;
}
export interface DoItem { lineId: string; qty: number; assetIds: string[]; deliveredSub?: string; package?: string }
export interface Delivery {
  id: string; number: string; soId: string; soNumber: string; lineId: string; customerId: string; date: string; type: string; assetIds: string[]; accessories: string[]; description: string;
  transport: string; extCost: number; conditionFiles: string[]; signature: string; foc: boolean; status: string; closed: boolean; driver?: string; vehicle?: string; narration?: string; supplierDoNo?: string;
  /** Rental (invoice) Start Date, defaults to the delivery date (decision 7). */
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number;
  requestedSub?: string; deliveredSub?: string; serviceLineIds?: string[]; project?: string;
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
  history: LogItem[]; condition?: { notes: string; files: string[]; checks?: string[] }; reissueRef?: string; reissueSoId?: string; supplierInvoice?: string; dispute?: number; revenue: number; date: string;
  /** Cross Hire Order (Hire Order) fields of the existing ERP; the record above is the order, the five stages are tracked on it */
  type?: 'Inventory' | 'Dropship'; requestIds?: string[]; rfqId?: string; confirmationDate?: string; expectedReceipt?: string; paymentTerms?: string; startDate?: string; endDate?: string;
  status?: string; receiving?: string; billing?: string; expenses?: { account: string; amount: number; note: string }[]; qty?: number;
  /** Goods Receipt Notes of the order (a separate form, created from the approved order) and the other order form fields of the existing ERP. */
  grns?: CrossHireGrn[]; form?: Record<string, any>; approvedBy?: string;
  /** One entry per received asset (1 fixed asset = 1 unit). The order is Category and Subcategory with a number of units; the assets are defined on the Goods Receipt. */
  units?: CrossUnit[];
}
export interface CrossUnit { assetId: string; stage: number; soId?: string; soNumber?: string; lineId?: string; grnId?: string; condition?: { notes: string; files: string[]; checks?: string[] }; reissueRef?: string; dispute?: number }
/** Units of an order. Older records without units carry their single asset on the order itself. */
export const unitsOf = (c: CrossHire): CrossUnit[] => c.units ?? (c.assetId ? [{ assetId: c.assetId, stage: c.stage, soId: c.stage >= 2 ? c.soId : undefined, soNumber: c.stage >= 2 ? c.soNumber : undefined, lineId: c.lineId, condition: c.condition, reissueRef: c.reissueRef, dispute: c.dispute }] : []);
/** Cost of an order that belongs to one Sales Order: the units delivered to it (rate share, expenses share, own dispute); an order with no unit delivered yet counts against the order it was raised for. */
export function costForSo(c: CrossHire, soId: string): number {
  const n = c.qty ?? 1;
  const us = unitsOf(c);
  const exp = (c.expenses ?? []).reduce((t, e) => t + e.amount, 0);
  const mine = us.filter((u) => u.soId === soId);
  if (mine.length) return mine.reduce((t, u) => t + (c.rate + exp) / n + (u.dispute ?? 0), 0);
  return !us.some((u) => u.soId) && c.soId === soId ? c.rate + exp + (c.dispute ?? 0) : 0;
}
/** Goods Receipt Note of a Cross Hire Order. The unit is traced on it (serial number), and Validate puts the unit on the Fixed Asset Register. */
export interface CrossHireGrn {
  id: string; number: string; date: string; receivedBy: string; narration: string; transportedBy: string; driver: string; driverId: string; vehicle: string; location: string; department: string;
  attachments: string[]; qty: number; traces: { serial: string; group: string; category: string; condition?: 'OK' | 'Damaged' | 'Needs check'; photo?: string; hours?: string; remarks?: string }[]; validated: boolean; address?: Record<string, string>;
}
export interface RfqItem { id: string; group: string; category: string; uom: string; description: string; specification: string; duration: string; qty: number; estYear: number; location: string; department: string; narration: string; orderNumber?: string }
export interface CrossHireRequest {
  id: string; number: string; date: string; soId: string; soNumber: string; lineId: string; group: string; category: string; qty: number; frequency: string; rate: number;
  vendorId?: string; vendor?: string; company: string; representative: string; currency: string; narration: string; location: string; department: string; attachments: string[];
  /** Cross-Hire Decision Right: who raised it and in which role (the permission is gated, not tied to one fixed role). */
  raisedBy?: string; raisedRole?: string;
  status: 'Draft' | 'Pending' | 'In Progress' | 'Completed' | 'Rejected'; rfqId?: string; orderId?: string; log: LogItem[];
}
export interface RfqResponse { vendorId: string; vendor: string; rate: number; leadTime: number; moq: number; date: string; note?: string; number?: string; paymentTerms?: string; incoterm?: string; reference?: string; narration?: string; condition?: string; specification?: string; vendorUom?: string; vendorDuration?: string; estYear?: number }
export interface CrossHireRfq {
  id: string; number: string; date: string; requestIds: string[]; soNumbers: string[]; group: string; category: string; qty: number; vendorIds: string[]; orderDeadline: string; expectedDate: string;
  currency: string; paymentTerms: string; start?: string; end?: string; narration: string; status: 'Draft' | 'Open' | 'RFQ Sent' | 'Response Received' | 'Pending Order' | 'Order' | 'Cancelled';
  items?: RfqItem[]; reference?: string; location?: string; representative?: string; company?: string; form?: Record<string, any>; responses: RfqResponse[]; awardedVendorId?: string; awardComment?: string; orderId?: string; log: LogItem[];
}
export const CH_REQUEST_STATUSES = ['Draft', 'Pending', 'In Progress', 'Completed', 'Rejected'];
export const CH_RFQ_STATUSES = ['Draft', 'Open', 'RFQ Sent', 'Response Received', 'Pending Order', 'Order', 'Cancelled'];
export const CH_ORDER_STATUSES = ['Draft', 'Pending', 'Pending Approval', 'Approved', 'Received', 'Billed', 'Rejected', 'Cancelled', 'Closed'];
export const RENTAL_DURATIONS = ['Daily', 'Hourly', '3 Hours', 'Weekly', '2 Weeks', 'Monthly', '2 Months', 'Half Yearly', 'Yearly'];
export const CH_TYPES = ['Inventory', 'Dropship'];
/** Roles that hold the permission to initiate a cross-hire request. Primarily the Operational Desk; an admin can grant it to any other user. */
export const CROSS_HIRE_ROLES = ['Operational Desk', 'Dispatcher / Service Desk', 'General Manager'];
/**
 * Buy-vs-hire view (decision support): what the same hire would have cost if the business owned an equivalent unit, estimated as the average purchase value of
 * the owned units of the Category + Subcategory spread over their useful life, for the months of the hire. Returns undefined when there is no owned unit to compare.
 */
export function ownedEquivalent(c: Pick<CrossHire, 'group' | 'category' | 'startDate' | 'endDate' | 'revenue' | 'date'>) {
  const owned = fleetRows().filter((a) => isLive(a) && !a.deliveryFleet && a.category === c.group && a.subCategory === c.category && a.ownership !== 'Cross-Hired' && a.assetValue > 0);
  if (!owned.length) return undefined;
  const monthly = owned.reduce((n, a) => n + a.assetValue / Math.max(1, a.usefulLifeYears * 12), 0) / owned.length;
  const from = c.startDate ?? c.date;
  const months = c.endDate ? Math.max(1, Math.round((new Date(c.endDate).getTime() - new Date(from).getTime()) / (30.4375 * 86400000))) : 1;
  const cost = Math.round(monthly * months);
  return { monthly: Math.round(monthly), months, cost, margin: c.revenue - cost };
}

/* ------------------------------------------------------------------ Fleet Management: trips (own delivery vehicles and external transporters) */
export const TRIP_STATUSES = ['Assigned', 'En Route', 'Stuck-Delayed', 'Completed', 'Cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const OPEN_TRIP: TripStatus[] = ['Assigned', 'En Route', 'Stuck-Delayed'];
export type TripKind = 'Delivery' | 'Collection' | 'Replacement';
export type FleetStatus = 'Free' | 'Assigned' | 'En Route' | 'Stuck-Delayed' | 'Unavailable';
export const FLEET_STATUSES: FleetStatus[] = ['Free', 'Assigned', 'En Route', 'Stuck-Delayed', 'Unavailable'];
/** journalId: an own-fleet cost posted to the ledger when it was added. billId: an external transporter's Transport Charge billed to the transporter. */
export interface TripExpense { type: string; amount: number; note?: string; date: string; journalId?: string; billId?: string }
/** One movement of a vehicle (or of an external transporter) for a Delivery Order, a Collection or a Replacement. Always created from its document, so it is always tied to a project. */
export interface Trip {
  id: string; number: string;
  date: string;
  kind: TripKind;
  docId: string; docNumber: string;
  soId: string; soNumber: string; customerId: string; site: string; costCentre?: string;
  transport: 'Own Fleet' | 'External Transporter';
  /** Where the vehicle was when the trip started; it goes back there when the trip completes. */
  origin?: string;
  vehicleId?: string; plate?: string;
  driver?: string; mobile?: string;
  transporter?: string;
  status: TripStatus;
  /** When the trip last changed status, so the board can show how long a vehicle has been in its state. */
  since: string;
  stuck?: { reason: string; responsible: 'Company' | 'Client'; since: string };
  expenses: TripExpense[];
  log: LogItem[];
}
export const tripTotal = (t: Pick<Trip, 'expenses'>) => t.expenses.reduce((s, e) => s + e.amount, 0);
export const isOpenTrip = (t: Pick<Trip, 'status'>) => OPEN_TRIP.includes(t.status);

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
const liveCategories = (): CategoryRec[] => { seedCollection('inventory.categories', categorySeed); return getCollection<CategoryRec>('inventory.categories').filter((c) => c.status === 'Active'); };
export const groupOptions = () => { const rows = liveCategories(); return rows.filter(isTopCategory).filter((t) => rows.some((c) => c.parent === t.name)).map((t) => t.name); };
export const categoryOptions = (group?: string) => (group ? liveCategories().filter((c) => c.parent === group).map((c) => c.name) : []);
export const yearEnd = (from: string = TODAY) => `${from.slice(0, 4)}-12-31`;
export const plusYear = (d: string) => dayjs(d).add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD');
/** An AMC document carries one contract line built from its Contract Value, so totals, the visit split and invoicing keep working. It is never edited as an item. */
export const AMC_ITEM = 'AMC Annual Contract';
export const amcLine = (value: number, scope?: string, id = 'amc'): Line => ({ id, activity: 'AMC', lineType: 'Individual', item: AMC_ITEM, unit: 'Contract', qty: 1, price: value, foc: false, desc: scope || 'Annual maintenance contract', assigned: [], crossHire: [] });
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
  seedCollection(COL.billingCycles, cycleSeed); seedCollection(COL.fleet, heavySeed);
  return getCollection<HeavyRec>(COL.fleet);
}
export const assetById = (id: string) => fleetRows().find((a) => a.id === id);
export const assetByAssetId = (assetId: string) => fleetRows().find((a) => a.assetId === assetId);
export const assetLabel = (a?: HeavyRec) => (a ? `${a.assetId} - ${a.name}` : '-');
export const isLive = (a: HeavyRec) => a.status === 'Active' && a.assetStatus !== 'Disposed';
/** Units that can go out on a delivery: Ready for Hire units of the Category + Subcategory (owned fleet and received cross-hired units). */
export function availability(group?: string, category?: string, rows: HeavyRec[] = fleetRows()) {
  /** Own delivery vehicles are never part of the hire pool (Fleet Management decision D1). */
  const ready = rows.filter((a) => isLive(a) && !a.deliveryFleet && a.category === group && a.subCategory === category && a.assetStatus === 'Ready for Hire');
  return { owned: ready.filter((a) => a.ownership !== 'Cross-Hired'), cross: ready.filter((a) => a.ownership === 'Cross-Hired') };
}
/** Categories offered on a Rental line: a Category whose live assets are all delivery vehicles (for example Vehicle) is not rentable. Fixed Asset Trading keeps every Category. */
export const rentalGroupOptions = () => {
  const live = fleetRows().filter(isLive);
  return groupOptions().filter((g) => { const m = live.filter((a) => a.category === g); return !(m.length && m.every((a) => a.deliveryFleet)); });
};

/* ------------------------------------------------------------------ fleet management: vehicles and trips */
export function tripRows(): Trip[] { seedCollection(COL.trips, tripSeed); return getCollection<Trip>(COL.trips); }
/** The Heavy Equipment Fixed Assets ticked as Delivery fleet vehicle. */
export const deliveryVehicles = (rows: HeavyRec[] = fleetRows()) => rows.filter((a) => a.deliveryFleet && a.assetStatus !== 'Disposed');
const tripDay = (t: Pick<Trip, 'date'>) => t.date.slice(0, 10);
/** A trip that already occupies its vehicle: started (En Route, Stuck-Delayed) or Assigned for today or an earlier day that has not started yet. */
const occupiesNow = (t: Trip) => t.status === 'Stuck-Delayed' || t.status === 'En Route' || (t.status === 'Assigned' && tripDay(t) <= TODAY);
/** The trip a vehicle is busy with right now (a trip booked for a later day does not occupy it yet). */
export const openTripOf = (vehicleId: string, trips: Trip[] = tripRows()) => trips.find((t) => t.vehicleId === vehicleId && isOpenTrip(t) && occupiesNow(t));
/** The next trip booked for a later day, shown on the board so the dispatcher knows the vehicle is spoken for. */
export const nextBookingOf = (vehicleId: string, trips: Trip[] = tripRows()) => trips.filter((t) => t.vehicleId === vehicleId && t.status === 'Assigned' && tripDay(t) > TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
const notInService = (a: HeavyRec) => a.status === 'Inactive' || ['Under Maintenance', 'Breakdown', 'Disposed'].includes(a.assetStatus);
/**
 * Whether a vehicle can take a trip on a given day (default today). Availability is by date: a trip booked for next week does not block today.
 * A vehicle that is Stuck-Delayed is blocked for any day (nobody knows when it is released); En Route blocks the rest of today; Assigned blocks its own day.
 */
export function vehicleFreeOn(a: HeavyRec, date?: string, trips: Trip[] = tripRows(), exceptTripId?: string): boolean {
  if (notInService(a)) return false;
  const day = (date ?? TODAY).slice(0, 10);
  return !trips.some((t) => t.id !== exceptTripId && t.vehicleId === a.id && isOpenTrip(t) && (t.status === 'Stuck-Delayed' || (t.status === 'En Route' && day <= TODAY) || (t.status === 'Assigned' && (tripDay(t) === day || (tripDay(t) <= TODAY && day <= TODAY)))));
}
/**
 * Derived, never stored (one source of truth: the trips). Free when no open trip occupies it now, otherwise that trip's status.
 * Unavailable when the vehicle is not in service (Under Maintenance, Breakdown, Disposed or Inactive).
 */
export function fleetStatus(a: HeavyRec, trips: Trip[] = tripRows()): FleetStatus {
  if (notInService(a)) return 'Unavailable';
  return (openTripOf(a.id, trips)?.status as FleetStatus | undefined) ?? 'Free';
}
export function patchAsset(id: string, patch: Partial<HeavyRec>, audit?: { title: string; detail?: string }, movement?: { type: string; from: string; to: string; reference: string; customer?: string; project?: string }) {
  const rows = fleetRows();
  setCollection(COL.fleet, rows.map((a) => {
    if (a.id !== id) return a;
    const when = `${TODAY} ${dayjs().format('HH:mm')}`;
    const mv = movement ? [...a.movements, { id: `m${Date.now()}${a.movements.length}`, entryNo: `MV-26-${String(9000 + a.movements.length)}`, date: `${TODAY}T${dayjs().format('HH:mm')}`, type: movement.type, from: movement.from, to: movement.to, reference: movement.reference, by: ACTOR, customer: movement.customer, project: movement.project }] : a.movements;
    return { ...a, ...patch, movements: mv, audit: audit ? [...a.audit, { when, title: audit.title, detail: audit.detail, by: ACTOR }] : a.audit };
  }));
}

/* ------------------------------------------------------------------ seed data */
const L = (id: string, over: Partial<Line> & Pick<Line, 'activity' | 'item'>): Line => ({ lineType: 'Individual', unit: 'Nos', qty: 1, price: 0, foc: false, desc: over.desc ?? over.item, assigned: [], crossHire: [], ...over, id });
/** A rental equipment line priced Monthly between two dates. */
const R = (id: string, group: string, category: string, price: number, start: string, end: string, over: Partial<Line> = {}): Line =>
  L(id, { activity: 'Rental', item: `Rental ${group} ${category} Monthly`, group, category, frequency: 'Monthly', start, end, unit: 'Nos', price, pricingId: pricingSeed.find((p) => p.category === group && p.subCategory === category && p.frequency === 'Monthly')?.id, desc: `${group} ${category}, rental, monthly billing`, ...over });
/** Service lines are the Inventory service items (Type = Service); this is the CRM view of them. */
export const toServiceCharge = (i: ItemRec): ServiceCharge => ({ id: i.id, name: i.name, type: i.serviceType ?? 'Charge', billing: i.billing ?? 'One-time', price: i.price, desc: i.description ?? i.name, source: 'Inventory' });
/** Live Inventory items (what is added or edited in Inventory > Items shows in CRM item pickers, stock and prices). */
export function liveItems(): ItemRec[] { seedCollection('items', itemSeed); return getCollection<ItemRec>('items').filter((i) => i.status === 'Active'); }
export const serviceSeed: ServiceCharge[] = itemSeed.filter((i) => i.type === 'Service' && i.serviceType).map(toServiceCharge);
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
  { id: 'ld3', number: 'LD-26-00033', date: '2026-09-09', source: 'WhatsApp', activity: 'Rental', company: 'Emirates Infrastructure LLC', contact: 'Rashid Al Mansoori', phone: '+971 50 214 7781', email: 'rashid@emiratesinfra.ae', owner: 'Leena Thomas', status: 'New', nextFollowUp: '2026-10-02', tags: 'Existing customer', priority: 'Medium', leadType: 'Company', probability: 30, comms: [] },
  { id: 'ld4', number: 'LD-26-00034', date: '2026-08-21', source: 'Trade Show', activity: 'AMC', company: 'Blue Crest Logistics', contact: 'Arun Shetty', phone: '+971 55 889 1204', email: 'arun@bluecrest.ae', owner: 'Yousef Karim', status: 'Lost', lostReason: 'Competitor', tags: 'Logistics', priority: 'Low', leadType: 'Company', probability: 0, comms: [lg('2026-09-01 15:30', 'Client chose incumbent AMC provider', 'Yousef Karim')] },
  { id: 'ld5', number: 'LD-26-00035', date: '2026-08-04', source: 'Referral', activity: 'Rental', company: 'Palm Marina Development', contact: 'Daniel Foster', phone: '+971 52 905 7714', email: 'daniel@palmmarina.ae', owner: 'Leena Thomas', status: 'Converted', tags: 'Marina Tower 3', priority: 'High', leadType: 'Company', probability: 80, opportunityId: 'op4', comms: [lg('2026-08-06 11:00', 'Site visit completed', 'Leena Thomas')] },
  { id: 'ld6', number: 'LD-26-00023', date: '2026-09-24', source: 'Phone', activity: 'Rental', company: 'Horizon Steel Fabricators', contact: 'Karim Haddad', phone: '+971 50 381 2290', email: 'karim@horizonsteel.ae', owner: 'Omar Farouk', status: 'Cold call', nextFollowUp: '2026-10-02', tags: 'Workshop, Ajman', priority: 'Low', leadType: 'Company', probability: 10, comms: [lg('2026-09-24 12:10', 'Cold call: interested in a 200 KVA for the paint shop', 'Omar Farouk')] },
  { id: 'ld7', number: 'LD-26-00024', date: '2026-09-20', source: 'Linkedin', activity: 'Rental', company: 'Coastal Marine Works', contact: 'Joanna Lewis', phone: '+971 55 607 1184', email: 'joanna@coastalmarine.ae', owner: 'Leena Thomas', status: 'Contact in progress', nextFollowUp: '2026-10-01', tags: 'Marine, Jebel Ali Port', priority: 'Medium', leadType: 'Company', probability: 70, comms: [lg('2026-09-21 10:00', 'Email sent: fleet list and rate card')] },
  { id: 'ld8', number: 'LD-26-00025', date: '2026-09-16', source: 'Email', activity: 'AMC', company: 'Al Barsha Medical Centre', contact: 'Sameer Joshi', phone: '+971 52 448 9017', email: 'facilities@albarshamedical.ae', owner: 'Leena Thomas', status: 'Follow up', nextFollowUp: '2026-10-03', tags: 'Healthcare, standby power', priority: 'High', leadType: 'Company', probability: 80, comms: [lg('2026-09-18 15:00', 'Site survey done: two 500 KVA standby sets', 'Leena Thomas')] },
  { id: 'ld9', number: 'LD-26-00026', date: '2026-09-12', source: 'Referral', activity: 'Rental', company: 'Skyline Towers Contracting', contact: 'Faisal Rahimi', phone: '+971 54 902 6631', email: 'faisal@skylinetowers.ae', owner: 'Yousef Karim', status: 'Negotiating', nextFollowUp: '2026-10-01', tags: 'High-rise, Business Bay', priority: 'High', leadType: 'Company', probability: 50, comms: [lg('2026-09-25 11:30', 'Client asked for 8% off on a 9 month hire', 'Yousef Karim')] },
  { id: 'ld10', number: 'LD-26-00027', date: '2026-09-10', source: 'Website', activity: 'Fuel Trading', company: 'Northgate Logistics Park', contact: 'Meera Pillai', phone: '+971 56 230 7745', email: 'meera@northgatepark.ae', owner: 'Omar Farouk', status: 'Quotation sent', nextFollowUp: '2026-10-04', tags: 'Diesel supply', priority: 'Medium', leadType: 'Company', probability: 30, comms: [lg('2026-09-22 09:40', 'Diesel price sent for 15,000 L per month', 'Omar Farouk')] },
  { id: 'ld11', number: 'LD-26-00028', date: '2026-09-08', source: 'Trade Show', activity: 'AMC', company: 'Oasis Data Centre FZ', contact: 'Thomas Becker', phone: '+971 50 774 3308', email: 'thomas@oasisdc.ae', owner: 'Leena Thomas', status: 'Qualified', nextFollowUp: '2026-10-05', tags: 'Data centre, load bank test', priority: 'High', leadType: 'Company', probability: 50, comms: [lg('2026-09-09 14:00', 'Budget and scope confirmed for annual load bank tests', 'Leena Thomas')] },
  { id: 'ld12', number: 'LD-26-00029', date: '2026-08-28', source: 'Facebook', activity: 'Rental', company: 'Sunrise Party Rentals', contact: 'Lina Haddad', phone: '+971 58 119 4472', email: 'lina@sunriseparty.ae', owner: 'Omar Farouk', status: 'Unqualified', lostReason: 'Client Went Cold', tags: 'Events', priority: 'Low', leadType: 'Company', probability: 0, comms: [lg('2026-09-02 10:30', 'Needs a 20 KVA unit only, below our fleet range', 'Omar Farouk')] },
  { id: 'ld13', number: 'LD-26-00030', date: '2026-08-25', source: 'Walk-in', activity: 'Trading', company: 'Ahmed Saleh', contact: 'Ahmed Saleh', phone: '+971 50 662 1093', email: 'ahmed.saleh@mail.ae', owner: 'Yousef Karim', status: 'Not qualified', tags: 'Individual', priority: 'Low', leadType: 'Individual', probability: 0, comms: [lg('2026-08-25 16:00', 'Wanted a used home generator, not a trade customer', 'Yousef Karim')] },
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
  O({ id: 'op11', number: 'OP-26-00018', date: '2026-09-15', customerId: 'c6', contact: 'Hassan Ali', project: 'Kiln 4 Shutdown', owner: 'Yousef Karim', title: 'Rent 500 KVA with installation and commissioning for the Kiln 4 shutdown', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 155000, probability: 100, expectedClose: '2026-09-27', quotationId: 'qt11', site: 'Sharjah Cement, Kiln 4' }),
  O({ id: 'op12', number: 'OP-26-00019', date: '2026-09-22', customerId: 'c4', contact: 'Imran Qureshi', project: 'Resort Backup Power', owner: 'Leena Thomas', title: 'Annual maintenance with load bank tests for the resort standby generators', activity: 'AMC', stage: 'Quoted', rating: 'Warm', estimated: 7000, probability: 50, expectedClose: '2026-10-15', quotationId: 'qt12', site: 'Desert Pearl Resort, Sharjah' }),
  O({ id: 'op13', number: 'OP-26-00020', date: '2026-08-12', customerId: 'c3', contact: 'Maha Saleh', project: 'Global Village Season', owner: 'Omar Farouk', title: 'Rent 2 x 200 KVA for the Global Village season', activity: 'Rental', stage: 'Lost', rating: 'Cold', estimated: 88000, probability: 0, expectedClose: '2026-09-10', lostReason: 'Price', winLossReason: 'Lost To Competition', comments: 'Competitor quoted 12% lower with fuel included', lines: [L('op13a', { activity: 'Rental', item: 'Generator 200 KVA', group: 'Generator', category: '200 KVA', qty: 2, price: 29500 })] }),
  O({ id: 'op14', number: 'OP-26-00017', date: '2026-09-19', customerId: 'c1', contact: 'Rashid Al Mansoori', project: 'Al Maktoum Airport Expansion', owner: 'Leena Thomas', title: 'Rent 1000 KVA for the Al Maktoum terminal works', activity: 'Rental', stage: 'Negotiation', rating: 'Hot', estimated: 196000, probability: 70, expectedClose: '2026-10-15', site: 'Al Maktoum Airport Expansion', nextAction: 'Client asked for 5% off on a 6 month commitment', lines: [L('op14a', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', price: 98000 })] }),
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
const so4Lines = [R('so4a', 'Generator', '1500 KVA', 145000, '2026-10-05', '2027-03-31'), R('so4b', 'Generator', '100 KVA', 18500, '2026-10-05', '2027-03-31', { qty: 2 }), S('so4c', 'Delivery Charge', 2000, 'One-time'), S('so4d', 'Return Charge', 2000, 'One-time')];
const so5Lines = [R('so5a', 'Generator', '500 KVA', 50000, '2026-02-20', '2026-09-22')];
const S6 = 'Annual maintenance of the 1500 KVA standby generator at Marina Tower 3: four scheduled visits, consumables and extra work billed against each job card';
const so6Lines = [amcLine(24000, S6, 'so6a')];
const so9Lines = [R('so9a', 'Generator', '200 KVA', 29500, '2026-06-01', '2026-09-30'), R('so9b', 'Generator', '100 KVA', 18500, '2026-06-01', '2026-09-30'), R('so9c', 'Generator', '500 KVA', 52000, '2026-06-01', '2026-09-30'), S('so9d', 'Delivery Charge', 1500, 'One-time')];
const S10 = 'Annual maintenance of the 500 KVA standby generator at the Al Maktoum site office: four scheduled visits, consumables and extra work billed against each job card';
const so10Lines = [amcLine(18000, S10, 'so10a')];
const so10Plan = planVisits('2025-12-01', '2026-11-30', 4, 18000);
const so11Lines = [R('so11a', 'Generator', '500 KVA', 52000, '2026-10-05', '2026-12-31'), S('so11b', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so11c', 'Transportation', 1200, 'One-time')];
/** Test order for Cross Hire (SO-26-00055): nothing delivered, no Ready for Hire 1500 KVA unit and the only 20 ft POD is under maintenance. */
const so12Lines = [R('so12a', 'Generator', '1500 KVA', 145000, '2026-10-05', '2027-04-04', { qty: 2 }), R('so12b', 'POD', '20 ft POD', 7500, '2026-10-05', '2027-04-04', { crossHire: ['chr5'] }), S('so12c', 'Delivery Charge', 2000, 'One-time')];
/** Test order for Rental invoicing (SO-26-00056): two 500 KVA units delivered on different days and one 200 KVA returned mid-cycle, a monthly damage waiver and delivery and return charges. */
const so13Lines = [R('so13a', 'Generator', '500 KVA', 50000, '2026-09-01', '2027-02-28', { qty: 2 }), R('so13b', 'Generator', '200 KVA', 29500, '2026-09-01', '2027-02-28'), S('so13c', 'Delivery Charge', 1500, 'One-time'), S('so13d', 'Return Charge', 1500, 'One-time'), S('so13e', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-09-01', end: '2027-02-28' })];
/** Test order for the weekly Automatic cycle (SO-26-00057): the scheduler raises its invoices. */
const so14Lines = [R('so14a', 'Generator', '100 KVA', 18500, '2026-09-24', '2026-12-31')];
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
  q('qt7', 'QT-26-00085', 'op7', 'c8', 'Converted to Sales Order', 'AMC', qLines(so6Lines, 'qt7'), { date: '2026-09-18', contractType: 'Closed', amcStart: '2026-10-01', amcEnd: '2027-09-30', visits: 4, amcValue: 24000, amcScope: S6, salesOrderId: 'so6' }),
  q('qt8', 'QT-26-00086', 'op8', 'c1', 'Converted to Sales Order', 'Trading', qLines(so7Lines, 'qt8'), { date: '2026-09-20', salesOrderId: 'so7' }),
  q('qt11', 'QT-26-00079', 'op11', 'c6', 'Converted to Sales Order', 'Rental', qLines(so11Lines, 'qt'), { date: '2026-09-18', validUntil: '2026-10-18', contractType: 'Closed', contractStart: '2026-10-05', contractEnd: '2026-12-31', salesOrderId: 'so11', preparedBy: 'Yousef Karim' }),
  q('qt12', 'QT-26-00080', 'op12', 'c4', 'Approved', 'AMC', [amcLine(7000, 'Two scheduled visits with a load bank test and report for the two resort standby generators', 'qt12a')], { date: '2026-09-24', validUntil: '2026-10-24', contractType: 'Closed', amcStart: '2026-11-01', amcEnd: '2027-10-31', visits: 2, amcValue: 7000, amcScope: 'Two scheduled visits with a load bank test and report for the two resort standby generators', log: [lg('2026-09-24 10:00', 'Quotation created', 'Leena Thomas'), lg('2026-09-25 09:30', 'Approved', 'Omar Farouk', undefined, 'green')] }),
];

const asg = (assetId: string, deliveryId: string, start: string, over: Partial<Assignment> = {}): Assignment => ({ assetId, deliveryId, start, state: 'On Hire', ...over });
const withAsg = (ls: Line[], map: Record<string, Assignment[]>, extra: Record<string, Partial<Line>> = {}) => ls.map((l) => ({ ...l, assigned: map[l.id] ?? [], ...(extra[l.id] ?? {}) }));
const so = (o: Omit<SalesOrder, 'entity' | 'paymentTerms' | 'currency' | 'vatType' | 'discountPct' | 'terms' | 'docs' | 'damageCharges' | 'logisticsCost' | 'deliveryMethod'> & Partial<SalesOrder>): SalesOrder => ({
  entity: ENT, paymentTerms: '30 days', currency: 'AED', vatType: VAT_TYPES[0], discountPct: 0, terms: TERMS, docs: [], damageCharges: [], logisticsCost: 0, deliveryMethod: 'Own Fleet', ...o,
});
export const orderSeed: SalesOrder[] = [
  so({ id: 'so1', number: 'SO-26-00041', date: '2026-08-30', quoteId: 'qt1', oppId: 'op1', customerId: 'c5', owner: 'Leena Thomas', title: 'Rent 500 KVA and 1000 KVA for Route 2020 Depot', reference: 'LPO-DMW-5521', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-04-12', contractEnd: '2026-10-08',
    lpo: 'LPO-DMW-5521', lpoDate: '2026-08-28', lpoExpiry: '2026-10-05', site: 'Route 2020 Depot, Jebel Ali', costCentre: 'SO-26-00041 Route 2020 Depot (Dubai Metro Works JV)', docs: ['LPO-DMW-5521.pdf', 'QT-26-00081.pdf'],
    lines: withAsg(so1Lines, { so1a: [asg('he15', 'dl1', '2026-04-12')], so1b: [asg('he18', 'dl2', '2026-05-18')] }, { so1d: { fulfilment: 'Charged and invoiced', fulfilmentRef: 'INV-26-00402' } }),
    log: [lg('2026-09-10 12:00', 'Extension EX-26-00007: end date 2026-09-08 to 2026-10-08', 'Leena Thomas', 'The existing Sales Order is revised, no new order is created', 'green'), lg('2026-08-30 10:00', 'Sales Order created from QT-26-00081', 'Leena Thomas')] }),
  so({ id: 'so2', number: 'SO-26-00046', date: '2026-09-01', quoteId: 'qt2', oppId: 'op2', customerId: 'c2', owner: 'Yousef Karim', title: 'Rent 200 KVA with POD for Yas Island Villas', reference: 'LPO-GBC-2209', status: 'Fully Delivered', activity: 'Rental', contractType: 'Open PO', contractStart: '2026-07-04', contractEnd: '2026-12-31',
    lpo: 'LPO-GBC-2209', lpoDate: '2026-08-31', lpoExpiry: '2026-12-31', site: 'Yas Island, Abu Dhabi', costCentre: 'SO-26-00046 Yas Island Villas Phase 2', deliveryMethod: 'External Transporter', logisticsCost: 2800, docs: ['LPO-GBC-2209.pdf'],
    lines: withAsg(so2Lines, { so2a: [asg('he14', 'dl3', '2026-06-01', { state: 'Replaced', stop: '2026-06-12' }), asg('he28', 'dl3', '2026-06-12', { state: 'Replaced', stop: '2026-07-04' }), asg('he13', 'dl3', '2026-07-04')], so2b: [asg('he24', 'dl4', '2026-07-06', { state: 'Returned', stop: '2026-09-26' })] },
      { so2a: { crossHire: ['ch2', 'chr3'] }, so2c: { fulfilment: 'Charged and invoiced', fulfilmentRef: 'INV-26-00415' } }),
    log: [lg('2026-09-29 14:20', 'Cross-Hire request CHR-26-00006 raised', 'Yousef Karim', 'Generator 200 KVA', 'blue'), lg('2026-09-27 10:00', 'Damage covered by damage waiver', 'Sanjay Kumar', 'AST-1024: dent on the container door and a broken cable gland. Damage invoice blocked because a waiver was paid', 'red'),
      lg('2026-09-26 10:00', 'Return CN-26-00132: AST-1024 off hire', 'Yousef Karim', 'Client no longer needs the POD', 'amber'), lg('2026-09-01 09:30', 'Sales Order created from QT-26-00082', 'Yousef Karim')] }),
  so({ id: 'so3', number: 'SO-26-00044', date: '2026-09-12', quoteId: 'qt3', oppId: 'op3', customerId: 'c3', owner: 'Omar Farouk', title: 'Rent 500 KVA for Expo winter festival', reference: 'LPO-ANE-0912', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-05-06', contractEnd: '2026-10-25',
    lpo: 'LPO-ANE-0912', lpoDate: '2026-09-11', lpoExpiry: '2026-10-25', site: 'Expo City, Dubai', costCentre: 'Dubai Branch',
    lines: withAsg(so3Lines, { so3a: [asg('he27', 'dl5', '2026-05-06')] }, { so3a: { crossHire: ['ch1'] } }),
    log: [lg('2026-09-12 14:00', 'Sales Order created from QT-26-00083', 'Omar Farouk'), lg('2026-05-06 09:00', 'Cross-hired AST-1027 allocated', 'Bilal Ahmed')] }),
  so({ id: 'so4', number: 'SO-26-00052', date: '2026-09-16', quoteId: 'qt4', oppId: 'op4', customerId: 'c8', owner: 'Leena Thomas', title: 'Rent 1500 KVA and 100 KVA for Marina Tower 3', reference: 'LPO-PMD-7710', status: 'Partially Delivered', activity: 'Rental', contractType: 'Project', contractStart: '2026-10-05', contractEnd: '2027-03-31', billingStructure: 'Milestone',
    lpo: 'LPO-PMD-7710', lpoDate: '2026-09-14', lpoExpiry: '2027-04-30', site: 'Dubai Marina', costCentre: 'Dubai Branch', docs: ['LPO-PMD-7710.pdf'],
    lines: withAsg(so4Lines, { so4a: [asg('he19', 'dl7', '2026-10-05', { state: 'Hold' })] }, { so4b: { crossHire: ['ch3', 'ch5'] } }),
    log: [lg('2026-09-30 08:30', 'Delivery DO-26-00125: 1 item(s), AST-1019 on Hold', 'Bilal Ahmed', 'Rental starts on the planned Rental Start Date. Site not ready for deployment (Client)', 'amber'), lg('2026-09-29 10:05', 'Cross-hire order CH-26-00008', 'Bilal Ahmed', 'Gulf Genset Rentals, Inventory', 'blue'),
      lg('2026-09-26 11:00', 'Cross-hire order CH-26-00010', 'Bilal Ahmed', 'Gulf Genset Rentals, Inventory', 'blue'), lg('2026-09-16 10:15', 'Sales Order created from QT-26-00084', 'Leena Thomas')] }),
  so({ id: 'so5', number: 'SO-26-00048', date: '2026-02-18', customerId: 'c6', owner: 'Yousef Karim', title: 'Rent 500 KVA for Kiln 4 shutdown', reference: 'LPO-SCC-3318', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-02-20', contractEnd: '2026-09-22',
    lpo: 'LPO-SCC-3318', lpoDate: '2026-02-16', lpoExpiry: '2026-09-25', site: 'Sharjah Cement, Kiln 4', costCentre: 'Dubai Branch', logisticsCost: 1500,
    lines: withAsg(so5Lines, { so5a: [asg('he16', 'dl6', '2026-02-20')] }), log: [lg('2026-02-18 09:00', 'Sales Order created', 'Yousef Karim')] }),
  so({ id: 'so6', number: 'SO-26-00053', date: '2026-09-25', quoteId: 'qt7', oppId: 'op7', customerId: 'c8', owner: 'Leena Thomas', title: 'AMC for Marina Tower 3 standby generator', reference: 'LPO-PMD-7790', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2026-10-01', amcEnd: '2027-09-30', visits: 4, amcValue: 24000, amcScope: S6,
    lpo: 'LPO-PMD-7790', lpoDate: '2026-09-24', lpoExpiry: '2027-09-30', site: 'Dubai Marina', costCentre: 'Dubai Branch', lines: withAsg(so6Lines, {}), visitPlan: planVisits('2026-10-01', '2027-09-30', 4, 24000),
    log: [lg('2026-09-25 10:00', 'Sales Order created from QT-26-00085', 'Leena Thomas')] }),
  so({ id: 'so7', number: 'SO-26-00054', date: '2026-09-28', quoteId: 'qt8', oppId: 'op8', customerId: 'c1', owner: 'Leena Thomas', title: 'Supply ATS panel and filters to Al Maktoum site', reference: 'LPO-EIL-4410', status: 'Confirmed', activity: 'Trading',
    lpo: 'LPO-EIL-4410', lpoDate: '2026-09-27', lpoExpiry: '2026-12-31', site: 'Al Maktoum Airport Expansion', costCentre: 'SO-26-00044 Al Maktoum Airport Expansion', lines: withAsg(so7Lines, {}),
    log: [lg('2026-09-28 11:00', 'Sales Order created from QT-26-00086', 'Leena Thomas')] }),
  so({ id: 'so9', number: 'SO-26-00049', date: '2026-05-28', customerId: 'c1', owner: 'Omar Farouk', title: 'Rent 200, 100 and 500 KVA for the Al Maktoum trial run', reference: 'LPO-EIL-3870', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-06-01', contractEnd: '2026-09-30',
    lpo: 'LPO-EIL-3870', lpoDate: '2026-05-26', lpoExpiry: '2026-10-31', site: 'Al Maktoum Airport Expansion', costCentre: 'Dubai Branch', docs: ['LPO-EIL-3870.pdf'],
    damageCharges: [{ assetId: 'he29', amount: 4500, note: 'Control panel display cracked and canopy door hinge broken', date: '2026-09-16' }],
    lines: withAsg(so9Lines, { so9a: [asg('he29', 'dl8', '2026-06-01', { state: 'Returned', stop: '2026-09-15' })], so9b: [asg('he30', 'dl9', '2026-06-01', { state: 'Returned', stop: '2026-09-29' })], so9c: [asg('he36', 'dl10', '2026-06-01', { state: 'Returned', stop: '2026-09-30' })] },
      { so9d: { fulfilment: 'Charged and invoiced', fulfilmentRef: 'INV-26-00344' } }),
    log: [lg('2026-09-30 10:00', 'Return CN-26-00123: AST-1036 off hire', 'Omar Farouk', 'Company collection arranged', 'amber'), lg('2026-09-29 11:00', 'Return CN-26-00122: AST-1030 off hire', 'Omar Farouk', 'Client self-return', 'amber'),
      lg('2026-09-16 10:30', 'Damage charge AED 4500', 'Sanjay Kumar', 'AST-1029: control panel display cracked and canopy door hinge broken. Linked permanently to this order', 'red'), lg('2026-09-15 14:00', 'Return CN-26-00121: AST-1029 off hire', 'Omar Farouk', undefined, 'amber'), lg('2026-05-28 09:00', 'Sales Order created', 'Omar Farouk')] }),
  so({ id: 'so10', number: 'SO-26-00050', date: '2025-11-28', customerId: 'c1', owner: 'Leena Thomas', title: 'AMC for the Al Maktoum site office standby generator', reference: 'LPO-EIL-3920', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2025-12-01', amcEnd: '2026-11-30', visits: 4, amcValue: 18000, amcScope: S10,
    lpo: 'LPO-EIL-3920', lpoDate: '2025-11-25', lpoExpiry: '2026-11-30', site: 'Al Maktoum Airport Expansion', costCentre: 'Dubai Branch', lines: withAsg(so10Lines, {}),
    visitPlan: so10Plan.map((v, i) => (i < 3 ? { ...v, done: v.date, ref: `JC-26-${String(104 + i).padStart(5, '0')}`, type: 'Job card', jobCardId: `jc${i + 2}` } : { ...v, jobCardId: 'jc5' })),
    log: [lg('2025-11-28 10:00', 'Sales Order created', 'Leena Thomas')] }),
  so({ id: 'so11', number: 'SO-26-00051', date: '2026-09-27', quoteId: 'qt11', oppId: 'op11', customerId: 'c6', owner: 'Yousef Karim', title: 'Rent 500 KVA with installation and commissioning for the Kiln 4 shutdown', reference: 'LPO-SCC-3402', status: 'Confirmed', activity: 'Rental', contractType: 'Closed', contractStart: '2026-10-05', contractEnd: '2026-12-31',
    lpo: 'LPO-SCC-3402', lpoDate: '2026-09-26', lpoExpiry: '2026-12-31', site: 'Sharjah Cement, Kiln 4', costCentre: 'Dubai Branch', lines: withAsg(so11Lines, {}),
    log: [lg('2026-09-27 09:15', 'Sales Order created from QT-26-00079', 'Yousef Karim')] }),
  so({ id: 'so12', number: 'SO-26-00055', date: '2026-09-29', customerId: 'c4', owner: 'Yousef Karim', title: 'Rent 2 x 1500 KVA and a POD for Desert Pearl Resort Phase 2', reference: 'LPO-DPH-5001', status: 'Confirmed', activity: 'Rental', contractType: 'Closed', contractStart: '2026-10-05', contractEnd: '2027-04-04',
    lpo: 'LPO-DPH-5001', lpoDate: '2026-09-28', lpoExpiry: '2027-04-30', site: 'Desert Pearl Resort, Sharjah', costCentre: 'Dubai Branch', docs: ['LPO-DPH-5001.pdf'], lines: withAsg(so12Lines, {}),
    log: [lg('2026-09-30 09:00', 'Cross-Hire request CHR-26-00008 raised', 'Yousef Karim', 'POD 20 ft POD, quantity 1', 'blue'), lg('2026-09-29 10:00', 'Sales Order created', 'Yousef Karim')] }),
  so({ id: 'so13', number: 'SO-26-00056', date: '2026-08-29', customerId: 'c1', owner: 'Omar Farouk', title: 'Rent 2 x 500 KVA and 200 KVA for the Al Maktoum terminal extension', reference: 'LPO-EIL-1180', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-09-01', contractEnd: '2027-02-28',
    lpo: 'LPO-EIL-1180', lpoDate: '2026-08-28', lpoExpiry: '2027-03-15', site: 'Al Maktoum Airport Expansion', costCentre: 'Dubai Branch', docs: ['LPO-EIL-1180.pdf'],
    lines: withAsg(so13Lines, { so13a: [asg('he51', 'dl11', '2026-09-01'), asg('he52', 'dl12', '2026-09-12')], so13b: [asg('he53', 'dl13', '2026-09-01', { state: 'Returned', stop: '2026-09-20' })] }),
    log: [lg('2026-09-20 15:00', 'Return CN-26-00124: AST-1053 off hire', 'Omar Farouk', 'Billing stops on the off-hire day', 'amber'), lg('2026-09-12 08:00', 'Delivery DO-26-00127: AST-1052', 'Bilal Ahmed'), lg('2026-09-01 08:00', 'Delivery DO-26-00126, DO-26-00128: AST-1051, AST-1053', 'Bilal Ahmed'), lg('2026-08-29 09:00', 'Sales Order created', 'Omar Farouk')] }),
  so({ id: 'so14', number: 'SO-26-00057', date: '2026-09-22', customerId: 'c7', owner: 'Yousef Karim', title: 'Rent 100 KVA, billed weekly, for the Al Safa substation test', reference: 'LPO-ASU-2201', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-09-24', contractEnd: '2026-12-31',
    lpo: 'LPO-ASU-2201', lpoDate: '2026-09-21', lpoExpiry: '2027-01-15', site: 'Mussafah Substation, Abu Dhabi', costCentre: 'Dubai Branch', billingCycle: 'Weekly', invoicingType: 'Automatic', lines: withAsg(so14Lines, { so14a: [asg('he54', 'dl14', '2026-09-24')] }),
    log: [lg('2026-09-24 08:00', 'Delivery DO-26-00129: AST-1054', 'Bilal Ahmed'), lg('2026-09-22 09:00', 'Sales Order created', 'Yousef Karim')] }),
];

/**
 * MASTER TEST ORDER (SO-26-00058, Gulf Build Contracting): one rental order that exercises Cross Hire, Fleet, Delivery, Replacement, Extension, Return and Invoicing.
 * Owned Ready for Hire units today: 500 KVA x 2, 1000 KVA x 2, 200 KVA x 1, 1500 KVA x 0. So 500 KVA and 1000 KVA deliver from stock, 200 KVA needs one cross-hire unit
 * and 1500 KVA needs one. Contract start is in the past so a delivery dated at the contract start has its first invoice due straight away. Nothing is delivered.
 */
const M_START = '2026-08-20';
const M_END = '2027-02-19';
const so15Lines = [
  R('so15a', 'Generator', '500 KVA', 50000, M_START, M_END, { qty: 2 }), R('so15b', 'Generator', '1000 KVA', 98000, M_START, M_END), R('so15c', 'Generator', '200 KVA', 29500, M_START, M_END, { qty: 2 }), R('so15d', 'Generator', '1500 KVA', 145000, M_START, M_END),
  S('so15e', 'Delivery Charge', 2000, 'One-time'), S('so15f', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so15g', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: M_START, end: M_END }), S('so15h', 'Return Charge', 2000, 'One-time'),
];
leadSeed.push({ id: 'ld13', number: 'LD-26-00036', date: '2026-08-10', source: 'Referral', activity: 'Rental', company: 'Gulf Build Contracting', contact: 'Khaled Mansoor', phone: '+971 50 774 1203', email: 'khaled@gulfbuild.ae', owner: 'Yousef Karim', status: 'Converted', tags: 'Yas Island Phase 3', priority: 'High', leadType: 'Company', probability: 80, opportunityId: 'op15',
  comms: [lg('2026-08-12 10:00', 'Converted to Opportunity OP-26-00029', 'Yousef Karim'), lg('2026-08-10 09:30', 'Lead created', 'Yousef Karim', 'Referral from the Yas Island Phase 2 team')] });
oppSeed.push(O({ id: 'op15', number: 'OP-26-00029', date: '2026-08-12', customerId: 'c2', contact: 'Khaled Mansoor', project: 'Yas Island Villas Phase 3', owner: 'Yousef Karim', title: 'Rent 500, 1000, 200 and 1500 KVA for Yas Island Villas Phase 3', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 620000, probability: 100, expectedClose: '2026-08-30', leadId: 'ld13', quotationId: 'qt13', site: 'Yas Island Phase 3, Abu Dhabi' }));
quoteSeed.push(q('qt13', 'QT-26-00087', 'op15', 'c2', 'Converted to Sales Order', 'Rental', qLines(so15Lines, 'qt13'), { date: '2026-08-14', validUntil: '2026-09-14', contractType: 'Closed', contractStart: M_START, contractEnd: M_END, salesOrderId: 'so15', preparedBy: 'Yousef Karim' }));
orderSeed.push(so({ id: 'so15', number: 'SO-26-00058', date: '2026-08-18', quoteId: 'qt13', oppId: 'op15', customerId: 'c2', owner: 'Yousef Karim', title: 'Master test: 500, 1000, 200 and 1500 KVA for Yas Island Villas Phase 3', reference: 'LPO-GBC-3305', status: 'Confirmed', activity: 'Rental', contractType: 'Closed', contractStart: M_START, contractEnd: M_END,
  lpo: 'LPO-GBC-3305', lpoDate: '2026-08-17', lpoExpiry: '2027-03-31', site: 'Yas Island Phase 3, Abu Dhabi', costCentre: 'Dubai Branch', docs: ['LPO-GBC-3305.pdf'], billingCycle: 'Monthly', invoicingType: 'Manual', lines: withAsg(so15Lines, {}),
  log: [lg('2026-08-18 10:00', 'Sales Order created from QT-26-00087', 'Yousef Karim')] }));

const dl = (id: string, number: string, s: SalesOrder, lineId: string, assetId: string, date: string, over: Partial<Delivery> = {}): Delivery => {
  const l = s.lines.find((x) => x.id === lineId);
  return { id, number, soId: s.id, soNumber: s.number, lineId, customerId: s.customerId, date, type: 'Full', assetIds: [assetId], accessories: [], description: '', transport: 'Own Fleet', extCost: 0, conditionFiles: [],
    signature: 'E-signature', foc: false, status: 'Acknowledged', closed: false, rentalStart: date, requestedSub: l?.category, deliveredSub: l?.category, ...over };
};
const sx = (id: string) => orderSeed.find((o) => o.id === id)!;
export const deliverySeed: Delivery[] = [
  dl('dl1', 'DO-26-00102', sx('so1'), 'so1a', 'he15', '2026-04-12', { driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213', mobile: '+971 50 311 4090' }),
  dl('dl2', 'DO-26-00108', sx('so1'), 'so1b', 'he18', '2026-05-18', { type: 'Partial' }),
  dl('dl3', 'DO-26-00131', sx('so2'), 'so2a', 'he13', '2026-07-04', { transport: 'External Transporter', extCost: 1400, transportedBy: 'Gulf Haulage and Transport LLC' }),
  dl('dl4', 'DO-26-00132', sx('so2'), 'so2b', 'he24', '2026-07-06', { transport: 'External Transporter', extCost: 1400, closed: true, transportedBy: 'Al Safeer Heavy Transport' }),
  dl('dl5', 'DO-26-00079', sx('so3'), 'so3a', 'he27', '2026-05-06'),
  dl('dl6', 'DO-26-00044', sx('so5'), 'so5a', 'he16', '2026-02-20', { driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213', mobile: '+971 50 311 4090' }),
  dl('dl7', 'DO-26-00125', sx('so4'), 'so4a', 'he19', '2026-09-30', { rentalStart: '2026-10-05', startReason: 'Site not ready for deployment', startBy: 'Client', siteReady: false, driver: 'Imran Shah', vehicleNumber: 'Sharjah 3 22871', mobile: '+971 55 418 2276' }),
  dl('dl8', 'DO-26-00121', sx('so9'), 'so9a', 'he29', '2026-06-01', { closed: true }),
  dl('dl9', 'DO-26-00122', sx('so9'), 'so9b', 'he30', '2026-06-01', { closed: true }),
  dl('dl10', 'DO-26-00123', sx('so9'), 'so9c', 'he36', '2026-06-01', { closed: true }),
  dl('dl11', 'DO-26-00126', sx('so13'), 'so13a', 'he51', '2026-09-01', { driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213' }),
  dl('dl12', 'DO-26-00127', sx('so13'), 'so13a', 'he52', '2026-09-12', { type: 'Partial', driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213' }),
  dl('dl14', 'DO-26-00129', sx('so14'), 'so14a', 'he54', '2026-09-24', { driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213' }),
  dl('dl13', 'DO-26-00128', sx('so13'), 'so13b', 'he53', '2026-09-01', { closed: true, driver: 'Tariq Hussain', vehicleNumber: 'Dubai P 48213' }),
];

/** One return per stage: off hire waiting for the yard, in the yard waiting for inspection, damage charged, damage covered by a waiver. */
const rt = (id: string, number: string, s: SalesOrder, lineId: string, deliveryId: string, assetId: string, method: string, timestamp: string, over: Partial<ReturnEntry> = {}): ReturnEntry => ({
  id, number, soId: s.id, soNumber: s.number, customerId: s.customerId, lineId, deliveryId, assetId, method, timestamp, siteChecklist: MASTER_SEED.siteChecklist, photos: [`site-${number}.jpg`], fuelNote: 'Tank at about one quarter', stage: 2, yardChecklist: [], inspection: 'Pending Inspection',
  log: [lg(`${timestamp.replace('T', ' ')}`, 'Return entry raised', 'Bilal Ahmed', 'Off-Hire. Billing stopped', 'amber'), lg(`${timestamp.replace('T', ' ')}`, 'Site check completed', 'Bilal Ahmed', '4 of 4 checks'), lg(`${timestamp.replace('T', ' ')}`, method === 'Company Collection' ? 'Collection arranged' : 'Client self-return', 'Bilal Ahmed')], ...over,
});
export const returnSeed: ReturnEntry[] = [
  rt('rt1', 'CN-26-00123', sx('so9'), 'so9c', 'dl10', 'he36', 'Company Collection', '2026-09-30T10:00'),
  rt('rt2', 'CN-26-00122', sx('so9'), 'so9b', 'dl9', 'he30', 'Self-Return', '2026-09-29T11:00', { stage: 3, reachedYard: '2026-09-29 15:00' }),
  rt('rt3', 'CN-26-00121', sx('so9'), 'so9a', 'dl8', 'he29', 'Company Collection', '2026-09-15T14:00', { stage: 5, reachedYard: '2026-09-15 16:00', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 4500, damageNote: 'Control panel display cracked and canopy door hinge broken', waiverApplied: false, outcome: 'Repair / Maintenance' }),
  rt('rt4', 'CN-26-00132', sx('so2'), 'so2b', 'dl4', 'he24', 'Company Collection', '2026-09-26T10:00', { stage: 5, reachedYard: '2026-09-26 15:30', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 0, damageNote: 'Dent on the container door and a broken cable gland', waiverApplied: true, outcome: 'Repair / Maintenance' }),
];
export const replacementSeed: Replacement[] = [
  { id: 'rp0', number: 'RP-26-00003', soId: 'so2', lineId: 'so2a', oldAssetId: 'he14', newAssetId: 'he28', reason: 'Breakdown', priceAdjust: 0, notified: true, date: '2026-06-12', crossHireId: 'ch2', by: 'Bilal Ahmed' },
  { id: 'rp1', number: 'RP-26-00004', soId: 'so2', lineId: 'so2a', oldAssetId: 'he28', newAssetId: 'he13', reason: 'Customer request', priceAdjust: 0, notified: true, date: '2026-07-04', by: 'Bilal Ahmed' },
];
/**
 * One trip per status so the Fleet Availability board and the Trips list are full. Every trip belongs to a document (DO, return or replacement), and an order's
 * logisticsCost is the sum of its trips' expenses (recomputed below), so the Logistics tab and the Logistics Cost report agree.
 * The collection of CN-26-00123 shows a first attempt that is stuck and a second trip with the crane truck.
 */
export const TRIP_SEED_N = 8;
const tx = (type: string, amount: number, date: string, note?: string): TripExpense => ({ type, amount, date, note });
const tr = (id: string, n: number, s: SalesOrder, kind: TripKind, doc: { id: string; number: string }, over: Partial<Trip> & Pick<Trip, 'date' | 'status' | 'since'>): Trip => ({
  id, number: `TRP-26-${String(n).padStart(5, '0')}`, kind, docId: doc.id, docNumber: doc.number, soId: s.id, soNumber: s.number, customerId: s.customerId, site: s.site, costCentre: s.costCentre,
  transport: 'Own Fleet', expenses: [], log: [], ...over,
});
const DRV = { tariq: { driver: 'Tariq Hussain', mobile: '+971 50 311 4090' }, imran: { driver: 'Imran Shah', mobile: '+971 55 418 2276' }, ravi: { driver: 'Ravi Kumar', mobile: '+971 56 129 6480' } };
export const tripSeed: Trip[] = [
  tr('tr1', 1, sx('so1'), 'Delivery', { id: 'dl1', number: 'DO-26-00102' }, { date: '2026-04-12T07:30', status: 'Completed', since: '2026-04-12T13:10', vehicleId: 'he21', plate: 'Dubai P 48213', ...DRV.tariq, expenses: [tx('Salik', 20, '2026-04-12'), tx('Fuel', 180, '2026-04-12')],
    log: [lg('2026-04-12 07:30', 'Trip created', 'Bilal Ahmed', 'Dubai P 48213, Tariq Hussain'), lg('2026-04-12 07:45', 'Trip started', 'Bilal Ahmed', undefined, 'blue'), lg('2026-04-12 13:10', 'Trip completed', 'Bilal Ahmed', 'Salik AED 20, Fuel AED 180', 'green')] }),
  tr('tr2', 2, sx('so4'), 'Delivery', { id: 'dl7', number: 'DO-26-00125' }, { date: '2026-09-30T08:30', status: 'En Route', since: '2026-09-30T09:05', vehicleId: 'he22', plate: 'Sharjah 3 22871', ...DRV.imran,
    log: [lg('2026-09-30 08:30', 'Trip created', 'Bilal Ahmed', 'Sharjah 3 22871, Imran Shah'), lg('2026-09-30 09:05', 'Trip started', 'Bilal Ahmed', undefined, 'blue')] }),
  tr('tr3', 3, sx('so9'), 'Collection', { id: 'rt1', number: 'CN-26-00123' }, { date: '2026-09-30T10:30', status: 'Stuck-Delayed', since: '2026-09-30T13:20', vehicleId: 'he21', plate: 'Dubai P 48213', ...DRV.tariq,
    stuck: { reason: 'Crane not available on site to load the generator', responsible: 'Client', since: '2026-09-30T13:20' },
    log: [lg('2026-09-30 10:30', 'Trip created', 'Bilal Ahmed', 'Dubai P 48213, Tariq Hussain'), lg('2026-09-30 11:00', 'Trip started', 'Bilal Ahmed', undefined, 'blue'), lg('2026-09-30 13:20', 'Marked Stuck-Delayed', 'Bilal Ahmed', 'Crane not available on site to load the generator. Responsible: Client', 'red')] }),
  tr('tr4', 4, sx('so9'), 'Collection', { id: 'rt1', number: 'CN-26-00123' }, { date: '2026-09-30T15:00', status: 'Assigned', since: '2026-09-30T15:00', vehicleId: 'he41', plate: 'Dubai L 30517', ...DRV.ravi,
    log: [lg('2026-09-30 15:00', 'Trip created', 'Bilal Ahmed', 'Second vehicle for the stuck collection: crane truck Dubai L 30517, Ravi Kumar')] }),
  tr('tr5', 5, sx('so2'), 'Delivery', { id: 'dl3', number: 'DO-26-00131' }, { date: '2026-07-04T08:00', status: 'Completed', since: '2026-07-04T12:40', transport: 'External Transporter', transporter: 'Gulf Haulage and Transport LLC', expenses: [tx('Transport Charge', 1400, '2026-07-04')],
    log: [lg('2026-07-04 08:00', 'Trip created', 'Bilal Ahmed', 'External transporter Gulf Haulage and Transport LLC'), lg('2026-07-04 12:40', 'Trip completed', 'Bilal Ahmed', 'Transport Charge AED 1400', 'green')] }),
  tr('tr6', 6, sx('so2'), 'Delivery', { id: 'dl4', number: 'DO-26-00132' }, { date: '2026-07-06T08:00', status: 'Completed', since: '2026-07-06T11:30', transport: 'External Transporter', transporter: 'Al Safeer Heavy Transport', expenses: [tx('Transport Charge', 1400, '2026-07-06')],
    log: [lg('2026-07-06 08:00', 'Trip created', 'Bilal Ahmed', 'External transporter Al Safeer Heavy Transport'), lg('2026-07-06 11:30', 'Trip completed', 'Bilal Ahmed', 'Transport Charge AED 1400', 'green')] }),
  tr('tr7', 7, sx('so5'), 'Delivery', { id: 'dl6', number: 'DO-26-00044' }, { date: '2026-02-20T07:00', status: 'Completed', since: '2026-02-20T15:30', vehicleId: 'he21', plate: 'Dubai P 48213', ...DRV.tariq, expenses: [tx('Fuel', 900, '2026-02-20'), tx('Salik', 220, '2026-02-20'), tx('Driver Allowance', 380, '2026-02-20')],
    log: [lg('2026-02-20 07:00', 'Trip created', 'Bilal Ahmed', 'Dubai P 48213, Tariq Hussain'), lg('2026-02-20 15:30', 'Trip completed', 'Bilal Ahmed', 'Fuel AED 900, Salik AED 220, Driver Allowance AED 380', 'green')] }),
  tr('tr8', 8, sx('so2'), 'Replacement', { id: 'rp1', number: 'RP-26-00004' }, { date: '2026-07-04T09:30', status: 'Completed', since: '2026-07-04T14:00', vehicleId: 'he22', plate: 'Sharjah 3 22871', ...DRV.imran, expenses: [tx('Salik', 40, '2026-07-04'), tx('Fuel', 160, '2026-07-04')],
    log: [lg('2026-07-04 09:30', 'Trip created', 'Bilal Ahmed', 'Sharjah 3 22871, Imran Shah'), lg('2026-07-04 14:00', 'Trip completed', 'Bilal Ahmed', 'Salik AED 40, Fuel AED 160', 'green')] }),
];
orderSeed.forEach((o) => { if (o.activity === 'Rental') { o.billingCycle = o.billingCycle ?? 'Monthly'; o.invoicingType = o.invoicingType ?? 'Manual'; } });
orderSeed.forEach((o) => { const t = tripSeed.filter((x) => x.soId === o.id && x.status !== 'Cancelled'); if (t.length) o.logisticsCost = t.reduce((n, x) => n + tripTotal(x), 0); });
export const extensionSeed: Extension[] = [
  { id: 'ex1', number: 'EX-26-00007', soId: 'so1', kind: 'Extension', oldEnd: '2026-09-08', newEnd: '2026-10-08', date: '2026-09-10', note: 'Client extended the hire by one month', status: 'Applied', clientConfirmedBy: 'Sergei Petrov' },
];
const chOrderExtra = (c: CrossHire): CrossHire => ({ type: 'Inventory', status: c.stage >= 4 ? 'Closed' : c.stage >= 1 ? 'Received' : 'Approved', receiving: c.stage >= 1 ? 'Fully Received' : 'Pending Receiving', billing: c.supplierInvoice ? 'Pending Billing' : 'Pending Billing', expenses: [], qty: 1, confirmationDate: c.date, expectedReceipt: c.date, paymentTerms: 'Net 30', startDate: c.date, endDate: undefined, grns: c.stage >= 1 ? [{ id: `${c.id}-grn`, number: `GRN-26-${String(c.number.slice(-5))}`, date: c.date, receivedBy: 'Sanjay Kumar', narration: 'Received at the yard', transportedBy: c.supplier, driver: 'Supplier driver', driverId: '', vehicle: '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], qty: 1, traces: [{ serial: `XH-${c.number.slice(-4)}`, group: c.group, category: c.category }], validated: true }] : [], ...c });
export const crossHireSeed: CrossHire[] = ([
  { id: 'ch1', number: 'CH-26-00007', soId: 'so3', soNumber: 'SO-26-00044', lineId: 'so3a', group: 'Generator', category: '500 KVA', supplierId: 's5', supplier: 'Falcon Equipment Hire LLC', rate: 36000, stage: 2, assetId: 'he27', revenue: 48000, date: '2026-05-02', supplierInvoice: 'FAL-INV-9921',
    history: [lg('2026-05-02 10:00', 'Request raised: no owned 500 KVA unit available', 'Bilal Ahmed'), lg('2026-05-02 16:00', 'Received from Falcon Equipment Hire LLC', 'Sanjay Kumar'), lg('2026-05-06 09:00', 'Allocated to SO-26-00044', 'Bilal Ahmed')] },
  { id: 'ch2', number: 'CH-26-00006', soId: 'so2', soNumber: 'SO-26-00046', lineId: 'so2a', group: 'Generator', category: '200 KVA', supplierId: 's6', supplier: 'Gulf Genset Rentals', rate: 21000, stage: 3, assetId: 'he28', revenue: 29500, date: '2026-06-10', supplierInvoice: 'GGR-2210',
    condition: { notes: 'Minor scratches on canopy, no functional damage', files: ['yard-condition-ch200.jpg'] },
    history: [lg('2026-06-10 09:00', 'Request raised: AST-1014 broke down on site', 'Bilal Ahmed'), lg('2026-06-10 15:00', 'Received at Sharjah Yard', 'Sanjay Kumar'), lg('2026-06-12 10:00', 'Allocated to SO-26-00046 as a replacement', 'Bilal Ahmed', 'RP-26-00003'), lg('2026-07-04 15:00', 'Returned to us, idle at Sharjah Yard', 'Sanjay Kumar', 'Own unit AST-1013 took over (RP-26-00004). Condition check completed', 'amber')] },
  { id: 'ch3', number: 'CH-26-00008', soId: 'so4', soNumber: 'SO-26-00052', lineId: 'so4b', group: 'Generator', category: '100 KVA', supplierId: 's6', supplier: 'Gulf Genset Rentals', rate: 13500, stage: 0, revenue: 18500, date: '2026-09-29', expectedReceipt: '2026-10-02', startDate: '2026-10-05', endDate: '2027-03-31',
    history: [lg('2026-09-29 10:00', 'Request', 'Bilal Ahmed', 'No owned 100 KVA unit Ready for Hire for SO-26-00052; direct order; Inventory'), lg('2026-09-29 10:05', 'Order created', 'Bilal Ahmed', 'CH-26-00008 with Gulf Genset Rentals at AED 13500 per unit', 'blue')] },
  { id: 'ch4', number: 'CH-26-00009', status: 'Pending Approval', soId: 'so1', soNumber: 'SO-26-00041', lineId: 'so1a', group: 'Generator', category: '500 KVA', supplierId: 's5', supplier: 'Falcon Equipment Hire LLC', rate: 36000, stage: 0, revenue: 52000, date: '2026-09-28', expectedReceipt: '2026-10-03', startDate: '2026-10-03', endDate: '2026-11-30',
    history: [lg('2026-09-28 09:00', 'Request', 'Bilal Ahmed', 'Standby cover for AST-1015 during its major service; direct order; Inventory'), lg('2026-09-28 09:10', 'Order created', 'Bilal Ahmed', 'CH-26-00009 with Falcon Equipment Hire LLC at AED 36000 per unit', 'blue')] },
  { id: 'ch5', number: 'CH-26-00010', soId: 'so4', soNumber: 'SO-26-00052', lineId: 'so4b', group: 'Generator', category: '100 KVA', supplierId: 's6', supplier: 'Gulf Genset Rentals', rate: 13500, stage: 1, assetId: 'he31', revenue: 18500, date: '2026-09-26', supplierInvoice: 'GGR-2291', expectedReceipt: '2026-09-28', startDate: '2026-09-28', endDate: '2027-03-31',
    history: [lg('2026-09-26 11:00', 'Request', 'Bilal Ahmed', 'No owned 100 KVA unit Ready for Hire for SO-26-00052; direct order; Inventory'), lg('2026-09-26 11:05', 'Order created', 'Bilal Ahmed', 'CH-26-00010 with Gulf Genset Rentals at AED 13500 per unit', 'blue'), lg('2026-09-28 14:00', 'Received into our custody as AST-1031', 'Sanjay Kumar', 'Supplier invoice GGR-2291')] },
]).map(chOrderExtra);


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
  { id: 'jc1', number: 'JC-26-00118', soId: 'so6', soNumber: 'SO-26-00053', customerId: 'c8', visitIdx: 0, plannedDate: '2026-11-16', technician: 'Rajesh Pillai', location: 'Service Van 1 (Rajesh Pillai)', item: 'AMC Annual Contract (Generator 1500 KVA)',
    materials: [], services: [], notes: 'Draft job card for the first planned visit', visitAmount: 6000, status: 'Open', log: [lg('2026-09-30 09:00', 'Job card created for visit 1', 'Leena Thomas')] },
  { id: 'jc2', number: 'JC-26-00104', soId: 'so10', soNumber: 'SO-26-00050', customerId: 'c1', visitIdx: 0, plannedDate: so10Plan[0].date, doneOn: so10Plan[0].date, technician: 'Rajesh Pillai', location: 'Service Van 1 (Rajesh Pillai)', item: AMC_ITEM, activities: 'Standard quarterly service: visual check, fluid levels, battery test, 30 minute load run',
    materials: [{ item: 'Oil Filter (Cummins C-Series)', qty: 2, unit: 'Nos', price: 85 }], services: [], notes: 'Unit in good condition', visitAmount: 4500, status: 'Invoiced', invoiceRef: 'INV-26-00371', invoiceId: 'inv-371', paymentStatus: 'Paid', signedCopy: ['JC-26-00104-signed.pdf'],
    log: [lg(`${so10Plan[0].date} 09:00`, 'Job card created for visit 1', 'Leena Thomas'), lg(`${so10Plan[0].date} 15:00`, 'Visit completed', 'Rajesh Pillai', 'Materials and services recorded', 'green'), lg(`${so10Plan[0].date} 17:00`, 'Invoice raised', 'Leena Thomas', 'INV-26-00371, total AED 4670', 'blue'), lg(`${so10Plan[1].date} 10:00`, 'Payment received', 'Priya Menon', 'INV-26-00371, AED 4670', 'green')] },
  { id: 'jc3', number: 'JC-26-00105', soId: 'so10', soNumber: 'SO-26-00050', customerId: 'c1', visitIdx: 1, plannedDate: so10Plan[1].date, doneOn: so10Plan[1].date, technician: 'Rajesh Pillai', location: 'Service Van 1 (Rajesh Pillai)', item: AMC_ITEM, activities: 'Standard quarterly service: visual check, fluid levels, battery test, 30 minute load run',
    materials: [{ item: 'Engine Oil 15W-40 (20 L)', qty: 2, unit: 'Drum', price: 420 }], services: [{ name: 'Coolant flush (additional task)', amount: 650 }], notes: 'Oil change due, coolant flushed at client request', visitAmount: 4500, status: 'Invoiced', invoiceRef: 'INV-26-00396', invoiceId: 'inv-396', paymentStatus: 'Unpaid', signedCopy: ['JC-26-00105-signed.pdf'],
    log: [lg(`${so10Plan[1].date} 09:00`, 'Job card created for visit 2', 'Leena Thomas'), lg(`${so10Plan[1].date} 16:00`, 'Visit completed', 'Rajesh Pillai', 'Materials and services recorded', 'green'), lg(`${so10Plan[1].date} 17:30`, 'Invoice raised', 'Leena Thomas', 'INV-26-00396, total AED 5990', 'blue')] },
  { id: 'jc4', number: 'JC-26-00106', soId: 'so10', soNumber: 'SO-26-00050', customerId: 'c1', visitIdx: 2, plannedDate: so10Plan[2].date, doneOn: so10Plan[2].date, technician: 'Rajesh Pillai', location: 'Service Van 1 (Rajesh Pillai)', item: AMC_ITEM, activities: 'Standard quarterly service: visual check, fluid levels, battery test, 30 minute load run',
    materials: [{ item: 'Air Filter (Perkins 2506)', qty: 1, unit: 'Nos', price: 110 }], services: [], notes: 'Air filter replaced, ready to invoice', visitAmount: 4500, status: 'Completed', signedCopy: ['JC-26-00106-signed.pdf'],
    log: [lg(`${so10Plan[2].date} 09:00`, 'Job card created for visit 3', 'Leena Thomas'), lg(`${so10Plan[2].date} 15:30`, 'Visit completed', 'Rajesh Pillai', 'Materials and services recorded', 'green')] },
  { id: 'jc5', number: 'JC-26-00107', soId: 'so10', soNumber: 'SO-26-00050', customerId: 'c1', visitIdx: 3, plannedDate: so10Plan[3].date, technician: 'Rajesh Pillai', location: 'Service Van 1 (Rajesh Pillai)', item: AMC_ITEM,
    materials: [], services: [], notes: 'Final visit of the contract year', visitAmount: 4500, status: 'Open', log: [lg('2026-09-28 09:00', 'Job card created for visit 4', 'Leena Thomas')] },
];

/** Seeds every collection once (first caller wins, so safe to call from any screen). */
export const chRequestSeed: CrossHireRequest[] = [
  { id: 'chr1', number: 'CHR-26-00004', date: '2026-05-02', soId: 'so3', soNumber: 'SO-26-00044', lineId: 'so3a', group: 'Generator', category: '500 KVA', qty: 1, frequency: 'Monthly', rate: 36000, vendorId: 's5', vendor: 'Falcon Equipment Hire LLC', company: ENT, representative: 'Bilal Ahmed', currency: 'AED', narration: 'No owned 500 KVA unit available', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Completed', orderId: 'ch1', log: [lg('2026-05-02 09:30', 'Request raised from SO-26-00044', 'Bilal Ahmed'), lg('2026-05-02 09:50', 'Order created', 'Bilal Ahmed')] },
  { id: 'chr2', number: 'CHR-26-00005', date: '2026-09-24', soId: 'so1', soNumber: 'SO-26-00041', lineId: 'so1b', group: 'Generator', category: '1000 KVA', qty: 1, frequency: 'Monthly', rate: 0, company: ENT, representative: 'Bilal Ahmed', currency: 'AED', narration: 'Extra unit for the new site', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'In Progress', log: [lg('2026-09-24 11:00', 'Request raised from SO-26-00041', 'Bilal Ahmed'), lg('2026-09-24 11:05', 'Submitted and approved', 'Bilal Ahmed', undefined, 'green')] },
  { id: 'chr3', number: 'CHR-26-00006', date: '2026-09-29', soId: 'so2', soNumber: 'SO-26-00046', lineId: 'so2a', group: 'Generator', category: '200 KVA', qty: 1, frequency: 'Monthly', rate: 0, company: ENT, representative: 'Yousef Karim', currency: 'AED', narration: 'Client asked for a second 200 KVA unit for the block B handover', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Pending', log: [lg('2026-09-29 14:20', 'Request raised from SO-26-00046', 'Yousef Karim', 'Generator 200 KVA, quantity 1')] },
  { id: 'chr4', number: 'CHR-26-00007', date: '2026-09-25', soId: 'so1', soNumber: 'SO-26-00041', lineId: 'so1b', group: 'Generator', category: '1000 KVA', qty: 1, frequency: 'Monthly', rate: 0, company: ENT, representative: 'Bilal Ahmed', currency: 'AED', narration: 'Second 1000 KVA unit for the depot extension, 6 months', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Completed', rfqId: 'rfq1',
    log: [lg('2026-09-25 10:00', 'Request raised from SO-26-00041', 'Bilal Ahmed'), lg('2026-09-25 10:05', 'Submitted and approved', 'Bilal Ahmed', undefined, 'green'), lg('2026-09-26 10:00', 'RFQ RFQ-26-00012 created', 'Bilal Ahmed')] },
];
chRequestSeed.push({ id: 'chr5', number: 'CHR-26-00008', date: '2026-09-29', soId: 'so12', soNumber: 'SO-26-00055', lineId: 'so12b', group: 'POD', category: '20 ft POD', qty: 1, frequency: 'Monthly', rate: 0, company: ENT, representative: 'Yousef Karim', currency: 'AED',
  narration: 'No 20 ft POD is Ready for Hire (the only unit is under maintenance)', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], status: 'Completed', rfqId: 'rfq2',
  log: [lg('2026-09-29 15:00', 'Request raised from SO-26-00055', 'Yousef Karim', 'POD 20 ft POD, quantity 1'), lg('2026-09-29 15:05', 'Submitted and approved', 'Yousef Karim', undefined, 'green'), lg('2026-09-30 09:00', 'RFQ RFQ-26-00013 created', 'Yousef Karim')] });
export const chRfqSeed: CrossHireRfq[] = [
  { id: 'rfq1', number: 'RFQ-26-00012', date: '2026-09-26', requestIds: ['chr4'], soNumbers: ['SO-26-00041'], group: 'Generator', category: '1000 KVA', qty: 1, vendorIds: ['s5', 's6'], orderDeadline: '2026-10-08', expectedDate: '2026-10-12', currency: 'AED', paymentTerms: 'Net 30', start: '2026-10-12', end: '2027-04-11', narration: 'Quote for one 1000 KVA generator, 6 months',
    status: 'Response Received', responses: [{ vendorId: 's5', vendor: 'Falcon Equipment Hire LLC', rate: 61000, leadTime: 5, moq: 1, date: '2026-09-27' }, { vendorId: 's6', vendor: 'Gulf Genset Rentals', rate: 58500, leadTime: 9, moq: 1, date: '2026-09-28' }], log: [lg('2026-09-26 10:00', 'RFQ created', 'Bilal Ahmed', 'From CHR-26-00007'), lg('2026-09-26 10:10', 'RFQ sent to 2 suppliers', 'Bilal Ahmed'), lg('2026-09-27 12:00', 'Response received from Falcon Equipment Hire LLC', 'Bilal Ahmed'), lg('2026-09-28 09:00', 'Response received from Gulf Genset Rentals', 'Bilal Ahmed')] },
];

chRfqSeed.push({ id: 'rfq2', number: 'RFQ-26-00013', date: '2026-09-30', requestIds: ['chr5'], soNumbers: ['SO-26-00055'], group: 'POD', category: '20 ft POD', qty: 1, vendorIds: ['s5', 's6'], orderDeadline: '2026-10-10', expectedDate: '2026-10-14', currency: 'AED', paymentTerms: 'Net 30', start: '2026-10-05', end: '2027-04-04',
  narration: 'Quote for one 20 ft POD, 6 months', status: 'Pending Order', awardedVendorId: 's6', awardComment: 'Lowest rate and the shortest lead time',
  responses: [{ vendorId: 's5', vendor: 'Falcon Equipment Hire LLC', rate: 5200, leadTime: 6, moq: 1, date: '2026-10-01' }, { vendorId: 's6', vendor: 'Gulf Genset Rentals', rate: 4800, leadTime: 4, moq: 1, date: '2026-10-02' }],
  log: [lg('2026-09-30 09:00', 'RFQ created', 'Yousef Karim', 'From CHR-26-00008'), lg('2026-09-30 09:10', 'RFQ sent to 2 suppliers', 'Yousef Karim'), lg('2026-10-01 11:00', 'Response received from Falcon Equipment Hire LLC', 'Yousef Karim'), lg('2026-10-02 10:00', 'Response received from Gulf Genset Rentals', 'Yousef Karim'), lg('2026-10-02 11:00', 'Awarded to Gulf Genset Rentals', 'Yousef Karim', 'Lowest rate and the shortest lead time', 'green')] });

export function seedAll() {
  seedCollection(COL.fleet, heavySeed); seedCollection(COL.pricing, pricingSeed); seedCollection(COL.masters, masterSeed);
  seedCollection(COL.leads, leadSeed); seedCollection(COL.opps, oppSeed); seedCollection(COL.quotes, quoteSeed); seedCollection(COL.orders, orderSeed);
  seedCollection(COL.deliveries, deliverySeed); seedCollection(COL.returns, returnSeed); seedCollection(COL.replacements, replacementSeed);
  seedCollection(COL.extensions, extensionSeed); seedCollection(COL.crossHire, crossHireSeed); seedCollection(COL.chRequests, chRequestSeed); seedCollection(COL.chRfqs, chRfqSeed); seedCollection(COL.jobCards, jobCardSeed); seedCollection(COL.trips, tripSeed);
}
seedAll();
