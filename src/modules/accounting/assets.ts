import { ACCOUNTS, buildBoard, COMPUTATIONS, DEPARTMENTS, DEPRECIATION_METHODS, locationSeed, TODAY, type LocationRec } from '@/modules/inventory/data';

/** Reused on the Fixed Asset form; the rest of the chart used here (location, department, accounts, depreciation method/computation) comes straight from the existing Inventory masters so the two registers stay consistent. */
export { ACCOUNTS, COMPUTATIONS, DEPARTMENTS, DEPRECIATION_METHODS, locationSeed, TODAY };
export type { LocationRec };

/**
 * Accounting > Fixed Asset Management > Assets Management (client feedback, instruction 8 Oct): the business's own fixed assets,
 * including delivery/fleet vehicles, are registered here instead of as a Heavy Equipment item in Inventory. Non-vehicle rental
 * equipment (generators, compressors...) is unaffected and stays in Inventory > Heavy Equipment.
 */
export const WRITTEN_OFF_BASIS = ['Sales', 'Purchase'];
export const ASSET_COL = 'accounting.fixedAssets';

export interface AssetRec {
  id: string;
  assetId: string;
  assetType: string;
  name: string;
  assetValue: number;
  /** Not stored as a separate depreciation run in this POC: computed straight from Asset Value, Not Depreciable Value, Duration and the method. */
  nbv: number;
  notDepreciable: number;
  acquisitionDate: string;
  location: string;
  /** Auto-filled from Asset Value when it is entered; kept editable afterwards for a later revaluation. */
  bookValue: number;
  putToUseDate: string;
  referenceNumber: string;
  method: string;
  computation: string;
  writtenOffBasis: string;
  decliningFactor: number;
  /** Useful life (years), the production ERP's Duration field. */
  usefulLifeYears: number;
  accFixedAsset: string;
  accDepreciation: string;
  accExpense: string;
  department: string;
  narration: string;
  seriesNumber: string;
  specification: string;
  attachments: string[];
  status: 'Active' | 'Inactive';
  /** Vehicle-specific (client feedback 8 Oct): used to deliver and collect equipment, never rented out, not counted in the rental fleet. */
  fleetVehicle: boolean;
  defaultDriver?: string;
  plateNumber?: string;
}

export const nextAssetId = (rows: Pick<AssetRec, 'assetId'>[]) => {
  const max = rows.reduce((mx, r) => Math.max(mx, Number(r.assetId.replace(/\D/g, '')) || 0), 1999);
  return `FA-${max + 1}`;
};

/** Net Asset Value, computed the same way as the Heavy Equipment depreciation board: straight line or declining balance from the capitalisation date. */
export function netAssetValue(a: Pick<AssetRec, 'assetValue' | 'notDepreciable' | 'usefulLifeYears' | 'method' | 'decliningFactor'> & { putToUseDate?: string; acquisitionDate?: string }): number {
  const board = buildBoard({ start: a.putToUseDate || a.acquisitionDate, assetValue: a.assetValue, notDepreciable: a.notDepreciable, months: (a.usefulLifeYears || 0) * 12, method: a.method, factor: a.decliningFactor });
  const posted = board.filter((b) => b.status === 'Posted');
  return posted.length ? posted[posted.length - 1].nbv : a.assetValue;
}

