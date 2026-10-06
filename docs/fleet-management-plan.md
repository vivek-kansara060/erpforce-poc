# Fleet Management: Implementation Plan (POC)

Status: **approved plan, not built yet**. Written 6 Oct 2026 for the ERPForce Heavy Equipment Rental POC (`erpforce-poc`, branch `feat/anurag`).

This document is meant to be implemented as is. Every requirement below is traced to its source. Anything that is our own design choice (not stated by Ajin or the requirement document) is marked **[Design choice]**.

---

## 1. Sources

| Code | Source |
|---|---|
| DOC | `ERP_HeavyRental.md` (Ajin's requirement document): "Delivery & Fleet Logistics" (Rental Module), Delivery Order fields, Rental dashboards, HRMS "Asset Issuance to Employees", Roles |
| T-17S | Call with Ajin, 17 Sep (heavy rental document 1/2) |
| T-18S | Call with Ajin, 18 Sep (document 2/2) |
| T-25S | Call with Ajin, 25 Sep (item master) |
| T-30S | Call with Ajin, 30 Sep |
| T-2O | Call with Ajin, 2 Oct |
| T-5O-AM / T-5O-PM | Calls with Ajin, 5 Oct morning and afternoon |
| USER | Decisions taken with Anurag in this session, 6 Oct |

## 2. What the client asked for

| # | Requirement | Source |
|---|---|---|
| R1 | Before any delivery, return or replacement, the dispatcher checks a dashboard of the own fleet to see which vehicle is available, then assigns one. | T-17S ("whenever any delivery, any return, any replacement, first I need to check my dashboard, which is my fleet is available"), T-30S |
| R2 | Assignment is manual. The system shows availability; the user decides. | T-17S ("that user will do manually"), DOC ("decided by the Service Desk team") |
| R3 | Vehicle / job status: **Free, Assigned, En Route, Stuck-Delayed**. Stuck-Delayed needs a mandatory reason (e.g. crane unavailable, offloading did not happen) so the dispatcher can plan around it. A vehicle must not sit as "out on job" forever. | DOC (Vehicle/Job Status, business rules) |
| R4 | Vehicles are categorised by type (low-bed, flatbed...) and the board can be filtered by type and status, with counts ("7 available, which are the seven?"). | T-30S ("you need to mention the categorization, what type of category it is"), T-2O, T-5O-PM |
| R5 | From the Delivery Order, the user opens the fleet view, filters to available, clicks a vehicle, and its details are filled in automatically. | T-5O-PM ("from here I need to open something like a dashboard... available fleet I'm checking, then from there I'm clicking, then automatically the details should be auto-fetched") |
| R6 | If own fleet is not available, an external transporter is used: chosen as a **supplier**, with its cost. (Already built.) | T-18S, T-5O-PM |
| R7 | Every trip's cost goes to the project / Sales Order: external transport charges and also own-fleet costs such as **Salik (road toll), fuel and other vehicle expenses**. Profitability is rent minus all such expenses. | T-18S ("maybe I do have vehicle expenses, maybe I do salik..."), DOC (Logistics Cost per Sales Order, linked to Cost Centre) |
| R8 | A job can move from own fleet to external transport (or back) based on availability. | DOC business rule |
| R9 | Own delivery vehicles are the **same Fixed Asset Register record** as rental assets (history, maintenance, cost, depreciation), not a separate lighter vehicle record. | DOC (three places) |
| R10 | A driver is a linked record, usually paired with a vehicle by default; the dispatcher can reassign. | DOC; HRMS "technician/driver vehicle allocation using the same Fixed Asset Register entry" |
| R11 | No delivery zone restriction: any vehicle anywhere in the UAE. | DOC |
| R12 | Fleet management lives in the **Rental module**, used by operations (allocation, fleet), after Sales works in CRM. | T-5O-AM ("when I need to go to allocations, fleet management and other things... in the rental module... to the rental operation people") |
| R13 | A failed collection is charged to the client if it is the client's problem, or booked as a company loss if it is ours. (Already built on Customer Returns.) | T-17S, DOC (Fault Attribution) |
| R14 | Dashboards come after the screens that feed them; no master is hard-coded; anything not useful to the client is hidden. | T-2O (Ajin's four standing rules) |
| R15 | Company vehicles are company assets, not rented out. | T-25S ("company asset, for example I have fleet... a car for my employee, I'm not renting that"), USER (Option 1) |

### Decisions taken (USER, 6 Oct)
- **D1 (Option 1):** delivery vehicles are **delivery only**. They are never rented out, never offered on a quote, and never counted as available rental fleet.
- **D2:** a checkbox on the Heavy Equipment Fixed Asset form marks a vehicle as fleet. Named **"Delivery fleet vehicle"** (not "Is vehicle"), because a company car is a vehicle but not delivery fleet. A checkbox (not the category) because categories are client-defined (R14).
- **D3:** statuses are the four from the document. "At site" is covered by En Route or Stuck-Delayed with its reason.
- **D4:** a **Trips** list is added **[Design choice]**. It is not named in the sources but is the record behind "per-delivery expense capture" (R7) and "outside-fleet tracking" (T-18S action item).
- **D5:** no separate Drivers master and no separate Vehicles master. Drivers come from the employee master (HRMS in the real ERP); vehicles are Heavy Equipment Fixed Assets (R9, R10).

---

## 3. Current POC state (verified in code, 6 Oct)

| Area | Today | File |
|---|---|---|
| Delivery Order transport | Transport Type (Own Fleet / External Transporter). External: Transported By (supplier, Service Provider type) + External Transport Cost (added to the order's `logisticsCost`). Own fleet: free-text Driver (select from employees with designation Driver or Dispatcher), Vehicle Number, Iqama, Mobile. | `src/modules/crm/DeliveryPages.tsx` lines ~67-71, `flow.ts` `createDelivery` |
| Order logistics cost | `SalesOrder.logisticsCost` (number). Feeds the "Logistics Cost & Profitability Report" and "Order Profitability Report". | `crm/data.ts`, `crm/reports.tsx` |
| Customer Return | Method Self-Return / Company Collection. "Collection Failed" with Responsible (Company / Client) and charge. Printable Collection Note with blank "Collected by (driver)" and "Vehicle" lines. | `crm/ReturnPages.tsx`, `flow.ts` `raiseReturn`, `failedCollection` |
| Replacement | Rental > Replacement Orders. No transport fields. | `rental/RentalPages.tsx`, `flow.ts` `replaceAsset` |
| Vehicles | Three Heavy Equipment Fixed Assets in category **Vehicle**: AST-1021 Low-bed Mercedes Actros (Jebel Ali, Ready for Hire), AST-1022 Low-bed Volvo FM 440 (Sharjah, Ready for Hire), AST-1023 Flatbed Isuzu FTR (Under Maintenance). Asset Type "Vehicles", department Logistics. They are in the **hire pool**. | `inventory/data.ts` SEEDS n 21-23 |
| Truck rental price | `pr9` Vehicle / Low-bed Truck, Daily, 2,400, "Low-bed truck with driver". Conflicts with D1. | `inventory/data.ts` line ~137 |
| Hire pool logic | `availability()` (Ready for Hire units of a category/subcategory), `isLive()`, `inFleetCount()` ("Include in Available Fleet Count"). Used by Opportunity, Quotation, Sales Order, Delivery, Replacement, Cross Hire, Items table and reports. | `crm/data.ts` ~256-261, `inventory/data.ts` ~244 |
| Drivers | Only one employee with designation Driver: Tariq Hussain (e9). Employees have no mobile number. | `mock-data/masters.ts` |
| Fleet screens | None. The rental "Fleet Status Dashboard" is about rental equipment, not delivery vehicles. A placeholder fleet dashboard was removed on 2 Oct (T-2O action item). | `crm/reports.tsx`, `rental/index.tsx` |
| Rental menu | Rental Dashboard, Product Management, Demand Planning, Invoicing, Rental (Replacement Orders, Renewals and Expiry), Agreements, Purchase, Cross Hire, Settings, Reports, Dashboards. | `rental/index.tsx` |

---

## 4. Target design

### 4.1 Where it lives
Rental sidebar, new group **Fleet Management** (R12), placed after "Rental" and before "Agreements":
- **Fleet Availability** `/rental/fleet` (NEW)
- **Trips** `/rental/trips` (NEW)

The vehicle master record stays on the Heavy Equipment Fixed Asset in Inventory (R9). Fleet Management is the operational layer on top of it.

### 4.2 Data model

**HeavyRec (inventory/data.ts), new optional fields**
```ts
deliveryFleet?: boolean;   // "Delivery fleet vehicle" checkbox (D2)
plateNumber?: string;      // required when deliveryFleet, unique across assets
defaultDriver?: string;    // employee name (POC); employee id in the real ERP
```

**Employee (mock-data/masters.ts), new optional field**
```ts
mobile?: string;           // filled into the trip and DO when the driver is picked
```

**Trip (new, collection `rental.trips`, in crm/data.ts next to the other rental types)**
```ts
export const TRIP_STATUSES = ['Assigned', 'En Route', 'Stuck-Delayed', 'Completed', 'Cancelled'] as const;
export type TripKind = 'Delivery' | 'Collection' | 'Replacement';
export interface TripExpense { type: string; amount: number; note?: string; date: string }
export interface Trip {
  id: string; number: string;            // TRP-26-00001
  date: string;                          // planned / dispatch date-time
  kind: TripKind;
  docId: string; docNumber: string;      // the DO, Customer Return or Replacement it serves
  soId: string; soNumber: string; customerId: string; site: string; costCentre?: string;
  transport: 'Own Fleet' | 'External Transporter';
  vehicleId?: string; plate?: string;    // own fleet
  driver?: string; mobile?: string;      // own fleet
  transporter?: string;                  // external: supplier name
  status: (typeof TRIP_STATUSES)[number];
  stuck?: { reason: string; responsible: 'Company' | 'Client'; since: string };
  expenses: TripExpense[];
  log: LogItem[];
}
```

**Vehicle fleet status is derived, never stored** **[Design choice]**: one source of truth (the trips).
```ts
// Free if no open trip; otherwise the open trip's status. Unavailable when the asset is not in service.
fleetStatus(vehicle, trips): 'Free' | 'Assigned' | 'En Route' | 'Stuck-Delayed' | 'Unavailable'
// Unavailable when assetStatus is Under Maintenance, Breakdown or Disposed, or status is Inactive.
// An open trip = status Assigned, En Route or Stuck-Delayed.
```

**Trip expense types: a master** (R14), stored in the CRM masters collection (`crm.masters`, key `tripExpenseTypes`) with list / add / edit like the other CRM masters. Seed: Transport Charge, Salik, Fuel, Driver Allowance, Parking, Other.

**Asset status for delivery vehicles.** Add **"In Service"** to `ASSET_STATUSES`. A delivery vehicle's Asset Status is In Service, Under Maintenance, Breakdown or Disposed. It is never Ready for Hire / On Hire / Hold / Off Hire. Board availability (Free, Assigned...) is the fleet status above, not the Asset Status.

### 4.3 Rules
1. A delivery vehicle (deliveryFleet) is **excluded from the hire pool everywhere**: `availability()`, rental quote / order / delivery pickers, cross-hire availability, Opportunity zero-availability flag, Items table Available / On Hand, `inFleetCount()` (returns false), rental and inventory fleet dashboards and "available fleet" counts (D1).
2. A vehicle can be picked for a trip only when its fleet status is **Free** (R1, R5).
3. One open trip per vehicle at a time.
4. Stuck-Delayed requires a reason and a Responsible (Company / Client) (R3, R13).
5. While a trip is **Assigned**, the dispatcher can reassign vehicle or driver, or **switch to External Transporter** (R8). After it is En Route, only Stuck-Delayed, Complete or Cancel.
6. Completing a trip frees the vehicle. Cancelling frees the vehicle and logs the reason.
7. Every trip expense is added to the Sales Order's `logisticsCost` and logged on the order (R7). Removing an expense subtracts it.
8. External trips: Transport Charge = the External Transport Cost entered on the document; it is recorded as a trip expense (and so posted once, not twice: `createDelivery` must stop adding `extCost` directly, the trip does it).
9. The driver defaults to the vehicle's Default Driver and can be changed per trip (R10). Mobile fills from the employee.
10. The "Delivery fleet vehicle" checkbox is available only for **Owned** assets (a cross-hired unit is rental equipment). Ticking it on an asset that is On Hire or Hold is blocked ("return the unit first").
11. Unticking it puts the asset back in the hire pool with Asset Status Ready for Hire, and is blocked while the vehicle has an open trip.

---

## 5. Screen-by-screen changes

### 5.1 Inventory > Heavy Equipment Fixed Asset: form (EXISTING WITH CHANGE)
File: `src/modules/inventory/HeavyEquipmentPages.tsx` (`HeavyForm`, Basic Details).
- New checkbox **Delivery fleet vehicle** (change "new", req "Fleet Management (5 Oct call): own delivery vehicles are Fixed Assets"), placed after Ownership. Hidden or disabled when Ownership is not Owned (rule 10). Hint: "Used to deliver and collect equipment. It is not rented out and not counted in the rental fleet".
- When ticked, show:
  - **Plate Number** (required, unique; error "This plate number is already used by AST-xxxx").
  - **Default Driver** (optional select). Options: employees with designation Driver first, then other active employees. Hint: "Filled into each trip; the dispatcher can change it".
- Asset Status for a new delivery vehicle starts as **In Service** (not Ready for Hire).
- "Include in Available Fleet Count" shows No for delivery vehicles.
- Everything else unchanged (depreciation, compliance, readings, movement history).

### 5.2 Inventory > Heavy Equipment Fixed Asset: view (EXISTING WITH CHANGE)
- Header chip: **Delivery fleet** next to the status.
- Basic Details: Plate Number, Default Driver, **Fleet Status** (derived), Current Trip (link).
- New tab **Trips** (only for delivery vehicles): the vehicle's trips, newest first (number, date, kind, document, customer, site, driver, status, total expenses), each linking to the trip.
- Manual status actions for delivery vehicles: Change Status offers In Service / Under Maintenance / Breakdown. "Mark Ready for Hire" is hidden; show **Back in Service** instead when Under Maintenance / Breakdown.

### 5.3 Rental > Fleet Management > Fleet Availability (NEW)
File: new `src/modules/rental/FleetPages.tsx` (`FleetBoard`), route `fleet`.
- Title "Fleet Availability". Subtitle: "Own delivery vehicles and what they are doing now. Pick a Free vehicle for a delivery, collection or replacement".
- **KPI row** (clickable, sets the status filter): Free, Assigned, En Route, Stuck-Delayed, Unavailable, with counts (R4).
- **Filters:** Vehicle Type (the vehicles' Subcategory, e.g. Low-bed Truck, Flatbed Truck; read from data, not hard-coded), Fleet Status, search (plate, asset, driver).
- **Table columns:** Plate Number, Vehicle (asset name, links to the asset), Type, Default Driver, Fleet Status (chip; Stuck-Delayed in red with the reason under it), Current Trip (number, kind, document, customer, site), In status since (e.g. "3 h", "2 days"), Location (`currentLocation`).
- **Row menu** by status:
  - Assigned: Start Trip (En Route), Reassign Vehicle / Driver, Switch to External Transporter, Cancel Trip.
  - En Route: Mark Stuck-Delayed (reason + Responsible required), Complete Trip, Add Expense.
  - Stuck-Delayed: Resume (En Route), Complete Trip, Cancel Trip, Add Expense.
  - Free: View asset, View trips.
  - Unavailable: View asset (reason shown: Under Maintenance / Breakdown).
- **Complete Trip dialog:** shows the trip; optional expense lines (Type from the master, Amount, Note) so Salik / fuel can be entered at the end of the trip (R7). Saves, frees the vehicle, posts expenses to the order.
- Empty state when no vehicle is ticked as delivery fleet: "No delivery vehicles yet. Tick Delivery fleet vehicle on a Heavy Equipment Fixed Asset".
- **Picker mode** (same component, used inside a dialog by the Delivery Order, Return and Replacement): only Free vehicles, Vehicle Type filter kept, a Select button per row; returns the vehicle (R5).

### 5.4 Rental > Fleet Management > Trips (NEW) [Design choice, D4]
Files: `FleetPages.tsx` (`TripList`, `TripView`), routes `trips`, `trips/:id`.
- **List columns:** Trip No., Date, Kind (Delivery / Collection / Replacement), Document (DO / CN / RP number, link), Sales Order (link), Customer, Site, Transport (Own Fleet / External), Vehicle or Transporter, Driver, Status, Total Expenses. Filters: Status, Kind, Transport; search.
- **View:** header with status chip and the same actions as the board row menu; details panel; **Expenses** table with Add / Remove (rules 7, 8); **Log** timeline (every status change, reassignment, switch to external, expense).
- No "Add Trip" button: a trip is always created from its document (Delivery Order, Return, Replacement) so it is always tied to a project.

### 5.5 CRM > Delivery Orders: form (EXISTING WITH CHANGE)
File: `src/modules/crm/DeliveryPages.tsx`.
- Transport Type = **Own Fleet**: replace the free-text Driver / Vehicle Number with a **Select from fleet** button that opens the Fleet Availability picker (R5). On pick, fill Vehicle (read-only, plate + name), Driver (editable select, default = vehicle's Default Driver), Mobile (from the employee). Vehicle is required for Own Fleet.
- If no vehicle is Free, the picker says so and offers **Use External Transporter** (switches Transport Type) (R8).
- External Transporter: unchanged (Transported By + cost).
- On save: create the Trip (kind Delivery, status Assigned, linked to the DO, SO, customer, site, cost centre). External: create the trip with the transport charge as an expense; do **not** also add `extCost` to `logisticsCost` in `createDelivery` (rule 8).
- Delivery Order view, Shipping tab: show the trip (number, status, vehicle, driver) with a link.
- Keep the **Iqama** field as it is (see Open questions).

### 5.6 CRM > Customer Returns (EXISTING WITH CHANGE)
File: `src/modules/crm/ReturnPages.tsx`.
- When Return Method = **Company Collection**, add a Transport section: Own Fleet (Select from fleet) / External Transporter (supplier + cost), same as the DO. On save, create a Trip (kind Collection).
- **Collection Failed** (existing) also marks the collection trip Stuck-Delayed with the same note and Responsible, so the board shows it.
- **Collection Note** print: fill "Collected by (driver)" and "Vehicle" from the trip instead of blank lines.

### 5.7 Rental > Replacement Orders (EXISTING WITH CHANGE)
File: `src/modules/rental/RentalPages.tsx` (`ReplacementForm`), `flow.ts` `replaceAsset`.
- Add the same Transport section. One Trip (kind Replacement) carries the new unit out and the old unit back.

### 5.8 Sales Order view (EXISTING WITH CHANGE)
File: `src/modules/crm/SalesOrderPages.tsx`.
- New tab **Logistics**: the order's trips (number, kind, document, vehicle or transporter, status, expenses) and the total, which equals `logisticsCost`.

### 5.9 CRM > Settings > Masters (EXISTING WITH CHANGE)
File: `src/modules/crm/MasterPages.tsx`.
- New master **Trip Expense Types** (list, add, edit, active/inactive), seeded as in 4.2.

### 5.10 Things removed or hidden
- Remove rental price `pr9` (Low-bed truck with driver, daily) (D1).
- In CRM category pickers for **Rental** lines, hide a category when all its live assets are delivery vehicles (so "Vehicle" does not appear on a rental quote). Fixed Asset Trading keeps all categories (an old truck can still be sold through disposal / trading) **[Design choice]**.

---

## 6. Flows (POC behaviour)

**Delivery with own fleet:** SO line > Deliver > Transport Type Own Fleet > Select from fleet (Free only) > pick "Dubai P 48213 Low-bed" > driver fills, mobile fills > Save. Trip TRP Assigned; board shows the truck Assigned with the DO. Dispatcher: Start Trip (En Route) > Complete Trip, adding Salik 20 and Fuel 180 > truck Free; SO Logistics tab and Logistics Cost report show +200.

**Stuck on site:** En Route > Mark Stuck-Delayed, reason "Crane not available on site", Responsible Client > board shows red with the reason > Resume or Complete later.

**No truck free:** picker shows none Free > Use External Transporter > supplier + cost > trip created with the Transport Charge expense.

**Switch while Assigned:** board > Switch to External Transporter > supplier + cost > own truck freed.

**Collection:** Return with Company Collection > Select from fleet > trip Collection. If collection fails: Collection Failed (existing) > trip Stuck-Delayed with the same reason.

**Replacement:** Replacement Order > transport > one Replacement trip.

**Maintenance:** asset Change Status > Under Maintenance > board shows Unavailable; Back in Service > Free.

---

## 7. Demo data (seed)

All dates are written as if today were 2026-09-30 (`store.ts` shifts them to the demo day). New trip numbers must sit below the `nextNumber('TRP', start)` value used in `flow.ts`.

**Vehicles (inventory/data.ts SEEDS):** set `deliveryFleet: true`, `plateNumber`, `defaultDriver`, Asset Status In Service on:
- AST-1021 Low-bed Mercedes Actros: plate "Dubai P 48213", driver Tariq Hussain.
- AST-1022 Low-bed Volvo FM 440: plate "Sharjah 3 22871", driver (new) Imran Shah.
- AST-1023 Flatbed Isuzu FTR: plate "Dubai K 61904", driver (new) Joseph Mathew; stays Under Maintenance (shows Unavailable).
- Add AST-10xx Crane Truck (Hiab, Vehicle / Crane Truck): plate "Dubai L 30517", driver (new) Ravi Kumar.
- Add AST-10xx Flatbed Truck Mitsubishi Fuso: plate "Abu Dhabi 12 45118", no default driver (shows the dispatcher choosing a driver).

**Drivers (mock-data/masters.ts employees):** add Imran Shah, Joseph Mathew, Ravi Kumar (designation Driver, department Operations, manager Bilal Ahmed), and a mobile on every driver (including Tariq Hussain).

**Trips (rental.trips):** at least one per status so the board and list are full:
- Completed, own fleet, Delivery on an existing delivered rental DO, with expenses Salik 20 and Fuel 180 (sum already reflected in that order's logisticsCost).
- En Route, own fleet (AST-1022), Delivery for the Hold order DO-26-00125 (or another open DO).
- Assigned, own fleet (Crane Truck), Collection for return CN-26-00123 (awaiting yard).
- Stuck-Delayed, own fleet (AST-1021), Collection, reason "Crane not available on site to load the generator", Responsible Client.
- Completed, External Transporter, on SO-26-00046 (External Transporter order), Transport Charge equal to its existing logistics cost.
- One Replacement trip, Completed, on RP-26-00004.
- The Fuso flatbed has no open trip, so it shows Free.

**Remove** `pr9`. **Masters:** seed Trip Expense Types.

**Consistency:** each order's `logisticsCost` must equal the sum of its trips' expenses after seeding (recompute in the seed or adjust the seeded values).

---

## 8. Files to change (POC)

| File | Change |
|---|---|
| `src/modules/inventory/data.ts` | `HeavyRec` fields; `ASSET_STATUSES` + In Service; `inFleetCount` false for delivery fleet; SEEDS for vehicles; remove `pr9` |
| `src/mock-data/masters.ts` | `Employee.mobile`; new drivers |
| `src/modules/crm/data.ts` | `Trip`, `TripExpense`, `TRIP_STATUSES`, `COL.trips = 'rental.trips'`, trip seed, `fleetStatus()`, `deliveryVehicles()`; `availability()` excludes delivery fleet; trip expense types master seed; category filter helper for rental lines |
| `src/modules/crm/flow.ts` | `createTrip`, `startTrip`, `markStuck`, `resumeTrip`, `completeTrip`, `cancelTrip`, `reassignTrip`, `switchToExternal`, `addTripExpense`, `removeTripExpense` (each updates the SO `logisticsCost` and logs); `createDelivery` stops adding `extCost` directly; `raiseReturn`, `failedCollection`, `replaceAsset` create / update trips |
| `src/modules/crm/shared.tsx` | `useTrips()` hook |
| `src/modules/rental/FleetPages.tsx` (new) | `FleetBoard` (page + picker mode), `FleetPickerDialog`, `TripList`, `TripView`, `CompleteTripDialog`, `StuckDialog`, `ExpenseDialog` |
| `src/modules/rental/index.tsx` | Fleet Management menu group and routes; Change Register entries |
| `src/modules/crm/DeliveryPages.tsx` | Own Fleet picker, driver/mobile fill, trip creation, Shipping tab trip |
| `src/modules/crm/ReturnPages.tsx` | Collection transport, trip, Collection Note fill |
| `src/modules/rental/RentalPages.tsx` | Replacement transport |
| `src/modules/crm/SalesOrderPages.tsx` | Logistics tab |
| `src/modules/crm/MasterPages.tsx` | Trip Expense Types master |
| `src/modules/crm/Items.tsx`, `OpportunityPages.tsx`, `QuotationPages.tsx` | rely on `availability()` (no change needed beyond it); category filter for rental lines |
| `src/modules/inventory/HeavyEquipmentPages.tsx` | checkbox, plate, default driver, In Service status, Trips tab, status actions |
| `src/modules/inventory/reports.tsx`, `src/modules/crm/reports.tsx` | exclude delivery fleet from rental fleet dashboards and availability reports; Logistics Cost report reads trips |
| `CHANGELOG.md` | one entry in the existing format (Where / Type / problem / what we did / be aware) |

Conventions to follow: NEW / CHANGED markers (`change`, `req` props) on every new field and screen; hints as "?" tooltips; masters with a list and "Create New" as the last dropdown row; no em dashes in any text.

---

## 9. Acceptance checks

1. The rental quote / Sales Order / Delivery asset pickers never offer AST-1021, 1022, 1023 or the new trucks; "Vehicle" does not appear as a rental category.
2. The Fleet Availability board shows every delivery vehicle with counts per status that match the rows; filters by type and status work.
3. Own Fleet on a DO opens the picker with Free vehicles only; picking fills vehicle, driver, mobile; saving creates an Assigned trip and the board updates.
4. Stuck-Delayed cannot be saved without a reason and Responsible; the reason shows on the board.
5. Completing a trip with Salik and Fuel increases the order's Logistics tab total, `logisticsCost`, and the Logistics Cost report by the same amount; external cost is not counted twice.
6. Switching an Assigned trip to External frees the truck and records the supplier and cost.
7. A truck set Under Maintenance shows Unavailable and cannot be picked; Back in Service makes it Free.
8. The checkbox cannot be ticked on a cross-hired or on-hire asset, and cannot be unticked during an open trip.
9. Collection Failed on a return marks its trip Stuck-Delayed; the Collection Note prints the driver and vehicle.
10. `npm run build` passes.

---

## 10. Real ERP (erp-be / erp-fe) impact, for estimation

- Today: `transportations` holds a free-text driver and vehicle number per DO / GRN; `mf_vehicle_types` and `mf_vehicle_numbers` are bare lookups; there is no fleet module.
- Needed:
  - On the new Inventory heavy-equipment asset register: `is_delivery_vehicle`, `plate_number`, `default_driver_id` (employee); status value In Service.
  - New tables: `fleet_trips` (kind, document type + id, sales_order_id, customer, site, transport type, asset_id, driver_id, supplier_id, status, stuck_reason, responsible, timestamps), `fleet_trip_expenses` (trip_id, expense_type_id, amount, note, date, journal link), `fleet_trip_expense_types` (master).
  - Trip expenses post to the Sales Order's cost centre / project (journal lines carry the cost centre, see the cost-centre work).
  - Delivery Order, Customer Return (GRN) and Replacement get a `trip_id`; the `transportations` table can be replaced by trips or kept as a view.
  - Availability queries for rental exclude delivery vehicles.
  - Driver to vehicle allocation can use HRMS asset issuance on the same asset record (DOC HRMS section).
  - New FE screens in `erp-fe/modules/rental`: Fleet Availability, Trips; changes to the DO, return and replacement forms.

---

## 11. Open questions (do not block the POC; ask Ajin)

1. **Iqama field** on the Delivery Order: Iqama is a Saudi residence ID; Ajin said KSA-only fields (like CRN) are not needed for UAE. Keep, rename to Emirates ID, or hide? (POC keeps it as is.)
2. Who enters trip expenses (driver on a phone, or the dispatcher after the trip)? The POC lets the dispatcher enter them at Complete Trip or later on the trip.
3. Should a truck's trips also appear in its Movement History (yard to site and back), or is the Trips tab enough? The POC uses the Trips tab only.
4. Trip expense types list: confirm Transport Charge, Salik, Fuel, Driver Allowance, Parking, Other.
5. Should the Logistics / Fleet dashboards (utilisation per vehicle, cost per trip) come later, after the screens are approved (R14)? The POC builds only the board and the list now.

---

## 12. Notes for the implementing session

Things learned while building the POC that are not visible from the plan alone.

### 12.1 How Anurag wants the work done
- **Approval first.** Give feedback and get Anurag's approval before changing the POC; then build.
- **Branch:** commit only to `feat/anurag` in `C:\Users\BAPS\Documents\Code\erpforce-poc`. Never commit to or push `main`. Commit, push and deploy only when asked.
- **Before reporting done:** `npm run build` (runs `tsc --noEmit` then `vite build`) must pass; add a `CHANGELOG.md` entry at the top of the entries (after the first `---`) in the existing format (`### date, around time: title`, `**Where:**` lines, `**Type:**`, *The problem.*, *What we did.*, *Be aware.*); update the Change Register text (`c(...)` entries / `changeRegister` rows in the module's `index.tsx`).
- **Deploy (when asked):** from the `erpforce-poc` folder run `npx vercel --prod --yes`; production alias is https://erpforce-poc.vercel.app.
- **Writing rule:** no em dashes in any text (code comments, UI text, CHANGELOG, docs).
- **Reporting:** report per screen (what changed, where), then the files touched.

### 12.2 Technical traps
- **Do not edit source files through PowerShell string replacement.** PowerShell strips `$` from JS template strings (`${why}` became `{why}`). Use the file edit tool for code.
- **Mixed line endings:** `src/modules/crm/flow.ts` and `src/modules/inventory/data.ts` contain LF while most files are CRLF, so exact-match edits can fail on line endings. Read the exact text first.
- **Number counters:** `nextNumber(prefix, seedStart)` in `src/store/store.ts` does not read the seed data; the counter starts at the `seedStart` passed by the **first** call for that prefix. There is no `TRP` counter yet: create trips with `nextNumber('TRP', N)` where N is the highest seeded trip number, and use the same N at every call site.
- **Demo dates:** `seedCollection` in `src/store/store.ts` shifts every ISO date in a seed forward by (today minus 2026-09-30), except dates ending `-12-31`. Write all seed dates as if today were 2026-09-30, and seed trips through `seedCollection` (via `useCollection(name, seed)`), never by `setCollection`, so their dates shift too.
- **Asset ids:** a SEEDS entry with `n: 21` becomes record id `he21`, item code `ITM-0021`, Asset ID `AST-1021` (`inventory/data.ts`, the SEEDS mapper). New trucks need the next free `n` after the seeding agent's additions (check the highest `n` in SEEDS).
- **Store:** data is in memory only (a page refresh restores the seed). `useCollection` returns `rows, get, add, update, remove, replace`; flow functions use `getCollection` / `setCollection`, and both stay in sync.

### 12.3 Recent changes this plan builds on (6 Oct)
- **One cross-hire record:** cross-hire lives only in `rental.crossHire` (Rental > Cross Hire > Orders). The Inventory asset page reads it through a `toView` adapter in `HeavyEquipmentPages.tsx` (`useCrossHires`). Do not recreate an Inventory-only cross-hire collection.
- **Movement origin:** `flow.ts` has `whereIs(assetId, fallback)` (the asset's last movement destination); use it for any new movement entry.
- **Holds:** `releaseHold` / `releaseDueHolds` in `flow.ts`; a hold bills from the planned Rental Start.
- **Employee locations (service vans):** Location Type `Employee` with `userIds`. Use `stockLocations()` (excludes vans) for any trip site or dispatch location list; `vanLocationsFor(employeeName)` returns a technician's vans. `systemUsers` (ERP logins) is in `mock-data/masters.ts`.
- **Demo records cited in section 7** (all created on 6 Oct): DO-26-00125 is the Hold delivery of AST-1019 on SO-26-00052; CN-26-00123 is a return of AST-1036 waiting for "Asset Reached Yard"; RP-26-00004 swaps AST-1028 for AST-1013; SO-26-00046 is an External Transporter order with seeded logistics cost; SO-26-00049 is the fully returned, closable order. Confirm each in `crm/data.ts` before linking trips to it.
- **Existing `logisticsCost`:** several seeded orders already carry a `logisticsCost`. Seeded trips must add up to those values (or the values must be recomputed from the trips) so the Logistics tab and the report agree.

### 12.4 Where the sources are
- `C:\Users\BAPS\Documents\Code\erp-latest\ERP_HeavyRental.md`: requirement document (search "Delivery & Fleet Logistics", "Logistics / Fleet Availability Dashboard", "Asset Issuance to Employees", "Dispatcher").
- `C:\Users\BAPS\Documents\Code\erp-latest\Transcript.md`: all calls with Ajin (17, 18, 22, 25, 30 Sep; 2 Oct; two on 5 Oct). Fleet discussion: search "fleet", "flatbed", "logistic", "salik". Speaker labels are often wrong; read by content.
- `C:\Users\BAPS\Documents\Code\erp-latest\ERP_Doc.md`: how the existing production ERP works.
- `C:\Users\BAPS\Documents\Code\erp-latest\erp-be` and `erp-fe`: the real ERP code (for section 10 only; the POC does not touch it).
- `docs/crm-decisions.md` (this repo): earlier CRM decisions the POC follows.
