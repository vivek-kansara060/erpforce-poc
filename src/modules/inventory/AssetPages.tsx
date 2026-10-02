import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, FormControlLabel, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { Timeline } from '@/components/Flow';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { employees, fmtNum } from '@/mock-data/masters';
import {
  ASSET_ELSEWHERE_REASONS, ASSET_NOT_FOUND_REASONS, ASSET_RESULTS, CERT_TYPES, COUNT_TYPES, DISPOSAL_METHODS, DISPOSAL_REASONS, MOVEMENT_PLACES, NOW, READING_FREQUENCY_DAYS, READING_METHODS, TODAY, certSeed, settingsSeed, countSeed, currentLocation, disposalSeed, heavySeed, itemSeed, locationSeed, locationStockSeed, nextMovementNo, readingSeed, STOCK_DIFF_REASONS,
  type AssetCountLine, type CertRec, type InventorySettings, type CountSession, type CountType, type DisposalRec, type HeavyRec, type ItemRec, type LocationRec, type LocationStock, type Movement, type ReadingRec,
} from './data';
import { FileList, aed, isBlank, num, requireFields, type Errors } from './shared';
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
export function AssetCertificates({ assetId, canEdit = true }: { assetId: string; canEdit?: boolean }) {
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
        <FormControlLabel control={<Switch size="small" checked={approvalOn} disabled={!canEdit} onChange={(e) => { settings.update('settings', { certApproval: e.target.checked }); toast(e.target.checked ? 'Certificate approval switched on: new and edited certificates need approval' : 'Certificate approval switched off'); }} />}
          label={<Text type="s5" color="theme.secondary.800">Approval required (client setting)</Text>} />
        {canEdit && <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ open: true })}>Add Certificate</Button>}
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
        actions={canEdit ? [
          { label: 'View / Edit', onClick: (r) => setDlg({ open: true, rec: r }) },
          { label: 'Approve', hidden: (r) => !approvalOn || r.approval !== 'Pending Approval', onClick: (r) => { certs.update(r.id, { approval: 'Approved', history: [{ when: NOW_STAMP, title: 'Approved', by: 'Current User' }, ...r.history] }); toast(`${r.type} certificate approved`); } },
          { label: 'Delete', danger: true, onClick: setDel },
        ] : undefined}
      />
      <CertificateDialog open={dlg.open} assetId={assetId} rec={dlg.rec} approvalOn={approvalOn} readOnly={!canEdit} onClose={() => setDlg({ open: false })} />
      <ConfirmDialog open={!!del} danger title="Delete certificate" description={`Delete the ${del?.type} certificate (expiry ${del?.expiry})?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { certs.remove(del.id); toast('Certificate deleted'); } }} />
    </Panel>
  );
}

function CertificateDialog({ open, assetId, rec, approvalOn, readOnly, onClose }: { open: boolean; assetId: string; rec?: CertRec; approvalOn: boolean; readOnly?: boolean; onClose: () => void }) {
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
    <AppDialog open={open} title={rec ? `${readOnly ? 'View' : 'Edit'} ${rec.type} Certificate` : 'Add Certificate'} onClose={onClose} onConfirm={readOnly ? undefined : save} confirmLabel={rec ? 'Save' : 'Add'} maxWidth="md">
      <FormGrid>
        <SelectInput label="Certificate / Document Type" required change="new" req={REQ_CERT} value={f.type} options={CERT_TYPES} onChange={set('type')} error={errors.type} disabled={readOnly} hint="New document types can be added by an administrator" />
        <TextInput label="Reference / Policy Number" change="new" req={REQ_CERT} value={f.reference} onChange={set('reference')} disabled={readOnly} />
        <DateInput label="Expiry Date" required change="new" req={REQ_CERT} value={f.expiry} onChange={set('expiry')} error={errors.expiry} disabled={readOnly} />
        <NumberInput label="Reminder Lead Time (days before expiry)" required change="new" req={REQ_CERT} value={f.leadDays} onChange={set('leadDays')} error={errors.leadDays} disabled={readOnly} hint="Configurable per certificate" />
        <FileInput label="Document" change="new" req={REQ_CERT} value={f.file} onChange={set('file')} multiple disabled={readOnly} />
        {approvalOn && !readOnly && <Text type="s5" color="theme.secondary.700">Approval is switched on, so this certificate is saved as Pending Approval.</Text>}
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
export function AssetReadings({ assetId, canEnter = true }: { assetId: string; canEnter?: boolean }) {
  const toast = useToast();
  const readings = useCollection<ReadingRec>('inventory.readings', readingSeed);
  const [dlg, setDlg] = useState<{ open: boolean; rec?: ReadingRec }>({ open: false });
  const [del, setDel] = useState<ReadingRec | null>(null);
  const rows = readings.rows.filter((r) => r.assetId === assetId).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel title="Usage Readings" change="new" req={REQ_USE_ASSET}
      right={canEnter ? <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ open: true })}>Add Reading</Button> : <Text type="s5" color="theme.secondary.700">You do not have permission to enter readings</Text>}>
      <Text type="s5" color="theme.secondary.700" sx={{ mb: 1 }}>Readings are optional and entered manually in this phase. The Reading Source field is kept so a future IoT or telematics feed can fill the same records. Reading frequency rule to be confirmed with client ({READING_FREQUENCY_DAYS} days assumed for the overdue report).</Text>
      <DataTable<ReadingRec> hideToolbar rows={rows} pageSize={50} emptyText="No readings recorded yet" onRowClick={canEnter ? (r) => setDlg({ open: true, rec: r }) : undefined}
        columns={[
          { key: 'date', label: 'Reading Date/Time', render: (r) => r.date.replace('T', ' ') },
          { key: 'hmr', label: 'Hour Meter Reading', align: 'right', render: (r) => `${fmtNum(r.hmr)} hours` },
          { key: 'by', label: 'Recorded By' },
          { key: 'method', label: 'Entry Method', render: (r) => r.method || '-' },
          { key: 'fuel', label: 'Fuel Level', align: 'right', render: (r) => (r.fuel === undefined ? '-' : `${r.fuel}%`) },
          { key: 'notes', label: 'Condition Notes', render: (r) => r.notes || '-' },
          { key: 'source', label: 'Reading Source', sortable: false, render: () => 'Manual' },
        ]}
        actions={canEnter ? [{ label: 'Edit', onClick: (r) => setDlg({ open: true, rec: r }) }, { label: 'Delete', danger: true, onClick: setDel }] : undefined}
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
const assetVariances = (s: CountSession) => (s.assetLines ?? []).filter((l) => l.result === 'Not Found' || l.result === 'Found elsewhere');
const varianceCount = (s: CountSession) => (isAssetCount(s) ? assetVariances(s).length : sessionVariances(s).length);
const coveredCount = (s: CountSession) => (isAssetCount(s) ? (s.assetLines ?? []).length : s.lines.length);
const resultTone = (r: string | null) => (r === 'Found' ? 'green' : r === 'Not Found' ? 'red' : 'amber') as 'green' | 'red' | 'amber';
const sessionBadge = (s: CountSession) => (s.status === 'In Progress' ? 'In Progress' : s.adjustmentStatus ?? (varianceCount(s) ? 'Variance' : 'No Variance'));
const REQ_PSV_ASSET = 'Physical Stock Verification > Fixed Assets count';
const REQ_PSV_REASON = 'Physical Stock Verification > Reason for each difference';
const ASSET_COUNT_HINT = 'Counting individual fixed assets is not defined in the requirement document. Rule to be confirmed with client';
const selectStyle = { width: 190, padding: '6px 8px', border: '1px solid #D3D3D4', borderRadius: 4, font: 'inherit', background: '#fff' } as const;

export function CountList() {
  const nav = useNavigate();
  const sessions = useCollection<CountSession>('inventory.counts', countSeed);
  return (
    <Page>
      <PageTitle title="Physical Stock Verification" change="new" req={REQ_PSV} subtitle="Count sessions can be started at any time, not only on a fixed schedule." />
      <DataTable<CountSession>
        rows={sessions.rows} searchPlaceholder="Search count sessions..."
        onAdd={() => nav('/inventory/stock-verification/add')} addLabel="Start Count Session" onRowClick={(r) => nav(`/inventory/stock-verification/${r.id}`)}
        columns={[
          { key: 'number', label: 'Stock Count Session' },
          { key: 'date', label: 'Date' },
          { key: 'location', label: 'Location' },
          { key: 'type', label: 'Count Type', change: 'new', req: REQ_PSV_ASSET, sortable: false, render: (r) => r.type ?? 'Stock Items' },
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

export function CountForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const sessions = useCollection<CountSession>('inventory.counts', countSeed);
  const items = useCollection<ItemRec>('items', itemSeed);
  const locs = useCollection<LocationRec>('locations', locationSeed);
  const existing = id ? sessions.get(id) : undefined;
  const [head, setHead] = useState({ location: existing?.location ?? '', date: existing?.date ?? TODAY, countedBy: existing?.countedBy ?? '', confirmedBy: existing?.confirmedBy ?? '' });
  const locStock = useCollection<LocationStock>('inventory.locationStock', locationStockSeed);
  const heavy = useHeavy();
  const [lines, setLines] = useState<CountSession['lines']>(existing?.lines ?? []);
  const [type, setType] = useState<CountType>(existing?.type ?? 'Stock Items');
  const [assetLines, setAssetLines] = useState<AssetCountLine[]>(existing?.assetLines ?? []);
  const [errors, setErrors] = useState<Errors>({});
  if (id && (!existing || existing.status !== 'In Progress')) return <NotFound back="Physical Stock Verification" to="/inventory/stock-verification" />;
  const isAssets = type === 'Fixed Assets';
  const assetSnapshot = (location: string): AssetCountLine[] =>
    heavy.rows.filter((h) => currentLocation(h) === location && h.assetStatus !== 'Disposed')
      .map((h) => ({ heavyId: h.id, assetId: h.assetId, name: h.name, category: h.category, ownership: h.ownership, expectedStatus: h.assetStatus, result: null }));
  const reload = (nextType: CountType, location: string) => {
    if (!location) { setLines([]); setAssetLines([]); return; }
    if (nextType === 'Fixed Assets') { setLines([]); setAssetLines(assetSnapshot(location)); } else { setAssetLines([]); setLines(snapshot(location)); }
  };
  const setResult = (assetId: string, p: Partial<AssetCountLine>) => setAssetLines(assetLines.map((x) => (x.assetId === assetId ? { ...x, ...p } : x)));
  // System quantity is what this location holds (not the item's total across all locations).
  const snapshot = (location: string) =>
    locStock.rows.filter((r) => r.location === location && r.qty > 0)
      .flatMap((r) => { const i = items.get(r.itemId); return i && i.tracking !== 'Serialized' && i.category !== 'Service' ? [{ itemId: i.id, code: i.code, name: i.name, unit: i.unit, systemQty: r.qty, countedQty: null as number | null }] : []; });
  const save = (complete: boolean) => {
    const e: Errors = {};
    if (isBlank(head.location)) e.location = 'Location is required';
    if (isBlank(head.date)) e.date = 'Date is required';
    if (isBlank(head.countedBy)) e.countedBy = 'Counted By is required';
    if (complete && isBlank(head.confirmedBy)) e.confirmedBy = 'Confirmed By is required to complete the count';
    if (isAssets) {
      if (!assetLines.length) e.lines = head.location ? 'No fixed assets are recorded at this location' : 'Select a location to load the expected fixed assets';
      else if (complete && assetLines.some((l) => !l.result)) e.lines = 'Mark every fixed asset as Found, Not Found or Found elsewhere';
      else if (complete && assetLines.some((l) => l.result === 'Found elsewhere' && (!l.foundAt || l.foundAt === head.location))) e.lines = 'Select where each "Found elsewhere" asset was found (a different place from this location)';
      else if (complete && assetLines.some((l) => l.result && l.result !== 'Found' && !l.reason)) e.lines = 'Select a reason for every asset that was not found or found elsewhere';
    } else {
      if (!lines.length) e.lines = 'Select a location to load the items to count';
      if (complete && lines.some((l) => l.countedQty === null || l.countedQty < 0)) e.lines = 'Enter the physically counted quantity for every item';
      if (complete && !e.lines && lines.some((l) => { const v = variance(l); return v !== null && v !== 0 && !l.reason; })) e.lines = 'Select a reason for every line with a difference';
    }
    setErrors(e);
    if (Object.keys(e).length) { toast(e.lines ?? 'Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: CountSession = { id: existing?.id ?? `cs${Date.now()}`, number: existing?.number ?? `SCS-26-${String(sessions.rows.length + 1).padStart(5, '0')}`, ...head, status: complete ? 'Completed' : 'In Progress', lines: isAssets ? [] : lines, ...(isAssets ? { type, assetLines } : {}) };
    if (existing) sessions.update(rec.id, rec); else sessions.add(rec);
    toast(complete ? 'Count completed' : 'Count progress saved');
    nav(`/inventory/stock-verification/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Physical Stock Verification', to: '/inventory/stock-verification' }, { label: existing ? existing.number : 'Start Count Session' }]}
        actions={<><Button variant="text" onClick={() => nav('/inventory/stock-verification')}>Cancel</Button><Button variant="outlined" onClick={() => save(false)}>Save progress</Button><Button variant="contained" onClick={() => save(true)}>Complete Count</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid cols={3}>
          <TextInput label="Stock Count Session" change="new" req={REQ_PSV} value={existing ? existing.number : 'Auto-generated'} disabled hint="Header record, number generated when the session is saved" />
          <SelectInput label="Count Type" required change="new" req={REQ_PSV_ASSET} value={type} options={[...COUNT_TYPES]} disabled={!!existing}
            onChange={(v) => { setType(v as CountType); reload(v as CountType, head.location); }} hint={ASSET_COUNT_HINT} />
          <SelectInput label="Location" required change="new" req={REQ_PSV} value={head.location} options={locs.rows.map((l) => l.name)} disabled={!!existing} error={errors.location}
            onChange={(v) => { setHead({ ...head, location: v }); reload(type, v); }} hint={isAssets ? 'Expected assets are those whose current location is this one (from Movement History)' : 'System quantity is captured when the session starts'} />
          <DateInput label="Date" required change="new" req={REQ_PSV} value={head.date} onChange={(v) => setHead({ ...head, date: v })} error={errors.date} />
          <SelectInput label="Counted By" required change="new" req={REQ_PSV} value={head.countedBy} options={EMP} onChange={(v) => setHead({ ...head, countedBy: v })} error={errors.countedBy} />
          <SelectInput label="Confirmed By" change="new" req={REQ_PSV} value={head.confirmedBy} options={EMP} onChange={(v) => setHead({ ...head, confirmedBy: v })} error={errors.confirmedBy} hint="Required to complete the count. The Fleet / Asset Manager confirms counts per the role matrix; exact rule to be confirmed with client" />
          <TextInput label="Items Covered" change="new" req={REQ_PSV} value={String(isAssets ? assetLines.length : lines.length)} disabled hint={isAssets ? 'Fixed assets expected at the selected location' : 'Items loaded for the selected location'} />
        </FormGrid>
        <FormSection title={isAssets ? 'Fixed Assets to Verify' : 'Items to Count'} change="new" req={isAssets ? REQ_PSV_ASSET : REQ_PSV}>
          {isAssets && assetLines.length === 0 && <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'}>{errors.lines ?? 'Select a location to load the expected fixed assets'}</Text>}
          {isAssets && assetLines.length > 0 && (
            <>
              <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'} sx={{ mb: 1 }}>{errors.lines ?? 'Mark each unit as found at this location, not found, or found elsewhere. Units on hire at a client are not expected here. A reason is required for every unit that is not found or found elsewhere (reason list to be confirmed with client).'}</Text>
              <DataTable<AssetCountLine & { id: string }> hideToolbar rowKey={(r) => r.assetId} rows={assetLines.map((l) => ({ ...l, id: l.assetId }))} pageSize={20} columns={[
                { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' },
                { key: 'expectedStatus', label: 'Expected Asset Status', render: (l) => <StatusChip status={l.expectedStatus} /> },
                { key: 'result', label: 'Verified', sortable: false, render: (l) => (
                  <select value={l.result ?? ''} onChange={(e) => setResult(l.assetId, { result: e.target.value || null, foundAt: e.target.value === 'Found elsewhere' ? l.foundAt : undefined, reason: undefined })} style={selectStyle}>
                    <option value="">Select...</option>{ASSET_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>) },
                { key: 'foundAt', label: 'Found At', sortable: false, render: (l) => (l.result === 'Found elsewhere' ? (
                  <select value={l.foundAt ?? ''} onChange={(e) => setResult(l.assetId, { foundAt: e.target.value })} style={selectStyle}>
                    <option value="">Select place...</option>{MOVEMENT_PLACES.filter((p) => p !== head.location).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>) : '-') },
                { key: 'reason', label: 'Reason', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => (l.result && l.result !== 'Found' ? (
                  <select value={l.reason ?? ''} onChange={(e) => setResult(l.assetId, { reason: e.target.value || undefined })} style={selectStyle}>
                    <option value="">Select reason...</option>{(l.result === 'Not Found' ? ASSET_NOT_FOUND_REASONS : ASSET_ELSEWHERE_REASONS).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>) : '-') },
              ]} />
            </>
          )}
          {!isAssets && lines.length === 0 && <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'}>{errors.lines ?? 'Select a location to load the items to count'}</Text>}
          {!isAssets && lines.length > 0 && (
            <>
            <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'} sx={{ mb: 1 }}>{errors.lines ?? 'Enter the counted quantity for every item. A reason is required for every line with a difference (reason list to be confirmed with client).'}</Text>
            <DataTable<CountSession['lines'][number]> hideToolbar rowKey={(r) => r.itemId} rows={lines.map((l) => ({ ...l, id: l.itemId }))} pageSize={20} columns={[
              { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' }, { key: 'unit', label: 'UOM' },
              { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => fmtNum(l.systemQty) },
              { key: 'counted', label: 'Physically Counted Quantity', sortable: false, align: 'right', render: (l) => (
                <input type="number" min={0} value={l.countedQty ?? ''} onChange={(e) => setLines(lines.map((x) => (x.itemId === l.itemId ? { ...x, countedQty: e.target.value === '' ? null : Number(e.target.value) } : x)))}
                  style={{ width: 110, padding: '6px 8px', textAlign: 'right', border: '1px solid #D3D3D4', borderRadius: 4, font: 'inherit' }} />) },
              { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={v > 0 ? `+${v}` : String(v)} tone={v === 0 ? 'green' : 'amber'} />; } },
              { key: 'reason', label: 'Reason', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => { const v = variance(l); return v === null || v === 0 ? '-' : (
                <select value={l.reason ?? ''} onChange={(e) => setLines(lines.map((x) => (x.itemId === l.itemId ? { ...x, reason: e.target.value || undefined } : x)))} style={selectStyle}>
                  <option value="">Select reason...</option>{STOCK_DIFF_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>); } },
            ]} />
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
      // Found elsewhere: append a corrective Movement History entry (append-only, never an edit). Not Found: logged on the asset for follow-up only; Asset Status is never changed automatically.
      let skipped = 0;
      assetVariances(s).forEach((l, k) => {
        const h = heavy.get(l.heavyId);
        if (!h) return;
        // Guard against a stale count: if the asset has moved since the count, its Movement History is not touched.
        if (currentLocation(h) !== s.location) { skipped += 1; return; }
        if (l.result === 'Found elsewhere' && l.foundAt) {
          const mv: Movement = { id: `m${Date.now()}-${k}`, entryNo: nextMovementNo(h.movements.length + 300 + k), date: NOW, type: 'Internal Transfer', from: s.location, to: l.foundAt, reference: s.number, by: 'Current User' };
          heavy.update(h.id, { movements: [...h.movements, mv], audit: [{ when: NOW_STAMP, title: 'Location corrected by physical count', detail: `Found at ${l.foundAt} in ${s.number}; ${mv.entryNo} added`, by: 'Current User' }, ...h.audit] });
        } else if (l.result === 'Not Found') {
          heavy.update(h.id, { audit: [{ when: NOW_STAMP, title: 'Not found in physical count', detail: `${s.number}: follow up required, Asset Status not changed`, by: 'Current User' }, ...h.audit] });
        }
      });
      push('Approved', 'Approved', `Movement History corrected for assets found elsewhere; missing assets logged for follow-up${skipped ? `; ${skipped} asset(s) skipped because they moved after the count` : ''}`);
      toast(skipped ? `Adjustment approved, ${skipped} asset(s) skipped because they moved after the count` : 'Adjustment approved, asset records updated');
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
        </ValueGrid>
        <KpiRow><Box sx={{ mt: 3, display: 'contents' }}>
          <KpiCard title="Items Covered" value={coveredCount(s)} /><KpiCard title="Lines with Variance" value={vars.length} tint={vars.length ? '#FFFAF0' : undefined} />
          <KpiCard title="Stock Adjustment" value={s.adjustmentNo ?? '-'} sub={s.adjustmentStatus ? <>Approval: {s.adjustmentStatus}</> : vars.length ? 'Not raised yet' : 'Not required'} />
        </Box></KpiRow>
        {s.status === 'Completed' && vars.length > 0 && s.adjustmentStatus !== 'Approved' && s.adjustmentStatus !== 'Rejected' && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>System quantity is corrected only after the Stock Adjustment is approved. Approval thresholds and roles to be confirmed with client.</Text>}
        {s.adjustmentStatus === 'Rejected' && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>The Stock Adjustment was rejected, so system quantity was not changed. What happens to a rejected variance to be confirmed with client.</Text>}
        {assets && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>On approval, assets found elsewhere get a corrective Movement History entry and assets not found are logged on the asset for follow-up. Asset Status is not changed automatically, and a lost asset still needs an approved Disposal Request. {ASSET_COUNT_HINT}.</Text>}
        {assets ? (
          <Panel title="Count Result" change="new" req={REQ_PSV_ASSET}>
            <DataTable<AssetCountLine & { id: string }> hideToolbar rows={(s.assetLines ?? []).map((l) => ({ ...l, id: l.assetId }))} columns={[
              { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'ownership', label: 'Ownership Type' },
              { key: 'expectedStatus', label: 'Expected Asset Status', render: (l) => <StatusChip status={l.expectedStatus} /> },
              { key: 'result', label: 'Verified', sortable: false, render: (l) => (l.result ? <StatusChip status={l.result} tone={resultTone(l.result)} /> : '-') },
              { key: 'foundAt', label: 'Found At', sortable: false, render: (l) => l.foundAt ?? '-' },
              { key: 'reason', label: 'Reason', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => l.reason ?? '-' },
            ]} />
          </Panel>
        ) : (
        <Panel title="Count Result" change="new" req={REQ_PSV}>
          <DataTable<CountSession['lines'][number] & { id: string }> hideToolbar rows={s.lines.map((l) => ({ ...l, id: l.itemId }))} columns={[
            { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' }, { key: 'unit', label: 'UOM' },
            { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => fmtNum(l.systemQty) },
            { key: 'countedQty', label: 'Physically Counted', align: 'right', render: (l) => (l.countedQty === null ? '-' : fmtNum(l.countedQty)) },
            { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={v > 0 ? `+${v}` : String(v)} tone={v === 0 ? 'green' : 'amber'} />; } },
            { key: 'reason', label: 'Reason', change: 'new', req: REQ_PSV_REASON, sortable: false, render: (l) => l.reason ?? '-' },
          ]} />
        </Panel>
        )}
        {log.length > 0 && <Panel title="Approval History" change="new" req={REQ_PSV} sx={{ mt: 2 }}><Timeline items={[...log].reverse().map((l) => ({ when: l.when, title: l.title, detail: l.detail, by: l.by, tone: l.title === 'Approved' ? 'green' as const : l.title === 'Rejected' ? 'red' as const : 'blue' as const }))} /></Panel>}
      </Page>
      <ConfirmDialog open={reject} danger title="Reject stock adjustment" description="System quantity stays unchanged." confirmLabel="Reject" onClose={() => setReject(false)} onConfirm={doReject} />
    </>
  );
}

/* ================================================================== Disposal / write-off */
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
          { key: 'reason', label: 'Disposal Reason' },
          { key: 'method', label: 'Disposal Method' },
          { key: 'value', label: 'Scrap/Sale Value', align: 'right', render: (r) => (r.method === 'Sale' ? aed(r.value) : '-') },
          { key: 'status', label: 'Approval Status', render: (r) => <StatusChip status={r.status} /> },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/inventory/disposals/${r.id}`) }]}
      />
    </Page>
  );
}

export function DisposalForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const disposals = useCollection<DisposalRec>('inventory.disposals', disposalSeed);
  const existing = id ? disposals.get(id) : undefined;
  const [f, setF] = useState<Record<string, any>>({ assetId: existing?.assetId ?? '', reason: existing?.reason ?? '', method: existing?.method ?? '', value: existing ? String(existing.value) : '', docs: existing?.docs ?? [] });
  const [errors, setErrors] = useState<Errors>({});
  if (id && (!existing || existing.status !== 'Draft')) return <NotFound back="Disposal Requests" to="/inventory/disposals" />;
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const open = disposals.rows.filter((d) => d.id !== existing?.id && (d.status === 'Draft' || d.status === 'Pending Approval')).map((d) => d.assetId);
  const options = heavy.rows.filter((h) => h.assetStatus !== 'Disposed' && !open.includes(h.assetId)).map((h) => ({ value: h.assetId, label: `${h.assetId} - ${h.name}` }));
  const sale = f.method === 'Sale';
  const save = (submit: boolean) => {
    const e = requireFields(f, ['assetId', 'reason', 'method', ...(sale ? ['value'] : [])], { assetId: 'Linked Asset', reason: 'Disposal Reason', method: 'Disposal Method', value: 'Scrap/Sale Value' });
    if (sale && !e.value && !(num(f.value) > 0)) e.value = 'Sale value must be greater than 0';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const log = [...(existing?.log ?? [{ when: NOW_STAMP, title: 'Request raised', by: 'Current User' }])];
    if (submit) log.push({ when: NOW_STAMP, title: 'Submitted for approval', by: 'Current User' });
    const rec: DisposalRec = { id: existing?.id ?? `dp${Date.now()}`, number: existing?.number ?? `DSP-26-${String(disposals.rows.length + 3).padStart(5, '0')}`, assetId: f.assetId, reason: f.reason, method: f.method, value: sale ? Number(f.value) : 0, docs: f.docs, status: submit ? 'Pending Approval' : 'Draft', date: existing?.date ?? TODAY, log };
    if (existing) disposals.update(rec.id, rec); else disposals.add(rec);
    toast(submit ? 'Disposal request submitted for approval' : 'Disposal request saved as draft');
    nav(`/inventory/disposals/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Asset Disposal Requests', to: '/inventory/disposals' }, { label: existing ? existing.number : 'Add Disposal Request' }]}
        actions={<><Button variant="text" onClick={() => nav('/inventory/disposals')}>Cancel</Button><Button variant="outlined" onClick={() => save(false)}>Save as draft</Button><Button variant="contained" onClick={() => save(true)}>Submit for Approval</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid>
          <TextInput label="Disposal Request Number" change="new" req={REQ_DSP} value={existing?.number ?? `DSP-26-${String(disposals.rows.length + 3).padStart(5, '0')}`} disabled hint="Auto-generated" />
          <SelectInput label="Linked Asset" required change="new" req={REQ_DSP} value={f.assetId} options={options} onChange={set('assetId')} error={errors.assetId} />
          <SelectInput label="Disposal Reason" required change="new" req={REQ_DSP} value={f.reason} options={DISPOSAL_REASONS} onChange={set('reason')} error={errors.reason} />
          <SelectInput label="Disposal Method" required change="new" req={REQ_DSP} value={f.method} options={DISPOSAL_METHODS} onChange={set('method')} error={errors.method} />
          <NumberInput label="Scrap/Sale Value (AED)" required={sale} change="new" req={REQ_DSP} value={f.value} onChange={set('value')} error={errors.value} disabled={!sale} hint="Mandatory when the method is Sale" />
          <TextInput label="Approval Status" change="new" req={REQ_DSP} value="Draft" disabled hint="Driven by the Approval Engine. Thresholds and roles to be confirmed with client" />
          <FileInput label="Supporting Documents" change="new" req={REQ_DSP} value={f.docs} onChange={set('docs')} multiple />
        </FormGrid>
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
  const [reject, setReject] = useState(false);
  const r = disposals.get(id);
  if (!r) return <NotFound back="Disposal Requests" to="/inventory/disposals" />;
  const asset = heavy.rows.find((h) => h.assetId === r.assetId);
  const push = (status: DisposalRec['status'], title: string, detail?: string) => disposals.update(r.id, { status, log: [...r.log, { when: NOW_STAMP, title, detail, by: 'Current User' }] });
  const approve = () => {
    push('Approved', 'Approved', 'Asset marked Disposed');
    if (asset) heavy.update(asset.id, { assetStatus: 'Disposed', status: 'Inactive', audit: [{ when: NOW_STAMP, title: 'Asset Status changed', detail: `${asset.assetStatus} to Disposed (${r.number})`, by: 'Current User' }, ...asset.audit] });
    toast('Request approved, asset marked Disposed');
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Asset Disposal Requests', to: '/inventory/disposals' }, { label: r.number }]} status={<StatusChip status={r.status} />}
        actions={<>
          {r.status === 'Draft' && <><Button variant="outlined" onClick={() => nav(`/inventory/disposals/${r.id}/edit`)}>Edit</Button><Button variant="contained" onClick={() => { push('Pending Approval', 'Submitted for approval'); toast('Submitted for approval'); }}>Submit for Approval</Button></>}
          {r.status === 'Pending Approval' && <><Button variant="outlined" color="error" onClick={() => setReject(true)}>Reject</Button><Button variant="contained" onClick={approve}>Approve</Button></>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Disposal Request Number" value={r.number} change="new" req={REQ_DSP} />
          <ValueField label="Linked Asset" value={asset ? `${r.assetId} - ${asset.name}` : r.assetId} change="new" req={REQ_DSP} />
          <ValueField label="Disposal Reason" value={r.reason} change="new" req={REQ_DSP} />
          <ValueField label="Disposal Method" value={r.method} change="new" req={REQ_DSP} />
          <ValueField label="Scrap/Sale Value" value={r.method === 'Sale' ? aed(r.value) : undefined} change="new" req={REQ_DSP} />
          <ValueField label="Approval Status" value={<StatusChip status={r.status} />} change="new" req={REQ_DSP} />
          <ValueField label="Asset Status" value={asset ? <StatusChip status={asset.assetStatus} /> : undefined} />
        </ValueGrid>
        {r.status !== 'Approved' && <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>The asset cannot be marked Disposed until this request is Approved.</Text>}
        <Panel title="Supporting Documents" change="new" req={REQ_DSP} sx={{ mt: 3 }}><FileList names={r.docs} /></Panel>
        <Panel title="Approval History" sx={{ mt: 2 }}><Timeline items={[...r.log].reverse().map((l) => ({ when: l.when, title: l.title, detail: l.detail, by: l.by, tone: l.title === 'Approved' ? 'green' as const : l.title === 'Rejected' ? 'red' as const : 'blue' as const }))} /></Panel>
      </Page>
      <ConfirmDialog open={reject} danger title="Reject disposal request" description="The asset stays active on the Fixed Asset Register." confirmLabel="Reject" onClose={() => setReject(false)} onConfirm={() => { push('Rejected', 'Rejected'); toast('Request rejected'); }} />
    </>
  );
}
