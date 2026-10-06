# AMC and Accounting Change Plan (ERPForce POC)

Prepared 6 Oct 2026 for execution in one session. Status: **PLAN ONLY, NOT APPROVED FOR EXECUTION, NOTHING EXECUTED.** Decisions D1 to D5 answered by Anurag on 6 Oct (section 2).
Read this whole file before touching code. Every path below is relative to `erpforce-poc/`.

> **Executed 6 Oct 2026** (approved by Anurag). Deviations from the text below:
> - Pure builders live in a separate `src/modules/accounting/billing.ts` (shared by the engine and the seed, avoids an import cycle); the rental invoicing screens are in `src/modules/rental/InvoicingPages.tsx`.
> - Seeded counts: 29 invoices (INV-26-00300 to 00321 rental history plus the 7 existing numbers), 3 bills, 24 payments (PAY-26-00031 to 00054), 58 journals (JV-26-00200 to 00257). First runtime numbers: INV-26-00416, BILL-26-00024, PAY-26-00055, CRN-26-00009, DBN-26-00004, JV-26-00401.
> - SO-26-00046 assets start on 1 Jun in the seed (replacements before 4 Jul), so its cycle is anchored on 1 Jun, not 4 Jul; the section 8 example for that order does not apply as written. The quantity of a pro-rated line is days / days in period rounded to 4 decimals.
> - Damage invoices are also guarded in `crm/flow.ts` against a second invoice for the same charge.

---

## 0. How to use this plan

1. Get explicit approval from Anurag before Phase 1 (standing rule: feedback first, edit the POC only after a yes). D1 to D5 are decided (section 2). Do not change them without asking.
2. Execute phases 1 to 6 in order. Each phase ends with a checkpoint (`npx tsc --noEmit` must pass with zero errors). Do not start the next phase with a red checkpoint.
3. Do not commit, push or deploy unless asked.

### 0.1 Hard rules that apply to every line written (from `docs/BUILDER-GUIDE.md` and `CLAUDE.md`)

- Never use an em dash character anywhere (code strings, comments, markdown). Use commas, colons, hyphens.
- Do not edit shared files: `src/components/*`, `src/store/*`, `src/mock-data/masters.ts`, `src/shell/*`, `src/types.ts`, `src/modules/index.ts`. Helpers go in the module folder.
- No new dependencies, no `npm install`. Available: react 18, react-router-dom 6, MUI 5.18, @mui/icons-material, notistack, dayjs.
- Every NEW or CHANGED element carries `change="new" | "changed"` plus a `req` string (Review Mode badges). Every new or changed screen gets a Change Register entry (`changes[]` of its module) and a `CHANGELOG.md` entry.
- Where a rule is not decided by the client, implement the plainest reading and add the hint `TO_CONFIRM` (`'Rule to be confirmed with client'`, exported from `src/modules/crm/shared.tsx`).
- No dead buttons: every button navigates, opens a dialog, changes state or shows a toast.
- Realistic UAE data: AED, 5% VAT, TRN, Dubai / Abu Dhabi / Sharjah. Company: Gulf Power Rentals LLC.
- Keep the existing look: `FormHeader` + `Page` + `TabPanels` + `DataTable` + `SpecView` / `SpecForm` + `MenuButton` patterns, exactly like `src/modules/crm/SalesOrderPages.tsx`.

### 0.2 Sources this plan is built on

| Source | What it gave |
|---|---|
| `erp-latest/erp-be` and `erp-latest/erp-fe` (existing ERP code) | Sales Invoice, Purchase Invoice (Bill), Payment Entry, Credit / Debit Note, Journal data model, status lifecycle, GL posting rules, UI actions (section 3) |
| `docs/baseline/accounting.md`, `docs/baseline/procurement.md` | Existing sidebar, list columns, actions, what is NOT existing |
| `ERPForce_Heavy_Equipment_Rental_Module.md` (client requirement) | Rental invoicing per delivery (L264, L271, L628-634), Asset Ledger (L624, L634), Activity Type and Cost Centre on invoices (L1318-1348), payment status (L1350-1359), credit limit (L345), vendor bill (L842-864), cross-hire supplier invoice (L886-925), AMC billing (L1479-1497), VAT Standard / Export (L204, L1510) |
| `Transcript.md` | Invoice start date editable, Hold stops billing (17 Sep L333-357, 18 Sep L1524-1530, 30 Sep L3731-3737); waiver, delivery and return charges with the 10,300 / 10,100 / 10,300 example (22 Sep L2153-2279); waiver blocks damage invoice (L2279); AMC job card then invoice (22 Sep L1640-1693, 30 Sep L3803-3825); invoices always take the SO price (L2591-2595); disposal sale needs a sales invoice (2 Oct L4798, L4826) |
| Current POC code | Section 4 |

---

## 1. Scope in one paragraph

(A) The AMC Order view becomes a read-only Sales-Order-style view with Generate, View and Actions dropdowns; the Job Card becomes a read-only view page, with the form used only to create a job card and, through Actions > Edit, to change it until it is invoiced. (B) A working Accounting POC is built in `src/modules/accounting/`: Sales Invoices, Bills (Purchase Invoices), Collections and Payments, Credit and Debit Notes, Journal Entries (auto-posted), Chart of Accounts and four existing reports, all following the existing ERP. (C) Every place in the POC that today only writes an invoice number string is connected to real invoices: Sales Order lines, Advance, rental billing cycles, damage and failed-collection charges, AMC job cards, asset disposal, cross-hire orders and external transport trips.

---

## 2. Decisions (answered by Anurag, 6 Oct)

| # | Decision | Answer |
|---|---|---|
| D1 | Job Card form | **Create + Edit.** Form on create, and Actions > Edit opens the form until the job card is invoiced. The view page is read-only. |
| D2 | Scope | **A + B + C** in one session. |
| D3 | Rental invoice trigger | **Run Invoicing only.** Rental invoices are raised only from Rental > Invoicing > Invoicing Rental Order with Run Invoicing for selected orders (simulates the scheduled run of the existing ERP). No rental invoice button on the Sales Order. |
| D4 | Approval of generated invoices | **Always Pending.** No "Approve and post now" checkbox anywhere. Every invoice or bill generated from a source document (Sales Order, rental run, job card, damage charge, disposal, cross-hire, trip) is created Pending and must be approved in Accounting (Submit for Approval / Quick Approval / Accept) before a journal is posted or a payment can be recorded. |
| D5 | Approval of Collections and Payments created from a dialog (Record Payment on the job card, Collection Entry on the invoice, Advance on the Sales Order) | **Pending, approved from the Collection view** (existing ERP behaviour). Saving the dialog creates a Pending Collection; the invoice's amount paid and payment status change, and the journal is posted, only when the Collection is approved on its view page. The dialog toast says "Collection PAY-26-xxxxx created, pending approval" and links to it. |


### 2.1 Conflicts found and how this plan resolves them (call these out to the client)

| Conflict | Resolution |
|---|---|
| 5 Oct call: "Accounting is standard and not designed in this POC" (comment in `src/modules/accounting/index.tsx:12`); builder guide forbids invented features | Overridden by Anurag's instruction of 6 Oct. Only existing-ERP screens and fields (baseline) are rebuilt; the new fields are only those the requirement names (Activity Type, Cost Centre / Project, source document). Change Register ref: `Instruction 6 Oct (accounting POC)` |
| AMC billing: 30 Sep call says the visit is charged 0 and only consumables are billed (Tr L3803-3825); the POC since 5 Oct bills each visit's share of the Contract Value, with FOC override | Keep the 5 Oct POC behaviour (latest). Visit share, non-FOC materials and non-FOC services are invoiced from the job card |
| Pro-rata and cycle anchor undecided (Req L431, L445; Tr L373-375) | Order-level monthly cycle anchored on the first Rental Start of the order, partial periods pro-rated by days in that period. Hint `TO_CONFIRM` on the dialog and the Billing Cycle field |
| Credit limit: hard block or warning not decided (Req L345) | Warning only (existing ERP flags when no credit hold). Hint `TO_CONFIRM` |
| ZATCA (Saudi) exists in the ERP, client is UAE | Not shown in the POC. No ZATCA button |
| Supplier credit: requirement says "Credit Note" from supplier (L877), existing ERP calls it Debit Note | Use the existing ERP name "Debit Note" with hint "Supplier credit note, recorded as a Debit Note" |
| Existing ERP assigns the sales invoice number only at approval; bills at creation | POC assigns both at creation (source documents need the number immediately). Note in the changelog "Be aware" |
| Existing ERP payment status enum default is "Pending" | POC shows "Unpaid" (also in the existing enum) for clarity; values Unpaid, Partially Paid, Paid |

---

## 3. What the existing ERP does (replicate this)

### 3.1 Sales Invoice (`sales_invoices`, Accounting > Invoice > Invoices)
- Header: series number, date, posting time, customer, salesperson, company (entity), location, department, due date, payment term, currency, exchange rate, transaction type (Cash / Credit), narration, additional discount (on Net or Gross, %, amount), round off, addresses (contact person, billing, shipping, place of supply), links to quotation / sales order / delivery order.
- Lines: item, description, UOM, quantity, rate, discount %, tax template (VAT 5% or Zero-Rated), gross, tax, total, location, department; rental lines carry rental period start / end, number of days, prorated unit.
- Calculation: line amount = qty x rate (x prorated unit for rental); discount = amount x %; gross = amount - discount; tax = gross x rate; total = gross + tax. Header: additional discount, tax recomputed on the discounted gross, round off.
- Statuses: approval Draft, Pending (created), Submitted (sent to approver), Approved, Rejected. Payment Unpaid, Partially Paid, Paid. Edit only in Draft, Pending, Rejected. Delete blocked once Approved or any payment. No cancel: a posted invoice is reversed with a Credit Note.
- Journal posted on approval only (journal type Sales): Dr Accounts Receivable (total), Cr item income account per line (gross), Cr Output VAT, Dr discount accounts, round off to Round Off.
- Cash invoice (Transaction Type Cash): on approval a Collection is created automatically and the invoice is Paid.
- View actions: Edit (before approval), Submit for Approval, Quick Approval, Accept / Reject, Apply Payment (advance), Credit Note, View Accounting Ledger, Collection Entry, Payment Request (overdue), Duplicate, Send Email, Download, Delete. List columns: ID, Customer, Payment Status, Status, Total Invoice Value, Due Date, Currency, Company, Exchange Rate.

