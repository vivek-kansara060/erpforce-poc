# 8 Oct Client Feedback Spec (ERPForce POC)

Prepared 9 Oct 2026 from the "Heavy rental module discussion - October 08" call with Ajin (69 min). Status: **SPEC ONLY, NOT APPROVED FOR EXECUTION, NOTHING EXECUTED.**
Written to be executed in a fresh session with no other context. Read this whole file before touching code. Every path is relative to `erpforce-poc/`.

---

## 0. How to use this spec

1. Get explicit approval from Anurag before Phase 1 (standing rule: feedback first, edit the POC only after a yes). If Anurag changes a default in section 2, update this file first.
2. Follow the mandatory context check in `CLAUDE.md` (FE code, `ERP_PROJECT_DOCUMENTATION.md`, `ERPForce_Heavy_Equipment_Rental_Module.md`, `Transcript.md`). The 8 Oct transcript is **not** in `Transcript.md` yet: append it there first (Anurag has the text), as a new section `## Heavy rental module discussion - October 08`.
3. Execute phases 1 to 7 in order (section 6). Each phase ends with `npx tsc --noEmit` passing with zero errors. Do not start the next phase on a red checkpoint. Run `npx vite build` at the end.
4. Do not commit, push or deploy unless asked.

### 0.1 Hard rules (from `docs/BUILDER-GUIDE.md`, `CLAUDE.md` and earlier feedback)

