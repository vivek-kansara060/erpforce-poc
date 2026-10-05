# Existing ERP -> New Requirement -> Combined POC

Updated 2 Oct 2026 after the client meetings: see `docs/crm-decisions.md` for the eight decisions (single header Activity Type, header Contract Type, duplicate check on the Opportunity, and others). Where this table and that file disagree, `docs/crm-decisions.md` wins.

Sources: `docs/baseline/crm.md`, `docs/baseline/rental.md`, `docs/baseline/inventory-fa.md` (the existing ERP), the Heavy Equipment Rental PDF, and the Master Sales / Rental / Mid-contract / Expiry / Return workflow.

Principle: one Sales Order, one asset register. Rental is not a separate system. It is the set of actions that become available on a Sales Order line tagged with Activity Type = Rental, working on the same Fixed Asset Register (Inventory module, `inventory.heavyEquipment`) that already exists in this POC.

## 1. Master Sales Flow

| Step | Existing ERP | New requirement (PDF + workflow) | Combined POC |
|---|---|---|---|
| Enquiry (Lead) | Lead list/form/view, statuses, sources, Communication Log, Convert button. No Activity Type, Lost Reason, Next Follow-Up, duplicate check | Activity Type multi-select (Rental / Trading / Fuel Trading / AMC / Service / Other), Lost Reason, Next Follow-Up Date, Tags, duplicate warning, one Lead converts to one Opportunity, at least one Activity Type before conversion | CRM > Lead keeps existing fields and statuses, adds the new fields, duplicate warning and Convert guard |
| Opportunity | List, stages, expected revenue, pipeline view. No Activity Type, rating, category, forecast | Activity Type(s) inherited, Rating, Stage, Equipment Group/Category (informational), FOC, Win Probability, Sales Forecast Value, zero availability flag that does not block | CRM > Opportunity extends the existing screen; availability flag reads the live fleet |
| Quotation | List, versions, T&C, approval actions. No line Activity Type | Line-level Activity Type (authoritative), Group + Category on Rental/AMC lines, Contract Type + End Date per line, Allocation Tag (internal), VAT Type, FOC, Valid Until, Push Amount to Opportunity | CRM > Quotation keeps header, approval and revision actions; line grid gains the new columns |
| Sales Order | List, header statuses, items grid, Create / View menus. No Activity Type, no asset concept | Lines inherit Activity Type, Contract Type/End Date, Billing Structure, LPO expiry, Assigned Asset(s), Compliance roll-up, Asset Ledger, editable number/date | CRM > Sales Orders is the hub. Each line shows a next-step action by Activity Type |
| After Sales Order | Delivery Order, Invoice, Customer Return | Rental: Deliver / Return. Inventory (Trading, Fuel Trading): Stock / Invoice. Service: Charge / Invoice. AMC: Visit / Billing | Per-line action button on the Sales Order. Non-rental lines get a small stock/charge/visit action that records an invoice reference; rental lines go to the Rental flow below |

## 2. Rental flow

| Step | Existing ERP | New requirement | Combined POC |
|---|---|---|---|
| Category selected, not asset | Item based rental order | Group + Category committed at Quotation/SO, exact asset only at Delivery | Sales Order rental line shows Group + Category and a live availability count from the Fixed Asset Register |
| Availability check | Available column on item table | Zero availability leads to Cross-Hire | Availability badge on the line; "Raise Cross-Hire" appears only when 0 owned units are Ready for Hire |
| Cross-Hire | Cross Hire requests, process, RFQ, orders, profitability (all exist) | Five stages: Request, Received, Allocated, Returned to Us, Returned to Supplier, condition check, dispute charge, cost roll-up, no depreciation | Rental > Cross Hire > Requests keeps the existing name and gains the stage lifecycle; Receive creates a Cross-Hired asset in the register |
| Delivery | Delivery Order (Picked, Packed, Dispatched, Delivered) | Delivery Type, asset picker limited to the confirmed Category, Transport Type and external cost, e-signature, Acknowledged, billing starts per delivery, Hold if site not ready | CRM > Delivery Orders gains the new fields. Saving assigns the asset, sets it On Hire (or Hold), appends Movement History and starts the invoice cycle |
| Mid-contract replacement | Replacement Orders list, replacement quotation | Started from the Sales/Rental Order, same-category owned unit first, else Cross-Hire, old asset to Under Maintenance, billing not paused | Rental > Replacements: asset-in / asset-out transaction with the same rules and a Cross-Hire fallback |
| Expiry | Upcoming Expiry report | Notification, client confirmation, extend the existing Sales Order or proceed to Return, early termination, overdue flag, fault attribution, escalation | Rental > Renewals and Expiry: notify, then Extend (revises the same Sales Order), Early Termination or Proceed to Return |
| Return | GRN based return (Pending, Validated) | Started from the Sales Order, Return Method, timestamp stops billing, site check, Yard, two-stage inspection, mandatory photos, damage charge, checklist before Ready for Hire | CRM > Customer Returns keeps RMA and adds Rental Returns raised from the Sales Order; closes the Delivery Order automatically |
| Reports / dashboards | 12 rental reports, static dashboard | Replacement History, Cross-Hire Frequency, Sales Order Asset Ledger, Fleet Status, Renewal and Overdue and others | A focused set of live reports and dashboards computed from the same collections |

## 3. Reuse and data

- Reused as is: Inventory module, Fixed Asset Register (`inventory.heavyEquipment`), Unified Asset Status list, Category and Pricing masters, customers, suppliers, employees, cost centres, Review Mode and Change Register tooling.
- Extended: Lead, Opportunity, Quotation, Sales Order, Delivery Order, Customer Returns, Cross Hire Requests.
- New screens only where nothing suitable exists: Rental Replacements, Renewals and Expiry, Rental Returns detail, Sales Order Asset Ledger tab.
- New collections (all `crm.*` or `rental.*`): leads, opportunities, quotations, salesOrders, deliveries, returns, replacements, extensions, crossHire.

## 4. Not rebuilt in this POC

Customer Management, Agreements, RFQ and Billing Cycle settings, Procurement, Accounting and HRMS screens. They are outside the workflow supplied and are unchanged.