### 3.2 Purchase Invoice / Bill (`purchase_invoice`, Accounting > Invoice > Bills)
- As sales, plus: bill date, vendor, supplier invoice number and date, purchase order link, Items table AND Expenses table (GL account lines without item).
- Journal on approval (Purchases): Dr expense / stock account per line, Dr Input VAT, Cr Accounts Payable.
- PO Billing Status: Pending Billing, Partially Billed, Fully Billed.
- List columns: ID, Supplier, Payment Status, Status, Total Invoice Value, Invoice Date, Due Date, Payment Amount, Currency. Actions: Payment Entry, Apply advance payment, View Accounting Ledger, View Debit Notes, Duplicate, Send Email, Download.

### 3.3 Payment Entry (Collection = Receive, Payment = Send)
- Fields: party, date, type Cash / Bank / Cheque, bank account, cheque number / date, reference, amount, advance flag, allocations to invoices / notes (invoice amount, amount due, allocated).
- On approval: Collection Dr Bank / Cash, Cr Accounts Receivable per allocation (advance: Cr Customer Advances). Payment Dr Accounts Payable, Cr Bank. Invoice amount paid / due updated; Paid when due < 1, else Partially Paid.
- Apply advance from the invoice: Dr Customer Advances, Cr Accounts Receivable.

### 3.4 Credit Note / Debit Note
- Credit Note (sales): party, date, reason, linked invoice(s), lines, amount; on approval Dr income + Dr Output VAT, Cr Accounts Receivable, auto-settles the linked invoice.
- Debit Note (purchase): mirror; Dr Accounts Payable, Cr expense + Cr Input VAT, settles the bill.

### 3.5 Journal Entry
- List: Posting Date, Series Number, Reference Type, Status, Amount, Created By, Journal Type, Currency, Narration. Lines: account, party, debit, credit.

---

## 4. What the POC has today (verified 6 Oct)

- No invoice entity. Invoice numbers are strings from `nextNumber('INV', 415)` stored on:
  - Sales Order line `fulfilmentRef` via `fulfilLine` (`src/modules/crm/flow.ts:129-137`), opened from `NextStepDialog` (`src/modules/crm/ActionDialogs.tsx:68-88`).
  - Job card `invoiceRef` via `invoiceJobCard` (`flow.ts:536-541`); `markJobCardPaid` (`flow.ts:543-545`) sets `paymentStatus`.
  - `recordVisit` (`flow.ts:350-355`, older AMC path).
  - Disposal `outcome.invoiceRef` via `seq('INV', 140)` in `src/modules/inventory/AssetPages.tsx:624-637`, then `nav('/accounting/invoices/<number>')`.
- Seeded invoice numbers that must become real records: `INV-26-00402` (so1 line so1d, Delivery Charge 1,500), `INV-26-00415` (so2 line so2c, Installation 3,500), `INV-26-00344` (so9 line so9d, Delivery Charge 1,500), `INV-26-00371` (job card jc2, Paid), `INV-26-00396` (job card jc3, Unpaid), `INV-26-00118` and `INV-26-00287` (disposals, `src/modules/inventory/data.ts:492, 497`).
- Sales Order view `src/modules/crm/SalesOrderPages.tsx`:
  - Create menu (lines 216-222): Delivery, Advance (log only, line 218), Invoice (opens NextStepDialog, line 219), Return, Replacement.
  - Asset Ledger tab `Ledger` (lines 108-126): invoiced = `periods() x price`, received = fake 80%.
  - Charges tab (line 261): `so.damageCharges`, no invoice.
- AMC `src/modules/crm/AmcPages.tsx`: `AmcView` (lines 54-105) read-only Project Details + tabs, header only "View Sales Order" and "Print consolidated report"; `JobCardPage` (lines 119-189) is an editable form with Generate and Actions menus. Routes in `src/modules/crm/index.tsx:51`: `amc-orders`, `amc-orders/:id`, `job-cards/:id`. `createJobCard` (`flow.ts:497-509`) persists immediately.
- Cross-hire `src/modules/rental/CrossHirePages.tsx` `ChOrderView` (lines 330-386): Receive dialog asks for Supplier Invoice Reference (text only), Billing Status is a static string, Return to Supplier records a dispute charge, Add Expense.
- Returns `src/modules/crm/ReturnPages.tsx`: `inspect()` adds `damageCharges` to the order (blocked by waiver); `failedCollection()` adds a charge when the client is at fault.
- Trips: `completeTrip` (`flow.ts:464-470`), external transporter charge is a trip expense posted to `logisticsCost`.
- Accounting `src/modules/accounting/index.tsx`: one `InvoicePage` (route `invoices/:ref`) that reads a disposal. Procurement is a placeholder.
- Rental `src/modules/rental/index.tsx:54`: `invoicing` and `previous-jobs` are static `ExistingScreen`s.
- Store `src/store/store.ts`: `seedCollection` shifts every ISO date in a seed by (today - 2026-09-30) days, except 31 Dec. `nextNumber(prefix, seedStart)`: one counter per prefix, `seedStart` only counts on the first call. `TODAY` (`src/modules/inventory/data.ts:6`) is the real clock.

---

## 5. Architecture

### 5.1 New and changed files

| File | Action | Content |
|---|---|---|
| `src/modules/accounting/data.ts` | NEW | Types, constants, Chart of Accounts, collection names, number counters, pure calculators |
| `src/modules/accounting/engine.ts` | NEW | All mutations: create / approve / reject / delete documents, posting, allocation, generators from source documents, rental billing builder, seed builder |
| `src/modules/accounting/seed.ts` | NEW | Seed records built from the raw CRM seeds (section 9) |
| `src/modules/accounting/shared.tsx` | NEW | Hooks (`useInvoices` ...), `R_ACC` refs, `InvoiceTotals`, `PartyName`, `LedgerDialog`, `CollectionDialog`, `DocsTab` (invoices of a source) |
| `src/modules/accounting/SalesInvoicePages.tsx` | NEW | `InvoiceList`, `InvoiceView`, `InvoiceForm` |
| `src/modules/accounting/BillPages.tsx` | NEW | `BillList`, `BillView`, `BillForm` |
| `src/modules/accounting/PaymentPages.tsx` | NEW | `CollectionList`, `PaymentList`, `PaymentEntryView`, `PaymentEntryForm` |
| `src/modules/accounting/NotePages.tsx` | NEW | `CreditNoteList/View/Form`, `DebitNoteList/View/Form` |
| `src/modules/accounting/JournalPages.tsx` | NEW | `JournalList`, `JournalView`, `CoaList` |
| `src/modules/accounting/reports.tsx` | NEW | Aged Receivable, Aged Payable, Customer SOA, General Ledger (live) |
| `src/modules/accounting/index.tsx` | REWRITE | Sidebar, routes, Change Register |
| `src/modules/crm/AmcPages.tsx` | REWRITE parts | `AmcView`, `JobCardView`, `JobCardForm` |
| `src/modules/crm/index.tsx` | EDIT | Job card routes, Change Register entries |
| `src/modules/crm/flow.ts` | EDIT | `fulfilLine`, `invoiceJobCard`, `markJobCardPaid`, `createJobCard`, `recordVisit`, `receiveCrossHire`, `returnToSupplier`, `completeTrip`, new `invoiceDamage` |
| `src/modules/crm/data.ts` | EDIT | Optional `invoiceId` on `damageCharges` entries; `JobCard.invoiceId` |
| `src/modules/crm/SalesOrderPages.tsx` | EDIT | Export `soForm`; Create menu items; Invoices tab; real Asset Ledger; Charges tab actions |
| `src/modules/crm/ActionDialogs.tsx` | EDIT | `NextStepDialog` creates a real invoice; new `AdvanceDialog`, `InvoiceLinesDialog` |
| `src/modules/crm/ReturnPages.tsx` | EDIT | "Raise Damage Invoice" action |
| `src/modules/crm/reports.tsx` | EDIT | Asset Ledger report row figures from invoices (check line 74 area) |
| `src/modules/rental/CrossHirePages.tsx` | EDIT | Bill on receive, Create > Bill, Bills tab, live Billing Status |
| `src/modules/rental/FleetPages.tsx` | EDIT | Trip view shows the transporter Bill link |
| `src/modules/rental/index.tsx` | EDIT | Live Invoicing Rental Order and Previous Jobs, Change Register |
| `src/modules/inventory/AssetPages.tsx` | EDIT | Disposal outcome creates a real invoice |
| `src/modules/inventory/index.tsx` | EDIT | Change Register line for the disposal invoice |
| `CHANGELOG.md` | EDIT | One entry per phase, newest first |

### 5.2 Dependency direction (avoid import cycles)

