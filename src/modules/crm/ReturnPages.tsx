import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, FormControlLabel } from '@mui/material';
import dayjs from 'dayjs';
import { DataTable } from '@/components/DataTable';
import { AppDialog, useToast } from '@/components/Dialogs';
import { DateInput, FileInput, FormGrid, FormSection, NumberInput, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { LifecycleStepper, Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { FAULT_ATTRIBUTION, RETURN_METHODS, TODAY, yards, assetById, custName, hasWaiver, type ReturnEntry } from './data';
import { failedCollection, getOrder, inspect, invoiceDamage, outstanding, raiseReturn, reachYard } from './flow';
import { invoiceByRef } from '@/modules/accounting/engine';
import { useInvoices } from '@/modules/accounting/shared';
import { R, TO_CONFIRM, aed, useDeliveries, useMaster, useOrders, useReturns, useTrips } from './shared';
import { TransportSection, TripsTable, blankTransport, toTransportInput, validateTransport } from '@/modules/rental/FleetPages';

const STEPS = ['Return triggered', 'Transport / collection', 'Site check', 'Reached Yard', 'Inspection', 'Outcome'];

/** Existing RMA documents stay as they are; rental returns raised from a Sales Order are listed alongside. */
const RMA = [
  { id: 'rma1', number: 'RMA-26-00012', date: '2026-08-14', customer: 'Emirates Infrastructure LLC', so: 'SO-26-00036', status: 'Return Completed' },
  { id: 'rma2', number: 'RMA-26-00013', date: '2026-09-03', customer: 'Al Safa Power Utilities', so: 'SO-26-00040', status: 'Pending Credit' },
  { id: 'rma3', number: 'RMA-26-00014', date: '2026-09-19', customer: 'Desert Pearl Hotels', so: 'SO-26-00042', status: 'Pending Approval' },
];

export function ReturnList() {
  const nav = useNavigate();
  const rets = useReturns();
  const dels = useDeliveries();
  const [tab, setTab] = useState('Rental Returns');
  return (
    <Page>
      <PageTitle title="Customer Returns" />
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        {['Rental Returns', 'RMA (Trading returns)'].map((t) => <Box key={t} onClick={() => setTab(t)} sx={{ cursor: 'pointer', px: 1.5, py: 0.5, borderRadius: '1.5rem', fontSize: 13, fontWeight: 500, bgcolor: tab === t ? '#B6E9D6' : '#EEEFF1' }}>{t}</Box>)}
      </Box>
      {tab === 'Rental Returns' ? (
        <DataTable<ReturnEntry> rows={rets.rows} searchPlaceholder="Search returns..." onAdd={() => nav('/crm/customer-returns/add')} addLabel="Add Return" onRowClick={(r) => nav(`/crm/customer-returns/${r.id}`)}
          emptyText="No rental returns yet. Raise one from a Sales Order."
          columns={[
            { key: 'number', label: 'Return Entry Number', change: 'new', req: R.ret }, { key: 'soNumber', label: 'Sales Order' }, { key: 'do', label: 'Delivery Order', change: 'new', req: R.meet, render: (r) => dels.get(r.deliveryId)?.number ?? '-' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) },
            { key: 'asset', label: 'Asset', render: (r) => assetById(r.assetId)?.assetId }, { key: 'method', label: 'Return Method', change: 'new', req: R.ret },
            { key: 'timestamp', label: 'Return Entry Timestamp', change: 'new', req: R.ret, render: (r) => r.timestamp.replace('T', ' ') },
            { key: 'inspection', label: 'Inspection Status', change: 'new', req: R.ret, render: (r) => <StatusChip status={r.inspection} /> }, { key: 'outcome', label: 'Outcome', render: (r) => r.outcome ?? 'In progress' },
          ]} />
      ) : (
        <DataTable hideToolbar rows={RMA} columns={[{ key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' }, { key: 'so', label: 'Sale Order' }, { key: 'status', label: 'RMA Status', render: (r) => <StatusChip status={r.status} /> }]} />
      )}
    </Page>
  );
}

export function ReturnForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const orders = useOrders();
  const SITE_CHECKLIST = useMaster('siteChecklist').values;
  const firstKey = () => { const o = getOrder(sp.get('so') ?? ''); const outs0 = (o?.lines ?? []).filter((l) => !sp.get('line') || l.id === sp.get('line')).flatMap((l) => outstanding(l).map((a) => `${l.id}|${a.assetId}`)); return outs0.length === 1 ? outs0[0] : ''; };
  const [f, setF] = useState<Record<string, any>>(() => ({ soId: sp.get('so') ?? '', assetKey: firstKey(), method: '', timestamp: `${TODAY}T${dayjs().format('HH:mm')}`, checks: [] as string[], photos: [] as string[], fuelNote: '' }));
  const [err, setErr] = useState<Record<string, string>>({});
  const [tp, setTp] = useState(blankTransport);
  const set = (k: string) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const so = orders.get(f.soId);
  const outs = (so?.lines ?? []).flatMap((l) => outstanding(l).map((a) => ({ line: l, a })));
  const pick = outs.find((o) => `${o.line.id}|${o.a.assetId}` === f.assetKey);
  const save = () => {
    const e: Record<string, string> = {};
    if (!so) e.soId = 'Select a Sales Order';
    if (!pick) e.assetKey = 'Select the asset being returned';
    if (!f.method) e.method = 'Return Method is required';
    if (f.checks.length < SITE_CHECKLIST.length) e.checks = 'The Pre-Return Site Checklist must be completed before Off-Hire is confirmed';
    if (!f.photos.length) e.photos = 'Photos are mandatory at Return';
    if (f.method === 'Company Collection') Object.assign(e, validateTransport(tp, f.timestamp));
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const r = raiseReturn({ soId: so!.id, lineId: pick!.line.id, assetId: pick!.a.assetId, method: f.method, timestamp: f.timestamp, siteChecklist: f.checks, photos: f.photos, fuelNote: f.fuelNote, transport: f.method === 'Company Collection' ? toTransportInput(tp) : undefined });
    toast(`${r.number} raised. Asset is Off Hire and rental billing has stopped`);
    nav(`/crm/customer-returns/${r.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: '/crm/customer-returns' }, { label: 'Add Return' }]} actions={<><Button variant="outlined" onClick={() => nav(-1)}>Discard</Button><Button variant="contained" onClick={save}>Save Return Entry</Button></>} />
      <Page sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Return is raised from the Sales Order. Only assets still out against that order are listed, you never need to open the Delivery Order. It closes automatically once its assets are returned.</Alert>
        <FormGrid>
          <SelectInput label="Sales Order" required change="new" req={R.rreturn} value={f.soId} options={orders.rows.filter((o) => o.lines.some((l) => outstanding(l).length)).map((o) => ({ value: o.id, label: `${o.number} - ${custName(o.customerId)}` }))} onChange={(v) => setF((x) => ({ ...x, soId: v, assetKey: '' }))} error={err.soId} />
          <SelectInput label="Asset being returned (pending only)" required change="new" req={R.rreturn} value={pick ? `${pick.line.id}|${pick.a.assetId}` : ''} options={outs.map((o) => ({ value: `${o.line.id}|${o.a.assetId}`, label: `${assetById(o.a.assetId)?.assetId} - ${assetById(o.a.assetId)?.name}` }))} onChange={set('assetKey')} error={err.assetKey} />
          <SelectInput label="Return Method" required change="new" req={R.ret} value={f.method} options={RETURN_METHODS} onChange={set('method')} error={err.method} hint="Selectable per transaction" />
          <DateInput label="Return Entry Timestamp (Off-Hire)" required change="new" req={R.ret} value={f.timestamp} onChange={set('timestamp')} hint="Stops the rental billing clock. Can be set earlier or later than today" />
        </FormGrid>
        <FormSection title="Pre-Return Site Checklist" change="new" req={R.rreturn}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {SITE_CHECKLIST.map((c) => <FormControlLabel key={c} control={<Checkbox size="small" checked={f.checks.includes(c)} onChange={(e) => set('checks')(e.target.checked ? [...f.checks, c] : f.checks.filter((x: string) => x !== c))} />} label={<Text type="s3">{c}</Text>} />)}
          </Box>
          {err.checks && <Text type="s5" color="#C64D4D">{err.checks}</Text>}
          <Text type="s5" color="theme.secondary.700">Light check at the client site before Off-Hire. Checklist content {TO_CONFIRM.toLowerCase()}.</Text>
        </FormSection>
        {f.method === 'Company Collection' && (
          <FormSection title="Collection Transport" change="new" req={R.fleet} hint="Creates a Collection trip. If the collection fails, the trip is marked Stuck-Delayed with the same note and Responsible.">
            <TransportSection value={tp} onChange={setTp} errors={err} date={f.timestamp} />
          </FormSection>
        )}
        <FormSection title="Photos and Fuel Note">
          <FormGrid>
            <FileInput label="Return Photo Attachments" required change="new" req={R.rreturn} multiple value={f.photos} onChange={set('photos')} error={err.photos} hint="Mandatory at Return (optional at Delivery)" />
            <TextInput label="Fuel Note" change="new" req={R.ret} value={f.fuelNote} onChange={set('fuelNote')} hint="Reference only. Fuel is never billed as part of rental" />
          </FormGrid>
        </FormSection>
      </Page>
    </>
  );
}

export function ReturnView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const rets = useReturns();
  useInvoices();
  const dels = useDeliveries();
  const trips = useTrips();
  const orders = useOrders();
  const YARD_CHECKLIST = useMaster('yardChecklist').values;
  const r = rets.get(id);
  const [fail, setFail] = useState<{ open: boolean; by: string; amount: string; note: string }>({ open: false, by: '', amount: '', note: '' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [yard, setYard] = useState(false);
  const [insp, setInsp] = useState(false);
  const [yardName, setYardName] = useState('Jebel Ali Main Yard');
  const [res, setRes] = useState('Passed');
  const [checks, setChecks] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  if (!r) return <Page><PageTitle title="Return not found" right={<Button variant="outlined" onClick={() => nav('/crm/customer-returns')}>Back</Button>} /></Page>;
  const a = assetById(r.assetId);
  const waiver = hasWaiver(orders.get(r.soId)?.lines ?? []);
  // The order charge this return created (damage at inspection or a failed collection charged to the client).
  const charges = orders.get(r.soId)?.damageCharges ?? [];
  const chargeIdx = charges.findIndex((c) => c.assetId === r.assetId && ((r.damageCharge && c.amount === r.damageCharge && !/failed collection/i.test(c.note)) || (r.collection?.by === 'Client' && /failed collection/i.test(c.note))));
  const charge = chargeIdx >= 0 ? charges[chargeIdx] : undefined;
  const chargeInv = invoiceByRef(charge?.invoiceId);
  const okInspect = res === 'Passed' ? checks.length === YARD_CHECKLIST.length : (waiver || Number(amount) > 0) && note.trim();
  const dn = dels.get(r.deliveryId)?.number;
  const rTrips = trips.rows.filter((t) => t.docId === r.id);
  const ct = rTrips.find((t) => t.status !== 'Cancelled');
  return (
    <>
      <FormHeader crumbs={[{ label: 'Customer Returns', to: '/crm/customer-returns' }, { label: r.number }]} status={<StatusChip status={r.inspection} />}
        actions={<>
          <Button variant="outlined" onClick={() => nav(`/crm/sales-orders/${r.soId}`)}>View Sales Order</Button>
          <Button variant="outlined" onClick={() => setNoteOpen(true)}>Print Collection Note</Button>
          {r.stage === 2 && r.method === 'Company Collection' && !r.collection && <Button variant="outlined" color="error" onClick={() => setFail({ ...fail, open: true })}>Collection Failed</Button>}
          {r.stage === 2 && <Button variant="contained" onClick={() => setYard(true)}>Asset Reached Yard</Button>}
          {r.stage === 3 && <Button variant="contained" onClick={() => setInsp(true)}>Record Inspection</Button>}
          {charge && !charge.invoiceId && <Button variant="contained" onClick={() => { const x = invoiceDamage(r.soId, chargeIdx); toast(x.message, x.ok ? 'success' : 'error'); }}>Raise Damage Invoice</Button>}
          {chargeInv && <Button variant="outlined" onClick={() => nav(`/accounting/invoices/${chargeInv.id}`)}>View Damage Invoice</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <LifecycleStepper steps={STEPS} current={r.stage === 5 ? 6 : r.stage} />
        <ValueGrid>
          <ValueField label="Return Entry Number" change="new" req={R.ret} value={r.number} /><ValueField label="Sales Order" value={r.soNumber} /><ValueField label="Delivery Order" change="new" req={R.meet} value={dn} /><ValueField label="Customer" value={custName(r.customerId)} />
          <ValueField label="Asset" value={a ? `${a.assetId} - ${a.name}` : '-'} /><ValueField label="Asset Status" value={a ? <StatusChip status={a.assetStatus} /> : '-'} />
          <ValueField label="Return Method" change="new" req={R.ret} value={r.method} /><ValueField label="Return Entry Timestamp" change="new" req={R.ret} value={r.timestamp.replace('T', ' ')} />
          <ValueField label="Billing" change="new" req={R.ret} value={`Stopped at ${r.timestamp.replace('T', ' ')}`} /><ValueField label="Inspection Status" change="new" req={R.ret} value={r.inspection} />
          <ValueField label="Reached Yard" value={r.reachedYard} /><ValueField label="Outcome" change="new" req={R.rreturn} value={r.outcome ?? 'In progress'} />
          <ValueField label="Damage Charge" change="new" req={R.ret} value={r.waiverApplied ? 'Covered by damage waiver' : r.damageCharge !== undefined ? aed(r.damageCharge) : '-'} /><ValueField label="Damage Waiver on order" change="new" req={R.meet} value={waiver ? 'Yes' : 'No'} /><ValueField label="Damage Invoice" change="new" req={R.ret} value={chargeInv ? `${chargeInv.number} (${chargeInv.approval === 'Approved' ? chargeInv.payStatus : chargeInv.approval})` : charge ? 'Not invoiced yet' : waiver && r.inspection === 'Damage Found' ? 'Not allowed (damage waiver paid)' : '-'} />{r.collection && <ValueField label="Failed collection" change="new" req={R.meet} value={r.collection.by === 'Client' ? `Charged to client ${aed(r.collection.amount)}` : 'Company loss'} />}<ValueField label="Fuel Note" change="new" req={R.ret} value={r.fuelNote} />
        </ValueGrid>
        <Box sx={{ mt: 3 }}>
          <TabPanels tabs={[
            { label: 'Checklists', content: <Box><Text type="s3" weight="medium">Pre-Return Site Checklist</Text>{r.siteChecklist.map((c) => <Text key={c} type="s4">- {c}</Text>)}<Text type="s3" weight="medium" sx={{ mt: 2 }}>Operations Return Checklist (Yard)</Text>{r.yardChecklist.length ? r.yardChecklist.map((c) => <Text key={c} type="s4">- {c}</Text>) : <Text type="s4">Not completed yet. The asset cannot become Ready for Hire until it is.</Text>}</Box> },
            { label: 'Trips', content: <TripsTable rows={rTrips} empty={r.method === 'Company Collection' ? 'No trip recorded for this collection' : 'Client self-return: no trip'} /> },
            { label: 'Photos', content: <Text type="s4">{r.photos.join(', ') || 'None'}</Text> },
            { label: 'Return log', content: <Timeline items={[...r.log].reverse()} /> },
          ]} />
        </Box>
      </Page>
      <AppDialog open={yard} title="Asset reached the Yard" onClose={() => setYard(false)} confirmLabel="Confirm" onConfirm={() => { reachYard(r, yardName); toast('Asset is now in the Yard, inspection pending'); setYard(false); }}>
        <SelectInput label="Yard" value={yardName} options={yards()} onChange={setYardName} hint="Off-Hire assets go to the Yard first, never straight to Ready for Hire" />
      </AppDialog>
      <AppDialog open={insp} title="Yard inspection" onClose={() => setInsp(false)} maxWidth="md" confirmLabel="Save inspection" confirmDisabled={!okInspect}
        onConfirm={() => { inspect(r, res as any, checks, res === 'Damage Found' ? { amount: Number(amount), note } : undefined); toast(res === 'Passed' ? 'Inspection passed, asset is Ready for Hire' : 'Damage recorded, asset sent to Maintenance'); setInsp(false); }}>
        <FormGrid cols={1}>
          <SelectInput label="Inspection Status" required value={res} options={['Passed', 'Damage Found']} onChange={setRes} />
          <Box>{YARD_CHECKLIST.map((c) => <FormControlLabel key={c} sx={{ display: 'flex' }} control={<Checkbox size="small" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} />} label={<Text type="s3">{c}</Text>} />)}
            <Text type="s5" color="theme.secondary.700">Yard checklist items are admin-configurable. {res === 'Passed' ? 'Every item must be complete before the asset can become Ready for Hire.' : ''}</Text></Box>
          {res === 'Damage Found' && waiver && <Alert severity="info">The client paid a damage waiver on {r.soNumber}. A damage invoice is not allowed; the repair cost is borne by the company.</Alert>}
          {res === 'Damage Found' && <>{!waiver && <NumberInput label="Damage Charge (AED)" required value={amount} onChange={setAmount} hint="Decided manually by an authorised user" />}<TextInput label="Justification" required multiline rows={2} value={note} onChange={setNote} hint="Retained permanently against the originating Sales Order" /></>}
        </FormGrid>
      </AppDialog>
      <AppDialog open={fail.open} title="Collection failed" onClose={() => setFail({ ...fail, open: false })} confirmLabel="Save" confirmDisabled={!fail.by || !fail.note.trim() || (fail.by === 'Client' && !Number(fail.amount))}
        onConfirm={() => { failedCollection(r, fail.by, Number(fail.amount) || 0, fail.note); toast(fail.by === 'Client' ? 'Charge added to the Sales Order' : 'Recorded as a company loss'); setFail({ open: false, by: '', amount: '', note: '' }); }}>
        <FormGrid cols={1}>
          <SelectInput label="Responsible" required value={fail.by} options={FAULT_ATTRIBUTION} onChange={(v) => setFail({ ...fail, by: v })} hint="Client: charge the client. Company: our logistics problem, booked as a loss" />
          {fail.by === 'Client' && <NumberInput label="Charge to client (AED)" required value={fail.amount} onChange={(v) => setFail({ ...fail, amount: v })} />}
          <TextInput label="Note" required multiline rows={2} value={fail.note} onChange={(v) => setFail({ ...fail, note: v })} />
        </FormGrid>
      </AppDialog>
      <AppDialog open={noteOpen} title="Collection Note" onClose={() => setNoteOpen(false)} maxWidth="md" confirmLabel="Print" onConfirm={() => { window.print(); setNoteOpen(false); }}>
        <Box sx={{ border: '1px solid #D3D3D4', borderRadius: '6px', p: 2 }}>
          <Text type="s2" weight="medium">Gulf Power Rentals LLC: Equipment Collection Note</Text>
          <Text type="s4" sx={{ mt: 1 }}>Collection Note: {r.number} &nbsp; Sales Order: {r.soNumber} &nbsp; Delivery Order: {dn ?? '-'}</Text>
          <Text type="s4">Customer: {custName(r.customerId)}</Text>
          <Text type="s4">Asset: {a ? `${a.assetId} - ${a.name}` : '-'}</Text>
          <Text type="s4">Off-Hire date and time: {r.timestamp.replace('T', ' ')}</Text>
          <Text type="s4" sx={{ mt: 3 }}>Client name and signature: ______________________ &nbsp; Date: ____________</Text>
          <Text type="s4" sx={{ mt: 2 }}>Collected by (driver): {ct ? <u>{ct.transport === 'Own Fleet' ? ct.driver || '-' : ct.transporter}</u> : '______________________'} &nbsp; Vehicle: {ct ? <u>{ct.transport === 'Own Fleet' ? ct.plate : 'External transporter'}</u> : '____________'}</Text>
        </Box>
      </AppDialog>
    </>
  );
}
