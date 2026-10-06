import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { DashboardPage, DashboardsIndex, ReportPage, ReportsIndex, type DashboardDef, type ReportDef } from '@/components/ReportsAndDashboards';
import { ASSET_STATUSES } from '@/mock-data/masters';
import { ACTIVITY_TYPES, categoryOptions, groupOptions, ESCALATION_DAYS, EXPIRY_NOTICE_DAYS, assetById, availability, custName, docTotals, isLive, lineTotal, type HeavyRec } from './data';
import { CrmReportPage, type CrmReportDef } from './CrmReport';
import { days, deliveredQty, outstanding } from './flow';
import { aed, useCrossHire, useDeliveries, useExtensions, useFleet, useLeads, useOpps, useOrders, useQuotes, useReplacements } from './shared';

const RC = 'CRM > Reports and Dashboards';
const RR = 'Rental > Reports and Dashboards';
const GROUP_COLORS = ['#2EB273', '#3E8193', '#A6914D', '#9C4F9C', '#C64D4D', '#7B7F85'];

function useData() {
  return { leads: useLeads().rows, opps: useOpps().rows, quotes: useQuotes().rows, orders: useOrders().rows, dels: useDeliveries().rows, ch: useCrossHire().rows, rep: useReplacements().rows, ext: useExtensions().rows, fleet: useFleet().rows };
}
type D = ReturnType<typeof useData>;

/**
 * Rental orders still out, with the header contract end (decision 2). `line` is a summary of the order's rental lines (items joined, all outstanding
 * assets) so the Rental screens that list expiries keep working.
 */
export function expiryRows(d: Pick<D, 'orders'>) {
  return d.orders.filter((o) => o.activity === 'Rental' && o.contractEnd && o.lines.some((l) => l.activity === 'Rental' && outstanding(l).length)).map((o) => {
    const rl = o.lines.filter((l) => l.activity === 'Rental' && outstanding(l).length);
    const left = -days(o.contractEnd!);
    const state = left < 0 ? 'Overdue' : left <= EXPIRY_NOTICE_DAYS ? 'Expiring' : 'Active';
    const line = { ...rl[0], id: `${o.id}-rental`, item: rl.map((l) => `${l.group} ${l.category}`).join(', '), contractEnd: o.contractEnd, assigned: rl.flatMap((l) => l.assigned) };
    return { id: o.id, so: o, line, left, state };
  }).sort((a, b) => a.left - b.left);
}

