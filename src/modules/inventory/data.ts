import dayjs from 'dayjs';
import { getCollection } from '@/store/store';
import { equipmentGroups, itemMaster, locations, employees, customers, ASSET_STATUSES, COMPANY, type ItemMaster } from '@/mock-data/masters';

/** Real clock, so dates typed today and dates the system stamps agree. */
export const TODAY = dayjs().format('YYYY-MM-DD');
export const NOW = dayjs().format('YYYY-MM-DDTHH:mm');

export const PRODUCT_CLASSIFICATIONS = ['Inventory', 'Rental', 'AMC', 'Fuel Trading', 'Trading'] as const;
export const TRACKING_METHODS = [
  { value: 'Serialized', label: 'Serialized (Unique Asset ID)' },
  { value: 'Quantity', label: 'Quantity' },
  { value: 'Length', label: 'Length (or other unit of measure)' },
];
export const ITEM_TYPES = ['Inventory', 'Non Inventory', 'Assembly (Finished product)', 'Service', 'Package', 'Inventory Fixed Asset', 'Heavy Equipment Fixed Asset'];
export const UOMS = ['Nos', 'Meter', 'Litre', 'Drum', 'Visit', 'Job', 'Kg', 'Set'];
/** Service items (Type = Service) carry a Service Type and a Billing type, used by Rental, AMC and Fixed Asset Trading documents in CRM. */
export const SERVICE_TYPES = ['Charge', 'Waiver', 'Insurance'];
export const SERVICE_BILLING = ['One-time', 'Recurring', 'Lump sum'];
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
export const BRANDS = ['Cummins', 'Perkins', 'Mercedes', 'Volvo', 'Isuzu', 'Emirates Cable & Panel', 'Local', 'MAN', 'Mitsubishi', 'Toyota'];
/** Brand master (5 Oct call): one global list used by every fixed asset and item, so brand filters and reports never depend on spelling. */
export interface BrandRec { id: string; name: string; status: 'Active' | 'Inactive' }
export const brandSeed: BrandRec[] = BRANDS.map((n, i) => ({ id: `br${i + 1}`, name: n, status: 'Active' as const }));
export { ASSET_STATUSES };
export const ACCOUNTS = {
  fixedAsset: ['120100 Fixed Assets: Plant & Machinery', '120200 Fixed Assets: Vehicles', '120300 Fixed Assets: Power Equipment'],
  depreciation: ['120190 Accumulated Depreciation: Plant & Machinery', '120290 Accumulated Depreciation: Vehicles', '120390 Accumulated Depreciation: Power Equipment'],
  expense: ['510200 Depreciation Expense', '510210 Depreciation Expense: Vehicles'],
  insurance: ['520100 Insurance Expense', '120500 Prepaid Insurance'],
  journals: ['Depreciation Journal', 'Fixed Asset Journal'],
};
export const DEPARTMENTS = Array.from(new Set(employees.map((e) => e.department))).sort();
/** Places a heavy asset can be: yards and supplier locations, never a service van (Employee location). */
export const LOCATION_NAMES = locations.filter((l) => l.type !== 'Employee').map((l) => l.name);
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
const EXTRA_CATEGORIES = ['Spare Part', 'Consumable', 'Fuel'];
const PREFIX: Record<string, string> = { Generator: 'GEN', Cable: 'CBL', Panel: 'PNL', POD: 'POD', Trolley: 'TRL', Tray: 'TRY', 'Day Tank': 'DTK', 'Spare Engine': 'SPE', Vehicle: 'VEH', 'Spare Part': 'SPR', Consumable: 'CON', Fuel: 'FUL' };
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
export const PRICING_ACTIVITIES = ['Rental', 'Fixed Asset Trading'] as const;
export type PricingActivity = (typeof PRICING_ACTIVITIES)[number];
export interface PricingRec {
  id: string; activity: PricingActivity; category: string; subCategory: string; description: string;
  /** Trading: the sales price. Rental: the price entered for baseFrequency. */
  price: number;
  /** Rental only: the billing frequency the user entered the price for */
  frequency?: string;
}
/** Days each billing frequency stands for: 1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months, 1 year = 12 months. */
export const FREQ_DAYS: Record<string, number> = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Yearly: 360 };
/** Kept for the old calculation helper; the pricing master no longer derives frequencies. */
export const deriveFrequencyPrices = (price: number, frequency: string): Record<string, number> =>
  Object.fromEntries(FREQUENCIES.map((fq) => [fq, Math.round(((price / FREQ_DAYS[frequency]) * FREQ_DAYS[fq]) * 100) / 100]));
/** One record per billing frequency (5 Oct call): a 100 KVA generator with seven prices has seven rows, which also keeps bulk upload simple. */
const rp = (id: string, category: string, subCategory: string, frequency: string, price: number, description: string): PricingRec =>
  ({ id, activity: 'Rental', category, subCategory, frequency, price, description });
const tp = (id: string, category: string, subCategory: string, price: number, description: string): PricingRec => ({ id, activity: 'Fixed Asset Trading', category, subCategory, price, description });
export const pricingSeed: PricingRec[] = [
  rp('pr1', 'Generator', '100 KVA', 'Monthly', 18500, 'Rental 100 KVA generator'),
  rp('pr1w', 'Generator', '100 KVA', 'Weekly', 5200, 'Rental 100 KVA generator, weekly'),
  rp('pr1d', 'Generator', '100 KVA', 'Daily', 900, 'Rental 100 KVA generator, daily'),
  rp('pr1q', 'Generator', '100 KVA', 'Quarterly', 52000, 'Rental 100 KVA generator, quarterly'),
  rp('pr1y', 'Generator', '100 KVA', 'Yearly', 195000, 'Rental 100 KVA generator, yearly'),
  rp('pr3', 'Generator', '200 KVA', 'Monthly', 29500, 'Rental 200 KVA generator'),
  rp('pr4', 'Generator', '500 KVA', 'Monthly', 52000, 'Rental 500 KVA generator'),
  rp('pr4w', 'Generator', '500 KVA', 'Weekly', 13500, 'Rental 500 KVA generator, weekly'),
  rp('pr4q', 'Generator', '500 KVA', 'Quarterly', 148000, 'Rental 500 KVA generator, quarterly'),
  rp('pr4y', 'Generator', '500 KVA', 'Yearly', 560000, 'Rental 500 KVA generator, yearly'),
  rp('pr5', 'Generator', '1000 KVA', 'Monthly', 98000, 'Rental 1000 KVA generator'),
  rp('pr5q', 'Generator', '1000 KVA', 'Quarterly', 280000, 'Rental 1000 KVA generator, quarterly'),
  rp('pr5y', 'Generator', '1000 KVA', 'Yearly', 1050000, 'Rental 1000 KVA generator, yearly'),
  rp('pr13', 'Generator', '1500 KVA', 'Monthly', 145000, 'Rental 1500 KVA generator'),
  rp('pr6', 'Cable', '4 Core 185 mm', 'Monthly', 14, 'Rental power cable, per meter'),
  rp('pr7', 'Panel', 'ATS Panel', 'Monthly', 6800, 'Rental ATS panel'),
  rp('pr8', 'POD', '20 ft POD', 'Monthly', 7500, 'Rental 20 ft power container'),
  tp('pr10', 'Generator', '100 KVA', 165000, 'New 100 KVA diesel generator, sale price'),
  tp('pr14', 'Generator', '500 KVA', 380000, 'Ex-fleet 500 KVA diesel generator with service history, sale price'),
  tp('pr11', 'Panel', 'ATS Panel', 61000, 'ATS panel 630A, sale price'),
  tp('pr12', 'Cable', '4 Core 185 mm', 95, 'Power cable 4C x 185 mm, sale price per meter'),
];
/** More rate cards (Oct 2026 demo data): every sub-category priced for the frequencies it is normally hired on, plus further sale prices. Frequencies already above are not repeated. */
pricingSeed.push(
  rp('pr20', 'Generator', '200 KVA', 'Daily', 1450, 'Rental 200 KVA generator, daily'),
  rp('pr20w', 'Generator', '200 KVA', 'Weekly', 8400, 'Rental 200 KVA generator, weekly'),
  rp('pr20q', 'Generator', '200 KVA', 'Quarterly', 83000, 'Rental 200 KVA generator, quarterly'),
  rp('pr20y', 'Generator', '200 KVA', 'Yearly', 315000, 'Rental 200 KVA generator, yearly'),
  rp('pr21d', 'Generator', '500 KVA', 'Daily', 2450, 'Rental 500 KVA generator, daily'),
  rp('pr22d', 'Generator', '1000 KVA', 'Daily', 4600, 'Rental 1000 KVA generator, daily'),
  rp('pr22w', 'Generator', '1000 KVA', 'Weekly', 24500, 'Rental 1000 KVA generator, weekly'),
  rp('pr23d', 'Generator', '1500 KVA', 'Daily', 6900, 'Rental 1500 KVA generator, daily'),
  rp('pr23w', 'Generator', '1500 KVA', 'Weekly', 36000, 'Rental 1500 KVA generator, weekly'),
  rp('pr23q', 'Generator', '1500 KVA', 'Quarterly', 410000, 'Rental 1500 KVA generator, quarterly'),
  rp('pr23y', 'Generator', '1500 KVA', 'Yearly', 1560000, 'Rental 1500 KVA generator, yearly'),
  rp('pr24', 'Cable', '4 Core 95 mm', 'Monthly', 9, 'Rental power cable 4C x 95 mm, per meter'),
  rp('pr24w', 'Cable', '4 Core 95 mm', 'Weekly', 3.2, 'Rental power cable 4C x 95 mm, per meter, weekly'),
  rp('pr24q', 'Cable', '4 Core 95 mm', 'Quarterly', 24, 'Rental power cable 4C x 95 mm, per meter, quarterly'),
  rp('pr25d', 'Cable', '4 Core 185 mm', 'Daily', 0.8, 'Rental power cable 4C x 185 mm, per meter, daily'),
  rp('pr25w', 'Cable', '4 Core 185 mm', 'Weekly', 4.8, 'Rental power cable 4C x 185 mm, per meter, weekly'),
  rp('pr25q', 'Cable', '4 Core 185 mm', 'Quarterly', 38, 'Rental power cable 4C x 185 mm, per meter, quarterly'),
  rp('pr26', 'Cable', '4 Core 300 mm', 'Monthly', 22, 'Rental power cable 4C x 300 mm, per meter'),
  rp('pr26w', 'Cable', '4 Core 300 mm', 'Weekly', 7.5, 'Rental power cable 4C x 300 mm, per meter, weekly'),
  rp('pr26q', 'Cable', '4 Core 300 mm', 'Quarterly', 60, 'Rental power cable 4C x 300 mm, per meter, quarterly'),
  rp('pr27d', 'Panel', 'ATS Panel', 'Daily', 380, 'Rental ATS panel, daily'),
  rp('pr27w', 'Panel', 'ATS Panel', 'Weekly', 2300, 'Rental ATS panel, weekly'),
  rp('pr27q', 'Panel', 'ATS Panel', 'Quarterly', 18500, 'Rental ATS panel, quarterly'),
  rp('pr28', 'Panel', 'Synchronizing Panel', 'Monthly', 14500, 'Rental synchronizing panel 1250 A'),
  rp('pr28w', 'Panel', 'Synchronizing Panel', 'Weekly', 4200, 'Rental synchronizing panel 1250 A, weekly'),
  rp('pr28q', 'Panel', 'Synchronizing Panel', 'Quarterly', 40000, 'Rental synchronizing panel 1250 A, quarterly'),
  rp('pr29', 'Panel', 'Distribution Panel', 'Monthly', 3900, 'Rental distribution panel 630 A'),
  rp('pr30w', 'POD', '20 ft POD', 'Weekly', 2600, 'Rental 20 ft power container, weekly'),
  rp('pr30q', 'POD', '20 ft POD', 'Quarterly', 21000, 'Rental 20 ft power container, quarterly'),
  rp('pr31', 'POD', '40 ft POD', 'Monthly', 12500, 'Rental 40 ft power container'),
  rp('pr31w', 'POD', '40 ft POD', 'Weekly', 4100, 'Rental 40 ft power container, weekly'),
  rp('pr31q', 'POD', '40 ft POD', 'Quarterly', 34000, 'Rental 40 ft power container, quarterly'),
  rp('pr32', 'Trolley', 'Generator Trolley', 'Monthly', 1400, 'Rental generator trolley'),
  rp('pr33', 'Tray', 'Cable Tray', 'Monthly', 650, 'Rental cable tray set (60 m)'),
  rp('pr34', 'Day Tank', '500 L Day Tank', 'Monthly', 1300, 'Rental 500 L day tank'),
  rp('pr35', 'Day Tank', '1000 L Day Tank', 'Monthly', 1950, 'Rental 1000 L day tank'),
  rp('pr36', 'Spare Engine', 'Cummins Spare Engine', 'Monthly', 9500, 'Rental Cummins standby engine assembly'),
  rp('pr37', 'Spare Engine', 'Perkins Spare Engine', 'Monthly', 7800, 'Rental Perkins standby engine assembly'),
  tp('pr40', 'Generator', '200 KVA', 258000, 'New 200 KVA diesel generator, sale price'),
  tp('pr41', 'Generator', '1000 KVA', 740000, 'Ex-fleet 1000 KVA diesel generator with service history, sale price'),
  tp('pr42', 'Generator', '1500 KVA', 1720000, 'New 1500 KVA container generator, sale price'),
  tp('pr43', 'Cable', '4 Core 95 mm', 68, 'Power cable 4C x 95 mm, sale price per meter'),
  tp('pr44', 'Cable', '4 Core 300 mm', 195, 'Power cable 4C x 300 mm, sale price per meter'),
  tp('pr45', 'Panel', 'Distribution Panel', 29500, 'Distribution panel 630A, sale price'),
  tp('pr46', 'Panel', 'Synchronizing Panel', 138000, 'Synchronizing panel 1250A, sale price'),
  tp('pr47', 'POD', '20 ft POD', 98000, '20 ft power container, ex-fleet, sale price'),
  tp('pr48', 'Day Tank', '1000 L Day Tank', 32000, '1000 L day tank, sale price'),
  tp('pr49', 'Trolley', 'Generator Trolley', 24500, 'Generator trolley, sale price'),
);

