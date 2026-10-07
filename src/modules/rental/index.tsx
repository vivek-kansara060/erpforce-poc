import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { Navigate, useParams } from 'react-router-dom';
import type { ChangeEntry, ModuleDef } from '@/types';
import { liveRoutes } from '@/modules/crm/reports';
import { RenewalsPage, ReplacementForm, ReplacementList } from './RentalPages';
import { ChOrderList, ChOrderView, ChProcess, ChRequestForm, ChRequestList, ChRequestView } from './CrossHirePages';
import { ChGrnForm, ChGrnList, ChGrnView, ChOrderForm } from './CrossHireOrderPages';
import { ChResponseForm, ChResponseList, ChResponseView, ChRfqAnalyze, ChRfqForm, ChRfqList, ChRfqView } from './CrossHireRfqPages';
import { ExistingScreen } from './ExistingScreen';
import { PreviousJobs, RentalInvoicingList } from './InvoicingPages';

const M = 'Rental';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });
const ex = (title: string, columns: string[], extra: Partial<Parameters<typeof ExistingScreen>[0]> = {}) => <ExistingScreen title={title} columns={columns} {...extra} />;

/**
 * Rental keeps the sidebar and screens of the existing ERP (5 Oct instruction), except Leads, Opportunity, Quotations and Orders: those are managed in CRM only
 * (6 Oct), where Activity Type = Rental gives the rental view.
 */
function TripRedirect() { const { id } = useParams(); return <Navigate to={`/crm/trips/${id}`} replace />; }

