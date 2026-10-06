import { useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Box, Button, FormControlLabel, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { customers as customerSeed, employees, fmtNum } from '@/mock-data/masters';
import {
  ASSET_RESULTS, CERT_TYPES, COUNT_TYPES, DISPOSAL_METHODS, DISPOSAL_REASONS, NOW, READING_FREQUENCY_DAYS, READING_METHODS, TODAY, certSeed, settingsSeed, countSeed, currentLocation, disposalSeed, heavySeed, itemSeed, locationSeed, locationStockSeed, qtyWithUnit, readingSeed,
  type AssetCountLine, type CertRec, type InventorySettings, type CountSession, type CountType, type DisposalOutcome, type DisposalRec, type HeavyRec, type ItemRec, type LocationRec, type LocationStock, type ReadingRec,
} from './data';
import { FileList, aed, isBlank, num, requireFields, type Errors, CertTypeSelect } from './shared';
import dayjs from 'dayjs';

const REQ_CERT = 'Compliance & Certificates (Asset-Level)';
const REQ_CERT_ASSET = 'Compliance & Certificates (2 Oct call: on the individual asset, many per asset, optional approval)';
const REQ_USE = 'Manual Usage & Status Recording';
const REQ_USE_ASSET = 'Manual Usage & Status Recording (2 Oct call: under the individual asset, optional, manual for now)';
const REQ_PSV = 'Physical Stock Verification';
const REQ_DSP = 'Asset Disposal / Write-Off';
const NOW_STAMP = `${TODAY} ${NOW.slice(11)}`;
const EMP = employees.map((e) => e.name);
const useHeavy = () => useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
const assetName = (rows: HeavyRec[], assetId: string) => rows.find((h) => h.assetId === assetId)?.name ?? '-';
const NotFound = ({ back, to }: { back: string; to: string }) => { const nav = useNavigate(); return <Page><PageTitle title="Record not found" right={<Button variant="outlined" onClick={() => nav(to)}>Back to {back}</Button>} /></Page>; };

/* ================================================================== Certificates */
export function certStatus(c: Pick<CertRec, 'expiry' | 'leadDays'>): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (c.expiry < TODAY) return { label: 'Expired', tone: 'red' };
  if (dayjs(c.expiry).diff(dayjs(TODAY), 'day') <= c.leadDays) return { label: 'Due Soon', tone: 'amber' };
  return { label: 'Valid', tone: 'green' };
}

/** Compliance & Certificates of one asset (2 Oct call: lives on the asset, many records per asset, optional approval). */
export function AssetCertificates({ assetId }: { assetId: string }) {
  const toast = useToast();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const settings = useCollection<InventorySettings>('inventory.settings', settingsSeed);
  const approvalOn = !!settings.get('settings')?.certApproval;
  const [dlg, setDlg] = useState<{ open: boolean; rec?: CertRec }>({ open: false });
  const [del, setDel] = useState<CertRec | null>(null);
  const rows = certs.rows.filter((c) => c.assetId === assetId);
  return (
    <Panel title="Compliance & Certificates" change="new" req={REQ_CERT_ASSET}
      right={<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControlLabel control={<Switch size="small" checked={approvalOn} onChange={(e) => { settings.update('settings', { certApproval: e.target.checked }); toast(e.target.checked ? 'Certificate approval switched on: new and edited certificates need approval' : 'Certificate approval switched off'); }} />}
          label={<Text type="s5" color="theme.secondary.800">Approval required (client setting)</Text>} />
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ open: true })}>Add Certificate</Button>
      </Box>}>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>One asset can carry any number of certificates (insurance, warranty, registration, inspection and others). Click a row to view or edit it.</Text>
      <DataTable<CertRec> hideToolbar rows={rows} pageSize={50} emptyText="No certificates yet" onRowClick={(r) => setDlg({ open: true, rec: r })}
        columns={[
          { key: 'type', label: 'Certificate / Document Type' },
          { key: 'reference', label: 'Reference', render: (r) => r.reference || '-' },
          { key: 'expiry', label: 'Expiry Date' },
          { key: 'leadDays', label: 'Reminder Lead Time', align: 'right', render: (r) => `${r.leadDays} days` },
          { key: 'file', label: 'Document', sortable: false, render: (r) => (r.file.length ? r.file.join(', ') : '-') },
          { key: 'status', label: 'Status', sortable: false, render: (r) => { const st = certStatus(r); return <StatusChip status={st.label} tone={st.tone} />; } },
          ...(approvalOn ? [{ key: 'approval', label: 'Approval', render: (r: CertRec) => <StatusChip status={r.approval ?? 'Approved'} /> }] : []),
        ]}
        actions={[
          { label: 'View / Edit', onClick: (r) => setDlg({ open: true, rec: r }) },
          { label: 'Approve', hidden: (r) => !approvalOn || r.approval !== 'Pending Approval', onClick: (r) => { certs.update(r.id, { approval: 'Approved', history: [{ when: NOW_STAMP, title: 'Approved', by: 'Current User' }, ...r.history] }); toast(`${r.type} certificate approved`); } },
          { label: 'Delete', danger: true, onClick: setDel },
        ]}
      />
      <CertificateDialog open={dlg.open} assetId={assetId} rec={dlg.rec} approvalOn={approvalOn} onClose={() => setDlg({ open: false })} />
      <ConfirmDialog open={!!del} danger title="Delete certificate" description={`Delete the ${del?.type} certificate (expiry ${del?.expiry})?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { certs.remove(del.id); toast('Certificate deleted'); } }} />
    </Panel>
  );
}

function CertificateDialog({ open, assetId, rec, approvalOn, onClose }: { open: boolean; assetId: string; rec?: CertRec; approvalOn: boolean; onClose: () => void }) {
  const toast = useToast();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const init = () => ({ type: rec?.type ?? '', reference: rec?.reference ?? '', expiry: rec?.expiry ?? '', leadDays: rec ? String(rec.leadDays) : '30', file: rec?.file ?? [] });
  const [f, setF] = useState<Record<string, any>>(init);
  const [errors, setErrors] = useState<Errors>({});
  const [key, setKey] = useState('');
  // Re-initialise the fields whenever the dialog opens for another record.
  const k = `${open}-${rec?.id ?? 'new'}`;
  if (k !== key) { setKey(k); setF(init()); setErrors({}); }
  const set = (n: string) => (v: any) => setF((x) => ({ ...x, [n]: v }));
  const save = () => {
    const e = requireFields(f, ['type', 'expiry', 'leadDays'], { type: 'Certificate / Document Type', expiry: 'Expiry Date', leadDays: 'Reminder Lead Time' });
    if (!e.leadDays && !(num(f.leadDays) > 0)) e.leadDays = 'Must be greater than 0';
    setErrors(e);
    if (Object.keys(e).length) return;
    const next: CertRec = { id: rec?.id ?? `ce${Date.now()}`, assetId, type: f.type, reference: f.reference.trim(), expiry: f.expiry, leadDays: Number(f.leadDays), file: f.file,
      approval: approvalOn ? 'Pending Approval' : rec?.approval,
      history: [{ when: NOW_STAMP, title: rec ? 'Certificate updated' : 'Certificate added', detail: rec ? `Expiry ${rec.expiry} to ${f.expiry}; reminder ${f.leadDays} days${approvalOn ? '; sent for approval' : ''}` : `${f.type} valid to ${f.expiry}${approvalOn ? '; sent for approval' : ''}`, by: 'Current User' }, ...(rec?.history ?? [])] };
    if (rec) certs.update(next.id, next); else certs.add(next);
    toast(rec ? 'Certificate updated' : 'Certificate added');
    onClose();
  };
  return (
    <AppDialog open={open} title={rec ? `Edit ${rec.type} Certificate` : 'Add Certificate'} onClose={onClose} onConfirm={save} confirmLabel={rec ? 'Save' : 'Add'} maxWidth="md">
      <FormGrid>
        <CertTypeSelect value={f.type} onChange={set('type')} error={errors.type} req={REQ_CERT} hint="Create New adds a new document type to the master" />
        <TextInput label="Reference / Policy Number" change="new" req={REQ_CERT} value={f.reference} onChange={set('reference')} />
        <DateInput label="Expiry Date" required change="new" req={REQ_CERT} value={f.expiry} onChange={set('expiry')} error={errors.expiry} />
        <NumberInput label="Reminder Lead Time (days before expiry)" required change="new" req={REQ_CERT} value={f.leadDays} onChange={set('leadDays')} error={errors.leadDays} hint="Configurable per certificate" />
        <FileInput label="Document" change="new" req={REQ_CERT} value={f.file} onChange={set('file')} multiple />
        {approvalOn && <Text type="s5" color="theme.secondary.700">Approval is switched on, so this certificate is saved as Pending Approval.</Text>}
      </FormGrid>
      {rec && rec.history.length > 0 && (
        <FormSection title="Edit History" change="new" req={REQ_CERT}>
          <Timeline items={rec.history.map((h) => ({ when: h.when, title: h.title, detail: h.detail, by: h.by, tone: 'blue' as const }))} />
        </FormSection>
      )}
    </AppDialog>
  );
}

/* ================================================================== Usage readings */
/** Usage readings of one asset (2 Oct call: kept under the asset, manual entry for now, optional). */
export function AssetReadings({ assetId }: { assetId: string }) {
  const toast = useToast();
  const readings = useCollection<ReadingRec>('inventory.readings', readingSeed);
  const [dlg, setDlg] = useState<{ open: boolean; rec?: ReadingRec }>({ open: false });
  const [del, setDel] = useState<ReadingRec | null>(null);
  const rows = readings.rows.filter((r) => r.assetId === assetId).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel title="Usage Readings" change="new" req={REQ_USE_ASSET}
      right={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ open: true })}>Add Reading</Button>}>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>Readings are optional and entered manually in this phase. The Reading Source field is kept so a future IoT or telematics feed can fill the same records. Reading frequency rule to be confirmed with client ({READING_FREQUENCY_DAYS} days assumed for the overdue report).</Text>
      <DataTable<ReadingRec> hideToolbar rows={rows} pageSize={50} emptyText="No readings recorded yet" onRowClick={(r) => setDlg({ open: true, rec: r })}
        columns={[
          { key: 'date', label: 'Reading Date/Time', render: (r) => r.date.replace('T', ' ') },
          { key: 'hmr', label: 'Hour Meter Reading', align: 'right', render: (r) => `${fmtNum(r.hmr)} hours` },
          { key: 'by', label: 'Recorded By' },
          { key: 'method', label: 'Entry Method', render: (r) => r.method || '-' },
          { key: 'fuel', label: 'Fuel Level', align: 'right', render: (r) => (r.fuel === undefined ? '-' : `${r.fuel}%`) },
          { key: 'notes', label: 'Condition Notes', render: (r) => r.notes || '-' },
          { key: 'source', label: 'Reading Source', sortable: false, render: () => 'Manual' },
        ]}
        actions={[{ label: 'Edit', onClick: (r) => setDlg({ open: true, rec: r }) }, { label: 'Delete', danger: true, onClick: setDel }]}
      />
      <ReadingDialog open={dlg.open} assetId={assetId} rec={dlg.rec} onClose={() => setDlg({ open: false })} />
      <ConfirmDialog open={!!del} danger title="Delete reading" description={`Delete the reading taken on ${del?.date.replace('T', ' ')}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { readings.remove(del.id); toast('Reading deleted'); } }} />
    </Panel>
  );
}

