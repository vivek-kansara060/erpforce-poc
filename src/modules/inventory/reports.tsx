import dayjs from 'dayjs';
import type { DashboardDef, ReportDef } from '@/components/ReportsAndDashboards';
import { fmtAED } from '@/mock-data/masters';
import { READING_FREQUENCY_DAYS, TODAY, certSeed, countVarianceRows, currentLocation, depreciationApplicable, disposalSeed, heavySeed, inFleetCount, movementDurations, readingSeed, stockStatusOf, type HeavyRec } from './data';
import { certStatus } from './AssetPages';

const REQ = 'Inventory & Fixed Assets > ';
const fleet = heavySeed;
const live = fleet.filter((h) => h.assetStatus !== 'Disposed');
const cats = Array.from(new Set(fleet.map((h) => h.category)));
const PERIOD_DAYS = 90;
const onHireDays = (h: HeavyRec) => Math.round((PERIOD_DAYS * h.utilization) / 100);
const name = (h: HeavyRec) => `${h.assetId} - ${h.name}`;
const costs = (h: HeavyRec) => {
  const depreciation = depreciationApplicable(h.ownership) && h.usefulLifeYears ? Math.round((h.assetValue / (h.usefulLifeYears * 12)) * 9) : 0;
  const maintenance = h.ownership === 'Cross-Hired' ? 0 : Math.round(h.assetValue * 0.008);
  const consumable = Math.round((h.assetValue || 120000) * 0.004);
  const hireCost = h.ownership === 'Cross-Hired' ? 21000 : 0;
  return { depreciation, maintenance, consumable, hireCost, revenue: h.profitability + depreciation + maintenance + consumable + hireCost };
};
const lastReading = (assetId: string) => readingSeed.filter((r) => r.assetId === assetId).sort((a, b) => b.date.localeCompare(a.date))[0];
const endOfLife = (h: HeavyRec) => dayjs(h.putToUseDate || h.purchaseDate).add(h.usefulLifeYears, 'year');
const eolAssets = live.filter((h) => depreciationApplicable(h.ownership) && h.usefulLifeYears > 0).map((h) => ({ h, end: endOfLife(h), monthsLeft: endOfLife(h).diff(dayjs(TODAY), 'month') })).sort((a, b) => a.monthsLeft - b.monthsLeft);
const stockRows = [
  { location: 'Jebel Ali Main Yard', type: 'Own Yard', supplier: '-', held: 88, consumed: 0, value: 16122 },
  { location: 'Sharjah Yard', type: 'Own Yard', supplier: '-', held: 0, consumed: 0, value: 0 },
  { location: 'Abu Dhabi Mussafah Yard', type: 'Own Yard', supplier: '-', held: 0, consumed: 0, value: 0 },
  { location: 'ENOC Al Quoz Depot (Fuel Stock)', type: 'Supplier-Held Location', supplier: 'ENOC Fuel Distribution', held: 60000, consumed: 38500, value: 61275 },
];