- `accounting/data.ts` imports only `@/store/store`, `@/mock-data/masters`, `dayjs`, and **types / pure helpers** from `@/modules/crm/data` (`COL`, `custName`, `docTotals`, `log`, `TODAY`, types).
- `accounting/engine.ts` imports `accounting/data.ts`, `@/modules/crm/data`. It must NOT import `@/modules/crm/flow` (flow imports the engine). It reads source documents with `getCollection(COL.orders)` etc. and writes ONLY accounting collections. Back-links on source documents (job card `invoiceId`, line `fulfilmentRef`, damage charge `invoiceId`, cross-hire `billing`) are written by the callers in `crm/flow.ts`.
- CRM, Rental and Inventory pages import from `@/modules/accounting/engine` and `@/modules/accounting/shared`. Flag in the changelog: the builder guide says modules should not read each other's collections; the invoice engine is the one deliberate exception, because invoicing is the link between modules.
- Single source of truth for payment state: the invoice. Job card "Payment", Sales Order "Received", Asset Ledger "Received" are always derived from invoices (`paymentStatusOf(invoiceId)`), never stored on the source.

### 5.3 Collections (all prefixed `accounting.`)

`accounting.invoices`, `accounting.bills`, `accounting.payments` (both Collection and Payment, `direction` field), `accounting.creditNotes`, `accounting.debitNotes`, `accounting.journals`, `accounting.rentalRuns`.

### 5.4 Numbering (one counter per prefix, `nextNumber(prefix, seedStart)`)

| Document | Format | Counter call | Seeded range | Note |
|---|---|---|---|---|
| Sales Invoice | `INV-26-00416` | `nextNumber('INV', 415)` | 00300-00340 (rental history), plus the seven existing numbers | All callers go through `nextInvoiceNo()` in `accounting/data.ts`; remove every other `nextNumber('INV', ...)` and the disposal `seq('INV', 140)` |
| Bill | `BILL-26-00024` | `nextNumber('BILL', 23)` | 00021-00023 | |
| Collection / Payment | `PAY-26-00061` | `nextNumber('PAY', 60)` | 00031-00060 | One series for both, as in the ERP |
| Credit Note | `CRN-26-00009` | `nextNumber('CRN', 8)` | 00008 | |
| Debit Note | `DBN-26-00004` | `nextNumber('DBN', 3)` | 00003 | |
| Journal | `JV-26-00401` | `nextNumber('JV', 400)` | 00200-00399 | Disposal NBV journals (`JV-26-00342`, `00351`, `seq('JV', 360)`) stay Inventory references and are not records here |

---

## 6. Data model (`src/modules/accounting/data.ts`)

```ts
export type ApprovalStatus = 'Draft' | 'Pending' | 'Submitted' | 'Approved' | 'Rejected';
export type PayStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export type SourceType = 'Sales Order' | 'Rental Cycle' | 'Job Card' | 'Damage Charge' | 'Asset Disposal' | 'Manual' | 'Cross Hire' | 'Trip';
export interface SourceRef { type: SourceType; id: string; number: string; soId?: string; lineIds?: string[] }

export interface InvLine {
  id: string; item: string; desc: string; account: string;          // income or expense account code
  qty: number; unit: string; rate: number; discountPct: number; vatPct: 0 | 5;
  activity?: string; costCentre?: string;                             // inherited, reporting only (Req L1347-1348)
  // rental lines only
  periodFrom?: string; periodTo?: string; days?: number; periodDays?: number; assetId?: string; deliveryId?: string; soLineId?: string;
  // origin tags used by the rental builder to know what was billed already
  tag?: 'rental' | 'recurring-service' | 'one-time-service' | 'waiting-charge' | 'damage' | 'visit' | 'material' | 'service' | 'goods' | 'asset-sale';
}
export interface ExpenseLine { id: string; account: string; desc: string; amount: number; vatPct: 0 | 5; costCentre?: string }

interface DocBase {
  id: string; number: string; date: string; postingTime: string; dueDate: string; paymentTerms: string;
  entity: string; currency: string; exchangeRate: number; location?: string; department?: string; narration?: string;
  discountOn: 'None' | 'Net Amount' | 'Gross Amount'; discountPct: number; roundOff: boolean;
  approval: ApprovalStatus; approver?: string; payStatus: PayStatus; amountPaid: number;
  activity?: string; costCentre?: string; source: SourceRef; journalId?: string;
  attachments: string[]; log: LogItem[];                              // LogItem from crm/data
}
export interface SalesInvoice extends DocBase {
  customerId?: string; partyName: string;                             // partyName always set (disposal buyers may not be customers)
  transactionType: 'Cash' | 'Credit'; salesperson?: string; lpo?: string; soId?: string; soNumber?: string; deliveryIds?: string[];
  contactPerson?: string; billingAddress?: string; shippingAddress?: string; placeOfSupply?: string; vatType: string;
  lines: InvLine[]; isRental?: boolean; periodFrom?: string; periodTo?: string; creditNoteIds: string[];
}
export interface Bill extends DocBase {
  supplierId: string; supplierName: string; supplierInvoiceNo: string; supplierInvoiceDate: string;
  orderRef?: string; lines: InvLine[]; expenses: ExpenseLine[]; debitNoteIds: string[];
}
export interface Allocation { docType: 'invoice' | 'bill'; docId: string; docNumber: string; amount: number }
export interface PaymentEntry {
  id: string; number: string; direction: 'Receive' | 'Send'; date: string; partyType: 'Customer' | 'Supplier'; partyId?: string; partyName: string;
  method: 'Cash' | 'Bank' | 'Cheque'; bankAccount: string; chequeNo?: string; chequeDate?: string; reference?: string;
  amount: number; isAdvance: boolean; advanceUsed: number; soId?: string; allocations: Allocation[];
  approval: ApprovalStatus; journalId?: string; narration?: string; log: LogItem[];
}
export interface NoteDoc {
  id: string; number: string; kind: 'Credit' | 'Debit'; date: string; partyId?: string; partyName: string; reason: string;
  againstId: string; againstNumber: string; lines: InvLine[]; approval: ApprovalStatus; journalId?: string; log: LogItem[];
}
export interface JournalLine { account: string; party?: string; debit: number; credit: number; costCentre?: string; memo?: string }
export interface Journal {
  id: string; number: string; postingDate: string; journalType: 'Sales' | 'Purchases' | 'Cash Receipt Voucher' | 'Payment' | 'Credit Note' | 'Debit Note';
  refType: string; refId: string; refNumber: string; status: 'Posted'; currency: 'AED'; narration: string; createdBy: string; lines: JournalLine[];
}
export interface RentalRun { id: string; number: string; runAt: string; soIds: string[]; invoiceIds: string[]; status: 'Processed' | 'Nothing to bill'; message: string }
```

### 6.1 Constants

```ts
export const COLA = { invoices: 'accounting.invoices', bills: 'accounting.bills', payments: 'accounting.payments', creditNotes: 'accounting.creditNotes', debitNotes: 'accounting.debitNotes', journals: 'accounting.journals', rentalRuns: 'accounting.rentalRuns' } as const;
export const BANK_ACCOUNTS = ['Emirates NBD Current 1015-447821-01', 'ADCB Current 6031-228410-001', 'Cash in Hand (Jebel Ali Office)'];
export const NOTE_REASONS = ['Early termination', 'Rate correction', 'Returned goods', 'Billing error', 'Other'];
export const DEBIT_REASONS = ['Early off-hire by supplier', 'Unit breakdown downtime', 'Rate correction', 'Rejected on receipt (QC)', 'Other'];
export const termDays = (terms: string) => (terms === 'Immediate' ? 0 : Number.parseInt(terms, 10) || 30);   // '30 days' -> 30
```

### 6.2 Chart of Accounts (6-digit codes, matching `ACCOUNTS` in `src/modules/inventory/data.ts:40`)

| Code | Name | Type | Used by |
|---|---|---|---|
| 110100 | Cash in Hand | Asset | Cash collections and payments |
| 110200 | Bank: Emirates NBD Current | Asset | Bank collections and payments (default) |
| 110300 | Bank: ADCB Current | Asset | Bank, second account |
| 130100 | Accounts Receivable | Asset | Every sales invoice, collection, credit note |
| 130200 | Input VAT Recoverable | Asset | Bills, debit notes |
| 140100 | Inventory: Spare Parts and Consumables | Asset | Shown on job card consumption reference |
| 120100 | Fixed Assets: Plant & Machinery | Asset | Reference (Inventory) |
| 210100 | Accounts Payable | Liability | Bills, payments, debit notes |
| 210300 | Output VAT Payable | Liability | Sales invoices, credit notes |
| 210400 | Customer Advances | Liability | Advance collections, apply advance |
| 410100 | Rental Income | Income | Rental lines |
| 410200 | Trading Sales | Income | Trading lines, AMC materials |
| 410300 | Fuel Sales | Income | Fuel Trading lines |
| 410400 | AMC Income | Income | AMC visit value, AMC services |
| 410500 | Service and Other Charges Income | Income | Service lines (delivery, return, installation, waiver, waiting charge, Other) |
| 410600 | Damage Recovery Income | Income | Damage and failed collection charges |
| 410700 | Asset Sale Proceeds | Income | Fixed Asset Trading, disposal |
| 410900 | Sales Discount | Income (contra) | Line and additional discounts |
| 510100 | Cross-Hire Charges | Expense | Cross-hire bills |
| 510300 | Transportation Expense | Expense | Transporter bills, cross-hire expense "Transportation Expense" |
| 510310 | Loading and Unloading | Expense | Cross-hire expense |
| 510320 | Fuel Expense | Expense | Cross-hire expense |
| 520100 | Insurance Expense | Expense | Cross-hire expense |
| 510400 | Cost of Materials Consumed | Expense | Job card consumption (reference, already in the POC text) |
| 510500 | Other Direct Expense | Expense | Cross-hire expense, supplier dispute charge |
| 590100 | Round Off | Expense | Round off difference |

