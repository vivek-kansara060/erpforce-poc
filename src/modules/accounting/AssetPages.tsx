import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, useToast } from '@/components/Dialogs';
import { CheckInput, DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ToggleInput, ValueField, ValueGrid } from '@/components/Form';
import { Panel, TabPanels } from '@/components/Widgets';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { aed, num, requireFields, type Errors } from '@/modules/inventory/shared';
import { AssetTypeSelect } from '@/modules/inventory/AssetTypePages';
import { useTrips } from '@/modules/crm/shared';
import { driverOptions, VehicleTrips } from '@/modules/rental/FleetPages';
import {
  ACCOUNTS, COMPUTATIONS, DEPARTMENTS, DEPRECIATION_METHODS, WRITTEN_OFF_BASIS, ASSET_COL, assetSeed, locationSeed, nextAssetId, netAssetValue, type AssetRec, type LocationRec,
} from './assets';

export const ASSETS_PATH = '/accounting/assets';
const REQ = 'Accounting > Fixed Asset Management > Assets Management (client feedback 8 Oct: vehicles and other business fixed assets are registered here, not as Heavy Equipment in Inventory)';
export const useAssets = () => useCollection<AssetRec>(ASSET_COL, assetSeed);
const useLiveLocations = () => useCollection<LocationRec>('locations', locationSeed).rows.filter((l) => l.status === 'Active' && l.type !== 'Employee').map((l) => l.name);

/* ------------------------------------------------------------------ list */
export function AssetList() {
  const nav = useNavigate();
  const toast = useToast();
  const assets = useAssets();
  return (
    <Page>
      <PageTitle title="Assets Management" subtitle="Fixed asset register, including delivery fleet vehicles" change="new" req={REQ} />
      <DataTable<AssetRec> rows={assets.rows} searchPlaceholder="Search assets..." filter={{ key: 'status', options: ['Active', 'Inactive'], label: 'Status' }}
        onAdd={() => nav(`${ASSETS_PATH}/add`)} addLabel="Add Asset" onRowClick={(r) => nav(`${ASSETS_PATH}/${r.id}`)}
        columns={[
          { key: 'assetId', label: 'Asset ID' }, { key: 'name', label: 'Asset Name' }, { key: 'assetType', label: 'Asset Type' }, { key: 'location', label: 'Location' },
          { key: 'assetValue', label: 'Asset Value', align: 'right', render: (r) => aed(r.assetValue) }, { key: 'nbv', label: 'Net Asset Value', align: 'right', render: (r) => aed(r.nbv) },
          { key: 'fleetVehicle', label: 'Fleet Vehicle', change: 'new', req: REQ, render: (r) => (r.fleetVehicle ? <StatusChip status={r.plateNumber ?? 'Fleet Vehicle'} tone="blue" /> : '-') },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`${ASSETS_PATH}/${r.id}`) },
          { label: 'Edit', onClick: (r) => nav(`${ASSETS_PATH}/${r.id}/edit`) },
          { label: 'Deactivate', hidden: (r) => r.status === 'Inactive', onClick: (r) => { assets.update(r.id, { status: 'Inactive' }); toast(`${r.name} marked Inactive`); } },
          { label: 'Activate', hidden: (r) => r.status === 'Active', onClick: (r) => { assets.update(r.id, { status: 'Active' }); toast(`${r.name} marked Active`); } },
        ]} />
    </Page>
  );
}

/* ------------------------------------------------------------------ add / edit */
const blank: Record<string, any> = {
  assetType: '', name: '', assetValue: '', notDepreciable: '0', acquisitionDate: '', location: '', putToUseDate: '', referenceNumber: '',
  method: 'Straight line', computation: 'Constant periods', writtenOffBasis: 'Purchase', decliningFactor: '', usefulLifeYears: '',
  accFixedAsset: '', accDepreciation: '', accExpense: '', department: '', narration: '', seriesNumber: '', specification: '', attachments: [],
  status: 'Active', fleetVehicle: false, defaultDriver: '', plateNumber: '',
};

