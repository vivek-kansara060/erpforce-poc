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
import { AmcList, AmcView, JobCardForm, JobCardView } from './AmcPages';
import { MasterView, MastersIndex } from './MasterPages';
import { FleetBoard, TripList, TripView } from '@/modules/rental/FleetPages';

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
        { label: 'AMC Orders', path: '/crm/amc-orders', change: 'new' },
        { label: 'Customer Returns', path: '/crm/customer-returns', change: 'changed' },
      ],
    },
    { label: 'Fleet Management', change: 'new', children: [
      { label: 'Fleet Availability', path: '/crm/fleet', change: 'new' },
      { label: 'Trips', path: '/crm/trips', change: 'new' },
    ] },
    { label: 'Settings', children: [{ label: 'Masters', path: '/crm/masters', change: 'new' }] },
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
    { path: 'amc-orders', element: <AmcList /> }, { path: 'amc-orders/:id', element: <AmcView /> }, { path: 'job-cards/add', element: <JobCardForm /> }, { path: 'job-cards/:id', element: <JobCardView /> }, { path: 'job-cards/:id/edit', element: <JobCardForm /> },
    { path: 'fleet', element: <FleetBoard /> }, { path: 'trips', element: <TripList /> }, { path: 'trips/:id', element: <TripView /> },
    { path: 'masters', element: <MastersIndex /> }, { path: 'masters/:key', element: <MasterView /> },
    ...liveRoutes('crm'),
  ],
  changes: [
    c('Fleet Availability', 'NEW', 'No screen for the own delivery vehicles (a placeholder fleet dashboard was removed on 2 Oct)', 'Dispatcher board of the own delivery vehicles with a status per vehicle (Free, Assigned, En Route, Stuck-Delayed, Unavailable), counts, filters by Vehicle Type and status, and the row actions of the trip. The same screen opens as a picker (Free vehicles only) from the Delivery Order, Return and Replacement', 'Rental > Delivery & Fleet Logistics; calls 17 Sep, 30 Sep, 5 Oct', '/crm/fleet'),
    c('Trips', 'NEW', 'No trip record; a free-text driver and vehicle number on the Delivery Order', 'One trip per delivery, collection or replacement, by own vehicle or external transporter, with expenses (Salik, fuel, transporter charge) posted to the Sales Order logistics cost, a status log and Stuck-Delayed with a mandatory reason. Always created from its document. Design choice, not named in the requirement document', 'Rental > Delivery & Fleet Logistics; calls 18 Sep, 5 Oct', '/crm/trips'),
    c('Lead', 'EXISTING WITH CHANGE', 'Lead list and form (Basic Details, Address, Contact; Owner Details, Follow Up, Classifications), statuses, Communication Log, Convert', 'Form and flow kept as is. Added: Activity Type (single), Lost Reason, Next Follow-Up Date, Tags; Source, Lost Reason, Industry and Company are masters with "+ Add new". Duplicate check is not on the Lead (moved to the Opportunity)', 'CRM > Lead; meeting 22 Sep', '/crm/leads'),
    c('Opportunity', 'EXISTING WITH CHANGE', 'Opportunity form (Basic Details, Address, Contact, Promotion; Owner Detail, Classification, Items, Follow Up), stages, pipeline view, Make Quotation', 'Form and flow kept as is. Added: Opportunity Title, Project, Contact Person, Activity Type, Rating, Sales Forecast Value, Approval Required, LPO and Site, 4-field duplicate prompt, Category / Subcategory item rows with FOC and availability flag, stages Enquiry / Quoted / Won. Items are optional', 'CRM > Opportunity; meeting 22 Sep', '/crm/opportunities'),
    c('Quotation', 'EXISTING WITH CHANGE', 'Quotation form (General Details, Address and Contact, Shipping, Promotion), item table and item dialog, Discounts, totals summary, approval, revision, direct Send by Email', 'Form and flow kept as is. Company shown first as the Entity. Added: Activity Type, header Contract Type / Start / End and AMC fields, Document Template, Prepared By, VAT Type, Quotation Description, rental item columns (Category, Subcategory, pricing line, Frequency, Start, End, Periods), FOC, Allocation Tag, editable description, Send by Email dialog', 'CRM > Quotation; meetings 17, 18, 22, 25 Sep', '/crm/quotations'),
    c('Sales Order', 'EXISTING WITH CHANGE', 'Sales Order form (Basic Details, Address & Contact, Shipping, Promotions), item table, Delivery, Discounts; Create (Quick Delivery, Delivery, Advance, Invoice) and View menus', 'Form and flow kept as is. Added: Activity Type and header contract, LPO expiry alert with Extend, per-item next step by Activity Type, Traceability, Asset Ledger, AMC visit plan, Charges, Live DO, Return and Replacement in Create, Send by Email dialog', 'CRM > Sales Order; meetings 17, 22, 30 Sep', '/crm/sales-orders'),
    c('Delivery Order', 'EXISTING WITH CHANGE', 'Delivery Order form (Basic Details, Package, Address and Contact, Shipping, Promotion), item table with Trace Details, Transportation', 'Form and flow kept as is. Trace Details picks the exact asset for rental items (Ready for Hire only, Category locked, Subcategory substitution with warning). Added: Delivery Type, Transport Type and external cost, Rental Start Date with reason, responsibility and waiting charge (Hold until start), service lines, e-signature, Acknowledged status. Own Fleet now uses Select from fleet (Fleet Availability picker, Free vehicles only) which fills vehicle, driver and mobile and creates a trip; an external transporter\'s cost is posted once, by the trip. The Shipping tab shows the trip', 'CRM > Delivery Order; meetings 17, 22, 30 Sep', '/crm/delivery-orders'),
    c('AMC Orders and Job Cards', 'NEW', '-', 'AMC Orders list and order page (planned visits, contract split, project cost and profit, consolidated report). One Job Card per visit with materials, services and an invoice raised against it; no Delivery Order for AMC', 'CRM > AMC; meeting 5 Oct', '/crm/amc-orders'),
    c('Masters', 'NEW', 'Settings screens (Shipping Rule, Promotions, Templates)', 'List views for every CRM dropdown, including a link to the Inventory service items (type, billing, price). Dropdowns also keep + Add new', 'Meeting 5 Oct', '/crm/masters'),
    c('Opportunity and Quotation (5 Oct afternoon call)', 'EXISTING WITH CHANGE', 'Opportunity with LPO fields; Quotation picked its Opportunity by number', 'LPO Number and Date removed from the Opportunity (they live on the Sales Order). Entity is the first field. Quotation drops the Opportunity ID and picks the Opportunity by Title with search; Activity Type is open and chosen on the Quotation when the Opportunity has none', 'Meeting 5 Oct afternoon', '/crm/quotations'),
    c('Print templates', 'NEW', 'Print with no format choice', 'Every printout (Lead, Opportunity, Quotation, Sales Order, Delivery Order, Job Card) asks for a Document Template, a master with Create New', 'Meeting 5 Oct afternoon', '/crm/masters'),
    c('Sales Order actions', 'EXISTING WITH CHANGE', 'Create menu with Quick Delivery, a separate Cross-Hire button on the line', 'Quick Delivery hidden. Cross Hire, Release Hold, Replace and Return sit in a Manage menu on the line. Print is under Actions with a template choice', 'Meeting 5 Oct afternoon', '/crm/sales-orders'),
    c('Delivery Order (5 Oct afternoon)', 'EXISTING WITH CHANGE', 'Delivery Order with free-text Transported By', 'Project fetched from the Sales Order. Transported By is a supplier (vendor) with the transport cost. + Add FOC item adds a free inventory item or fixed asset as a zero-priced, traced line. A non-blocking warning shows when a chosen asset has an expired certificate', 'Meeting 5 Oct afternoon', '/crm/delivery-orders'),
    c('AMC Orders and Job Card (5 Oct afternoon)', 'NEW', 'AMC orders with visit plan and job card', 'Add AMC Order opens the Quotation filtered to AMC. Project shown on the list, order and job card. Value split shown (monthly amount, per visit). Actual Date comes from the job card, payment status per visit. Job Card: general Job Activities, optional materials and services, Generate > Invoice, Actions (Edit, Print, Upload signed copy, Mark Payment Received), accounting and inventory entries shown for reference', 'Meeting 5 Oct afternoon', '/crm/amc-orders'),
    c('Field help', 'EXISTING WITH CHANGE', 'Explanatory notes shown under fields', 'Notes moved behind a ? icon next to the field label so the screens stay clean for the client', 'Meeting 5 Oct afternoon'),
    c('AMC Order view (6 Oct)', 'EXISTING WITH CHANGE', 'AMC order page with two buttons (View Sales Order, Print consolidated report)', 'Same fields, panels and tabs as before. Only the page header changes to the Sales Order view style: Edit, Generate (Job Card for the next visit, Invoice for completed job cards), View (Sales Order, Quotation, Opportunity, Invoices) and Actions (Send by Email, Print, Print consolidated report, Close). The form is only used to create (Quotation) and edit the order', 'Instruction 6 Oct (AMC view like the Sales Order)', '/crm/amc-orders'),
    c('Job Card (6 Oct)', 'EXISTING WITH CHANGE', 'Job card page was an editable form with Generate and Actions', 'Same fields and sections, shown read-only, with Complete Visit, Generate (Invoice), View and Actions (Edit, Print, Send by Email, Upload signed copy, Record Payment). The form opens only to create a job card for a planned visit and through Actions, Edit until it is invoiced. Generate, Invoice creates a real sales invoice in Accounting (Pending approval); Record Payment creates a Pending collection', 'Instruction 6 Oct; CRM > AMC billing (Req L1479-1497)', '/crm/amc-orders'),
    c('Sales Order invoicing (6 Oct)', 'EXISTING WITH CHANGE', 'Create, Invoice and the line Invoice step only wrote an invoice number on the line; Advance only wrote a log line; Asset Ledger used sample received figures', 'Create, Invoice raises one real sales invoice for the selected non-rental lines; the line step does the same; Advance records a Pending advance Collection; new Invoices tab (invoices, payments, advances); Asset Ledger reads invoiced and received from the rental invoices, with Invoiced up to and Next Invoice Date; Charges tab raises the damage or failed-collection invoice (blocked by a paid damage waiver). Rental periods are invoiced by Rental, Invoicing Rental Order. All invoices are Pending until approved in Accounting', 'Finance > Sales Invoicing (Req L1340-1361); Rental > Rental Invoicing (Req L624, L634); calls 22 Sep, 30 Sep; instruction 6 Oct', '/crm/sales-orders'),
    c('Customer Returns damage invoice (6 Oct)', 'EXISTING WITH CHANGE', 'Damage charge recorded on the order with no invoice', 'Raise Damage Invoice on the return (and on the order Charges tab) creates the sales invoice for the damage or failed-collection charge; not offered when a damage waiver was paid', 'CRM > Customer Returns; call 22 Sep; instruction 6 Oct', '/crm/customer-returns'),
    c('Trips transporter bill (6 Oct)', 'EXISTING WITH CHANGE', 'External transporter charge only added to the order logistics cost', 'Completing an External Transporter trip also raises a Pending bill to the transporter for its Transport Charge; the trip shows the bill', 'Instruction 6 Oct (accounting POC); transporter is a supplier (5 Oct)', '/crm/trips'),
    c('Customer Returns', 'EXISTING WITH CHANGE', 'RMA with GRN, credit note flow', 'Rental Returns from the Sales Order with DO reference, off-hire date earlier or later than today, failed collection, collection note print, two-stage inspection, damage charge blocked by a paid damage waiver (not part of the 5 Oct form rework). A Company Collection now has a Collection Transport section (own vehicle or external transporter) that creates a trip; Collection Failed marks that trip Stuck-Delayed; the Collection Note prints the driver and vehicle from the trip', 'CRM > Customer Returns; meetings 17, 22, 30 Sep', '/crm/customer-returns'),
    c('Reports', 'NEW', '15 sales reports', '8 reports with a search box per column, filters, sticky totals, print and drill-down to the record', 'CRM > Reports; meeting 2 Oct', '/crm/reports'),
    c('Dashboards', 'REMOVED', 'Static CRM dashboard', 'Removed until the screens are agreed; the Dashboard menu opens Sales Orders (2 Oct: prepare the screens first)', 'Meeting 2 Oct'),
    c('Customer Management, Settings, existing reports', 'EXISTING', 'Customer master, Shipping Rule, Promotions, Templates, 15 reports', 'Not rebuilt in this POC, unchanged', 'CRM'),
  ],
};
export default mod;