export const reports: ReportDef[] = [
  { slug: 'asset-utilization', title: 'Asset Utilization Report', purpose: 'On-hire time vs. available time, per asset and by category.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'category', label: 'Category', options: cats }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'onHire', label: 'On-Hire Days (last 90)', align: 'right' }, { key: 'available', label: 'Available Days', align: 'right' }, { key: 'util', label: 'Utilization %', align: 'right' }],
    rows: live.map((h) => ({ asset: name(h), category: h.category, onHire: onHireDays(h), available: PERIOD_DAYS - onHireDays(h), util: `${h.utilization}%` })) },
  { slug: 'asset-profitability', title: 'Asset Profitability Report', purpose: 'Revenue earned vs. depreciation, maintenance, and consumable cost, per asset.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'category', label: 'Category', options: cats }, { key: 'ownership', label: 'Ownership Type', options: ['Owned', 'Cross-Hired', 'Spare-Standby'] }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }, { key: 'revenue', label: 'Revenue', align: 'right' }, { key: 'dep', label: 'Depreciation / Hire Cost', align: 'right' }, { key: 'maint', label: 'Maintenance', align: 'right' }, { key: 'cons', label: 'Consumables', align: 'right' }, { key: 'profit', label: 'Profitability', align: 'right' }],
    rows: live.map((h) => { const c = costs(h); return { asset: name(h), category: h.category, ownership: h.ownership, revenue: fmtAED(c.revenue), dep: fmtAED(c.depreciation + c.hireCost), maint: fmtAED(c.maintenance), cons: fmtAED(c.consumable), profit: fmtAED(h.profitability) }; }) },
  { slug: 'end-of-useful-life', title: 'End-of-Useful-Life Report', purpose: 'Assets approaching the end of their configured useful life, to plan replacement purchases.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'category', label: 'Category', options: cats }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'life', label: 'Useful Life (years)', align: 'right' }, { key: 'end', label: 'End of Useful Life' }, { key: 'left', label: 'Months Remaining', align: 'right' }, { key: 'plan', label: 'Replacement Planning', status: true }],
    rows: eolAssets.map(({ h, end, monthsLeft }) => ({ asset: name(h), category: h.category, life: h.usefulLifeYears, end: end.format('YYYY-MM-DD'), left: monthsLeft, plan: monthsLeft <= 12 ? 'Due soon' : monthsLeft <= 36 ? 'Plan ahead' : 'On track' })) },
  { slug: 'category-demand-vs-owned', title: 'Category Demand vs. Owned Report', purpose: 'Which categories are most in demand vs. what the business actually owns.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    columns: [{ key: 'category', label: 'Category' }, { key: 'demand', label: 'Units Requested (YTD)', align: 'right' }, { key: 'owned', label: 'Owned Units', align: 'right' }, { key: 'cross', label: 'Cross-Hired Units', align: 'right' }, { key: 'gap', label: 'Demand Gap', align: 'right' }],
    rows: cats.map((c, i) => { const demand = [31, 9, 6, 4, 2][i] ?? 3; const owned = live.filter((h) => h.category === c && h.ownership !== 'Cross-Hired').length; return { category: c, demand, owned, cross: live.filter((h) => h.category === c && h.ownership === 'Cross-Hired').length, gap: Math.max(demand - owned, 0) }; }) },
  { slug: 'overdue-usage-readings', title: 'Overdue / Missing Usage Readings Report', purpose: `Assets without a usage reading within the confirmed minimum frequency. Frequency rule to be confirmed with client (${READING_FREQUENCY_DAYS} days assumed).`, group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'last', label: 'Last Reading' }, { key: 'hmr', label: 'Last HMR', align: 'right' }, { key: 'days', label: 'Days Since Reading', align: 'right' }, { key: 'status', label: 'Status', status: true }],
    rows: live.map((h) => { const r = lastReading(h.assetId); const days = r ? dayjs(TODAY).diff(dayjs(r.date), 'day') : null; return { asset: name(h), category: h.category, last: r ? r.date.replace('T', ' ') : '-', hmr: r ? r.hmr : '-', days: days ?? '-', status: days === null ? 'Missing' : days > READING_FREQUENCY_DAYS ? 'Overdue' : 'Up to date' }; }).filter((r) => r.status !== 'Up to date') },
  { slug: 'idle-time', title: 'Idle Time Report', purpose: 'Time each asset has spent Available, not on hire, by category and period.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'category', label: 'Category', options: cats }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'period', label: 'Period' }, { key: 'idle', label: 'Idle Days', align: 'right' }, { key: 'idlePct', label: 'Idle %', align: 'right' }],
    rows: live.map((h) => ({ asset: name(h), category: h.category, period: 'Last 90 days', idle: PERIOD_DAYS - onHireDays(h), idlePct: `${100 - h.utilization}%` })) },
  { slug: 'movement-history', title: 'Movement History Report', purpose: 'Full delivery/return/transfer/repair history per asset, for internal use only.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'type', label: 'Movement Type', options: ['Delivery', 'Return', 'Internal Transfer', 'Sent for Repair', 'Cross-Hire Stage Change'] }],
    columns: [{ key: 'entry', label: 'Movement Entry No.' }, { key: 'asset', label: 'Asset' }, { key: 'type', label: 'Movement Type' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'date', label: 'Date/Time' }, { key: 'dur', label: 'Duration' }],
    rows: fleet.flatMap((h) => { const d = movementDurations(h.movements); return h.movements.map((m) => ({ entry: m.entryNo, asset: name(h), type: m.type, from: m.from, to: m.to, date: m.date.replace('T', ' '), dur: d[m.id] })); }).sort((a, b) => b.date.localeCompare(a.date)) },
  { slug: 'owned-vs-cross-hire-vs-spare', title: 'Owned vs. Cross-Hire vs. Spare-Standby Report', purpose: 'Fleet composition by ownership type, including the Cross-Hire idle-at-our-location flag.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'ownership', label: 'Ownership Type', options: ['Owned', 'Cross-Hired', 'Spare-Standby'] }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }, { key: 'status', label: 'Asset Status', status: true }, { key: 'loc', label: 'Current Location' }, { key: 'idle', label: 'Cross-Hire Idle at Our Location', status: true }, { key: 'fleet', label: 'In Available Fleet Count' }],
    rows: live.map((h) => ({ asset: name(h), category: h.category, ownership: h.ownership, status: h.assetStatus, loc: currentLocation(h), idle: h.crossHireIdle ? 'Idle' : '-', fleet: inFleetCount(h) ? 'Yes' : 'No' })) },
  { slug: 'location-wise-stock', title: 'Location-Wise Stock Report', purpose: 'Stock held, consumed, and remaining value by location, including Supplier-Held Locations. Shares data with the Procurement module equivalent report.', group: 'Stock', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'type', label: 'Location Type', options: ['Own Yard', 'Supplier-Held Location'] }],
    columns: [{ key: 'location', label: 'Location' }, { key: 'type', label: 'Location Type' }, { key: 'supplier', label: 'Linked Supplier' }, { key: 'held', label: 'Stock Held', align: 'right' }, { key: 'consumed', label: 'Consumed', align: 'right' }, { key: 'value', label: 'Remaining Value', align: 'right' }],
    rows: stockRows.map((r) => ({ ...r, held: r.held.toLocaleString('en-US'), consumed: r.consumed.toLocaleString('en-US'), value: fmtAED(r.value) })) },
  { slug: 'physical-stock-variance', title: 'Physical Stock Variance Report', purpose: 'Results of physical count sessions against system quantity, with resulting adjustments.', group: 'Stock', change: 'new', req: REQ + 'Reports',
    columns: [{ key: 'session', label: 'Stock Count Session' }, { key: 'date', label: 'Date' }, { key: 'location', label: 'Location' }, { key: 'item', label: 'Item' }, { key: 'sys', label: 'System Qty', align: 'right' }, { key: 'counted', label: 'Counted Qty', align: 'right' }, { key: 'variance', label: 'Variance', align: 'right' }, { key: 'adj', label: 'Stock Adjustment' }, { key: 'status', label: 'Adjustment Status', status: true }],
    // Read from the live count sessions every time the report is opened, so new, approved and rejected counts show up.
    get rows() { return countVarianceRows(); } },
  { slug: 'certificate-expiry', title: 'Certificate Expiry Report', purpose: 'All asset-level certificates nearing or past expiry.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'status', label: 'Status', options: ['Expired', 'Due Soon'] }, { key: 'type', label: 'Certificate Type', options: ['Registration', 'Insurance', 'Inspection', 'Warranty', 'Other'] }],
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'type', label: 'Certificate Type' }, { key: 'expiry', label: 'Expiry Date' }, { key: 'days', label: 'Days to Expiry', align: 'right' }, { key: 'lead', label: 'Reminder Lead (days)', align: 'right' }, { key: 'status', label: 'Status', status: true }],
    rows: certSeed.map((c) => ({ c, s: certStatus(c) })).filter((x) => x.s.label !== 'Valid').map(({ c, s }) => ({ asset: `${c.assetId} - ${fleet.find((h) => h.assetId === c.assetId)?.name ?? ''}`, type: c.type, expiry: c.expiry, days: dayjs(c.expiry).diff(dayjs(TODAY), 'day'), lead: c.leadDays, status: s.label })).sort((a, b) => a.days - b.days) },
  { slug: 'asset-disposal-write-off', title: 'Asset Disposal / Write-Off Report', purpose: 'All disposed/written-off assets, reason, method, and value.', group: 'Fixed Assets', change: 'new', req: REQ + 'Reports',
    filters: [{ key: 'method', label: 'Disposal Method', options: ['Scrap', 'Sale'] }],
    columns: [{ key: 'number', label: 'Disposal Request' }, { key: 'asset', label: 'Asset' }, { key: 'reason', label: 'Reason' }, { key: 'method', label: 'Method' }, { key: 'value', label: 'Scrap/Sale Value', align: 'right' }, { key: 'status', label: 'Approval Status', status: true }],
    rows: disposalSeed.filter((d) => d.status === 'Approved').map((d) => ({ number: d.number, asset: `${d.assetId} - ${fleet.find((h) => h.assetId === d.assetId)?.name ?? ''}`, reason: d.reason, method: d.method, value: d.method === 'Sale' ? fmtAED(d.value) : '-', status: d.status })) },
];

