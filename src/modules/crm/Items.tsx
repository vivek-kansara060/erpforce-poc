import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Menu, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { Text } from '@/components/Text';
import { AppDialog } from '@/components/Dialogs';
import { CheckInput, DateInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { fmtAED as _fmt } from '@/mock-data/masters';
void _fmt;
import { itemMaster, fmtAED } from '@/mock-data/masters';
import { neutral } from '@/theme/color';
import {
  ALL_LOCATIONS, CATEGORY_LABEL, COST_CENTRES, FUEL_UNITS, SUBCATEGORY_LABEL, availability, categoryOptions, groupOptions, isPeriodic, isRentalLine, lineActivitiesFor, lineGross, linePeriods, lineTaxable, lineVat, mkLine, pricingName,
  type ActivityType, type HeavyRec, type Line, type PricingRec,
} from './data';
import { ChangeTag } from '@/components/ChangeTag';
import { deliveredQty } from './flow';
import { AvailabilityBadge, R, TO_CONFIRM, aed, useServiceCharges } from './shared';

type Mode = 'opp' | 'quote' | 'order';
const kindLabel = (a: string) => (a === 'Rental' ? 'Equipment' : a === 'Fixed Asset Trading' ? 'Asset' : a === 'Service' ? 'Service charge' : a);
const stock = (l: Line) => itemMaster.find((i) => i.name === l.item)?.stock ?? 0;

interface Col { id: string; label: string; change?: 'new' | 'changed'; vis: boolean; right?: boolean; only?: Mode[]; render: (l: Line, i: number, c: Ctx) => ReactNode }
interface Ctx { vat: string; fleet?: HeavyRec[] }

const COLS: Col[] = [
  { id: 'sno', label: 'S.No', vis: true, only: ['order'], render: (_l, i) => i + 1 },
  { id: 'kind', label: 'Line', change: 'new', vis: true, render: (l) => kindLabel(l.activity) },
  { id: 'item', label: 'Item', vis: true, render: (l) => <span>{l.item || '-'}{l.foc ? ' (FOC)' : ''}</span> },
  { id: 'category', label: CATEGORY_LABEL, change: 'new', vis: true, render: (l) => l.group ?? '-' },
  { id: 'subcategory', label: SUBCATEGORY_LABEL, change: 'new', vis: true, render: (l) => l.category ?? '-' },
  { id: 'qty', label: 'Quantity', vis: true, right: true, render: (l) => l.qty },
  { id: 'remaining', label: 'Remaining Quantity', vis: true, right: true, only: ['order'], render: (l) => Math.max(0, l.qty - (l.activity === 'Rental' ? deliveredQty(l) : l.fulfilment ? l.qty : 0)) },
  { id: 'uom', label: 'UoM', vis: true, render: (l) => l.unit },
  { id: 'rate', label: 'Rate', vis: true, right: true, render: (l) => aed(l.foc ? 0 : l.price) },
  { id: 'frequency', label: 'Frequency', change: 'new', vis: true, render: (l) => (isPeriodic(l) ? l.frequency : '-') },
  { id: 'start', label: 'Start Date', change: 'new', vis: true, render: (l) => (isPeriodic(l) ? l.start : '-') },
  { id: 'end', label: 'End Date', change: 'new', vis: true, render: (l) => (isPeriodic(l) ? l.end : '-') },
  { id: 'periods', label: 'Periods', change: 'new', vis: true, right: true, render: (l) => (isPeriodic(l) ? linePeriods(l) : '-') },
  { id: 'gross', label: 'Gross Amount', vis: false, right: true, render: (l) => aed(lineGross(l)) },
  { id: 'dItem', label: 'Discounted Item', vis: false, render: (l) => ((l.discount ?? 0) > 0 ? 'Yes' : 'No') },
  { id: 'dRate', label: 'Discount Rate (%)', vis: false, right: true, render: (l) => l.discount ?? 0 },
  { id: 'dAmt', label: 'Discount Amount', vis: false, right: true, render: (l) => aed(lineGross(l) - lineTaxable(l)) },
  { id: 'net', label: 'Net Amount', vis: true, right: true, render: (l) => aed(lineTaxable(l)) },
  { id: 'promo', label: 'Promotion Amount', vis: false, right: true, render: () => aed(0) },
  { id: 'taxT', label: 'Tax Template', vis: false, render: (_l, _i, c) => (c.vat.startsWith('Export') ? 'Zero Rated' : 'VAT 5%') },
  { id: 'tax', label: 'Tax Amount', vis: true, right: true, render: (l, _i, c) => aed(lineVat(l, c.vat)) },
  { id: 'total', label: 'Total Amount', vis: true, right: true, render: (l, _i, c) => aed(lineTaxable(l) + lineVat(l, c.vat)) },
  { id: 'desc', label: 'Description', change: 'changed', vis: false, render: (l) => l.desc || l.item },
  { id: 'deliv', label: 'Delivery Commitment Date', vis: false, render: (l) => l.deliveryDate ?? '-' },
  { id: 'ship', label: 'Expected Shipping Date', vis: false, render: (l) => l.shipDate ?? '-' },
  { id: 'repl', label: 'Replacement Cost', vis: false, right: true, only: ['quote'], render: (l) => aed(l.replacementCost ?? 0) },
  { id: 'avail', label: 'Available', vis: false, right: true, render: (l, _i, c) => (l.activity === 'Rental' ? (() => { const a = availability(l.group, l.category, c.fleet); return a.owned.length + a.cross.length; })() : stock(l)) },
  { id: 'onhand', label: 'On Hand', vis: false, right: true, render: (l, _i, c) => (l.activity === 'Rental' ? (() => { const a = availability(l.group, l.category, c.fleet); return a.owned.length + a.cross.length; })() : stock(l)) },
  { id: 'reserved', label: 'Reserved', vis: false, right: true, render: () => 0 },
  { id: 'back', label: 'Back Ordered', vis: false, right: true, only: ['order'], render: (l) => Math.max(0, l.qty - stock(l)) },
  { id: 'invoiced', label: 'Invoiced', vis: false, right: true, only: ['order'], render: (l) => (l.fulfilment?.includes('invoiced') ? l.qty : 0) },
  { id: 'delivered', label: 'Delivered', vis: false, right: true, only: ['order'], render: (l) => (l.activity === 'Rental' ? deliveredQty(l) : l.fulfilment ? l.qty : 0) },
  { id: 'loc', label: 'Location', vis: false, render: (l) => l.location ?? '-' },
  { id: 'dept', label: 'Department', vis: false, render: (l) => l.department ?? '-' },
  { id: 'narr', label: 'Narration', vis: false, render: (l) => l.narration ?? '-' },
];

const cellSx = { px: 1, py: 0.75, fontSize: 13, whiteSpace: 'nowrap' } as const;

/** The existing ERP item table (same column names and order, column chooser, Add / edit through a dialog) plus the new rental columns. */
export function ItemsTable({ lines, onChange, header, vatType, locked, fleet, pricing, mode, extra, contract }: {
  lines: Line[]; onChange?: (l: Line[]) => void; header: ActivityType | string; vatType: string; locked?: boolean; fleet?: HeavyRec[]; pricing: PricingRec[]; mode: Mode; contract?: { start?: string; end?: string };
  extra?: { label: string; render: (l: Line) => ReactNode };
}) {
  const hasRental = header === 'Rental' || header === 'Fixed Asset Trading';
  const cols = useMemo(() => COLS.filter((c) => !c.only || c.only.includes(mode)).filter((c) => hasRental || !['category', 'subcategory'].includes(c.id) || mode === 'opp').filter((c) => header === 'Rental' || !['frequency', 'start', 'end', 'periods'].includes(c.id)), [mode, hasRental, header]);
  const [shown, setShown] = useState<string[]>(() => COLS.filter((c) => c.vis).map((c) => c.id));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [edit, setEdit] = useState<{ idx: number; line: Line } | null>(null);
  const vis = cols.filter((c) => shown.includes(c.id) && (c.id !== 'kind' || lineActivitiesFor(header as string).length > 1));
  const ctx: Ctx = { vat: vatType, fleet };
  const kinds = lineActivitiesFor(header as string);
  const openNew = (k: string) => {
    setEdit({ idx: -1, line: k === 'Rental' || k === 'Fixed Asset Trading' ? mkLine({ activity: k as ActivityType, item: '', group: 'Generator', frequency: k === 'Rental' ? 'Monthly' : undefined, start: k === 'Rental' ? contract?.start : undefined, end: k === 'Rental' ? contract?.end : undefined }) : mkLine({ activity: k as ActivityType, item: '', billing: k === 'Service' ? 'One-time' : undefined, unit: k === 'Fuel Trading' ? 'Litre' : k === 'AMC' ? 'Visit' : 'Nos' }) });
  };
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!locked && onChange && kinds.map((k) => <Button key={k} size="small" variant="contained" onClick={() => openNew(k)}>Add{kinds.length > 1 ? ` ${kindLabel(k)}` : ''}</Button>)}
        </Box>
        <Button size="small" variant="text" startIcon={<ViewColumnOutlinedIcon />} onClick={(e) => setAnchor(e.currentTarget)}>Columns</Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', maxHeight: 360, overflow: 'auto' }}>
            {cols.map((c) => <FormControlLabel key={c.id} control={<Checkbox size="small" checked={shown.includes(c.id)} onChange={(e) => setShown(e.target.checked ? [...shown, c.id] : shown.filter((x) => x !== c.id))} />} label={<Text type="s4">{c.label}</Text>} />)}
          </Box>
        </Menu>
      </Box>
      <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: neutral[100] }}>
              {extra && <TableCell sx={{ ...cellSx, fontWeight: 500 }}>{extra.label}<ChangeTag kind="new" req={R.so} /></TableCell>}
              {vis.map((c) => <TableCell key={c.id} align={c.right ? 'right' : 'left'} sx={{ ...cellSx, fontWeight: 500 }}>{c.label}<ChangeTag kind={c.change} req={R.meet} /></TableCell>)}
              {!locked && onChange && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.length === 0 && <TableRow><TableCell colSpan={vis.length + 2}><Text type="s4" color="theme.secondary.700">{mode === 'opp' ? 'No items. Items are optional on an Opportunity; the commitment happens on the Quotation.' : 'No items added.'}</Text></TableCell></TableRow>}
            {lines.map((l, i) => (
              <TableRow key={l.id} hover>
                {extra && <TableCell sx={cellSx}>{extra.render(l)}</TableCell>}
                {vis.map((c) => <TableCell key={c.id} align={c.right ? 'right' : 'left'} sx={cellSx}>{c.render(l, i, ctx)}</TableCell>)}
                {!locked && onChange && (
                  <TableCell sx={cellSx}>
                    <IconButton size="small" onClick={() => setEdit({ idx: i, line: l })}><EditOutlinedIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => onChange(lines.filter((x) => x.id !== l.id))}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {hasRental && mode !== 'opp' && <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Rental lines take the price from the Heavy Equipment Pricing line (Inventory) and stay editable. Net Amount = Quantity x Rate x Periods less discount; periods follow the dates and frequency. {TO_CONFIRM}.</Text>}
      {edit && <ItemModal line={edit.line} isNew={edit.idx < 0} header={header as string} mode={mode} vat={vatType} pricing={pricing} fleet={fleet} contract={contract} docFrequency={lines.find((x) => x.activity === 'Rental' && x.frequency)?.frequency} onClose={() => setEdit(null)}
        onSave={(l, again) => { onChange?.(edit.idx < 0 ? [...lines, l] : lines.map((x, j) => (j === edit.idx ? l : x))); if (again && edit.idx < 0) openNew(l.activity); else setEdit(null); }} />}
    </Box>
  );
}

/**
 * Item dialog. Existing fields kept (Item, UOM, Description, Quantity, Rate, Discount, Tax, Location, dates). Field order follows the 5 Oct call: what the user types
 * comes first (Category, Subcategory, Pricing, Description, UOM, Quantity, FOC); frequency and dates are derived and sit below. Service lines come from the Service master.
 */
function ItemModal({ line, isNew, header, mode, vat, pricing, fleet, contract, docFrequency, onClose, onSave }: { line: Line; isNew: boolean; header: string; mode: Mode; vat: string; pricing: PricingRec[]; fleet?: HeavyRec[]; contract?: { start?: string; end?: string }; docFrequency?: string; onClose: () => void; onSave: (l: Line, again: boolean) => void }) {
  const services = useServiceCharges().rows;
  const [l, setL] = useState<Line>(line);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (p: Partial<Line>) => setL((x) => ({ ...x, ...p }));
  const equipment = l.activity === 'Rental' || l.activity === 'Fixed Asset Trading';
  const service = l.activity === 'Service';
  const rental = l.activity === 'Rental';
  const priceOpts = pricing.filter((p) => p.category === l.group && (!l.category || p.subCategory === l.category));
  const itemList = itemMaster.filter((i) => (l.activity === 'Fuel Trading' ? i.classification === 'Fuel Trading' : l.activity === 'AMC' ? i.classification === 'AMC' : ['Trading', 'Inventory'].includes(i.classification)));
  const pick = (pid: string) => { const p = pricing.find((x) => x.id === pid); if (p) set({ pricingId: pid, item: pricingName(p), price: l.foc ? 0 : p.price, frequency: p.frequency, desc: !l.desc || l.desc === l.item ? pricingName(p) : l.desc }); };
  const pickService = (name: string) => {
    const m = services.find((x) => x.name === name);
    if (!m) return;
    const rec = m.billing === 'Recurring';
    set({ item: m.name, serviceId: m.id, serviceType: m.type, billing: m.billing, price: l.foc ? 0 : m.price, desc: m.desc || m.name, frequency: rec ? docFrequency ?? 'Monthly' : undefined, start: rec ? contract?.start : undefined, end: rec ? contract?.end : undefined });
  };
  const save = (again: boolean) => {
    const e: Record<string, string> = {};
    if (equipment && !l.group) e.group = 'Required';
    if (equipment && !l.category) e.category = 'Required';
    if (!l.item) e.item = 'Required';
    if (!(l.qty > 0)) e.qty = 'Quantity must be above zero';
    if (rental) {
      if (!l.frequency) e.frequency = 'Required';
      if (!l.start) e.start = 'Required';
      if (!l.end) e.end = 'Required'; else if (l.start && l.end < l.start) e.end = 'End Date must be after Start Date';
    }
    setErr(e);
    if (!Object.keys(e).length) onSave(l, again);
  };
  const g = lineGross(l); const net = lineTaxable(l);
  const foc = <CheckInput label="FOC" change="new" req={R.quote} checked={l.foc} onChange={(v) => set({ foc: v, price: v ? 0 : l.price })} hint={service ? 'Amount is zero' : 'Rate is set to zero, the asset is still tracked'} />;
  return (
    <AppDialog open title={`${isNew ? 'Add' : 'Edit'} ${kindLabel(l.activity)}`} onClose={onClose} maxWidth="lg" confirmLabel="Save" onConfirm={() => save(false)}
      actions={isNew ? <Button variant="outlined" onClick={() => save(true)}>Save and Add another</Button> : undefined}>
      <FormGrid cols={3}>
        {equipment && <SelectInput label={CATEGORY_LABEL} required change="new" req={R.meet} value={l.group} options={groupOptions} onChange={(v) => set({ group: v, category: undefined, pricingId: undefined })} error={err.group} />}
        {equipment && <SelectInput label={SUBCATEGORY_LABEL} required change="new" req={R.meet} value={l.category} options={categoryOptions(l.group)} onChange={(v) => set({ category: v, pricingId: undefined, item: rental ? `Rental ${l.group} ${v}` : `${l.group} ${v} (sale)` })} error={err.category} hint="The exact serialized asset is chosen at Delivery" />}
        {rental && (priceOpts.length
          ? <SelectInput label="Pricing" required change="new" req={R.meet} value={l.pricingId} options={priceOpts.map((p) => ({ value: p.id, label: `${pricingName(p)} (${fmtAED(p.price)})` }))} onChange={pick} error={err.item} hint="From Inventory, Heavy Equipment Pricing" />
          : <TextInput label="Pricing" required value={l.item} onChange={(v) => set({ item: v })} error={err.item} hint="No pricing line for this Category and Subcategory yet" />)}
        {service && <SelectInput label="Service" required change="new" req={R.meet} value={l.item} options={services.map((m) => ({ value: m.name, label: `${m.name} (${m.type}, ${m.billing})` }))} onChange={pickService} error={err.item} hint="From the Service master (Masters, Service Charges)" />}
        {!equipment && !service && <SelectInput label="Item" required value={l.item} options={itemList.map((i) => i.name)} onChange={(v) => { const m = itemMaster.find((i) => i.name === v); set({ item: v, desc: v, unit: l.activity === 'Fuel Trading' ? l.unit : m?.unit ?? l.unit, price: l.foc ? 0 : m?.price ?? l.price }); }} error={err.item} hint={l.activity === 'AMC' ? 'AMC items from Inventory' : undefined} />}
        {l.activity === 'Fixed Asset Trading' && <NumberInput label="Rate (sale price)" required disabled={l.foc} value={l.foc ? 0 : l.price} onChange={(v) => set({ price: Number(v) })} />}
        <Box sx={{ gridColumn: '1 / -1' }}><TextInput label="Description" change="changed" req={R.meet} multiline rows={4} value={l.desc} onChange={(v) => set({ desc: v })} hint="Prints on the document, any length. Defaults to the item name, never written back to the item" /></Box>
        {!service && (l.activity === 'Fuel Trading' ? <SelectInput label="UOM" value={l.unit} options={FUEL_UNITS} onChange={(v) => set({ unit: v })} /> : <TextInput label="UOM" value={l.unit} onChange={(v) => set({ unit: v })} />)}
        <NumberInput label="Quantity" required value={l.qty} onChange={(v) => set({ qty: Number(v) })} error={err.qty} />
        {foc}
        {l.activity !== 'Fixed Asset Trading' && <NumberInput label="Rate" required disabled={l.foc} value={l.foc ? 0 : l.price} onChange={(v) => set({ price: Number(v) })} />}
        <NumberInput label="Discount Rate (%)" value={l.discount ?? 0} onChange={(v) => set({ discount: Number(v) })} />
        {service && <TextInput label="Billing" disabled change="new" req={R.meet} value={l.billing ?? '-'} hint="Set in the Service master" />}
        {service && l.billing === 'Recurring' && <TextInput label="Frequency" disabled change="new" req={R.meet} value={docFrequency ?? l.frequency ?? 'Monthly'} hint="Follows the frequency of the rental item" />}
        {rental && <SelectInput label="Frequency" required change="new" req={R.meet} value={l.frequency} options={[...new Set(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'])]} onChange={(v) => set({ frequency: v })} error={err.frequency} hint="Taken from the pricing line" />}
        {rental && <DateInput label="Start Date" required change="new" req={R.meet} value={l.start} onChange={(v) => set({ start: v })} error={err.start} hint="Auto-filled from the contract dates" />}
        {rental && <DateInput label="End Date" required change="new" req={R.meet} value={l.end} onChange={(v) => set({ end: v })} error={err.end} hint={`${linePeriods(l)} period(s)`} />}
        <TextInput label="Gross Amount" disabled value={aed(g)} />
        <TextInput label="Net Amount" disabled value={aed(net)} />
        <TextInput label="Tax Template" disabled value={vat.startsWith('Export') ? 'Zero Rated' : 'VAT 5%'} />
        <TextInput label="Tax Amount" disabled value={aed(lineVat(l, vat))} />
        <TextInput label="Total Amount" disabled value={aed(net + lineVat(l, vat))} />
        {!service && <SelectInput label="Location" value={l.location} options={l.activity === 'Fuel Trading' || l.activity === 'Trading' ? ALL_LOCATIONS : ALL_LOCATIONS.slice(0, 3)} onChange={(v) => set({ location: v })} hint={l.activity === 'Fuel Trading' ? 'Own yard or a supplier yard' : undefined} />}
        {!service && l.activity !== 'AMC' && <DateInput label="Delivery Commitment Date" value={l.deliveryDate} onChange={(v) => set({ deliveryDate: v })} hint="One date per item, as there may be several delivery commitments" />}
        {!service && l.activity !== 'AMC' && <DateInput label="Expected Shipping Date" value={l.shipDate} onChange={(v) => set({ shipDate: v })} />}
        {mode === 'quote' && rental && <NumberInput label="Replacement Cost" value={l.replacementCost ?? 0} onChange={(v) => set({ replacementCost: Number(v) })} />}
        {rental && <TextInput label="Allocation Tag (internal)" change="new" req={R.quote} value={l.allocationTag} onChange={(v) => set({ allocationTag: v })} hint="Never printed on client documents" />}
        <SelectInput label="Cost Centre (optional)" change="new" req={R.meet} value={l.costCentre} options={COST_CENTRES} onChange={(v) => set({ costCentre: v })} hint="Overrides the header cost centre for this item" />
      </FormGrid>
      {rental && <Box sx={{ mt: 1 }}><AvailabilityBadge group={l.group} category={l.category} fleet={fleet} /></Box>}
    </AppDialog>
  );
}

export function lineErrors(lines: Line[], header: string, needItems = true): string[] {
  const e: string[] = [];
  if (needItems && !lines.length) e.push('Add at least one item');
  lines.forEach((l, i) => {
    const n = `Item ${i + 1}`;
    if (isRentalLine(l) && (!l.group || !l.category)) e.push(`${n}: ${CATEGORY_LABEL} and ${SUBCATEGORY_LABEL} are required`);
    if (l.activity === 'Rental' && (!l.frequency || !l.start || !l.end)) e.push(`${n}: Frequency, Start Date and End Date are required`);
    if (!l.item) e.push(`${n}: Item is required`);
    if (!lineActivitiesFor(header).includes(l.activity)) e.push(`${n}: ${l.activity} items are not allowed on a ${header} document`);
  });
  return e;
}