export function AssetForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const assets = useAssets();
  const liveLocs = useLiveLocations();
  const existing = id ? assets.get(id) : undefined;
  const [f, setF] = useState<Record<string, any>>(() => (existing
    ? Object.fromEntries(Object.entries({ ...blank, ...existing }).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v ?? '']))
    : { ...blank }));
  const [errors, setErrors] = useState<Errors>({});
  if (id && !existing) return <Page><PageTitle title="Fixed asset not found" right={<Button variant="outlined" onClick={() => nav(ASSETS_PATH)}>Back</Button>} /></Page>;
  const upd = (p: Record<string, any>) => setF((x) => ({ ...x, ...p }));
  const set = (k: string) => (v: any) => upd({ [k]: v });
  const n = (k: string) => num(f[k]) || 0;
  const fleetVehicle = !!f.fleetVehicle;
  const nbv = netAssetValue({ assetValue: n('assetValue'), notDepreciable: n('notDepreciable'), usefulLifeYears: n('usefulLifeYears'), method: f.method, decliningFactor: n('decliningFactor'), putToUseDate: f.putToUseDate, acquisitionDate: f.acquisitionDate });

  const validate = (): Errors => {
    const e = requireFields(f, ['assetType', 'name', 'acquisitionDate', 'location', 'method', 'computation', 'usefulLifeYears', 'accFixedAsset', 'accDepreciation', 'accExpense'], {
      assetType: 'Asset Type', acquisitionDate: 'Acquisition Date', usefulLifeYears: 'Duration', accFixedAsset: 'Fixed Asset Account', accDepreciation: 'Depreciation Account', accExpense: 'Expense Account',
    });
    if (!e.name && !f.name.trim()) e.name = 'Asset Name is required';
    if (!(n('assetValue') > 0)) e.assetValue = 'Asset Value must be greater than 0';
    if (!e.usefulLifeYears && n('usefulLifeYears') <= 0) e.usefulLifeYears = 'Duration must be greater than 0';
    if (f.method === 'Declining' && !(n('decliningFactor') > 0)) e.decliningFactor = 'Declining Factor is required for the Declining method';
    if (n('notDepreciable') > n('assetValue')) e.notDepreciable = 'Cannot exceed Asset Value';
    if (f.putToUseDate && f.acquisitionDate && f.putToUseDate < f.acquisitionDate) e.putToUseDate = 'Cannot be before Acquisition Date';
    if (fleetVehicle) {
      const plate = String(f.plateNumber ?? '').trim();
      if (!plate) e.plateNumber = 'Plate Number is required for a fleet vehicle';
      else { const dup = assets.rows.find((a) => a.id !== existing?.id && a.fleetVehicle && (a.plateNumber ?? '').trim().toLowerCase() === plate.toLowerCase()); if (dup) e.plateNumber = `This plate number is already used by ${dup.assetId}`; }
    }
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const rec: AssetRec = {
      id: existing?.id ?? `fa${Date.now()}`, assetId: existing?.assetId ?? nextAssetId(assets.rows),
      assetType: f.assetType, name: f.name.trim(), assetValue: n('assetValue'), nbv, notDepreciable: n('notDepreciable'),
      acquisitionDate: f.acquisitionDate, location: f.location, bookValue: n('assetValue'), putToUseDate: f.putToUseDate, referenceNumber: f.referenceNumber,
      method: f.method, computation: f.computation, writtenOffBasis: f.writtenOffBasis, decliningFactor: n('decliningFactor'), usefulLifeYears: n('usefulLifeYears'),
      accFixedAsset: f.accFixedAsset, accDepreciation: f.accDepreciation, accExpense: f.accExpense, department: f.department, narration: f.narration,
      seriesNumber: f.seriesNumber, specification: f.specification, attachments: f.attachments, status: f.status === 'Active' ? 'Active' : 'Inactive',
      fleetVehicle, defaultDriver: fleetVehicle ? (f.defaultDriver || undefined) : undefined, plateNumber: fleetVehicle ? String(f.plateNumber).trim() : undefined,
    };
    if (existing) assets.update(existing.id, rec); else assets.add(rec);
    toast(existing ? 'Fixed asset updated' : 'Fixed asset created');
    nav(`${ASSETS_PATH}/${rec.id}`);
  };

  const main = (
    <>
      <FormSection title="General Information">
        <FormGrid>
          <AssetTypeSelect value={f.assetType} onChange={set('assetType')} error={errors.assetType} req={REQ} />
          <TextInput label="Asset Name" required value={f.name} onChange={set('name')} error={errors.name} />
          <TextInput label="Reference Number" value={f.referenceNumber} onChange={set('referenceNumber')} />
          <TextInput label="Series Number" value={f.seriesNumber} onChange={set('seriesNumber')} />
          <DateInput label="Acquisition Date" required value={f.acquisitionDate} onChange={set('acquisitionDate')} error={errors.acquisitionDate} />
          <DateInput label="Put to Use Date" value={f.putToUseDate} onChange={set('putToUseDate')} error={errors.putToUseDate} />
          <SelectInput label="Location" required value={f.location} options={liveLocs} onChange={set('location')} error={errors.location} />
          <SelectInput label="Department" value={f.department} options={DEPARTMENTS} onChange={set('department')} />
          <ToggleInput label="Status" checked={f.status === 'Active'} onChange={(v) => set('status')(v ? 'Active' : 'Inactive')} />
          <TextInput label="Asset Specification" value={f.specification} onChange={set('specification')} multiline rows={2} full />
          <TextInput label="Narration" value={f.narration} onChange={set('narration')} multiline rows={2} full />
          <FileInput label="Attachment" multiple value={f.attachments} onChange={set('attachments')} full />
        </FormGrid>
      </FormSection>
      <FormSection title="Fleet Vehicle" change="new" req={REQ} hint="Tick this for a vehicle bought for the business's own delivery and collection use. It is never rented out and does not appear in the rental fleet.">
        <FormGrid>
          <CheckInput label="Fleet Vehicle" checked={fleetVehicle} onChange={(v) => upd({ fleetVehicle: v })} />
          <Box />
          {fleetVehicle && <TextInput label="Plate Number" required value={f.plateNumber} onChange={set('plateNumber')} error={errors.plateNumber} hint="Unique across all fleet vehicles. Shown on the Fleet Availability board and filled into each trip" />}
          {fleetVehicle && <SelectInput label="Default Driver" value={f.defaultDriver} options={driverOptions()} onChange={set('defaultDriver')} hint="Filled into each trip; the dispatcher can change it" />}
        </FormGrid>
      </FormSection>
      <FormSection title="Depreciation">
        <FormGrid>
          <NumberInput label="Asset Value" required value={f.assetValue} onChange={set('assetValue')} error={errors.assetValue} />
          <NumberInput label="Not Depreciable Value" value={f.notDepreciable} onChange={set('notDepreciable')} error={errors.notDepreciable} />
          <TextInput label="Book Value" disabled value={f.assetValue} hint="Auto-filled from Asset Value" />
          <TextInput label="Net Asset Value" disabled value={String(Math.round(nbv))} hint="Computed from Asset Value, Not Depreciable Value, Duration and the Depreciation Method" />
          <SelectInput label="Depreciation Method" required value={f.method} options={DEPRECIATION_METHODS} onChange={set('method')} error={errors.method} />
          {f.method === 'Declining' ? <NumberInput label="Declining Factor" required value={f.decliningFactor} onChange={set('decliningFactor')} error={errors.decliningFactor} /> : <Box />}
          <SelectInput label="Computation" required value={f.computation} options={COMPUTATIONS} onChange={set('computation')} error={errors.computation} />
          <SelectInput label="Written Off basis" value={f.writtenOffBasis} options={WRITTEN_OFF_BASIS} onChange={set('writtenOffBasis')} />
          <NumberInput label="Duration (Years)" required value={f.usefulLifeYears} onChange={set('usefulLifeYears')} error={errors.usefulLifeYears} hint="Useful life of the asset" />
        </FormGrid>
      </FormSection>
      <FormSection title="Accounts">
        <FormGrid>
          <SelectInput label="Fixed Asset Account" required value={f.accFixedAsset} options={ACCOUNTS.fixedAsset} onChange={set('accFixedAsset')} error={errors.accFixedAsset} />
          <SelectInput label="Depreciation Account" required value={f.accDepreciation} options={ACCOUNTS.depreciation} onChange={set('accDepreciation')} error={errors.accDepreciation} />
          <SelectInput label="Expense Account" required value={f.accExpense} options={ACCOUNTS.expense} onChange={set('accExpense')} error={errors.accExpense} />
        </FormGrid>
      </FormSection>
    </>
  );

  const summary = (
    <Panel title="Summary" sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <ValueField label="Asset Name" value={f.name || '-'} />
        <ValueField label="Asset Type" value={f.assetType || '-'} />
        <ValueField label="Depreciation Method" value={f.method} />
        <ValueField label="Net Asset Value" value={aed(nbv)} />
        <ValueField label="Useful Life" value={f.usefulLifeYears ? `${f.usefulLifeYears} years` : '-'} />
        {fleetVehicle && <ValueField label="Fleet Vehicle" value={<StatusChip status={f.plateNumber || 'Pending plate number'} tone="blue" />} />}
      </Box>
    </Panel>
  );

  return (
    <>
      <FormHeader crumbs={[{ label: 'Assets Management', to: ASSETS_PATH }, { label: existing ? `Edit ${existing.assetId}` : 'Add Asset' }]}
        actions={<><Button variant="outlined" onClick={() => nav(existing ? `${ASSETS_PATH}/${existing.id}` : ASSETS_PATH)}>Discard</Button><Button variant="contained" onClick={save}>{existing ? 'Update' : 'Save'}</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box>{main}</Box>
          {summary}
        </Box>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ view */
export function AssetView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const assets = useAssets();
  const trips = useTrips();
  const r = assets.get(id);
  const [del, setDel] = useState(false);
  if (!r) return <Page><PageTitle title="Fixed asset not found" right={<Button variant="outlined" onClick={() => nav(ASSETS_PATH)}>Back to Assets Management</Button>} /></Page>;
  const flip = r.status === 'Active' ? 'Inactive' : 'Active';
  const inUse = r.fleetVehicle && trips.rows.some((t) => t.vehicleId === r.id);
  const basic = (
    <>
      <Panel title="General Information">
        <ValueGrid cols={4}>
          <ValueField label="Asset ID" value={r.assetId} />
          <ValueField label="Asset Type" value={r.assetType} />
          <ValueField label="Asset Name" value={r.name} />
          <ValueField label="Location" value={r.location} />
          <ValueField label="Department" value={r.department || '-'} />
          <ValueField label="Acquisition Date" value={r.acquisitionDate} />
          <ValueField label="Put to Use Date" value={r.putToUseDate || '-'} />
          <ValueField label="Reference Number" value={r.referenceNumber || '-'} />
          <ValueField label="Series Number" value={r.seriesNumber || '-'} />
        </ValueGrid>
        {r.specification && <Box sx={{ mt: 2 }}><ValueField label="Asset Specification" value={r.specification} /></Box>}
        {r.narration && <Box sx={{ mt: 2 }}><ValueField label="Narration" value={r.narration} /></Box>}
      </Panel>
      {r.fleetVehicle && (
        <Panel title="Fleet Vehicle" change="new" req={REQ} sx={{ mt: 2 }}>
          <ValueGrid cols={4}>
            <ValueField label="Plate Number" value={r.plateNumber} />
            <ValueField label="Default Driver" value={r.defaultDriver || '-'} />
          </ValueGrid>
        </Panel>
      )}
      <Panel title="Depreciation" sx={{ mt: 2 }}>
        <ValueGrid cols={4}>
          <ValueField label="Asset Value" value={aed(r.assetValue)} />
          <ValueField label="Not Depreciable Value" value={aed(r.notDepreciable)} />
          <ValueField label="Book Value" value={aed(r.bookValue)} />
          <ValueField label="Net Asset Value" value={aed(r.nbv)} />
          <ValueField label="Depreciation Method" value={r.method} />
          {r.method === 'Declining' && <ValueField label="Declining Factor" value={String(r.decliningFactor)} />}
          <ValueField label="Computation" value={r.computation} />
          <ValueField label="Written Off basis" value={r.writtenOffBasis} />
          <ValueField label="Duration" value={`${r.usefulLifeYears} years`} />
        </ValueGrid>
      </Panel>
      <Panel title="Accounts" sx={{ mt: 2 }}>
        <ValueGrid cols={3}>
          <ValueField label="Fixed Asset Account" value={r.accFixedAsset} />
          <ValueField label="Depreciation Account" value={r.accDepreciation} />
          <ValueField label="Expense Account" value={r.accExpense} />
        </ValueGrid>
      </Panel>
      {r.attachments.length > 0 && (
        <Panel title="Attachments" sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{r.attachments.map((n) => <Text key={n} type="s5">{n}</Text>)}</Box>
        </Panel>
      )}
    </>
  );
  return (
    <>
      <FormHeader crumbs={[{ label: 'Assets Management', to: ASSETS_PATH }, { label: r.assetId }]}
        status={<><StatusChip status={r.status} />{r.fleetVehicle && <StatusChip status="Fleet Vehicle" tone="blue" />}</>}
        actions={<>
          <Button variant="outlined" onClick={() => { assets.update(r.id, { status: flip }); toast(`Marked ${flip}`); }}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
          <Button variant="outlined" color="error" onClick={() => setDel(true)}>Delete</Button>
          <Button variant="contained" onClick={() => nav(`${ASSETS_PATH}/${r.id}/edit`)}>Edit</Button>
        </>} />
      <Page sx={{ pt: 2 }}>
        <Text type="h3" weight="medium" sx={{ mb: 2 }}>{r.name}</Text>
        {r.fleetVehicle ? (
          <TabPanels tabs={[
            { label: 'Basic Details', content: basic },
            { label: 'Trips', change: 'new', req: REQ, content: <VehicleTrips vehicleId={r.id} /> },
          ]} />
        ) : basic}
      </Page>
      <ConfirmDialog open={del} danger title={`Delete ${r.assetId}`} description={inUse ? `${r.name} has trips recorded against it and cannot be deleted. Mark it Inactive instead.` : `Delete ${r.name}? This cannot be undone.`} confirmLabel={inUse ? undefined : 'Delete'}
        onClose={() => setDel(false)} onConfirm={() => { if (inUse) { setDel(false); return; } assets.remove(r.id); toast('Fixed asset deleted'); nav(ASSETS_PATH); }} />
    </>
  );
}
