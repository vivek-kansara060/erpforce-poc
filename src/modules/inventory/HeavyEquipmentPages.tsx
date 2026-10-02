import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { CheckInput, DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard, KpiRow, Panel, TabPanels } from '@/components/Widgets';
import { Timeline } from '@/components/Flow';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { Text } from '@/components/Text';
import { getCollection, useCollection } from '@/store/store';
import { suppliers } from '@/mock-data/masters';
import { neutral } from '@/theme/color';
import {
  ACCOUNTS, ASSET_STATUSES, ASSET_TYPES, COMPANY, COMPUTATIONS, DEPARTMENTS, DEPRECIATION_METHODS, LOCATION_NAMES, MOVEMENT_PLACES, MOVEMENT_TYPES, NOW, OWNERSHIP, TODAY,
  attributesFor, buildBoard, categoryOptions, categorySeed, currentLocation, depreciationApplicable, heavySeed, inFleetCount, itemSeed, movementDurations, nextItemCode, nextMovementNo, stockStatusOf, subCategoriesOf, topCategories,
  type AuditEntry, type BoardRow, type DisposalRec, type CategoryRec, type HeavyRec, type InsuranceEntry, type ItemRec, type Movement,
} from './data';
import { AttributeFields, AttributeValues, FileList, Note, PhotoBox, PhotoInput, REQ_HE, SerializedFields, SerializedView, aed, num, requireFields, validateAttrs, validateSerialized, type Errors } from './shared';

export const HEAVY_PATH = '/inventory/items/heavy';
const REQ_ITEM_CODE = 'Item Master > Item Code';
const REQ_FA = 'Fixed Asset Register';
const REQ_MV = 'Movement History';
const useHeavy = () => useCollection<HeavyRec>('inventory.heavyEquipment', heavySeed);
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
    { key: 'reference', label: 'Reference' },
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

/** Deterministic QR-style tag generated from the Asset ID (Phase 1: scanning shows the Asset ID only). */
function AssetTag({ assetId }: { assetId: string }) {
  const n = 21;
  let h = 0;
  for (const ch of assetId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bit = (x: number, y: number) => { h = (h * 1664525 + 1013904223 + x * 7 + y) >>> 0; return (h >>> 16) & 1; };
  const corners = [[0, 0], [n - 7, 0], [0, n - 7]];
  const finder = (x: number, y: number) => corners.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7 && (x === fx || x === fx + 6 || y === fy || y === fy + 6 || (x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4)));
  const inFinder = (x: number, y: number) => corners.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const cells: JSX.Element[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inFinder(x, y) ? finder(x, y) : bit(x, y)) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ width: 104, height: 104, p: 0.75, border: `1px solid ${neutral[200]}`, borderRadius: '8px', bgcolor: '#fff' }}>
        <svg viewBox={`0 0 ${n} ${n}`} width="100%" height="100%" fill="#1F2125" shapeRendering="crispEdges">{cells}</svg>
      </Box>
      <Text type="s5" weight="medium" sx={{ mt: 0.5 }}>{assetId}</Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ add / edit */
const blank: Record<string, any> = {
  name: '', classification: 'Rental', category: '', subCategory: '', brand: '', model: '', engineNo: '', capacity: '', specification: '', assetType: '',
  purchaseDate: '', putToUseDate: '', assetValue: '', notDepreciable: '0', nbv: '', deprPct: '', deprAmount: '', capex: '',
  initialLocation: '', department: '', status: 'Active', assetStatus: 'Ready for Hire', image: undefined, attachments: [], attrs: {},
  method: 'Straight line', decliningFactor: '', computation: 'Constant periods', usefulLifeYears: '', usefulLifeHours: '', accFixedAsset: '', accDepreciation: '', accExpense: '', journal: ACCOUNTS.journals[0],
  ownership: 'Owned', supplier: '', crossHireIdle: false, insurance: [],
};
const BASIC_KEYS = ['name', 'category', 'assetType', 'brand', 'model', 'engineNo', 'capacity', 'purchaseDate', 'assetValue', 'nbv', 'deprPct', 'deprAmount', 'capex', 'initialLocation', 'assetStatus', 'putToUseDate', 'notDepreciable'];
const DEP_KEYS = ['method', 'decliningFactor', 'computation', 'usefulLifeYears', 'accFixedAsset', 'accDepreciation', 'accExpense'];
const TRACKED: [string, string][] = [['name', 'Name'], ['assetStatus', 'Asset Status'], ['ownership', 'Ownership Type'], ['assetValue', 'Asset Value'], ['nbv', 'Current Net Book Value'], ['usefulLifeYears', 'Useful Life (Years)'], ['method', 'Depreciation Method'], ['department', 'Department']];

