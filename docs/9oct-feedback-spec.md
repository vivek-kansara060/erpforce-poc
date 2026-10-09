# 9 Oct Client Feedback Spec (ERPForce POC)

Prepared 9 Oct 2026 from the "Heavy rental module discussion - October 09" call with Ajin (33 min, Renewals and Expiry, Extension, Replacement Orders, Customer Returns). Status: **SPEC ONLY, NOT APPROVED FOR EXECUTION, NOTHING EXECUTED.**
Every path is relative to `erpforce-poc/`. The 8 Oct work (F1 to F16, `docs/8oct-feedback-spec.md`) is built and committed (`cf7b1dd`); this spec changes some of it, and says so per item.

---

## 0. How to use this spec

1. Get explicit approval from Anurag first (standing rule: feedback first, edit the POC only after a yes). If a default in section 2 changes, update this file first.
2. Follow the mandatory context check in `CLAUDE.md`. Append the 9 Oct transcript to `Transcript.md` as `## Heavy rental module discussion - October 09` before Phase 1.
3. Execute the phases in section 5 in order. Each phase ends with `npx tsc --noEmit` at zero errors; `npx vite build` at the end.
4. Same hard rules as the 8 Oct spec (section 0.1 there): no em dash characters, existing components and look (`FormHeader`, `Page`, `TabPanels`, `DataTable`, `SpecForm`, `MenuButton`, `ValueGrid`, `StatusChip`), `change` + `req` on every new or changed element (new helper `R9(topic)` = `` `Client call 9 Oct: ${topic}` `` in `src/modules/crm/shared.tsx`), a Change Register entry and a `CHANGELOG.md` entry per screen, `TO_CONFIRM` where the client did not decide, no new dependencies, no commit unless asked.

---

## 1. Every point from the call

