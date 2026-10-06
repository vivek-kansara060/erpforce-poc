import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Select } from '@mui/material';
import dayjs from 'dayjs';
import { employees, suppliers } from '@/mock-data/masters';
import { DataTable } from '@/components/DataTable';
import { AppDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FormGrid, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { FLEET_STATUSES, TRIP_STATUSES, assetById, custName, deliveryVehicles, fleetStatus, isOpenTrip, tripTotal, type FleetStatus, type HeavyRec, type Trip } from '@/modules/crm/data';
import { addTripExpense, cancelTrip, completeTrip, getTrip, markStuck, reassignTrip, removeTripExpense, resumeTrip, startTrip, switchToExternal, vehicleIsFree } from '@/modules/crm/flow';
import { MasterSelect, R, RowMenu, aed, useFleet, useTrips, type RowMenuItem } from '@/modules/crm/shared';
import { currentLocation } from '@/modules/inventory/data';

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
const docPath = (t: Trip) => (t.kind === 'Delivery' ? `/crm/delivery-orders/${t.docId}` : t.kind === 'Collection' ? `/crm/customer-returns/${t.docId}` : '/rental/replacements');
const RL = { color: '#0A6C3D', textDecoration: 'none', fontWeight: 500 } as const;

/* ------------------------------------------------------------------ trip actions (shared by the board row menu and the trip page) */
type DlgKind = 'stuck' | 'complete' | 'expense' | 'reassign' | 'external' | 'cancel';
type ExpenseLine = { type: string; amount: string; note: string };

/** The status-driven actions of a trip, and the dialogs they open. */
export function useTripMenu() {
  const [dlg, setDlg] = useState<{ kind: DlgKind; id: string } | null>(null);
  const toast = useToast();
  const open = (kind: DlgKind, t: Trip) => setDlg({ kind, id: t.id });
  const items = (t: Trip): RowMenuItem[] => {
    const own = t.transport === 'Own Fleet';
    const m: RowMenuItem[] = [];
    if (t.status === 'Assigned') {
      m.push({ label: 'Start Trip', onClick: () => { startTrip(t); toast(`${t.number} started, the vehicle is En Route`); } });
      if (own) m.push({ label: 'Reassign Vehicle / Driver', onClick: () => open('reassign', t) }, { label: 'Switch to External Transporter', onClick: () => open('external', t) });
    }
    if (t.status === 'En Route') m.push({ label: 'Mark Stuck-Delayed', onClick: () => open('stuck', t) });
    if (t.status === 'Stuck-Delayed') m.push({ label: 'Resume (En Route)', onClick: () => { resumeTrip(t); toast(`${t.number} resumed`); } });
    if (t.status === 'En Route' || t.status === 'Stuck-Delayed') m.push({ label: 'Complete Trip', onClick: () => open('complete', t) });
    if (t.status === 'En Route' || t.status === 'Stuck-Delayed') m.push({ label: 'Add Expense', onClick: () => open('expense', t) });
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
      <Text type="s4" weight="medium">{trip.number} ({trip.kind}) for {trip.docNumber}</Text>
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
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {lines.map((l, i) => (
        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.4fr auto', gap: 1.5, alignItems: 'end' }}>
          <MasterSelect master="tripExpenseTypes" label="Expense Type" required change="new" req={R.trip} value={l.type} onChange={(v) => set(i, { type: v })} />
          <NumberInput label="Amount (AED)" required value={l.amount} onChange={(v) => set(i, { amount: v })} />
          <TextInput label="Note" value={l.note} onChange={(v) => set(i, { note: v })} />
          <Button size="small" color="error" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, n) => n !== i))} sx={{ mb: 0.5 }}>Remove</Button>
        </Box>
      ))}
      <Box><Button size="small" variant="outlined" onClick={() => onChange([...lines, { type: '', amount: '', note: '' }])}>Add expense line</Button></Box>
    </Box>
  );
}
const toExpenses = (lines: ExpenseLine[]) => lines.filter((l) => l.type && Number(l.amount) > 0).map((l) => ({ type: l.type, amount: Number(l.amount), note: l.note.trim() || undefined }));
function CompleteTripDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<ExpenseLine[]>([{ type: '', amount: '', note: '' }]);
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
  const [lines, setLines] = useState<ExpenseLine[]>([{ type: '', amount: '', note: '' }]);
  const ok = toExpenses(lines);
  return (
    <AppDialog open title="Add Expense" onClose={onClose} maxWidth="md" confirmLabel="Add" confirmDisabled={!ok.length || ok.length !== lines.length} onConfirm={() => { ok.forEach((e) => addTripExpense(getTrip(trip.id) ?? trip, e)); toast(`AED ${ok.reduce((s, x) => s + x.amount, 0)} added to ${trip.soNumber}`); onClose(); }}>
      <TripSummary trip={trip} />
      <ExpenseLines lines={lines} onChange={setLines} />
    </AppDialog>
  );
}
/** Reassign vehicle / driver while Assigned. Only Free vehicles (and the trip's own) are offered. */
function VehicleDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const fleet = useFleet();
  const options = deliveryVehicles(fleet.rows).filter((a) => a.id === trip.vehicleId || vehicleIsFree(a.id, trip.id));
  const [vid, setVid] = useState(trip.vehicleId ?? '');
  const [driver, setDriver] = useState(trip.driver ?? '');
  const pick = (id: string) => { setVid(id); const d = assetById(id)?.defaultDriver ?? ''; setDriver(d); };
  return (
    <AppDialog open title="Reassign Vehicle / Driver" onClose={onClose} confirmLabel="Save" confirmDisabled={!vid} onConfirm={() => { reassignTrip(trip, vid, driver, mobileOf(driver)); toast(`${trip.number} reassigned`); onClose(); }}>
      <TripSummary trip={trip} />
      <FormGrid cols={1}>
        <SelectInput label="Vehicle (Free only)" required value={vid} options={options.map((a) => ({ value: a.id, label: vehicleLabel(a) }))} onChange={pick} error={options.length === 0 ? 'No vehicle is Free' : undefined} />
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
  return (
    <AppDialog open title="Switch to External Transporter" onClose={onClose} confirmLabel="Switch" confirmDisabled={!by || !(Number(cost) > 0)} onConfirm={() => { switchToExternal(trip, by, Number(cost)); toast(`${trip.number} moved to ${by}, the own vehicle is Free`); onClose(); }}>
      <TripSummary trip={trip} />
      <FormGrid cols={1}>
        <SelectInput label="Transported By" required value={by} options={transporterOptions()} onChange={setBy} hint="The supplier who transports, so the cost is paid back to them against the project" />
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
      <TextInput label="Reason" required value={reason} onChange={setReason} multiline rows={2} />
    </AppDialog>
  );
}

