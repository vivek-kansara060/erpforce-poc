# Existing ERP baseline: CRM / Sales (source: analysis of erpforce-fe modules/crm, branch spar-arabia)

The CRM module is the "Sales" module. `modules/quotes` is an unrelated scaffold. Rental has its own Leads/Opportunity/Quotations/Orders (see rental.md); CRM screens filter `is_rental=0`.

## Sidebar as-is
Dashboard | Sales Forecast (commented out, no screen) | Orders: Lead, Opportunity, Quotation, Sales Orders, Delivery Orders, Customer Returns | Master Data: Customer Management | Reports (15) | Settings: Shipping Rule, Promotions, Customer Segments, Delivery Settings, Terms and Conditions, Forms, Template Editor (Emails, PDF).

## List pattern
ActionBar (title, saved views, search, filter, Add, Import, Export) + table (column chooser, row menu Edit / Duplicate / Delete) + footer pagination. Kanban/Calendar views disabled on Lead, Quotation, Sales Order, Delivery Order.

## Lead (`/orders/lead`)
- List columns: ID, Name, Company, Lead Status, Owner, Source, Status (Draft/Active/Inactive).
- Form tabs: Basic Details, Address, Contact. Fields: Lead Type (Company/Individual), ID, names / Company name, Phone, Email, Entity, Website, Currency, Lead Status, Conversion Probability, Reference Number, Priority (Low/Medium/High), VAT Number, CRN, Responsible Person. Accordions: Attachments (+Active toggle), Owner Details (Salesperson, Lead Source, Industry, Annual Revenue, Narration), Follow Up (table + modal: Call/Email/Personal Meeting, reminder), Classification (Department).
- Statuses: Cold call, Quotation sent, Contact in progress, Follow up, Converted, Lost, Negotiating, Not qualified. Sources: Search engine, Lead recall, Newsletter, Facebook, Twitter, Linkedin.
- Communication Log modal (title, type Phone call/Email/Face to face/Virtual, agenda, date, time, venue). View: Convert button opens Add Opportunity. Save as Draft / Save.
- NOT existing: Activity Type multi-select, Lost Reason, Next Follow-Up Date field, Tags, duplicate detection, lead-to-customer conversion.

## Opportunity (`/orders/opportunity`)
- List columns: ID, Customer, Company, Expected Revenue, Stage, Closing Date, Contact Name, Salesperson. "View Sales Pipeline" (read-only kanban).
- Stages: Qualified, Proposal, Negotiation, Closed-won, Lost. Win/Loss reasons list. Priority.
- Tabs: Basic Details, Address, Contact, Promotion. Fields: ID, Customer, Expected Closing Date, Expected Revenue, Stage, Probability, Win/Loss Reason, phone, email, Company, Website, Currency, VAT, CRN, Exchange Rate, Reference Number, Priority. Accordions: Attachments, Owner Details, Classification, Items (table: item, UOM, qty, rate, discount, tax, total ...), Follow Up.
- View: Make Quotation / View Quotation. NOT existing: Activity Type, Rating, Equipment Group/Category, FOC indicator, Win Probability slider driving forecast, Sales Forecast Value, Location/Site, LPO fields, approval flag.

## Quotation (`/orders/quotation`)
- List columns: Series Number, Date, Customer, Status, Salesperson, Company Name, Total Value.
- Statuses: Draft, Submitted, Under review, Accepted (shown "Approved"), Rejected, Order confirmed, Expired, Cancelled, Closed, Revision Created.
- Tabs: General Details, Address, Shipping, Promotion. General: ID, Opportunity, Transaction Type (Cash/Credit), Customer, Payment Terms, Company, Date, Posting Time, Expiration Date, Delivery Commitment Date, Currency, Exchange Rate, Salesperson, Reference No, Recurring, Status, Version, VAT, CRN, Quote Percentage, Terms and Condition, Narration. Accordions: Classification, Items (Item, Qty, UOM, Rate, Tax, Total, description, dates, discount, tax template, location, department, narration), Discounts (additional discount %, round off), Upload.
- View actions: Print, Proforma Invoice, Send by Email, Cancel, Close, Create Order, Create Revision (version field, View Revision), Create Invoice, Submit for Approval / Quick Approval, Approve/Reject.
- NOT existing: per-line Activity Type, Group + Category selection, Package Builder, Contract Type (per line), Allocation Tag, Document Template selector (only T&C select), Quotation Valid Until as mandatory aging driver, Prepared By block, Push Amount to Opportunity, VAT Type Standard/Export, FOC per line, version history with field-level audit.