/** Fixed asset register seed: a handful of business fixed assets, including the delivery fleet vehicles previously held as Heavy Equipment Fixed Assets with "Delivery fleet vehicle" ticked (client feedback 8 Oct: vehicles are purchased for the business's own use, not for rental, so they belong in the Accounting Fixed Asset register, not Inventory). */
interface VehicleSeed { assetId: string; name: string; value: number; years: number; purchase: string; loc: string; dept: string; plate: string; driver: string; spec: string; retired?: boolean }
const VEHICLES: VehicleSeed[] = [
  { assetId: 'FA-2001', name: 'Low-bed Truck Mercedes Actros 3340', value: 420000, years: 8, purchase: '2021-02-14', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai P 48213', driver: 'Tariq Hussain', spec: '6x4 tractor unit with hydraulic ramp low-bed trailer' },
  { assetId: 'FA-2002', name: 'Low-bed Truck Volvo FM 440', value: 445000, years: 8, purchase: '2022-05-09', loc: 'Sharjah Yard', dept: 'Logistics', plate: 'Sharjah 3 22871', driver: 'Imran Shah', spec: '6x4 tractor unit with low-bed trailer' },
  { assetId: 'FA-2003', name: 'Flatbed Truck Isuzu FTR 34', value: 210000, years: 8, purchase: '2020-07-22', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai K 61904', driver: 'Joseph Mathew', spec: 'Flatbed body with tie-down rails' },
  { assetId: 'FA-2004', name: 'Crane Truck Hiab XS 288 on Isuzu FVZ', value: 380000, years: 8, purchase: '2022-10-03', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai L 30517', driver: 'Ravi Kumar', spec: 'Rigid truck with a rear-mounted hydraulic loader crane' },
  { assetId: 'FA-2005', name: 'Flatbed Truck Mitsubishi Fuso FJ 2528', value: 295000, years: 8, purchase: '2023-04-17', loc: 'Abu Dhabi Mussafah Yard', dept: 'Logistics', plate: 'Abu Dhabi 12 45118', driver: 'Sameer Khan', spec: 'Flatbed body with tie-down rails and side boards' },
  { assetId: 'FA-2006', name: 'Low-bed Truck MAN TGS 33.480', value: 465000, years: 8, purchase: '2024-03-11', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai M 77042', driver: 'Arun Das', spec: '6x4 tractor unit with hydraulic ramp low-bed trailer' },
  { assetId: 'FA-2007', name: 'Pickup Toyota Hilux 2.8 GD-6 Double Cab', value: 118000, years: 6, purchase: '2024-06-03', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai T 92318', driver: 'Joseph Mathew', spec: 'Double cab 4x4 pickup for site visits and light deliveries' },
  { assetId: 'FA-2008', name: 'Crane Truck Mercedes Arocs 3345 with Palfinger PK 29002', value: 640000, years: 8, purchase: '2025-01-20', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai N 51806', driver: 'Arun Das', spec: '6x4 rigid truck with a rear-mounted hydraulic loader crane' },
  { assetId: 'FA-2009', name: 'Flatbed Truck Isuzu NPR 85', value: 168000, years: 8, purchase: '2022-12-05', loc: 'Sharjah Yard', dept: 'Logistics', plate: 'Sharjah 1 67390', driver: 'Imran Shah', spec: 'Flatbed body with tie-down rails for trolleys, cable drums and panels' },
  { assetId: 'FA-2010', name: 'Flatbed Truck Isuzu NPR 66 (Old Fleet)', value: 190000, years: 8, purchase: '2016-01-18', loc: 'Jebel Ali Main Yard', dept: 'Logistics', plate: 'Dubai F 20871', driver: '', spec: 'Flatbed body, retired from the delivery fleet', retired: true },
];
const vehicleRec = (v: VehicleSeed): AssetRec => {
  const base: Omit<AssetRec, 'nbv'> = {
    id: `fa-${v.assetId}`, assetId: v.assetId, assetType: 'Vehicles', name: v.name, assetValue: v.value, notDepreciable: 0,
    acquisitionDate: v.purchase, location: v.loc, bookValue: v.value, putToUseDate: v.purchase, referenceNumber: '',
    method: 'Declining', computation: 'Constant periods', writtenOffBasis: 'Purchase', decliningFactor: 1.5, usefulLifeYears: v.years,
    accFixedAsset: ACCOUNTS.fixedAsset[1], accDepreciation: ACCOUNTS.depreciation[1], accExpense: ACCOUNTS.expense[1],
    department: v.dept, narration: '', seriesNumber: '', specification: v.spec, attachments: [], status: v.retired ? 'Inactive' : 'Active',
    fleetVehicle: true, defaultDriver: v.driver || undefined, plateNumber: v.plate,
  };
  return { ...base, nbv: netAssetValue(base) };
};
const nonVehicleRec = (over: Omit<AssetRec, 'nbv' | 'fleetVehicle' | 'status' | 'notDepreciable' | 'bookValue' | 'referenceNumber' | 'narration' | 'seriesNumber' | 'attachments' | 'writtenOffBasis' | 'computation' | 'decliningFactor'> & Partial<AssetRec>): AssetRec => {
  const base: Omit<AssetRec, 'nbv'> = {
    notDepreciable: 0, bookValue: over.assetValue, referenceNumber: '', narration: '', seriesNumber: '', attachments: [], writtenOffBasis: 'Purchase', computation: 'Constant periods', decliningFactor: 0, status: 'Active', fleetVehicle: false,
    ...over,
  };
  return { ...base, nbv: netAssetValue(base) };
};
export const assetSeed: AssetRec[] = [
  nonVehicleRec({ id: 'fa1', assetId: 'FA-1001', assetType: 'Plant & Machinery', name: 'Head Office Furniture and Fixtures', assetValue: 95000, acquisitionDate: '2021-01-10', putToUseDate: '2021-01-15', location: 'Jebel Ali Main Yard', department: 'Administration', method: 'Straight line', usefulLifeYears: 10, accFixedAsset: ACCOUNTS.fixedAsset[0], accDepreciation: ACCOUNTS.depreciation[0], accExpense: ACCOUNTS.expense[0], specification: 'Workstations, chairs and reception furniture' }),
  nonVehicleRec({ id: 'fa2', assetId: 'FA-1002', assetType: 'Plant & Machinery', name: 'IT Equipment - Servers and Networking', assetValue: 68000, acquisitionDate: '2022-06-01', putToUseDate: '2022-06-05', location: 'Jebel Ali Main Yard', department: 'Administration', method: 'Straight line', usefulLifeYears: 5, accFixedAsset: ACCOUNTS.fixedAsset[0], accDepreciation: ACCOUNTS.depreciation[0], accExpense: ACCOUNTS.expense[0], specification: 'Office servers, switches and rack' }),
  ...VEHICLES.map(vehicleRec),
];
