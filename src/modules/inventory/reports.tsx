import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Text } from '@/components/Text';
import { DataTable } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { ASSET_STATUSES } from '@/mock-data/masters';
import { holderOf } from '@/modules/crm/data';
import { R8 } from '@/modules/crm/shared';
import type { DashboardDef } from '@/components/ReportsAndDashboards';
import { getCollection } from '@/store/store';
import type { InvReportDef } from './ReportPages';
import { READING_FREQUENCY_DAYS, TODAY, certSeed, countVarianceRows, currentLocation, depreciationApplicable, disposalSeed, heavySeed, inFleetCount, itemSeed, locationSeed, locationStockSeed, movementDurations, qtyWithUnit, readingSeed, type CertRec, type DisposalRec, type HeavyRec, type ItemRec, type LocationRec, type LocationStock, type ReadingRec } from './data';
import { certStatus } from './AssetPages';

const REQ = 'Inventory & Fixed Assets > ';
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
const endOfLife = (h: HeavyRec) => dayjs(h.putToUseDate || h.purchaseDate).add(h.usefulLifeYears, 'year');

/* ------------------------------------------------------------------ reports (built from live POC data each time a report opens) */
const liveOf = <T,>(name: string, seed: T[]): T[] => { const l = getCollection<T>(name); return l.length ? l : seed; };
const liveFleet = () => liveOf<HeavyRec>('inventory.heavyEquipment', heavySeed);
const activeFleet = () => liveFleet().filter((h) => h.status === 'Active' && h.assetStatus !== 'Disposed');
const assetCols = (h: HeavyRec) => ({ asset: name(h), _heavyId: h.id });
const heavyIdOf = (assetId: string) => liveFleet().find((h) => h.assetId === assetId)?.id;
const assetNameOf = (assetId: string) => liveFleet().find((h) => h.assetId === assetId)?.name ?? '';
const lastReadingLive = (assetId: string) => liveOf<ReadingRec>('inventory.readings', readingSeed).filter((r) => r.assetId === assetId).sort((a, b) => b.date.localeCompare(a.date))[0];
const R = REQ + 'Reports';
const eol = () => activeFleet().filter((h) => depreciationApplicable(h.ownership) && h.usefulLifeYears > 0).map((h) => ({ h, end: endOfLife(h), monthsLeft: endOfLife(h).diff(dayjs(TODAY), 'month') })).sort((a, b) => a.monthsLeft - b.monthsLeft);