/* ------------------------------------------------------------------ items (existing Item Master + new fields) */
export interface ItemRec extends ItemMaster {
  type: string; sku: string; status: 'Active' | 'Inactive';
  costingMethod?: string; traceability?: string; useBins?: boolean; costPrice?: number;
  brand?: string; model?: string; engineNo?: string; capacity?: string;
  purchaseDate?: string; assetValue?: number; nbv?: number; deprPct?: number; deprAmount?: number; capex?: number;
  image?: string; attachments?: string[]; attrs?: Record<string, string>;
  /** Type = Service only (NEW): what the service is and how it is billed on a CRM document */
  serviceType?: string; billing?: string; description?: string;
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
  // Spare parts carried in the service vans (Employee locations), drawn from on AMC visits.
  { id: 'ls-i3-5', itemId: 'i3', location: 'Service Van 1 (Rajesh Pillai)', qty: 6 }, { id: 'ls-i4-5', itemId: 'i4', location: 'Service Van 1 (Rajesh Pillai)', qty: 4 },
  { id: 'ls-i12-5', itemId: 'i12', location: 'Service Van 1 (Rajesh Pillai)', qty: 3 }, { id: 'ls-i6-5', itemId: 'i6', location: 'Service Van 1 (Rajesh Pillai)', qty: 2 },
  { id: 'ls-i3-6', itemId: 'i3', location: 'Service Van 2 (Shared)', qty: 2 }, { id: 'ls-i5-6', itemId: 'i5', location: 'Service Van 2 (Shared)', qty: 1 },
  { id: 'ls-i5-5', itemId: 'i5', location: 'Service Van 1 (Rajesh Pillai)', qty: 1 },
  { id: 'ls-i6-6', itemId: 'i6', location: 'Service Van 2 (Shared)', qty: 2 }, { id: 'ls-i12-6', itemId: 'i12', location: 'Service Van 2 (Shared)', qty: 2 },
  { id: 'ls-i6-7', itemId: 'i6', location: 'Service Van 3 (Sanjay Kumar)', qty: 3 }, { id: 'ls-i12-7', itemId: 'i12', location: 'Service Van 3 (Sanjay Kumar)', qty: 2 }, { id: 'ls-i5-7', itemId: 'i5', location: 'Service Van 3 (Sanjay Kumar)', qty: 1 },
];
// [item id, Jebel Ali Main Yard, Sharjah Yard, Abu Dhabi Mussafah Yard] for the stock items added in the Oct 2026 data set. Zero rows are kept on purpose.
const EXTRA_YARD_STOCK: [string, number, number, number][] = [
  ['i13', 24, 10, 6], ['i14', 5, 3, 0], ['i15', 30, 14, 9], ['i16', 10, 4, 3], ['i17', 6, 2, 0], ['i18', 12, 5, 0], ['i19', 3, 1, 1], ['i20', 14, 6, 4],
  ['i21', 2, 0, 1], ['i22', 2, 0, 1], ['i23', 1, 1, 0], ['i24', 900, 350, 0], ['i25', 500, 0, 250], ['i26', 120, 40, 22],
  ['i28', 120, 40, 0], ['i29', 0, 0, 0], ['i30', 0, 0, 0], ['i31', 8, 4, 2], ['i32', 3, 0, 1],
];
locationStockSeed.push(
  ...EXTRA_YARD_STOCK.flatMap(([itemId, a, b, c]) => [
    { id: `ls-${itemId}-1`, itemId, location: 'Jebel Ali Main Yard', qty: a },
    { id: `ls-${itemId}-2`, itemId, location: 'Sharjah Yard', qty: b },
    { id: `ls-${itemId}-3`, itemId, location: 'Abu Dhabi Mussafah Yard', qty: c },
  ]),
  { id: 'ls-i27-4', itemId: 'i27', location: FUEL_DEPOT, qty: 6200, consumed: 3800 },
  // Spare parts carried in the service vans for the new stock items.
  { id: 'ls-i13-5', itemId: 'i13', location: 'Service Van 1 (Rajesh Pillai)', qty: 3 }, { id: 'ls-i15-5', itemId: 'i15', location: 'Service Van 1 (Rajesh Pillai)', qty: 5 },
  { id: 'ls-i20-5', itemId: 'i20', location: 'Service Van 1 (Rajesh Pillai)', qty: 2 }, { id: 'ls-i15-7', itemId: 'i15', location: 'Service Van 3 (Sanjay Kumar)', qty: 2 },
  { id: 'ls-i20-7', itemId: 'i20', location: 'Service Van 3 (Sanjay Kumar)', qty: 2 }, { id: 'ls-i18-6', itemId: 'i18', location: 'Service Van 2 (Shared)', qty: 2 },
  { id: 'ls-i31-6', itemId: 'i31', location: 'Service Van 2 (Shared)', qty: 1 }, { id: 'ls-i19-7', itemId: 'i19', location: 'Service Van 3 (Sanjay Kumar)', qty: 0 },
);
const stockTotal = (itemId: string, fallback: number) => {
  const rows = locationStockSeed.filter((r) => r.itemId === itemId);
  return rows.length ? rows.reduce((t, r) => t + r.qty, 0) : fallback;
};
const SERVICE_SEED: Record<string, Partial<ItemRec>> = {
  i10: { serviceType: 'Charge', billing: 'One-time', description: 'Generator installation and commissioning' },
};
/** Rental related service items, kept in Inventory with the other service items (6 Oct: service lines come from the Inventory service items). */
const svc = (n: number, id: string, name: string, serviceType: string, billing: string, price: number, description: string, unit = 'Nos'): ItemRec => ({
  id, code: `ITM-${String(n).padStart(4, '0')}`, name, classification: '', category: '', tracking: 'Quantity', unit, price, stock: 0,
  type: 'Service', sku: `SKU-${String(n).padStart(4, '0')}`, status: 'Active', costingMethod: 'Average Cost', traceability: 'No Tracking', costPrice: Math.round(price * 0.72 * 100) / 100, serviceType, billing, description,
});
export const serviceItemSeed: ItemRec[] = [
  svc(13, 'sv1', 'Delivery Charge', 'Charge', 'One-time', 1500, 'Delivery of equipment to site, billed on the first invoice'),
  svc(14, 'sv2', 'Return Charge', 'Charge', 'One-time', 2000, 'Collection of equipment from site, billed on the final invoice'),
  svc(15, 'sv3', 'Transportation', 'Charge', 'One-time', 1200, 'Transport service charge'),
  svc(16, 'sv4', 'Damage Waiver (Monthly)', 'Waiver', 'Recurring', 150, 'Damage waiver billed with every rental cycle; if paid, damage is not invoiced at return'),
  svc(17, 'sv5', 'Damage Waiver (Lump Sum)', 'Waiver', 'Lump sum', 400, 'One-time damage waiver for the whole contract'),
  svc(41, 'sv8', 'Damage Waiver (One-time)', 'Waiver', 'One-time', 250, 'Damage waiver billed once on the first invoice, for short hires'),
  svc(18, 'sv6', 'Equipment Insurance (Monthly)', 'Insurance', 'Recurring', 300, 'Insurance cover billed with every rental cycle'),
  svc(19, 'sv7', 'Operator Charge (Monthly)', 'Charge', 'Recurring', 4500, 'Operator provided with the equipment'),
];
serviceItemSeed.push(
  svc(321, 'sv9', 'Operator Charge (Weekly)', 'Charge', 'Recurring', 1100, 'Operator provided with the equipment, billed every week of the hire'),
  svc(322, 'sv10', 'Delivery Charge (Low-bed, Heavy Unit)', 'Charge', 'One-time', 2800, 'Delivery of 500 KVA and larger units on a low-bed truck, billed on the first invoice'),
  svc(323, 'sv11', 'Return Charge (Low-bed, Heavy Unit)', 'Charge', 'One-time', 3200, 'Collection of 500 KVA and larger units on a low-bed truck, billed on the final invoice'),
  svc(324, 'sv12', 'Cable Laying and Termination', 'Charge', 'One-time', 1800, 'Laying, glanding and termination of hired power cable at site', 'Job'),
  svc(325, 'sv13', 'Crane Offloading and Positioning', 'Charge', 'One-time', 1500, 'Crane truck attendance to offload and position the unit on site', 'Visit'),
  svc(326, 'sv14', 'Equipment Insurance (Lump Sum)', 'Insurance', 'Lump sum', 1200, 'One-time insurance cover for the whole contract period'),
  svc(327, 'sv15', 'Standby Charge (Daily)', 'Charge', 'Recurring', 650, 'Charged for each day the unit is kept on site but not run, at the client request'),
);
/** Stock items added in the Oct 2026 data set. Stock is the total of the location rows above, like the original items. */
const stk = (n: number, id: string, name: string, classification: ItemRec['classification'], category: string, tracking: ItemRec['tracking'], unit: string, price: number, cost: number, p: Partial<ItemRec> = {}): ItemRec => ({
  id, code: `ITM-${String(n).padStart(4, '0')}`, name, classification, category, tracking, unit, price, stock: stockTotal(id, 0),
  type: 'Inventory', sku: `SKU-${String(n).padStart(4, '0')}`, status: 'Active', costingMethod: 'Average Cost', traceability: tracking === 'Serialized' ? 'Serial Number Tracking' : 'No Tracking',
  useBins: tracking === 'Quantity' && !!p.spare, costPrice: cost, ...p,
});
const extraItemSeed: ItemRec[] = [
  stk(301, 'i13', 'Oil Filter (Perkins 1106)', 'Inventory', 'Spare Part', 'Quantity', 'Nos', 78, 54, { minStock: 20, reorderQty: 60, spare: true, brand: 'Perkins' }),
  stk(302, 'i14', 'Air Filter (Cummins QSX15)', 'Inventory', 'Spare Part', 'Quantity', 'Nos', 245, 172, { minStock: 12, reorderQty: 24, spare: true, brand: 'Cummins' }),
  stk(303, 'i15', 'Fuel Filter (Cummins C-Series)', 'AMC', 'Spare Part', 'Quantity', 'Nos', 68, 47, { minStock: 25, reorderQty: 60, spare: true, brand: 'Cummins' }),
  stk(304, 'i16', 'Coolant Extended Life 50/50 (20 L)', 'Inventory', 'Consumable', 'Quantity', 'Drum', 310, 226, { minStock: 8, reorderQty: 16, spare: true }),
  stk(305, 'i17', 'Engine Oil 15W-40 (208 L Drum)', 'Trading', 'Consumable', 'Quantity', 'Drum', 1450, 1180, { minStock: 4, reorderQty: 8, spare: true }),
  stk(306, 'i18', 'Fan Belt (Perkins 1106)', 'AMC', 'Spare Part', 'Quantity', 'Nos', 95, 63, { minStock: 10, reorderQty: 20, spare: true, brand: 'Perkins' }),
  stk(307, 'i19', 'Alternator Belt (Cummins QSX15)', 'AMC', 'Spare Part', 'Quantity', 'Nos', 120, 84, { minStock: 6, reorderQty: 12, spare: true, brand: 'Cummins' }),
  stk(308, 'i20', 'Battery 12V 100Ah', 'Trading', 'Spare Part', 'Quantity', 'Nos', 380, 295, { minStock: 10, reorderQty: 20, spare: true }),
  stk(309, 'i21', 'Generator Controller Module (DSE 7320)', 'Trading', 'Spare Part', 'Quantity', 'Nos', 3200, 2480, { minStock: 2, reorderQty: 4, spare: true }),
  stk(310, 'i22', 'ATS Panel 400A', 'Trading', 'Panel', 'Serialized', 'Nos', 38500, 29800, { subCategory: 'ATS Panel', brand: 'Emirates Cable & Panel', model: 'ATS-400', capacity: '400 A', attrs: { 'at-p1': '400' } }),
  stk(311, 'i23', 'Distribution Panel 630A', 'Trading', 'Panel', 'Serialized', 'Nos', 27500, 21300, { subCategory: 'Distribution Panel', brand: 'Emirates Cable & Panel', model: 'DB-630', capacity: '630 A', attrs: { 'at-p1': '630' } }),
  stk(312, 'i24', 'Power Cable 4C x 95 mm', 'Trading', 'Cable', 'Length', 'Meter', 62, 47, { subCategory: '4 Core 95 mm', attrs: { 'at-c1': '4', 'at-c2': '100' } }),
  stk(313, 'i25', 'Power Cable 4C x 300 mm', 'Rental', 'Cable', 'Length', 'Meter', 24, 17.3, { subCategory: '4 Core 300 mm', attrs: { 'at-c1': '4', 'at-c2': '50' } }),
  stk(314, 'i26', 'Cable Lug 185 mm Copper (Crimp)', 'Inventory', 'Spare Part', 'Quantity', 'Nos', 28, 19, { minStock: 50, reorderQty: 200, spare: true }),
  stk(315, 'i27', 'Diesel (Site Delivery)', 'Fuel Trading', 'Fuel', 'Quantity', 'Litre', 3.05, 2.62),
  stk(316, 'i28', 'Lithium Grease EP2', 'Inventory', 'Consumable', 'Quantity', 'Kg', 18, 12.5, { minStock: 50, reorderQty: 150, spare: true }),
  stk(317, 'i29', 'Radiator Hose Kit (Perkins 2506)', 'AMC', 'Spare Part', 'Quantity', 'Set', 420, 305, { minStock: 3, reorderQty: 6, spare: true, brand: 'Perkins' }),
  stk(318, 'i30', 'Turbocharger (Cummins QSX15)', 'Trading', 'Spare Part', 'Quantity', 'Nos', 9800, 7650, { minStock: 1, reorderQty: 2, spare: true, brand: 'Cummins' }),
  stk(319, 'i31', 'Fire Extinguisher DCP 9 kg', 'Inventory', 'Consumable', 'Quantity', 'Nos', 185, 128, { minStock: 6, reorderQty: 12, spare: true }),
  stk(320, 'i32', 'Hydraulic Oil ISO 68 (20 L)', 'Inventory', 'Consumable', 'Quantity', 'Drum', 365, 262, { minStock: 4, reorderQty: 8, spare: true }),
];
export const itemSeed: ItemRec[] = [...itemMaster.map((m): ItemRec => ({
  ...m,
  stock: stockTotal(m.id, m.stock),
  type: m.id === 'i1' || m.id === 'i2' ? 'Inventory Fixed Asset' : m.id === 'i10' ? 'Service' : 'Inventory',
  sku: m.code.replace('ITM', 'SKU'),
  status: m.id === 'i4' ? 'Inactive' : 'Active',
  costingMethod: 'Average Cost',
  traceability: m.tracking === 'Serialized' ? 'Serial Number Tracking' : 'No Tracking',
  useBins: m.tracking === 'Quantity' && !!m.spare,
  costPrice: Math.round(m.price * 0.72 * 100) / 100,
  ...SERIAL_SEED[m.id],
  ...SERVICE_SEED[m.id],
})), ...serviceItemSeed, ...extraItemSeed];

