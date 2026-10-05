import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Menu, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { Text } from '@/components/Text';
import { AppDialog } from '@/components/Dialogs';
import { CheckInput, DateInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { itemMaster, fmtAED } from '@/mock-data/masters';
import { neutral } from '@/theme/color';
import {
  CATEGORY_LABEL, DEPARTMENTS, FREQUENCIES, FUEL_UNITS, SERVICE_BILLING, SUBCATEGORY_LABEL, YARDS, availability, categoryOptions, groupOptions, isPeriodic, isRentalLine, lineActivitiesFor, lineGross, linePeriods, lineTaxable, lineVat, mkLine, pricingName,
  type ActivityType, type HeavyRec, type Line, type PricingRec,
} from './data';
import { ChangeTag } from '@/components/ChangeTag';
import { deliveredQty } from './flow';
import { AvailabilityBadge, MasterSelect, R, TO_CONFIRM, aed } from './shared';

type Mode = 'opp' | 'quote' | 'order';
const kindLabel = (a: string) => (a === 'Rental' ? 'Equipment' : a === 'Service' ? 'Service / charge' : a);
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
export function ItemsTable({ lines, onChange, header, vatType, locked, fleet, pricing, mode, extra }: {
  lines: Line[]; onChange?: (l: Line[]) => void; header: ActivityType | string; vatType: string; locked?: boolean; fleet?: HeavyRec[]; pricing: PricingRec[]; mode: Mode;
  extra?: { label: string; render: (l: Line) => ReactNode };
}) {
  const hasRental = lineActivitiesFor(header as string).includes('Rental') || header === 'AMC';
  const cols = useMemo(() => COLS.filter((c) => !c.only || c.only.includes(mode)).filter((c) => hasRental || !['frequency', 'start', 'end', 'periods', 'category', 'subcategory'].includes(c.id) || mode === 'opp'), [mode, hasRental]);
  const [shown, setShown] = useState<string[]>(() => COLS.filter((c) => c.vis).map((c) => c.id));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [edit, setEdit] = useState<{ idx: number; line: Line } | null>(null);
  const vis = cols.filter((c) => shown.includes(c.id) && (c.id !== 'kind' || lineActivitiesFor(header as string).length > 1));
  const ctx: Ctx = { vat: vatType, fleet };
  const kinds = lineActivitiesFor(header as string);
  const openNew = (k: string) => {
    const ref = lines.find((x) => x.start);
    setEdit({ idx: -1, line: k === 'Rental' || (header === 'AMC' && k === 'AMC') ? mkLine({ activity: k as ActivityType, item: '', group: 'Generator', frequency: k === 'Rental' ? 'Monthly' : undefined, start: ref?.start, end: ref?.end }) : mkLine({ activity: k as ActivityType, item: '', billing: k === 'Service' ? 'One-time' : undefined, unit: k === 'Fuel Trading' ? 'Litre' : 'Nos' }) });
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
      {edit && <ItemModal line={edit.line} isNew={edit.idx < 0} header={header as string} mode={mode} vat={vatType} pricing={pricing} fleet={fleet} onClose={() => setEdit(null)}
        onSave={(l) => { onChange?.(edit.idx < 0 ? [...lines, l] : lines.map((x, j) => (j === edit.idx ? l : x))); setEdit(null); }} />}
    </Box>
  );
}

/** The existing item dialog (Item, UOM, Description, Location, dates, Quantity, Rate, Discount, Tax Template, Department, Narration) with the new rental fields. */
function ItemModal({ line, isNew, header, mode, vat, pricing, fleet, onClose, onSave }: { line: Line; isNew: boolean; header: string; mode: Mode; vat: string; pricing: PricingRec[]; fleet?: HeavyRec[]; onClose: () => void; onSave: (l: Line) => void }) {
  const [l, setL] = useState<Line>(line);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (p: Partial<Line>) => setL((x) => ({ ...x, ...p }));
  const eq = isRentalLine(l);
  const periodic = isPeriodic(l);
  const priceOpts = pricing.filter((p) => p.category === l.group && (!l.category || p.subCategory === l.category));
  const itemList = itemMaster.filter((i) => (l.activity === 'Fuel Trading' ? i.classification === 'Fuel Trading' : ['Trading', 'Inventory'].includes(i.classification)));
  const pick = (pid: string) => { const p = pricing.find((x) => x.id === pid); if (p) set({ pricingId: pid, item: pricingName(p), price: p.price, frequency: p.frequency, desc: !l.desc || l.desc === l.item ? pricingName(p) : l.desc }); };
  const save = () => {
    const e: Record<string, string> = {};
    if (eq && !l.group) e.group = 'Required';
    if (eq && !l.category) e.category = 'Required';
    if (!l.item) e.item = 'Required';
    if (!(l.qty > 0)) e.qty = 'Quantity must be above zero';
    if (l.activity === 'Rental') {
      if (!l.frequency) e.frequency = 'Required';
      if (!l.start) e.start = 'Required';
      if (!l.end) e.end = 'Required'; else if (l.start && l.end < l.start) e.end = 'End Date must be after Start Date';
    }
    setErr(e);
    if (!Object.keys(e).length) onSave(l);
  };
  const g = lineGross(l); const net = lineTaxable(l);
  return (
    <AppDialog open title={`${isNew ? 'Add' : 'Edit'} ${kindLabel(l.activity)} item`} onClose={onClose} maxWidth="lg" confirmLabel="Save" onConfirm={save}>
      <FormGrid cols={3}>
        {lineActivitiesFor(header).length > 1 && <SelectInput label="Line type" change="new" req={R.meet} value={l.activity} disabled={!isNew} options={lineActivitiesFor(header).map((k) => ({ value: k, label: kindLabel(k) }))} onChange={() => undefined} />}
        {eq && <SelectInput label={CATEGORY_LABEL} required change="new" req={R.meet} value={l.group} options={groupOptions} onChange={(v) => set({ group: v, category: undefined, pricingId: undefined })} error={err.group} />}
        {eq && <SelectInput label={SUBCATEGORY_LABEL} required change="new" req={R.meet} value={l.category} options={categoryOptions(l.group)} onChange={(v) => set({ category: v, pricingId: undefined, item: l.activity === 'Rental' ? `Rental ${l.group} ${v}` : l.item })} error={err.category} hint="Exact serialized asset is chosen only at Delivery" />}
        {l.activity === 'Rental' ? (priceOpts.length
          ? <SelectInput label="Item (pricing line)" required change="new" req={R.meet} value={l.pricingId} options={priceOpts.map((p) => ({ value: p.id, label: `${pricingName(p)} (${fmtAED(p.price)})` }))} onChange={pick} error={err.item} hint="From Inventory > Heavy Equipment Pricing" />
          : <TextInput label="Item" required value={l.item} onChange={(v) => set({ item: v })} error={err.item} hint="No pricing line for this Category and Subcategory yet" />)
          : l.activity === 'Service' ? <MasterSelect master="serviceItem" label="Item" required value={l.item} onChange={(v) => set({ item: v, desc: v })} error={err.item} />
          : l.activity === 'AMC' ? <TextInput label="Item" required value={l.item} onChange={(v) => set({ item: v })} error={err.item} />
          : <SelectInput label="Item" required value={l.item} options={itemList.map((i) => i.name)} onChange={(v) => { const m = itemMaster.find((i) => i.name === v); set({ item: v, desc: v, unit: l.activity === 'Fuel Trading' ? l.unit : m?.unit ?? l.unit, price: m?.price ?? l.price }); }} error={err.item} />}
        {l.activity === 'Fuel Trading' ? <SelectInput label="UOM" value={l.unit} options={FUEL_UNITS} onChange={(v) => set({ unit: v })} /> : <TextInput label="UOM" value={l.unit} onChange={(v) => set({ unit: v })} />}
        <NumberInput label="Quantity" required value={l.qty} onChange={(v) => set({ qty: Number(v) })} error={err.qty} />
        <NumberInput label="Rate" required disabled={l.foc} value={l.foc ? 0 : l.price} onChange={(v) => set({ price: Number(v) })} />
        {periodic && <SelectInput label="Frequency" required={l.activity === 'Rental'} change="new" req={R.meet} value={l.frequency} options={FREQUENCIES} onChange={(v) => set({ frequency: v })} error={err.frequency} />}
        {periodic && <DateInput label="Start Date" required={l.activity === 'Rental'} change="new" req={R.meet} value={l.start} onChange={(v) => set({ start: v })} error={err.start} />}
        {periodic && <DateInput label="End Date" required={l.activity === 'Rental'} change="new" req={R.meet} value={l.end} onChange={(v) => set({ end: v })} error={err.end} hint={`${linePeriods(l)} period(s)`} />}
        <NumberInput label="Discount Rate (%)" value={l.discount ?? 0} onChange={(v) => set({ discount: Number(v) })} />
        <TextInput label="Discount Amount" disabled value={aed(g - net)} />
        <TextInput label="Gross Amount" disabled value={aed(g)} />
        <TextInput label="Net Amount" disabled value={aed(net)} />
        <TextInput label="Tax Template" disabled value={vat.startsWith('Export') ? 'Zero Rated' : 'VAT 5%'} />
        <TextInput label="Tax Amount" disabled value={aed(lineVat(l, vat))} />
        <TextInput label="Total Amount" disabled value={aed(net + lineVat(l, vat))} />
        <SelectInput label="Location" value={l.location} options={YARDS} onChange={(v) => set({ location: v })} />
        <DateInput label="Delivery Commitment Date" value={l.deliveryDate} onChange={(v) => set({ deliveryDate: v })} hint="One date per line, as there may be several delivery commitments" />
        <DateInput label="Expected Shipping Date" value={l.shipDate} onChange={(v) => set({ shipDate: v })} />
        {mode === 'quote' && <NumberInput label="Replacement Cost" value={l.replacementCost ?? 0} onChange={(v) => set({ replacementCost: Number(v) })} />}
        <SelectInput label="Department" value={l.department} options={DEPARTMENTS} onChange={(v) => set({ department: v })} />
        <TextInput label="Narration" value={l.narration} onChange={(v) => set({ narration: v })} />
        <TextInput label="Description" change="changed" req={R.meet} value={l.desc} onChange={(v) => set({ desc: v })} hint="Defaults to the item name, editable per document, prints, never written back to the item" />
        {l.activity === 'Rental' && <TextInput label="Allocation Tag (internal)" change="new" req={R.quote} value={l.allocationTag} onChange={(v) => set({ allocationTag: v })} hint="Never printed on client documents" />}
        {l.activity === 'Service' && <SelectInput label="Billing" change="new" req={R.meet} value={l.billing ?? 'One-time'} options={SERVICE_BILLING} onChange={(v) => set({ billing: v, ...(v === 'Recurring' ? { frequency: l.frequency ?? 'Monthly' } : {}) })} />}
        <CheckInput label="FOC (price is zero, asset still tracked)" change="new" req={R.quote} checked={l.foc} onChange={(v) => set({ foc: v })} />
      </FormGrid>
      {l.activity === 'Rental' && <Box sx={{ mt: 1 }}><AvailabilityBadge group={l.group} category={l.category} fleet={fleet} /></Box>}
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