| # | Call point (timestamp) | Today in the POC | Disposition | Item |
|---|---|---|---|---|
| 1 | Renewals is operational, not financial: rental keeps billing until the material is returned, so no fault attribution or billing treatment (2:39 to 6:51) | Renewals and Expiry has "Overdue handling" (Fault Attribution, Same / Penalty Rate / Hold Billing) and a Fault Attribution column (`src/modules/rental/RentalPages.tsx:207-253`) | Remove | G2 |
| 2 | Show only what is near expiry, default one week, not contracts 182 days away (6:51) | Contracts tab lists every live rental order, filter Overdue / Expiring / Active, notice 14 days (`EXPIRY_NOTICE_DAYS`, `src/modules/crm/data.ts:99`) | Build: default window 7 days, choosable | G2 |
| 3 | "Extend or return" goes straight to the page, no pop-up (8:02 to 8:13) | Row menu opens `ExpiryDialog` (`src/modules/crm/ActionDialogs.tsx:15`) | Build: two direct actions | G2 |
| 4 | Extend: one New End Date at the top for the whole order, not line by line; same idea as the contract period on the main form (9:13) | Extend page needs a New End per line (`src/modules/crm/SalesOrderPages.tsx:597-623`) | Build | G3 |
| 5 | Extension is saved as an "Update", not a "Revision" (9:13 to 11:01) | Button "Save Revision", alert and toast say Revision | Build (wording); history kept, see Q1 | G3 |
| 6 | Every Edit page: the button is **Update**, not Save, globally, to tell an edit from a new record (10:00 to 11:01) | About 20 edit forms say "Save" | Build | G1 |
| 7 | Is the shown total the monthly amount for the extension? (12:00 to 13:11) | Extend grid shows only rates; the order Totals are contract totals | Build: per-period and extension amounts on the Extend page | G4 |
| 8 | Item columns: S.No first, then Category, Subcategory, then Description; identical on new, edit and view (13:26 to 15:33) | View puts the Status column before S.No (`src/modules/crm/Items.tsx:106,116`); order is S.No, Line, Item, Category, Subcategory; S.No only on orders; Extend grid is Item, Category, Subcategory | Build | G5 |
| 9 | No Delivery button for an extended order, the units are already delivered (15:37 to 16:28) | Create > Delivery is always enabled on a rental order (`SalesOrderPages.tsx:357`) | Build | G6 |
| 10 | Replacement form must show the order context (project, cost centre, order) and clearly the asset being replaced (17:20 to 18:48) | Form shows only a locked Rental Order select and the asset select (`RentalPages.tsx:117-121`) | Build | G7 |
| 11 | Replacement: show the price list rate of the chosen generator (19:01) | Only a free Price Adjustment | Build | G7 |
| 12 | Replacement is a collection **and** a delivery, two legs; the collection follows the return flow (fleet or external, collection note), but the invoice is not stopped (20:20 to 21:57, 26:37 to 27:21) | One Replacement trip "carries the new unit out and brings the old unit back"; the old asset jumps straight to Under Maintenance, no collection document (`src/modules/crm/flow.ts:517-555`) | Build | G7 |
| 13 | The same vehicle can deliver and collect, or separate vehicles; collection or delivery can happen at any time (24:29) | Not possible | Build (replacement) | G7 |
| 14 | External party collection has an extra expense, it must be tagged (27:21) | Trip expenses and Transport Charge already roll into Logistics Cost (Fleet, 7 Oct) | Already built, show it on the replacement view | G7 |
| 15 | Faulty asset after replacement: a dropdown, Under Maintenance or straight back to stock if it is fine (e.g. noise only) (26:19 to 26:47) | Fixed text "Under Maintenance" (`RentalPages.tsx:149`) | Build (replacement only) | G7 |
| 16 | Return method: what is Self vs Company Collection? Company Collection is the normal case and uses our fleet or external, like delivery (22:25 to 23:57) | Already built: Company Collection has the Collection Transport (Own Fleet / External) and creates a Collection trip (`src/modules/crm/ReturnPages.tsx:145,225`; `flow.ts:642`). Labels are unclear and nothing is preselected | Build: clearer labels, default Company Collection | G8 |
| 17 | A returned asset goes to maintenance statuses (25:xx) | Already built 8 Oct (F10, F11): Off Hire - In Transit, Yard Inspection, Under Maintenance (Routine / Critical) | Show it: asset status column on the return view | G8 |
| 18 | Replacement Orders and Renewals moved to CRM / Sales (1:28) | Done 9 Oct | No change | - |
| 19 | Keep the changes inside the system so Ajin can present them (30:30) | Change Register + changelog exist | Entries per item | all |
| 20 | Wireframe update, estimate email, salary certificate (28:21 to 32:39) | Not POC work | Out of scope | - |
| 21 | Development must connect inventory, packages / service masters, finance, cost centres, procurement (31:00) | Development phase | Note only | - |

---

## 2. Defaults chosen (confirm with Anurag)

