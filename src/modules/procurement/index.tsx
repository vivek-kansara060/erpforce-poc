import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ChangeEntry, ModuleDef } from '@/types';
import { PurchaseOrderForm, PurchaseOrderList, PurchaseOrderView } from './PurchaseOrderPages';
import { ProcurementSettingsPage } from './SettingsPage';
import { R_PROC } from './data';

const M = 'Procurement';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });

/**
 * Procurement was a one-screen placeholder with no Purchase Order, GRN or approval-workflow screens. Two client feedback items (8 Oct) are built here as a
 * minimal, demoable slice: a Purchase Order with an approval workflow and a Create GRN status transition. Out of scope: Supplier Master, RFQ, Landed Cost, VRA.
 */
const mod: ModuleDef = {
  id: 'procurement',
  label: 'Procurement',
  basePath: '/procurement',
  icon: <ShoppingCartOutlinedIcon />,
  tileBg: 'rgba(255,125,172,.10)',
  menu: [
    { label: 'Dashboard', path: '/procurement', icon: <ShoppingCartOutlinedIcon /> },
    { label: 'Purchase Orders', path: '/procurement/purchase-orders', change: 'new' },
    { label: 'Settings', children: [{ label: 'Procurement Settings', path: '/procurement/settings', change: 'new' }] },
  ],
  routes: [
    { index: true, element: <Page><PageTitle title="Procurement" subtitle="Purchase Orders with an approval workflow and goods receipt (GRN)." change="new" req={R_PROC} /></Page> },
    { path: 'purchase-orders', element: <PurchaseOrderList /> },
    { path: 'purchase-orders/add', element: <PurchaseOrderForm /> },
    { path: 'purchase-orders/:id', element: <PurchaseOrderView /> },
    { path: 'purchase-orders/:id/edit', element: <PurchaseOrderForm /> },
    { path: 'settings', element: <ProcurementSettingsPage /> },
  ],
  changes: [
    c('Purchase Order', 'NEW', '-', 'Purchase Order list, add, edit and view, with items (qty, rate, amount), supplier, cost centre and an approval workflow (Approve / Reject). Only a Draft, Pending or Rejected PO can be edited or deleted', R_PROC, '/procurement/purchase-orders'),
    c('Approval workflow and GRN', 'NEW', '-', 'One Procurement Setting switches the approval workflow on or off for Purchase Orders; the same switch governs create, edit and delete (not three separate triggers). When no workflow is configured, a Purchase Order is approved automatically and a Create GRN action (a status transition to Received, not a separate GRN document) is not blocked. When a workflow is configured, GRN is blocked until the Purchase Order is approved', R_PROC, '/procurement/settings'),
  ],
};
export default mod;
