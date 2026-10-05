import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { Navigate } from 'react-router-dom';
import type { ChangeEntry, ModuleDef } from '@/types';
import { liveRoutes } from '@/modules/crm/reports';
import { LeadList } from '@/modules/crm/LeadPages';
import { OpportunityList } from '@/modules/crm/OpportunityPages';
import { QuotationList } from '@/modules/crm/QuotationPages';
import { CrossHireList, CrossHireView, RenewalsPage, RentalOrders, ReplacementForm, ReplacementList } from './RentalPages';
import { ExistingScreen } from './ExistingScreen';

const M = 'Rental';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });
const ex = (title: string, columns: string[], extra: Partial<Parameters<typeof ExistingScreen>[0]> = {}) => <ExistingScreen title={title} columns={columns} {...extra} />;

/**
 * Rental keeps the sidebar and screens of the existing ERP (5 Oct instruction). Leads, Opportunity, Quotations and Orders are the same CRM records filtered to
 * Activity Type = Rental, so the new fields appear here without a second copy of the data.
 */
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
    { label: 'Invoicing', children: [{ label: 'Invoicing Rental Order', path: '/rental/invoicing' }, { label: 'Previous Jobs', path: '/rental/previous-jobs' }] },
    { label: 'Rental', children: [
      { label: 'Leads', path: '/rental/leads', change: 'changed' },
      { label: 'Opportunity', path: '/rental/opportunities', change: 'changed' },
      { label: 'Quotations', path: '/rental/quotations', change: 'changed' },
      { label: 'Orders', path: '/rental/orders', change: 'changed' },
      { label: 'Replacement Orders', path: '/rental/replacements', change: 'changed' },
      { label: 'Renewals and Expiry', path: '/rental/renewals', change: 'new' },
    ] },
    { label: 'Agreements', path: '/rental/agreements' },
    { label: 'Purchase', children: [{ label: 'Request for Quote', path: '/rental/purchase-rfq' }, { label: 'Orders', path: '/rental/purchase-orders' }] },
    { label: 'Cross Hire', children: [
      { label: 'Requests', path: '/rental/cross-hire', change: 'changed' },
      { label: 'Process Cross Hire', path: '/rental/cross-hire-process' },
      { label: 'Request for Quote', path: '/rental/cross-hire-rfq' },
      { label: 'Orders', path: '/rental/cross-hire-orders' },
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
    { path: 'invoicing', element: ex('Invoicing Rental Order', ['Rental Order', 'Date', 'Customer', 'Invoice', 'Start Date', 'End Date', 'Next Invoice Date', 'Billing Cycle', 'Currency', 'Narration']) },
    { path: 'previous-jobs', element: ex('Previous Jobs', ['Job', 'Rental Order', 'Status', 'Run At', 'Message']) },
    { path: 'leads', element: <LeadList activity="Rental" /> },
    { path: 'opportunities', element: <OpportunityList activity="Rental" /> },
    { path: 'quotations', element: <QuotationList activity="Rental" /> },
    { path: 'orders', element: <RentalOrders /> },
    { path: 'replacements', element: <ReplacementList /> }, { path: 'replacements/add', element: <ReplacementForm /> },
    { path: 'renewals', element: <RenewalsPage /> },
    { path: 'agreements', element: ex('Agreements', ['ID', 'Date', 'Name', 'Type', 'Vendor', 'Valid Up To', 'Company', 'Currency', 'Status']) },
    { path: 'purchase-rfq', element: ex('Request for Quote', ['ID', 'Date', 'Vendor', 'Status']) },
    { path: 'purchase-orders', element: ex('Orders', ['ID', 'Date', 'Vendor', 'Receiving Status', 'Billing Status', 'Status']) },
    { path: 'cross-hire', element: <CrossHireList /> }, { path: 'cross-hire/:id', element: <CrossHireView /> },
    { path: 'cross-hire-process', element: ex('Process Cross Hire', ['Item', 'Rental Order ID', 'Request Quantity', 'On Hand', 'Available', 'Cross Hire Qty', 'Vendor', 'Cross Hire Type', 'Unit Rate']) },
    { path: 'cross-hire-rfq', element: ex('Request for Quote', ['ID', 'Date', 'Vendors', 'Responses', 'Status']) },
    { path: 'cross-hire-orders', element: ex('Orders', ['Hire Order Number', 'Rental Order(s)', 'Supplier', 'Cross Hire Type', 'Dates', 'Receiving Status', 'Status']) },
    { path: 'settings', element: ex('Settings', ['Setting', 'Value']) },
    { path: 'billing-cycle', element: ex('Billing Cycle', ['Name', 'Count', 'Duration', 'Company', 'Invoicing Type', 'Max Schedule Count', 'Prorated']) },
    { path: 'terms', element: ex('Terms and Conditions', ['Name', 'Content', 'Status']) },
    { path: 'forms', element: ex('Forms', ['Form', 'Module', 'Status']) },
    { path: 'template-editor', element: ex('Template Editor', ['Template', 'Type', 'Status']) },
    ...liveRoutes('rental'),
  ],
  changes: [
    c('Rental sidebar', 'EXISTING', 'Rental Dashboard, Product Management, Demand Planning, Invoicing, Rental, Agreements, Purchase, Cross Hire, Settings, Reports', 'Kept as in the existing ERP. Screens the requirement does not change show their existing columns and are not rebuilt; Items and Category open the shared Inventory masters', 'Instruction 5 Oct'),
    c('Rental Leads, Opportunity, Quotations', 'EXISTING WITH CHANGE', 'Separate rental leads, opportunities and quotations (is_rental)', 'Same CRM records filtered to Activity Type = Rental, with all new fields, so rental has no second copy of the sales flow (meeting 5 Oct: one set of CRM screens)', 'Rental > Rental Order & Status Lifecycle; meeting 5 Oct', '/rental/leads'),
    c('Rental Orders', 'EXISTING WITH CHANGE', 'Rental Orders list with the Replacement Orders toggle, period and billing columns', 'One row per Sales Order with Activity Type = Rental, existing columns kept, plus Contract Type, Cost Centre / Project and assets on hire', 'Rental > Rental Order & Status Lifecycle', '/rental/orders'),
    c('Replacement Orders', 'EXISTING WITH CHANGE', 'Replacement Orders list and replacement quotation', 'Asset-in / asset-out transaction started from the order: same-category check, Cross-Hire fallback, reason, price adjustment, old asset to Under Maintenance, billing not paused', 'Rental > Replacement Processing', '/rental/replacements'),
    c('Renewals and Expiry', 'NEW', 'Upcoming Expiry report only', 'Notification, client confirmation, Extend the existing Sales Order, Early Termination or Proceed to Return, overdue fault attribution and escalation', 'Rental > Overdue On-Hire & Contract Expiry', '/rental/renewals'),
    c('Cross Hire Requests', 'EXISTING WITH CHANGE', 'Cross hire requests, process, RFQ, orders, profitability', 'Five-stage lifecycle (Request, Received, Allocated, Returned to Us, Returned to Supplier), condition check, dispute charge, asset in the register without depreciation, profitability roll-up', 'Procurement > Cross-Hire Suppliers', '/rental/cross-hire'),
    c('Rental Reports and Dashboards', 'EXISTING WITH CHANGE', '12 rental reports, static dashboard', 'Existing reports kept and fed by live data, with Replacement History, Cross-Hire Frequency, Asset Ledger, Logistics Cost, Contract Expiry added. Fleet Status, Renewal and Overdue, Maintenance, Cross-Hire Cost vs Revenue dashboards', 'Rental > Reports and Dashboards', '/rental/reports'),
  ],
};
export default mod;