| # | Question | Default | Why |
|---|---|---|---|
| Q1 | "Not revision, make it an update" (11:01): wording only, or drop the version history? | Wording only. Button **Update**, alert and toast say "update"; the Revisions tab stays, renamed **Update History** ("Update 1", "Update 2"); crumb shows `(Updated)` instead of `(Rev n)` | On 8 Oct Ajin asked to keep "the previous rental order and the current rental order". 9 Oct only asked for a distinction in the button name |
| Q2 | Expiry window | Default **7 days** everywhere (`EXPIRY_NOTICE_DAYS = 7`: Renewals, Renewal & Overdue dashboard, expiry reports). The Renewals page adds a window filter: Next 7 days (default), Next 14 days, Next 30 days, Overdue only, All live | Ajin: "by default give for one week". Closes open question O9 of 8 Oct with one global value |
| Q3 | Overdue rows on Renewals | Kept (they need the call too) with the hint "Rental keeps billing until the material is returned". No fault or billing treatment anywhere | Ajin 6:22 to 6:51 |
| Q4 | "Is this total monthly?" | Extend page shows, per line, **Amount per {frequency}** (units out x new rate) and **Extension amount** (for the new period), plus a total of each. Order Totals unchanged | The question was asked and answered loosely on the call (Vivek said "yes"); showing both removes the doubt. `TO_CONFIRM` |
| Q5 | Column order | One order for Opportunity, Quotation, Sales Order add, edit, view and the Extend grid: **S.No, Category, Subcategory, Item (description), Line kind (only on mixed documents), Quantity, ...**, and on the view the **Status** column goes last, before the three-dots menu. S.No shown in every mode | Ajin 13:30, 15:20 "make it identical". One table component, so quotation and opportunity follow automatically |
| Q6 | "Update" scope | Every page and dialog that edits an existing record: primary button **Update**. Create pages and dialogs keep **Save**. Draft buttons ("Save as Draft") unchanged. Action dialogs that are not edits (Collection failed, Advance, Track Details) unchanged | Ajin: "everywhere globally ... distinction between update and save" |
| Q7 | Replacement collection document | Saving a replacement creates, besides the Delivery Order, a **Customer Return** for the faulty unit with Operation Type `Replacement` (number RMA-..., Collection Note printable). It does not stop billing: the line keeps billing through the new unit, the old unit's billing ends on the replacement date exactly as today | Ajin: "Replacement is same like our return, but the logic is we are not stopping the invoice" (20:59) |
| Q8 | Same vehicle | Collection leg has **Collection by**: "Same vehicle as the delivery" (default) / "Separate trip" (Own Fleet or External Transporter, own date and time, transporter charge). Same vehicle: one Replacement trip linked to both documents. Separate: a Replacement trip for the Delivery Order and a Collection trip for the return | Ajin 24:29 |
| Q9 | Faulty asset outcome | Replacement form: **Resulting status of the faulty asset** select: Under Maintenance - Routine, Under Maintenance - Critical (default when reason is Breakdown), Ready for Hire (no fault found). Applied when the collected unit is validated at the yard (Goods Receipt), not at save. Until then the unit is Off Hire - In Transit, then Yard Inspection, same as a return | Ajin 26:37: "make a drop down ... it can also go directly to inventory if it is totally fine". This **changes** 8 Oct F10 for replacements only; normal returns still always go to maintenance |
| Q10 | Price list on replacement | Read-only **Price list rate** (Heavy Equipment Pricing for the chosen Category / Subcategory and the line frequency) next to **Current line rate**; Price Adjustment prefilled with the difference when the Subcategory differs, editable | Ajin 19:01 |

### 2.1 Conflicts

| Conflict | Resolution |
|---|---|
| 8 Oct V7 / requirement "Overdue On-Hire": fault attribution and overdue billing treatment | 9 Oct call wins: removed (G2). The requirement's notification and escalation stay |
| 8 Oct F10: every returned owned asset goes to maintenance | Unchanged for returns; for a replacement the user picks the outcome (Q9) |
| 8 Oct F12 / 9 Oct changelog: one trip carries the new unit out and the old unit back, old asset straight to Under Maintenance | Replaced by the two-leg flow (G7) |
| Existing ERP uses "Save" on edit pages (`erp-fe`) | Client asked for Update; the POC follows the client and the changelog says so |

---

## 3. Data model changes (all optional, seeds keep working)

| Type (file) | Add |
|---|---|
| `Replacement` (`src/modules/crm/data.ts:243`) | `returnId?: string; collectionMode?: 'Same vehicle' \| 'Separate trip'; outcome?: 'Under Maintenance - Routine' \| 'Under Maintenance - Critical' \| 'Ready for Hire'; priceListRate?: number` |
| `ReturnEntry` (`data.ts:234`) | `replacementId?: string; keepBilling?: boolean` |
| `Trip` (`data.ts:350`) | `alsoDoc?: { id: string; number: string; kind: TripKind }` (the second document of a same-vehicle replacement trip) |
| `EXPIRY_NOTICE_DAYS` (`data.ts:99`) | 14 to 7 |

`OrderRevision`, `revision`, `revisions` keep their names in code (labels change only).

---

## 4. Work items

### G1. Edit pages say Update (global)