export function HeavyForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const items = useCollection<ItemRec>('items', itemSeed);
  const cats = useCollection<CategoryRec>('inventory.categories', categorySeed);
  const supplierRows = useCollection('suppliers', suppliers);
  const existing = id ? heavy.get(id) : undefined;
  const code = existing?.code ?? nextItemCode(items.rows.map((r) => r.code), heavy.rows.map((r) => r.code));
  const assetId = existing?.assetId ?? `AST-${1000 + Number(code.replace(/\D/g, ''))}`;
  const [f, setF] = useState<Record<string, any>>(() => (existing ? { ...Object.fromEntries(Object.entries({ ...blank, ...existing }).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v ?? ''])), attrs: existing.attrs, image: existing.image } : blank));
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState({ key: 0, initial: 0 });
  const [leave, setLeave] = useState(false);
  const upd = (p: Record<string, any>) => setF((x) => ({ ...x, ...p }));
  const set = (k: string) => (v: any) => upd({ [k]: v });
  const subs = subCategoriesOf(cats.rows, f.category);
  const attrDefs = attributesFor(cats.rows, f.category, f.subCategory);
  const insurance: InsuranceEntry[] = f.insurance;
  const setIns = (i: number, p: Partial<InsuranceEntry>) => set('insurance')(insurance.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const dep = depreciationApplicable(f.ownership);
  const months = (num(f.usefulLifeYears) || 0) * 12;
  const startDate = f.putToUseDate || f.purchaseDate;
  const catDefault = cats.rows.find((c) => c.level === 1 && c.name === f.category)?.depMethod;

  const board = useMemo(() => buildBoard({ start: startDate, assetValue: num(f.assetValue) || 0, notDepreciable: num(f.notDepreciable) || 0, months, method: f.method, factor: num(f.decliningFactor) || 0 }), [startDate, f.assetValue, f.notDepreciable, months, f.method, f.decliningFactor]);

  const validate = (): Errors => {
    const req = ['category', 'assetType', 'assetStatus', 'ownership'];
    if (!existing) req.push('initialLocation');
    if (dep) req.push('method', 'computation', 'usefulLifeYears', 'accFixedAsset', 'accDepreciation', 'accExpense');
    const e = requireFields(f, req, { assetType: 'Asset Type', assetStatus: 'Asset Status', initialLocation: 'Initial Location', usefulLifeYears: 'Useful Life (Years)', accFixedAsset: 'Fixed Asset Account', accDepreciation: 'Depreciation Account', accExpense: 'Expense Account', ownership: 'Ownership Type' });
    Object.assign(e, validateSerialized(f, !dep), validateAttrs(attrDefs, f.attrs));
    if (f.assetStatus === 'Disposed' && existing?.assetStatus !== 'Disposed' && !getCollection<DisposalRec>('inventory.disposals').some((d) => d.assetId === assetId && d.status === 'Approved')) e.assetStatus = 'Disposed requires an Approved Disposal Request';
    if (dep && !e.usefulLifeYears && num(f.usefulLifeYears) <= 0) e.usefulLifeYears = 'Useful Life must be greater than 0';
    if (dep && f.method === 'Declining' && !(num(f.decliningFactor) > 0)) e.decliningFactor = 'Declining Factor is required';
    if (f.ownership === 'Cross-Hired' && !f.supplier) e.supplier = 'Cross-Hire Supplier is required';
    if (f.putToUseDate && f.purchaseDate && f.putToUseDate < f.purchaseDate) e.putToUseDate = 'Cannot be before Purchase Date';
    if (dep && num(f.notDepreciable) > num(f.assetValue)) e.notDepreciable = 'Cannot exceed Asset Value';
    if (insurance.some((x) => !x.amount || !x.date || !x.dueDate || !x.account || x.dueDate < x.date)) e.insurance = 'Complete every insurance entry (amount, date, due date after date, account)';
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    const keys = Object.keys(e);
    if (keys.length) {
      const initial = keys.some((k) => BASIC_KEYS.includes(k) || k.startsWith('attr:')) ? 0 : keys.some((k) => DEP_KEYS.includes(k)) ? 1 : 3;
      setTab((t) => ({ key: t.key + 1, initial }));
      toast('Please complete the mandatory fields highlighted on the form', 'error');
      return;
    }
    const n = (k: string) => Number(f[k]);
    const first: Movement = { id: `m${Date.now()}`, entryNo: nextMovementNo(100 + heavy.rows.length), date: `${f.purchaseDate || TODAY}T10:00`, type: dep ? 'Internal Transfer' : 'Cross-Hire Stage Change', from: dep ? 'Purchase Receipt' : `Supplier: ${f.supplier}`, to: f.initialLocation, reference: `GRN-26-${String(heavy.rows.length * 7 + 100).padStart(5, '0')}`, by: 'Current User' };
    const changed = existing ? TRACKED.filter(([k]) => String((existing as any)[k] ?? '') !== String(f[k] ?? '')).map(([k, l]) => `${l}: ${(existing as any)[k] ?? '-'} to ${f[k] || '-'}`) : [];
    const audit: AuditEntry[] = existing
      ? changed.length ? [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Record updated', detail: changed.join('; '), by: 'Current User' }, ...existing.audit] : existing.audit
      : [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Asset record created', detail: `Asset ID ${assetId} generated`, by: 'Current User' }];
    // No name is typed in: the display name is built from Category, Sub-Category, Brand and Model (an existing record keeps its name unless one of those changes).
    const unchanged = !!existing && existing.category === f.category && existing.subCategory === f.subCategory && existing.brand === f.brand && existing.model === f.model;
    const displayName = unchanged ? existing!.name : [f.category, f.subCategory, f.brand, f.model].filter(Boolean).join(' ');
    const rec: HeavyRec = {
      id: existing?.id ?? `he${Date.now()}`, code, assetId, name: displayName, classification: 'Rental', tracking: 'Serialized', category: f.category, subCategory: f.subCategory, brand: f.brand, model: f.model, engineNo: f.engineNo, capacity: f.capacity,
      specification: f.specification, assetType: f.assetType, purchaseDate: f.purchaseDate, putToUseDate: f.putToUseDate, assetValue: n('assetValue') || 0, notDepreciable: n('notDepreciable') || 0, nbv: n('nbv') || 0, deprPct: n('deprPct') || 0, deprAmount: n('deprAmount') || 0, capex: n('capex') || 0,
      department: f.department, company: COMPANY, status: f.status, assetStatus: f.assetStatus, method: f.method, decliningFactor: n('decliningFactor') || 0, computation: f.computation, usefulLifeYears: n('usefulLifeYears') || 0, usefulLifeHours: f.usefulLifeHours === '' ? undefined : n('usefulLifeHours'),
      accFixedAsset: f.accFixedAsset, accDepreciation: f.accDepreciation, accExpense: f.accExpense, journal: f.journal, ownership: f.ownership, supplier: f.ownership === 'Cross-Hired' ? f.supplier : '', crossHireIdle: f.ownership === 'Cross-Hired' && !!f.crossHireIdle,
      insurance, movements: existing?.movements ?? [first], audit, utilization: existing?.utilization ?? 0, idleDays: existing?.idleDays ?? 0, profitability: existing?.profitability ?? 0, attrs: f.attrs, image: f.image, attachments: f.attachments,
    };
    if (existing) heavy.update(existing.id, rec); else heavy.add(rec);
    toast(existing ? 'Heavy equipment fixed asset updated' : 'Heavy equipment fixed asset created');
    nav(`${HEAVY_PATH}/${rec.id}`);
  };

  const basic = (
    <>
      <FormGrid>
        <SelectInput label="Asset Type" required change="new" req={REQ_FA} value={f.assetType} options={ASSET_TYPES} onChange={set('assetType')} error={errors.assetType} />
        <SelectInput label="Category" required change="new" req={REQ_HE} value={f.category} options={categoryOptions(cats.rows, 'Heavy Equipment', f.category)} error={errors.category}
          onChange={(v) => upd({ category: v, subCategory: '', attrs: {}, ...(cats.rows.find((c) => c.level === 1 && c.name === v)?.depMethod ? { method: cats.rows.find((c) => c.level === 1 && c.name === v)!.depMethod } : {}) })} />
        <SelectInput label="Sub-Category" change="new" req={REQ_HE} value={f.subCategory} options={subs} disabled={!f.category || subs.length === 0} hint="Optional, depends on Category" onChange={(v) => upd({ subCategory: v, attrs: {} })} />
        <TextInput label="Specification" change="new" req={REQ_FA} value={f.specification} onChange={set('specification')} multiline rows={2} full />
      </FormGrid>
      <AttributeFields defs={attrDefs} values={f.attrs} onChange={set('attrs')} errors={errors} />
      <FormSection title="Equipment and Asset Details" change="new" req={REQ_HE}>
        <SerializedFields f={f} upd={upd} errors={errors} req={REQ_HE} withNotDepreciable hideValues={!dep} />
        <Box sx={{ mt: 2 }}><FormGrid><DateInput label="Put to Use Date" change="new" req={REQ_FA} value={f.putToUseDate} onChange={set('putToUseDate')} error={errors.putToUseDate} /></FormGrid></Box>
      </FormSection>
      <FormSection title="Status and Location" change="new" req={REQ_FA}>
        <FormGrid>
          <SelectInput label="Asset Status" required change="new" req={REQ_FA} value={f.assetStatus} options={[...ASSET_STATUSES]} onChange={set('assetStatus')} error={errors.assetStatus} hint="Unified Asset Status master" />
          {existing
            ? <TextInput label="Current Location" change="new" req={REQ_MV} value={currentLocation(existing)} disabled hint="Derived from Movement History, add a movement to change it" />
            : <SelectInput label="Initial Location" required change="new" req={REQ_MV} value={f.initialLocation} options={LOCATION_NAMES} onChange={set('initialLocation')} error={errors.initialLocation} hint="Creates the first Movement History entry" />}
          <SelectInput label="Department" value={f.department} options={DEPARTMENTS} onChange={set('department')} />
          <TextInput label="Company" value={COMPANY} disabled />
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
        <SelectInput label="Ownership Type" required change="new" req={REQ_HE} value={f.ownership} options={OWNERSHIP} onChange={set('ownership')} error={errors.ownership} />
        <TextInput label="Owner Company" value={COMPANY} disabled />
        {f.ownership === 'Cross-Hired' && <SelectInput label="Cross-Hire Supplier" required change="new" req={REQ_HE} value={f.supplier} options={supplierRows.rows.filter((s: any) => s.type === 'Cross-Hire Company').map((s: any) => s.name)} onChange={set('supplier')} error={errors.supplier} />}
        {f.ownership === 'Cross-Hired' && <CheckInput label="Cross-Hire Idle" change="new" req={REQ_HE} checked={f.crossHireIdle} onChange={set('crossHireIdle')} hint="Returned by the client but not yet returned to the supplier" />}
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
          { label: 'Depreciation Board', content: depreciation },
          { label: 'Movement History', content: existing ? <><Note>Movement History is append-only. To record a new movement, use Add Movement on the view page.</Note><MovementTable rows={existing.movements} /></> : <><Note>The first entry is created automatically from the Initial Location once the equipment is saved.</Note><MovementTable rows={[]} /></> },
          { label: 'Ownership', content: ownership },
        ]} />
      </Page>
      <ConfirmDialog open={leave} info title="Discard changes" description="Leave this form? Unsaved changes will be lost." confirmLabel="Leave" onClose={() => setLeave(false)} onConfirm={() => nav('/inventory/items')} />
    </>
  );
}