/** Next sequential Item Code across the item master and Heavy Equipment records. */
export function nextItemCode(...codeLists: string[][]): string {
  const max = codeLists.flat().reduce((mx, c) => Math.max(mx, Number(c.replace(/\D/g, '')) || 0), 0);
  return `ITM-${String(max + 1).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ heavy equipment (serialized asset) */
export interface InsuranceEntry { amount: string; date: string; dueDate: string; account: string }
export interface Movement { id: string; entryNo: string; date: string; type: string; from: string; to: string; reference: string; by: string; /** filled automatically from the Delivery Order (5 Oct call) */ customer?: string; project?: string }
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
  /** Own delivery vehicle (Fleet Management, 6 Oct): used to deliver and collect equipment, never rented out, not counted in the rental fleet. */
  deliveryFleet?: boolean; plateNumber?: string; defaultDriver?: string;
}

/** Derived, never stored: current location is the destination of the latest Movement History entry. */
export const currentLocation = (r: Pick<HeavyRec, 'movements'>) => [...r.movements].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]?.to ?? '-';
/** Derived from the Unified Asset Status: units physically in the yard count as in stock. */
export const stockStatusOf = (r: Pick<HeavyRec, 'assetStatus'>): 'In Stock' | 'Out of Stock' => (['Ready for Hire', 'Yard', 'Off Hire'].includes(r.assetStatus) ? 'In Stock' : 'Out of Stock');
export const depreciationApplicable = (ownership: string) => ownership !== 'Cross-Hired';
export const inFleetCount = (r: Pick<HeavyRec, 'ownership' | 'assetStatus' | 'deliveryFleet'>) => !r.deliveryFleet && r.ownership === 'Owned' && r.assetStatus !== 'On Hire' && r.assetStatus !== 'Disposed';
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

interface Seed { n: number; name: string; category: string; sub: string; brand: string; model: string; engine: string; capacity: string; purchase: string; value: number; years: number; loc: string; dept: string; ownership?: string; crossHire?: { supplier: string; idle?: boolean }; out?: { site: string; date: string }; retired?: boolean; repair?: boolean; assetType: string; spec: string; util: number;
  /** Demo states: the Asset Status the unit is in now (when not the default), a status set by hand with its reason, and movements after the delivery [date, type, from, to, reference]. */
  status?: string; override?: { when: string; reason: string }; moves?: [string, string, string, string, string][];
  /** Own delivery vehicle: plate and the driver normally paired with it. */
  fleet?: { plate: string; driver?: string } }
const SEEDS: Seed[] = [
  { n: 13, name: 'Diesel Generator 200 KVA Perkins 1106A', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70418', capacity: '200 KVA', purchase: '2022-03-15', value: 245000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Gulf Build Contracting', date: '2026-07-04T09:30' }, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz, prime rating', util: 78 },
  { n: 14, name: 'Diesel Generator 200 KVA Cummins C200D5', category: 'Generator', sub: '200 KVA', brand: 'Cummins', model: 'C200D5', engine: 'CUM-6CTA-55027', capacity: '200 KVA', purchase: '2021-09-01', value: 260000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', repair: true, assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 3 phase, 50 Hz', util: 64 },
  { n: 15, name: 'Diesel Generator 500 KVA Cummins C500D5', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88231', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Dubai Metro Works JV', date: '2026-04-12T08:00' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 86 },
  { n: 16, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 2)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88262', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Sharjah Cement Company', date: '2026-02-20T10:15' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 82 },
  { n: 17, name: 'Diesel Generator 500 KVA Perkins 2506C', category: 'Generator', sub: '500 KVA', brand: 'Perkins', model: '2506C', engine: 'PRK-2506C-31190', capacity: '500 KVA', purchase: '2022-11-10', value: 505000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 50 Hz', util: 58 },
  { n: 18, name: 'Diesel Generator 1000 KVA Cummins C1000D5', category: 'Generator', sub: '1000 KVA', brand: 'Cummins', model: 'C1000D5', engine: 'CUM-KTA50-92017', capacity: '1000 KVA', purchase: '2024-08-05', value: 980000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Dubai Metro Works JV', date: '2026-05-18T07:45' }, assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 91 },
  { n: 19, name: 'Diesel Generator 1500 KVA Cummins C1500D5', category: 'Generator', sub: '1500 KVA', brand: 'Cummins', model: 'C1500D5', engine: 'CUM-QSK60-10452', capacity: '1500 KVA', purchase: '2025-10-12', value: 1450000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Palm Marina Development', date: '2026-09-30T08:00' }, status: 'Hold', assetType: 'Power Equipment', spec: '40 ft container mounted, 11 kV ready, 50 Hz', util: 35 },
  { n: 20, name: 'Diesel Generator 100 KVA Perkins P100 (Standby)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: 'P100', engine: 'PRK-1104D-22890', capacity: '100 KVA', purchase: '2022-01-20', value: 150000, years: 10, loc: 'Abu Dhabi Mussafah Yard', dept: 'Operations', ownership: 'Spare-Standby', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 12 },
  { n: 21, name: 'Low-bed Truck Mercedes Actros 3340', category: 'Vehicle', sub: 'Low-bed Truck', brand: 'Mercedes', model: 'Actros 3340', engine: 'MB-OM471-60318', capacity: '40 Ton', purchase: '2021-02-14', value: 420000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', status: 'In Service', fleet: { plate: 'Dubai P 48213', driver: 'Tariq Hussain' }, assetType: 'Vehicles', spec: '6x4 tractor unit with hydraulic ramp low-bed trailer', util: 71 },
  { n: 22, name: 'Low-bed Truck Volvo FM 440', category: 'Vehicle', sub: 'Low-bed Truck', brand: 'Volvo', model: 'FM 440', engine: 'VOL-D13K-41672', capacity: '45 Ton', purchase: '2022-05-09', value: 445000, years: 8, loc: 'Sharjah Yard', dept: 'Logistics', status: 'In Service', fleet: { plate: 'Sharjah 3 22871', driver: 'Imran Shah' }, assetType: 'Vehicles', spec: '6x4 tractor unit with low-bed trailer', util: 64 },
  { n: 23, name: 'Flatbed Truck Isuzu FTR 34', category: 'Vehicle', sub: 'Flatbed Truck', brand: 'Isuzu', model: 'FTR 34', engine: 'ISZ-6HK1-19540', capacity: '12 Ton', purchase: '2020-07-22', value: 210000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', repair: true, fleet: { plate: 'Dubai K 61904', driver: 'Joseph Mathew' }, assetType: 'Vehicles', spec: 'Flatbed body with tie-down rails', util: 55 },
  { n: 24, name: 'POD 20 ft Power Container', category: 'POD', sub: '20 ft POD', brand: 'Emirates Cable & Panel', model: 'POD-20', engine: 'N/A', capacity: '20 ft', purchase: '2023-03-30', value: 70000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Gulf Build Contracting', date: '2026-07-06T11:00' }, status: 'Under Maintenance', moves: [['2026-09-26T15:30', 'Return', 'Client: Gulf Build Contracting', 'Jebel Ali Main Yard', 'RMA-26-00132'], ['2026-09-27T09:00', 'Sent for Repair', 'Jebel Ali Main Yard', 'Workshop: Al Masaood Service Centre', 'RMA-26-00132']], assetType: 'Containers & Shelters', spec: 'Insulated 20 ft container with cable entry glands', util: 74 },
  { n: 25, name: 'Perkins Spare Engine 2506C-E15', category: 'Spare Engine', sub: 'Perkins Spare Engine', brand: 'Perkins', model: '2506C-E15', engine: 'PRK-2506E-00781', capacity: '500 kW', purchase: '2024-01-16', value: 120000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Workshop', ownership: 'Spare-Standby', assetType: 'Plant & Machinery', spec: 'Complete long engine assembly held as standby', util: 5 },
  { n: 27, name: 'Diesel Generator 500 KVA Falcon Cross-Hire', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'CH-500', engine: 'CUM-QSX15-70451', capacity: '500 KVA', purchase: '2026-05-02', value: 0, years: 0, loc: 'Jebel Ali Main Yard', dept: 'Operations', crossHire: { supplier: 'Falcon Equipment Hire LLC' }, out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-05-06T09:00' }, assetType: 'Power Equipment', spec: 'Cross-hired unit, open skid, 415 V, 50 Hz', util: 88 },
  { n: 28, name: 'Diesel Generator 200 KVA Gulf Genset Cross-Hire', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: 'CH-200', engine: 'PRK-1106A-90211', capacity: '200 KVA', purchase: '2026-06-10', value: 0, years: 0, loc: 'Sharjah Yard', dept: 'Operations', crossHire: { supplier: 'Gulf Genset Rentals', idle: true }, moves: [['2026-06-12T09:00', 'Delivery', 'Sharjah Yard', 'Client: Gulf Build Contracting', 'RP-26-00003'], ['2026-07-04T15:00', 'Cross-Hire Stage Change', 'Client: Gulf Build Contracting', 'Sharjah Yard', 'CH-26-00006']], assetType: 'Power Equipment', spec: 'Cross-hired unit, canopy type, 415 V, 50 Hz', util: 22 },
  { n: 29, name: 'Diesel Generator 200 KVA Cummins C200D5 (Unit 2)', category: 'Generator', sub: '200 KVA', brand: 'Cummins', model: 'C200D5', engine: 'CUM-6CTA-55311', capacity: '200 KVA', purchase: '2023-02-10', value: 260000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-06-01T08:30' }, status: 'Under Maintenance', moves: [['2026-09-15T16:00', 'Return', 'Client: Emirates Infrastructure LLC', 'Jebel Ali Main Yard', 'RMA-26-00121'], ['2026-09-16T10:00', 'Sent for Repair', 'Jebel Ali Main Yard', 'Workshop: Al Masaood Service Centre', 'RMA-26-00121']], assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 3 phase, 50 Hz', util: 70 },
  { n: 30, name: 'Diesel Generator 100 KVA Cummins C100D5', category: 'Generator', sub: '100 KVA', brand: 'Cummins', model: 'C100D5', engine: 'CUM-4BT-44188', capacity: '100 KVA', purchase: '2024-02-10', value: 165000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-06-01T08:30' }, status: 'Yard', moves: [['2026-09-29T15:00', 'Return', 'Client: Emirates Infrastructure LLC', 'Jebel Ali Main Yard', 'RMA-26-00122']], assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz', util: 66 },
  { n: 31, name: 'Diesel Generator 100 KVA Gulf Genset Cross-Hire', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: 'CH-100', engine: 'PRK-1104D-90377', capacity: '100 KVA', purchase: '2026-09-28', value: 0, years: 0, loc: 'Jebel Ali Main Yard', dept: 'Operations', crossHire: { supplier: 'Gulf Genset Rentals' }, assetType: 'Power Equipment', spec: 'Cross-hired unit, canopy type, 415 V, 50 Hz', util: 0 },
  { n: 32, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 3)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88407', capacity: '500 KVA', purchase: '2024-03-18', value: 525000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 61 },
  { n: 33, name: 'Diesel Generator 1000 KVA Cummins C1000D5 (Unit 2)', category: 'Generator', sub: '1000 KVA', brand: 'Cummins', model: 'C1000D5', engine: 'CUM-KTA50-92155', capacity: '1000 KVA', purchase: '2025-02-20', value: 990000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 48 },
  { n: 34, name: 'Diesel Generator 1000 KVA Perkins 4008-30TAG2', category: 'Generator', sub: '1000 KVA', brand: 'Perkins', model: '4008-30TAG2', engine: 'PRK-4008-17720', capacity: '1000 KVA', purchase: '2023-09-05', value: 940000, years: 10, loc: 'Sharjah Yard', dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 57 },
  { n: 35, name: 'Diesel Generator 200 KVA Perkins 1106A (Unit 2)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70592', capacity: '200 KVA', purchase: '2023-04-12', value: 248000, years: 10, loc: 'Abu Dhabi Mussafah Yard', dept: 'Operations', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz, prime rating', util: 63 },
  { n: 36, name: 'Diesel Generator 500 KVA Perkins 2506C (Unit 2)', category: 'Generator', sub: '500 KVA', brand: 'Perkins', model: '2506C', engine: 'PRK-2506C-31244', capacity: '500 KVA', purchase: '2022-11-10', value: 505000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-06-01T08:30' }, status: 'Off Hire', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 50 Hz', util: 73 },
  { n: 37, name: 'Diesel Generator 100 KVA Perkins 1104D', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1104D', engine: 'PRK-1104D-23015', capacity: '100 KVA', purchase: '2021-05-15', value: 150000, years: 10, loc: 'Abu Dhabi Mussafah Yard', dept: 'Operations', status: 'Breakdown', override: { when: '2026-09-27 15:20', reason: 'Alternator failure during the weekly load test, waiting for parts' }, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 41 },
  { n: 38, name: 'Diesel Generator 200 KVA Perkins 1006 (Old Fleet)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1006TAG', engine: 'PRK-1006-08841', capacity: '200 KVA', purchase: '2017-01-20', value: 230000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', status: 'Yard', override: { when: '2026-09-18 11:00', reason: 'Parked: close to the end of its useful life, disposal being prepared' }, assetType: 'Power Equipment', spec: 'Open skid, 415 V, 50 Hz', util: 18 },
  { n: 39, name: 'Diesel Generator 100 KVA Perkins 1103 (Scrapped)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1103A', engine: 'PRK-1103A-00562', capacity: '100 KVA', purchase: '2014-04-02', value: 140000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Open skid, 415 V, 50 Hz', util: 0 },
  { n: 40, name: 'Diesel Generator 100 KVA Cummins C100D5 (Fire Damaged)', category: 'Generator', sub: '100 KVA', brand: 'Cummins', model: 'C100D5', engine: 'CUM-4BT-40977', capacity: '100 KVA', purchase: '2019-08-20', value: 160000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 0 },
  { n: 41, name: 'Crane Truck Hiab XS 288 on Isuzu FVZ', category: 'Vehicle', sub: 'Crane Truck', brand: 'Isuzu', model: 'FVZ 260 Hiab', engine: 'ISZ-6HK1-20871', capacity: '28 Ton.m', purchase: '2022-10-03', value: 380000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', status: 'In Service', fleet: { plate: 'Dubai L 30517', driver: 'Ravi Kumar' }, assetType: 'Vehicles', spec: 'Rigid truck with a rear-mounted hydraulic loader crane', util: 58 },
  { n: 42, name: 'Flatbed Truck Mitsubishi Fuso FJ 2528', category: 'Vehicle', sub: 'Flatbed Truck', brand: 'Mitsubishi', model: 'Fuso FJ 2528', engine: 'MIT-6D40-30415', capacity: '14 Ton', purchase: '2023-04-17', value: 295000, years: 8, loc: 'Abu Dhabi Mussafah Yard', dept: 'Logistics', status: 'In Service', fleet: { plate: 'Abu Dhabi 12 45118', driver: 'Sameer Khan' }, assetType: 'Vehicles', spec: 'Flatbed body with tie-down rails and side boards', util: 49 },
  { n: 43, name: 'Low-bed Truck MAN TGS 33.480', category: 'Vehicle', sub: 'Low-bed Truck', brand: 'MAN', model: 'TGS 33.480', engine: 'MAN-D2676-51209', capacity: '45 Ton', purchase: '2024-03-11', value: 465000, years: 8, loc: 'Jebel Ali Main Yard', dept: 'Logistics', status: 'In Service', fleet: { plate: 'Dubai M 77042', driver: 'Arun Das' }, assetType: 'Vehicles', spec: '6x4 tractor unit with hydraulic ramp low-bed trailer', util: 52 },
  { n: 26, name: 'Diesel Generator 200 KVA Perkins 1106A (Retired)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-41005', capacity: '200 KVA', purchase: '2015-05-10', value: 240000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 50 Hz', util: 0 },
  { n: 51, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 3)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88301', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-09-01T08:00' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 80 },
  { n: 52, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 4)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88302', capacity: '500 KVA', purchase: '2023-06-01', value: 520000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-09-12T08:00' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 78 },
  { n: 53, name: 'Diesel Generator 200 KVA Perkins 1106A (Unit 3)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70499', capacity: '200 KVA', purchase: '2022-03-15', value: 245000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-09-01T08:00' }, status: 'Yard', moves: [['2026-09-20T15:00', 'Return', 'Client: Emirates Infrastructure LLC', 'Jebel Ali Main Yard', 'RMA-26-00124']], assetType: 'Power Equipment', spec: 'Canopied, 415 V, 50 Hz', util: 70 },
  { n: 54, name: 'Diesel Generator 100 KVA Perkins 1104D (Unit 3)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1104D', engine: 'PRK-1104D-61877', capacity: '100 KVA', purchase: '2023-01-10', value: 118000, years: 10, loc: 'Jebel Ali Main Yard', dept: 'Operations', out: { site: 'Client: Al Safa Power Utilities', date: '2026-09-24T08:00' }, assetType: 'Power Equipment', spec: 'Canopied, 415 V, 50 Hz', util: 75 },
];
/** 40 more fixed assets (Oct 2026 demo data): ready units in every generator size, units out on hire, cross-hired units, idle and broken units, accessories and own delivery vehicles. */
const JA = 'Jebel Ali Main Yard', SJ = 'Sharjah Yard', AD = 'Abu Dhabi Mussafah Yard', WS = 'Workshop: Al Masaood Service Centre';
const EXTRA_SEEDS: Seed[] = [
  // 100 KVA
  { n: 44, name: 'Diesel Generator 100 KVA Cummins C100D5 (Unit 3)', category: 'Generator', sub: '100 KVA', brand: 'Cummins', model: 'C100D5', engine: 'CUM-4BT-44231', capacity: '100 KVA', purchase: '2024-05-06', value: 165000, years: 10, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz', util: 68 },
  { n: 45, name: 'Diesel Generator 100 KVA Perkins 1104D (Unit 4)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1104D', engine: 'PRK-1104D-61902', capacity: '100 KVA', purchase: '2023-08-14', value: 120000, years: 10, loc: SJ, dept: 'Operations', assetType: 'Power Equipment', spec: 'Canopied, 415 V, 50 Hz', util: 54 },
  { n: 46, name: 'Diesel Generator 100 KVA Cummins C100D5 (Unit 4)', category: 'Generator', sub: '100 KVA', brand: 'Cummins', model: 'C100D5', engine: 'CUM-4BT-41377', capacity: '100 KVA', purchase: '2022-06-20', value: 158000, years: 10, loc: AD, dept: 'Operations', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz', util: 47 },
  { n: 47, name: 'Diesel Generator 100 KVA Perkins 1104D (Unit 5)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1104D', engine: 'PRK-1104D-48215', capacity: '100 KVA', purchase: '2021-11-02', value: 122000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Al Noor Events Management', date: '2026-08-10T08:30' }, assetType: 'Power Equipment', spec: 'Canopied, 415 V, 50 Hz', util: 88 },
  // 200 KVA
  { n: 48, name: 'Diesel Generator 200 KVA Cummins C200D5 (Unit 3)', category: 'Generator', sub: '200 KVA', brand: 'Cummins', model: 'C200D5', engine: 'CUM-6CTA-55420', capacity: '200 KVA', purchase: '2024-09-12', value: 268000, years: 10, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 3 phase, 50 Hz', util: 52 },
  { n: 49, name: 'Diesel Generator 200 KVA Perkins 1106A (Unit 4)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70633', capacity: '200 KVA', purchase: '2022-08-01', value: 242000, years: 10, loc: SJ, dept: 'Operations', assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz, prime rating', util: 61 },
  { n: 50, name: 'Diesel Generator 200 KVA Cummins C200D5 (Unit 4)', category: 'Generator', sub: '200 KVA', brand: 'Cummins', model: 'C200D5', engine: 'CUM-6CTA-55388', capacity: '200 KVA', purchase: '2023-10-23', value: 262000, years: 10, loc: AD, dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 3 phase, 50 Hz', util: 44 },
  { n: 55, name: 'Diesel Generator 200 KVA Perkins 1106A (Unit 5)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1106A', engine: 'PRK-1106A-70704', capacity: '200 KVA', purchase: '2024-01-15', value: 250000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Desert Pearl Hotels', date: '2026-07-22T09:00' }, assetType: 'Power Equipment', spec: 'Canopy type, 415 V, 3 phase, 50 Hz, prime rating', util: 90 },
  { n: 56, name: 'Diesel Generator 200 KVA Volvo Penta Gulf Genset Cross-Hire', category: 'Generator', sub: '200 KVA', brand: 'Volvo', model: 'CH-TAD734', engine: 'VOL-TAD734-31208', capacity: '200 KVA', purchase: '2026-09-10', value: 0, years: 0, loc: JA, dept: 'Operations', crossHire: { supplier: 'Gulf Genset Rentals' }, status: 'Breakdown', override: { when: '2026-09-29 11:40', reason: 'Coolant pump seal leaking at the pre-delivery test, supplier technician booked' }, assetType: 'Power Equipment', spec: 'Cross-hired unit, canopy type, 415 V, 50 Hz', util: 18 },
  // 500 KVA
  { n: 57, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 5)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88455', capacity: '500 KVA', purchase: '2024-11-04', value: 528000, years: 10, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 59 },
  { n: 58, name: 'Diesel Generator 500 KVA Perkins 2506C (Unit 3)', category: 'Generator', sub: '500 KVA', brand: 'Perkins', model: '2506C', engine: 'PRK-2506C-31301', capacity: '500 KVA', purchase: '2023-02-27', value: 508000, years: 10, loc: SJ, dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 50 Hz', util: 51 },
  { n: 59, name: 'Diesel Generator 500 KVA Volvo Penta TAD1641GE', category: 'Generator', sub: '500 KVA', brand: 'Volvo', model: 'TAD1641GE', engine: 'VOL-TAD1641-20118', capacity: '500 KVA', purchase: '2022-09-12', value: 498000, years: 10, loc: AD, dept: 'Operations', assetType: 'Power Equipment', spec: 'Soundproof canopy, 415 V, 50 Hz', util: 46 },
  { n: 60, name: 'Diesel Generator 500 KVA Cummins C500D5 (Unit 6)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'C500D5', engine: 'CUM-QSX15-88519', capacity: '500 KVA', purchase: '2025-04-22', value: 535000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Sharjah Cement Company', date: '2026-03-10T08:00' }, assetType: 'Power Equipment', spec: 'Open skid with ATS provision, 415 V, 50 Hz', util: 96 },
  { n: 61, name: 'Diesel Generator 500 KVA Falcon Cross-Hire (Unit 2)', category: 'Generator', sub: '500 KVA', brand: 'Cummins', model: 'CH-500', engine: 'CUM-QSX15-70488', capacity: '500 KVA', purchase: '2026-07-18', value: 0, years: 0, loc: JA, dept: 'Operations', crossHire: { supplier: 'Falcon Equipment Hire LLC' }, out: { site: 'Client: Dubai Metro Works JV', date: '2026-07-20T09:00' }, assetType: 'Power Equipment', spec: 'Cross-hired unit, open skid, 415 V, 50 Hz', util: 85 },
  // 1000 KVA
  { n: 62, name: 'Diesel Generator 1000 KVA Cummins C1000D5 (Unit 3)', category: 'Generator', sub: '1000 KVA', brand: 'Cummins', model: 'C1000D5', engine: 'CUM-KTA50-92233', capacity: '1000 KVA', purchase: '2025-07-14', value: 995000, years: 10, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 40 },
  { n: 63, name: 'Diesel Generator 1000 KVA Mercedes MTU 12V2000', category: 'Generator', sub: '1000 KVA', brand: 'Mercedes', model: 'MTU 12V2000 G85', engine: 'MTU-12V2000-40621', capacity: '1000 KVA', purchase: '2025-11-03', value: 1120000, years: 12, loc: AD, dept: 'Operations', moves: [['2025-11-12T11:00', 'Internal Transfer', JA, AD, 'IT-25-00063']], assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz, sound attenuated', util: 33 },
  { n: 64, name: 'Diesel Generator 1000 KVA Perkins 4008-30TAG3', category: 'Generator', sub: '1000 KVA', brand: 'Perkins', model: '4008-30TAG3', engine: 'PRK-4008-17803', capacity: '1000 KVA', purchase: '2024-04-09', value: 950000, years: 10, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 55 },
  { n: 65, name: 'Diesel Generator 1000 KVA Cummins C1000D5 (Unit 4)', category: 'Generator', sub: '1000 KVA', brand: 'Cummins', model: 'C1000D5', engine: 'CUM-KTA50-92310', capacity: '1000 KVA', purchase: '2025-05-19', value: 995000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Al Safa Power Utilities', date: '2026-06-15T08:00' }, assetType: 'Power Equipment', spec: '40 ft container mounted, 415 V, 50 Hz', util: 95 },
  // 1500 KVA
  { n: 66, name: 'Diesel Generator 1500 KVA Cummins C1500D5 (Unit 2)', category: 'Generator', sub: '1500 KVA', brand: 'Cummins', model: 'C1500D5', engine: 'CUM-QSK60-10519', capacity: '1500 KVA', purchase: '2026-03-10', value: 1400000, years: 12, loc: JA, dept: 'Operations', assetType: 'Power Equipment', spec: '40 ft container mounted, 11 kV ready, 50 Hz', util: 20 },
  // spare engines
  { n: 67, name: 'Cummins Spare Engine QSX15-E500', category: 'Spare Engine', sub: 'Cummins Spare Engine', brand: 'Cummins', model: 'QSX15-E500', engine: 'CUM-QSX15-E0412', capacity: '500 kW', purchase: '2023-10-02', value: 135000, years: 10, loc: JA, dept: 'Workshop', ownership: 'Spare-Standby', assetType: 'Plant & Machinery', spec: 'Complete long engine assembly held as standby for 500 KVA sets', util: 3 },
  { n: 68, name: 'Cummins Spare Engine KTA50-E1000', category: 'Spare Engine', sub: 'Cummins Spare Engine', brand: 'Cummins', model: 'KTA50-E1000', engine: 'CUM-KTA50-E0277', capacity: '1000 kW', purchase: '2024-06-18', value: 210000, years: 10, loc: JA, dept: 'Workshop', ownership: 'Spare-Standby', status: 'Under Maintenance', moves: [['2026-09-21T11:00', 'Sent for Repair', JA, WS, 'JC-26-00247']], assetType: 'Plant & Machinery', spec: 'Standby engine for 1000 KVA sets, in the workshop for a top overhaul', util: 12 },
  // PODs
  { n: 69, name: 'POD 20 ft Power Container (Unit 2)', category: 'POD', sub: '20 ft POD', brand: 'Emirates Cable & Panel', model: 'POD-20', engine: 'N/A', capacity: '20 ft', purchase: '2023-05-22', value: 72000, years: 10, loc: JA, dept: 'Operations', assetType: 'Containers & Shelters', spec: 'Insulated 20 ft container with cable entry glands', util: 60 },
  { n: 70, name: 'POD 40 ft Power Container', category: 'POD', sub: '40 ft POD', brand: 'Emirates Cable & Panel', model: 'POD-40', engine: 'N/A', capacity: '40 ft', purchase: '2024-02-19', value: 118000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Palm Marina Development', date: '2026-05-30T10:00' }, assetType: 'Containers & Shelters', spec: 'Insulated 40 ft container with cable entry glands and internal lighting', util: 83 },
  { n: 71, name: 'POD 40 ft Power Container (Unit 2)', category: 'POD', sub: '40 ft POD', brand: 'Emirates Cable & Panel', model: 'POD-40', engine: 'N/A', capacity: '40 ft', purchase: '2023-11-08', value: 112000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Desert Pearl Hotels', date: '2026-03-01T09:30' }, status: 'Off Hire', moves: [['2026-09-18T14:00', 'Return', 'Client: Desert Pearl Hotels', JA, 'CN-26-00131']], assetType: 'Containers & Shelters', spec: 'Insulated 40 ft container with cable entry glands and internal lighting', util: 62 },
  // cables
  { n: 72, name: 'Power Cable Drum 4C x 95 mm (100 m)', category: 'Cable', sub: '4 Core 95 mm', brand: 'Emirates Cable & Panel', model: 'ECP-4C95', engine: 'N/A', capacity: '100 m', purchase: '2024-03-04', value: 18000, years: 6, loc: JA, dept: 'Operations', out: { site: 'Client: Gulf Build Contracting', date: '2026-08-03T09:00' }, assetType: 'Power Equipment', spec: 'XLPE insulated copper armoured cable on a steel drum', util: 77 },
  { n: 73, name: 'Power Cable Drum 4C x 185 mm (100 m)', category: 'Cable', sub: '4 Core 185 mm', brand: 'Emirates Cable & Panel', model: 'ECP-4C185', engine: 'N/A', capacity: '100 m', purchase: '2023-01-30', value: 32000, years: 8, loc: JA, dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-04-03T09:00' }, status: 'Off Hire', moves: [['2026-09-09T11:00', 'Return', 'Client: Emirates Infrastructure LLC', JA, 'CN-26-00118']], assetType: 'Power Equipment', spec: 'XLPE insulated copper armoured cable on a steel drum', util: 71 },
  { n: 74, name: 'Power Cable Drum 4C x 300 mm (50 m)', category: 'Cable', sub: '4 Core 300 mm', brand: 'Emirates Cable & Panel', model: 'ECP-4C300', engine: 'N/A', capacity: '50 m', purchase: '2025-06-17', value: 41500, years: 8, loc: JA, dept: 'Operations', out: { site: 'Client: Dubai Metro Works JV', date: '2026-08-18T08:30' }, assetType: 'Power Equipment', spec: 'XLPE insulated copper armoured cable on a steel drum', util: 77 },
  // panels
  { n: 75, name: 'ATS Panel 800A (Unit 2)', category: 'Panel', sub: 'ATS Panel', brand: 'Emirates Cable & Panel', model: 'ATS-800', engine: 'N/A', capacity: '800 A', purchase: '2024-10-08', value: 52000, years: 10, loc: JA, dept: 'Operations', out: { site: 'Client: Emirates Infrastructure LLC', date: '2026-09-05T08:00' }, assetType: 'Power Equipment', spec: 'Floor standing automatic transfer panel, 4 pole, 800 A', util: 70 },
  { n: 76, name: 'Synchronizing Panel 1250A (Unit 2)', category: 'Panel', sub: 'Synchronizing Panel', brand: 'Emirates Cable & Panel', model: 'SYN-1250', engine: 'N/A', capacity: '1250 A', purchase: '2022-04-12', value: 95000, years: 10, loc: JA, dept: 'Operations', status: 'Yard', override: { when: '2026-09-02 10:15', reason: 'Returned from the Al Safa site, parked until a project needs it; not offered for hire until refurbished' }, assetType: 'Power Equipment', spec: 'Paralleling panel for up to four generators, 1250 A', util: 3 },
  { n: 77, name: 'Distribution Panel 630A', category: 'Panel', sub: 'Distribution Panel', brand: 'Emirates Cable & Panel', model: 'DB-630', engine: 'N/A', capacity: '630 A', purchase: '2023-07-24', value: 24500, years: 10, loc: JA, dept: 'Operations', status: 'Under Maintenance', moves: [['2026-09-23T09:30', 'Sent for Repair', JA, WS, 'JC-26-00251']], assetType: 'Power Equipment', spec: 'Outdoor distribution board with 12 outgoing ways', util: 38 },
  // accessories
  { n: 78, name: 'Generator Trolley GT-3', category: 'Trolley', sub: 'Generator Trolley', brand: 'Local', model: 'GT-3', engine: 'N/A', capacity: '3 Ton', purchase: '2024-08-26', value: 19500, years: 6, loc: JA, dept: 'Operations', out: { site: 'Client: Sharjah Cement Company', date: '2026-03-10T08:00' }, assetType: 'Tools & Accessories', spec: 'Twin axle trolley with towing eye and jacks', util: 82 },
  { n: 79, name: 'Cable Tray Set Galvanised (60 m)', category: 'Tray', sub: 'Cable Tray', brand: 'Local', model: 'CT-60', engine: 'N/A', capacity: '60 m', purchase: '2022-02-15', value: 21500, years: 6, loc: JA, dept: 'Operations', status: 'Yard', override: { when: '2026-08-20 09:45', reason: 'Returned complete from the Sharjah site and stored, no demand' }, assetType: 'Tools & Accessories', spec: 'Hot dip galvanised perforated trays with couplers and covers', util: 4 },
  { n: 80, name: 'Day Tank 500 L', category: 'Day Tank', sub: '500 L Day Tank', brand: 'Emirates Cable & Panel', model: 'DT-500', engine: 'N/A', capacity: '500 L', purchase: '2023-09-11', value: 18500, years: 8, loc: JA, dept: 'Operations', out: { site: 'Client: Al Noor Events Management', date: '2026-08-10T08:30' }, assetType: 'Plant & Machinery', spec: 'Double wall steel tank with level gauge and transfer pump', util: 79 },
  { n: 81, name: 'Day Tank 1000 L (Unit 2)', category: 'Day Tank', sub: '1000 L Day Tank', brand: 'Emirates Cable & Panel', model: 'DT-1000', engine: 'N/A', capacity: '1000 L', purchase: '2024-12-02', value: 26500, years: 8, loc: JA, dept: 'Operations', out: { site: 'Client: Desert Pearl Hotels', date: '2026-09-28T09:00' }, status: 'Hold', assetType: 'Plant & Machinery', spec: 'Double wall steel tank with level gauge and transfer pump', util: 25 },
  // retired
  { n: 82, name: 'Diesel Generator 200 KVA Perkins 1006TAG (Old Fleet 2)', category: 'Generator', sub: '200 KVA', brand: 'Perkins', model: '1006TAG', engine: 'PRK-1006-05520', capacity: '200 KVA', purchase: '2016-03-14', value: 215000, years: 10, loc: JA, dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Open skid, 415 V, 50 Hz', util: 0 },
  { n: 83, name: 'Diesel Generator 100 KVA Perkins 1103A (Scrapped 2)', category: 'Generator', sub: '100 KVA', brand: 'Perkins', model: '1103A', engine: 'PRK-1103A-00417', capacity: '100 KVA', purchase: '2013-09-09', value: 125000, years: 10, loc: JA, dept: 'Operations', retired: true, assetType: 'Power Equipment', spec: 'Open skid, 415 V, 50 Hz', util: 0 },
  // own delivery vehicles
  { n: 84, name: 'Pickup Toyota Hilux 2.8 GD-6 Double Cab', category: 'Vehicle', sub: 'Pickup', brand: 'Toyota', model: 'Hilux 2.8 GD-6', engine: 'TOY-1GD-52914', capacity: '1 Ton', purchase: '2024-06-03', value: 118000, years: 6, loc: JA, dept: 'Logistics', status: 'In Service', fleet: { plate: 'Dubai T 92318', driver: 'Joseph Mathew' }, assetType: 'Vehicles', spec: 'Double cab 4x4 pickup for site visits and light deliveries', util: 74 },
  { n: 85, name: 'Crane Truck Mercedes Arocs 3345 with Palfinger PK 29002', category: 'Vehicle', sub: 'Crane Truck', brand: 'Mercedes', model: 'Arocs 3345', engine: 'MB-OM471-61902', capacity: '29 Ton.m', purchase: '2025-01-20', value: 640000, years: 8, loc: JA, dept: 'Logistics', status: 'In Service', fleet: { plate: 'Dubai N 51806', driver: 'Arun Das' }, assetType: 'Vehicles', spec: '6x4 rigid truck with a rear-mounted hydraulic loader crane', util: 62 },
  { n: 86, name: 'Flatbed Truck Isuzu NPR 85', category: 'Vehicle', sub: 'Flatbed Truck', brand: 'Isuzu', model: 'NPR 85', engine: 'ISZ-4JJ1-33076', capacity: '4 Ton', purchase: '2022-12-05', value: 168000, years: 8, loc: SJ, dept: 'Logistics', status: 'Under Maintenance', moves: [['2026-09-25T10:00', 'Sent for Repair', SJ, WS, 'JC-26-00258']], fleet: { plate: 'Sharjah 1 67390', driver: 'Imran Shah' }, assetType: 'Vehicles', spec: 'Flatbed body with tie-down rails for trolleys, cable drums and panels', util: 66 },
  { n: 87, name: 'Flatbed Truck Isuzu NPR 66 (Old Fleet)', category: 'Vehicle', sub: 'Flatbed Truck', brand: 'Isuzu', model: 'NPR 66', engine: 'ISZ-4HK1-18820', capacity: '3 Ton', purchase: '2016-01-18', value: 190000, years: 8, loc: JA, dept: 'Logistics', retired: true, fleet: { plate: 'Dubai F 20871' }, assetType: 'Vehicles', spec: 'Flatbed body, retired from the delivery fleet', util: 0 },
];
/** A unit bought later than the fixed 2025 yard transfer in fromSeed would show a transfer before it existed: keep only entries from the purchase date on. */
const fromExtra = (s: Seed): HeavyRec => { const h = fromSeed(s); return { ...h, movements: h.movements.filter((m) => m.date.slice(0, 10) >= h.purchaseDate) }; };

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
  s.moves?.forEach(([date, type, from, to, reference]) => movements.push(mv(date, type, from, to, reference, 'Grace Fernandez')));
  const ownership = ch ? 'Cross-Hired' : s.ownership ?? 'Owned';
  const assetStatus = s.status ? s.status : s.retired ? 'Disposed' : ch?.idle ? 'Yard' : s.out ? 'On Hire' : s.repair ? 'Under Maintenance' : ownership === 'Spare-Standby' ? 'Yard' : 'Ready for Hire';
  const putToUse = dayjs(s.purchase).add(14, 'day').format('YYYY-MM-DD');
  return {
    id: `he${s.n}`, code: `ITM-${String(s.n).padStart(4, '0')}`, assetId: `AST-${1000 + s.n}`, name: s.name, classification: 'Rental', tracking: 'Serialized',
    category: s.category, subCategory: s.sub, brand: s.brand, model: s.model, engineNo: s.engine, capacity: s.capacity, specification: s.spec, assetType: s.assetType,
    purchaseDate: s.purchase, putToUseDate: putToUse, assetValue: s.value, notDepreciable: 0, nbv, deprPct: s.value ? Math.round((depr / s.value) * 10000) / 100 : 0, deprAmount: depr, capex: s.value,
    department: s.dept, company: COMPANY, status: s.retired ? 'Inactive' : 'Active', assetStatus, statusOverride: s.override ? { by: 'Sanjay Kumar', ...s.override } : undefined,
    method: 'Straight line', decliningFactor: 0, computation: 'Constant periods', usefulLifeYears: s.years, usefulLifeHours: s.category === 'Generator' ? 40000 : undefined,
    accFixedAsset: ACCOUNTS.fixedAsset[acc], accDepreciation: ACCOUNTS.depreciation[acc], accExpense: ACCOUNTS.expense[s.assetType === 'Vehicles' ? 1 : 0], journal: ACCOUNTS.journals[0],
    ownership, supplier: ch?.supplier ?? '', crossHireIdle: !!ch?.idle,
    insurance: ch ? [] : s.assetType === 'Vehicles' ? [{ amount: '6800', date: '2026-01-15', dueDate: '2027-01-14', account: ACCOUNTS.insurance[0] }] : s.retired ? [] : [{ amount: String(Math.round(s.value * 0.012)), date: '2026-01-01', dueDate: '2026-12-31', account: ACCOUNTS.insurance[0] }],
    movements, utilization: s.util, idleDays: Math.round((100 - s.util) * 2.7), profitability: ch ? (s.util > 50 ? 18400 : -2600) : Math.round(s.value * 0.22 * (s.util / 100) - s.value * 0.01),
    attrs: s.category === 'Generator' ? { 'at-g1': 'Diesel', 'at-g2': 'Three Phase' } : {},
    audit: [
      { when: `${s.purchase} 10:05`, title: 'Asset record created', detail: `Asset ID AST-${1000 + s.n} generated`, by: 'Sanjay Kumar' },
      ...(ch ? [] : [{ when: `${putToUse} 09:00`, title: 'Depreciation started', detail: `${s.years} year useful life, Straight line`, by: 'System' }]),
      ...(s.out ? [{ when: s.out.date.replace('T', ' '), title: 'Asset Status changed', detail: `Ready for Hire to ${s.status === 'Hold' ? 'Hold' : 'On Hire'}`, by: 'Grace Fernandez' }] : []),
      ...(s.override ? [{ when: s.override.when, title: 'Asset Status changed by hand', detail: `${s.status}: ${s.override.reason}`, by: 'Sanjay Kumar' }] : []),
    ],
    attachments: s.retired || ch ? [] : [`${s.model.replace(/\s/g, '-')}-purchase-invoice.pdf`],
    ...(s.fleet ? { deliveryFleet: true, plateNumber: s.fleet.plate, defaultDriver: s.fleet.driver } : {}),
  };
}
export const heavySeed: HeavyRec[] = [...SEEDS.map(fromSeed), ...EXTRA_SEEDS.map(fromExtra)];

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
// Cross-hire records live in Rental > Cross Hire (collection rental.crossHire); the asset pages show them through a view.

/** Codes currently in use by Heavy Equipment records (live collection when loaded, seed otherwise). */
export const heavyCodes = () => {
  const live = getCollection<HeavyRec>('inventory.heavyEquipment');
  return (live.length ? live : heavySeed).map((h) => h.code);
};

/* ------------------------------------------------------------------ location master (existing + new) */
/** Location master (2 Oct call: Parent Location, Company and the address block removed; City kept). Stock figures are derived from location stock, never typed in. */
export interface LocationRec {
  id: string; code: string; name: string; shortName: string; type: string; supplierId?: string; city?: string;
  /** Employee locations (a service van): the user accounts that may draw stock from it */
  userIds?: string[];
  inventoryAvailable: boolean; status: 'Active' | 'Inactive';
}
export const LOCATION_TYPES = ['Own Yard', 'Supplier-Held Location', 'Employee'];
export const EMPLOYEE_LOCATION = 'Employee';
export const locationSeed: LocationRec[] = locations.map((l) => ({
  id: l.id, code: l.code, name: l.name, type: l.type, supplierId: l.supplierId, userIds: l.userIds, city: l.city,
  shortName: l.name.split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase(), inventoryAvailable: true, status: 'Active' as const,
}));
/** A quantity always shown with its unit, e.g. "21,500 Litres". */
export const qtyWithUnit = (qty: number, unit: string) => {
  const plural: Record<string, string> = { Nos: 'Nos', Meter: 'Meters', Litre: 'Litres', Drum: 'Drums', Visit: 'Visits', Job: 'Jobs', Kg: 'Kg', Set: 'Sets' };
  return `${qty.toLocaleString('en-US')} ${qty === 1 ? unit : plural[unit] ?? unit}`;
};

/* ------------------------------------------------------------------ certificates, usage readings, stock verification, disposal */
export const CERT_TYPES = ['Registration', 'Insurance', 'Inspection', 'Warranty', 'Other'];
/** Certificate / document types are a master (5 Oct call: if another type comes up, it has to be addable). */
export interface CertTypeRec { id: string; name: string; status: 'Active' | 'Inactive' }
export const certTypeSeed: CertTypeRec[] = CERT_TYPES.map((n, i) => ({ id: `ct${i + 1}`, name: n, status: 'Active' as const }));
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
/** A certificate with later history entries (renewal reminders, replaced documents). */
const certH = (n: number, assetId: string, type: string, reference: string, expiry: string, leadDays: number, ...more: AuditEntry[]): CertRec => {
  const c = cert(n, assetId, type, reference, expiry, leadDays);
  return { ...c, history: [...c.history, ...more] };
};
const remind = (when: string, detail: string): AuditEntry => ({ when, title: 'Expiry reminder sent', detail, by: 'System' });
certSeed.push(
  // expired
  certH(11, 'AST-1047', 'Insurance', 'POL-GEN-61102', '2026-09-12', 30, remind('2026-08-13 07:00', 'Expires in 30 days'), remind('2026-09-12 07:00', 'Expired today, renewal not yet uploaded')),
  certH(12, 'AST-1086', 'Registration', 'SHJ-TRK-51420', '2026-09-25', 45, remind('2026-08-11 07:00', 'Expires in 45 days'), { when: '2026-09-25 07:00', title: 'Certificate expired', detail: 'Truck is in the workshop, renewal waits for the repair', by: 'System' }),
  certH(13, 'AST-1084', 'Insurance', 'POL-VEH-30977', '2026-08-31', 30, remind('2026-08-01 07:00', 'Expires in 30 days')),
  certH(14, 'AST-1056', 'Inspection', 'CIV-INS-71208', '2026-09-28', 14),
  certH(53, 'AST-1041', 'Inspection', 'RTA-INS-2026-612', '2026-09-22', 21, remind('2026-09-01 07:00', 'Expires in 21 days')),
  // due within 7 / 14 / 30 days
  certH(15, 'AST-1085', 'Registration', 'DXB-TRK-52610', '2026-10-05', 45, remind('2026-08-21 07:00', 'Expires in 45 days'), remind('2026-09-28 07:00', 'Expires in 7 days')),
  certH(16, 'AST-1060', 'Inspection', 'CIV-INS-70331', '2026-10-07', 21, remind('2026-09-16 07:00', 'Expires in 21 days')),
  certH(50, 'AST-1023', 'Insurance', 'POL-VEH-30519', '2026-10-09', 30, remind('2026-09-09 07:00', 'Expires in 30 days')),
  certH(17, 'AST-1065', 'Insurance', 'POL-GEN-61544', '2026-10-12', 30, remind('2026-09-12 07:00', 'Expires in 30 days')),
  certH(19, 'AST-1021', 'Insurance', 'POL-VEH-30442', '2026-10-13', 30),
  certH(18, 'AST-1070', 'Inspection', 'CIV-INS-70955', '2026-10-14', 21),
  certH(51, 'AST-1043', 'Registration', 'DXB-TRK-47716', '2026-10-17', 45, remind('2026-09-02 07:00', 'Expires in 45 days')),
  certH(23, 'AST-1055', 'Insurance', 'POL-GEN-61307', '2026-10-20', 30),
  certH(20, 'AST-1057', 'Warranty', 'WR-CUM-88455', '2026-10-24', 30),
  certH(21, 'AST-1044', 'Inspection', 'CIV-INS-70488', '2026-10-28', 30),
  certH(52, 'AST-1042', 'Registration', 'AUH-TRK-45118', '2026-11-09', 45),
  // valid
  cert(22, 'AST-1062', 'Insurance', 'POL-GEN-61890', '2026-10-29', 14),
  cert(24, 'AST-1013', 'Other', 'LOAD-TEST-2026-044', '2026-11-12', 30),
  cert(25, 'AST-1044', 'Insurance', 'POL-GEN-61201', '2026-12-31', 30),
  cert(26, 'AST-1045', 'Insurance', 'POL-GEN-61202', '2026-12-31', 30),
  cert(27, 'AST-1046', 'Warranty', 'WR-CUM-41377', '2027-06-19', 60),
  certH(28, 'AST-1048', 'Warranty', 'WR-CUM-55420', '2027-09-11', 60, { when: '2026-03-04 14:10', title: 'Document replaced', detail: 'Warranty certificate re-issued with the corrected engine number', by: 'Sanjay Kumar' }),
  cert(29, 'AST-1049', 'Insurance', 'POL-GEN-61203', '2026-12-31', 30),
  cert(30, 'AST-1050', 'Inspection', 'CIV-INS-70512', '2027-03-18', 30),
  cert(31, 'AST-1057', 'Insurance', 'POL-GEN-61204', '2026-12-31', 30),
  cert(32, 'AST-1058', 'Insurance', 'POL-GEN-61205', '2026-12-31', 30),
  cert(33, 'AST-1059', 'Insurance', 'POL-GEN-61206', '2026-12-31', 30),
  cert(34, 'AST-1060', 'Insurance', 'POL-GEN-61207', '2026-12-31', 30),
  cert(35, 'AST-1060', 'Warranty', 'WR-CUM-88519', '2027-04-21', 60),
  cert(36, 'AST-1062', 'Warranty', 'WR-CUM-92233', '2027-07-13', 60),
  cert(37, 'AST-1063', 'Warranty', 'WR-MTU-40621', '2028-11-02', 90),
  cert(38, 'AST-1063', 'Insurance', 'POL-GEN-61208', '2026-12-31', 30),
  cert(39, 'AST-1064', 'Insurance', 'POL-GEN-61209', '2026-12-31', 30),
  cert(40, 'AST-1066', 'Warranty', 'WR-CUM-10519', '2028-03-09', 90),
  cert(41, 'AST-1066', 'Insurance', 'POL-GEN-61210', '2027-03-09', 30),
  cert(42, 'AST-1069', 'Insurance', 'POL-POD-23010', '2026-12-31', 30),
  cert(43, 'AST-1070', 'Insurance', 'POL-POD-23011', '2026-12-31', 30),
  cert(44, 'AST-1075', 'Warranty', 'WR-ECP-ATS800', '2027-10-07', 45),
  cert(45, 'AST-1084', 'Registration', 'DXB-PKP-61822', '2027-03-14', 45),
  certH(46, 'AST-1085', 'Insurance', 'POL-VEH-31388', '2027-01-20', 45, { when: '2026-01-21 10:30', title: 'Certificate renewed', detail: 'Previous policy POL-VEH-30388 replaced', by: 'Sanjay Kumar' }),
  cert(47, 'AST-1085', 'Inspection', 'RTA-INS-2026-904', '2026-11-30', 30),
  cert(48, 'AST-1086', 'Insurance', 'POL-VEH-30911', '2026-11-18', 30),
  cert(49, 'AST-1022', 'Insurance', 'POL-VEH-30788', '2027-01-14', 45),
  cert(54, 'AST-1019', 'Insurance', 'POL-GEN-55102', '2026-12-31', 30),
  cert(55, 'AST-1027', 'Other', 'HA-FAL-0412', '2026-12-05', 30),
);
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
/**
 * Monthly reading histories added in the Oct 2026 data set. Dates, hour meter values (running totals built from the monthly increments), fuel levels and notes are given per asset.
 * An asset whose last reading is older than 30 days shows in the overdue report; assets with no reading at all show as missing.
 */
const monthlyDates = (firstMonth: string, count: number, days: number[]) =>
  Array.from({ length: count }, (_, i) => `${dayjs(`${firstMonth}-01`).add(i, 'month').format('YYYY-MM')}-${String(days[i % days.length]).padStart(2, '0')}`);
const hoursFrom = (start: number, increments: number[]) => increments.reduce<number[]>((acc, inc) => [...acc, acc[acc.length - 1] + inc], [start]);
const TIMES = ['08:15', '09:00', '07:50', '10:30', '08:40', '14:00'];
let nextReading = 10;
const series = (assetId: string, dates: string[], hmr: number[], o: { by?: string[]; fuel?: (number | undefined)[]; notes?: Record<number, string>; paper?: number[] } = {}): ReadingRec[] =>
  dates.map((d, i) => rd(nextReading++, assetId, `${d}T${TIMES[i % TIMES.length]}`, hmr[i], o.by ? o.by[i % o.by.length] : 'Grace Fernandez', o.paper?.includes(i) ? READING_METHODS[1] : READING_METHODS[0], o.fuel?.[i], o.notes?.[i] ?? ''));
const GF = 'Grace Fernandez', SK = 'Sanjay Kumar', RP = 'Rajesh Pillai';
readingSeed.push(
  // AST-1060, 500 KVA on hire at Sharjah Cement since March 2026: near continuous running, monthly
  ...series('AST-1060', monthlyDates('2025-10', 12, [24, 23, 25, 22, 24, 24, 23, 25, 22, 24, 24, 23]), hoursFrom(180, [310, 420, 590, 610, 640, 650, 660, 690, 700, 680, 710]),
    { by: [GF, SK], fuel: [88, 84, 80, 75, 70, 66, 78, 72, 69, 64, 74, 70], notes: { 5: 'Handed over to client at Sharjah Cement site', 8: 'Oil and filters changed at 4,750 h', 11: 'Running normally on 82% load' } }),
  // AST-1065, 1000 KVA: test runs while waiting, then continuous running after the June 2026 delivery
  ...series('AST-1065', monthlyDates('2025-10', 12, [26, 25, 24, 27, 26, 24, 25, 26, 24, 25, 26, 24]), hoursFrom(12, [18, 22, 20, 16, 24, 18, 20, 230, 700, 705, 690]),
    { by: [SK], fuel: [95, 95, 94, 94, 95, 93, 92, 85, 78, 72, 80, 76], notes: { 6: 'Pre-delivery load test', 8: 'Delivered to Al Safa Power Utilities on 15 Jun', 9: 'Fuel topped up by client' }, paper: [10] }),
  // AST-1047, 100 KVA: light use until the August 2026 hire
  ...series('AST-1047', monthlyDates('2026-01', 9, [20, 19, 24, 21, 20, 22, 20, 21, 22]), hoursFrom(2150, [60, 85, 40, 110, 95, 120, 230, 520]),
    { by: [GF], fuel: [90, 88, 91, 85, 80, 82, 70, 66, 61], notes: { 7: 'Delivered to Al Noor Events on 10 Aug' } }),
  // AST-1055, 200 KVA on hire at Desert Pearl Hotels since 22 Jul 2026
  ...series('AST-1055', monthlyDates('2026-04', 6, [23, 22, 21, 23, 24, 21]), hoursFrom(1980, [90, 130, 80, 650, 680]),
    { by: [SK, GF], fuel: [92, 90, 86, 78, 71, 68], notes: { 3: 'Delivered, hour meter checked with the client', 5: 'Running normally' } }),
  // AST-1018 and AST-1015 (older units): history before the readings entered earlier
  ...series('AST-1018', monthlyDates('2026-03', 6, [14, 15, 16, 14, 15, 17]), hoursFrom(2080, [180, 150, 160, 190, 180]),
    { by: [SK], fuel: [60, 55, 62, 58, 54, 57], paper: [2, 4], notes: { 2: 'Paper log, entered later', 4: 'Paper log, entered later' } }),
  ...series('AST-1015', monthlyDates('2026-04', 4, [22, 24, 24, 23]), hoursFrom(5120, [280, 290, 260]),
    { by: [GF], fuel: [74, 70, 76, 68], notes: { 3: 'Belt tension checked' } }),
  // AST-1021, low-bed truck: engine hours, monthly
  ...series('AST-1021', monthlyDates('2026-03', 6, [5, 4, 5, 6, 5, 4]), hoursFrom(9820, [96, 104, 88, 112, 92]),
    { by: [SK], fuel: [60, 45, 70, 52, 66, 48], notes: { 2: 'Tyre pressure low, corrected', 5: 'Hydraulic ramp serviced' } }),
  // AST-1062, 1000 KVA: irregular gaps and now overdue (last reading 47 days ago)
  ...series('AST-1062', ['2025-11-04', '2026-01-20', '2026-02-02', '2026-06-11', '2026-08-14'], [14, 66, 71, 312, 498],
    { by: [GF, SK], fuel: [96, 92, 90, 81, 79], notes: { 1: 'First reading after a long gap', 3: 'Returned from a 3 month hire with Gulf Build', 4: 'Reading taken late, unit was on site' }, paper: [3] }),
  // AST-1057, 500 KVA: last reading end of July, overdue
  ...series('AST-1057', monthlyDates('2026-02', 6, [12, 11, 14, 13, 12, 29]), hoursFrom(1440, [150, 170, 160, 110, 140]),
    { by: [GF], fuel: [72, 68, 74, 70, 66, 64], notes: { 5: 'Reading taken before the unit was moved to the front row' } }),
  // AST-1049, 200 KVA: irregular, overdue
  ...series('AST-1049', ['2026-02-17', '2026-03-03', '2026-05-26', '2026-07-27'], [3640, 3702, 3891, 4020],
    { by: [SK], fuel: [58, 60, 51, 49], notes: { 2: 'No reading in April, unit on hire without a site reading' }, paper: [2] }),
  // AST-1064, 1000 KVA Perkins: monthly, up to date
  ...series('AST-1064', monthlyDates('2026-01', 9, [18, 17, 19, 18, 18, 17, 20, 18, 18]), hoursFrom(1620, [70, 85, 60, 95, 130, 110, 140, 120]),
    { by: [GF, SK], fuel: [96, 94, 95, 90, 88, 90, 84, 86, 82], notes: { 4: 'Oil sample sent to the lab', 8: 'Ready for hire' } }),
  // AST-1058, 500 KVA Perkins: monthly, up to date
  ...series('AST-1058', monthlyDates('2026-04', 6, [10, 9, 10, 10, 11, 10]).slice(0, 5).concat(['2026-09-14']), hoursFrom(2210, [120, 95, 140, 110, 105]),
    { by: [SK], fuel: [80, 78, 82, 76, 79, 74], notes: { 5: 'Idle between hires, started weekly on no load' } }),
  // AST-1032, 500 KVA Cummins
  ...series('AST-1032', monthlyDates('2026-05', 5, [8, 9, 10, 8, 9]), hoursFrom(4010, [230, 260, 240, 250]),
    { by: [GF], fuel: [70, 66, 72, 69, 65], notes: { 3: 'Coolant level topped up' } }),
  // AST-1067, long idle standby engine: only occasional checks (shows how little it runs)
  ...series('AST-1067', ['2026-02-02', '2026-09-08'], [0, 4],
    { by: [SK], notes: { 0: 'Stored with preservation oil', 1: 'Turned over for 4 hours, no faults' } }),
);
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
      al(21, 'Low-bed Truck Mercedes Actros 3340', 'Vehicle', 'Owned', 'In Service', 'Not Found', 'Driver says it was taken to Sharjah Yard; transfer not recorded'),
      al(23, 'Flatbed Truck Isuzu FTR 34', 'Vehicle', 'Owned', 'Under Maintenance', 'Found'),
      al(25, 'Perkins Spare Engine 2506C-E15', 'Spare Engine', 'Spare-Standby', 'Yard', 'Not Found', 'Possibly sent to the workshop without a movement entry'),
    ] },
  { id: 'cs6', number: 'SCS-26-00006', date: '2026-09-30', location: 'Sharjah Yard', countedBy: 'Grace Fernandez', status: 'In Progress', type: 'Fixed Assets', lines: [],
    assetLines: [
      al(22, 'Low-bed Truck Volvo FM 440', 'Vehicle', 'Owned', 'In Service', 'Found'),
      al(28, 'Diesel Generator 200 KVA Gulf Genset Cross-Hire', 'Generator', 'Cross-Hired', 'Yard', null),
      al(34, 'Diesel Generator 1000 KVA Perkins 4008-30TAG2', 'Generator', 'Owned', 'Ready for Hire', null),
    ] },
  { id: 'cs7', number: 'SCS-26-00007', date: '2026-09-22', location: 'Abu Dhabi Mussafah Yard', countedBy: 'Sanjay Kumar', status: 'Completed', confirmedBy: 'Hamdan Al Suwaidi', type: 'Fixed Assets', lines: [], adjustmentNo: 'ADJ-26-00022', adjustmentStatus: 'Approved',
    log: [{ when: '2026-09-22 16:40', title: 'Stock Adjustment raised', detail: 'ADJ-26-00022 sent for approval', by: 'Sanjay Kumar' }, { when: '2026-09-23 10:05', title: 'Approved', detail: 'Missing assets logged for follow-up', by: 'Hamdan Al Suwaidi' }],
    assetLines: [
      al(20, 'Diesel Generator 100 KVA Perkins P100 (Standby)', 'Generator', 'Spare-Standby', 'Yard', 'Found'),
      al(35, 'Diesel Generator 200 KVA Perkins 1106A (Unit 2)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(37, 'Diesel Generator 100 KVA Perkins 1104D', 'Generator', 'Owned', 'Ready for Hire', 'Not Found', 'Taken to the Perkins dealer for a load test; transfer not recorded on the count day'),
    ] },
];
countSeed.push(
  { id: 'cs8', number: 'SCS-26-00008', date: '2026-09-26', location: 'Sharjah Yard', countedBy: 'Grace Fernandez', status: 'Completed', confirmedBy: 'Sanjay Kumar', adjustmentNo: 'ADJ-26-00025', adjustmentStatus: 'Approved',
    reason: 'One fuel filter used on a visit without a stock issue, one battery received but not posted, 10 m of cable cut off and written off on site, four crimp lugs spoiled, two kg of grease miscounted',
    log: [{ when: '2026-09-26 16:50', title: 'Stock Adjustment raised', detail: 'ADJ-26-00025 sent for approval', by: 'Grace Fernandez' }, { when: '2026-09-27 09:20', title: 'Approved', detail: 'System quantities corrected', by: 'Sanjay Kumar' }], lines: [
    ln('i13', 'ITM-0301', 'Oil Filter (Perkins 1106)', 'Nos', 10, 10), ln('i14', 'ITM-0302', 'Air Filter (Cummins QSX15)', 'Nos', 3, 3), ln('i15', 'ITM-0303', 'Fuel Filter (Cummins C-Series)', 'Nos', 14, 13), ln('i16', 'ITM-0304', 'Coolant Extended Life 50/50 (20 L)', 'Drum', 4, 4),
    ln('i17', 'ITM-0305', 'Engine Oil 15W-40 (208 L Drum)', 'Drum', 2, 2), ln('i18', 'ITM-0306', 'Fan Belt (Perkins 1106)', 'Nos', 5, 5), ln('i20', 'ITM-0308', 'Battery 12V 100Ah', 'Nos', 6, 7), ln('i24', 'ITM-0312', 'Power Cable 4C x 95 mm', 'Meter', 350, 340),
    ln('i26', 'ITM-0314', 'Cable Lug 185 mm Copper (Crimp)', 'Nos', 40, 36), ln('i28', 'ITM-0316', 'Lithium Grease EP2', 'Kg', 40, 42)] },
  { id: 'cs9', number: 'SCS-26-00009', date: '2026-09-30', location: 'Abu Dhabi Mussafah Yard', countedBy: 'Sanjay Kumar', status: 'In Progress', type: 'Fixed Assets', lines: [],
    assetLines: [
      al(46, 'Diesel Generator 100 KVA Cummins C100D5 (Unit 4)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(50, 'Diesel Generator 200 KVA Cummins C200D5 (Unit 4)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(59, 'Diesel Generator 500 KVA Volvo Penta TAD1641GE', 'Generator', 'Owned', 'Ready for Hire', null),
      al(63, 'Diesel Generator 1000 KVA Mercedes MTU 12V2000', 'Generator', 'Owned', 'Ready for Hire', null),
      al(20, 'Diesel Generator 100 KVA Perkins P100 (Standby)', 'Generator', 'Spare-Standby', 'Yard', null),
    ] },
  { id: 'cs10', number: 'SCS-26-00010', date: '2026-09-27', location: 'Jebel Ali Main Yard', countedBy: 'Grace Fernandez', status: 'Completed', confirmedBy: 'Sanjay Kumar', type: 'Fixed Assets', lines: [], adjustmentNo: 'ADJ-26-00026', adjustmentStatus: 'Approved',
    log: [{ when: '2026-09-27 17:30', title: 'Stock Adjustment raised', detail: 'ADJ-26-00026 sent for approval', by: 'Grace Fernandez' }, { when: '2026-09-28 10:15', title: 'Approved', detail: 'Missing standby engine logged for follow-up with the workshop', by: 'Hamdan Al Suwaidi' }],
    assetLines: [
      al(44, 'Diesel Generator 100 KVA Cummins C100D5 (Unit 3)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(48, 'Diesel Generator 200 KVA Cummins C200D5 (Unit 3)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(57, 'Diesel Generator 500 KVA Cummins C500D5 (Unit 5)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(62, 'Diesel Generator 1000 KVA Cummins C1000D5 (Unit 3)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(66, 'Diesel Generator 1500 KVA Cummins C1500D5 (Unit 2)', 'Generator', 'Owned', 'Ready for Hire', 'Found'),
      al(69, 'POD 20 ft Power Container (Unit 2)', 'POD', 'Owned', 'Ready for Hire', 'Found'),
      al(76, 'Synchronizing Panel 1250A (Unit 2)', 'Panel', 'Owned', 'Yard', 'Found'),
      al(79, 'Cable Tray Set Galvanised (60 m)', 'Tray', 'Owned', 'Yard', 'Found'),
      al(67, 'Cummins Spare Engine QSX15-E500', 'Spare Engine', 'Spare-Standby', 'Yard', 'Not Found', 'Workshop collected it for a trial fit on a 500 KVA set; no movement entered'),
    ] },
  { id: 'cs11', number: 'SCS-26-00011', date: '2026-09-30', location: 'Jebel Ali Main Yard', countedBy: 'Sanjay Kumar', status: 'Completed', confirmedBy: 'Grace Fernandez', adjustmentNo: 'ADJ-26-00027', adjustmentStatus: 'Pending Approval',
    reason: 'Two Perkins oil filters found damaged, one fan belt returned from a van not posted, a 20 m cable cut length written off, ten kg of grease used in the workshop without an issue',
    log: [{ when: '2026-09-30 15:45', title: 'Stock Adjustment raised', detail: 'ADJ-26-00027 sent for approval', by: 'Sanjay Kumar' }], lines: [
    ln('i13', 'ITM-0301', 'Oil Filter (Perkins 1106)', 'Nos', 24, 22), ln('i14', 'ITM-0302', 'Air Filter (Cummins QSX15)', 'Nos', 5, 5), ln('i15', 'ITM-0303', 'Fuel Filter (Cummins C-Series)', 'Nos', 30, 30), ln('i16', 'ITM-0304', 'Coolant Extended Life 50/50 (20 L)', 'Drum', 10, 10),
    ln('i18', 'ITM-0306', 'Fan Belt (Perkins 1106)', 'Nos', 12, 13), ln('i20', 'ITM-0308', 'Battery 12V 100Ah', 'Nos', 14, 14), ln('i24', 'ITM-0312', 'Power Cable 4C x 95 mm', 'Meter', 900, 880), ln('i28', 'ITM-0316', 'Lithium Grease EP2', 'Kg', 120, 110),
    ln('i31', 'ITM-0319', 'Fire Extinguisher DCP 9 kg', 'Nos', 8, 8), ln('i32', 'ITM-0320', 'Hydraulic Oil ISO 68 (20 L)', 'Drum', 3, 3)] },
);
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
/** buyer = the party invoiced, saleValue = the invoice amount; both apply to a sale and to a scrap (scrap is sold to a scrap buyer). */
export interface DisposalOutcome { date: string; buyer?: string; buyerSource?: string; saleValue?: number; invoiceRef?: string; scrapRef?: string; journalRef: string; nbvAtDisposal: number; by: string }
export interface DisposalRec { id: string; number: string; assetId: string; reason: string; method: string; value: number; docs: string[]; status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'; date: string; log: AuditEntry[]; outcome?: DisposalOutcome }
export const disposalSeed: DisposalRec[] = [
  { id: 'dp1', number: 'DSP-26-00003', assetId: 'AST-1026', reason: 'End of Useful Life', method: 'Sale', value: 38000, docs: ['valuation-AST-1026.pdf'], status: 'Approved', date: '2026-03-12',
    outcome: { date: '2026-03-24', buyer: 'Khalid Bin Saeed (Farm Project)', buyerSource: 'Customer list', saleValue: 38000, invoiceRef: 'INV-26-00118', journalRef: 'JV-26-00342', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-03-12 10:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-03-13 15:10', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-03-16 09:40', title: 'Approved', detail: 'Asset marked Disposed', by: 'Ahmed Al Khouri' }, { when: '2026-03-24 14:20', title: 'Sale completed', detail: 'Sold to Khalid Bin Saeed (Farm Project) for AED 38,000; Sales Invoice INV-26-00118; journal JV-26-00342', by: 'Priya Menon' }] },
  { id: 'dp2', number: 'DSP-26-00004', assetId: 'AST-1023', reason: 'Damaged Beyond Repair', method: 'Scrap', value: 0, docs: [], status: 'Pending Approval', date: '2026-09-24', log: [{ when: '2026-09-24 11:30', title: 'Request raised', by: 'Grace Fernandez' }, { when: '2026-09-24 11:45', title: 'Submitted for approval', by: 'Grace Fernandez' }] },
  { id: 'dp3', number: 'DSP-26-00005', assetId: 'AST-1014', reason: 'Other', method: 'Sale', value: 90000, docs: [], status: 'Rejected', date: '2026-07-02', log: [{ when: '2026-07-02 10:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-07-03 12:15', title: 'Rejected', detail: 'Unit returned to service after repair', by: 'Ahmed Al Khouri' }] },
  { id: 'dp4', number: 'DSP-26-00006', assetId: 'AST-1039', reason: 'End of Useful Life', method: 'Scrap', value: 6500, docs: ['scrap-quote-AST-1039.pdf'], status: 'Approved', date: '2026-08-04',
    outcome: { date: '2026-08-20', buyer: 'Emirates Metal Recycling LLC', buyerSource: 'Entered manually', saleValue: 6500, invoiceRef: 'INV-26-00287', scrapRef: 'SCR-26-00011', journalRef: 'JV-26-00351', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-08-04 09:30', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-08-04 09:40', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-08-06 11:00', title: 'Approved', detail: 'Asset marked Disposed', by: 'Ahmed Al Khouri' }, { when: '2026-08-20 15:10', title: 'Scrap invoiced', detail: 'Invoice INV-26-00287 to Emirates Metal Recycling LLC for AED 6,500; scrap note SCR-26-00011; journal JV-26-00351', by: 'Priya Menon' }] },
  { id: 'dp5', number: 'DSP-26-00007', assetId: 'AST-1040', reason: 'Damaged Beyond Repair', method: 'Sale', value: 22000, docs: ['fire-report-AST-1040.pdf', 'valuation-AST-1040.pdf'], status: 'Approved', date: '2026-09-21', log: [
    { when: '2026-09-21 10:15', title: 'Request raised', by: 'Grace Fernandez' }, { when: '2026-09-21 10:20', title: 'Submitted for approval', by: 'Grace Fernandez' }, { when: '2026-09-25 12:30', title: 'Approved', detail: 'Asset marked Disposed. Sold as is for parts', by: 'Ahmed Al Khouri' }] },
  { id: 'dp6', number: 'DSP-26-00008', assetId: 'AST-1038', reason: 'End of Useful Life', method: 'Sale', value: 30000, docs: [], status: 'Draft', date: '2026-09-29', log: [{ when: '2026-09-29 14:00', title: 'Request raised', by: 'Sanjay Kumar' }] },
];
disposalSeed.push(
  { id: 'dp7', number: 'DSP-26-00009', assetId: 'AST-1082', reason: 'End of Useful Life', method: 'Sale', value: 41000, docs: ['valuation-AST-1082.pdf', 'sale-offer-AST-1082.pdf'], status: 'Approved', date: '2026-08-18',
    outcome: { date: '2026-09-02', buyer: 'Al Noor Events Management', buyerSource: 'Customer list', saleValue: 41000, invoiceRef: 'INV-26-00452', journalRef: 'JV-26-00361', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-08-18 10:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-08-18 10:20', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-08-21 11:15', title: 'Approved', detail: 'Asset marked Disposed', by: 'Ahmed Al Khouri' },
    { when: '2026-09-02 14:40', title: 'Sale completed', detail: 'Sold to Al Noor Events Management for AED 41,000; Sales Invoice INV-26-00452; journal JV-26-00361', by: 'Priya Menon' }] },
  { id: 'dp8', number: 'DSP-26-00010', assetId: 'AST-1083', reason: 'End of Useful Life', method: 'Scrap', value: 5200, docs: ['scrap-quote-AST-1083.pdf'], status: 'Approved', date: '2026-09-02',
    outcome: { date: '2026-09-17', buyer: 'Emirates Metal Recycling LLC', buyerSource: 'Entered manually', saleValue: 5200, invoiceRef: 'INV-26-00455', scrapRef: 'SCR-26-00014', journalRef: 'JV-26-00363', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-09-02 09:45', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-09-02 09:55', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-09-04 10:30', title: 'Approved', detail: 'Asset marked Disposed', by: 'Ahmed Al Khouri' },
    { when: '2026-09-17 15:25', title: 'Scrap invoiced', detail: 'Invoice INV-26-00455 to Emirates Metal Recycling LLC for AED 5,200; scrap note SCR-26-00014; journal JV-26-00363', by: 'Priya Menon' }] },
  { id: 'dp9', number: 'DSP-26-00011', assetId: 'AST-1087', reason: 'End of Useful Life', method: 'Sale', value: 36000, docs: ['valuation-AST-1087.pdf', 'mulkiya-AST-1087.pdf'], status: 'Approved', date: '2026-09-08',
    outcome: { date: '2026-09-26', buyer: 'Al Jazeera Used Trucks Trading', buyerSource: 'Entered manually', saleValue: 36000, invoiceRef: 'INV-26-00458', journalRef: 'JV-26-00365', nbvAtDisposal: 0, by: 'Priya Menon' }, log: [
    { when: '2026-09-08 11:00', title: 'Request raised', by: 'Grace Fernandez' }, { when: '2026-09-08 11:10', title: 'Submitted for approval', by: 'Grace Fernandez' }, { when: '2026-09-10 09:50', title: 'Approved', detail: 'Asset marked Disposed. Vehicle registration to be cancelled with the RTA', by: 'Ahmed Al Khouri' },
    { when: '2026-09-26 13:30', title: 'Sale completed', detail: 'Sold to Al Jazeera Used Trucks Trading for AED 36,000; Sales Invoice INV-26-00458; journal JV-26-00365', by: 'Priya Menon' }] },
  { id: 'dp10', number: 'DSP-26-00012', assetId: 'AST-1076', reason: 'Other', method: 'Sale', value: 30000, docs: ['valuation-AST-1076.pdf'], status: 'Pending Approval', date: '2026-09-29',
    log: [{ when: '2026-09-29 10:10', title: 'Request raised', detail: 'Analogue paralleling panel, replaced by a digital synchronizing panel in the fleet', by: 'Sanjay Kumar' }, { when: '2026-09-29 10:25', title: 'Submitted for approval', by: 'Sanjay Kumar' }] },
  { id: 'dp11', number: 'DSP-26-00013', assetId: 'AST-1079', reason: 'Damaged Beyond Repair', method: 'Scrap', value: 1800, docs: [], status: 'Draft', date: '2026-09-30',
    log: [{ when: '2026-09-30 11:05', title: 'Request raised', detail: 'Trays corroded after storage near the coast, scrap value to be confirmed', by: 'Grace Fernandez' }] },
  { id: 'dp12', number: 'DSP-26-00014', assetId: 'AST-1068', reason: 'Damaged Beyond Repair', method: 'Scrap', value: 12000, docs: ['workshop-report-AST-1068.pdf'], status: 'Rejected', date: '2026-09-22',
    log: [{ when: '2026-09-22 15:00', title: 'Request raised', by: 'Sanjay Kumar' }, { when: '2026-09-22 15:10', title: 'Submitted for approval', by: 'Sanjay Kumar' }, { when: '2026-09-24 10:40', title: 'Rejected', detail: 'Overhaul quote is well below the replacement cost, the engine will be repaired', by: 'Ahmed Al Khouri' }] },
);
