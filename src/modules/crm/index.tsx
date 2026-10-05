import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { Navigate } from 'react-router-dom';
import type { ChangeEntry, ModuleDef } from '@/types';
import { LeadForm, LeadList, LeadView } from './LeadPages';
import { OpportunityForm, OpportunityList, OpportunityView } from './OpportunityPages';
import { QuotationForm, QuotationList, QuotationView } from './QuotationPages';
import { SalesOrderForm, SalesOrderList, SalesOrderView } from './SalesOrderPages';
import { DeliveryForm, DeliveryList, DeliveryView } from './DeliveryPages';
import { ReturnForm, ReturnList, ReturnView } from './ReturnPages';
import { liveRoutes } from './reports';

const M = 'CRM / Sales';
const c = (screen: string, classification: ChangeEntry['classification'], existing: string, change: string, ref: string, path?: string): ChangeEntry => ({ module: M, screen, classification, existing, change, ref, path });

const mod: ModuleDef = {
  id: 'crm',
  label: 'CRM / Sales',
  basePath: '/crm',
  icon: <PeopleAltOutlinedIcon />,
  tileBg: 'rgba(111,102,215,.10)',
  menu: [
    { label: 'Dashboard', path: '/crm/sales-orders', icon: <PeopleAltOutlinedIcon />, change: 'changed' },
    {
      label: 'Orders', children: [
        { label: 'Lead', path: '/crm/leads', change: 'changed' },
        { label: 'Opportunity', path: '/crm/opportunities', change: 'changed' },
        { label: 'Quotation', path: '/crm/quotations', change: 'changed' },
        { label: 'Sales Orders', path: '/crm/sales-orders', change: 'changed' },
        { label: 'Delivery Orders', path: '/crm/delivery-orders', change: 'changed' },
        { label: 'Customer Returns', path: '/crm/customer-returns', change: 'changed' },
      ],
    },
    { label: 'Reports', path: '/crm/reports', change: 'new' },
  ],
  routes: [
    { index: true, element: <Navigate to="/crm/sales-orders" replace /> },
    { path: 'leads', element: <LeadList /> }, { path: 'leads/add', element: <LeadForm /> }, { path: 'leads/:id', element: <LeadView /> }, { path: 'leads/:id/edit', element: <LeadForm /> },
    { path: 'opportunities', element: <OpportunityList /> }, { path: 'opportunities/add', element: <OpportunityForm /> }, { path: 'opportunities/:id', element: <OpportunityView /> }, { path: 'opportunities/:id/edit', element: <OpportunityForm /> },
    { path: 'quotations', element: <QuotationList /> }, { path: 'quotations/add', element: <QuotationForm /> }, { path: 'quotations/:id', element: <QuotationView /> }, { path: 'quotations/:id/edit', element: <QuotationForm /> },
    { path: 'sales-orders', element: <SalesOrderList /> }, { path: 'sales-orders/:id', element: <SalesOrderView /> }, { path: 'sales-orders/:id/edit', element: <SalesOrderForm /> },
    { path: 'delivery-orders', element: <DeliveryList /> }, { path: 'delivery-orders/add', element: <DeliveryForm /> }, { path: 'delivery-orders/:id', element: <DeliveryView /> },
    { path: 'customer-returns', element: <ReturnList /> }, { path: 'customer-returns/add', element: <ReturnForm /> }, { path: 'customer-returns/:id', element: <ReturnView /> },
    ...liveRoutes('crm'),
  ],
  changes: [
    c('Lead', 'EXISTING WITH CHANGE', 'Lead list and form (Basic Details, Address, Contact; Owner Details, Follow Up, Classifications), statuses, Communication Log, Convert', 'Form and flow kept as is. Added: Activity Type (single), Lost Reason, Next Follow-Up Date, Tags; Source, Lost Reason, Industry and Company are masters with "+ Add new". Duplicate check is not on the Lead (moved to the Opportunity)', 'CRM > Lead; meeting 22 Sep', '/crm/leads'),
    c('Opportunity', 'EXISTING WITH CHANGE', 'Opportunity form (Basic Details, Address, Contact, Promotion; Owner Detail, Classification, Items, Follow Up), stages, pipeline view, Make Quotation', 'Form and flow kept as is. Added: Opportunity Title, Project, Contact Person, Activity Type, Rating, Sales Forecast Value, Approval Required, LPO and Site, 4-field duplicate prompt, Category / Subcategory item rows with FOC and availability flag, stages Enquiry / Quoted / Won. Items are optional', 'CRM > Opportunity; meeting 22 Sep', '/crm/opportunities'),
    c('Quotation', 'EXISTING WITH CHANGE', 'Quotation form (General Details, Address and Contact, Shipping, Promotion), item table and item dialog, Discounts, totals summary, approval, revision, direct Send by Email', 'Form and flow kept as is. Company shown first as the Entity. Added: Activity Type, header Contract Type / Start / End and AMC fields, Document Template, Prepared By, VAT Type, Quotation Description, rental item columns (Category, Subcategory, pricing line, Frequency, Start, End, Periods), FOC, Allocation Tag, editable description, Send by Email dialog', 'CRM > Quotation; meetings 17, 18, 22, 25 Sep', '/crm/quotations'),
    c('Sales Order', 'EXISTING WITH CHANGE', 'Sales Order form (Basic Details, Address & Contact, Shipping, Promotions), item table, Delivery, Discounts; Create (Quick Delivery, Delivery, Advance, Invoice) and View menus', 'Form and flow kept as is. Added: Activity Type and header contract, LPO expiry alert with Extend, per-item next step by Activity Type, Traceability, Asset Ledger, AMC visit plan, Charges, Live DO, Return and Replacement in Create, Send by Email dialog', 'CRM > Sales Order; meetings 17, 22, 30 Sep', '/crm/sales-orders'),
    c('Delivery Order', 'EXISTING WITH CHANGE', 'Delivery Order form (Basic Details, Package, Address and Contact, Shipping, Promotion), item table with Trace Details, Transportation', 'Form and flow kept as is. Trace Details picks the exact asset for rental items (Ready for Hire only, Category locked, Subcategory substitution with warning). Added: Delivery Type, Transport Type and external cost, Rental Start Date with reason, responsibility and waiting charge (Hold until start), service lines, e-signature, Acknowledged status', 'CRM > Delivery Order; meetings 17, 22, 30 Sep', '/crm/delivery-orders'),
    c('Customer Returns', 'EXISTING WITH CHANGE', 'RMA with GRN, credit note flow', 'Rental Returns from the Sales Order with DO reference, off-hire date earlier or later than today, failed collection, collection note print, two-stage inspection, damage charge blocked by a paid damage waiver (not part of the 5 Oct form rework)', 'CRM > Customer Returns; meetings 17, 22, 30 Sep', '/crm/customer-returns'),
    c('Reports', 'NEW', '15 sales reports', '8 reports with a search box per column, filters, sticky totals, print and drill-down to the record', 'CRM > Reports; meeting 2 Oct', '/crm/reports'),
    c('Dashboards', 'REMOVED', 'Static CRM dashboard', 'Removed until the screens are agreed; the Dashboard menu opens Sales Orders (2 Oct: prepare the screens first)', 'Meeting 2 Oct'),
    c('Customer Management, Settings, existing reports', 'EXISTING', 'Customer master, Shipping Rule, Promotions, Templates, 15 reports', 'Not rebuilt in this POC, unchanged', 'CRM'),
  ],
};
export default mod;