**Change.** On each form below, when an existing record is edited (`existing`, `ex`, `editing`, an `:id` route), the primary button reads **Update** and the success toast says "... updated". Add pages keep **Save**.
`SalesOrderPages.tsx:110` (always edit), `AmcPages.tsx:279`, `LeadPages.tsx:111`, `OpportunityPages.tsx:131`, `QuotationPages.tsx:81`, `ReturnPages.tsx:196` (non-draft submit button when editing) and `:423` (always edit), `SalesInvoicePages.tsx:233`, `BillPages.tsx:156`, `PurchaseOrderPages.tsx:128`, `AssetPages.tsx:178` (accounting), `AssetTypePages.tsx:99`, `HeavyEquipmentPages.tsx:347`, `ItemPages.tsx:181`, `LocationPages.tsx:104`, `Masters.tsx:175`, `PricingPages.tsx:117`, `BillingCyclePages.tsx:79`, `CrossHireRfqPages.tsx:140`, `CrossHireOrderPages.tsx` (order form in edit mode). Dialogs editing a value: `Items.tsx:174` (`isNew ? 'Save' : 'Update'`), `MasterPages.tsx:37`, `Masters.tsx:281`, `FleetPages.tsx:188` (Reassign: Update).
Before editing, grep `src/modules` again for `>Save<` and `confirmLabel="Save"` to catch any form not listed. One Change Register entry in the CRM module ("Edit pages: Update instead of Save", global).

**Check.** Sales Order > Edit shows Update; Quotation > Add shows Save, Quotation > Edit shows Update; an item row Edit dialog shows Update, Add shows Save.

### G2. Renewals and Expiry: information and follow-up only

**Change** (`src/modules/rental/RentalPages.tsx:206-256`):
1. Remove `Handling`, the `rental.overdueHandling` collection, the Overdue handling dialog, the Fault Attribution column and the menu entry. Remove `FAULT_ATTRIBUTION` if nothing else uses it (grep).
2. Subtitle: "Contracts ending in the selected window and overdue on-hire assets, for the follow-up call. Rental keeps billing until the material is returned. Escalation after {ESCALATION_DAYS} overdue days."
3. Window filter (`toolbarRight` select, same style as the Replacement list `pick`): Next 7 days (default), Next 14 days, Next 30 days, Overdue only, All live. Rows outside the window are hidden. Keep the State filter.
4. Row actions (`MenuButton` "Actions"): **Notify** (as today), **Extend** (navigates to `/crm/sales-orders/{id}/extend`), **Return** (navigates to `/crm/customer-returns/add?so={id}`). No dialog. Row click still opens the Sales Order.
5. Overdue rows: hint chip text "Still billing" next to the state.
6. `EXPIRY_NOTICE_DAYS = 7` (Q2): the dashboard and reports follow. `ExpiryDialog` stays only if another caller uses it; otherwise delete it (grep `ExpiryDialog`).
7. Tab "Extension requests" renamed **Extensions**, column Revision becomes **Update** ("Update 1").

**Check.** Renewals opens with only orders ending within 7 days and overdue ones (SO-26-00088 "In 4 days" is there; SO-26-00041 "In 8 days" appears with Next 14 days). Extend opens the Extend page directly. No fault attribution anywhere.

### G3. Extend: one date for the whole order, saved as an Update

**Change** (`SalesOrderPages.tsx:544-629`, `flow.ts` `extendOrder`):
1. Above the grid, a `Section` "Extend the whole order" with **New End Date (all lines)** (date) and an **Apply to all lines** button: sets the New End of every line with units out and every recurring service line. Typing the date alone also fills empty line dates. Lines stay editable for the exception case. Hint: "Same as the contract period on the main form. Change a line only when it ends on a different date".
2. Header button **Update** (was "Save Revision"). Alert: "Extending updates this Sales Order. The previous version is kept under Update History." Toast: "{SO} updated, now ends on {date}".
3. Sales Order view: tab Revisions renamed **Update History**, rows "Update {n}"; crumb `(Updated)` when `revision > 0`; `RevisionDialog` title "Update {n} of {SO}". Log text "Update {n}: extended to {date} ...".
4. Grid column order per G5: S.No, Category, Subcategory, Item, Units out, Current End, New End, Current Rate, New Rate, Frequency, plus G4 columns.

