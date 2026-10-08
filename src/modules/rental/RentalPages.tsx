import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, MenuButton, useToast } from '@/components/Dialogs';
import { CheckInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel, TabPanels } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { CROSS_STAGES, ESCALATION_DAYS, EXPIRY_NOTICE_DAYS, FAULT_ATTRIBUTION, masterValues, assetById, availability, custName, docTotals, type CrossHire, type Replacement, type SalesOrder } from '@/modules/crm/data';
import { deliveredQty, getOrder, outstanding, receiveCrossHire, replaceAsset, returnToSupplier, returnToUs } from '@/modules/crm/flow';
import { R, aed, useCrossHire, useExtensions, useFleet, useOrders, useReplacements } from '@/modules/crm/shared';
import { ExpiryDialog } from '@/modules/crm/ActionDialogs';
import { expiryRows } from '@/modules/crm/reports';
import { TransportSection, blankTransport, toTransportInput, validateTransport } from './FleetPages';

/* ------------------------------------------------------------------ Replacements */
export function ReplacementList() {
  const nav = useNavigate();
  const reps = useReplacements();
  const orders = useOrders();
  return (
    <Page>
      <PageTitle title="Replacement Orders" change="changed" req={R.repl} />
      <DataTable<Replacement> rows={reps.rows} onAdd={() => nav('/rental/replacements/add')} addLabel="Add Replacement" searchPlaceholder="Search replacements..."
        columns={[
          { key: 'number', label: 'Replacement' }, { key: 'so', label: 'Rental Order', render: (r) => orders.get(r.soId)?.number }, { key: 'cust', label: 'Customer', render: (r) => custName(orders.get(r.soId)?.customerId ?? '') },
          { key: 'out', label: 'Asset Out', change: 'new', req: R.repl, render: (r) => assetById(r.oldAssetId)?.assetId }, { key: 'in', label: 'Asset In', change: 'new', req: R.repl, render: (r) => assetById(r.newAssetId)?.assetId },
          { key: 'reason', label: 'Reason', change: 'new', req: R.repl }, { key: 'adj', label: 'Price Adjustment', align: 'right', render: (r) => aed(r.priceAdjust) }, { key: 'date', label: 'Date' },
        ]} />
    </Page>
  );
}