`incomeAccountFor(lineKind: string)`: Rental -> 410100; Trading -> 410200; Fuel Trading -> 410300; AMC -> 410400; Service and Other -> 410500; Fixed Asset Trading -> 410700. `expenseAccountFor(name)` maps the five cross-hire expense names above.

### 6.3 Pure calculators

```ts
lineAmount  = qty * rate
lineDisc    = lineAmount * discountPct / 100
lineGross   = lineAmount - lineDisc
lineVat     = lineGross * vatPct / 100
docTotals(doc): sub = sum(lineGross) + sum(expense.amount)
                addDisc = discountOn === 'None' ? 0 : sub * discountPct / 100
                taxable = sub - addDisc; vat = sum(lineVat) * (taxable / sub || 0)   // tax recomputed pro-rata on the discounted base
                total = round2(taxable + vat); if roundOff: rounded = Math.round(total); roundDiff = rounded - total
amountDue(doc) = total - amountPaid - settled by approved notes
payStatusOf(due, total) = due < 1 ? 'Paid' : due < total ? 'Partially Paid' : 'Unpaid'
round2 = (n) => Math.round(n * 100) / 100   // all money stored rounded to 2 decimals
```

VAT: `vatPct = vatType.startsWith('Export') ? 0 : 5` (same rule as `lineVat` in `crm/data.ts`).

---

## 7. Engine (`src/modules/accounting/engine.ts`)

All functions are synchronous, use `getCollection` / `setCollection`, and append a `log()` entry (actor from `crm/data` `ACTOR`). Every function returning a document returns the saved object.

### 7.1 Core
| Function | Behaviour |
|---|---|
| `createInvoice(d: Omit<SalesInvoice, 'id' \| 'number' \| ...>, opts?: { draft?: boolean })` | Generated invoices are always Pending (D4); only the manual form can save as Draft. Assign id (`uid('inv')`) and number, `approval = draft ? 'Draft' : 'Pending'`, `payStatus 'Unpaid'`, `amountPaid 0`, due date = date + `termDays(paymentTerms)`. Credit-limit check: if `customerId` and (open AR of customer + total) > `creditLimit`, push a log line "Credit limit exceeded, warning only" (UI shows the warning before save). If `transactionType === 'Cash'`, when the invoice is later approved auto-create an approved Collection for the total. |
| `approveInvoice(id, approver = ACTOR)` | `approval 'Approved'`, post journal (7.2), log |
| `submitInvoice(id, approver)` | `approval 'Submitted'`, `approver` |
| `rejectInvoice(id, note)` | `approval 'Rejected'`, log with note |
| `deleteInvoice(id)` | Only if approval in Draft, Pending, Rejected and `amountPaid === 0`; returns `{ ok, message }` |
| `updateInvoice(id, patch)` | Only in Draft, Pending, Rejected |
| `duplicateInvoice(id)` | New Pending invoice, same lines, today, source Manual, `original` noted in log |
| Same five for bills | `createBill`, `approveBill`, ... (journal type Purchases) |
| `createPayment(p, opts?: { approve?: boolean })` | Validates sum(allocations) <= amount; remainder only allowed when `isAdvance`. Pending by default |
| `approvePayment(id)` | Posts journal; for each allocation increases `amountPaid` on the invoice / bill and recomputes `payStatus` |
| `applyAdvance(invoiceId, paymentId, amount)` | Moves advance: `advanceUsed += amount`, invoice `amountPaid += amount`, journal Dr 210400, Cr 130100 |
| `createCreditNote(invoiceId, lines, reason, opts)` / `approveCreditNote(id)` | Lines cannot exceed the invoice due; on approval post journal, push note id to `creditNoteIds`, settle (amountPaid += note total) |
| `createDebitNote(billId, lines, reason, opts)` / `approveDebitNote(id)` | Mirror on bills |
| `invoiceByRef(idOrNumber)`, `billByRef(idOrNumber)` | Lookup by id OR number (old links use numbers) |
| `invoicesOfSource(type, id)`, `invoicesOfOrder(soId)`, `billsOfOrderRef(ref)` | Filters |
| `paymentStatusOf(invoiceId?)` | `'-'` if none, else `payStatus` |
| `openArOf(customerId)` | Sum of due on approved invoices |

### 7.2 Posting rules (one journal per approved document)

| Document | Debit | Credit |
|---|---|---|
| Sales invoice | 130100 Accounts Receivable = total; 410900 Sales Discount = line + additional discounts; 590100 Round Off if negative diff | Each line's income account = lineAmount (before discount); 210300 Output VAT = vat; 590100 if positive diff |
| Bill | Each line / expense account = gross; 130200 Input VAT = vat | 210100 Accounts Payable = total |
| Collection (allocated) | 110200 / 110300 / 110100 by bank account = amount | 130100 per allocation; 210400 for the unallocated advance part |
| Payment (Send) | 210100 per allocation | Bank account |
| Apply advance | 210400 | 130100 |
| Credit note | Income account of each line; 210300 VAT | 130100 |
| Debit note | 210100 | Expense account of each line; 130200 VAT |

Journal lines carry `party` (customer or supplier name) and `costCentre` (from the document; the requirement adds Cost Centre to journal lines, Req L1318-1334). Assert sum(debit) === sum(credit) after rounding; if a 0.01 difference remains, add it to 590100.

### 7.3 Generators from source documents (called by CRM, Rental, Inventory)

| Generator | Input | Invoice built |
|---|---|---|
| `invoiceFromOrderLines(soId, lineIds, opts)` | Sales Order lines that are not Rental and not AMC | One line per SO line: item, desc, qty, unit, rate = SO price (Tr L2591-2595), discount, VAT from SO `vatType`, account by activity, `activity`, `costCentre` (line override else header). Header copies customer, entity, payment terms, currency, transaction type, LPO, salesperson, addresses, cost centre, activity. Source `{ type: 'Sales Order', id: soId, number, lineIds }` |
| `buildRentalInvoice(order, deliveries, priorInvoices, from, to)` | PURE, no store access; used by both the UI and the seed | Section 8 |
| `invoiceRentalPeriod(soId, from, to, opts)` | Reads store, calls the builder, creates the invoice (`isRental true`, `periodFrom/To`), returns `{ invoice?, message }` ("Nothing to bill" when no lines) |
| `nextRentalPeriod(soId)` | `{ from, to }`: from = day after the latest `periodTo` of the order's rental invoices, else the earliest assignment start; to = from + 1 month - 1 day |
| `invoiceJobCard(jc, opts)` | Job card | Lines: visit value (tag `visit`, 410400, 0 if `visitFoc`), each non-FOC material (tag `material`, 410200), each non-FOC service (tag `service`, 410400). FOC lines are not on the invoice. Cost centre = order `costCentre`, activity AMC. Source Job Card |
| `invoiceDamage(soId, chargeIndex, opts)` | `so.damageCharges[i]` | One line "Damage charge: <asset> <note>" (tag `damage`, 410600). Refuses when `hasWaiver(so.lines)` with message "A damage waiver was paid on this order, a damage invoice is not allowed" (Req, Tr L2279). Note: `inspect()` already never stores a charge when a waiver exists, the check is a second guard |
| `invoiceDisposal({ disposalId, number, assetId, buyer, customerId?, amount, date })` | Disposal outcome | One line "Sale of <asset>" or "Scrap sale of <asset>" (410700), partyName = buyer. Source Asset Disposal |
| `advanceCollection({ soId, amount, method, bankAccount, reference, date })` | Sales Order | Collection with `isAdvance true`, no allocation; created Pending (D5); on approval journal Dr bank Cr 210400 |
| `billFromCrossHire(ch, { supplierInvoiceNo, supplierInvoiceDate, includeExpenses: true })` | Cross-hire order | Line "Cross-hire <group> <category> (<start> to <end>)" qty `ch.qty ?? 1`, rate `ch.rate` (Agreed Rate total), 510100; expenses from `ch.expenses` (account by name, VAT 5%). Supplier from `ch.supplierId`. Source Cross Hire |
| `billDisputeCharge(ch, amount)` | Return to Supplier with dispute > 0 | Supplementary bill "Supplier dispute / additional charge", 510500, supplier invoice no `<ch.number>-DSP` (editable later) |
| `billFromTrip(trip)` | Completed trip with `transport === 'External Transporter'` and Transport Charge expenses > 0 | Supplier = `suppliers.find(s => s.name === trip.transporter)` else name only; lines = Transport Charge expenses, 510300, cost centre = trip `costCentre`. Source Trip. Salik / fuel of own vehicles are not bills |

---

## 8. Rental billing rules (`buildRentalInvoice`)

Inputs: the order (with lines and assignments), its deliveries, its prior rental invoices (non-deleted), and the period `[from, to]` (inclusive dates).

1. **Rental lines** (`line.activity === 'Rental'`): for each assignment `a` of the line with `a.state !== 'Sold'`:
   - billable start = max(from, a.start). `a.start` is the Rental (invoice) Start Date from the Delivery Order; an asset on Hold has its future start, so it is excluded until then.
   - billable end = min(to, stopDay - 1) when `a.stop` is set (billing stops at the Return Entry or replacement day; the stop day itself is not billed, which avoids double billing on a same-day replacement), else `to`.
   - skip when billable start > billable end, or when a prior invoice line already covers this `assetId` + `soLineId` up to or past billable start (use the max `periodTo` of prior lines with the same `assetId` and `soLineId`; start = max(start, priorTo + 1)).
   - days = billable end - billable start + 1; periodDays = to - from + 1.
   - amount: Monthly frequency: `rate = line.price`, `qty = round4(days / periodDays)` (1 for a full period); Weekly: `qty = days / 7`; Daily: `qty = days`; Quarterly / Yearly: `qty = days / periodDays / 3` or `/ 12`. FOC lines: rate 0 (still listed, so the client sees the unit). Line discount = `line.discount`.
   - one invoice line per assignment: item `line.item`, desc `<Asset ID> <asset name>, <billable start> to <billable end> (<days> days)`, tag `rental`, account 410100, `assetId`, `deliveryId`, `soLineId`, `periodFrom`, `periodTo`, `days`, `periodDays`.
