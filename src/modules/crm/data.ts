import dayjs from 'dayjs';
import { costCentres, customers, systemUsers } from '@/mock-data/masters';
import { COMPANY, FREQUENCIES, categorySeed, heavySeed, isTopCategory, itemSeed, locationSeed, pricingSeed, TODAY, type CategoryRec, type HeavyRec, type ItemRec, type LocationRec, type PricingRec } from '@/modules/inventory/data';
import { ASSET_COL, assetSeed, type AssetRec } from '@/modules/accounting/assets';
import { getCollection, seedCollection, setCollection } from '@/store/store';

export { FREQUENCIES, TODAY };
export type { HeavyRec, PricingRec };
/** Fixed Asset Trading (sell a serialized asset) is added; Fuel Trading and Trading are separate, as agreed on 5 Oct. Service (new) is a one-time, non-recurring AMC: same contract line pattern and job-card flow, no visit plan beyond the single visit. */
export const ACTIVITY_TYPES = ['Rental', 'Fixed Asset Trading', 'Trading', 'Fuel Trading', 'AMC', 'Service', 'Other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
/** AMC and Service share the same contract header fields (start/end, scope, itemized service lines) and the same Order/Job Card flow; Service just has no Number of Visits and produces exactly one job card. */
export const AMC_LIKE: ActivityType[] = ['AMC'];
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
  { id: 'bc1', name: 'Monthly', count: 1, duration: 'Month', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 12, initialEnabled: false, prorated: false },
  { id: 'bc2', name: '2 Months', count: 2, duration: 'Month', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 6, initialEnabled: false, prorated: false },
  { id: 'bc3', name: 'Quarterly', count: 1, duration: '3 Month', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 4, initialEnabled: false, prorated: false },
  { id: 'bc4', name: 'Weekly', count: 1, duration: 'Week', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 8, initialEnabled: false, prorated: false },
  { id: 'bc5', name: 'Calendar Month Prorated', count: 1, duration: 'Calendar Month', invoicingType: 'Automatic', startOption: 'delivery', maxSchedule: 12, initialEnabled: true, initialDays: 1, prorated: true },
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
/**
 * Activity Types that a header Activity Type allows on its lines (decision 1: Rental may also carry Service and Fuel Trading lines).
 * A Service header carries Service charge lines only (8 Oct call: a service has no delivery and no job card, it is executed and invoiced from the order).
 */
export const LINE_ACTIVITIES: Record<string, string[]> = { Rental: ['Rental', 'Service'], 'Fixed Asset Trading': ['Fixed Asset Trading', 'Service'], Service: ['Service'] };
export const lineActivitiesFor = (header: string) => LINE_ACTIVITIES[header] ?? [header];
/** Admin-configurable in the real system. */
/** 9 Oct call: contracts show for the follow-up call one week before they end (was 14 days). */
export const EXPIRY_NOTICE_DAYS = 7;
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
  maintenanceRoutine: ['Wash and clean the unit', 'Check oil, coolant and filters', 'Battery and charging check', 'Load test', 'Canopy and paint touch-up'],
  maintenanceCritical: ['Fault diagnosed and recorded', 'Parts replaced and recorded', 'Load test after repair', 'Workshop supervisor sign-off'],
};
export interface MasterRec { id: string; values: string[] }
export const masterSeed: MasterRec[] = Object.entries(MASTER_SEED).map(([id, values]) => ({ id, values }));
export const masterValues = (key: string) => getCollection<MasterRec>(COL.masters).find((m) => m.id === key)?.values ?? MASTER_SEED[key] ?? [];

/* ------------------------------------------------------------------ types */
export interface LogItem { when: string; title: string; detail?: string; by: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'grey' }
/** Lump sum billed for days outside the rental run: before the Invoice Start Date (delivery) or after the Invoice End Date (return). */
export interface AdditionalCharge { from: string; to: string; days: number; amount: number; note?: string }
/** A saved earlier version of a Sales Order, kept when the order is extended (revision). */
export interface OrderRevision { rev: number; date: string; by: string; note: string; contractEnd?: string; lpo?: string; lpoExpiry?: string; lines: { id: string; item: string; end?: string; price: number }[] }
/** `extendedTo` and `extRev`: the unit is still out after an extension of the order (8 Oct call), so it can be shown as Extended while returned units stay Returned. */
export interface Assignment { assetId: string; deliveryId: string; start: string; stop?: string; state: 'On Hire' | 'Hold' | 'Returned' | 'Replaced' | 'Sold'; extendedTo?: string; extRev?: number }
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
  /** Earlier rates of the line (8 Oct call): `price` was `price` up to and including `until`; the current `price` applies after the last `until` (the extension period). */
  rateHistory?: { until: string; price: number }[];
}
/** Header commercial fields shared by Quotation and Sales Order (decision 2: Contract Type and End Date sit in the header). */
export interface Commercial {
  activity: ActivityType; entity: string; customerId: string; paymentTerms: string; currency: string;
  contractType?: string; contractStart?: string; contractEnd?: string; billingStructure?: string;
  costCentre?: string;
  amcStart?: string; amcEnd?: string; visits?: number;
  /** AMC and Service: amcValue is the computed total of the itemized service lines (before VAT), kept for display/reference; amcScope is the overall narration, separate from the lines. For AMC the value is split across the planned visits; a Service contract has exactly one visit. */
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
  materials: { item: string; qty: number; unit: string; price: number; cost?: number; foc?: boolean; vat?: number }[]; services: { name: string; amount: number; foc?: boolean }[]; notes: string; visitAmount: number;
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
  /** Extension is a revision of the same order (8 Oct call): the number of the current revision and the earlier versions. */
  revision?: number; revisions?: OrderRevision[];
}
export interface DoItem { lineId: string; qty: number; assetIds: string[]; deliveredSub?: string; package?: string }
export interface Delivery {
  id: string; number: string; soId: string; soNumber: string; lineId: string; customerId: string; date: string; type: string; assetIds: string[]; accessories: string[]; description: string;
  transport: string; extCost: number; conditionFiles: string[]; signature: string; foc: boolean; status: string; closed: boolean; driver?: string; vehicle?: string; narration?: string; supplierDoNo?: string;
  /** Rental (invoice) Start Date, defaults to the delivery date (decision 7). */
  rentalStart: string; startReason?: string; startBy?: string; waitingCharge?: number;
  /** 8 Oct call: lump sum invoiced for the days before the Invoice Start Date, and the replacement this delivery was created for. */
  additional?: AdditionalCharge; additionalInvoiceId?: string; replacementId?: string;
  requestedSub?: string; deliveredSub?: string; serviceLineIds?: string[]; project?: string;
  /** existing Delivery Order form fields; items = one row per Sales Order line delivered */
  items?: DoItem[]; reference?: string; poNumber?: string; poDate?: string; location?: string; operationType?: string; transportedBy?: string; vehicleNumber?: string; iqama?: string; mobile?: string; department?: string; salesperson?: string;
  /** existing Delivery Order form fields; items = one row per Sales Order line delivered */
  /** kept for older records */
  siteReady?: boolean; holdReason?: string; holdBy?: string;
  /** A trip-style cost charged to this Delivery Order directly (Add Expense on the Delivery Order), independent of there being an active trip. */
  expenses?: TripExpense[];
}
/** Customer Return (RMA) of the existing ERP: header, items, approval, then a Goods Receipt (GRN) that is validated. Rental additions are marked NEW on the screens. */
export const RMA_STATUSES = ['Draft', 'Pending', 'Pending Approval', 'Pending Receipt', 'Pending Credit', 'Return Completed', 'Rejected'];
export interface ReturnItem { id: string; lineId: string; deliveryId: string; assetId: string; narration?: string; files?: string[] }
/** One asset on a Goods Receipt: where it arrived, its serial confirmed (Track Details) and the yard inspection (Operations Return Checklist). */
export interface ReturnGrnItem {
  itemId: string; assetId: string; yard: string; reachedYard: string; tracked: boolean; inspection: 'Pending Inspection' | 'Passed' | 'Damage Found'; yardChecklist: string[];
  damageCharge?: number; damageNote?: string; waiverApplied?: boolean; outcome?: string;
}
export interface ReturnGrn { id: string; number: string; date: string; status: 'Pending' | 'Validated'; items: ReturnGrnItem[] }
export interface ReturnTransport { transport: 'Own Fleet' | 'External Transporter'; vehicleId?: string; driver?: string; mobile?: string; transporter?: string; charge?: number }
export interface ReturnEntry {
  id: string; number: string; date: string; customerId: string; soId: string; soNumber: string; source: 'sales order' | 'delivery'; deliveryId?: string; shippingAddress?: string; operationType: string;
  salesperson: string; entity: string; reference?: string; currency: string; exchangeRate: number; narration?: string; location: string; department?: string; attachments: string[];
  status: string; items: ReturnItem[]; approver?: string; grns: ReturnGrn[]; log: LogItem[];
  /** rental: how it comes back, when billing stops, the site check and photos, the collection transport and a failed collection */
  /** Invoice End Date (Off-Hire, 8 Oct call) and the lump sum invoiced for the days between it and the return date. */
  offHireDate?: string; additional?: AdditionalCharge; additionalInvoiceId?: string;
  /** 9 Oct call: the collection leg of a replacement. Billing is not stopped by it, the line keeps billing through the new unit. */
  replacementId?: string; keepBilling?: boolean;
  method: string; timestamp: string; siteChecklist: string[]; photos: string[]; fuelNote: string; transport?: ReturnTransport; collected?: string; collection?: { by: string; amount: number; note: string };
}
export const REPLACEMENT_OUTCOMES = ['Under Maintenance - Routine', 'Under Maintenance - Critical', 'Ready for Hire'] as const;
export type ReplacementOutcome = (typeof REPLACEMENT_OUTCOMES)[number];
export interface Replacement {
  id: string; number: string; soId: string; lineId: string; oldAssetId: string; newAssetId: string; reason: string; priceAdjust: number; notified: boolean; date: string; crossHireId?: string; by: string;
  /** 8 Oct call: the Delivery Order created for the new unit, and the Category and Subcategory it was chosen from. */
  deliveryId?: string; group?: string; category?: string;
  /** 9 Oct call: the faulty unit comes back through its own collection (a Customer Return that does not stop billing), by the same vehicle or a separate trip, and ends in the status chosen here. */
  returnId?: string; collectionMode?: 'Same vehicle' | 'Separate trip'; outcome?: ReplacementOutcome; priceListRate?: number;
}
export interface Extension { id: string; number: string; soId: string; lineId?: string; kind: 'Extension'; oldEnd: string; newEnd: string; date: string; note: string; status: string; clientConfirmedBy: string; revision?: number; changes?: string }
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
  /** Sales Order context carried to the order (8 Oct call). */
  project?: string; customerId?: string; site?: string;
  /** Items of the order, one per Category and Subcategory with its units and rate per unit. Group, Category, quantity and rate above are the first item and the totals. */
  items?: CrossHireItem[];
}
/** One Category and Subcategory of a Cross Hire Order: the units ordered and the agreed rate per unit. */
export interface CrossHireItem { id: string; group: string; category: string; qty: number; rate: number; lineId?: string }
export interface CrossUnit { assetId: string; stage: number; soId?: string; soNumber?: string; lineId?: string; grnId?: string; condition?: { notes: string; files: string[]; checks?: string[] }; reissueRef?: string; dispute?: number }
/** Items of an order; an order without items is one item of its own Category. */
export const chItems = (c: CrossHire): CrossHireItem[] => c.items ?? [{ id: c.id, group: c.group, category: c.category, qty: c.qty ?? 1, rate: c.rate / (c.qty ?? 1), lineId: c.lineId }];
/** Agreed rate per unit for a Category and Subcategory of the order (the order average when the asset is not one of its items). */
export const chItemRate = (c: CrossHire, group?: string, category?: string) => chItems(c).find((i) => i.group === group && i.category === category)?.rate ?? c.rate / (c.qty ?? 1);
/** Units of the item received so far (assets of its Category and Subcategory), at most the units ordered. */
export const itemReceived = (c: CrossHire, i: { group: string; category: string; qty: number }) => Math.min(i.qty, unitsOf(c).filter((u) => { const a = assetById(u.assetId); return a?.category === i.group && a?.subCategory === i.category; }).length);
/** Units of an order. Older records without units carry their single asset on the order itself. */
export const unitsOf = (c: CrossHire): CrossUnit[] => c.units ?? (c.assetId ? [{ assetId: c.assetId, stage: c.stage, soId: c.stage >= 2 ? c.soId : undefined, soNumber: c.stage >= 2 ? c.soNumber : undefined, lineId: c.lineId, condition: c.condition, reissueRef: c.reissueRef, dispute: c.dispute }] : []);
/** Cost of an order that belongs to one Sales Order: the units delivered to it (rate share, expenses share, own dispute); an order with no unit delivered yet counts against the order it was raised for. */
export function costForSo(c: CrossHire, soId: string): number {
  const n = c.qty ?? 1;
  const us = unitsOf(c);
  const exp = (c.expenses ?? []).reduce((t, e) => t + e.amount, 0);
  const mine = us.filter((u) => u.soId === soId);
  if (mine.length) return mine.reduce((t, u) => { const a = assetById(u.assetId); return t + chItemRate(c, a?.category, a?.subCategory) + exp / n + (u.dispute ?? 0); }, 0);
  return !us.some((u) => u.soId) && c.soId === soId ? c.rate + exp + (c.dispute ?? 0) : 0;
}
/** Goods Receipt Note of a Cross Hire Order. The unit is traced on it (serial number), and Validate puts the unit on the Fixed Asset Register. */
export interface CrossHireGrn {
  id: string; number: string; date: string; receivedBy: string; narration: string; transportedBy: string; driver: string; driverId: string; vehicle: string; location: string; department: string;
  attachments: string[]; qty: number; traces: { serial: string; group: string; category: string; condition?: 'OK' | 'Damaged' | 'Needs check'; photo?: string; remarks?: string; brand?: string; model?: string; hours?: string }[]; validated: boolean; address?: Record<string, string>;
}
export interface RfqItem { id: string; group: string; category: string; uom: string; description: string; specification: string; duration: string; qty: number; estYear: number; location: string; department: string; narration: string; orderNumber?: string }
/** One Category and Subcategory of a Cross Hire Request (a request holds one item per equipment line selected on the Sales Order). */
export interface CrossHireReqItem { lineId: string; group: string; category: string; qty: number; frequency: string; rate?: number; orderId?: string; rfqId?: string }
export interface CrossHireRequest {
  id: string; number: string; date: string; soId: string; soNumber: string; lineId: string; group: string; category: string; qty: number; frequency: string; rate: number;
  vendorId?: string; vendor?: string; company: string; representative: string; currency: string; narration: string; location: string; department: string; attachments: string[];
  /** Cross-Hire Decision Right: who raised it and in which role (the permission is gated, not tied to one fixed role). */
  raisedBy?: string; raisedRole?: string;
  /** Items of the request. The Category, Subcategory, quantity and line above are those of the first item (the total quantity); a request without items has just that one. */
  items?: CrossHireReqItem[];
  status: 'Draft' | 'Pending' | 'In Progress' | 'Completed' | 'Rejected'; rfqId?: string; orderId?: string; log: LogItem[];
}
export interface RfqResponse { vendorId: string; vendor: string; rate: number; leadTime: number; moq: number; date: string; note?: string; number?: string; paymentTerms?: string; incoterm?: string; reference?: string; narration?: string; condition?: string; specification?: string; vendorUom?: string; vendorDuration?: string; estYear?: number }
export interface CrossHireRfq {
  id: string; number: string; date: string; requestIds: string[]; soNumbers: string[]; group: string; category: string; qty: number; vendorIds: string[]; orderDeadline: string; expectedDate: string;
  currency: string; paymentTerms: string; start?: string; end?: string; narration: string; status: 'Draft' | 'Open' | 'RFQ Sent' | 'Response Received' | 'Pending Order' | 'Order' | 'Cancelled';
  items?: RfqItem[]; reference?: string; location?: string; representative?: string; company?: string; form?: Record<string, any>; responses: RfqResponse[]; awardedVendorId?: string; awardComment?: string; orderId?: string; log: LogItem[];
}
export const reqItems = (r: CrossHireRequest): CrossHireReqItem[] => r.items ?? [{ lineId: r.lineId, group: r.group, category: r.category, qty: r.qty, frequency: r.frequency, rate: r.rate, orderId: r.orderId, rfqId: r.rfqId }];
export const CH_REQUEST_STATUSES = ['Draft', 'Pending', 'In Progress', 'Completed', 'Rejected'];
export const CH_RFQ_STATUSES = ['Draft', 'Open', 'RFQ Sent', 'Response Received', 'Pending Order', 'Order', 'Cancelled'];
export const CH_ORDER_STATUSES = ['Draft', 'Pending', 'Pending Approval', 'Approved', 'Received', 'Billed', 'Rejected', 'Cancelled', 'Closed'];
/** Price of a rental line for one day (Monthly price / 30, Weekly / 7, Daily / 1), used for the default of an additional invoice. */
export const dayRate = (l: Pick<Line, 'price' | 'frequency'>) => l.price / (l.frequency === 'Weekly' ? 7 : l.frequency === 'Daily' ? 1 : 30);
export const RENTAL_DURATIONS = ['Daily', 'Hourly', '3 Hours', 'Weekly', '2 Weeks', 'Monthly', '2 Months', 'Half Yearly', 'Yearly'];
export const CH_TYPES = ['Inventory', 'Dropship'];
/** Roles that hold the permission to initiate a cross-hire request. Primarily the Operational Desk; an admin can grant it to any other user. */
export const CROSS_HIRE_ROLES = ['Operational Desk', 'Dispatcher / Service Desk', 'General Manager'];
/**
 * Buy-vs-hire view (decision support): what the same hire would have cost if the business owned an equivalent unit, estimated as the average purchase value of
 * the owned units of the Category + Subcategory spread over their useful life, for the months of the hire. Returns undefined when there is no owned unit to compare.
 */
export function ownedEquivalent(c: CrossHire) {
  const rows = chItems(c).map((i) => {
    const owned = fleetRows().filter((a) => isLive(a) && !a.deliveryFleet && a.category === i.group && a.subCategory === i.category && a.ownership !== 'Cross-Hired' && a.assetValue > 0);
    return owned.length ? { qty: i.qty, monthly: owned.reduce((n, a) => n + a.assetValue / Math.max(1, a.usefulLifeYears * 12), 0) / owned.length } : undefined;
  }).filter(Boolean) as { qty: number; monthly: number }[];
  if (!rows.length) return undefined;
  const monthly = rows.reduce((n, r) => n + r.monthly * r.qty, 0);
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
/**
 * journalId: an own-fleet cost posted to the ledger when it was added. billId: an external transporter's Transport Charge billed to the transporter.
 * vatPct: VAT on the expense (client review: trip expenses need an explicit VAT %). account: the GL account it posts to (Expense Head), shown and overridable
 * instead of being derived silently; defaults to tripExpenseAccount(type) when left blank.
 */
export interface TripExpense { type: string; amount: number; vatPct?: number; account?: string; note?: string; date: string; journalId?: string; billId?: string }
/** The expense inclusive of its VAT: what actually lands on the Sales Order logistics cost and the ledger. */
export const expenseGross = (e: Pick<TripExpense, 'amount' | 'vatPct'>) => e.amount + (e.amount * (e.vatPct ?? 0)) / 100;
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
  /** The external transporter's driver (client review: Switch to External Transporter has no driver name today). */
  transporterDriver?: string;
  status: TripStatus;
  /** When the trip last changed status, so the board can show how long a vehicle has been in its state. */
  since: string;
  stuck?: { reason: string; responsible: 'Company' | 'Client'; since: string };
  /** 9 Oct call: a replacement trip that also collects the faulty unit (same vehicle) carries the collection document here. */
  alsoDoc?: { id: string; number: string };
  expenses: TripExpense[];
  log: LogItem[];
}
export const tripTotal = (t: Pick<Trip, 'expenses'>) => t.expenses.reduce((s, e) => s + expenseGross(e), 0);
export const isOpenTrip = (t: Pick<Trip, 'status'>) => OPEN_TRIP.includes(t.status);
/** Fleet Management settings (client review 8 Oct): whether the detailed driver trip workflow (Assigned, En Route, Stuck-Delayed, Completed) runs at all.
 * Off: the Delivery Order's own Dispatched / Delivered actions drive the trip instead (Delivery drives status, not the trip). On (default): unchanged behaviour. */
export interface FleetSettings { id: 'settings'; driverAppEnabled: boolean }
export const fleetSettingsSeed: FleetSettings[] = [{ id: 'settings', driverAppEnabled: true }];

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
/** Price of a rental or recurring service line on a day: an earlier rate up to its `until` date, else the current price. */
export const rateOn = (l: Pick<Line, 'price' | 'rateHistory'>, date: string) => (l.rateHistory ?? []).find((h) => date <= h.until)?.price ?? l.price;
const rawPeriods = (freq: string | undefined, start: string, end: string) => {
  const a = dayjs(start); const b = dayjs(end);
  return freq === 'Daily' ? b.diff(a, 'day') : freq === 'Weekly' ? b.diff(a, 'week', true) : b.diff(a, 'month', true) / (MONTHS[freq ?? ''] ?? 1);
};
/** Amount of one unit over the line's whole term: each rate counts for the part of the term it covered (the new rate only for the extension period). */
const termAmount = (l: Line) => {
  const hist = l.rateHistory ?? [];
  if (!hist.length || !l.start || !l.end) return l.price * linePeriods(l);
  let from = l.start; let sum = 0;
  for (const h of hist) { if (h.until >= from) { sum += h.price * Math.max(0, rawPeriods(l.frequency, from, h.until)); from = h.until; } }
  return sum + l.price * Math.max(0, rawPeriods(l.frequency, from, l.end));
};
export const lineGross = (l: Line) => (l.foc ? 0 : l.qty * (isPeriodic(l) && l.rateHistory?.length ? Math.max(termAmount(l), l.price) : l.price * linePeriods(l)));
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
/**
 * A delivery/fleet vehicle (client feedback 8 Oct) is an Accounting > Fixed Asset Management record with Fleet Vehicle ticked, not a Heavy
 * Equipment item. It is carried into the shared HeavyRec shape so the rest of this Fleet / Trip subsystem (written against Heavy Equipment
 * fixed assets before the move) keeps working unchanged; `deliveryFleet`/`plateNumber`/`defaultDriver` are the only fields it populates.
 */
export function assetToFleetView(a: AssetRec): HeavyRec {
  return {
    id: a.id, code: a.assetId, assetId: a.assetId, name: a.name, classification: 'Fixed Asset', tracking: 'Serialized',
    category: 'Vehicle', subCategory: a.assetType, brand: '', model: '', engineNo: '', capacity: '',
    specification: a.specification, assetType: a.assetType,
    purchaseDate: a.acquisitionDate, putToUseDate: a.putToUseDate, assetValue: a.assetValue, notDepreciable: a.notDepreciable, nbv: a.nbv,
    deprPct: a.assetValue ? Math.round(((a.assetValue - a.nbv) / a.assetValue) * 10000) / 100 : 0, deprAmount: Math.max(0, a.assetValue - a.nbv), capex: a.assetValue,
    department: a.department, company: COMPANY, status: a.status, assetStatus: 'In Service', statusOverride: undefined,
    method: a.method, decliningFactor: a.decliningFactor, computation: a.computation, usefulLifeYears: a.usefulLifeYears,
    accFixedAsset: a.accFixedAsset, accDepreciation: a.accDepreciation, accExpense: a.accExpense, journal: '',
    ownership: 'Owned', supplier: '', crossHireIdle: false, insurance: [],
    // One movement so Current Location (derived from the last movement) shows the asset's Location from the Fixed Asset record.
    movements: [{ id: `fa-mv-${a.id}`, entryNo: '-', date: a.acquisitionDate || TODAY, type: 'Internal Transfer', from: '-', to: a.location, reference: '-', by: '-' }],
    audit: [], utilization: 0, idleDays: 0, profitability: 0, attrs: {}, attachments: a.attachments,
    deliveryFleet: a.fleetVehicle, plateNumber: a.plateNumber, defaultDriver: a.defaultDriver,
  };
}
const fleetVehicleRows = (): HeavyRec[] => { seedCollection(ASSET_COL, assetSeed); return getCollection<AssetRec>(ASSET_COL).filter((a) => a.fleetVehicle).map(assetToFleetView); };
export function fleetRows(): HeavyRec[] {
  seedCollection(COL.billingCycles, cycleSeed); seedCollection(COL.fleet, heavySeed);
  return [...getCollection<HeavyRec>(COL.fleet), ...fleetVehicleRows()];
}
export const assetById = (id: string) => fleetRows().find((a) => a.id === id);
export const assetByAssetId = (assetId: string) => fleetRows().find((a) => a.assetId === assetId);
export const assetLabel = (a?: HeavyRec) => (a ? `${a.assetId} - ${a.name}` : '-');
/** Who holds an asset now (8 Oct call, Asset Dashboard): the customer, project and Sales Order whose line has the asset On Hire or on Hold. */
export function holderOf(assetId: string): { customer: string; project: string; soId: string; soNumber: string; since: string } | undefined {
  const rows = getCollection<SalesOrder>(COL.orders);
  for (const o of rows.length ? rows : orderSeed) {
    for (const l of o.lines) {
      const a = l.assigned.find((x) => x.assetId === assetId && (x.state === 'On Hire' || x.state === 'Hold'));
      if (a) return { customer: custName(o.customerId), project: o.costCentre, soId: o.id, soNumber: o.number, since: a.start };
    }
  }
  return undefined;
}
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
/** The Accounting Fixed Assets ticked as Fleet Vehicle. */
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
  const rows = getCollection<HeavyRec>(COL.fleet);
  // A fleet vehicle lives in Accounting Fixed Asset Management, not Heavy Equipment; it has no movement/audit trail here (patch is empty for the trip start/complete calls that reach it).
  if (!rows.some((a) => a.id === id)) return;
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
      lg('2026-09-26 10:00', 'Return RMA-26-00132: AST-1024 off hire', 'Yousef Karim', 'Client no longer needs the POD', 'amber'), lg('2026-09-01 09:30', 'Sales Order created from QT-26-00082', 'Yousef Karim')] }),
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
    log: [lg('2026-09-30 10:00', 'Return RMA-26-00123: AST-1036 off hire', 'Omar Farouk', 'Company collection arranged', 'amber'), lg('2026-09-29 11:00', 'Return RMA-26-00122: AST-1030 off hire', 'Omar Farouk', 'Client self-return', 'amber'),
      lg('2026-09-16 10:30', 'Damage charge AED 4500', 'Sanjay Kumar', 'AST-1029: control panel display cracked and canopy door hinge broken. Linked permanently to this order', 'red'), lg('2026-09-15 14:00', 'Return RMA-26-00121: AST-1029 off hire', 'Omar Farouk', undefined, 'amber'), lg('2026-05-28 09:00', 'Sales Order created', 'Omar Farouk')] }),
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
    log: [lg('2026-09-20 15:00', 'Return RMA-26-00124: AST-1053 off hire', 'Omar Farouk', 'Billing stops on the off-hire day', 'amber'), lg('2026-09-12 08:00', 'Delivery DO-26-00127: AST-1052', 'Bilal Ahmed'), lg('2026-09-01 08:00', 'Delivery DO-26-00126, DO-26-00128: AST-1051, AST-1053', 'Bilal Ahmed'), lg('2026-08-29 09:00', 'Sales Order created', 'Omar Farouk')] }),
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