const count = (f: (h: HeavyRec) => boolean) => live.filter(f).length;
const statusGroups = [
  { label: 'Available', value: count((h) => stockStatusOf(h) === 'In Stock') },
  { label: 'On Hire', value: count((h) => h.assetStatus === 'On Hire') },
  { label: 'Under Maintenance', value: count((h) => ['Under Maintenance', 'Breakdown'].includes(h.assetStatus)) },
  { label: 'Disposed', value: fleet.length - live.length },
];
const cols4 = ['Available', 'On Hire', 'Under Maintenance', 'Disposed'];
const groupOf = (h: HeavyRec) => (h.assetStatus === 'Disposed' ? 'Disposed' : h.assetStatus === 'On Hire' ? 'On Hire' : ['Under Maintenance', 'Breakdown'].includes(h.assetStatus) ? 'Under Maintenance' : 'Available');
const ownerCounts = ['Owned', 'Cross-Hired', 'Spare-Standby'].map((o) => ({ label: o, value: live.filter((h) => h.ownership === o).length }));
const byProfit = [...live].sort((a, b) => b.profitability - a.profitability);

export const dashboards: DashboardDef[] = [
  { slug: 'fleet-status', title: 'Fleet Status Dashboard', purpose: 'Live counts of Available / On-Hire / Under-Maintenance / Disposed, by category.', change: 'new', req: REQ + 'Dashboards',
    kpis: statusGroups.map((g) => ({ title: g.label, value: g.value })),
    widgets: [
      { type: 'donut', title: 'Fleet by status', data: statusGroups, centerLabel: 'Units' },
      { type: 'heat', title: 'Status by category', rows: cats, cols: cols4, values: cats.map((c) => cols4.map((s) => fleet.filter((h) => h.category === c && groupOf(h) === s).length)) },
    ] },
  { slug: 'owned-vs-cross-hire', title: 'Owned vs. Cross-Hire Dashboard', purpose: "Distinguishes owned fleet from cross-hired units, including which cross-hired units are idle at the business's own location awaiting return to supplier.", change: 'new', req: REQ + 'Dashboards',
    kpis: [...ownerCounts.map((o) => ({ title: o.label, value: o.value })), { title: 'Cross-Hire Idle at Our Location', value: live.filter((h) => h.crossHireIdle).length, tint: '#FFFAF0' }],
    widgets: [
      { type: 'donut', title: 'Fleet by ownership type', data: ownerCounts, centerLabel: 'Units' },
      { type: 'table', title: 'Cross-hired units', columns: [{ key: 'asset', label: 'Asset' }, { key: 'supplier', label: 'Supplier' }, { key: 'loc', label: 'Current Location' }, { key: 'state', label: 'State', status: true }],
        rows: live.filter((h) => h.ownership === 'Cross-Hired').map((h) => ({ asset: name(h), supplier: h.supplier, loc: currentLocation(h), state: h.crossHireIdle ? 'Idle' : h.assetStatus })) },
    ] },
  { slug: 'asset-profitability', title: 'Asset Profitability Dashboard', purpose: 'Per-asset earned vs. cost view, filterable by category and period.', change: 'new', req: REQ + 'Dashboards',
    kpis: [{ title: 'Total Profitability to Date', value: fmtAED(live.reduce((s, h) => s + h.profitability, 0)) }, { title: 'Best Performing', value: byProfit[0].assetId, sub: fmtAED(byProfit[0].profitability) }, { title: 'Loss-Making Assets', value: live.filter((h) => h.profitability < 0).length }],
    widgets: [
      { type: 'bar', title: 'Profitability by asset (top 8)', data: byProfit.slice(0, 8).map((h) => ({ label: h.assetId, value: h.profitability })), format: (n) => fmtAED(n) },
      { type: 'table', title: 'Earned vs cost', columns: [{ key: 'asset', label: 'Asset' }, { key: 'rev', label: 'Revenue', align: 'right' }, { key: 'cost', label: 'Cost', align: 'right' }, { key: 'profit', label: 'Profit', align: 'right' }],
        rows: byProfit.slice(0, 10).map((h) => { const c = costs(h); return { asset: h.assetId, rev: fmtAED(c.revenue), cost: fmtAED(c.revenue - h.profitability), profit: fmtAED(h.profitability) }; }) },
    ] },
  { slug: 'location-wise-stock', title: 'Location-Wise Stock Dashboard', purpose: 'Own-yard vs. supplier-held stock, with consumption and remaining value shared with the Procurement module equivalent dashboard.', change: 'new', req: REQ + 'Dashboards',
    kpis: [{ title: 'Own-Yard Stock Value', value: fmtAED(16122) }, { title: 'Supplier-Held Remaining Value', value: fmtAED(61275) }, { title: 'Fuel Consumed', value: '38,500 L', sub: 'of 60,000 L held' }],
    widgets: [
      { type: 'bar', title: 'Remaining value by location', data: stockRows.map((r) => ({ label: r.location.split(' (')[0], value: r.value })), format: (n) => fmtAED(n) },
      { type: 'progress', title: 'Supplier-held consumption', items: [{ label: 'ENOC Al Quoz Depot (Fuel Stock)', value: 64, sub: '38,500 of 60,000 L consumed' }] },
    ] },
  { slug: 'end-of-life-planning', title: 'End-of-Life Planning Dashboard', purpose: 'Assets approaching end of useful life, to support purchase planning.', change: 'new', req: REQ + 'Dashboards',
    kpis: [{ title: 'Due within 12 months', value: eolAssets.filter((e) => e.monthsLeft <= 12).length }, { title: 'Due within 36 months', value: eolAssets.filter((e) => e.monthsLeft <= 36).length }],
    widgets: [
      { type: 'bar', title: 'Assets reaching end of life by year', data: Array.from(new Set(eolAssets.map((e) => e.end.year()))).sort().map((y) => ({ label: String(y), value: eolAssets.filter((e) => e.end.year() === y).length })) },
      { type: 'table', title: 'Nearest end of life', columns: [{ key: 'asset', label: 'Asset' }, { key: 'end', label: 'End of Useful Life' }, { key: 'left', label: 'Months Left', align: 'right' }], rows: eolAssets.slice(0, 8).map(({ h, end, monthsLeft }) => ({ asset: name(h), end: end.format('YYYY-MM-DD'), left: monthsLeft })) },
    ] },
];
