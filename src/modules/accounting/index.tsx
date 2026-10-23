import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import type { ChangeEntry, ModuleDef } from '@/types';
import { ExistingScreen } from '@/modules/rental/ExistingScreen';
import { InvoiceForm, InvoiceList, InvoiceView } from './SalesInvoicePages';
import { BillForm, BillList, BillView } from './BillPages';
import { PaymentEntryForm, PaymentEntryList, PaymentEntryView } from './PaymentPages';
import { NoteForm, NoteList, NoteView } from './NotePages';
import { CoaList, JournalList, JournalView } from './JournalPages';
import { AccountingDashboard, ReportPage, ReportsIndex } from './reports';
import { R_ACC } from './shared';
import { AssetForm, AssetList, AssetView } from './AssetPages';

const M = 'Accounting & Finance';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });
const ex = (title: string, columns: string[]) => <ExistingScreen title={title} columns={columns} note="Existing ERP accounting screen. It is not changed by the Heavy Equipment requirement and is not rebuilt in this POC." />;

/**
 * Accounting keeps the existing ERP sidebar (docs/baseline/accounting.md). Invoices, Bills, Collection, Payment, Credit and Debit Notes, Journal Entry,
 * Chart of Accounts and four reports are rebuilt on live POC data (instruction 6 Oct); every other entry shows its existing columns.
 */
