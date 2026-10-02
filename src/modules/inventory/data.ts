import dayjs from 'dayjs';
import { getCollection } from '@/store/store';
import { equipmentGroups, itemMaster, locations, employees, customers, ASSET_STATUSES, COMPANY, type ItemMaster } from '@/mock-data/masters';

export const TODAY = '2026-09-30';
export const NOW = '2026-09-30T12:00';

export const PRODUCT_CLASSIFICATIONS = ['Inventory', 'Rental', 'AMC', 'Fuel Trading', 'Trading'] as const;
export const TRACKING_METHODS = [
  { value: 'Serialized', label: 'Serialized (Unique Asset ID)' },
  { value: 'Quantity', label: 'Quantity' },
  { value: 'Length', label: 'Length (or other unit of measure)' },
];
export const ITEM_TYPES = ['Inventory', 'Non Inventory', 'Assembly (Finished product)', 'Service', 'Package', 'Inventory Fixed Asset', 'Heavy Equipment Fixed Asset'];
export const UOMS = ['Nos', 'Meter', 'Litre', 'Drum', 'Visit', 'Job', 'Kg', 'Set'];
export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
export const OWNERSHIP = ['Owned', 'Cross-Hired', 'Spare-Standby'];
export const DEPRECIATION_METHODS = ['Straight line', 'Declining'];
export const COMPUTATIONS = ['Constant periods', 'Based on days per period'];
/** Asset Type master (2 Oct call: client-specific, not a fixed list). The seed rows are demo data and can be edited, deactivated or extended. */
export interface AssetTypeRec { id: string; name: string; description: string; status: 'Active' | 'Inactive' }
export const assetTypeSeed: AssetTypeRec[] = [
  { id: 'at1', name: 'Plant & Machinery', description: 'Engines, workshop machinery and other plant', status: 'Active' },
  { id: 'at2', name: 'Vehicles', description: 'Delivery and support vehicles', status: 'Active' },
  { id: 'at3', name: 'Power Equipment', description: 'Generators and power distribution equipment', status: 'Active' },
  { id: 'at4', name: 'Containers & Shelters', description: 'Power containers (PODs) and shelters', status: 'Active' },
  { id: 'at5', name: 'Tools & Accessories', description: 'Trolleys, trays and small accessories', status: 'Active' },
];
export const MOVEMENT_TYPES = ['Delivery', 'Return', 'Internal Transfer', 'Sent for Repair', 'Cross-Hire Stage Change'];
export const ATTRIBUTE_TYPES = ['Text', 'Number', 'Date', 'Picklist'];
export const BRANDS = ['Cummins', 'Perkins', 'Mercedes', 'Volvo', 'Isuzu', 'Emirates Cable & Panel', 'Local'];
export { ASSET_STATUSES };
export const ACCOUNTS = {
  fixedAsset: ['120100 Fixed Assets: Plant & Machinery', '120200 Fixed Assets: Vehicles', '120300 Fixed Assets: Power Equipment'],
  depreciation: ['120190 Accumulated Depreciation: Plant & Machinery', '120290 Accumulated Depreciation: Vehicles', '120390 Accumulated Depreciation: Power Equipment'],
  expense: ['510200 Depreciation Expense', '510210 Depreciation Expense: Vehicles'],
  insurance: ['520100 Insurance Expense', '120500 Prepaid Insurance'],
  journals: ['Depreciation Journal', 'Fixed Asset Journal'],
};
export const DEPARTMENTS = Array.from(new Set(employees.map((e) => e.department))).sort();
export const LOCATION_NAMES = locations.map((l) => l.name);
/** Places a movement can start from or end at: own yards, client / project sites, cross-hire suppliers and the workshop. */
export const MOVEMENT_PLACES = [...LOCATION_NAMES, ...customers.filter((c) => c.type === 'Company').map((c) => `Client: ${c.name}`), 'Supplier: Falcon Equipment Hire LLC', 'Supplier: Gulf Genset Rentals', 'Workshop: Al Masaood Service Centre'];
export { COMPANY };

/* ------------------------------------------------------------------ category master (existing Item Category + new) */
export interface AttributeDef { id: string; name: string; type: string; options: string; required: boolean }
export interface CategoryRec {
  /** parent is '-' for a Category; a Sub-Category names its parent Category. */
  id: string; name: string; parent: string; status: 'Active' | 'Inactive';
  brand?: string; description?: string; skuPrefix?: string; uniqueItems?: number; attributes: AttributeDef[]; depMethod?: string;
}
const EXTRA_CATEGORIES = ['Spare Part', 'Consumable', 'Fuel', 'Service'];
const PREFIX: Record<string, string> = { Generator: 'GEN', Cable: 'CBL', Panel: 'PNL', POD: 'POD', Trolley: 'TRL', Tray: 'TRY', 'Day Tank': 'DTK', 'Spare Engine': 'SPE', Vehicle: 'VEH', 'Spare Part': 'SPR', Consumable: 'CON', Fuel: 'FUL', Service: 'SRV' };
const ATTRS: Record<string, AttributeDef[]> = {
  Generator: [
    { id: 'at-g1', name: 'Fuel Type', type: 'Picklist', options: 'Diesel, Gas', required: true },
    { id: 'at-g2', name: 'Phase', type: 'Picklist', options: 'Single Phase, Three Phase', required: true },
  ],
  Cable: [
    { id: 'at-c1', name: 'Number of Cores', type: 'Number', options: '', required: true },
    { id: 'at-c2', name: 'Length per Drum (m)', type: 'Number', options: '', required: false },
  ],
  Panel: [{ id: 'at-p1', name: 'Rated Current (A)', type: 'Number', options: '', required: false }],
};
export const categorySeed: CategoryRec[] = [
  ...equipmentGroups.flatMap((g, gi) => [
    { id: `cat${gi + 1}`, name: g.group, parent: '-', status: 'Active' as const, skuPrefix: PREFIX[g.group], uniqueItems: 1, description: `${g.group} equipment and accessories`, attributes: ATTRS[g.group] ?? [], depMethod: g.group === 'Vehicle' ? 'Declining' : undefined },
    ...g.categories.map((c, ci) => ({ id: `cat${gi + 1}-${ci + 1}`, name: c, parent: g.group, status: 'Active' as const, skuPrefix: `${PREFIX[g.group]}${ci + 1}`, uniqueItems: 1, attributes: [] as AttributeDef[] })),
  ]),
  ...EXTRA_CATEGORIES.map((n, i) => ({ id: `catx${i + 1}`, name: n, parent: '-', status: 'Active' as const, skuPrefix: PREFIX[n], uniqueItems: 1, attributes: [] as AttributeDef[] })),
];
export const isTopCategory = (r: Pick<CategoryRec, 'parent'>) => !r.parent || r.parent === '-';
/** Active categories. The current value is kept in the list so an existing record still shows its category. */
export const categoryOptions = (rows: CategoryRec[], current?: string) => {
  const names = rows.filter((r) => isTopCategory(r) && r.status === 'Active').map((r) => r.name);
  return current && !names.includes(current) ? [...names, current] : names;
};
export const topCategories = (rows: CategoryRec[]) => rows.filter((r) => isTopCategory(r) && r.status === 'Active').map((r) => r.name);
export const subCategoriesOf = (rows: CategoryRec[], category?: string) => (category ? rows.filter((r) => r.parent === category && r.status === 'Active').map((r) => r.name) : []);
/** Custom attributes defined on the Category plus those defined on the selected Sub-Category. */
export const attributesFor = (rows: CategoryRec[], category?: string, sub?: string): AttributeDef[] => [
  ...(rows.find((r) => isTopCategory(r) && r.name === category)?.attributes ?? []),
  ...(sub ? rows.find((r) => r.parent === category && r.name === sub)?.attributes ?? [] : []),
];

