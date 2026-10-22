# Rental flow: test plan and test data

Activity Type = Rental. All dates below are relative to the demo day ("today"), because the POC moves every seed date forward to today. Nothing is saved after a browser refresh, so every test starts from the same data.

## Master test order: SO-26-00058 (Gulf Build Contracting)

One rental order for the whole journey. It is Confirmed, nothing is delivered, and it is linked back to its Lead (LD-26-00036), Opportunity (OP-26-00029) and Quotation (QT-26-00087). Billing Cycle Monthly, Invoicing Type Manual, contract start about 41 days ago, so a delivery dated at the contract start has its first invoice due straight away.

| Line | Quantity | Stock today | What it tests |
|---|---|---|---|
| Generator 500 KVA, AED 50,000 | 2 | 2 Ready for Hire | Delivery from own stock, Own Fleet trip, Return |
| Generator 1000 KVA, AED 98,000 | 1 | 2 Ready for Hire | Delivery, Replacement with the spare unit |
| Generator 200 KVA, AED 29,500 | 2 | 1 Ready for Hire | One from stock, one by Cross Hire |
| Generator 1500 KVA, AED 145,000 | 1 | none | Whole line by Cross Hire |
| Delivery Charge 2,000, Installation and Commissioning 3,500, Return Charge 2,000, Damage Waiver 150 a month | | | One-time and recurring charges |

Steps (tick each as you go):
1. **Chain.** Open the Sales Order. View > Opportunity and View > Quotation open OP-26-00029 and QT-26-00087; the Lead is linked from the Opportunity. Check the header: PO LPO-GBC-3305, Cost Centre, Billing section (Monthly, Manual), Scheduled Invoices empty ("starts with the first delivery").
2. **Cross Hire gap.** On the order, select the 200 KVA and 1500 KVA lines, Bulk actions > Cross Hire (selected lines). The Request form opens with both lines; Save creates ONE request with two items (200 KVA x 1 and 1500 KVA x 1, not 2 and 1: the owned 200 KVA unit covers one). The 500 KVA and 1000 KVA lines offer no Cross Hire.
3. **Request to Order.** Cross Hire Requests: submit the request. Process Cross Hire lists its two items as two rows; select both rows and Create > Cross Hire Order: one Order form opens with both items (Category, Subcategory, units); enter the supplier and the rate per unit of each row and Submit. To order only one of them now, delete the other row on the form: the request stays In Progress for it and the item is still listed in Process Cross Hire. Open the order, Submit > Quick Approval.
4. **Goods Receipt.** On each order Receive, Save the header, Track Details on the Goods Receipt view: one serial, Validate. Expect each asset on the register as Cross-Hired, Ready for Hire; order Received, Fully Received. Bill each order: Bill opens the Accounting bill form prefilled from the order; enter the supplier invoice number and save.
5. **Delivery and Fleet.** Create > Delivery, one Delivery Order for 500 KVA x 2 and 1000 KVA x 1: Date and Rental Start both set to the contract start date, Own Fleet, pick a Free vehicle from Fleet Availability, sign. A second Delivery Order for 200 KVA x 2 (pick the owned unit and the cross-hired one) and 1500 KVA x 1 (the cross-hired unit): External Transporter with a charge. Check: assets On Hire, the cross-hired units show Allocated to SO-26-00058 in their orders' Units tab, two trips exist in Fleet Management > Trips, the order status is Fully Delivered. On the trips use Start and Complete, then try Mark Stuck-Delayed, Cancel on a spare trip.
6. **Replacement.** Row menu on the 1000 KVA line > Replace asset. Pick the spare Ready 1000 KVA unit and a reason. Expect the old unit to go to maintenance, billing not paused, a replacement trip.
7. **Extension.** Extend / Terminate > Extension to a later end date, with the client's name. The contract end moves, the Scheduled Invoices tab grows.
8. **Invoicing.** Scheduled Invoices tab: the first period (contract start to a month later) is Pending. Rental > Invoicing > Invoicing Rental Order: it is listed. Submit. Expect one invoice with six rental lines at the Sales Order rates (cross-hired units billed at 29,500 and 145,000, not at the supplier rate), Delivery Charge, Installation and Commissioning and the Damage Waiver; no Return Charge yet. If every asset was delivered at the contract start: AED 407,650.00 before VAT, VAT 20,382.50, total 428,032.50. After the replacement the 1000 KVA is billed per unit for its own days. Previous Jobs shows the job; open it. Accounting > Invoices: approve, check the ledger, record a Collection.
9. **Return.** Customer Returns > Add Customer Return (or row menu > Return asset on the Sales Order, or Return Delivery on a Delivery Order). The form is the existing one: Customer Returns, Classification, Items, Attachment, with a Summary panel; the Rental Return section is added (Return Method Self-Return or Company Collection, Return Entry Timestamp, Pre-Return Site Checklist, photos, Collection Transport). Pick one 500 KVA unit and the cross-hired unit, Save. Expect status Pending, the assets Off Hire, billing stopped at the timestamp, the cross-hired unit Returned to Us on its order, and for Company Collection a Collection trip. Then Submit > Quick Approval (status Pending Receipt), Receive: the Goods Receipt form (yard and Reached Yard), Save. On the Goods Receipt Inspect each asset (tick that its serial number matches the nameplate, then Passed or Damage Found), then Validate: the return becomes Return Completed, assets go to Ready for Hire or Under Maintenance. This order carries a Damage Waiver, so damage is covered and no charge is raised; a failed collection (Collection Failed on a Company Collection before receiving) is still charged. For a chargeable damage use SO-26-00049. Check the next invoice stops billing the unit on its off-hire day.
10. **Cross-hired unit back.** Return a cross-hired unit the same way, then open its Cross Hire Order > Units: Record Return to Us (yard checklist), then Re-Issue to another project (pick SO-26-00055) or Return to Supplier with a dispute charge. A dispute raises a supplementary bill and the order closes when all its units are back.
11. **Close.** When every asset is returned, the last schedule period is the final one and carries the Return Charge. Close the Sales Order (Actions > Close).
12. **Reports.** CRM > Reports: Order Profitability, Logistics Cost, Cross-Hire Frequency, Asset Ledger; Rental dashboards: Fleet Status, Cross-Hire Cost vs Revenue. Accounting > Reports: Aged Receivable and Customer SOA for Gulf Build Contracting.

