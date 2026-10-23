import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Navigate } from 'react-router-dom';
import type { ModuleDef } from '@/types';
import { ItemList, ItemForm, ItemView } from './ItemPages';
import { HeavyForm, HeavyView } from './HeavyEquipmentPages';
import { LocationForm, LocationList, LocationView } from './LocationPages';
import { CountForm, CountList, CountView, DisposalForm, DisposalList, DisposalView } from './AssetPages';
import { dashboards, reports } from './reports';
import { dashboardRoutes } from '@/components/ReportsAndDashboards';
import { invReportRoutes } from './ReportPages';
import { BrandList, CategoryForm, CategoryList, CategoryView, SubCategoryForm, SubCategoryList } from './Masters';
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
        { label: 'Items', path: '/inventory/items', change: 'changed' },
        { label: 'Item Category', path: '/inventory/categories', change: 'changed' },
        { label: 'Item Sub-Category', path: '/inventory/sub-categories', change: 'new' },
        { label: 'Brand', path: '/inventory/brands', change: 'new' },
        { label: 'Asset Type', path: '/inventory/asset-types', change: 'new' },
        { label: 'Heavy Equipment Pricing', path: '/inventory/pricing', change: 'new' },
      ],
    },
    { label: 'Configuration', children: [{ label: 'Location', path: '/inventory/locations', change: 'changed' }] },
    { label: 'Fixed Asset Management', children: [
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
    { path: 'items/:id', element: <ItemView /> },
    { path: 'items/:id/edit', element: <ItemForm /> },
    { path: 'categories', element: <CategoryList /> },
    { path: 'categories/add', element: <CategoryForm /> },
    { path: 'categories/:id', element: <CategoryView /> },
    { path: 'categories/:id/edit', element: <CategoryForm /> },
    { path: 'sub-categories', element: <SubCategoryList /> },
    { path: 'sub-categories/add', element: <SubCategoryForm /> },
    { path: 'sub-categories/:id', element: <CategoryView /> },
    { path: 'sub-categories/:id/edit', element: <SubCategoryForm /> },
    { path: 'brands', element: <BrandList /> },
    { path: 'asset-types', element: <AssetTypeList /> },
    { path: 'asset-types/add', element: <AssetTypeForm /> },
    { path: 'asset-types/:id/edit', element: <AssetTypeForm /> },
    { path: 'pricing', element: <PricingList /> },
    { path: 'pricing/add', element: <PricingForm /> },
    { path: 'pricing/:id', element: <PricingView /> },
    { path: 'pricing/:id/edit', element: <PricingForm /> },
    { path: 'locations', element: <LocationList /> },
    { path: 'locations/add', element: <LocationForm /> },
    { path: 'locations/:id', element: <LocationView /> },
    { path: 'locations/:id/edit', element: <LocationForm /> },
    { path: 'stock-verification', element: <CountList /> },
    { path: 'stock-verification/add', element: <CountForm /> },
    { path: 'stock-verification/:id', element: <CountView /> },
    { path: 'stock-verification/:id/edit', element: <CountForm /> },
    { path: 'disposals', element: <DisposalList /> },
    { path: 'disposals/add', element: <DisposalForm /> },
    { path: 'disposals/:id', element: <DisposalView /> },
    { path: 'disposals/:id/edit', element: <DisposalForm /> },
    ...invReportRoutes('/inventory', reports),
    ...dashboardRoutes('/inventory', dashboards),
  ],
  changes: [
    { module: 'Inventory & Fixed Assets', screen: 'Items: Complete Maintenance', classification: 'EXISTING WITH CHANGE', existing: 'Mark Ready for Hire in one click from Under Maintenance', change: 'Complete Maintenance with the Routine or Critical checklist (a master), technician, date and notes; Change Status asks for the Maintenance Type; the type shows next to the status', ref: 'Client call 8 Oct (33:00 to 34:12)', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Items: asset statuses', classification: 'EXISTING WITH CHANGE', existing: 'Return went Off Hire, then Yard, then the inspection result', change: 'Two new statuses, Off Hire - In Transit and Yard Inspection, set by the return and its Goods Receipt and visible on the asset list', ref: 'Client call 8 Oct (53:24 to 54:42)', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Dashboards: Fleet Status', classification: 'EXISTING WITH CHANGE', existing: 'Counts and a heat map by status group', change: 'A Returning group, an Assets: where they are now table (category, subcategory, asset, status, current customer and project); certificate expiry stays in the Certificate Expiry Report', ref: 'Client call 8 Oct (37:00, 54:58 to 55:21)', path: '/inventory/dashboards' },
    { module: 'Inventory & Fixed Assets', screen: 'Items', classification: 'EXISTING WITH CHANGE', existing: 'Items list and multi-tab form with type, SKU, name, category, traceability, prices', change: 'Adds Item Code (auto), Product Classification, Category/Sub-Category from master, Tracking Method, serialized asset fields, photo and attachments', ref: 'Item Master > New Fields', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Type = Service', classification: 'EXISTING WITH CHANGE', existing: 'A service item carried a Product Classification, a Category and a Subcategory like a stock item', change: 'A service is a charge (delivery charge, labor, installation, waiver), not an Activity Type. A service item no longer has Product Classification, Category or Subcategory; Service Type, Billing, price and description remain. It is picked as a service charge line on an order', ref: 'Meeting 6 Oct (Service is not an Activity Type)', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Item Category', classification: 'EXISTING WITH CHANGE', existing: 'Parent, Level, Category Name, Brand, Description, SKU Prefix, Unique Items, Status, Attributes', change: 'One screen for categories and sub-categories as before (Parent field makes a sub-category); Level and Category Type removed. Adds Custom Attributes with Required flag, Depreciation Method Override, sub-categories on the category page, and Create New from the item, asset and pricing dropdowns', ref: 'Category & Sub-Category Master', path: '/inventory/categories' },
    { module: 'Inventory & Fixed Assets', screen: 'Item Sub-Category and Brand', classification: 'NEW', existing: 'One Item Category screen for categories and sub-categories, Brand on the category', change: 'Item Category and Item Sub-Category are separate masters (a sub-category belongs to a Category). Brand leaves the category and becomes its own Brand master, chosen on the asset or item with Create New', ref: 'Meeting 5 Oct afternoon', path: '/inventory/sub-categories' },
    { module: 'Inventory & Fixed Assets', screen: 'Heavy Equipment Fixed Asset (5 Oct afternoon)', classification: 'EXISTING WITH CHANGE', existing: 'Asset form with typed CapEx, free-text certificate type, manual Add Movement', change: 'Entity is the first field. CapEx is auto-fetched, not typed. Certificate type is a master with Create New. Movement History has no manual entry: it is filled from Delivery Orders, returns and maintenance status changes and shows Customer and Project. A Disposal Request button opens the request for the asset. A Delivery fleet vehicle checkbox (Owned assets only) marks an own delivery vehicle: Plate Number, Default Driver, status In Service, a Trips tab and a derived Fleet Status; it is excluded from the hire pool and the rental fleet counts', ref: 'Meeting 5 Oct afternoon', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Disposal invoice (6 Oct)', classification: 'EXISTING WITH CHANGE', existing: 'Record Outcome typed a suggested invoice number and opened a reference page', change: 'Record Outcome creates a real sales invoice in Accounting (Pending approval) for the buyer, with the sale or scrap value and 5% VAT; the invoice number is assigned on save and links back to the disposal', ref: 'Fixed Asset disposal sale invoice (call 2 Oct); instruction 6 Oct (accounting POC)', path: '/inventory/disposals' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Disposal Requests (5 Oct afternoon)', classification: 'EXISTING WITH CHANGE', existing: 'Disposal request from its own list', change: 'Raised from the asset. The request and the approver see the asset income vs expenses ratio, status and history. After the invoice is created the user lands on the Accounting invoice page', ref: 'Meeting 5 Oct afternoon', path: '/inventory/disposals' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Type', classification: 'NEW', existing: 'Fixed list of asset types in the accounting asset form', change: 'Client-specific Asset Type master with list, add, edit, activate / deactivate and delete (blocked while in use), and Create New from the Asset Type dropdown on the Heavy Equipment Fixed Asset form', ref: 'Asset Type Master (2 Oct call)', path: '/inventory/asset-types' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Service type', classification: 'NEW', existing: 'Service item with name, UOM, price', change: 'Service Type (Charge, Waiver, Insurance), Billing (One-time, Recurring, Lump sum) and Description; rental service lines in CRM and AMC job cards are picked from these items', ref: 'Meeting 5 Oct: rental service lines come from Inventory service items', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Heavy Equipment Fixed Asset type', classification: 'NEW', existing: '-', change: 'New always-serialized item type within Items, identified by an auto-generated Serialized ID (no typed name, item code or tracking method on the form), with its own listing view, add/edit form and view page (Basic Details, Depreciation Board, Movement History, Ownership)', ref: 'Item Master / Fixed Asset Register', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Heavy Equipment Pricing', classification: 'NEW', existing: '-', change: 'Activity Type (Rental / Fixed Asset Trading) and Description. One record per Category / Sub-Category and billing frequency (Add Frequency copies a record so only the price changes), a Fixed Asset Trading price is a single sales price, Bulk Upload takes one row per frequency', ref: 'Pricing Master (2 Oct call)', path: '/inventory/pricing' },
    { module: 'Inventory & Fixed Assets', screen: 'Location', classification: 'EXISTING WITH CHANGE', existing: 'Name, Short Name, Parent, Company, Address, Summary, Inventory Available, Status', change: 'Removes Parent Location, Company and the address block (City removed 5 Oct). Adds Location Code (auto), Location Type (Own Yard / Supplier-Held / Employee), Linked Supplier or Assigned Users (conditional), a read-only per-item stock table with units (Stock Held, Consumed, Remaining, Remaining Value), and Transfer stock in on Employee locations (service vans)', ref: 'Location & Warehouse Master (2 Oct call), Employee location (5 Oct call)', path: '/inventory/locations' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Heavy Equipment Fixed Asset > Compliance & Certificates tab', classification: 'NEW', existing: '-', change: 'Certificates live on the individual asset (no separate sidebar screen): many per asset with type, reference, expiry, reminder lead time, document, status and edit history; can be added while creating the asset; optional approval switch; QR code with Print QR', ref: 'Compliance & Certificates (2 Oct call)', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Items > Heavy Equipment Fixed Asset > Usage Readings tab', classification: 'NEW', existing: '-', change: 'Manual hour meter readings kept under the individual asset (no separate sidebar screen): optional, add / edit / delete in a dialog, entry limited to users allowed to enter readings, Reading Source reserved for a future IoT feed', ref: 'Manual Usage & Status Recording (2 Oct call)', path: '/inventory/items' },
    { module: 'Inventory & Fixed Assets', screen: 'Physical Stock Verification', classification: 'NEW', existing: 'Only a Stock Reconciliation report', change: 'Count sessions with system snapshot, quantities with units, variance and Stock Adjustment approval (approve or reject, with approval history). Stock Items: one free-text reason for the session. Fixed Assets: Found / Not Found per unit with a reason only when not found, filters, Select All with bulk marking, inactive assets excluded, no paging', ref: 'Physical Stock Verification (2 Oct call)', path: '/inventory/stock-verification' },
    { module: 'Inventory & Fixed Assets', screen: 'Asset Disposal Requests', classification: 'NEW', existing: 'Dispose page in Accounting with no approval', change: 'Disposal request (asset, method, reason, documents) with approval; approval inactivates the asset, then an invoice is created for the sale or the scrap (invoice number, date, invoice to from the customer list or entered by hand, amount; journal, gain or loss); lifecycle stepper and history', ref: 'Asset Disposal / Write-Off (2 Oct call)', path: '/inventory/disposals' },
    { module: 'Inventory & Fixed Assets', screen: 'Reports', classification: 'NEW', existing: '16 inventory reports', change: '12 fixed asset and stock reports built from live data, each with a visible Filter panel, column search, sorting, a sticky totals row, Print, Export and assets that open the asset page', ref: 'Reports (2 Oct call)', path: '/inventory/reports' },
    { module: 'Inventory & Fixed Assets', screen: 'Dashboards', classification: 'NEW', existing: 'Customizable widget dashboard', change: '3 dashboards counted live from the asset records (Fleet Status, Owned vs. Cross-Hire, End-of-Life Planning), each linking to the underlying records; Asset Profitability and Location-Wise Stock dashboards held back until their source data exists', ref: 'Dashboards (2 Oct call)', path: '/inventory/dashboards' },
  ],
};
export default mod;