function ReadingDialog({ open, assetId, rec, onClose }: { open: boolean; assetId: string; rec?: ReadingRec; onClose: () => void }) {
  const toast = useToast();
  const readings = useCollection<ReadingRec>('inventory.readings', readingSeed);
  const init = () => ({ date: rec?.date ?? NOW, hmr: rec ? String(rec.hmr) : '', by: rec?.by ?? '', method: rec?.method ?? READING_METHODS[0], fuel: rec?.fuel === undefined ? '' : String(rec.fuel), notes: rec?.notes ?? '' });
  const [f, setF] = useState<Record<string, any>>(init);
  const [errors, setErrors] = useState<Errors>({});
  const [key, setKey] = useState('');
  const k = `${open}-${rec?.id ?? 'new'}`;
  if (k !== key) { setKey(k); setF(init()); setErrors({}); }
  const set = (n: string) => (v: any) => setF((x) => ({ ...x, [n]: v }));
  const save = () => {
    const e = requireFields(f, ['date', 'hmr', 'by'], { date: 'Reading Date/Time', hmr: 'Hour Meter Reading', by: 'Recorded By' });
    if (!e.hmr && num(f.hmr) < 0) e.hmr = 'Cannot be negative';
    if (!e.hmr && !e.date) {
      const prior = readings.rows.filter((r) => r.assetId === assetId && r.id !== rec?.id && r.date < f.date).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prior && num(f.hmr) < prior.hmr) e.hmr = `Cannot be lower than the previous reading (${fmtNum(prior.hmr)} on ${prior.date.slice(0, 10)})`;
    }
    if (!isBlank(f.fuel) && (num(f.fuel) < 0 || num(f.fuel) > 100)) e.fuel = 'Must be between 0 and 100';
    setErrors(e);
    if (Object.keys(e).length) return;
    const next: ReadingRec = { id: rec?.id ?? `rd${Date.now()}`, assetId, date: f.date, hmr: Number(f.hmr), by: f.by, method: f.method, fuel: isBlank(f.fuel) ? undefined : Number(f.fuel), notes: f.notes };
    if (rec) readings.update(next.id, next); else readings.add(next);
    toast(rec ? 'Reading updated' : 'Reading recorded');
    onClose();
  };
  return (
    <AppDialog open={open} title={rec ? 'Edit Usage Reading' : 'Add Usage Reading'} onClose={onClose} onConfirm={save} confirmLabel={rec ? 'Save' : 'Add'} maxWidth="md">
      <FormGrid>
        <DateInput label="Reading Date/Time" required change="new" req={REQ_USE} value={f.date} onChange={set('date')} error={errors.date} />
        <NumberInput label="Hour Meter Reading (hours)" required change="new" req={REQ_USE} value={f.hmr} onChange={set('hmr')} error={errors.hmr} />
        <SelectInput label="Recorded By" required change="new" req={REQ_USE} value={f.by} options={EMP} onChange={set('by')} error={errors.by} hint="Responsible role to be confirmed with client" />
        <SelectInput label="Entry Method" change="new" req={REQ_USE} value={f.method} options={READING_METHODS} onChange={set('method')} hint="Preferred method to be confirmed with client" />
        <NumberInput label="Fuel Level (%)" change="new" req={REQ_USE} value={f.fuel} onChange={set('fuel')} error={errors.fuel} />
        <TextInput label="Reading Source" change="new" req={REQ_USE} value="Manual" disabled hint="Reserved so a future IoT feed can use the same structure" />
        <TextInput label="Condition Notes" change="new" req={REQ_USE} value={f.notes} onChange={set('notes')} multiline rows={2} full />
      </FormGrid>
    </AppDialog>
  );
}

