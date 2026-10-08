# ERPForce POC: What We Changed and Why

This is a plain-language log of every change made to the ERPForce POC (the Heavy Equipment Rental design POC). It is written so anyone can open it and understand what changed, why it changed, and how it affects the rest of the system. It only covers this POC. The real `erp-fe` and `erp-be` code has not been touched.

**How to read it.** Each entry is one change to one screen, newest first. Under every heading are two tags: **Where** (module, side menu and screen, exactly as they appear in the POC's sidebar) and **Type** (the same classification the Change Register uses: NEW, EXISTING WITH CHANGE, EXISTING, REMOVED). A change that touches more than one screen has one Where line per screen. Times are IST; "around" means the time was not written down when the work was done, so it is an estimate.

**Reading it inside the POC.** Open the Change Register and press "View detailed changelog". The page lets you filter these entries by module, by side menu and screen, and by Type.

**Where the "why" comes from.** The requirement document (`ERPForce_Heavy_Equipment_Rental_Module.md`), the description of what the existing ERP already does (`docs/baseline/inventory-fa.md`), and the two calls with Ajin on 25 and 30 September.

**Current state in one paragraph.** The POC's Inventory module has a Heavy Equipment Fixed Asset type and a Heavy Equipment Pricing screen (both named to match Ajin's wording), and a Physical Stock Verification screen that counts both stock items and individual heavy equipment assets, with per-location quantities, a confirmer, and a proper approve or reject step. Its variance report reads live data.

---

### 8 Oct, around 1:30 PM: Customer Return Goods Receipt: no Track Details, the serial is confirmed in the yard inspection
**Where:** CRM / Sales > Orders > Customer Returns
**Type:** EXISTING WITH CHANGE

*What we did.* A returned rental asset is already identified (it is picked from the assets out against the order, quantity 1), so the Track Details icon and dialog are removed from the Customer Return's Goods Receipt. The items table shows each asset's Serial Number instead, and the yard inspection has one required tick, "Serial number ... matches the nameplate of the unit received", before Passed or Damage Found can be saved. Validate needs every asset inspected with its serial confirmed.
*Be aware.* The Cross Hire Goods Receipt keeps Track Details, because that is where a supplier's serial number is first entered.

### 8 Oct, around 12:30 PM: Delivery Order: Add Extra Item (free or billable) and a searchable Trace Details picker
**Where:** CRM / Sales > Orders > Delivery Orders
**Type:** EXISTING WITH CHANGE

*What we did.* (1) The button on the Delivery Order items is **+ Add Extra Item**, a menu of the kinds of item that can be delivered (Equipment or Asset, and Trading). It opens the same item dialog as the Quotation and the Sales Order (Category, Subcategory, Pricing or Item, Description, UOM, Quantity, FOC, Rate, Discount, amounts, Location, Cost Centre), so whether it is free of charge is decided there with the FOC checkbox; a priced extra is a billable line on the Sales Order. (2) In Trace Details the Assigned Asset(s) stays a dropdown, now with a search in it (asset ID, name, brand, model or serial), compact option lines with a checkbox and a Cross-Hired tag, an "x of y selected" counter in its label, chips for the selected units, and the options lock once the units to deliver are chosen.
*Be aware.* The delivery's own Free of charge checkbox (for the whole delivery) is unchanged.

### 8 Oct, around 11:30 AM: Goods Receipt: assets traced on the view page, in a Track Details dialog
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*What we did.* The Goods Receipt form is back to the header, the items table (ordered, received, remaining) and the other sections; the assets are not entered there. On the Goods Receipt view page the items table has On this receipt and a Track Details icon per item. Track Details opens a dialog with that item's assets (Serial Number, Category received, Condition, Photo, Remarks, check), + Add asset and a paste-a-list box; Save keeps them on the receipt. An asset received as a Category not on the order has its own "Not on the order" row. Validate on the view page puts the assets on the register.
*Be aware.* Saving the form no longer carries serial numbers; they are added with Track Details.
*Design (same day).* Track Details is a scan-first dialog: Ordered, Received so far, On this receipt and Still to come at the top with a progress bar; one box to scan or type a serial number (Enter adds it) or Paste several; each asset is one compact line with its serial, the Category received (click to change it, an off-order Category turns amber), Condition as an OK, Needs check or Damaged switch, a photo button, a note button and a check; a damaged line has a red edge. The box stops accepting serials once the units still to come are on the receipt.

### 8 Oct, around 10:30 AM: Goods Receipt: one items table with the assets under each item; Hours reading removed
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*What we did.* The Goods Receipt has one Items table instead of an items table plus an assets grid. Each order item is a header row (Item, Ordered, Received, Remaining, how many are on this receipt) with + Add asset; its assets are rows under it with the Category received, Serial Number, Condition, Photo and Remarks, a check and a delete. An asset received of a Category not on the order shows under "Not on the order". The Hours reading field is removed.
*Be aware.* The paste-a-list box fills the asset rows from the top.

### 8 Oct, around 9:30 AM: Cross Hire Goods Receipt: receiving inside Basic Details, Items
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*What we did.* The separate Receiving tab is gone. The assets received are entered in the Items section of Basic Details, under the items table (ordered, received, remaining and on this receipt per item), on the Goods Receipt form as well as on its view. Saving the form keeps the serials entered; Validate on the Goods Receipt puts the assets on the register.

### 8 Oct, around 8:30 AM: One Cross Hire Order for several Categories, partial orders by deleting rows
**Where:** Rental > Cross Hire > Orders
**Where:** Rental > Cross Hire > Process Cross Hire
**Where:** Rental > Cross Hire > Request for Quote
**Where:** Accounting & Finance > Invoice > Bills
**Type:** EXISTING WITH CHANGE

*The problem.* An order was for one Category and Subcategory, so several items of a request needed several orders.
*What we did.* An order now has an Items table (Category, Subcategory, Units, Rate per unit, Amount) like the existing ERP. Process Cross Hire with several rows, or Create > Order on a request, opens one Order form with all the items; delete the rows you do not want to order now, and add or change rows. The request items covered by the order are marked, the request stays In Progress for the rest and completes when every item has an order or an RFQ. The RFQ already worked this way. The Goods Receipt shows units ordered, received and remaining per item, and a new asset row takes the first item that still has units to come; an asset of another Category is flagged as differing from the order. The order view, the Bill form (one line per item at its own rate), the cost of a Sales Order (each unit at the rate of its own item) and the cross-hire reports follow the items.
*Be aware.* The rental period, location and rental duration are one set for the whole order. The supplier and the type (Inventory or Dropship) are one per order, so rows with different suppliers are ordered separately.

### 8 Oct, around 7:00 AM: One Cross Hire Request for all the lines selected
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Process Cross Hire
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Selecting several equipment lines (several Categories and Subcategories) on a Sales Order raised one request for each line.
*What we did.* Cross Hire on several lines, or several lines picked on the Request form, now makes one request with one item per line (Category, Subcategory, units not covered yet). The request list shows all its Categories and the total quantity; the request view lists every item with what covers it. Process Cross Hire shows a row per item, so an order is made for one Category at a time (select the rows of one item; the request stays In Progress until every item has an order or an RFQ), and an RFQ can take several rows and so several Categories.
*Be aware.* An order is still for one Category and Subcategory. Create > Order on a request with several Categories sends you to Process Cross Hire to pick the item.

### 8 Oct, around 6:00 AM: Entity first on the rental forms; Address & Contact fills in like the existing ERP
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Orders
**Where:** Rental > Cross Hire > Request for Quote
**Where:** Rental > Settings > Billing Cycle
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* The rental forms called our own company "Company" and put it in the middle of the form, and the Address & Contact tabs were free-text boxes.
*What we did.* (1) Company is now **Entity** and the first field on the Cross Hire Request, Order, Request for Quote, Response, Goods Receipt and Billing Cycle forms, and on Customer Returns; the lists and views use the same label. (2) Address & Contact works like the existing ERP: Supplier Address and Contact Person list the addresses and contacts of the chosen supplier (for the RFQ, its first vendor in Call For Tender) and the first one is filled in when the supplier is chosen; Shipping Address, Billing Address and Place of Supply list the locations of the chosen Entity with the default shipping and billing address pre-selected, and Place of Supply follows the shipping address. Changing the supplier or the Entity refills them. The Goods Receipt takes the supplier and Entity of its order. The Quotation and Sales Order address tab and the Customer Return's Shipping Address follow the customer in the same way: its head office and the site of the order are offered and the site is pre-selected, Contact Person lists its contacts, Place of Supply is the emirate.
*Be aware.* The address and contact lists are POC sample data derived from the supplier, customer and entity records (a registered office and a yard per cross-hire supplier, two contacts each, the yards and head office of each Entity); the real lists come from the party masters. Addresses are stored as text, so invoices and bills that copy them are unchanged.

### 8 Oct, around 4:00 AM: Customer Returns rebuilt on the existing screens; Cross Hire creates open forms instead of dialogs
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Orders
**Where:** Rental > Cross Hire > Request for Quote
**Where:** Accounting & Finance > Invoice > Invoices
**Where:** Accounting & Finance > Invoice > Bills
**Type:** EXISTING WITH CHANGE