/* ------------------------------------------------------------------ Fleet Availability */
interface BoardRow {
  id: string; plate: string; name: string; type: string; driver: string; status: FleetStatus; trip?: Trip; since: string; location: string; asset: HeavyRec;
}
const useBoardRows = (): BoardRow[] => {
  const fleet = useFleet();
  const trips = useTrips();
  return deliveryVehicles(fleet.rows).map((a): BoardRow => {
    const status = fleetStatus(a, trips.rows);
    const trip = trips.rows.find((t) => t.vehicleId === a.id && isOpenTrip(t));
    return { id: a.id, plate: a.plateNumber ?? '-', name: a.name, type: a.subCategory, driver: trip?.driver ?? a.defaultDriver ?? '-', status, trip, since: trip ? sinceLabel(trip.since) : '-', location: currentLocation(a), asset: a };
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
  const rows = useBoardRows();
  const menu = useTripMenu();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);
  const view = rows.filter((r) => (!type || r.type === type) && (!status || r.status === status));
  const count = (s: FleetStatus) => rows.filter((r) => (!type || r.type === type) && r.status === s).length;
  return (
    <Page>
      <PageTitle title="Fleet Availability" subtitle="Own delivery vehicles and what they are doing now. Pick a Free vehicle for a delivery, collection or replacement" change="new" req={R.fleet} />
      <KpiRow>
        {FLEET_STATUSES.map((s) => (
          <KpiCard key={s} title={s} value={count(s)} tint={status === s ? '#B6E9D6' : undefined} sub={status === s ? 'Filtered, click to clear' : 'Click to filter'} onClick={() => setStatus(status === s ? '' : s)} />
        ))}
      </KpiRow>
      <DataTable<BoardRow> rows={view} searchPlaceholder="Search plate, vehicle or driver..." toolbarRight={<FleetFilters types={types} type={type} setType={setType} status={status} setStatus={setStatus} />}
        emptyText={rows.length ? 'No vehicle matches the filters' : 'No delivery vehicles yet. Tick Delivery fleet vehicle on a Heavy Equipment Fixed Asset'}
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
          { key: 'since', label: 'In Status Since', sortable: false },
          { key: 'location', label: 'Location' },
          { key: 'menu', label: '', sortable: false, width: 48, render: (r) => <span onClick={(e) => e.stopPropagation()}><RowMenu items={r.trip ? menu.items(r.trip) : [{ label: 'View Asset', onClick: () => nav(`${HEAVY}/${r.id}`) }, { label: 'View Trips', onClick: () => nav(`${HEAVY}/${r.id}`, { state: { tab: 'Trips' } }) }]} /></span> },
        ]} />
      {menu.dialogs}
    </Page>
  );
}