/* ------------------------------------------------------------------ pricing master */
/**
 * Pricing master. A Rental price is one record per Category / Sub-Category that holds a price for EVERY billing frequency:
 * the user enters one frequency's price, the others are calculated from it and can be changed by hand. Trading (sales)
 * prices are a single sales price with no frequency.
 */
export const PRICING_ACTIVITIES = ['Rental', 'Trading'] as const;
export type PricingActivity = (typeof PRICING_ACTIVITIES)[number];
export interface PricingRec {
  id: string; activity: PricingActivity; category: string; subCategory: string; description: string;
  /** Trading: the sales price. Rental: the price entered for baseFrequency. */
  price: number;
  /** Rental only: the billing frequency the user entered the price for */
  frequency?: string;
  /** Rental only: price per billing frequency, all frequencies stored */
  prices?: Record<string, number>;
  /** Rental only: frequencies whose calculated price was changed by hand */
  edited?: string[];
}
/** Days each billing frequency stands for: 1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months, 1 year = 12 months. */
export const FREQ_DAYS: Record<string, number> = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Yearly: 360 };
/** Prices for every billing frequency calculated from one frequency's price, rounded to 2 decimals. */
export const deriveFrequencyPrices = (price: number, frequency: string): Record<string, number> =>
  Object.fromEntries(FREQUENCIES.map((fq) => [fq, Math.round(((price / FREQ_DAYS[frequency]) * FREQ_DAYS[fq]) * 100) / 100]));
const rp = (id: string, category: string, subCategory: string, frequency: string, price: number, description: string, overrides: Record<string, number> = {}): PricingRec =>
  ({ id, activity: 'Rental', category, subCategory, frequency, price, description, prices: { ...deriveFrequencyPrices(price, frequency), ...overrides }, edited: Object.keys(overrides) });
const tp = (id: string, category: string, subCategory: string, price: number, description: string): PricingRec => ({ id, activity: 'Trading', category, subCategory, price, description });
export const pricingSeed: PricingRec[] = [
  rp('pr1', 'Generator', '100 KVA', 'Monthly', 18500, 'Rental 100 KVA generator', { Weekly: 5200 }),
  rp('pr3', 'Generator', '200 KVA', 'Monthly', 29500, 'Rental 200 KVA generator'),
  rp('pr4', 'Generator', '500 KVA', 'Monthly', 52000, 'Rental 500 KVA generator'),
  rp('pr5', 'Generator', '1000 KVA', 'Monthly', 98000, 'Rental 1000 KVA generator'),
  rp('pr6', 'Cable', '4 Core 185 mm', 'Monthly', 14, 'Rental power cable, per meter'),
  rp('pr7', 'Panel', 'ATS Panel', 'Monthly', 6800, 'Rental ATS panel'),
  rp('pr8', 'POD', '20 ft POD', 'Monthly', 7500, 'Rental 20 ft power container'),
  rp('pr9', 'Vehicle', 'Low-bed Truck', 'Daily', 2400, 'Low-bed truck with driver'),
  tp('pr10', 'Generator', '100 KVA', 165000, 'New 100 KVA diesel generator, sale price'),
  tp('pr11', 'Panel', 'ATS Panel', 61000, 'ATS panel 630A, sale price'),
  tp('pr12', 'Cable', '4 Core 185 mm', 95, 'Power cable 4C x 185 mm, sale price per meter'),
];