## Sales Order (`/orders/sales-orders`)
- List columns: ID, Date, Customer, Sales Order Status, Invoice Status, Delivery Status, Salesperson, Company, Total Amount.
- Status: Draft, Pending, Submitted, Approved, Rejected, Open, Completed, Closed. Invoice status: Pending Invoice, Partially Invoiced, Fully Invoiced. Delivery status: Pending Delivery, Partially Delivered, Fully Delivered.
- Tabs: Basic Details, Address and Contact, Shipping, Promotions. Basic: ID, Opportunity, Quotation, Transaction Type, Customer, Date, Posting Time, Payment Term, Company, Currency, Exchange Rate, Expiration Date, Salesperson, PO Number, Recurring, Terms and Condition, Narration; accordions General, Classification, Items (S.No, Item, Qty, Remaining Qty, UOM, Rate, Tax, Total, Description, dates, Available/On Hand/Reserved/Back Ordered/Invoiced/Delivered, discounts, Location, Department), Delivery, Discounts, Attachment.
- View header: Submit / Quick Approval / Accept / Reject / Close / Print / Generate Picklist; Create dropdown (Quick Delivery, Delivery, Advance, Invoice); View dropdown (Opportunity, Delivery Orders, Invoices); Customer Return when Completed. Quick Delivery modal (Date, Delivery Date, PO No, PO Date, Transported By, Driver, Vehicle, Iqama, Mobile).
- NOT existing: line-level Activity Type / Contract Type / Contract End Date / Billing Structure, Order Status Partially Delivered/Confirmed (has header statuses above), Assigned Asset / Allocation Tag, Certificate/Compliance rollup, Billing Cycle reference per delivery, editable Order Number/Date, LPO Expiry Date, multiple item descriptions, document uploads (DO/CN/Invoice/CN/LPO/Quote), live DO side panel, Sales Order Asset Ledger.

## Delivery Order (`/orders/delivery-orders`)
- List columns: ID, Date, Sale Order, Status, Salesperson, Customer, Location, Company. Status: Picked, Packed, Dispatched, Delivered (Validate step).
- Tabs: General Details, Package, Address, Shipping, Promotion. General: ID, Date, Customer, Sales Order, Operation Type, Salesperson, Company, Reference Number, Status, PO Number, PO Date, Narration; Transportation (Transported By, Driver, Vehicle Number, Iqama/Resident Number, Mobile); Items (Item, UOM, SO Line, Quantity, On Hand, Reserved, Remaining, Delivered Qty, Location, Package, Trace Details lot/serial/bin).
- NOT existing: Delivery Type Full/Partial, asset picker constrained to confirmed Category, ad hoc accessories tag, Transport Type Own Fleet/External + External Transport Cost, Delivery Condition Attachments, Customer Signature (e-signature), Delivery Status Acknowledged.

## Customer Returns (`/orders/customer-returns`)
- RMA with GRN sub-document. List: ID, Date, Customer, Salesperson, Sale Order, Company, RMA Status (Draft, Pending, Pending Approval, Pending Receipt, Pending Credit, Return Completed, Completed, Rejected). Form: ID, Date, Customer, Shipping Address, Operation Type, Salesperson, Company, Reference Number, Currency, Exchange Rate, Narration, Items. Flow: approval, GRN, validate, credit note.
- NOT existing: Return Method, Inspection Status, Damage Charge, Operations Return Checklist, Fuel Note, entry from Rental Order.

## Customer Management (`/master-data/customer-management`)
- Server form-builder driven (Individual/Company switcher). List: ID, Name, Phone Number, Emails, Salesperson, Status. View: Summary/Activity, ageing, bank accounts, transactions, sold items.
- NOT existing: credit limit field, Cost Centre/Project per site, KPI summary, Active/Inactive history log, sales/returns/asset-status history filtered by Activity Type.

## Reports (15, all existing)
Sales Order Summary, Delivery Order Report, Sales Invoice Summary, Sales Order Detail, Sales Invoice Detail, Sales by Salesperson Performance, Pending Quotes and Approvals, Sales Return / Credit Note, Regional / Branch Sales Performance, Sales Discount and Promotion Analysis, Sales Channel Analysis, Order Fulfillment and Delivery, Sales Commission and Incentive, Sales by Product/Service, Customer Churn and Retention. NOT existing: lead/opportunity/funnel/win-loss/conversion/aging/credit reports.

## Dashboard / other
CRM dashboard is hard-coded mock (4 KPI cards, revenue area chart, top 3 products / salespeople donuts). Sales Forecast routes render nothing. Approval: submit / quick approval / accept / reject on Quotation, Sales Order, Customer Return. Settings screens exist (Shipping Rule, Promotions, Customer Segments, Delivery Settings, T&C, Forms, Template Editor).