## Test data (already in the POC)

| Document | What it is for |
|---|---|
| SO-26-00055 (Desert Pearl Hotels) | Cross Hire. Line 1: Generator 1500 KVA x 2, no unit Ready for Hire anywhere. Line 2: POD 20 ft POD x 1, its only unit is under maintenance, and a request and a RFQ are already prepared for it. Nothing delivered. |
| CHR-26-00008 and RFQ-26-00013 | Prepared chain for the POD: request Completed, RFQ Pending Order, awarded to Gulf Genset Rentals at AED 4,800 (Falcon quoted 5,200). Use Create > Order on the RFQ. |
| CH-26-00009 | Order waiting for approval (Pending Approval). |
| CH-26-00008 | Approved order with no goods receipt yet (use Receive). |
| CH-26-00010 | Received, unit AST-1031 is Ready for Hire. |
| CH-26-00007, CH-26-00006 | Unit allocated, and unit returned to us (idle at our yard), for Return to Us, Re-Issue and Return to Supplier. |
| SO-26-00057 (Al Safa Power) | Billing Cycle Weekly, Invoicing Type Automatic, one 100 KVA delivered 14 days ago. Its first week ends today: the scheduler raises it when the app opens. |
| Failed job | A Failed job for SO-26-00046 (invoice could not be saved) to test Retry. |
| SO-26-00056 (Emirates Infrastructure LLC, the same customer as SO-26-00049) | Invoicing. Billing Cycle Monthly, Invoicing Type Manual. Rental Start about 37 days ago for AST-1051 (500 KVA) and AST-1053 (200 KVA), about 26 days ago for AST-1052 (500 KVA, mid-cycle). AST-1053 was returned about 18 days ago. Delivery Charge and Return Charge lines and a monthly Damage Waiver. Nothing invoiced yet, the first period has ended, so it is Due and listed in Invoicing Rental Order. |
| Other rental orders | Seeded invoice history, one Due order (SO-26-00046) and orders not due yet, for comparison. |