/** One return per stage: collection pending, in the yard waiting for inspection, damage charged, damage covered by a waiver. */
const rt = (id: string, number: string, s: SalesOrder, lineId: string, deliveryId: string, assetId: string, method: string, timestamp: string, over: Partial<ReturnEntry> & Record<string, unknown> = {}): ReturnEntry => ({
  id, number, date: timestamp.slice(0, 10), customerId: s.customerId, soId: s.id, soNumber: s.number, source: 'sales order', shippingAddress: s.site, operationType: 'Return', salesperson: s.owner, entity: ENT, currency: 'AED', exchangeRate: 1, location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [],
  status: 'Pending Receipt', items: [{ id: `${id}-i1`, lineId, deliveryId, assetId }], approver: 'Ahmed Al Khouri', grns: [], method, timestamp, siteChecklist: MASTER_SEED.siteChecklist, photos: [`site-${number}.jpg`], fuelNote: 'Tank at about one quarter',
  log: [lg(`${timestamp.replace('T', ' ')}`, 'Return entry raised', 'Bilal Ahmed', 'Off-Hire. Billing stopped', 'amber'), lg(`${timestamp.replace('T', ' ')}`, 'Site check completed', 'Bilal Ahmed', '4 of 4 checks'), lg(`${timestamp.replace('T', ' ')}`, method === 'Company Collection' ? 'Collection arranged' : 'Client self-return', 'Bilal Ahmed'), lg(`${timestamp.replace('T', ' ')}`, 'Approved (Quick Approval)', 'Ahmed Al Khouri', undefined, 'green')], ...over,
});
const rgrn = (id: string, number: string, date: string, status: 'Pending' | 'Validated', it: Partial<ReturnGrnItem> & Pick<ReturnGrnItem, 'itemId' | 'assetId' | 'reachedYard'>): ReturnGrn => ({ id, number, date, status, items: [{ yard: 'Jebel Ali Main Yard', tracked: true, inspection: 'Pending Inspection', yardChecklist: [], ...it }] });
export const returnSeed: ReturnEntry[] = [
  rt('rt1', 'RMA-26-00123', sx('so9'), 'so9c', 'dl10', 'he36', 'Company Collection', '2026-09-30T10:00'),
  rt('rt2', 'RMA-26-00122', sx('so9'), 'so9b', 'dl9', 'he30', 'Self-Return', '2026-09-29T11:00', { grns: [rgrn('rg2', 'GRN-26-00102', '2026-09-29', 'Pending', { itemId: 'rt2-i1', assetId: 'he30', reachedYard: '2026-09-29 15:00' })] }),
  rt('rt3', 'RMA-26-00121', sx('so9'), 'so9a', 'dl8', 'he29', 'Company Collection', '2026-09-15T14:00', { status: 'Return Completed', grns: [rgrn('rg3', 'GRN-26-00101', '2026-09-15', 'Validated', { itemId: 'rt3-i1', assetId: 'he29', reachedYard: '2026-09-15 16:00', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 4500, damageNote: 'Control panel display cracked and canopy door hinge broken', waiverApplied: false, outcome: 'Repair / Maintenance' })] }),
  rt('rt4', 'RMA-26-00132', sx('so2'), 'so2b', 'dl4', 'he24', 'Company Collection', '2026-09-26T10:00', { status: 'Return Completed', grns: [rgrn('rg4', 'GRN-26-00103', '2026-09-26', 'Validated', { itemId: 'rt4-i1', assetId: 'he24', reachedYard: '2026-09-26 15:30', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 0, damageNote: 'Dent on the container door and a broken cable gland', waiverApplied: true, outcome: 'Repair / Maintenance' })] }),
];
export const replacementSeed: Replacement[] = [
  { id: 'rp0', number: 'RP-26-00003', soId: 'so2', lineId: 'so2a', oldAssetId: 'he14', newAssetId: 'he28', reason: 'Breakdown', priceAdjust: 0, notified: true, date: '2026-06-12', crossHireId: 'ch2', by: 'Bilal Ahmed' },
  { id: 'rp1', number: 'RP-26-00004', soId: 'so2', lineId: 'so2a', oldAssetId: 'he28', newAssetId: 'he13', reason: 'Customer request', priceAdjust: 0, notified: true, date: '2026-07-04', by: 'Bilal Ahmed' },
];
/**
 * One trip per status so the Fleet Availability board and the Trips list are full. Every trip belongs to a document (DO, return or replacement), and an order's
 * logisticsCost is the sum of its trips' expenses (recomputed below), so the Logistics tab and the Logistics Cost report agree.
 * The collection of RMA-26-00123 shows a first attempt that is stuck and a second trip with the crane truck.
 */
