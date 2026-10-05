import { useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { Text } from '@/components/Text';
import { StatusChip } from '@/components/StatusChip';
import { AppDialog, useToast } from '@/components/Dialogs';
import { SelectInput, TextInput } from '@/components/Form';
import { fmtAED } from '@/mock-data/masters';
import { useCollection } from '@/store/store';
import { itemSeed, type ItemRec } from '@/modules/inventory/data';
import {
  COL, availability, toServiceCharge,
  type CrossHire, type Delivery, type ServiceCharge, type JobCard, type Extension, type HeavyRec, type Lead, type MasterRec, type Opportunity, type PricingRec, type Quotation, type Replacement, type ReturnEntry, type SalesOrder,
} from './data';

export const useLeads = () => useCollection<Lead>(COL.leads);
export const useOpps = () => useCollection<Opportunity>(COL.opps);
export const useQuotes = () => useCollection<Quotation>(COL.quotes);
export const useOrders = () => useCollection<SalesOrder>(COL.orders);
export const useDeliveries = () => useCollection<Delivery>(COL.deliveries);
export const useReturns = () => useCollection<ReturnEntry>(COL.returns);
export const useCrossHire = () => useCollection<CrossHire>(COL.crossHire);
export const useReplacements = () => useCollection<Replacement>(COL.replacements);
export const useExtensions = () => useCollection<Extension>(COL.extensions);
export const useFleet = () => useCollection<HeavyRec>(COL.fleet);
/** Service lines come from the Inventory service items (Item Type = Service), not from a CRM-owned master. */
export const useServiceCharges = () => {
  const items = useCollection<ItemRec>('items', itemSeed);
  return { rows: items.rows.filter((i) => i.type === 'Service' && i.status === 'Active' && i.serviceType).map((i): ServiceCharge => toServiceCharge(i)), get: (id: string) => items.get(id) };
};
export const useJobCards = () => useCollection<JobCard>(COL.jobCards);
export const usePricing = () => useCollection<PricingRec>(COL.pricing);

/** Requirement references used on NEW / CHANGED badges. */
export const R = {
  lead: 'CRM > Lead', opp: 'CRM > Opportunity', quote: 'CRM > Quotation', so: 'CRM > Sales Order', del: 'CRM > Delivery Order', ret: 'CRM > Customer Returns',
  rental: 'Rental > Rental Order & Status Lifecycle', repl: 'Rental > Replacement Processing', cross: 'Procurement > Cross-Hire Suppliers / Rental > Cross-Hire', exp: 'Rental > Overdue On-Hire & Contract Expiry',
  rreturn: 'Rental > Customer Return & Condition Assessment', ledger: 'Rental > Rental Invoicing & Billing Cycle',
  meet: 'Client meetings 17 Sep to 2 Oct (docs/crm-decisions.md)',
};
export const TO_CONFIRM = 'Rule to be confirmed with client';
export const aed = (n?: number) => (n === undefined ? '-' : fmtAED(Math.round(n * 100) / 100));
export const fmtDate = (s?: string) => (s ? s.replace('T', ' ') : '-');

export function ActivityChip({ activity }: { activity?: string }) {
  return activity ? <StatusChip status={activity} tone="grey" /> : <span>-</span>;
}
export function Note({ children }: { children: ReactNode }) {
  return <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{children}</Text>;
}

/* ------------------------------------------------------------------ masters with an add option (no hard-coded lists) */
const ADD = '__add__';
export function useMaster(key: string) {
  const m = useCollection<MasterRec>(COL.masters);
  const values = m.get(key)?.values ?? [];
  const add = (v: string) => { const rec = m.get(key); if (rec) m.update(key, { values: [...rec.values, v] }); else m.add({ id: key, values: [v] }); };
  const replace = (vals: string[]) => { const rec = m.get(key); if (rec) m.update(key, { values: vals }); else m.add({ id: key, values: vals }); };
  return { values, add, replace };
}
function AddValueDialog({ open, title, onClose, onAdd }: { open: boolean; title: string; onClose: () => void; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <AppDialog open={open} title={`Add to ${title}`} onClose={() => { setV(''); onClose(); }} confirmLabel="Add" confirmDisabled={!v.trim()} onConfirm={() => { onAdd(v.trim()); setV(''); onClose(); }}>
      <TextInput label="New value" required value={v} onChange={setV} hint="Added to the master and available everywhere this list is used" />
    </AppDialog>
  );
}
/** SelectInput fed by a master list, with "Create New" as the last option. */
export function MasterSelect({ master, value, onChange, ...p }: Omit<Parameters<typeof SelectInput>[0], 'options'> & { master: string }) {
  const m = useMaster(master);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SelectInput {...p} value={value} options={[...m.values, { value: ADD, label: 'Create New' }]} onChange={(v) => (v === ADD ? setOpen(true) : onChange?.(v))} />
      <AddValueDialog open={open} title={p.label} onClose={() => setOpen(false)} onAdd={(v) => { m.add(v); onChange?.(v); toast(`"${v}" added to ${p.label}`); }} />
    </>
  );
}

/** Live availability of a Category + Subcategory from the Fixed Asset Register (owned fleet and received cross-hired units). */
export function AvailabilityBadge({ group, category, fleet }: { group?: string; category?: string; fleet?: HeavyRec[] }) {
  if (!group || !category) return <Text type="s5" color="theme.secondary.700">-</Text>;
  const a = availability(group, category, fleet);
  const total = a.owned.length + a.cross.length;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <StatusChip status={total ? `${total} available` : 'None available'} tone={total ? 'green' : 'red'} />
      {a.cross.length > 0 && <Text type="s5" color="theme.secondary.700">({a.cross.length} cross-hired)</Text>}
    </Box>
  );
}
