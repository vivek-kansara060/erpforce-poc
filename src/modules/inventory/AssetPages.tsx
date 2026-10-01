import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard, KpiRow, Panel } from '@/components/Widgets';
import { Timeline } from '@/components/Flow';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { employees, fmtNum } from '@/mock-data/masters';
import {
  CERT_TYPES, DISPOSAL_METHODS, DISPOSAL_REASONS, NOW, READING_FREQUENCY_DAYS, READING_METHODS, TODAY, certSeed, countSeed, disposalSeed, heavySeed, itemSeed, locationSeed, readingSeed,
  type CertRec, type CountSession, type DisposalRec, type HeavyRec, type ItemRec, type LocationRec, type ReadingRec,
} from './data';
import { FileList, aed, isBlank, num, requireFields, type Errors } from './shared';
import dayjs from 'dayjs';

const REQ_CERT = 'Compliance & Certificates (Asset-Level)';
const REQ_USE = 'Manual Usage & Status Recording';
const REQ_PSV = 'Physical Stock Verification';
const REQ_DSP = 'Asset Disposal / Write-Off';
const NOW_STAMP = `${TODAY} ${NOW.slice(11)}`;
const EMP = employees.map((e) => e.name);
const useHeavy = () => useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
const useAssetOptions = (rows: HeavyRec[]) => rows.map((h) => ({ value: h.assetId, label: `${h.assetId} - ${h.name}` }));
const assetName = (rows: HeavyRec[], assetId: string) => rows.find((h) => h.assetId === assetId)?.name ?? '-';
const NotFound = ({ back, to }: { back: string; to: string }) => { const nav = useNavigate(); return <Page><PageTitle title="Record not found" right={<Button variant="outlined" onClick={() => nav(to)}>Back to {back}</Button>} /></Page>; };

/* ================================================================== Certificates */
export function certStatus(c: Pick<CertRec, 'expiry' | 'leadDays'>): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (c.expiry < TODAY) return { label: 'Expired', tone: 'red' };
  if (dayjs(c.expiry).diff(dayjs(TODAY), 'day') <= c.leadDays) return { label: 'Due Soon', tone: 'amber' };
  return { label: 'Valid', tone: 'green' };
}