export const reports: InvReportDef[] = [
  { slug: 'asset-utilization', title: 'Asset Utilization Report', purpose: 'On-hire time vs. available time, per asset and by category.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }, { key: 'onHire', label: 'On-Hire Days (last 90)', align: 'right', format: 'days', total: true }, { key: 'available', label: 'Available Days', align: 'right', format: 'days', total: true }, { key: 'util', label: 'Utilization %', align: 'right', format: 'pct' }],
    rows: () => activeFleet().map((h) => ({ ...assetCols(h), category: h.category, ownership: h.ownership, onHire: onHireDays(h), available: PERIOD_DAYS - onHireDays(h), util: h.utilization })) },
  { slug: 'asset-profitability', title: 'Asset Profitability Report', purpose: 'Revenue earned vs. depreciation, maintenance, and consumable cost, per asset.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }, { key: 'revenue', label: 'Revenue', align: 'right', format: 'aed', total: true }, { key: 'dep', label: 'Depreciation / Hire Cost', align: 'right', format: 'aed', total: true }, { key: 'maint', label: 'Maintenance', align: 'right', format: 'aed', total: true }, { key: 'cons', label: 'Consumables', align: 'right', format: 'aed', total: true }, { key: 'profit', label: 'Profitability', align: 'right', format: 'aed', total: true }],
    rows: () => activeFleet().map((h) => { const c = costs(h); return { ...assetCols(h), category: h.category, ownership: h.ownership, revenue: c.revenue, dep: c.depreciation + c.hireCost, maint: c.maintenance, cons: c.consumable, profit: h.profitability }; }) },
  { slug: 'end-of-useful-life', title: 'End-of-Useful-Life Report', purpose: 'Assets approaching the end of their configured useful life, to plan replacement purchases.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }, { key: 'plan', label: 'Replacement Planning' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'life', label: 'Useful Life (years)', align: 'right', format: 'num' }, { key: 'end', label: 'End of Useful Life' }, { key: 'left', label: 'Months Remaining', align: 'right', format: 'num' }, { key: 'plan', label: 'Replacement Planning', status: true }],
    rows: () => activeFleet().filter((h) => depreciationApplicable(h.ownership) && h.usefulLifeYears > 0).map((h) => { const end = endOfLife(h); const left = end.diff(dayjs(TODAY), 'month'); return { ...assetCols(h), category: h.category, life: h.usefulLifeYears, end: end.format('YYYY-MM-DD'), left, plan: left <= 12 ? 'Due soon' : left <= 36 ? 'Plan ahead' : 'On track' }; }).sort((a, b) => a.left - b.left) },
  { slug: 'category-demand-vs-owned', title: 'Category Demand vs. Owned Report', purpose: 'Which categories are most in demand vs. what the business actually owns.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }],
    columns: [{ key: 'category', label: 'Category' }, { key: 'demand', label: 'Units Requested (YTD)', align: 'right', format: 'num', total: true }, { key: 'owned', label: 'Owned Units', align: 'right', format: 'num', total: true }, { key: 'cross', label: 'Cross-Hired Units', align: 'right', format: 'num', total: true }, { key: 'gap', label: 'Demand Gap', align: 'right', format: 'num', total: true }],
    rows: () => { const f = activeFleet(); return Array.from(new Set(f.map((h) => h.category))).map((c, i) => { const demand = [31, 9, 6, 4, 2][i] ?? 3; const owned = f.filter((h) => h.category === c && h.ownership !== 'Cross-Hired').length; return { category: c, demand, owned, cross: f.filter((h) => h.category === c && h.ownership === 'Cross-Hired').length, gap: Math.max(demand - owned, 0) }; }); } },
  { slug: 'overdue-usage-readings', title: 'Overdue / Missing Usage Readings Report', purpose: `Assets without a usage reading within the confirmed minimum frequency. Frequency rule to be confirmed with client (${READING_FREQUENCY_DAYS} days assumed).`, group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'last', label: 'Last Reading' }, { key: 'hmr', label: 'Last HMR (hours)', align: 'right', format: 'num' }, { key: 'days', label: 'Days Since Reading', align: 'right', format: 'days' }, { key: 'status', label: 'Status', status: true }],
    rows: () => activeFleet().map((h) => { const r = lastReadingLive(h.assetId); const days = r ? dayjs(TODAY).diff(dayjs(r.date), 'day') : undefined; return { ...assetCols(h), category: h.category, last: r ? r.date.replace('T', ' ') : '-', hmr: r?.hmr, days, status: days === undefined ? 'Missing' : days > READING_FREQUENCY_DAYS ? 'Overdue' : 'Up to date' }; }).filter((r) => r.status !== 'Up to date') },
  { slug: 'idle-time', title: 'Idle Time Report', purpose: 'Time each asset has spent Available, not on hire, by category and period.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'period', label: 'Period' }, { key: 'idle', label: 'Idle Days', align: 'right', format: 'days', total: true }, { key: 'idlePct', label: 'Idle %', align: 'right', format: 'pct' }],
    rows: () => activeFleet().map((h) => ({ ...assetCols(h), category: h.category, ownership: h.ownership, period: 'Last 90 days', idle: PERIOD_DAYS - onHireDays(h), idlePct: 100 - h.utilization })) },
  { slug: 'movement-history', title: 'Movement History Report', purpose: 'Full delivery/return/transfer/repair history per asset, for internal use only.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'type', label: 'Movement Type' }, { key: 'category', label: 'Category' }],
    columns: [{ key: 'entry', label: 'Movement Entry No.' }, { key: 'asset', label: 'Asset', link: 'asset' }, { key: 'type', label: 'Movement Type' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'date', label: 'Date/Time' }, { key: 'dur', label: 'Duration' }],
    rows: () => liveFleet().filter((h) => h.ownership !== 'Cross-Hired').flatMap((h) => { const d = movementDurations(h.movements); return h.movements.map((m) => ({ entry: m.entryNo, ...assetCols(h), category: h.category, type: m.type, from: m.from, to: m.to, date: m.date.replace('T', ' '), dur: d[m.id] })); }).sort((a, b) => b.date.localeCompare(a.date)) },
  { slug: 'owned-vs-cross-hire-vs-spare', title: 'Owned vs. Cross-Hire vs. Spare-Standby Report', purpose: 'Fleet composition by ownership type, including the Cross-Hire idle-at-our-location flag.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'ownership', label: 'Ownership Type' }, { key: 'status', label: 'Asset Status' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' }, { key: 'status', label: 'Asset Status', status: true }, { key: 'loc', label: 'Current Location' }, { key: 'idle', label: 'Cross-Hire Idle at Our Location' }, { key: 'fleet', label: 'In Available Fleet Count' }],
    rows: () => activeFleet().map((h) => ({ ...assetCols(h), category: h.category, ownership: h.ownership, status: h.assetStatus, loc: currentLocation(h), idle: h.crossHireIdle ? 'Idle' : '-', fleet: inFleetCount(h) ? 'Yes' : 'No' })) },
  { slug: 'location-wise-stock', title: 'Location-Wise Stock Report', purpose: 'Stock held, consumed, and remaining value by location, including Supplier-Held Locations. Shares data with the Procurement module equivalent report.', group: 'Stock', change: 'new', req: R,
    filters: [{ key: 'type', label: 'Location Type' }, { key: 'location', label: 'Location' }],
    columns: [{ key: 'location', label: 'Location' }, { key: 'type', label: 'Location Type' }, { key: 'item', label: 'Item' }, { key: 'held', label: 'Stock Held', align: 'right' }, { key: 'consumed', label: 'Consumed', align: 'right' }, { key: 'remaining', label: 'Remaining', align: 'right' }, { key: 'value', label: 'Remaining Value', align: 'right', format: 'aed', total: true }],
    rows: () => { const items = liveOf<ItemRec>('items', itemSeed); const locs = liveOf<LocationRec>('locations', locationSeed); return liveOf<LocationStock>('inventory.locationStock', locationStockSeed).flatMap((r) => { const it = items.find((i) => i.id === r.itemId); if (!it) return []; const c = r.consumed ?? 0; return [{ location: r.location, type: locs.find((l) => l.name === r.location)?.type ?? '-', item: it.name, held: qtyWithUnit(r.qty + c, it.unit), consumed: qtyWithUnit(c, it.unit), remaining: qtyWithUnit(r.qty, it.unit), value: Math.round(r.qty * it.price * 100) / 100 }]; }); } },
  { slug: 'physical-stock-variance', title: 'Physical Stock Variance Report', purpose: 'Results of physical count sessions against system quantity, with resulting adjustments.', group: 'Stock', change: 'new', req: R,
    filters: [{ key: 'location', label: 'Location' }, { key: 'status', label: 'Adjustment Status' }],
    columns: [{ key: 'session', label: 'Stock Count Session' }, { key: 'date', label: 'Date' }, { key: 'location', label: 'Location' }, { key: 'item', label: 'Item / Asset', link: 'asset' }, { key: 'sys', label: 'System Qty', align: 'right' }, { key: 'counted', label: 'Counted Qty', align: 'right' }, { key: 'variance', label: 'Variance', align: 'right' }, { key: 'reason', label: 'Reason' }, { key: 'adj', label: 'Stock Adjustment' }, { key: 'status', label: 'Adjustment Status', status: true }],
    rows: () => countVarianceRows().map((r) => ({ ...r, _heavyId: r.assetId ? heavyIdOf(r.assetId) : undefined })) },
  { slug: 'certificate-expiry', title: 'Certificate Expiry Report', purpose: 'All asset-level certificates nearing or past expiry.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'status', label: 'Status' }, { key: 'type', label: 'Certificate Type' }],
    columns: [{ key: 'asset', label: 'Asset', link: 'asset' }, { key: 'type', label: 'Certificate Type' }, { key: 'reference', label: 'Reference' }, { key: 'expiry', label: 'Expiry Date' }, { key: 'days', label: 'Days to Expiry', align: 'right', format: 'num' }, { key: 'lead', label: 'Reminder Lead', align: 'right', format: 'days' }, { key: 'status', label: 'Status', status: true }],
    rows: () => liveOf<CertRec>('inventory.certificates', certSeed).map((c) => ({ c, s: certStatus(c) })).filter((x) => x.s.label !== 'Valid').map(({ c, s }) => ({ asset: `${c.assetId} - ${assetNameOf(c.assetId)}`, _heavyId: heavyIdOf(c.assetId), type: c.type, reference: c.reference || '-', expiry: c.expiry, days: dayjs(c.expiry).diff(dayjs(TODAY), 'day'), lead: c.leadDays, status: s.label })).sort((a, b) => a.days - b.days) },
  { slug: 'asset-disposal-write-off', title: 'Asset Disposal / Write-Off Report', purpose: 'All disposed/written-off assets, reason, method, and value.', group: 'Fixed Assets', change: 'new', req: R,
    filters: [{ key: 'method', label: 'Disposal Method' }, { key: 'outcome', label: 'Outcome' }],
    columns: [{ key: 'number', label: 'Disposal Request' }, { key: 'asset', label: 'Asset', link: 'asset' }, { key: 'reason', label: 'Reason' }, { key: 'method', label: 'Method' }, { key: 'outcome', label: 'Outcome', status: true }, { key: 'buyer', label: 'Invoiced To' }, { key: 'value', label: 'Invoice Amount', align: 'right', format: 'aed', total: true }, { key: 'invoice', label: 'Invoice' }],
    rows: () => liveOf<DisposalRec>('inventory.disposals', disposalSeed).filter((d) => d.status === 'Approved').map((d) => ({ number: d.number, asset: `${d.assetId} - ${assetNameOf(d.assetId)}`, _heavyId: heavyIdOf(d.assetId), reason: d.reason, method: d.method, outcome: d.outcome ? (d.method === 'Sale' ? 'Sold, invoiced' : 'Scrapped, invoiced') : 'Invoice to create', buyer: d.outcome?.buyer ?? '-', value: d.outcome?.saleValue, invoice: d.outcome?.invoiceRef ?? '-' })) },
];