## Flow 1: Lead, Opportunity, Quotation, Sales Order

1. CRM > Lead. Open LD-26-00033 (Emirates Infrastructure LLC, Activity Rental). Convert. Expect an Opportunity with the same customer, contact and Activity Type.
2. In the Opportunity add a rental item: Generator, 500 KVA, quantity 1. Save. Click Make Quotation. Expect a Quotation with Contract Type, Contract Start and End and the item lines.
3. In the Quotation set Cost Centre / Project, a price, Document Template. Submit for Approval, then Approve.
4. Create Order. Expect a Sales Order, status Confirmed, with a Billing section showing Billing Cycle Monthly and Invoicing Type Manual.
5. Open the Sales Order, Edit, enter PO Number, LPO Date and Expiration Date. Save.
6. Check: no Billing section on the Quotation; no Billing section on an AMC or Trading Sales Order; Cross Hire actions only on the rental order.

## Flow 2: Sales Order to Rental Invoicing (schedules, jobs, Automatic, Accumulate)

Rental > Settings > Billing Cycle holds the cycles (Monthly, 2 Months, Quarterly, Weekly, Calendar Month Prorated). A Sales Order picks one in its Billing section; that sets the Invoicing Type (changeable per order) and the invoice schedule.

A. Schedule and manual invoicing (SO-26-00056, Monthly, Manual)
1. Open SO-26-00056. Billing section: Monthly, Manual, Next Invoice Date. Open the **Scheduled Invoices** tab: the first period is Pending with its amount, followed by the next periods up to the cycle's Max Schedule Count (12). The Asset Ledger tab shows three assets, AST-1053 with Billing Stopped.
2. Rental > Invoicing > Invoicing Rental Order. Next Invoice Date is today. SO-26-00056 is listed as Recurring, Manual. Change Next Invoice Date to a future date to see later schedules; use the Customer and Subsidiary filters.
3. Tick it and Submit, Proceed. Expect one Pending invoice: AST-1051 30 of 30 days, AST-1052 19 of 30 days, AST-1053 19 of 30 days (stops the day before off-hire), Delivery Charge once, Damage Waiver for the month, no Return Charge (two assets still out). Before VAT AED 101,997.35, VAT 5,099.87, total 107,097.22.
4. Rental > Invoicing > Previous Jobs. A new job (Processed, Manual) is at the top. Open it: one line with the period, Processed, and the invoice link.
5. Back on the Sales Order, Scheduled Invoices: the first period is Processed with the invoice number, the next one is Pending. The Billing section shows Last Invoice Date.
6. Accounting > Invoices: the invoice is Pending. Approve it (Quick Approval), check View Accounting Ledger (Dr Receivable, Cr Rental income, Cr Output VAT, Cost Centre). Record a Collection and check the Sales Order Invoices and Asset Ledger tabs.
7. Return AST-1051 and AST-1052 from the Sales Order. The schedule stops at the last off-hire day; the final period includes the Return Charge and bills to the day before off-hire.

B. Automatic (SO-26-00057, Weekly, Automatic)
1. Reload the app. The scheduler runs when the app opens: Previous Jobs shows a job "Processed, Automatic" run by System (scheduler) with an invoice for SO-26-00057 (a week of one 100 KVA unit).
2. Open SO-26-00057, Scheduled Invoices: the first week is Processed, the next weeks are Pending. Invoicing Rental Order no longer lists it for today.
3. Previous Jobs > Run scheduler now: with nothing due it says so. Move Next Invoice Date on Invoicing Rental Order a week ahead: the next week is listed, but the scheduler only raises it on its date.

C. Failed job and Retry (SO-26-00046)
1. Previous Jobs shows a Failed job. Open it: the line for SO-26-00046 is Failed with the reason.
2. On Invoicing Rental Order the same schedule is listed with a Failed tag, and the Sales Order Scheduled Invoices tab shows it Failed.
3. Retry on the job line. Expect an invoice, the line Processed, the job Processed, the schedule Processed.

