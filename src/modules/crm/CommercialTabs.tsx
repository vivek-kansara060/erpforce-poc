import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { customers } from '@/mock-data/masters';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { ACTIVITY_TYPES, BILLING_STRUCTURES, CONTRACT_TYPES, COST_CENTRES, DEPARTMENTS, DISCOUNT_ON, INCOTERMS, RECURRING, TRANSACTION_TYPES, VAT_TYPES, yards, docTotals, lineGross, plusYear, yearEnd, type Commercial, type Line } from './data';
import { Section, SpecForm, SpecView, type Spec } from './FormKit';
import { R, aed } from './shared';

type F = Record<string, any>;
export type Kind = 'quote' | 'order';

/**
 * General details of Quotation and Sales Order in the existing order. Company is moved to the first position and labelled as the Entity (22 Sep);
 * every other existing field keeps its label and order. NEW fields are marked.
 */
export const generalSpecs = (kind: Kind): Spec[] => [
  { key: 'entity', label: 'Entity', type: 'master', master: 'entity', required: true, change: 'changed', req: R.meet, hint: 'Our own company, first field' },
  { key: 'number', label: 'ID', type: 'readonly' },
  ...(kind === 'order' ? [{ key: 'quoteNo', label: 'Quotation', type: 'readonly' } as Spec] : []),
  { key: 'title', label: kind === 'quote' ? 'Opportunity Title' : 'Order Title', type: 'readonly', change: 'new', req: R.meet, hint: 'Carried from the Opportunity' },
  { key: 'activity', label: 'Activity Type', type: kind === 'quote' ? 'select' : 'readonly', options: [...ACTIVITY_TYPES], required: kind === 'quote', change: 'new', req: R.meet, hint: kind === 'quote' ? 'Taken from the Opportunity when it has one, otherwise choose it here' : 'Inherited from the Quotation. A Rental document may also carry Service items' },
  { key: 'costCentre', label: 'Cost Centre / Project', type: 'select', options: COST_CENTRES, required: true, change: 'new', req: R.meet, hint: 'Mandatory in the header; an item can override it' },
  { key: 'transactionType', label: 'Transaction Type', type: 'select', options: TRANSACTION_TYPES, required: true },
  { key: 'customerId', label: 'Customer', type: 'select', options: customers.map((c) => ({ value: c.id, label: c.name })), required: true, disabled: true },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'master', master: 'paymentTerms', required: true },
  { key: 'date', label: 'Date', type: 'date', required: true, disabled: kind === 'quote' },
  { key: 'postingTime', label: 'Posting Time', required: true },
  ...(kind === 'quote'
    ? [{ key: 'validUntil', label: 'Expiration Date', type: 'date', required: true, change: 'changed', req: R.quote, hint: 'Valid Until, drives the Quotation Aging Report' } as Spec]
    : [{ key: 'lpoExpiry', label: 'Expiration Date', type: 'date', required: true, hint: 'LPO Expiry Date. An alert fires 7 days before, configurable', change: 'changed', req: R.so } as Spec]),
  { key: 'deliveryCommitment', label: 'Delivery Commitment Date', type: 'date', hint: 'Header date kept; each item can carry its own date' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', required: true, disabled: (f) => f.currency === 'AED', value: (f) => (f.currency === 'AED' ? 1 : f.exchangeRate) },
  { key: 'salesperson', label: 'Salesperson' },
  ...(kind === 'order' ? [{ key: 'lpo', label: 'PO Number', required: true, hint: 'Client LPO number' } as Spec, { key: 'lpoDate', label: 'LPO Date', type: 'date' } as Spec] : []),
  { key: 'referenceNo', label: 'Reference Number' },
  { key: 'recurring', label: 'Recurring', type: 'select', options: RECURRING },
  { key: 'untilDate', label: 'Until Date', type: 'date', required: true, show: (f) => !!f.recurring },
  { key: 'status', label: kind === 'quote' ? 'Status' : 'Sales Order Status', type: 'readonly' },
  ...(kind === 'quote' ? [{ key: 'version', label: 'Version Number', type: 'readonly' } as Spec] : []),
  { key: 'vatNumber', label: 'VAT Number', hint: '15 digits' }, { key: 'crn', label: 'CRN', hint: '10 digits' },
  { key: 'vatType', label: 'VAT Type', type: 'select', options: VAT_TYPES, required: true, change: 'new', req: R.quote, hint: 'Standard or Export (Zero-Rated)' },
  ...(kind === 'quote' ? [{ key: 'quotePercentage', label: 'Quote Percentage (%)', type: 'number' } as Spec, { key: 'template', label: 'Document Template', type: 'master', master: 'docTemplate', required: true, change: 'new', req: R.quote, hint: 'Chosen by the sales rep per quotation' } as Spec, { key: 'description', label: 'Quotation Description', change: 'new', req: R.quote, hint: 'Quotation level only, does not sync back to the Opportunity' } as Spec] : []),
  { key: 'terms', label: 'Terms & Conditions', type: 'textarea', required: true },
  { key: 'narration', label: 'Narration', type: 'textarea' },
];
export const preparedSpecs: Spec[] = [
  { key: 'preparedBy', label: 'Name', required: true }, { key: 'designation', label: 'Designation', required: true }, { key: 'mobile', label: 'Mobile', required: true }, { key: 'email', label: 'Email', required: true },
];
export const contractSpecs: Spec[] = [
  { key: 'contractType', label: 'Contract Type', type: 'select', options: CONTRACT_TYPES, required: true, show: (f) => f.activity === 'Rental', hint: 'Open PO / Closed / Project, once for the whole document' },
  { key: 'contractStart', label: 'Contract Start Date', type: 'date', required: true, show: (f) => f.activity === 'Rental' },
  { key: 'contractEnd', label: 'Contract End Date', type: 'date', required: true, show: (f) => f.activity === 'Rental', hint: 'Open PO still has an end date, defaults to 31 December' },
  { key: 'billingStructure', label: 'Billing Structure', type: 'select', options: BILLING_STRUCTURES, required: true, show: (f) => f.activity === 'Rental' && f.contractType === 'Project', hint: 'Feature that drives this to be confirmed with client' },
  { key: 'amcStart', label: 'AMC Start Date', type: 'date', required: true, show: (f) => f.activity === 'AMC' },
  { key: 'amcEnd', label: 'AMC End Date', type: 'date', required: true, show: (f) => f.activity === 'AMC', hint: 'Start + 1 year by default, editable' },
  { key: 'visits', label: 'Number of Visits', type: 'number', required: true, show: (f) => f.activity === 'AMC', hint: 'Planned visit dates are generated on the Sales Order' },
];
const classification: Spec[] = [{ key: 'location', label: 'Location', type: 'select', options: yards, required: true }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
const discounts: Spec[] = [
  { key: 'discountOn', label: 'Apply Additional Discount On', type: 'select', options: DISCOUNT_ON },
  { key: 'discountPct', label: 'Additional Discount Percentage', type: 'number' },
  { key: 'discountAmount', label: 'Additional Discount Amount', type: 'readonly', value: (f) => aed((f.lines as Line[] ?? []).reduce((s, l) => s + lineGross(l) * (1 - (l.discount ?? 0) / 100), 0) * (Number(f.discountPct) || 0) / 100) },
  { key: 'cashDiscount', label: 'Is Cash or Non Trade Discount', type: 'check' },
  { key: 'roundOffOn', label: 'Round off', type: 'check' },
  { key: 'roundOff', label: 'Round off to', type: 'select', options: ['Nearest 100', 'Nearest 1000', 'Nearest 10,000'], show: (f) => !!f.roundOffOn },
];
const address: Spec[] = [
  { key: 'contactPerson', label: 'Contact Person', required: true, hint: 'Required for Credit' }, { key: 'shippingAddress', label: 'Shipping Address' }, { key: 'billingAddress', label: 'Billing Address' }, { key: 'placeOfSupply', label: 'Place of Supply' },
];
const shipping: Spec[] = [
  { key: 'shippingRule', label: 'Shipping Rule' }, { key: 'shippingCost', label: 'Shipping Cost', type: 'number' }, { key: 'handlingCost', label: 'Handling Cost', type: 'number' }, { key: 'incoterm', label: 'Incoterm', type: 'select', options: INCOTERMS },
];

/** Contract Start / End live in the main form only (6 Oct); every rental and recurring service line follows them. */
export function withHeaderCascade(x: F, k: string, v: any): F {
  const n: F = { ...x, [k]: v };
  if (k === 'contractType' && v === 'Open PO' && !x.contractEnd) n.contractEnd = yearEnd(x.contractStart || undefined);
  if (k === 'activity' && x.activity !== v) n.lines = [];
  if (k === 'amcStart' && v) n.amcEnd = plusYear(v);
  if (k === 'contractStart' || k === 'contractEnd') {
    const lk = k === 'contractStart' ? 'start' : 'end';
    n.lines = (x.lines as Line[]).map((l) => (l.activity === 'Rental' || (l.activity === 'Service' && l.billing === 'Recurring') ? { ...l, [lk]: v } : l));
  }
  return n;
}

export function commercialErrors(f: F): Record<string, string> {
  const e: Record<string, string> = {};
  ['entity', 'paymentTerms', 'currency', 'transactionType', 'postingTime', 'terms', 'vatType'].forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
  if (f.oppId !== undefined && !f.activity) e.activity = 'Activity Type is required';
  if (f.recurring && !f.untilDate) e.untilDate = 'Until Date is required when Recurring is set';
  if (f.currency !== 'AED' && !Number(f.exchangeRate)) e.exchangeRate = 'Exchange Rate is required';
  if (f.vatNumber && !/^\d{15}$/.test(f.vatNumber)) e.vatNumber = 'VAT Number must be 15 digits';
  if (f.crn && !/^\d{10}$/.test(f.crn)) e.crn = 'CRN must be 10 digits';
  if (f.transactionType === 'Credit' && !String(f.contactPerson ?? '').trim()) e.contactPerson = 'Contact Person is required for Credit';
  if (!f.location) e.location = 'Location is required';
  if (!f.costCentre) e.costCentre = 'Cost Centre / Project is required in the header';
  if (f.activity === 'Rental') {
    if (!f.contractType) e.contractType = 'Contract Type is required';
    if (!f.contractStart) e.contractStart = 'Contract Start Date is required';
    if (!f.contractEnd) e.contractEnd = 'Contract End Date is required';
    else if (f.contractStart && f.contractEnd < f.contractStart) e.contractEnd = 'End Date must be after Start Date';
    if (f.contractType === 'Project' && !f.billingStructure) e.billingStructure = 'Billing Structure is required for Project';
  }
  if (f.activity === 'AMC') {
    if (!f.amcStart) e.amcStart = 'AMC Start Date is required';
    if (!f.amcEnd) e.amcEnd = 'AMC End Date is required';
    if (!Number(f.visits)) e.visits = 'Number of Visits is required';
  }
  return e;
}

/**
 * The existing Quotation / Sales Order tabs: General Details (Basic Details), Address and Contact, Shipping, Promotion. `items` is the Items section node
 * placed after Classification, as in the existing form. `locked` switches every section to its read-only view.
 */
export function CommercialTabs({ kind, f, set, err, locked, items, aboveGeneral, belowGeneral }: { kind: Kind; f: F; set: (k: string, v: any) => void; err?: Record<string, string>; locked?: boolean; items: ReactNode; aboveGeneral?: ReactNode; belowGeneral?: ReactNode }) {
  const Fm = locked ? SpecView : SpecForm;
  const g = (specs: Spec[], cols = 2) => (locked ? <SpecView specs={specs} f={f} cols={cols + 1} /> : <SpecForm specs={specs} f={f} set={set} err={err} cols={cols} />);
  void Fm;
  const label = kind === 'quote' ? 'General Details' : 'Basic Details';
  return (
    <TabPanels tabs={[
      { label, content: (
        <>
          {aboveGeneral}
          {g(generalSpecs(kind))}
          <Section title="Contract" change="new" req={R.meet}>{g(contractSpecs, 3)}</Section>
          {kind === 'quote' && <Section title="Prepared By" change="new" req={R.quote}>{g(preparedSpecs, 4)}</Section>}
          {belowGeneral}
          <Section title="Classification">{g(classification)}</Section>
          <Section title="Items" change="changed" req={R.meet}>{items}</Section>
          <Section title="Discounts">{g(discounts, 3)}</Section>
          {!locked && <Section title="Attachment"><SpecForm specs={[{ key: 'attachments', label: 'Attachment', type: 'file' }]} f={f} set={set} /></Section>}
        </>) },
      { label: 'Address and Contact', content: g(address) },
      { label: 'Shipping', content: g(shipping) },
      { label: 'Promotion', content: <Text type="s4">Promotions are evaluated from Settings, Promotions (existing, unchanged). No promotion is applied to this document.</Text> },
    ]} />
  );
}

/** Existing CalculationSummary rows. */
export function Totals({ lines, discountPct, vatType, currency = 'AED', shipping = 0 }: { lines: Line[]; discountPct: number; vatType: string; currency?: string; shipping?: number }) {
  const t = docTotals(lines, discountPct, vatType);
  const itemDisc = lines.reduce((s, l) => s + (lineGross(l) * (l.discount ?? 0)) / 100, 0);
  const rows: [string, number | string][] = [
    ['Total Quantity', lines.reduce((s, l) => s + (l.activity === 'Fuel Trading' ? 0 : l.qty), 0)],
    ['Item Discount', -itemDisc], ...(discountPct ? [[`Additional Discount (${discountPct}%)`, -t.disc] as [string, number]] : []),
    ['Subtotal Excluding Taxes', t.sub - t.disc], [`Taxes and Charges Added (${vatType.startsWith('Export') ? 'Zero-Rated' : 'VAT 5%'})`, t.vat], ...(shipping ? [['Shipping and Handling', shipping] as [string, number]] : []),
  ];
  return (
    <Box sx={{ ml: 'auto', width: 360, mt: 2 }}>
      {rows.map(([k, v]) => <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s4">{k}</Text><Text type="s4">{typeof v === 'number' && k !== 'Total Quantity' ? aed(v || 0).replace('AED', currency) : v}</Text></Box>)}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid #D3D3D4' }}><Text type="s3" weight="medium">Grand Total</Text><Text type="s3" weight="medium">{aed(t.total + shipping).replace('AED', currency)}</Text></Box>
    </Box>
  );
}
export type { Commercial };