/* ------------------------------------------------------------------ add movement (append-only) */
export function MovementForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const heavy = useHeavy();
  const r = heavy.get(id);
  const [f, setF] = useState({ type: '', from: r ? currentLocation(r) : '', to: '', date: NOW, reference: '' });
  const [errors, setErrors] = useState<Errors>({});
  if (!r) return <Page><PageTitle title="Heavy equipment fixed asset not found" /></Page>;
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const latest = [...r.movements].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]?.date ?? '';
  const entryNo = nextMovementNo(r.movements.length + 100 + heavy.rows.length * 10);
  const back = () => nav(`${HEAVY_PATH}/${r.id}`, { state: { tab: 'Movement History' } });
  const save = () => {
    const e = requireFields(f, ['type', 'from', 'to', 'date'], { type: 'Movement Type', from: 'From', to: 'To', date: 'Movement Date/Time' });
    if (!e.from && !e.to && f.from === f.to) e.to = 'From and To cannot be the same';
    if (!e.date && f.date < latest) e.date = `Must be after the latest entry (${latest.replace('T', ' ')}); corrections are made by adding a new entry`;
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const mv: Movement = { id: `m${Date.now()}`, entryNo, date: f.date, type: f.type, from: f.from, to: f.to, reference: f.reference || '-', by: 'Current User' };
    heavy.update(r.id, { movements: [...r.movements, mv], audit: [{ when: `${TODAY} ${NOW.slice(11)}`, title: 'Movement recorded', detail: `${f.type}: ${f.from} to ${f.to}`, by: 'Current User' }, ...r.audit] });
    toast('Movement recorded');
    back();
  };
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: r.assetId, to: `${HEAVY_PATH}/${r.id}` }, { label: 'Add Movement' }]}
        actions={<><Button variant="text" onClick={back}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></>}
      />
      <Page sx={{ pt: 2 }}>
        <FormGrid>
          <TextInput label="Movement Entry Number" change="new" req={REQ_MV} value={entryNo} disabled hint="Auto-generated" />
          <TextInput label="Linked Asset" change="new" req={REQ_MV} value={`${r.assetId} - ${r.name}`} disabled />
          <SelectInput label="Movement Type" required change="new" req={REQ_MV} value={f.type} options={MOVEMENT_TYPES} onChange={set('type')} error={errors.type} />
          <DateInput label="Movement Date/Time" required change="new" req={REQ_MV} value={f.date} onChange={set('date')} error={errors.date} />
          <SelectInput label="From" required change="new" req={REQ_MV} value={f.from} options={MOVEMENT_PLACES} onChange={set('from')} error={errors.from} hint="Defaults to the current location" />
          <SelectInput label="To" required change="new" req={REQ_MV} value={f.to} options={MOVEMENT_PLACES} onChange={set('to')} error={errors.to} hint="Location, client / project or supplier" />
          <TextInput label="Reference" value={f.reference} onChange={set('reference')} />
        </FormGrid>
      </Page>
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
  const board = useMemo(() => (r ? buildBoard({ start: r.putToUseDate || r.purchaseDate, assetValue: r.assetValue, notDepreciable: r.notDepreciable, months: r.usefulLifeYears * 12, method: r.method, factor: r.decliningFactor }) : []), [r]);
  if (!r) return <Page><PageTitle title="Heavy equipment fixed asset not found" right={<Button variant="outlined" onClick={() => nav('/inventory/items')}>Back to Items</Button>} /></Page>;
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  const stock = stockStatusOf(r);
  const dep = depreciationApplicable(r.ownership);
  const attrDefs = attributesFor(cats.rows, r.category, r.subCategory);
  const tabs = ['Basic Details', 'Depreciation Board', 'Movement History', 'Ownership'];
  const initial = Math.max(0, tabs.indexOf((loc.state as any)?.tab));
  return (
    <>
      <FormHeader
        crumbs={[{ label: 'Items', to: '/inventory/items' }, { label: `ID: ${r.assetId}` }]}
        status={<><StatusChip status={r.status} /><StatusChip status={stock} tone={tone(stock)} /></>}
        actions={<>
          <Button variant="outlined" onClick={() => { heavy.update(r.id, { status: flip }); toast(`Marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
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
              <ValueField label="Product Classification" value={r.classification} change="new" req={REQ_HE} />
              <ValueField label="Tracking Method" value="Serialized (Unique Asset ID)" change="new" req={REQ_HE} />
              <ValueField label="Asset Type" value={r.assetType} change="new" req={REQ_FA} />
              <ValueField label="Category" value={r.category} change="new" req={REQ_HE} />
              <ValueField label="Sub-Category" value={r.subCategory} change="new" req={REQ_HE} />
              <ValueField label="Asset Status" value={<StatusChip status={r.assetStatus} />} change="new" req={REQ_FA} />
              <ValueField label="Current Location" value={currentLocation(r)} change="new" req={REQ_MV} />
            </ValueGrid>
          </Box>
          <AssetTag assetId={r.assetId} />
        </Box>
        <TabPanels key={loc.key} initial={initial} tabs={[
          { label: 'Basic Details', content: (
            <>
              {attrDefs.length > 0 && <Panel title="Category Attributes" change="new" req="Category Master > Custom Attributes" sx={{ mb: 2 }}><AttributeValues defs={attrDefs} values={r.attrs} /></Panel>}
              <Panel title="Equipment and Asset Details" change="new" req={REQ_HE}>
                <SerializedView r={r} req={REQ_HE} />
                <Box sx={{ mt: 3 }}>
                  <ValueGrid cols={4}>
                    <ValueField label="Put to Use Date" value={r.putToUseDate} change="new" req={REQ_FA} />
                    <ValueField label="Department" value={r.department} change="new" req={REQ_FA} />
                    <ValueField label="Company" value={r.company} change="new" req={REQ_FA} />
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
          { label: 'Depreciation Board', content: !dep ? (
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
          { label: 'Movement History', content: (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Text type="s5" color="theme.secondary.700">Append-only log. Current Location is the destination of the latest entry.</Text>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => nav(`${HEAVY_PATH}/${r.id}/movement/add`)}>Add Movement</Button>
              </Box>
              <MovementTable rows={r.movements} />
            </>
          ) },
          { label: 'Ownership', content: (
            <>
              <ValueGrid cols={4}>
                <ValueField label="Ownership Type" value={r.ownership} change="new" req={REQ_HE} />
                <ValueField label="Owner Company" value={r.company} />
                {r.ownership === 'Cross-Hired' && <ValueField label="Cross-Hire Supplier" value={r.supplier} change="new" req={REQ_HE} />}
                {r.ownership === 'Cross-Hired' && <ValueField label="Cross-Hire Idle" value={r.crossHireIdle ? <StatusChip status="Idle" /> : 'No'} change="new" req={REQ_HE} />}
                <ValueField label="Depreciation Applicable" value={dep ? 'Yes' : 'No'} change="new" req={REQ_HE} />
                <ValueField label="Include in Available Fleet Count" value={inFleetCount(r) ? 'Yes' : 'No'} change="new" req={REQ_HE} />
                {!dep && <ValueField label="Cost and Profitability Tracking" value="Applicable" change="new" req={REQ_HE} />}
              </ValueGrid>
              <Panel title="Insurance" change="new" req={REQ_FA} sx={{ mt: 3 }}><InsuranceTable rows={r.insurance} /></Panel>
            </>
          ) },
        ]} />
      </Page>
    </>
  );
}