/* ------------------------------------------------------------------ items (existing Item Master + new fields) */
export interface ItemRec extends ItemMaster {
  type: string; sku: string; status: 'Active' | 'Inactive';
  costingMethod?: string; traceability?: string; useBins?: boolean; costPrice?: number;
  brand?: string; model?: string; engineNo?: string; capacity?: string;
  purchaseDate?: string; assetValue?: number; nbv?: number; deprPct?: number; deprAmount?: number; capex?: number;
  image?: string; attachments?: string[]; attrs?: Record<string, string>;
}
const SERIAL_SEED: Record<string, Partial<ItemRec>> = {
  i1: { brand: 'Cummins', model: 'C100D5', engineNo: 'CUM-4BT-44102', capacity: '100 KVA', purchaseDate: '2024-02-10', assetValue: 165000, nbv: 138000, deprPct: 16.36, deprAmount: 27000, capex: 165000, attachments: ['Cummins-C100D5-datasheet.pdf'], attrs: { 'at-g1': 'Diesel', 'at-g2': 'Three Phase' } },
  i2: { brand: 'Cummins', model: 'C500D5', engineNo: 'CUM-QSX15-88231', capacity: '500 KVA', purchaseDate: '2023-06-01', assetValue: 520000, nbv: 401000, deprPct: 22.88, deprAmount: 119000, capex: 520000, attrs: { 'at-g1': 'Diesel', 'at-g2': 'Three Phase' } },
  i7: { attrs: { 'at-c1': '4', 'at-c2': '100' } },
  i11: { brand: 'Emirates Cable & Panel', model: 'ATS-630', engineNo: 'N/A', capacity: '630 A', purchaseDate: '2025-01-20', assetValue: 48000, nbv: 41500, deprPct: 13.54, deprAmount: 6500, capex: 48000, attrs: { 'at-p1': '630' } },
};
/** Stock held per item per location. The item's own stock is the total of its rows, so a count at one location only moves that location. */
export interface LocationStock { id: string; itemId: string; location: string; qty: number; /** quantity consumed or sold from this location so far (Supplier-Held Locations) */ consumed?: number }
const FUEL_DEPOT = 'ENOC Al Quoz Depot (Fuel Stock)';
// [item id, Jebel Ali Main Yard, Sharjah Yard, Abu Dhabi Mussafah Yard]. Jebel Ali keeps the original figures so the earlier count sessions still match.
const YARD_STOCK: [string, number, number, number][] = [
  ['i3', 14, 6, 4], ['i4', 41, 20, 12], ['i5', 6, 4, 2], ['i6', 18, 8, 5], ['i7', 1800, 600, 400], ['i12', 9, 3, 2],
];
export const locationStockSeed: LocationStock[] = [
  ...YARD_STOCK.flatMap(([itemId, a, b, c]) => [
    { id: `ls-${itemId}-1`, itemId, location: 'Jebel Ali Main Yard', qty: a },
    { id: `ls-${itemId}-2`, itemId, location: 'Sharjah Yard', qty: b },
    { id: `ls-${itemId}-3`, itemId, location: 'Abu Dhabi Mussafah Yard', qty: c },
  ]),
  { id: 'ls-i8-4', itemId: 'i8', location: FUEL_DEPOT, qty: 21500, consumed: 38500 },
];
const stockTotal = (itemId: string, fallback: number) => {
  const rows = locationStockSeed.filter((r) => r.itemId === itemId);
  return rows.length ? rows.reduce((t, r) => t + r.qty, 0) : fallback;
};
export const itemSeed: ItemRec[] = itemMaster.map((m) => ({
  ...m,
  stock: stockTotal(m.id, m.stock),
  type: m.id === 'i1' || m.id === 'i2' ? 'Inventory Fixed Asset' : m.category === 'Service' ? 'Service' : 'Inventory',
  sku: m.code.replace('ITM', 'SKU'),
  status: m.id === 'i4' ? 'Inactive' : 'Active',
  costingMethod: 'Average Cost',
  traceability: m.tracking === 'Serialized' ? 'Serial Number Tracking' : 'No Tracking',
  useBins: m.tracking === 'Quantity' && !!m.spare,
  costPrice: Math.round(m.price * 0.72 * 100) / 100,
  ...SERIAL_SEED[m.id],
}));