function crmDefs(d: D): CrmReportDef[] {
  const lineRows = d.orders.flatMap((o) => o.lines.map((l) => ({ o, l })));
  const soLink = (id: string) => `/crm/sales-orders/${id}`;
  return [
    { slug: 'opportunity-pipeline', title: 'Opportunity Pipeline / Funnel Report', purpose: 'Count and value by stage, filterable by Activity Type.', group: 'Pipeline', change: 'new', req: RC,
      columns: [{ key: 'number', label: 'Opportunity' }, { key: 'title', label: 'Opportunity Title' }, { key: 'customer', label: 'Customer' }, { key: 'stage', label: 'Stage', filter: true, status: true }, { key: 'activity', label: 'Activity Type', filter: true }, { key: 'owner', label: 'Salesperson', filter: true }, { key: 'value', label: 'Estimated Value', align: 'right', money: true, total: true }, { key: 'forecast', label: 'Forecast Value', align: 'right', money: true, total: true }],
      rows: d.opps.map((o) => ({ number: o.number, title: o.title, customer: custName(o.customerId), stage: o.stage, activity: o.activity, owner: o.owner, value: o.estimated, forecast: Math.round((o.estimated * o.probability) / 100), _link: `/crm/opportunities/${o.id}` })) },
    { slug: 'lead-source-conversion', title: 'Lead Source Conversion Report', purpose: 'Which lead sources convert into business.', group: 'Pipeline', change: 'new', req: RC,
      columns: [{ key: 'source', label: 'Source', filter: true }, { key: 'activity', label: 'Activity Type', filter: true }, { key: 'leads', label: 'Leads', align: 'right', total: true }, { key: 'converted', label: 'Converted', align: 'right', total: true }, { key: 'rate', label: 'Conversion', align: 'right' }],
      rows: Array.from(new Set(d.leads.map((l) => `${l.source}|${l.activity}`))).map((k) => { const [src, act] = k.split('|'); const m = d.leads.filter((l) => l.source === src && l.activity === act); const c = m.filter((l) => l.status === 'Converted').length; return { source: src, activity: act, leads: m.length, converted: c, rate: `${Math.round((c / m.length) * 100)}%` }; }) },
    { slug: 'activity-type-performance', title: 'Activity Type Performance Report', purpose: 'Rental vs. Trading vs. Fuel Trading vs. AMC vs. Service, pipeline and revenue side by side.', group: 'Sales', change: 'new', req: RC,
      columns: [{ key: 'activity', label: 'Activity Type', filter: true }, { key: 'quotes', label: 'Quotations', align: 'right', total: true }, { key: 'quotedValue', label: 'Quoted Value', align: 'right', money: true, total: true }, { key: 'orders', label: 'Sales Orders', align: 'right', total: true }, { key: 'revenue', label: 'Order Value', align: 'right', money: true, total: true }],
      rows: ACTIVITY_TYPES.map((a) => { const q = d.quotes.filter((x) => x.activity === a && x.status !== 'Revised'); const o = d.orders.filter((x) => x.activity === a); return { activity: a, quotes: q.length, quotedValue: Math.round(q.reduce((n, x) => n + docTotals(x.lines, x.discountPct, x.vatType).sub, 0)), orders: o.length, revenue: Math.round(o.reduce((n, x) => n + docTotals(x.lines, x.discountPct, x.vatType).sub, 0)) }; }) },
    { slug: 'required-vs-allocated', title: 'Required vs. Hired/Allocated Category Report', purpose: 'What the client requested against what was allocated or delivered, to guide fleet purchases.', group: 'Rental', change: 'new', req: RC,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'customer', label: 'Customer', filter: true }, { key: 'requested', label: 'Requested (client-facing)', filter: true }, { key: 'reserved', label: 'Allocation Tag (internal)' }, { key: 'delivered', label: 'Delivered' }, { key: 'asset', label: 'Asset' }, { key: 'differs', label: 'Differs', status: true, filter: true }],
      rows: lineRows.filter((x) => x.l.activity === 'Rental').flatMap(({ o, l }) => { const got = l.assigned.filter((a) => a.state !== 'Replaced').map((a) => assetById(a.assetId)).filter(Boolean) as HeavyRec[]; return (got.length ? got : [undefined]).map((h) => ({ so: o.number, customer: custName(o.customerId), requested: `${l.group} ${l.category}`, reserved: l.allocationTag ?? '-', delivered: h ? `${h.category} ${h.subCategory}` : 'Not yet delivered', asset: h?.assetId ?? '-', differs: l.allocationTag || (h && h.subCategory !== l.category) ? 'Yes' : 'No', _link: soLink(o.id) })); }) },
    { slug: 'category-demand-availability', title: 'Category Demand vs. Availability Report', purpose: "What's being quoted vs. what's actually in stock.", group: 'Rental', change: 'new', req: RC,
      columns: [{ key: 'category', label: 'Category', filter: true }, { key: 'sub', label: 'Subcategory' }, { key: 'quoted', label: 'Units Quoted (open quotations)', align: 'right', total: true }, { key: 'ordered', label: 'Units Awaiting Delivery', align: 'right', total: true }, { key: 'owned', label: 'Owned Ready for Hire', align: 'right', total: true }, { key: 'cross', label: 'Cross-Hired Ready', align: 'right', total: true }, { key: 'gap', label: 'Shortfall', status: true, filter: true }],
      rows: groupOptions().flatMap((g) => categoryOptions(g).map((c) => ({ g, c }))).map(({ g, c }) => { const q = d.quotes.filter((x) => ['Draft', 'Submitted for Approval', 'Approved'].includes(x.status)).flatMap((x) => x.lines).filter((l) => l.group === g && l.category === c).reduce((n, l) => n + l.qty, 0); const o = lineRows.filter((x) => x.l.group === g && x.l.category === c && x.l.activity === 'Rental').reduce((n, x) => n + (x.l.qty - deliveredQty(x.l)), 0); const a = availability(g, c, d.fleet); const short = Math.max(0, q + o - a.owned.length - a.cross.length); return { category: g, sub: c, quoted: q, ordered: o, owned: a.owned.length, cross: a.cross.length, gap: short ? `Short by ${short}` : 'Covered', _t: q + o }; }).filter((r) => r._t > 0 || r.owned > 0) },
    { slug: 'sales-order-backlog', title: 'Sales Order Backlog Report', purpose: 'Confirmed orders not yet delivered.', group: 'Sales', change: 'new', req: RC,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'customer', label: 'Customer', filter: true }, { key: 'activity', label: 'Activity Type', filter: true }, { key: 'item', label: 'Item' }, { key: 'pending', label: 'Pending Qty', align: 'right', total: true }, { key: 'value', label: 'Pending Value', align: 'right', money: true, total: true }, { key: 'status', label: 'Order Status', status: true, filter: true }],
      rows: lineRows.filter(({ o, l }) => (l.activity === 'Rental' ? deliveredQty(l) < l.qty : l.activity !== 'AMC' && !(o.activity === 'Rental' && l.activity === 'Service') && !l.fulfilment)).map(({ o, l }) => ({ so: o.number, customer: custName(o.customerId), activity: o.activity, item: l.item, pending: l.activity === 'Rental' ? l.qty - deliveredQty(l) : l.qty, value: Math.round(lineTotal(l)), status: o.status, _link: soLink(o.id) })) },
    { slug: 'order-profitability', title: 'Order Profitability Report', purpose: 'Per Sales Order line: revenue against direct cost (cross-hire, logistics), traced to the order as a project.', group: 'Sales', change: 'new', req: RC,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'activity', label: 'Activity Type', filter: true }, { key: 'kind', label: 'Line Type', filter: true }, { key: 'item', label: 'Line' }, { key: 'revenue', label: 'Revenue', align: 'right', money: true, total: true }, { key: 'cost', label: 'Direct Cost', align: 'right', money: true, total: true }, { key: 'margin', label: 'Margin', align: 'right', money: true, total: true }],
      rows: lineRows.map(({ o, l }) => { const rev = lineTotal(l); const cost = d.ch.filter((c) => c.lineId === l.id).reduce((n, c) => n + c.rate + (c.dispute ?? 0), 0) + (l.activity === 'Rental' ? o.logisticsCost / Math.max(1, o.lines.filter((x) => x.activity === 'Rental').length) : 0); return { so: o.number, activity: o.activity, kind: l.activity, item: l.item, revenue: Math.round(rev), cost: Math.round(cost), margin: Math.round(rev - cost), _link: soLink(o.id) }; }) },
    { slug: 'contract-lpo-expiry', title: 'Contract and LPO Expiry Report', purpose: 'Orders whose contract or LPO ends soon, for renewal or return follow-up.', group: 'Sales', change: 'new', req: RC,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'customer', label: 'Customer', filter: true }, { key: 'activity', label: 'Activity Type', filter: true }, { key: 'lpo', label: 'LPO' }, { key: 'end', label: 'Contract End' }, { key: 'lpoEnd', label: 'LPO Expiry' }, { key: 'left', label: 'Days left', align: 'right' }, { key: 'state', label: 'State', status: true, filter: true }],
      rows: d.orders.filter((o) => !['Closed', 'Cancelled'].includes(o.status)).map((o) => { const end = o.contractEnd ?? o.amcEnd ?? o.lpoExpiry; const left = end ? -days(end) : 9999; return { so: o.number, customer: custName(o.customerId), activity: o.activity, lpo: o.lpo, end: o.contractEnd ?? o.amcEnd ?? '-', lpoEnd: o.lpoExpiry || '-', left: end ? left : '-', state: left < 0 ? 'Overdue' : left <= EXPIRY_NOTICE_DAYS ? 'Expiring' : 'Active', _link: soLink(o.id) }; }).sort((a, b) => Number(a.left) - Number(b.left)) },
  ];
}

