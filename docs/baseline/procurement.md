# Existing ERP baseline: Procurement (source: modules/procurement; rental-scoped purchase copies in modules/rental)

## Sidebar as-is
Dashboard (static sample) | Requests | Purchase Agreements | Orders: Request for Quote, Purchase Orders, Goods Receipt Note, Vendor Return Authorization, Delivery Orders, Landed Cost | Approvals | Master Data: Vendor Management | Reports (15) | Settings: Purchase Settings, Forms, Terms and Conditions, Approval Workflow, Template Editor.

## Purchase Requests (equivalent of Requisition)
List: ID, Date, Company, Purchase Representative, Vendor, Total Amount, Status. Form: ID, Date, Company, Purchase Representative, Vendor, Currency, Narration, Department, Location, Attachment; items (Item, Vendor, UOM, Description, Quantity, Available, On Hand, Rate, Gross, Discount, Net, Tax, Total, Location, Department). Statuses: Draft, Pending, In Progress, Pending Approval, Completed, Rejected, Cancelled. Buttons: Edit, Close, Delete, Submit for approval / Quick approval, Accept/Reject, Create (Order, RFQ).
NOT existing: Requesting Department/Wing picklist, Purpose picklist, value-tier configurable approver matrix shown on the record, automatic requisition from min stock.

## Purchase Agreements
Contract / Blanket agreements: ID, Date, Name, Type, Vendor, Purchase Rep, Valid Up To, Company, Currency, Payment Terms, Incoterms; items with per-item Rate and Min Order Qty. Statuses Draft ... Approved, Expired. Selectable on PO. NOT existing: locked price auto-populating PO lines with visible override flag, Agreement Status Active/Expired/Superseded semantic.

## RFQ / Response / Analyze / Award
RFQ list ID, Date, Reference No, Vendor, Status (Draft, Open, RFQ Sent, Response Received, Cancelled, Order). Multi-vendor tender table, Responses (unit price, lead time, MOQ), Analyze and Award comparison grid (Vendor, RFQ ID, Lead Time, MOQ, Unit Price, Currency), award to PO or agreement.

## Purchase Orders
Toggle Item / Fixed Asset. Columns: Series, Date, Reference Number, Confirmation Date, Supplier, Purchase Representative, Company, Expected Receipt Date, Total Amount, Status, Billing Status, Receiving Status. Tabs Basic Details, Address and Contact. Fields: ID, Date, Supplier, Company, Confirmation Date, Expected Receipt Date, Agreement, Currency, Exchange Rate, Payment Term, Reference No, Incoterm, T&C, Narration, Attachment, Department, Location; item table (Item, Is Landed Cost, Vendor, UOM, Quantity, Remaining, Location, Rate, Discount, Tax, Total ...). Statuses: Draft, Pending, Pending Approval, Approved, Received, Billed, Rejected, Cancelled, Closed; billing Pending/Partially/Fully Billed; receiving Pending/Partially/Fully Received. Actions: Submit, Cancel, Receive, Print, Email, Close, Bill, GRN, Return, Approval History.
NOT existing: Cost Centre/Project (mandatory), Budget Reference, Budget Variance Flag, Over-Budget Reason, Approve Overage / Amend Budget, PO Status "Partially Received".

## GRN
Columns GRN ID, GRN Date, Vendor, Company, Currency, Reference No, Status (Pending, Validated). Items with lot/serial/bin trace. No quality inspection. NOT existing: Receiving Location (Own warehouse / Client site), Confirmed By permission, Item Condition Accepted/Rejected-Damaged/Rejected-Short, Quality Check step, Certificate/Warranty attachment with expiry.

## Vendor Return Authorization + Delivery Orders
VRA fields ID, PO ID, Date, Vendor, Agreement, Currency, Company, Payment Term, items. Statuses Draft ... Delivered, Refunded, Closed. Debit note. NOT existing: Return Reason picklist, Resolution Type (Material Return / Credit Note / Refund) with Resolution Reference, link via Invoice or GRN.

## Vendor bills
Live in Accounting (Invoice > Bills). No three-way match screen; no Match Status; no Purchase Type Petty Cash bypass.

## Vendor Management
Shared party form (server form-builder). List: ID, Name, Phone Number, Emails, Status. NOT existing: Supplier Type picklist, Supplier Classification (Preferred/New/Blacklisted), per-document attachments with expiry, mandatory reason on Active/Inactive with audit, credit period/limit auto-block, Internal Performance Rating field, Price Agreement references.

## Approvals
Approval workflow builder + Approvals dashboard (external package `@erpsquad/approval-workflow`, module "purchase") for purchase request, order, agreement, vendor return; Approval History button on PO view.

## Landed Cost, Reports, Dashboard
Landed Cost (cost lines with split method, valuation lines; Draft, Pending, Validated). 15 reports: PO Summary, PO Detail, Purchase Invoice Summary, Purchase Invoice Detail, Approved vs Pending PO, Material Requirement Exception, Supplier Contract Compliance, Supplier Ranking Scorecard, Purchase Return, PO Cancellation, Purchase Trend, Received vs Ordered, Supplier Aging Payable, Purchase Price Variance, Open Purchase Order. Dashboard is static sample tiles.
NOT existing: cross-hire lifecycle in Procurement (it lives in Rental), certificates/compliance capture, spare-part replenishment (min/max auto-requisition), Budget vs Actual, Forecast, Revenue vs Expense, Cashflow, Supplier Certificate Expiry, Location-Wise Stock and Sales, Capex/Fixed Asset Useful-Life reports; Supplier Certificate Expiry, Budget vs Actual, Location-Wise Inventory and Sales, Cross-Hire Lifecycle and Profitability, Low-Stock/Reorder, Pending Approvals dashboards.
