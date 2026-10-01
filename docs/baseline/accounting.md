# Existing ERP baseline: Accounting (source: modules/accounting)

Most add/edit headers are server form-builder driven; field lists below come from code and API request shapes.

## Sidebar as-is
Dashboard | Journal Entry | Payment Entry: Payment, PDC Send Transfer, Collection, PDC Receiver Transfer | Payment Request | Invoice: Bills, Invoices, Cash Expense | Credits: Debit Notes, Credit Notes | Expense: Expense Reimbursement, Expense Report | Commissions: Commission Setup (Commission Plan, Commission Target), Authorize Commission, Commission, Month Wise Commission | Fixed Asset Management: Assets Management, Asset Transfer | Budget | Master Data: Customer Management, Vendor Management | Reports (19) | Settings: Chart of Accounts, Currency, Journal Types, Currency Exchange, Tax Category, Tax Code, Tax Template, Bank, Bank Account, Reconciliation, Fiscal Year, Payment Terms, Forms, Template Editor, Accounting Settings, Voucher Settings, COA Settings, COA Code Config.

## Approval statuses everywhere
Draft, Pending, Submitted, Approved, Rejected. Submit for Approval (approver picker), Quick Approval, Accept/Reject. Payment status: Draft, Pending, In Transit, Paid, Partially Paid, Unpaid, Cancelled.

## Chart of Accounts
List: ID, Account Name, Status (Enabled/Disabled), Account Code, Account Type. Form: parent type, account type, parent account, auto-generated code, currency, tax category, allowed journal, companies. COA Settings and Code Config screens. NOT existing change: Books/Ledgers Structure stays single, combined (unchanged).

## Cost Centres
DOES NOT EXIST. No cost centre entity, hierarchy, master, allocation or reporting. Only line-level Department and Location selects on transactions, and "dimension" breakdown inside Trial Balance drill-down.

## Journal Entry
List: Posting Date, Series Number, Reference Type, Status, Amount, Created By, ID, Journal Type, Currency, Exchange Rate, Reversal Date, Reversal Journal, Autopost, Narration. Lines: account, party, debit, credit, currency amounts, reference type, is_advance. No cost-centre field on journal lines.

## Sales Invoices (Invoice > Invoices)
List: ID, Customer, Payment Status, Status, Total Invoice Value, Due Date, Currency, Company, Exchange Rate. Header: date, customer, posting time, due date, payment term, currency, company, department, exchange rate, narration, additional discount, round off, addresses, links to quotation / sales order / delivery order. Recurring (Day/Weekly/Monthly/Yearly, Mark recurring / Stop). Actions: Apply Payment, Credit Note, ZATCA Report, Collection Entry, Payment Request (email dunning), Duplicate, Send Email, Download, Delete. Customer SOA report exists.
NOT existing: Activity Type inherited, Cost Centre per invoice/line, Recurring Invoice Schedule generated from the Sales Order billing cycle in accounting, Collection Priority Indicator, credit-terms override per project.

## Purchase Invoices (Bills) and Cash Expense
Bills list: ID, Supplier, Payment Status, Status, Total Invoice Value, Invoice Date, Due Date, Payment Amount, Currency ... Split Add: Item bill / Fixed Asset bill. Item + expense entries, fixed-asset lines create assets. Actions: Payment Entry, Apply advance payment, Recurring, View Accounting Ledger, View Debit Notes, Create Landed Cost. Cash Expense settled immediately. NOT existing: Linked Vendor Bill approval by purchase type, Payment Batch/Priority selection, Cost Centre per bill/line.

## Payment Entry / Collection / PDC
Payment and Collection: Cash / Bank / Cheque, advance flag, allocation to invoices / notes, round-off account. PDC pages are bulk Transfer screens only. NOT existing: payment method picklist limited to Bank Transfer / Cheque / Other as specified.

## Bank and cash
Bank, Bank Account (multiple), Reconciliation (upload PDF statement, manual exact-sum match). Cash is a COA account. NOT existing: Petty Cash Account per branch/site, Petty Cash Draw, Petty Cash Reimbursement/Settlement, Day Book, cash book.

## Fixed Asset accounting
See inventory-fa.md. Depreciation posted by backend. NOT existing: Initial Depreciation Setup Approval (one-time per asset), Disposal Gain/Loss calculation, Asset Cost Event Type (Capital Improvement / Expense) with Capital Improvement Impact, Cost Centre per asset.

## Budget
`/budget`: Budget Name, Budget Type, Financial Year, Total Amount, budget period (Monthly ... Custom), department, location, per COA account per month amounts; Compare page (budget / actual / over budget per month); statuses Draft ... Approved; Quick Approval.
NOT existing: budget linked to a Cost Centre, Bottom-Up / Top-Down process per Cost Centre Type, budget lines by expense category per Cost Centre, budget revision with reason, over-budget alert and approve/amend workflow, rolling forecast, forecast vs budget variance.

## Currency, VAT
Currency, Currency Exchange (manual records, by date), multi-currency on documents. VAT: Tax Category, Tax Code (rate, reverse charge), Tax Template, VAT Report (tabs incl. RCM), Tax Summary. ZATCA reporting on sales invoice and credit note. NOT existing: Exchange Gain/Loss auto-posting, VAT Audit File (FAF) export in UAE FTA format (ZATCA is the KSA equivalent), Export (Zero-Rated) VAT Type on quotation.

## AMC billing
NOT existing: Service Type per AMC line (Scheduled Visit non-chargeable / Consumable / Additional Task), Chargeable Override FOC, Project Team sign-off.

## Reports (existing 19)
Balance Sheet, General Ledger, Cashflow, Profit and Loss, Trial Balance, Aged Payable, Aged Receivable, Depreciation Schedule, Journal Report, Shareholder Report, Schedule Report, VAT Report, Customer SOA, Vendor SOA, Collection Register, Expense Analysis, Tax Summary, Fixed Assets Register, Sales Commission Report.
NOT existing: Fixed vs Variable Cost P&L, Collection Priority List, Day Book / Cash Position, Fixed Asset Gain/Loss on Disposal, Capital Improvement vs Expense, Activity Type Profitability, VAT Audit File, and all Cost Centre reports (P&L, Comparison, Roll-Up, Budget vs Actual vs Forecast, Allocation Detail).

## Dashboard
Financial summary KPI cards (revenue, expenses, gross margin, net profit), ageing donuts and bars, vendor/customer performance; cash-flow and reorder-point widgets are mock. NOT existing: Business Health, Receivables and Collections, Payables, Cost Centre Budget vs Actual vs Forecast, Activity Type Profitability, Cash Position dashboards as named in the document.

## Also existing (not in the document, keep unchanged)
Commissions group, Expense Reimbursement / Report, Credit / Debit Notes, Payment Request, Voucher Settings, COA Settings.