function rentalDefs(d: D): { reports: ReportDef[]; dashboards: DashboardDef[] } {
  // Own delivery vehicles are not rental fleet (Fleet Management decision D1), so they stay out of every rental fleet count.
  const live = d.fleet.filter((a) => isLive(a) && !a.deliveryFleet);
  const exp = expiryRows(d);
  const reports: ReportDef[] = [
    { slug: 'replacement-history', title: 'Replacement History Report', purpose: 'Full history of replacements, filterable by project, client and asset.', group: 'Rental', change: 'new', req: RR,
      columns: [{ key: 'no', label: 'Replacement' }, { key: 'so', label: 'Sales Order (project)' }, { key: 'customer', label: 'Client' }, { key: 'out', label: 'Asset Out (to maintenance)' }, { key: 'in', label: 'Asset In' }, { key: 'reason', label: 'Reason' }, { key: 'date', label: 'Date' }],
      rows: d.rep.map((r) => { const o = d.orders.find((x) => x.id === r.soId); return { no: r.number, so: o?.number, customer: o ? custName(o.customerId) : '-', out: assetById(r.oldAssetId)?.assetId, in: assetById(r.newAssetId)?.assetId, reason: r.reason, date: r.date }; }) },
    { slug: 'cross-hire-frequency', title: 'Cross-Hire Frequency Report', purpose: 'How often a category is cross-hired, to guide future fleet purchase decisions.', group: 'Cross-Hire', change: 'new', req: RR,
      columns: [{ key: 'category', label: 'Group + Category' }, { key: 'count', label: 'Cross-Hire Requests', align: 'right' }, { key: 'cost', label: 'Supplier Cost', align: 'right' }, { key: 'revenue', label: 'Rental Revenue', align: 'right' }],
      rows: Array.from(new Set(d.ch.map((c) => `${c.group} ${c.category}`))).map((k) => { const m = d.ch.filter((c) => `${c.group} ${c.category}` === k); return { category: k, count: m.length, cost: aed(m.reduce((n, c) => n + c.rate + (c.dispute ?? 0), 0)), revenue: aed(m.reduce((n, c) => n + c.revenue, 0)) }; }) },
    { slug: 'asset-ledger', title: 'Sales Order Asset Ledger', purpose: 'Live per-Order view of assets delivered, billed and received to date. Open an order to see the ledger tab.', group: 'Rental', change: 'new', req: RR,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'asset', label: 'Asset' }, { key: 'delivered', label: 'Delivered' }, { key: 'stop', label: 'Billing Stopped' }, { key: 'state', label: 'Status', status: true }],
      rows: d.orders.flatMap((o) => o.lines.flatMap((l) => l.assigned.map((a) => ({ so: o.number, asset: assetById(a.assetId)?.assetId, delivered: a.start, stop: a.stop ?? '-', state: a.state === 'Returned' ? 'Off Hire' : a.state })))) },
    { slug: 'logistics-cost', title: 'Logistics Cost & Profitability Report', purpose: 'Delivery/collection cost allocated per Sales Order, feeding overall order profitability.', group: 'Rental', change: 'new', req: RR,
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'customer', label: 'Customer' }, { key: 'rev', label: 'Order Value', align: 'right' }, { key: 'log', label: 'Logistics Cost', align: 'right' }, { key: 'pct', label: 'Logistics % of value', align: 'right' }],
      rows: d.orders.map((o) => { const t = docTotals(o.lines, o.discountPct, o.vatType).sub; return { so: o.number, customer: custName(o.customerId), rev: aed(t), log: aed(o.logisticsCost), pct: `${t ? ((o.logisticsCost / t) * 100).toFixed(1) : 0}%` }; }) },
    { slug: 'contract-expiry', title: 'Overdue On-Hire and Contract Expiry Report', purpose: 'Rental lines nearing or past their Contract End Date without a completed return.', group: 'Rental', change: 'new', req: RR,
      filters: [{ key: 'state', label: 'State', options: ['Overdue', 'Expiring', 'Active'] }],
      columns: [{ key: 'so', label: 'Sales Order' }, { key: 'customer', label: 'Customer' }, { key: 'item', label: 'Line' }, { key: 'end', label: 'Contract End' }, { key: 'left', label: 'Days left', align: 'right' }, { key: 'state', label: 'State', status: true }],
      rows: exp.map((e) => ({ so: e.so.number, customer: custName(e.so.customerId), item: e.line.item, end: e.so.contractEnd, left: e.left, state: e.state })) },
  ];
  /* Existing Rental reports (unchanged names), now fed by the same Sales Orders and Fixed Asset Register. */
  const rentalOrders = d.orders.filter((o) => o.activity === 'Rental');
  const existing: ReportDef[] = [
    { slug: 'active-rentals', title: 'Active Rentals', purpose: 'Rental orders with assets currently on hire.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'so', label: 'Rental Order' }, { key: 'customer', label: 'Customer' }, { key: 'assets', label: 'Assets On Hire' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }, { key: 'type', label: 'Contract Type' }],
      rows: rentalOrders.filter((o) => o.lines.some((l) => outstanding(l).length)).map((o) => ({ so: o.number, customer: custName(o.customerId), assets: o.lines.flatMap((l) => outstanding(l)).map((a) => assetById(a.assetId)?.assetId).join(', '), start: o.contractStart, end: o.contractEnd, type: o.contractType })) },
    { slug: 'rental-revenue', title: 'Rental Revenue', purpose: 'Rental order value by customer.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'customer', label: 'Customer' }, { key: 'orders', label: 'Orders', align: 'right' }, { key: 'revenue', label: 'Order Value', align: 'right' }],
      rows: Array.from(new Set(rentalOrders.map((o) => o.customerId))).map((c) => { const m = rentalOrders.filter((o) => o.customerId === c); return { customer: custName(c), orders: m.length, revenue: aed(Math.round(m.reduce((n, o) => n + docTotals(o.lines, o.discountPct, o.vatType).sub, 0))) }; }) },
    { slug: 'customer-rental', title: 'Customer Rental', purpose: 'Rental lines per customer.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'customer', label: 'Customer' }, { key: 'so', label: 'Rental Order' }, { key: 'item', label: 'Item' }, { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'status', label: 'Status', status: true }],
      rows: rentalOrders.flatMap((o) => o.lines.filter((l) => l.activity === 'Rental').map((l) => ({ customer: custName(o.customerId), so: o.number, item: l.item, qty: l.qty, status: o.status }))) },
    { slug: 'asset-availability', title: 'Asset Availability', purpose: 'Ready for Hire units by Category and Subcategory.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'category', label: 'Category' }, { key: 'sub', label: 'Subcategory' }, { key: 'ready', label: 'Ready for Hire', align: 'right' }, { key: 'onHire', label: 'On Hire', align: 'right' }, { key: 'other', label: 'Other statuses', align: 'right' }],
      rows: Array.from(new Set(live.map((a) => `${a.category}|${a.subCategory}`))).map((k) => { const [g, c] = k.split('|'); const m = live.filter((a) => a.category === g && a.subCategory === c); return { category: g, sub: c, ready: m.filter((a) => a.assetStatus === 'Ready for Hire').length, onHire: m.filter((a) => a.assetStatus === 'On Hire').length, other: m.filter((a) => !['Ready for Hire', 'On Hire'].includes(a.assetStatus)).length }; }) },
    { slug: 'asset-utilization', title: 'Asset Utilization', purpose: 'On-hire share of time per asset.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'asset', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'util', label: 'Utilization %', align: 'right' }],
      rows: live.map((a) => ({ asset: `${a.assetId} - ${a.name}`, category: `${a.category} ${a.subCategory}`, util: `${a.utilization}%` })) },
    { slug: 'asset-category-performance', title: 'Asset Category Performance', purpose: 'Order value by Category and Subcategory.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'category', label: 'Category' }, { key: 'sub', label: 'Subcategory' }, { key: 'lines', label: 'Order Lines', align: 'right' }, { key: 'value', label: 'Order Value', align: 'right' }],
      rows: Array.from(new Set(rentalOrders.flatMap((o) => o.lines.filter((l) => l.activity === 'Rental').map((l) => `${l.group}|${l.category}`)))).map((k) => { const [g, c] = k.split('|'); const m = rentalOrders.flatMap((o) => o.lines).filter((l) => l.activity === 'Rental' && l.group === g && l.category === c); return { category: g, sub: c, lines: m.length, value: aed(Math.round(m.reduce((n, l) => n + lineTotal(l), 0))) }; }) },
    { slug: 'rental-cancellations-amendments', title: 'Rental Cancellations and Amendments', purpose: 'Extensions, early terminations and replacements.', group: 'Rental reports (existing)', req: RR,
      columns: [{ key: 'ref', label: 'Reference' }, { key: 'type', label: 'Type' }, { key: 'so', label: 'Rental Order' }, { key: 'date', label: 'Date' }, { key: 'detail', label: 'Detail' }],
      rows: [...d.ext.map((e) => ({ ref: e.number, type: e.kind, so: d.orders.find((o) => o.id === e.soId)?.number, date: e.date, detail: `${e.oldEnd} to ${e.newEnd}` })), ...d.rep.map((r) => ({ ref: r.number, type: 'Replacement', so: d.orders.find((o) => o.id === r.soId)?.number, date: r.date, detail: `${assetById(r.oldAssetId)?.assetId} replaced by ${assetById(r.newAssetId)?.assetId}` }))] },
  ];
  const stat = ASSET_STATUSES.map((s, i) => ({ label: s, value: live.filter((a) => a.assetStatus === s).length, color: GROUP_COLORS[i % 6] })).filter((x) => x.value);
  const cats = Array.from(new Set(live.map((a) => `${a.category} ${a.subCategory}`)));
  const dashboards: DashboardDef[] = [
    { slug: 'fleet-status', title: 'Fleet Status Dashboard', purpose: 'Live counts by category, Available / On-Hire / Under-Maintenance / Disposed.', change: 'new', req: RR,
      kpis: [{ title: 'Ready for Hire', value: live.filter((a) => a.assetStatus === 'Ready for Hire').length }, { title: 'On Hire', value: live.filter((a) => a.assetStatus === 'On Hire').length }, { title: 'Hold', value: live.filter((a) => a.assetStatus === 'Hold').length }, { title: 'Yard / Off Hire', value: live.filter((a) => ['Yard', 'Off Hire'].includes(a.assetStatus)).length }, { title: 'Under Maintenance', value: live.filter((a) => a.assetStatus === 'Under Maintenance').length }],
      widgets: [{ type: 'donut', title: 'Fleet by Asset Status', data: stat, centerLabel: 'Assets' }, { type: 'heat', title: 'Assets by category and status', rows: cats, cols: ['Ready for Hire', 'On Hire', 'Yard', 'Under Maintenance'], values: cats.map((c) => ['Ready for Hire', 'On Hire', 'Yard', 'Under Maintenance'].map((s) => live.filter((a) => `${a.category} ${a.subCategory}` === c && a.assetStatus === s).length)) }] },
    { slug: 'renewal-overdue', title: 'Renewal & Overdue Dashboard', purpose: `Upcoming contract expiries (notice ${EXPIRY_NOTICE_DAYS} days) and current overdue on-hire assets together, for Service Desk and Sales follow-up. Escalation after ${ESCALATION_DAYS} overdue days.`, change: 'new', req: RR,
      kpis: [{ title: 'Overdue', value: exp.filter((e) => e.state === 'Overdue').length, tint: '#FFEBEB' }, { title: 'Expiring soon', value: exp.filter((e) => e.state === 'Expiring').length, tint: '#FFF3CC' }, { title: 'Escalated', value: exp.filter((e) => -e.left > ESCALATION_DAYS).length }],
      widgets: [{ type: 'table', title: 'Expiry and overdue list', span: 2, columns: [{ key: 'so', label: 'Sales Order' }, { key: 'c', label: 'Customer' }, { key: 'item', label: 'Line' }, { key: 'end', label: 'End' }, { key: 'left', label: 'Days left', align: 'right' }, { key: 'state', label: 'State', status: true }], rows: exp.filter((e) => e.state !== 'Active').map((e) => ({ so: e.so.number, c: custName(e.so.customerId), item: e.line.item, end: e.so.contractEnd, left: e.left, state: e.state })) }] },
    { slug: 'maintenance-breakdown', title: 'Maintenance / Breakdown Dashboard', purpose: 'Assets due for service or currently down, by category.', change: 'new', req: RR,
      widgets: [{ type: 'table', title: 'Assets in maintenance or breakdown', span: 2, columns: [{ key: 'a', label: 'Asset' }, { key: 'c', label: 'Category' }, { key: 's', label: 'Status', status: true }, { key: 'l', label: 'Last movement' }], rows: live.filter((a) => ['Under Maintenance', 'Breakdown'].includes(a.assetStatus)).map((a) => ({ a: `${a.assetId} - ${a.name}`, c: `${a.category} ${a.subCategory}`, s: a.assetStatus, l: [...a.movements].sort((x, y) => y.date.localeCompare(x.date))[0]?.type })) }] },
    { slug: 'cross-hire-cost-revenue', title: 'Cross-Hire Cost vs. Rental Revenue Dashboard', purpose: 'Cost of cross-hired units vs. revenue earned.', change: 'new', req: RR,
      widgets: [{ type: 'bar', title: 'Cost vs revenue per request (AED)', data: d.ch.flatMap((c) => [{ label: `${c.number} cost`, value: c.rate + (c.dispute ?? 0), color: '#C64D4D' }, { label: `${c.number} revenue`, value: c.revenue, color: '#2EB273' }]), format: (n) => `${Math.round(n / 1000)}k` }, { type: 'table', title: 'Cross-hire profitability', columns: [{ key: 'n', label: 'Request' }, { key: 'cost', label: 'Cost', align: 'right' }, { key: 'rev', label: 'Revenue', align: 'right' }, { key: 'm', label: 'Margin', align: 'right' }], rows: d.ch.map((c) => ({ n: c.number, cost: aed(c.rate + (c.dispute ?? 0)), rev: aed(c.revenue), m: aed(c.revenue - c.rate - (c.dispute ?? 0)) })) }] },
  ];
  return { reports: [...existing, ...reports], dashboards };
}