export const TRIP_SEED_N = 32;
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
  tr('tr3', 3, sx('so9'), 'Collection', { id: 'rt1', number: 'RMA-26-00123' }, { date: '2026-09-30T10:30', status: 'Stuck-Delayed', since: '2026-09-30T13:20', vehicleId: 'he21', plate: 'Dubai P 48213', ...DRV.tariq,
    stuck: { reason: 'Crane not available on site to load the generator', responsible: 'Client', since: '2026-09-30T13:20' },
    log: [lg('2026-09-30 10:30', 'Trip created', 'Bilal Ahmed', 'Dubai P 48213, Tariq Hussain'), lg('2026-09-30 11:00', 'Trip started', 'Bilal Ahmed', undefined, 'blue'), lg('2026-09-30 13:20', 'Marked Stuck-Delayed', 'Bilal Ahmed', 'Crane not available on site to load the generator. Responsible: Client', 'red')] }),
  tr('tr4', 4, sx('so9'), 'Collection', { id: 'rt1', number: 'RMA-26-00123' }, { date: '2026-09-30T15:00', status: 'Assigned', since: '2026-09-30T15:00', vehicleId: 'he41', plate: 'Dubai L 30517', ...DRV.ravi,
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

// ==== BEGIN SALES FLOW SEED ====
/**
 * Sales flow mock data written as of 30 Sep 2026 (the store shifts the dates to the demo day). Added only: Leads ld14-ld27, Opportunities op16-op33,
 * Quotations qt14-qt31, Sales Orders so16-so44, Deliveries dl15-dl42, Returns rt5-rt11, Replacements rp2-rp4, Extensions ex2-ex5.
 * Numbers: LD-26-00037..50, OP-26-00031..48, QT-26-00091..108, SO-26-00059..87, DO-26-00133..160, CN (see returns), RP-26-00005..07, EX-26-00008..11.
 * Everything lives in one block scope so the helper names cannot clash with the regions added after this one.
 */
{
  /* ---------------------------------------------------------------- helpers */
  const PREP: Record<string, { designation: string; mobile: string; email: string }> = {
    'Leena Thomas': { designation: 'Sales Representative', mobile: '+971 50 400 1101', email: 'leena@gulfpowerrentals.ae' },
    'Yousef Karim': { designation: 'Sales Representative', mobile: '+971 50 400 1103', email: 'yousef@gulfpowerrentals.ae' },
    'Omar Farouk': { designation: 'Sales Manager', mobile: '+971 50 400 1100', email: 'omar@gulfpowerrentals.ae' },
    'Khalid Mahmoud': { designation: 'Sales Representative', mobile: '+971 50 400 1105', email: 'khalid@gulfpowerrentals.ae' },
  };
  const qq = (id: string, number: string, oppId: string, customerId: string, status: string, activity: ActivityType, lines: Line[], over: Partial<Quotation> = {}): Quotation => {
    const p = PREP[over.preparedBy ?? 'Leena Thomas'];
    return q(id, number, oppId, customerId, status, activity, lines, { designation: p.designation, mobile: p.mobile, email: p.email, ...over });
  };
  /** Quotation lines cloned from the Sales Order lines (new line ids, nothing assigned or fulfilled). */
  const ql = (ls: Line[], p: string): Line[] => ls.map((l) => ({ ...l, id: `${p}${l.id.replace(/^so\d+/, '')}`, assigned: [], fulfilment: undefined, fulfilmentRef: undefined, crossHire: [] }));
  const RW = (id: string, group: string, category: string, pid: string, price: number, start: string, end: string, over: Partial<Line> = {}): Line =>
    L(id, { activity: 'Rental', item: `Rental ${group} ${category} Weekly`, group, category, frequency: 'Weekly', start, end, unit: 'Nos', price, pricingId: pid, desc: `${group} ${category}, rental, weekly billing`, ...over });
  const T = (id: string, item: string, unit: string, qty: number, price: number, over: Partial<Line> = {}): Line => L(id, { activity: 'Trading', item, unit, qty, price, ...over });

  /* ---------------------------------------------------------------- sales order lines */
  const l16 = [R('so16a', 'Generator', '100 KVA', 18500, '2026-07-15', '2026-12-31'), R('so16b', 'Day Tank', '500 L Day Tank', 1300, '2026-08-10', '2026-12-31'), S('so16c', 'Delivery Charge', 1500, 'One-time'),
    S('so16d', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-07-15', end: '2026-12-31' }), S('so16e', 'Return Charge', 1500, 'One-time')];
  const l17 = [R('so17a', 'Generator', '200 KVA', 29500, '2026-07-22', '2027-01-21'), R('so17b', 'Day Tank', '1000 L Day Tank', 1950, '2026-10-10', '2027-01-21', { allocationTag: 'Client fuel farm tank, rental starts when the client permit is released' }),
    S('so17c', 'Delivery Charge', 1500, 'One-time'), S('so17d', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so17e', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-07-22', end: '2027-01-21' })];
  const l18 = [R('so18a', 'Generator', '500 KVA', 52000, '2026-03-15', '2026-09-15'), R('so18b', 'Trolley', 'Generator Trolley', 1400, '2026-03-15', '2026-09-15'), S('so18c', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'),
    S('so18d', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so18e', 'Operator Charge (Monthly)', 4500, 'Recurring', { frequency: 'Monthly', start: '2026-03-15', end: '2026-09-15' }), S('so18f', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time')];
  const l19 = [R('so19a', 'Generator', '500 KVA', 52000, '2026-07-05', '2027-01-19', { allocationTag: 'Cross-hired 500 KVA unit covers the breakdown of the owned unit' }),
    R('so19b', 'Cable', '4 Core 300 mm', 1100, '2026-08-18', '2027-01-19', { unit: 'Drum', desc: 'Cable 4 core 300 mm, 50 m drum, rental, monthly billing' }), S('so19c', 'Delivery Charge', 1500, 'One-time'),
    S('so19d', 'Cable Laying and Termination', 1800, 'One-time'), S('so19e', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-07-05', end: '2027-01-19' })];
  const l20 = [R('so20a', 'Generator', '1000 KVA', 98000, '2026-05-25', '2026-10-03'), S('so20b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('so20c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time'), S('so20d', 'Damage Waiver (Lump Sum)', 400, 'Lump sum')];
  const l21 = [R('so21a', 'POD', '40 ft POD', 12500, '2026-05-30', '2027-05-29'), S('so21b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('so21c', 'Crane Offloading and Positioning', 1500, 'One-time'), S('so21d', 'Equipment Insurance (Lump Sum)', 1200, 'Lump sum')];
  const l22 = [R('so22a', 'Cable', '4 Core 95 mm', 900, '2026-08-03', '2026-12-31', { qty: 2, unit: 'Drum', desc: 'Cable 4 core 95 mm, 100 m drum, rental, monthly billing' }), S('so22b', 'Cable Laying and Termination', 1800, 'One-time')];
  const l23 = [R('so23a', 'Panel', 'ATS Panel', 6800, '2026-09-05', '2027-03-04', { desc: 'ATS panel 800 A, rental, monthly billing' }), S('so23b', 'Delivery Charge', 1500, 'One-time', { foc: true, desc: 'Delivery charge waived as goodwill, approved by Omar Farouk' }), S('so23c', 'Crane Offloading and Positioning', 1500, 'One-time')];
  const l24 = [R('so24a', 'Cable', '4 Core 185 mm', 1400, '2026-04-03', '2027-04-02', { unit: 'Drum', desc: 'Cable 4 core 185 mm, 100 m drum, rental, monthly billing' }), S('so24b', 'Return Charge', 2000, 'One-time'), S('so24c', 'Cable Laying and Termination', 1800, 'One-time')];
  const l25 = [R('so25a', 'POD', '40 ft POD', 12500, '2026-03-04', '2026-09-30'), S('so25b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('so25c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time')];
  const l26 = [R('so26a', 'Generator', '200 KVA', 29500, '2026-08-05', '2026-09-12'), S('so26b', 'Delivery Charge', 1500, 'One-time'), S('so26c', 'Return Charge', 2000, 'One-time')];
  const l27 = [R('so27a', 'Generator', '500 KVA', 52000, '2026-07-01', '2026-09-30', { discount: 4 }), S('so27b', 'Delivery Charge', 1500, 'One-time'), S('so27c', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-07-01', end: '2026-09-30' }), S('so27d', 'Return Charge', 2000, 'One-time')];
  const l28 = [R('so28a', 'Generator', '1000 KVA', 92500, '2026-04-06', '2026-08-31'), S('so28b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('so28c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time'), S('so28d', 'Generator Installation & Commissioning', 3500, 'One-time')];
  const l29 = [R('so29a', 'Generator', '200 KVA', 29500, '2026-06-18', '2026-08-31', { allocationTag: 'Requested 200 KVA, none free: a 500 KVA unit was delivered at the 200 KVA rate' }), S('so29b', 'Damage Waiver (Monthly)', 150, 'Recurring', { frequency: 'Monthly', start: '2026-06-18', end: '2026-08-31' }),
    S('so29c', 'Delivery Charge', 1500, 'One-time'), S('so29d', 'Return Charge', 2000, 'One-time')];
  const l30 = [RW('so30a', 'Generator', '500 KVA', 'pr4w', 13500, '2026-12-28', '2027-01-04', { qty: 2, discount: 5 }), S('so30b', 'Operator Charge (Weekly)', 1100, 'Recurring', { frequency: 'Weekly', start: '2026-12-28', end: '2027-01-04', qty: 2 }),
    S('so30c', 'Delivery Charge', 1500, 'One-time', { qty: 2 }), S('so30d', 'Return Charge', 2000, 'One-time', { qty: 2 })];
  const l31 = [R('so31a', 'Generator', '1500 KVA', 145000, '2026-11-02', '2027-02-28'), R('so31b', 'Generator', '1000 KVA', 98000, '2026-11-02', '2027-02-28', { qty: 2 }), S('so31c', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time', { qty: 3 }),
    S('so31d', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time', { qty: 3 }), S('so31e', 'Operator Charge (Monthly)', 4500, 'Recurring', { frequency: 'Monthly', start: '2026-11-02', end: '2027-02-28', qty: 3 }),
    S('so31f', 'Equipment Insurance (Monthly)', 300, 'Recurring', { frequency: 'Monthly', start: '2026-11-02', end: '2027-02-28', qty: 3 })];
  const l32 = [R('so32a', 'Generator', '100 KVA', 18500, '2026-10-05', '2026-12-31'), S('so32b', 'Delivery Charge', 1500, 'One-time'), S('so32c', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so32d', 'Damage Waiver (One-time)', 250, 'One-time')];
  const l33 = [R('so33a', 'Generator', '500 KVA', 52000, '2026-09-01', '2026-12-31'), S('so33b', 'Generator Installation & Commissioning', 3500, 'One-time'), S('so33c', 'Delivery Charge', 1500, 'One-time')];
  const l34 = [R('so34a', 'Generator', '200 KVA', 29500, '2026-10-01', '2026-12-31', { qty: 3 }), S('so34b', 'Delivery Charge', 1500, 'One-time', { qty: 3 })];
  const l35 = [T('so35a', 'ATS Panel 400A', 'Nos', 2, 38500), T('so35b', 'Distribution Panel 630A', 'Nos', 1, 27500), T('so35c', 'Oil Filter (Cummins C-Series)', 'Nos', 100, 85)];
  const l36 = [T('so36a', 'Power Cable 4C x 95 mm', 'Meter', 300, 62), T('so36b', 'Cable Lug 185 mm Copper (Crimp)', 'Nos', 24, 28), T('so36c', 'Fire Extinguisher DCP 9 kg', 'Nos', 4, 185, { foc: true, desc: 'Fire extinguishers supplied free of charge with the cable order' })];
  const l37 = [L('so37a', { activity: 'Fuel Trading', item: 'Diesel (Bulk)', unit: 'Litre', qty: 25000, price: 2.85, location: 'Gulf Petroleum Sharjah Depot (Fuel Stock)' })];
  const l38 = [L('so38a', { activity: 'Fixed Asset Trading', item: 'Generator 200 KVA (sale)', group: 'Generator', category: '200 KVA', unit: 'Nos', qty: 1, price: 41000, desc: 'Ex-fleet diesel generator 200 KVA, sold as is with the service history' })];
  const l39 = [L('so39a', { activity: 'Fixed Asset Trading', item: 'Generator 1000 KVA (sale)', group: 'Generator', category: '1000 KVA', unit: 'Nos', qty: 1, price: 740000, discount: 4, desc: 'Ex-fleet diesel generator 1000 KVA with 4,200 running hours' })];
  const l40 = [S('so40a', 'Generator Installation & Commissioning', 3500, 'One-time', { activity: 'Other', qty: 2 }), S('so40b', 'Cable Laying and Termination', 1800, 'One-time', { activity: 'Other', qty: 3 }), S('so40c', 'Crane Offloading and Positioning', 1500, 'One-time', { activity: 'Other' })];
  const S41 = 'Two scheduled visits a year on the 750 KVA hospital standby generator: full service, ATS test and load run, consumables and extra work billed against each job card';
  const S42 = 'Quarterly service of the two 500 KVA hotel standby generators: four scheduled visits, filters and oil changed as needed, extra work billed against each job card';
  const S43 = 'Monthly preventive maintenance of the four 1500 KVA data hall generators: twelve scheduled visits, monthly run test, quarterly load bank test, consumables billed against each job card';
  const l41 = [amcLine(9500, S41, 'so41a')];
  const l42 = [amcLine(26000, S42, 'so42a')];
  const l43 = [amcLine(96000, S43, 'so43a')];
  const l44 = [T('so44a', 'Power Cable 4C x 300 mm', 'Meter', 200, 25), T('so44b', 'Oil Filter (Cummins C-Series)', 'Nos', 50, 87), T('so44c', 'Fuel Filter (Cummins C-Series)', 'Nos', 80, 70)];

  /* ---------------------------------------------------------------- leads (every status, every Activity Type, some overdue follow ups) */
  leadSeed.push(
    { id: 'ld14', number: 'LD-26-00037', date: '2026-02-09', source: 'Referral', activity: 'Rental', company: 'Arabian Gulf Contracting Co LLC', contact: 'Mathew Joseph', phone: '+971 50 442 9017', email: 'mathew@agcontracting.ae', owner: 'Omar Farouk', status: 'Converted', opportunityId: 'op16',
      tags: 'Precast yard, Silicon Oasis', priority: 'High', leadType: 'Company', reference: 'RFQ-AGC-0206', probability: 100, industry: 'Construction', annualRevenue: 420000000, location: 'Dubai', currency: 'AED', vat: '100418273600003',
      comms: [lg('2026-03-02 10:15', 'Converted to Opportunity OP-26-00031', 'Omar Farouk'), lg('2026-02-17 11:00', 'Site visit: precast yard power room measured', 'Omar Farouk', '1000 KVA needed from April, 5 months'), lg('2026-02-09 09:30', 'Lead created', 'Omar Farouk', 'Referral from the Dubai Metro Works team')] },
    { id: 'ld15', number: 'LD-26-00038', date: '2026-04-28', source: 'Trade Show', activity: 'AMC', company: 'Al Wasl Data Centres FZ-LLC', contact: 'Prakash Iyer', phone: '+971 4 360 7741', email: 'prakash@alwasldc.ae', owner: 'Omar Farouk', status: 'Converted', opportunityId: 'op17',
      tags: 'Data centre, DC1, monthly PM', priority: 'High', leadType: 'Company', probability: 100, industry: 'Real Estate', annualRevenue: 880000000, location: 'Dubai Silicon Oasis',
      comms: [lg('2026-04-30 12:00', 'Converted to Opportunity OP-26-00032', 'Omar Farouk'), lg('2026-04-28 15:45', 'Met at the Data Centre World stand', 'Omar Farouk', 'Their AMC contractor is exiting in June')] },
    { id: 'ld16', number: 'LD-26-00039', date: '2026-09-29', source: 'WhatsApp', activity: 'Fuel Trading', company: 'Salem Al Mazrouei', contact: 'Salem Al Mazrouei', phone: '+971 50 719 4402', email: 'salem.mazrouei@mail.ae', owner: 'Khalid Mahmoud', status: 'New', nextFollowUp: '2026-10-01',
      tags: 'Individual, farm diesel', priority: 'Low', leadType: 'Individual', probability: 10, location: 'Al Dhaid, Sharjah', comms: [] },
    { id: 'ld17', number: 'LD-26-00040', date: '2026-09-21', source: 'Phone', activity: 'Rental', company: 'Fujairah Shipyard Services', contact: 'Abdullah Al Hefeiti', phone: '+971 9 222 6410', email: 'abdullah@fujshipyard.ae', owner: 'Khalid Mahmoud', status: 'Cold call', nextFollowUp: '2026-09-26',
      tags: 'Marine, dry dock', priority: 'Low', leadType: 'Company', probability: 10, industry: 'Oil & Gas', location: 'Fujairah', comms: [lg('2026-09-21 14:20', 'Cold call: asked to send the fleet list', 'Khalid Mahmoud', 'Fleet list not sent yet')] },
    { id: 'ld18', number: 'LD-26-00041', date: '2026-09-18', source: 'Email', activity: 'Trading', company: 'Al Ain Farms and Agri Holdings', contact: 'Hamad Al Kaabi', phone: '+971 3 762 9045', email: 'hamad@alainfarms.ae', owner: 'Yousef Karim', status: 'Contacted', nextFollowUp: '2026-10-02',
      tags: 'Existing customer, pump station cable', priority: 'Medium', leadType: 'Company', probability: 30, industry: 'Manufacturing', location: 'Al Ain', comms: [lg('2026-09-19 10:10', 'Email sent: cable and panel price list', 'Yousef Karim')] },
    { id: 'ld19', number: 'LD-26-00042', date: '2026-09-12', source: 'Search engine', activity: 'Rental', company: 'Dubai South Logistics Hub', contact: 'Rania Sabbagh', phone: '+971 4 818 7720', email: 'rania@dsouthlogistics.ae', owner: 'Leena Thomas', status: 'Contact in progress', nextFollowUp: '2026-10-03',
      tags: 'Warehouse park, 3 months', priority: 'Medium', leadType: 'Company', probability: 70, industry: 'Logistics', location: 'Dubai South',
      comms: [lg('2026-09-24 11:40', 'Call: requirement is 2 x 200 KVA for a cold store', 'Leena Thomas', 'Waiting for the site load list'), lg('2026-09-12 09:20', 'Web enquiry received', 'Leena Thomas')],
      followUps: [{ type: 'Call', date: '2026-10-03', remind: '2026-10-03', desc: 'Get the load list for the cold store' }] },
    { id: 'ld20', number: 'LD-26-00043', date: '2026-08-30', source: 'Referral', activity: 'Rental', company: 'Ajman Pearl Towers Development', contact: 'Reem Al Shamsi', phone: '+971 6 742 1189', email: 'reem@ajmanpearl.ae', owner: 'Leena Thomas', status: 'Follow up', nextFollowUp: '2026-09-22',
      tags: 'Tower B, MEP testing', priority: 'High', leadType: 'Company', probability: 80, industry: 'Real Estate', location: 'Ajman', comms: [lg('2026-09-08 16:00', 'Client asked for 3 x 200 KVA from 1 October', 'Leena Thomas'), lg('2026-09-15 10:00', 'Follow up call not answered', 'Leena Thomas', 'Follow up is overdue')],
      followUps: [{ type: 'Call', date: '2026-09-22', remind: '2026-09-21', desc: 'Confirm the start date and the LPO' }] },
    { id: 'ld21', number: 'LD-26-00044', date: '2026-09-02', source: 'Linkedin', activity: 'Rental', company: 'Mina Zayed Port Operations', contact: 'Capt. Yousuf Al Hammadi', phone: '+971 2 673 5518', email: 'yousuf@minazayedport.ae', owner: 'Yousef Karim', status: 'Negotiating', nextFollowUp: '2026-10-02',
      tags: 'Port, 3 x 1000 KVA, 9 months', priority: 'High', leadType: 'Company', probability: 50, industry: 'Logistics', annualRevenue: 310000000, location: 'Abu Dhabi',
      comms: [lg('2026-09-26 15:30', 'Client wants a 10 percent discount for a 9 month commitment', 'Yousef Karim', 'Escalated to Omar Farouk'), lg('2026-09-10 11:00', 'Site meeting at Mina Zayed', 'Yousef Karim')] },
    { id: 'ld22', number: 'LD-26-00045', date: '2026-09-14', source: 'Referral', activity: 'Fixed Asset Trading', company: 'Mubarak Heavy Civil Works', contact: 'George Thomas', phone: '+971 2 555 3871', email: 'george@mubarakcivil.ae', owner: 'Omar Farouk', status: 'Quotation sent', nextFollowUp: '2026-10-04',
      tags: 'Buy ex-fleet 1000 KVA', priority: 'Medium', leadType: 'Company', probability: 30, industry: 'Construction', comms: [lg('2026-09-22 09:15', 'Quotation sent for one ex-fleet 1000 KVA unit', 'Omar Farouk', 'Client to inspect the unit at Jebel Ali')] },
    { id: 'ld23', number: 'LD-26-00046', date: '2026-08-25', source: 'Email', activity: 'Trading', company: 'Al Dhafra Utilities Services', contact: 'Saeed Al Mheiri', phone: '+971 2 641 8820', email: 'saeed@aldhafrautilities.ae', owner: 'Yousef Karim', status: 'Qualified', nextFollowUp: '2026-10-05',
      tags: 'Panels and filters', priority: 'Medium', leadType: 'Company', probability: 50, industry: 'Utilities', comms: [lg('2026-09-01 12:00', 'Budget confirmed, wants delivery in two lots', 'Yousef Karim')] },
    { id: 'ld24', number: 'LD-26-00047', date: '2026-09-08', source: 'Facebook', activity: 'Other', company: 'Sunrise Auto Garage', contact: 'Imtiaz Hussain', phone: '+971 55 903 2276', email: 'imtiaz@sunriseauto.ae', owner: 'Khalid Mahmoud', status: 'Unqualified', lostReason: 'Other',
      tags: 'Wants a 15 KVA wiring job', priority: 'Low', leadType: 'Company', probability: 0, comms: [lg('2026-09-09 10:00', 'Needs house wiring, not generator installation', 'Khalid Mahmoud', 'Outside our scope')] },
    { id: 'ld25', number: 'LD-26-00048', date: '2026-07-30', source: 'Walk-in', activity: 'Trading', company: 'Hussain Al Blooshi', contact: 'Hussain Al Blooshi', phone: '+971 50 244 8190', email: 'hussain.blooshi@mail.ae', owner: 'Leena Thomas', status: 'Not qualified', lostReason: 'Other',
      tags: 'Individual, used fuel pump', priority: 'Low', leadType: 'Individual', probability: 0, comms: [lg('2026-07-30 17:10', 'Walked in for a used fuel pump, we do not trade pumps', 'Leena Thomas')] },
    { id: 'ld26', number: 'LD-26-00049', date: '2026-01-12', source: 'Referral', activity: 'Rental', company: 'Liwa Desert Camps Hospitality', contact: 'Mansour Al Dhaheri', phone: '+971 50 301 5864', email: 'mansour@liwacamps.ae', owner: 'Yousef Karim', status: 'Lost', lostReason: 'Price',
      tags: 'Desert camp season', priority: 'Medium', leadType: 'Company', probability: 0, industry: 'Hospitality', comms: [lg('2026-02-18 14:00', 'Client chose a local supplier, 18 percent cheaper', 'Yousef Karim'), lg('2026-01-12 10:00', 'Lead created', 'Yousef Karim')] },
    { id: 'ld27', number: 'LD-26-00050', date: '2026-08-03', source: 'Phone', activity: 'Rental', company: 'Gulf Shipyards LLC', contact: 'Peter Almeida', phone: '+971 4 345 6620', email: 'peter@gulfshipyards.ae', owner: 'Omar Farouk', status: 'Lost', lostReason: 'No Stock',
      tags: '1500 KVA, dry dock', priority: 'High', leadType: 'Company', probability: 0, industry: 'Oil & Gas', comms: [lg('2026-08-12 09:30', 'No 1500 KVA unit free for 6 months, client went to another hire company', 'Omar Farouk', 'Cross-hire was not approved')] },
  );

  /* ---------------------------------------------------------------- opportunities (every stage) */
  oppSeed.push(
    O({ id: 'op16', number: 'OP-26-00031', date: '2026-03-02', customerId: 'c10', contact: 'Mathew Joseph', project: 'Silicon Oasis Precast Yard', owner: 'Omar Farouk', title: 'Rent 1000 KVA for the Silicon Oasis precast yard', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 480000, probability: 100, expectedClose: '2026-03-27',
      leadId: 'ld14', quotationId: 'qt16', source: 'Referral', lpo: 'LPO-AGC-8821', lpoDate: '2026-03-27', site: 'Dubai Silicon Oasis precast yard', priority: 'High', industry: 'Construction', winLossReason: 'Install Base', comments: 'Negotiated down in two rounds, three quotation versions',
      lines: [L('op16a', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', price: 98000 })] }),
    O({ id: 'op17', number: 'OP-26-00032', date: '2026-04-30', customerId: 'c16', contact: 'Prakash Iyer', project: 'Data Centre DC1 Generator Plant', owner: 'Omar Farouk', title: 'Annual maintenance with monthly service visits for the DC1 generator plant', activity: 'AMC', stage: 'Won', rating: 'Hot', estimated: 96000, probability: 100, expectedClose: '2026-05-25',
      leadId: 'ld15', quotationId: 'qt17', source: 'Trade Show', site: 'Al Wasl Data Centre DC1, Dubai Silicon Oasis', priority: 'High', industry: 'Real Estate', winLossReason: 'Good Lead' }),
    O({ id: 'op18', number: 'OP-26-00033', date: '2026-07-15', customerId: 'c18', contact: 'Dr. Salma Khoury', project: 'Hospital Standby Power', owner: 'Yousef Karim', title: 'Bi-annual service of the hospital standby generator', activity: 'AMC', stage: 'Won', rating: 'Warm', estimated: 9500, probability: 100, expectedClose: '2026-07-28', quotationId: 'qt18', site: 'Al Ain Specialist Hospital, Al Ain', priority: 'Medium' }),
    O({ id: 'op19', number: 'OP-26-00034', date: '2026-02-10', customerId: 'c11', contact: 'Layla Haddad', project: 'Palm Hotel Standby Generators', owner: 'Leena Thomas', title: 'Quarterly service of the hotel standby generators', activity: 'AMC', stage: 'Won', rating: 'Warm', estimated: 26000, probability: 100, expectedClose: '2026-02-24', quotationId: 'qt19', site: 'Emirates Palm Hotel, Palm Jumeirah', industry: 'Hospitality' }),
    O({ id: 'op20', number: 'OP-26-00035', date: '2026-07-01', customerId: 'c4', contact: 'Imran Qureshi', project: 'Staff Accommodation Block', owner: 'Leena Thomas', title: 'Rent 200 KVA and 1000 L day tank for the staff accommodation block', activity: 'Rental', stage: 'Won', rating: 'Warm', estimated: 190000, probability: 100, expectedClose: '2026-07-17', quotationId: 'qt20', lpo: 'LPO-DPH-4417', lpoDate: '2026-07-17', site: 'Desert Pearl Resort, Sharjah', industry: 'Hospitality',
      lines: [L('op20a', { activity: 'Rental', item: 'Generator 200 KVA', group: 'Generator', category: '200 KVA', price: 29500 }), L('op20b', { activity: 'Rental', item: 'Day Tank 1000 L', group: 'Day Tank', category: '1000 L Day Tank', price: 1950 })] }),
    O({ id: 'op21', number: 'OP-26-00036', date: '2026-06-18', customerId: 'c5', contact: 'Sergei Petrov', project: 'Station 7 Fit-out', owner: 'Omar Farouk', title: 'Rent 500 KVA and 300 mm cable for the Station 7 fit-out', activity: 'Rental', stage: 'Won', rating: 'Hot', estimated: 340000, probability: 100, expectedClose: '2026-07-01', quotationId: 'qt21', lpo: 'LPO-DMW-5702', lpoDate: '2026-07-01', site: 'Station 7 Fit-out, Al Satwa, Dubai', approvalRequired: true, priority: 'High', industry: 'Construction' }),
    O({ id: 'op22', number: 'OP-26-00037', date: '2026-08-28', customerId: 'c12', contact: 'Saeed Al Mheiri', project: 'Mirfa Water Plant', owner: 'Yousef Karim', title: 'Supply of ATS panels, a distribution panel and filters for the Mirfa water plant', activity: 'Trading', stage: 'Won', rating: 'Warm', estimated: 107000, probability: 100, expectedClose: '2026-09-08', quotationId: 'qt22', leadId: undefined, site: 'Mirfa Water Plant, Al Dhafra', industry: 'Utilities' }),
    O({ id: 'op23', number: 'OP-26-00038', date: '2026-09-01', customerId: 'c26', contact: 'Faisal Al Qasimi', project: 'Dammam Yard Spares', owner: 'Omar Farouk', title: 'Export of cable and filters to the Dammam yard', activity: 'Trading', stage: 'Won', rating: 'Warm', estimated: 21500, probability: 100, expectedClose: '2026-09-10', quotationId: 'qt23', site: 'Julfar Dammam yard, Saudi Arabia', industry: 'Logistics', currency: 'SAR' }),
    O({ id: 'op24', number: 'OP-26-00039', date: '2026-09-26', customerId: 'c22', contact: 'Maryam Al Ameri', project: 'Private Wedding Tent', owner: 'Yousef Karim', title: 'Power for a private wedding tent, 600 guests', activity: 'Rental', stage: 'Enquiry', rating: 'Warm', estimated: 14000, probability: 10, expectedClose: '2026-11-20', source: 'Phone', site: 'Al Bateen, Abu Dhabi', nextAction: 'Visit the venue and confirm the lighting and cooling load',
      lines: [L('op24a', { activity: 'Rental', item: 'Generator 200 KVA', group: 'Generator', category: '200 KVA', price: 8400 })] }),
    O({ id: 'op25', number: 'OP-26-00040', date: '2026-09-22', customerId: 'c14', contact: 'Captain Ian McBride', project: 'Offshore Support Base', owner: 'Yousef Karim', title: 'Rent 2 x 40 ft PODs and 185 mm cable for the offshore support base', activity: 'Rental', stage: 'Qualified', rating: 'Hot', estimated: 130000, probability: 30, expectedClose: '2026-10-25', quotationId: 'qt24', source: 'Referral', site: 'Mussafah Marine Base, Abu Dhabi', priority: 'High', industry: 'Oil & Gas',
      nextAction: 'No 40 ft POD or 185 mm cable is Ready for Hire: raise a cross-hire request or confirm a start date after the returns', lines: [L('op25a', { activity: 'Rental', item: 'POD 40 ft', group: 'POD', category: '40 ft POD', qty: 2, price: 12500 }), L('op25b', { activity: 'Rental', item: 'Cable 4 Core 185 mm', group: 'Cable', category: '4 Core 185 mm', qty: 3, price: 1400 })] }),
    O({ id: 'op26', number: 'OP-26-00041', date: '2026-09-15', customerId: 'c23', contact: 'Chris Walker', project: 'Sandstorm Winter Festival', owner: 'Leena Thomas', title: 'Rent 4 x 500 KVA festival power packages for the Sandstorm winter festival', activity: 'Rental', stage: 'Quoted', rating: 'Hot', estimated: 210000, probability: 40, expectedClose: '2026-10-12', quotationId: 'qt25', source: 'Trade Show', site: 'Al Marmoom Desert, Dubai', industry: 'Events', nextAction: 'Client reviewing the package price, call on Sunday' }),
    O({ id: 'op27', number: 'OP-26-00042', date: '2026-09-16', customerId: 'c23', contact: 'Chris Walker', project: 'Sandstorm Winter Festival', owner: 'Leena Thomas', title: 'Rent 4 x 500 KVA festival power packages for the Sandstorm winter festival', activity: 'Rental', stage: 'Enquiry', rating: 'Cold', estimated: 210000, probability: 10, expectedClose: '2026-10-30', source: 'Website', site: 'Al Marmoom Desert, Dubai', industry: 'Events', comments: 'Duplicate of OP-26-00041, raised again from the website form. Merge or close one of them' }),
    O({ id: 'op28', number: 'OP-26-00043', date: '2026-09-20', customerId: 'c17', contact: 'Ahmad Al Hosani', project: 'Ruwais 2027 Turnaround', owner: 'Yousef Karim', title: 'Rent 2 x 1500 KVA and 1000 KVA for the Ruwais 2027 turnaround', activity: 'Rental', stage: 'Proposal', rating: 'Hot', estimated: 2330000, probability: 50, expectedClose: '2026-11-10', quotationId: 'qt26', site: 'Ruwais Industrial Complex, Al Dhafra', approvalRequired: true, priority: 'High', industry: 'Oil & Gas',
      nextAction: 'Customer is at 97 percent of the credit limit: Finance to confirm security before the order', lines: [L('op28a', { activity: 'Rental', item: 'Generator 1500 KVA', group: 'Generator', category: '1500 KVA', qty: 2, price: 145000 }), L('op28b', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', price: 98000 })] }),
    O({ id: 'op29', number: 'OP-26-00044', date: '2026-08-28', customerId: 'c13', contact: 'Nina Kapoor', project: 'Burj Park Summer Events', owner: 'Leena Thomas', title: 'Rent 1000 KVA for the Burj Park summer events', activity: 'Rental', stage: 'Negotiation', rating: 'Warm', estimated: 98000, probability: 70, expectedClose: '2026-10-08', quotationId: 'qt27', site: 'Burj Park, Downtown Dubai', industry: 'Events', nextAction: 'Client is over the credit limit: ask for a 50 percent advance before a new quotation',
      lines: [L('op29a', { activity: 'Rental', item: 'Generator 1000 KVA', group: 'Generator', category: '1000 KVA', price: 98000 })] }),
    O({ id: 'op30', number: 'OP-26-00045', date: '2026-07-12', customerId: 'c25', contact: 'Hamad Al Kaabi', project: 'Date Farm Pump Station', owner: 'Yousef Karim', title: 'Rent 500 KVA for the date farm pump station', activity: 'Rental', stage: 'Quoted', rating: 'Cold', estimated: 156000, probability: 40, expectedClose: '2026-08-20', quotationId: 'qt28', site: 'Al Ain Farms, Remah', comments: 'No response after two reminders, the quotation validity has passed. Close or requote' }),
    O({ id: 'op31', number: 'OP-26-00046', date: '2026-01-15', customerId: 'c24', contact: 'Mansour Al Dhaheri', project: 'Liwa Desert Camp Season', owner: 'Yousef Karim', title: 'Rent 2 x 200 KVA for the Liwa desert camp season', activity: 'Rental', stage: 'Lost', rating: 'Cold', estimated: 90000, probability: 0, expectedClose: '2026-02-15', quotationId: 'qt29', lostReason: 'Client Went Cold', winLossReason: 'No Budget', comments: 'Customer later deactivated after its payment delays', site: 'Liwa Oasis' }),
    O({ id: 'op32', number: 'OP-26-00047', date: '2026-08-04', customerId: 'c20', contact: 'Reem Al Shamsi', project: 'Ajman Pearl Tower A', owner: 'Leena Thomas', title: 'Rent 3 x 500 KVA for Ajman Pearl Tower A commissioning', activity: 'Rental', stage: 'Lost', rating: 'Cold', estimated: 468000, probability: 0, expectedClose: '2026-08-31', quotationId: 'qt30', lostReason: 'Price', winLossReason: 'Lost To Competition', comments: 'Project postponed and a competitor offered fuel included', site: 'Ajman Pearl Tower A, Ajman' }),
    O({ id: 'op33', number: 'OP-26-00048', date: '2026-09-25', customerId: 'c21', contact: 'Rashid Al Falasi', project: 'Villa Works Al Barsha South', owner: 'Leena Thomas', title: 'Rent 100 KVA for villa construction, Al Barsha South', activity: 'Rental', stage: 'Proposal', rating: 'Warm', estimated: 38000, probability: 50, expectedClose: '2026-10-05', quotationId: 'qt31', source: 'Walk-in', site: 'Villa 14, Al Barsha South 3, Dubai', priority: 'Medium', nextAction: 'Collect the deposit by cash before delivery' }),
  );

  /* ---------------------------------------------------------------- quotations (every status, v1-v3 chain, Open PO / Closed / Project, VAT standard and export) */
  const qlog = (...items: LogItem[]) => items;
  quoteSeed.push(
    /* revision chain for Arabian Gulf Contracting: v1 and v2 revised, v3 converted */
    qq('qt14', 'QT-26-00091', 'op16', 'c10', 'Revised', 'Rental', [R('qt14a', 'Generator', '1000 KVA', 98000, '2026-04-06', '2026-08-31'), S('qt14b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('qt14c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time')],
      { date: '2026-03-04', validUntil: '2026-03-18', contractType: 'Closed', contractStart: '2026-04-06', contractEnd: '2026-08-31', preparedBy: 'Omar Farouk', paymentTerms: '60 days', description: 'Rent 1000 KVA for the Silicon Oasis precast yard, first offer',
        log: qlog(lg('2026-03-10 15:00', 'Superseded by a revision', 'Omar Farouk'), lg('2026-03-04 09:00', 'Quotation created', 'Omar Farouk')) }),
    qq('qt15', 'QT-26-00092', 'op16', 'c10', 'Revised', 'Rental', [R('qt15a', 'Generator', '1000 KVA', 95000, '2026-04-06', '2026-08-31'), S('qt15b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('qt15c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time'), S('qt15d', 'Generator Installation & Commissioning', 3500, 'One-time', { foc: true, desc: 'Commissioning offered free to match the competitor offer' })],
      { date: '2026-03-11', validUntil: '2026-03-25', version: 2, prevId: 'qt14', contractType: 'Closed', contractStart: '2026-04-06', contractEnd: '2026-08-31', preparedBy: 'Omar Farouk', paymentTerms: '60 days', description: 'Revision 2: rate down to AED 95,000 and free commissioning',
        log: qlog(lg('2026-03-19 11:30', 'Superseded by a revision', 'Omar Farouk'), lg('2026-03-11 10:00', 'Revision 2 created from QT-26-00091', 'Omar Farouk', 'Rate AED 98,000 to 95,000, commissioning made FOC')) }),
    qq('qt16', 'QT-26-00093', 'op16', 'c10', 'Converted to Sales Order', 'Rental', ql(l28, 'qt16'),
      { date: '2026-03-20', validUntil: '2026-04-03', version: 3, prevId: 'qt15', contractType: 'Closed', contractStart: '2026-04-06', contractEnd: '2026-08-31', salesOrderId: 'so28', preparedBy: 'Omar Farouk', paymentTerms: '60 days', description: 'Revision 3: final rate AED 92,500, commissioning charged again',
        log: qlog(lg('2026-03-30 10:00', 'Converted to SO-26-00071', 'Omar Farouk', undefined, 'green'), lg('2026-03-27 16:00', 'Approved by the client with LPO-AGC-8821', 'Omar Farouk', undefined, 'green'), lg('2026-03-20 09:30', 'Revision 3 created from QT-26-00092', 'Omar Farouk', 'Rate AED 95,000 to 92,500, commissioning charged')) }),
    /* AMC: 12, 2 and 4 visits */
    qq('qt17', 'QT-26-00094', 'op17', 'c16', 'Converted to Sales Order', 'AMC', [amcLine(96000, S43, 'qt17a')],
      { date: '2026-05-12', validUntil: '2026-06-12', contractType: 'Closed', amcStart: '2026-06-01', amcEnd: '2027-05-31', visits: 12, amcValue: 96000, amcScope: S43, salesOrderId: 'so43', preparedBy: 'Omar Farouk', paymentTerms: '90 days', costCentre: 'AMC Services', description: 'AMC with 12 monthly visits, DC1 generator plant',
        log: qlog(lg('2026-05-26 10:00', 'Converted to SO-26-00086', 'Omar Farouk', undefined, 'green'), lg('2026-05-12 09:00', 'Quotation created', 'Omar Farouk')) }),
    qq('qt18', 'QT-26-00095', 'op18', 'c18', 'Converted to Sales Order', 'AMC', [amcLine(9500, S41, 'qt18a')],
      { date: '2026-07-20', validUntil: '2026-08-20', contractType: 'Closed', amcStart: '2026-08-01', amcEnd: '2027-07-31', visits: 2, amcValue: 9500, amcScope: S41, salesOrderId: 'so41', preparedBy: 'Yousef Karim', costCentre: 'AMC Services', description: 'AMC with 2 visits, hospital standby generator',
        log: qlog(lg('2026-07-28 11:00', 'Converted to SO-26-00084', 'Yousef Karim', undefined, 'green'), lg('2026-07-20 09:00', 'Quotation created', 'Yousef Karim')) }),
    qq('qt19', 'QT-26-00096', 'op19', 'c11', 'Converted to Sales Order', 'AMC', [amcLine(26000, S42, 'qt19a')],
      { date: '2026-02-12', validUntil: '2026-03-12', contractType: 'Closed', amcStart: '2026-03-01', amcEnd: '2027-02-28', visits: 4, amcValue: 26000, amcScope: S42, salesOrderId: 'so42', paymentTerms: '45 days', costCentre: 'AMC Services', description: 'AMC with 4 quarterly visits, hotel standby generators',
        log: qlog(lg('2026-02-24 10:30', 'Converted to SO-26-00085', 'Leena Thomas', undefined, 'green'), lg('2026-02-12 09:00', 'Quotation created', 'Leena Thomas')) }),
    /* Rental converted */
    qq('qt20', 'QT-26-00097', 'op20', 'c4', 'Converted to Sales Order', 'Rental', ql(l17, 'qt20'),
      { date: '2026-07-06', validUntil: '2026-07-20', contractType: 'Closed', contractStart: '2026-07-22', contractEnd: '2027-01-21', salesOrderId: 'so17', paymentTerms: '60 days', costCentre: 'Sharjah Branch', description: 'Rent 200 KVA and 1000 L day tank for the staff accommodation block',
        log: qlog(lg('2026-07-18 10:00', 'Converted to SO-26-00060', 'Leena Thomas', undefined, 'green'), lg('2026-07-06 09:00', 'Quotation created', 'Leena Thomas')) }),
    qq('qt21', 'QT-26-00098', 'op21', 'c5', 'Converted to Sales Order', 'Rental', ql(l19, 'qt21').map((l) => (l.end === '2027-01-19' ? { ...l, end: '2026-10-19' } : l)),
      { date: '2026-06-20', validUntil: '2026-07-04', contractType: 'Closed', contractStart: '2026-07-05', contractEnd: '2026-10-19', salesOrderId: 'so19', preparedBy: 'Omar Farouk', paymentTerms: '60 days', costCentre: 'SO-26-00062 Station 7 Fit-out (Dubai Metro Works JV)', description: 'Rent 500 KVA and 300 mm cable for the Station 7 fit-out',
        log: qlog(lg('2026-07-02 10:00', 'Converted to SO-26-00062', 'Omar Farouk', undefined, 'green'), lg('2026-06-24 15:00', 'Approved', 'Ahmed Al Khouri', 'Value above AED 300,000', 'green'), lg('2026-06-20 09:00', 'Quotation created', 'Omar Farouk')) }),
    /* Trading and export */
    qq('qt22', 'QT-26-00099', 'op22', 'c12', 'Converted to Sales Order', 'Trading', ql(l35, 'qt22'),
      { date: '2026-09-01', validUntil: '2026-09-30', discountPct: 3, salesOrderId: 'so35', preparedBy: 'Yousef Karim', paymentTerms: '45 days', costCentre: 'Abu Dhabi Branch', description: 'Supply of ATS panels, a distribution panel and filters for the Mirfa water plant',
        log: qlog(lg('2026-09-08 10:00', 'Converted to SO-26-00078', 'Yousef Karim', undefined, 'green'), lg('2026-09-01 09:00', 'Quotation created', 'Yousef Karim')) }),
    qq('qt23', 'QT-26-00100', 'op23', 'c26', 'Converted to Sales Order', 'Trading', ql(l44, 'qt23'),
      { date: '2026-09-03', validUntil: '2026-09-30', currency: 'SAR', exchangeRate: 0.9792, vatType: VAT_TYPES[1], incoterm: 'DAP', salesOrderId: 'so44', preparedBy: 'Omar Farouk', paymentTerms: '30 days', costCentre: 'Sharjah Branch', description: 'Export of cable and filters to the Dammam yard, priced in SAR, zero-rated',
        log: qlog(lg('2026-09-10 09:30', 'Converted to SO-26-00087', 'Omar Farouk', undefined, 'green'), lg('2026-09-03 09:00', 'Quotation created', 'Omar Farouk', 'Export, zero-rated, SAR')) }),
    /* open pipeline: Draft, Under review, Submitted for Approval, Rejected, Expired, Closed, Cancelled, Approved */
    qq('qt24', 'QT-26-00101', 'op25', 'c14', 'Draft', 'Rental', [R('qt24a', 'POD', '40 ft POD', 3400, '2026-11-01', '2027-04-30', { qty: 2 }), R('qt24b', 'Cable', '4 Core 185 mm', 380, '2026-11-01', '2027-04-30', { qty: 3, unit: 'Drum' }), S('qt24c', 'Delivery Charge (Low-bed, Heavy Unit)', 760, 'One-time', { qty: 2 })],
      { date: '2026-09-29', validUntil: '2026-10-29', currency: 'USD', exchangeRate: 3.6725, contractType: 'Project', billingStructure: 'Lump Sum', contractStart: '2026-11-01', contractEnd: '2027-04-30', preparedBy: 'Yousef Karim', paymentTerms: '60 days', costCentre: 'Abu Dhabi Branch',
        description: 'Rent 2 x 40 ft PODs and 185 mm cable for the offshore support base, priced in USD', log: qlog(lg('2026-09-29 14:00', 'Quotation created', 'Yousef Karim', 'No Ready for Hire 40 ft POD or 185 mm cable yet'))}),
    qq('qt25', 'QT-26-00102', 'op26', 'c23', 'Under review', 'Rental', [L('qt25a', { activity: 'Rental', lineType: 'Package', item: 'Festival Power Package: 500 KVA generator, 1000 L day tank, 100 m cable and ATS panel', group: 'Generator', category: '500 KVA', frequency: 'Weekly', start: '2026-12-05', end: '2026-12-31', unit: 'Package', qty: 4, price: 14800, discount: 6,
        allocationTag: 'Reserve 4 units from the Sharjah and Abu Dhabi yards', desc: 'Complete festival stage power package, weekly rate' }), S('qt25b', 'Generator Installation & Commissioning', 3500, 'One-time', { qty: 4 }), S('qt25c', 'Crane Offloading and Positioning', 1500, 'One-time', { foc: true, qty: 4, desc: 'Crane offloading free of charge for a four package order' })],
      { date: '2026-09-24', validUntil: '2026-10-24', contractType: 'Closed', contractStart: '2026-12-05', contractEnd: '2026-12-31', paymentTerms: '15 days', costCentre: 'Dubai Branch', description: 'Rent 4 x 500 KVA festival power packages for the Sandstorm winter festival',
        log: qlog(lg('2026-09-28 10:00', 'Under review with the client', 'Leena Thomas', 'Client reviewing the package price'), lg('2026-09-24 11:00', 'Quotation created', 'Leena Thomas')) }),
    qq('qt26', 'QT-26-00103', 'op28', 'c17', 'Submitted for Approval', 'Rental', [R('qt26a', 'Generator', '1500 KVA', 145000, '2027-01-10', '2027-07-09', { qty: 2 }), R('qt26b', 'Generator', '1000 KVA', 98000, '2027-01-10', '2027-07-09'), S('qt26c', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time', { qty: 3 }),
        S('qt26d', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time', { qty: 3 }), S('qt26e', 'Operator Charge (Monthly)', 4500, 'Recurring', { frequency: 'Monthly', start: '2027-01-10', end: '2027-07-09', qty: 3 }), S('qt26f', 'Equipment Insurance (Lump Sum)', 1200, 'Lump sum', { qty: 3 })],
      { date: '2026-09-26', validUntil: '2026-10-26', discountPct: 4, contractType: 'Project', billingStructure: 'Milestone', contractStart: '2027-01-10', contractEnd: '2027-07-09', preparedBy: 'Yousef Karim', paymentTerms: '60 days', costCentre: 'Abu Dhabi Branch', description: 'Rent 2 x 1500 KVA and 1000 KVA for the Ruwais 2027 turnaround',
        log: qlog(lg('2026-09-26 16:30', 'Submitted for approval', 'Yousef Karim', 'Value above AED 1,000,000 and customer at 97 percent of the credit limit', 'amber'), lg('2026-09-26 11:00', 'Quotation created', 'Yousef Karim')) }),
    qq('qt27', 'QT-26-00104', 'op29', 'c13', 'Rejected', 'Rental', [R('qt27a', 'Generator', '1000 KVA', 98000, '2026-10-12', '2026-11-11'), S('qt27b', 'Delivery Charge (Low-bed, Heavy Unit)', 2800, 'One-time'), S('qt27c', 'Return Charge (Low-bed, Heavy Unit)', 3200, 'One-time')],
      { date: '2026-09-10', validUntil: '2026-09-24', discountPct: 15, contractType: 'Closed', contractStart: '2026-10-12', contractEnd: '2026-11-11', paymentTerms: 'Immediate', description: 'Rent 1000 KVA for the Burj Park summer events',
        log: qlog(lg('2026-09-12 09:40', 'Rejected', 'Omar Farouk', 'A discount above 10 percent is not allowed and the customer is over its credit limit', 'red'), lg('2026-09-10 15:00', 'Submitted for approval', 'Leena Thomas', undefined, 'amber'), lg('2026-09-10 11:00', 'Quotation created', 'Leena Thomas')) }),
    qq('qt28', 'QT-26-00105', 'op30', 'c25', 'Expired', 'Rental', [R('qt28a', 'Generator', '500 KVA', 52000, '2026-08-01', '2026-10-31', { allocationTag: 'Soft reserve of AST-1032 until the validity date' }), S('qt28b', 'Delivery Charge', 1500, 'One-time')],
      { date: '2026-07-15', validUntil: '2026-08-14', contractType: 'Closed', contractStart: '2026-08-01', contractEnd: '2026-10-31', preparedBy: 'Yousef Karim', costCentre: 'Abu Dhabi Branch', description: 'Rent 500 KVA for the date farm pump station',
        log: qlog(lg('2026-08-15 00:05', 'Quotation expired', 'System', 'Validity date passed without an LPO', 'grey'), lg('2026-07-15 10:00', 'Quotation created', 'Yousef Karim')) }),
    qq('qt29', 'QT-26-00106', 'op31', 'c24', 'Closed', 'Rental', [R('qt29a', 'Generator', '200 KVA', 29500, '2026-02-01', '2026-05-31', { qty: 2 }), S('qt29b', 'Delivery Charge', 1500, 'One-time', { qty: 2 })],
      { date: '2026-01-20', validUntil: '2026-02-19', contractType: 'Closed', contractStart: '2026-02-01', contractEnd: '2026-05-31', preparedBy: 'Yousef Karim', costCentre: 'Abu Dhabi Branch', description: 'Rent 2 x 200 KVA for the Liwa desert camp season',
        log: qlog(lg('2026-02-18 14:10', 'Closed with the lost opportunity', 'Yousef Karim', 'Client chose another supplier', 'grey'), lg('2026-01-20 09:30', 'Quotation created', 'Yousef Karim')) }),
    qq('qt30', 'QT-26-00107', 'op32', 'c20', 'Cancelled', 'Rental', [R('qt30a', 'Generator', '500 KVA', 52000, '2026-09-01', '2026-12-31', { qty: 3 }), S('qt30b', 'Delivery Charge', 1500, 'One-time', { qty: 3 })],
      { date: '2026-08-05', validUntil: '2026-09-04', contractType: 'Closed', contractStart: '2026-09-01', contractEnd: '2026-12-31', costCentre: 'Ajman Branch', description: 'Rent 3 x 500 KVA for Ajman Pearl Tower A commissioning',
        log: qlog(lg('2026-08-26 12:00', 'Cancelled', 'Leena Thomas', 'Client postponed the tower commissioning to 2027', 'red'), lg('2026-08-05 10:00', 'Quotation created', 'Leena Thomas')) }),
    qq('qt31', 'QT-26-00108', 'op33', 'c21', 'Approved', 'Rental', ql(l32, 'qt31'),
      { date: '2026-09-27', validUntil: '2026-10-07', contractType: 'Open PO', contractStart: '2026-10-05', contractEnd: '2026-12-31', transactionType: 'Cash', paymentTerms: 'Immediate', description: 'Rent 100 KVA for villa construction, Al Barsha South',
        log: qlog(lg('2026-09-27 17:30', 'Approved', 'Omar Farouk', 'Cash customer, deposit before delivery', 'green'), lg('2026-09-27 12:00', 'Quotation created', 'Leena Thomas')) }),
  );

  /* ---------------------------------------------------------------- sales orders: Rental placed with clients, returned, replaced, held, overdue */
  const noteWait = (no: number, assetId: string, amount: number, date: string) => ({ assetId, amount, note: `Waiting period lump sum (DO-26-${String(no).padStart(5, '0')})`, date });
  orderSeed.push(
    so({ id: 'so16', number: 'SO-26-00059', date: '2026-07-10', customerId: 'c3', owner: 'Leena Thomas', title: 'Rent 100 KVA and 500 L day tank for the Souk Madinat events season', reference: 'LPO-ANE-2207', status: 'Fully Delivered', activity: 'Rental', contractType: 'Open PO', contractStart: '2026-07-15', contractEnd: '2026-12-31',
      lpo: 'LPO-ANE-2207', lpoDate: '2026-07-09', lpoExpiry: '2026-10-05', site: 'Souk Madinat Jumeirah, Dubai', costCentre: 'Dubai Branch', docs: ['LPO-ANE-2207.pdf'], billingCycle: 'Monthly', invoicingType: 'Manual', paymentTerms: '15 days', contactPerson: 'Maha Saleh', salesperson: 'Leena Thomas',
      lines: withAsg(l16, { so16a: [asg('he20', 'dl15', '2026-07-15', { state: 'Replaced', stop: '2026-08-10' }), asg('he47', 'dl16', '2026-08-10')], so16b: [asg('he80', 'dl17', '2026-08-10')] }),
      log: [lg('2026-09-28 09:00', 'LPO expires on 2026-10-05', 'Bilal Ahmed', 'Renewal reminder sent to the client, the Open PO needs a new LPO to continue', 'amber'), lg('2026-08-10 11:00', 'Replacement RP-26-00005: AST-1020 out, AST-1047 in', 'Bilal Ahmed', 'Upgrade to the low-noise canopy unit. The invoice cycle is not paused by a replacement; price adjustment AED 1500', 'blue'),
        lg('2026-08-10 08:30', 'Delivery DO-26-00134, DO-26-00135: AST-1047, AST-1080 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-07-15 08:00', 'Delivery DO-26-00133: AST-1020 on hire', 'Bilal Ahmed', 'Standby unit from the Mussafah yard', 'green'), lg('2026-07-10 09:30', 'Sales Order created', 'Leena Thomas')] }),
    so({ id: 'so17', number: 'SO-26-00060', date: '2026-07-18', quoteId: 'qt20', oppId: 'op20', customerId: 'c4', owner: 'Leena Thomas', title: 'Rent 200 KVA and 1000 L day tank for the staff accommodation block', reference: 'LPO-DPH-4417', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-07-22', contractEnd: '2027-01-21',
      lpo: 'LPO-DPH-4417', lpoDate: '2026-07-17', lpoExpiry: '2027-01-31', site: 'Desert Pearl Resort, Sharjah', costCentre: 'Sharjah Branch', docs: ['LPO-DPH-4417.pdf', 'QT-26-00097.pdf'], billingCycle: 'Monthly', invoicingType: 'Manual', paymentTerms: '60 days', contactPerson: 'Imran Qureshi',
      lines: withAsg(l17, { so17a: [asg('he55', 'dl18', '2026-07-22')], so17b: [asg('he81', 'dl19', '2026-10-10', { state: 'Hold' })] }),
      log: [lg('2026-09-28 09:20', 'Delivery DO-26-00137: AST-1081 on Hold', 'Bilal Ahmed', 'Rental starts 2026-10-10. Awaiting client permit (Client)', 'amber'), lg('2026-07-22 09:00', 'Delivery DO-26-00136: AST-1055 on hire', 'Bilal Ahmed', 'Exact serialized asset assigned. Billing starts on the Rental Start Date', 'green'), lg('2026-07-18 10:00', 'Sales Order created from QT-26-00097', 'Leena Thomas')] }),
    so({ id: 'so18', number: 'SO-26-00061', date: '2026-03-06', customerId: 'c6', owner: 'Yousef Karim', title: 'Rent 500 KVA and generator trolley for the Kiln 5 refractory works', reference: 'LPO-SCC-2975', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-03-15', contractEnd: '2026-09-15',
      lpo: 'LPO-SCC-2975', lpoDate: '2026-03-05', lpoExpiry: '2026-09-20', site: 'Sharjah Cement, Kiln 5', costCentre: 'Sharjah Branch', docs: ['LPO-SCC-2975.pdf'], billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '45 days', contactPerson: 'Hassan Ali',
      damageCharges: [noteWait(138, 'he60', 800, '2026-03-10')],
      lines: withAsg(l18, { so18a: [asg('he60', 'dl20', '2026-03-15')], so18b: [asg('he78', 'dl21', '2026-03-15')] }),
      log: [lg('2026-09-25 10:00', 'Extension request EX-26-00009 recorded', 'Yousef Karim', 'Client wants to keep the unit until 2026-12-15, new LPO pending', 'amber'), lg('2026-09-21 08:00', 'Overdue on hire: contract ended 2026-09-15, LPO expired 2026-09-20', 'Bilal Ahmed', 'Escalated to the Operations Manager after 5 overdue days', 'red'),
        lg('2026-03-10 08:00', 'Delivery DO-26-00138, DO-26-00139: AST-1060, AST-1078 on Hold', 'Bilal Ahmed', 'Rental starts 2026-03-15. Power room not complete (Client), waiting charge AED 800', 'amber'), lg('2026-03-06 09:00', 'Sales Order created', 'Yousef Karim')] }),
    so({ id: 'so19', number: 'SO-26-00062', date: '2026-07-02', quoteId: 'qt21', oppId: 'op21', customerId: 'c5', owner: 'Omar Farouk', title: 'Rent 500 KVA and 300 mm cable for the Station 7 fit-out', reference: 'LPO-DMW-5702', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-07-05', contractEnd: '2027-01-19',
      lpo: 'LPO-DMW-5702', lpoDate: '2026-07-01', lpoExpiry: '2027-01-19', site: 'Station 7 Fit-out, Al Satwa, Dubai', costCentre: 'SO-26-00062 Station 7 Fit-out (Dubai Metro Works JV)', docs: ['LPO-DMW-5702.pdf', 'QT-26-00098.pdf'], billingCycle: 'Monthly', invoicingType: 'Manual', paymentTerms: '60 days', contactPerson: 'Sergei Petrov',
      damageCharges: [noteWait(140, 'he17', 600, '2026-07-05')],
      lines: withAsg(l19, { so19a: [asg('he17', 'dl22', '2026-07-05', { state: 'Replaced', stop: '2026-07-20' }), asg('he61', 'dl23', '2026-07-20')], so19b: [asg('he74', 'dl24', '2026-08-18')] }),
      log: [lg('2026-09-25 14:00', 'Extension EX-26-00008: end date 2026-10-19 to 2027-01-19', 'Omar Farouk', 'The existing Sales Order is revised, no new order is created', 'green'), lg('2026-08-18 08:30', 'Delivery DO-26-00142: AST-1074 on hire', 'Bilal Ahmed', 'Delivered free of charge with the 500 KVA hire', 'green'),
        lg('2026-07-20 09:30', 'Replacement RP-26-00006: AST-1017 out, AST-1061 in', 'Bilal Ahmed', 'Breakdown: fuel injection pump failed on AST-1017. Cross-hired AST-1061 supplied by the Cross-Hire team', 'blue'), lg('2026-07-05 08:00', 'Delivery DO-26-00140: AST-1017 on hire', 'Bilal Ahmed', 'Waiting charge AED 600, site access permit delayed', 'amber'), lg('2026-07-02 10:00', 'Sales Order created from QT-26-00098', 'Omar Farouk')] }),
    so({ id: 'so20', number: 'SO-26-00063', date: '2026-05-18', customerId: 'c7', owner: 'Yousef Karim', title: 'Rent 1000 KVA for the Mussafah substation shutdown', reference: 'LPO-ASU-1987', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-05-25', contractEnd: '2026-10-03',
      lpo: 'LPO-ASU-1987', lpoDate: '2026-05-16', lpoExpiry: '2026-10-10', site: 'Mussafah Substation, Abu Dhabi', costCentre: 'Abu Dhabi Branch', docs: ['LPO-ASU-1987.pdf'], billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '30 days', contactPerson: 'Nadia Rahman',
      lines: withAsg(l20, { so20a: [asg('he34', 'dl25', '2026-05-25', { state: 'Replaced', stop: '2026-06-15' }), asg('he65', 'dl26', '2026-06-15', { state: 'Returned', stop: '2026-10-03' })] }),
      log: [lg('2026-09-29 15:00', 'Return CN-26-00144: AST-1065 off hire on 2026-10-03', 'Yousef Karim', 'Off-hire booked in advance for the end of the contract, billing stops on the off-hire day', 'amber'), lg('2026-06-15 09:00', 'Replacement RP-26-00007: AST-1034 out, AST-1065 in', 'Bilal Ahmed', 'Customer request: switchgear needs the Cummins alternator. Price adjustment AED 2500, client not yet notified in writing', 'blue'),
        lg('2026-05-25 08:00', 'Delivery DO-26-00143: AST-1034 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-05-18 09:30', 'Sales Order created', 'Yousef Karim')] }),
    so({ id: 'so21', number: 'SO-26-00064', date: '2026-05-22', customerId: 'c8', owner: 'Leena Thomas', title: 'Rent 40 ft power POD for the Marina Tower 3 site office and switch room', reference: 'LPO-PMD-7455', status: 'Fully Delivered', activity: 'Rental', contractType: 'Project', billingStructure: 'Lump Sum', contractStart: '2026-05-30', contractEnd: '2027-05-29',
      lpo: 'LPO-PMD-7455', lpoDate: '2026-05-20', lpoExpiry: '2027-06-30', site: 'Dubai Marina', costCentre: 'SO-26-00064 Marina Tower 3 Site POD (Palm Marina Development)', docs: ['LPO-PMD-7455.pdf'], billingCycle: 'Quarterly', invoicingType: 'Manual', contactPerson: 'Daniel Foster',
      lines: withAsg(l21, { so21a: [asg('he70', 'dl27', '2026-05-30')] }), log: [lg('2026-05-30 09:00', 'Delivery DO-26-00145: AST-1070 on hire', 'Bilal Ahmed', 'Low-bed with crane offloading by the external transporter', 'green'), lg('2026-05-22 10:00', 'Sales Order created', 'Leena Thomas')] }),
    so({ id: 'so22', number: 'SO-26-00065', date: '2026-07-30', customerId: 'c2', owner: 'Yousef Karim', title: 'Rent 2 x 95 mm cable drums for the Yas Island Phase 3 temporary supply', reference: 'LPO-GBC-3511', status: 'Partially Delivered', activity: 'Rental', contractType: 'Open PO', contractStart: '2026-08-03', contractEnd: '2026-12-31',
      lpo: 'LPO-GBC-3511', lpoDate: '2026-07-29', lpoExpiry: '2026-12-31', site: 'Yas Island Phase 3, Abu Dhabi', costCentre: 'Abu Dhabi Branch', billingCycle: 'Monthly', invoicingType: 'Manual', contactPerson: 'Khaled Mansoor',
      lines: withAsg(l22, { so22a: [asg('he72', 'dl28', '2026-08-03')] }), log: [lg('2026-08-05 10:00', 'Delivery DO-26-00146: AST-1072 on hire', 'Bilal Ahmed', 'Rental start back-dated to the handover on 2026-08-03. The second drum is outstanding', 'amber'), lg('2026-07-30 09:00', 'Sales Order created', 'Yousef Karim')] }),
    so({ id: 'so23', number: 'SO-26-00066', date: '2026-08-31', customerId: 'c1', owner: 'Omar Farouk', title: 'Rent 800 A ATS panel for the Terminal B changeover', reference: 'LPO-EIL-2290', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-09-05', contractEnd: '2027-03-04',
      lpo: 'LPO-EIL-2290', lpoDate: '2026-08-30', lpoExpiry: '2027-03-31', site: 'Al Maktoum Airport Expansion', costCentre: 'SO-26-00044 Al Maktoum Airport Expansion', docs: ['LPO-EIL-2290.pdf'], billingCycle: 'Monthly', invoicingType: 'Manual', paymentTerms: '45 days', contactPerson: 'Rashid Al Mansoori',
      lines: withAsg(l23, { so23a: [asg('he75', 'dl29', '2026-09-05')] }), log: [lg('2026-09-05 08:30', 'Delivery DO-26-00147: AST-1075 on hire', 'Bilal Ahmed', 'Free-of-charge delivery, signature pending', 'green'), lg('2026-08-31 11:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so24', number: 'SO-26-00067', date: '2026-03-30', customerId: 'c1', owner: 'Omar Farouk', title: 'Rent 185 mm cable drum for the Terminal 3 temporary feeder', reference: 'LPO-EIL-1744', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-04-03', contractEnd: '2027-04-02',
      lpo: 'LPO-EIL-1744', lpoDate: '2026-03-29', lpoExpiry: '2027-04-30', site: 'Al Maktoum Airport Expansion', costCentre: 'SO-26-00044 Al Maktoum Airport Expansion', billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '45 days', contactPerson: 'Rashid Al Mansoori',
      damageCharges: [{ assetId: 'he73', amount: 900, note: 'Failed collection: site security refused to release the drum, our vehicle waited 3 hours', date: '2026-09-09' }],
      lines: withAsg(l24, { so24a: [asg('he73', 'dl30', '2026-04-03', { state: 'Returned', stop: '2026-09-09' })] }),
      log: [lg('2026-09-09 14:00', 'Collection failed', 'Bilal Ahmed', 'Client charged AED 900. Site security refused to release the drum', 'red'),
        lg('2026-09-09 11:00', 'Return CN-26-00118: AST-1073 off hire', 'Bilal Ahmed', 'Company collection arranged. Billing stopped', 'amber'), lg('2026-04-03 09:00', 'Delivery DO-26-00148: AST-1073 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-03-30 10:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so25', number: 'SO-26-00068', date: '2026-02-25', customerId: 'c4', owner: 'Leena Thomas', title: 'Rent 40 ft POD for the resort kitchen refurbishment', reference: 'LPO-DPH-3688', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-03-04', contractEnd: '2026-09-30',
      lpo: 'LPO-DPH-3688', lpoDate: '2026-02-24', lpoExpiry: '2026-10-31', site: 'Desert Pearl Resort, Sharjah', costCentre: 'Sharjah Branch', billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '60 days', contactPerson: 'Imran Qureshi',
      lines: withAsg(l25, { so25a: [asg('he71', 'dl31', '2026-03-04', { state: 'Returned', stop: '2026-09-18' })] }),
      log: [lg('2026-09-18 16:00', 'Collection failed', 'Bilal Ahmed', 'Booked as company loss. The low-bed truck broke down on the way, collection moved to the next day', 'red'), lg('2026-09-18 09:30', 'Return CN-26-00131: AST-1071 off hire', 'Bilal Ahmed', 'Company collection arranged. Billing stopped', 'amber'),
        lg('2026-03-01 09:00', 'Delivery DO-26-00149: AST-1071 on Hold', 'Bilal Ahmed', 'Rental starts 2026-03-04. Commissioning by our workshop (Company), client not charged', 'amber'), lg('2026-02-25 10:00', 'Sales Order created', 'Leena Thomas')] }),
    so({ id: 'so26', number: 'SO-26-00069', date: '2026-07-28', customerId: 'c19', owner: 'Omar Farouk', title: 'Rent 200 KVA for the Jebel Jais quarry crusher line', reference: 'LPO-RAK-0731', status: 'Closed', activity: 'Rental', contractType: 'Closed', contractStart: '2026-08-05', contractEnd: '2026-09-12',
      lpo: 'LPO-RAK-0731', lpoDate: '2026-07-27', lpoExpiry: '2026-09-30', site: 'Jebel Jais Quarry, Ras Al Khaimah', costCentre: 'Rental Operations', billingCycle: '2 Months', invoicingType: 'Manual', contactPerson: 'Jassim Al Nuaimi',
      lines: withAsg(l26, { so26a: [asg('he35', 'dl32', '2026-08-05', { state: 'Returned', stop: '2026-09-12' })] }),
      log: [lg('2026-09-14 10:00', 'Sales Order closed', 'Omar Farouk', 'All assets returned and inspected', 'grey'), lg('2026-09-12 17:00', 'Return CN-26-00150: AST-1035 off hire', 'Bilal Ahmed', 'Client self-return, inspection passed', 'amber'), lg('2026-08-28 11:00', 'Extension EX-26-00011: end date 2026-09-05 to 2026-09-12', 'Omar Farouk', 'The existing Sales Order is revised, no new order is created', 'green'),
        lg('2026-08-05 08:00', 'Delivery DO-26-00150: AST-1035 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-07-28 09:30', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so27', number: 'SO-26-00070', date: '2026-06-26', customerId: 'c11', owner: 'Leena Thomas', title: 'Rent 500 KVA for the Palm Jumeirah hotel renovation', reference: 'LPO-EHG-6120', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-07-01', contractEnd: '2026-09-30',
      lpo: 'LPO-EHG-6120', lpoDate: '2026-06-25', lpoExpiry: '2026-10-15', site: 'Emirates Palm Hotel, Palm Jumeirah', costCentre: 'Dubai Branch', billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '45 days', contactPerson: 'Layla Haddad',
      lines: withAsg(l27, { so27a: [asg('he32', 'dl33', '2026-07-01', { state: 'Returned', stop: '2026-09-20' })] }),
      log: [lg('2026-09-28 11:00', 'Inspection passed CN-26-00151', 'Sanjay Kumar', 'AST-1032 is Ready for Hire', 'green'), lg('2026-09-25 09:10', 'Return CN-26-00151: AST-1032 off hire back-dated to 2026-09-20', 'Leena Thomas', 'Client switched the unit off on 20 September but could not release it until 27 September. Approved by Hamdan Al Suwaidi', 'amber'),
        lg('2026-07-01 08:00', 'Delivery DO-26-00151: AST-1032 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-06-26 10:00', 'Sales Order created', 'Leena Thomas')] }),
    so({ id: 'so28', number: 'SO-26-00071', date: '2026-03-30', quoteId: 'qt16', oppId: 'op16', customerId: 'c10', owner: 'Omar Farouk', title: 'Rent 1000 KVA for the Silicon Oasis precast yard', reference: 'LPO-AGC-8821', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-04-06', contractEnd: '2026-08-31',
      lpo: 'LPO-AGC-8821', lpoDate: '2026-03-27', lpoExpiry: '2026-09-30', site: 'Dubai Silicon Oasis precast yard', costCentre: 'SO-26-00071 Silicon Oasis Precast Yard (Arabian Gulf Contracting Co LLC)', docs: ['LPO-AGC-8821.pdf', 'QT-26-00093.pdf'], billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '60 days', contactPerson: 'Mathew Joseph',
      damageCharges: [{ assetId: 'he33', amount: 3800, note: 'Radiator guard bent and two fuel cap locks missing', date: '2026-09-04' }],
      lines: withAsg(l28, { so28a: [asg('he33', 'dl34', '2026-04-06', { state: 'Returned', stop: '2026-09-02' })] }),
      log: [lg('2026-09-04 11:00', 'Damage charge AED 3800', 'Sanjay Kumar', 'AST-1033: radiator guard bent and two fuel cap locks missing. Linked permanently to this order', 'red'), lg('2026-09-02 10:00', 'Return CN-26-00152: AST-1033 off hire', 'Omar Farouk', 'Company collection, two days after the contract end', 'amber'),
        lg('2026-04-06 08:00', 'Delivery DO-26-00152: AST-1033 on hire', 'Bilal Ahmed', undefined, 'green'), lg('2026-03-30 10:00', 'Sales Order created from QT-26-00093', 'Omar Farouk')] }),
    so({ id: 'so29', number: 'SO-26-00072', date: '2026-06-14', customerId: 'c14', owner: 'Yousef Karim', title: 'Rent 200 KVA for the Mussafah marine yard workshop', reference: 'LPO-GOM-5033', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-06-18', contractEnd: '2026-08-31',
      lpo: 'LPO-GOM-5033', lpoDate: '2026-06-13', lpoExpiry: '2026-09-30', site: 'Gulf Offshore marine yard, Mussafah', costCentre: 'Abu Dhabi Branch', billingCycle: 'Quarterly', invoicingType: 'Manual', paymentTerms: '60 days', contactPerson: 'Captain Ian McBride',
      lines: withAsg(l29, { so29a: [asg('he57', 'dl35', '2026-06-18', { state: 'Returned', stop: '2026-09-01' })] }),
      log: [lg('2026-09-02 14:00', 'Damage covered by damage waiver', 'Sanjay Kumar', 'AST-1057: salt water ingress in the control panel and corroded terminals. Damage invoice blocked because a waiver was paid', 'red'), lg('2026-09-01 11:00', 'Return CN-26-00153: AST-1057 off hire', 'Yousef Karim', 'Company collection', 'amber'),
        lg('2026-06-18 08:00', 'Delivery DO-26-00153: AST-1057 on hire', 'Bilal Ahmed', 'Allocation differs from the request: requested Generator 200 KVA, delivered Generator 500 KVA', 'amber'), lg('2026-06-14 09:00', 'Sales Order created', 'Yousef Karim')] }),

    /* not yet delivered: Pending (over credit limit), Confirmed (near credit limit), Draft (cash individual), Cancelled, Rejected */
    so({ id: 'so30', number: 'SO-26-00073', date: '2026-09-28', customerId: 'c13', owner: 'Leena Thomas', title: 'Rent 2 x 500 KVA for the New Year fireworks show', reference: 'LPO-BEE-0928', status: 'Pending', activity: 'Rental', contractType: 'Closed', contractStart: '2026-12-28', contractEnd: '2027-01-04',
      lpo: 'LPO-BEE-0928', lpoDate: '2026-09-28', lpoExpiry: '2027-01-10', site: 'Burj Park, Downtown Dubai', costCentre: 'Dubai Branch', paymentTerms: 'Immediate', billingCycle: 'Weekly', invoicingType: 'Automatic', contactPerson: 'Nina Kapoor', lines: withAsg(l30, {}),
      log: [lg('2026-09-28 16:00', 'Held for Finance approval', 'Priya Menon', 'Customer is AED 28,200 over its credit limit. Release only against a 50 percent advance', 'red'), lg('2026-09-28 10:30', 'Sales Order created', 'Leena Thomas')] }),
    so({ id: 'so31', number: 'SO-26-00074', date: '2026-09-24', customerId: 'c17', owner: 'Yousef Karim', title: 'Rent 1500 KVA and 2 x 1000 KVA for the Ruwais shutdown turnaround', reference: 'LPO-RPS-2611', status: 'Confirmed', activity: 'Rental', contractType: 'Project', billingStructure: 'Milestone', contractStart: '2026-11-02', contractEnd: '2027-02-28',
      lpo: 'LPO-RPS-2611', lpoDate: '2026-09-23', lpoExpiry: '2027-03-31', site: 'Ruwais Industrial Complex, Al Dhafra', costCentre: 'SO-26-00074 Ruwais Shutdown Turnaround (Ruwais Petrochemical Services)', docs: ['LPO-RPS-2611.pdf'], paymentTerms: '60 days', billingCycle: 'Monthly', invoicingType: 'Manual', contactPerson: 'Ahmad Al Hosani', lines: withAsg(l31, {}),
      log: [lg('2026-09-25 09:00', 'Credit check', 'Priya Menon', 'Customer is at 97 percent of its credit limit (AED 3,412,000 of 3,500,000). Approved by the General Manager against a bank guarantee', 'amber'), lg('2026-09-24 11:00', 'Sales Order created', 'Yousef Karim')] }),
    so({ id: 'so32', number: 'SO-26-00075', date: '2026-09-29', quoteId: 'qt31', oppId: 'op33', customerId: 'c21', owner: 'Leena Thomas', title: 'Rent 100 KVA for villa construction, Al Barsha South', reference: 'Cash deposit', status: 'Draft', activity: 'Rental', contractType: 'Open PO', contractStart: '2026-10-05', contractEnd: '2026-12-31',
      lpo: '', lpoDate: '', lpoExpiry: '', site: 'Villa 14, Al Barsha South 3, Dubai', costCentre: 'Dubai Branch', paymentTerms: 'Immediate', transactionType: 'Cash', billingCycle: 'Monthly', invoicingType: 'Manual', contactPerson: 'Rashid Al Falasi', lines: withAsg(l32, {}),
      log: [lg('2026-09-29 15:00', 'Draft saved', 'Leena Thomas', 'Individual cash customer: deposit and ID copy to be received before the order is confirmed'), lg('2026-09-29 14:30', 'Sales Order created from QT-26-00108', 'Leena Thomas')] }),
    so({ id: 'so33', number: 'SO-26-00076', date: '2026-08-14', customerId: 'c15', owner: 'Omar Farouk', title: 'Rent 500 KVA for the dry dock pump house', reference: 'LPO-HMW-2208', status: 'Cancelled', activity: 'Rental', contractType: 'Closed', contractStart: '2026-09-01', contractEnd: '2026-12-31',
      lpo: 'LPO-HMW-2208', lpoDate: '2026-08-13', lpoExpiry: '2026-12-31', site: 'Hamriyah Free Zone, Sharjah', costCentre: 'Sharjah Branch', billingCycle: 'Monthly', invoicingType: 'Manual', contactPerson: 'Omar Bin Dhaen', lines: withAsg(l33, {}),
      log: [lg('2026-08-27 12:00', 'Sales Order cancelled', 'Omar Farouk', 'The client postponed the dry dock refit to 2027. LPO returned', 'red'), lg('2026-08-14 10:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so34', number: 'SO-26-00077', date: '2026-09-17', customerId: 'c20', owner: 'Leena Thomas', title: 'Rent 3 x 200 KVA for the Tower B podium MEP testing', reference: 'LPO-APT-0917', status: 'Rejected', activity: 'Rental', contractType: 'Closed', contractStart: '2026-10-01', contractEnd: '2026-12-31',
      lpo: 'LPO-APT-0917', lpoDate: '2026-09-17', lpoExpiry: '2026-12-31', site: 'Ajman Pearl Tower B, Ajman', costCentre: 'Ajman Branch', paymentTerms: '45 days', billingCycle: 'Monthly', invoicingType: 'Manual', contactPerson: 'Reem Al Shamsi', lines: withAsg(l34, {}),
      log: [lg('2026-09-19 10:15', 'Sales Order rejected', 'Nasser Al Ketbi', 'Two invoices are more than 90 days overdue. Resubmit with a security cheque', 'red'), lg('2026-09-17 15:00', 'Sales Order created', 'Leena Thomas')] }),

    /* Trading, Fuel Trading, Fixed Asset Trading, service only and export (delivered lines carry the delivery number, invoicing is added later) */
    so({ id: 'so35', number: 'SO-26-00078', date: '2026-09-08', quoteId: 'qt22', oppId: 'op22', customerId: 'c12', owner: 'Yousef Karim', title: 'Supply of ATS panels, a distribution panel and filters for the Mirfa water plant', reference: 'LPO-ADU-7714', status: 'Partially Delivered', activity: 'Trading', discountPct: 3, paymentTerms: '45 days',
      lpo: 'LPO-ADU-7714', lpoDate: '2026-09-07', lpoExpiry: '2026-12-31', site: 'Mirfa Water Plant, Al Dhafra', costCentre: 'Abu Dhabi Branch', docs: ['LPO-ADU-7714.pdf'], contactPerson: 'Saeed Al Mheiri', terms: 'Payment as per the payment terms from invoice date. Goods stay the property of Gulf Power Rentals LLC until paid in full.',
      lines: withAsg(l35, {}, { so35a: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00154' }, so35c: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00154' } }),
      log: [lg('2026-09-30 08:00', 'Delivery DO-26-00155 dispatched: Distribution Panel 630A', 'Bilal Ahmed', 'Second lot after the panel arrived from the supplier', 'blue'), lg('2026-09-15 10:00', 'Delivery DO-26-00154: 2 item(s)', 'Bilal Ahmed', 'Stock delivered', 'green'), lg('2026-09-08 10:00', 'Sales Order created from QT-26-00099', 'Yousef Karim')] }),
    so({ id: 'so36', number: 'SO-26-00079', date: '2026-08-12', customerId: 'c25', owner: 'Yousef Karim', title: 'Supply of power cable and lugs for the date farm irrigation pumps', reference: 'LPO-AAF-0812', status: 'Fully Delivered', activity: 'Trading',
      lpo: 'LPO-AAF-0812', lpoDate: '2026-08-11', lpoExpiry: '2026-12-31', site: 'Al Ain Farms, Remah', costCentre: 'Abu Dhabi Branch', contactPerson: 'Hamad Al Kaabi', terms: 'Payment as per the payment terms from invoice date. Goods stay the property of Gulf Power Rentals LLC until paid in full.',
      lines: withAsg(l36, {}, { so36a: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00156' }, so36b: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00156' }, so36c: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00156' } }),
      log: [lg('2026-08-20 11:00', 'Delivery DO-26-00156: 3 item(s)', 'Bilal Ahmed', 'Stock delivered. Fire extinguishers free of charge', 'green'), lg('2026-08-12 09:30', 'Sales Order created', 'Yousef Karim')] }),
    so({ id: 'so37', number: 'SO-26-00080', date: '2026-09-27', customerId: 'c26', owner: 'Omar Farouk', title: 'Supply of 25,000 litres of diesel for the Julfar yard generators', reference: 'LPO-JOL-2709', status: 'Confirmed', activity: 'Fuel Trading', paymentTerms: '45 days',
      lpo: 'LPO-JOL-2709', lpoDate: '2026-09-26', lpoExpiry: '2026-12-31', site: 'Julfar Oilfield Logistics yard, Ras Al Khaimah', costCentre: 'Fuel Trading', contactPerson: 'Faisal Al Qasimi', location: 'Gulf Petroleum Sharjah Depot (Fuel Stock)', terms: 'Fuel is billed at the delivered quantity and the rate of the day of delivery, payment as per the payment terms.',
      lines: withAsg(l37, {}), log: [lg('2026-09-30 13:00', 'Delivery DO-26-00160 picked', 'Bilal Ahmed', 'Tanker loading at the Gulf Petroleum Sharjah depot, supplier-held stock', 'blue'), lg('2026-09-27 10:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so38', number: 'SO-26-00081', date: '2026-08-20', customerId: 'c3', owner: 'Omar Farouk', title: 'Sale of one ex-fleet 200 KVA generator to Al Noor Events', reference: 'LPO-ANE-2312', status: 'Fully Delivered', activity: 'Fixed Asset Trading', paymentTerms: 'Immediate',
      lpo: 'LPO-ANE-2312', lpoDate: '2026-08-19', lpoExpiry: '2026-12-31', site: 'Al Noor Events workshop, Al Quoz, Dubai', costCentre: 'Dubai Branch', contactPerson: 'Maha Saleh', terms: 'Sold as is, no warranty. Title passes on full payment.',
      lines: withAsg(l38, { so38a: [asg('he82', 'dl39', '2026-09-02', { state: 'Sold' })] }),
      log: [lg('2026-09-02 12:00', 'Delivery DO-26-00157: AST-1082 sold', 'Bilal Ahmed', 'The asset leaves the active fleet', 'green'), lg('2026-08-20 11:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so39', number: 'SO-26-00082', date: '2026-09-22', customerId: 'c27', owner: 'Omar Farouk', title: 'Sale of one ex-fleet 1000 KVA generator to Mubarak Heavy Civil Works', reference: 'LPO-MHC-4108', status: 'Confirmed', activity: 'Fixed Asset Trading', paymentTerms: '60 days',
      lpo: 'LPO-MHC-4108', lpoDate: '2026-09-21', lpoExpiry: '2026-12-31', site: 'Mubarak Heavy Civil Works yard, Mussafah', costCentre: 'Abu Dhabi Branch', contactPerson: 'George Thomas', terms: 'Sold as is after client inspection. Title passes on full payment.',
      lines: withAsg(l39, {}), log: [lg('2026-09-26 10:00', 'Client inspection booked for 2 October', 'Omar Farouk', 'Unit to be chosen from the Ready for Hire 1000 KVA stock'), lg('2026-09-22 15:00', 'Sales Order created', 'Omar Farouk')] }),
    so({ id: 'so40', number: 'SO-26-00083', date: '2026-09-18', customerId: 'c16', owner: 'Leena Thomas', title: 'Commissioning and cable laying for the client-owned generator in hall 2', reference: 'LPO-AWD-3350', status: 'Confirmed', activity: 'Other', paymentTerms: '90 days',
      lpo: 'LPO-AWD-3350', lpoDate: '2026-09-17', lpoExpiry: '2026-12-31', site: 'Al Wasl Data Centre DC2, Dubai Silicon Oasis', costCentre: 'Dubai Branch', contactPerson: 'Prakash Iyer', terms: 'Service order, payment as per the payment terms after the signed completion report.',
      lines: withAsg(l40, {}), log: [lg('2026-09-18 11:00', 'Sales Order created', 'Leena Thomas', 'Service only, no equipment supplied')] }),
    so({ id: 'so41', number: 'SO-26-00084', date: '2026-07-28', quoteId: 'qt18', oppId: 'op18', customerId: 'c18', owner: 'Yousef Karim', title: 'Bi-annual service of the hospital standby generator', reference: 'LPO-AAS-0728', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2026-08-01', amcEnd: '2027-07-31', visits: 2, amcValue: 9500, amcScope: S41,
      lpo: 'LPO-AAS-0728', lpoDate: '2026-07-27', lpoExpiry: '2027-07-31', site: 'Al Ain Specialist Hospital, Al Ain', costCentre: 'AMC Services', lines: withAsg(l41, {}), visitPlan: planVisits('2026-08-01', '2027-07-31', 2, 9500),
      log: [lg('2026-07-28 11:00', 'Sales Order created from QT-26-00095', 'Yousef Karim')] }),
    so({ id: 'so42', number: 'SO-26-00085', date: '2026-02-24', quoteId: 'qt19', oppId: 'op19', customerId: 'c11', owner: 'Leena Thomas', title: 'Quarterly service of the hotel standby generators', reference: 'LPO-EHG-0224', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2026-03-01', amcEnd: '2027-02-28', visits: 4, amcValue: 26000, amcScope: S42, paymentTerms: '45 days',
      lpo: 'LPO-EHG-0224', lpoDate: '2026-02-23', lpoExpiry: '2027-02-28', site: 'Emirates Palm Hotel, Palm Jumeirah', costCentre: 'AMC Services', lines: withAsg(l42, {}), visitPlan: planVisits('2026-03-01', '2027-02-28', 4, 26000),
      log: [lg('2026-09-20 09:00', 'Two scheduled visits are overdue', 'Leena Thomas', 'No job card has been created for visits 1 and 2', 'amber'), lg('2026-02-24 10:30', 'Sales Order created from QT-26-00096', 'Leena Thomas')] }),
    so({ id: 'so43', number: 'SO-26-00086', date: '2026-05-26', quoteId: 'qt17', oppId: 'op17', customerId: 'c16', owner: 'Omar Farouk', title: 'Annual maintenance with monthly service visits for the DC1 generator plant', reference: 'LPO-AWD-0526', status: 'Confirmed', activity: 'AMC', contractType: 'Closed', amcStart: '2026-06-01', amcEnd: '2027-05-31', visits: 12, amcValue: 96000, amcScope: S43, paymentTerms: '90 days',
      lpo: 'LPO-AWD-0526', lpoDate: '2026-05-25', lpoExpiry: '2027-05-31', site: 'Al Wasl Data Centre DC1, Dubai Silicon Oasis', costCentre: 'AMC Services', docs: ['LPO-AWD-0526.pdf'], lines: withAsg(l43, {}), visitPlan: planVisits('2026-06-01', '2027-05-31', 12, 96000),
      log: [lg('2026-05-26 10:00', 'Sales Order created from QT-26-00094', 'Omar Farouk')] }),
    so({ id: 'so44', number: 'SO-26-00087', date: '2026-09-10', quoteId: 'qt23', oppId: 'op23', customerId: 'c26', owner: 'Omar Farouk', title: 'Export of cable and filters to the Dammam yard', reference: 'LPO-JOL-0910', status: 'Partially Delivered', activity: 'Trading', currency: 'SAR', exchangeRate: 0.9792, vatType: VAT_TYPES[1], incoterm: 'DAP', paymentTerms: '30 days',
      lpo: 'LPO-JOL-0910', lpoDate: '2026-09-09', lpoExpiry: '2026-12-31', site: 'Julfar Dammam yard, Saudi Arabia', costCentre: 'Dubai Branch', contactPerson: 'Faisal Al Qasimi', placeOfSupply: 'Dammam, Saudi Arabia', shippingAddress: 'Julfar Dammam yard, 2nd Industrial City, Dammam, Saudi Arabia', billingAddress: 'Julfar Oilfield Logistics, Al Nakheel, Ras Al Khaimah, UAE',
      terms: 'Export supply, zero-rated. Delivery DAP Dammam. Payment in SAR as per the payment terms from the shipping date.',
      lines: withAsg(l44, {}, { so44a: { fulfilment: 'Delivered', fulfilmentRef: 'DO-26-00158' } }),
      log: [lg('2026-09-30 10:00', 'Delivery DO-26-00159 packed: filters', 'Bilal Ahmed', 'Waiting for the export declaration', 'blue'), lg('2026-09-15 09:00', 'Delivery DO-26-00158: 1 item(s)', 'Bilal Ahmed', 'Cable shipped by road to Dammam', 'green'), lg('2026-09-10 10:00', 'Sales Order created from QT-26-00100', 'Omar Farouk', 'Export, zero-rated, priced in SAR')] }),
  );

  /* ---------------------------------------------------------------- deliveries (own fleet and external, Hold, waiting charge, FOC, back-dated start, substituted subcategory, every status) */
  const V_DXB_LB = { vehicle: 'he21', vehicleNumber: 'Dubai P 48213', driver: 'Tariq Hussain', mobile: '+971 50 311 4090' };
  const V_SHJ = { vehicle: 'he22', vehicleNumber: 'Sharjah 3 22871', driver: 'Hassan Mahmood', mobile: '+971 56 390 2548' };
  const V_DXB2 = { vehicle: 'he43', vehicleNumber: 'Dubai M 77042', driver: 'Vijay Reddy', mobile: '+971 52 846 3017' };
  const V_AUH = { vehicle: 'he42', vehicleNumber: 'Abu Dhabi 12 45118', driver: 'Jomon Varghese', mobile: '+971 50 774 1295' };
  const D = (id: string, no: number, soId: string, lineId: string, assets: string[], date: string, over: Partial<Delivery> = {}): Delivery => {
    const s = sx(soId);
    return dl(id, `DO-26-${String(no).padStart(5, '0')}`, s, lineId, assets[0] ?? '', date, {
      assetIds: assets, items: [{ lineId, qty: Math.max(assets.length, 1), assetIds: assets }], poNumber: s.lpo, poDate: s.lpoDate, project: s.costCentre, reference: s.reference, operationType: 'Delivery', location: 'Jebel Ali Main Yard', department: 'Operations', salesperson: s.owner, ...over,
    });
  };
  const dItem = (lineId: string, qty: number): DoItem => ({ lineId, qty, assetIds: [] });
  deliverySeed.push(
    D('dl15', 133, 'so16', 'so16a', ['he20'], '2026-07-15', { ...V_DXB2, location: 'Abu Dhabi Mussafah Yard', narration: 'Standby 100 KVA unit supplied while the new low-noise unit was being prepared' }),
    D('dl16', 134, 'so16', 'so16a', ['he47'], '2026-08-10', { ...V_DXB_LB, narration: 'Replacement unit under RP-26-00005', serviceLineIds: ['so16c'], accessories: ['Fuel transfer hose 5 m', 'Earthing rod'], conditionFiles: ['delivery-condition-AST-1047.jpg'] }),
    D('dl17', 135, 'so16', 'so16b', ['he80'], '2026-08-10', { ...V_DXB_LB, narration: 'Day tank delivered on the same trip as the replacement unit' }),
    D('dl18', 136, 'so17', 'so17a', ['he55'], '2026-07-22', { transport: 'External Transporter', extCost: 1300, transportedBy: 'Sharjah Low-bed Carriers', driver: 'Ghulam Abbas', mobile: '+971 56 773 6029', serviceLineIds: ['so17c', 'so17d'], location: 'Jebel Ali Main Yard' }),
    D('dl19', 137, 'so17', 'so17b', ['he81'], '2026-09-28', { ...V_SHJ, status: 'Delivered', rentalStart: '2026-10-10', startReason: 'Awaiting client permit', startBy: 'Client', siteReady: false, narration: 'Tank offloaded at the site gate, the fuel farm permit from the client is pending', conditionFiles: ['delivery-condition-AST-1081.jpg'] }),
    D('dl20', 138, 'so18', 'so18a', ['he60'], '2026-03-10', { ...V_DXB_LB, rentalStart: '2026-03-15', startReason: 'Power room not complete', startBy: 'Client', siteReady: false, waitingCharge: 800, serviceLineIds: ['so18c', 'so18d'], narration: 'Delivered ahead of the client power room, billing starts on 15 March' }),
    D('dl21', 139, 'so18', 'so18b', ['he78'], '2026-03-10', { transport: 'External Transporter', extCost: 650, transportedBy: 'Sharjah Low-bed Carriers', driver: 'Ghulam Abbas', mobile: '+971 56 773 6029', rentalStart: '2026-03-15', startReason: 'Power room not complete', startBy: 'Client', siteReady: false }),
    D('dl22', 140, 'so19', 'so19a', ['he17'], '2026-07-05', { ...V_DXB_LB, waitingCharge: 600, startReason: 'Awaiting client permit', startBy: 'Client', serviceLineIds: ['so19c'], narration: 'Site access permit delayed, the driver waited 4 hours at the gate' }),
    D('dl23', 141, 'so19', 'so19a', ['he61'], '2026-07-20', { transport: 'External Transporter', extCost: 1500, transportedBy: 'Jebel Ali Heavy Haulage LLC', driver: 'Gurpreet Singh', mobile: '+971 50 255 7096', narration: 'Cross-hired unit received from the supplier, replacement under RP-26-00006' }),
    D('dl24', 142, 'so19', 'so19b', ['he74'], '2026-08-18', { ...V_DXB2, foc: true, serviceLineIds: ['so19d'], narration: 'Cable drum delivered free of charge with the 500 KVA hire' }),
    D('dl25', 143, 'so20', 'so20a', ['he34'], '2026-05-25', { transport: 'External Transporter', extCost: 2800, transportedBy: 'Sharjah Low-bed Carriers', driver: 'Ghulam Abbas', mobile: '+971 56 773 6029', location: 'Sharjah Yard', serviceLineIds: ['so20b'] }),
    D('dl26', 144, 'so20', 'so20a', ['he65'], '2026-06-15', { ...V_DXB_LB, closed: true, narration: 'Replacement unit under RP-26-00007' }),
    D('dl27', 145, 'so21', 'so21a', ['he70'], '2026-05-30', { transport: 'External Transporter', extCost: 2600, transportedBy: 'Jebel Ali Heavy Haulage LLC', driver: 'Gurpreet Singh', mobile: '+971 50 255 7096', serviceLineIds: ['so21b', 'so21c'] }),
    D('dl28', 146, 'so22', 'so22a', ['he72'], '2026-08-05', { ...V_AUH, type: 'Partial', rentalStart: '2026-08-03', narration: 'Rental start back-dated to the actual handover on 3 August (signed site receipt), the delivery order was raised late' }),
    D('dl29', 147, 'so23', 'so23a', ['he75'], '2026-09-05', { ...V_DXB2, foc: true, status: 'Delivered', serviceLineIds: ['so23b', 'so23c'], narration: 'Free-of-charge delivery, client signature to follow' }),
    D('dl30', 148, 'so24', 'so24a', ['he73'], '2026-04-03', { ...V_AUH, closed: true }),
    D('dl31', 149, 'so25', 'so25a', ['he71'], '2026-03-01', { transport: 'External Transporter', extCost: 2400, transportedBy: 'Al Safeer Heavy Transport', driver: 'Ali Reza', mobile: '+971 56 902 1188', rentalStart: '2026-03-04', startReason: 'Other', startBy: 'Company', siteReady: false, closed: true,
      narration: 'Delivered on 1 March, commissioning completed by our workshop on 4 March. The client is not charged for the delay', serviceLineIds: ['so25b'] }),
    D('dl32', 150, 'so26', 'so26a', ['he35'], '2026-08-05', { ...V_SHJ, closed: true, location: 'Abu Dhabi Mussafah Yard' }),
    D('dl33', 151, 'so27', 'so27a', ['he32'], '2026-07-01', { ...V_DXB_LB, closed: true }),
    D('dl34', 152, 'so28', 'so28a', ['he33'], '2026-04-06', { transport: 'External Transporter', extCost: 2800, transportedBy: 'Jebel Ali Heavy Haulage LLC', driver: 'Gurpreet Singh', mobile: '+971 50 255 7096', closed: true, serviceLineIds: ['so28b', 'so28d'] }),
    D('dl35', 153, 'so29', 'so29a', ['he57'], '2026-06-18', { ...V_AUH, closed: true, requestedSub: '200 KVA', deliveredSub: '500 KVA', items: [{ lineId: 'so29a', qty: 1, assetIds: ['he57'], deliveredSub: '500 KVA' }], narration: 'A 500 KVA unit was delivered because no 200 KVA unit was free. Client documents keep the requested 200 KVA' }),
    D('dl36', 154, 'so35', 'so35a', [], '2026-09-15', { ...V_AUH, type: 'Partial', items: [dItem('so35a', 2), dItem('so35c', 100)], narration: 'First lot: ATS panels and oil filters' }),
    D('dl37', 155, 'so35', 'so35b', [], '2026-09-30', { ...V_AUH, type: 'Partial', status: 'Dispatched', signature: '', items: [dItem('so35b', 1)], narration: 'Second lot: distribution panel, on the road to Mirfa' }),
    D('dl38', 156, 'so36', 'so36a', [], '2026-08-20', { ...V_AUH, closed: true, items: [dItem('so36a', 300), dItem('so36b', 24), dItem('so36c', 4)], narration: 'Complete order, extinguishers free of charge' }),
    D('dl39', 157, 'so38', 'so38a', ['he82'], '2026-09-02', { ...V_DXB_LB, closed: true, narration: 'Sold as is, handed over with the registration papers and the service history' }),
    D('dl40', 158, 'so44', 'so44a', [], '2026-09-15', { transport: 'External Transporter', extCost: 1800, transportedBy: 'Al Safeer Heavy Transport', driver: 'Ali Reza', mobile: '+971 56 902 1188', type: 'Partial', items: [dItem('so44a', 200)], narration: 'Cable shipped by road to Dammam, DAP' }),
    D('dl41', 159, 'so44', 'so44b', [], '2026-09-30', { transport: 'External Transporter', extCost: 900, transportedBy: 'Al Safeer Heavy Transport', type: 'Partial', status: 'Packed', signature: '', items: [dItem('so44b', 50), dItem('so44c', 80)], narration: 'Filters packed, waiting for the export declaration' }),
    D('dl42', 160, 'so37', 'so37a', [], '2026-09-30', { transport: 'External Transporter', extCost: 450, transportedBy: 'Gulf Petroleum Distribution LLC', status: 'Picked', signature: '', location: 'Gulf Petroleum Sharjah Depot (Fuel Stock)', items: [dItem('so37a', 25000)], narration: 'Tanker loading at the supplier-held depot' }),
  );

  /* ---------------------------------------------------------------- returns */
  const withLog = (r: ReturnEntry, ...more: LogItem[]): ReturnEntry => ({ ...r, log: [...r.log, ...more] });
  returnSeed.push(
    withLog(rt('rt5', 'CN-26-00131', sx('so25'), 'so25a', 'dl31', 'he71', 'Company Collection', '2026-09-18T09:30', { stage: 2, fuelNote: 'Tank empty', collection: { by: 'Company', amount: 0, note: 'Low-bed truck broke down on the Sharjah bypass, collection moved to the next day. Delay caused by us, the client is not charged' } }),
      lg('2026-09-18 16:00', 'Collection failed', 'Bilal Ahmed', 'Company loss: Low-bed truck broke down on the Sharjah bypass, collection moved to the next day. Delay caused by us, the client is not charged', 'red')),
    withLog(rt('rt6', 'CN-26-00118', sx('so24'), 'so24a', 'dl30', 'he73', 'Company Collection', '2026-09-09T11:00', { stage: 2, fuelNote: 'Not applicable', collection: { by: 'Client', amount: 900, note: 'Site security refused to release the drum, our vehicle waited 3 hours' } }),
      lg('2026-09-09 14:30', 'Collection failed', 'Bilal Ahmed', 'Charged to client AED 900: Site security refused to release the drum, our vehicle waited 3 hours', 'red')),
    rt('rt7', 'CN-26-00144', sx('so20'), 'so20a', 'dl26', 'he65', 'Company Collection', '2026-10-03T09:00', { stage: 2, fuelNote: 'To be recorded at pickup', siteChecklist: [], photos: [],
      log: [lg('2026-09-29 15:00', 'Return entry raised', 'Yousef Karim', 'Off-hire booked in advance for 2026-10-03 09:00, the end of the contract. Billing stops on that day', 'amber'), lg('2026-09-29 15:10', 'Collection arranged', 'Bilal Ahmed', 'Low-bed to be booked for 3 October')] }),
    rt('rt8', 'CN-26-00150', sx('so26'), 'so26a', 'dl32', 'he35', 'Self-Return', '2026-09-12T15:00', { stage: 5, fuelNote: 'Tank at about half', reachedYard: '2026-09-12 16:30', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Passed', outcome: 'Ready for Hire',
      log: [lg('2026-09-12 15:00', 'Return entry raised', 'Bilal Ahmed', 'Off-Hire. Billing stopped', 'amber'), lg('2026-09-12 15:05', 'Client self-return', 'Bilal Ahmed'), lg('2026-09-12 16:30', 'Asset reached the yard', 'Sanjay Kumar', 'Abu Dhabi Mussafah Yard'), lg('2026-09-13 09:00', 'Inspection passed', 'Sanjay Kumar', 'Operations Return Checklist complete. Asset is Ready for Hire', 'green')] }),
    rt('rt9', 'CN-26-00151', sx('so27'), 'so27a', 'dl33', 'he32', 'Company Collection', '2026-09-20T17:00', { stage: 5, fuelNote: 'Tank at about three quarters', reachedYard: '2026-09-27 14:00', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Passed', outcome: 'Ready for Hire',
      log: [lg('2026-09-25 09:10', 'Return entry raised', 'Leena Thomas', 'Off-Hire back-dated to 2026-09-20 17:00 at the client request: the unit was switched off from that day. Approved by Hamdan Al Suwaidi. Billing stopped on 2026-09-20', 'amber'), lg('2026-09-25 09:20', 'Collection arranged', 'Bilal Ahmed'),
        lg('2026-09-27 14:00', 'Asset reached the yard', 'Sanjay Kumar', 'Jebel Ali Main Yard'), lg('2026-09-28 10:00', 'Inspection passed', 'Sanjay Kumar', 'Operations Return Checklist complete. Asset is Ready for Hire', 'green')] }),
    rt('rt10', 'CN-26-00152', sx('so28'), 'so28a', 'dl34', 'he33', 'Company Collection', '2026-09-02T10:00', { stage: 5, fuelNote: 'Tank at about one third', reachedYard: '2026-09-03 09:30', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 3800, damageNote: 'Radiator guard bent and two fuel cap locks missing', waiverApplied: false, outcome: 'Repaired and back to Ready for Hire',
      log: [lg('2026-09-02 10:00', 'Return entry raised', 'Omar Farouk', 'Off-Hire. Billing stopped', 'amber'), lg('2026-09-02 10:10', 'Collection arranged', 'Bilal Ahmed'), lg('2026-09-03 09:30', 'Asset reached the yard', 'Sanjay Kumar', 'Jebel Ali Main Yard'),
        lg('2026-09-04 11:00', 'Damage found', 'Sanjay Kumar', 'Charge AED 3800: Radiator guard bent and two fuel cap locks missing', 'red'), lg('2026-09-18 15:00', 'Repair completed', 'Sanjay Kumar', 'Workshop repair done, asset is Ready for Hire again', 'green')] }),
    rt('rt11', 'CN-26-00153', sx('so29'), 'so29a', 'dl35', 'he57', 'Company Collection', '2026-09-01T11:00', { stage: 5, fuelNote: 'Tank at about one quarter', reachedYard: '2026-09-02 10:00', yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Damage Found', damageCharge: 0, damageNote: 'Salt water ingress in the control panel and corroded terminals', waiverApplied: true, outcome: 'Repaired and back to Ready for Hire',
      log: [lg('2026-09-01 11:00', 'Return entry raised', 'Yousef Karim', 'Off-Hire. Billing stopped', 'amber'), lg('2026-09-01 11:10', 'Collection arranged', 'Bilal Ahmed'), lg('2026-09-02 10:00', 'Asset reached the yard', 'Sanjay Kumar', 'Jebel Ali Main Yard'),
        lg('2026-09-02 14:00', 'Damage found', 'Sanjay Kumar', 'Covered by the damage waiver paid on SO-26-00072: no damage invoice to the client, repair cost borne by the company. Salt water ingress in the control panel and corroded terminals', 'red'), lg('2026-09-16 15:00', 'Repair completed', 'Sanjay Kumar', 'Panel replaced, asset is Ready for Hire again', 'green')] }),
  );

  /* ---------------------------------------------------------------- replacements and extensions */
  replacementSeed.push(
    { id: 'rp2', number: 'RP-26-00005', soId: 'so16', lineId: 'so16a', oldAssetId: 'he20', newAssetId: 'he47', reason: 'Upgrade', priceAdjust: 1500, notified: true, date: '2026-08-10', by: 'Bilal Ahmed' },
    { id: 'rp3', number: 'RP-26-00006', soId: 'so19', lineId: 'so19a', oldAssetId: 'he17', newAssetId: 'he61', reason: 'Breakdown', priceAdjust: 0, notified: true, date: '2026-07-20', by: 'Bilal Ahmed' },
    { id: 'rp4', number: 'RP-26-00007', soId: 'so20', lineId: 'so20a', oldAssetId: 'he34', newAssetId: 'he65', reason: 'Customer request', priceAdjust: 2500, notified: false, date: '2026-06-15', by: 'Bilal Ahmed' },
  );
  extensionSeed.push(
    { id: 'ex2', number: 'EX-26-00008', soId: 'so19', lineId: 'so19a', kind: 'Extension', oldEnd: '2026-10-19', newEnd: '2027-01-19', date: '2026-09-25', note: 'Client extended the hire by three months because the Station 7 fit-out is delayed', status: 'Applied', clientConfirmedBy: 'Sergei Petrov' },
    { id: 'ex3', number: 'EX-26-00009', soId: 'so18', lineId: 'so18a', kind: 'Extension', oldEnd: '2026-09-15', newEnd: '2026-12-15', date: '2026-09-25', note: 'Client wants the 500 KVA and the trolley until mid December, the new LPO is not received yet', status: 'Pending Client LPO', clientConfirmedBy: 'Hassan Ali' },
    { id: 'ex5', number: 'EX-26-00011', soId: 'so26', lineId: 'so26a', kind: 'Extension', oldEnd: '2026-09-05', newEnd: '2026-09-12', date: '2026-08-28', note: 'Crusher line commissioning took one more week', status: 'Applied', clientConfirmedBy: 'Jassim Al Nuaimi' },
  );
  /* ---------------------------------------------------------------- demo flow: Renewals and Replacement Orders (8 Oct call) */
  // SO-26-00088: four 200 KVA units on hire, three already returned and one still running, contract and LPO ending in 4 days. Open it from Rental, Renewals and Expiry, Extend only the unit
  // that is still out (new end date and rate), then replace it from the order. The three returned units are Ready for Hire again and can be the replacement.
  const l45 = [R('so45a', 'Generator', '200 KVA', 29500, '2026-07-05', '2026-10-04', { qty: 4, desc: 'Generator 200 KVA, rental, monthly billing, events season' })];
  orderSeed.push(
    so({ id: 'so45', number: 'SO-26-00088', date: '2026-06-28', customerId: 'c11', owner: 'Leena Thomas', title: 'Rent four 200 KVA generators for the Marina hotels events season', reference: 'LPO-EHG-6431', status: 'Fully Delivered', activity: 'Rental', contractType: 'Closed', contractStart: '2026-07-05', contractEnd: '2026-10-04',
      lpo: 'LPO-EHG-6431', lpoDate: '2026-06-27', lpoExpiry: '2026-10-04', site: 'Dubai Marina Promenade, Dubai', costCentre: 'Dubai Branch', billingCycle: 'Monthly', invoicingType: 'Manual', paymentTerms: '30 days', contactPerson: 'Nadia Farouk',
      lines: withAsg(l45, { so45a: [asg('he90', 'dl43', '2026-07-05'), asg('he91', 'dl43', '2026-07-05', { state: 'Returned', stop: '2026-09-22' }), asg('he92', 'dl43', '2026-07-05', { state: 'Returned', stop: '2026-09-25' }), asg('he93', 'dl43', '2026-07-05', { state: 'Returned', stop: '2026-09-28' })] }),
      log: [lg('2026-09-29 11:00', 'Client asked to keep one unit until the end of October', 'Leena Thomas', 'Three units are back, AST-1090 is still running. Extend only that unit', 'amber'), lg('2026-09-28 10:00', 'Return RMA-26-00126: AST-1093 off hire', 'Bilal Ahmed', 'Client self-return. Billing stopped', 'amber'),
        lg('2026-09-25 10:00', 'Return RMA-26-00125: AST-1092 off hire', 'Bilal Ahmed', 'Client self-return. Billing stopped', 'amber'), lg('2026-09-22 10:00', 'Return RMA-26-00124: AST-1091 off hire', 'Bilal Ahmed', 'Client self-return. Billing stopped', 'amber'),
        lg('2026-07-05 09:00', 'Delivery DO-26-00161: 4 unit(s) on hire', 'Bilal Ahmed', 'AST-1090, AST-1091, AST-1092, AST-1093', 'green'), lg('2026-06-28 10:00', 'Sales Order created', 'Leena Thomas')] }),
  );
  deliverySeed.push(
    D('dl43', 161, 'so45', 'so45a', ['he90', 'he91', 'he92', 'he93'], '2026-07-05', { ...V_DXB_LB, type: 'Full', narration: 'Four 200 KVA units for the Marina hotels events season' }),
  );
  const ret45 = (id: string, no: number, grn: number, assetId: string, ts: string, yardAt: string, done: string): ReturnEntry => withLog(
    rt(id, `RMA-26-${String(no).padStart(5, '0')}`, sx('so45'), 'so45a', 'dl43', assetId, 'Self-Return', ts, { status: 'Return Completed', fuelNote: 'Tank at about half',
      grns: [rgrn(`rg${no}`, `GRN-26-${String(grn).padStart(5, '0')}`, ts.slice(0, 10), 'Validated', { itemId: `${id}-i1`, assetId, reachedYard: yardAt, yardChecklist: MASTER_SEED.yardChecklist, inspection: 'Passed', outcome: 'Routine Maintenance' })] }),
    lg(yardAt, 'Asset reached the yard', 'Sanjay Kumar', 'Jebel Ali Main Yard'), lg(done, 'Inspection passed', 'Sanjay Kumar', 'Sent for Routine Maintenance, completed and Ready for Hire again', 'green'));
  returnSeed.push(
    ret45('rt12', 124, 104, 'he91', '2026-09-22T10:00', '2026-09-22 11:30', '2026-09-23 10:00'),
    ret45('rt13', 125, 105, 'he92', '2026-09-25T10:00', '2026-09-25 11:30', '2026-09-26 10:00'),
    ret45('rt14', 126, 106, 'he93', '2026-09-28T10:00', '2026-09-28 11:30', '2026-09-29 10:00'),
  );
  // Replacements already done keep the Delivery Order of the unit that came in (the old flow reused the Delivery Order of the line), so the list shows it.
  replacementSeed.forEach((r) => {
    const l = sx(r.soId).lines.find((x) => x.id === r.lineId);
    const a = l?.assigned.find((x) => x.assetId === r.newAssetId);
    if (a) r.deliveryId = a.deliveryId;
    if (l) { r.group = l.group; r.category = l.category; }
  });
  // Extensions already applied are the earlier revision of their order: the Revisions tab shows the version before, and the units still out are marked Extended.
  extensionSeed.filter((e) => e.kind === 'Extension' && e.status === 'Applied' && e.soId !== 'so26').forEach((e) => {
    const o = sx(e.soId);
    const hit = (l: Line) => !e.lineId || l.id === e.lineId;
    e.revision = 1; e.changes = `end ${e.oldEnd} to ${e.newEnd}`;
    o.revision = 1;
    o.revisions = [{ rev: 0, date: e.date, by: o.owner, note: e.note, contractEnd: e.oldEnd, lpo: o.lpo, lpoExpiry: o.lpoExpiry,
      lines: o.lines.filter((l) => l.activity === 'Rental' || (l.activity === 'Service' && l.billing === 'Recurring')).map((l) => ({ id: l.id, item: l.item, end: hit(l) && l.end === e.newEnd ? e.oldEnd : l.end, price: l.price })) }];
    o.lines.filter((l) => l.activity === 'Rental' && hit(l)).forEach((l) => l.assigned.forEach((a) => { if (a.state === 'On Hire' || a.state === 'Hold') { a.extendedTo = e.newEnd; a.extRev = 1; } }));
  });
}
// ==== END SALES FLOW SEED ====

// ==== BEGIN OPS SEED ====
/**
 * Operations mock data written as of 30 Sep 2026 (the store shifts the dates to the demo day). Added only: AMC Job Cards jc6-jc13 (JC-26-00119..00126, invoices
 * INV-26-00470..00473) with the matching visit plan entries of SO-26-00084, 00085 and 00086; Cross Hire Requests chr6-chr11 (CHR-26-00009..00014), RFQs rfq3-rfq7
 * (RFQ-26-00014..00018), Cross Hire Orders ch6-ch15 (CH-26-00011..00020); Trips tr9-tr32 (TRP-26-00009..00032), after which the order logistics cost is recomputed.
 * Everything lives in one block scope so the helper names cannot clash with the regions before it.
 */
{
  /** Adds a log entry to a Sales Order in its place (the order log is newest first). */
  const insertLog = (o: SalesOrder, e: LogItem) => { const i = o.log.findIndex((x) => x.when <= e.when); o.log.splice(i < 0 ? o.log.length : i, 0, e); };
  const lineOf = (soId: string, lineId: string) => sx(soId).lines.find((l) => l.id === lineId)!;
  /** The ids of the requests and orders raised for a line are kept on the line, like the app does. */
  const tagLine = (soId: string, lineId: string, ...ids: string[]) => { const l = lineOf(soId, lineId); l.crossHire = [...l.crossHire, ...ids]; };

  /* ---------------------------------------------------------------- AMC job cards (one per visit that has happened or is due) */
  const VAN1 = 'Service Van 1 (Rajesh Pillai)'; const VAN2 = 'Service Van 2 (Shared)'; const VAN3 = 'Service Van 3 (Sanjay Kumar)'; const VAN4 = 'Service Van 4 (Mohammed Faisal)';
  const ACT43 = 'Monthly preventive maintenance of the four 1500 KVA data hall generators: no-load and on-load run test of each set, battery and charger check, coolant and oil levels, fuel polishing check, ATS transfer test';
  const ACT42 = 'Quarterly service of the two 500 KVA standby generators: oil and filter inspection, belts and hoses, battery and charger test, 30 minute load run and ATS test';
  const jcNo = (n: number) => `JC-26-${String(n).padStart(5, '0')}`;
  const jcTotal = (j: JobCard) => (j.visitFoc ? 0 : j.visitAmount) + j.materials.reduce((s, m) => s + (m.foc ? 0 : m.qty * m.price), 0) + j.services.reduce((s, m) => s + (m.foc ? 0 : m.amount), 0);
  const jcFoc = (j: JobCard) => (j.visitFoc ? j.visitAmount : 0) + j.materials.reduce((s, m) => s + (m.foc ? m.qty * m.price : 0), 0) + j.services.reduce((s, m) => s + (m.foc ? m.amount : 0), 0);
  const jcard = (id: string, n: number, soId: string, visitIdx: number, item: string, over: Partial<JobCard> & Pick<JobCard, 'technician' | 'location' | 'status'>): JobCard => {
    const o = sx(soId); const v = o.visitPlan![visitIdx];
    return { id, number: jcNo(n), soId, soNumber: o.number, customerId: o.customerId, visitIdx, plannedDate: v.date, item, materials: [], services: [], notes: '', visitAmount: v.amount ?? 0, log: [], ...over };
  };
  const I43 = 'AMC Annual Contract (4 x Generator 1500 KVA)';
  const I42 = 'AMC Annual Contract (2 x Generator 500 KVA)';
  const I41 = 'AMC Annual Contract (Generator 750 KVA)';
  const FF_CUM = { item: 'Fuel Filter (Cummins C-Series)', unit: 'Nos', price: 68 };
  const newJobCards: JobCard[] = [
    /* SO-26-00086, Al Wasl Data Centres: 12 monthly visits, the first four are past */
    jcard('jc6', 119, 'so43', 0, I43, { technician: 'Rajesh Pillai', location: VAN1, doneOn: '2026-06-16', activities: ACT43, materials: [{ ...FF_CUM, qty: 2 }], notes: 'All four sets ran on load without alarms. Fuel filters of sets 1 and 2 replaced',
      status: 'Invoiced', invoiceRef: 'INV-26-00470', invoiceId: 'inv-470', paymentStatus: 'Paid', signedCopy: ['JC-26-00119-signed.pdf'],
      log: [lg('2026-06-15 16:00', 'Job card created for visit 1'), lg('2026-06-16 15:30', 'Visit completed', 'Rajesh Pillai', `Materials drawn from ${VAN1}; services recorded`, 'green'), lg('2026-06-16 17:00', 'Invoice raised', 'Leena Thomas', 'INV-26-00470, total AED 8136. Pending approval in Accounting', 'blue'), lg('2026-07-14 10:00', 'Payment received', 'Priya Menon', 'INV-26-00470, AED 8136', 'green')] }),
    jcard('jc7', 120, 'so43', 1, I43, { technician: 'Sanjay Kumar', location: VAN3, doneOn: '2026-07-17', activities: ACT43, materials: [{ ...FF_CUM, qty: 2 }], services: [{ name: 'Cable Laying and Termination', amount: 1800 }],
      notes: 'Set 3 reported a loose control cable alarm: the cable was re-terminated and tested under load. Additional task billed', status: 'Invoiced', invoiceRef: 'INV-26-00471', invoiceId: 'inv-471', paymentStatus: 'Paid', signedCopy: ['JC-26-00120-signed.pdf'],
      log: [lg('2026-07-16 15:00', 'Job card created for visit 2'), lg('2026-07-17 16:00', 'Visit completed', 'Sanjay Kumar', `Materials drawn from ${VAN3}; services recorded`, 'green'), lg('2026-07-17 17:30', 'Invoice raised', 'Leena Thomas', 'INV-26-00471, total AED 9936. Pending approval in Accounting', 'blue'), lg('2026-08-20 11:00', 'Payment received', 'Priya Menon', 'INV-26-00471, AED 9936', 'green')] }),
    jcard('jc8', 121, 'so43', 2, I43, { technician: 'Rajesh Pillai', location: VAN1, doneOn: '2026-08-16', activities: ACT43, materials: [{ ...FF_CUM, qty: 2 }, { item: 'Battery 12V 200Ah', qty: 1, unit: 'Nos', price: 640, foc: true }], services: [{ name: 'Transportation', amount: 1200, foc: true }],
      notes: 'Starter battery of set 2 was replaced free of cost (client complaint about slow cranking); the old battery was taken away for disposal', status: 'Invoiced', invoiceRef: 'INV-26-00472', invoiceId: 'inv-472', paymentStatus: 'Unpaid', signedCopy: ['JC-26-00121-signed.pdf'],
      log: [lg('2026-08-14 15:00', 'Job card created for visit 3'), lg('2026-08-16 15:45', 'Visit completed', 'Rajesh Pillai', `Materials drawn from ${VAN1}; services recorded`, 'green'), lg('2026-08-16 17:15', 'Invoice raised', 'Leena Thomas', 'INV-26-00472, total AED 8136, free of cost AED 1840. Pending approval in Accounting', 'blue')] }),
    jcard('jc9', 122, 'so43', 3, I43, { technician: 'Suresh Nair', location: '', doneOn: '2026-09-15', activities: `${ACT43}, quarterly load bank test of all four sets`, notes: 'Nothing consumed on this visit. Load bank readings are attached to the report, the client signature is still to be collected',
      status: 'Completed', log: [lg('2026-09-14 15:00', 'Job card created for visit 4'), lg('2026-09-15 17:30', 'Visit completed', 'Suresh Nair', 'Materials and services recorded', 'green')] }),
    jcard('jc10', 123, 'so43', 4, I43, { technician: 'Mohammed Faisal', location: VAN4, activities: ACT43, notes: 'Next monthly visit, bring the cooling fan belts for set 4 (worn at the last visit)', status: 'Open', log: [lg('2026-09-29 09:00', 'Job card created for visit 5')] }),
    /* SO-26-00085, Emirates Palm Hotel: visit 1 was done five months late as a goodwill FOC visit, visit 2 is still overdue (no job card), visit 3 is due */
    jcard('jc11', 124, 'so42', 0, I42, { technician: 'Rajesh Pillai', location: VAN2, doneOn: '2026-09-24', activities: ACT42, visitFoc: true,
      materials: [{ item: 'Air Filter (Perkins 2506)', qty: 2, unit: 'Nos', price: 110 }, { item: 'Engine Oil 15W-40 (20 L)', qty: 2, unit: 'Drum', price: 420, foc: true }],
      notes: 'Visit due on 16 April was done late. The visit value is waived (FOC visit) and the oil change is free of cost, approved by Omar Farouk after the client complaint. The air filters are billed',
      status: 'Invoiced', invoiceRef: 'INV-26-00473', invoiceId: 'inv-473', paymentStatus: 'Unpaid', signedCopy: ['JC-26-00124-signed.pdf'],
      log: [lg('2026-09-23 10:00', 'Job card created for visit 1', 'Leena Thomas', 'Late visit, FOC visit approved by the Sales Manager'), lg('2026-09-24 16:30', 'Visit completed', 'Rajesh Pillai', `Materials drawn from ${VAN2}; services recorded`, 'green'), lg('2026-09-24 17:30', 'Invoice raised', 'Leena Thomas', 'INV-26-00473, total AED 220, free of cost AED 7340 (FOC visit). Pending approval in Accounting', 'blue')] }),
    jcard('jc12', 125, 'so42', 2, I42, { technician: 'Suresh Nair', location: '', activities: ACT42, notes: 'The hotel asks for the visit before 10:00 to avoid the breakfast service', status: 'Open', log: [lg('2026-09-30 08:30', 'Job card created for visit 3')] }),
    /* SO-26-00084, Al Ain Specialist Hospital: the first of two visits is due on 31 October */
    jcard('jc13', 126, 'so41', 0, I41, { technician: 'Mohammed Faisal', location: VAN4, activities: 'Bi-annual full service of the 750 KVA hospital standby generator: oil, fuel and air filter change, coolant test, battery test, ATS test and one hour load run',
      notes: 'Book the generator room access with the hospital engineering department three days ahead', status: 'Open', log: [lg('2026-09-30 11:00', 'Job card created for visit 1', 'Yousef Karim')] }),
  ];
  jobCardSeed.push(...newJobCards);
  newJobCards.forEach((j) => {
    const o = sx(j.soId);
    const v = o.visitPlan![j.visitIdx];
    o.visitPlan![j.visitIdx] = j.doneOn ? { ...v, done: j.doneOn, ref: j.number, type: 'Job card', jobCardId: j.id } : { ...v, jobCardId: j.id };
    insertLog(o, lg(j.log[0].when, `Job card ${j.number} created`, j.log[0].by, `AMC visit ${j.visitIdx + 1}`, 'blue'));
    const done = j.log.find((x) => x.title === 'Visit completed');
    if (done) insertLog(o, lg(done.when, `AMC visit ${j.visitIdx + 1} completed`, done.by, j.number, 'green'));
    const inv = j.log.find((x) => x.title === 'Invoice raised');
    if (inv) insertLog(o, lg(inv.when, `Job card ${j.number} invoiced`, inv.by, `${j.invoiceRef}, AED ${jcTotal(j)}${jcFoc(j) ? `, free of cost AED ${jcFoc(j)}` : ''}`, 'blue'));
  });

  /* the first visit of SO-26-00053 already has its draft job card jc1: the plan points at it like the other orders do */
  sx('so6').visitPlan![0] = { ...sx('so6').visitPlan![0], jobCardId: 'jc1' };

  /* ---------------------------------------------------------------- cross hire requests (every status) */
  const rq = (id: string, n: number, soId: string, lineId: string, over: Partial<CrossHireRequest> & Pick<CrossHireRequest, 'date' | 'status' | 'qty' | 'log'>): CrossHireRequest => {
    const o = sx(soId); const l = lineOf(soId, lineId);
    return { id, number: `CHR-26-${String(n).padStart(5, '0')}`, soId, soNumber: o.number, lineId, group: l.group ?? '', category: l.category ?? '', frequency: l.frequency ?? 'Monthly', rate: 0, company: ENT, representative: 'Bilal Ahmed', currency: o.currency,
      narration: '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], raisedBy: 'Bilal Ahmed', raisedRole: 'Dispatcher / Service Desk', ...over };
  };
  chRequestSeed.push(
    rq('chr6', 9, 'so31', 'so31a', { date: '2026-09-25', qty: 1, status: 'Completed', rfqId: 'rfq3', orderId: 'ch11', vendorId: 's12', vendor: 'Emirates Power Rental Co', rate: 128000, narration: 'No 1500 KVA unit is owned, the Ruwais turnaround needs one from 2 November',
      log: [lg('2026-09-25 09:30', 'Request raised from SO-26-00074', 'Bilal Ahmed', 'Generator 1500 KVA, quantity 1'), lg('2026-09-25 09:35', 'Submitted and approved', 'Bilal Ahmed', undefined, 'green'), lg('2026-09-26 10:00', 'RFQ RFQ-26-00014 created', 'Bilal Ahmed'), lg('2026-09-29 11:00', 'Order CH-26-00016 created', 'Bilal Ahmed', 'Emirates Power Rental Co')] }),
    rq('chr7', 10, 'so30', 'so30a', { date: '2026-09-29', qty: 2, frequency: 'Weekly', status: 'Draft', narration: 'Two festival units for the New Year show, saved as a draft until Finance releases SO-26-00073',
      log: [lg('2026-09-29 16:30', 'Request raised from SO-26-00073', 'Bilal Ahmed', 'Generator 500 KVA, quantity 2'), lg('2026-09-29 16:35', 'Saved as draft', 'Bilal Ahmed', 'The order is held by Finance for the credit limit', 'amber')] }),
    rq('chr8', 11, 'so34', 'so34a', { date: '2026-09-18', qty: 3, status: 'Rejected', raisedBy: 'Leena Thomas', raisedRole: 'Operational Desk', representative: 'Leena Thomas', narration: 'Three 200 KVA units for the Tower B podium testing from 1 October',
      log: [lg('2026-09-18 09:00', 'Request raised from SO-26-00077', 'Leena Thomas', 'Generator 200 KVA, quantity 3'), lg('2026-09-18 09:05', 'Submitted', 'Leena Thomas', undefined, 'green'), lg('2026-09-19 11:00', 'Request rejected', 'Hamdan Al Suwaidi', 'SO-26-00077 was rejected by Finance for overdue invoices. No cross-hire until the order is resubmitted with a security cheque', 'red')] }),
    rq('chr9', 12, 'so31', 'so31b', { date: '2026-09-26', qty: 2, status: 'Completed', rfqId: 'rfq4', narration: 'Two 1000 KVA units for the Ruwais turnaround, only one owned unit is Ready for Hire',
      log: [lg('2026-09-26 11:00', 'Request raised from SO-26-00074', 'Bilal Ahmed', 'Generator 1000 KVA, quantity 2'), lg('2026-09-26 11:05', 'Submitted and approved', 'Bilal Ahmed', undefined, 'green'), lg('2026-09-28 09:30', 'RFQ RFQ-26-00015 created', 'Bilal Ahmed')] }),
    rq('chr10', 13, 'so11', 'so11a', { date: '2026-09-30', qty: 1, status: 'Completed', orderId: 'ch15', vendorId: 's11', vendor: 'Horizon Cross-Hire Equipment LLC', rate: 37000, narration: 'The two owned 500 KVA units are committed to the master test order, Kiln 4 needs a third from 5 October',
      log: [lg('2026-09-30 08:45', 'Request raised from SO-26-00051', 'Bilal Ahmed', 'Generator 500 KVA, quantity 1'), lg('2026-09-30 08:50', 'Submitted and approved', 'Bilal Ahmed', undefined, 'green'), lg('2026-09-30 10:15', 'Order CH-26-00020 created', 'Bilal Ahmed', 'Horizon Cross-Hire Equipment LLC')] }),
    rq('chr11', 14, 'so12', 'so12a', { date: '2026-09-29', qty: 2, status: 'Completed', rfqId: 'rfq5', narration: 'Two 1500 KVA units for Desert Pearl Resort Phase 2, none owned',
      log: [lg('2026-09-29 15:30', 'Request raised from SO-26-00055', 'Yousef Karim', 'Generator 1500 KVA, quantity 2'), lg('2026-09-29 15:35', 'Submitted and approved', 'Yousef Karim', undefined, 'green'), lg('2026-09-30 09:30', 'RFQ RFQ-26-00016 created', 'Yousef Karim')], raisedBy: 'Yousef Karim', raisedRole: 'Operational Desk', representative: 'Yousef Karim' }),
  );

  /* ---------------------------------------------------------------- RFQs (Order, Response Received, RFQ Sent, Open, Draft) */
  chRfqSeed.push(
    { id: 'rfq3', number: 'RFQ-26-00014', date: '2026-09-26', requestIds: ['chr6'], soNumbers: ['SO-26-00074'], group: 'Generator', category: '1500 KVA', qty: 1, vendorIds: ['s5', 's12', 's14'], orderDeadline: '2026-10-02', expectedDate: '2026-10-28', currency: 'AED', paymentTerms: 'Net 30', start: '2026-11-02', end: '2027-02-28',
      narration: 'Quote for one 1500 KVA generator for the Ruwais turnaround, 4 months', status: 'Order', awardedVendorId: 's12', awardComment: 'Lowest rate, and the unit is stationed in Abu Dhabi close to the site', orderId: 'ch11',
      responses: [{ vendorId: 's5', vendor: 'Falcon Equipment Hire LLC', rate: 134000, leadTime: 7, moq: 1, date: '2026-09-27' }, { vendorId: 's12', vendor: 'Emirates Power Rental Co', rate: 128000, leadTime: 5, moq: 1, date: '2026-09-28', note: 'Unit stationed in Abu Dhabi, delivery to Ruwais included' }, { vendorId: 's14', vendor: 'Al Khaleej Equipment Leasing', rate: 131500, leadTime: 9, moq: 1, date: '2026-09-29' }],
      log: [lg('2026-09-26 10:00', 'RFQ created', 'Bilal Ahmed', 'From CHR-26-00009'), lg('2026-09-26 10:10', 'RFQ sent to 3 suppliers', 'Bilal Ahmed'), lg('2026-09-27 12:00', 'Response received from Falcon Equipment Hire LLC', 'Bilal Ahmed'), lg('2026-09-28 09:00', 'Response received from Emirates Power Rental Co', 'Bilal Ahmed'), lg('2026-09-29 10:00', 'Response received from Al Khaleej Equipment Leasing', 'Bilal Ahmed'),
        lg('2026-09-29 10:30', 'Awarded to Emirates Power Rental Co', 'Bilal Ahmed', 'Lowest rate, and the unit is stationed in Abu Dhabi close to the site', 'green'), lg('2026-09-29 11:00', 'Order CH-26-00016 created', 'Bilal Ahmed')] },
    { id: 'rfq4', number: 'RFQ-26-00015', date: '2026-09-28', requestIds: ['chr9'], soNumbers: ['SO-26-00074'], group: 'Generator', category: '1000 KVA', qty: 2, vendorIds: ['s5', 's6', 's11', 's14'], orderDeadline: '2026-10-06', expectedDate: '2026-10-30', currency: 'AED', paymentTerms: 'Net 30', start: '2026-11-02', end: '2027-02-28',
      narration: 'Quote for two 1000 KVA generators for the Ruwais turnaround, 4 months', status: 'Response Received',
      responses: [{ vendorId: 's5', vendor: 'Falcon Equipment Hire LLC', rate: 86000, leadTime: 7, moq: 2, date: '2026-09-29' }, { vendorId: 's6', vendor: 'Gulf Genset Rentals', rate: 83500, leadTime: 10, moq: 1, date: '2026-09-29' }, { vendorId: 's11', vendor: 'Horizon Cross-Hire Equipment LLC', rate: 81000, leadTime: 6, moq: 2, date: '2026-09-30', note: 'Includes a fuel transfer pump and 20 m earthing cable' }, { vendorId: 's14', vendor: 'Al Khaleej Equipment Leasing', rate: 84500, leadTime: 9, moq: 2, date: '2026-09-30' }],
      log: [lg('2026-09-28 09:30', 'RFQ created', 'Bilal Ahmed', 'From CHR-26-00012'), lg('2026-09-28 09:40', 'RFQ sent to 4 suppliers', 'Bilal Ahmed'), lg('2026-09-29 14:00', 'Response received from Falcon Equipment Hire LLC', 'Bilal Ahmed'), lg('2026-09-29 16:30', 'Response received from Gulf Genset Rentals', 'Bilal Ahmed'), lg('2026-09-30 09:00', 'Response received from Horizon Cross-Hire Equipment LLC', 'Bilal Ahmed'), lg('2026-09-30 11:30', 'Response received from Al Khaleej Equipment Leasing', 'Bilal Ahmed')] },
    { id: 'rfq5', number: 'RFQ-26-00016', date: '2026-09-30', requestIds: ['chr11'], soNumbers: ['SO-26-00055'], group: 'Generator', category: '1500 KVA', qty: 2, vendorIds: ['s11', 's12'], orderDeadline: '2026-10-08', expectedDate: '2026-10-12', currency: 'AED', paymentTerms: 'Net 30', start: '2026-10-12', end: '2027-04-04',
      narration: 'Quote for two 1500 KVA generators for Desert Pearl Resort Phase 2, 6 months', status: 'RFQ Sent', responses: [],
      log: [lg('2026-09-30 09:30', 'RFQ created', 'Yousef Karim', 'From CHR-26-00014'), lg('2026-09-30 09:45', 'RFQ sent to 2 suppliers', 'Yousef Karim')] },
    { id: 'rfq6', number: 'RFQ-26-00017', date: '2026-09-30', requestIds: [], soNumbers: [], group: 'Generator', category: '500 KVA', qty: 4, vendorIds: ['s5', 's6', 's11', 's12'], orderDeadline: '2026-10-15', expectedDate: '2026-11-25', currency: 'AED', paymentTerms: 'Net 30', start: '2026-12-01', end: '2027-02-28', reference: 'Winter festival framework',
      narration: 'Framework quote for four 500 KVA festival power packages for the Sandstorm winter festival, no order yet', status: 'Open', responses: [],
      items: [{ id: 'rfq6-i1', group: 'Generator', category: '500 KVA', uom: 'Nos', description: 'Generator 500 KVA, festival power package', specification: 'Silent canopy, 400 V, 50 Hz, with 20 m earthing cable and fuel transfer pump', duration: 'Monthly', qty: 4, estYear: 1, location: 'Jebel Ali Main Yard', department: 'Operations', narration: 'Winter festival, 3 months from 1 December' }],
      log: [lg('2026-09-30 14:00', 'RFQ created', 'Bilal Ahmed', 'From a manual entry'), lg('2026-09-30 14:05', 'Saved as open', 'Bilal Ahmed', 'To be sent once the festival layout is confirmed')] },
    { id: 'rfq7', number: 'RFQ-26-00018', date: '2026-09-29', requestIds: [], soNumbers: [], group: 'POD', category: '20 ft POD', qty: 2, vendorIds: ['s5', 's14'], orderDeadline: '', expectedDate: '', currency: 'AED', paymentTerms: 'Net 30', start: '2026-11-01', end: '2027-04-30',
      narration: 'Draft: two 20 ft PODs for a staff accommodation site, waiting for the client site plan before it is sent', status: 'Draft', responses: [],
      items: [{ id: 'rfq7-i1', group: 'POD', category: '20 ft POD', uom: 'Nos', description: 'POD 20 ft, site office', specification: 'Insulated, air conditioned, 400 V distribution board', duration: 'Monthly', qty: 2, estYear: 1, location: 'Jebel Ali Main Yard', department: 'Operations', narration: '' }],
      log: [lg('2026-09-29 17:00', 'RFQ created', 'Bilal Ahmed', 'From a manual entry, saved as draft')] },
  );

  /* ---------------------------------------------------------------- cross hire orders (every stage, Inventory and Dropship, one negative margin, one dropped supplier) */
  const SUPPLIER: Record<string, { name: string; contact: string; address: string }> = {
    s5: { name: 'Falcon Equipment Hire LLC', contact: 'Tariq Mahmood', address: 'Warehouse 14, Al Quoz Industrial Area 3, Dubai' },
    s6: { name: 'Gulf Genset Rentals', contact: 'Ravi Menon', address: 'Industrial Area 12, Sharjah' },
    s11: { name: 'Horizon Cross-Hire Equipment LLC', contact: 'Nabil Haddad', address: 'Dubai Investments Park 2, Dubai' },
    s12: { name: 'Emirates Power Rental Co', contact: 'Vinod Shetty', address: 'ICAD 3, Mussafah, Abu Dhabi' },
    s13: { name: 'Rapid Genset Hire FZE', contact: 'Zubair Khan', address: 'SAIF Zone, Sharjah' },
    s14: { name: 'Al Khaleej Equipment Leasing', contact: 'Hesham Fouad', address: 'Ras Al Khor Industrial Area 2, Dubai' },
  };
  const cho = (id: string, n: number, soId: string, lineId: string, supplierId: string, over: Partial<CrossHire> & Pick<CrossHire, 'rate' | 'stage' | 'revenue' | 'date' | 'history'>): CrossHire => {
    const o = sx(soId); const l = lineOf(soId, lineId); const s = SUPPLIER[supplierId];
    return { id, number: `CH-26-${String(n).padStart(5, '0')}`, soId, soNumber: o.number, lineId, group: l.group ?? '', category: l.category ?? '', supplierId, supplier: s.name,
      form: { company: ENT, currency: 'AED', representative: 'Bilal Ahmed', department: 'Operations', location: 'Jebel Ali Main Yard', duration: l.frequency ?? 'Monthly', contactPerson: s.contact, supplierAddress: s.address, shippingAddress: o.site }, ...over };
  };
  const CLOSED_CHECKS = MASTER_SEED.yardChecklist;
  const newCrossHires: CrossHire[] = ([
    /* Stage 4, Inventory: a standby unit that came back from SO-26-00056 and went to the supplier after a re-issue was offered and not needed */
    cho('ch6', 11, 'so13', 'so13a', 's5', { date: '2026-08-27', rate: 31000, revenue: 50000, stage: 4, status: 'Closed', supplierInvoice: 'FAL-INV-9304', billing: 'Fully Billed', expectedReceipt: '2026-08-31', startDate: '2026-09-01', endDate: '2026-09-14', paymentTerms: 'Net 30',
      expenses: [{ account: 'Loading and Unloading', amount: 350, note: 'Crane offloading and loading back at the Jebel Ali yard' }], reissueRef: 'SO-26-00074',
      condition: { notes: 'Clean at return: 1,240 hours, no damage, tank empty. Two fuel cap keys handed back with the unit', files: ['yard-condition-ch500-0914.jpg'], checks: CLOSED_CHECKS },
      history: [lg('2026-08-27 09:00', 'Request', 'Bilal Ahmed', 'Second 500 KVA of SO-26-00056 is not ready: AST-1052 is still in the workshop after its 4,000 hour service; direct order; Inventory'), lg('2026-08-27 09:10', 'Order created', 'Bilal Ahmed', 'CH-26-00011 with Falcon Equipment Hire LLC at AED 31000 per unit', 'blue'),
        lg('2026-08-31 14:00', 'Received into our custody', 'Sanjay Kumar', 'Goods receipt GRN-26-00011, supplier invoice FAL-INV-9304'), lg('2026-09-01 08:00', 'Allocated to SO-26-00056', 'Bilal Ahmed', 'Standby second unit until AST-1052 is released'),
        lg('2026-09-12 16:00', 'Returned to us, idle at Jebel Ali Main Yard', 'Sanjay Kumar', 'AST-1052 was delivered (DO-26-00127), the standby unit is no longer needed. Condition check completed', 'amber'), lg('2026-09-13 10:00', 'Re-issue offered to SO-26-00074', 'Bilal Ahmed', 'The Ruwais turnaround starts on 2 November: too far out to keep the unit idle'),
        lg('2026-09-14 11:00', 'Returned to supplier', 'Sanjay Kumar', 'Loop closed, no dispute charge', 'green')] }),
    /* Stage 4, Inventory, negative margin: the Sales Order was cancelled, the unit never left the yard, the supplier charged a cancellation fee (dispute charge) */
    cho('ch7', 12, 'so33', 'so33a', 's11', { date: '2026-08-16', rate: 9000, revenue: 0, stage: 4, status: 'Closed', supplierInvoice: 'HCE-INV-2217', billing: 'Fully Billed', expectedReceipt: '2026-08-24', startDate: '2026-08-24', endDate: '2026-08-31', paymentTerms: 'Net 30', dispute: 1500,
      expenses: [{ account: 'Insurance Expense', amount: 300, note: 'Transit cover for the one week hire' }],
      condition: { notes: 'Unused: seals on the fuel tank are intact, handed back as received', files: ['yard-condition-ch500-0828.jpg'], checks: CLOSED_CHECKS.slice(0, 4) },
      history: [lg('2026-08-16 10:00', 'Request', 'Bilal Ahmed', 'Cover for SO-26-00076 starting 1 September; no owned 500 KVA unit Ready for Hire; direct order; Inventory'), lg('2026-08-16 10:10', 'Order created', 'Bilal Ahmed', 'CH-26-00012 with Horizon Cross-Hire Equipment LLC at AED 9000 per unit (one week minimum)', 'blue'),
        lg('2026-08-24 15:00', 'Received into our custody', 'Sanjay Kumar', 'Goods receipt GRN-26-00012, supplier invoice HCE-INV-2217'), lg('2026-08-27 12:00', 'SO-26-00076 cancelled', 'Bilal Ahmed', 'The client postponed the dry dock refit to 2027. The unit never left the yard', 'amber'),
        lg('2026-08-28 11:00', 'Returned to supplier', 'Sanjay Kumar', 'Dispute charge AED 1500 recorded (cancellation fee) and traced to SO-26-00076', 'red')] }),
    /* Stage 4, Inventory, blacklisted supplier: the unit failed the acceptance test and the supplier was dropped */
    cho('ch8', 13, 'so29', 'so29a', 's13', { date: '2026-06-12', rate: 3500, revenue: 29500, stage: 4, status: 'Closed', billing: 'Pending Billing', receiving: 'Not received', grns: [], expectedReceipt: '2026-06-15', startDate: '2026-06-18', endDate: '2026-08-31', paymentTerms: 'Advance',
      history: [lg('2026-06-12 09:00', 'Request', 'Bilal Ahmed', 'SO-26-00072 needs a 200 KVA from 18 June; no owned 200 KVA unit Ready for Hire; direct order; Inventory'), lg('2026-06-12 09:10', 'Order created', 'Bilal Ahmed', 'CH-26-00013 with Rapid Genset Hire FZE at AED 21000 per unit', 'blue'),
        lg('2026-06-16 08:30', 'Unit arrived at the yard and was rejected', 'Sanjay Kumar', 'Failed the acceptance test: no output on phase B, the AVR is faulty. Not accepted, no goods receipt created, the supplier was 1 day late', 'red'), lg('2026-06-16 10:00', 'Returned to supplier', 'Sanjay Kumar', 'Unit loaded back on the supplier truck the same day', 'green'),
        lg('2026-06-17 11:00', 'Order value reduced', 'Hamdan Al Suwaidi', 'Rapid waived the hire charge of AED 21000, only the mobilisation fee of AED 3500 stays payable. An owned 500 KVA unit goes to SO-26-00072 instead (DO-26-00153)', 'blue'),
        lg('2026-06-30 15:00', 'Supplier blacklisted', 'Hamdan Al Suwaidi', 'Third failed delivery in 2026: Rapid Genset Hire FZE is blacklisted, no new cross-hire orders. See Procurement, Suppliers', 'red')] }),
    /* Stage 4, Dropship: shipped to the quarry, collected by the supplier from the site */
    cho('ch14', 19, 'so26', 'so26a', 's5', { date: '2026-08-18', type: 'Dropship', rate: 24500, revenue: 29500, stage: 4, status: 'Closed', supplierInvoice: 'FAL-INV-9188', billing: 'Fully Billed', receiving: 'Not applicable (Dropship)', grns: [], expectedReceipt: '2026-08-20', startDate: '2026-08-20', endDate: '2026-09-12', paymentTerms: 'Net 30',
      expenses: [{ account: 'Fuel Expense', amount: 420, note: 'First tank filled by us before the crusher test run' }],
      history: [lg('2026-08-18 09:30', 'Request', 'Bilal Ahmed', 'The crusher line needs a second 200 KVA for the commissioning weeks; the supplier ships straight to Jebel Jais quarry; Dropship'), lg('2026-08-18 09:35', 'Order created', 'Bilal Ahmed', 'CH-26-00019 with Falcon Equipment Hire LLC at AED 24500 per unit', 'blue'),
        lg('2026-08-20 08:00', 'Marked shipped to the client site', 'Bilal Ahmed', 'Dropship: no goods receipt, no register entry', 'blue'), lg('2026-09-13 12:00', 'Returned to supplier', 'Bilal Ahmed', 'Falcon collected the unit from the quarry after the extension ended on 12 September. Loop closed', 'green')] }),
    /* Stage 2, Inventory: the cross-hired unit AST-1061 replaced the broken AST-1017 on SO-26-00062 */
    cho('ch9', 14, 'so19', 'so19a', 's5', { date: '2026-07-17', rate: 38000, revenue: 52000, stage: 2, assetId: 'he61', status: 'Billed', supplierInvoice: 'FAL-INV-9477', billing: 'Fully Billed', expectedReceipt: '2026-07-18', startDate: '2026-07-18', endDate: '2027-01-19', paymentTerms: 'Net 30',
      expenses: [{ account: 'Insurance Expense', amount: 450, note: 'All-risk cover required by Falcon for units on a client site' }],
      grns: [{ id: 'ch9-grn', number: 'GRN-26-00427', date: '2026-07-18', receivedBy: 'Sanjay Kumar', narration: 'Falcon unit 2, received at the yard and load tested', transportedBy: 'Falcon Equipment Hire LLC', driver: 'Supplier driver', driverId: '', vehicle: '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], qty: 1,
        traces: [{ serial: 'CUM-QSX15-70488', group: 'Generator', category: '500 KVA', condition: 'OK', hours: '1860', remarks: '30 minute load test passed' }], validated: true }],
      history: [lg('2026-07-17 09:00', 'Request', 'Bilal Ahmed', 'AST-1017 broke down at Station 7 (fuel injection pump), a replacement 500 KVA is needed; direct order; Inventory'), lg('2026-07-17 09:10', 'Order created', 'Bilal Ahmed', 'CH-26-00014 with Falcon Equipment Hire LLC at AED 38000 per unit', 'blue'),
        lg('2026-07-18 10:00', 'Received into our custody as AST-1061', 'Sanjay Kumar', 'GRN-26-00427, supplier invoice FAL-INV-9477'), lg('2026-07-20 09:00', 'Allocated to SO-26-00062 as a replacement', 'Bilal Ahmed', 'RP-26-00006, DO-26-00141')] }),
    /* Stage 2, Dropship, negative margin: the supplier price is above the client price, accepted to keep the schedule */
    cho('ch10', 15, 'so22', 'so22a', 's11', { date: '2026-09-10', type: 'Dropship', rate: 1050, revenue: 900, stage: 2, status: 'Shipped', supplierInvoice: 'HCE-INV-3420', billing: 'Fully Billed', receiving: 'Not applicable (Dropship)', grns: [], expectedReceipt: '2026-09-12', startDate: '2026-09-12', endDate: '2026-12-31', paymentTerms: 'Net 30',
      expenses: [{ account: 'Transportation Expense', amount: 380, note: 'Horizon truck delivery to Yas Island Phase 3' }],
      history: [lg('2026-09-10 11:00', 'Request', 'Bilal Ahmed', 'The second 95 mm cable drum of SO-26-00065 is still outstanding and no drum is Ready for Hire; the supplier ships straight to the site; Dropship'),
        lg('2026-09-10 11:05', 'Order created', 'Bilal Ahmed', 'CH-26-00015 with Horizon Cross-Hire Equipment LLC at AED 1050 per unit, above the client price of AED 900. Approved by the Operations Manager to keep the client schedule', 'amber'),
        lg('2026-09-12 10:00', 'Marked shipped to the client site', 'Bilal Ahmed', 'Dropship: no goods receipt, no register entry', 'blue')] }),
    /* Stage 1, Inventory: received, but the unit failed its pre-delivery test and cannot be allocated */
    cho('ch13', 18, 'so2', 'so2a', 's6', { date: '2026-09-08', rate: 21000, revenue: 29500, stage: 1, assetId: 'he56', status: 'Billed', supplierInvoice: 'GGR-2340', billing: 'Fully Billed', expectedReceipt: '2026-09-10', startDate: '2026-09-24', endDate: '2026-12-31', paymentTerms: 'Net 30',
      grns: [{ id: 'ch13-grn', number: 'GRN-26-00392', date: '2026-09-10', receivedBy: 'Sanjay Kumar', narration: 'Volvo Penta 200 KVA received at the yard, visual check passed', transportedBy: 'Gulf Genset Rentals', driver: 'Supplier driver', driverId: '', vehicle: '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], qty: 1,
        traces: [{ serial: 'VOL-TAD734-31208', group: 'Generator', category: '200 KVA', condition: 'OK', hours: '3120', remarks: 'Visual check passed, load test planned before delivery' }], validated: true }],
      history: [lg('2026-09-08 10:00', 'Request', 'Bilal Ahmed', 'Spare 200 KVA for the Yas Island block B handover of SO-26-00046; direct order; Inventory'), lg('2026-09-08 10:05', 'Order created', 'Bilal Ahmed', 'CH-26-00018 with Gulf Genset Rentals at AED 21000 per unit', 'blue'),
        lg('2026-09-10 10:05', 'Received into our custody as AST-1056', 'Sanjay Kumar', 'GRN-26-00392, supplier invoice GGR-2340'), lg('2026-09-29 11:40', 'Breakdown at the pre-delivery test', 'Sanjay Kumar', 'Coolant pump seal is leaking, the supplier technician is booked. The unit cannot be allocated until it is repaired or swapped', 'red'),
        lg('2026-09-30 09:00', 'Supplier notified', 'Bilal Ahmed', 'Gulf Genset Rentals promised a technician on 2 October or a replacement unit. The invoice stays on hold until the unit works', 'amber')] }),
    /* Stage 0: approved from an awarded RFQ, a direct approved order, and a draft */
    cho('ch11', 16, 'so31', 'so31a', 's12', { date: '2026-09-29', rate: 128000, revenue: 145000, stage: 0, status: 'Approved', approvedBy: 'Ahmed Al Khouri', requestIds: ['chr6'], rfqId: 'rfq3', expectedReceipt: '2026-10-28', startDate: '2026-11-02', endDate: '2027-02-28', paymentTerms: 'Net 30',
      history: [lg('2026-09-29 11:00', 'Request', 'Bilal Ahmed', 'CHR-26-00009 via RFQ award; Inventory'), lg('2026-09-29 11:00', 'Order created', 'Bilal Ahmed', 'CH-26-00016 with Emirates Power Rental Co at AED 128000 per unit', 'blue'), lg('2026-09-29 11:30', 'Quick approval', 'Ahmed Al Khouri', 'Approved by Ahmed Al Khouri', 'green')] }),
    cho('ch15', 20, 'so11', 'so11a', 's11', { date: '2026-09-30', rate: 37000, revenue: 52000, stage: 0, status: 'Approved', approvedBy: 'Hamdan Al Suwaidi', requestIds: ['chr10'], expectedReceipt: '2026-10-03', startDate: '2026-10-05', endDate: '2026-12-31', paymentTerms: 'Net 30',
      history: [lg('2026-09-30 10:15', 'Request', 'Bilal Ahmed', 'CHR-26-00013 direct order; Inventory'), lg('2026-09-30 10:15', 'Order created', 'Bilal Ahmed', 'CH-26-00020 with Horizon Cross-Hire Equipment LLC at AED 37000 per unit', 'blue'), lg('2026-09-30 11:00', 'Order approved', 'Hamdan Al Suwaidi', 'By Hamdan Al Suwaidi. A Goods Receipt can now be created', 'green')] }),
    cho('ch12', 17, 'so30', 'so30a', 's14', { date: '2026-09-29', rate: 21600, revenue: 27000, stage: 0, status: 'Draft', qty: 2, expectedReceipt: '2026-12-24', startDate: '2026-12-28', endDate: '2027-01-04', paymentTerms: 'Net 45',
      history: [lg('2026-09-29 12:00', 'Order created', 'Bilal Ahmed', 'CH-26-00017: 2 unit(s) of Generator 500 KVA with Al Khaleej Equipment Leasing at AED 10800 per unit; saved as draft', 'blue'), lg('2026-09-29 16:00', 'Held as draft', 'Bilal Ahmed', 'Finance has not released SO-26-00073 yet, the order is submitted once the 50 percent advance is received', 'amber')] }),
  ] as CrossHire[]).map(chOrderExtra);
  crossHireSeed.push(...newCrossHires);
  /* the order lines and logs of the Sales Orders know their requests and orders */
  const orderTags: [string, string, string[]][] = [['so31', 'so31a', ['chr6', 'ch11']], ['so31', 'so31b', ['chr9']], ['so30', 'so30a', ['chr7', 'ch12']], ['so34', 'so34a', ['chr8']], ['so11', 'so11a', ['chr10', 'ch15']], ['so12', 'so12a', ['chr11']], ['so22', 'so22a', ['ch10']],
    ['so19', 'so19a', ['ch9']], ['so2', 'so2a', ['ch13']], ['so13', 'so13a', ['ch6']], ['so33', 'so33a', ['ch7']], ['so29', 'so29a', ['ch8']], ['so26', 'so26a', ['ch14']]];
  orderTags.forEach(([s, l, ids]) => tagLine(s, l, ...ids));
  newCrossHires.forEach((c) => insertLog(sx(c.soId), lg(c.history.find((h) => h.title === 'Order created')?.when ?? `${c.date} 09:00`, `Cross-hire order ${c.number}`, 'Bilal Ahmed', `${c.supplier}, ${c.type ?? 'Inventory'}`, 'blue')));
  chRequestSeed.filter((r) => ['chr8', 'chr7', 'chr9', 'chr10', 'chr11', 'chr6'].includes(r.id)).forEach((r) => insertLog(sx(r.soId), lg(r.log[0].when, `Cross-Hire request ${r.number} raised`, r.log[0].by, `${r.group} ${r.category}`, 'blue')));

  /* ---------------------------------------------------------------- trips: deliveries, collections and replacements of the new orders */
  const VEH = {
    he21: { vehicleId: 'he21', plate: 'Dubai P 48213', ...DRV.tariq },
    he22: { vehicleId: 'he22', plate: 'Sharjah 3 22871', driver: 'Hassan Mahmood', mobile: '+971 56 390 2548' },
    he42: { vehicleId: 'he42', plate: 'Abu Dhabi 12 45118', driver: 'Jomon Varghese', mobile: '+971 50 774 1295' },
    he43: { vehicleId: 'he43', plate: 'Dubai M 77042', driver: 'Vijay Reddy', mobile: '+971 52 846 3017' },
    he84: { vehicleId: 'he84', plate: 'Dubai T 92318', driver: 'Joseph Mathew', mobile: '+971 52 703 9154' },
    he85: { vehicleId: 'he85', plate: 'Dubai N 51806', driver: 'Arun Das', mobile: '+971 55 302 7716' },
  };
  type VehKey = keyof typeof VEH;
  type Doc = { id: string; number: string };
  const tl = (when: string, title: string, detail?: string, tone?: LogItem['tone']) => lg(when.replace('T', ' '), title, 'Bilal Ahmed', detail, tone);
  const dayOf = (iso: string) => iso.slice(0, 10);
  const plus = (iso: string, minutes: number) => dayjs(iso).add(minutes, 'minute').format('YYYY-MM-DDTHH:mm');
  const extra = (e: [string, number, string?][], date: string): TripExpense[] => e.map(([t, a, note]) => tx(t, a, dayOf(date), note));
  const summary = (e: [string, number, string?][]) => e.map(([t, a]) => `${t} AED ${a}`).join(', ');
  /** An own-fleet trip that ran to the end, with its Salik, fuel, allowance and parking. */
  const ownDone = (id: string, n: number, soId: string, kind: TripKind, doc: Doc, v: VehKey, date: string, end: string, exp: [string, number, string?][]): Trip => tr(id, n, sx(soId), kind, doc, { date, status: 'Completed', since: end, ...VEH[v], expenses: extra(exp, date),
    log: [tl(date, 'Trip created', `${VEH[v].plate}, ${VEH[v].driver}`), tl(plus(date, 15), 'Trip started', undefined, 'blue'), tl(end, 'Trip completed', summary(exp), 'green')] });
  /** An external transporter trip: the Transport Charge is the cost entered on the Delivery Order (or agreed for the collection). */
  const extTrip = (id: string, n: number, soId: string, kind: TripKind, doc: Doc, transporter: string, date: string, status: 'Completed' | 'Assigned', amount: number, since: string, note?: string): Trip => tr(id, n, sx(soId), kind, doc, { date, status, since, transport: 'External Transporter', transporter, expenses: [tx('Transport Charge', amount, dayOf(date), note)],
    log: status === 'Completed' ? [tl(date, 'Trip created', `External transporter ${transporter}`), tl(since, 'Trip completed', `Transport Charge AED ${amount}`, 'green')] : [tl(since, 'Trip created', `External transporter ${transporter}${note ? `. ${note}` : ''}, Transport Charge AED ${amount}`)] });
  const D = (id: string, number: string): Doc => ({ id, number });
  const newTrips: Trip[] = [
    extTrip('tr9', 9, 'so25', 'Delivery', D('dl31', 'DO-26-00149'), 'Al Safeer Heavy Transport', '2026-03-01T07:00', 'Completed', 2400, '2026-03-01T14:20'),
    ownDone('tr10', 10, 'so18', 'Delivery', D('dl20', 'DO-26-00138'), 'he21', '2026-03-10T07:30', '2026-03-10T14:10', [['Salik', 60], ['Fuel', 260], ['Driver Allowance', 150], ['Parking', 40, 'Waited at the gate for the power room handover']]),
    extTrip('tr11', 11, 'so18', 'Delivery', D('dl21', 'DO-26-00139'), 'Sharjah Low-bed Carriers', '2026-03-10T08:00', 'Completed', 650, '2026-03-10T12:30'),
    extTrip('tr12', 12, 'so28', 'Delivery', D('dl34', 'DO-26-00152'), 'Jebel Ali Heavy Haulage LLC', '2026-04-06T06:30', 'Completed', 2800, '2026-04-06T11:45'),
    extTrip('tr13', 13, 'so20', 'Delivery', D('dl25', 'DO-26-00143'), 'Sharjah Low-bed Carriers', '2026-05-25T06:30', 'Completed', 2800, '2026-05-25T12:10'),
    extTrip('tr14', 14, 'so21', 'Delivery', D('dl27', 'DO-26-00145'), 'Jebel Ali Heavy Haulage LLC', '2026-05-30T07:00', 'Completed', 2600, '2026-05-30T13:40', 'Low-bed with crane offloading'),
    ownDone('tr15', 15, 'so20', 'Replacement', D('rp4', 'RP-26-00007'), 'he21', '2026-06-15T07:30', '2026-06-15T16:40', [['Salik', 80], ['Fuel', 340], ['Driver Allowance', 150], ['Parking', 30]]),
    ownDone('tr16', 16, 'so19', 'Delivery', D('dl22', 'DO-26-00140'), 'he21', '2026-07-05T07:30', '2026-07-05T15:10', [['Salik', 40], ['Fuel', 180], ['Driver Allowance', 250, 'Waited 4 hours at the site gate for the access permit']]),
    extTrip('tr17', 17, 'so19', 'Delivery', D('dl23', 'DO-26-00141'), 'Jebel Ali Heavy Haulage LLC', '2026-07-20T07:30', 'Completed', 1500, '2026-07-20T12:50'),
    ownDone('tr18', 18, 'so19', 'Replacement', D('rp3', 'RP-26-00006'), 'he85', '2026-07-20T09:30', '2026-07-20T14:30', [['Salik', 40], ['Fuel', 220], ['Parking', 25]]),
    extTrip('tr19', 19, 'so17', 'Delivery', D('dl18', 'DO-26-00136'), 'Sharjah Low-bed Carriers', '2026-07-22T07:00', 'Completed', 1300, '2026-07-22T11:30'),
    ownDone('tr20', 20, 'so16', 'Replacement', D('rp2', 'RP-26-00005'), 'he85', '2026-08-10T08:30', '2026-08-10T15:00', [['Salik', 60], ['Fuel', 280], ['Driver Allowance', 120]]),
    /* CN-26-00118: the first collection was refused at the site gate (Cancelled, the client is charged), the retry is stuck at the same gate */
    tr('tr21', 21, sx('so24'), 'Collection', D('rt6', 'CN-26-00118'), { date: '2026-09-09T11:00', status: 'Cancelled', since: '2026-09-09T15:10', ...VEH.he42, stuck: undefined,
      log: [tl('2026-09-09T11:00', 'Trip created', 'Abu Dhabi 12 45118, Jomon Varghese'), tl('2026-09-09T11:20', 'Trip started', undefined, 'blue'), tl('2026-09-09T13:40', 'Marked Stuck-Delayed', 'Site security refused to release the drum. Responsible: Client', 'red'),
        tl('2026-09-09T15:10', 'Trip cancelled', 'Site security refused to release the drum, the vehicle waited 3 hours and returned to the yard. The client is charged AED 900 on the return', 'red')] }),
    tr('tr22', 22, sx('so35'), 'Delivery', D('dl36', 'DO-26-00154'), { date: '2026-09-14T08:00', status: 'Cancelled', since: '2026-09-13T16:00', ...VEH.he42,
      log: [tl('2026-09-12T14:00', 'Trip created', 'Abu Dhabi 12 45118, Jomon Varghese, planned 2026-09-14 08:00'), tl('2026-09-13T16:00', 'Trip cancelled', 'The Mirfa plant postponed the receipt by one day. A new trip is created for 15 September', 'red')] }),
    ownDone('tr23', 23, 'so35', 'Delivery', D('dl36', 'DO-26-00154'), 'he42', '2026-09-15T07:30', '2026-09-15T13:20', [['Fuel', 190], ['Driver Allowance', 80]]),
    extTrip('tr24', 24, 'so44', 'Delivery', D('dl40', 'DO-26-00158'), 'Al Safeer Heavy Transport', '2026-09-15T07:00', 'Completed', 1800, '2026-09-15T12:30', 'Cable to Dammam by road, DAP'),
    /* CN-26-00131: the own low-bed truck broke down on the way, the collection is re-booked with an external transporter */
    tr('tr25', 25, sx('so25'), 'Collection', D('rt5', 'CN-26-00131'), { date: '2026-09-18T09:30', status: 'Cancelled', since: '2026-09-18T15:40', ...VEH.he22,
      log: [tl('2026-09-18T09:30', 'Trip created', 'Sharjah 3 22871, Hassan Mahmood'), tl('2026-09-18T10:00', 'Trip started', undefined, 'blue'), tl('2026-09-18T12:10', 'Marked Stuck-Delayed', 'Low-bed truck broke down on the Sharjah bypass. Responsible: Company', 'red'),
        tl('2026-09-18T15:40', 'Trip cancelled', 'The truck was towed to the workshop, the collection is re-booked with an external transporter', 'red')] }),
    ownDone('tr26', 26, 'so17', 'Delivery', D('dl19', 'DO-26-00137'), 'he22', '2026-09-28T08:30', '2026-09-28T12:50', [['Fuel', 140], ['Parking', 30]]),
    tr('tr27', 27, sx('so35'), 'Delivery', D('dl37', 'DO-26-00155'), { date: '2026-09-30T07:30', status: 'En Route', since: '2026-09-30T08:10', ...VEH.he42,
      log: [tl('2026-09-30T07:30', 'Trip created', 'Abu Dhabi 12 45118, Jomon Varghese'), tl('2026-09-30T08:10', 'Trip started', undefined, 'blue')] }),
    tr('tr28', 28, sx('so24'), 'Collection', D('rt6', 'CN-26-00118'), { date: '2026-09-30T10:00', status: 'Stuck-Delayed', since: '2026-09-30T11:35', ...VEH.he84, stuck: { reason: 'Site gate is closed to vehicles until the client issues the security pass', responsible: 'Client', since: '2026-09-30T11:35' },
      log: [tl('2026-09-30T10:00', 'Trip created', 'Retry after the failed collection of 9 September: Dubai T 92318, Joseph Mathew'), tl('2026-09-30T10:20', 'Trip started', undefined, 'blue'), tl('2026-09-30T11:35', 'Marked Stuck-Delayed', 'Site gate is closed to vehicles until the client issues the security pass. Responsible: Client', 'red')] }),
    extTrip('tr29', 29, 'so37', 'Delivery', D('dl42', 'DO-26-00160'), 'Gulf Petroleum Distribution LLC', '2026-09-30T15:30', 'Assigned', 450, '2026-09-30T13:05', 'Tanker from the supplier-held depot'),
    extTrip('tr30', 30, 'so44', 'Delivery', D('dl41', 'DO-26-00159'), 'Al Safeer Heavy Transport', '2026-10-01T08:00', 'Assigned', 900, '2026-09-30T16:00', 'Departs once the export declaration is cleared'),
    extTrip('tr31', 31, 'so25', 'Collection', D('rt5', 'CN-26-00131'), 'Al Safeer Heavy Transport', '2026-10-01T06:30', 'Assigned', 2400, '2026-09-30T09:20', 'Re-booked after the breakdown on 18 September'),
    tr('tr32', 32, sx('so20'), 'Collection', D('rt7', 'CN-26-00144'), { date: '2026-10-03T09:00', status: 'Assigned', since: '2026-09-29T15:10', ...VEH.he43,
      log: [tl('2026-09-29T15:10', 'Trip created', 'Booked in advance for the end of the contract: Dubai M 77042, Vijay Reddy, planned 2026-10-03 09:00')] }),
  ];
  tripSeed.push(...newTrips);
  /* an order's logistics cost is the sum of its trips (also for the trips added here) */
  orderSeed.forEach((o) => { const t = tripSeed.filter((x) => x.soId === o.id && x.status !== 'Cancelled'); if (t.length) o.logisticsCost = t.reduce((n, x) => n + tripTotal(x), 0); });

  /* ---------------------------------------------------------------- CRM masters: a few more realistic values (appended, nothing removed or reordered) */
  const more = (key: string, ...values: string[]) => values.forEach((v) => { if (!MASTER_SEED[key].includes(v)) MASTER_SEED[key].push(v); });
  more('leadSource', 'Exhibition', 'Existing Customer', 'Tender Portal');
  more('lostReason', 'Budget Cut', 'Project Cancelled', 'Credit Not Approved');
  more('industry', 'Healthcare', 'Data Centres', 'Marine', 'Agriculture');
  more('delayReason', 'Access road closed', 'Client crane not available');
  more('replacementReason', 'Scheduled Service', 'Noise Complaint');
  more('docTemplate', 'Arabic and English format');
}
// ==== END OPS SEED ====

export function seedAll() {
  seedCollection(COL.fleet, heavySeed); seedCollection(COL.pricing, pricingSeed); seedCollection(COL.masters, masterSeed);
  seedCollection(COL.leads, leadSeed); seedCollection(COL.opps, oppSeed); seedCollection(COL.quotes, quoteSeed); seedCollection(COL.orders, orderSeed);
  seedCollection(COL.deliveries, deliverySeed); seedCollection(COL.returns, returnSeed); seedCollection(COL.replacements, replacementSeed);
  seedCollection(COL.extensions, extensionSeed); seedCollection(COL.crossHire, crossHireSeed); seedCollection(COL.chRequests, chRequestSeed); seedCollection(COL.chRfqs, chRfqSeed); seedCollection(COL.jobCards, jobCardSeed); seedCollection(COL.trips, tripSeed);
}
seedAll();