/** Next sequential Item Code across the item master and Heavy Equipment records. */
export function nextItemCode(...codeLists: string[][]): string {
  const max = codeLists.flat().reduce((mx, c) => Math.max(mx, Number(c.replace(/\D/g, '')) || 0), 0);
  return `ITM-${String(max + 1).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ heavy equipment (serialized asset) */
export interface InsuranceEntry { amount: string; date: string; dueDate: string; account: string }
export interface Movement { id: string; entryNo: string; date: string; type: string; from: string; to: string; reference: string; by: string }
export interface AuditEntry { when: string; title: string; detail?: string; by: string }
export interface HeavyRec {
  id: string; code: string; assetId: string; name: string; classification: string; tracking: 'Serialized'; category: string; subCategory: string;
  brand: string; model: string; engineNo: string; capacity: string; specification: string; assetType: string;
  purchaseDate: string; putToUseDate: string; assetValue: number; notDepreciable: number; nbv: number; deprPct: number; deprAmount: number; capex: number;
  department: string; company: string; status: 'Active' | 'Inactive'; assetStatus: string;
  method: string; decliningFactor: number; computation: string; usefulLifeYears: number; usefulLifeHours?: number; accFixedAsset: string; accDepreciation: string; accExpense: string; journal: string;
  ownership: string; supplier: string; crossHireIdle: boolean; insurance: InsuranceEntry[]; movements: Movement[]; audit: AuditEntry[];
  /** Present when Asset Status was last set by hand (not by delivery, return, cross-hire or disposal). */
  statusOverride?: { by: string; when: string; reason: string };
  utilization: number; idleDays: number; profitability: number; attrs: Record<string, string>;
  image?: string; attachments: string[];
}

/** Derived, never stored: current location is the destination of the latest Movement History entry. */
export const currentLocation = (r: Pick<HeavyRec, 'movements'>) => [...r.movements].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]?.to ?? '-';
/** Derived from the Unified Asset Status: units physically in the yard count as in stock. */
export const stockStatusOf = (r: Pick<HeavyRec, 'assetStatus'>): 'In Stock' | 'Out of Stock' => (['Ready for Hire', 'Yard', 'Off Hire'].includes(r.assetStatus) ? 'In Stock' : 'Out of Stock');
export const depreciationApplicable = (ownership: string) => ownership !== 'Cross-Hired';
export const inFleetCount = (r: Pick<HeavyRec, 'ownership' | 'assetStatus'>) => r.ownership === 'Owned' && r.assetStatus !== 'On Hire' && r.assetStatus !== 'Disposed';
/** Duration from this entry to the next one, or to now for the latest entry. */
export function movementDurations(rows: Movement[]): Record<string, string> {
  const s = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const out: Record<string, string> = {};
  s.forEach((m, i) => {
    const end = s[i + 1]?.date ?? NOW;
    const days = Math.max(0, dayjs(end).diff(dayjs(m.date), 'day'));
    out[m.id] = days >= 60 ? `${Math.round(days / 30)} months` : `${days} day${days === 1 ? '' : 's'}`;
  });
  return out;
}
export const nextMovementNo = (n: number) => `MV-26-${String(n).padStart(5, '0')}`;

/** Trivial mock depreciation board: straight line or simple declining balance. Real entries are generated by the backend. */
export interface BoardRow { id: string; period: number; date: string; depreciation: number; accumulated: number; nbv: number; status: 'Posted' | 'Scheduled' }
export function buildBoard(p: { start?: string; assetValue: number; notDepreciable: number; months: number; method: string; factor: number }): BoardRow[] {
  const { assetValue, notDepreciable, months, method, factor } = p;
  if (!p.start || !assetValue || !months || months < 1) return [];
  const base = Math.max(assetValue - notDepreciable, 0);
  const rows: BoardRow[] = [];
  let open = assetValue, acc = 0;
  for (let i = 1; i <= Math.min(months, 240); i++) {
    const remaining = open - notDepreciable;
    const raw = method === 'Declining' ? Math.min(remaining, (open * (factor || 1.5)) / Math.max(months / 12, 1) / 12) : base / months;
    const dep = i === months ? remaining : Math.round(raw * 100) / 100;
    acc += dep; open -= dep;
    const date = dayjs(p.start).add(i, 'month').endOf('month').format('YYYY-MM-DD');
    rows.push({ id: `b${i}`, period: i, date, depreciation: Math.round(dep * 100) / 100, accumulated: Math.round(acc * 100) / 100, nbv: Math.round(open * 100) / 100, status: date <= TODAY ? 'Posted' : 'Scheduled' });
  }
  return rows;
}

interface Seed { n: number; name: string; category: string; sub: string; brand: string; model: string; engine: string; capacity: string; purchase: string; value: number; years: number; loc: string; dept: string; ownership?: string; crossHire?: { supplier: string; idle?: boolean }; out?: { site: string; date: string }; retired?: boolean; repair?: boolean; assetType: string; spec: string; util: number }
const SEEDS: Seed[] = [
  { n: 13, name: 'Diesel Generator 200 KVA Perkins 1106A', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70418', capacity: '200 KVA', purchase: '2022-03-15', value: 245000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Gulf Build Contracting', date: '2026-07-04T09:30' }, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz, prime rating', util: 78 },
  { n: 14, name: 'Diesel Generator 200 KVA Cummins C200D5', category: 'Generator', sub: '200 KVA', brand: 'Cummins', model: 'C200D5', engine: 'CUM-6CTA-55027', capacity: '200 KVA', purchase: '2021-09-01', value: 260000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', repair: true, assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 3 phase, 50 Hz', util: 64 },
  { n: 15, name: 'Diesel Generator 500 KVA Cummins C500D5', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88231', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Dubai Metro Works JV', date: '2026-04-12T08:00' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 86 },
  { n: 16, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 2)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88262', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Sharjah Cement Company', date: '2026-02-20T10:15' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 82 },
  { n: 17, name: 'Diesel Generator 500 KVA Perkins 2506C', category: 'Generator', sub: '500 KVA', brand: 'Perkins', model: '2506C', engine: 'PRK-2506C-31190', capacity: '500 KVA', purchase: '2022-11-10', value: 505000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 50 Hz', util: 58 },
  { n: 18, name: 'Diesel Generator 1000 KVA Cummins C1000D5', category: 'Generator', sub: '1000 KVA', brand: 'Cummins', model: 'C1000D5', engine: 'CUM-KTA50-92017', capacity: '1000 KVA', purchase: '2024-08-05', value: 980000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Dubai Metro Works JV', date: '2026-05-18T07:45' }, assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 91 },
  { n: 19, name: 'Diesel Generator 1500 KVA Cummins C1500D5', category: 'Generator', sub: '1500 KVA', brand: 'Cummins', model: 'C1500D5', engine: 'CUM-QSK60-10452', capacity: '1500 KVA', purchase: '2025-10-12', value: 1450000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 11 kV ready, 50 Hz', util: 35 },
  { n: 20, name: 'Diesel Generator 100 KVA Perkins P100 (Standby)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: 'P100', engine: 'PRK-1104D-22890', capacity: '100 KVA', purchase: '2022-01-20', value: 150000, years: 10, loc: 'Abu Dhabi Mussafah Yard', dept: 'Operations', ownership: 'Spare-Standby', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 12 },
  { n: 21, name: 'Low-bed Truck Mercedes Actros 3340', category: 'Vehicle', sub: 'Low-bed Truck', brand: 'Mercedes', model: 'Actros 3340', engine: 'MB-OM471-60318', capacity: '40 Ton', purchase: '2021-02-14', value: 420000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', assetType: 'Vehicles', spec: '6x4 tractor unit with hydraulic ramp low-bed trailer', util: 71 },
  { n: 22, name: 'Low-bed Truck Volvo FM 440', category: 'Vehicle', sub: 'Low-bed Truck', brand: 'Volvo', model: 'FM 440', engine: 'VOL-D13K-41672', capacity: '45 Ton', purchase: '2022-05-09', value: 445000, years: 8, loc: 'Sharjah Yard', dept: 'Logistics', assetType: 'Vehicles', spec: '6x4 tractor unit with low-bed trailer', util: 64 },
  { n: 23, name: 'Flatbed Truck Isuzu FTR 34', category: 'Vehicle', sub: 'Flatbed Truck', brand: 'Isuzu', model: 'FTR 34', engine: 'ISZ-6HK1-19540', capacity: '12 Ton', purchase: '2020-07-22', value: 210000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', repair: true, assetType: 'Vehicles', spec: 'Flatbed body with tie-down rails', util: 55 },
  { n: 24, name: 'POD 20 ft Power Container', category: 'POD', sub: '20 ft POD', brand: 'Emirates Cable & Panel', model: 'POD-20', engine: 'N/A', capacity: '20 ft', purchase: '2023-03-30', value: 70000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Gulf Build Contracting', date: '2026-06-01T11:00' }, assetType: 'Containers & Shelters', spec: 'Insulated 20 ft container with cable entry glands', util: 74 },
  { n: 25, name: 'Perkins Spare Engine 2506C-E15', category: 'Spare Engine', sub: 'Perkins Spare Engine', brand: 'Perkins', model: '2506C-E15', engine: 'PRK-2506E-00781', capacity: '500 kW', purchase: '2024-01-16', value: 120000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Workshop', ownership: 'Spare-Standby', assetType: 'Plant & Machinery', spec: 'Complete long engine assembly held as standby', util: 5 },
  { n: 27, name: 'Diesel Generator 500 KVA Falcon Cross-Hire', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'CH-500', engine: 'CUM-QSX15-70451', capacity: '500 KVA', purchase: '2026-05-02', value: 0, years: 0, loc: 'Jebel Ali Main Yard', dept: 'Operations', crossHire: { supplier: 'Falcon Equipment Hire LLC' }, out: { site: 'Client: Al Noor Events Management', date: '2026-05-06T09:00' }, assetType: 'Power Equipment', spec: 'Cross-hired unit, open skid, 415 V, 50 Hz', util: 88 },
  { n: 28, name: 'Diesel Generator 200 KVA Gulf Genset Cross-Hire', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: 'CH-200', engine: 'PRK-1106A-90211', capacity: '200 KVA', purchase: '2026-06-10', value: 0, years: 0, loc: 'Sharjah Yard', dept: 'Operations', crossHire: { supplier: 'Gulf Genset Rentals', idle: true }, assetType: 'Power Equipment', spec: 'Cross-hired unit, canopy type, 415 V, 50 Hz', util: 22 },
  { n: 26, name: 'Diesel Generator 200 KVA Perkins 1106A (Retired)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-41005', capacity: '200 KVA', purchase: '2015-05-10', value: 240000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 0 },
];

function fromSeed(s: Seed): HeavyRec {
  const ch = s.crossHire;
  const board = buildBoard({ start: s.purchase, assetValue: s.value, notDepreciable: 0, months: s.years * 12, method: 'Straight line', factor: 0 });
  const posted = board.filter((b) => b.status === 'Posted');
  const last = posted[posted.length - 1];
  const nbv = s.retired ? 0 : last ? Math.round(last.nbv) : s.value;
  const depr = s.value - nbv;
  const acc = s.assetType === 'Vehicles' ? 1 : s.assetType === 'Power Equipment' ? 2 : 0;
  let k = 0;
  const mv = (date: string, type: string, from: string, to: string, reference: string, by: string): Movement => ({ id: `m${s.n}-${k}`, entryNo: nextMovementNo(s.n * 10 + k++), date, type, from, to, reference, by });
  const movements: Movement[] = [mv(`${s.purchase}T10:00`, ch ? 'Cross-Hire Stage Change' : 'Internal Transfer', ch ? `Supplier: ${ch.supplier}` : 'Purchase Receipt', 'Jebel Ali Main Yard', `GRN-${s.purchase.slice(2, 4)}-${String(s.n * 7).padStart(5, '0')}`, 'Sanjay Kumar')];
  if (s.loc !== 'Jebel Ali Main Yard' && !ch) movements.push(mv('2025-03-10T14:00', 'Internal Transfer', 'Jebel Ali Main Yard', s.loc, `IT-25-${String(s.n).padStart(5, '0')}`, 'Sanjay Kumar'));
  if (s.repair) {
    movements.push(mv('2026-03-02T09:00', 'Sent for Repair', s.loc, 'Workshop: Al Masaood Service Centre', `JC-26-${String(s.n * 3).padStart(5, '0')}`, 'Grace Fernandez'));
    movements.push(mv('2026-03-19T16:30', 'Return', 'Workshop: Al Masaood Service Centre', s.loc, `JC-26-${String(s.n * 3).padStart(5, '0')}`, 'Grace Fernandez'));
  }
  if (ch && s.loc !== 'Jebel Ali Main Yard') movements.push(mv('2026-06-10T15:00', 'Cross-Hire Stage Change', 'Jebel Ali Main Yard', s.loc, `CH-26-${String(s.n)}`, 'Sanjay Kumar'));
  if (s.out) movements.push(mv(s.out.date, 'Delivery', 'Jebel Ali Main Yard', s.out.site, `DN-26-${String(s.n * 11).padStart(5, '0')}`, 'Grace Fernandez'));
  const ownership = ch ? 'Cross-Hired' : s.ownership ?? 'Owned';
  const assetStatus = s.retired ? 'Disposed' : ch?.idle ? 'Yard' : s.out ? 'On Hire' : s.repair ? 'Under Maintenance' : ownership === 'Spare-Standby' ? 'Yard' : 'Ready for Hire';
  const putToUse = dayjs(s.purchase).add(14, 'day').format('YYYY-MM-DD');
  return {
    id: `he${s.n}`, code: `ITM-${String(s.n).padStart(4, '0')}`, assetId: `AST-${1000 + s.n}`, name: s.name, classification: 'Rental', tracking: 'Serialized',
    category: s.category, subCategory: s.sub, brand: s.brand, model: s.model, engineNo: s.engine, capacity: s.capacity, specification: s.spec, assetType: s.assetType,
    purchaseDate: s.purchase, putToUseDate: putToUse, assetValue: s.value, notDepreciable: 0, nbv, deprPct: s.value ? Math.round((depr / s.value) * 10000) / 100 : 0, deprAmount: depr, capex: s.value,
    department: s.dept, company: COMPANY, status: s.retired ? 'Inactive' : 'Active', assetStatus,
    method: 'Straight line', decliningFactor: 0, computation: 'Constant periods', usefulLifeYears: s.years, usefulLifeHours: s.category === 'Generator' ? 40000 : undefined,
    accFixedAsset: ACCOUNTS.fixedAsset[acc], accDepreciation: ACCOUNTS.depreciation[acc], accExpense: ACCOUNTS.expense[s.assetType === 'Vehicles' ? 1 : 0], journal: ACCOUNTS.journals[0],
    ownership, supplier: ch?.supplier ?? '', crossHireIdle: !!ch?.idle,
    insurance: ch ? [] : s.assetType === 'Vehicles' ? [{ amount: '6800', date: '2026-01-15', dueDate: '2027-01-14', account: ACCOUNTS.insurance[0] }] : s.retired ? [] : [{ amount: String(Math.round(s.value * 0.012)), date: '2026-01-01', dueDate: '2026-12-31', account: ACCOUNTS.insurance[0] }],
    movements, utilization: s.util, idleDays: Math.round((100 - s.util) * 2.7), profitability: ch ? (s.util > 50 ? 18400 : -2600) : Math.round(s.value * 0.22 * (s.util / 100) - s.value * 0.01),
    attrs: s.category === 'Generator' ? { 'at-g1': 'Diesel', 'at-g2': 'Three Phase' } : {},
    audit: [
      { when: `${s.purchase} 10:05`, title: 'Asset record created', detail: `Asset ID AST-${1000 + s.n} generated`, by: 'Sanjay Kumar' },
      ...(ch ? [] : [{ when: `${putToUse} 09:00`, title: 'Depreciation started', detail: `${s.years} year useful life, Straight line`, by: 'System' }]),
      ...(s.out ? [{ when: s.out.date.replace('T', ' '), title: 'Asset Status changed', detail: 'Ready for Hire to On Hire', by: 'Grace Fernandez' }] : []),
    ],
    attachments: s.retired || ch ? [] : [`${s.model.replace(/\s/g, '-')}-purchase-invoice.pdf`],
  };
}
export const heavySeed: HeavyRec[] = SEEDS.map(fromSeed);

/* ------------------------------------------------------------------ cross-hire records (POC stand-in for the Procurement cross-hire transaction) */
/** Stages a cross-hired unit goes through. The asset's status follows the stage; it is not typed in. */
export const CROSS_HIRE_STAGES = ['Received', 'On Hire', 'Idle at Our Location', 'Returned to Supplier'] as const;
export type CrossHireStage = (typeof CROSS_HIRE_STAGES)[number];
export interface CrossHireRec {
  id: string; number: string; supplier: string; category: string; subCategory: string; brand: string; model: string; capacity: string; engineNo: string;
  receivedAt: string; hireStart: string; expectedReturn: string; monthlyRate: number; stage: CrossHireStage; returnedOn?: string; heavyId?: string;
}
/** Asset Status that each cross-hire stage puts the asset in. */
export const crossHireStatus: Record<CrossHireStage, string> = { Received: 'Ready for Hire', 'On Hire': 'On Hire', 'Idle at Our Location': 'Yard', 'Returned to Supplier': 'Off Hire' };
export const crossHireSeed: CrossHireRec[] = [
  { id: 'ch1', number: 'CH-26-00027', supplier: 'Falcon Equipment Hire LLC', category: 'Generator', subCategory: '500 KVA', brand: 'Cummins', model: 'CH-500', capacity: '500 KVA', engineNo: 'CUM-QSX15-70451', receivedAt: 'Jebel Ali Main Yard', hireStart: '2026-05-02', expectedReturn: '2026-11-30', monthlyRate: 21000, stage: 'On Hire', heavyId: 'he27' },
  { id: 'ch2', number: 'CH-26-00028', supplier: 'Gulf Genset Rentals', category: 'Generator', subCategory: '200 KVA', brand: 'Perkins', model: 'CH-200', capacity: '200 KVA', engineNo: 'PRK-1106A-90211', receivedAt: 'Sharjah Yard', hireStart: '2026-06-10', expectedReturn: '2026-10-15', monthlyRate: 12500, stage: 'Idle at Our Location', heavyId: 'he28' },
  { id: 'ch3', number: 'CH-26-00031', supplier: 'Falcon Equipment Hire LLC', category: 'Generator', subCategory: '1000 KVA', brand: 'Cummins', model: 'CH-1000', capacity: '1000 KVA', engineNo: 'CUM-KTA50-77310', receivedAt: 'Jebel Ali Main Yard', hireStart: '2026-09-28', expectedReturn: '2027-01-31', monthlyRate: 39000, stage: 'Received' },
];

/** Codes currently in use by Heavy Equipment records (live collection when loaded, seed otherwise). */
export const heavyCodes = () => {
  const live = getCollection<HeavyRec>('inventory.heavyEquipment');
  return (live.length ? live : heavySeed).map((h) => h.code);
};

/* ------------------------------------------------------------------ location master (existing + new) */
/** Location master (2 Oct call: Parent Location, Company and the address block removed; City kept). Stock figures are derived from location stock, never typed in. */
export interface LocationRec {
  id: string; code: string; name: string; shortName: string; type: string; supplierId?: string; city: string;
  inventoryAvailable: boolean; status: 'Active' | 'Inactive';
}
export const LOCATION_TYPES = ['Own Yard', 'Supplier-Held Location'];
export const locationSeed: LocationRec[] = locations.map((l) => ({
  id: l.id, code: l.code, name: l.name, type: l.type, supplierId: l.supplierId, city: l.city,
  shortName: l.name.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase(), inventoryAvailable: true, status: 'Active' as const,
}));
/** A quantity always shown with its unit, e.g. "21,500 Litres". */
export const qtyWithUnit = (qty: number, unit: string) => {
  const plural: Record<string, string> = { Nos: 'Nos', Meter: 'Meters', Litre: 'Litres', Drum: 'Drums', Visit: 'Visits', Job: 'Jobs', Kg: 'Kg', Set: 'Sets' };
  return `${qty.toLocaleString('en-US')} ${qty === 1 ? unit : plural[unit] ?? unit}`;
};

/* ------------------------------------------------------------------ certificates, usage readings, stock verification, disposal */
export const CERT_TYPES = ['Registration', 'Insurance', 'Inspection', 'Warranty', 'Other'];
export interface CertRec { id: string; assetId: string; type: string; reference: string; expiry: string; leadDays: number; file: string[]; history: AuditEntry[]; /** only used when certificate approval is switched on */ approval?: 'Pending Approval' | 'Approved' }
/** Client-level settings for the Inventory POC (one record). Certificate approval is optional and off by default. */
export interface InventorySettings { id: 'settings'; certApproval: boolean }
export const settingsSeed: InventorySettings[] = [{ id: 'settings', certApproval: false }];
const cert = (n: number, assetId: string, type: string, reference: string, expiry: string, leadDays: number): CertRec => ({ id: `ce${n}`, assetId, type, reference, expiry, leadDays, file: [`${type}-${assetId}.pdf`], history: [{ when: '2026-01-12 11:20', title: 'Certificate added', detail: `${type} valid to ${expiry}`, by: 'Sanjay Kumar' }] });
export const certSeed: CertRec[] = [
  cert(1, 'AST-1015', 'Insurance', 'POL-GEN-55012', '2026-12-31', 30), cert(2, 'AST-1015', 'Warranty', 'WR-CUM-88231', '2026-10-20', 30), cert(3, 'AST-1018', 'Insurance', 'POL-GEN-55044', '2026-12-31', 30),
  cert(4, 'AST-1021', 'Registration', 'DXB-TRK-44120', '2026-11-14', 45), cert(5, 'AST-1021', 'Inspection', 'RTA-INS-2026-771', '2026-10-08', 21), cert(6, 'AST-1022', 'Registration', 'SHJ-TRK-30982', '2026-09-18', 45),
  cert(7, 'AST-1023', 'Registration', 'DXB-TRK-39977', '2027-01-22', 45), cert(8, 'AST-1019', 'Warranty', 'WR-CUM-10452', '2027-10-12', 60), cert(9, 'AST-1013', 'Inspection', 'CIV-INS-66120', '2026-10-30', 30), cert(10, 'AST-1024', 'Insurance', 'POL-POD-21877', '2026-12-31', 30),
];
export interface ReadingRec { id: string; assetId: string; date: string; hmr: number; by: string; method: string; fuel?: number; notes: string }
export const READING_METHODS = ['Direct System Entry (on-site)', 'Paper, Entered Later'];
export const READING_FREQUENCY_DAYS = 30;
const rd = (n: number, assetId: string, date: string, hmr: number, by: string, method = READING_METHODS[0], fuel?: number, notes = ''): ReadingRec => ({ id: `rd${n}`, assetId, date, hmr, by, method, fuel, notes });
export const readingSeed: ReadingRec[] = [
  rd(1, 'AST-1015', '2026-09-22T08:30', 6480, 'Grace Fernandez', READING_METHODS[0], 72, 'Running normally'), rd(2, 'AST-1015', '2026-08-24T08:10', 6210, 'Grace Fernandez', READING_METHODS[0], 65),
  rd(3, 'AST-1018', '2026-09-15T09:00', 3120, 'Sanjay Kumar', READING_METHODS[1], 58, 'Paper log entered later'), rd(4, 'AST-1016', '2026-09-01T07:50', 5340, 'Grace Fernandez', READING_METHODS[0], 80),
  rd(5, 'AST-1013', '2026-08-02T10:10', 11890, 'Sanjay Kumar', READING_METHODS[0], 44, 'Oil top-up recommended'), rd(6, 'AST-1017', '2026-09-20T11:00', 7420, 'Grace Fernandez'), rd(7, 'AST-1014', '2026-07-10T09:30', 12640, 'Sanjay Kumar', READING_METHODS[0], 30, 'After repair, test run'),
  rd(8, 'AST-1019', '2026-09-25T14:00', 820, 'Grace Fernandez', READING_METHODS[0], 90), rd(9, 'AST-1024', '2026-09-05T12:00', 0, 'Sanjay Kumar'),
];
export interface CountLine { itemId: string; code: string; name: string; unit: string; systemQty: number; countedQty: number | null }
/** Count Type is not defined in the requirement document (rule to be confirmed with client). Sessions without a type are Stock Items counts. */
export const COUNT_TYPES = ['Stock Items', 'Fixed Assets'] as const;
export type CountType = (typeof COUNT_TYPES)[number];
/** 2 Oct call: a fixed asset is either Found or Not Found at the counted location (Found elsewhere removed). */
export const ASSET_RESULTS = ['Found', 'Not Found'] as const;
/** One expected unit in a Fixed Assets count: the assets whose current location (from Movement History) is the counted location. */
/** reason: free text, needed only when the asset is Not Found. */
export interface AssetCountLine { heavyId: string; assetId: string; name: string; category: string; ownership: string; expectedStatus: string; result: string | null; reason?: string }
/** reason: one free-text reason for the stock differences of the whole session (2 Oct call), not one per line. */
export interface CountSession { id: string; number: string; date: string; location: string; countedBy: string; status: 'In Progress' | 'Completed'; lines: CountLine[]; type?: CountType; assetLines?: AssetCountLine[]; reason?: string; confirmedBy?: string; adjustmentNo?: string; adjustmentStatus?: 'Pending Approval' | 'Approved' | 'Rejected'; log?: AuditEntry[] }
const al = (n: number, name: string, category: string, ownership: string, expectedStatus: string, result: string | null, reason?: string): AssetCountLine => ({ heavyId: `he${n}`, assetId: `AST-${1000 + n}`, name, category, ownership, expectedStatus, result, reason });
const ln = (id: string, code: string, name: string, unit: string, sys: number, counted: number | null): CountLine => ({ itemId: id, code, name, unit, systemQty: sys, countedQty: counted });
export const countSeed: CountSession[] = [
  { id: 'cs1', number: 'SCS-26-00001', date: '2026-08-31', location: 'Jebel Ali Main Yard', countedBy: 'Grace Fernandez', status: 'Completed', confirmedBy: 'Sanjay Kumar', adjustmentNo: 'ADJ-26-00014', adjustmentStatus: 'Approved', reason: 'Two oil filters short after shelf recount',
    log: [{ when: '2026-08-31 16:20', title: 'Stock Adjustment raised', detail: 'ADJ-26-00014 sent for approval', by: 'Grace Fernandez' }, { when: '2026-09-01 09:35', title: 'Approved', detail: 'System quantity corrected', by: 'Sanjay Kumar' }], lines: [
    ln('i3', 'ITM-0003', 'Oil Filter (Cummins C-Series)', 'Nos', 16, 14), ln('i4', 'ITM-0004', 'Fuel Filter (Perkins 1106)', 'Nos', 41, 41), ln('i5', 'ITM-0005', 'Battery 12V 200Ah', 'Nos', 6, 6), ln('i6', 'ITM-0006', 'Engine Oil 15W-40 (20 L)', 'Drum', 18, 18), ln('i12', 'ITM-0012', 'Air Filter (Perkins 2506)', 'Nos', 9, 9)] },
  { id: 'cs2', number: 'SCS-26-00002', date: '2026-09-28', location: 'Jebel Ali Main Yard', countedBy: 'Sanjay Kumar', status: 'Completed', confirmedBy: 'Grace Fernandez', adjustmentNo: 'ADJ-26-00021', adjustmentStatus: 'Pending Approval', reason: 'Two oil filters damaged in storage, one battery delivery not posted yet, cable drum recounted',
    log: [{ when: '2026-09-28 17:05', title: 'Stock Adjustment raised', detail: 'ADJ-26-00021 sent for approval', by: 'Sanjay Kumar' }], lines: [
    ln('i3', 'ITM-0003', 'Oil Filter (Cummins C-Series)', 'Nos', 14, 12), ln('i4', 'ITM-0004', 'Fuel Filter (Perkins 1106)', 'Nos', 41, 41), ln('i5', 'ITM-0005', 'Battery 12V 200Ah', 'Nos', 6, 7), ln('i6', 'ITM-0006', 'Engine Oil 15W-40 (20 L)', 'Drum', 18, 18), ln('i7', 'ITM-0007', 'Power Cable 4C x 185 mm', 'Meter', 1800, 1760)] },
  { id: 'cs3', number: 'SCS-26-00003', date: '2026-09-30', location: 'ENOC Al Quoz Depot (Fuel Stock)', countedBy: 'Sanjay Kumar', status: 'In Progress', lines: [ln('i8', 'ITM-0008', 'Diesel (Bulk)', 'Litre', 21500, null)] },
  { id: 'cs4', number: 'SCS-26-00004', date: '2026-09-15', location: 'Sharjah Yard', countedBy: 'Grace Fernandez', status: 'Completed', confirmedBy: 'Sanjay Kumar', adjustmentNo: 'ADJ-26-00018', adjustmentStatus: 'Rejected', reason: 'Two fuel filters could not be found',
    log: [{ when: '2026-09-15 15:40', title: 'Stock Adjustment raised', detail: 'ADJ-26-00018 sent for approval', by: 'Grace Fernandez' }, { when: '2026-09-16 10:10', title: 'Rejected', detail: 'System quantity unchanged', by: 'Sanjay Kumar' }],
    lines: [ln('i4', 'ITM-0004', 'Fuel Filter (Perkins 1106)', 'Nos', 20, 18), ln('i5', 'ITM-0005', 'Battery 12V 200Ah', 'Nos', 4, 4)] },
  { id: 'cs5', number: 'SCS-26-00005', date: '2026-09-29', location: 'Jebel Ali Main Yard', countedBy: 'Grace Fernandez', status: 'Completed', confirmedBy: 'Sanjay Kumar', type: 'Fixed Assets', lines: [], adjustmentNo: 'ADJ-26-00024', adjustmentStatus: 'Pending Approval',
    log: [{ when: '2026-09-29 18:10', title: 'Stock Adjustment raised', detail: 'ADJ-26-00024 sent for approval', by: 'Grace Fernandez' }],
    assetLines: [
      al(14, 'Diesel Generator 200 KVA Cummins C200D5', 'Generator', 'Owned', 'Under Maintenance', 'Found'),
      al(17, 'Diesel Generator 500 KVA Perkins 2506C', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(19, 'Diesel Generator 1500 KVA Cummins C1500D5', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(21, 'Low-bed Truck Mercedes Actros 3340', 'Vehicle', 'Owned', 'Ready for Hire', 'Not Found', 'Driver says it was taken to Sharjah Yard; transfer not recorded'),
      al(23, 'Flatbed Truck Isuzu FTR 34', 'Vehicle', 'Owned', 'Under Maintenance', 'Found'),
      al(25, 'Perkins Spare Engine 2506C-E15', 'Spare Engine', 'Spare-Standby', 'Yard', 'Not Found', 'Possibly sent to the workshop without a movement entry'),
    ] },
];
/** Rows for the Physical Stock Variance Report, built from the live count sessions (the seed sessions until the app has loaded them). */
export function countVarianceRows(): Record<string, any>[] {
  const live = getCollection<CountSession>('inventory.counts');
  return (live.length ? live : countSeed).filter((s) => s.status === 'Completed').flatMap((s) => [
    // Fixed Assets counts: one unit expected, so a unit not found at the counted location is a variance of -1 Nos.
    ...(s.assetLines ?? []).filter((l) => l.result === 'Not Found').map((l) => ({ session: s.number, date: s.date, location: s.location, item: `${l.assetId} - ${l.name} (Not Found)`, assetId: l.assetId, sys: qtyWithUnit(1, 'Nos'), counted: qtyWithUnit(0, 'Nos'), variance: '-1 Nos', varianceNum: -1, reason: l.reason ?? '-', adj: s.adjustmentNo ?? '-', status: s.adjustmentStatus ?? 'Not raised' })),
    ...s.lines.filter((l) => l.countedQty !== null && l.countedQty !== l.systemQty).map((l) => { const v = (l.countedQty as number) - l.systemQty; return { session: s.number, date: s.date, location: s.location, item: l.name, sys: qtyWithUnit(l.systemQty, l.unit), counted: qtyWithUnit(l.countedQty as number, l.unit), variance: `${v > 0 ? '+' : ''}${qtyWithUnit(v, l.unit)}`, varianceNum: v, reason: s.reason ?? '-', adj: s.adjustmentNo ?? '-', status: s.adjustmentStatus ?? 'Not raised' }; }),
  ]);
}
export const DISPOSAL_REASONS = ['End of Useful Life', 'Damaged Beyond Repair', 'Other'];
export const DISPOSAL_METHODS = ['Scrap', 'Sale'];
/** What happened after approval (2 Oct call): the sale or scrap outcome with its finance references (POC: reference numbers only, no accounting backend). */
export interface DisposalOutcome { date: string; buyer?: string; saleValue?: number; invoiceRef?: string; scrapRef?: string; journalRef: string; nbvAtDisposal: number; by: string }
export interface DisposalRec { id: string; number: string; assetId: string; reason: string; method: string; value: number; docs: string[]; status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'; date: string; log: AuditEntry[]; outcome?: DisposalOutcome }
export const disposalSeed: DisposalRec[] = [
  { id: 'dp1', number: 'DSP-26-00003', assetId: 'AST-1026', reason: 'End of Useful Life', method: 'Sale', value: 38000, docs: ['valuation-AST-1026.pdf'], status: 'Approved', date: '2026-03-12',
    outcome: { date: '2026-03-24', buyer: 'Khalid Bin Saeed (Farm Project)', saleValue: 38000, invoiceRef: 'INV-26-00118', journalRef: 'JV-26-00342', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-03-12 10:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-03-13 15:10', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-03-16 09:40', title: 'Approved', detail: 'Asset marked Disposed', by: 'Ahmed Al Khouri' }, { when: '2026-03-24 14:20', title: 'Sale completed', detail: 'Sold to Khalid Bin Saeed (Farm Project) for AED 38,000; Sales Invoice INV-26-00118; journal JV-26-00342', by: 'Priya Menon' }] },
  { id: 'dp2', number: 'DSP-26-00004', assetId: 'AST-1023', reason: 'Damaged Beyond Repair', method: 'Scrap', value: 0, docs: [], status: 'Pending Approval', date: '2026-09-24', log: [{ when: '2026-09-24 11:30', title: 'Request raised', by: 'Grace Fernandez' }, { when: '2026-09-24 11:45', title: 'Submitted for approval', by: 'Grace Fernandez' }] },
  { id: 'dp3', number: 'DSP-26-00005', assetId: 'AST-1014', reason: 'Other', method: 'Sale', value: 90000, docs: [], status: 'Rejected', date: '2026-07-02', log: [{ when: '2026-07-02 10:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-07-03 12:15', title: 'Rejected', detail: 'Unit returned to service after repair', by: 'Ahmed Al Khouri' }] },
];