2. **Recurring service lines** (`activity Service`, `billing 'Recurring'`, e.g. Damage Waiver Monthly): one line per period while at least one rental assignment is billable in the period; same pro-rata as the earliest billable rental assignment; tag `recurring-service`, account 410500.
3. **One-time service lines** (`billing 'One-time'` or `'Lump sum'`, not FOC, no `fulfilmentRef`):
   - name matches `/return|collection/i`: billed on the final invoice only, i.e. when after this period no assignment of the order is On Hire or Hold.
   - all others (Delivery Charge, Installation, Transportation): billed on the first rental invoice of the order.
   - tag `one-time-service`, account 410500. The caller sets `fulfilment 'Charged and invoiced'` and `fulfilmentRef` on those SO lines.
4. **Waiting charge**: each delivery with `waitingCharge > 0` whose id is not yet on a prior invoice line (tag `waiting-charge`, `deliveryId`) is added once, account 410500, desc "Waiting charge, <DO number>, site not ready".
5. Damage charges are NOT part of the cycle (own invoice, 7.3).
6. Header: as `invoiceFromOrderLines`, plus `isRental true`, `periodFrom/To`, narration "Rental invoice <from> to <to>". Invoices always use the Sales Order price.
7. Hint on the dialog and the Billing Cycle value: `Monthly, anchored on the first Rental Start; partial periods pro-rated by days. ${TO_CONFIRM}`.
8. Overdue assets (past contract end, still On Hire) keep billing at the same rate (Overdue Billing Treatment "Same Rate" default; the Renewals page choice is local state only). Hint `TO_CONFIRM`.

**Acceptance examples** (unit check by hand after Phase 1, dates as written in the raw seed, i.e. demo day 30 Sep):
- Transcript example (Tr L2237-2241), monthly 10,000 rental + monthly waiver 100 + delivery 200 + return 200 over 6 months: month 1 = 10,300; months 2-5 = 10,100; month 6 = 10,300 (before VAT).
- so2 (Gulf Build Contracting), period 2026-07-04 to 2026-08-03 (31 days): 200 KVA 29,500.00 (full); 20 ft POD from 07-06, 29/31 x 7,500 = 7,016.13; Damage Waiver Monthly 150.00; Installation already invoiced (INV-26-00415) so not repeated. Subtotal 36,666.13, VAT 1,833.31, total 38,499.44.

---

## 9. Seed data (`src/modules/accounting/seed.ts`)

Build from the RAW constants (`orderSeed`, `deliverySeed`, `jobCardSeed`, `crossHireSeed`, `disposalSeed`) with as-of date `'2026-09-30'` (the store `DEMO_BASE`). Then call `seedCollection(name, rows)` for each accounting collection. `seedCollection` shifts every date by the demo offset, so the seeded history stays consistent with the shifted CRM data. Never build seeds from `getCollection` (already shifted, would shift twice). Seed once, in `accounting/data.ts` `seedAccounting()` called at the bottom of `engine.ts` and in each hook.

| Seed | Records |
|---|---|
| Rental history | For each Rental order in `orderSeed` (so1, so2, so3, so5, so9; so4 and so11 start after 30 Sep so get none): run `buildRentalInvoice` for consecutive monthly periods from the first Rental Start while the period end < 2026-09-30. Numbers `INV-26-00300` upward in date order (about 25 invoices, must stay below 00344). All Approved, journals posted. Payment: invoices whose due date is more than 15 days before 30 Sep are Paid (one Collection each, Bank, Emirates NBD); the newest invoice per order is Unpaid; so5's second newest is Partially Paid (50%) so Aged Receivable has every bucket |
| Existing numbers | `INV-26-00402` so1 Delivery Charge 1,500 (Paid); `INV-26-00415` so2 Installation 3,500 (Paid); `INV-26-00344` so9 Delivery Charge 1,500 (Paid); `INV-26-00371` jc2 (visit 4,500 + 2 x 85 = 4,670, Paid, matches the jc2 log); `INV-26-00396` jc3 (4,500 + 840 + 650 = 5,990, Unpaid, matches jc3 log); `INV-26-00118` disposal Khalid Bin Saeed 38,000 (Paid); `INV-26-00287` disposal Emirates Metal Recycling 6,500 (Paid). The rental builder must skip one-time lines that already have a `fulfilmentRef` |
| Bills | `BILL-26-00021` ch1 Falcon Equipment Hire, supplier invoice FAL-INV-9921, 36,000 + VAT, Paid; `BILL-26-00022` ch2 Gulf Genset Rentals, GGR-2210, 21,000 + VAT, Paid; `BILL-26-00023` ch5 Gulf Genset Rentals, GGR-2291, 13,500 + VAT, Approved, Unpaid |
| Advance | `PAY-26-00031` advance Collection AED 20,000 from Palm Marina Development against so4 (SO-26-00052), unapplied, so "Apply Advance" can be demoed |
| Credit note | `CRN-26-00008` against the latest so5 invoice, reason Early termination, one line pro-rata 3 days of the 500 KVA, Approved |
| Debit note | `DBN-26-00003` against BILL-26-00022, reason Unit breakdown downtime, 2 days of 21,000 / 30, Approved |
| Journals | One per approved document above, numbers `JV-26-00200` upward in posting-date order |
| Rental runs | Two Previous Jobs rows: "RUN-26-00011 Processed, 3 orders, 3 invoices" (1 Sep), "RUN-26-00012 Processed" (1 Sep + 1 month) referencing seeded invoice ids |

Back-links that the seed must also satisfy on the CRM side (edit `crm/data.ts` seeds): `jc2.invoiceId` and `jc3.invoiceId` = the seeded invoice ids (use fixed ids `inv-371`, `inv-396`); keep `invoiceRef`. Use fixed ids for every seeded accounting record (`inv-300`..., `bill-21`, `pay-31`, `crn-8`, `dbn-3`, `jv-200`...) so links are stable.

After seeding, the counters must start after the seeds: first runtime numbers are INV-26-00416, BILL-26-00024, PAY-26-00061, CRN-26-00009, DBN-26-00004, JV-26-00401.

---

## 10. Phase plan

### Phase 1: Accounting data, engine and seed (no UI)
1. Create `accounting/data.ts` (section 6), `engine.ts` (section 7, 8), `seed.ts` (section 9).
2. Create `accounting/shared.tsx` hooks: `useInvoices`, `useBills`, `usePayments`, `useCreditNotes`, `useDebitNotes`, `useJournals`, `useRentalRuns` (each `useCollection(COLA.x)` after `seedAccounting()`), `R_ACC` refs:
   ```ts
   export const R_ACC = {
     inv: 'Finance > Sales Invoicing & Receivables (Req L1340-1361); Instruction 6 Oct (accounting POC)',
     bill: 'Procurement > Vendor Bill (Req L842-864); Finance > Payables (Req L1371-1385)',
     pay: 'Finance > Payments & Collections (Req L1350-1359, L1371-1385)',
     gl: 'Finance > General Ledger, Cost Centre on journals (Req L1318-1334)',
     rental: 'Rental > Rental Invoicing & Billing Cycle (Req L264, L271, L628-634; calls 17, 18, 22, 30 Sep)',
     amc: 'CRM > AMC billing (Req L1479-1497; calls 22 Sep, 30 Sep, 5 Oct)',
     cross: 'Rental > Cross-Hire supplier invoice (Req L886-925)',
     disposal: 'Fixed Asset disposal sale invoice (call 2 Oct L4798, L4826)',
   };
   ```
3. Checkpoint: `npx tsc --noEmit`. Hand-check the two acceptance examples in section 8 with a throwaway `console.log` in the browser or a temporary call (remove afterwards).

### Phase 2: Accounting screens
Sidebar (existing order from `docs/baseline/accounting.md`; built screens marked, the rest use `ExistingScreen` from `@/modules/rental/ExistingScreen` with the baseline columns, as Rental already does):

```
Dashboard                                  /accounting                       existing, KPI cards (live)
Journal Entry                              /accounting/journals               built (list + view)
Payment Entry > Payment                    /accounting/payments               built
Payment Entry > PDC Send Transfer          ExistingScreen
Payment Entry > Collection                 /accounting/collections            built
Payment Entry > PDC Receiver Transfer      ExistingScreen
Payment Request                            ExistingScreen
Invoice > Bills                            /accounting/bills                  built
Invoice > Invoices                         /accounting/invoices               built
Invoice > Cash Expense                     ExistingScreen
Credits > Debit Notes                      /accounting/debit-notes            built
Credits > Credit Notes                     /accounting/credit-notes           built
Expense, Commissions, Fixed Asset Management, Budget, Master Data   ExistingScreen each (baseline columns)
Reports                                    /accounting/reports                built index: Aged Receivable, Aged Payable, Customer SOA, General Ledger
Settings > Chart of Accounts               /accounting/chart-of-accounts      built; other Settings entries ExistingScreen
```

Routes: `invoices`, `invoices/add`, `invoices/:id` (id or number), `invoices/:id/edit`; same for `bills`; `collections`, `collections/add`, `payments`, `payments/add`, `payment-entries/:id`; `credit-notes`, `credit-notes/add?invoice=`, `credit-notes/:id`; `debit-notes`, `debit-notes/add?bill=`, `debit-notes/:id`; `journals`, `journals/:id`; `chart-of-accounts`; `reports`, `reports/:slug`.

