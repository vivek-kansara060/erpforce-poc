# Existing ERP baseline: Rental (source: modules/rental, branch spar-arabia with SPAR rental-invoicing work)

## Sidebar as-is
Rental Dashboard | Product Management: Items, Category | Demand Planning | Invoicing: Invoicing Rental Order, Previous Jobs | Rental: Leads, Opportunity, Quotations, Orders | Agreements | Purchase: Request for Quote, Orders | Cross Hire: Requests, Process Cross Hire, Request for Quote, Orders | Settings: Settings, Billing Cycle, Terms and Conditions, Forms, Template Editor | Reports (12).

## Rental Orders (`/orders`)
- List toggle Rental Orders / Replacement Orders. Columns: series number, date, customer, payment term, company, currency, expiration date, salesperson, status, invoice status, delivery status, amounts, start/end date time, total period, billing cycle, last/next invoice date.
- Statuses: Draft, Approved, Completed, Pending, Submitted, Open, Delivered, Pending Return, Returned, Expired, Rejected, Cancelled, Closed. Invoice status: Pending Invoice / Partially Invoiced / Fully Invoiced. Delivery status: Pending delivery / Partially delivered / Fully delivered.
- Form tabs: Basic Details (ID, Date, Customer, Payment Terms, Company, Currency, Exchange Rate, Expiration Date, T&C, Sales Person, Reference Number, Narration; Rental Period: Start Date Time, End Date Time, Total Period; Billing: Billing Cycle, Last/Next Invoice Date, Invoicing Type Automatic/Manual; Classification: Location, Department; Items; Delivery; Attachment), Address and Contact, Shipping, Promotions.
- Item table: S.No, Item, UOM, Description, Quantity, On Hand, Available, Cross Hire, Reserved, Price List (rental period), Rate, Total Amount, Location, Department, Narration.
- View tabs: Basic Details, Address and Contact, Shipping, Promotions, Scheduled Invoices (SPAR: schedule cards, summary tiles Total scheduled / Total amount / Overdue / Next due, filters All/Overdue/Upcoming, Add Schedule, Start Invoicing modal that blocks further deliveries).
- Header buttons by status: Edit, Close, Delete, Sync Quotation, Generate Picking List, Cross Hire Request (selected lines), Create dropdown (Quick Delivery, Delivery, Advance, Invoice / Next Invoice, Replacement Quotation), View dropdown (GRN, Delivery, Invoices), Quality Check (stub), Print, Send by Email.
- NOT existing: Hold status, Active/Inactive flag on asset, Extension Request, Early Termination Request, replacement from the order as an in/out asset transaction, Sales Order Asset Ledger, Invoice Cycle Pause, overdue flag / fault attribution / escalation threshold, Return initiated from the order with two-stage inspection.

## Delivery Orders (rental, `/orders/:id/delivery-orders`)
Statuses Draft, Pending, Picked, Packed, Dispatched, Delivered. Tabs Basic Details, Address and Contact, Shipping, Packages. Transport block (Transported By, Driver, Transportation ID, Vehicle Number, Iqama, Mobile). Trace modal (Lot / Serial, Bin, Quantity). Quick Delivery modal.

## Rental Returns (GRN)
`/orders/grns`. Fields: Rental Order, Goods Receipt No., Delivery Note No., Receipt Date, Customer, PO Number, Company, Sales Person, transport fields, Location. Items with Scrapped Quantity modal. Status Pending, Validated. Buttons: Print, Create scrapped invoice, Validate, Return to vendor (dropship), Replacement (Quotation / Order).
NOT existing: Return Method, Return Entry Timestamp stopping billing, Inspection Status, Damage Charge, Operations Return Checklist, mandatory photos, Yard Inspection checklist, Return-to-Ready-for-Hire SLA.

## Quotations / Leads / Opportunities (rental variants)
Rental quotation has rental period, revised and replacement quotations; statuses Draft, Order confirmed, Under review, Submitted, Accepted, Rejected, Expired, Cancelled, Closed, Revision Created. Leads statuses New, Cold Call, Quotation Sent, Contact In Progress, Follow Up, Converted, Lost, Negotiating.

## Rental Invoicing
Invoicing Rental Order (columns: Rental Order, Date, Customer, Invoice, Start Date, End Date, Next Invoice Date, Billing Cycle, Currency, Narration; filters; Accumulate Orders, Refresh, Submit), Previous Jobs (statuses pending, processed, cancelled, failed, queued; Retry). Billing Cycle master (Name, Count, Duration, Company, Invoicing Type, Invoice Start Date option, Max Schedule Count, Initial Invoice, Prorated). Rental Settings (Enable rate below cost, Quote percentage).

## Items (rental)
No separate rental asset register: rentable units are inventory items with `is_rental` (rental_base_price, hour fine, day fine, security time, rental prices per period Daily / Hourly / 3 Hours / Weekly / 2 Weeks / Monthly / 2 Months / Half Yearly / Yearly). Item types Inventory, Assembly, Inventory Fixed Asset. Availability only via order item quantities and Asset Availability report.

## Rental Agreements
Vendor-side agreements for cross hire. Fields: ID, Date, Name, Type (Contract/Blanket), Vendor, Valid Up To, Company, Currency, Payment Terms, Incoterms, Start/End Date, Total Period, items (Item, Vendor, UOM, Duration, Rate, Min Order Qty). Statuses Draft, Pending, Pending Approval, In Progress, Confirmed, Closed, Expired, Approved, Rejected.

## Cross Hire (EXISTS in full, inside Rental)
- Requests (from rental order lines or manual): statuses Draft, Pending, In Progress, Pending Approval, Completed, Rejected. Process Cross Hire (grid: Item, Rental Order ID, Request Quantity, On Hand, Available, Cross Hire Qty, Vendor, Cross Hire Type Inventory/Dropship, Unit Rate; Create Order / RFQ). RFQ (responses, analyze, award). Orders (Hire Order Number, Rental Order(s), Supplier, Cross Hire Type, dates, T&C, Agreement, Currency, payment terms; statuses Draft ... Closed; billing/receiving status), GRN, Delivery Orders, Allocations modal, Profitability modal (Vendor Cost, Customer Revenue, Profit, Margin %), Mark Shipped, Return to Procurement Vendor Returns.
- NOT existing as such: the five-stage lifecycle Request / Received / Allocated / Returned to Us / Returned to Supplier with condition check, Re-Issue Reference, supplier dispute charge, cost roll-up to originating Sales Order, Cross-Hire Idle flag.

## Demand Planning, Reports, Dashboard
Demand Planning (Item, Demand, On Hand, On Order, Available, Committed, PR, Required; detail per transaction). 12 reports: Rental Payment Aging, Rental Asset Return, Rental Agreement Detail, Asset Category Performance, Rental Cancellations and Amendments, Active Rentals, Rental Agreement, Upcoming Expiry, Rental Revenue, Asset Availability, Asset Utilization, Customer Rental. Rental dashboard is static sample tiles (revenue, expenses, net profit, area chart, donuts).
NOT existing: Replacement History, Cross-Hire Frequency, Sales Order Asset Ledger, Logistics Cost and Profitability reports; Fleet Status, Logistics/Fleet Availability, Renewal and Overdue, Maintenance/Breakdown, Cross-Hire Cost vs Rental Revenue dashboards. No maintenance module, no fleet vehicle/driver job status, no fuel delivery records, no hour-meter service scheduling, no security deposit/damage/inspection.