**Check.** On SO-26-00088 enter one date at the top, Apply, Update: only the line with a unit out is extended, the order shows Update History with Update 1.

### G4. Extend: what the amount is

**Change.** Extend grid adds **Amount per {frequency}** (units out x New Rate) and **Extension amount** (units out x New Rate x periods between Current End + 1 and New End, using the line frequency and `linePeriods`), with a total row for both, labelled "per month" / "for the extension". Below: "Rental is invoiced every {frequency} at the amount per period until the units are returned." `TO_CONFIRM`.

**Check.** One unit at AED 9,000 monthly extended by one month: Amount per month 9,000, Extension amount 9,000.

### G5. Item columns in one order on every screen

**Change** (`src/modules/crm/Items.tsx`):
1. `COLS` order: `sno` (no `only` restriction, every mode), `category`, `subcategory`, `item` (label stays "Item"; Description stays the optional column), `kind`, `qty`, then unchanged.
2. The `extra` column (Status on the view) renders after the last visible column, before the menu cell, in head and body.
3. `selectable` checkbox stays first (it is a control, not data).
Mark `sno`, `category`, `subcategory` `change: 'changed'` with `R9('Item columns identical on add, edit and view')`.

**Check.** Quotation add, Sales Order edit and view, and the Extend grid all read S.No, Category, Subcategory, Item, ...; the view's Status is the last column.

### G6. No Delivery when nothing is left to deliver

**Change** (`SalesOrderPages.tsx:357`): Create > Delivery is hidden on a Rental order when no Rental line has `l.qty - deliveredQty(l) > 0` (extended, fully delivered orders included); disabled with that reason for Trading lines already fulfilled. The Extend page and the extension flow never create or offer a delivery.

**Check.** On SO-26-00041 (fully delivered, extended) the Create menu has no Delivery; on an order with units to deliver it is there.

### G7. Replacement: order context, price list, and two legs (delivery and collection)

**Form** (`RentalPages.tsx:67-158`), sections in this order:
1. **Sales Order** (read-only `ValueGrid`, `change: 'new'`): Sales Order (link), Customer, Project / Cost Centre, Activity Type, Site, LPO, Contract End.
2. **Asset to replace**: a `DataTable` of the units on hire on the order (radio-style single select; preselected when `?line=` has one unit): Asset ID, Asset Name, Category, Subcategory, Delivery Order, On hire since, Current rate. Replacement Reason select stays here.
3. **Replacement unit**: Category (locked, as decided 9 Oct), Subcategory, Replacement Asset (as today), plus **Price list rate** and **Current line rate** (read-only, Q10) and Price Adjustment (moved here, prefilled with the difference when the Subcategory differs).
4. **Delivery of the replacement unit** (`change: 'changed'`): Delivery Date & Time, Delivery Status (Packed, locked), Reference, Transport (`TransportSection` as today).
5. **Collection of the faulty unit** (`change: 'new'`): Collection by (Same vehicle as the delivery / Separate trip, Q8); when Separate: Collection Date & Time and its own `TransportSection` (Own Fleet or External Transporter with charge); **Resulting status of the faulty asset** (Q9); Customer notified (moved here). Hint: "The faulty unit follows the return flow: Off Hire - In Transit, Goods Receipt at the yard, then the status chosen here. Billing is not stopped, the line keeps billing through the new unit."