/* ================================================================== Physical stock verification */
const variance = (l: { systemQty: number; countedQty: number | null }) => (l.countedQty === null ? null : l.countedQty - l.systemQty);
const sessionVariances = (s: CountSession) => s.lines.filter((l) => variance(l) !== null && variance(l) !== 0);
const isAssetCount = (s: Pick<CountSession, 'type'>) => s.type === 'Fixed Assets';
const assetVariances = (s: CountSession) => (s.assetLines ?? []).filter((l) => l.result === 'Not Found');
const varianceCount = (s: CountSession) => (isAssetCount(s) ? assetVariances(s).length : sessionVariances(s).length);
const coveredCount = (s: CountSession) => (isAssetCount(s) ? (s.assetLines ?? []).length : s.lines.length);
const resultTone = (r: string | null) => (r === 'Found' ? 'green' : 'red') as 'green' | 'red';
const sessionBadge = (s: CountSession) => (s.status === 'In Progress' ? 'In Progress' : s.adjustmentStatus ?? (varianceCount(s) ? 'Variance' : 'No Variance'));
const signedQty = (v: number, unit: string) => `${v > 0 ? '+' : ''}${qtyWithUnit(v, unit)}`;
const REQ_PSV_ASSET = 'Physical Stock Verification > Fixed Assets count (2 Oct call: Found / Not Found only)';
const REQ_PSV_REASON = 'Physical Stock Verification > Reason (2 Oct call: one free-text reason for stock items; reason only for assets Not Found)';
const REQ_PSV_LIST = 'Physical Stock Verification (2 Oct call: filters, Select All, inactive assets excluded, no paging)';
const ASSET_COUNT_HINT = 'Counting individual fixed assets is not defined in the requirement document. Rule to be confirmed with client';
const inputStyle = { padding: '6px 8px', border: '1px solid #D3D3D4', borderRadius: 4, font: 'inherit', background: '#fff' } as const;
/** Lists in a count show every row at once: they are already limited to one location, so paging only gets in the way. */
const NoPaging = ({ children }: { children: React.ReactNode }) => <Box sx={{ '& .MuiPagination-root': { display: 'none' } }}>{children}</Box>;
const ALL_ROWS = 100000;