const mod: ModuleDef = {
  id: 'accounting',
  label: 'Accounting & Finance',
  basePath: '/accounting',
  icon: <AccountBalanceOutlinedIcon />,
  tileBg: 'rgba(102,215,113,.10)',
  menu: [
    { label: 'Dashboard', path: '/accounting', icon: <AccountBalanceOutlinedIcon />, change: 'changed' },
    { label: 'Journal Entry', path: '/accounting/journals', change: 'changed' },
    { label: 'Payment Entry', children: [
      { label: 'Payment', path: '/accounting/payments', change: 'changed' }, { label: 'PDC Send Transfer', path: '/accounting/pdc-send' },
      { label: 'Collection', path: '/accounting/collections', change: 'changed' }, { label: 'PDC Receiver Transfer', path: '/accounting/pdc-receive' },
    ] },
    { label: 'Payment Request', path: '/accounting/payment-requests' },
    { label: 'Invoice', children: [
      { label: 'Bills', path: '/accounting/bills', change: 'changed' }, { label: 'Invoices', path: '/accounting/invoices', change: 'changed' }, { label: 'Cash Expense', path: '/accounting/cash-expense' },
    ] },
    { label: 'Credits', children: [{ label: 'Debit Notes', path: '/accounting/debit-notes', change: 'changed' }, { label: 'Credit Notes', path: '/accounting/credit-notes', change: 'changed' }] },
    { label: 'Expense', children: [{ label: 'Expense Reimbursement', path: '/accounting/expense-reimbursement' }, { label: 'Expense Report', path: '/accounting/expense-report' }] },
    { label: 'Commissions', children: [{ label: 'Commission Setup', path: '/accounting/commission-setup' }, { label: 'Authorize Commission', path: '/accounting/authorize-commission' }, { label: 'Commission', path: '/accounting/commission' }, { label: 'Month Wise Commission', path: '/accounting/month-wise-commission' }] },
    { label: 'Fixed Asset Management', children: [{ label: 'Assets Management', path: '/accounting/assets', change: 'changed' }, { label: 'Asset Transfer', path: '/accounting/asset-transfer' }] },
    { label: 'Budget', path: '/accounting/budget' },
    { label: 'Master Data', children: [{ label: 'Customer Management', path: '/accounting/customers' }, { label: 'Vendor Management', path: '/accounting/vendors' }] },
    { label: 'Reports', path: '/accounting/reports', change: 'changed' },
    { label: 'Settings', children: [
      { label: 'Chart of Accounts', path: '/accounting/chart-of-accounts', change: 'changed' }, { label: 'Currency', path: '/accounting/currency' }, { label: 'Journal Types', path: '/accounting/journal-types' }, { label: 'Tax Code', path: '/accounting/tax-code' },
      { label: 'Tax Template', path: '/accounting/tax-template' }, { label: 'Bank Account', path: '/accounting/bank-accounts' }, { label: 'Payment Terms', path: '/accounting/payment-terms' }, { label: 'Accounting Settings', path: '/accounting/settings' },
    ] },
  ],
  routes: [
    { index: true, element: <AccountingDashboard /> },
    { path: 'invoices', element: <InvoiceList /> }, { path: 'invoices/add', element: <InvoiceForm /> }, { path: 'invoices/:id', element: <InvoiceView /> }, { path: 'invoices/:id/edit', element: <InvoiceForm /> },
    { path: 'bills', element: <BillList /> }, { path: 'bills/add', element: <BillForm /> }, { path: 'bills/:id', element: <BillView /> }, { path: 'bills/:id/edit', element: <BillForm /> },
    { path: 'collections', element: <PaymentEntryList direction="Receive" /> }, { path: 'collections/add', element: <PaymentEntryForm direction="Receive" /> },
    { path: 'payments', element: <PaymentEntryList direction="Send" /> }, { path: 'payments/add', element: <PaymentEntryForm direction="Send" /> }, { path: 'payment-entries/:id', element: <PaymentEntryView /> },
    { path: 'credit-notes', element: <NoteList kind="Credit" /> }, { path: 'credit-notes/add', element: <NoteForm kind="Credit" /> }, { path: 'credit-notes/:id', element: <NoteView kind="Credit" /> },
    { path: 'debit-notes', element: <NoteList kind="Debit" /> }, { path: 'debit-notes/add', element: <NoteForm kind="Debit" /> }, { path: 'debit-notes/:id', element: <NoteView kind="Debit" /> },
    { path: 'journals', element: <JournalList /> }, { path: 'journals/:id', element: <JournalView /> }, { path: 'chart-of-accounts', element: <CoaList /> },
    { path: 'reports', element: <ReportsIndex /> }, { path: 'reports/:slug', element: <ReportPage /> },
    { path: 'pdc-send', element: ex('PDC Send Transfer', ['Cheque Number', 'Cheque Date', 'Party', 'Amount', 'Bank', 'Status']) },
    { path: 'pdc-receive', element: ex('PDC Receiver Transfer', ['Cheque Number', 'Cheque Date', 'Party', 'Amount', 'Bank', 'Status']) },
    { path: 'payment-requests', element: ex('Payment Request', ['ID', 'Customer', 'Invoice', 'Amount Due', 'Due Date', 'Sent On', 'Status']) },
    { path: 'cash-expense', element: ex('Cash Expense', ['ID', 'Date', 'Account', 'Amount', 'Tax', 'Status']) },
    { path: 'expense-reimbursement', element: ex('Expense Reimbursement', ['ID', 'Employee', 'Date', 'Amount', 'Status']) },
    { path: 'expense-report', element: ex('Expense Report', ['ID', 'Employee', 'Period', 'Total', 'Status']) },
    { path: 'commission-setup', element: ex('Commission Setup', ['Commission Plan', 'Commission Target', 'Salesperson', 'Status']) },
    { path: 'authorize-commission', element: ex('Authorize Commission', ['Salesperson', 'Period', 'Amount', 'Status']) },
    { path: 'commission', element: ex('Commission', ['Salesperson', 'Invoice', 'Amount', 'Status']) },
    { path: 'month-wise-commission', element: ex('Month Wise Commission', ['Month', 'Salesperson', 'Amount']) },
    { path: 'assets', element: <AssetList /> }, { path: 'assets/add', element: <AssetForm /> }, { path: 'assets/:id', element: <AssetView /> }, { path: 'assets/:id/edit', element: <AssetForm /> },
    { path: 'asset-transfer', element: ex('Asset Transfer', ['Asset', 'From', 'To', 'Date', 'Status']) },
    { path: 'budget', element: ex('Budget', ['Budget Name', 'Budget Type', 'Financial Year', 'Total Amount', 'Status']) },
    { path: 'customers', element: ex('Customer Management', ['ID', 'Name', 'Phone Number', 'Emails', 'Status']) },
    { path: 'vendors', element: ex('Vendor Management', ['ID', 'Name', 'Phone Number', 'Emails', 'Status']) },
    { path: 'currency', element: ex('Currency', ['Currency', 'Symbol', 'Status']) }, { path: 'journal-types', element: ex('Journal Types', ['Name', 'Module', 'Is Payment']) },
    { path: 'tax-code', element: ex('Tax Code', ['Name', 'Rate', 'Reverse Charge', 'Tax Category']) }, { path: 'tax-template', element: ex('Tax Template', ['Name', 'Tax Codes', 'Status']) },
    { path: 'bank-accounts', element: ex('Bank Account', ['Bank', 'Account Number', 'Currency', 'Status']) }, { path: 'payment-terms', element: ex('Payment Terms', ['Name', 'Days', 'Status']) },
    { path: 'settings', element: ex('Accounting Settings', ['Setting', 'Value']) },
  ],
  changes: [
    c('Accounting sidebar', 'EXISTING', 'Existing ERP accounting sidebar', 'Kept in the same order. Screens not touched by the requirement show their existing columns and are not rebuilt', 'Instruction 6 Oct (accounting POC)'),
    c('Invoices (Sales Invoice)', 'EXISTING WITH CHANGE', 'Invoice list, form and view with approval (Submit, Quick Approval, Accept / Reject), Apply Payment, Credit Note, Collection Entry, Accounting Ledger, Payment Request, Duplicate, Delete', 'Rebuilt as in the ERP. Added: Activity Type and Cost Centre / Project inherited from the source, Source document link, rental period lines per asset (pro-rata), credit-limit warning. Created Pending from Sales Order lines, rental runs, AMC job cards, damage charges and disposals; approved in Accounting', R_ACC.inv, '/accounting/invoices'),
    c('Bills (Purchase Invoice)', 'EXISTING WITH CHANGE', 'Bills with Items and Expenses tables, supplier invoice number, Payment Entry, Debit Notes, Accounting Ledger', 'Rebuilt. Added: Cost Centre / Project and Source link. Created Pending from cross-hire orders, supplier dispute charges and external transport trips', R_ACC.bill, '/accounting/bills'),
    c('Collection and Payment', 'EXISTING', 'Payment Entry (Receive / Send) with allocation to invoices and bills, advance flag', 'Rebuilt. Entries are Pending until approved on their page; the invoice payment status and the journal change only on approval. Advance from the Sales Order, applied from the invoice', R_ACC.pay, '/accounting/collections'),
    c('Credit Notes and Debit Notes', 'EXISTING', 'Credit notes settling invoices, debit notes settling bills', 'Rebuilt; raised from the approved document, settle it on approval', R_ACC.inv, '/accounting/credit-notes'),
    c('Journal Entry', 'EXISTING WITH CHANGE', 'Journal list and lines (account, party, debit, credit)', 'System-posted on approval of every document. Cost Centre added on journal lines', R_ACC.gl, '/accounting/journals'),
    c('Chart of Accounts', 'EXISTING', 'Chart of accounts list', 'The accounts used by the POC postings, with balance and a link to the General Ledger', R_ACC.gl, '/accounting/chart-of-accounts'),
    c('Reports', 'EXISTING', '19 accounting reports', 'Aged Receivable, Aged Payable, Customer SOA and General Ledger rebuilt on live POC data; the rest unchanged', R_ACC.inv, '/accounting/reports'),
    c('Dashboard', 'EXISTING WITH CHANGE', 'Financial summary KPI cards', 'Cards fed by the POC invoices, bills and collections, plus waiting-for-approval count', R_ACC.meet, '/accounting'),
    c('Assets Management', 'EXISTING WITH CHANGE', 'Fixed Asset register placeholder', 'Rebuilt as the Fixed Asset register: Asset Type, value, depreciation (method, computation, written off basis, duration, declining factor), accounts, department and attachment. Client feedback (8 Oct): delivery/fleet vehicles are purchased for the business\'s own use, not for rental, so they are registered here with a Fleet Vehicle flag and Default Driver instead of as a Heavy Equipment Fixed Asset in Inventory. Non-vehicle rental equipment is unaffected', R_ACC.meet, '/accounting/assets'),
  ],
};
export default mod;