/* ------------------------------------------------------------------ dashboards (2 Oct call: only what the source screens really hold, with a way into the records) */
const REQ_DASH = 'Dashboards (2 Oct call: built from source-screen data only, drill into the records)';
/** 8 Oct call: assets coming back (Off Hire - In Transit, Yard Inspection) are neither on hire nor available yet. */
const groupOf = (h: HeavyRec) => (h.assetStatus === 'Disposed' ? 'Disposed' : h.assetStatus === 'On Hire' ? 'On Hire' : ['Off Hire - In Transit', 'Yard Inspection'].includes(h.assetStatus) ? 'Returning' : ['Under Maintenance', 'Breakdown'].includes(h.assetStatus) ? 'Under Maintenance' : 'Available');
const STATUS_GROUPS = ['Available', 'On Hire', 'Returning', 'Under Maintenance', 'Disposed'];
const R_ASSETS = R8('Asset Dashboard: category, subcategory, asset, current customer, status');
/** Asset Dashboard (8 Oct call): every asset with its category, subcategory, status and the customer holding it now. */
function AssetsNow() {
  const nav = useNavigate();
  const rows = liveFleet().filter((h) => !h.deliveryFleet).map((h) => { const w = holderOf(h.id); return { id: h.id, category: h.category, sub: h.subCategory, assetId: h.assetId, name: h.name, ownership: h.ownership, status: h.assetStatus, customer: w?.customer ?? '-', project: w?.project || '-', soId: w?.soId, soNumber: w?.soNumber ?? '-', loc: currentLocation(h) }; });
  return (
    <DataTable hideToolbar={false} searchPlaceholder="Search assets..." filter={{ key: 'status', options: [...ASSET_STATUSES] }} pageSize={10} rows={rows} onRowClick={(r) => nav(`/inventory/items/heavy/${r.id}`)} emptyText="No asset"
      columns={[
        { key: 'category', label: 'Category' }, { key: 'sub', label: 'Subcategory' }, { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'ownership', label: 'Ownership' },
        { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }, { key: 'customer', label: 'Current Customer' }, { key: 'project', label: 'Project' },
        { key: 'soNumber', label: 'Sales Order', render: (r) => (r.soId ? <Box component="span" sx={{ textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); nav(`/crm/sales-orders/${r.soId}`); }}>{r.soNumber}</Box> : '-') },
        { key: 'loc', label: 'Current Location' },
      ]} />
  );
}
/** Links from a dashboard to the records behind its numbers. */
const records = (links: { label: string; to: string }[]) => ({
  type: 'custom' as const, title: 'Underlying records', span: 2, change: 'new' as const, req: REQ_DASH,
  node: (
    <Box>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>The figures above are counted from the Heavy Equipment Fixed Asset records. Open the records behind them:</Text>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{links.map((l) => <Button key={l.to} size="small" variant="outlined" component={Link} to={l.to}>{l.label}</Button>)}</Box>
    </Box>
  ),
});

