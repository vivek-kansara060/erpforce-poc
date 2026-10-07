import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import { neutral } from '@/theme/color';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FileInput, FormGrid, SelectInput, TextInput, ValueField, ValueGrid } from '@/components/Form';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { suppliers } from '@/mock-data/masters';
import { DEPARTMENTS, RENTAL_DURATIONS, TODAY, categoryOptions, groupOptions, stockLocations, masterValues, unitsOf, fleetRows, type CrossHire, type CrossHireGrn } from '@/modules/crm/data';
import { createChOrderFromForm, createGrn, deleteGrn, saveChOrder, saveGrn, validateGrn } from '@/modules/crm/flow';
import { Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { aed, useChRfqs, useCrossHire, useOrders } from '@/modules/crm/shared';

const HIRE_SUPPLIERS = suppliers.filter((s) => s.type === 'Cross-Hire Company');
const supOpts = HIRE_SUPPLIERS.map((s) => ({ value: s.id, label: s.name }));
const R_CH = 'Existing ERP Cross Hire Orders and GRN; Rental > Cross-Hire (Rental Side)';

/* ------------------------------------------------------------------ Order add / edit form (existing ERP: Basic Details, Address & Contact) */
const orderSpecs = (soOpts: { value: string; label: string }[], fromRfq: boolean): Spec[] => [
  { key: 'number', label: 'Hire Order No.', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'soId', label: 'Rental Order ID (optional)', type: 'select', options: soOpts, disabled: fromRfq, hint: 'The demand this order is raised for. Units are bound to a Sales Order at the Delivery Order, not here' },
  { key: 'supplierId', label: 'Supplier', type: 'select', options: supOpts, required: true, disabled: fromRfq, hint: 'Suppliers of type Cross-Hire Company' },
  { key: 'type', label: 'Cross Hire Type', type: 'select', options: ['Inventory', 'Dropship'], required: true },
  { key: 'company', label: 'Company', type: 'master', master: 'entity', required: true },
  { key: 'confirmationDate', label: 'Confirmation Date', type: 'date', required: true },
  { key: 'expectedReceipt', label: 'Expected Receipt Date', type: 'date', required: true },
  { key: 'terms', label: 'Terms & Conditions' }, { key: 'agreement', label: 'Agreement' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', disabled: (f) => f.currency === 'AED', value: (f) => (f.currency === 'AED' ? 1 : f.exchangeRate) },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'master', master: 'paymentTerms', required: true },
  { key: 'representative', label: 'Purchase Representative', type: 'select', options: ['Leena Thomas', 'Yousef Karim', 'Omar Farouk', 'Bilal Ahmed'] },
  { key: 'reference', label: 'Reference Number' }, { key: 'incoterm', label: 'Incoterm' },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const rentalPeriodSpecs: Spec[] = [
  { key: 'startDate', label: 'Select Start Date & Time', type: 'date', required: true },
  { key: 'endDate', label: 'Select End Date & Time', type: 'date' },
  { key: 'totalPeriod', label: 'Total Period', type: 'readonly', value: (f) => (f.startDate && f.endDate ? `${Math.max(0, Math.round((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000))} day(s)` : '-') },
];
const itemSpecs: Spec[] = [
  { key: 'qty', label: 'Units required', type: 'number', required: true, change: 'changed', req: R_CH, hint: 'Number of units of the Category and Subcategory. Each asset is defined on the Goods Receipt, one fixed asset is one unit' }, { key: 'rate', label: 'Rate (per unit, AED)', type: 'number', required: true },
  { key: 'duration', label: 'Rental Duration Type', type: 'select', options: RENTAL_DURATIONS }, { key: 'location', label: 'Location', type: 'select', options: stockLocations },
];
const classSpecs: Spec[] = [{ key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
const addressSpecs: Spec[] = [
  { key: 'supplierAddress', label: 'Supplier Address', required: true }, { key: 'contactPerson', label: 'Contact Person', required: true },
  { key: 'shippingAddress', label: 'Shipping Address (Company)', required: true }, { key: 'billingAddress', label: 'Billing Address (Company)' }, { key: 'placeOfSupply', label: 'Place of Supply' },
];

export function ChOrderForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const orders = useOrders();
  const all = useCrossHire();
  const rfqs = useChRfqs();
  const existing = all.get(id);
  const rfq = rfqs.get(sp.get('rfq') ?? existing?.rfqId ?? undefined);
  const award = rfq?.responses.find((x) => x.vendorId === rfq.awardedVendorId);
  const rentals = orders.rows.filter((o) => o.activity === 'Rental');
  const so0 = rentals.find((o) => rfq?.soNumbers.includes(o.number));
  const line0 = so0?.lines.find((l) => l.activity === 'Rental' && l.group === rfq?.group && l.category === rfq?.category);
  const [f, setF] = useState<Record<string, any>>(() => existing
    ? { ...existing.form, number: existing.number, date: existing.date, soId: existing.soId, group: existing.group, category: existing.category, supplierId: existing.supplierId, type: existing.type ?? 'Inventory', qty: existing.qty ?? 1, rate: existing.rate / (existing.qty ?? 1), confirmationDate: existing.confirmationDate, expectedReceipt: existing.expectedReceipt, paymentTerms: existing.paymentTerms, startDate: existing.startDate, endDate: existing.endDate }
    : { date: TODAY, company: masterValues('entity')[0], currency: 'AED', type: 'Inventory', paymentTerms: rfq?.paymentTerms ?? '30 days', representative: 'Bilal Ahmed', department: 'Operations', location: 'Jebel Ali Main Yard', duration: 'Monthly',
      confirmationDate: TODAY, expectedReceipt: rfq?.expectedDate ?? TODAY, startDate: rfq?.start ?? line0?.start, endDate: rfq?.end ?? line0?.end, qty: rfq?.qty ?? 1, rate: award?.rate ?? '', supplierId: award?.vendorId ?? '', soId: so0?.id ?? '', group: rfq?.group ?? '', category: rfq?.category ?? '', narration: rfq ? `From ${rfq.number}, awarded to ${award?.vendor ?? ''}` : '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, ...(k === 'group' ? { category: '' } : {}) }));
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    (draft ? ['group', 'category', 'supplierId'] : ['date', 'group', 'category', 'supplierId', 'type', 'company', 'confirmationDate', 'expectedReceipt', 'currency', 'paymentTerms', 'startDate', 'qty', 'rate', 'supplierAddress', 'contactPerson', 'shippingAddress']).forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = 'End must be after start';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const sup = HIRE_SUPPLIERS.find((s) => s.id === f.supplierId)!;
    if (existing) {
      saveChOrder(existing.id, { date: f.date, supplierId: sup.id, supplier: sup.name, type: f.type, qty: Number(f.qty), rate: Number(f.rate) * Number(f.qty), group: f.group, category: f.category, soId: f.soId ?? '', confirmationDate: f.confirmationDate, expectedReceipt: f.expectedReceipt, paymentTerms: f.paymentTerms, startDate: f.startDate, endDate: f.endDate, form: f, status: draft ? 'Draft' : existing.status === 'Draft' || existing.status === 'Rejected' ? 'Pending' : existing.status });
      toast('Order updated'); nav(`/rental/cross-hire-orders/${existing.id}`); return;
    }
    const nid = createChOrderFromForm({ supplierId: sup.id, supplier: sup.name, soId: f.soId || undefined, group: f.group, category: f.category, type: f.type, qty: Number(f.qty) || 1, rate: Number(f.rate) || 0, draft, rfqId: rfq?.id, requestIds: rfq?.requestIds, form: f });
    toast(draft ? 'Order saved as draft' : 'Order saved'); nav(`/rental/cross-hire-orders/${nid}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: existing ? `Edit ${existing.number}` : 'Add New' }]}
        actions={<><Button variant="text" onClick={() => nav(existing ? `/rental/cross-hire-orders/${existing.id}` : '/rental/cross-hire-orders')}>Discard</Button>{(!existing || existing.status === 'Draft') && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>{existing ? 'Save' : 'Submit'}</Button></>} />
      <Page sx={{ pt: 2 }}>
        {rfq && <Alert severity="info" sx={{ mb: 2 }}>Prefilled from {rfq.number}: supplier, rate and rental period come from the awarded response.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={orderSpecs(rentals.map((o) => ({ value: o.id, label: o.number })), !!rfq && !!so0)} f={f} set={set} err={err} />
              <Section title="Rental Period"><SpecForm specs={rentalPeriodSpecs} f={f} set={set} err={err} cols={3} /></Section>
              <Section title="Items" change="changed" req={R_CH}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
                  <SelectInput label="Category" required value={f.group ?? ''} options={groupOptions()} onChange={(v) => set('group', v)} error={err.group} />
                  <SelectInput label="Subcategory" required value={f.category ?? ''} options={f.group ? categoryOptions(f.group) : []} onChange={(v) => set('category', v)} error={err.category} />
                </Box>
                <SpecForm specs={itemSpecs} f={f} set={set} err={err} cols={4} />
                <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{f.group && f.category ? `${f.group} ${f.category}, UoM Nos. Total ${aed((Number(f.qty) || 0) * (Number(f.rate) || 0))} before VAT.` : 'Choose the Category and Subcategory. The assets themselves are defined on the Goods Receipt.'}</Text>
              </Section>
              <Section title="Attachment"><FileInput label="Attachment" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
              <Section title="Classification"><SpecForm specs={classSpecs} f={f} set={set} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecForm specs={addressSpecs} f={f} set={set} err={err} /> },
        ]} />
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ Goods Receipt Note (separate form, created from the approved order) */
const grnStatus = (g: CrossHireGrn) => (g.validated ? 'Validated' : 'Pending');
const grnSpecs: Spec[] = [
  { key: 'number', label: 'Goods Receipt No.', type: 'readonly', value: (f) => f.number ?? 'Auto-generated' },
  { key: 'date', label: 'Receipt Date', type: 'date', required: true },
  { key: 'vendor', label: 'Vendor', type: 'readonly' }, { key: 'currency', label: 'Currency', type: 'readonly' }, { key: 'company', label: 'Company', type: 'readonly' },
  { key: 'receivedBy', label: 'Received By', type: 'select', options: ['Sanjay Kumar', 'Bilal Ahmed', 'Omar Farouk'] },
  { key: 'narration', label: 'Narration', type: 'textarea', full: true },
];
const transportSpecs: Spec[] = [{ key: 'transportedBy', label: 'Transported By' }, { key: 'driver', label: 'Driver' }, { key: 'driverId', label: 'ID' }, { key: 'vehicle', label: 'Vehicle Number' }];
const grnClass: Spec[] = [{ key: 'location', label: 'Location', type: 'select', options: stockLocations }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }];
const grnAddress: Spec[] = [{ key: 'supplierAddress', label: 'Supplier Address' }, { key: 'contactPerson', label: 'Contact Person' }, { key: 'shippingAddress', label: 'Shipping Address' }, { key: 'billingAddress', label: 'Billing Address' }, { key: 'placeOfSupply', label: 'Place of Supply' }];

export function ChGrnList() {
  const { id } = useParams();
  const nav = useNavigate();
  const c = useCrossHire().get(id);
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" /></Page>;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: `/rental/cross-hire-orders/${c.id}` }, { label: 'Goods Receipt' }]} />
      <Page>
        <PageTitle title="Goods Receipt" subtitle="Goods Receipt Notes are created from the Receive button of an approved Inventory order" change="new" req={R_CH} />
        <DataTable<CrossHireGrn> hideToolbar rows={c.grns ?? []} emptyText="No goods receipt yet" onRowClick={(g) => nav(`/rental/cross-hire-orders/${c.id}/grns/${g.id}`)}
          columns={[{ key: 'number', label: 'ID' }, { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Vendor', render: () => c.supplier }, { key: 'company', label: 'Company', render: () => c.form?.company ?? masterValues('entity')[0] }, { key: 'currency', label: 'Currency', render: () => c.form?.currency ?? 'AED' }, { key: 'status', label: 'Status', render: (g) => <StatusChip status={grnStatus(g)} /> }]} />
      </Page>
    </>
  );
}

export function ChGrnForm() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const c = useCrossHire().get(id);
  const g0 = (c?.grns ?? []).find((x) => x.id === gid);
  const [f, setF] = useState<Record<string, any>>(() => ({ date: TODAY, receivedBy: 'Sanjay Kumar', transportedBy: c?.supplier ?? '', location: 'Jebel Ali Main Yard', department: 'Operations', attachments: [], ...g0 }));
  const [err, setErr] = useState<Record<string, string>>({});
  if (!c) return <Page><PageTitle title="Cross Hire Order not found" /></Page>;
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.date) e.date = 'This field is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields', 'error'); return; }
    const { number, vendor, currency, company, ...rest } = f;
    void number; void vendor; void currency; void company;
    const { qty, traces, validated, ...head } = rest as any;
    void qty; void traces; void validated;
    const gid2 = g0 ? g0.id : createGrn(c.id, head);
    if (g0) saveGrn(c.id, g0.id, head);
    toast('Goods Receipt Note saved successfully. Add the assets received on the Receiving tab.');
    nav(`/rental/cross-hire-orders/${c.id}/grns/${gid2}`);
  };
  const view = { ...f, vendor: c.supplier, currency: c.form?.currency ?? 'AED', company: c.form?.company ?? masterValues('entity')[0] };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: `/rental/cross-hire-orders/${c.id}` }, { label: 'Goods Receipt', to: `/rental/cross-hire-orders/${c.id}/grns` }, { label: g0 ? `Edit ${g0.number}` : 'Add New' }]}
        actions={<><Button variant="text" onClick={() => nav(`/rental/cross-hire-orders/${c.id}/grns`)}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={grnSpecs} f={view} set={set} err={err} />
              <Section title="Items">
                <DataTable hideToolbar rows={[{ id: 'l' }]} columns={[
                  { key: 'item', label: 'Item', render: () => `${c.group} ${c.category}` }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'line', label: 'Order Line', render: () => c.number },
                  { key: 'ord', label: 'Units ordered', align: 'right', render: () => c.qty ?? 1 }, { key: 'got', label: 'Assets received', align: 'right', render: () => unitsOf(c).length }, { key: 'rem', label: 'Remaining', align: 'right', render: () => Math.max(0, (c.qty ?? 1) - unitsOf(c).length) },
                  { key: 'trace', label: 'Trace Details', render: () => <Text type="s5">Added after saving, on the Receiving tab</Text> },
                ]} />
              </Section>
              <Section title="Transportation"><SpecForm specs={transportSpecs} f={f} set={set} cols={4} /></Section>
              <Section title="Classification"><SpecForm specs={grnClass} f={f} set={set} /></Section>
              <Section title="Attachment"><FileInput label="Attachment" multiple value={f.attachments ?? []} onChange={(v) => set('attachments', v)} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecForm specs={grnAddress} f={f.address ?? {}} set={(k, v) => set('address', { ...(f.address ?? {}), [k]: v })} /> },
        ]} />
      </Page>
    </>
  );
}

type Trace = CrossHireGrn['traces'][number];
const CONDITIONS: NonNullable<Trace['condition']>[] = ['OK', 'Needs check', 'Damaged'];
const blankTrace = (c: CrossHire): Trace => ({ serial: '', group: c.group, category: c.category, condition: 'OK' });
/** Per-row problems found while receiving: missing or duplicate serial (also against the register). */
const traceIssues = (rows: Trace[], validated = false) => rows.map((r, i) => {
  const sn = r.serial.trim();
  if (!sn) return 'Serial number missing';
  if (rows.some((x, j) => j !== i && x.serial.trim() === sn)) return 'Duplicate serial on this receipt';
  if (!validated && fleetRows().some((a) => a.engineNo === sn)) return 'Serial already on the register';
  return '';
});

/**
 * Receiving grid: one row per asset still to come (1 fixed asset = 1 unit), filled in on the page. Serials can be pasted as a list; a different Category or
 * Subcategory than ordered is flagged; a damaged unit still enters the register, as Under Maintenance.
 */
function ReceivingGrid({ c, g, rows, setRows, room }: { c: CrossHire; g: CrossHireGrn; rows: Trace[]; setRows: (r: Trace[]) => void; room: number }) {
  const [paste, setPaste] = useState('');
  const issues = traceIssues(rows, g.validated);
  const differs = (t: Trace) => t.group !== c.group || t.category !== c.category;
  const setRow = (i: number, p: Partial<Trace>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setCount = (n: number) => { const k = Math.max(0, Math.min(room, n)); setRows(k >= rows.length ? [...rows, ...Array.from({ length: k - rows.length }, () => blankTrace(c))] : rows.slice(0, k)); };
  const applyPaste = () => {
    const list = paste.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, Math.max(room, rows.length));
    if (!list.length) return;
    const next = [...rows];
    list.forEach((sn, i) => { if (next[i]) next[i] = { ...next[i], serial: sn }; else next.push({ ...blankTrace(c), serial: sn }); });
    setRows(next); setPaste('');
  };
  const nOk = rows.length - issues.filter(Boolean).length;
  const done = g.validated;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', p: 1.5, bgcolor: '#F6F8F7', borderRadius: '8px', mb: 2 }}>
        <Text type="s4">Ordered <b>{c.qty ?? 1}</b></Text><Text type="s4">Already received <b>{unitsOf(c).length}</b></Text><Text type="s4">Still to come <b>{room}</b></Text>
        <Text type="s4" weight="medium">This receipt <b>{rows.length}</b></Text>
        {!done && <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button size="small" variant="outlined" disabled={rows.length <= 0} onClick={() => setCount(rows.length - 1)}>-</Button>
          <Text type="s5">units on this receipt</Text>
          <Button size="small" variant="outlined" disabled={rows.length >= room} onClick={() => setCount(rows.length + 1)}>+</Button>
        </Box>}
      </Box>
      {!done && <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}><TextInput label="Paste or scan serial numbers" value={paste} onChange={setPaste} hint="Separate by space, comma or new line. They fill the rows from the top" /></Box>
        <Button variant="outlined" sx={{ mt: 2.5 }} onClick={applyPaste} disabled={!paste.trim()}>Fill rows</Button>
      </Box>}
      <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
        <Table size="small">
          <TableHead><TableRow sx={{ bgcolor: neutral[100] }}>{['#', 'Serial Number', 'Received as', 'Condition', 'Photo', 'Hours reading', 'Remarks', 'Check'].map((h) => <TableCell key={h} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8}><Text type="s4" color="theme.secondary.700">{room ? 'No unit on this receipt. Use + to add a row for each asset that arrived' : 'All ordered units are already received'}</Text></TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i} sx={{ bgcolor: r.condition === 'Damaged' ? '#FFF5F5' : differs(r) ? '#FFFAEB' : undefined }}>
                <TableCell>{i + 1}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{done ? r.serial : <TextField size="small" value={r.serial} error={!!issues[i] && !!r.serial} onChange={(e) => setRow(i, { serial: e.target.value })} sx={{ width: 150 }} />}</TableCell>
                <TableCell sx={{ py: 0.5, minWidth: 250 }}>{done ? `${r.group} ${r.category}` : (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Select size="small" value={r.group} onChange={(e) => setRow(i, { group: e.target.value, category: categoryOptions(e.target.value)[0] ?? '' })} sx={{ fontSize: 13, width: 120 }}>{groupOptions().map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select>
                    <Select size="small" value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} sx={{ fontSize: 13, width: 110 }}>{categoryOptions(r.group).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select>
                  </Box>)}
                  {differs(r) && <Text type="s5" color="#A6914D">Differs from order ({c.group} {c.category})</Text>}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{done ? r.condition ?? 'OK' : <Select size="small" value={r.condition ?? 'OK'} onChange={(e) => setRow(i, { condition: e.target.value as Trace['condition'] })} sx={{ fontSize: 13, width: 130 }}>{CONDITIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select>}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{done ? r.photo ?? '-' : <Button size="small" component="label" variant="text">{r.photo ?? 'Add'}<input hidden type="file" accept="image/*" onChange={(e) => setRow(i, { photo: e.target.files?.[0]?.name })} /></Button>}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{done ? r.hours ?? '-' : <TextField size="small" value={r.hours ?? ''} onChange={(e) => setRow(i, { hours: e.target.value })} sx={{ width: 90 }} />}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{done ? r.remarks ?? '-' : <TextField size="small" value={r.remarks ?? ''} onChange={(e) => setRow(i, { remarks: e.target.value })} sx={{ width: 160 }} />}</TableCell>
                <TableCell>{done ? <StatusChip status={fleetRows().find((a) => a.engineNo === r.serial)?.assetId ?? 'Registered'} tone="green" /> : issues[i] ? <Text type="s5" color="#C64D4D">{issues[i]}</Text> : <StatusChip status="OK" tone="green" />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>
        {rows.length} on this receipt, {nOk} ready, {rows.filter(differs).length} differ from the order, {rows.filter((r) => r.condition === 'Damaged').length} damaged. {done ? '' : 'Validate puts each asset on the Fixed Asset Register as Cross-Hired. A damaged unit enters as Under Maintenance.'}
      </Text>
    </Box>
  );
}

export function ChGrnView() {
  const { id, gid } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const c = useCrossHire().get(id);
  const g = (c?.grns ?? []).find((x) => x.id === gid);
  const room = c && g ? Math.max(0, (c.qty ?? 1) - unitsOf(c).length - (c.grns ?? []).filter((x) => x.id !== g.id && !x.validated).reduce((n, x) => n + x.traces.length, 0)) : 0;
  const [rows, setRows] = useState<Trace[] | null>(null);
  const [del, setDel] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!c || !g) return <Page><PageTitle title="Goods Receipt not found" /></Page>;
  const cur = rows ?? (g.traces.length ? g.traces : Array.from({ length: g.validated ? 0 : room }, () => blankTrace(c)));
  const issues = traceIssues(cur, g.validated);
  const base = `/rental/cross-hire-orders/${c.id}`;
  const clean = (r: Trace[]) => r.map((t) => ({ ...t, serial: t.serial.trim() }));
  const saveDraft = () => { saveGrn(c.id, g.id, { traces: clean(cur) }); toast('Receipt saved'); };
  const tryValidate = () => {
    if (!cur.length) { toast('Add at least one asset to validate', 'error'); return; }
    if (issues.some(Boolean)) { toast('Fix the highlighted rows first', 'error'); return; }
    setPreview(true);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Orders', to: '/rental/cross-hire-orders' }, { label: `ID: ${c.number}`, to: base }, { label: 'Goods Receipt', to: `${base}/grns` }, { label: g.number }]} status={<StatusChip status={grnStatus(g)} />}
        actions={<>
          {!g.validated && <MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`${base}/grns/${g.id}/edit`) }, { label: 'Delete', onClick: () => setDel(true) }]} />}
          {!g.validated && <Button variant="outlined" onClick={saveDraft}>Save Draft</Button>}
          {!g.validated && <Button variant="contained" onClick={tryValidate}>Validate</Button>}
          {g.validated && <Button variant="outlined" onClick={() => toast('Labels with QR code sent to the printer', 'info')}>Print Labels</Button>}
          {g.validated && <Button variant="outlined" onClick={() => nav(base)}>View Order</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Receiving', change: 'changed', req: R_CH, content: <ReceivingGrid c={c} g={g} rows={cur} setRows={(r) => setRows(r)} room={room} /> },
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={[...grnSpecs.filter((s) => s.key !== 'narration' && s.key !== 'number'), { key: 'narration', label: 'Narration' }]} f={{ ...g, vendor: c.supplier, currency: c.form?.currency ?? 'AED', company: c.form?.company ?? masterValues('entity')[0] }} />
              <Section title="Items">
                <DataTable hideToolbar rows={[{ id: 'l' }]} columns={[
                  { key: 'item', label: 'Item', render: () => `${c.group} ${c.category}` }, { key: 'uom', label: 'UoM', render: () => 'Nos' }, { key: 'line', label: 'Order Line', render: () => c.number },
                  { key: 'ord', label: 'Units ordered', align: 'right', render: () => c.qty ?? 1 }, { key: 'qty', label: 'Assets on this receipt', align: 'right', render: () => cur.length }, { key: 'loc', label: 'Location', render: () => g.location },
                ]} />
              </Section>
              <Section title="Transportation"><SpecView specs={transportSpecs} f={g} /></Section>
              <Section title="Classification"><SpecView specs={grnClass} f={g} /></Section>
            </>) },
          { label: 'Address & Contact', content: <SpecView specs={grnAddress} f={g.address ?? {}} /> },
        ]} />
      </Page>
      <ConfirmDialog open={preview} info title="Validate Goods Receipt" confirmLabel="Validate" onClose={() => setPreview(false)}
        description={`These ${cur.length} asset(s) will be added to the register as Cross-Hired (no depreciation): ${cur.map((t) => `${t.serial.trim()} as ${t.group} ${t.category}${t.condition === 'Damaged' ? ' (Damaged, Under Maintenance)' : ''}`).join('; ')}.`}
        onConfirm={() => { saveGrn(c.id, g.id, { traces: clean(cur) }); validateGrn({ ...c, grns: (c.grns ?? []).map((x) => (x.id === g.id ? { ...x, traces: clean(cur) } : x)) }, g.id); setPreview(false); setRows(null); toast(`${cur.length} asset(s) validated and on the Fixed Asset Register`); }} />
      <ConfirmDialog open={del} title="Delete Goods Receipt" description={`Delete ${g.number}?`} danger confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => { deleteGrn(c.id, g.id); toast('Deleted'); nav(`${base}/grns`); }} />
    </>
  );
}