**2.1 Invoices list** (`InvoiceList`): `PageTitle "Invoices"`, `DataTable` with filter chips on Status. Columns: ID, Date, Customer (partyName), Source (`<type> <number>`, NEW), Activity Type (NEW), Cost Centre / Project (NEW), Payment Status (chip), Status (chip), Total Invoice Value, Amount Due (NEW? no: existing has amount due on the view; keep as column only if needed, mark NEW), Due Date, Currency, Company. Row click to view. Row actions: View, Edit (hidden when Approved), Duplicate, Delete (hidden when Approved or paid). `onAdd` to `invoices/add`. Supports `?so=<id>` to pre-filter (used from the AMC and SO Invoices tabs, chip "Filtered by SO-26-xxxxx" with a clear link).

**2.2 Invoice view** (`InvoiceView`), Sales Order layout:
- `FormHeader` crumbs Invoices > number; status = approval chip; second chip payment status next to it (render both inside `status`).
- Header buttons:
  - `Edit` (only Draft, Pending, Rejected) to `invoices/:id/edit`.
  - Approval: `Submit for Approval` (Pending / Rejected: dialog with approver select from `systemUsers`), `Quick Approval` (Pending / Rejected), `Accept` and `Reject` (Submitted; reject needs a reason).
  - `MenuButton "Create"`: Collection Entry (Approved and not Paid: opens `CollectionDialog` prefilled with amount due), Apply Advance (Approved, customer has unapplied advance: dialog lists advances), Credit Note (Approved: to `credit-notes/add?invoice=<id>`).
  - `MenuButton "View"`: Source document (navigates by source type: Sales Order `/crm/sales-orders/:soId`, Job Card `/crm/job-cards/:id`, Asset Disposal `/inventory/disposals/:id`, Rental Cycle the order), Accounting Ledger (opens `LedgerDialog` with the journal lines, disabled until Approved), Customer SOA (`/accounting/reports/customer-soa?customer=`).
  - `MenuButton "Actions"`: Send by Email (`EmailDialog` from CRM `ActionDialogs`, `customerId` may be undefined: then To is empty), Print (`PrintDialog doc="Sales Invoice"`), Duplicate, Payment Request (enabled only when overdue: toast "Payment reminder emailed to <customer>" and log), Delete (ConfirmDialog, same rule as engine).
- Alerts: credit-limit warning (if exceeded), "Created from <source>" info, overdue warning.
- Body: `TabPanels`:
  - Basic Details: `SpecView` of header fields (ID, Date, Posting Time, Customer, Entity, Payment Terms, Due Date, Transaction Type, Currency, Exchange Rate, Salesperson, LPO, Activity Type NEW, Cost Centre / Project NEW, Source NEW, Rental Period NEW when `isRental`, VAT Type, Narration); Section Classification (Location, Department); Section Items (read-only `DataTable`: Item, Description, Period (rental), Qty, UOM, Rate, Discount %, VAT, Amount); Section Taxes and Charges (VAT 5% total); Section Discounts; `InvoiceTotals` panel (Total Quantity, Item Discount, Additional Discount, Subtotal Excluding Taxes, VAT, Round Off, Grand Total, Amount Paid, Amount Due).
  - Address and Contact.
  - Payments (NEW tab name existing in ERP as allocation view): collections allocated, credit notes, advances applied.
  - Accounting Ledger: journal lines table (Account, Party, Cost Centre, Debit, Credit, totals).
  - Activity Log: `Timeline`.

**2.3 Invoice form** (`InvoiceForm`, create and edit): `FormHeader` actions `Discard`, `Save as Draft`, `Save`. Uses `SpecForm` sections in the existing order: Basic Details (Customer select from `customers`, or free Party Name when not a customer; Entity master; Date; Posting Time; Payment Terms master; Due Date read-only computed; Transaction Type; Currency; Exchange Rate; Salesperson; Cost Centre / Project select `COST_CENTRES` NEW; Activity Type select NEW; VAT Type; Narration), Classification, Items (`RowsEditor` with Item, Description, Qty, UOM, Rate, Discount %, VAT % select 5 / 0, Account select of income accounts), Discounts, Attachment. Validation like `commercialErrors`: customer or party name, at least one line, quantities > 0. Query `?so=<id>` prefills header from the order (no lines). Edit mode refuses when Approved.

**2.4 Bills** list / view / form: same structure. List columns per baseline (ID, Supplier, Supplier Invoice No NEW? baseline view has it, keep unmarked, Payment Status, Status, Total Invoice Value, Invoice Date, Due Date, Payment Amount, Currency, Source NEW, Cost Centre NEW). Form has Items and Expenses (`RowsEditor` Account select of expense accounts, Narration, Amount, VAT %). View Create menu: Payment Entry, Debit Note; View menu: Source (Cross Hire `/rental/cross-hire-orders/:id`, Trip `/crm/trips/:id`), Accounting Ledger, Debit Notes.

**2.5 Collection and Payment** (`PaymentEntryForm` with `direction` from the route): Party (customer or supplier select), Date, Type (Cash / Bank / Cheque), Bank Account (`BANK_ACCOUNTS`), Cheque No / Date (Cheque only), Reference, Amount, Advance (check). Allocation table lists the party's approved open invoices (or bills) with Invoice, Date, Due Date, Total, Due, Allocate (editable number, auto-fill oldest first button "Allocate oldest first"). Unallocated remainder requires Advance ticked. Actions: Save, Save and Approve. View: header Approve (Pending), Actions Print / Send by Email, tabs Allocations, Accounting Ledger, Activity Log. Lists: Collection list (Series, Date, Journal Type "Cash Receipt Voucher", Type, Party, Total, Approval Status, Advance, Bank, Reference); Payment list same with Supplier.
`CollectionDialog` (in `shared.tsx`): compact dialog used from invoice view, job card, SO: amount (default due), type, bank account, reference; the Collection is created Pending (D5). Calls `createPayment({ ... allocations: [{ invoice, amount }] }, { approve })`; `approve` is always false from dialogs (D5).

**2.6 Credit and Debit Notes**: form from `?invoice=<id>` (or `?bill=`): header party read-only, against invoice read-only, date, reason select (`NOTE_REASONS` / `DEBIT_REASONS`), lines copied from the invoice with editable qty and rate (cannot exceed due; error message). Save (Pending) / Save and Approve. View: Approve button, View against document, Accounting Ledger tab, Activity Log. Lists: ID, Date, Party, Against, Reason, Amount, Status.

**2.7 Journal Entry**: list columns per baseline (Posting Date, Series Number, Reference Type, Status, Amount, Created By, Journal Type, Currency, Narration); no Add button (all journals are system-posted in this POC; subtitle says so). View: header info + lines table with totals; "View source document" button.

**2.8 Chart of Accounts**: list ID, Account Name, Status (Enabled), Account Code, Account Type (section 6.2). Row click to General Ledger report filtered by the account.

**2.9 Reports** (live, own small page component, columns sortable, Print button, totals row; reuse the look of `CrmReportPage` by importing it from `@/modules/crm/CrmReport` with `CrmReportDef` built from live data inside a component):
- Aged Receivable: per customer, buckets Current, 1-30, 31-60, 61-90, 91-120, 121-180, 181-365, 365+ by days past due of approved unpaid invoices, Total.
- Aged Payable: same for bills by supplier.
- Customer SOA: select customer; rows Date, Document, Reference, Debit, Credit, Running Balance (invoices, collections, credit notes).
- General Ledger: select account; rows Posting Date, Journal, Reference, Party, Cost Centre, Debit, Credit, Balance.

**2.10 Dashboard**: `KpiRow`: Receivables outstanding, Overdue receivables, Payables outstanding, Collected this month; small table "Latest invoices" (5). Existing dashboard has KPI cards, so classification EXISTING WITH CHANGE (cards fed by live data).

Checkpoint: `npx tsc --noEmit`; click every new menu entry, no blank screens.

### Phase 3: AMC Order view and Job Card (part A)

**3.1 `AmcView`** (`src/modules/crm/AmcPages.tsx`), Sales Order style, read-only:
- `FormHeader` crumbs AMC Orders > number, status chip.
- Header buttons (same order and style as `SalesOrderView`):
  - `Edit` to `/crm/sales-orders/:id/edit` (the existing Sales Order form; the form is only used to create and edit).
  - `Confirm` when status Pending (`confirmOrder`).
  - `MenuButton "Generate"` (variant contained): `Job Card (visit N)` for the first planned visit without a job card, navigates to `/crm/job-cards/add?so=<id>&visit=<idx>`, disabled when every visit has one; `Invoice` enabled when at least one job card is Completed and not invoiced: one candidate generates directly through `GenerateJobCardInvoiceDialog` (confirmation showing the invoice lines and total), several open a picker (select job card) in the same dialog. The invoice is created Pending (D4). After success toast "Invoice INV-26-xxxxx raised against JC-26-xxxxx, pending approval in Accounting" and stay.
  - `MenuButton "View"`: Sales Order, Quotation, Opportunity, Invoices (`/accounting/invoices?so=<id>`).
  - `MenuButton "Actions"`: Send by Email (`EmailDialog`, log to the order), Print (`PrintDialog doc="AMC Order"`), Print consolidated report (`window.print()` after switching to that tab is not needed; keep `window.print()`), Close (`ConfirmDialog`, `closeOrder`).
