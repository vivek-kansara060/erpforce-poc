# POC Builder Guide

You are building part of a **client-facing frontend design POC**: "the existing ERPForce ERP after applying the changes in the Heavy Equipment Rental requirement document". Read this whole file first.

## 0. Hard rules (from the client brief)

1. **No product suggestions, no invented functionality.** Build only (a) what the existing ERP already has in your area (see `docs/baseline/*.md`) and (b) what the requirement document explicitly states (`docs/requirement-extracted.txt`, line ranges given in your task). Do not add features because they are "typical for an ERP": no extra dashboards, filters, statuses, bulk actions, reports, automation, KPIs or workflow steps that are not in the document or the existing ERP.
2. Preserve the existing ERP: terminology, sidebar structure, list/form/view patterns, statuses. Change only what the document changes. Where the document changes an existing screen, keep the existing fields and add the new ones.
3. Every NEW or CHANGED element must be marked with the Review-Mode badges (`change="new"` / `change="changed"` props, `<ChangeTag>`, `<Marked>`) and carry a `req` string (requirement reference, e.g. `"CRM > Quotation > Allocation Tag"`).
4. Where the document says "requires confirmation", implement the plainest reading and add a short visible hint (`hint` prop) such as "Rule to be confirmed with client". Do not decide policy.
5. Frontend only. Mock data, local state. No API calls, no real calculations beyond trivial arithmetic (totals). Depreciation/stock/accounting figures are static mock values.
6. Client-presentable: no lorem ipsum, no TODO, no "coming soon", no dead buttons. Every button either navigates, opens a dialog, changes local state/status, or shows a toast (`useToast()`). Realistic UAE data (AED, Dubai/Abu Dhabi/Sharjah, TRN, LPO...). Never use an em dash character in any text; use commas, colons or hyphens.
7. Do not modify files outside your assigned folder except where told. Never edit shared files (`src/components/*`, `src/store/*`, `src/mock-data/masters.ts`, `src/shell/*`, `src/types.ts`, `src/modules/index.ts`). If you need a small shared helper, put it in your own folder.
8. Do not run `npm install` or add dependencies. Only these are available: react 18, react-router-dom 6, @mui/material 5.18, @mui/icons-material, @emotion, notistack, dayjs. No chart or table libraries (use the provided Widgets).

## 1. Project layout

```
src/
  components/   shared design-system components (read-only for you)
  store/        useCollection store (read-only)
  mock-data/    masters.ts (shared masters) + notifications.ts
  modules/<id>/ YOUR FOLDER (crm | rental | procurement | inventory | accounting | hrms | admin)
  types.ts      MenuItem, ChangeEntry, PartDef, ModuleDef
```
The app runs at http://localhost:5177 (`npm run dev`), HashRouter. Verify your work with `npx tsc --noEmit` (must pass with zero errors in your files) and, if you like, `npx vite build`.

## 2. Module part contract

You export a **PartDef** from your part's `index.tsx` (default export or named export as your task says):

```ts
import type { PartDef } from '@/types';
const part: PartDef = {
  menu: [ { label: 'Orders', children: [ { label: 'Lead', path: '/crm/leads' }, ... ] } ],   // ABSOLUTE paths
  routes: [ { path: 'leads', element: <LeadList /> }, { path: 'leads/add', element: <LeadForm /> }, { path: 'leads/:id', element: <LeadView /> } ], // RELATIVE to module basePath
  changes: [ { module: 'CRM / Sales', screen: 'Lead', classification: 'EXISTING WITH CHANGE', existing: '...', change: '...', ref: 'CRM > Lead', path: '/crm/leads' } ],
};
export default part;
```
- Module base paths: `/crm`, `/rental`, `/procurement`, `/inventory`, `/accounting`, `/hrms`, `/admin`.
- Sidebar: reproduce the **existing** sidebar entries of your area (see baseline "Sidebar as-is") in the same order and labels; add NEW entries only where the document needs a screen, with `change: 'new'`. Icons are optional (sub-items have none in the existing ERP; top-level groups may have a MUI outlined icon).
- `changes[]` is the Change Register. Add one entry for **every** screen/feature that is NEW / EXISTING WITH CHANGE / REMOVED, plus entries of classification `EXISTING` for existing screens you keep unchanged and re-create (one line each). Classification values: `'EXISTING' | 'EXISTING WITH CHANGE' | 'NEW' | 'REMOVED'`. `existing` = what the baseline says exists today ("-" for NEW); `change` = what the document adds or changes; `ref` = document section.
- Reports and dashboards: use `ReportDef[]` / `DashboardDef[]` and `reportRoutes(basePath, defs)` / `dashboardRoutes(basePath, defs)` (routes `reports`, `reports/:slug`, `dashboards`, `dashboards/:slug`). Add menu entries "Reports" and "Dashboards" (children may list each report/dashboard individually as the existing sidebar does for reports). Report rows are mock arrays (8 to 15 realistic rows each), columns as sensible for the stated purpose. Reports whose "Purpose" is described in the document must use that text as `purpose`.

## 3. Shared components (import from `@/components/...`)

