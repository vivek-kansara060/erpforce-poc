import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Autocomplete, Box, Button, FormControlLabel, IconButton, MenuItem, Select, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { neutral } from '@/theme/color';
import { ChangeTag } from '@/components/ChangeTag';
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
import { FLEET_STATUSES, TODAY, TRIP_STATUSES, assetById, custName, deliveryVehicles, fleetSettingsSeed, fleetStatus, isOpenTrip, nextBookingOf, openTripOf, tripTotal, vehicleFreeOn, type Delivery, type FleetSettings, type FleetStatus, type HeavyRec, type Trip, type TripExpense } from '@/modules/crm/data';
import { addTripExpense, arrangeDeliveryTransport, cancelTrip, completeTrip, getTrip, markStuck, reassignTrip, removeTripExpense, resumeTrip, startTrip, switchToExternal, updateTripExpense, vehicleIsFree } from '@/modules/crm/flow';
import { R, RowMenu, aed, useFleet, useTrips, type RowMenuItem } from '@/modules/crm/shared';
import { currentLocation } from '@/modules/inventory/data';
import { accLabel, expenseAccountFor, expenseAccounts, tripExpenseAccount } from '@/modules/accounting/data';
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
/** Fleet Management settings (client review 8 Oct): is the detailed driver trip workflow on? Off: the Delivery Order's own Dispatched / Delivered actions drive the trip instead. */
export const useFleetSettings = () => useCollection<FleetSettings>(FLEET_SETTINGS_COL, fleetSettingsSeed);
export const driverAppOf = (s: ReturnType<typeof useFleetSettings>) => s.get('settings')?.driverAppEnabled ?? true;
/** The status-driven actions of a trip, and the dialogs they open. With the driver app off, the Assigned -> En Route -> Stuck-Delayed -> Completed actions are
 * skipped (the Delivery Order drives those transitions instead); Add Expense and Cancel Trip stay available either way. */