*The problem.* Customer Returns looked like a new screen, not the existing ERP's Customer Return (RMA). Cross Hire, the Sales Order and the Cross Hire order used dialogs to create RFQs, orders, requests, invoices and bills, where the existing ERP opens the form page.
*What we did.* (1) Customer Returns follows the existing ERP: list (ID, Date, Customer, Salesperson, Sales Order, Company, RMA Status) with Edit, Duplicate and Delete; one-page form (Customer Returns, Classification, Items, Attachment) with a Summary panel and Save as Draft; statuses Draft, Pending, Pending Approval, Pending Receipt, Return Completed, Rejected; Submit for Approval or Quick Approval, Accept and Reject; Receive creates a Goods Receipt (GRN) whose items have Track Details and which is Validated. The requirement is added on top and marked NEW: a Rental Return section (Return Method, Return Entry Timestamp that stops billing, Pre-Return Site Checklist, mandatory photos, fuel note, Collection Transport with its trip), Asset ID and Delivery Order on the items, Yard and Reached Yard and the yard Inspection (Operations Return Checklist, damage charge, damage waiver) on the Goods Receipt, Collection Failed, Print Collection Note, and Return Delivery on the Delivery Order. One return can carry several assets, each is one unit. (2) Create > Order and Create > RFQ on a request or on Process Cross Hire open the Order form or the RFQ form prefilled from the requests; Cross Hire on the Sales Order and in Replacement opens the Request form with the lines chosen; Bill on a Cross Hire Order opens the Accounting bill form prefilled from the order; Create > Invoice on a Sales Order (and a line's Invoice step) opens the Accounting invoice form prefilled with the invoiceable lines. Saving those forms links the documents back (order billed, lines invoiced).
*Layout.* Items on the return form are edited in the table itself (an asset picker and a narration on each row, + Add adds a row, the bin deletes it), with no dialog. The Summary panel sits on the right only on screens 1536 px wide or more; on narrower screens the summary is a section above the form, so the page does not scroll sideways, and wide tables scroll inside their own section.
*Be aware.* Return numbers are RMA-26-... (they were CN-26-...). The rental assets are off hire and billing stops when the return is saved (not a draft); editing then only changes the header. Delete is possible only for a Draft return. A return rejected at approval does not put the assets back on hire. The credit note and Pending Credit step of the existing RMA are not used for rental, because billing simply stops.

### 8 Oct, around 2:00 AM: A customer return of a cross-hired unit is its Return to Us
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Recording a customer return of a cross-hired unit left its Cross Hire Order at Allocated, so Return to Us had to be recorded a second time.
*What we did.* Saving the customer return moves the unit in its Cross Hire Order to Returned to Us (with a log line and the customer return number), ready for Re-Issue or Return to Supplier. The yard inspection of the return then fills in the unit's condition check, and the unit is flagged idle at our yard once it reaches the yard.
*Be aware.* Record Return to Us on the order stays for a unit that came back without a customer return.

### 8 Oct, around 1:30 AM: One master test order for the whole rental journey
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Testing Cross Hire, Fleet, Replacement, Extension, Return and Invoicing needed several orders and manual set-up.
*What we did.* SO-26-00058 (Gulf Build Contracting) is seeded with its Lead, Opportunity and Quotation: 500 KVA x 2 and 1000 KVA x 1 from stock, 200 KVA x 2 (one by Cross Hire) and 1500 KVA x 1 (all by Cross Hire), delivery, installation and return charges and a monthly damage waiver. Nothing is delivered, and the contract start is in the past so the first invoice is due after a backdated delivery. The numbered steps are at the top of docs/rental-flow-test-plan.md.
*Be aware.* The order carries a Damage Waiver, so inspection damage is covered and not charged; use SO-26-00049 for a chargeable damage. A new Lead takes numbers from LD-26-00037.

### 8 Oct, around 12:30 AM: Billing Cycle master, invoice schedules, Invoicing Rental Order per schedule, Accumulate Orders, Previous Jobs with Retry, Automatic scheduler
**Where:** Rental > Settings > Billing Cycle
**Where:** Rental > Invoicing > Invoicing Rental Order
**Where:** Rental > Invoicing > Previous Jobs
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* The POC billed every rental order on three hard-coded monthly cycles, had no invoice schedule, listed Invoicing Rental Order per order, had no Accumulate Orders, recorded a run as one line, and Invoicing Type did nothing. The existing ERP does all of this with a backend scheduler.
*What we did.* (1) Billing Cycle is a master again: Name, Count x Duration (Day, Week, Month, Calendar Month, 3 Month, 6 Month, Year), Company, Invoicing Type, Invoice Start Date (from delivery, from order creation, custom date), Max Schedule Count, Initial Invoicing with its days, and Prorated. The Sales Order picks a cycle in its Billing section and takes its Invoicing Type from it. (2) The schedule of an order follows its cycle: initial periods first, then recurring periods, up to Max Schedule Count ahead, ending when the last asset is off hire. The Sales Order has a Scheduled Invoices tab (Initial or Recurring, period, days, invoice date, amount, Pending, Failed or Processed, invoice link). (3) Invoicing Rental Order lists one row per due schedule with Next Invoice Date, Customer and Subsidiary filters, an Initial or Recurring tag, Refresh, Submit (one invoice per order and period, saved as a job) and Accumulate Orders (one customer's schedules on one invoice with a nature of goods title; each order keeps its own ledger and next period). (4) Previous Jobs lists every job with status, customer and type; a job opens into one line per order and period with its status, invoice link and Retry for a failed line. (5) The scheduler raises the invoices of Automatic orders when they are due, as a System job; in the POC it runs when the app opens and from Run scheduler now.
*Be aware.* The period of an order is billed per asset from its own Rental Start, as before; the existing ERP bills an order-level daily rate. Initial Invoicing and Prorated follow the existing ERP's backend rule (first days, to month end) but their exact amounts are to be confirmed. Add Schedule and Delete Schedule of the existing order tab are not built. A failed invoice is simulated only by the seeded failed job. The scheduler needs a back end in the real system.

### 7 Oct, around 11:30 PM: Rental flow review: test data, month-end billing fix, Cross Hire request quantity
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Invoicing > Invoicing Rental Order
**Type:** EXISTING WITH CHANGE

*The problem.* A walk through Lead to Invoice found four defects: seeded rental orders had no Billing Cycle or Invoicing Type; a billing period starting on the 31st drifted to the 29th and 30th of later months; a Cross Hire Request asked for the whole line quantity even when units were already ordered or received; Cross Hire was refused whenever an owned unit was Ready for Hire, even if demand was larger.
*What we did.* Seeded rental orders now carry Monthly and Manual. Billing periods follow the cycle from the first Rental Start (31 Aug, 30 Sep, 31 Oct). A Cross Hire Request is raised only for the units not covered by Ready for Hire units (owned or cross-hired) and by open requests, RFQs and orders of the line, and the request carries that number. Two test orders were added: SO-26-00055 for Cross Hire (1500 KVA x 2 with no unit anywhere, and a POD with a request and an awarded RFQ already prepared) and SO-26-00056 for invoicing (two 500 KVA delivered on different days, one 200 KVA returned mid-cycle, delivery and return charges, a monthly damage waiver, first period due). The steps are in docs/rental-flow-test-plan.md.
*Be aware.* The existing ERP generates invoice schedules in the backend (a Scheduled Invoices tab on the order, an Invoicing Rental Order list with one row per due schedule, jobs with Retry, Accumulate Orders). The POC still works out the next period on the fly. See the review notes for what would be needed to match it.

### 7 Oct, around 10:00 PM: Goods Receipt tracing is a receiving grid on the page
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Tracing assets on the Goods Receipt needed a modal, then an Add dialog and a Save for every unit.
*What we did.* A new Receiving tab on the Goods Receipt shows Ordered, Already received, Still to come and This receipt, with one pre-filled row per unit still to come (+ and - change the count). Each row is one asset: Serial Number, Received as (Category and Subcategory, flagged when it differs from the order), Condition (OK, Needs check, Damaged), Photo, Hours reading and Remarks. Serials can be pasted or scanned as a list and fill the rows from the top. Rows are checked as you type for a missing serial, a duplicate on the receipt and a serial already on the register. Validate shows a preview; each row becomes a Cross-Hired asset, a Damaged unit enters as Under Maintenance, and Print Labels is offered afterwards. Saving a new Goods Receipt opens it on the Receiving tab.
*Be aware.* The photo only keeps the file name in the POC and Print Labels is a placeholder. Hours reading and remarks go into the asset's audit trail.

### 7 Oct, around 9:00 PM: Cross Hire works like Sales Order and Delivery Order: Category and Subcategory on the order, assets defined on the Goods Receipt
**Where:** Rental > Cross Hire > Orders
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* A Cross Hire Order was tied to one Sales Order line and one asset, and the Goods Receipt asked for a quantity. A fixed asset is always one unit, and on the rental Sales Order the line carries only Category and Subcategory; the asset is picked at delivery.
*What we did.* The order is Category, Subcategory and a number of units (Units required); the Rental Order is optional and only says which demand it serves. The Goods Receipt has no quantity or bin: each row of Trace Details is one asset (serial number, Category and Subcategory actually received, flagged when it differs from the order). Validate puts one Cross-Hired asset on the Fixed Asset Register per row. The order shows Units ordered, Assets received and Remaining, with Receiving Status Partially or Fully Received, and Receive stays available until all units are in. Each asset has its own lifecycle (Received, Allocated, Returned to Us, Returned to Supplier) in a new Units tab, with Return to Us, Re-Issue and Return to Supplier on the unit. The unit is bound to a Sales Order at the Delivery Order. The Sales Order Cross Hire tab shows the units delivered to it and the cost of those units.
*Be aware.* Cost of an order is shared equally over its units (rate and expenses); a unit that serves two projects over time is not split by days yet, to be confirmed with the client. Order Profitability and the Cross-Hire reports still follow the Sales Order line the request was raised from. The asset form in Inventory still links one asset to an order.

### 7 Oct, around 8:00 PM: Cross Hire Orders follow the existing flow (approval, Goods Receipt); Request for Quote rebuilt to the existing layout
**Where:** Rental > Cross Hire > Orders
**Where:** Rental > Cross Hire > Request for Quote
**Type:** EXISTING WITH CHANGE

*The problem.* The POC received a unit straight from the order and raised the supplier bill at the same time, and its Request for Quote screen looked nothing like the existing ERP.
*What we did.* (1) Orders: the list has the existing columns and statuses (Draft, Pending, Pending Approval, Approved, Received, Billed, Rejected, Cancelled, Closed) with Edit and Delete; Add New opens the order form (Basic Details, Address & Contact, Rental Period, Items, Attachment, Classification). The order is approved as in the existing ERP: Submit for Approval or Quick Approval, then Accept or Reject, and Re-Submit when rejected. An approved Inventory order has Receive, which opens a separate Goods Receipt form; the unit is traced on it (serial number, bin) and Validate puts it on the Fixed Asset Register as Cross-Hired, Ready for Hire. Bill is its own action. A Dropship order has Mark Shipped instead. The five-stage lifecycle, condition check, re-issue, dispute charge and profitability continue unchanged after Validate. (2) Request for Quote: list with Edit, Duplicate, Delete; the form and the view have Basic Details and Address & Contact tabs, Rental Period, Items, Call For Tender and Attachment. Responses are separate pages (list, add, view, edit). Analyze & Award has the items list on the left and the responses on the right, with the All, Low Price, Low MOQ and Low Lead Time tabs, a filter, previous prices, and an award that asks for a comment. The RFQ becomes Pending Order after the award, and Create > Order opens the order form prefilled from the awarded response.
*Be aware.* This reverses the 6 Oct rule that Cross Hire Receive raises the supplier bill: the bill is now raised with Bill, after approval, as in the existing ERP. Allocations and View Profitability modals of the existing order screen are not rebuilt (the profitability panel stays on the order). An RFQ response carries one rate for the RFQ, not one per item. A GRN traces one unit; several units per order are not split into several register entries in the POC. The approver is the signed-in user, there is no approver pick list.

### 7 Oct, around 6:00 PM: Only new or changed modules shown; Billing section and Cross Hire move to the Rental Sales Order; Cross Hire gets the requirement's new fields
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Orders
**Where:** Rental > Invoicing > Invoicing Rental Order
**Type:** EXISTING WITH CHANGE

*The problem.* The POC still showed modules and screens of the existing ERP that nothing in the requirement touches. The Billing section of the existing Rental Order had no home now that rental orders are managed in CRM. Cross Hire could be started from any Sales Order. The Cross Hire module did not yet carry every field of the requirement.
*What we did.* (1) Review view: the launcher, the module switcher, the sidebars and the Change Register show only what is new or changed. Procurement, HRMS and User & Administration have no change and are hidden; unchanged screens (for example Rental Demand Planning, Agreements, Purchase, Settings, or the Accounting PDC, Commission and Budget screens) are hidden from the sidebar but still open by link. (2) The Sales Order has a Billing section, shown only for Activity Type Rental, with Billing Cycle, Invoicing Type, Last Invoice Date and Next Invoice Date, as on the existing Rental Order. The Rental, Invoicing Rental Order run follows the cycle (Monthly, 2 Months, Quarterly) and shows the Invoicing Type. The cycle is locked once the first rental invoice exists. (3) Cross Hire (line action, bulk action, Cross Hire tab with requests, orders and the cost rolled into the order) appears on a Sales Order only when its Activity Type is Rental. (4) Rental Cross Hire keeps its screens and flow. Added from the requirement: Raised By and Decision Right on the request; a yard checklist on the Return to Us condition check; Re-Issue to another project after Return to Us, with the Re-Issue Reference as a linked Sales Order; a buy-vs-hire estimate on the order and in the Cross-Hire Cost vs Revenue dashboard.
*Be aware.* Re-Issue puts the unit back to Ready for Hire; the Delivery Order to the new project then moves the order's cost roll-up to that project, and the earlier hire stays in the stage history. How to split the supplier cost between two projects is to be confirmed. The buy-vs-hire figure is an estimate (average purchase value of the owned units over their useful life), method to be confirmed with the client. Cross Hire permission is shown on the request but not enforced, because User & Administration is not built in this POC.

### 7 Oct, around 4:00 PM: Fleet Management review: date-based availability, trips tied to the Delivery Order, trip costs in Accounting
**Where:** CRM / Sales > Fleet Management > Fleet Availability
**Where:** CRM / Sales > Fleet Management > Trips
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Accounting > Journals
**Type:** EXISTING WITH CHANGE

*The problem.* Review of Fleet Management found gaps: a vehicle was blocked from the moment a trip was booked, whatever the date; only the form checked that a vehicle was Free; a Delivery Order was Dispatched while its trip had not started and never became Delivered; cancelling a trip left its cost on the Sales Order; Salik and fuel never reached the ledger; a transporter charge added after completion was never billed.
*What we did.* (1) Availability is by date: a vehicle is offered for a delivery only when it is Free on that day, a trip booked for a later day does not block today, and the board has a Next Booking column. (2) The vehicle is re-checked when a Delivery Order, Return or Replacement is saved, and on Reassign and Switch to External, so a stale screen cannot double-book it. (3) A Delivery Order is Packed when its trip is created, Dispatched when the trip starts, and Delivered when the trip completes (if the customer signature is already captured). Completing a Collection puts the asset in the yard. Start and Complete write the vehicle's Movement History, and it returns to where it left from. (4) Cancelling a trip takes its expenses off the Sales Order logistics cost, reverses its ledger entries, voids or debit-notes the transporter bill, and the Delivery Order shows an Arrange Transport button. (5) Own-fleet expenses post a journal (Dr expense, Cr Accrued Trip Expenses, on the order's cost centre); each external Transport Charge becomes its own Pending bill to the transporter, also when added after completion. (6) The Sales Order Logistics tab shows quoted Delivery and Return Charge lines against the actual trip cost.
*Be aware.* Assets still go On Hire when the Delivery Order is saved; only its status follows the trip. The customer is not invoiced for trip expenses, only for the quoted Delivery and Return Charge lines; whether an overrun or a client-caused delay is re-billed is still to be confirmed with the client. Availability is by day, not by hour. Seeded trips have no ledger entries. Fleet Management stays in CRM for now.

### 6 Oct, around 12:50 PM: Every invoice in the POC is now a real invoice in Accounting
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** CRM / Sales > Fleet Management > Trips
**Where:** Rental > Invoicing > Invoicing Rental Order
**Where:** Rental > Invoicing > Previous Jobs
**Where:** Rental > Cross Hire > Orders
**Where:** Inventory & Fixed Assets > Asset Disposal Requests
**Type:** EXISTING WITH CHANGE

*The problem.* Invoices existed only as numbers typed on a Sales Order line, a job card or a disposal. Nothing could be approved, paid or traced, the Sales Order Asset Ledger showed sample "received" figures, and cross-hire supplier invoices were a text field.
*What we did.* Every flow now creates a real document in Accounting, always Pending until approved there. Sales Order: Create, Invoice raises one invoice for the selected non-rental lines (the line step does the same); Advance records a Pending advance collection; a new Invoices tab shows invoices, payments and advances; the Asset Ledger reads invoiced and received from the rental invoices and shows Invoiced up to and Next Invoice Date; the Charges tab raises the damage or failed-collection invoice. Rental invoices are raised only from Rental, Invoicing Rental Order with Run Invoicing (decision of 6 Oct): each delivered asset from its own Rental Start (Hold excluded) to its off-hire day, pro-rated, plus the monthly damage waiver, delivery and installation charges on the first invoice, return charges on the final invoice and any waiting charge; Previous Jobs lists every run. AMC job cards raise their invoice (visit share, non-FOC materials and services). A return with damage raises its invoice, except when a damage waiver was paid. Cross-hire Receive (or Create, Bill for Dropship) raises the supplier bill with the agreed rate and expenses; a dispute charge raises a supplementary bill. Completing an external transporter trip raises the transporter's bill. Recording a disposal sale or scrap raises the buyer's invoice. The seven invoice numbers already in the demo data (INV-26-00118, 00287, 00344, 00371, 00396, 00402, 00415) are now real invoices, plus about 20 months of rental history.
*Be aware.* Invoices are Pending until approved in Accounting (decision D4) and payments are Pending until approved (D5), so a job card shows Paid only after the invoice and its collection are both approved. The rental cycle is monthly from the first Rental Start of the order, pro-rated by days, and billing stops on the off-hire day: rule to be confirmed with client. The credit limit is a warning only, also to be confirmed. The invoice engine sits in Accounting and is called by CRM, Rental and Inventory; this is the one deliberate exception to "modules do not read each other's data".

### 6 Oct, around 12:45 PM: Accounting POC: Invoices, Bills, Collections, Payments, Credit and Debit Notes, Journals
**Where:** Accounting & Finance > Dashboard
**Where:** Accounting & Finance > Journal Entry
**Where:** Accounting & Finance > Payment Entry > Payment
**Where:** Accounting & Finance > Payment Entry > Collection
**Where:** Accounting & Finance > Invoice > Bills
**Where:** Accounting & Finance > Invoice > Invoices
**Where:** Accounting & Finance > Credits > Debit Notes
**Where:** Accounting & Finance > Credits > Credit Notes
**Where:** Accounting & Finance > Reports
**Where:** Accounting & Finance > Settings > Chart of Accounts
**Type:** EXISTING WITH CHANGE

*The problem.* Accounting had only a dashboard placeholder and a reference page for disposal invoices (on 5 Oct accounting was "not designed in this POC"). Anurag asked on 6 Oct for a sales and purchase invoicing POC connected to the existing flows.
*What we did.* The existing ERP accounting sidebar is reproduced in its order. Invoices (sales) and Bills (purchase) follow the existing ERP: list, form and view with Submit for Approval, Quick Approval, Accept and Reject, Edit and Delete only before approval, Collection Entry or Payment Entry, Apply Payment (advance), Credit Note or Debit Note, View Accounting Ledger, Payment Request when overdue, Duplicate, Print and Email. Added on top of the ERP: Activity Type and Cost Centre / Project inherited from the source, a Source document link, rental period lines per asset, and a credit-limit warning. Collection and Payment allocate to open invoices or bills (or record an advance) and change them only when approved. Every approval posts a journal following the existing posting rules (Dr Receivable, Cr income and Output VAT; Dr expense and Input VAT, Cr Payable; Dr bank, Cr Receivable; credit and debit notes reverse), with Cost Centre on the journal lines. Chart of Accounts lists the accounts used, with balances. Aged Receivable, Aged Payable, Customer SOA and General Ledger read the live documents. The other accounting screens show their existing columns and are not rebuilt.
*Be aware.* Invoice and bill numbers are assigned at creation (the ERP assigns the sales invoice number at approval) so the source documents can show them at once. ZATCA (Saudi) is not shown: the client is in the UAE. Numbers continue from the demo data: INV-26-00416, BILL-26-00024, PAY-26-00055, CRN-26-00009, DBN-26-00004, JV-26-00401.

### 6 Oct, around 12:40 PM: AMC Order and Job Card become view pages; the form is only for creating and editing
**Where:** CRM / Sales > Orders > AMC Orders
**Type:** EXISTING WITH CHANGE

*The problem.* The Job Card page was an editable form even after it was saved, and the AMC Order page had no Generate or Actions menus, unlike the Sales Order.
*What we did.* The AMC Order keeps exactly its fields, panels and tabs; only the page header changes to the Sales Order view style: Edit, Generate (Job Card for the next planned visit, Invoice for completed job cards), View (Sales Order, Quotation, Opportunity, Invoices) and Actions (Send by Email, Print, Print consolidated report, Close). The Job Card keeps its fields and sections, shown read-only, with Complete Visit, Generate (Invoice), View and Actions (Edit, Print, Send by Email, Upload signed copy, Record Payment). The form opens only to create a job card for a planned visit (nothing is saved until Save) and through Actions, Edit until the job card is invoiced.
*Be aware.* Payment on the job card, the AMC order and the AMC list is now read from the invoice in Accounting, so Mark Payment Received is replaced by Record Payment, which creates a Pending collection.

### 6 Oct, around 8:30 PM: The driver comes with the vehicle on a delivery, collection or replacement
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** Rental > Rental > Replacement Orders
**Where:** CRM / Sales > Fleet Management > Fleet Availability
**Type:** EXISTING WITH CHANGE

*The problem.* Drivers are linked to a vehicle by default (requirement document, Assigned Driver), but in the demo the only Free vehicle had no default driver, so the driver always had to be picked by hand, and the Driver field looked like a free choice.
*What we did.* Picking a vehicle fills its Default Driver and mobile as read-only fields; a "Change driver" link opens the driver list for the rare swap (Service Desk reassignment). Every delivery vehicle now has a default driver: the Mitsubishi Fuso flatbed is paired with Sameer Khan (new driver), and a sixth vehicle was added, a MAN TGS low-bed (Dubai M 77042) with Arun Das (new driver), so two vehicles are Free on the board and every status still has an example.
*Be aware.* A vehicle without a Default Driver still shows the driver list straight away.

### 6 Oct, around 8:00 PM: Fleet Management moved from Rental to CRM
**Where:** CRM / Sales > Fleet Management > Fleet Availability
**Where:** CRM / Sales > Fleet Management > Trips
**Type:** NEW

*The problem.* Fleet Management (Fleet Availability, Trips) sat in the Rental sidebar. The team decided it belongs in CRM, next to the Delivery Orders and Customer Returns that create the trips.
*What we did.* The Fleet Management group is now in the CRM sidebar (after Orders) at /crm/fleet and /crm/trips, and removed from Rental. Every trip and board link (Delivery Order, Customer Return, Sales Order Logistics tab, Heavy Equipment asset page) points to the new address; the old /rental/fleet and /rental/trips links redirect. The two Change Register rows moved to CRM.
*Be aware.* This reverses requirement R12 of the fleet plan: on the 5 Oct morning call Ajin placed fleet management in the Rental module for the rental operations team. Decision taken by Anurag on 6 Oct.

### 6 Oct, around 7:30 PM: FOC visit on an AMC job card
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Orders > Sales Orders
**Type:** EXISTING WITH CHANGE

*The problem.* FOC existed on job card materials and services, but a whole visit could not be given free (for example AED 20,000 over 4 visits, one visit of AED 5,000 not billed).
*What we did.* The job card has an "FOC visit" tick: that visit's share of the Contract Value is not invoiced; materials and services keep their own FOC tick. Free of cost is shown everywhere the AMC money appears: the job card totals, a "Free of cost" KPI and an FOC chip on the planned visits of the AMC order, a Free of cost column and total in the consolidated report, a Free of cost column on the AMC Orders list, "(FOC)" on the AMC Visits tab of the Sales Order, and the invoice log. Also fixed: a material's cost stayed 0 when the row was added before the item was picked.
*Be aware.* An FOC visit is not moved onto the other visits: the total billed drops by that visit's share.

### 6 Oct, around 7:00 PM: AMC job card: FOC per material and service line; a van with AMC stock for every technician
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** Inventory & Fixed Assets > Configuration > Location
**Type:** EXISTING WITH CHANGE

*The problem.* The requirement document (AMC Billing) lets the Project Team mark a normally chargeable consumable or extra task as Free of Cost for a specific job; the job card had no way to do it. For the AMC demo, Sanjay Kumar had no AMC materials in any van, and Sales Representatives were offered as technicians although they have no van.
*What we did.* Each material and service row on the job card has an FOC tick: the line is not billed (the invoice total drops and a "Free of cost (not billed)" line shows the value), but the material still leaves the van stock and its cost is still counted. Added Service Van 3 (Sanjay Kumar) and AMC stock (Engine Oil, Air Filter, Battery) in all three vans; Battery 12V 200Ah is now classified AMC. The Technician list on the job card shows Service Technicians and the Yard Supervisor only.
*Be aware.* Oil Filter stays an Inventory item (it is sold on a Trading order), so it is not offered as an AMC material.

### 6 Oct, around 6:00 PM: AMC has no item lines; materials come from AMC items on the job card
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* An AMC Quotation asked for item lines (an "AMC Scheduled Visit" item with quantity and rate), as if materials or visits were sold as items. Ajin defined an AMC as a period and a number of visits (22 Sep call), with a contract value split across the visits (2 Oct call); materials are recorded on each visit's job card from the AMC items in inventory (2 Oct and 5 Oct calls).
*What we did.* AMC Quotations and Sales Orders have no Items grid. The Contract section asks for AMC Start Date, End Date, Number of Visits, **Contract Value** and **Scope of the AMC**; a Contract Value section shows the totals. The visit plan splits the Contract Value across the visits as before. An AMC Opportunity has no item lines (the Estimated Value carries the expected value into the Quotation). The AMC Orders list, the AMC order view and the job card show the Scope instead of an "AMC Item". On the job card, materials are only inventory items with Product Classification = AMC carried in the technician's van. The "AMC Scheduled Visit (Generator)" service item is removed. Fuel Filter, Engine Oil and Air Filter are now classified AMC. Demo AMC records keep their values (SO-26-00053 AED 24,000, SO-26-00050 AED 18,000, QT-26-00080 AED 7,000).
*Be aware.* Behind the scenes an AMC document still holds one "AMC Annual Contract" line built from the Contract Value, so totals, invoices and reports keep working; it is never edited as an item.

### 6 Oct, around 4:30 PM: Service is no longer an Activity Type; it is a charge
**Where:** CRM / Sales > Orders > Lead
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* "Service" was listed as an Activity Type next to Rental, Trading and AMC, and a service item carried a Product Classification, a Category and a Subcategory. A service is not a kind of business. It is a charge we levy (delivery charge, labor, installation, waiver), added to an order from the Inventory service master.
*What we did.* Removed Service from every Activity Type list (Lead, Opportunity, Quotation, Sales Order, the Activity Type Performance report and the document templates). Service items in Inventory no longer have Product Classification, Category or Subcategory (hidden on the form, list and view, and no longer required). Service charge lines are still added to Rental and Fixed Asset Trading orders from the service master. The seven demo records that were Service only now sit under real Activity Types: the Emirates Infrastructure lead is Rental, the Oasis Data Centre lead is AMC, the Kiln 4 job (OP-26-00018, QT-26-00079, SO-26-00051) is now a Rental order for a 500 KVA unit with installation and transportation as service charges, and the resort load bank test (OP-26-00019, QT-26-00080) is an AMC with two scheduled visits. AMC is no longer a Service Type either (Service Type is Charge, Waiver or Insurance); the AMC Scheduled Visit item is a Charge billed per visit, and an AMC order line picks from the service master.
*Be aware.* SO-26-00051 now has a 500 KVA unit pending delivery. Internally a service line is still tagged "Service" as a line kind, but it is no longer an Activity Type anywhere you can see or choose.

### 6 Oct, around 2:30 PM: Fleet Management: own delivery vehicles, Fleet Availability board, Trips and trip costs
**Where:** Rental > Fleet Management > Fleet Availability
**Where:** Rental > Fleet Management > Trips
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Rental > Rental > Replacement Orders
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** CRM / Sales > Settings > Masters
**Type:** NEW

*The problem.* Ajin asked for a way to see which own vehicle is free before a delivery, collection or replacement, to assign one, and to charge every trip's cost (Salik, fuel, transporter) to the project. The POC only had a free-text driver and vehicle number on the Delivery Order, and the three trucks sat in the hire pool, so a truck could even be quoted for rent.
*What we did.* Own delivery vehicles are the same Heavy Equipment Fixed Asset record, marked with a new **Delivery fleet vehicle** checkbox (Owned assets only) with a Plate Number and Default Driver. They are In Service, never rented out, never offered on a quote and never counted in the rental fleet (the Vehicle category no longer appears on a rental line and the low-bed truck rental price is removed). A new **Fleet Availability** board shows each vehicle as Free, Assigned, En Route, Stuck-Delayed (reason and Responsible required) or Unavailable, with counts and filters by Vehicle Type and status. A new **Trips** list and view hold one trip per delivery, collection or replacement, with expenses and a log. The Delivery Order, Customer Return (Company Collection) and Replacement Order get a transport section: Select from fleet opens the board as a picker of Free vehicles, which fills vehicle, driver and mobile; no free vehicle offers an external transporter; an Assigned trip can be switched to an external transporter. Every trip expense is added to the Sales Order logistics cost (new Logistics tab), and an external transporter's cost is posted once. Collection Failed marks the collection trip Stuck-Delayed; the Collection Note prints driver and vehicle. Trip Expense Types is a new CRM master. Section hints in the touched forms are now "?" tooltips.
*Be aware.* The Trips list is our own design choice (not named in the requirement document). Vehicle status is derived from the trips, never typed. The Iqama field is kept for now (open question for Ajin). Data is in memory, a refresh restores the demo trips. RMA-26-00123 shows two trips on purpose: a stuck first attempt and a second crane-truck trip.

### 7 Oct, around 12:30 AM: Format checks removed from fields; business checks kept
**Where:** CRM / Sales > Orders > Lead
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Some fields rejected values that did not match a fixed format, which gets in the way of a POC demo where any sample value should be accepted.
*What we did.* Removed the format checks: Email on the Lead (any text is accepted), VAT Number (15 digits) and CRN (10 digits) on the Lead, Opportunity, Quotation and Sales Order, and Iqama / Resident Number (10 digits) on the Delivery Order. The "15 digits" and "10 digits" hints under those fields are gone too. Phone and mobile fields had no format check and still accept anything.
*Be aware.* Business checks are unchanged: required fields, amounts greater than 0, percentages between 0 and 100, values that cannot be negative, date order, and stock limits.
### 6 Oct, around 11:30 PM: Employee location type for service vans, with Transfer stock in and van stock on AMC job cards
**Where:** Inventory & Fixed Assets > Configuration > Location
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Type:** EXISTING WITH CHANGE

*The problem.* AMC technicians carry spare parts in a van and use them on visits. A location could only be an Own Yard or a Supplier-Held Location, so there was nowhere to keep van stock, and an AMC job card could "consume" from any location, including a yard far away, without reducing any stock.
*What we did.* Location Type now has a third value, **Employee**. Choosing it replaces Linked Supplier with **Assigned Users**, a required multi-select of ERP user accounts (people with a login, not the whole employee list). The location list shows an Assigned Users column and can be filtered by Employee. An Employee location's page shows its users and has **Transfer stock in**, which moves a quantity of a stock item from a yard or supplier location into the van, never more than is available there. On the AMC job card, "Consume from location" lists only the vans assigned to the chosen technician (picked automatically when there is one), the materials list offers only what that van holds and shows the quantities, the visit cannot be completed with more than the van holds, and completing it reduces the van's stock. Vans are kept out of places a generator is dispatched from: Delivery Order location, quotation and order line locations, cross-hire receiving location, the asset's Initial Location and movement places. Physical Stock Verification can count a van like any other location. Sample data: a list of system users, Service Van 1 (Rajesh Pillai) and Service Van 2 (Rajesh Pillai and Sanjay Kumar), each with spare parts; seeded job cards now draw from Service Van 1.
*Be aware.* In the real ERP the van is filled with the existing Stock Transfer screen; Transfer stock in stands in for it in this POC. A van can be assigned to several users, as agreed on the 5 Oct call.
### 6 Oct, around 10:30 PM: Demo data now covers every flow, and its dates follow the demo day
**Where:** CRM / Sales > Orders > Lead
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Orders > Customer Returns
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Request for Quote
**Where:** Rental > Cross Hire > Orders
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Where:** Inventory & Fixed Assets > Fixed Asset Management > Disposal Requests
**Where:** Inventory & Fixed Assets > Dashboards
**Type:** EXISTING WITH CHANGE

*The problem.* Several flows could not be shown from the sample data. A new AMC quotation had no item to pick. No cross-hire order was waiting to be received or linked to an asset, the RFQ had no request behind it, and its dates were in the future. Nothing was on Hold, no return was waiting at any step, no order could be closed, no LPO was close to expiry, there was no Service order and no AMC order with invoiced and paid job cards. Pricing had no 1500 KVA, Quarterly or Yearly rows, few units were Ready for Hire, and there were no Off Hire, Breakdown or end-of-life units, no Fixed Assets count in progress and no scrap or draft disposal. A Lost lead still offered Convert.
*What we did.* The AMC item list now shows the Inventory AMC items. New sample records, all dated relative to the demo day: cross-hire orders CH-26-00008 (to receive), CH-26-00009 (for the asset form picker) and CH-26-00010 (received, unit AST-1031 ready to deliver on SO-26-00052); request CHR-26-00006 (Pending) and CHR-26-00007 (behind RFQ-26-00012, so the order created from the award is linked to SO-26-00041); AST-1019 on Hold on SO-26-00052 until its Rental Start Date; SO-26-00049 fully returned and ready to close, with returns at every step (RMA-26-00123 off hire, RMA-26-00122 in the yard awaiting inspection, RMA-26-00121 damage charged) and RMA-26-00132 damage covered by the waiver on SO-26-00046; LPO on SO-26-00041 expiring within the notice period and on SO-26-00048 expired; a Service opportunity, approved quotation QT-26-00080 and confirmed order SO-26-00051; AMC order SO-26-00050 with job cards Invoiced and Paid, Invoiced and Unpaid, Completed and Open; 1500 KVA, Quarterly, Yearly and a 500 KVA Fixed Asset Trading price; more Ready for Hire units; Off Hire, Breakdown and an end-of-life unit; count sessions SCS-26-00006 (in progress) and SCS-26-00007 (approved); disposals DSP-26-00006 (scrap invoiced), DSP-26-00007 (invoice to create) and DSP-26-00008 (draft); leads in every status; a Lost and a Negotiation opportunity; a One-time damage waiver item. CH-26-00006 is now linked to SO-26-00046 as the cover for the broken-down AST-1014. Palm Marina Development is active again. Convert is hidden on Lost, Unqualified and Not qualified leads.
*Be aware.* Sample data only; refreshing the browser restores it. New cross-hire orders and requests now start numbering after CH-26-00010 and CHR-26-00007. SO-26-00052 now asks for two 100 KVA units, one per cross-hire order.

### 6 Oct, around 9:00 PM: Six fixes: FOC assets on rentals, one cross-hire record, real movement origins, hold release, live locations, real date
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Six things behaved wrongly. A free-of-charge fixed asset added on a rental delivery was recorded as sold and left the fleet. Inventory kept its own cross-hire records with different numbers and rates from the Rental cross-hire orders, so the same unit showed two rates and a unit received through Rental showed "No cross-hire record is linked". Every delivery and replacement movement said it left Jebel Ali Main Yard. Release Hold started billing on the release day, and a hold never ended by itself. The supplier DO number check and the asset's Initial Location used a fixed list, so new locations were ignored. "Today" was fixed at 30 Sep while times came from the real clock.
*What we did.* On a Rental order a free-of-charge fixed asset is now a zero-priced Rental line: it goes On Hire and comes back on return; only a Fixed Asset Trading order treats it as a sale. The asset page now reads the Rental cross-hire order (one record, one rate), and Returned to Us and Return to Supplier on the asset page run the same Rental flow. Movements start from where the asset actually is (its last movement), with the DO location as the fallback. A hold now bills from the planned Rental Start Date, ends by itself when that date arrives (checked when the Sales Order is opened), and Release Hold is for a site that is ready early, billing from that day. The supplier DO check and Initial Location read the live Locations list. Today is the real date.
*Be aware.* The three Inventory-only cross-hire samples (CH-26-00027, 00028, 00031) are gone; the asset pages show the Rental orders CH-26-00007 and CH-26-00006 instead. A new cross-hired asset is normally created by receiving the cross-hire order in Rental; the manual picker on the asset form only lists orders not yet linked to an asset. With the real date, demo dates near 30 Sep may now show as past due.

### 6 Oct, around 7:30 PM: Line item actions moved into a three-dots menu, bulk Cross Hire on Sales Order lines
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Type:** EXISTING WITH CHANGE

*The problem.* Line items showed actions as buttons in the row, and Cross Hire could only be raised one line at a time.
*What we did.* Every line item table now has a three-dots menu per row holding all of that row's actions (Edit and Delete on editable tables; Deliver, Cross Hire, Release Hold, Replace, Return, Invoice and the next step on the Sales Order; Trace Details on the Delivery Order). Sales Order lines can be selected, and Bulk actions > Cross Hire raises one request per selected line with one preferred supplier and rate.
*Be aware.* Bulk Cross Hire only accepts rental lines with no unit Ready for Hire and no open request.

### 6 Oct, around 6:00 PM: Changes from the 5 Oct afternoon showcase call with Ajin (CRM and Inventory)
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** Inventory & Fixed Assets > Product Management > Item Category
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Where:** Inventory & Fixed Assets > Configuration > Location
**Where:** Inventory & Fixed Assets > Fixed Asset Management > Disposal Requests
**Type:** EXISTING WITH CHANGE

*The problem.* The showcase call listed changes to the CRM and Inventory screens.
*What we did.* Opportunity: LPO removed, Entity first. Quotation: Opportunity picked by Title, Activity Type open. Sales Order: Quick Delivery hidden, Cross Hire moved into a row menu, Print under Actions. Every printout asks for a document template. Delivery Order: Project fetched, Transported By is a supplier with its cost, an Add FOC item button for free inventory or fixed asset lines, and an expired certificate warning that does not block. AMC: Project, value split, actual date from the job card, payment status, job card with general activities, print, signed copy upload and Generate Invoice. Field notes moved behind a ? icon. Inventory: separate Item Category and Item Sub-Category masters, a Brand master chosen on the asset, Entity on the asset, CapEx auto-fetched, certificate type as a master, Movement History filled automatically with Customer and Project, pricing as one record per frequency with Add Frequency, Trading renamed Fixed Asset Trading in pricing, City removed from Location, and Disposal Request raised from the asset with income vs expense history and a redirect to the invoice.
*Be aware.* Fleet availability for transport is left for the fleet management call. Job card journals and the inventory ledger are shown for reference only, Accounting posts them. The transcript was cut off after the Physical Stock Verification item, so changes after that point are not included.

### 6 Oct, around 1:00 PM: Cross Hire now follows the existing Request, Process, RFQ and Order flow with the five client stages on the order
**Where:** Rental > Cross Hire > Requests
**Where:** Rental > Cross Hire > Process Cross Hire
**Where:** Rental > Cross Hire > Request for Quote
**Where:** Rental > Cross Hire > Orders
**Type:** EXISTING WITH CHANGE

*The problem.* The POC raised a cross hire straight from a Sales Order with a typed supplier and rate, and the Process, Request for Quote and Orders screens were empty placeholders. The existing ERP works as Request, Process, RFQ with responses, then Order.
*What we did.* Built the four screens as in the existing ERP. A request is raised from the Rental Order line, submitted, then turned into an RFQ or an Order (single or from the Process screen). The RFQ takes supplier responses, compares them and awards one, and the order is created from the award. The order keeps the existing fields (Hire Order Number, Cross Hire Type Inventory or Dropship, dates, Receiving and Billing status, Expenses) and adds the client's five stages: Received adds the unit to the Fixed Asset Register as Cross-Hired with no depreciation, Allocated happens through Delivery, Return to Us has the condition check, Return to Supplier has the dispute charge, and the profit rolls into the Sales Order.
*Be aware.* The supplier and rate are decided at the RFQ award or the order, not on the request (existing ERP rule over the client document). Dropship skips Received and Return to Us. Approval is a single Submit in this POC. Decisions in `docs/crm-decisions.md`.

### 6 Oct, around 10:00 AM: Rental no longer holds Lead to Order, service lines come from Inventory service items, contract dates move to the main form, UOM is a dropdown
**Where:** Rental > Rental (Leads, Opportunity, Quotations, Orders)
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Settings > Masters
**Type:** EXISTING WITH CHANGE

*The problem.* Rental showed its own copy of Lead, Opportunity, Quotation and Order, the CRM kept a separate Service Charges master, rental dates were asked again on every equipment line, and UOM was free text.
*What we did.* Removed Leads, Opportunity, Quotations and Orders from the Rental sidebar; they live in CRM only (filter by Activity Type = Rental). The Inventory Item form now has Service Type, Billing and Description when Type = Service (marked NEW), the rental service items (Delivery, Return, Transportation, Damage Waiver, Insurance, Operator) are seeded there, and the CRM item dialog and AMC job cards read them from Inventory. The CRM Service Charges master is gone. Contract Start and End Date are set once in the main form and every rental and recurring service line follows them; the item dialog and table no longer carry them. UOM in the item dialog is a dropdown fed by the Inventory UOM list.
*Sync.* CRM item pickers, stock and default prices, and AMC job card materials now read the live Inventory Items, so an item added or edited in Inventory shows in CRM straight away. Category and Subcategory (CRM "Category" and "Subcategory" fields) and every Location and Yard dropdown in CRM now read Inventory Item Category and Locations live. Pricing and the Fixed Asset Register were already shared. The Inventory Items list shows Service Type, Billing and Default Price on the Service tab.
*Be aware.* Inventory is changed only for the service item fields and the Service list columns. Changing a contract date overwrites the dates on all rental lines. Decisions are in `docs/crm-decisions.md`.

### 5 Oct, around 9:30 PM: CRM forms rebuilt on the existing ERP, second call with Ajin applied, Rental module kept as the existing system
**Where:** CRM / Sales > Orders > Lead
**Where:** CRM / Sales > Orders > Opportunity
**Where:** CRM / Sales > Orders > Quotation
**Where:** CRM / Sales > Orders > Sales Orders
**Where:** CRM / Sales > Orders > Delivery Orders
**Where:** CRM / Sales > Orders > AMC Orders
**Where:** CRM / Sales > Settings > Masters
**Where:** Rental > Rental > Orders
**Type:** EXISTING WITH CHANGE

*The problem.* The first CRM build reorganised the existing screens, and the 5 Oct call changed several earlier decisions.
*What we did.* Lead, Opportunity, Quotation, Sales Order and Delivery Order now keep the existing tabs, field order and item-table columns, with the new items marked NEW or CHANGED. From the call: Activity Types are Rental, Fixed Asset Trading, Trading, Fuel Trading, AMC, Service and Other, and Fuel Trading is not allowed on a Rental document. "Entity" is the first field of Quotation and Sales Order and Cost Centre / Project is mandatory in the header. The item dialog follows the call (Category, Subcategory, Pricing, Description, UOM, Quantity, FOC, then derived frequency and dates) and has Save and Add another. Service lines come from a new Service Charges master. Fixed Asset Trading traces the asset at Delivery and the asset leaves the active fleet. Fuel Trading can be delivered from a supplier yard with the supplier's own Delivery Order number. AMC has an AMC Orders menu with a Job Card per visit, the contract split across visits, project cost and profit, and a consolidated report. A Masters area gives every dropdown a list view; "Create New" is the last row of the dropdown. The Rental module again has the full existing sidebar; its Leads, Opportunity, Quotations and Orders are the CRM records filtered to Rental.
*Be aware.* Inventory was not changed. The Employee location type, the Service master in Inventory and the AMC / Fuel Trading / Trading classification remain Inventory work. Decisions are in `docs/crm-decisions.md`. Rental screens such as Agreements, Billing Cycle and Settings show their existing columns only and are not rebuilt.

### 5 Oct, around 11:30 AM: "Create New" is now the last row inside the dropdown, replacing the "+ Add" link above it
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Where:** Inventory & Fixed Assets > Product Management > Asset Type
**Type:** EXISTING WITH CHANGE

*The problem.* The quick-add for master values was a small "+ Add" link sitting above the field. The existing ERP puts this action inside the dropdown itself (for example "Create New Fixed Asset"), and the team wants the same here.
*What we did.* The **Asset Type**, **Category** and **Sub-Category** dropdowns on the Heavy Equipment Fixed Asset form, the normal Item form and the Heavy Equipment Pricing form now end with a **Create New Asset Type / Create New Category / Create New Sub-Category** row, separated by a line. Choosing it opens the same small dialog as before; after saving, the new value is selected in the field. The "+ Add" link above the field is gone.
*Be aware.* Choosing the Create New row does not change the field until the new value is saved. Sub-Category still needs a Category to be picked first, and the new sub-category is created under that category.

### 5 Oct, around 11:00 AM: Item Category is one screen again (categories and sub-categories together), without the Level field
**Where:** Inventory & Fixed Assets > Product Management > Item Category
**Type:** EXISTING WITH CHANGE

*The problem.* On 2 Oct categories and sub-categories were split into two screens. The team prefers the original single Item Category screen, only without the unexplained Level field.
*What we did.* **Item Category** is again one list holding categories and sub-categories, with **Category Name, Parent, Status and Sub Categories** columns. The form has the **Parent Category** field back: leave it empty for a top-level category, pick one to create a sub-category (a category that already has sub-categories stays top-level). **Level** is not shown anywhere. The page of a category lists its sub-categories with an **Add Sub-Category** button (which opens the form with the parent filled in); the page of a sub-category links to its parent. The separate **Item Sub-Category** screen is removed from the side menu.
*Be aware.* Category Type (Normal / Heavy Equipment) stays removed, as agreed on 2 Oct.

### 2 Oct, around 5:30 PM: A disposal by sale or scrap now ends with an invoice to a selected party
**Where:** Inventory & Fixed Assets > Fixed Asset Management > Disposal Requests
**Where:** Inventory & Fixed Assets > Reports
**Type:** EXISTING WITH CHANGE

*The problem.* A sale or a scrap always brings in an amount, so both need an invoice to the party taking the asset. Before, only a sale captured a buyer and invoice reference, and a scrap was simply recorded.
*What we did.* After approval, both methods show **Create Invoice**. The invoice has an **Invoice Number** (suggested, editable), **Invoice Date**, **Invoice To Taken From** (Customer list or Entered manually), **Invoice To** (picked from the customer list or typed in), and the **Sale / Scrap Amount**; a scrap can also carry a scrap reference. The request then shows a **Sale Invoice / Scrap Invoice** panel with these details, the net book value at disposal, the gain or loss and the finance journal reference. The request form asks for an optional **expected value** for both methods. The lifecycle's last step is now **Sale Invoiced / Scrap Invoiced**, the list's Outcome column reads "Sold, invoiced", "Scrapped, invoiced" or "Invoice to create", and the Asset Disposal report shows Invoiced To, Invoice Amount and Invoice.
*Be aware.* Two points are **flagged to be confirmed with client**: whether the invoiced party is picked by the system or entered by hand (both are offered for now), and the VAT treatment (the amount is shown without VAT). The invoice is a reference record only; the POC has no Finance module.

### 2 Oct, around 5:15 PM: A rental price now stores a price for every billing frequency; calculated prices can be changed by hand
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Type:** EXISTING WITH CHANGE

*The problem.* Each rental billing frequency was a separate price record, the listing showed a Billing Frequency column, and the screen explained how each figure was worked out. The ask is one rental price per Category / Sub-Category that holds every frequency, with calculated figures editable and no formula on screen.
*What we did.* On the form, the user picks a **Billing Frequency** and enters its price; the **Price for Every Billing Frequency** table fills in Daily, Weekly, Monthly, Quarterly and Yearly at once. Any calculated price can be **changed by hand** (it is marked "Changed by hand"); changing the chosen frequency or its price **recalculates** all of them. Saving stores **all five prices**. The **view page** shows all five with their source (Entered, Calculated, Changed by hand). The **listing** no longer has a Billing Frequency column: it has one row per Category / Sub-Category and a **Show rental prices for** dropdown that decides which frequency's price the Price column shows (trading rows show their sales price). The "How it is worked out" column is removed and a short note explains the conversion (7 / 30 / 90 / 360 days, 2 decimals). **Add Another Frequency** is removed because every frequency is now on one record. Bulk upload columns list a price per frequency. Trading prices are unchanged.
*Connected change.* The demo 100 KVA monthly and weekly prices were merged into one record (monthly AED 18,500 entered, weekly AED 5,200 changed by hand).

### 2 Oct, around 5:00 PM: "My access" (Can edit / View only) switch removed; the POC assumes full access
**Where:** Inventory & Fixed Assets > Reports
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** REMOVED

*The problem.* For the review the team works as a superadmin with full access, so the Can edit / View only switch only added clutter.
*What we did.* Removed the switch from the Reports pages and the asset page, and removed every view-only behaviour it controlled. Edit, Activate / Deactivate, Change Status, Mark Ready for Hire, Add Movement, cross-hire actions, certificate and reading entry, and the Items list Add, Edit, Duplicate and Delete actions are always available again.
*Be aware.* Permission-based editing is still a requirement for the live system; it is simply not shown in the POC.

### 2 Oct, around 4:45 PM: Delivery Orders list removed from supplier-held locations
**Where:** Inventory & Fixed Assets > Configuration > Location
**Type:** REMOVED

*The problem.* The sample "Delivery Orders from this Location" panel on supplier-held locations is not needed for now.
*What we did.* Removed the panel and its sample data. The read-only stock table (Stock Held, Consumed, Remaining and Remaining Value, with units) stays on every location page.

### 2 Oct, around 4:00 PM: Asset screens cleaned of internal and repeated fields
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* The Heavy Equipment Fixed Asset page still showed fields that never change or that the client does not need: Product Classification (always Rental), Tracking Method (always Serialized, already shown by the Serialized ID), Company and Owner Company (always Gulf Power Rentals LLC). The form showed Company too, and the Ownership tab repeated Ownership Type, which is now set on Basic Details.
*What we did.* Removed Product Classification and Tracking Method from the asset page header, Company from the asset page and form, Owner Company from the Ownership tab (page and form), and the repeated Ownership Type from the form's Ownership tab. Ownership Type is still shown once on the asset page's Ownership tab.
*Be aware.* The values are still stored on the record (every heavy asset is Rental and Serialized), they are only no longer displayed. The standard item form and page keep Product Classification and Tracking Method, because they differ between items there.

### 2 Oct, around 3:45 PM: Dashboards show only figures backed by the asset records, and link to those records
**Where:** Inventory & Fixed Assets > Dashboards
**Type:** EXISTING WITH CHANGE

*The problem.* Ajin asked that dashboards come after the source screens and never show numbers without a reliable source. Two dashboards did: Asset Profitability used estimated cost formulas, and Location-Wise Stock used fixed numbers. All dashboards were also calculated once from the starting demo data, so changes made in the POC did not show, and there was no way from a dashboard into the records behind it.
*What we did.* **Asset Profitability** and **Location-Wise Stock** dashboards are **held back** until their source data exists. The three that remain (**Fleet Status**, **Owned vs. Cross-Hire**, **End-of-Life Planning**) are now **counted live** from the Heavy Equipment Fixed Asset records each time they open, so a new, returned or disposed asset changes them straight away. Each has an **Underlying records** panel with buttons to the matching asset list and reports.
*Be aware.* The held-back dashboards' reports (Asset Profitability Report, Location-Wise Stock Report) are still available under Reports. No fleet-management (delivery vehicles) dashboard exists in this POC.

### 2 Oct, around 3:30 PM: Every report has a visible filter, column search, sticky totals, print and drill-down to the asset; View only access
**Where:** Inventory & Fixed Assets > Reports
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* Reports had only a few dropdown filters, no column search, no totals, no print, and an asset in a report could not be opened. Most reports also read the starting demo data, so changes made in the POC did not show. Ajin also asked that only users with edit permission can edit; others can only view.
*What we did.* Every inventory report now has a clearly visible **Filter** button (with a count of active filters) that opens a filter panel: **search across all columns**, the report's **dropdown filters** (options come from the data) and a **search box under every column heading**. Columns can be **sorted** by clicking the heading. A **totals row** (row count plus the sum of money, day and unit columns) stays **visible at the bottom while scrolling**. **Print** opens a print-ready copy of the filtered rows with the totals and the filters used; Export is kept. In every report that lists assets, **clicking the asset opens its asset page** with its details, current status and history. All twelve reports now read the **live POC data**, so new assets, counts, certificates, readings and disposals appear. A **My access** switch (**Can edit / View only**) on the Reports pages and the asset page stands in for the user's role: in View only, the asset page hides Edit, Activate / Deactivate, Change Status, Mark Ready for Hire, Add Movement, cross-hire actions and certificate and reading entry, and the Items list hides Add, Edit, Duplicate and Delete.
*Be aware.* The POC has no login or role system, so the access switch is a single POC-level stand-in; in the live system it comes from the user's role permissions. Report figures are still POC demo values.

### 2 Oct, around 2:45 PM: Physical Stock Verification simplified: one free-text reason, Found / Not Found, filters, Select All, no paging
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Where:** Inventory & Fixed Assets > Reports
**Type:** EXISTING WITH CHANGE

*The problem.* In the 2 Oct call Ajin found the count too heavy: a reason had to be picked from a dropdown on every differing line, fixed assets had a third result "Found elsewhere", the asset list paged with next-page arrows although it is already limited to one location, there was no way to filter or select many assets at once, and quantities were shown without units.
*What we did.* **Stock Items count:** a single free-text **Reason for Differences** at the top of the session, needed only when a counted quantity differs from the system; quantities and variances always show their unit (for example "14 Nos", "-2 Nos", "1,760 Meters"). **Fixed Assets count:** each asset is **Found** or **Not Found** ("Found elsewhere" and its automatic location correction are removed); a free-text reason is asked for only when an asset is not found. The asset list has **filters** (Asset or Asset Name, Category, Ownership, Result), **Select All** (respects the filters) with **Mark selected Found / Not Found**, a running count of found, not found and not marked, and shows **every row without paging**. Only **active** assets are loaded, so scrapped, disposed and returned cross-hire units no longer appear. Approving a Fixed Assets adjustment logs each Not Found asset on its audit trail; status and location are never changed automatically. The session list gets a status filter and a Counted By column. The Physical Stock Variance Report shows the session reason and quantities with units.
*Be aware.* The reason is free text, as asked; earlier reason lists are removed. Existing demo sessions were converted to one reason per session.

### 2 Oct, around 2:15 PM: Disposal requests now show the full lifecycle, including the sale or scrap outcome
**Where:** Inventory & Fixed Assets > Fixed Asset Management > Disposal Requests
**Type:** EXISTING WITH CHANGE

*The problem.* A disposal request stopped at "Approved, asset Disposed". Ajin asked for the request to show what happened next: for a scrap, the asset leaves normal use; for a sale, the buyer, sale value, Sales Invoice and finance reference.
*What we did.* The request form follows the agreed order: **1. Asset**, **2. Disposal Method** (Scrap or Sale), Disposal Reason, **3. Supporting Documents**, **4. Submit for Approval** (an Expected Sale Value is optional for a sale). Only active owned assets without an open request can be picked. **Approving** inactivates the asset (Asset Status Disposed, record Inactive) and writes this to the asset's audit trail. The request then shows **Complete Sale** (sale date, buyer from the Customer master, sale value, Sales Invoice reference) or **Record Scrap** (scrap date, optional scrap reference). The outcome panel shows the sale or scrap details, Net Book Value at disposal, the gain or loss on disposal and a finance journal reference. A **lifecycle stepper** (Request Raised, Pending Approval, Approved, Asset Inactivated, Sale / Scrap Completed) sits at the top of the request and form, and the list has an **Outcome** column (Sold, Scrapped, Sale to complete, Scrap to record).
*Be aware.* The Sales Invoice and journal are reference numbers only, clearly labelled: the POC has no Finance module. Cross-hired units cannot be disposed of; they are returned to their supplier instead.

### 2 Oct, around 1:45 PM: Usage Readings moved under the individual asset
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Fixed Asset Management
**Type:** EXISTING WITH CHANGE

*The problem.* Usage readings were a separate sidebar screen, disconnected from the asset they describe. Ajin asked for them to sit under the asset, entered manually for now, as an optional step.
*What we did.* The asset page has a **Usage Readings** tab showing that asset's readings, newest first (date and time, hour meter reading in hours, recorded by, entry method, fuel level, condition notes, reading source). **Add Reading** opens a dialog; clicking a reading opens it for editing, and readings can be deleted. A reading still cannot be lower than the previous one. Entering readings is limited to users who are allowed to enter them (see the permission switch in a later entry). The separate Usage Readings sidebar screen is removed.
*Be aware.* Readings are optional. The Reading Source field stays "Manual" and is kept so a future IoT or telematics feed can fill the same records; no IoT integration is built. The Overdue / Missing Usage Readings Report is unchanged.

### 2 Oct, around 1:30 PM: Compliance & Certificates moved onto the individual asset, with optional approval and Print QR
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Fixed Asset Management
**Type:** EXISTING WITH CHANGE

*The problem.* Certificates were kept on a separate sidebar screen, away from the asset they belong to. Ajin asked for them to live on the asset, to be enterable at purchase, for one asset to carry many records, for approval to be optional per client, and for the asset QR code to be printable.
*What we did.* The asset page (and the asset edit form) has a **Compliance & Certificates** tab listing every certificate of that asset (type, reference, expiry date, reminder lead time, document, status). **Add Certificate** opens a dialog; clicking a row opens it to view or edit, with its edit history. When **creating** a Heavy Equipment Fixed Asset, the same tab lets the user add any number of certificates that came with the purchase; they are saved against the new asset. An **Approval required (client setting)** switch, off by default, makes new and edited certificates start as Pending Approval with an Approve action. Under the asset's QR code there is a **Print QR** button that opens a print-ready label (QR, Serialized ID, asset name). The separate Compliance and Certificates sidebar screen is removed.
*Connected change.* The Certificate Expiry Report is unchanged and still lists certificates nearing or past expiry.
*Be aware.* Print QR opens a new browser window; if pop-ups are blocked, a message asks to allow them. The QR pattern is a POC stand-in generated from the Serialized ID.

### 2 Oct, around 1:00 PM: Location is simplified, and stock at a location is shown per item with its unit
**Where:** Inventory & Fixed Assets > Configuration > Location
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* The Location form carried fields that do not help this module (Parent Location, Company, Address, Zipcode, Country, State, Summary). Supplier-held stock was shown as bare numbers such as "60,000" with no unit, and stock and consumption looked like form fields.
*What we did.* The Location form and page now have only Name, Short Name, Location Code, Location Type, Linked Supplier (for supplier-held locations), City, Inventory Available and Status; the list has a Location Type filter and a City column. Every location page shows a **read-only stock table per item, always with the unit**: for a supplier-held location it shows Stock Held, Consumed, Remaining and Remaining Value (for example "60,000 Litres held, 38,500 Litres consumed, 21,500 Litres remaining"); for an own yard it shows Quantity on Hand and Value. A supplier-held location also lists the **Delivery Orders** made from it. On the item page, location-wise stock and stock on hand now show units too.
*Be aware.* The deliveries are sample data: Delivery Orders are raised in the sales / rental flow, which the POC does not have yet. Stock and consumption are calculated figures and cannot be typed in.

### 2 Oct, around 12:30 PM: Cross-hired assets take their details from the cross-hire record and show only what applies to them
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* For a cross-hired unit the user had to type the supplier and every detail by hand, tick an "idle" box manually, and the asset page still showed depreciation and movement history that do not apply. There was no way to filter own assets from cross-hired ones, and nothing ended a hire when the unit went back to the supplier.
*What we did.* **Ownership Type** is now the first field on the Heavy Equipment Fixed Asset form. Choosing **Cross-Hired** asks for the **Cross-Hire Record** the unit came in on; picking it fills in the supplier, category, sub-category, brand, model, capacity, engine number, hire start, received-at location and the suggested name, and those fetched fields are locked. For a cross-hired unit the form and the asset page **hide Depreciation Board, Movement History and Ownership**, and the asset page has a **Cross-Hire** tab with the record, supplier, stage, hire dates and supplier rate. **Asset Status follows the cross-hire stage** (Received = Ready for Hire, On Hire = On Hire, Idle at Our Location = Yard), and Change Status is not offered for these units. **Returned to Us (Idle)** and **Return to Supplier** move the stage; returning to the supplier ends the hire, marks the asset Inactive and shows "Hire ended" instead of current hire details. The heavy equipment listing has **Own Asset / Cross-Hire Asset** filter chips.
*Be aware.* The POC has no Procurement cross-hire screen, so three demo cross-hire records stand in for it (CH-26-00027 and CH-26-00028 are linked to the two existing cross-hired units; CH-26-00031 is waiting to be registered as an asset).

### 2 Oct, around 12:00 PM: Asset Type is a master, the asset name can be changed, and Asset Status is set by the system with a manual override
**Where:** Inventory & Fixed Assets > Product Management > Asset Type
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* Asset Type was a fixed list in the code, so a client could not use its own types. The asset name was always generated and could not be changed. Asset Status had to be picked by hand on the form, although Ajin wants it to follow the workflow (delivery, return) with a manual change only where the process needs it, for example Ready for Hire after a yard check.
*What we did.* A new **Asset Type** master (Product Management > Asset Type) lists the types with how many assets use each, and supports add, edit, activate / deactivate and delete (delete is blocked while assets use the type). The Asset Type dropdown on the Heavy Equipment Fixed Asset form has **+ Add**. The form has an **Asset Name** field again: it is suggested from Category, Sub-Category, Brand and Model and follows them as they change, until the user types their own name; **Use suggested name** switches back. **Asset Status** is no longer picked on the form: a new asset starts as Ready for Hire and an existing one keeps its status. On the asset page, **Change Status** (with a required reason) and **Mark Ready for Hire** (shown when the asset is in Yard, Off Hire, Under Maintenance, Breakdown or Hold) change it by hand. Under the status the page says whether it was set by the system or set manually, by whom, when and why, and every manual change is written to the audit trail. The heavy equipment listing shows an **Asset Status** column.
*Be aware.* Disposed cannot be set by hand; it still needs an approved Disposal Request. The demo asset types are seed data and can be edited.

### 2 Oct, around 11:30 AM: Category and Sub-Category are now two simple masters, without Level or Category Type
**Where:** Inventory & Fixed Assets > Product Management > Item Category
**Where:** Inventory & Fixed Assets > Product Management > Item Sub-Category
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Type:** EXISTING WITH CHANGE

*The problem.* Item Category mixed categories and sub-categories in one list, showed an unexplained Level field, and forced every category into a hard-coded Category Type (Normal or Heavy Equipment). In the 2 Oct call Ajin asked for this to be simplified and for masters to be addable from the screens that use them.
*What we did.* **Item Category** now lists categories only (Category Name, number of Sub-Categories, Description, Status) and has a view page showing its sub-categories, with Activate / Deactivate, Edit and Delete. A new **Item Sub-Category** screen lists sub-categories with their Category, with a Category filter, and its own add, edit and view pages; a sub-category simply picks the category it belongs to. **Level** and **Category Type** are removed everywhere. On the item form, the Heavy Equipment Fixed Asset form and the pricing form, the Category and Sub-Category dropdowns have a **+ Add** link that adds a new value in a small dialog without leaving the form, and selects it.
*Connected change.* Because Category Type is gone, the Heavy Equipment Fixed Asset form and the standard item form now both offer every active category.
*Be aware.* Deleting a category still deletes its sub-categories; Deactivate is offered next to Delete to keep history.

### 2 Oct, around 11:00 AM: Heavy Equipment Pricing separates Rental and Trading prices, with descriptions and bulk upload
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Type:** EXISTING WITH CHANGE

*The problem.* In the 2 Oct call Ajin asked for rental pricing and trading (sales) pricing to be kept apart. A price had no Activity Type and no Description, frequency was treated as a minor attribute, and trading prices had nowhere to go.
*What we did.* Every price now has an **Activity Type** (Rental or Trading) and a **Description**. A **rental** price needs a **Billing Frequency**, and each frequency is its own record. On a rental price, **Add Another Frequency** (in the row menu and on the view page) opens the form with Category, Sub-Category and the next unpriced billing frequency filled in, so the user only types the price and description. A **trading** price has no frequency, just a **Sales Price**. The list has **Rental / Trading** filter chips, a **Bulk Upload** button (choose Rental or Trading, see the spreadsheet columns, upload a file) and a Description column. The billing frequency preview table is shown for rental prices only.
*Connected change.* Pricing now lives in its own file in the POC (`PricingPages.tsx`), so this change can be reverted on its own.
*Be aware.* Bulk upload is a POC screen: the file is not processed, a message explains what the live system would do. Showing the billing frequency on rental orders is not done, because the POC has no rental order screens yet.

### 1 Oct, around 6:15 PM: The back arrow in the top bar now returns to the previous page, as in the existing ERP
**Where:** POC Review Tools > Top bar > Back arrow
**Type:** EXISTING WITH CHANGE

*The problem.* The arrow next to the module name always went to the module selection screen, wherever you were. From an item's view page, for example, it skipped the Items listing completely. The existing ERP's header arrow does not behave like this: it goes back to the previous page, like the browser's back button.
*What we did.* The arrow now goes back to the previous page you were on (listing to view page and back lands on the listing again). If there is no earlier page, for example when a link is opened directly in a new tab, it goes to the module selection screen so it never does nothing. Its tooltip now reads "Back".
*Be aware.* As in the existing ERP, after you save a form the arrow goes back to the form you just saved, because that was the previous page. The breadcrumb at the top left (for example "Items") still always goes to the listing. This change was made in the shared top bar (`src/shell/Shell.tsx`) with approval, as an exception to the builder guide's rule against editing shared files.

### 1 Oct, around 6:00 PM: Heavy Equipment Pricing shows what a price works out to at every billing frequency, and each price now has a view page
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Type:** NEW

*The problem.* A price is set for one billing frequency only (for example AED 600 Daily). The user and the customer had no quick way to see what that means per week, month, quarter or year. Clicking a price in the list also went straight into edit mode; there was no page to just look at it.
*What we did.* Under the fields on the Add and Edit Price form there is now a **Billing Frequency Preview** table. It takes the price and frequency you set and shows the equivalent price for Daily, Weekly, Monthly, Quarterly and Yearly, with a "How it is worked out" column (for example "600 × 7 days"). The frequency you set is marked "(set)". The table updates as you type. Clicking a price in the list now opens a new **view page** showing Category, Sub-Category, Price and Frequency with the same preview table, plus Edit and Delete buttons. Saving a price now opens its view page.
*Connected change.* Nothing is saved from the preview. No extra price records are created, and quotations and orders still use only the price that was set.
*Be aware.* The conversion assumes 1 week = 7 days, 1 month = 30 days, 1 quarter = 3 months and 1 year = 12 months (360 days), rounded to 2 decimals. A note under the table says this, explains that figures can differ by a few fils (AED 14 monthly is AED 0.47 daily, but 0.47 × 30 = AED 14.10), and states that the table is a preview only and actual invoices follow the rental dates on the order.

### 1 Oct, 5:30 PM: Product Classification removed from the Heavy Equipment Fixed Asset form, and Rental removed from the standard item form
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* The Heavy Equipment Fixed Asset form let the user pick any Product Classification (Inventory, Rental, AMC, Fuel Trading, Trading), but depreciation applied whatever was picked. Heavy equipment in this form is always rental fleet, so picking Trading or AMC made no sense and still produced a depreciating asset. The standard Add Item form, for its part, still offered Rental, so a rental generator could be created a second time as an ordinary item.
*What we did.* The Heavy Equipment Fixed Asset form no longer shows the Product Classification field. Every record saved from it is classified as Rental automatically. On the standard Add Item form, the Product Classification dropdown no longer offers Rental, and a hint under it says rental equipment is added as a Heavy Equipment Fixed Asset.
*Connected change.* The Heavy Equipment Fixed Asset details page still shows "Product Classification: Rental" as a read-only value. Existing standard items that are already classified as Rental (Diesel Generator 100 KVA, Diesel Generator 500 KVA and Power Cable 4C x 185 mm) keep that value and still show it when edited; only new choices are limited.
*Be aware.* Equipment kept for sale (Trading) is added on the standard item form, not the heavy equipment form. Whether the three existing Rental items should stay as ordinary items is to be confirmed with client.

### 1 Oct, 3:00 PM: The Heavy Equipment Fixed Asset form no longer asks for a name, item code, asset ID or tracking method
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** NEW

*The problem.* The form started with four fields that did not need the user: Item Code and Asset ID were read-only numbers the system generates anyway, Tracking Method was fixed to "Serialized" because heavy equipment is always serialized, and Name asked the user to type a name for something that is already described by its category, sub-category, brand and model. They made the form longer without adding information.
*What we did.* Removed all four fields from the form. The system still generates the unique ID behind the scenes. The record's display name is now built automatically from Category, Sub-Category, Brand and Model (for example "Generator 500 KVA Cummins C500D5"). When an existing record is edited, it keeps its current name unless one of those four values changes.
*Connected change.* Everything that shows an asset's name (movement history, stock counts, disposal requests, usage readings) keeps working because the name still exists on the record, it is just no longer typed in.
*Be aware.* The details page still shows a read-only "Tracking Method: Serialized" line. Only the form was changed.

### 1 Oct, 3:00 PM: Heavy equipment is now identified by a Serialized ID on the listing and the details page
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** NEW

*Why.* With the item code and asset ID gone from the form, a reviewer still needs a way to tell two units of the same model apart and to quote one unit. The unique ID the system generates for each physical unit is now shown as the **Serialized ID**.
*What we did.* The Heavy Equipment Fixed Asset listing has a new first column, **Serialized ID**, and the details page shows it in place of the old Item Code. It is the same unique number the rest of the POC uses for that unit (for example in stock counts and disposal requests), so nothing needs to be re-linked.

### 1 Oct, 3:00 PM: Item categories now have a Category Type: Normal or Heavy Equipment
**Where:** Inventory & Fixed Assets > Product Management > Item Category
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*The problem.* The category list was one mixed list. The Heavy Equipment Fixed Asset form offered categories like Spare Part, Consumable and Fuel, and the standard item form offered Generator and Vehicle, even though each form is meant for one kind of thing.
*What we did on the Item Category screen.* Added a **Category Type** dropdown (Normal or Heavy Equipment), in the same style as the Count Type dropdown on the stock count. It is required on a top-level category. A sub-category always follows its parent's type, so the dropdown is locked for it, and changing a parent's type updates its sub-categories. The list has a new Category Type column and a filter, and the details page shows the type. As a starting point, Generator, Vehicle, POD, Spare Engine, Trolley and Day Tank are Heavy Equipment, and everything else is Normal.
*What we did on the Items forms.* The Heavy Equipment Fixed Asset form now offers only Heavy Equipment categories, and the standard Add Item form offers only Normal categories. An existing record whose category is not in its form's list still shows that category when it is opened, so nothing looks blank.
*Be aware.* The requirement document does not mention a category type, so the dropdown carries a note: rule to be confirmed with client. Because Generator is now a Heavy Equipment category, a new standard item (for example an Inventory Fixed Asset) can no longer be created under it. Heavy Equipment Pricing was not changed, since it also prices rental cables and panels, so it still lists every category.

### 1 Oct, 1:13 PM: Every difference in a count now needs a reason
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Type:** NEW

*The problem.* When a count found a difference, the screen recorded the numbers but not why they differed. An approver could not tell a real loss from a recording mistake. A single reason for the whole session would not have helped either, because one count can contain differences with different causes (one item lost, another simply miscounted).
*What we did.* The reason is recorded **per line with a difference**, in both kinds of count.
- **Stock Items counts:** a **Reason** dropdown appears on any line where the counted quantity differs from the system quantity, and stays empty ("-") on matching lines. The choices are Lost or stolen, Damaged, Miscount or recount needed, Unposted delivery or movement, and Other.
- **Fixed Assets counts:** a Reason dropdown appears on any unit that is Not Found or Found elsewhere. The two cases have their own lists, because the causes differ. Not Found: Lost or stolen, Sent out and not recorded, Recording error, Other. Found elsewhere: Moved without being recorded, Wrong location recorded, Other. Changing a unit's result clears its reason so an old reason cannot stay attached to a new result.
- **Required to complete.** A count cannot be completed while any line with a difference has no reason, and the screen tells the counter exactly that.
- The view page shows the reason beside each difference, and the sample counts all have reasons filled in.
*Be aware.* The requirement document does not define reasons at all, so the lists above are our proposal. The screen says so with a visible note ("reason list to be confirmed with client"). The reason is a label for the approver and the report. It does not change how stock or assets are corrected on approval, and it does not post anything to accounting.

### 1 Oct, 1:13 PM: The variance report shows the reason for each difference
**Where:** Inventory & Fixed Assets > Reports > Physical Stock Variance Report
**Type:** NEW

The Physical Stock Variance Report has a new **Reason** column next to Variance, for both stock differences and fixed asset differences, so anyone reading the report can see why each difference happened as well as how big it was. It reads the same live counts as the Stock Count screens.

### 1 Oct, 1:00 PM: The detailed changelog can be filtered by module, side menu and change type
**Where:** POC Review Tools > Change Register > Detailed changelog
**Type:** NEW

*The problem.* The changelog was one long document. To find out what changed on a particular screen you had to read all of it.
*What we did.* The detailed changelog page now has the same pill filters as the Change Register, plus one more level. You pick a **module**, then (for that module) a **side menu group** and, where the group has several screens, the **screen**, and finally a **change type** (NEW, EXISTING WITH CHANGE and so on). Each pill shows how many entries it holds. Every entry shows where it happened as clickable chips that open that screen in the POC.
*How it works.* Each entry in this file carries a **Where** and **Type** line (see the top of this file). The page reads those lines, so adding a new entry with those two lines makes it appear in the filters automatically.
*Be aware.* Only the Inventory & Fixed Assets module has been built so far. The other modules still show only a placeholder dashboard, so their filters show zero entries.

### 1 Oct, 12:56 PM: The detailed changelog can be read from inside the POC
**Where:** POC Review Tools > Change Register > Detailed changelog
**Type:** NEW

*The problem.* The Change Register shows a short table of what is new or changed, but the full story of what changed and why only lived in the `CHANGELOG.md` file, which reviewers could not open from the POC.
*What we did.* Added a **View detailed changelog** button at the top right of the Change Register. It opens a new reading page (`#/change-register/changelog`) that shows the whole changelog as a formatted document, with a link back to the Change Register. The page reads `CHANGELOG.md` directly, so whenever we add an entry to the file and redeploy, the page shows it.
*Be aware.* The POC cannot add outside libraries, so the page uses a small built-in formatter that handles what the changelog uses (headings, paragraphs, bold, italic, code and bullet lists). If we start using tables or images in the changelog, the formatter will need extending.

### 1 Oct, 12:44 PM: A count now compares against what that location actually holds
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Type:** NEW

*The problem.* Every item had one stock number shared by the whole company. Counting Oil Filters at Jebel Ali showed 14, and counting them at Sharjah also showed 14. Worse, approving a correction at one yard overwrote the single number, which silently changed the figure for every other yard.
*What we did on the count screen.* Each item now has a stock quantity per location (for example Oil Filter: Jebel Ali 14, Sharjah 6, Abu Dhabi Mussafah 4, total 24). The Start Count form loads the quantities for the chosen location only, so Jebel Ali, Sharjah and the fuel depot each show their own figures. When a stock adjustment is approved, only that location's quantity is set to the counted figure. The item's total then moves by the same difference, so the total and the locations always agree.
*Be aware.* Items with a system quantity of zero at a location are still not listed for counting. The matching change on the Items screen is logged in the next entry.

### 1 Oct, 12:44 PM: Item stock is now shown per location
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** EXISTING WITH CHANGE

*Why.* The count screen now works location by location (see the entry above), so the item's own page needed to show the same numbers, otherwise a reviewer could not see where the stock really sits.
*What we did.* The item's view page (Inventory tab) now has a **Location wise stock** table under the total, and the total is labelled "Stock on Hand (all locations)". The existing ERP already shows stock by location on item pages, so this is not a new idea, it just makes the new numbers visible.
*Be aware.* The total is now the sum of the locations, so some totals look larger than before (Oil Filter went from 14 to 24). Jebel Ali keeps the old figures, so the earlier sample counts still line up.

### 1 Oct, 12:44 PM: A count can now record who confirmed it
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Type:** NEW

*The problem.* The form only had "Counted By", the person who did the counting. The requirement document's role table says the Fleet / Asset Manager confirms physical stock counts, which is a separate step: the counter reports the numbers and a manager accepts them as valid.
*What we did.* Added a **Confirmed By** field on the Start Count Session form. It is required to complete the count, and it shows on the count's view page next to Counted By. The sample counts have a confirmer filled in.
*Be aware.* The document does not spell out exactly how confirmation works, so the field carries a visible note: "exact rule to be confirmed with client". It is a simple field for now, not a separate approval step.

### 1 Oct, 12:44 PM: The Physical Stock Variance Report now reflects real activity
**Where:** Inventory & Fixed Assets > Reports > Physical Stock Variance Report
**Type:** NEW

*The problem.* The report was built from fixed sample data, so creating, approving or rejecting a count changed nothing in it.
*What we did.* The report now reads the same list of counts that the Stock Count screens use, each time it is opened. A count you complete, approve or reject appears in the report straight away, with the right status. If the Stock Count screens have not been opened yet, it shows the sample counts.
*How we checked.* Replacing the list of counts in a test changes the report's rows.

### 1 Oct, 12:12 PM: Heavy equipment can now be counted, unit by unit
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Where:** Inventory & Fixed Assets > Product Management > Items
**Where:** Inventory & Fixed Assets > Reports > Physical Stock Variance Report
**Type:** NEW

*The problem.* The count could only handle stock quantities (for example 14 oil filters). Heavy equipment was left out completely, because each generator or truck is a single, individually tracked asset. Saying "we have 6 of them" is not useful when every unit has its own record, status and history. So none of the fleet was ever being verified.

*What we did on the count screen.* The start form now has a **Count Type** choice: Stock Items or Fixed Assets. When you choose Fixed Assets and a location, the screen lists the units that the system expects to be at that location. "Expected" means the latest entry in the unit's Movement History says it is there. Units out on hire at a client are not listed, because they are not supposed to be in the yard, and units already disposed of are not listed either.

For each unit the counter picks one of three results:
- **Found**: it is where the system says it is.
- **Not Found**: it is not there.
- **Found elsewhere**: it is somewhere else, and the counter says where.

The count cannot be completed until every unit has a result, and a "Found elsewhere" unit must have the place it was found. The sessions list has a new Count Type column, and the Items Covered and Lines with Variance columns count assets for asset counts. A sample asset count (`SCS-26-00005`, Jebel Ali Main Yard, one unit found elsewhere, one not found, waiting for approval) shows the approval.

*What happens on the Items screen after approval.* This is where the count connects to the heavy equipment records:
- A **Found elsewhere** unit gets a new correcting entry in its **Movement History** (an Internal Transfer from the counted location to where it was found, pointing back to the count session). The asset's Current Location then updates by itself, because the location is always read from the latest movement. The old entries are never edited, only added to.
- A **Not Found** unit only gets a note in its audit trail saying it was missing in the count and needs follow-up. Its **Asset Status is not changed**. The requirement document says the system must never dispose of an asset by itself, and a disposal needs its own approved request, so a missing asset must go through a Disposal Request before it can be marked Disposed.
- A **rejected** count changes nothing on any asset.
- **Safety check.** If a unit has moved since the count was done (for example it was delivered to a client in the meantime), approving the count skips that unit instead of overwriting its newer history. The approval history says how many units were skipped.

*What we did on the report.* The Physical Stock Variance Report now includes asset counts: a unit that was not at the counted place shows as system 1, counted 0, variance minus 1, with where it was found if known.

*Be aware.* The requirement document does not define how individual assets are counted. This is our reading of it, and the screen says so with a visible note ("Rule to be confirmed with client"). Things deliberately left out: adding an unexpected asset found during a count, a "Lost" or "Missing" asset status, a "Lost" reason on disposal requests, and automatically raising a Disposal Request.

### 1 Oct, around 12:00 PM: The count now has the approval steps the rest of the POC already has
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Where:** Inventory & Fixed Assets > Reports > Physical Stock Variance Report
**Type:** NEW

*The problem.* When a count found a difference, a Stock Adjustment could be raised, but it only had an Approve button. The requirement document says the adjustment must follow "the same approval framework used elsewhere" and that the system quantity must never be silently overwritten. The Asset Disposal Request screen in this POC already works that way, with Approve, Reject and a history of who did what.

*What we did on the count screen.*
- Added a **Reject** button, with a confirmation, next to Approve. Rejecting leaves the system quantity untouched.
- Added an **Approval History** panel showing, in order, when the adjustment was raised and who approved or rejected it.
- Added a **Rejected** status. It shows in red in the sessions list, using the colours the POC already uses for rejected items.
- Added a short on-screen note saying that what happens to a rejected difference (for example whether it can be raised again) still needs to be confirmed with the client. Today a rejected adjustment cannot be raised again.
- The requirement document says a count is a header record that is auto-generated and covers a date, a location and the items covered. The start form now shows a read-only **Stock Count Session** field ("Auto-generated", then the real number once saved) and an **Items Covered** field. The view page also shows Items Covered.
- To make every state visible we added a rejected sample count (`SCS-26-00004`, Sharjah Yard) and approval history to the two existing sample counts.

*What we did on the report.* The Adjustment Status column of the Physical Stock Variance Report shows the new Rejected state.

### 1 Oct, 11:39 AM: Item type renamed to "Heavy Equipment Fixed Asset"
**Where:** Inventory & Fixed Assets > Product Management > Items
**Type:** NEW

On the 30 September call Ajin made it clear that this is the fixed asset form brought across from accounting, not a general "heavy equipment" item. The item type was called "Heavy Equipment"; it is now called **Heavy Equipment Fixed Asset** everywhere users can see it: the type chip and filter on the Items list, the Add button, the page headings, messages, and the small requirement badges used in review mode. Internal links and storage names were left as they were, so nothing broke.

### 1 Oct, 11:39 AM: "Pricing Master" renamed to "Heavy Equipment Pricing"
**Where:** Inventory & Fixed Assets > Product Management > Heavy Equipment Pricing
**Type:** NEW

Following the 30 September call, where Ajin called it "Heavy equipment pricing", the screen is now named that way in the sidebar, the page title, the add and edit headings and the change register.
*Be aware.* It is still a sidebar item. Ajin talked about it living in the Items type dropdown instead. That has not been changed and is an open point.

### Open points for Physical Stock Verification
**Where:** Inventory & Fixed Assets > Operations > Physical Stock Verification
**Type:** NEW

Not yet decided or built: listing items whose system quantity at a location is zero. The reason lists also still need the client's confirmation.