export function ReplacementForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const orders = useOrders();
  const fleet = useFleet();
  const [f, setF] = useState<Record<string, any>>({ soId: sp.get('so') ?? '', key: '', reason: '', newId: '', priceAdjust: '', notified: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [tp, setTp] = useState(blankTransport);
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const so = orders.get(f.soId);
  const outs = (so?.lines ?? []).flatMap((l) => outstanding(l).filter((a) => a.state === 'On Hire').map((a) => ({ l, a })));
  const pick = outs.find((o) => `${o.l.id}|${o.a.assetId}` === f.key) ?? (outs.length === 1 && sp.get('line') ? outs[0] : undefined);
  const av = pick ? availability(pick.l.group, pick.l.category, fleet.rows) : { owned: [], cross: [] };
  const choices = [...av.owned, ...av.cross];
  const save = () => {
    const e: Record<string, string> = {};
    if (!so) e.soId = 'Select a Rental Order';
    if (!pick) e.key = 'Select the asset to replace';
    if (!f.reason) e.reason = 'Replacement Reason is required';
    if (!f.newId) e.newId = 'Select the replacement asset';
    Object.assign(e, validateTransport(tp));
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const r = replaceAsset({ soId: so!.id, lineId: pick!.l.id, oldId: pick!.a.assetId, newId: f.newId, reason: f.reason, priceAdjust: Number(f.priceAdjust) || 0, notified: f.notified, transport: toTransportInput(tp) });
    toast(`${r.number}: asset swapped. Old asset moved to Under Maintenance, billing cycle not paused`);
    nav('/rental/replacements');
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Replacement Orders', to: '/rental/replacements' }, { label: 'Add Replacement' }]} actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="contained" onClick={save}>Save Replacement</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Replacement is started from the Rental Order, never from the Delivery Order. Only assets currently outstanding are shown. The old asset and the new asset are recorded against the same project in one transaction.</Alert>
        <FormGrid>
          <SelectInput label="Rental Order" required change="new" req={R.repl} value={f.soId} options={orders.rows.filter((o) => o.lines.some((l) => outstanding(l).length)).map((o) => ({ value: o.id, label: `${o.number} - ${custName(o.customerId)}` }))} onChange={(v) => setF((x) => ({ ...x, soId: v, key: '', newId: '' }))} error={err.soId} />
          <SelectInput label="Asset to replace (outstanding only)" required change="new" req={R.repl} value={pick ? `${pick.l.id}|${pick.a.assetId}` : ''} options={outs.map((o) => ({ value: `${o.l.id}|${o.a.assetId}`, label: `${assetById(o.a.assetId)?.assetId} - ${assetById(o.a.assetId)?.name}` }))} onChange={(v) => setF((x) => ({ ...x, key: v, newId: '' }))} error={err.key} />
          <SelectInput label="Replacement Reason" required change="new" req={R.repl} value={f.reason} options={masterValues('replacementReason')} onChange={set('reason')} error={err.reason} hint="Admin-extendable list" />
        </FormGrid>
        {pick && (
          <FormSection title={`Same-category check: ${pick.l.group} ${pick.l.category}`} change="new" req={R.repl}>
            {choices.length === 0 ? (
              <Alert severity="warning" action={<Button size="small" color="inherit" onClick={() => nav(`/rental/cross-hire/add?so=${so?.id}&lines=${pick?.l.id}`)}>Raise Cross-Hire</Button>}>No owned {pick.l.group} {pick.l.category} unit is Ready for Hire. Source the replacement through Cross-Hire.</Alert>
            ) : (
              <SelectInput label="Replacement Asset (Ready for Hire)" required value={f.newId} options={choices.map((a) => ({ value: a.id, label: `${a.assetId} - ${a.name}${a.ownership === 'Cross-Hired' ? ' (Cross-Hired)' : ''}` }))} onChange={set('newId')} error={err.newId} hint={`${av.owned.length} owned and ${av.cross.length} cross-hired unit(s) available`} />
            )}
          </FormSection>
        )}
        <FormSection title="Commercial and notification">
          <FormGrid>
            <NumberInput label="Price Adjustment (optional, AED)" change="new" req={R.repl} value={f.priceAdjust} onChange={set('priceAdjust')} hint="A replacement is rarely price-neutral by assumption, the option must exist" />
            <CheckInput label="Customer notified of the replacement" change="new" req={R.repl} checked={f.notified} onChange={set('notified')} />
            <TextInput label="Resulting status of the faulty asset" disabled value="Under Maintenance" hint="Always Under Maintenance first. Disposal is a separate manual decision, the system never auto-disposes" />
          </FormGrid>
        </FormSection>
        <FormSection title="Transport" change="new" req={R.fleet} hint="One Replacement trip carries the new unit out and brings the old unit back.">
          <TransportSection value={tp} onChange={setTp} errors={err} />
        </FormSection>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Renewals and Expiry */
interface Handling { id: string; fault: string; treatment: string }
export function RenewalsPage() {
  const toast = useToast();
  const orders = useOrders();
  const exts = useExtensions();
  const handling = useCollection<Handling>('rental.overdueHandling', []);
  const [notified, setNotified] = useState<string[]>([]);
  const [dlg, setDlg] = useState<{ soId: string; lineId: string } | null>(null);
  const [od, setOd] = useState<{ id: string; fault: string; treatment: string } | null>(null);
  const rows = expiryRows({ orders: orders.rows });
  return (
    <Page>
      <PageTitle title="Renewals and Expiry" subtitle={`Contracts nearing their end date (notice ${EXPIRY_NOTICE_DAYS} days) and overdue on-hire assets. Escalation to a manager after ${ESCALATION_DAYS} overdue days. Both settings are admin-configurable.`} change="new" req={R.exp} />
      <TabPanels tabs={[
        { label: 'Contracts', content: (
          <DataTable hideToolbar rows={rows} pageSize={15} filter={{ key: 'state', options: ['Overdue', 'Expiring', 'Active'] }}
            rowSx={(r) => (r.state === 'Overdue' ? { bgcolor: '#FFF5F5' } : undefined)}
            columns={[
              { key: 'so', label: 'Sales Order', render: (r) => r.so.number }, { key: 'c', label: 'Customer', render: (r) => custName(r.so.customerId) }, { key: 'item', label: 'Line', render: (r) => r.line.item },
              { key: 'assets', label: 'Assets', render: (r) => outstanding(r.line).map((a) => assetById(a.assetId)?.assetId).join(', ') }, { key: 'end', label: 'Contract End', render: (r) => r.line.contractEnd },
              { key: 'left', label: 'Days left', align: 'right', render: (r) => (r.left < 0 ? `${-r.left} overdue` : r.left) },
              { key: 'state', label: 'State', render: (r) => <StatusChip status={r.state === 'Overdue' && -r.left > ESCALATION_DAYS ? 'Overdue, escalated' : r.state} /> },
              { key: 'fault', label: 'Fault Attribution', render: (r) => (r.state === 'Overdue' ? handling.get(r.line.id)?.fault ?? 'Not set' : '-') },
              { key: 'act', label: 'Action', render: (r) => (
                <MenuButton label="Actions" variant="outlined" items={[
                  { label: notified.includes(r.line.id) ? 'Notified' : 'Notify', disabled: r.state === 'Active' || notified.includes(r.line.id), onClick: () => { setNotified([...notified, r.line.id]); toast(`Notification sent to the Service Desk, Sales and ${custName(r.so.customerId)}`); } },
                  { label: 'Overdue handling (fault attribution)', disabled: r.state !== 'Overdue', onClick: () => setOd({ id: r.line.id, fault: handling.get(r.line.id)?.fault ?? '', treatment: handling.get(r.line.id)?.treatment ?? '' }) },
                  { label: 'Client confirmation: extend, terminate or return', onClick: () => setDlg({ soId: r.so.id, lineId: r.line.id }) },
                ]} />) },
            ]} />
        ) },
        { label: 'Extension / Termination requests', content: (
          <DataTable hideToolbar rows={exts.rows} emptyText="No requests yet" columns={[
            { key: 'number', label: 'Request' }, { key: 'so', label: 'Sales Order', render: (r) => getOrder(r.soId)?.number }, { key: 'kind', label: 'Type', render: (r) => <StatusChip status={r.kind} tone="grey" /> },
            { key: 'old', label: 'Old end', render: (r) => r.oldEnd }, { key: 'new', label: 'New end', render: (r) => r.newEnd }, { key: 'by', label: 'Confirmed by client', render: (r) => r.clientConfirmedBy }, { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
          ]} />
        ) },
      ]} />
      <ExpiryDialog open={!!dlg} onClose={() => setDlg(null)} soId={dlg?.soId} lineId={dlg?.lineId} />
      <AppDialog open={!!od} title="Overdue on-hire handling" onClose={() => setOd(null)} confirmLabel="Save" confirmDisabled={!od?.fault} onConfirm={() => { if (od) { if (handling.get(od.id)) handling.update(od.id, od); else handling.add(od); toast('Overdue handling saved'); setOd(null); } }}>
        <Alert severity="info" sx={{ mb: 2 }}>The internal alert always fires. The commercial response stays flexible and is decided case by case.</Alert>
        <FormGrid cols={1}>
          <SelectInput label="Fault Attribution" required change="new" req={R.exp} value={od?.fault} options={FAULT_ATTRIBUTION} onChange={(v) => od && setOd({ ...od, fault: v })} hint="Company: no charge, for example the business's own logistics could not collect on time" />
          <SelectInput label="Overdue Billing Treatment" change="new" req={R.exp} value={od?.treatment} options={['Same Rate', 'Penalty Rate', 'Hold Billing']} onChange={(v) => od && setOd({ ...od, treatment: v })} />
        </FormGrid>
      </AppDialog>
    </Page>
  );
}
