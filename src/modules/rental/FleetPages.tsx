import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, FormControlLabel, MenuItem, Select, Switch } from '@mui/material';
import dayjs from 'dayjs';
import { employees, suppliers } from '@/mock-data/masters';
import { useCollection } from '@/store/store';
import { DataTable } from '@/components/DataTable';
import { AppDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { FLEET_STATUSES, TODAY, TRIP_STATUSES, assetById, custName, deliveryVehicles, fleetSettingsSeed, fleetStatus, isOpenTrip, nextBookingOf, openTripOf, tripTotal, vehicleFreeOn, type Delivery, type FleetSettings, type FleetStatus, type HeavyRec, type Trip } from '@/modules/crm/data';
import { addDeliveryExpense, addTripExpense, arrangeDeliveryTransport, cancelTrip, completeTrip, getTrip, markStuck, reassignTrip, removeTripExpense, resumeTrip, startTrip, switchToExternal, vehicleIsFree } from '@/modules/crm/flow';
import { MasterSelect, R, RowMenu, aed, useFleet, useTrips, type RowMenuItem } from '@/modules/crm/shared';
import { currentLocation } from '@/modules/inventory/data';
import { accLabel, expenseAccounts, tripExpenseAccount } from '@/modules/accounting/data';
import { billsOfSource } from '@/modules/accounting/engine';
import { useBills } from '@/modules/accounting/shared';

const FLEET_SETTINGS_COL = 'rental.fleetSettings';

const HEAVY = '/inventory/items/heavy';

/* ------------------------------------------------------------------ small helpers */
/** How long a vehicle has been in its state, for the board ("3 h", "2 days"). */
export function sinceLabel(iso?: string): string {
  if (!iso) return '-';
  const m = dayjs().diff(dayjs(iso), 'minute');
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`;
}
/** Employees with designation Driver first, then the other active employees (a dispatcher can drive too). */
export const driverOptions = () => { const act = employees.filter((e) => e.status === 'Active'); return [...act.filter((e) => e.designation === 'Driver'), ...act.filter((e) => e.designation !== 'Driver')].map((e) => e.name); };
export const mobileOf = (name?: string) => employees.find((e) => e.name === name)?.mobile ?? '';
export const transporterOptions = () => suppliers.filter((x) => x.type === 'Service Provider' && x.active).map((x) => x.name);
const vehicleLabel = (a?: HeavyRec) => (a ? `${a.plateNumber ?? a.assetId} - ${a.name}` : '-');
const fleetTone = (s: FleetStatus) => (s === 'Unavailable' ? ('grey' as const) : undefined);
const docPath = (t: Trip) => (t.kind === 'Delivery' || (t.kind === 'Replacement' && t.docNumber.startsWith('DO-')) ? `/crm/delivery-orders/${t.docId}` : t.kind === 'Collection' ? `/crm/customer-returns/${t.docId}` : t.docId.startsWith('rp') ? `/crm/replacements/${t.docId}` : '/crm/replacements');
/** 9 Oct call: one replacement trip can deliver the new unit and collect the faulty one; both documents are shown. */
const docText = (t: Trip) => (t.alsoDoc ? `${t.docNumber} and ${t.alsoDoc.number}` : t.docNumber);
const RL = { color: '#0A6C3D', textDecoration: 'none', fontWeight: 500 } as const;

/* ------------------------------------------------------------------ trip actions (shared by the board row menu and the trip page) */
type DlgKind = 'stuck' | 'complete' | 'expense' | 'reassign' | 'external' | 'cancel';
type ExpenseLine = { type: string; amount: string; vatPct: string; account: string; note: string };
const blankExpenseLine = (): ExpenseLine => ({ type: '', amount: '', vatPct: '5', account: '', note: '' });
/** Expense Head options for a trip expense line, as on BillPages / Cash Expense: an explicit GL account the user sees and can override. */
const expenseAccOptions = expenseAccounts.map((a) => `${a.code} ${a.name}`);
const accText = (code: string) => expenseAccOptions.find((a) => a.startsWith(code)) ?? code;
const accCode = (label: string) => label.slice(0, 6);

/** Fleet Management settings (client review 8 Oct): is the detailed driver trip workflow on? Off: the Delivery Order's own Dispatched / Delivered actions drive the trip instead. */
export const useFleetSettings = () => useCollection<FleetSettings>(FLEET_SETTINGS_COL, fleetSettingsSeed);
export const driverAppOf = (s: ReturnType<typeof useFleetSettings>) => s.get('settings')?.driverAppEnabled ?? true;
/** The status-driven actions of a trip, and the dialogs they open. With the driver app off, the Assigned -> En Route -> Stuck-Delayed -> Completed actions are
 * skipped (the Delivery Order drives those transitions instead); Add Expense and Cancel Trip stay available either way. */
export function useTripMenu() {
  const [dlg, setDlg] = useState<{ kind: DlgKind; id: string } | null>(null);
  const toast = useToast();
  const driverApp = driverAppOf(useFleetSettings());
  const open = (kind: DlgKind, t: Trip) => setDlg({ kind, id: t.id });
  const items = (t: Trip): RowMenuItem[] => {
    const own = t.transport === 'Own Fleet';
    const m: RowMenuItem[] = [];
    if (driverApp) {
      if (t.status === 'Assigned') {
        m.push({ label: 'Start Trip', onClick: () => { startTrip(t); toast(`${t.number} started, the vehicle is En Route`); } });
        if (own) m.push({ label: 'Reassign Vehicle / Driver', onClick: () => open('reassign', t) }, { label: 'Switch to External Transporter', onClick: () => open('external', t) });
      }
      if (t.status === 'En Route') m.push({ label: 'Mark Stuck-Delayed', onClick: () => open('stuck', t) });
      if (t.status === 'Stuck-Delayed') m.push({ label: 'Resume (En Route)', onClick: () => { resumeTrip(t); toast(`${t.number} resumed`); } });
      if (t.status === 'En Route' || t.status === 'Stuck-Delayed') m.push({ label: 'Complete Trip', onClick: () => open('complete', t) });
    }
    if (t.status === 'En Route' || t.status === 'Stuck-Delayed' || t.status === 'Completed') m.push({ label: 'Add Expense', onClick: () => open('expense', t) });
    if (isOpenTrip(t)) m.push({ label: 'Cancel Trip', danger: true, onClick: () => open('cancel', t) });
    return m;
  };
  const trip = dlg ? getTrip(dlg.id) : undefined;
  const close = () => setDlg(null);
  const dialogs = trip && dlg ? (
    <>
      {dlg.kind === 'stuck' && <StuckDialog trip={trip} onClose={close} />}
      {dlg.kind === 'complete' && <CompleteTripDialog trip={trip} onClose={close} />}
      {dlg.kind === 'expense' && <ExpenseDialog trip={trip} onClose={close} />}
      {dlg.kind === 'reassign' && <VehicleDialog trip={trip} onClose={close} />}
      {dlg.kind === 'external' && <ExternalDialog trip={trip} onClose={close} />}
      {dlg.kind === 'cancel' && <CancelDialog trip={trip} onClose={close} />}
    </>
  ) : null;
  return { items, dialogs };
}

function TripSummary({ trip }: { trip: Trip }) {
  return (
    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F4F5F7', borderRadius: '6px' }}>
      <Text type="s4" weight="medium">{trip.number} ({trip.kind}) for {docText(trip)}</Text>
      <Text type="s5" color="theme.secondary.700">{trip.soNumber}, {custName(trip.customerId)}, {trip.site || '-'}. {trip.transport === 'Own Fleet' ? `${trip.plate ?? '-'}${trip.driver ? `, ${trip.driver}` : ''}` : trip.transporter}</Text>
    </Box>
  );
}
function StuckDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [by, setBy] = useState('');
  return (
    <AppDialog open title="Mark Stuck-Delayed" onClose={onClose} confirmLabel="Mark Stuck-Delayed" confirmColor="error" confirmDisabled={!reason.trim() || !by} onConfirm={() => { markStuck(trip, reason.trim(), by as 'Company' | 'Client'); toast(`${trip.number} marked Stuck-Delayed`); onClose(); }}>
      <TripSummary trip={trip} />
      <FormGrid cols={1}>
        <TextInput label="Reason" required change="new" req={R.fleet} value={reason} onChange={setReason} multiline rows={2} hint="For example crane not available, offloading did not happen. The dispatcher plans around it" />
        <SelectInput label="Responsible" required change="new" req={R.fleet} value={by} options={['Company', 'Client']} onChange={setBy} hint="Client: the delay is the client's problem. Company: our logistics problem" />
      </FormGrid>
    </AppDialog>
  );
}
function ExpenseLines({ lines, onChange }: { lines: ExpenseLine[]; onChange: (l: ExpenseLine[]) => void }) {
  const set = (i: number, p: Partial<ExpenseLine>) => onChange(lines.map((l, n) => (n === i ? { ...l, ...p } : l)));
  // Picking a type suggests the GL account it normally posts to; the dispatcher can still override it per line.
  const pickType = (i: number, v: string) => set(i, { type: v, account: lines[i].account || accText(tripExpenseAccount(v)) });
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {lines.map((l, i) => (
        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1.1fr 0.75fr 0.55fr 1.5fr 1.1fr auto', gap: 1.5, alignItems: 'end' }}>
          <MasterSelect master="tripExpenseTypes" label="Expense Type" required change="new" req={R.trip} value={l.type} onChange={(v) => pickType(i, v)} />
          <NumberInput label="Amount (AED)" required value={l.amount} onChange={(v) => set(i, { amount: v })} />
          <SelectInput label="VAT %" change="new" req={R.trip} value={l.vatPct} options={['5', '0']} onChange={(v) => set(i, { vatPct: v })} />
          <SelectInput label="Expense Head" change="new" req={R.trip} value={l.account} options={expenseAccOptions} onChange={(v) => set(i, { account: v })} hint="Defaults from the Expense Type; override to post elsewhere" />
          <TextInput label="Note" value={l.note} onChange={(v) => set(i, { note: v })} />
          <Button size="small" color="error" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, n) => n !== i))} sx={{ mb: 0.5 }}>Remove</Button>
        </Box>
      ))}
      <Box><Button size="small" variant="outlined" onClick={() => onChange([...lines, blankExpenseLine()])}>Add expense line</Button></Box>
    </Box>
  );
}
const toExpenses = (lines: ExpenseLine[]) => lines.filter((l) => l.type && Number(l.amount) > 0).map((l) => ({ type: l.type, amount: Number(l.amount), vatPct: Number(l.vatPct) || 0, account: accCode(l.account) || tripExpenseAccount(l.type), note: l.note.trim() || undefined }));
function CompleteTripDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<ExpenseLine[]>([blankExpenseLine()]);
  const bad = lines.some((l) => (l.type || l.amount) && !(l.type && Number(l.amount) > 0));
  return (
    <AppDialog open title="Complete Trip" onClose={onClose} maxWidth="md" confirmLabel="Complete Trip" confirmDisabled={bad} onConfirm={() => { const e = toExpenses(lines); completeTrip(trip, e); toast(`${trip.number} completed, the vehicle is Free${e.length ? `. AED ${e.reduce((s, x) => s + x.amount, 0)} added to ${trip.soNumber}` : ''}`); onClose(); }}>
      <TripSummary trip={trip} />
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Enter the costs of this trip (Salik, fuel and so on). They are added to the Sales Order logistics cost. Leave empty if there are none; expenses can also be added later on the trip.</Text>
      <ExpenseLines lines={lines} onChange={setLines} />
      {bad && <Text type="s5" color="#C64D4D" sx={{ mt: 1 }}>Each expense line needs a type and an amount greater than 0, or remove the line</Text>}
    </AppDialog>
  );
}
function ExpenseDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<ExpenseLine[]>([blankExpenseLine()]);
  const ok = toExpenses(lines);
  return (
    <AppDialog open title="Add Expense" onClose={onClose} maxWidth="md" confirmLabel="Add" confirmDisabled={!ok.length || ok.length !== lines.length} onConfirm={() => { ok.forEach((e) => addTripExpense(getTrip(trip.id) ?? trip, e)); toast(`AED ${ok.reduce((s, x) => s + x.amount, 0)} added to ${trip.soNumber}`); onClose(); }}>
      <TripSummary trip={trip} />
      <ExpenseLines lines={lines} onChange={setLines} />
    </AppDialog>
  );
}
/** Add a trip-style expense straight on a Delivery Order, no active trip required (client review 8 Oct). Same fields and posting as a trip expense. */
export function DeliveryExpenseDialog({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<ExpenseLine[]>([blankExpenseLine()]);
  const ok = toExpenses(lines);
  return (
    <AppDialog open title="Add Expense" onClose={onClose} maxWidth="md" confirmLabel="Add" confirmDisabled={!ok.length || ok.length !== lines.length} onConfirm={() => { ok.forEach((e) => addDeliveryExpense(delivery.id, e)); toast(`AED ${ok.reduce((s, x) => s + x.amount, 0)} added to ${delivery.soNumber}`); onClose(); }}>
      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F4F5F7', borderRadius: '6px' }}>
        <Text type="s4" weight="medium">{delivery.number}</Text>
        <Text type="s5" color="theme.secondary.700">{delivery.soNumber}, {custName(delivery.customerId)}</Text>
      </Box>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Charge a cost to this delivery even when there is no active trip, for example before dispatch or after the trip already completed.</Text>
      <ExpenseLines lines={lines} onChange={setLines} />
    </AppDialog>
  );
}
/** Reassign vehicle / driver while Assigned. Only Free vehicles (and the trip's own) are offered. */
function VehicleDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const fleet = useFleet();
  const options = deliveryVehicles(fleet.rows).filter((a) => a.id === trip.vehicleId || vehicleIsFree(a.id, trip.id, trip.date));
  const [vid, setVid] = useState(trip.vehicleId ?? '');
  const [driver, setDriver] = useState(trip.driver ?? '');
  const pick = (id: string) => { setVid(id); const d = assetById(id)?.defaultDriver ?? ''; setDriver(d); };
  return (
    <AppDialog open title="Reassign Vehicle / Driver" onClose={onClose} confirmLabel="Update" confirmDisabled={!vid} onConfirm={() => { const err = reassignTrip(trip, vid, driver, mobileOf(driver)); if (err) { toast(err, 'error'); return; } toast(`${trip.number} reassigned`); onClose(); }}>
      <TripSummary trip={trip} />
      <FormGrid cols={1}>
        <SelectInput label={`Vehicle (Free on ${trip.date.slice(0, 10)})`} required value={vid} options={options.map((a) => ({ value: a.id, label: vehicleLabel(a) }))} onChange={pick} error={options.length === 0 ? 'No vehicle is Free' : undefined} />
        <SelectInput label="Driver" value={driver} options={driverOptions()} onChange={setDriver} hint="Defaults to the vehicle's Default Driver" />
        <TextInput label="Mobile" disabled value={mobileOf(driver)} />
      </FormGrid>
    </AppDialog>
  );
}
function ExternalDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [by, setBy] = useState('');
  const [cost, setCost] = useState('');
  const [driverName, setDriverName] = useState('');
  return (
    <AppDialog open title="Switch to External Transporter" onClose={onClose} confirmLabel="Switch" confirmDisabled={!by || !(Number(cost) > 0)} onConfirm={() => { const err = switchToExternal(trip, by, Number(cost), driverName); if (err) { toast(err, 'error'); return; } toast(`${trip.number} moved to ${by}, the own vehicle is Free`); onClose(); }}>
      <TripSummary trip={trip} />
      <FormGrid cols={1}>
        <SelectInput label="Transported By" required value={by} options={transporterOptions()} onChange={setBy} hint="The supplier who transports, so the cost is paid back to them against the project" />
        <TextInput label="Driver Name" value={driverName} onChange={setDriverName} hint="The external transporter's driver, for the trip record" />
        <NumberInput label="Transport Charge (AED)" required value={cost} onChange={setCost} hint="Posts to the Sales Order logistics cost" />
      </FormGrid>
    </AppDialog>
  );
}
function CancelDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <AppDialog open title="Cancel Trip" onClose={onClose} confirmLabel="Cancel Trip" confirmColor="error" confirmDisabled={!reason.trim()} onConfirm={() => { cancelTrip(trip, reason.trim()); toast(`${trip.number} cancelled, the vehicle is Free`); onClose(); }}>
      <TripSummary trip={trip} />
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Cancelling frees the vehicle and takes the trip's expenses ({aed(tripTotal(trip))}) back off {trip.soNumber}. Ledger entries are reversed and a transporter bill is voided. The document needs new transport afterwards.</Text>
      <TextInput label="Reason" required value={reason} onChange={setReason} multiline rows={2} />
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ Fleet Availability */
interface BoardRow {
  id: string; plate: string; name: string; type: string; driver: string; status: FleetStatus; trip?: Trip; booking?: Trip; since: string; location: string; asset: HeavyRec;
}
const useBoardRows = (): BoardRow[] => {
  const fleet = useFleet();
  const trips = useTrips();
  return deliveryVehicles(fleet.rows).map((a): BoardRow => {
    const status = fleetStatus(a, trips.rows);
    const trip = openTripOf(a.id, trips.rows);
    return { id: a.id, plate: a.plateNumber ?? '-', name: a.name, type: a.subCategory, driver: trip?.driver ?? a.defaultDriver ?? '-', status, trip, booking: nextBookingOf(a.id, trips.rows), since: trip ? sinceLabel(trip.since) : '-', location: currentLocation(a), asset: a };
  });
};
const compact = { minWidth: 160, bgcolor: '#fff', fontSize: 13, height: 36 } as const;

function FleetFilters({ types, type, setType, status, setStatus, hideStatus }: { types: string[]; type: string; setType: (v: string) => void; status: string; setStatus: (v: string) => void; hideStatus?: boolean }) {
  return (
    <>
      <Select size="small" displayEmpty value={type} onChange={(e) => setType(e.target.value)} sx={compact} renderValue={(v) => (v ? `Vehicle Type: ${v}` : 'Vehicle Type: All')}>
        <MenuItem value="">All vehicle types</MenuItem>
        {types.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
      </Select>
      {!hideStatus && (
        <Select size="small" displayEmpty value={status} onChange={(e) => setStatus(e.target.value)} sx={compact} renderValue={(v) => (v ? `Fleet Status: ${v}` : 'Fleet Status: All')}>
          <MenuItem value="">All statuses</MenuItem>
          {FLEET_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      )}
    </>
  );
}

/** The dispatcher's view of the own delivery fleet. In picker mode (opened from a Delivery Order, Return or Replacement) it lists only Free vehicles. */
export function FleetBoard() {
  const nav = useNavigate();
  const toast = useToast();
  const rows = useBoardRows();
  const menu = useTripMenu();
  const settings = useFleetSettings();
  const driverApp = driverAppOf(settings);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);
  const view = rows.filter((r) => (!type || r.type === type) && (!status || r.status === status));
  const count = (s: FleetStatus) => rows.filter((r) => (!type || r.type === type) && r.status === s).length;
  return (
    <Page>
      {/* client review 8 Oct: Driver app enabled bypasses the detailed trip workflow (Assigned, En Route, Stuck-Delayed, Completed) */}
      <PageTitle title="Fleet Availability" subtitle="Own delivery vehicles and what they are doing now. Pick a Free vehicle for a delivery, collection or replacement" change="new" req={R.fleet}
        right={<FormControlLabel control={<Switch size="small" checked={driverApp} onChange={(e) => { settings.update('settings', { driverAppEnabled: e.target.checked }); toast(e.target.checked ? 'Driver app switched on: trips follow Assigned, En Route, Stuck-Delayed, Completed' : "Driver app switched off: the Delivery Order's own Dispatched / Delivered actions drive the trip"); }} />}
          label={<Text type="s5" color="theme.secondary.800">Driver app enabled</Text>} />} />
      <KpiRow>
        {FLEET_STATUSES.map((s) => (
          <KpiCard key={s} title={s} value={count(s)} tint={status === s ? '#B6E9D6' : undefined} sub={status === s ? 'Filtered, click to clear' : 'Click to filter'} onClick={() => setStatus(status === s ? '' : s)} />
        ))}
      </KpiRow>
      <DataTable<BoardRow> rows={view} searchPlaceholder="Search plate, vehicle or driver..." toolbarRight={<FleetFilters types={types} type={type} setType={setType} status={status} setStatus={setStatus} />}
        emptyText={rows.length ? 'No vehicle matches the filters' : 'No delivery vehicles yet. Tick Fleet Vehicle on an asset in Accounting > Fixed Asset Management'}
        columns={[
          { key: 'plate', label: 'Plate Number', change: 'new', req: R.fleet },
          { key: 'name', label: 'Vehicle', render: (r) => <Link to={`${HEAVY}/${r.id}`} style={RL}>{r.name}</Link> },
          { key: 'type', label: 'Type', change: 'new', req: R.fleet },
          { key: 'driver', label: 'Driver' },
          { key: 'status', label: 'Fleet Status', change: 'new', req: R.fleet, render: (r) => (
            <Box><StatusChip status={r.status} tone={fleetTone(r.status)} />
              {r.status === 'Stuck-Delayed' && r.trip?.stuck && <Text type="s5" color="#C64D4D" sx={{ mt: 0.5, maxWidth: 260 }}>{r.trip.stuck.reason} ({r.trip.stuck.responsible})</Text>}
              {r.status === 'Unavailable' && <Text type="s5" color="theme.secondary.700" sx={{ mt: 0.5 }}>{r.asset.status === 'Inactive' ? 'Inactive' : r.asset.assetStatus}</Text>}
            </Box>
          ) },
          { key: 'trip', label: 'Current Trip', sortable: false, render: (r) => (r.trip ? <Box><Link to={`/crm/trips/${r.trip.id}`} style={RL}>{r.trip.number}</Link><Text type="s5" color="theme.secondary.700">{r.trip.kind}, {r.trip.docNumber}, {custName(r.trip.customerId)}{r.trip.site ? `, ${r.trip.site}` : ''}</Text></Box> : '-') },
          { key: 'booking', label: 'Next Booking', change: 'new', req: 'Fleet review 7 Oct: availability is by date, so a vehicle booked for a later day stays Free today', sortable: false, render: (r) => (r.booking ? <Box><Link to={`/crm/trips/${r.booking.id}`} style={RL}>{r.booking.number}</Link><Text type="s5" color="theme.secondary.700">{r.booking.date.replace('T', ' ')}, {r.booking.kind}, {r.booking.docNumber}</Text></Box> : '-') },
          { key: 'since', label: 'In Status Since', sortable: false },
          { key: 'location', label: 'Location' },
          { key: 'menu', label: '', sortable: false, width: 48, render: (r) => <span onClick={(e) => e.stopPropagation()}><RowMenu items={r.trip ? menu.items(r.trip) : [{ label: 'View Asset', onClick: () => nav(`${HEAVY}/${r.id}`) }, { label: 'View Trips', onClick: () => nav(`${HEAVY}/${r.id}`, { state: { tab: 'Trips' } }) }]} /></span> },
        ]} />
      {menu.dialogs}
    </Page>
  );
}

/** Used inside a dialog by the Delivery Order, Return and Replacement: only Free vehicles, a Select button per row. */
export function FleetPickerDialog({ open, onClose, onPick, onExternal, date }: { open: boolean; onClose: () => void; onPick: (a: HeavyRec) => void; onExternal?: () => void; date?: string }) {
  const rows = useBoardRows();
  const trips = useTrips();
  const day = (date ?? TODAY).slice(0, 10);
  const isFree = (r: BoardRow) => vehicleFreeOn(r.asset, day, trips.rows);
  const [type, setType] = useState('');
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);
  const free = rows.filter((r) => isFree(r) && (!type || r.type === type));
  return (
    <AppDialog open={open} title="Select from fleet" onClose={onClose} maxWidth="lg">
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Only vehicles that are Free on {day} are listed. {rows.filter(isFree).length} of {rows.length} delivery vehicles are Free.</Text>
      {rows.filter(isFree).length === 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }} action={onExternal && <Button size="small" color="inherit" onClick={() => { onClose(); onExternal(); }}>Use External Transporter</Button>}>No vehicle is Free on {day}. Change the date, wait for one to be released, or use an external transporter.</Alert>
      )}
      <DataTable<BoardRow> rows={free} searchPlaceholder="Search plate, vehicle or driver..." toolbarRight={<FleetFilters types={types} type={type} setType={setType} status="" setStatus={() => undefined} hideStatus />} pageSize={8} emptyText="No Free vehicle matches"
        columns={[
          { key: 'plate', label: 'Plate Number' }, { key: 'name', label: 'Vehicle' }, { key: 'type', label: 'Type' }, { key: 'driver', label: 'Default Driver' }, { key: 'location', label: 'Location' },
          { key: 'pick', label: '', sortable: false, width: 100, render: (r) => <Button size="small" variant="contained" onClick={() => { onPick(r.asset); onClose(); }}>Select</Button> },
        ]} />
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ transport section (Delivery Order, Return, Replacement) */
export interface TransportValue { transport: string; vehicleId: string; driver: string; mobile: string; transporter: string; charge: string }
export const blankTransport = (): TransportValue => ({ transport: 'Own Fleet', vehicleId: '', driver: '', mobile: '', transporter: '', charge: '' });
export function validateTransport(v: TransportValue, date?: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.transport === 'Own Fleet') {
    if (!v.vehicleId) e.vehicleId = 'Select a Free vehicle from the fleet';
    else if (!vehicleIsFree(v.vehicleId, undefined, date)) e.vehicleId = `This vehicle is not Free on ${(date ?? TODAY).slice(0, 10)}. Select another`;
  } else {
    if (!v.transporter.trim()) e.transporter = 'Select the supplier who transports';
    if (!Number(v.charge)) e.charge = 'External Transport Cost is required for an external transporter';
  }
  return e;
}
/** Own Fleet: pick a Free vehicle from Fleet Availability and the driver and mobile fill in. External Transporter: the supplier and its cost. */
/** `date` is the day of the delivery, collection or replacement: a vehicle is offered only when it is Free on that day. */
export function TransportSection({ value, onChange, errors = {}, hint, date }: { value: TransportValue; onChange: (v: TransportValue) => void; errors?: Record<string, string>; hint?: ReactNode; date?: string }) {
  const [picker, setPicker] = useState(false);
  const [swap, setSwap] = useState(false);
  const fleet = useFleet();
  const set = (p: Partial<TransportValue>) => onChange({ ...value, ...p });
  const v = fleet.get(value.vehicleId);
  // The driver comes with the vehicle (its Default Driver); the dispatcher changes it only when needed.
  const linked = !!v?.defaultDriver && !swap;
  const own = value.transport === 'Own Fleet';
  return (
    <>
      <FormGrid>
        <SelectInput label="Transport Type" required change="new" req={R.del} value={value.transport} options={['Own Fleet', 'External Transporter']} onChange={(t) => set({ transport: t })} />
        <Box />
        {own ? (
          <>
            <Box>
              <TextInput label="Vehicle" required change="new" req={R.fleet} value={v ? vehicleLabel(v) : ''} disabled error={errors.vehicleId} placeholder="No vehicle selected" hint="Picked from Fleet Availability, vehicles Free on the document date only" />
              <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => setPicker(true)}>{v ? 'Change vehicle' : 'Select from fleet'}</Button>
            </Box>
            <Box />
            {linked ? (
              <Box>
                <TextInput label="Driver" change="changed" req={R.fleet} value={value.driver} disabled hint="The driver assigned to this vehicle (its Default Driver)" />
                <Button size="small" variant="text" sx={{ mt: 0.5 }} onClick={() => setSwap(true)}>Change driver</Button>
              </Box>
            ) : (
              <SelectInput label="Driver" change="changed" req={R.fleet} value={value.driver} options={driverOptions()} onChange={(d) => set({ driver: d, mobile: mobileOf(d) })} hint={v?.defaultDriver ? `Default Driver of this vehicle is ${v.defaultDriver}; pick another only when needed` : 'This vehicle has no Default Driver; pick the driver for this trip'} />
            )}
            <TextInput label="Mobile Number" value={value.mobile} disabled={linked} onChange={(m) => set({ mobile: m })} hint="Filled from the employee record of the driver" />
          </>
        ) : (
          <>
            <SelectInput label="Transported By" required change="changed" req={R.meet} value={value.transporter} options={transporterOptions()} onChange={(t) => set({ transporter: t })} error={errors.transporter} hint="The supplier (vendor) who transports, so the cost is paid back to them against the project" />
            <NumberInput label="External Transport Cost (AED)" required change="new" req={R.del} value={value.charge} onChange={(c) => set({ charge: c })} error={errors.charge} hint="Cost of the project. Posts to the same Order / Project cost centre, once, as a trip expense" />
          </>
        )}
      </FormGrid>
      {hint && <Box sx={{ mt: 1 }}>{hint}</Box>}
      <FleetPickerDialog open={picker} date={date} onClose={() => setPicker(false)} onExternal={() => set({ transport: 'External Transporter', vehicleId: '', driver: '', mobile: '' })}
        onPick={(a) => { const d = a.defaultDriver ?? ''; setSwap(false); set({ vehicleId: a.id, driver: d, mobile: mobileOf(d) }); }} />
    </>
  );
}
/** What a document passes to createTrip / raiseReturn / replaceAsset. */
export const toTransportInput = (v: TransportValue) => ({
  transport: v.transport as Trip['transport'], vehicleId: v.vehicleId || undefined, driver: v.driver || undefined, mobile: v.mobile || undefined, transporter: v.transporter || undefined, charge: Number(v.charge) || undefined,
});

/** A Delivery Order whose trip was cancelled gets a new trip: own vehicle (Free on the chosen day) or an external transporter. */
export function ArrangeTransportDialog({ docId, docNumber, onClose }: { docId: string; docNumber: string; onClose: () => void }) {
  const toast = useToast();
  const [tp, setTp] = useState(blankTransport);
  const [date, setDate] = useState(`${TODAY}T${dayjs().format('HH:mm')}`);
  const [err, setErr] = useState<Record<string, string>>({});
  const save = () => {
    const e = validateTransport(tp, date);
    setErr(e);
    if (Object.keys(e).length) return;
    const msg = arrangeDeliveryTransport(docId, { ...toTransportInput(tp), date });
    if (msg) { toast(msg, 'error'); return; }
    toast(`New trip created for ${docNumber}`);
    onClose();
  };
  return (
    <AppDialog open title={`Arrange Transport for ${docNumber}`} onClose={onClose} maxWidth="md" confirmLabel="Create Trip" onConfirm={save}>
      <FormGrid cols={1}><TextInput label="Planned Dispatch" required value={date.replace('T', ' ')} disabled hint="The new trip is planned for now" /></FormGrid>
      <Box sx={{ mt: 2 }}><TransportSection value={tp} onChange={setTp} errors={err} date={date} /></Box>
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ Trips */
const tripVehicle = (t: Trip) => (t.transport === 'Own Fleet' ? t.plate ?? '-' : t.transporter ?? '-');
export function TripList() {
  const nav = useNavigate();
  const trips = useTrips();
  const [kind, setKind] = useState('');
  const [transport, setTransport] = useState('');
  const rows = trips.rows.filter((t) => (!kind || t.kind === kind) && (!transport || t.transport === transport)).map((t) => ({ ...t, vehicleOrTransporter: tripVehicle(t), customer: custName(t.customerId), total: tripTotal(t) }));
  return (
    <Page>
      <PageTitle title="Trips" subtitle="Every delivery, collection and replacement movement, by own vehicle or external transporter. A trip is created from its document, never on its own" change="new" req={R.trip} />
      <DataTable rows={rows} searchPlaceholder="Search trips..." filter={{ key: 'status', options: [...TRIP_STATUSES] }} onRowClick={(r) => nav(`/crm/trips/${r.id}`)}
        toolbarRight={<>
          <Select size="small" displayEmpty value={kind} onChange={(e) => setKind(e.target.value)} sx={compact} renderValue={(v) => (v ? `Kind: ${v}` : 'Kind: All')}>
            <MenuItem value="">All kinds</MenuItem>{['Delivery', 'Collection', 'Replacement'].map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={transport} onChange={(e) => setTransport(e.target.value)} sx={compact} renderValue={(v) => (v ? `Transport: ${v}` : 'Transport: All')}>
            <MenuItem value="">All transport</MenuItem>{['Own Fleet', 'External Transporter'].map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </Select>
        </>}
        columns={[
          { key: 'number', label: 'Trip No.' }, { key: 'date', label: 'Date', render: (r) => r.date.replace('T', ' ') }, { key: 'kind', label: 'Kind' },
          { key: 'docNumber', label: 'Document', render: (r) => <><Link to={docPath(r)} style={RL} onClick={(e) => e.stopPropagation()}>{r.docNumber}</Link>{r.alsoDoc && <> and <Link to={`/crm/customer-returns/${r.alsoDoc.id}`} style={RL} onClick={(e) => e.stopPropagation()}>{r.alsoDoc.number}</Link></>}</> },
          { key: 'soNumber', label: 'Sales Order', render: (r) => <Link to={`/crm/sales-orders/${r.soId}`} style={RL} onClick={(e) => e.stopPropagation()}>{r.soNumber}</Link> },
          { key: 'customer', label: 'Customer' }, { key: 'site', label: 'Site' }, { key: 'transport', label: 'Transport' },
          { key: 'vehicleOrTransporter', label: 'Vehicle / Transporter' }, { key: 'driver', label: 'Driver', render: (r) => r.driver ?? '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }, { key: 'total', label: 'Total Expenses', align: 'right', render: (r) => aed(r.total) },
        ]} />
    </Page>
  );
}

export function TripView() {
  const { id } = useParams();
  const nav = useNavigate();
  const trips = useTrips();
  const menu = useTripMenu();
  useBills();
  const t = trips.get(id);
  if (!t) return <Page><PageTitle title="Trip not found" right={<Button variant="outlined" onClick={() => nav('/crm/trips')}>Back</Button>} /></Page>;
  const own = t.transport === 'Own Fleet';
  const vehicle = t.vehicleId ? assetById(t.vehicleId) : undefined;
  const items = menu.items(t);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Trips', to: '/crm/trips' }, { label: t.number }]} status={<StatusChip status={t.status} />} actions={<>
        <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${t.soId}`)}>View Sales Order</Button>
        <Button variant="outlined" onClick={() => nav(docPath(t))}>View {t.kind === 'Delivery' ? 'Delivery Order' : t.kind === 'Collection' ? 'Return' : 'Replacements'}</Button>
        {items.length > 0 && <MenuButton label="Actions" items={items.map((i) => ({ label: i.label, onClick: i.onClick }))} variant="contained" />}
      </>} />
      <Page sx={{ pt: 2 }}>
        {t.status === 'Stuck-Delayed' && t.stuck && <Alert severity="error" sx={{ mb: 2 }}>Stuck-Delayed since {t.stuck.since.replace('T', ' ')}: {t.stuck.reason}. Responsible: {t.stuck.responsible}.</Alert>}
        <Panel title="Trip Details" change="new" req={R.trip}>
          <ValueGrid cols={4}>
            <ValueField label="Trip No." value={t.number} /><ValueField label="Kind" value={t.kind} /><ValueField label="Date" value={t.date.replace('T', ' ')} /><ValueField label="Status" value={<StatusChip status={t.status} />} />
            <ValueField label="Document" value={<><Link to={docPath(t)} style={RL}>{t.docNumber}</Link>{t.alsoDoc && <> and <Link to={`/crm/customer-returns/${t.alsoDoc.id}`} style={RL}>{t.alsoDoc.number}</Link> (collection)</>}</>} /><ValueField label="Sales Order" value={<Link to={`/crm/sales-orders/${t.soId}`} style={RL}>{t.soNumber}</Link>} />
            <ValueField label="Customer" value={custName(t.customerId)} /><ValueField label="Site" value={t.site || '-'} />
            <ValueField label="Project / Cost Centre" value={t.costCentre || '-'} /><ValueField label="Transport" value={t.transport} />
            {own ? (
              <>
                <ValueField label="Vehicle" value={vehicle ? <Link to={`${HEAVY}/${vehicle.id}`} style={RL}>{vehicleLabel(vehicle)}</Link> : t.plate ?? '-'} />
                <ValueField label="Driver" value={t.driver || '-'} /><ValueField label="Mobile" value={t.mobile || '-'} />
              </>
            ) : <><ValueField label="Transported By" value={t.transporter || '-'} /><ValueField label="Driver Name" change="new" req="Fleet review 8 Oct: the external transporter's driver was not captured" value={t.transporterDriver || '-'} /><ValueField label="Transporter Bill" change="new" req="Instruction 6 Oct (accounting POC): each external transporter charge becomes a Pending bill to the transporter" value={(() => { const bs = billsOfSource('Trip', t.id); return bs.length ? <>{bs.map((b, n) => <span key={b.id}>{n > 0 && ', '}<Link to={`/accounting/bills/${b.id}`} style={RL}>{b.number} ({b.approval})</Link></span>)}</> : t.status === 'Completed' ? 'No transport charge' : 'Raised when the trip is completed'; })()} /></>}
            <ValueField label="In Status Since" value={sinceLabel(t.since)} /><ValueField label="Total Expenses" value={aed(tripTotal(t))} />
          </ValueGrid>
        </Panel>
        <Panel title="Expenses" change="new" req={R.trip} sx={{ mt: 2 }} right={items.some((i) => i.label === 'Add Expense') && <Button size="small" variant="outlined" onClick={() => items.find((i) => i.label === 'Add Expense')?.onClick()}>Add Expense</Button>}>
          <DataTable hideToolbar rows={t.expenses.map((e, i) => ({ id: String(i), i, ...e }))} emptyText="No expenses yet. Add Salik, fuel or the transporter's charge; each one is added to the Sales Order logistics cost"
            actions={t.status === 'Cancelled' ? undefined : [{ label: 'Remove', danger: true, onClick: (r) => removeTripExpense(t, r.i) }]}
            columns={[{ key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => aed(r.amount) },
              { key: 'vatPct', label: 'VAT %', change: 'new', req: R.trip, align: 'right', render: (r) => (r.vatPct ? `${r.vatPct}%` : '-') },
              { key: 'account', label: 'Expense Head', change: 'new', req: R.trip, render: (r) => (r.account ? accLabel(r.account) : '-') },
              { key: 'date', label: 'Date' }, { key: 'note', label: 'Note', render: (r) => r.note ?? '-' },
              { key: 'acc', label: 'Accounting', change: 'new', req: 'Fleet review 7 Oct: trip costs reach the ledger. Own-fleet costs post a journal, an external Transport Charge becomes a bill', sortable: false, render: (r) => (r.billId ? <Link to={`/accounting/bills/${r.billId}`} style={RL}>Bill to transporter</Link> : r.journalId ? <Link to={`/accounting/journals/${r.journalId}`} style={RL}>Posted to ledger</Link> : <Text type="s5" color="theme.secondary.700">{t.transport === 'External Transporter' && r.type === 'Transport Charge' ? 'Billed when the trip is completed' : '-'}</Text>) }]} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Total {aed(tripTotal(t))}. Every expense is part of the logistics cost of {t.soNumber}. Own-fleet costs post to the ledger (Dr expense, Cr Accrued Trip Expenses) on the order's cost centre; an external Transport Charge is billed to the transporter. Neither is invoiced to the customer; the customer pays only the Delivery and Return Charge lines quoted on the order.</Text>
        </Panel>
        <Panel title="Log" sx={{ mt: 2 }}><Timeline items={[...t.log].reverse()} /></Panel>
      </Page>
      {menu.dialogs}
    </>
  );
}