D. Accumulate Orders
1. Invoicing Rental Order lists SO-26-00049 and SO-26-00056, both for Emirates Infrastructure LLC. (Do this before test A step 3, or use Next Invoice Date a month ahead to list later schedules.)
2. Accumulate Orders, choose Emirates Infrastructure LLC, tick one schedule for each order, enter a Nature of goods title, Generate Invoice. Expect one invoice with the lines of both orders, one job (Processed, Accumulated), and each order's Scheduled Invoices tab showing its period Processed with the same invoice number. Each order's next period moves on by itself.

E. Billing Cycle master
1. Billing Cycle > Add New: Name "10 Days", Count 10, Duration Day, Manual, From delivery. Save.
2. On a new rental Sales Order or on SO-26-00055 (nothing delivered, cycle not locked), pick it in the Billing section. After the first delivery the schedule is 10-day periods.
3. Try deleting Monthly: it is blocked while orders use it.
4. Calendar Month Prorated (Initial Invoicing on, Prorated): the first period runs to the end of the month, then calendar months.

F. Delivery Order test: create a Delivery Order for a rental order and check the Rental Start, that the asset goes On Hire, and that the schedule starts at the first Rental Start (From delivery).

## Flow 3: Cross Hire, then Delivery, then Invoicing

A. Direct order (SO-26-00055, line Generator 1500 KVA x 2)
1. Open SO-26-00055. The line shows Cross Hire; the POD line does not (already covered by CHR-26-00008). Row menu > Cross Hire. Pick a supplier or leave blank. Expect a request for 2 units.
2. Rental > Cross Hire > Cross Hire Requests. Open it, Submit. Create > Order. Order status Pending.
3. Open the order, Submit > Submit for Approval, then Accept (Accept and confirm). Status Approved. Check that Receive is available and Bill is available.
4. Receive. Save the Goods Receipt header. On Track Details enter one serial (FAL-1500-01), Validate. Check: order Received, Receiving Status Partially Received, one asset on the register (Cross-Hired, Ready for Hire), Remaining 1.
5. Receive again, enter serial FAL-1500-02, Condition Damaged, Validate. The unit enters as Under Maintenance, order Receiving Status Fully Received.
6. Bill, enter a supplier invoice reference. Accounting > Bills shows a Pending bill. Order status Billed.
7. Sales Order > Deliver (or Create > Delivery). Select the cross-hired 1500 KVA unit. Save with a Rental Start date. Check: the asset is On Hire, the order's Units tab shows the unit Allocated to SO-26-00055, the Sales Order Cross Hire tab shows the unit and its cost.
8. Rental invoicing: Invoicing Rental Order shows SO-26-00055 once the period has ended. For a quick check use a Rental Start in the past on the Delivery Order. Run Invoicing and check the customer is billed at the Sales Order rate, not the supplier rate.
9. Return the unit from the Sales Order, then in the order's Units tab: Record Return to Us (yard checklist), then either Re-Issue to another project (pick another rental order) or Return to Supplier (with or without a dispute charge). Check the dispute creates a supplementary bill and the order closes when all units are back.

B. Through the RFQ (SO-26-00055, line POD)
1. Cross Hire > Request for Quote > RFQ-26-00013. Status Pending Order, awarded to Gulf Genset Rentals. Analyze & Award shows both responses with Lowest tags.
2. Create > Order. The order form opens prefilled (supplier, rate, period). Submit, then approve, Receive, Validate, Bill, Deliver as above.

C. Other checks
- Cross Hire > Process Cross Hire shows In Progress requests; create an order from several at once.
- Add a request on SO-26-00052 line 100 KVA: not offered, because CH-26-00008 and CH-26-00010 already cover it.
- Sales Order of Activity Type Trading or AMC: no Cross Hire option anywhere.

## Expected results to compare against

| Check | Expected |
|---|---|
| SO-26-00056 first invoice, before VAT | AED 101,997.35 |
| VAT 5% | AED 5,099.87 |
| Total | AED 107,097.22 |