export function CountList() {
  const nav = useNavigate();
  const sessions = useCollection<CountSession>('inventory.counts', countSeed);
  return (
    <Page>
      <PageTitle title="Physical Stock Verification" change="new" req={REQ_PSV} subtitle="Count sessions can be started at any time, not only on a fixed schedule." />
      <DataTable<CountSession>
        rows={sessions.rows} searchPlaceholder="Search count sessions..." filter={{ key: 'status', options: ['In Progress', 'Completed'] }}
        onAdd={() => nav('/inventory/stock-verification/add')} addLabel="Start Count Session" onRowClick={(r) => nav(`/inventory/stock-verification/${r.id}`)}
        columns={[
          { key: 'number', label: 'Stock Count Session' },
          { key: 'date', label: 'Date' },
          { key: 'location', label: 'Location' },
          { key: 'type', label: 'Count Type', change: 'new', req: REQ_PSV_ASSET, sortable: false, render: (r) => r.type ?? 'Stock Items' },
          { key: 'countedBy', label: 'Counted By' },
          { key: 'items', label: 'Items Covered', sortable: false, align: 'right', render: (r) => coveredCount(r) },
          { key: 'var', label: 'Lines with Variance', sortable: false, align: 'right', render: (r) => varianceCount(r) },
          { key: 'adjustmentNo', label: 'Stock Adjustment', render: (r) => r.adjustmentNo ?? '-' },
          { key: 'status', label: 'Status', sortable: false, render: (r) => <StatusChip status={sessionBadge(r)} tone={sessionBadge(r) === 'Variance' ? 'amber' : undefined} /> },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/inventory/stock-verification/${r.id}`) }, { label: 'Continue Counting', hidden: (r) => r.status !== 'In Progress', onClick: (r) => nav(`/inventory/stock-verification/${r.id}/edit`) }]}
      />
    </Page>
  );
}

/** Filter bar for the fixed-asset count list. */
function AssetCountFilters({ rows, f, onChange }: { rows: AssetCountLine[]; f: Record<string, string>; onChange: (f: Record<string, string>) => void }) {
  const cats = Array.from(new Set(rows.map((r) => r.category)));
  const owners = Array.from(new Set(rows.map((r) => r.ownership)));
  const sel = (key: string, label: string, opts: string[]) => (
    <Box sx={{ minWidth: 170 }}><SelectInput label={label} value={f[key] ?? ''} options={['', ...opts].map((o) => ({ value: o, label: o || 'All' }))} placeholder="All" onChange={(v) => onChange({ ...f, [key]: v })} /></Box>
  );
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
      <Box sx={{ minWidth: 240 }}><TextInput label="Asset or Asset Name" value={f.q ?? ''} onChange={(v) => onChange({ ...f, q: v })} placeholder="e.g. AST-1017 or Perkins" /></Box>
      {sel('category', 'Category', cats)}
      {sel('ownership', 'Ownership', owners)}
      {sel('result', 'Result', ['Found', 'Not Found', 'Not marked'])}
      {Object.values(f).some(Boolean) && <Button size="small" variant="text" onClick={() => onChange({})}>Clear filters</Button>}
    </Box>
  );
}
const applyAssetFilters = (rows: AssetCountLine[], f: Record<string, string>) => rows.filter((r) => {
  const q = (f.q ?? '').trim().toLowerCase();
  if (q && !`${r.assetId} ${r.name}`.toLowerCase().includes(q)) return false;
  if (f.category && r.category !== f.category) return false;
  if (f.ownership && r.ownership !== f.ownership) return false;
  if (f.result && (f.result === 'Not marked' ? r.result !== null : r.result !== f.result)) return false;
  return true;
});

export function CountForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const sessions = useCollection<CountSession>('inventory.counts', countSeed);
  const items = useCollection<ItemRec>('items', itemSeed);
  const locs = useCollection<LocationRec>('locations', locationSeed);
  const existing = id ? sessions.get(id) : undefined;
  const [head, setHead] = useState({ location: existing?.location ?? '', date: existing?.date ?? TODAY, countedBy: existing?.countedBy ?? '', confirmedBy: existing?.confirmedBy ?? '', reason: existing?.reason ?? '' });
  const locStock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const heavy = useHeavy();
  const [lines, setLines] = useState<CountSession['lines']>(existing?.lines ?? []);
  const [type, setType] = useState<CountType>(existing?.type ?? 'Stock Items');
  const [assetLines, setAssetLines] = useState<AssetCountLine[]>(existing?.assetLines ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  if (id && (!existing || existing.status !== 'In Progress')) return <NotFound back="Physical Stock Verification" to="/inventory/stock-verification" />;
  const isAssets = type === 'Fixed Assets';
  // Only active, usable assets whose current location is the counted one are expected (scrapped, disposed and returned cross-hire units are left out).
  const assetSnapshot = (location: string): AssetCountLine[] =>
    heavy.rows.filter((h) => currentLocation(h) === location && h.status === 'Active' && h.assetStatus !== 'Disposed')
      .map((h) => ({ heavyId: h.id, assetId: h.assetId, name: h.name, category: h.category, ownership: h.ownership, expectedStatus: h.assetStatus, result: null }));
  const reload = (nextType: CountType, location: string) => {
    setSelected([]); setFilters({});
    if (!location) { setLines([]); setAssetLines([]); return; }
    if (nextType === 'Fixed Assets') { setLines([]); setAssetLines(assetSnapshot(location)); } else { setAssetLines([]); setLines(snapshot(location)); }
  };
  const setResult = (assetId: string, p: Partial<AssetCountLine>) => setAssetLines(assetLines.map((x) => (x.assetId === assetId ? { ...x, ...p } : x)));
  const markSelected = (result: string) => { setAssetLines(assetLines.map((x) => (selected.includes(x.assetId) ? { ...x, result, reason: result === 'Found' ? undefined : x.reason } : x))); toast(`${selected.length} asset(s) marked ${result}`); setSelected([]); };
  // System quantity is what this location holds (not the item's total across all locations).
  const snapshot = (location: string) =>
    locStock.rows.filter((r) => r.location === location && r.qty > 0)
      .flatMap((r) => { const i = items.get(r.itemId); return i && i.tracking !== 'Serialized' && i.type !== 'Service' ? [{ itemId: i.id, code: i.code, name: i.name, unit: i.unit, systemQty: r.qty, countedQty: null as number | null }] : []; });
  const hasStockDiff = lines.some((l) => { const v = variance(l); return v !== null && v !== 0; });
  const save = (complete: boolean) => {
    const e: Errors = {};
    if (isBlank(head.location)) e.location = 'Location is required';
    if (isBlank(head.date)) e.date = 'Date is required';
    if (isBlank(head.countedBy)) e.countedBy = 'Counted By is required';
    if (complete && isBlank(head.confirmedBy)) e.confirmedBy = 'Confirmed By is required to complete the count';
    if (isAssets) {
      if (!assetLines.length) e.lines = head.location ? 'No active fixed assets are recorded at this location' : 'Select a location to load the expected fixed assets';
      else if (complete && assetLines.some((l) => !l.result)) e.lines = 'Mark every fixed asset as Found or Not Found (Select All can mark several at once)';
      else if (complete && assetLines.some((l) => l.result === 'Not Found' && !l.reason?.trim())) e.lines = 'Enter a reason for every asset that was not found';
    } else {
      if (!lines.length) e.lines = 'Select a location to load the items to count';
      if (complete && lines.some((l) => l.countedQty === null || l.countedQty < 0)) e.lines = 'Enter the physically counted quantity for every item';
      if (complete && !e.lines && hasStockDiff && isBlank(head.reason)) e.reason = 'Enter a reason, because some counted quantities differ from the system';
    }
    setErrors(e);
    if (Object.keys(e).length) { toast(e.lines ?? e.reason ?? 'Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: CountSession = { id: existing?.id ?? `cs${Date.now()}`, number: existing?.number ?? `SCS-26-${String(sessions.rows.length + 1).padStart(5, '0')}`, location: head.location, date: head.date, countedBy: head.countedBy, confirmedBy: head.confirmedBy, reason: isAssets ? undefined : head.reason.trim() || undefined, status: complete ? 'Completed' : 'In Progress', lines: isAssets ? [] : lines, ...(isAssets ? { type, assetLines } : {}) };
    if (existing) sessions.update(rec.id, rec); else sessions.add(rec);
    toast(complete ? 'Count completed' : 'Count progress saved');
    nav(`/inventory/stock-verification/${rec.id}`);
  };
  const shown = applyAssetFilters(assetLines, filters);
  const found = assetLines.filter((l) => l.result === 'Found').length, notFound = assetLines.filter((l) => l.result === 'Not Found').length;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Physical Stock Verification', to: '/inventory/stock-verification' }, { label: existing ? existing.number : 'Start Count Session' }]}
        actions={<><Button variant="text" onClick={() => nav('/inventory/stock-verification')}>Cancel</Button><Button variant="outlined" onClick={() => save(false)}>Save progress</Button><Button variant="contained" onClick={() => save(true)}>Complete Count</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid cols={3}>
          <SelectInput label="Count Type" required change="new" req={REQ_PSV_ASSET} value={type} options={[...COUNT_TYPES]} disabled={!!existing}
            onChange={(v) => { setType(v as CountType); reload(v as CountType, head.location); }} hint={ASSET_COUNT_HINT} />
          <SelectInput label="Location" required change="new" req={REQ_PSV} value={head.location} options={locs.rows.filter((l) => l.status === 'Active').map((l) => l.name)} disabled={!!existing} error={errors.location}
            onChange={(v) => { setHead({ ...head, location: v }); reload(type, v); }} hint={isAssets ? 'Expected assets are the active ones whose current location is this one (from Movement History)' : 'System quantity is captured when the session starts'} />
          <DateInput label="Date" required change="new" req={REQ_PSV} value={head.date} onChange={(v) => setHead({ ...head, date: v })} error={errors.date} />
          <SelectInput label="Counted By" required change="new" req={REQ_PSV} value={head.countedBy} options={EMP} onChange={(v) => setHead({ ...head, countedBy: v })} error={errors.countedBy} />
          <SelectInput label="Confirmed By" change="new" req={REQ_PSV} value={head.confirmedBy} options={EMP} onChange={(v) => setHead({ ...head, confirmedBy: v })} error={errors.confirmedBy} hint="Required to complete the count. The Fleet / Asset Manager confirms counts per the role matrix; exact rule to be confirmed with client" />
          {!isAssets && <TextInput label="Reason for Differences" change="new" req={REQ_PSV_REASON} value={head.reason} onChange={(v) => setHead({ ...head, reason: v })} error={errors.reason} multiline rows={2} full
            hint="One reason for the whole count, needed only when a counted quantity differs from the system" />}
        </FormGrid>
        <FormSection title={isAssets ? 'Fixed Assets to Verify' : 'Items to Count'} change="new" req={isAssets ? REQ_PSV_ASSET : REQ_PSV}>
          {isAssets && assetLines.length === 0 && <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'}>{errors.lines ?? 'Select a location to load the expected fixed assets'}</Text>}
          {isAssets && assetLines.length > 0 && (
            <>
              <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'} sx={{ mb: 1 }}>{errors.lines ?? `Mark each asset Found or Not Found. A reason is needed only for assets not found. ${found} found, ${notFound} not found, ${assetLines.length - found - notFound} not marked yet.`}</Text>
              <AssetCountFilters rows={assetLines} f={filters} onChange={(f) => { setFilters(f); setSelected([]); }} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setSelected(shown.map((l) => l.assetId))}>Select All{Object.values(filters).some(Boolean) ? ' (filtered)' : ''}</Button>
                <Button size="small" variant="text" disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</Button>
                <Text type="s5" color="theme.secondary.700">{selected.length} selected</Text>
                <Button size="small" variant="contained" disabled={!selected.length} onClick={() => markSelected('Found')}>Mark selected Found</Button>
                <Button size="small" variant="outlined" color="error" disabled={!selected.length} onClick={() => markSelected('Not Found')}>Mark selected Not Found</Button>
              </Box>
              <NoPaging>
                <DataTable<AssetCountLine & { id: string }> hideToolbar rowKey={(r) => r.assetId} rows={shown.map((l) => ({ ...l, id: l.assetId }))} pageSize={ALL_ROWS} selectable selected={selected} onSelect={setSelected} emptyText="No assets match the filters" columns={[
                  { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership' },
                  { key: 'expectedStatus', label: 'Expected Asset Status', render: (l) => <StatusChip status={l.expectedStatus} /> },
                  { key: 'result', label: 'Verified', sortable: false, render: (l) => (
                    <select value={l.result ?? ''} onChange={(e) => setResult(l.assetId, { result: e.target.value || null, reason: e.target.value === 'Not Found' ? l.reason : undefined })} style={{ ...inputStyle, width: 150 }}>
                      <option value="">Select...</option>{ASSET_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>) },
                  { key: 'reason', label: 'Reason (if Not Found)', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => (l.result === 'Not Found' ? (
                    <input value={l.reason ?? ''} placeholder="Why was it not found?" onChange={(e) => setResult(l.assetId, { reason: e.target.value })} style={{ ...inputStyle, width: 260 }} />) : '-') },
                ]} />
              </NoPaging>
            </>
          )}
          {!isAssets && lines.length === 0 && <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'}>{errors.lines ?? 'Select a location to load the items to count'}</Text>}
          {!isAssets && lines.length > 0 && (
            <>
            <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'} sx={{ mb: 1 }}>{errors.lines ?? 'Enter the counted quantity for every item. If any quantity differs, enter one reason for the count above.'}</Text>
            <NoPaging>
              <DataTable<CountSession['lines'][number]> hideToolbar rowKey={(r) => r.itemId} rows={lines.map((l) => ({ ...l, id: l.itemId }))} pageSize={ALL_ROWS} columns={[
                { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' },
                { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => qtyWithUnit(l.systemQty, l.unit) },
                { key: 'counted', label: 'Physically Counted Quantity', sortable: false, align: 'right', render: (l) => (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <input type="number" min={0} value={l.countedQty ?? ''} onChange={(e) => setLines(lines.map((x) => (x.itemId === l.itemId ? { ...x, countedQty: e.target.value === '' ? null : Number(e.target.value) } : x)))}
                      style={{ ...inputStyle, width: 110, textAlign: 'right' }} />
                    <Text type="s5" color="theme.secondary.700">{l.unit}</Text>
                  </Box>) },
                { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={signedQty(v, l.unit)} tone={v === 0 ? 'green' : 'amber'} />; } },
              ]} />
            </NoPaging>
            </>
          )}
        </FormSection>
      </Page>
    </>
  );
}

export function CountView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const sessions = useCollection<CountSession>('inventory.counts', countSeed);
  const items = useCollection<ItemRec>('items', itemSeed);
  const locStock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const heavy = useHeavy();
  const [reject, setReject] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const s = sessions.get(id);
  if (!s) return <NotFound back="Physical Stock Verification" to="/inventory/stock-verification" />;
  const assets = isAssetCount(s);
  const vars = assets ? assetVariances(s) : sessionVariances(s);
  const log = s.log ?? [];
  const push = (adjustmentStatus: NonNullable<CountSession['adjustmentStatus']>, title: string, detail: string, extra: Partial<CountSession> = {}) =>
    sessions.update(s.id, { ...extra, adjustmentStatus, log: [...log, { when: NOW_STAMP, title, detail, by: 'Current User' }] });
  const raise = () => {
    const adjustmentNo = `ADJ-26-${String(21 + sessions.rows.length).padStart(5, '0')}`;
    push('Pending Approval', 'Stock Adjustment raised', `${adjustmentNo} sent for approval`, { adjustmentNo });
    toast('Stock Adjustment raised and sent for approval');
  };
  const approve = () => {
    if (assets) {
      // Not Found: logged on the asset for follow-up only. Asset Status and location are never changed automatically.
      let skipped = 0;
      assetVariances(s).forEach((l) => {
        const h = heavy.get(l.heavyId);
        if (!h) return;
        // Guard against a stale count: if the asset has moved since the count, it is not touched.
        if (currentLocation(h) !== s.location) { skipped += 1; return; }
        heavy.update(h.id, { audit: [{ when: NOW_STAMP, title: 'Not found in physical count', detail: `${s.number}: ${l.reason ?? 'no reason given'}; follow up required, Asset Status not changed`, by: 'Current User' }, ...h.audit] });
      });
      push('Approved', 'Approved', `Missing assets logged for follow-up${skipped ? `; ${skipped} asset(s) skipped because they moved after the count` : ''}`);
      toast(skipped ? `Adjustment approved, ${skipped} asset(s) skipped because they moved after the count` : 'Adjustment approved, missing assets logged for follow-up');
      return;
    }
    // Only this location's quantity is set to the counted figure; the item's total moves by the same difference.
    s.lines.forEach((l) => {
      if (l.countedQty === null || variance(l) === 0) return;
      const row = locStock.rows.find((r) => r.itemId === l.itemId && r.location === s.location);
      const current = row ? row.qty : l.systemQty;
      if (row) locStock.update(row.id, { qty: l.countedQty });
      const it = items.get(l.itemId);
      if (it) items.update(l.itemId, { stock: it.stock + (l.countedQty - current) });
    });
    push('Approved', 'Approved', `System quantity corrected at ${s.location}`);
    toast(`Stock Adjustment approved, system quantity corrected at ${s.location}`);
  };
  const doReject = () => { push('Rejected', 'Rejected', 'System quantity unchanged'); setReject(false); toast('Stock Adjustment rejected, system quantity unchanged'); };
  const assetRows = applyAssetFilters(s.assetLines ?? [], filters);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Physical Stock Verification', to: '/inventory/stock-verification' }, { label: s.number }]} status={<StatusChip status={sessionBadge(s)} tone={sessionBadge(s) === 'Variance' ? 'amber' : undefined} />}
        actions={<>
          {s.status === 'In Progress' && <Button variant="contained" onClick={() => nav(`/inventory/stock-verification/${s.id}/edit`)}>Continue Counting</Button>}
          {s.status === 'Completed' && vars.length > 0 && !s.adjustmentNo && <Button variant="contained" onClick={raise}>Raise Stock Adjustment</Button>}
          {s.adjustmentStatus === 'Pending Approval' && <><Button variant="outlined" color="error" onClick={() => setReject(true)}>Reject</Button><Button variant="contained" onClick={approve}>Approve Adjustment</Button></>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Stock Count Session" value={s.number} change="new" req={REQ_PSV} />
          <ValueField label="Count Type" value={s.type ?? 'Stock Items'} change="new" req={REQ_PSV_ASSET} />
          <ValueField label="Date" value={s.date} />
          <ValueField label="Location" value={s.location} />
          <ValueField label="Items Covered" value={String(coveredCount(s))} change="new" req={REQ_PSV} />
          <ValueField label="Counted By" value={s.countedBy} />
          <ValueField label="Confirmed By" value={s.confirmedBy || (s.status === 'Completed' ? '-' : 'Not yet confirmed')} change="new" req={REQ_PSV} />
          {!assets && <ValueField label="Reason for Differences" value={s.reason} change="new" req={REQ_PSV_REASON} />}
        </ValueGrid>
        <KpiRow><Box sx={{ mt: 3, display: 'contents' }}>
          <KpiCard title="Items Covered" value={coveredCount(s)} /><KpiCard title={assets ? 'Assets Not Found' : 'Lines with Variance'} value={vars.length} tint={vars.length ? '#FFFAF0' : undefined} />
          <KpiCard title="Stock Adjustment" value={s.adjustmentNo ?? '-'} sub={s.adjustmentStatus ? <>Approval: {s.adjustmentStatus}</> : vars.length ? 'Not raised yet' : 'Not required'} />
        </Box></KpiRow>
        {s.status === 'Completed' && vars.length > 0 && s.adjustmentStatus !== 'Approved' && s.adjustmentStatus !== 'Rejected' && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>System quantity is corrected only after the Stock Adjustment is approved. Approval thresholds and roles to be confirmed with client.</Text>}
        {s.adjustmentStatus === 'Rejected' && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>The Stock Adjustment was rejected, so system quantity was not changed. What happens to a rejected variance to be confirmed with client.</Text>}
        {assets && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>On approval, assets not found are logged on the asset for follow-up. Asset Status and location are not changed automatically, and a lost asset still needs an approved Disposal Request. {ASSET_COUNT_HINT}.</Text>}
        {assets ? (
          <Panel title="Count Result" change="new" req={REQ_PSV_LIST}>
            <AssetCountFilters rows={s.assetLines ?? []} f={filters} onChange={setFilters} />
            <NoPaging>
              <DataTable<AssetCountLine & { id: string }> hideToolbar rows={assetRows.map((l) => ({ ...l, id: l.assetId }))} pageSize={ALL_ROWS} emptyText="No assets match the filters" columns={[
                { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership' },
                { key: 'expectedStatus', label: 'Expected Asset Status', render: (l) => <StatusChip status={l.expectedStatus} /> },
                { key: 'result', label: 'Verified', sortable: false, render: (l) => (l.result ? <StatusChip status={l.result} tone={resultTone(l.result)} /> : '-') },
                { key: 'reason', label: 'Reason', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => l.reason ?? '-' },
              ]} />
            </NoPaging>
          </Panel>
        ) : (
        <Panel title="Count Result" change="new" req={REQ_PSV}>
          <NoPaging>
            <DataTable<CountSession['lines'][number] & { id: string }> hideToolbar rows={s.lines.map((l) => ({ ...l, id: l.itemId }))} pageSize={ALL_ROWS} columns={[
              { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' },
              { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => qtyWithUnit(l.systemQty, l.unit) },
              { key: 'countedQty', label: 'Physically Counted', align: 'right', render: (l) => (l.countedQty === null ? '-' : qtyWithUnit(l.countedQty, l.unit)) },
              { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={signedQty(v, l.unit)} tone={v === 0 ? 'green' : 'amber'} />; } },
            ]} />
          </NoPaging>
        </Panel>
        )}
        {log.length > 0 && <Panel title="Approval History" change="new" req={REQ_PSV} sx={{ mt: 2 }}><Timeline items={[...log].reverse().map((l) => ({ when: l.when, title: l.title, detail: l.detail, by: l.by, tone: l.title === 'Approved' ? 'green' as const : l.title === 'Rejected' ? 'red' as const : 'blue' as const }))} /></Panel>}
      </Page>
      <ConfirmDialog open={reject} danger title="Reject stock adjustment" description="System quantity stays unchanged." confirmLabel="Reject" onClose={() => setReject(false)} onConfirm={doReject} />
    </>
  );
}

/* ================================================================== Disposal / write-off */
const REQ_DSP_FLOW = 'Asset Disposal (2 Oct call: select asset, method, documents, approval, then the sale or scrap outcome)';
/** Where a disposal request is in its lifecycle. Approval inactivates the asset; the outcome (sale or scrap) completes it. */
const disposalSteps = (r: Pick<DisposalRec, 'method'>) => ['Request Raised', 'Pending Approval', 'Approved', 'Asset Inactivated', r.method === 'Sale' ? 'Sale Invoiced' : r.method === 'Scrap' ? 'Scrap Invoiced' : 'Invoiced'];
const INVOICE_TO_SOURCES = ['Customer list', 'Entered manually'];
const REQ_DSP_INV = 'Asset Disposal > Invoice on sale or scrap (2 Oct call)';
const disposalStep = (r: DisposalRec) => (r.status === 'Draft' ? 0 : r.status === 'Pending Approval' ? 1 : r.status === 'Rejected' ? 2 : r.outcome ? 5 : 4);
const outcomeLabel = (r: DisposalRec) => (r.status === 'Rejected' ? 'Rejected' : r.status !== 'Approved' ? 'Awaiting approval' : r.outcome ? (r.method === 'Sale' ? 'Sold, invoiced' : 'Scrapped, invoiced') : 'Invoice to create');

export function DisposalList() {
  const nav = useNavigate();
  const heavy = useHeavy();
  const rows = useCollection<DisposalRec>('inventory.disposals', disposalSeed);
  return (
    <Page>
      <PageTitle title="Asset Disposal Requests" change="new" req={REQ_DSP} />
      <DataTable<DisposalRec>
        rows={rows.rows} searchPlaceholder="Search disposal requests..."
        filter={{ key: 'status', options: ['Draft', 'Pending Approval', 'Approved', 'Rejected'] }}
        onAdd={() => nav('/inventory/disposals/add')} addLabel="Add Disposal Request" onRowClick={(r) => nav(`/inventory/disposals/${r.id}`)}
        columns={[
          { key: 'number', label: 'Disposal Request Number' },
          { key: 'assetId', label: 'Asset', render: (r) => `${r.assetId} - ${assetName(heavy.rows, r.assetId)}` },
          { key: 'method', label: 'Disposal Method' },
          { key: 'reason', label: 'Disposal Reason' },
          { key: 'status', label: 'Approval Status', render: (r) => <StatusChip status={r.status} /> },
          { key: 'outcome', label: 'Outcome', change: 'new', req: REQ_DSP_FLOW, sortable: false, render: (r) => <StatusChip status={outcomeLabel(r)} tone={r.outcome ? 'green' : r.status === 'Approved' ? 'amber' : 'grey'} /> },
          { key: 'value', label: 'Invoice Amount', align: 'right', sortable: false, render: (r) => (r.outcome?.saleValue !== undefined ? aed(r.outcome.saleValue) : '-') },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/inventory/disposals/${r.id}`) }]}
      />
    </Page>
  );
}

