# CRM POC: open questions and the decisions applied

Date: 2 Oct 2026. The client's position in the meetings (Transcript.md) is newer than the requirement document, so where they disagree the meeting position is used. Each decision below is the recommendation given before implementation and approved by the team ("record each recommendation against the question").

Sources checked: existing FE code (`erpforce-fe/modules/crm`), existing BE code (`erpforce-be/modules/sales`), `ERP_PROJECT_DOCUMENTATION.md`, `ERPForce_Heavy_Equipment_Rental_Module.md` (client document), `Transcript.md` (17 Sep to 2 Oct).

| # | Question | Document says | Meetings say | Decision applied |
|---|---|---|---|---|
| 1 | Activity Type: single at the top, or per line? | Multi-select on Lead and Opportunity, per line on Quotation and Sales Order, mixed orders are the norm | 22 Sep: "Activity type, we can make it a single", chosen at the top. **5 Oct: Fuel Trading must not be on a Rental document** (billing and invoicing flow differ) | One Activity Type per Lead, Opportunity, Quotation and Sales Order, chosen in the header. A Rental or Fixed Asset Trading document may also carry Service lines (charges, waivers). **Fuel Trading lines are not allowed on a Rental document (revised 5 Oct, was allowed)** |
| 2 | Contract Type and End Date: header or per line? | Per line | 22 Sep: "I don't need contract type in the line, it should be at the top" | Header (Quotation and Sales Order). Open PO defaults the end date to 31 December (17 Sep) |
| 3 | Duplicate check: Lead or Opportunity? | Lead, on phone and company name, warning only | 22 Sep: "Lead, you don't need to consider anything". Warn on the Opportunity when Title, Project, Customer and Contact Person all match, "Do you want to continue?", no approval | Opportunity only, 4-field match, confirm prompt. Removed from the Lead |
| 4 | Pricing source for quotation lines | Pricing & Rate Management with Bulk Price Update under Quotation | 22 to 30 Sep: Heavy Equipment Pricing lives in Inventory. 2 Oct: add description, activity type, one row per frequency, bulk upload | CRM only reads the existing Inventory Heavy Equipment Pricing list (no Inventory change). A pricing line is named from Category, Subcategory and Frequency until Inventory adds a description. Bulk Price Update is not built in CRM; it belongs with the Inventory pricing changes |
| 5 | CRM Dashboards | Eight CRM dashboards | 2 Oct: "don't prepare the dashboard at the first, prepare the screens" | The two new CRM dashboards and the Dashboards menu are removed. The sidebar "Dashboard" opens the Sales Orders list until the screens are agreed |
| 6 | Delivery Commitment Date on the Quotation | Not mentioned | 22 Sep: "leave the delivery commitment date here because I may have multiple delivery commitments" (ambiguous) | **Revised 5 Oct:** the existing header field is kept (existing ERP forms are preserved) and each item also carries its own Delivery Commitment Date |
| 7 | Hold vs Rental Start Date on delivery | Hold status when the site is not ready, invoicing does not start, Hold Reason mandatory | 17 Sep, 18 Sep, 30 Sep: Rental (invoice) Start Date defaults to the delivery date and is editable; if different, a comment is required with an option to charge a lump sum for the waiting period | Rental Start Date on the Delivery Order. If it is later than the delivery date, the asset is on Hold until then, billing starts on that date, a reason and who is responsible are mandatory, and a lump-sum waiting charge is optional |
| 8 | Changes outside CRM | - | Team instruction: CRM only, no Inventory changes | No Inventory file is changed. Rental files are touched only where they read the CRM order data, so they keep working |

## Other meeting points applied without a question