export function CertificateList() {
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const [del, setDel] = useState<CertRec | null>(null);
  return (
    <Page>
      <PageTitle title="Compliance and Certificates" change="new" req={REQ_CERT} />
      <DataTable<CertRec>
        rows={certs.rows} searchPlaceholder="Search certificates..."
        filter={{ key: 'type', options: CERT_TYPES }}
        onAdd={() => nav('/inventory/certificates/add')} addLabel="Add Certificate" onRowClick={(r) => nav(`/inventory/certificates/${r.id}`)}
        columns={[
          { key: 'assetId', label: 'Asset', render: (r) => `${r.assetId} - ${assetName(heavy.rows, r.assetId)}` },
          { key: 'type', label: 'Certificate / Document Type' },
          { key: 'expiry', label: 'Expiry Date' },
          { key: 'leadDays', label: 'Reminder Lead Time (days)', align: 'right' },
          { key: 'status', label: 'Status', sortable: false, render: (r) => { const s = certStatus(r); return <StatusChip status={s.label} tone={s.tone} />; } },
        ]}
        actions={[{ label: 'Edit', onClick: (r) => nav(`/inventory/certificates/${r.id}`) }, { label: 'Delete', danger: true, onClick: setDel }]}
      />
      <ConfirmDialog open={!!del} danger title="Delete certificate" description={`Delete the ${del?.type} certificate of ${del?.assetId}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { certs.remove(del.id); toast('Certificate deleted'); } }} />
    </Page>
  );
}

export function CertificateForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const existing = id ? certs.get(id) : undefined;
  const [f, setF] = useState<Record<string, any>>({ assetId: existing?.assetId ?? '', type: existing?.type ?? '', expiry: existing?.expiry ?? '', leadDays: existing ? String(existing.leadDays) : '30', file: existing?.file ?? [] });
  const [errors, setErrors] = useState<Errors>({});
  if (id && !existing) return <NotFound back="Certificates" to="/inventory/certificates" />;
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const e = requireFields(f, ['assetId', 'type', 'expiry', 'leadDays'], { assetId: 'Asset', type: 'Certificate / Document Type', expiry: 'Expiry Date', leadDays: 'Reminder Lead Time' });
    if (!e.leadDays && !(num(f.leadDays) > 0)) e.leadDays = 'Must be greater than 0';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: CertRec = { id: existing?.id ?? `ce${Date.now()}`, assetId: f.assetId, type: f.type, reference: existing?.reference ?? '', expiry: f.expiry, leadDays: Number(f.leadDays), file: f.file,
      history: [{ when: NOW_STAMP, title: existing ? 'Certificate updated' : 'Certificate added', detail: existing ? `Expiry ${existing.expiry} to ${f.expiry}; reminder ${f.leadDays} days` : `${f.type} valid to ${f.expiry}`, by: 'Current User' }, ...(existing?.history ?? [])] };
    if (existing) certs.update(rec.id, rec); else certs.add(rec);
    toast(existing ? 'Certificate updated' : 'Certificate added');
    nav('/inventory/certificates');
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Compliance and Certificates', to: '/inventory/certificates' }, { label: existing ? 'Edit Certificate' : 'Add Certificate' }]}
        actions={<><Button variant="outlined" onClick={() => nav('/inventory/certificates')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid>
          <SelectInput label="Asset" required change="new" req={REQ_CERT} value={f.assetId} options={useAssetOptions(heavy.rows)} onChange={set('assetId')} error={errors.assetId} disabled={!!existing} />
          <SelectInput label="Certificate / Document Type" required change="new" req={REQ_CERT} value={f.type} options={CERT_TYPES} onChange={set('type')} error={errors.type} hint="New document types can be added by an administrator" />
          <DateInput label="Expiry Date" required change="new" req={REQ_CERT} value={f.expiry} onChange={set('expiry')} error={errors.expiry} />
          <NumberInput label="Reminder Lead Time (days before expiry)" required change="new" req={REQ_CERT} value={f.leadDays} onChange={set('leadDays')} error={errors.leadDays} hint="Configurable per certificate" />
          <FileInput label="Document Attachment" change="new" req={REQ_CERT} value={f.file} onChange={set('file')} multiple />
        </FormGrid>
        {existing && (
          <FormSection title="Last Updated By / Edit History" change="new" req={REQ_CERT}>
            <Timeline items={existing.history.map((h) => ({ when: h.when, title: h.title, detail: h.detail, by: h.by, tone: 'blue' as const }))} />
          </FormSection>
        )}
      </Page>
    </>
  );
}

/* ================================================================== Usage readings */
export function ReadingList() {
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const rows = useCollection<ReadingRec>('inventory.readings', readingSeed);
  const [del, setDel] = useState<ReadingRec | null>(null);
  return (
    <Page>
      <PageTitle title="Usage Readings" change="new" req={REQ_USE} subtitle={`Readings are entered manually in this phase. Reading frequency rule to be confirmed with client (${READING_FREQUENCY_DAYS} days assumed for the overdue report).`} />
      <DataTable<ReadingRec>
        rows={rows.rows} searchPlaceholder="Search readings..."
        onAdd={() => nav('/inventory/usage-readings/add')} addLabel="Add Reading" onRowClick={(r) => nav(`/inventory/usage-readings/${r.id}`)}
        columns={[
          { key: 'assetId', label: 'Asset', render: (r) => `${r.assetId} - ${assetName(heavy.rows, r.assetId)}` },
          { key: 'date', label: 'Reading Date/Time', render: (r) => r.date.replace('T', ' ') },
          { key: 'hmr', label: 'Hour Meter Reading', align: 'right', render: (r) => fmtNum(r.hmr) },
          { key: 'by', label: 'Recorded By' },
          { key: 'method', label: 'Entry Method' },
          { key: 'fuel', label: 'Fuel Level', align: 'right', render: (r) => (r.fuel === undefined ? '-' : `${r.fuel}%`) },
          { key: 'source', label: 'Reading Source', sortable: false, render: () => 'Manual' },
        ]}
        actions={[{ label: 'Edit', onClick: (r) => nav(`/inventory/usage-readings/${r.id}`) }, { label: 'Delete', danger: true, onClick: setDel }]}
      />
      <ConfirmDialog open={!!del} danger title="Delete reading" description={`Delete the reading of ${del?.assetId} taken on ${del?.date.replace('T', ' ')}?`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) { rows.remove(del.id); toast('Reading deleted'); } }} />
    </Page>
  );
}

export function ReadingForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const readings = useCollection<ReadingRec>('inventory.readings', readingSeed);
  const existing = id ? readings.get(id) : undefined;
  const [f, setF] = useState<Record<string, any>>({ assetId: existing?.assetId ?? '', date: existing?.date ?? NOW, hmr: existing ? String(existing.hmr) : '', by: existing?.by ?? '', method: existing?.method ?? '', fuel: existing?.fuel === undefined ? '' : String(existing.fuel), notes: existing?.notes ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  if (id && !existing) return <NotFound back="Usage Readings" to="/inventory/usage-readings" />;
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const e = requireFields(f, ['assetId', 'date', 'hmr', 'by'], { assetId: 'Linked Asset', date: 'Reading Date/Time', hmr: 'Hour Meter Reading', by: 'Recorded By' });
    if (!e.hmr && num(f.hmr) < 0) e.hmr = 'Cannot be negative';
    if (!e.hmr && !e.date) {
      const prior = readings.rows.filter((r) => r.assetId === f.assetId && r.id !== existing?.id && r.date < f.date).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prior && num(f.hmr) < prior.hmr) e.hmr = `Cannot be lower than the previous reading (${fmtNum(prior.hmr)} on ${prior.date.slice(0, 10)})`;
    }
    if (!isBlank(f.fuel) && (num(f.fuel) < 0 || num(f.fuel) > 100)) e.fuel = 'Must be between 0 and 100';
    setErrors(e);
    if (Object.keys(e).length) { toast('Please correct the highlighted fields', 'error'); return; }
    const rec: ReadingRec = { id: existing?.id ?? `rd${Date.now()}`, assetId: f.assetId, date: f.date, hmr: Number(f.hmr), by: f.by, method: f.method, fuel: isBlank(f.fuel) ? undefined : Number(f.fuel), notes: f.notes };
    if (existing) readings.update(rec.id, rec); else readings.add(rec);
    toast(existing ? 'Reading updated' : 'Reading recorded');
    nav('/inventory/usage-readings');
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Usage Readings', to: '/inventory/usage-readings' }, { label: existing ? 'Edit Reading' : 'Add Reading' }]}
        actions={<><Button variant="outlined" onClick={() => nav('/inventory/usage-readings')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <FormGrid>
          <SelectInput label="Linked Asset" required change="new" req={REQ_USE} value={f.assetId} options={useAssetOptions(heavy.rows)} onChange={set('assetId')} error={errors.assetId} disabled={!!existing} />
          <DateInput label="Reading Date/Time" required change="new" req={REQ_USE} value={f.date} onChange={set('date')} error={errors.date} />
          <NumberInput label="Hour Meter Reading (HMR)" required change="new" req={REQ_USE} value={f.hmr} onChange={set('hmr')} error={errors.hmr} />
          <SelectInput label="Recorded By" required change="new" req={REQ_USE} value={f.by} options={EMP} onChange={set('by')} error={errors.by} hint="Responsible role to be confirmed with client" />
          <SelectInput label="Entry Method" change="new" req={REQ_USE} value={f.method} options={READING_METHODS} onChange={set('method')} hint="Preferred method to be confirmed with client" />
          <NumberInput label="Fuel Level (%)" change="new" req={REQ_USE} value={f.fuel} onChange={set('fuel')} error={errors.fuel} />
          <TextInput label="Condition Notes" change="new" req={REQ_USE} value={f.notes} onChange={set('notes')} multiline rows={2} full hint="Other details to capture at each reading to be confirmed with client" />
          <TextInput label="Reading Source" change="new" req={REQ_USE} value="Manual" disabled hint="Reserved so a future IoT feed can use the same structure" />
        </FormGrid>
      </Page>
    </>
  );
}

/* ================================================================== Physical stock verification */
const variance = (l: { systemQty: number; countedQty: number | null }) => (l.countedQty === null ? null : l.countedQty - l.systemQty);
const sessionVariances = (s: CountSession) => s.lines.filter((l) => variance(l) !== null && variance(l) !== 0);
const sessionBadge = (s: CountSession) => (s.status === 'In Progress' ? 'In Progress' : s.adjustmentStatus ?? (sessionVariances(s).length ? 'Variance' : 'No Variance'));

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
          { key: 'items', label: 'Items Covered', sortable: false, align: 'right', render: (r) => r.lines.length },
          { key: 'var', label: 'Lines with Variance', sortable: false, align: 'right', render: (r) => sessionVariances(r).length },
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
  const [head, setHead] = useState({ location: existing?.location ?? '', date: existing?.date ?? TODAY, countedBy: existing?.countedBy ?? '' });
  const [lines, setLines] = useState<CountSession['lines']>(existing?.lines ?? []);
  const [errors, setErrors] = useState<Errors>({});
  if (id && (!existing || existing.status !== 'In Progress')) return <NotFound back="Physical Stock Verification" to="/inventory/stock-verification" />;
  const snapshot = (location: string) => {
    const fuel = locs.rows.find((l) => l.name === location)?.type === 'Supplier-Held Location';
    return items.rows.filter((i) => i.tracking !== 'Serialized' && i.category !== 'Service' && (fuel ? i.classification === 'Fuel Trading' : i.classification !== 'Fuel Trading') && i.stock > 0)
      .map((i) => ({ itemId: i.id, code: i.code, name: i.name, unit: i.unit, systemQty: i.stock, countedQty: null as number | null }));
  };
  const save = (complete: boolean) => {
    const e: Errors = {};
    if (isBlank(head.location)) e.location = 'Location is required';
    if (isBlank(head.date)) e.date = 'Date is required';
    if (isBlank(head.countedBy)) e.countedBy = 'Counted By is required';
    if (!lines.length) e.lines = 'Select a location to load the items to count';
    if (complete && lines.some((l) => l.countedQty === null || l.countedQty < 0)) e.lines = 'Enter the physically counted quantity for every item';
    setErrors(e);
    if (Object.keys(e).length) { toast(e.lines ?? 'Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: CountSession = { id: existing?.id ?? `cs${Date.now()}`, number: existing?.number ?? `SCS-26-${String(sessions.rows.length + 1).padStart(5, '0')}`, ...head, status: complete ? 'Completed' : 'In Progress', lines };
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
          <SelectInput label="Location" required change="new" req={REQ_PSV} value={head.location} options={locs.rows.map((l) => l.name)} disabled={!!existing} error={errors.location}
            onChange={(v) => { setHead({ ...head, location: v }); setLines(snapshot(v)); }} hint="System quantity is captured when the session starts" />
          <DateInput label="Date" required change="new" req={REQ_PSV} value={head.date} onChange={(v) => setHead({ ...head, date: v })} error={errors.date} />
          <SelectInput label="Counted By" required change="new" req={REQ_PSV} value={head.countedBy} options={EMP} onChange={(v) => setHead({ ...head, countedBy: v })} error={errors.countedBy} />
        </FormGrid>
        <FormSection title="Items to Count" change="new" req={REQ_PSV}>
          {lines.length === 0 && <Text type="s5" color={errors.lines ? '#C64D4D' : 'theme.secondary.700'}>{errors.lines ?? 'Select a location to load the items to count'}</Text>}
          {lines.length > 0 && (
            <DataTable<CountSession['lines'][number]> hideToolbar rowKey={(r) => r.itemId} rows={lines.map((l) => ({ ...l, id: l.itemId }))} pageSize={20} columns={[
              { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' }, { key: 'unit', label: 'UOM' },
              { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => fmtNum(l.systemQty) },
              { key: 'counted', label: 'Physically Counted Quantity', sortable: false, align: 'right', render: (l) => (
                <input type="number" min={0} value={l.countedQty ?? ''} onChange={(e) => setLines(lines.map((x) => (x.itemId === l.itemId ? { ...x, countedQty: e.target.value === '' ? null : Number(e.target.value) } : x)))}
                  style={{ width: 110, padding: '6px 8px', textAlign: 'right', border: '1px solid #D3D3D4', borderRadius: 4, font: 'inherit' }} />) },
              { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={v > 0 ? `+${v}` : String(v)} tone={v === 0 ? 'green' : 'amber'} />; } },
            ]} />
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
  const s = sessions.get(id);
  if (!s) return <NotFound back="Physical Stock Verification" to="/inventory/stock-verification" />;
  const vars = sessionVariances(s);
  const raise = () => { sessions.update(s.id, { adjustmentNo: `ADJ-26-${String(21 + sessions.rows.length).padStart(5, '0')}`, adjustmentStatus: 'Pending Approval' }); toast('Stock Adjustment raised and sent for approval'); };
  const approve = () => { s.lines.forEach((l) => { if (l.countedQty !== null && variance(l) !== 0) items.update(l.itemId, { stock: l.countedQty }); }); sessions.update(s.id, { adjustmentStatus: 'Approved' }); toast('Stock Adjustment approved, system quantity corrected'); };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Physical Stock Verification', to: '/inventory/stock-verification' }, { label: s.number }]} status={<StatusChip status={sessionBadge(s)} tone={sessionBadge(s) === 'Variance' ? 'amber' : undefined} />}
        actions={<>
          {s.status === 'In Progress' && <Button variant="contained" onClick={() => nav(`/inventory/stock-verification/${s.id}/edit`)}>Continue Counting</Button>}
          {s.status === 'Completed' && vars.length > 0 && !s.adjustmentNo && <Button variant="contained" onClick={raise}>Raise Stock Adjustment</Button>}
          {s.adjustmentStatus === 'Pending Approval' && <Button variant="contained" onClick={approve}>Approve Adjustment</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Stock Count Session" value={s.number} change="new" req={REQ_PSV} />
          <ValueField label="Date" value={s.date} />
          <ValueField label="Location" value={s.location} />
          <ValueField label="Counted By" value={s.countedBy} />
        </ValueGrid>
        <KpiRow><Box sx={{ mt: 3, display: 'contents' }}>
          <KpiCard title="Items Covered" value={s.lines.length} /><KpiCard title="Lines with Variance" value={vars.length} tint={vars.length ? '#FFFAF0' : undefined} />
          <KpiCard title="Stock Adjustment" value={s.adjustmentNo ?? '-'} sub={s.adjustmentStatus ? <>Approval: {s.adjustmentStatus}</> : vars.length ? 'Not raised yet' : 'Not required'} />
        </Box></KpiRow>
        {s.status === 'Completed' && vars.length > 0 && s.adjustmentStatus !== 'Approved' && <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>System quantity is corrected only after the Stock Adjustment is approved. Approval thresholds and roles to be confirmed with client.</Text>}
        <Panel title="Count Result" change="new" req={REQ_PSV}>
          <DataTable<CountSession['lines'][number] & { id: string }> hideToolbar rows={s.lines.map((l) => ({ ...l, id: l.itemId }))} columns={[
            { key: 'code', label: 'Item Code' }, { key: 'name', label: 'Item' }, { key: 'unit', label: 'UOM' },
            { key: 'systemQty', label: 'System Quantity', align: 'right', render: (l) => fmtNum(l.systemQty) },
            { key: 'countedQty', label: 'Physically Counted', align: 'right', render: (l) => (l.countedQty === null ? '-' : fmtNum(l.countedQty)) },
            { key: 'variance', label: 'Variance', align: 'right', sortable: false, render: (l) => { const v = variance(l); return v === null ? '-' : <StatusChip status={v > 0 ? `+${v}` : String(v)} tone={v === 0 ? 'green' : 'amber'} />; } },
          ]} />
        </Panel>
      </Page>
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