const base = (scope: string) => (scope === 'crm' ? '/crm' : '/rental');

function Index({ scope, kind }: { scope: 'crm' | 'rental'; kind: 'reports' | 'dashboards' }) {
  const d = useData();
  if (scope === 'crm') return <ReportsIndex reports={crmDefs(d) as unknown as ReportDef[]} basePath="/crm" />;
  const x = rentalDefs(d);
  return kind === 'reports' ? <ReportsIndex reports={x.reports} basePath={base(scope)} /> : <DashboardsIndex dashboards={x.dashboards} basePath={base(scope)} />;
}
function Item({ scope, kind }: { scope: 'crm' | 'rental'; kind: 'reports' | 'dashboards' }) {
  const { slug } = useParams();
  const d = useData();
  if (scope === 'crm') { const r = crmDefs(d).find((y) => y.slug === slug); return r ? <CrmReportPage def={r} /> : <Navigate to="/crm/reports" replace />; }
  const x = rentalDefs(d);
  if (kind === 'reports') { const r = x.reports.find((y) => y.slug === slug); return r ? <ReportPage report={r} basePath={base(scope)} /> : <Navigate to={`${base(scope)}/reports`} replace />; }
  const db = x.dashboards.find((y) => y.slug === slug);
  return db ? <DashboardPage def={db} basePath={base(scope)} /> : <Navigate to={`${base(scope)}/dashboards`} replace />;
}
/** CRM: reports only (decision 5, dashboards removed until the screens are agreed). Rental keeps its reports and dashboards. */
export const liveRoutes = (scope: 'crm' | 'rental'): RouteObject[] => [
  { path: 'reports', element: <Index scope={scope} kind="reports" /> }, { path: 'reports/:slug', element: <Item scope={scope} kind="reports" /> },
  ...(scope === 'rental' ? [{ path: 'dashboards', element: <Index scope={scope} kind="dashboards" /> }, { path: 'dashboards/:slug', element: <Item scope={scope} kind="dashboards" /> }] : []),
];