/** Decision support for a disposal (5 Oct call): income against expense of the asset, its current state and recent history, so "end of useful life" is not the only reason on the page. Income and expense come from Accounting; POC values are derived from the asset record. */
export function AssetHistoryPanel({ asset }: { asset?: HeavyRec }) {
  if (!asset) return <Panel title="Asset history and economics" change="new" req={REQ_DSP_FLOW} sx={{ mt: 2 }}><Text type="s5" color="theme.secondary.700">Select an asset to see its history, income and expenses.</Text></Panel>;
  const income = Math.round(asset.assetValue * 0.28 * ((asset.utilization + 40) / 100));
  const expense = Math.round(asset.assetValue * 0.07 + asset.idleDays * 40);
  const ratio = expense ? Math.round((income / expense) * 100) / 100 : 0;
  const repairs = asset.movements.filter((m) => m.type === 'Sent for Repair').length;
  return (
    <Panel title="Asset history and economics" change="new" req={REQ_DSP_FLOW} sx={{ mt: 2 }}>
      <ValueGrid cols={4}>
        <ValueField label="Income to date" value={aed(income)} /><ValueField label="Expenses to date" value={aed(expense)} />
        <ValueField label="Income vs Expenses ratio" value={<StatusChip status={`${ratio}`} tone={ratio >= 1.5 ? 'green' : ratio >= 1 ? 'amber' : 'red'} />} />
        <ValueField label="Net Book Value" value={aed(asset.nbv)} /><ValueField label="Utilization" value={`${asset.utilization}%`} /><ValueField label="Idle time" value={`${asset.idleDays} days`} /><ValueField label="Times sent for repair" value={String(repairs)} /><ValueField label="Current status" value={asset.assetStatus} />
      </ValueGrid>
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1, mb: 1 }}>Income and expenses are derived from Accounting (POC values). Recent history of this asset:</Text>
      <Timeline items={[...asset.audit].slice(0, 5).map((a) => ({ when: a.when, title: a.title, detail: a.detail, by: a.by, tone: 'blue' as const }))} />
    </Panel>
  );
}