- Body:
  - `KpiRow` kept (Contract value, Invoiced = sum of approved job card invoices from the engine, Free of cost, Consumables cost, Profit to date).
  - `CommercialTabs kind="order" locked` with `f = soForm(o, oppNo, quoteNo)` (export `soForm` from `SalesOrderPages.tsx`). For AMC, `CommercialTabs` already shows the Contract section (AMC Start, End, Visits, Contract Value, Scope) and the Contract Value totals instead of Items. Pass `belowGeneral={<Section title="Project" change="new" req={R_AMC}><SpecView ... Project, Site, LPO /></Section>}`.
  - The value-split `Alert` kept under the tabs.
  - `TabPanels`: Planned Visits (as today, action column: "Create Job Card" to the add route, "Open Job Card" to the view; Payment column from `paymentStatusOf(jc.invoiceId)`), Job Cards (NEW: Job Card, Visit, Technician, Status, Done On, Invoice total, Invoice, Payment; row click to the view), Invoices (NEW: engine `invoicesOfOrder(o.id)`: Invoice, Date, Job Card, Total, Due, Payment Status, Status; row click to `/accounting/invoices/:id`), Consolidated report (as today, invoiced figures from invoices), Activity Log.
- Remove the old "View Sales Order" and "Print consolidated report" buttons (now in View and Actions).

**3.2 Job card routes** (`src/modules/crm/index.tsx`): replace `{ path: 'job-cards/:id', element: <JobCardPage /> }` with `job-cards/add` -> `JobCardForm`, `job-cards/:id` -> `JobCardView`, `job-cards/:id/edit` -> `JobCardForm`. Static route `add` must be listed before `:id`.

**3.3 `flow.ts` job card functions**:
- `draftJobCard(soId, visitIdx): JobCard` (new, pure, no persist): the object `createJobCard` builds today, number shown as "Assigned on save".
- `createJobCard(soId, visitIdx, fields?: Partial<JobCard>): string`: unchanged guard (existing job card for the visit returns its id), now merges `fields` and persists. Keep the old signature working (fields optional).
- `invoiceJobCard(jc, opts)`: calls `engine.invoiceJobCard(jc, opts)`, then patches the job card `status 'Invoiced'`, `invoiceId`, `invoiceRef = invoice.number`, logs as today, returns the invoice.
- `markJobCardPaid`: delete; replaced by `CollectionDialog` on the invoice. Remove `paymentStatus` writes; keep the field in the type for seed compatibility but stop reading it (use `paymentStatusOf(jc.invoiceId)`; fall back to `jc.paymentStatus` when no `invoiceId`).
- `recordVisit`: has no caller (verified 6 Oct). Delete it.

**3.4 `JobCardView`** (read-only):
- Crumbs AMC Orders > SO number > JC number; status chip; if invoiced, payment chip.
- Header: `Complete Visit` (contained, status Open; same validations as today: technician, van when materials, stock check, then `completeJobCard`); `MenuButton "Generate"`: Invoice (enabled when Completed, opens `GenerateJobCardInvoiceDialog`); `MenuButton "View"`: AMC Order, Sales Order, Invoice (when invoiced); `MenuButton "Actions"`: Edit (disabled when Invoiced, navigates to `/crm/job-cards/:id/edit`), Print (`PrintDialog doc="Job Card"`), Upload signed copy (existing dialog), Record Payment (enabled when the invoice is Approved, not Paid, and has no Pending Collection: `CollectionDialog`; the Collection is created Pending, D5), Send by Email.
- Body: info `Alert` when invoiced; `SpecView` of `jcSpecs` (all fields displayed, values for selects as text); Section Materials consumed (read-only `DataTable`: Material, Quantity, UoM, Billed price, FOC, Cost); Section Services performed (read-only); totals box (as today); Section Invoice (NEW: Invoice number link, Status, Total, Amount Due, Payment Status); Section Accounting and inventory entries (keep the consumption rows; add a line "Sales invoice journal <JV number>" with link when posted); Section Job card log.

**3.5 `JobCardForm`** (create and edit):
- Create: reads `so` and `visit` from the query; if a job card exists for the visit, `Navigate` to its view. State = `draftJobCard(...)`.
- Edit: loads the job card; if Invoiced, `Navigate` to the view with toast "An invoiced job card cannot be edited".
- `FormHeader` crumbs ... > "New Job Card" or "Edit JC-..."; actions `Discard` (back) and `Save` (create: `createJobCard(so, visit, f)` then navigate to the view with toast "Job card JC-26-xxxxx created"; edit: `saveJobCard(f)` then view).
- Body: today's `SpecForm` + materials and services `RowsEditor` + totals box (moved unchanged from `JobCardPage`). No Generate or Actions menus on the form.

**3.6 `AmcList`**: "Invoiced" and "Payment" columns from the engine (`invoicesOfOrder`, `paymentStatusOf`). Keep `onAdd` to `/crm/quotations/add?activity=AMC` (creation through the Quotation form, unchanged).

Checkpoint: tsc; walk SO-26-00050 (so10): visit 3 Completed -> Generate > Invoice -> invoice Pending, Record Payment disabled -> approve it in Accounting > Invoices (Quick Approval) -> back on the job card Record Payment (Collection Pending, D5) -> approve the Collection -> job card shows Paid -> AMC view shows 3 of 3 invoiced, payment figures updated; visit 4 -> Create Job Card form -> Save -> view read-only.

### Phase 4: Connect the flows (part C)

**4.1 Sales Order** (`SalesOrderPages.tsx`, `ActionDialogs.tsx`, `flow.ts`):
- `fulfilLine(soId, lineId, detail, opts)`: for every activity except AMC, call `engine.invoiceFromOrderLines(soId, [lineId], opts)`; set `fulfilment = step.done`, `fulfilmentRef = invoice.number`, log as today; return the number. The AMC branch is removed (AMC is billed from job cards; `NEXT_STEP.AMC` stays for the label only, `lineActions` already routes AMC lines to the AMC order).
- `NextStepDialog`: creates the invoice Pending (D4); toast "<step done>, invoice INV-26-xxxxx pending approval"; stays on the SO.
- Create menu:
  - `Invoice` opens new `InvoiceLinesDialog`: checklist of invoiceable lines (non-Rental, non-AMC, not yet invoiced, Trading / Fuel / FA Trading need `fulfilment` 'Delivered' or are issued in the same step as today). Confirm builds ONE invoice for the selected lines (`engine.invoiceFromOrderLines(soId, ids)`), marks each line, toast.
  - No rental invoice entry on the Sales Order (D3). Rental invoices come only from Rental > Invoicing Rental Order (4.2). The Invoices tab and the Asset Ledger show them.
  - `Advance`: `AdvanceDialog` (Amount, Type, Bank Account, Reference, Date) calls `engine.advanceCollection`, logs "Advance PAY-26-xxxxx received, AED x" on the order. Label stays "Advance".
- New tab `Invoices` (change new, req `R_ACC.inv`), all activities: summary row (Invoiced, Received, Credit notes, Outstanding) + table of invoices of the order (Invoice, Date, Type: Rental period / Lines / Damage / Job card, Period, Total, Due, Payment Status, Status) + advances list with remaining amount. Row click to the invoice.
- `Ledger` (Asset Ledger): Invoiced to date = sum of invoice lines with that `assetId` + `soLineId` (approved and pending, not deleted); Received to date = for each such line, line total x (invoice amountPaid / invoice total). Add column "Next invoice date" = `nextRentalPeriod(so.id).from` while the asset is out. Replace the note "Received amounts are sample figures" with "Invoiced and received come from the invoices in Accounting".
- Charges tab: add columns Invoice (number link or "Not invoiced"), Payment; row action `Raise Damage Invoice` (hidden when invoiced) calling `invoiceDamage` via flow (sets `damageCharges[i].invoiceId`).
- `lineStatus` for Service Recurring lines: "Billed with each rental cycle" (unchanged).
- Export `soForm`.

**4.2 Rental > Invoicing** (`src/modules/rental/index.tsx` + new `src/modules/rental/InvoicingPages.tsx`):
- `invoicing` route: live list `RentalInvoicingList` with the existing columns: Rental Order, Date, Customer, Invoice (latest number), Start Date (first Rental Start), End Date (contract end), Next Invoice Date, Billing Cycle ("Monthly"), Currency, Narration; plus selectable rows and a `Run Invoicing` button (NEW) that, for each selected order, calls `invoiceRentalPeriod(soId, nextRentalPeriod)` only if the next period end <= today (else skip with message), marks first / final one-time service lines invoiced on the Sales Order (`fulfilmentRef`, written by a new `markOneTimeInvoiced(soId, lineIds, number)` in `crm/flow.ts`), creates a `RentalRun` record, toast summary "2 invoices raised (pending approval), 1 order not due yet". Before running, a confirmation dialog lists per selected order the period and the preview total from `buildRentalInvoice`, with the hint from section 8 point 7. This is the ONLY place rental invoices are raised (D3). Invoices are Pending (D4).
- `previous-jobs` route: live list of `accounting.rentalRuns` with existing columns Job, Rental Order, Status, Run At, Message.
- Billing Cycle settings screen stays static.
- Change Register: "Invoicing Rental Order" EXISTING WITH CHANGE, "Previous Jobs" EXISTING WITH CHANGE.

**4.3 Customer Returns** (`ReturnPages.tsx`): header button `Raise Damage Invoice` when `r.inspection === 'Damage Found'` and `r.damageCharge > 0` and the matching `damageCharges` entry has no `invoiceId`; also for `r.collection?.by === 'Client'`. Uses `invoiceDamage`. ValueField "Damage Invoice" (NEW) shows the number. Waiver case unchanged (no button, existing alert).

