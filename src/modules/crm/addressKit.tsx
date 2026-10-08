import { useEffect } from 'react';
import { customers, suppliers } from '@/mock-data/masters';
import { getCollection } from '@/store/store';
import { COL, type SalesOrder } from './data';
import type { Spec } from './FormKit';

/**
 * Address & Contact behaviour of the existing ERP: the party's addresses and contact persons come from its record and the first one is filled in when the party
 * is chosen; the shipping address, billing address and place of supply come from the locations of the chosen Entity, with the default pre-selected. Values are
 * stored as the readable address text, so documents and invoices that copy them keep working.
 */
export const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
export interface AddrRec { label: string; emirate: string; isDefault?: boolean; kind?: 'billing' | 'shipping' }
export interface ContactRec { name: string; designation: string; phone: string; email: string }

const SUPPLIER_CITY: Record<string, string> = { s1: 'Jebel Ali, Dubai', s2: 'Jebel Ali, Dubai', s3: 'Deira, Dubai', s4: 'Al Quoz, Dubai', s5: 'Al Quoz, Dubai', s6: 'Industrial Area 12, Sharjah' };
const emirateOf = (city: string) => EMIRATES.find((e) => city.includes(e)) ?? 'Dubai';
export function supplierAddresses(supplierId?: string): AddrRec[] {
  const s = suppliers.find((x) => x.id === supplierId);
  if (!s) return [];
  const city = SUPPLIER_CITY[s.id] ?? 'Dubai';
  const list: AddrRec[] = [{ label: `${s.name}, Registered Office, ${city}, UAE`, emirate: emirateOf(city), isDefault: true }];
  if (s.type === 'Cross-Hire Company') list.push({ label: `${s.name}, Equipment Yard, ${city}, UAE`, emirate: emirateOf(city) });
  return list;
}
export function supplierContacts(supplierId?: string): ContactRec[] {
  const s = suppliers.find((x) => x.id === supplierId);
  return s ? [{ name: s.contact, designation: 'Sales Manager', phone: s.phone, email: s.email }, { name: `${s.name.split(' ')[0]} Accounts Desk`, designation: 'Accounts', phone: s.phone, email: s.email.replace(/^[^@]+/, 'accounts') }] : [];
}
export function customerAddresses(customerId?: string, sites: string[] = []): AddrRec[] {
  const c = customers.find((x) => x.id === customerId);
  if (!c) return [];
  const orderSites = getCollection<SalesOrder>(COL.orders).filter((o) => o.customerId === customerId && o.site).map((o) => o.site);
  const uniq = [...new Set([...sites, ...orderSites].filter(Boolean))];
  return [{ label: `${c.name}, Head Office, ${c.city}, UAE`, emirate: c.city, isDefault: true, kind: 'billing' }, ...uniq.map((s) => ({ label: s, emirate: emirateOf(s) === 'Dubai' && !/Dubai/.test(s) ? c.city : emirateOf(s), kind: 'shipping' as const }))];
}
export function customerContacts(customerId?: string): ContactRec[] {
  const c = customers.find((x) => x.id === customerId);
  return c ? [{ name: c.contact, designation: 'Primary Contact', phone: c.phone, email: c.email }, { name: `${c.name.split(' ')[0]} Accounts Desk`, designation: 'Accounts', phone: c.phone, email: c.email }] : [];
}
/** Locations of our own Entity (existing ERP: warehouse locations filtered by company). */
const ENTITY_ADDRESSES: Record<string, AddrRec[]> = {
  'Gulf Power Rentals LLC': [{ label: 'Head Office, Business Bay, Dubai', emirate: 'Dubai', kind: 'billing', isDefault: true }, { label: 'Jebel Ali Main Yard, Dubai', emirate: 'Dubai', kind: 'shipping', isDefault: true }, { label: 'Sharjah Yard, Industrial Area 4, Sharjah', emirate: 'Sharjah', kind: 'shipping' }],
  'Gulf Power Rentals LLC - Abu Dhabi Branch': [{ label: 'Abu Dhabi Branch Office, Mussafah', emirate: 'Abu Dhabi', kind: 'billing', isDefault: true }, { label: 'Mussafah Yard, Abu Dhabi', emirate: 'Abu Dhabi', kind: 'shipping', isDefault: true }],
  'Gulf Power Trading FZE': [{ label: 'JAFZA Office, Jebel Ali Free Zone, Dubai', emirate: 'Dubai', kind: 'billing', isDefault: true }, { label: 'JAFZA Warehouse, Jebel Ali Free Zone, Dubai', emirate: 'Dubai', kind: 'shipping', isDefault: true }],
};
export const entityAddresses = (entity?: string): AddrRec[] => ENTITY_ADDRESSES[entity ?? ''] ?? ENTITY_ADDRESSES['Gulf Power Rentals LLC'];
const defOf = (l: AddrRec[], kind?: 'billing' | 'shipping') => (l.find((x) => x.isDefault && (!kind || x.kind === kind)) ?? l.find((x) => !kind || x.kind === kind) ?? l[0])?.label ?? '';