export function DisposalForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const disposals = useCollection<DisposalRec>('inventory.disposals', disposalSeed);
  const [sp] = useSearchParams();
  const existing = id ? disposals.get(id) : undefined;
  const [f, setF] = useState<Record<string, any>>({ assetId: existing?.assetId ?? sp.get('asset') ?? '', method: existing?.method ?? '', reason: existing?.reason ?? '', value: existing?.value ? String(existing.value) : '', docs: existing?.docs ?? [] });
  const [errors, setErrors] = useState<Errors>({});
  if (id && (!existing || existing.status !== 'Draft')) return <NotFound back="Disposal Requests" to="/inventory/disposals" />;
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const open = disposals.rows.filter((d) => d.id !== existing?.id && (d.status === 'Draft' || d.status === 'Pending Approval')).map((d) => d.assetId);
  // Only active owned units can be disposed of; cross-hired units go back to their supplier instead.
  const options = heavy.rows.filter((h) => h.assetStatus !== 'Disposed' && h.status === 'Active' && h.ownership !== 'Cross-Hired' && !open.includes(h.assetId)).map((h) => ({ value: h.assetId, label: `${h.assetId} - ${h.name}` }));
  const sale = f.method === 'Sale';
  const number = existing?.number ?? `DSP-26-${String(disposals.rows.length + 3).padStart(5, '0')}`;
  const save = (submit: boolean) => {
    const e = requireFields(f, ['assetId', 'method', 'reason'], { assetId: 'Asset', method: 'Disposal Method', reason: 'Disposal Reason' });
    if (!isBlank(f.value) && !(num(f.value) > 0)) e.value = 'Expected value must be greater than 0';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const log = [...(existing?.log ?? [{ when: NOW_STAMP, title: 'Request raised', by: 'Current User' }])];
    if (submit) log.push({ when: NOW_STAMP, title: 'Submitted for approval', by: 'Current User' });
    const rec: DisposalRec = { id: existing?.id ?? `dp${Date.now()}`, number, assetId: f.assetId, reason: f.reason, method: f.method, value: !isBlank(f.value) ? Number(f.value) : 0, docs: f.docs, status: submit ? 'Pending Approval' : 'Draft', date: existing?.date ?? TODAY, log };
    if (existing) disposals.update(rec.id, rec); else disposals.add(rec);
    toast(submit ? 'Disposal request submitted for approval' : 'Disposal request saved as draft');
    nav(`/inventory/disposals/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Asset Disposal Requests', to: '/inventory/disposals' }, { label: existing ? existing.number : 'Add Disposal Request' }]}
        actions={<><Button variant="text" onClick={() => nav('/inventory/disposals')}>Cancel</Button><Button variant="outlined" onClick={() => save(false)}>Save as draft</Button><Button variant="contained" onClick={() => save(true)}>Submit for Approval</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ mb: 2 }}><LifecycleStepper steps={disposalSteps({ method: f.method })} current={0} /></Box>
        <FormGrid>
          <SelectInput label="1. Asset" required change="new" req={REQ_DSP_FLOW} value={f.assetId} options={options} onChange={set('assetId')} error={errors.assetId} hint="Active owned assets without an open request" />
          <SelectInput label="2. Disposal Method" required change="new" req={REQ_DSP_FLOW} value={f.method} options={DISPOSAL_METHODS} onChange={set('method')} error={errors.method} hint="Scrap or Sale. Both end in an invoice, created after approval" />
          <SelectInput label="Disposal Reason" required change="new" req={REQ_DSP} value={f.reason} options={DISPOSAL_REASONS} onChange={set('reason')} error={errors.reason} />
          {f.method && <NumberInput label={sale ? 'Expected Sale Value (AED)' : 'Expected Scrap Value (AED)'} change="new" req={REQ_DSP} value={f.value} onChange={set('value')} error={errors.value} hint="Optional estimate for the approver; the actual amount is entered on the invoice" />}
          <FileInput label="3. Supporting Documents" change="new" req={REQ_DSP_FLOW} value={f.docs} onChange={set('docs')} multiple full />
        </FormGrid>
        <AssetHistoryPanel asset={heavy.rows.find((h) => h.assetId === f.assetId)} />
        <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>4. Submit for approval. Once approved, the asset is inactivated and can no longer be used; an invoice is then created for the sale or scrap. Approval thresholds and roles to be confirmed with client.</Text>
      </Page>
    </>
  );
}

export function DisposalView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const disposals = useCollection<DisposalRec>('inventory.disposals', disposalSeed);
  const customers = useCollection('customers', customerSeed);
  const [reject, setReject] = useState(false);
  const [outDlg, setOutDlg] = useState(false);
  const [o, setO] = useState<Record<string, any>>({ date: TODAY, buyer: '', saleValue: '', invoiceRef: '', scrapRef: '' });
  const [oErr, setOErr] = useState<Errors>({});
  const r = disposals.get(id);
  if (!r) return <NotFound back="Disposal Requests" to="/inventory/disposals" />;
  const asset = heavy.rows.find((h) => h.assetId === r.assetId);
  const sale = r.method === 'Sale';
  const push = (patch: Partial<DisposalRec>, title: string, detail?: string) => disposals.update(r.id, { ...patch, log: [...r.log, { when: NOW_STAMP, title, detail, by: 'Current User' }] });
  const approve = () => {
    push({ status: 'Approved' }, 'Approved', 'Asset inactivated (Disposed)');
    if (asset) heavy.update(asset.id, { assetStatus: 'Disposed', status: 'Inactive', statusOverride: undefined, audit: [{ when: NOW_STAMP, title: 'Asset inactivated', detail: `${asset.assetStatus} to Disposed (${r.number} approved); no longer available for use`, by: 'Current User' }, ...asset.audit] });
    toast(`Request approved, asset inactivated. Next: record the ${sale ? 'sale' : 'scrap'}`);
  };
  const seq = (prefix: string, base: number) => `${prefix}-26-${String(base + disposals.rows.length).padStart(5, '0')}`;
  const openOutcome = () => { setO({ date: TODAY, source: INVOICE_TO_SOURCES[0], buyer: '', saleValue: r.value ? String(r.value) : '', invoiceRef: seq('INV', 140), scrapRef: '' }); setOErr({}); setOutDlg(true); };
  const completeOutcome = () => {
    const e: Errors = isBlank(o.date) ? { date: 'Date is required' } : {};
    if (isBlank(o.buyer)) e.buyer = 'Invoice To is required';
    if (!(num(o.saleValue) > 0)) e.saleValue = 'Invoice amount must be greater than 0';
    if (isBlank(o.invoiceRef)) e.invoiceRef = 'Invoice number is required';
    setOErr(e);
    if (Object.keys(e).length) return;
    const nbv = asset?.nbv ?? 0;
    const outcome: DisposalOutcome = { date: o.date, journalRef: seq('JV', 360), nbvAtDisposal: nbv, by: 'Current User', buyer: o.buyer.trim(), buyerSource: o.source, saleValue: Number(o.saleValue), invoiceRef: o.invoiceRef.trim(), scrapRef: sale ? undefined : o.scrapRef.trim() || undefined };
    push({ outcome }, sale ? 'Sale invoiced' : 'Scrap invoiced', `Invoice ${outcome.invoiceRef} to ${outcome.buyer} for ${aed(o.saleValue)}; journal ${outcome.journalRef}`);
    setOutDlg(false);
    toast(`Invoice ${outcome.invoiceRef} created`);
    nav(`/accounting/invoices/${outcome.invoiceRef}`);
  };
  const out = r.outcome;
  const gain = out ? (out.saleValue ?? 0) - out.nbvAtDisposal : 0;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Asset Disposal Requests', to: '/inventory/disposals' }, { label: r.number }]} status={<StatusChip status={r.status} />}
        actions={<>
          {r.status === 'Draft' && <><Button variant="outlined" onClick={() => nav(`/inventory/disposals/${r.id}/edit`)}>Edit</Button><Button variant="contained" onClick={() => { push({ status: 'Pending Approval' }, 'Submitted for approval'); toast('Submitted for approval'); }}>Submit for Approval</Button></>}
          {r.status === 'Pending Approval' && <><Button variant="outlined" color="error" onClick={() => setReject(true)}>Reject</Button><Button variant="contained" onClick={approve}>Approve</Button></>}
          {r.status === 'Approved' && !out && <Button variant="contained" onClick={openOutcome}>Create Invoice</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <Panel sx={{ mb: 2 }}>
          <LifecycleStepper steps={disposalSteps(r)} current={disposalStep(r)} />
          {r.status === 'Rejected' && <Text type="s5" color="#C64D4D" sx={{ mt: 1 }}>Rejected: the asset stays active on the Fixed Asset Register.</Text>}
          {r.status === 'Approved' && !out && <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>The asset has been inactivated. Create the invoice for the {sale ? 'sale' : 'scrap'} to close the request.</Text>}
        </Panel>
        <ValueGrid cols={4}>
          <ValueField label="Disposal Request Number" value={r.number} change="new" req={REQ_DSP} />
          <ValueField label="Asset" value={asset ? <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/inventory/items/heavy/${asset.id}`)}>{r.assetId} - {asset.name}</Box> : r.assetId} change="new" req={REQ_DSP} />
          <ValueField label="Disposal Method" value={r.method} change="new" req={REQ_DSP} />
          <ValueField label="Disposal Reason" value={r.reason} change="new" req={REQ_DSP} />
          <ValueField label={sale ? 'Expected Sale Value' : 'Expected Scrap Value'} value={r.value ? aed(r.value) : undefined} change="new" req={REQ_DSP} />
          <ValueField label="Approval Status" value={<StatusChip status={r.status} />} change="new" req={REQ_DSP} />
          <ValueField label="Asset Status" value={asset ? <><StatusChip status={asset.assetStatus} /> <StatusChip status={asset.status} /></> : undefined} />
        </ValueGrid>
        {out && (
          <Panel title={sale ? 'Sale Invoice' : 'Scrap Invoice'} change="new" req={REQ_DSP_INV} sx={{ mt: 3 }}>
            <ValueGrid cols={4}>
              <ValueField label="Invoice Number" value={<Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav(`/accounting/invoices/${out.invoiceRef}`)}>{out.invoiceRef}</Box>} />
              <ValueField label="Invoice Date" value={out.date} />
              <ValueField label="Invoice To" value={out.buyer} />
              <ValueField label="Invoice To Taken From" value={out.buyerSource} />
              <ValueField label="Invoice Amount" value={aed(out.saleValue)} />
              {!sale && <ValueField label="Scrap Reference" value={out.scrapRef} />}
              <ValueField label="Net Book Value at Disposal" value={aed(out.nbvAtDisposal)} />
              <ValueField label={gain >= 0 ? 'Gain on Disposal' : 'Loss on Disposal'} value={aed(Math.abs(gain))} />
              <ValueField label="Finance Journal" value={out.journalRef} />
              <ValueField label="Recorded By" value={out.by} />
            </ValueGrid>
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>POC: the invoice and journal are reference records only. In the live system they are created in Finance & Accounting and linked here. VAT treatment and how the invoiced party is chosen are to be confirmed with client.</Text>
          </Panel>
        )}
        <AssetHistoryPanel asset={asset} />
        <Panel title="Supporting Documents" change="new" req={REQ_DSP} sx={{ mt: 3 }}><FileList names={r.docs} /></Panel>
        <Panel title="History" sx={{ mt: 2 }}><Timeline items={[...r.log].reverse().map((l) => ({ when: l.when, title: l.title, detail: l.detail, by: l.by, tone: l.title === 'Approved' || l.title.endsWith('invoiced') || l.title.endsWith('completed') ? 'green' as const : l.title === 'Rejected' ? 'red' as const : 'blue' as const }))} /></Panel>
      </Page>
      <ConfirmDialog open={reject} danger title="Reject disposal request" description="The asset stays active on the Fixed Asset Register." confirmLabel="Reject" onClose={() => setReject(false)} onConfirm={() => { push({ status: 'Rejected' }, 'Rejected'); toast('Request rejected'); }} />
      <AppDialog open={outDlg} title={`Create Invoice for ${sale ? 'Sale' : 'Scrap'}`} onClose={() => setOutDlg(false)} onConfirm={completeOutcome} confirmLabel="Create Invoice" maxWidth="md">
        <Text type="s5" color="theme.secondary.700" sx={{ mb: 2 }}>A {sale ? 'sale' : 'scrap'} always results in an amount, so an invoice is raised to the party taking the asset.</Text>
        <FormGrid>
          <TextInput label="Invoice Number" required change="new" req={REQ_DSP_INV} value={o.invoiceRef} onChange={(v) => setO({ ...o, invoiceRef: v })} error={oErr.invoiceRef} hint="Suggested next number; in the live system the invoice is raised in Finance" />
          <DateInput label="Invoice Date" required change="new" req={REQ_DSP_INV} value={o.date} onChange={(v) => setO({ ...o, date: v })} error={oErr.date} />
          <SelectInput label="Invoice To Taken From" required change="new" req={REQ_DSP_INV} value={o.source} options={INVOICE_TO_SOURCES} onChange={(v) => setO({ ...o, source: v, buyer: '' })} hint="Whether the invoiced party is picked by the system or entered by hand is to be confirmed with client" />
          {o.source === 'Customer list'
            ? <SelectInput label="Invoice To" required change="new" req={REQ_DSP_INV} value={o.buyer} options={(customers.rows as any[]).filter((c) => c.active).map((c) => c.name)} onChange={(v) => setO({ ...o, buyer: v })} error={oErr.buyer} hint={sale ? 'The buyer' : 'The scrap buyer or dealer'} />
            : <TextInput label="Invoice To" required change="new" req={REQ_DSP_INV} value={o.buyer} onChange={(v) => setO({ ...o, buyer: v })} error={oErr.buyer} hint={sale ? 'Name of the buyer' : 'Name of the scrap buyer or dealer'} />}
          <NumberInput label={`${sale ? 'Sale' : 'Scrap'} Amount (AED)`} required change="new" req={REQ_DSP_INV} value={o.saleValue} onChange={(v) => setO({ ...o, saleValue: v })} error={oErr.saleValue} hint="VAT treatment to be confirmed with client" />
          {!sale && <TextInput label="Scrap Reference / Certificate" value={o.scrapRef} onChange={(v) => setO({ ...o, scrapRef: v })} hint="Optional, e.g. scrap dealer receipt number" />}
          <TextInput label="Net Book Value at Disposal" value={aed(asset?.nbv ?? 0)} disabled hint="Used to work out the gain or loss" />
        </FormGrid>
      </AppDialog>
    </>
  );
}
