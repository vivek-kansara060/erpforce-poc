import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { Navigate } from 'react-router-dom';
import type { ChangeEntry, ModuleDef } from '@/types';
import { liveRoutes } from '@/modules/crm/reports';
import { CrossHireList, CrossHireView, RenewalsPage, RentalOrders, ReplacementForm, ReplacementList } from './RentalPages';

const M = 'Rental';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });

const mod: ModuleDef = {
  id: 'rental',
  label: 'Rental',
  basePath: '/rental',
  icon: <KeyOutlinedIcon />,
  tileBg: 'rgba(0,121,63,.10)',
  menu: [
    { label: 'Rental Dashboard', path: '/rental/dashboards/fleet-status', icon: <KeyOutlinedIcon />, change: 'changed' },
    { label: 'Rental', children: [
      { label: 'Orders', path: '/rental/orders', change: 'changed' },
      { label: 'Replacement Orders', path: '/rental/replacements', change: 'changed' },
      { label: 'Renewals and Expiry', path: '/rental/renewals', change: 'new' },
    ] },
    { label: 'Cross Hire', children: [{ label: 'Requests', path: '/rental/cross-hire', change: 'changed' }] },
    { label: 'Reports', path: '/rental/reports', change: 'new' },
    { label: 'Dashboards', path: '/rental/dashboards', change: 'new' },
  ],
  routes: [
    { index: true, element: <Navigate to="/rental/dashboards/fleet-status" replace /> },
    { path: 'orders', element: <RentalOrders /> },
    { path: 'replacements', element: <ReplacementList /> }, { path: 'replacements/add', element: <ReplacementForm /> },
    { path: 'renewals', element: <RenewalsPage /> },
    { path: 'cross-hire', element: <CrossHireList /> }, { path: 'cross-hire/:id', element: <CrossHireView /> },
    ...liveRoutes('rental'),
  ],
  changes: [
    c('Rental Orders', 'EXISTING WITH CHANGE', 'Separate Rental Order list with rental period, billing cycle and statuses', 'Shown as the rental lines of the Sales Orders (Activity Type = Rental). One order, no separate rental order record', 'Rental > Rental Order & Status Lifecycle', '/rental/orders'),
    c('Replacement Orders', 'EXISTING WITH CHANGE', 'Replacement Orders list and replacement quotation', 'Asset-in / asset-out transaction started from the order: same-category check, Cross-Hire fallback, reason, price adjustment, old asset to Under Maintenance, billing not paused', 'Rental > Replacement Processing', '/rental/replacements'),
    c('Renewals and Expiry', 'NEW', 'Upcoming Expiry report only', 'Notification, client confirmation, Extend the existing Sales Order, Early Termination or Proceed to Return, overdue fault attribution and escalation', 'Rental > Overdue On-Hire & Contract Expiry', '/rental/renewals'),
    c('Cross Hire Requests', 'EXISTING WITH CHANGE', 'Cross hire requests, process, RFQ, orders, profitability', 'Five-stage lifecycle (Request, Received, Allocated, Returned to Us, Returned to Supplier), condition check, dispute charge, asset in the register without depreciation, profitability roll-up', 'Procurement > Cross-Hire Suppliers', '/rental/cross-hire'),
    c('Rental Reports and Dashboards', 'NEW', '12 rental reports, static dashboard', 'Replacement History, Cross-Hire Frequency, Asset Ledger, Logistics Cost, Contract Expiry reports. Fleet Status, Renewal and Overdue, Maintenance, Cross-Hire Cost vs Revenue dashboards', 'Rental > Reports and Dashboards', '/rental/reports'),
    c('Agreements, RFQ, Billing Cycle, Invoicing screens', 'EXISTING', 'Vendor agreements, cross hire RFQ and orders, billing cycle master, rental invoicing', 'Not rebuilt in this POC, unchanged', 'Rental'),
  ],
};
export default mod;