type F = Record<string, any>;
export interface AddressCfg {
  party: 'supplier' | 'customer';
  /** where the party id and the entity name are read from in the form values */
  partyId: (f: F) => string | undefined;
  entity: (f: F) => string | undefined;
  /** extra addresses offered for the party (for example the site of the order) */
  sites?: (f: F) => string[];
  partyLabel?: string;
}
const partyAddr = (cfg: AddressCfg, f: F) => (cfg.party === 'supplier' ? supplierAddresses(cfg.partyId(f)) : customerAddresses(cfg.partyId(f), cfg.sites?.(f)));
const partyCon = (cfg: AddressCfg, f: F) => (cfg.party === 'supplier' ? supplierContacts(cfg.partyId(f)) : customerContacts(cfg.partyId(f)));
const opts = (l: { label?: string; name?: string }[]) => l.map((x) => x.label ?? x.name ?? '');

/** The Address & Contact fields of the existing forms, as selects that follow the party and the entity. */
export const addressSpecs = (cfg: AddressCfg): Spec[] => [
  { key: 'supplierAddress', label: cfg.partyLabel ?? (cfg.party === 'supplier' ? 'Supplier Address' : 'Customer Address'), type: 'select', required: true, options: (f) => opts(partyAddr(cfg, f)), hint: 'From the addresses on the record; the default is filled in when the party is chosen' },
  { key: 'contactPerson', label: 'Contact Person', type: 'select', required: true, options: (f) => opts(partyCon(cfg, f)), hint: 'Contact persons of the party' },
  { key: 'shippingAddress', label: 'Shipping Address (Entity)', type: 'select', required: true, options: (f) => opts(entityAddresses(cfg.entity(f))), hint: 'Locations of the chosen Entity' },
  { key: 'billingAddress', label: 'Billing Address (Entity)', type: 'select', options: (f) => opts(entityAddresses(cfg.entity(f))) },
  { key: 'placeOfSupply', label: 'Place of Supply', type: 'select', options: (f) => opts(entityAddresses(cfg.entity(f))), hint: 'Defaults to the shipping address' },
];
/** Customer documents (Quotation, Sales Order, Customer Return): the customer's addresses and contacts, and the entity's locations. Contact Person and Customer Address are not part of the existing order forms, so they are left out. */
export const customerAddressSpecs = (cfg: AddressCfg): Spec[] => [
  { key: 'contactPerson', label: 'Contact Person', type: 'select', required: true, options: (f) => opts(partyCon(cfg, f)), hint: 'Required for Credit' },
  { key: 'shippingAddress', label: 'Shipping Address', type: 'select', options: (f) => opts(partyAddr(cfg, f)), hint: 'Customer addresses and the sites of its orders' },
  { key: 'billingAddress', label: 'Billing Address', type: 'select', options: (f) => opts(partyAddr(cfg, f)) },
  { key: 'placeOfSupply', label: 'Place of Supply', type: 'select', options: EMIRATES, hint: 'Defaults to the emirate of the shipping address' },
];

/** Fills the address fields as soon as the party or the entity is known, and again when either changes (a value that is not on the new party's list is replaced by its default). */
export function useAddressAutofill(f: F, set: (k: string, v: any) => void, cfg: AddressCfg, enabled = true) {
  const party = cfg.partyId(f);
  const entity = cfg.entity(f);
  const site = cfg.sites?.(f).join('|');
  const fill = (k: string, list: string[], def: string) => { if (!list.includes(f[k])) set(k, def); };
  useEffect(() => {
    if (!enabled || !party) return;
    const a = partyAddr(cfg, f); const c = partyCon(cfg, f);
    if (cfg.party === 'supplier') fill('supplierAddress', opts(a), defOf(a));
    else { const site0 = cfg.sites?.(f)[0]; const ship = (site0 ? a.find((x) => x.label === site0) : undefined) ?? a[0]; fill('shippingAddress', opts(a), ship?.label ?? ''); fill('billingAddress', opts(a), defOf(a, 'billing')); }
    fill('contactPerson', opts(c), c[0]?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party, enabled, site]);
  useEffect(() => {
    if (!enabled) return;
    if (cfg.party === 'customer') {
      const ship = partyAddr(cfg, f).find((x) => x.label === f.shippingAddress);
      if (!f.placeOfSupply || !EMIRATES.includes(f.placeOfSupply)) set('placeOfSupply', ship?.emirate ?? 'Dubai');
      return;
    }
    const e = entityAddresses(entity);
    fill('shippingAddress', opts(e), defOf(e, 'shipping'));
    fill('billingAddress', opts(e), defOf(e, 'billing'));
    fill('placeOfSupply', opts(e), f.shippingAddress && opts(e).includes(f.shippingAddress) ? f.shippingAddress : defOf(e, 'shipping'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, enabled, f.shippingAddress]);
}