- Category / Subcategory wording replaces "Equipment Group / Equipment Category" (all meetings).
- Lists of values are masters with a "+" button to add a value on the spot, nothing hard-coded (2 Oct).
- Fields that do not apply to the chosen Activity Type are hidden (22 Sep, 2 Oct).
- Quotation header: Entity first, then Customer, Payment Terms, Currency, Valid Until (22 Sep).
- Line table in the ERP style: Category, Subcategory, Pricing line, Qty, Unit Price, Discount, Taxable Amount, VAT, Total; rental lines add Start Date, End Date and Billing Frequency, and the period total follows from the dates and frequency (22 Sep, 25 Sep, 2 Oct).
- Line description defaults to the item or pricing name, is editable, prints, and never writes back to the master (22 Sep, 30 Sep).
- Service and waiver lines (delivery charge, return charge, damage waiver Monthly / One-time) with One-time or Recurring billing (22 Sep). A paid damage waiver blocks the damage charge at return (22 Sep, 30 Sep).
- Send by Email dialog with To, CC, Subject, Body and Attachments (18 Sep).
- Sales Order: traceability of Quote, SO and DO numbers with requested vs delivered subcategory and asset ID (22 Sep); LPO expiry alert with configurable notice and Extend (30 Sep).
- AMC: start date, end date (start + 1 year, editable), number of visits, planned visit dates; no delivery (22 Sep, 30 Sep).
- Delivery Order: category locked, subcategory defaults to the requested one and can be changed with a warning; only Ready for Hire assets are listed (17 Sep, 22 Sep).
- Customer Returns: off-hire date can be earlier or later than today, failed collection charged to the client or booked as a company loss, printable collection note, source DO shown (17 Sep, 30 Sep).
- Reports: column search, filters, sticky totals, print, drill-down to the record (2 Oct).

## Revision 5 Oct 2026: existing forms preserved

Instruction: keep the Lead, Opportunity, Quotation, Sales Order and Delivery Order flow and forms as in the existing ERP, and only add the new and related changes. The screens were rebuilt on the existing structure (checked against `erpforce-fe/modules/crm` and the field inventory taken from it):

- Existing tabs, section order, field labels and item-table columns are kept; new fields are marked NEW or CHANGED in Review Mode.
- One more recommendation applied: **Opportunity items are optional** (existing ERP requires one; 22 Sep: "if I don't have item there, it's fine").
- Delivery Order now covers trading and fuel items as well as rental items, as in the existing ERP; rental items use Trace Details to pick the exact asset.
- Sales Order Create menu keeps Quick Delivery, Delivery, Advance and Invoice; Return and Replacement are added.

## Revision 5 Oct 2026 (second call with Ajin): decisions applied

| # | Question | Decision applied |
|---|---|---|
| A | Rental module vs "no separate rental module" | The Rental module keeps the existing ERP sidebar and screens (instruction 5 Oct). Rental Leads, Opportunity and Quotations are the CRM records filtered to Activity Type = Rental, so new fields appear without a second copy. Rental Orders is the existing list, one row per rental Sales Order. Screens the requirement does not change show their existing columns and are not rebuilt. Rental flows (replacement, cross hire, return, expiry) stay reachable from the CRM Sales Order |
| B | Where trading stock is allocated | The item is chosen directly on the Sales Order (no Category) and stock is allocated at Delivery as in the existing ERP. Fixed assets, rented or sold, use Category and Subcategory and the exact asset is traced at Delivery |
| C | Masters that sit in Inventory | Inventory untouched. CRM reads the Inventory item classifications (AMC, Fuel Trading, Trading) and keeps a CRM Masters area with list views, including Service Charges. The Employee location type, Service master in Inventory and AMC / Fuel Trading / Trading product classification remain Inventory work |
| D | Activity Type list | Rental, Fixed Asset Trading, Trading, Fuel Trading, AMC, Service, Other |
| E | AMC job card | AMC Orders menu, one Job Card per visit (materials, services, technician, consumption location, invoice), contract value split across visits, project cost and profit, consolidated report. No Delivery Order for AMC |

Also from the call: label "Entity" first; item dialog order Category, Subcategory, Pricing, Description (large printed text), UOM, Quantity, FOC, with frequency and dates last and auto-filled, and a "Save and Add another" button; service lines come from the Service master (type, billing, frequency follows the quotation); no department, narration, delivery dates or replacement cost on service lines; header Cost Centre / Project is mandatory, items can override it; Fuel Trading delivered from an own or supplier yard with the supplier's own Delivery Order number.