export const dashboards: DashboardDef[] = [
  { slug: 'fleet-status', title: 'Fleet Status Dashboard', purpose: 'Live counts of Available / On-Hire / Returning / Under-Maintenance / Disposed, by category, and where every asset is now.', change: 'new', req: REQ + 'Dashboards',
    get kpis() { const f = liveFleet().filter((h) => !h.deliveryFleet); return STATUS_GROUPS.map((g) => ({ title: g, value: f.filter((h) => groupOf(h) === g).length })); },
    get widgets() {
      const f = liveFleet().filter((h) => !h.deliveryFleet);
      const cats = Array.from(new Set(f.map((h) => h.category)));
      return [
        { type: 'donut' as const, title: 'Fleet by status', data: STATUS_GROUPS.map((g) => ({ label: g, value: f.filter((h) => groupOf(h) === g).length })), centerLabel: 'Units' },
        { type: 'heat' as const, title: 'Status by category', rows: cats, cols: STATUS_GROUPS, values: cats.map((c) => STATUS_GROUPS.map((g) => f.filter((h) => h.category === c && groupOf(h) === g).length)) },
        { type: 'custom' as const, title: 'Assets: where they are now', span: 2, change: 'new' as const, req: R_ASSETS, node: <AssetsNow /> },
        records([{ label: 'Heavy Equipment Fixed Assets', to: '/inventory/items' }, { label: 'Owned vs. Cross-Hire vs. Spare-Standby Report', to: '/inventory/reports/owned-vs-cross-hire-vs-spare' }, { label: 'Asset Disposal Report', to: '/inventory/reports/asset-disposal-write-off' }]),
      ];
    } },
  { slug: 'owned-vs-cross-hire', title: 'Owned vs. Cross-Hire Dashboard', purpose: "Distinguishes owned fleet from cross-hired units, including which cross-hired units are idle at the business's own location awaiting return to supplier.", change: 'new', req: REQ + 'Dashboards',
    get kpis() { const f = activeFleet(); return [...['Owned', 'Cross-Hired', 'Spare-Standby'].map((o) => ({ title: o, value: f.filter((h) => h.ownership === o).length })), { title: 'Cross-Hire Idle at Our Location', value: f.filter((h) => h.crossHireIdle).length, tint: '#FFFAF0' }]; },
    get widgets() {
      const f = activeFleet();
      return [
        { type: 'donut' as const, title: 'Fleet by ownership type', data: ['Owned', 'Cross-Hired', 'Spare-Standby'].map((o) => ({ label: o, value: f.filter((h) => h.ownership === o).length })), centerLabel: 'Units' },
        { type: 'table' as const, title: 'Cross-hired units', columns: [{ key: 'asset', label: 'Asset' }, { key: 'supplier', label: 'Supplier' }, { key: 'loc', label: 'Current Location' }, { key: 'state', label: 'State', status: true }],
          rows: f.filter((h) => h.ownership === 'Cross-Hired').map((h) => ({ asset: name(h), supplier: h.supplier, loc: currentLocation(h), state: h.crossHireIdle ? 'Idle' : h.assetStatus })) },
        records([{ label: 'Owned vs. Cross-Hire vs. Spare-Standby Report', to: '/inventory/reports/owned-vs-cross-hire-vs-spare' }, { label: 'Heavy Equipment Fixed Assets', to: '/inventory/items' }]),
      ];
    } },
  { slug: 'end-of-life-planning', title: 'End-of-Life Planning Dashboard', purpose: 'Assets approaching end of useful life, to support purchase planning.', change: 'new', req: REQ + 'Dashboards',
    get kpis() { const e = eol(); return [{ title: 'Due within 12 months', value: e.filter((x) => x.monthsLeft <= 12).length }, { title: 'Due within 36 months', value: e.filter((x) => x.monthsLeft <= 36).length }]; },
    get widgets() {
      const e = eol();
      return [
        { type: 'bar' as const, title: 'Assets reaching end of life by year', data: Array.from(new Set(e.map((x) => x.end.year()))).sort().map((y) => ({ label: String(y), value: e.filter((x) => x.end.year() === y).length })) },
        { type: 'table' as const, title: 'Nearest end of life', columns: [{ key: 'asset', label: 'Asset' }, { key: 'end', label: 'End of Useful Life' }, { key: 'left', label: 'Months Left', align: 'right' as const }], rows: e.slice(0, 8).map(({ h, end, monthsLeft }) => ({ asset: name(h), end: end.format('YYYY-MM-DD'), left: monthsLeft })) },
        records([{ label: 'End-of-Useful-Life Report', to: '/inventory/reports/end-of-useful-life' }]),
      ];
    } },
];
