import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Navigate } from 'react-router-dom';
import type { ModuleDef } from '@/types';
import { ItemList, ItemForm, ItemView } from './ItemPages';
import { HeavyForm, HeavyView, MovementForm } from './HeavyEquipmentPages';
import { LocationForm, LocationList, LocationView } from './LocationPages';
import { CertificateForm, CertificateList, CountForm, CountList, CountView, DisposalForm, DisposalList, DisposalView, ReadingForm, ReadingList } from './AssetPages';
import { dashboards, reports } from './reports';
import { dashboardRoutes, reportRoutes } from '@/components/ReportsAndDashboards';
import { CategoryForm, CategoryList, CategoryView, SubCategoryForm, SubCategoryList, SubCategoryView } from './Masters';
import { PricingForm, PricingList, PricingView } from './PricingPages';
import { AssetTypeForm, AssetTypeList } from './AssetTypePages';

const mod: ModuleDef = {
  id: 'inventory',
  label: 'Inventory & Fixed Assets',
  basePath: '/inventory',
  icon: <Inventory2OutlinedIcon />,
  tileBg: 'rgba(102,120,215,.20)',
  menu: [
    {
      label: 'Product Management', icon: <Inventory2OutlinedIcon />, children: [
        { label: 'Items', path: '/inventory/items' },
        { label: 'Item Category', path: '/inventory/categories', change: 'changed' },
        { label: 'Item Sub-Category', path: '/inventory/sub-categories', change: 'new' },
        { label: 'Asset Type', path: '/inventory/asset-types', change: 'new' },
        { label: 'Heavy Equipment Pricing', path: '/inventory/pricing', change: 'new' },
      ],
    },
    { label: 'Configuration', children: [{ label: 'Location', path: '/inventory/locations', change: 'changed' }] },
    { label: 'Fixed Asset Management', children: [
      { label: 'Compliance and Certificates', path: '/inventory/certificates', change: 'new' },
      { label: 'Usage Readings', path: '/inventory/usage-readings', change: 'new' },
      { label: 'Disposal Requests', path: '/inventory/disposals', change: 'new' },
    ] },
    { label: 'Operations', children: [{ label: 'Physical Stock Verification', path: '/inventory/stock-verification', change: 'new' }] },
    { label: 'Reports', path: '/inventory/reports', change: 'new' },
    { label: 'Dashboards', path: '/inventory/dashboards', change: 'new' },
  ],
  routes: [
    { index: true, element: <Navigate to="/inventory/items" replace /> },
    { path: 'items', element: <ItemList /> },
    { path: 'items/add', element: <ItemForm /> },
    { path: 'items/heavy/add', element: <HeavyForm /> },
    { path: 'items/heavy/:id', element: <HeavyView /> },
    { path: 'items/heavy/:id/edit', element: <HeavyForm /> },
    { path: 'items/heavy/:id/movement/add', element: <MovementForm /> },
    { path: 'items/:id', element: <ItemView /> },
    { path: 'items/:id/edit', element: <ItemForm /> },
    { path: 'categories', element: <CategoryList /> },
    { path: 'categories/add', element: <CategoryForm /> },
    { path: 'categories/:id', element: <CategoryView /> },
    { path: 'categories/:id/edit', element: <CategoryForm /> },
    { path: 'asset-types', element: <AssetTypeList /> },
    { path: 'asset-types/add', element: <AssetTypeForm /> },
    { path: 'asset-types/:id/edit', element: <AssetTypeForm /> },
    { path: 'sub-categories', element: <SubCategoryList /> },
    { path: 'sub-categories/add', element: <SubCategoryForm /> },
    { path: 'sub-categories/:id', element: <SubCategoryView /> },
    { path: 'sub-categories/:id/edit', element: <SubCategoryForm /> },
    { path: 'pricing', element: <PricingList /> },
    { path: 'pricing/add', element: <PricingForm /> },
    { path: 'pricing/:id', element: <PricingView /> },
    { path: 'pricing/:id/edit', element: <PricingForm /> },
    { path: 'locations', element: <LocationList /> },
    { path: 'locations/add', element: <LocationForm /> },
    { path: 'locations/:id', element: <LocationView /> },
    { path: 'locations/:id/edit', element: <LocationForm /> },
    { path: 'certificates', element: <CertificateList /> },
    { path: 'certificates/add', element: <CertificateForm /> },
    { path: 'certificates/:id', element: <CertificateForm /> },
    { path: 'usage-readings', element: <ReadingList /> },
    { path: 'usage-readings/add', element: <ReadingForm /> },
    { path: 'usage-readings/:id', element: <ReadingForm /> },
    { path: 'stock-verification', element: <CountList /> },
    { path: 'stock-verification/add', element: <CountForm /> },
    { path: 'stock-verification/:id', element: <CountView /> },
    { path: 'stock-verification/:id/edit', element: <CountForm /> },
    { path: 'disposals', element: <DisposalList /> },
    { path: 'disposals/add', element: <DisposalForm /> },
    { path: 'disposals/:id', element: <DisposalView /> },
    { path: 'disposals/:id/edit', element: <DisposalForm /> },
    ...reportRoutes('/inventory', reports),
    ...dashboardRoutes('/inventory', dashboards),
  ],
  changes: [
    { module: 'Inventory & Fixed Assets', screen: 'Items', classification: 'EXISTING WITH CHANGE', existing: 'Items list and multi-tab form with type, SKU, name, category, traceability, prices', change: 'Adds Item Code (auto), Product Classification, Category/Sub-Category from master, Tracking Method, serialized asset fields, photo and attachments', ref: 'Item Master > New Fields', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Item Category', classification: 'EXISTING WITH CHANGE', existing: 'Parent, Level, Category Name, Brand, Description, SKU Prefix, Unique Items, Status, Attributes', change: 'Lists categories only (Level and Category Type removed). Adds Custom Attributes with Required flag and Depreciation Method Override, a view page with its sub-categories, and + Add from the item, asset and pricing forms', ref: 'Category & Sub-Category Master (2 Oct call)', path: '/inventory/categories' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Type', classification: 'NEW', existing: 'Fixed list of asset types in the accounting asset form', change: 'Client-specific Asset Type master with list, add, edit, activate / deactivate and delete (blocked while in use), and + Add from the Heavy Equipment Fixed Asset form', ref: 'Asset Type Master (2 Oct call)', path: '/inventory/asset-types' },
    { module: 'Inventory & Fixed Assets', screen: 'Item Sub-Category', classification: 'NEW', existing: '-', change: 'Separate master for sub-categories, each linked to one category, with list, add, edit, view, deactivate and delete', ref: 'Category & Sub-Category Master (2 Oct call)', path: '/inventory/sub-categories' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Heavy Equipment Fixed Asset type', classification: 'NEW', existing: '-', change: 'New always-serialized item type within Items, identified by an auto-generated Serialized ID (no typed name, item code or tracking method on the form), with its own listing view, add/edit form and view page (Basic Details, Depreciation Board, Movement History, Ownership)', ref: 'Item Master / Fixed Asset Register', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Heavy Equipment Pricing', classification: 'NEW', existing: '-', change: 'Activity Type (Rental / Trading) and Description. Rental prices are one record per billing frequency, with Add Another Frequency and a read-only preview of the price at every frequency; Trading prices are a single sales price. Rental / Trading filter, bulk upload and a view page', ref: 'Pricing Master (2 Oct call)', path: '/inventory/pricing' },
    { module: 'Inventory & Fixed Assets', screen: 'Location', classification: 'EXISTING WITH CHANGE', existing: 'Name, Short Name, Parent, Company, Address, Summary, Inventory Available, Status', change: 'Adds Location Code (auto), Location Type (Own Yard / Supplier-Held), Linked Supplier (conditional) and calculated Stock Held, Consumption and Remaining Value', ref: 'Location & Warehouse Master', path: '/inventory/locations' },
    { module: 'Inventory & Fixed Assets', screen: 'Compliance and Certificates', classification: 'NEW', existing: '-', change: 'Asset-level certificates with type, expiry, reminder lead time, attachment and edit history', ref: 'Compliance & Certificates', path: '/inventory/certificates' },
    { module: 'Inventory & Fixed Assets', screen: 'Usage Readings', classification: 'NEW', existing: '-', change: 'Manual hour meter and status recording per asset', ref: 'Manual Usage & Status Recording', path: '/inventory/usage-readings' },
    { module: 'Inventory & Fixed Assets', screen: 'Physical Stock Verification', classification: 'NEW', existing: 'Only a Stock Reconciliation report', change: 'Count sessions with system snapshot, variance and Stock Adjustment approval (approve or reject, with approval history). A reason is recorded for every difference (list to be confirmed with client). Count Type: Stock Items or Fixed Assets (Found / Not Found / Found elsewhere per unit, to be confirmed with client)', ref: 'Physical Stock Verification', path: '/inventory/stock-verification' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Disposal Requests', classification: 'NEW', existing: 'Dispose page in Accounting with no approval', change: 'Disposal request with reason, method, value and approval before an asset can be Disposed', ref: 'Asset Disposal / Write-Off', path: '/inventory/disposals' },
    { module: 'Inventory & Fixed Assets', screen: 'Reports', classification: 'NEW', existing: '16 inventory reports', change: '12 fixed asset and stock reports', ref: 'Reports', path: '/inventory/reports' },
    { module: 'Inventory & Fixed Assets', screen: 'Dashboards', classification: 'NEW', existing: 'Customizable widget dashboard', change: '5 fleet dashboards', ref: 'Dashboards', path: '/inventory/dashboards' },
  ],
};
export default mod;
