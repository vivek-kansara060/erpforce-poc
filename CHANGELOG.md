# ERPForce POC: What We Changed and Why

This is a plain-language log of every change made to the ERPForce POC (the Heavy Equipment Rental design POC). It is written so anyone can open it and understand what changed, why it changed, and how it affects the rest of the system. It only covers this POC. The real `erp-fe` and `erp-be` code has not been touched.

**How to read it.** Each entry is one change to one screen, newest first. Under every heading are two tags: **Where** (module, side menu and screen, exactly as they appear in the POC's sidebar) and **Type** (the same classification the Change Register uses: NEW, EXISTING WITH CHANGE, EXISTING, REMOVED). A change that touches more than one screen has one Where line per screen. Times are IST; "around" means the time was not written down when the work was done, so it is an estimate.

**Reading it inside the POC.** Open the Change Register and press "View detailed changelog". The page lets you filter these entries by module, by side menu and screen, and by Type.

**Where the "why" comes from.** The requirement document (`ERPForce_Heavy_Equipment_Rental_Module.md`), the description of what the existing ERP already does (`docs/baseline/inventory-fa.md`), and the two calls with Ajin on 25 and 30 September.

**Current state in one paragraph.** The POC's Inventory module has a Heavy Equipment Fixed Asset type and a Heavy Equipment Pricing screen (both named to match Ajin's wording), and a Physical Stock Verification screen that counts both stock items and individual heavy equipment assets, with per-location quantities, a confirmer, and a proper approve or reject step. Its variance report reads live data.

---

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
*What we did.* The AMC Order view now follows the Sales Order view: read-only Basic Details, Contract and Contract Value, with Edit, Generate (Job Card for the next planned visit, Invoice for completed job cards), View (Sales Order, Quotation, Opportunity, Invoices) and Actions (Send by Email, Print, Print consolidated report, Close), and new Job Cards and Invoices tabs. The Job Card is a read-only view with Complete Visit, Generate (Invoice), View and Actions (Edit, Print, Send by Email, Upload signed copy, Record Payment). The form opens only to create a job card for a planned visit (nothing is saved until Save) and through Actions, Edit until the job card is invoiced.
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
*Be aware.* The Trips list is our own design choice (not named in the requirement document). Vehicle status is derived from the trips, never typed. The Iqama field is kept for now (open question for Ajin). Data is in memory, a refresh restores the demo trips. CN-26-00123 shows two trips on purpose: a stuck first attempt and a second crane-truck trip.

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
*What we did.* The AMC item list now shows the Inventory AMC items. New sample records, all dated relative to the demo day: cross-hire orders CH-26-00008 (to receive), CH-26-00009 (for the asset form picker) and CH-26-00010 (received, unit AST-1031 ready to deliver on SO-26-00052); request CHR-26-00006 (Pending) and CHR-26-00007 (behind RFQ-26-00012, so the order created from the award is linked to SO-26-00041); AST-1019 on Hold on SO-26-00052 until its Rental Start Date; SO-26-00049 fully returned and ready to close, with returns at every step (CN-26-00123 off hire, CN-26-00122 in the yard awaiting inspection, CN-26-00121 damage charged) and CN-26-00132 damage covered by the waiver on SO-26-00046; LPO on SO-26-00041 expiring within the notice period and on SO-26-00048 expired; a Service opportunity, approved quotation QT-26-00080 and confirmed order SO-26-00051; AMC order SO-26-00050 with job cards Invoiced and Paid, Invoiced and Unpaid, Completed and Open; 1500 KVA, Quarterly, Yearly and a 500 KVA Fixed Asset Trading price; more Ready for Hire units; Off Hire, Breakdown and an end-of-life unit; count sessions SCS-26-00006 (in progress) and SCS-26-00007 (approved); disposals DSP-26-00006 (scrap invoiced), DSP-26-00007 (invoice to create) and DSP-26-00008 (draft); leads in every status; a Lost and a Negotiation opportunity; a One-time damage waiver item. CH-26-00006 is now linked to SO-26-00046 as the cover for the broken-down AST-1014. Palm Marina Development is active again. Convert is hidden on Lost, Unqualified and Not qualified leads.
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