- Never use an em dash character anywhere (code strings, comments, markdown). Use commas, colons, hyphens.
- Keep the existing look and flow: `FormHeader` + `Page` + `TabPanels` + `DataTable` + `SpecForm` / `SpecView` + `MenuButton` + `ValueGrid`, exactly like `src/modules/crm/SalesOrderPages.tsx`. Status colours come from `StatusChip` keyword rules.
- "Make X like Y" style changes copy layout and actions only. Never add, remove or swap the fields of a screen unless this spec names the field.
- Every NEW or CHANGED element carries `change="new" | "changed"` plus a `req` string. Use the new helper `R8(topic)` (section 3.2). Every new or changed screen gets a Change Register entry (the module's `changes[]`) and a `CHANGELOG.md` entry (section 7).
- Where a rule is not decided by the client, implement the plainest reading and show the hint `TO_CONFIRM` (`'Rule to be confirmed with client'`, exported from `src/modules/crm/shared.tsx`).
- No dead buttons. Realistic UAE data (AED, 5% VAT, Gulf Power Rentals LLC). No new dependencies, no `npm install`.
- **Shared files.** The builder guide forbids editing `src/components/*` and `src/mock-data/masters.ts`. This spec overrides that for exactly three edits, because Ajin asked for a global behaviour and the requirement makes the status list admin-extendable (Req L425, L1052): `src/components/Form.tsx`, `src/components/Widgets.tsx`, `src/components/Dialogs.tsx` (F1), one new file `src/components/ErrorPanel.tsx` (F1), and `ASSET_STATUSES` in `src/mock-data/masters.ts` (F11). Touch nothing else in shared folders.

### 0.2 Sources this spec is built on

| Source | What it gave |
|---|---|
| 8 Oct call transcript (pasted by Anurag, cut off at 1:06:30) | Every work item below; timestamps quoted per item |
| Current POC code, verified line by line on 9 Oct | "Today" paragraph of every item |
| `ERPForce_Heavy_Equipment_Rental_Module.md` | Unified Asset Status is admin-extendable (L79, L425, L1052); Yard Inspection Checklist admin-configurable (L552); per-delivery billing start (L632); cross-hire Supplier Invoice Reference (L915); Brand, Model on serialized assets (L1014) |
| `docs/amc-accounting-change-plan.md` | Decisions D3 (rental invoices from the run), D4 (every generated invoice or bill is created Pending) still apply |
| `docs/BUILDER-GUIDE.md` | Component contract, data rules |

---

## 1. Scope

### 1.1 Every action item from the call and what this spec does with it

| # | Call item (timestamp) | Disposition | Work item |
|---|---|---|---|
| 1 | Service items need no delivery or job card (7:42) | Already true for service lines on a Rental order. Standalone Service orders still get a one-visit job card: open question O2 | V1 |
| 2 | Cross-Hire order: everything carries forward from the Sales Order, user only picks the supplier (8:47 to 9:30) | Build | F3 |
| 3 | Category and Subcategory shown separately, same as the Sales Order, not combined (10:32 to 11:13) | Build | F2 |
| 4 | Project on the Cross-Hire order and receiving, carried from the Sales Order (11:22 to 12:48) | Build | F3 |
| 5 | Dropship vs Inventory (12:13) | Already built | V2 |
| 6 | Brand and Model (optional) when tracing a hired asset (13:16 to 14:14) | Build | F4 |
| 7 | Cross-hire flag on the asset to tell hired from owned (14:14 to 15:00) | Already built (`ownership`) | V3 |
| 8 | Supplier bill entered by hand, no recurring automation (16:27 to 16:54, 39:48 to 45:15) | Build | F5 |
| 9 | Rental invoicing default Automatic, manual still possible (22:xx to 23:07) | Build | F15 |
| 10 | Return checklist as a master the user maintains (24:30 to 25:00) | Already built (CRM Masters) | V4 |
| 11 | Partial return from the same Sales Order (27:00) | Already built | V4 |
| 12 | Attachment per returned item and for the whole return (28:00) | Build (per item) | F9 |
| 13 | Return approval follows "our latest approval cycle" (29:17 to 29:43) | Development phase, no POC change (Ajin: "we will take care while developing") | Note only |
| 14 | Invoice start and end dates separate from delivery and return dates; ask "raise an additional invoice?" when they differ (29:58 to 31:58) | Build | F7, F8 |
| 15 | Returned own assets always go to maintenance (cleaning, washing) with routine or critical checklists; cross-hired assets skip this (32:52 to 34:12) | Build | F10 |
| 16 | Security deposit, bank guarantee, LC (34:12 to 34:53) | Phase 2, agreed on the call | Out of scope |
| 17 | Error messages listed at the side or bottom, click goes to the field, global (35:10 to 36:11) | Build | F1 |
| 18 | Asset Dashboard shows Category, Subcategory, Asset, current company holding it, Status (36:23 to 37:29) | Build | F14 |
| 19 | Track requested vs delivered capacity for a future utilization report (37:32 to 38:49) | Data already tracked (`requestedSub` / `deliveredSub`, Required vs. Hired/Allocated report). Report format later | V6 |
| 20 | Return to Supplier from the Sales Order and from the asset, not only from the Cross-Hire order (39:00 to 40:00) | Build (SO side; asset side exists) | F6 |
| 21 | HR letters, HSE documents, warning letters, KPI for appreciation (45:48 to 46:53) | HRMS product, not this POC (HRMS module is a placeholder) | Out of scope, O10 |
| 22 | Replacement: traceable item, another serial, old one to maintenance (47:00 to 48:31) | Exists; refined in F12 | F12 |
| 23 | Contract expiry dashboard, click to the Sales Order, extend there (49:00, 1:03:21) | Dashboard exists (14 days notice). Click-through and extend flow: build | F13 |
| 24 | Collection dashboard like the sales order dashboard (51:xx) | Ajin's side to send the dashboard definition (Darshit asked for it at 52:02) | Out of scope |
| 25 | Scrap / disposal method has no connection, only a status change (52:xx) | Earlier feedback, not part of this call's demo | Out of scope |
| 26 | Asset statuses: On Hire, Off Hire In Transit, Yard Inspection, ready for hire, visible on the asset list (53:24 to 54:42) | Build | F11 |
| 27 | Certificate expiry reminder on a dashboard (report is also fine) (54:42 to 55:37) | Report and notifications exist; add a dashboard widget | F14 |
| 28 | Scaffolding rental and heavy equipment rental in one system (55:54) | Future, no concrete ask | Out of scope |
| 29 | Replacement only from the Sales Order; choose Category and Subcategory; fleet selection; delivery order (57:35 to 1:00:43) | Build | F12 |
| 30 | On the Sales Order, see assets allocated, returned and pending (59:07, 1:00:03) | Tabs exist; add a per-line summary | F16 |
| 31 | Overdue on-hire handling, fault attribution (1:00:43) | Already built (Rental > Renewals and Expiry) | V7 |
| 32 | Extension as a revision of the same Sales Order: same screen, change date and rate, keep previous and current version (1:05:09 to 1:06:30) | Build | F13 |
| 33 | Extension when only some assets are still out (1:06:30, transcript cut off) | Build: only lines with assets still out are extended | F13 |
| 34 | Delivery: deliver 550 KVA when 500 KVA is asked (20:19) | Already built (Trace Details, Subcategory substitution) | V5 |
| 35 | RFQ optional, order direct is fine (8:17, 17:28) | Already built | V8 |
| 36 | Deploy HRMS to KSA, Employee Master upload (4:09) | Operations task, not POC | Out of scope |

### 1.2 Work items in one paragraph

A global error panel (F1). Cross-Hire: separate Category and Subcategory everywhere (F2), Project and the Sales Order context on the order and the receipt (F3), optional Brand and Model on traced units (F4), manual periodic supplier bills from the Sales Order (F5), Return to Supplier and Re-Issue from the Sales Order (F6). Delivery and Return: invoice start and end dates with an "additional invoice?" question (F7, F8), attachments per returned item (F9). Assets: every returned owned asset goes to maintenance with a routine or critical checklist, cross-hired assets go back toward the supplier (F10), two new statuses Off Hire - In Transit and Yard Inspection (F11). Sales Order: replacement only from the order with Category / Subcategory choice and its own Delivery Order (F12), extension as a revision with rate change and version history, dashboards click through to the order (F13), Automatic as the default invoicing type (F15), per-line Out / Returned / To deliver summary (F16). Dashboards: per-asset "where is it now" table and certificate reminders (F14).

---

## 2. Defaults chosen (confirm with Anurag before Phase 1)

| # | Question | Default in this spec | Why |
|---|---|---|---|
| D1 | "Supplier auto-populate" (8:47 to 9:30) | Read as: every field except the supplier is carried from the Sales Order (Rental Order, Project, Activity Type, Customer, Site, rental period); the supplier is prefilled when the request or RFQ award has one (already built) and is otherwise the only thing the user picks | Ajin: "Only what I required is I just need to [select] the supplier, because the [Rental Order] ID, activity type, [cost centre], everything is carried forwarded here". Raise as O1 |
| D2 | Additional invoice amount | Lump sum, defaulted to day rate x days x units (Monthly price / 30, Weekly / 7, Daily / 1), editable | Ajin only asked for the yes/no question and "create an additional invoice against that" |
| D3 | Additional invoice on Return | Asked only when the Invoice End Date is **before** the return date (those days are otherwise not billed). When it is after, the rental run keeps billing until then, so no question | Avoids billing the same days twice. `TO_CONFIRM` hint |
| D4 | Rate change on extension | The new rate applies to every rental period not yet invoiced | Billing reads the line price at run time (`src/modules/accounting/billing.ts:191`). `TO_CONFIRM` hint |
| D5 | Early Termination | Kept, moved out of the header into Actions | Ajin: "no need for terminate" but then "if I'm mentioning terminate, I need to do some closing". Raise as O5 |
| D6 | Replacement "delivery order selection" | Saving a replacement creates its own Delivery Order for the new unit (the old flow reused the original DO number) | Plainest reading that gives the replacement unit a DO like every other delivery. Raise as O6 |
| D7 | Replacement Category | Category and Subcategory both selectable, prefilled from the line | Ajin: "I need to choose the category. I need to choose the subcategory." Delivery Trace Details locks Category, so this differs: raise as O7 |
| D8 | Owned asset that passes yard inspection | Goes to Under Maintenance (Routine), not straight to Ready for Hire | Ajin 33:20: "always it will ... cleaning, washing ... it will directly go for the maintenance itself". This **changes** the current rule in `src/modules/crm/flow.ts:616-618` |
| D9 | Cross-hired asset with damage at yard inspection | Not sent to maintenance; stays at the yard flagged idle for Return to Supplier; the damage charge to the client still applies | Vivek 34:04: "cross-hire, we don't need to check that one, they will take care" |
| D10 | HRMS letters and KPIs | Not built in this POC | HRMS here is a placeholder (`src/modules/hrms/index.tsx`); Darshit: "HRMS ... is the standard only ... that we will consider with HRMS" |

### 2.1 Conflicts found (call these out to the client)

| Conflict | Resolution |
|---|---|
| Current POC: an owned asset that passes yard inspection becomes Ready for Hire (`flow.ts:616-618`) | 8 Oct call wins: always Under Maintenance first (D8) |
| Builder guide: never edit shared components or `masters.ts` | Overridden for F1 and F11 only (section 0.1) |
| A delivery's waiting charge is billed on the first rental invoice (`billing.ts:220-224`) **and** pushed to the order's Charges tab (`flow.ts:273`), where "Raise Invoice" can bill it again | New deliveries stop using `waitingCharge` (F7). Legacy seed records keep it; note the double-billing risk in the changelog "Be aware" |
| Delivery Trace Details locks Category; Ajin wants Category choosable on replacement | D7, raise as O7 |

---

## 3. Shared conventions for this change

### 3.1 Naming trap: Category and Subcategory

- Sales Order `Line`, Cross-Hire items, request items and RFQ items: **`group` = Category** (e.g. Generator), **`category` = Subcategory** (e.g. 500 KVA). See the comment at `src/modules/crm/data.ts:125-128`.
- Fixed asset `HeavyRec`: `category` = Category, `subCategory` = Subcategory.
- Labels on screen are always exactly **"Category"** and **"Subcategory"** (the Sales Order wording, `src/modules/crm/Items.tsx:35-36`).

### 3.2 Requirement reference helper

Add to `src/modules/crm/shared.tsx` next to `R`:

```ts
/** Requirement reference for changes from the 8 Oct client call. */
export const R8 = (topic: string) => `Client call 8 Oct: ${topic}`;
```

Use it for every `req` string introduced by this spec, e.g. `req={R8('Category and Subcategory shown separately')}`.

### 3.3 Data model changes (all optional fields, so seeds keep working)

| Type (file) | Add |
|---|---|
| `CrossHire` (`src/modules/crm/data.ts:232`) | `project?: string; customerId?: string; site?: string` |
| `CrossHireGrn.traces[]` (`data.ts:268`) | `brand?: string; model?: string` |
| `ReturnItem` (`data.ts:213`) | `files?: string[]` |
| `ReturnEntry` (`data.ts:221`) | `offHireDate?: string; additional?: AdditionalCharge; additionalInvoiceId?: string` |
| `Delivery` (`data.ts:197`) | `additional?: AdditionalCharge; additionalInvoiceId?: string; replacementId?: string` |
| `Replacement` (`data.ts:228`) | `deliveryId?: string; group?: string; category?: string` |
| `Extension` (`data.ts:231`) | `revision?: number; changes?: string` |
| `SalesOrder` (`data.ts:189`) | `revision?: number; revisions?: OrderRevision[]` |
| `HeavyRec` (`src/modules/inventory/data.ts:340` area) | `maintenanceType?: 'Routine' \| 'Critical'; maintenanceRef?: string` |
| `LineTag` (`src/modules/accounting/data.ts:15`) | `'additional'` |

New types in `src/modules/crm/data.ts`:

```ts
export interface AdditionalCharge { from: string; to: string; days: number; amount: number; note?: string }
export interface OrderRevision { rev: number; date: string; by: string; note: string; contractEnd?: string; lpo?: string; lpoExpiry?: string; lines: { id: string; item: string; end?: string; price: number }[] }
```

New masters in `MASTER_SEED` (`src/modules/crm/data.ts:104`) and labels in `MASTER_LABELS` (`src/modules/crm/MasterPages.tsx:11`):

```ts
maintenanceRoutine: ['Wash and clean the unit', 'Check oil, coolant and filters', 'Battery and charging check', 'Load test', 'Canopy and paint touch-up'],
maintenanceCritical: ['Fault diagnosed and recorded', 'Parts replaced and recorded', 'Load test after repair', 'Workshop supervisor sign-off'],
```

Labels: `maintenanceRoutine: { label: 'Routine Maintenance Checklist', used: 'Heavy Equipment Fixed Asset: Complete Maintenance' }`, same for `maintenanceCritical` ("Critical Maintenance Checklist"). Show the hint "Checklist content to be supplied by the client" on the Complete Maintenance dialog.

The store is in memory and re-seeds on every refresh (`src/store/store.ts`), so no migration is needed.

---

## 4. Work items

Each item: what Ajin said, what the code does today (verified 9 Oct), the change, and how to check it.

### F1. Global error panel with click-to-field

**Ajin (35:10):** "Instead of [a pop-up], why can't we show something at the bottom or at the side, what is the error? And if I'm clicking that error, it should redirect me to that particular error point itself ... Maybe we can adopt it as a global one."

**Today.** Every form builds a local `errors` record, passes `error=` to inputs (rendered under the field by `FieldShell`, `src/components/Form.tsx:29-41`) and fires one toast `'Please complete the mandatory fields highlighted on the form'` through `useToast` (`src/components/Dialogs.tsx:79-82`). `TabPanels` renders only the active tab (`src/components/Widgets.tsx:110`), so an error on another tab is invisible. Example from the demo: the Cross-Hire order requires `supplierAddress`, `contactPerson`, `shippingAddress` on the Address & Contact tab (`src/modules/rental/CrossHireOrderPages.tsx:103`), and the user only sees a toast. No `ErrorSummary` or `scrollIntoView` exists anywhere.

**Change.**
1. `src/components/Form.tsx`, `FieldShell`: on the root `Box` add `data-field-error={error ? label : undefined}` and `data-field-msg={error || undefined}`. Add and export:
   ```tsx
   /** An error not tied to one input (an items table, a checklist). Listed by the error panel like a field error. */
   export function FieldError({ label, error }: { label: string; error?: string }) {
     if (!error) return null;
     return <Text type="s5" color="#C64D4D" data-field-error={label} data-field-msg={error} sx={{ mt: 0.5 }}>{error}</Text>;
   }
   ```
   (If `Text` does not forward `data-*` props, wrap it in a `Box` that carries them.)
2. `src/components/Widgets.tsx`, `TabPanels`: render every non-hidden tab's content, the inactive ones in a `Box` with `sx={{ display: i === idx ? 'block' : 'none' }}` and `data-tab-panel={i}`, so forms on other tabs stay mounted. Keep a ref per panel. Listen on `window` for the `erp:reveal-field` CustomEvent (detail = the element); if a panel contains it, switch to that tab. Listen for `erp:errors-changed` and show a small red count after the tab label when that panel holds `[data-field-error]` elements (use the existing `#C64D4D`, 11px, round badge).
3. New `src/components/ErrorPanel.tsx` exporting `ErrorPanelHost`:
   - Listens for the `erp:form-error` CustomEvent (detail = the toast message). After two animation frames (so `setErr` has rendered) it collects `document.querySelectorAll('[data-field-error]')`.
   - None found: call `enqueueSnackbar(message, { variant: 'error' })` (unchanged behaviour for non-form errors such as "This charge is already invoiced").
   - One or more found: open a panel fixed on the right (`top: 72px; right: 16px; width: 360px; max-height: calc(100vh - 96px); z-index: 1400` so it sits above dialogs), white, `1px solid neutral[200]`, `8px` radius, same shadow as menus. Header: "Fix {n} field(s) to save" (`Text s3 medium`), the message below in `s5`, a close icon. Body: one row per error, label in `s4 medium`, message in `s5` red, hover background `neutral[100]`.
   - Clicking a row: dispatch `erp:reveal-field` with the element, then after 80 ms `el.scrollIntoView({ behavior: 'smooth', block: 'center' })`, focus the first `input, textarea, [role="combobox"], button` inside it, and flash a 2px `#C64D4D` outline for 1.2 s.
   - A `MutationObserver` on `document.body` (subtree, childList, attributes `data-field-error`) re-collects; it dispatches `erp:errors-changed`; when nothing is left the panel closes. It also closes on route change (`useLocation`).
4. `src/components/Dialogs.tsx`, `useToast`: for `variant === 'error'` dispatch `window.dispatchEvent(new CustomEvent('erp:form-error', { detail: msg }))` instead of calling `enqueueSnackbar`; other variants unchanged.
5. Mount `<ErrorPanelHost />` once in `src/App.tsx`, inside `<Suspense>` next to `<Routes>` (it is inside the router and inside `SnackbarProvider` from `src/main.tsx`).
6. Replace the ad-hoc red error texts with `FieldError` in the forms this spec touches: `CrossHireOrderPages.tsx:139` (`label="Items"`), `DeliveryPages.tsx:155` (Items), `:171` (Rental Start), `:188` (Customer Signature), `ReturnPages.tsx:196` (Pre-Return Site Checklist), `:202` (Items). Other forms keep working because their `FieldShell` errors are picked up automatically.

**Check.** Cross-Hire > Orders > Add New, press Submit empty: the panel lists Supplier, Confirmation Date, ..., Items, and the Address & Contact fields; the Address & Contact tab label shows a red count; clicking "Contact Person" switches to that tab and focuses the field; filling every field closes the panel. An error toast that is not about fields (e.g. Charges > Raise Invoice twice) still shows as a toast. Check one dialog form (Expense Entry on a Cross-Hire order) and one long page (Sales Order view) for layout regressions caused by keeping tabs mounted.

### F2. Category and Subcategory as two columns on every Cross-Hire and rental screen

**Ajin (10:40 to 11:02):** "Currently we have combined category and subcategory and display. Don't do that ... we are doing one format in sales order and another format in cross-hire, and again we want to train it to the people."

**Today.** Combined `${group} ${category}` strings in display tables and fields:

| File:line | Screen | Change to |
|---|---|---|
| `src/modules/rental/CrossHirePages.tsx:40` | Cross Hire Requests list, column "Category + Subcategory" | Two columns Category, Subcategory (each the unique values of the request items joined with ", ") |
| `CrossHirePages.tsx:161` | Process Cross Hire, column Item | Category, Subcategory |
| `CrossHirePages.tsx:257` | Cross-Hire Order view, field Items | Two `ValueField`s: Category, Subcategory (unique values joined), plus keep "Units" |
| `CrossHirePages.tsx:275` | Order view, Item Entries tab, column Item | Category, Subcategory |
| `CrossHirePages.tsx:286` | Order view, Units tab, column Received as | Category, Subcategory |
| `src/modules/rental/CrossHireOrderPages.tsx:243` | Goods Receipt form, Items, column Item | Category, Subcategory |
| `CrossHireOrderPages.tsx:403` | Goods Receipt view, Items, column Item | Category, Subcategory ("Not on the order" goes in Category, "-" in Subcategory) |
| `CrossHireOrderPages.tsx:309` | Track Details dialog title | `Track Details: Category {group}, Subcategory {category}` |
| `src/modules/rental/CrossHireRfqPages.tsx:90, :308, :341` | RFQ items, responses, comparison, column Item | Category, Subcategory |
| `src/modules/crm/SalesOrderPages.tsx:217` | Sales Order, Cross Hire tab, Requests, column Category | Category, Subcategory |
| `SalesOrderPages.tsx:197-202` | Sales Order, Traceability tab, Requested / Delivered | Category, Requested Subcategory, Delivered Subcategory (keep Differs) |
| `src/modules/crm/ReturnPages.tsx:169, :212, :313` | Customer Return form (locked and editable tables) and view, column Item | Category, Subcategory |

Leave alone: dropdown option labels (e.g. `CrossHirePages.tsx:89`), log texts, invoice and bill line item names, report rows, the Track Details category chip (`CrossHireOrderPages.tsx:344`, a compact selector inside a row).

Mark each new column `change="changed" req={R8('Category and Subcategory shown separately, as on the Sales Order')}`.

**Check.** Open a Cross-Hire request, order, Goods Receipt, RFQ and a customer return: no column or field shows "Generator 500 KVA" as one value.

### F3. Cross-Hire order and Goods Receipt carry the Sales Order context, including Project

**Ajin (8:47 to 9:11):** "In the sales order we already have a start date and end date ... I just need to [select] the supplier, because the [Rental Order] ID, activity type, [cost centre], everything is carried forward." **(11:22 to 12:36):** "We need project because in the sales order we are assigning the project. There is a chance the supplier will directly deliver this material to the site itself ... we need to arrange the project also."

**Today.** `orderSpecs` (`CrossHireOrderPages.tsx:32-48`) has Rental Order ID (optional), Supplier, Cross Hire Type, dates, currency, but no Project, Activity Type, Customer or Site. `grnSpecs` (`:174-181`) has no Rental Order or Project. Supplier is prefilled from an RFQ award or the request's vendor (`:95`). Rental period is prefilled from the RFQ or the first request line (`:95`), not from the order header when there is no line.

**Change.**
1. `orderSpecs`: right after `soId` add read-only specs, each `change: 'new', req: R8('Sales Order context carried to the Cross-Hire order')`:
   - `project`, label "Project (Cost Centre)", value = selected order's `costCentre`, hint "Fetched from the Sales Order".
   - `activity`, label "Activity Type", value `'Rental'` when an order is selected, else "-".
   - `customer`, label "Customer", value `custName(so.customerId)`.
   - `site`, label "Delivery Site", value `so.site`, `show: (f) => f.type === 'Dropship'`, hint "Dropship: the supplier delivers straight to this site".
   Compute these from `orders.get(f.soId)` in the `view` object passed to `SpecForm` (same technique as `DeliveryPages.tsx:115`).
2. Prefill: `startDate` and `endDate` fall back to `so0.contractStart` / `so0.contractEnd` when there is no line or RFQ date. Supplier prefill unchanged (D1).
3. Save: `createChOrderFromForm` (`src/modules/crm/flow.ts:399`) and the edit path (`CrossHireOrderPages.tsx:119`) store `project: so?.costCentre, customerId: so?.customerId, site: so?.site` on the `CrossHire` record.
4. Order view (`CrossHirePages.tsx:255-262`): add `ValueField`s Project, Customer (and Delivery Site for Dropship) after "Rental Order (demand)". Orders list (`:191-198`): add a Project column after "Rental Order(s)".
5. Goods Receipt form and view (`grnSpecs`): add read-only "Rental Order" (`c.soNumber || 'Not tied to an order'`) and "Project" (`c.project ?? orders.get(c.soId)?.costCentre ?? '-'`) after Vendor.
6. Cross Hire Request view (`CrossHirePages.tsx:113-116`): add `ValueField` Project from the order.

**Check.** From a rental Sales Order line: Cross Hire, Save, Submit, Create > Order. Only Supplier (when the request had none), rate and the Address tab need input; Project, Activity Type, Customer, rental period are already there. After approval, Receive: the Goods Receipt shows Rental Order and Project.

### F4. Optional Brand and Model when tracing a hired asset

**Ajin (13:16 to 14:14):** "Asset ID, okay, it's fine. But I need to mention which is the brand ... just like we have in the heavy equipment form ... I hired a 100 KVA generator from one supplier ... I need the brand, I need the model to understand that. Don't make it mandatory, but give us this option."

**Today.** Track Details rows hold serial, Category, condition, photo, remarks (`CrossHireOrderPages.tsx:259-365`). `validateGrn` (`flow.ts:433-449`) builds the asset from template `he27`, so the template's own brand and model leak into every cross-hired asset.

**Change.**
1. Track Details row (`CrossHireOrderPages.tsx:341-354`): after the category chip add two `TextField size="small" variant="standard"` inputs, placeholders "Brand (optional)" and "Model (optional)", width 120 each; read-only text when `done`. Mark the dialog's help text with the new fields.
2. `validateGrn`: set `brand: t.brand ?? ''`, `model: t.model ?? ''` (always override the template), and `name: \`${t.brand ? \`${t.brand}${t.model ? ` ${t.model}` : ''} \` : 'Diesel '}${t.group} ${t.category} ${ch.supplier.split(' ')[0]} Cross-Hire\``.
3. Validate preview text (`CrossHireOrderPages.tsx:418`): include brand and model when present.
4. Cross-Hire order view, Units tab (`CrossHirePages.tsx:284-289`): add Brand and Model columns.

**Check.** Receive two units, give one a brand and model, leave the other blank, Validate. The asset page of the first shows them; the second shows blank brand and model (not the template's).

### F5. Cross-Hire Bill from the Sales Order (manual, per period)

**Ajin (39:48 to 45:15):** "Similarly my supplier will give me the bill against this cross-hire ... monthly billing, weekly billing, or last bill ... I am not mentioning to automate, I need to have a provision ... from the sales order, if I do any cross-hire against that particular sales order there should be an action, Cross-Hire Bill. If I'm clicking it, only the assets which I have cross-hired, I can allocate there, and the supplier details can be added." Darshit: "You don't need to create a workflow ... just need that provision to enter the bill." Vivek (16:27): "the invoice will not generate periodically. They will give us and we will enter the bill."

**Today.** The Cross-Hire order view has a "Bill" button only while the order has **no** bill (`CrossHirePages.tsx:245`, `!myBills.length`); it opens the Accounting bill form prefilled with one period at the agreed rate (`src/modules/accounting/BillPages.tsx:122-126`) and `linkCrossHireBill` marks the order Fully Billed (`flow.ts:171-174`). No action exists on the Sales Order. There is no billing period on a cross-hire bill.

**Change.**
1. Engine, `src/modules/accounting/engine.ts` (next to `billFromCrossHire`, line 355): add
   ```ts
   export function billCrossHirePeriod(ch: CrossHireLike, i: { soId: string; soNumber: string; supplierInvoiceNo: string; supplierInvoiceDate: string; from: string; to: string; final: boolean;
     lines: { assetId?: string; group: string; category: string; days: number; rate: number; amount: number }[]; expenses: { account: string; amount: number; note: string }[] }): Bill
   ```
   One `createBill` (Pending, D4) with `orderRef: ch.number`, `activity: 'Rental'`, `costCentre` from the Sales Order, one line per row: `item: \`Cross-hire ${group} ${category}\``, `desc: \`${ch.number} for ${soNumber}${assetId ? `, ${assetLabel}` : ''}, ${from} to ${to} (${days} days)\``, `account: '510100'`, `qty: 1, unit: 'Period', rate: amount`, `periodFrom: from, periodTo: to, days, assetId, tag: 'cross-hire'`; expenses as in `billFromCrossHire`; `narration: \`Cross-hire ${final ? 'final' : 'periodic'} bill, ${ch.number}, ${from} to ${to}\``; `source: { type: 'Cross Hire', id: ch.id, number: ch.number, soId: i.soId }`.
2. Flow, `src/modules/crm/flow.ts`: add `billCrossHireFromOrder(...)` that calls it, then patches the Cross-Hire order: `supplierInvoice`, `billing: final ? 'Fully Billed' : 'Partially Billed'`, `status` as `linkCrossHireBill` does today, history entry with the period; and adds a Sales Order log line "Cross-hire bill BILL-... for CH-..., {from} to {to}, pending approval".
3. New page `SalesOrderCrossHireBill` in `src/modules/crm/SalesOrderPages.tsx`, route `sales-orders/:id/cross-hire-bill` in `src/modules/crm/index.tsx:49`. Layout: `FormHeader` crumbs Sales Orders > {number} > Cross-Hire Bill, actions Discard / Save. Body (`Section`s with `SpecForm`):
   - **Bill details:** Sales Order (read-only), Project (read-only), Cross Hire Order (select, required: orders of this Sales Order, i.e. `soId === so.id` or any unit with `soId === so.id`, status Approved / Received / Billed / Shipped / Closed, and `billing !== 'Fully Billed'`; label `{number} - {supplier}`; preselect `?ch=`), Supplier (read-only from the order), Supplier Invoice Number (required), Supplier Invoice Date (required, default today), Bill Type (select Periodic / Final, required, hint "Final marks the order Fully Billed"), Billing Period From and To (required; From defaults to the day after the latest `periodTo` of this order's existing bills, else the order `startDate`; To defaults to From plus one Rental Duration Type period minus one day, capped at today).
   - **Cross-hired assets:** a `DataTable` with `selectable` (all selected by default): one row per unit of the chosen order with `soId === so.id` (Dropship orders: one row per item with its units). Columns: Asset ID, Category, Subcategory, Brand, Model, Agreed Rate (per {duration}), Days (editable number, default `To - From + 1`), Amount (editable, default `rate x days / basis`, basis 30 Monthly, 7 Weekly, 1 Daily, read from `c.form?.duration ?? 'Monthly'`). Total below.
   - **Expenses:** check "Add this order's expenses ({aed}) to this bill", default ticked only when no bill exists yet for the order.
   - Hint on the page: "Enter the supplier's bill when it arrives. There is no schedule and nothing is raised automatically."
   - Validation through `setErr` + error toast (F1). Save calls the flow, toasts "{BILL number} created, pending approval", navigates to the bill.
4. Sales Order view: in the `Create` menu (`SalesOrderPages.tsx:300-306`) add `{ label: 'Cross-Hire Bill', disabled: !hasCrossHire, onClick: () => nav(\`/crm/sales-orders/${so.id}/cross-hire-bill\`) }`, shown only when `isRental`. In the Cross Hire tab (`OrderCrossHire`, `:208-225`) add a third table "Supplier bills": Bill, Cross Hire Order, Period (`periodFrom` to `periodTo` of its first line), Supplier Invoice, Total (incl. VAT), Status, Payment; row click opens the bill.
5. Cross-Hire order view: the "Bill" button shows while `c.billing !== 'Fully Billed'`; when `c.soId` is set it opens `/crm/sales-orders/{soId}/cross-hire-bill?ch={id}`, otherwise the Accounting bill form as today. Billing Status (view `:225` and list `:184`) reads `c.billing ?? 'Pending Billing'` instead of "any bill exists". Bills tab (`:293`) adds a Period column.
6. Accounting `BillPages.tsx`: unchanged (still usable for orders without a Sales Order).

**Check.** On a Sales Order with a received and delivered cross-hired unit: Create > Cross-Hire Bill, choose the order, a one-month period, Periodic, Save. A Pending bill exists with the period; the order shows Partially Billed. Repeat for the next month with Final: the order shows Fully Billed and the Create menu entry no longer lists that order.

### F6. Return to Supplier and Re-Issue from the Sales Order

**Ajin (39:28 to 40:00):** "I returned that in my inventory ... I need to return that material ... It should not be like here [the Cross-Hire order], it should be from the sales order, or from our asset ... if it is a cross-hire, directly we need to return that item from there so we can easily identify."

**Today.** Return to Supplier and Re-Issue exist on the Cross-Hire order's Units tab (`CrossHirePages.tsx:279-283`, dialogs `:308-314`) and on the asset page (`src/modules/inventory/HeavyEquipmentPages.tsx:383-400`). Nothing on the Sales Order.

**Change.**
1. Move the two dialogs out of `ChOrderView` into exported components in `CrossHirePages.tsx`: `ReturnToSupplierDialog({ ch, assetId, open, onClose })` and `ReissueDialog({ ch, assetId, open, onClose })`, same fields and texts as today. `ChOrderView` uses them (no behaviour change there).
2. Sales Order view, Cross Hire tab: add a first table "Cross-hired units on this order": every unit of every Cross-Hire order with `u.soId === so.id`. Columns: Asset ID, Category, Subcategory, Brand, Model, Supplier, Cross Hire Order, Lifecycle Stage (`StatusChip`), Asset Status. Row actions (`actions` prop): "Return to Supplier" and "Re-Issue to another project", both `hidden` unless `u.stage === 3` (Returned to Us); "Open asset" always. Empty text: "No cross-hired unit has been delivered on this order".

**Check.** Return a cross-hired unit from the Sales Order (customer return, receive, validate). Back on the Sales Order, Cross Hire tab: the unit shows Returned to Us with Return to Supplier available; doing it closes the loop exactly as from the Cross-Hire order.

### F7. Delivery: Invoice Start Date and the "additional invoice?" question

**Darshit (30:57):** "When we deliver, there is a question: check the delivery date and invoicing date. If the invoice date is not equal to the delivery date, then there should be a question: do you want to raise an additional invoice? Yes or no. If no, just go ahead; if yes, you need to create an additional invoice against that." **Ajin (30:33):** "When I delivered today, maybe my invoicing will start by tomorrow week."

**Today.** `DeliveryPages.tsx:163-173` has "Rental Start Date (Invoice Start)", which may be later than the delivery date (assets go on Hold); a later start needs a reason and who is responsible, plus an optional "Lump sum for the waiting period". The lump sum is billed on the first rental invoice (`billing.ts:220-224`) and also added to the order's Charges (`flow.ts:273`).

**Change.**
1. Rename the label to "Invoice Start Date (Rental Start)" (same key `rentalStart`), `change: 'changed'`.
2. Replace the `waitingCharge` spec (shown when `late`) with, `change: 'new', req: R8('Additional invoice when invoice start differs from delivery')`:
   - `addInvoice`, type select `['Yes', 'No']`, required, label: "Invoice starts {n} day(s) after delivery. Raise an additional invoice for those days?" (`n` = days from the delivery date to the Invoice Start Date).
   - `addAmount`, number, required when Yes, label "Additional invoice amount (AED)", default when Yes is picked = sum over the rental lines being delivered of units x day rate x n (D2), hint shows the arithmetic and `TO_CONFIRM`.
   - `addNote`, text, optional, label "Narration".
3. Save: pass `additional: { from: deliveryDate, to: invoiceStart - 1 day, days: n, amount, note }` only when Yes; never pass `waitingCharge` for new deliveries.
4. Engine, `engine.ts`: add `invoiceAdditionalCharge(soId, i: { kind: 'Delivery' | 'Return'; docId: string; docNumber: string } & AdditionalCharge): SalesInvoice`: one Pending `createInvoice` with `headerFromOrder(o)`, one line `item: kind === 'Delivery' ? 'Additional charge, before invoice start' : 'Additional charge, after invoice end'`, `desc: \`${docNumber}: ${from} to ${to} (${days} day(s))${note ? `, ${note}` : ''}\``, `account: '410500'`, `qty: 1, unit: 'Lump sum', rate: amount`, `vatPct: vatPctOf(o.vatType)`, `activity: 'Rental'`, `costCentre: o.costCentre`, `periodFrom: from, periodTo: to, tag: 'additional'`; `source: { type: 'Sales Order', id: o.id, number: o.number, soId: o.id }`. Add `'additional'` to `LineTag`.
5. Flow, `createDelivery`: when `i.additional` is set, after saving the delivery call `invoiceAdditionalCharge`, store `additional` and `additionalInvoiceId` on the delivery, log on the Sales Order "Additional invoice INV-... raised for {n} day(s) before invoice start, pending approval". The success toast mentions it.
6. Delivery view: show "Additional Invoice" (link to the invoice) and its period when present.
7. Legacy: deliveries that already carry `waitingCharge` keep today's behaviour.

**Check.** Deliver with Invoice Start 5 days after the delivery date, answer Yes with the default amount: a Pending invoice for 5 days exists, the Sales Order Invoices tab lists it, the assets are on Hold until the start date. Answer No: no invoice. Same dates: the question is not shown.

### F8. Return: Invoice End Date (Off-Hire) and the same question

**Darshit (31:40):** "Similarly in the return you need to mention it." **Ajin (31:47):** "When to stop that one, because off-hiring needs to happen based on that." **Ajin (30:43):** "My [collection] I am taking today, but off-hiring may happen on Monday."

**Today.** One field, "Return Entry Timestamp (Off-Hire)" (`ReturnPages.tsx:134`), both records the return and stops billing: `applyOffHire` sets `stop: r.timestamp.slice(0, 10)` (`flow.ts:571`); billing runs to the day before `stop` (`billing.ts:184`).

**Change.**
1. Form (`ReturnPages.tsx:132-136`): relabel `timestamp` to "Return Date & Time" with hint "When the asset is physically returned or collected". Add `offHireDate`, type date, required, label "Invoice End Date (Off-Hire)", default = the return date, editable earlier or later, hint "Rental is billed up to the day before this date, the same rule as today. Defaults to the return date". Both `change: 'new', req: R8('Invoice end date on return')`, disabled when `locked`.
2. When `offHireDate` is **before** the return date (D3): show `addInvoice` Yes/No "Raise an additional invoice for the {n} day(s) between the Invoice End Date and the return date?", `addAmount` (default from the returned assets' lines, D2), `addNote`, as in F7, with `TO_CONFIRM`. When it is **after**: show an info `Alert` "Billing continues until {offHireDate}".
3. Flow: `ReturnInput` and `createReturn` carry `offHireDate` and `additional`; `applyOffHire` uses `stop: r.offHireDate ?? r.timestamp.slice(0, 10)` and the log reads "Billing stops at {that date}". When `additional` is set call `invoiceAdditionalCharge(kind 'Return')` and store `additionalInvoiceId`.
4. Return view: show Return Date & Time, Invoice End Date and the additional invoice link.

**Check.** Return with Invoice End Date 3 days after the return date: the Asset Ledger "Billing Stopped" shows that date and the next rental run bills up to the day before. Return with it 2 days before: the question appears; Yes raises a Pending invoice for 2 days.

### F9. Attachments per returned item

**Ajin (28:00):** "Per item we can give attachment, and at the bottom also we can give attachment."

**Today.** Header "Attachment" section and the mandatory "Return Photo Attachments" exist (`ReturnPages.tsx:198, :232`); item rows have only Narration.

**Change.** Editable items table (`ReturnPages.tsx:207-225`): add a column "Attachments" before Narration with an icon button (`AttachFileOutlined`, `component="label"`, hidden `<input type="file" multiple>`) that stores file names in `row.files`, showing the count as a small chip with the names in a `Tooltip`. Locked table and view (`itemCols`, `:168-176` and `:313`): column "Attachments" with the names or "-". `ReturnItem.files` is saved by `createReturn` / `saveReturn`. `change: 'new', req: R8('Attachment per returned item')`.

**Check.** Add a return with a photo on one item: the view shows it on that row; the header attachment and Return Photo Attachments still work.

### F10. Returned owned assets always go to maintenance; cross-hired assets do not

**Ajin (33:20):** "Always it will ... once it comes, maybe cleaning, washing ... it will directly go for the maintenance itself. In maintenance there are some checklists, something like maintenance or critical maintenance, so they will understand it will take a long time." **Vivek (34:04):** "Cross-hire, we don't need to check that one, they will take care. But for our asset, it should be like that."

**Today.** `validateReturnGrn` (`flow.ts:605-634`): Passed sends the asset to Ready for Hire (owned and cross-hired); Damage Found sends it to Under Maintenance with a workshop movement and a damage charge. "Mark Ready for Hire" on the asset view (`HeavyEquipmentPages.tsx:433, :456`) is one click from Under Maintenance.

**Change.**
1. `validateReturnGrn`, per item:
   - **Owned** (`ownership !== 'Cross-Hired'`): Passed: `assetStatus: 'Under Maintenance', maintenanceType: 'Routine', maintenanceRef: r.number`, movement type "Sent for Maintenance" from the yard to `${it.yard} (maintenance bay)`, outcome "Routine Maintenance". Damage Found: as today plus `maintenanceType: 'Critical'`, outcome "Critical Maintenance".
   - **Cross-hired**: Passed or Damage Found: `assetStatus: 'Yard', crossHireIdle: true`, outcome "Awaiting Return to Supplier"; condition noted on the unit (as today); the damage charge to the client still applies (D9). No maintenance.
2. Update texts in `ReturnPages.tsx` that promise "Ready for Hire" after inspection (search the file for `Ready for Hire`) to "Routine Maintenance (owned) / Return to Supplier (cross-hired)".
3. Asset view (`HeavyEquipmentPages.tsx`): when `assetStatus === 'Under Maintenance'` the button reads "Complete Maintenance" and opens an `AppDialog`: Maintenance Type (read-only, from `maintenanceType`, default Critical), the checklist from master `maintenanceRoutine` or `maintenanceCritical` as `CheckInput`s, Technician (select of employees, optional), Completed On (date, default today), Notes (required when a check is not ticked). Confirm calls `setStatus('Ready for Hire', 'Maintenance completed ({type}): {n} of {m} checks')` and clears `maintenanceType`. Other statuses in `READY_FROM` keep the one-click "Mark Ready for Hire". Show "Maintenance Type" next to Asset Status when under maintenance.
4. Change Status dialog on the asset view: when the target is Under Maintenance, add a required "Maintenance Type" select (Routine / Critical).
5. `replaceAsset` (`flow.ts:507`): the old asset gets `maintenanceType: reason === 'Breakdown' ? 'Critical' : 'Routine'`.

**Check.** Return an owned unit that passes inspection: it is Under Maintenance (Routine), not Ready for Hire; Complete Maintenance with all checks makes it Ready for Hire. Return a cross-hired unit: it is at the yard, idle, and Return to Supplier is offered (F6).

### F11. Asset statuses Off Hire - In Transit and Yard Inspection

**Ajin (53:24 to 54:42):** "When it is deployed, change it to on hire ... it is not come to the yard, but it is off-hire, off-hire in transit ... while in the yard inspection, mention that it is under yard inspection ... sales department needs to see which is available ... this will be the status on the heavy equipment asset listing."

**Today.** `ASSET_STATUSES` (`src/mock-data/masters.ts:12`): Ready for Hire, On Hire, Off Hire, Breakdown, Under Maintenance, Disposed, Yard, Hold, In Service. Return entry sets Off Hire (`flow.ts:569`); validation sets Yard then the outcome (`flow.ts:612`).

**Change.**
1. `masters.ts:12`: insert `'Off Hire - In Transit'` after `'Off Hire'` and `'Yard Inspection'` after `'Yard'`. Update the comment above it ("8 Oct call"). `StatusChip` already colours both amber ("off hire", "yard"), no change there.
2. `applyOffHire` (`flow.ts:569`): set `'Off Hire - In Transit'` (owned and cross-hired), audit "On Hire to Off Hire - In Transit ({number}). Rental invoicing stops {date}".
3. `createReturnGrn` (`flow.ts:594-601`): for each asset set `'Yard Inspection'` and write the "Return" movement (client to yard, `reachedYard` time) here.
4. `validateReturnGrn`: drop the intermediate `patchAsset(..., { assetStatus: 'Yard' })` and its movement (moved to step 3); go straight to the F10 outcome.
5. Dashboards: `src/modules/inventory/reports.tsx:88-89` add a group "Returning" (Off Hire - In Transit, Yard Inspection) to `STATUS_GROUPS` and `groupOf`, so these assets are no longer counted as Available. `src/modules/crm/reports.tsx:125` heat map columns: add the two statuses.
6. The Items list and asset view already show `assetStatus`; nothing else to do there.

**Check.** Save a customer return: the asset shows Off Hire - In Transit on the Items list. Receive (Goods Receipt): Yard Inspection. Validate: Under Maintenance (owned) or Yard idle (cross-hired). The Fleet Status Dashboard counts it under Returning.

### F12. Replacement: only from the Sales Order, Category and Subcategory choice, its own Delivery Order

**Ajin (57:35 to 58:47):** "I need to add replacement from the sales order. Always do it from the sales order ... I need to choose the category, I need to choose the subcategory, because at the time of replacement maybe I don't have 200 KVA, I have 250 KVA ... If it is on fleet I need to select a fleet ... our delivery order selection is missing here." Darshit (47:00): "This is traceable ... choose another serial number, and this serial number needs to be allocated as maintenance."

**Today.** Replacement can start from the Sales Order (line menu `SalesOrderPages.tsx:277`, Create menu `:305`) but also from Rental > Replacement Orders "Add Replacement" (`src/modules/rental/RentalPages.tsx:28`) with a free Rental Order select (`:72`). The replacement asset is limited to the line's exact Category and Subcategory (`:51`, "Same-category check"). Transport with the Own Fleet vehicle picker exists (`:92-94`). The new unit reuses the original Delivery Order id (`flow.ts:512`); no Delivery Order is created.

**Change.**
1. `ReplacementList`: remove `onAdd` / `addLabel`; subtitle "Started from the Sales Order: line menu Replace asset, or Create > Replacement". Add a column "Delivery Order" (`deliveryId` number, link).
2. `ReplacementForm`: without `?so=` render a `Page` with an info `Alert` "Replacements are started from the Sales Order" and a button to the Sales Orders list. With `?so=`, the Rental Order select is `disabled`.
3. Replace the "Same-category check" section with "Replacement unit" (`change: 'changed', req: R8('Replacement: choose Category and Subcategory')`): Category (select, `groupOptions()`, prefilled `pick.l.group`), Subcategory (select, `categoryOptions(group)`, prefilled `pick.l.category`), Replacement Asset (Ready for Hire units of the chosen Category and Subcategory, owned and cross-hired, cross-hired suffixed). When either differs from the line, an amber `Alert` like `DeliveryPages.tsx:249`. Keep the "Raise Cross-Hire" fallback.
4. New section "Delivery Order" (`change: 'new'`): Delivery Date & Time (datetime, default now), Delivery Status (select from `DELIVERY_STATUSES`, default Dispatched), Reference Number, hint "A Delivery Order is created for the replacement unit". Transport section stays as is.
5. `replaceAsset` (`flow.ts:498-518`): accept `group`, `category`, `delivery: { date, status, reference }`. Create a `Delivery` record (`nextNumber('DO', 160)`, `operationType: 'Replacement'`, `type: 'Partial'`, `items: [{ lineId, qty: 1, assetIds: [newId], deliveredSub: category }]`, `rentalStart: TODAY`, `project: o.costCentre`, transport fields from the transport input, `replacementId: rec.id`, `closed: false`). The new assignment uses this delivery's id. Store `deliveryId`, `group`, `category` on the Replacement. When the delivered Subcategory differs from the line, add the same "Allocation differs from the request" log as `flow.ts:263`. Old asset: Under Maintenance with `maintenanceType` (F10).
6. The trip is still created (kind Replacement); link it to the new Delivery Order (`doc: { id: d.id, number: d.number }`) so the Delivery view shows it.

**Check.** From a Sales Order line with a 200 KVA unit out: Replace asset, choose Subcategory 250 KVA, pick a unit, Own Fleet vehicle, Save. A new Delivery Order exists for the 250 KVA unit, the line shows the new asset On Hire with "Allocation differs" in the log, the old unit is Under Maintenance. Rental > Replacement Orders has no Add button.

### F13. Extension as a revision of the same Sales Order; dashboards click through

**Ajin (1:03:21 to 1:06:30):** "If I'm clicking this particular dashboard it will redirect me to the sales order, and from there give an option to extend ... the rate will be same, or rate will be increased ... I can amend it, because that is also the same sales order. Extension will not be separate." "Same like revisions, you can show the same exact information of the sales order ... just change the date. If the rental rate they want to negotiate, they will change it there and save it ... We will have the previous rental order and the current rental order." Then: "Already I returned three generators and only one generator is running and the customer is asking for extension. So in that extension, only one generator should [be extended]" (transcript cut off).

**Today.** "Extend / Terminate" opens `ExpiryDialog` (`src/modules/crm/ActionDialogs.tsx:15-45`): client decision, confirmed by, new end date, note. `applyExtension` (`flow.ts:522-537`) changes `contractEnd`, the LPO expiry and every periodic line whose end equals the old end, in place, with a log line. No rate change, no saved previous version, `lineId` is ignored. The Renewal & Overdue dashboard and Renewals page exist with a 14-day notice (`EXPIRY_NOTICE_DAYS`, `src/modules/crm/data.ts:99`).

**Change.**
1. New page `SalesOrderExtend` in `SalesOrderPages.tsx`, route `sales-orders/:id/extend`. Layout: `FormHeader` crumbs Sales Orders > {number} > Extend, actions Discard / Save Revision. Info `Alert`: "Extension revises this Sales Order (Revision {n+1}). The current version is kept under Revisions." Then the read-only `CommercialTabs kind="order" locked` exactly as on the view, with the items area replaced by an **Extension** grid (`change: 'new', req: R8('Extension as a revision of the Sales Order')`): one row per Rental line and per Recurring Service line. Columns: Item, Category, Subcategory, Units out (e.g. "1 of 4 still out", from `outstanding(l)`), Current End, New End (date input; required for lines with units out; disabled with text "Not extended, nothing on hire" otherwise), Current Rate, New Rate (number, default current), Frequency. Below: New Contract End (read-only, latest New End), Client confirmed by (required), New LPO Number and LPO Expiry (optional), Note (required when any rate changes). Hint on New Rate: "Applies to every rental period not invoiced yet" + `TO_CONFIRM` (D4).
2. Flow: replace the Extension branch of `applyExtension` with `extendOrder({ soId, lines: { lineId, newEnd, newPrice }[], lpo?, lpoExpiry?, confirmedBy, note })`: push an `OrderRevision` snapshot of the current header and lines to `revisions`, increment `revision`, apply the new ends and prices, set `contractEnd` to the latest new end, `lpoExpiry` as today's rule (or the new LPO expiry), keep an `Extension` record (with `revision` and a `changes` summary) for Rental > Renewals and Expiry, log "Revision {n}: extended to {date}{, rate changes ...}". Early Termination keeps the existing path.
3. Sales Order view: the crumb shows `{number} (Rev {n})` when `revision > 0`. Header: replace "Extend / Terminate" with "Extend" (navigates to the extend page); add "Early Termination" to the Actions menu (opens `ExpiryDialog` preset to Early Termination) (D5). The LPO alert's Extend button (`:312`) goes to the extend page. New tab "Revisions" (`change: 'new'`, hidden when there is none): Revision, Date, By, Contract End, Note; row click opens an `AppDialog` showing that revision's lines (Item, End, Rate) next to the current values, differences in bold.
4. `ExpiryDialog`: choosing "Extend the existing Sales Order" and confirming navigates to the extend page instead of changing the date inline.
5. Rental > Renewals and Expiry (`RentalPages.tsx:115-130`): rows get `onRowClick` to the Sales Order. CRM Renewal & Overdue dashboard (`src/modules/crm/reports.tsx:126`): if its table widget cannot link rows, replace it with a `custom` widget holding a `DataTable` with `onRowClick` to the Sales Order.

**Check.** On an order with 4 units of which 3 are returned: Extend, the line shows "1 of 4 still out"; set a new end and a higher rate, Save. The order shows Rev 1, the Revisions tab shows Revision 0 with the old end and rate, the next rental run bills the remaining unit only, at the new rate. From the Renewal & Overdue dashboard, clicking a row opens the order.

### F14. Asset Dashboard: where every asset is now; certificate reminders

**Ajin (37:00):** "In the Asset Dashboard ... what is my category, subcategory, asset name, which is the current company which is [using it], what is the status." **(54:58 to 55:21):** "Even a report is fine. But if it is in the dashboard it always comes in front ... there are a lot of chances they won't renew."

**Today.** Fleet Status Dashboard (`src/modules/inventory/reports.tsx:102-112`): KPIs, donut, heat map, links; no per-asset list and no customer. The current customer is only visible inside each asset's Movement History. Certificates: per-asset tab, Certificate Expiry Report (`reports.tsx:76`), seeded notifications; no dashboard widget.

**Change.**
1. Helper in `src/modules/crm/data.ts`: `holderOf(assetId: string): { customer: string; project: string; soId: string; soNumber: string; since: string } | undefined`, scanning `getCollection<SalesOrder>(COL.orders)` lines for an assignment of that asset with state On Hire or Hold.
2. Fleet Status Dashboard: add a `custom` widget, `span: 2`, title "Assets: where they are now", `change: 'new', req: R8('Asset Dashboard: category, subcategory, asset, current customer, status')`, holding a `DataTable` (search, `filter={{ key: 'status', options: ASSET_STATUSES }}`, `pageSize={10}`, row click to `/inventory/items/heavy/{id}`). Columns: Category, Subcategory, Asset ID, Asset Name, Ownership, Status (`StatusChip`), Current Customer, Project, Sales Order (link), Current Location. Rows: live fleet without delivery vehicles.
3. Same dashboard: KPI "Certificates due or expired" and a `custom` widget "Certificate reminders": `DataTable` of certificates with `certStatus(c)` (`src/modules/inventory/AssetPages.tsx:36-40`) Due Soon or Expired, sorted by expiry, columns Asset, Certificate, Expiry, Days left, Status; a button "Open Certificate Expiry Report". `req: R8('Certificate expiry reminder on the dashboard')`.

**Check.** The dashboard lists every hire asset with its customer and project when on hire, filters by status, and clicking a row opens the asset. The certificate widget lists the same due and expired certificates as the report.

### F15. Rental invoicing defaults to Automatic

**Ajin (22:xx):** "But this will be automated, right?" **Vivek (23:00):** "Whatever configuration is set in the billing cycle, but by default make it automatic."

**Today.** Billing cycle seeds bc1, bc2, bc3, bc5 are Manual (`src/modules/crm/data.ts:49-53`); a new cycle defaults to Manual (`src/modules/rental/BillingCyclePages.tsx:33`); a new Sales Order gets Manual (`flow.ts:124`, `SalesOrderPages.tsx:69`).

**Change.** Set `invoicingType: 'Automatic'` on bc1, bc2, bc3, bc5; default `'Automatic'` in `asForm`; `orderFromQuotation` and `soForm` default to `'Automatic'`. **Do not** change seeded orders (they carry an explicit 'Manual', and `processAutomatic()` runs once on app load in `src/App.tsx:17-21`, so flipping them would raise invoices at start-up). Manual stays selectable on the cycle and the order.

**Check.** A new Sales Order from a quotation shows Invoicing Type Automatic; existing demo orders are unchanged; the app opens without new invoices.

### F16. Per-line summary of what is out, returned and still to deliver

**Ajin (59:07, 1:00:03):** "If I'm going in the sales order, to view the assets delivered to that particular sales order ... what all the assets I allocated, what is returned, what is pending."

**Today.** The detail exists in the Traceability, Asset Ledger and Deliveries tabs; the items grid's Status column shows only a chip (`SalesOrderPages.tsx:258-264`).

**Change.** For Rental lines, under the chip render `Text s5`: "{out} out, {returned} returned, {pending} to deliver" (`out` = `outstanding(l).length`, `returned` = assignments with state Returned, `pending` = `l.qty - deliveredQty(l)`). `change: 'changed', req: R8('Sales Order shows allocated, returned and pending')` on the column.

**Check.** An order with 4 units, 3 returned, 1 out shows "1 out, 3 returned, 0 to deliver".

### V. Verified as already built (no code change; mention in the reply to Ajin)

| # | Point | Where |
|---|---|---|
| V1 | Service lines on a Rental order: no Delivery Order, no job card, invoiced with the rental run or Charge / Invoice | `DeliveryPages.tsx:28` (service lines are never deliverable), `flow.ts:134-142`, `SalesOrderPages.tsx:281-284` |
| V2 | Cross Hire Type Inventory / Dropship | `CrossHireOrderPages.tsx:38`, `flow.ts:419-420` |
| V3 | Cross-hired vs owned flag, shown when picking units at delivery | `inventory/data.ts` `OWNERSHIP`, `DeliveryPages.tsx:251` |
| V4 | Pre-Return Site and Yard Inspection checklists as user-maintained masters; partial returns from the same order | `crm/MasterPages.tsx:20-21`; `ReturnPages.tsx:95-118` |
| V5 | Deliver a different Subcategory than requested, logged | `DeliveryPages.tsx:235-257`, `flow.ts:263` |
| V6 | Requested vs delivered capacity tracked | `crm/data.ts:202`, report `required-vs-allocated` (`crm/reports.tsx:52`) |
| V7 | Overdue on-hire handling with fault attribution | `RentalPages.tsx:140-146` |
| V8 | RFQ optional, Create > Order straight from a request | `CrossHirePages.tsx:108` |

---

## 5. Files touched (overview)

| File | Items |
|---|---|
| `src/components/Form.tsx`, `Widgets.tsx`, `Dialogs.tsx`, new `ErrorPanel.tsx`, `src/App.tsx` | F1 |
| `src/mock-data/masters.ts` | F11 |
| `src/modules/crm/data.ts` | 3.3 types and masters, F14 `holderOf`, F15 seeds |
| `src/modules/crm/shared.tsx` | `R8` |
| `src/modules/crm/flow.ts` | F3, F4, F5, F7, F8, F10, F11, F12, F13, F15 |
| `src/modules/crm/SalesOrderPages.tsx`, `index.tsx` | F2, F5, F6, F13, F15, F16 |
| `src/modules/crm/DeliveryPages.tsx` | F1, F7 |
| `src/modules/crm/ReturnPages.tsx` | F1, F2, F8, F9, F10 |
| `src/modules/crm/ActionDialogs.tsx` | F13 |
| `src/modules/crm/MasterPages.tsx` | 3.3 masters |
| `src/modules/crm/reports.tsx` | F11, F13 |
| `src/modules/rental/CrossHirePages.tsx`, `CrossHireOrderPages.tsx`, `CrossHireRfqPages.tsx` | F1, F2, F3, F4, F5, F6 |
| `src/modules/rental/RentalPages.tsx`, `BillingCyclePages.tsx` | F12, F13, F15 |
| `src/modules/accounting/engine.ts`, `data.ts` | F5, F7 |
| `src/modules/inventory/HeavyEquipmentPages.tsx`, `reports.tsx`, `data.ts` | F10, F11, F14 |
| `src/modules/*/index.tsx` (`changes[]`), `CHANGELOG.md`, `Transcript.md` | Section 7, step 0.2 |

---

## 6. Phase plan

| Phase | Items | Checkpoint |
|---|---|---|
| 1. Foundations | Transcript appended; `R8`; section 3.3 types and masters; F11 status list; F1 error panel | `npx tsc --noEmit`; F1 check |
| 2. Cross-Hire | F2, F3, F4, F6, then F5 | tsc; F2 to F6 checks |
| 3. Delivery and Return | F7, F8, F9, F11 wiring (`applyOffHire`, `createReturnGrn`, `validateReturnGrn`), F10 | tsc; F7 to F11 checks |
| 4. Sales Order | F12, F13, F16, F15 | tsc; F12, F13, F15, F16 checks |
| 5. Dashboards | F14, F11 dashboard groups | tsc; F14 check |
| 6. Change Register and changelog | Section 7 | tsc |
| 7. End-to-end walkthrough | Section 8 | `npx vite build` |

---

## 7. Change Register and CHANGELOG

- One Change Register entry per item in the owning module's `changes[]` (CRM: F5, F6 on the Sales Order side, F7, F8, F9, F12, F13, F16; Rental: F2, F3, F4, F5 on the order side, F12 list, F13 renewals, F15; Inventory: F10, F11, F14). F1 goes in CRM with module "All modules" and screen "Form validation (global)". Classification EXISTING WITH CHANGE except F1 and F14 (NEW widgets on existing screens: EXISTING WITH CHANGE) and the extend and cross-hire bill pages (NEW). `ref`: "Client call 8 Oct (timestamp)".
- `CHANGELOG.md`: one entry per item at the top, newest first, in the existing style: `### 9 Oct, HH:MM: Title`, `**Where:** Module > Menu > Screen` (one line per screen), `**Type:** ...`, then *What Ajin asked.*, *What we did.*, *Be aware.* (defaults D1 to D10 that apply, the waiting-charge double-billing note under F7, the shared-file exception under F1 and F11).

---

## 8. End-to-end walkthrough (definition of done)

Run on a seeded Rental Sales Order with at least two rental lines (pick one in Sales Orders with Activity Type Rental and assets still to deliver):

1. Line menu Cross Hire, save the request with no vendor, Submit, Create > Order: Project, Customer, rental period are prefilled; press Submit with no supplier: the error panel lists Supplier and the Address & Contact fields; click each to fix (F1, F3).
2. Quick Approval, Receive, save the Goods Receipt: Rental Order and Project shown; Track Details: two serials, one with brand and model; Validate (F2, F4).
3. From the Sales Order, Deliver with Invoice Start 3 days later, answer Yes: Pending additional invoice; assets on Hold (F7, F16).
4. Create > Cross-Hire Bill for one month, Periodic (F5).
5. Return one owned and one cross-hired unit with Invoice End Date one day before the return date, Yes to the additional invoice, a photo on one item: assets Off Hire - In Transit (F8, F9, F11).
6. Receive the return: Yard Inspection. Validate: owned Under Maintenance (Routine), cross-hired at the yard idle (F10, F11).
7. Sales Order, Cross Hire tab: Return to Supplier on the cross-hired unit; Create > Cross-Hire Bill, Final (F5, F6).
8. Asset page of the owned unit: Complete Maintenance, Ready for Hire (F10).
9. Replace the remaining owned unit with a different Subcategory: new Delivery Order, old unit Under Maintenance (F12).
10. Extend the order with a new rate: Rev 1, Revisions tab (F13).
11. Inventory > Dashboards > Fleet Status: the units show with customer, project and status; certificate reminders listed (F14).
12. New quotation to order: Invoicing Type Automatic (F15).

---

## 9. Risks and gotchas

- Keeping all tabs mounted (F1) runs every tab's effects at once. `SalesOrderView` calls `releaseDueHolds` in an effect and many tabs read collections: check for duplicate side effects and for slow pages; if a tab is too heavy, it may opt out with a `lazy` flag on the tab, but then its errors are not listed.
- `useToast` callers keep calling `toast(msg, 'error')` exactly as today; only its body changes to dispatch the event. Error toasts fired from inside a dialog's `onConfirm` (e.g. `ActionDialogs.tsx`) also go through the panel, which sits above dialogs (`z-index: 1400`).
- `validateGrn` spreads template `he27`: always override `brand`, `model`, `image`, `attachments` (F4).
- Rate change on extension re-prices any unbilled past period too (D4). Make the hint visible.
- `costForSo` still uses the agreed rate, not the entered bills (F5). Profitability does not change with this spec; note it in the changelog.
- The Return GRN movement moves from validation to receipt (F11): check the asset Movement History does not show the Return movement twice for seeded returns (seeds were written with the old order of events).
- Seed dates are shifted to the demo day (`store.ts:21-37`); default dates in new forms must use `TODAY`, never literal dates.

---

## 10. Out of scope and open questions for Ajin

**Out of scope (say this if asked):** security deposit, bank guarantee and LC (Phase 2, agreed); HRMS letters, HSE documents, warning letters and KPI tracking (HRMS product, not this POC); HRMS deployment to KSA and Employee Master upload (operations); scaffolding and heavy equipment rental in one system (needs its own discussion); collection dashboard (waiting for Ajin's dashboard definition, Darshit's request at 52:02); utilization report layout (data is ready); return approval on the latest approval cycle (development phase); scrap and disposal accounting connection (earlier feedback).

**Open questions (each has a default in section 2):**

| # | Question | Default |
|---|---|---|
| O1 | "Supplier auto-populate": is anything beyond carrying the order context and the request / RFQ supplier needed (for example a preferred supplier per Category and Subcategory)? | D1 |
| O2 | A standalone Service order (Activity Type Service) still has a one-visit plan and a job card, like AMC. Should Service orders have no visit and no job card ("services might be transportation")? | No change |
| O3 | Additional invoice amount: lump sum or day rate? On return, also when the Invoice End Date is after the return date? | D2, D3 |
| O4 | New rate on extension: from the extension date only, or every period not yet invoiced? | D4 |
| O5 | Keep Early Termination? | D5 |
| O6 | Replacement "delivery order selection": a new Delivery Order (built) or pick an existing one? | D6 |
| O7 | Replacement: can the Category change too, or only the Subcategory as on delivery? | D7 |
| O8 | Routine and Critical maintenance checklist contents | Sample lists in section 3.3 |
| O9 | Expiry notice per order ("one week or two weeks as per the order") or one setting (14 days today)? | One setting |
| O10 | "Certificate compliance already done": asset certificates (built) or employee certificates (HRMS)? | Asset certificates |
| O11 | The transcript was cut off at 1:06:30 (partial extension scenario). Anything decided after that point? | F13 as written |