/* ------------------------------------------------------------------ embedded lists (Heavy Equipment asset view, Sales Order, Delivery Order, Return) */
export function TripsTable({ rows, empty = 'No trips yet', hideVehicle }: { rows: Trip[]; empty?: string; hideVehicle?: boolean }) {
  const nav = useNavigate();
  const data = [...rows].sort((a, b) => b.date.localeCompare(a.date)).map((t) => ({ ...t, vehicleOrTransporter: tripVehicle(t), customer: custName(t.customerId), total: tripTotal(t) }));
  return (
    <DataTable hideToolbar rows={data} emptyText={empty} onRowClick={(r) => nav(`/crm/trips/${r.id}`)}
      columns={[
        { key: 'number', label: 'Trip No.' }, { key: 'date', label: 'Date', render: (r) => r.date.replace('T', ' ') }, { key: 'kind', label: 'Kind' }, { key: 'docNumber', label: 'Document', render: (r) => docText(r) },
        { key: 'customer', label: 'Customer' }, { key: 'site', label: 'Site' },
        ...(hideVehicle ? [] : [{ key: 'vehicleOrTransporter', label: 'Vehicle / Transporter' }]),
        { key: 'driver', label: 'Driver', render: (r) => r.driver ?? '-' }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }, { key: 'total', label: 'Total Expenses', align: 'right', render: (r) => aed(r.total) },
      ]} />
  );
}
export function VehicleTrips({ vehicleId }: { vehicleId: string }) {
  const trips = useTrips();
  return <TripsTable rows={trips.rows.filter((t) => t.vehicleId === vehicleId)} empty="This vehicle has no trips yet" hideVehicle />;
}