const mod: ModuleDef = {
  id: 'rental',
  label: 'Rental',
  basePath: '/rental',
  icon: <KeyOutlinedIcon />,
  tileBg: 'rgba(0,121,63,.10)',
  menu: [
    { label: 'Rental Dashboard', path: '/rental/dashboards/fleet-status', icon: <KeyOutlinedIcon />, change: 'changed' },
    { label: 'Product Management', children: [{ label: 'Items', path: '/rental/items' }, { label: 'Category', path: '/rental/categories' }] },
    { label: 'Demand Planning', path: '/rental/demand-planning' },
    { label: 'Invoicing', children: [{ label: 'Invoicing Rental Order', path: '/rental/invoicing', change: 'changed' }, { label: 'Previous Jobs', path: '/rental/previous-jobs', change: 'changed' }] },
    { label: 'Rental', children: [
      { label: 'Replacement Orders', path: '/rental/replacements', change: 'changed' },
      { label: 'Renewals and Expiry', path: '/rental/renewals', change: 'new' },
    ] },
    { label: 'Agreements', path: '/rental/agreements' },
    { label: 'Purchase', children: [{ label: 'Request for Quote', path: '/rental/purchase-rfq' }, { label: 'Orders', path: '/rental/purchase-orders' }] },
    { label: 'Cross Hire', children: [
      { label: 'Requests', path: '/rental/cross-hire', change: 'changed' },
      { label: 'Process Cross Hire', path: '/rental/cross-hire-process', change: 'changed' },
      { label: 'Request for Quote', path: '/rental/cross-hire-rfq', change: 'changed' },
      { label: 'Orders', path: '/rental/cross-hire-orders', change: 'changed' },
    ] },
    { label: 'Settings', children: [
      { label: 'Settings', path: '/rental/settings' }, { label: 'Billing Cycle', path: '/rental/billing-cycle' }, { label: 'Terms and Conditions', path: '/rental/terms' },
      { label: 'Forms', path: '/rental/forms' }, { label: 'Template Editor', path: '/rental/template-editor' },
    ] },
    { label: 'Reports', path: '/rental/reports', change: 'new' },
    { label: 'Dashboards', path: '/rental/dashboards', change: 'new' },
  ],
  routes: [
    { index: true, element: <Navigate to="/rental/dashboards/fleet-status" replace /> },
    { path: 'items', element: ex('Items', ['Item Code', 'Name', 'Item Type', 'Category', 'Rental Base Price', 'Status'], { link: '/inventory/items', linkLabel: 'Open Items in Inventory', note: 'Rentable units are Heavy Equipment Fixed Assets in Inventory, with their rental prices in Heavy Equipment Pricing.' }) },
    { path: 'categories', element: ex('Category', ['Parent', 'Category Name', 'Brand', 'Description', 'Status'], { link: '/inventory/categories', linkLabel: 'Open Item Category in Inventory', note: 'One Category / Subcategory master is shared by Inventory, CRM and Rental.' }) },
    { path: 'demand-planning', element: ex('Demand Planning', ['Item', 'Demand', 'On Hand', 'On Order', 'Available', 'Committed', 'PR', 'Required']) },
    { path: 'invoicing', element: <RentalInvoicingList /> },
    { path: 'previous-jobs', element: <PreviousJobs /> },
    { path: 'replacements', element: <ReplacementList /> }, { path: 'replacements/add', element: <ReplacementForm /> },
    { path: 'renewals', element: <RenewalsPage /> },
    // Fleet Management moved to CRM (6 Oct); old links keep working.
    { path: 'fleet', element: <Navigate to="/crm/fleet" replace /> }, { path: 'trips', element: <Navigate to="/crm/trips" replace /> }, { path: 'trips/:id', element: <TripRedirect /> },
    { path: 'agreements', element: ex('Agreements', ['ID', 'Date', 'Name', 'Type', 'Vendor', 'Valid Up To', 'Company', 'Currency', 'Status']) },
    { path: 'purchase-rfq', element: ex('Request for Quote', ['ID', 'Date', 'Vendor', 'Status']) },
    { path: 'purchase-orders', element: ex('Orders', ['ID', 'Date', 'Vendor', 'Receiving Status', 'Billing Status', 'Status']) },
    { path: 'cross-hire', element: <ChRequestList /> }, { path: 'cross-hire/add', element: <ChRequestForm /> }, { path: 'cross-hire/:id', element: <ChRequestView /> },
    { path: 'cross-hire-process', element: <ChProcess /> },
    { path: 'cross-hire-rfq', element: <ChRfqList /> }, { path: 'cross-hire-rfq/add', element: <ChRfqForm /> }, { path: 'cross-hire-rfq/:id', element: <ChRfqView /> }, { path: 'cross-hire-rfq/:id/edit', element: <ChRfqForm /> }, { path: 'cross-hire-rfq/:id/analyze', element: <ChRfqAnalyze /> },
    { path: 'cross-hire-rfq/:id/responses', element: <ChResponseList /> }, { path: 'cross-hire-rfq/:id/responses/add', element: <ChResponseForm /> }, { path: 'cross-hire-rfq/:id/responses/:vid', element: <ChResponseView /> }, { path: 'cross-hire-rfq/:id/responses/:vid/edit', element: <ChResponseForm /> },
    { path: 'cross-hire-orders', element: <ChOrderList /> }, { path: 'cross-hire-orders/add', element: <ChOrderForm /> }, { path: 'cross-hire-orders/:id', element: <ChOrderView /> }, { path: 'cross-hire-orders/:id/edit', element: <ChOrderForm /> },
    { path: 'cross-hire-orders/:id/grns', element: <ChGrnList /> }, { path: 'cross-hire-orders/:id/grns/add', element: <ChGrnForm /> }, { path: 'cross-hire-orders/:id/grns/:gid', element: <ChGrnView /> }, { path: 'cross-hire-orders/:id/grns/:gid/edit', element: <ChGrnForm /> },
    { path: 'settings', element: ex('Settings', ['Setting', 'Value']) },
    { path: 'billing-cycle', element: ex('Billing Cycle', ['Name', 'Count', 'Duration', 'Company', 'Invoicing Type', 'Max Schedule Count', 'Prorated']) },
    { path: 'terms', element: ex('Terms and Conditions', ['Name', 'Content', 'Status']) },
    { path: 'forms', element: ex('Forms', ['Form', 'Module', 'Status']) },
    { path: 'template-editor', element: ex('Template Editor', ['Template', 'Type', 'Status']) },
    ...liveRoutes('rental'),
  ],
  changes: [
    c('Invoicing Rental Order (6 Oct)', 'EXISTING WITH CHANGE', 'Invoicing Rental Order list (Rental Order, Date, Customer, Invoice, Start Date, End Date, Next Invoice Date, Billing Cycle, Currency, Narration) fed by the billing schedule', 'Live list of rental Sales Orders with their next billing period, status (Due, Not due yet) and the preview amount. Run Invoicing raises one invoice per selected order for the ended period: each delivered asset from its own Rental Start (Hold excluded) to its off-hire day, pro-rated, plus the recurring waiver, first-invoice and final-invoice charges and any waiting charge. The only place rental invoices are raised (decision 6 Oct); invoices are Pending until approved in Accounting. Cycle anchor and pro-rata to be confirmed with client', 'Rental > Rental Invoicing & Billing Cycle (Req L264, L271, L628-634); calls 17, 18, 22, 30 Sep; instruction 6 Oct', '/rental/invoicing'),
    c('Previous Jobs (6 Oct)', 'EXISTING WITH CHANGE', 'Previous Jobs list of invoicing runs', 'Live list of each run with the orders, the invoices raised and the orders skipped', 'Rental > Rental Invoicing & Billing Cycle; instruction 6 Oct', '/rental/previous-jobs'),
    c('Cross Hire Orders billing (6 Oct)', 'EXISTING WITH CHANGE', 'Supplier Invoice Reference as text, static Billing Status', 'Receive creates a Pending bill in Accounting with the agreed rate and the expenses; Dropship orders get Create, Bill; a dispute charge on Return to Supplier creates a supplementary bill; Billing Status and a Bills tab follow the bills', 'Rental > Cross-Hire supplier invoice (Req L886-925); instruction 6 Oct', '/rental/cross-hire-orders'),
    c('Rental sidebar', 'EXISTING', 'Rental Dashboard, Product Management, Demand Planning, Invoicing, Rental, Agreements, Purchase, Cross Hire, Settings, Reports', 'Kept as in the existing ERP. Screens the requirement does not change show their existing columns and are not rebuilt; Items and Category open the shared Inventory masters', 'Instruction 5 Oct'),
    c('Rental Leads, Opportunity, Quotations, Orders', 'REMOVED', 'Separate rental leads, opportunities, quotations and orders', 'Not in the Rental module any more: the whole sales flow is managed in CRM, filtered by Activity Type = Rental. Rental keeps Replacement Orders, Renewals, Cross Hire and the operational screens', 'Meeting 5 Oct (rental module does not hold Lead, Opportunity, Quotation, Order)', '/crm/sales-orders'),
    c('Replacement Orders', 'EXISTING WITH CHANGE', 'Replacement Orders list and replacement quotation', 'Asset-in / asset-out transaction started from the order: same-category check, Cross-Hire fallback, reason, price adjustment, old asset to Under Maintenance, billing not paused. Transport section added: own vehicle from Fleet Availability or an external transporter, creating one Replacement trip', 'Rental > Replacement Processing', '/rental/replacements'),
    c('Renewals and Expiry', 'NEW', 'Upcoming Expiry report only', 'Notification, client confirmation, Extend the existing Sales Order, Early Termination or Proceed to Return, overdue fault attribution and escalation', 'Rental > Overdue On-Hire & Contract Expiry', '/rental/renewals'),
    c('Delivery vehicles on the Fixed Asset Register', 'EXISTING WITH CHANGE', 'Vehicles were Heavy Equipment Fixed Assets in the hire pool', 'A Delivery fleet vehicle checkbox on the asset marks an own vehicle used for delivery only: plate number, default driver, status In Service, never rented out or counted in the rental fleet, no rental price. Same Fixed Asset Register record, history and depreciation', 'Rental > Delivery & Fleet Logistics (own vehicles are Fixed Assets); call 5 Oct', '/inventory/items'),
    c('Cross Hire Requests', 'EXISTING WITH CHANGE', 'Requests list and form (Basic Details, Items, Classification, Attachment) raised from a Rental Order, statuses Draft, Pending, In Progress, Completed', 'Same list and form. Category and Subcategory come from the order line, a Raise Cross-Hire action on the Sales Order line creates the request, supplier and rate are optional here (the RFQ award or the order fixes them)', 'Procurement > Cross-Hire Suppliers; existing ERP Cross Hire', '/rental/cross-hire'),
    c('Process Cross Hire', 'EXISTING WITH CHANGE', 'Grouped table by item with On Hand, Available, Cross Hire Quantity and Type, Create Order or RFQ', 'Same screen with live availability from the Fixed Asset Register; Create makes an Order or an RFQ from the selected requests', 'Existing ERP Cross Hire', '/rental/cross-hire-process'),
    c('Cross Hire Request for Quote', 'EXISTING WITH CHANGE', 'RFQ with call for tender, supplier responses, Analyze and award', 'Same flow: Send, Add Response, compare (All, Low Price, Low MOQ, Lead time), Award with comment, Create Order from the awarded response. Suppliers limited to Cross-Hire Company', 'Existing ERP Cross Hire; Procurement > Cross-Hire Suppliers', '/rental/cross-hire-rfq'),
    c('Cross Hire Orders', 'EXISTING WITH CHANGE', 'Hire Order list and form (Cross Hire Type Inventory or Dropship, Receive, Mark Shipped, Expenses, Receiving and Billing status)', 'Same order, with the five-stage lifecycle tracker (Request, Received, Allocated, Returned to Us, Returned to Supplier), condition check, supplier invoice reference, dispute charge, asset in the register without depreciation and a profitability panel rolled into the Sales Order. Dropship skips Receive and Return to Us', 'Procurement > Cross-Hire Suppliers', '/rental/cross-hire-orders'),
    c('Cross Hire Orders: approval and Goods Receipt (7 Oct)', 'EXISTING WITH CHANGE', 'Order list, form (Basic Details, Address & Contact), approval (Submit, Quick Approval, Accept, Reject, Re-Submit), Receive creates a separate GRN form with trace details and Validate, then Bill', 'Brought back to the existing flow: Order, Approval, Receive (Goods Receipt form, Trace Details, Validate), Bill. Validate is the stock-in: the traced unit goes on the Fixed Asset Register as Cross-Hired. The five-stage lifecycle continues after that', 'Existing ERP Cross Hire Orders and GRN; Rental > Cross-Hire (Rental Side)', '/rental/cross-hire-orders'),
    c('Cross Hire Request for Quote: existing layout (7 Oct)', 'EXISTING WITH CHANGE', 'RFQ list, form (Basic Details, Address & Contact, Rental Period, Items, Call For Tender), view with Analyze & Award, separate Responses pages, Create Order', 'Rebuilt to the existing layout: list with Edit, Duplicate, Delete; form and view in two tabs; Call For Tender table; Responses as separate pages; Analyze & Award with the item list, All, Low Price, Low MOQ and Low Lead Time tabs, filter, award with comment, previous prices. Create > Order opens the order form prefilled from the awarded response', 'Existing ERP Cross Hire Request for Quote', '/rental/cross-hire-rfq'),
    c('Cross Hire new fields (7 Oct)', 'EXISTING WITH CHANGE', 'Cross Hire Requests, Process, RFQ and Orders as in the existing ERP', 'Screens and flow kept. Added from the requirement: Raised By and Decision Right on the request, a yard checklist on the Return to Us condition check, a Re-Issue to another project action after Return to Us (Re-Issue Reference is now a linked Sales Order), and a buy-vs-hire estimate beside the cross-hire profitability', 'Rental > Cross-Hire (Rental Side); Procurement > Cross-Hire Suppliers', '/rental/cross-hire-orders'),
    c('Rental Reports and Dashboards', 'EXISTING WITH CHANGE', '12 rental reports, static dashboard', 'Existing reports kept and fed by live data, with Replacement History, Cross-Hire Frequency, Asset Ledger, Logistics Cost, Contract Expiry added. Fleet Status, Renewal and Overdue, Maintenance, Cross-Hire Cost vs Revenue dashboards', 'Rental > Reports and Dashboards', '/rental/reports'),
  ],
};
export default mod;