**Flow** (`flow.ts` `replaceAsset`):
1. Keep: Replacement record, Delivery Order for the new unit, new unit On Hire, line assignment (old Replaced with `stop: TODAY`, new On Hire), cross-hire allocation, allocation-differs log.
2. Old asset: `assetStatus: 'Off Hire - In Transit'` (was Under Maintenance at once); movement "Collection" from the client to the yard.
3. Create a `ReturnEntry` for the old unit: `operationType: 'Replacement'`, `method: 'Company Collection'`, `replacementId`, `keepBilling: true`, `status: 'Pending Receipt'`, one item (asset, line, original delivery), `transport` from the collection input, `offHireDate` = replacement date, number from the RMA series. Do **not** call `applyOffHire` (billing already moved to the new unit); log on it "Collection for replacement RP-...; billing continues through {new asset}".
4. Trips: Same vehicle: one Replacement trip, `doc` = Delivery Order, `alsoDoc` = the return. Separate: a Replacement trip for the Delivery Order and a Collection trip for the return. External charges go to trip expenses as today, so Logistics Cost and Order Profitability pick them up.
5. `validateReturnGrn`: when the return has `replacementId`, the asset outcome is the Replacement's `outcome` (Routine / Critical maintenance with workshop movement, or Ready for Hire) instead of the F10 rule.
6. Store `returnId`, `collectionMode`, `outcome`, `priceListRate` on the Replacement.

**Views.**
- Replacement view (`RentalPages.tsx:161-204`): a **Collection** panel next to Delivery Order: Collection Note number (link), status, trips, outcome chosen, asset status now. Assets table Direction labels "Out (being collected)" / "In (on hire)". A **Logistics cost** line: sum of both legs' trip expenses (external charge included).
- Customer Returns list and view: Operation Type `Replacement` shown as a chip; view links back to the replacement; banner "Collection for a replacement. Billing was not stopped".
- Trips (`FleetPages.tsx:43,465`): a trip with `alsoDoc` shows both documents ("DO-... and RMA-...").
- Replacement list: column **Collection** (return number and status).

**Check.** On SO-26-00088 replace AST-1090 with a 250 KVA unit, Same vehicle, outcome Ready for Hire, Save. A Delivery Order and a Return (Operation Type Replacement, Pending Receipt) exist, one trip shows both. AST-1090 is Off Hire - In Transit; the line keeps billing on the new unit. Receive and validate the return: AST-1090 goes Ready for Hire. Repeat with Separate trip, External Transporter, AED 600: two trips, the 600 shows in the order's Logistics cost and on the replacement view.

### G8. Customer Return: clear return methods, statuses visible

**Change** (`ReturnPages.tsx`, `data.ts:88`):
1. Method options shown as **Company Collection (our fleet or an external transporter)** and **Customer Self-Return (the client brings it to our yard)**; stored values unchanged (`'Company Collection'`, `'Self-Return'`). Default **Company Collection** on a new return, so the Collection Transport is visible at once. Hint: "Company Collection is the normal case. The collection is planned in Fleet like a delivery".
2. Return view items table: column **Asset Status now** (`StatusChip`), so Off Hire - In Transit, Yard Inspection and Under Maintenance (Routine / Critical) are visible on the return itself.

**Check.** Sales Order > Return asset: Company Collection is preselected and the transport fields show; after saving, the view shows the asset as Off Hire - In Transit; after the Goods Receipt, Yard Inspection; after validation, Under Maintenance (Routine).

---

## 5. Phases

| Phase | Items | Files |
|---|---|---|
| 1 | G1 Update buttons | about 20 page files listed in G1 |
| 2 | G5 column order, G6 Delivery button | `crm/Items.tsx`, `crm/SalesOrderPages.tsx` |
| 3 | G2 Renewals, G3 and G4 Extend | `rental/RentalPages.tsx`, `crm/SalesOrderPages.tsx`, `crm/data.ts`, `crm/flow.ts`, `crm/reports.tsx`, `crm/ActionDialogs.tsx` |
| 4 | G8 Returns | `crm/ReturnPages.tsx`, `crm/data.ts` |
| 5 | G7 Replacement two legs | `rental/RentalPages.tsx`, `crm/flow.ts`, `crm/data.ts`, `crm/ReturnPages.tsx`, `rental/FleetPages.tsx` |
| 6 | Change Register entries (`crm/index.tsx`), `CHANGELOG.md` entries (9 Oct, after 7:30 PM, newest first), `npx vite build` | |

## 6. Out of scope

Wireframe update, estimate and timeline email, salary certificate format, development-phase integrations (inventory, service masters, finance, cost centres, procurement), the collection dashboard (still waiting for Ajin's definition).