| File | Exports and usage |
|---|---|
| `Text` | `<Text type="h3\|s3\|s4\|s5..." weight="medium" color="theme.secondary.800">` (existing typography wrapper). |
| `ChangeTag` | `<ChangeTag kind="new\|changed" req="..."/>` inline badge; `<Marked kind req>` wraps a block with left accent + badge. `useReviewMode()`. |
| `PageHeader` | `<FormHeader crumbs={[{label,to}]} actions={...} status={<StatusChip/>}/>` sticky breadcrumb bar (use on add/edit/view pages); `<PageTitle title subtitle right change req/>` (list pages); `<Page>` padded container (px 2rem). |
| `DataTable` | `<DataTable rows columns rowKey onRowClick actions filter={{key,options}} onAdd addLabel toolbarRight selectable selected onSelect pageSize hideToolbar rowSx/>`; `Column {key,label,render,width,align,change,req,sortable}`. Rows need an `id` (or pass `rowKey`). Row action menu = `actions=[{label,onClick,danger,hidden}]`. |
| `Form` | `TextInput NumberInput DateInput SelectInput MultiSelectInput CheckInput ToggleInput FileInput` (all take `label required hint change req disabled full error` + `value/onChange`), `FormGrid cols`, `FormSection title change req right`, `ValueField`/`ValueGrid` (view pages), `FieldShell`. Labels sit above controls (existing pattern). `DateInput` renders a datetime-local if the label contains "time". |
| `StatusChip` | `<StatusChip status="Approved"/>` auto-colours by keyword (existing colour mapping); `tone` prop overrides (`green blue amber red grey magenta dark teal`). |
| `Dialogs` | `AppDialog {open,title,onClose,onConfirm,confirmLabel,maxWidth}`, `ConfirmDialog`, `SideDrawer`, `MenuButton {label,items}` (the "Create v" dropdown), `useToast()`. |
| `Widgets` | `KpiCard KpiRow Panel BarChart DonutChart Progress TabPanels`. `TabPanels tabs={[{label,content,change,req,hidden}]}`. |
| `Flow` | `LifecycleStepper steps current`, `Timeline items` (audit trail / movement history / version history), `SignaturePad onChange` (e-signature). |
| `ReportsAndDashboards` | `ReportDef`, `DashboardDef`, `Widget` types, `reportRoutes`, `dashboardRoutes`, `ReportsIndex`, `DashboardPage`. Widgets: bar, donut, table, progress, heat, custom. |

Standard screen shapes (copy the existing ERP patterns):
- **List page**: `<Page><PageTitle title=.../><DataTable .../></Page>`; row click goes to the view page; `onAdd` goes to the add page; row actions Edit/Duplicate/Delete as in the existing ERP.
- **Add/Edit page**: `<FormHeader crumbs actions={<><Button variant="outlined">Save as draft</Button><Button variant="contained">Save</Button></>}/>` then `<Page>` with `TabPanels` (existing forms use tabs such as Basic Details / Address and Contact) or `FormSection`s. Save writes to the collection and navigates back with a toast.
- **View page**: FormHeader with breadcrumb `ID: series_number` and a `StatusChip`, status-dependent header buttons (that change the local status), `ValueGrid` details, `TabPanels` for line items / history / attachments, a Timeline for logs.

## 4. Data and state

- `useCollection<T extends {id:string}>(name, seed?)` from `@/store/store` gives `{rows,get,add,update,remove,replace}`. Seed once per collection name (first caller wins). Number series: `nextNumber('QT', 87)` -> `QT-26-00088`.
- **Shared masters** in `@/mock-data/masters`: `customers, suppliers, assets, locations, costCentres, employees, itemMaster, equipmentGroups`, constants `ASSET_STATUSES` (the Unified Asset Status master: Ready for Hire, On Hire, Off Hire, Breakdown, Under Maintenance, Disposed, Yard, Hold), `ACTIVITY_TYPES`, `OWNERSHIP_TYPES`, `costCentreTypes`, formatters `fmtAED`, `fmtNum`. Use these collection names EXACTLY: `'customers' 'suppliers' 'assets' 'locations' 'costCentres' 'employees' 'items'` and seed them with the exported arrays (`useCollection('assets', assets)`) so all modules see one dataset. You may update these records (e.g. an asset's status changes when a delivery is made).
- Your own collections must be prefixed with your module id, e.g. `'crm.quotations'`, `'rental.orders'`. Never read another module's prefixed collections; cross-module links are route links (e.g. `/inventory/assets/a1`) plus the shared masters. If you link to another module's page, use these agreed routes: asset view `/inventory/assets/:id`, customer view `/crm/customers/:id`, supplier view `/procurement/suppliers/:id`, cost centre view `/accounting/cost-centres/:id`, rental order view `/rental/orders/:id`, sales order view `/crm/sales-orders/:id`, employee view `/hrms/employees/:id`.
- Keep company: Gulf Power Rentals LLC; currency AED; dates 2026 (today is 30 Sep 2026). Number formats `AED 12,500`.
- Approvals: value-tier approval matrix example from the document (0-2,000 Warehouse; 2,000-5,000 Warehouse Manager; 5,000-10,000 Manager; above 10,000 General Manager). Show as configurable data, not hard-coded logic.
- Audit trail: show `Timeline` entries with user and timestamp wherever the document requires "logged".

## 5. Definition of done for your part

1. Every screen/feature the document lists for your area exists and is reachable from the sidebar or from a link inside another screen (no orphan screens). Every field listed in the document's field tables appears on the right screen with the stated type (picklist values exactly as written, mandatory marks, conditional mandatory behaviour, read-only/calculated fields shown read-only).
2. Business rules in the document that are visible in the UI are demonstrated by behaviour (e.g. conditional mandatory, status transitions, blocked actions with an explanatory message).
3. All reports and dashboards listed for your area exist (definition-driven is fine).
4. `npx tsc --noEmit` passes for your files. Manually check for runtime errors by reasoning; keep components small and typed loosely (`any` is acceptable in mock rows).
5. Final message to the coordinator (<= 25 lines): files created, routes, a list of "requires confirmation" hints you added, anything from the document you could NOT represent (be honest), and any existing-ERP behaviour you were unsure about.
