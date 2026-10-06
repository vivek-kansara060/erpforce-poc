/**
 * Shared master data used across all modules (customers, suppliers, equipment categories, fixed asset register,
 * locations, cost centres, employees). Mock/local data only. Modules read these through useCollection(name, seed).
 * Collection names: 'customers' 'suppliers' 'assets' 'locations' 'costCentres' 'employees'
 */

export const COMPANY = 'Gulf Power Rentals LLC';
export const CURRENCY = 'AED';

/** Unified Asset Status master (Rental + Inventory & Fixed Assets share one list, admin-extendable). */
/** "In Service" is for own delivery vehicles (Fleet Management, 6 Oct): they are never Ready for Hire / On Hire. */
export const ASSET_STATUSES = ['Ready for Hire', 'On Hire', 'Off Hire', 'Breakdown', 'Under Maintenance', 'Disposed', 'Yard', 'Hold', 'In Service'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ACTIVITY_TYPES = ['Rental', 'Trading', 'Fuel Trading', 'AMC', 'Other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const OWNERSHIP_TYPES = ['Owned', 'Cross-Hired', 'Spare-Standby'] as const;

/** Category & Sub-Category master. Group = "Category Name", category = "Sub-Category Name" in the requirement. */
export interface EquipmentGroup { group: string; categories: string[] }
export const equipmentGroups: EquipmentGroup[] = [
  { group: 'Generator', categories: ['100 KVA', '200 KVA', '500 KVA', '1000 KVA', '1500 KVA'] },
  { group: 'Cable', categories: ['4 Core 95 mm', '4 Core 185 mm', '4 Core 300 mm'] },
  { group: 'Panel', categories: ['ATS Panel', 'Synchronizing Panel', 'Distribution Panel'] },
  { group: 'POD', categories: ['20 ft POD', '40 ft POD'] },
  { group: 'Trolley', categories: ['Generator Trolley'] },
  { group: 'Tray', categories: ['Cable Tray'] },
  { group: 'Day Tank', categories: ['500 L Day Tank', '1000 L Day Tank'] },
  { group: 'Spare Engine', categories: ['Perkins Spare Engine', 'Cummins Spare Engine'] },
  { group: 'Vehicle', categories: ['Low-bed Truck', 'Flatbed Truck', 'Crane Truck', 'Pickup'] },
];

export interface Customer {
  id: string; code: string; name: string; type: 'Company' | 'Individual'; tradeLicense: string; trn: string; contact: string; phone: string; email: string;
  creditLimit: number; creditTerms: number; salesperson: string; active: boolean; city: string; outstanding: number;
}
export const customers: Customer[] = [
  { id: 'c1', code: 'CUS-0001', name: 'Emirates Infrastructure LLC', type: 'Company', tradeLicense: 'DED-784512', trn: '100254781200003', contact: 'Rashid Al Mansoori', phone: '+971 50 214 7781', email: 'rashid@emiratesinfra.ae', creditLimit: 1500000, creditTerms: 45, salesperson: 'Omar Farouk', active: true, city: 'Dubai', outstanding: 812400 },
  { id: 'c2', code: 'CUS-0002', name: 'Gulf Build Contracting', type: 'Company', tradeLicense: 'DED-663120', trn: '100311452700003', contact: 'Vikram Nair', phone: '+971 55 902 1140', email: 'vikram@gulfbuild.ae', creditLimit: 900000, creditTerms: 30, salesperson: 'Omar Farouk', active: true, city: 'Abu Dhabi', outstanding: 934000 },
  { id: 'c3', code: 'CUS-0003', name: 'Al Noor Events Management', type: 'Company', tradeLicense: 'DED-551874', trn: '100487213300003', contact: 'Maha Saleh', phone: '+971 52 118 6634', email: 'maha@alnoorevents.ae', creditLimit: 250000, creditTerms: 15, salesperson: 'Leena Thomas', active: true, city: 'Dubai', outstanding: 64200 },
  { id: 'c4', code: 'CUS-0004', name: 'Desert Pearl Hotels', type: 'Company', tradeLicense: 'SHJ-220914', trn: '100622904100003', contact: 'Imran Qureshi', phone: '+971 56 447 9021', email: 'imran@desertpearl.ae', creditLimit: 600000, creditTerms: 60, salesperson: 'Leena Thomas', active: true, city: 'Sharjah', outstanding: 218500 },
  { id: 'c5', code: 'CUS-0005', name: 'Dubai Metro Works JV', type: 'Company', tradeLicense: 'DED-902231', trn: '100118845600003', contact: 'Sergei Petrov', phone: '+971 54 330 2288', email: 'sergei@dmwjv.ae', creditLimit: 2500000, creditTerms: 60, salesperson: 'Omar Farouk', active: true, city: 'Dubai', outstanding: 1650000 },
  { id: 'c6', code: 'CUS-0006', name: 'Sharjah Cement Company', type: 'Company', tradeLicense: 'SHJ-118420', trn: '100530177800003', contact: 'Hassan Ali', phone: '+971 50 771 4409', email: 'hassan@sharjahcement.ae', creditLimit: 1200000, creditTerms: 45, salesperson: 'Yousef Karim', active: true, city: 'Sharjah', outstanding: 301000 },
  { id: 'c7', code: 'CUS-0007', name: 'Al Safa Power Utilities', type: 'Company', tradeLicense: 'AUH-330187', trn: '100742016600003', contact: 'Nadia Rahman', phone: '+971 58 620 3312', email: 'nadia@alsafapower.ae', creditLimit: 800000, creditTerms: 30, salesperson: 'Yousef Karim', active: true, city: 'Abu Dhabi', outstanding: 0 },
  { id: 'c8', code: 'CUS-0008', name: 'Palm Marina Development', type: 'Company', tradeLicense: 'DED-771093', trn: '100365520900003', contact: 'Daniel Foster', phone: '+971 52 905 7714', email: 'daniel@palmmarina.ae', creditLimit: 700000, creditTerms: 30, salesperson: 'Leena Thomas', active: true, city: 'Dubai', outstanding: 125000 },
  { id: 'c9', code: 'CUS-0009', name: 'Khalid Bin Saeed (Farm Project)', type: 'Individual', tradeLicense: '-', trn: '-', contact: 'Khalid Bin Saeed', phone: '+971 50 118 2200', email: 'khalid.saeed@mail.ae', creditLimit: 50000, creditTerms: 7, salesperson: 'Yousef Karim', active: true, city: 'Al Ain', outstanding: 0 },
];

export interface Supplier {
  id: string; code: string; name: string; type: 'Equipment Manufacturer' | 'Spare Parts Supplier' | 'Fuel Supplier' | 'Cross-Hire Company' | 'Service Provider' | 'Other';
  classification: 'Preferred' | 'New' | 'Blacklisted' | ''; tradeLicense: string; trn: string; contact: string; phone: string; email: string; creditPeriod: number;
  creditLimit: number; rating: number; active: boolean; paymentTerms: string;
}
export const suppliers: Supplier[] = [
  { id: 's1', code: 'SUP-0001', name: 'Cummins Gulf FZE', type: 'Equipment Manufacturer', classification: 'Preferred', tradeLicense: 'JAFZA-44120', trn: '100901224500003', contact: 'Andrew Coyle', phone: '+971 4 881 2200', email: 'orders@cumminsgulf.ae', creditPeriod: 60, creditLimit: 3000000, rating: 4.6, active: true, paymentTerms: 'Net 60' },
  { id: 's2', code: 'SUP-0002', name: 'Perkins Power Systems', type: 'Equipment Manufacturer', classification: 'Preferred', tradeLicense: 'JAFZA-38874', trn: '100812345500003', contact: 'Sunil Varma', phone: '+971 4 887 3010', email: 'sales@perkinspower.ae', creditPeriod: 45, creditLimit: 2000000, rating: 4.3, active: true, paymentTerms: 'Net 45' },
  { id: 's3', code: 'SUP-0003', name: 'Al Ittihad Spare Parts Trading', type: 'Spare Parts Supplier', classification: 'Preferred', tradeLicense: 'DED-220981', trn: '100455120300003', contact: 'Mohammed Jasim', phone: '+971 4 339 1187', email: 'parts@alittihad.ae', creditPeriod: 30, creditLimit: 400000, rating: 4.1, active: true, paymentTerms: 'Net 30' },
  { id: 's4', code: 'SUP-0004', name: 'ENOC Fuel Distribution', type: 'Fuel Supplier', classification: 'Preferred', tradeLicense: 'DED-100440', trn: '100000784100003', contact: 'Fatima Al Zaabi', phone: '+971 4 707 5000', email: 'b2b@enoc.ae', creditPeriod: 15, creditLimit: 1500000, rating: 4.8, active: true, paymentTerms: 'Net 15' },
  { id: 's5', code: 'SUP-0005', name: 'Falcon Equipment Hire LLC', type: 'Cross-Hire Company', classification: 'Preferred', tradeLicense: 'DED-604412', trn: '100628811200003', contact: 'Tariq Mahmood', phone: '+971 50 665 7712', email: 'hire@falconequip.ae', creditPeriod: 30, creditLimit: 800000, rating: 4.0, active: true, paymentTerms: 'Net 30' },
  { id: 's6', code: 'SUP-0006', name: 'Gulf Genset Rentals', type: 'Cross-Hire Company', classification: 'New', tradeLicense: 'SHJ-331200', trn: '100777023400003', contact: 'Ravi Menon', phone: '+971 55 210 4471', email: 'ops@gulfgenset.ae', creditPeriod: 30, creditLimit: 500000, rating: 3.6, active: true, paymentTerms: 'Net 30' },
  { id: 's7', code: 'SUP-0007', name: 'Emirates Cable & Panel Works', type: 'Equipment Manufacturer', classification: '', tradeLicense: 'DED-410093', trn: '100340118800003', contact: 'Peter Dsouza', phone: '+971 4 285 6601', email: 'info@ecpworks.ae', creditPeriod: 45, creditLimit: 600000, rating: 3.9, active: true, paymentTerms: 'Net 45' },
  { id: 's8', code: 'SUP-0008', name: 'Prime Field Services', type: 'Service Provider', classification: 'Blacklisted', tradeLicense: 'DED-118872', trn: '100290014400003', contact: 'Ali Reza', phone: '+971 56 902 1188', email: 'ali@primefield.ae', creditPeriod: 0, creditLimit: 0, rating: 2.1, active: false, paymentTerms: 'Advance' },
  { id: 's9', code: 'SUP-0009', name: 'Gulf Haulage and Transport LLC', type: 'Service Provider', classification: 'Preferred', tradeLicense: 'DED-552310', trn: '100290014400011', contact: 'Ali Reza', phone: '+971 56 902 1188', email: 'ali@primefield.ae', creditPeriod: 0, creditLimit: 0, rating: 2.1, active: false, paymentTerms: 'Advance' },
  { id: 's10', code: 'SUP-0010', name: 'Al Safeer Heavy Transport', type: 'Service Provider', classification: 'New', tradeLicense: 'DED-660218', trn: '100290014400029', contact: 'Ali Reza', phone: '+971 56 902 1188', email: 'ali@primefield.ae', creditPeriod: 0, creditLimit: 0, rating: 2.1, active: false, paymentTerms: 'Advance' },
];

export interface LocationMaster {
  id: string; code: string; name: string; type: 'Own Yard' | 'Supplier-Held Location' | 'Employee'; supplierId?: string; userIds?: string[]; city: string; stockHeld?: number; consumed?: number; remainingValue?: number;
}
export const locations: LocationMaster[] = [
  { id: 'l1', code: 'LOC-0001', name: 'Jebel Ali Main Yard', type: 'Own Yard', city: 'Dubai' },
  { id: 'l2', code: 'LOC-0002', name: 'Sharjah Yard', type: 'Own Yard', city: 'Sharjah' },
  { id: 'l3', code: 'LOC-0003', name: 'Abu Dhabi Mussafah Yard', type: 'Own Yard', city: 'Abu Dhabi' },
  { id: 'l4', code: 'LOC-0004', name: 'ENOC Al Quoz Depot (Fuel Stock)', type: 'Supplier-Held Location', supplierId: 's4', city: 'Dubai', stockHeld: 60000, consumed: 38500, remainingValue: 21500 * 2.85 },
  // Service vans: spare parts carried by the AMC technicians, assigned to their user accounts.
  { id: 'l5', code: 'LOC-0005', name: 'Service Van 1 (Rajesh Pillai)', type: 'Employee', userIds: ['u8'], city: 'Dubai' },
  { id: 'l6', code: 'LOC-0006', name: 'Service Van 2 (Shared)', type: 'Employee', userIds: ['u8', 'u7'], city: 'Sharjah' },
];

export interface Asset {
  id: string; assetId: string; item: string; group: string; category: string; brand: string; model: string; serial: string;
  status: AssetStatus; ownership: 'Owned' | 'Cross-Hired' | 'Spare-Standby'; active: boolean; location: string; customer?: string; project?: string;
  purchaseDate: string; assetValue: number; nbv: number; usefulLifeYears: number; usedYears: number; hmr: number; utilization: number; certExpiry: string;
  crossHireSupplier?: string; crossHireIdle?: boolean; holdReason?: string;
}
const A = (n: number, group: string, category: string, brand: string, model: string, over: Partial<Asset>): Asset => ({
  id: `a${n}`, assetId: `AST-${String(1000 + n)}`, item: `${group} ${category}`, group, category, brand, model, serial: `${brand.slice(0, 3).toUpperCase()}${88000 + n * 37}`,
  status: 'Ready for Hire', ownership: 'Owned', active: true, location: 'Jebel Ali Main Yard', purchaseDate: '2022-03-15', assetValue: 180000, nbv: 126000, usefulLifeYears: 10, usedYears: 3, hmr: 4200 + n * 130,
  utilization: 60 + ((n * 7) % 35), certExpiry: '2027-02-28', ...over,
});
export const assets: Asset[] = [
  A(1, 'Generator', '100 KVA', 'Cummins', 'C100D5', { status: 'On Hire', customer: 'Emirates Infrastructure LLC', project: 'Al Maktoum Airport Expansion', location: 'Customer Site', assetValue: 165000, nbv: 118500 }),
  A(2, 'Generator', '100 KVA', 'Cummins', 'C100D5', { status: 'Ready for Hire', assetValue: 165000, nbv: 121000 }),
  A(3, 'Generator', '200 KVA', 'Perkins', '1106A', { status: 'On Hire', customer: 'Gulf Build Contracting', project: 'Yas Island Villas Phase 2', location: 'Customer Site', assetValue: 245000, nbv: 176000 }),
  A(4, 'Generator', '200 KVA', 'Perkins', '1106A', { status: 'Yard', location: 'Sharjah Yard', assetValue: 245000, nbv: 181000 }),
  A(5, 'Generator', '200 KVA', 'Cummins', 'C200D5', { status: 'Under Maintenance', location: 'Jebel Ali Main Yard', assetValue: 260000, nbv: 152000, usedYears: 5 }),
  A(6, 'Generator', '500 KVA', 'Cummins', 'C500D5', { status: 'On Hire', customer: 'Dubai Metro Works JV', project: 'Route 2020 Depot', location: 'Customer Site', assetValue: 520000, nbv: 401000 }),
  A(7, 'Generator', '500 KVA', 'Cummins', 'C500D5', { status: 'On Hire', customer: 'Sharjah Cement Company', project: 'Kiln 4 Shutdown', location: 'Customer Site', assetValue: 520000, nbv: 389000 }),
  A(8, 'Generator', '500 KVA', 'Perkins', '2506C', { status: 'Off Hire', location: 'Jebel Ali Main Yard', assetValue: 505000, nbv: 372000 }),
  A(9, 'Generator', '1000 KVA', 'Cummins', 'C1000D5', { status: 'On Hire', customer: 'Dubai Metro Works JV', project: 'Route 2020 Depot', location: 'Customer Site', assetValue: 980000, nbv: 812000, usedYears: 2 }),
  A(10, 'Generator', '1000 KVA', 'Cummins', 'C1000D5', { status: 'Hold', customer: 'Palm Marina Development', project: 'Marina Tower 3', location: 'Customer Site', assetValue: 980000, nbv: 790000, holdReason: 'Client site not ready for deployment (Client responsibility)' }),
  A(11, 'Generator', '1500 KVA', 'Cummins', 'C1500D5', { status: 'Ready for Hire', assetValue: 1450000, nbv: 1240000, usedYears: 1 }),
  A(12, 'Generator', '500 KVA', 'Falcon (Cross-Hire)', 'CH-500', { status: 'On Hire', ownership: 'Cross-Hired', customer: 'Al Noor Events Management', project: 'Expo Winter Festival', location: 'Customer Site', assetValue: 0, nbv: 0, crossHireSupplier: 'Falcon Equipment Hire LLC', usefulLifeYears: 0, usedYears: 0 }),
  A(13, 'Generator', '200 KVA', 'Gulf Genset (Cross-Hire)', 'CH-200', { status: 'Yard', ownership: 'Cross-Hired', location: 'Sharjah Yard', assetValue: 0, nbv: 0, crossHireSupplier: 'Gulf Genset Rentals', crossHireIdle: true, usefulLifeYears: 0, usedYears: 0 }),
  A(14, 'Generator', '100 KVA', 'Perkins', 'P100', { status: 'Ready for Hire', ownership: 'Spare-Standby', location: 'Abu Dhabi Mussafah Yard', assetValue: 150000, nbv: 110000 }),
  A(15, 'Panel', 'ATS Panel', 'Emirates Cable', 'ATS-630', { status: 'On Hire', customer: 'Dubai Metro Works JV', project: 'Route 2020 Depot', location: 'Customer Site', assetValue: 48000, nbv: 33000 }),
  A(16, 'Panel', 'Synchronizing Panel', 'Emirates Cable', 'SYN-1250', { status: 'Ready for Hire', assetValue: 95000, nbv: 74000 }),
  A(17, 'POD', '20 ft POD', 'Emirates Cable', 'POD-20', { status: 'On Hire', customer: 'Gulf Build Contracting', project: 'Yas Island Villas Phase 2', location: 'Customer Site', assetValue: 70000, nbv: 52000 }),
  A(18, 'Day Tank', '1000 L Day Tank', 'Emirates Cable', 'DT-1000', { status: 'Breakdown', location: 'Customer Site', customer: 'Desert Pearl Hotels', project: 'Resort Backup Power', assetValue: 18000, nbv: 9500 }),
  A(19, 'Vehicle', 'Low-bed Truck', 'Mercedes', 'Actros 3340', { status: 'On Hire', ownership: 'Owned', location: 'Jebel Ali Main Yard', assetValue: 420000, nbv: 285000, utilization: 71, usefulLifeYears: 8 }),
  A(20, 'Vehicle', 'Low-bed Truck', 'Volvo', 'FM 440', { status: 'Ready for Hire', location: 'Sharjah Yard', assetValue: 445000, nbv: 330000, utilization: 64, usefulLifeYears: 8 }),
  A(21, 'Vehicle', 'Flatbed Truck', 'Isuzu', 'FTR 34', { status: 'Under Maintenance', location: 'Jebel Ali Main Yard', assetValue: 210000, nbv: 120000, utilization: 55, usefulLifeYears: 8 }),
  A(22, 'Generator', '200 KVA', 'Perkins', '1106A', { status: 'Disposed', active: false, location: 'Sold', assetValue: 240000, nbv: 0, usedYears: 10, purchaseDate: '2015-05-10' }),
  A(23, 'Spare Engine', 'Perkins Spare Engine', 'Perkins', '2506C-E15', { status: 'Yard', ownership: 'Spare-Standby', location: 'Jebel Ali Main Yard', assetValue: 120000, nbv: 88000 }),
  A(24, 'Trolley', 'Generator Trolley', 'Local', 'GT-2', { status: 'Ready for Hire', assetValue: 14000, nbv: 9000 }),
];

export interface CostCentre {
  id: string; code: string; name: string; type: string; parent?: string; active: boolean; budget: number; committed: number; actual: number; createdBy: string; forecast: number;
}
export const costCentreTypes = ['Project', 'Activity Type', 'Capital', 'Rental', 'Equipment', 'Branch', 'Department', 'Office / Warehouse'];
export const costCentres: CostCentre[] = [
  { id: 'cc1', code: 'CC-0001', name: 'Dubai Branch', type: 'Branch', active: true, budget: 6000000, committed: 1400000, actual: 3850000, createdBy: 'Finance Manager', forecast: 5700000 },
  { id: 'cc2', code: 'CC-0002', name: 'SO-26-00041 Route 2020 Depot (Dubai Metro Works JV)', type: 'Project', parent: 'cc1', active: true, budget: 950000, committed: 210000, actual: 585000, createdBy: 'Operations Manager', forecast: 880000 },
  { id: 'cc3', code: 'CC-0003', name: 'SO-26-00044 Al Maktoum Airport Expansion', type: 'Project', parent: 'cc1', active: true, budget: 620000, committed: 90000, actual: 410000, createdBy: 'Operations Manager', forecast: 590000 },
  { id: 'cc4', code: 'CC-0004', name: 'Abu Dhabi Branch', type: 'Branch', active: true, budget: 3500000, committed: 700000, actual: 1900000, createdBy: 'Finance Manager', forecast: 3300000 },
  { id: 'cc5', code: 'CC-0005', name: 'SO-26-00046 Yas Island Villas Phase 2', type: 'Project', parent: 'cc4', active: true, budget: 480000, committed: 60000, actual: 255000, createdBy: 'Operations Manager', forecast: 470000 },
  { id: 'cc6', code: 'CC-0006', name: 'Head Office', type: 'Office / Warehouse', active: true, budget: 1200000, committed: 100000, actual: 780000, createdBy: 'Finance Manager', forecast: 1150000 },
  { id: 'cc7', code: 'CC-0007', name: 'Fuel Trading', type: 'Activity Type', active: true, budget: 2000000, committed: 300000, actual: 1420000, createdBy: 'Finance Manager', forecast: 1950000 },
  { id: 'cc8', code: 'CC-0008', name: 'Fleet Capex 2026', type: 'Capital', active: true, budget: 2500000, committed: 1980000, actual: 900000, createdBy: 'Finance Manager', forecast: 2700000 },
  { id: 'cc9', code: 'CC-0009', name: 'SO-25-00112 Kiln 3 Shutdown (Closed)', type: 'Project', parent: 'cc4', active: false, budget: 300000, committed: 0, actual: 287000, createdBy: 'Operations Manager', forecast: 287000 },
];

export interface Employee {
  id: string; code: string; name: string; type: 'UAE National' | 'Expatriate'; department: string; designation: string; branch: string; manager: string; joined: string; status: 'Active' | 'Inactive'; nationality: string;
  /** Filled into a trip and the Delivery Order when the driver is picked. */
  mobile?: string;
}
export const employees: Employee[] = [
  { id: 'e1', code: 'EMP-0001', name: 'Ahmed Al Khouri', type: 'UAE National', department: 'Management', designation: 'General Manager', branch: 'Dubai', manager: '-', joined: '2016-01-10', status: 'Active', nationality: 'UAE' },
  { id: 'e2', code: 'EMP-0002', name: 'Omar Farouk', type: 'Expatriate', department: 'Sales', designation: 'Sales Manager', branch: 'Dubai', manager: 'Ahmed Al Khouri', joined: '2018-04-02', status: 'Active', nationality: 'Egypt' },
  { id: 'e3', code: 'EMP-0003', name: 'Leena Thomas', type: 'Expatriate', department: 'Sales', designation: 'Sales Representative', branch: 'Dubai', manager: 'Omar Farouk', joined: '2021-09-13', status: 'Active', nationality: 'India' },
  { id: 'e4', code: 'EMP-0004', name: 'Yousef Karim', type: 'Expatriate', department: 'Sales', designation: 'Sales Representative', branch: 'Abu Dhabi', manager: 'Omar Farouk', joined: '2022-02-21', status: 'Active', nationality: 'Jordan' },
  { id: 'e5', code: 'EMP-0005', name: 'Hamdan Al Suwaidi', type: 'UAE National', department: 'Operations', designation: 'Operations Manager', branch: 'Dubai', manager: 'Ahmed Al Khouri', joined: '2017-06-05', status: 'Active', nationality: 'UAE' },
  { id: 'e6', code: 'EMP-0006', name: 'Bilal Ahmed', type: 'Expatriate', department: 'Operations', designation: 'Service Desk Dispatcher', branch: 'Dubai', manager: 'Hamdan Al Suwaidi', joined: '2020-01-19', status: 'Active', nationality: 'Pakistan' },
  { id: 'e7', code: 'EMP-0007', name: 'Sanjay Kumar', type: 'Expatriate', department: 'Operations', designation: 'Yard Supervisor', branch: 'Dubai', manager: 'Hamdan Al Suwaidi', joined: '2019-08-11', status: 'Active', nationality: 'India' },
  { id: 'e8', code: 'EMP-0008', name: 'Rajesh Pillai', type: 'Expatriate', department: 'Maintenance', designation: 'Service Technician', branch: 'Dubai', manager: 'Sanjay Kumar', joined: '2019-10-01', status: 'Active', nationality: 'India' },
  { id: 'e9', code: 'EMP-0009', name: 'Tariq Hussain', type: 'Expatriate', department: 'Operations', designation: 'Driver', branch: 'Dubai', manager: 'Bilal Ahmed', joined: '2021-03-08', status: 'Active', nationality: 'Pakistan', mobile: '+971 50 311 4090' },
  { id: 'e10', code: 'EMP-0010', name: 'Nasser Al Ketbi', type: 'UAE National', department: 'Finance', designation: 'Finance Manager', branch: 'Dubai', manager: 'Ahmed Al Khouri', joined: '2017-11-14', status: 'Active', nationality: 'UAE' },
  { id: 'e11', code: 'EMP-0011', name: 'Priya Menon', type: 'Expatriate', department: 'Finance', designation: 'Accountant', branch: 'Dubai', manager: 'Nasser Al Ketbi', joined: '2020-05-25', status: 'Active', nationality: 'India' },
  { id: 'e12', code: 'EMP-0012', name: 'Mariam Al Nuaimi', type: 'UAE National', department: 'HR', designation: 'HR Manager', branch: 'Dubai', manager: 'Ahmed Al Khouri', joined: '2018-09-03', status: 'Active', nationality: 'UAE' },
  { id: 'e13', code: 'EMP-0013', name: 'Farhan Sheikh', type: 'Expatriate', department: 'Procurement', designation: 'Buyer', branch: 'Dubai', manager: 'Hamdan Al Suwaidi', joined: '2021-01-17', status: 'Active', nationality: 'Pakistan' },
  { id: 'e14', code: 'EMP-0014', name: 'Grace Fernandez', type: 'Expatriate', department: 'Warehouse', designation: 'Warehouse Staff', branch: 'Sharjah', manager: 'Sanjay Kumar', joined: '2022-07-04', status: 'Active', nationality: 'Philippines' },
  { id: 'e15', code: 'EMP-0015', name: 'Imran Shah', type: 'Expatriate', department: 'Operations', designation: 'Driver', branch: 'Sharjah', manager: 'Bilal Ahmed', joined: '2022-03-14', status: 'Active', nationality: 'Pakistan', mobile: '+971 55 418 2276' },
  { id: 'e16', code: 'EMP-0016', name: 'Joseph Mathew', type: 'Expatriate', department: 'Operations', designation: 'Driver', branch: 'Dubai', manager: 'Bilal Ahmed', joined: '2023-01-09', status: 'Active', nationality: 'India', mobile: '+971 52 703 9154' },
  { id: 'e17', code: 'EMP-0017', name: 'Ravi Kumar', type: 'Expatriate', department: 'Operations', designation: 'Driver', branch: 'Dubai', manager: 'Bilal Ahmed', joined: '2023-06-19', status: 'Active', nationality: 'India', mobile: '+971 56 129 6480' },
];

/** ERP user accounts (people with a login). An Employee location is assigned to these, not to the whole employee list (5 Oct call). */
export interface SystemUser { id: string; username: string; employeeId: string; name: string; role: string }
export const systemUsers: SystemUser[] = [
  { id: 'u1', username: 'ahmed.k', employeeId: 'e1', name: 'Ahmed Al Khouri', role: 'Administrator' },
  { id: 'u2', username: 'omar.f', employeeId: 'e2', name: 'Omar Farouk', role: 'Sales Manager' },
  { id: 'u3', username: 'leena.t', employeeId: 'e3', name: 'Leena Thomas', role: 'Sales' },
  { id: 'u5', username: 'hamdan.s', employeeId: 'e5', name: 'Hamdan Al Suwaidi', role: 'Operations Manager' },
  { id: 'u6', username: 'bilal.a', employeeId: 'e6', name: 'Bilal Ahmed', role: 'Operations' },
  { id: 'u7', username: 'sanjay.k', employeeId: 'e7', name: 'Sanjay Kumar', role: 'Yard Supervisor' },
  { id: 'u8', username: 'rajesh.p', employeeId: 'e8', name: 'Rajesh Pillai', role: 'Service Technician' },
  { id: 'u10', username: 'nasser.k', employeeId: 'e10', name: 'Nasser Al Ketbi', role: 'Finance' },
  { id: 'u14', username: 'grace.f', employeeId: 'e14', name: 'Grace Fernandez', role: 'Warehouse' },
];

/** Standard item master (trading / spare parts / fuel / service items) shared by procurement, inventory and CRM lines. */
export interface ItemMaster {
  id: string; code: string; name: string; classification: 'Inventory' | 'Rental' | 'AMC' | 'Fuel Trading' | 'Trading' | ''; category: string; subCategory?: string;
  tracking: 'Serialized' | 'Quantity' | 'Length'; unit: string; price: number; stock: number; minStock?: number; reorderQty?: number; spare?: boolean;
}
export const itemMaster: ItemMaster[] = [
  { id: 'i1', code: 'ITM-0001', name: 'Diesel Generator 100 KVA (Cummins)', classification: 'Rental', category: 'Generator', subCategory: '100 KVA', tracking: 'Serialized', unit: 'Nos', price: 1800, stock: 2 },
  { id: 'i2', code: 'ITM-0002', name: 'Diesel Generator 500 KVA (Cummins)', classification: 'Rental', category: 'Generator', subCategory: '500 KVA', tracking: 'Serialized', unit: 'Nos', price: 5200, stock: 3 },
  { id: 'i3', code: 'ITM-0003', name: 'Oil Filter (Cummins C-Series)', classification: 'Inventory', category: 'Spare Part', tracking: 'Quantity', unit: 'Nos', price: 85, stock: 14, minStock: 20, reorderQty: 60, spare: true },
  { id: 'i4', code: 'ITM-0004', name: 'Fuel Filter (Perkins 1106)', classification: 'Inventory', category: 'Spare Part', tracking: 'Quantity', unit: 'Nos', price: 62, stock: 41, minStock: 25, reorderQty: 60, spare: true },
  { id: 'i5', code: 'ITM-0005', name: 'Battery 12V 200Ah', classification: 'Inventory', category: 'Spare Part', tracking: 'Quantity', unit: 'Nos', price: 640, stock: 6, minStock: 8, reorderQty: 12, spare: true },
  { id: 'i6', code: 'ITM-0006', name: 'Engine Oil 15W-40 (20 L)', classification: 'Inventory', category: 'Consumable', tracking: 'Quantity', unit: 'Drum', price: 420, stock: 18, minStock: 10, reorderQty: 20, spare: true },
  { id: 'i7', code: 'ITM-0007', name: 'Power Cable 4C x 185 mm', classification: 'Rental', category: 'Cable', subCategory: '4 Core 185 mm', tracking: 'Length', unit: 'Meter', price: 14, stock: 1800 },
  { id: 'i8', code: 'ITM-0008', name: 'Diesel (Bulk)', classification: 'Fuel Trading', category: 'Fuel', tracking: 'Quantity', unit: 'Litre', price: 2.85, stock: 21500 },
  { id: 'i9', code: 'ITM-0009', name: 'AMC Scheduled Visit (Generator)', classification: '', category: '', tracking: 'Quantity', unit: 'Visit', price: 0, stock: 0 },
  { id: 'i10', code: 'ITM-0010', name: 'Generator Installation & Commissioning', classification: '', category: '', tracking: 'Quantity', unit: 'Job', price: 3500, stock: 0 },
  { id: 'i11', code: 'ITM-0011', name: 'ATS Panel 630A', classification: 'Trading', category: 'Panel', subCategory: 'ATS Panel', tracking: 'Serialized', unit: 'Nos', price: 61000, stock: 2 },
  { id: 'i12', code: 'ITM-0012', name: 'Air Filter (Perkins 2506)', classification: 'Inventory', category: 'Spare Part', tracking: 'Quantity', unit: 'Nos', price: 110, stock: 9, minStock: 15, reorderQty: 40, spare: true },
];

export const fmtAED = (n: number) => `AED ${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
export const fmtNum = (n: number) => n.toLocaleString('en-US');