export function useTripMenu() {
  const [dlg, setDlg] = useState<{ kind: DlgKind; id: string } | null>(null);
  const toast = useToast();
  const navTo = useNavigate();
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
    if (t.status === 'En Route' || t.status === 'Stuck-Delayed' || t.status === 'Completed') m.push({ label: 'Add Expense', onClick: () => navTo(`/crm/trips/${t.id}?addExpense=${Date.now()}`) });
    if (isOpenTrip(t)) m.push({ label: 'Cancel Trip', danger: true, onClick: () => open('cancel', t) });
    return m;
  };
  const trip = dlg ? getTrip(dlg.id) : undefined;
  const close = () => setDlg(null);
  const dialogs = trip && dlg ? (
    <>
      {dlg.kind === 'stuck' && <StuckDialog trip={trip} onClose={close} />}
      {dlg.kind === 'complete' && <CompleteTripDialog trip={trip} onClose={close} />}
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
/* ------------------------------------------------------------------ expense lines: inline table (client feedback 12 Oct) */
/** Expense Account options: the expense accounts of the Chart of Accounts. Nothing is preselected, the user picks the account on every line. */
const expenseAccOptions = expenseAccounts.map((a) => `${a.code} ${a.name}`);
const accText = (code: string) => expenseAccOptions.find((a) => a.startsWith(code)) ?? code;
const accCode = (label: string) => label.slice(0, 6);
const R_EXP = 'Client feedback 12 Oct: expenses are edited inline in the table as in the existing ERP, no Expense Type, the Expense Account is chosen on every line';
type ExpenseDraft = { account: string; amount: string; vatPct: string; note: string };
const blankDraft = (): ExpenseDraft => ({ account: '', amount: '', vatPct: '5', note: '' });
export type ExpenseInput = Omit<TripExpense, 'date'> & { account: string };
const cellSx = { px: 1, py: 0.5, fontSize: 13 } as const;

/**
 * The existing ERP inline table (material-editable-table): a click on a row edits it in place, the tick saves and the cross (or Esc) cancels,
 * the bin deletes, Add opens an empty row at the bottom and, once it is saved, the next empty row opens.
 */
export function ExpenseTable<T extends { account?: string; type?: string; amount: number; vatPct?: number; note?: string; date?: string }>({ rows, onAdd, onUpdate, onRemove, locked, rowLocked, accounting, autoAdd, onAutoAddDone, empty = 'No expenses yet', noteLabel = 'Note', hideDate }: {
  rows: T[]; onAdd: (e: ExpenseInput) => void; onUpdate?: (idx: number, e: ExpenseInput) => void; onRemove?: (idx: number) => void; locked?: boolean;
  /** A line that can no longer change, for example one already carried into a bill */
  rowLocked?: (e: T, idx: number) => boolean;
  accounting?: (e: T) => ReactNode; autoAdd?: boolean; onAutoAddDone?: () => void; empty?: string; noteLabel?: string; hideDate?: boolean;
}) {
  const [edit, setEdit] = useState<{ idx: number; v: ExpenseDraft; tried: boolean } | null>(null);
  useEffect(() => { if (autoAdd && !locked) { setEdit({ idx: -1, v: blankDraft(), tried: false }); onAutoAddDone?.(); } }, [autoAdd, locked]);
  const set = (p: Partial<ExpenseDraft>) => setEdit((x) => (x ? { ...x, v: { ...x.v, ...p } } : x));
  const startEdit = (i: number) => {
    if (locked || edit || !onUpdate || rowLocked?.(rows[i], i)) return;
    const r = rows[i];
    setEdit({ idx: i, v: { account: r.account ? accText(expenseAccountFor(r.account)) : '', amount: String(r.amount), vatPct: String(r.vatPct ?? 0), note: r.note ?? '' }, tried: false });
  };
  const save = () => {
    if (!edit) return;
    const { v } = edit;
    if (!v.account || !(Number(v.amount) > 0)) { setEdit({ ...edit, tried: true }); return; }
    const e: ExpenseInput = { account: accCode(v.account), amount: Number(v.amount), vatPct: Number(v.vatPct) || 0, note: v.note.trim() || undefined };
    if (edit.idx < 0) { onAdd(e); setEdit({ idx: -1, v: blankDraft(), tried: false }); } else { onUpdate?.(edit.idx, e); setEdit(null); }
  };
  const keys = (ev: React.KeyboardEvent) => { if (ev.key === 'Escape') setEdit(null); if (ev.key === 'Enter' && !(ev.target as HTMLElement).closest('.MuiAutocomplete-root')) save(); };
  const bad = !!edit?.tried;
  const cols = ['S.No', 'Expense Account', 'Amount (AED)', 'VAT %', noteLabel, ...(hideDate ? [] : ['Date']), ...(accounting ? ['Accounting'] : [])];
  const editRow = (i: number, date: string) => (
    <TableRow key={`e${i}`} onKeyDown={keys} sx={{ bgcolor: '#FAFBFC' }}>
      <TableCell sx={cellSx}>{i < 0 ? rows.length + 1 : i + 1}</TableCell>
      <TableCell sx={{ ...cellSx, minWidth: 260 }}>
        <Autocomplete size="small" options={expenseAccOptions} value={edit!.v.account || null} onChange={(_, v) => set({ account: v ?? '' })} autoHighlight openOnFocus
          renderInput={(p) => <TextField {...p} autoFocus placeholder="Select" error={bad && !edit!.v.account} />} />
      </TableCell>
      <TableCell sx={{ ...cellSx, width: 140 }}><TextField size="small" type="number" value={edit!.v.amount} onChange={(e) => set({ amount: e.target.value })} error={bad && !(Number(edit!.v.amount) > 0)} inputProps={{ min: 0, step: 'any' }} /></TableCell>
      <TableCell sx={{ ...cellSx, width: 90 }}><Select size="small" value={edit!.v.vatPct} onChange={(e) => set({ vatPct: String(e.target.value) })} sx={{ fontSize: 13 }}>{['5', '0'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select></TableCell>
      <TableCell sx={{ ...cellSx, minWidth: 180 }}><TextField size="small" fullWidth value={edit!.v.note} onChange={(e) => set({ note: e.target.value })} /></TableCell>
      {!hideDate && <TableCell sx={cellSx}>{date}</TableCell>}
      {accounting && <TableCell sx={cellSx} />}
      <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
        <Tooltip title="Save"><IconButton size="small" onClick={save}><CheckIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Cancel (Esc)"><IconButton size="small" onClick={() => setEdit(null)}><CloseIcon fontSize="small" /></IconButton></Tooltip>
      </TableCell>
    </TableRow>
  );
  return (
    <Box>
      <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
        <Table size="small">
          <TableHead><TableRow sx={{ bgcolor: neutral[100] }}>{cols.map((c) => <TableCell key={c} sx={{ ...cellSx, fontWeight: 500, whiteSpace: 'nowrap' }}>{c}{c === 'Expense Account' && <ChangeTag kind="changed" req={R_EXP} />}</TableCell>)}<TableCell sx={{ ...cellSx, width: 80 }} /></TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && edit?.idx !== -1 && <TableRow><TableCell colSpan={cols.length + 1} sx={cellSx}><Text type="s4" color="theme.secondary.700">{empty}</Text></TableCell></TableRow>}
            {rows.map((r, i) => (edit?.idx === i ? editRow(i, r.date ?? '-') : (
              <TableRow key={i} hover onClick={() => startEdit(i)} sx={{ cursor: !locked && !edit && onUpdate && !rowLocked?.(r, i) ? 'pointer' : 'default' }}>
                <TableCell sx={cellSx}>{i + 1}</TableCell>
                <TableCell sx={cellSx}>{r.account ? accLabel(expenseAccountFor(r.account)) : accLabel(tripExpenseAccount(r.type))}</TableCell>
                <TableCell sx={cellSx}>{aed(r.amount)}</TableCell>
                <TableCell sx={cellSx}>{r.vatPct ? `${r.vatPct}%` : '-'}</TableCell>
                <TableCell sx={cellSx}>{r.note || '-'}</TableCell>
                {!hideDate && <TableCell sx={cellSx}>{r.date || '-'}</TableCell>}
                {accounting && <TableCell sx={cellSx} onClick={(e) => e.stopPropagation()}>{accounting(r)}</TableCell>}
                <TableCell sx={cellSx} onClick={(e) => e.stopPropagation()}>
                  {!locked && onRemove && !rowLocked?.(r, i) && <Tooltip title="Delete"><span><IconButton size="small" disabled={!!edit} onClick={() => onRemove(i)}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>}
                </TableCell>
              </TableRow>
            )))}
            {edit?.idx === -1 && editRow(-1, TODAY)}
          </TableBody>
        </Table>
      </TableContainer>
      {bad && <Text type="s5" color="#C64D4D" sx={{ mt: 0.5 }}>Select the Expense Account and enter an amount above 0</Text>}
      {!locked && <Button size="small" variant="outlined" startIcon={<AddIcon />} sx={{ mt: 1 }} disabled={!!edit} onClick={() => setEdit({ idx: -1, v: blankDraft(), tried: false })}>Add</Button>}
    </Box>
  );
}

function CompleteTripDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<TripExpense[]>([]);
  return (
    <AppDialog open title="Complete Trip" onClose={onClose} maxWidth="lg" confirmLabel="Complete Trip" onConfirm={() => { completeTrip(trip, lines); toast(`${trip.number} completed, the vehicle is Free${lines.length ? `. AED ${lines.reduce((s, x) => s + x.amount, 0)} added to ${trip.soNumber}` : ''}`); onClose(); }}>
      <TripSummary trip={trip} />
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>Enter the costs of this trip (Salik, fuel and so on). They are added to the Sales Order logistics cost{trip.transport === 'External Transporter' ? ' and billed to the transporter' : ''}. Leave empty if there are none; expenses can also be added later on the trip.</Text>
      <ExpenseTable rows={lines} onAdd={(e) => setLines((x) => [...x, { ...e, date: TODAY }])} onUpdate={(i, e) => setLines((x) => x.map((y, k) => (k === i ? { ...e, date: y.date } : y)))} onRemove={(i) => setLines((x) => x.filter((_, k) => k !== i))} empty="No expenses. Use Add to enter one" />
    </AppDialog>
  );
}
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
  const [sp, setSp] = useSearchParams();
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
        <Panel title="Expenses" change="changed" req={R_EXP} sx={{ mt: 2 }}>
          <ExpenseTable rows={t.expenses} locked={t.status === 'Cancelled' || t.status === 'Assigned'} autoAdd={!!sp.get('addExpense')} onAutoAddDone={() => setSp({}, { replace: true })}
            onAdd={(e) => addTripExpense(getTrip(t.id) ?? t, e)} onUpdate={(i, e) => updateTripExpense(getTrip(t.id) ?? t, i, e)} onRemove={(i) => removeTripExpense(getTrip(t.id) ?? t, i)}
            empty={t.status === 'Assigned' ? 'Expenses can be added once the trip has started' : "No expenses yet. Use Add for Salik, fuel or the transporter's charge; each one is added to the Sales Order logistics cost"}
            accounting={(r) => (r.billId ? <Link to={`/accounting/bills/${r.billId}`} style={RL}>Bill to transporter</Link> : r.journalId ? <Link to={`/accounting/journals/${r.journalId}`} style={RL}>Posted to ledger</Link> : <Text type="s5" color="theme.secondary.700">{t.transport === 'External Transporter' ? 'Billed to the transporter when the trip is completed' : '-'}</Text>)} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Total {aed(tripTotal(t))}. Every expense is part of the logistics cost of {t.soNumber}. Own-fleet costs post to the ledger (Dr expense, Cr Accrued Trip Expenses) on the order's cost centre; on an external transporter's trip every expense line is billed to the transporter. Neither is invoiced to the customer; the customer pays only the Delivery and Return Charge lines quoted on the order.</Text>
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
