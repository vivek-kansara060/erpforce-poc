import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { masterValues } from '@/modules/crm/data';
import { DataTable, type Column } from '@/components/DataTable';
import { DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard, KpiRow, Panel, TabPanels } from '@/components/Widgets';
import { Timeline } from '@/components/Flow';
import { AppDialog, ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { neutral } from '@/theme/color';
import {
  ACCOUNTS, ASSET_STATUSES, COMPANY, COMPUTATIONS, DEPARTMENTS, DEPRECIATION_METHODS, LOCATION_NAMES, MOVEMENT_PLACES, MOVEMENT_TYPES, NOW, OWNERSHIP, TODAY,
  CERT_TYPES, attributesFor, buildBoard, categorySeed, certSeed, settingsSeed, crossHireSeed, crossHireStatus, isTopCategory, currentLocation, depreciationApplicable, heavySeed, inFleetCount, itemSeed, movementDurations, nextItemCode, nextMovementNo, stockStatusOf,
  type AuditEntry, type BoardRow, type CategoryRec, type CertRec, type CrossHireRec, type InventorySettings, type HeavyRec, type InsuranceEntry, type ItemRec, type Movement,
} from './data';
import { CategorySelect, SubCategorySelect } from './Masters';
import { AssetTypeSelect } from './AssetTypePages';
import { AssetCertificates, AssetReadings } from './AssetPages';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { AttributeFields, AttributeValues, FileList, Note, PhotoBox, PhotoInput, REQ_HE, SerializedFields, SerializedView, aed, num, requireFields, validateAttrs, validateSerialized, type Errors, CertTypeSelect } from './shared';

export const HEAVY_PATH = '/inventory/items/heavy';
const REQ_FA = 'Fixed Asset Register';
const REQ_MV = 'Movement History';
const REQ_CERT_TAB = 'Compliance & Certificates (2 Oct call: on the individual asset)';
const REQ_USE_TAB = 'Manual Usage & Status Recording (2 Oct call: under the individual asset)';
const REQ_NAME = 'Fixed Asset > Asset Name (2 Oct call: suggested, editable by the client)';
const REQ_STATUS = 'Fixed Asset > Asset Status (2 Oct call: set by the system, manual change where needed)';
/** Statuses an asset can be returned to the hire pool from with Mark Ready for Hire. */
const READY_FROM = ['Yard', 'Off Hire', 'Under Maintenance', 'Breakdown', 'Hold'];
const useHeavy = () => useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
const useCrossHires = () => useCollection<CrossHireRec>('inventory.crossHires', crossHireSeed);
const REQ_CH = 'Cross-Hire Assets (2 Oct call: details fetched from the cross-hire record, status from the cross-hire workflow)';
const chLabel = (c: CrossHireRec) => `${c.number} - ${c.supplier} - ${c.category} ${c.subCategory}`;
const tone = (s: string) => (s === 'In Stock' ? 'green' : 'amber') as 'green' | 'amber';

/* ------------------------------------------------------------------ shared tables / widgets */
function BoardTable({ rows }: { rows: BoardRow[] }) {
  const cols: Column<BoardRow>[] = [
    { key: 'period', label: 'Period', width: 90, align: 'right' },
    { key: 'date', label: 'Depreciation Date' },
    { key: 'depreciation', label: 'Depreciation', align: 'right', render: (r) => aed(r.depreciation) },
    { key: 'accumulated', label: 'Accumulated Depreciation', align: 'right', render: (r) => aed(r.accumulated) },
    { key: 'nbv', label: 'Net Book Value', align: 'right', render: (r) => aed(r.nbv) },
    { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ];
  return <DataTable<BoardRow> rows={rows} columns={cols} hideToolbar pageSize={12} emptyText="Enter Asset Value, Purchase Date and Useful Life to preview the depreciation board" />;
}

function MovementTable({ rows }: { rows: Movement[] }) {
  const dur = useMemo(() => movementDurations(rows), [rows]);
  const cols: Column<Movement>[] = [
    { key: 'entryNo', label: 'Movement Entry No.' },
    { key: 'date', label: 'Date/Time', render: (r) => r.date.replace('T', ' ') },
    { key: 'type', label: 'Movement Type' },
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
    { key: 'customer', label: 'Customer', change: 'new', req: REQ_MV, render: (r) => r.customer ?? [r.to, r.from].find((x) => x.startsWith('Client: '))?.replace('Client: ', '') ?? '-' },
    { key: 'project', label: 'Project', change: 'new', req: REQ_MV, render: (r) => r.project ?? '-' },
    { key: 'reference', label: 'Reference (DO / job)' },
    { key: 'dur', label: 'Duration at Location/Project', sortable: false, render: (r) => dur[r.id] },
  ];
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  return <DataTable<Movement> rows={sorted} columns={cols} hideToolbar pageSize={10} emptyText="No movements recorded yet" />;
}

function InsuranceTable({ rows }: { rows: InsuranceEntry[] }) {
  if (!rows.length) return <Text type="s5" color="theme.secondary.700">No insurance entries</Text>;
  return <DataTable<InsuranceEntry & { id: string }> rows={rows.map((r, i) => ({ ...r, id: String(i) }))} hideToolbar pageSize={5} columns={[
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => aed(r.amount) }, { key: 'date', label: 'Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'account', label: 'Account' },
  ]} />;
}

/** Deterministic QR-style cells generated from the Asset ID (Phase 1: scanning shows the Asset ID only). */
const QR_N = 21;
function qrCells(assetId: string): [number, number][] {
  const n = QR_N;
  let h = 0;
  for (const ch of assetId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bit = (x: number, y: number) => { h = (h * 1664525 + 1013904223 + x * 7 + y) >>> 0; return (h >>> 16) & 1; };
  const corners = [[0, 0], [n - 7, 0], [0, n - 7]];
  const finder = (x: number, y: number) => corners.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7 && (x === fx || x === fx + 6 || y === fy || y === fy + 6 || (x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4)));
  const inFinder = (x: number, y: number) => corners.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const out: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inFinder(x, y) ? finder(x, y) : bit(x, y)) out.push([x, y]);
  return out;
}
const qrSvg = (assetId: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${QR_N} ${QR_N}" width="180" height="180" fill="#1F2125" shape-rendering="crispEdges">${qrCells(assetId).map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('')}</svg>`;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
/** Opens a print-ready label (QR, Serialized ID, asset name) in a new window and starts printing. */
function printAssetLabel(assetId: string, name: string, onBlocked: () => void) {
  const w = window.open('', '_blank', 'width=420,height=520');
  if (!w) { onBlocked(); return; }
  w.document.write(`<!doctype html><html><head><title>QR label ${esc(assetId)}</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;padding:24px}.l{border:1px dashed #999;padding:16px 20px;text-align:center;width:240px}.id{font-size:20px;font-weight:bold;margin-top:8px}.n{font-size:12px;color:#444;margin-top:4px}.c{font-size:11px;color:#777;margin-top:8px}</style></head><body><div class="l">${qrSvg(assetId)}<div class="id">${esc(assetId)}</div><div class="n">${esc(name)}</div><div class="c">Gulf Power Rentals LLC</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
function AssetTag({ assetId, name }: { assetId: string; name: string }) {
  const toast = useToast();
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ width: 104, height: 104, p: 0.75, border: `1px solid ${neutral[200]}`, borderRadius: '8px', bgcolor: '#fff' }}>
        <svg viewBox={`0 0 ${QR_N} ${QR_N}`} width="100%" height="100%" fill="#1F2125" shapeRendering="crispEdges">{qrCells(assetId).map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)}</svg>
      </Box>
      <Text type="s5" weight="medium" sx={{ mt: 0.5 }}>{assetId}</Text>
      <Button size="small" variant="text" startIcon={<PrintOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => printAssetLabel(assetId, name, () => toast('Allow pop-ups for this site to print the QR label', 'error'))} sx={{ mt: 0.25, fontSize: 12 }}>Print QR</Button>
    </Box>
  );
}

/* ------------------------------------------------------------------ add / edit */
const blank: Record<string, any> = {
  entity: masterValues('entity')[0], name: '', classification: 'Rental', category: '', subCategory: '', brand: '', model: '', engineNo: '', capacity: '', specification: '', assetType: '',
  purchaseDate: '', putToUseDate: '', assetValue: '', notDepreciable: '0', nbv: '', deprPct: '', deprAmount: '', capex: '',
  initialLocation: '', department: '', status: 'Active', assetStatus: 'Ready for Hire', image: undefined, attachments: [], attrs: {},
  method: 'Straight line', decliningFactor: '', computation: 'Constant periods', usefulLifeYears: '', usefulLifeHours: '', accFixedAsset: '', accDepreciation: '', accExpense: '', journal: ACCOUNTS.journals[0],
  ownership: 'Owned', supplier: '', crossHireIdle: false, insurance: [],
};
const BASIC_KEYS = ['name', 'category', 'assetType', 'brand', 'model', 'engineNo', 'capacity', 'purchaseDate', 'assetValue', 'nbv', 'deprPct', 'deprAmount', 'capex', 'initialLocation', 'putToUseDate', 'notDepreciable'];
/** Suggested asset name built from the record's Category, Sub-Category, Brand and Model. */
const suggestedName = (f: Record<string, any>) => [f.category, f.subCategory, f.brand, f.model].filter(Boolean).join(' ');
const DEP_KEYS = ['method', 'decliningFactor', 'computation', 'usefulLifeYears', 'accFixedAsset', 'accDepreciation', 'accExpense'];
const TRACKED: [string, string][] = [['name', 'Name'], ['assetStatus', 'Asset Status'], ['ownership', 'Ownership Type'], ['assetValue', 'Asset Value'], ['nbv', 'Current Net Book Value'], ['usefulLifeYears', 'Useful Life (Years)'], ['method', 'Depreciation Method'], ['department', 'Department']];

export function HeavyForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const items = useCollection<ItemRec>('items', itemSeed);
  const cats = useCollection<CategoryRec>('inventory.categories', categorySeed);
  const crossHires = useCrossHires();
  const certs = useCollection<CertRec>('inventory.certificates', certSeed);
  const settings = useCollection<InventorySettings>('inventory.settings', settingsSeed);
  const [newCerts, setNewCerts] = useState<{ type: string; reference: string; expiry: string; leadDays: string; file: string[] }[]>([]);
  const setCert = (i: number, p: Partial<(typeof newCerts)[number]>) => setNewCerts(newCerts.map((c, n) => (n === i ? { ...c, ...p } : c)));
  const existing = id ? heavy.get(id) : undefined;
  const code = existing?.code ?? nextItemCode(items.rows.map((r) => r.code), heavy.rows.map((r) => r.code));
  const assetId = existing?.assetId ?? `AST-${1000 + Number(code.replace(/\D/g, ''))}`;
  const [f, setF] = useState<Record<string, any>>(() => (existing ? { ...Object.fromEntries(Object.entries({ ...blank, ...existing }).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v ?? ''])), attrs: existing.attrs, entity: existing.company || masterValues('entity')[0], image: existing.image, nameAuto: existing.name === suggestedName(existing) } : { ...blank, nameAuto: true }));
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState({ key: 0, initial: 0 });
  const [leave, setLeave] = useState(false);
  const upd = (p: Record<string, any>) => setF((x) => ({ ...x, ...p }));
  const set = (k: string) => (v: any) => upd({ [k]: v });
  const attrDefs = attributesFor(cats.rows, f.category, f.subCategory);
  const insurance: InsuranceEntry[] = f.insurance;
  const setIns = (i: number, p: Partial<InsuranceEntry>) => set('insurance')(insurance.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const dep = depreciationApplicable(f.ownership);
  const months = (num(f.usefulLifeYears) || 0) * 12;
  const startDate = f.putToUseDate || f.purchaseDate;
  const catDefault = cats.rows.find((c) => isTopCategory(c) && c.name === f.category)?.depMethod;
  const assetName: string = f.nameAuto ? suggestedName(f) : f.name;
  const crossHired = f.ownership === 'Cross-Hired';
  const linkedCh = crossHires.rows.find((c) => c.heavyId === existing?.id && !!existing);
  const chId: string = f.crossHireId ?? linkedCh?.id ?? '';
  const chRec = crossHires.rows.find((c) => c.id === chId);
  const chOptions = crossHires.rows.filter((c) => (!c.heavyId || c.heavyId === existing?.id) && c.stage !== 'Returned to Supplier').map((c) => ({ value: c.id, label: chLabel(c) }));
  // Picking the cross-hire record fills everything it already knows, so nothing is typed twice.
  const pickCrossHire = (cid: string) => { const c = crossHires.rows.find((x) => x.id === cid); if (!c) return; upd({ crossHireId: cid, supplier: c.supplier, category: c.category, subCategory: c.subCategory, brand: c.brand, brandAuto: false, model: c.model, capacity: c.capacity, engineNo: c.engineNo, initialLocation: c.receivedAt, purchaseDate: c.hireStart, nameAuto: true, attrs: {} }); };

  const board = useMemo(() => buildBoard({ start: startDate, assetValue: num(f.assetValue) || 0, notDepreciable: num(f.notDepreciable) || 0, months, method: f.method, factor: num(f.decliningFactor) || 0 }), [startDate, f.assetValue, f.notDepreciable, months, f.method, f.decliningFactor]);

  const validate = (): Errors => {
    const req = ['entity', 'category', 'assetType', 'ownership'];
    if (!existing) req.push('initialLocation');
    if (dep) req.push('method', 'computation', 'usefulLifeYears', 'accFixedAsset', 'accDepreciation', 'accExpense');
    const e = requireFields(f, req, { assetType: 'Asset Type', initialLocation: 'Initial Location', usefulLifeYears: 'Useful Life (Years)', accFixedAsset: 'Fixed Asset Account', accDepreciation: 'Depreciation Account', accExpense: 'Expense Account', ownership: 'Ownership Type' });
    Object.assign(e, validateSerialized(f, !dep), validateAttrs(attrDefs, f.attrs));
    if (!assetName.trim()) e.name = 'Asset Name is required (or fill in Category, Sub-Category, Brand and Model to get a suggestion)';
    if (dep && !e.usefulLifeYears && num(f.usefulLifeYears) <= 0) e.usefulLifeYears = 'Useful Life must be greater than 0';
    if (dep && f.method === 'Declining' && !(num(f.decliningFactor) > 0)) e.decliningFactor = 'Declining Factor is required';
    if (crossHired && !chId) e.crossHireId = 'Select the cross-hire record this unit came in on';
    if (f.putToUseDate && f.purchaseDate && f.putToUseDate < f.purchaseDate) e.putToUseDate = 'Cannot be before Purchase Date';
    if (dep && num(f.notDepreciable) > num(f.assetValue)) e.notDepreciable = 'Cannot exceed Asset Value';
    if (newCerts.some((c) => !c.type || !c.expiry || !(num(c.leadDays) > 0))) e.certs = 'Complete every certificate (type, expiry date and a reminder lead time greater than 0), or remove it';
    if (insurance.some((x) => !x.amount || !x.date || !x.dueDate || !x.account || x.dueDate < x.date)) e.insurance = 'Complete every insurance entry (amount, date, due date after date, account)';
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    const keys = Object.keys(e);
    if (keys.length) {
      const initial = keys.some((k) => BASIC_KEYS.includes(k) || k.startsWith('attr:')) ? 0 : keys.some((k) => DEP_KEYS.includes(k)) ? 1 : keys.includes('certs') ? (crossHired ? 1 : 4) : 3;
      setTab((t) => ({ key: t.key + 1, initial }));
      toast('Please complete the mandatory fields highlighted on the form', 'error');
      return;
    }
    const n = (k: string) => Number(f[k]);
    const first: Movement = { id: `m${Date.now()}`, entryNo: nextMovementNo(100 + heavy.rows.length), date: `${f.purchaseDate || TODAY}T10:00`, type: dep ? 'Internal Transfer' : 'Cross-Hire Stage Change', from: dep ? 'Purchase Receipt' : `Supplier: ${f.supplier}`, to: f.initialLocation, reference: `GRN-26-${String(heavy.rows.length * 7 + 100).padStart(5, '0')}`, by: 'Current User' };
    const after: Record<string, any> = { ...f, name: assetName.trim() };
    const changed = existing ? TRACKED.filter(([k]) => k !== 'assetStatus' && String((existing as any)[k] ?? '') !== String(after[k] ?? '')).map(([k, l]) => `${l}: ${(existing as any)[k] ?? '-'} to ${after[k] || '-'}`) : [];
    const audit: AuditEntry[] = existing
      ? changed.length ? [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Record updated', detail: changed.join('; '), by: 'Current User' }, ...existing.audit] : existing.audit
      : [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Asset record created', detail: `Asset ID ${assetId} generated`, by: 'Current User' }];
    const displayName = assetName.trim();
    const rec: HeavyRec = {
      id: existing?.id ?? `he${Date.now()}`, code, assetId, name: displayName, classification: 'Rental', tracking: 'Serialized', category: f.category, subCategory: f.subCategory, brand: f.brand, model: f.model, engineNo: f.engineNo, capacity: f.capacity,
      specification: f.specification, assetType: f.assetType, purchaseDate: f.purchaseDate, putToUseDate: f.putToUseDate, assetValue: n('assetValue') || 0, notDepreciable: n('notDepreciable') || 0, nbv: n('nbv') || 0, deprPct: n('deprPct') || 0, deprAmount: n('deprAmount') || 0, capex: n('capex') || 0,
      department: f.department, company: f.entity || COMPANY, status: f.status, assetStatus: existing?.assetStatus ?? (crossHired && chRec ? crossHireStatus[chRec.stage] : 'Ready for Hire'), statusOverride: existing?.statusOverride, method: f.method, decliningFactor: n('decliningFactor') || 0, computation: f.computation, usefulLifeYears: n('usefulLifeYears') || 0, usefulLifeHours: f.usefulLifeHours === '' ? undefined : n('usefulLifeHours'),
      accFixedAsset: f.accFixedAsset, accDepreciation: f.accDepreciation, accExpense: f.accExpense, journal: f.journal, ownership: f.ownership, supplier: crossHired ? chRec?.supplier ?? f.supplier : '', crossHireIdle: crossHired && chRec?.stage === 'Idle at Our Location',
      insurance: crossHired ? [] : insurance, movements: existing?.movements ?? [first], audit, utilization: existing?.utilization ?? 0, idleDays: existing?.idleDays ?? 0, profitability: existing?.profitability ?? 0, attrs: f.attrs, image: f.image, attachments: f.attachments,
    };
    if (existing) heavy.update(existing.id, rec); else heavy.add(rec);
    // Certificates entered while creating the asset are stored against it.
    const approvalOn = !!settings.get('settings')?.certApproval;
    newCerts.forEach((c, i) => certs.add({ id: `ce${Date.now()}-${i}`, assetId, type: c.type, reference: c.reference.trim(), expiry: c.expiry, leadDays: Number(c.leadDays), file: c.file, approval: approvalOn ? 'Pending Approval' : undefined, history: [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Certificate added', detail: `${c.type} valid to ${c.expiry} (added with the asset)`, by: 'Current User' }] }));
    // Link the cross-hire record to this asset (and release a previously linked one).
    crossHires.replace(crossHires.rows.map((c) => (crossHired && c.id === chId ? { ...c, heavyId: rec.id } : c.heavyId === rec.id && c.id !== chId ? { ...c, heavyId: undefined } : c)));
    toast(existing ? 'Heavy equipment fixed asset updated' : 'Heavy equipment fixed asset created');
    nav(`${HEAVY_PATH}/${rec.id}`);
  };

  const basic = (
    <>
      <FormGrid>
        <SelectInput label="Entity" required change="new" req={REQ_HE} value={f.entity} options={masterValues('entity')} onChange={set('entity')} error={errors.entity} hint="The company this asset belongs to, first field as agreed on the 5 Oct call" />
        <SelectInput label="Ownership Type" required change="changed" req={REQ_CH} value={f.ownership} options={OWNERSHIP} onChange={(v) => upd({ ownership: v, ...(v !== 'Cross-Hired' ? { crossHireId: '', supplier: '' } : {}) })} error={errors.ownership} hint="Owned and Spare-Standby units are depreciated; Cross-Hired units are not" />
        {crossHired ? <SelectInput label="Cross-Hire Record" required change="new" req={REQ_CH} value={chId} options={chOptions} onChange={pickCrossHire} error={errors.crossHireId} disabled={!!linkedCh} hint={linkedCh ? 'Linked to this asset' : 'Details below are filled in from the cross-hire record'} /> : <Box />}
        {crossHired && chRec && <TextInput label="Cross-Hire Supplier" change="new" req={REQ_CH} value={chRec.supplier} disabled hint="From the cross-hire record" />}
        {crossHired && chRec && <TextInput label="Hire Period" change="new" req={REQ_CH} value={`${chRec.hireStart} to ${chRec.expectedReturn} (expected return)`} disabled hint="From the cross-hire record" />}
        <AssetTypeSelect value={f.assetType} onChange={set('assetType')} error={errors.assetType} />
        <CategorySelect value={f.category} error={errors.category} req={REQ_HE} disabled={crossHired && !!chRec}
          onChange={(v) => { const dm = cats.rows.find((c) => isTopCategory(c) && c.name === v)?.depMethod; upd({ category: v, subCategory: '', attrs: {}, ...(dm ? { method: dm } : {}), ...followBrand(cats.rows, f, v, '') }); }} />
        <SubCategorySelect category={f.category} value={f.subCategory} req={REQ_HE} disabled={crossHired && !!chRec} onChange={(v) => upd({ subCategory: v, attrs: {}, ...followBrand(cats.rows, f, f.category, v) })} />
        <Box sx={{ position: 'relative' }}>
          <TextInput label="Asset Name" required change="new" req={REQ_NAME} value={assetName} onChange={(v) => upd({ name: v, nameAuto: false })} error={errors.name}
            hint={f.nameAuto ? 'Suggested from Category, Sub-Category, Brand and Model. Type to change it.' : 'Custom name'} />
          {!f.nameAuto && <Button size="small" variant="text" onClick={() => upd({ nameAuto: true })} sx={{ position: 'absolute', top: -6, right: 0, minWidth: 0, px: 0.75, py: 0, fontSize: 12 }}>Use suggested name</Button>}
        </Box>
        <TextInput label="Specification" change="new" req={REQ_FA} value={f.specification} onChange={set('specification')} multiline rows={2} full />
      </FormGrid>
      <AttributeFields defs={attrDefs} values={f.attrs} onChange={set('attrs')} errors={errors} />
      <FormSection title="Equipment and Asset Details" change="new" req={REQ_HE}>
        <SerializedFields f={f} upd={upd} errors={errors} req={REQ_HE} withNotDepreciable hideValues={!dep} />
        <Box sx={{ mt: 2 }}><FormGrid><DateInput label="Put to Use Date" change="new" req={REQ_FA} value={f.putToUseDate} onChange={set('putToUseDate')} error={errors.putToUseDate} /></FormGrid></Box>
      </FormSection>
      <FormSection title="Status and Location" change="new" req={REQ_FA}>
        <FormGrid>
          <TextInput label="Asset Status" change="changed" req={REQ_STATUS} value={existing?.assetStatus ?? (crossHired && chRec ? crossHireStatus[chRec.stage] : 'Ready for Hire')} disabled hint={crossHired ? 'Follows the cross-hire stage' : existing ? 'Set by the system; use Change Status on the asset page when it must be changed by hand' : 'A new asset starts as Ready for Hire'} />
          {existing
            ? <TextInput label="Current Location" change="new" req={REQ_MV} value={currentLocation(existing)} disabled hint="Derived from Movement History, add a movement to change it" />
            : <SelectInput label="Initial Location" required change="new" req={REQ_MV} value={f.initialLocation} options={LOCATION_NAMES} onChange={set('initialLocation')} error={errors.initialLocation} disabled={crossHired && !!chRec} hint={crossHired && chRec ? 'Where the cross-hired unit was received, from the cross-hire record' : 'Creates the first Movement History entry'} />}
          <SelectInput label="Department" value={f.department} options={DEPARTMENTS} onChange={set('department')} />
          <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
        </FormGrid>
        {existing && (
          <Box sx={{ mt: 2 }}>
            <FormGrid cols={3}>
              <TextInput label="Utilization %" change="new" req={REQ_FA} value={`${existing.utilization}%`} disabled hint="Calculated by the system" />
              <TextInput label="Idle Time" change="new" req={REQ_FA} value={`${existing.idleDays} days`} disabled hint="Calculated by the system" />
              <TextInput label={f.ownership === 'Cross-Hired' ? 'Cost and Profitability' : 'Profitability'} change="new" req={REQ_FA} value={aed(existing.profitability)} disabled hint="Calculated by the system" />
            </FormGrid>
          </Box>
        )}
      </FormSection>
      <FormSection title="Photo and Attachments" change="new" req={REQ_HE}>
        <FormGrid>
          <PhotoInput value={f.image} onChange={set('image')} change="new" req={REQ_HE} />
          <FileInput label="Attachments" multiple change="new" req={REQ_HE} value={f.attachments} onChange={set('attachments')} />
        </FormGrid>
      </FormSection>
    </>
  );

  const depreciation = !dep ? (
    <Panel title="Depreciation not applicable" change="new" req={REQ_FA}>
      <Text type="s4" color="theme.secondary.800">Cross-Hired assets never generate a depreciation posting. They are costed and tracked for profitability against the project or client they are allocated to.</Text>
    </Panel>
  ) : (
    <>
      <FormGrid>
        <SelectInput label="Depreciation Method" required change="new" req={REQ_FA} value={f.method} options={DEPRECIATION_METHODS} onChange={set('method')} error={errors.method} hint={catDefault ? `Category override: ${catDefault}` : 'Default is Straight line'} />
        {f.method === 'Declining' ? <NumberInput label="Declining Factor" required change="new" req={REQ_FA} value={f.decliningFactor} onChange={set('decliningFactor')} error={errors.decliningFactor} /> : <Box />}
        <SelectInput label="Computation" required change="new" req={REQ_FA} value={f.computation} options={COMPUTATIONS} onChange={set('computation')} error={errors.computation} />
        <NumberInput label="Useful Life (Years)" required change="new" req={REQ_FA} value={f.usefulLifeYears} onChange={set('usefulLifeYears')} error={errors.usefulLifeYears} />
        <NumberInput label="Useful Life (Hours)" change="new" req={REQ_FA} value={f.usefulLifeHours} onChange={set('usefulLifeHours')} />
        <TextInput label="Duration (months)" change="new" req={REQ_FA} value={months ? String(months) : ''} disabled hint="Useful Life in years x 12" />
        <TextInput label="Depreciation Start Date" change="new" req={REQ_FA} value={startDate} disabled hint="System-set, posting starts from the capitalisation date" />
        <SelectInput label="Journal" change="new" req={REQ_FA} value={f.journal} options={ACCOUNTS.journals} onChange={set('journal')} />
        <SelectInput label="Fixed Asset Account" required change="new" req={REQ_FA} value={f.accFixedAsset} options={ACCOUNTS.fixedAsset} onChange={set('accFixedAsset')} error={errors.accFixedAsset} />
        <SelectInput label="Depreciation Account" required change="new" req={REQ_FA} value={f.accDepreciation} options={ACCOUNTS.depreciation} onChange={set('accDepreciation')} error={errors.accDepreciation} />
        <SelectInput label="Expense Account" required change="new" req={REQ_FA} value={f.accExpense} options={ACCOUNTS.expense} onChange={set('accExpense')} error={errors.accExpense} />
      </FormGrid>
      <FormSection title="Depreciation Board">
        <Note>Depreciation posts automatically every month from the start date, with no manual journal. This is a preview.</Note>
        <BoardTable rows={board} />
      </FormSection>
    </>
  );

  const ownership = (
    <>
      <FormGrid>
        <TextInput label="Depreciation Applicable" change="new" req={REQ_HE} value={dep ? 'Yes' : 'No'} disabled hint="System-derived" />
        <TextInput label="Include in Available Fleet Count" change="new" req={REQ_HE} value={inFleetCount({ ownership: f.ownership, assetStatus: f.assetStatus }) ? 'Yes' : 'No'} disabled hint="System-derived" />
        {!dep && <TextInput label="Cost and Profitability Tracking" change="new" req={REQ_HE} value="Applicable, tracked against project allocation" disabled hint="Used in place of depreciation" full />}
      </FormGrid>
      <FormSection title="Insurance" change="new" req={REQ_FA} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => set('insurance')([...insurance, { amount: '', date: '', dueDate: '', account: ACCOUNTS.insurance[0] }])}>Add Entry</Button>}>
        {insurance.length === 0 && <Text type="s5" color="theme.secondary.700">No insurance entries added</Text>}
        {errors.insurance && <Text type="s5" color="#C64D4D" sx={{ mb: 1 }}>{errors.insurance}</Text>}
        {insurance.map((x, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr 40px', gap: 2, alignItems: 'end', mb: 1.5 }}>
            <NumberInput label="Amount (AED)" value={x.amount} onChange={(v) => setIns(i, { amount: v })} />
            <DateInput label="Date" value={x.date} onChange={(v) => setIns(i, { date: v })} />
            <DateInput label="Due Date" value={x.dueDate} onChange={(v) => setIns(i, { dueDate: v })} />
            <SelectInput label="Account" value={x.account} options={ACCOUNTS.insurance} onChange={(v) => setIns(i, { account: v })} />
            <IconButton size="small" onClick={() => set('insurance')(insurance.filter((_, n) => n !== i))} sx={{ mb: 0.5 }}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}
      </FormSection>
    </>
  );

  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: existing ? `Edit ${existing.code}` : 'Add Heavy Equipment Fixed Asset' }]}
        actions={<><Button variant="text" onClick={() => setLeave(true)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <TabPanels key={tab.key} initial={tab.initial} tabs={[
          { label: 'Basic Details', content: basic },
          { label: 'Depreciation Board', content: depreciation, hidden: crossHired },
          { label: 'Movement History', hidden: crossHired, content: existing ? <><Note>Movement History is filled automatically from Delivery Orders, returns and maintenance status changes.</Note><MovementTable rows={existing.movements} /></> : <><Note>The first entry is created automatically from the Initial Location once the equipment is saved.</Note><MovementTable rows={[]} /></> },
          { label: 'Ownership', content: ownership, hidden: crossHired },
          { label: 'Compliance & Certificates', change: 'new', req: REQ_CERT_TAB, content: existing ? <AssetCertificates assetId={existing.assetId} /> : (
            <FormSection title="Compliance & Certificates" change="new" req={REQ_CERT_TAB} right={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setNewCerts([...newCerts, { type: '', reference: '', expiry: '', leadDays: '30', file: [] }])}>Add Certificate</Button>}>
              <Note>Add the certificates that come with the purchase (insurance, warranty, registration, inspection). More can be added or edited later on the asset page.</Note>
              {errors.certs && <Text type="s5" color="#C64D4D" sx={{ mb: 1 }}>{errors.certs}</Text>}
              {newCerts.length === 0 && <Text type="s5" color="theme.secondary.700">No certificates added</Text>}
              {newCerts.map((c, i) => (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 0.8fr 1.6fr 40px', gap: 2, alignItems: 'end', mb: 1.5 }}>
                  <CertTypeSelect value={c.type} onChange={(v) => setCert(i, { type: v })} req={REQ_CERT_TAB} />
                  <TextInput label="Reference" value={c.reference} onChange={(v) => setCert(i, { reference: v })} />
                  <DateInput label="Expiry Date" required value={c.expiry} onChange={(v) => setCert(i, { expiry: v })} />
                  <NumberInput label="Reminder (days)" required value={c.leadDays} onChange={(v) => setCert(i, { leadDays: v })} />
                  <FileInput label="Document" value={c.file} onChange={(v) => setCert(i, { file: v })} />
                  <IconButton size="small" onClick={() => setNewCerts(newCerts.filter((_, n) => n !== i))} sx={{ mb: 0.5 }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Box>
              ))}
            </FormSection>
          ) },
        ]} />
      </Page>
      <ConfirmDialog open={leave} info title="Discard changes" description="Leave this form? Unsaved changes will be lost." confirmLabel="Leave" onClose={() => setLeave(false)} onConfirm={() => nav('/inventory/items')} />
    </>
  );
}

/* ------------------------------------------------------------------ cross-hire panel (view) */
function CrossHirePanel({ ch, returned, onStage }: { ch?: CrossHireRec; returned: boolean; onStage: (s: CrossHireRec['stage']) => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!ch) return <Panel title="Cross-Hire" change="new" req={REQ_CH}><Text type="s5" color="theme.secondary.700">No cross-hire record is linked to this asset. Edit the asset and select the cross-hire record it came in on.</Text></Panel>;
  return (
    <>
      {returned && <Panel sx={{ mb: 2, bgcolor: '#F4F5F7' }}><Text type="s4" weight="medium">Hire ended: returned to {ch.supplier} on {ch.returnedOn}.</Text><Text type="s5" color="theme.secondary.700">The unit is no longer in the active fleet. The record is kept for history.</Text></Panel>}
      <Panel title="Cross-Hire Details" change="new" req={REQ_CH} right={!returned && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {ch.stage === 'On Hire' && <Button size="small" variant="outlined" onClick={() => onStage('Idle at Our Location')}>Returned to Us (Idle)</Button>}
          {ch.stage !== 'On Hire' && <Button size="small" variant="contained" onClick={() => setConfirm(true)}>Return to Supplier</Button>}
        </Box>
      )}>
        <ValueGrid cols={4}>
          <ValueField label="Cross-Hire Record" value={ch.number} />
          <ValueField label="Supplier" value={ch.supplier} />
          <ValueField label="Stage" value={<StatusChip status={ch.stage} tone={returned ? 'grey' : ch.stage === 'On Hire' ? 'blue' : ch.stage === 'Idle at Our Location' ? 'amber' : 'green'} />} />
          <ValueField label="Received At" value={ch.receivedAt} />
          <ValueField label="Hire Start" value={ch.hireStart} />
          <ValueField label={returned ? 'Returned On' : 'Expected Return'} value={returned ? ch.returnedOn : ch.expectedReturn} />
          <ValueField label="Supplier Rate" value={`${aed(ch.monthlyRate)} per month`} />
        </ValueGrid>
        {!returned && <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>{ch.stage === 'On Hire' ? 'The unit is with a client. When the client returns it, mark it Returned to Us (Idle), then return it to the supplier.' : 'The unit is at our location. Return it to the supplier to end the hire.'} Depreciation and movement history do not apply to cross-hired units.</Text>}
      </Panel>
      <ConfirmDialog open={confirm} title="Return to supplier" description={`End the hire ${ch.number} and return the unit to ${ch.supplier}? The asset is marked Inactive and leaves the active fleet.`} confirmLabel="Return to Supplier" onClose={() => setConfirm(false)} onConfirm={() => onStage('Returned to Supplier')} />
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function HeavyView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const loc = useLocation();
  const heavy = useHeavy();
  const cats = useCollection<CategoryRec>('inventory.categories', categorySeed);
  const r = heavy.get(id);
  const crossHires = useCrossHires();
  const [statusDlg, setStatusDlg] = useState(false);
  const [sf, setSf] = useState({ to: '', reason: '' });
  const [sfErr, setSfErr] = useState<Errors>({});
  const board = useMemo(() => (r ? buildBoard({ start: r.putToUseDate || r.purchaseDate, assetValue: r.assetValue, notDepreciable: r.notDepreciable, months: r.usefulLifeYears * 12, method: r.method, factor: r.decliningFactor }) : []), [r]);
  if (!r) return <Page><PageTitle title="Heavy equipment fixed asset not found" right={<Button variant="outlined" onClick={() => nav('/inventory/items')}>Back to Items</Button>} /></Page>;
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  const stock = stockStatusOf(r);
  const setStatus = (to: string, reason: string) => {
    const maint = ['Under Maintenance', 'Breakdown'];
    const mv: Movement | undefined = maint.includes(to) && !maint.includes(r.assetStatus) ? { id: `m${Date.now()}`, entryNo: nextMovementNo(300 + r.movements.length), date: NOW, type: 'Sent for Repair', from: currentLocation(r), to: 'Workshop: Al Masaood Service Centre', reference: `Maintenance: ${reason}`, by: 'Current User' }
      : to === 'Ready for Hire' && maint.includes(r.assetStatus) ? { id: `m${Date.now()}`, entryNo: nextMovementNo(300 + r.movements.length), date: NOW, type: 'Internal Transfer', from: currentLocation(r), to: 'Jebel Ali Main Yard', reference: `Maintenance completed: ${reason}`, by: 'Current User' } : undefined;
    heavy.update(r.id, { ...(mv ? { movements: [...r.movements, mv] } : {}), assetStatus: to, statusOverride: { by: 'Current User', when: `${TODAY} ${NOW.slice(11)}`, reason }, audit: [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Asset Status changed manually', detail: `${r.assetStatus} to ${to}: ${reason}`, by: 'Current User' }, ...r.audit] });
    toast(`Asset Status changed to ${to}`);
  };
  const crossHired = r.ownership === 'Cross-Hired';
  const ch = crossHires.rows.find((c) => c.heavyId === r.id);
  const returned = ch?.stage === 'Returned to Supplier';
  const canReady = !crossHired && r.status === 'Active' && READY_FROM.includes(r.assetStatus);
  const stamp = `${TODAY} ${NOW.slice(11)}`;
  /** Cross-hire stage changes drive the asset's status; returning to the supplier ends the hire and the unit leaves the active fleet. */
  const moveStage = (stage: CrossHireRec['stage']) => {
    if (!ch) return;
    crossHires.update(ch.id, { stage, ...(stage === 'Returned to Supplier' ? { returnedOn: TODAY } : {}) });
    heavy.update(r.id, {
      assetStatus: crossHireStatus[stage], crossHireIdle: stage === 'Idle at Our Location', statusOverride: undefined,
      ...(stage === 'Returned to Supplier' ? { status: 'Inactive' as const } : {}),
      audit: [{ when: stamp, title: `Cross-hire stage: ${stage}`, detail: `${ch.number}; Asset Status ${r.assetStatus} to ${crossHireStatus[stage]}${stage === 'Returned to Supplier' ? '; asset marked Inactive' : ''}`, by: 'Current User' }, ...r.audit],
    });
    toast(stage === 'Returned to Supplier' ? 'Returned to supplier. The hire has ended and the unit is no longer in the active fleet' : `Cross-hire stage changed to ${stage}`);
  };
  const dep = depreciationApplicable(r.ownership);
  const attrDefs = attributesFor(cats.rows, r.category, r.subCategory);
  const tabs = crossHired ? ['Basic Details', 'Cross-Hire', 'Compliance & Certificates', 'Usage Readings'] : ['Basic Details', 'Depreciation Board', 'Movement History', 'Ownership', 'Compliance & Certificates', 'Usage Readings'];
  const initial = Math.max(0, tabs.indexOf((loc.state as any)?.tab));
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: `ID: ${r.assetId}` }]}
        status={<><StatusChip status={r.status} /><StatusChip status={stock} tone={tone(stock)} /></>}
        actions={<>
          <Button variant="outlined" onClick={() => { heavy.update(r.id, { status: flip }); toast(`Marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          {!crossHired && r.assetStatus !== 'Disposed' && <Button variant="outlined" onClick={() => setStatusDlg(true)}>Change Status</Button>}
          {!crossHired && r.assetStatus !== 'Disposed' && r.status === 'Active' && <Button variant="outlined" onClick={() => nav(`/inventory/disposals/add?asset=${r.assetId}`)}>Disposal Request</Button>}
          {canReady && <Button variant="outlined" color="success" onClick={() => setStatus('Ready for Hire', 'Checked in the yard and ready for the next hire')}>Mark Ready for Hire</Button>}
          <Button variant="contained" onClick={() => nav(`${HEAVY_PATH}/${r.id}/edit`)}>Edit</Button>
        </>}
      />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3 }}>
          <PhotoBox src={r.image} size={132} />
          <Box sx={{ flex: 1 }}>
            <Text type="h3" weight="medium" sx={{ mb: 2 }}>{r.name}</Text>
            <ValueGrid cols={4}>
              <ValueField label="Serialized ID" value={r.assetId} change="new" req={REQ_FA} />
              <ValueField label="Asset Type" value={r.assetType} change="new" req={REQ_FA} />
              <ValueField label="Category" value={r.category} change="new" req={REQ_HE} />
              <ValueField label="Sub-Category" value={r.subCategory} change="new" req={REQ_HE} />
              <ValueField label="Entity" value={r.company} change="new" req={REQ_HE} />
              <ValueField label="Asset Status" change="changed" req={REQ_STATUS} value={<><StatusChip status={r.assetStatus} /><Text type="s5" color="theme.secondary.700" sx={{ mt: 0.5 }}>{crossHired ? 'Follows the cross-hire stage' : r.statusOverride ? `Set manually by ${r.statusOverride.by} on ${r.statusOverride.when}: ${r.statusOverride.reason}` : 'Set by the system (delivery, return, cross-hire, disposal)'}</Text></>} />
              <ValueField label="Current Location" value={currentLocation(r)} change="new" req={REQ_MV} />
            </ValueGrid>
          </Box>
          <AssetTag assetId={r.assetId} name={r.name} />
        </Box>
        <TabPanels key={loc.key} initial={initial} tabs={[
          { label: 'Basic Details', content: (
            <>
              {attrDefs.length > 0 && <Panel title="Category Attributes" change="new" req="Category Master > Custom Attributes" sx={{ mb: 2 }}><AttributeValues defs={attrDefs} values={r.attrs} /></Panel>}
              <Panel title="Equipment and Asset Details" change="new" req={REQ_HE}>
                <SerializedView r={r} req={REQ_HE} hideValues={crossHired} />
                <Box sx={{ mt: 3 }}>
                  <ValueGrid cols={4}>
                    <ValueField label="Put to Use Date" value={r.putToUseDate} change="new" req={REQ_FA} />
                    <ValueField label="Department" value={r.department} change="new" req={REQ_FA} />
                    <ValueField label="Specification" value={r.specification} change="new" req={REQ_FA} />
                  </ValueGrid>
                </Box>
              </Panel>
              <Panel title="Asset Performance (calculated)" change="new" req={REQ_FA} sx={{ mt: 2 }}>
                <ValueGrid cols={4}>
                  <ValueField label="Utilization %" value={`${r.utilization}%`} />
                  <ValueField label="Idle Time" value={`${r.idleDays} days`} />
                  <ValueField label={dep ? 'Profitability (to date)' : 'Cost and Profitability (to date)'} value={aed(r.profitability)} />
                </ValueGrid>
              </Panel>
              <Panel title="Attachments" change="new" req={REQ_HE} sx={{ mt: 2 }}><FileList names={r.attachments} /></Panel>
              <Panel title="Audit Trail" change="new" req={REQ_FA} sx={{ mt: 2 }}>
                <Timeline items={r.audit.map((a) => ({ when: a.when, title: a.title, detail: a.detail, by: a.by, tone: 'blue' as const }))} />
              </Panel>
            </>
          ) },
          { label: 'Cross-Hire', hidden: !crossHired, change: 'new', req: REQ_CH, content: <CrossHirePanel ch={ch} returned={returned} onStage={moveStage} /> },
          { label: 'Depreciation Board', hidden: crossHired, content: !dep ? (
            <Panel title="Depreciation not applicable" change="new" req={REQ_FA}><Text type="s4" color="theme.secondary.800">Cross-Hired assets never generate a depreciation posting. Cost and profitability are tracked against the allocated project instead.</Text></Panel>
          ) : (
            <>
              <KpiRow>
                <KpiCard title="Asset Value" value={aed(r.assetValue)} />
                <KpiCard title="Current Net Book Value" value={aed(r.nbv)} />
                <KpiCard title="Total Depreciation" value={aed(r.deprAmount)} sub={`${r.deprPct}% of asset value`} />
                <KpiCard title="Useful Life" value={`${r.usefulLifeYears} years`} sub={`${r.method}${r.usefulLifeHours ? `, ${r.usefulLifeHours.toLocaleString('en-US')} hours` : ''}`} />
              </KpiRow>
              <Panel title="Depreciation Settings" sx={{ mb: 2 }}>
                <ValueGrid cols={4}>
                  <ValueField label="Depreciation Method" value={r.method} change="new" req={REQ_FA} />
                  {r.method === 'Declining' && <ValueField label="Declining Factor" value={String(r.decliningFactor)} change="new" req={REQ_FA} />}
                  <ValueField label="Computation" value={r.computation} change="new" req={REQ_FA} />
                  <ValueField label="Depreciation Start Date" value={r.putToUseDate || r.purchaseDate} change="new" req={REQ_FA} />
                  <ValueField label="Fixed Asset Account" value={r.accFixedAsset} change="new" req={REQ_FA} />
                  <ValueField label="Depreciation Account" value={r.accDepreciation} change="new" req={REQ_FA} />
                  <ValueField label="Expense Account" value={r.accExpense} change="new" req={REQ_FA} />
                  <ValueField label="Journal" value={r.journal} change="new" req={REQ_FA} />
                </ValueGrid>
              </Panel>
              <BoardTable rows={board} />
            </>
          ) },
          { label: 'Movement History', hidden: crossHired, content: (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Text type="s5" color="theme.secondary.700">Automatic log from Delivery Orders, returns and maintenance. Current Location is the destination of the latest entry.</Text>
              </Box>
              <MovementTable rows={r.movements} />
            </>
          ) },
          { label: 'Ownership', hidden: crossHired, content: (
            <>
              <ValueGrid cols={4}>
                <ValueField label="Ownership Type" value={r.ownership} change="new" req={REQ_HE} />
                {r.ownership === 'Cross-Hired' && <ValueField label="Cross-Hire Supplier" value={r.supplier} change="new" req={REQ_HE} />}
                {r.ownership === 'Cross-Hired' && <ValueField label="Cross-Hire Idle" value={r.crossHireIdle ? <StatusChip status="Idle" /> : 'No'} change="new" req={REQ_HE} />}
                <ValueField label="Depreciation Applicable" value={dep ? 'Yes' : 'No'} change="new" req={REQ_HE} />
                <ValueField label="Include in Available Fleet Count" value={inFleetCount(r) ? 'Yes' : 'No'} change="new" req={REQ_HE} />
                {!dep && <ValueField label="Cost and Profitability Tracking" value="Applicable" change="new" req={REQ_HE} />}
              </ValueGrid>
              <Panel title="Insurance" change="new" req={REQ_FA} sx={{ mt: 3 }}><InsuranceTable rows={r.insurance} /></Panel>
            </>
          ) },
          { label: 'Compliance & Certificates', change: 'new', req: REQ_CERT_TAB, content: <AssetCertificates assetId={r.assetId} /> },
          { label: 'Usage Readings', change: 'new', req: REQ_USE_TAB, content: <AssetReadings assetId={r.assetId} /> },
        ]} />
      </Page>
      <AppDialog open={statusDlg} title="Change Asset Status" onClose={() => { setStatusDlg(false); setSf({ to: '', reason: '' }); setSfErr({}); }} confirmLabel="Change Status"
        onConfirm={() => {
          const e: Errors = {};
          if (!sf.to) e.to = 'New Asset Status is required';
          else if (sf.to === r.assetStatus) e.to = 'The asset already has this status';
          if (!sf.reason.trim()) e.reason = 'Reason is required for a manual change';
          setSfErr(e);
          if (Object.keys(e).length) return;
          setStatus(sf.to, sf.reason.trim());
          setStatusDlg(false); setSf({ to: '', reason: '' });
        }}>
        <Text type="s5" color="theme.secondary.700" sx={{ mb: 2 }}>Asset Status is normally set by the system from deliveries, returns, cross-hire and disposal. Use this only when the business process needs a manual change, for example after a yard check. Disposed is set only by an approved Disposal Request.</Text>
        <FormGrid cols={1}>
          <TextInput label="Current Asset Status" value={r.assetStatus} disabled />
          <SelectInput label="New Asset Status" required change="new" req={REQ_STATUS} value={sf.to} options={ASSET_STATUSES.filter((s) => s !== 'Disposed')} onChange={(v) => setSf({ ...sf, to: v })} error={sfErr.to} />
          <TextInput label="Reason" required change="new" req={REQ_STATUS} value={sf.reason} onChange={(v) => setSf({ ...sf, reason: v })} error={sfErr.reason} multiline rows={2} />
        </FormGrid>
      </AppDialog>
    </>
  );
}