**4.4 Cross-hire** (`CrossHirePages.tsx`, `flow.ts`):
- Receive dialog: add Supplier Invoice Date (default today); on confirm `receiveCrossHire(c, inv, date)` also calls `engine.billFromCrossHire` (Pending, D4) and sets `billing 'Fully Billed'`.
- Dropship: header `MenuButton "Create"` with `Bill` (enabled when stage >= 2 or shipped and no bill yet): dialog Supplier Invoice Reference + Date, creates the bill, `billing 'Fully Billed'`.
- `returnToSupplier` with dispute > 0: creates the supplementary bill (`billDisputeCharge`), log.
- Billing Status ValueField shows `Pending Billing` / `Fully Billed` from the existing bills; new tab `Bills` (NEW) listing bills with source this order; Expense added after billing: toast "Expense added. Raise a supplementary bill from Accounting if the supplier bills it" (no automatic bill).
- Profitability panel: Vendor Cost stays computed from rate + expenses + dispute (unchanged).

**4.5 Trips** (`flow.ts completeTrip`, `FleetPages.tsx`): when an External Transporter trip is completed and has Transport Charge expenses, call `engine.billFromTrip(trip)` (Pending, D4) and log "Bill BILL-26-xxxxx raised to <transporter>". Trip view shows ValueField "Transporter Bill" with link.

**4.6 Asset disposal** (`src/modules/inventory/AssetPages.tsx` lines 611-690):
- `openOutcome`: Invoice Number field becomes read-only "Assigned on save" (remove `seq('INV', 140)`).
- On confirm: `const inv = invoiceDisposal({...})` (Pending, D4); `outcome.invoiceRef = inv.number`; keep the NBV journal `seq('JV', 360)` as today; `nav('/accounting/invoices/' + inv.id)`.
- Link on the disposal view uses `invoiceByRef(out.invoiceRef)?.id ?? out.invoiceRef` (old seeded numbers resolve by number).
- The old `InvoicePage` in `accounting/index.tsx` is deleted; the new `InvoiceView` resolves id or number and shows the "Back to Disposal Request" action through View > Source document.

Checkpoint: tsc + `npx vite build`.

### Phase 5: Change Register and changelog

**Accounting `changes[]`** (module 'Accounting & Finance'):
| Screen | Classification | Existing | Change |
|---|---|---|---|
| Accounting sidebar | EXISTING | Existing ERP sidebar | Kept in the same order; screens not touched by the requirement show their existing columns |
| Invoices (Sales Invoice) | EXISTING WITH CHANGE | Invoice list, form and view, approval, Apply Payment, Credit Note, Collection Entry, ledger | Rebuilt as in the ERP. Added: Activity Type and Cost Centre / Project inherited from the source, Source document link, rental period lines (per asset, pro-rata), credit-limit warning. Created automatically from Sales Orders, rental cycles, job cards, damage charges and disposals |
| Bills (Purchase Invoice) | EXISTING WITH CHANGE | Bills with Items and Expenses, Payment Entry, Debit Notes | Rebuilt. Added: Cost Centre / Project, source link; created from cross-hire orders, dispute charges and external transport trips |
| Collection / Payment | EXISTING | Payment Entry with allocation and advance | Rebuilt; advance from the Sales Order, Apply Advance |
| Credit Notes / Debit Notes | EXISTING | Credit and debit notes settling invoices and bills | Rebuilt |
| Journal Entry | EXISTING WITH CHANGE | Journal list and lines | Rebuilt as system-posted on approval; Cost Centre on journal lines added (Req L1318-1334) |
| Chart of Accounts | EXISTING | COA list | Accounts used by the POC |
| Reports | EXISTING | 19 reports | Aged Receivable, Aged Payable, Customer SOA, General Ledger rebuilt on live data |
| Dashboard | EXISTING WITH CHANGE | Financial KPI cards | Cards fed by the POC invoices |

**CRM `changes[]`** add: "AMC Order view (6 Oct)" EXISTING WITH CHANGE (read-only Sales Order layout, Generate / View / Actions); "Job Card (6 Oct)" EXISTING WITH CHANGE (read-only view, form on create and Edit, real invoice, Record Payment through a Collection); "Sales Order invoicing (6 Oct)" EXISTING WITH CHANGE (real invoices from lines, Rental Invoice per period, Advance as a Collection, Invoices tab, Asset Ledger from invoices, damage invoice); "Customer Returns damage invoice" EXISTING WITH CHANGE.
**Rental `changes[]`** add: Invoicing Rental Order, Previous Jobs (EXISTING WITH CHANGE), Cross Hire Orders billing (EXISTING WITH CHANGE).
**Inventory `changes[]`** add: "Asset Disposal invoice (6 Oct)" EXISTING WITH CHANGE.

**`CHANGELOG.md`** (top of the list, existing format: `### <date>, around <time>: <title>`, `**Where:**` lines, `**Type:**`, *The problem.* / *What we did.* / *Be aware.*). Entries:
1. AMC Order view becomes read-only like the Sales Order (Where: CRM / Sales > Orders > AMC Orders).
2. Job Card: view page read-only, form only to create and edit (Where: CRM / Sales > Orders > AMC Orders).
3. Accounting POC: Invoices, Bills, Collections, Payments, Credit and Debit Notes, Journals, Chart of Accounts, reports (Where: Accounting & Finance > each menu). Be aware: accounting was out of scope on 5 Oct, rebuilt on Anurag's instruction of 6 Oct; numbers assigned at creation; invoice engine is shared by CRM, Rental and Inventory.
4. Real invoices from Sales Orders, rental cycles, returns, AMC, disposal; bills from cross-hire and transport (one Where line per screen). Be aware: pro-rata and cycle anchor to be confirmed; credit limit is a warning only.
No em dashes.

### Phase 6: Verification (definition of done)

1. `npx tsc --noEmit` with zero errors; `npx vite build` succeeds.
2. `grep -rnP "\x{2014}" src docs/amc-accounting-change-plan.md CHANGELOG.md` returns nothing new.
3. `grep -rn "nextNumber('INV'" src` only in `accounting/data.ts`. `grep -rn "markJobCardPaid\|paymentStatus: 'Paid'" src` only in seeds.
4. Manual walk-through on `npm run dev` (http://localhost:5177):
   - AMC Orders > SO-26-00050: no form on the view; Generate, View, Actions present; Generate > Invoice for JC-26-00106 -> invoice Pending and Record Payment disabled; approve it in Accounting > Invoices; Job Card view read-only; Actions > Record Payment -> Collection created Pending, invoice still Unpaid; approve the Collection in Accounting > Payment Entry > Collection -> invoice Paid; AMC list Payment "3 of 3 paid" only after paying JC-26-00105's INV-26-00396 too.
   - Generate > Job Card on SO-26-00053 (so6): form opens; Discard leaves nothing; Save creates JC and opens read-only view; Actions > Edit opens the form.
   - Sales Order SO-26-00046 (so2) has no rental invoice button. Rental > Invoicing Rental Order: select SO-26-00046, Run Invoicing, the confirmation preview shows the next period; confirm; Previous Jobs shows the run; the invoice is Pending in Accounting > Invoices with Source "Rental Cycle"; the SO Invoices tab and Asset Ledger show it.
   - SO-26-00054 (so7, Trading): Create > Invoice for both lines -> one invoice, VAT 5%, lines marked "Stock issued and invoiced".
   - SO-26-00052 (so4): Invoice view of any later invoice > Create > Apply Advance uses PAY-26-00031.
   - Customer Returns: a Damage Found return without waiver -> Raise Damage Invoice; with waiver -> no button.
   - Cross Hire Order CH-26-00008 (stage 0): Receive with invoice ref -> Bill created, Billing Status Fully Billed, Bills tab shows it.
   - Inventory disposal: record a sale outcome -> lands on the real invoice; old seeded disposal links (INV-26-00118) open the seeded invoice.
   - Accounting: Journal for every approved document balances; Aged Receivable shows buckets; Customer SOA running balance ends at the customer's open AR; General Ledger for 130100 equals total open AR.
   - Review Mode on: every new screen element shows a NEW / CHANGED badge with its req.
5. Report to Anurag with the list of changed files and anything that could not be done.

---

## 11. Risks and gotchas

- **Double date shift**: build seeds from raw constants only (section 9).
- **Counters**: `nextNumber` keeps the first `seedStart` it sees per prefix. Every INV number must come from `nextInvoiceNo()` (single call site) so 415 is the seed start; seeded rental history uses 00300-00340, which is below it.
- **Import cycles**: `engine.ts` must not import `crm/flow.ts`; pages may import both.
- **Shared files**: `EmailDialog` and `PrintDialog` live in `crm/ActionDialogs.tsx` (module file, importable). Do not touch `src/components/*`. `ExistingScreen` is imported from `@/modules/rental/ExistingScreen`.
- **`TODAY` is the real clock** while seeds are written for 30 Sep; never compare raw seed dates with `TODAY` inside the seed builder, use the constant `'2026-09-30'`.
- **Old links**: `/accounting/invoices/INV-26-00118` must still work (lookup by number).
- **Job card `paymentStatus`**: the seeds still carry it; reading code must prefer the invoice.
- **Sales Order totals**: invoices always take the Sales Order price; never recompute rates from Pricing.
- **Performance**: the rental builder runs on demand only (dialog preview, Run Invoicing, seed), not on every render of large lists; memoise in `RentalInvoicingList`.
- **Size**: roughly 3,000 lines across about 20 files. Keep components small; `any` is acceptable in mock rows.

---

## 12. Out of scope (state this if asked)

Real e-invoicing (UAE or ZATCA), FX gain / loss, PDC, bank reconciliation, budgets, cost-centre reports, recurring invoice templates for non-rental invoices, three-way PO / GRN match (Procurement purchase orders and GRN are not in the POC), payroll and depreciation journals, multi-entity books (open conflict: single book in the requirement vs several entities in the 22 Sep call).