/** Used inside a dialog by the Delivery Order, Return and Replacement: only Free vehicles, a Select button per row. */
export function FleetPickerDialog({ open, onClose, onPick, onExternal }: { open: boolean; onClose: () => void; onPick: (a: HeavyRec) => void; onExternal?: () => void }) {
  const rows = useBoardRows();
  const [type, setType] = useState('');
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);
  const free = rows.filter((r) => r.status === 'Free' && (!type || r.type === type));
  return (
    <AppDialog open={open} title="Select from fleet" onClose={onClose} maxWidth="lg">
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Only Free vehicles are listed. {rows.filter((r) => r.status === 'Free').length} of {rows.length} delivery vehicles are Free.</Text>
      {rows.filter((r) => r.status === 'Free').length === 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }} action={onExternal && <Button size="small" color="inherit" onClick={() => { onClose(); onExternal(); }}>Use External Transporter</Button>}>No vehicle is Free right now. Wait for one to be released, or use an external transporter.</Alert>
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
export function validateTransport(v: TransportValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.transport === 'Own Fleet') {
    if (!v.vehicleId) e.vehicleId = 'Select a Free vehicle from the fleet';
    else if (!vehicleIsFree(v.vehicleId)) e.vehicleId = 'This vehicle is no longer Free. Select another';
  } else {
    if (!v.transporter.trim()) e.transporter = 'Select the supplier who transports';
    if (!Number(v.charge)) e.charge = 'External Transport Cost is required for an external transporter';
  }
  return e;
}
/** Own Fleet: pick a Free vehicle from Fleet Availability and the driver and mobile fill in. External Transporter: the supplier and its cost. */
export function TransportSection({ value, onChange, errors = {}, hint }: { value: TransportValue; onChange: (v: TransportValue) => void; errors?: Record<string, string>; hint?: ReactNode }) {
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
              <TextInput label="Vehicle" required change="new" req={R.fleet} value={v ? vehicleLabel(v) : ''} disabled error={errors.vehicleId} placeholder="No vehicle selected" hint="Picked from Fleet Availability, Free vehicles only" />
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
      <FleetPickerDialog open={picker} onClose={() => setPicker(false)} onExternal={() => set({ transport: 'External Transporter', vehicleId: '', driver: '', mobile: '' })}
        onPick={(a) => { const d = a.defaultDriver ?? ''; setSwap(false); set({ vehicleId: a.id, driver: d, mobile: mobileOf(d) }); }} />
    </>
  );
}
/** What a document passes to createTrip / raiseReturn / replaceAsset. */
export const toTransportInput = (v: TransportValue) => ({
  transport: v.transport as Trip['transport'], vehicleId: v.vehicleId || undefined, driver: v.driver || undefined, mobile: v.mobile || undefined, transporter: v.transporter || undefined, charge: Number(v.charge) || undefined,
});

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
          { key: 'docNumber', label: 'Document', render: (r) => <Link to={docPath(r)} style={RL} onClick={(e) => e.stopPropagation()}>{r.docNumber}</Link> },
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
            <ValueField label="Document" value={<Link to={docPath(t)} style={RL}>{t.docNumber}</Link>} /><ValueField label="Sales Order" value={<Link to={`/crm/sales-orders/${t.soId}`} style={RL}>{t.soNumber}</Link>} />
            <ValueField label="Customer" value={custName(t.customerId)} /><ValueField label="Site" value={t.site || '-'} />
            <ValueField label="Project / Cost Centre" value={t.costCentre || '-'} /><ValueField label="Transport" value={t.transport} />
            {own ? (
              <>
                <ValueField label="Vehicle" value={vehicle ? <Link to={`${HEAVY}/${vehicle.id}`} style={RL}>{vehicleLabel(vehicle)}</Link> : t.plate ?? '-'} />
                <ValueField label="Driver" value={t.driver || '-'} /><ValueField label="Mobile" value={t.mobile || '-'} />
              </>
            ) : <ValueField label="Transported By" value={t.transporter || '-'} />}
            <ValueField label="In Status Since" value={sinceLabel(t.since)} /><ValueField label="Total Expenses" value={aed(tripTotal(t))} />
          </ValueGrid>
        </Panel>
        <Panel title="Expenses" change="new" req={R.trip} sx={{ mt: 2 }} right={items.some((i) => i.label === 'Add Expense') && <Button size="small" variant="outlined" onClick={() => items.find((i) => i.label === 'Add Expense')?.onClick()}>Add Expense</Button>}>
          <DataTable hideToolbar rows={t.expenses.map((e, i) => ({ id: String(i), i, ...e }))} emptyText="No expenses yet. Add Salik, fuel or the transporter's charge; each one is added to the Sales Order logistics cost"
            actions={t.status === 'Cancelled' ? undefined : [{ label: 'Remove', danger: true, onClick: (r) => removeTripExpense(t, r.i) }]}
            columns={[{ key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => aed(r.amount) }, { key: 'date', label: 'Date' }, { key: 'note', label: 'Note', render: (r) => r.note ?? '-' }]} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Total {aed(tripTotal(t))}. Every expense is part of the logistics cost of {t.soNumber}.</Text>
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
        { key: 'number', label: 'Trip No.' }, { key: 'date', label: 'Date', render: (r) => r.date.replace('T', ' ') }, { key: 'kind', label: 'Kind' }, { key: 'docNumber', label: 'Document' },
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
