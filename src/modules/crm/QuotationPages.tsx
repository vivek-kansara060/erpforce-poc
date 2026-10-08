import { useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { MenuButton, useToast } from '@/components/Dialogs';
import { SelectInput } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Panel } from '@/components/Widgets';
import { Text } from '@/components/Text';
import { nextNumber } from '@/store/store';
import { QUOTE_STATUSES, TODAY, VAT_TYPES, cust, custName, docTotals, log, type Line, type Quotation } from './data';
import { orderFromQuotation, reviseQuotation } from './flow';
import { ActivityChip, R, aed, useFleet, useOpps, usePricing, useQuotes } from './shared';
import { CommercialTabs, Totals, commercialErrors, withHeaderCascade } from './CommercialTabs';
import { ItemsTable, lineErrors } from './Items';
import { EmailDialog, PrintDialog } from './ActionDialogs';

export { Totals };

/** Quotation as the form sees it: stored fields plus the derived read-only ones, with defaults for the existing header fields. */
const toForm = (q: Partial<Quotation>, oppNo = '', title = ''): Record<string, any> => ({
  transactionType: 'Credit', postingTime: '09:00', exchangeRate: 1, currency: 'AED', paymentTerms: '30 days', location: 'Jebel Ali Main Yard', salesperson: q.preparedBy, discountOn: 'Gross Amount', ...q,
  number: q.number ?? 'Auto-generated', status: q.status ?? 'Draft', version: q.version ?? 1, oppNo, title: title || q.description || '', contactPerson: q.contactPerson ?? cust(q.customerId ?? '')?.contact ?? '',
});

export function QuotationList({ activity }: { activity?: string } = {}) {
  const nav = useNavigate();
  const quotes = useQuotes();
  return (
    <Page>
      <PageTitle title="Quotation" />
      <DataTable<Quotation> rows={activity ? quotes.rows.filter((q) => q.activity === activity) : quotes.rows} searchPlaceholder="Search quotations..." filter={{ key: 'status', options: QUOTE_STATUSES }} onAdd={() => nav('/crm/quotations/add')} addLabel="Add Quotation" onRowClick={(r) => nav(`/crm/quotations/${r.id}`)}
        columns={[
          { key: 'number', label: 'Series Number' }, { key: 'date', label: 'Date' }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) },
          { key: 'activity', label: 'Activity Type', change: 'new', req: R.meet, render: (r) => <ActivityChip activity={r.activity} /> },
          { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> }, { key: 'preparedBy', label: 'Salesperson' }, { key: 'entity', label: 'Company Name' },
          { key: 'validUntil', label: 'Expiration Date' }, { key: 'version', label: 'Version' },
          { key: 'total', label: 'Total Value', align: 'right', render: (r) => aed(docTotals(r.lines, r.discountPct, r.vatType).total) },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/quotations/${r.id}`) }, { label: 'Edit', onClick: (r) => nav(`/crm/quotations/${r.id}/edit`), hidden: (r) => !['Draft', 'Rejected'].includes(r.status) }, { label: 'Delete', danger: true, onClick: (r) => quotes.remove(r.id), hidden: (r) => r.status !== 'Draft' }]} />
    </Page>
  );
}

export function QuotationForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const quotes = useQuotes();
  const opps = useOpps();
  const fleet = useFleet();
  const pricing = usePricing();
  const [sp] = useSearchParams();
  const onlyActivity = sp.get('activity');
  const ex = id ? quotes.get(id) : undefined;
  const locked = !!ex && !['Draft', 'Rejected'].includes(ex.status);
  const [f, setF] = useState<Record<string, any>>(() => ex ? toForm(ex, opps.get(ex.oppId)?.number, opps.get(ex.oppId)?.title) : toForm({ oppId: '', activity: undefined, entity: '', customerId: '', description: '', validUntil: '', preparedBy: 'Leena Thomas', designation: 'Sales Representative', mobile: '+971 50 400 1101', email: 'sales@gulfpowerrentals.ae', template: '', terms: 'Payment: as per the payment terms from invoice date. Fuel is not included in the rental rate and is billed separately.', vatType: VAT_TYPES[0], discountPct: 0, pushToOpp: false, lines: [] as Line[] } as any));
  const [err, setErr] = useState<Record<string, string>>({});
  const [lineErr, setLineErr] = useState<string[]>([]);
  const set = (k: string, v: any) => setF((x) => withHeaderCascade(x, k, v));
  const opp = opps.get(f.oppId);
  const pickOpp = (v: string) => { const o = opps.get(v); setF((x) => ({ ...x, oppId: v, oppNo: o?.number, title: o?.title, customerId: o?.customerId ?? '', activity: o?.activity || onlyActivity || undefined, entity: o?.entity ?? x.entity, currency: o?.currency ?? x.currency, description: x.description || o?.title || '', contactPerson: o?.contact ?? '', lines: [] })); };
  const save = () => {
    const e: Record<string, string> = { ...commercialErrors(f) };
    ['oppId', 'validUntil', 'preparedBy', 'designation', 'mobile', 'email', 'template'].forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    const le = lineErrors(f.lines, f.activity);
    setErr(e); setLineErr(le);
    if (Object.keys(e).length || le.length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const { oppNo, title, ...rest } = f;
    void oppNo; void title;
    const rec = { ...(ex ?? { version: 1, status: 'Draft', log: [log('Quotation created')] }), ...rest, id: ex?.id ?? `qt${Date.now()}`, number: ex?.number ?? nextNumber('QT', 108), date: ex?.date ?? TODAY, customerId: opp!.customerId, discountPct: Number(f.discountPct) || 0 } as Quotation;
    if (ex) quotes.update(rec.id, { ...rec, log: [log('Quotation edited', 'Field changes recorded in the audit trail'), ...ex.log] }); else { quotes.add(rec); opps.update(opp!.id, { quotationId: rec.id, stage: ['Enquiry', 'Qualified'].includes(opp!.stage) ? 'Quoted' : opp!.stage }); }
    if (f.pushToOpp) opps.update(opp!.id, { estimated: Math.round(docTotals(f.lines, f.discountPct, f.vatType).total) });
    toast(ex ? 'Quotation updated' : 'Quotation created');
    nav(`/crm/quotations/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Quotation', to: '/crm/quotations' }, { label: ex ? `Edit ${ex.number}` : 'Add Quotation' }]} actions={<><Button variant="outlined" onClick={() => nav('/crm/quotations')}>Discard</Button>{!locked && <Button variant="contained" onClick={save}>Save</Button>}</>} />
      <Page sx={{ pt: 2 }}>
        {locked && <Alert severity="info" sx={{ mb: 2 }}>This quotation is {ex!.status}. Use Create Revision on the view page to change it; the previous version is retained in full.</Alert>}
        {lineErr.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{lineErr.map((m) => <div key={m}>{m}</div>)}</Alert>}
        {!ex && <Box sx={{ mb: 2, maxWidth: 640 }}><SelectInput label="Opportunity Title" required value={f.oppId} options={opps.rows.filter((o) => (!o.quotationId || o.id === f.oppId) && (!onlyActivity || !o.activity || o.activity === onlyActivity)).map((o) => ({ value: o.id, label: `${o.title} (${custName(o.customerId)})` }))} onChange={pickOpp} error={err.oppId} hint="Search by Opportunity Title. A Quotation is generated from an Opportunity; Customer and Entity come from it" /></Box>}
        {f.oppId && (
          <CommercialTabs kind="quote" f={f} set={set} err={err} locked={locked}
            items={f.activity ? <>
              <ItemsTable lines={f.lines} onChange={(l) => set('lines', l)} header={f.activity} vatType={f.vatType} locked={locked} fleet={fleet.rows} pricing={pricing.rows} mode="quote" contract={{ start: f.contractStart, end: f.contractEnd }} />
              <Totals lines={f.lines} discountPct={Number(f.discountPct) || 0} vatType={f.vatType} currency={f.currency} shipping={(Number(f.shippingCost) || 0) + (Number(f.handlingCost) || 0)} />
            </> : null} />
        )}
      </Page>
    </>
  );
}

export function QuotationView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const quotes = useQuotes();
  const opps = useOpps();
  const fleet = useFleet();
  const pricing = usePricing();
  const q = quotes.get(id);
  const [mail, setMail] = useState(false);
  if (!q) return <Page><PageTitle title="Quotation not found" right={<Button variant="outlined" onClick={() => nav('/crm/quotations')}>Back</Button>} /></Page>;
  const setStatus = (status: string, msg: string) => { quotes.update(q.id, { status, log: [log(msg), ...q.log] }); toast(msg); };
  const chain: Quotation[] = [];
  for (let p = q.prevId ? quotes.get(q.prevId) : undefined; p; p = p.prevId ? quotes.get(p.prevId) : undefined) chain.push(p);
  const so = q.salesOrderId;
  const o = opps.get(q.oppId);
  const f = toForm(q, o?.number, o?.title);
  return (
    <>
      <FormHeader crumbs={[{ label: 'Quotation', to: '/crm/quotations' }, { label: q.number }]} status={<StatusChip status={q.status} />}
        actions={<>
          {['Draft', 'Rejected'].includes(q.status) && <Button variant="outlined" onClick={() => nav(`/crm/quotations/${q.id}/edit`)}>Edit</Button>}
          {q.status === 'Draft' && <Button variant="outlined" onClick={() => setStatus('Submitted for Approval', 'Submitted for approval')}>Submit for Approval</Button>}
          {q.status === 'Submitted for Approval' && <><Button variant="outlined" color="error" onClick={() => setStatus('Rejected', 'Quotation rejected')}>Reject</Button><Button variant="outlined" onClick={() => setStatus('Approved', 'Quotation approved')}>Approve</Button></>}
          <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} doc="Quotation" />
          <MenuButton label="Actions" items={[
            { label: 'Create Revision', disabled: !['Approved', 'Converted to Sales Order', 'Submitted for Approval', 'Rejected'].includes(q.status), onClick: () => { const n = reviseQuotation(q); toast('Revision created, the previous version is retained'); nav(`/crm/quotations/${n}/edit`); } },
            { label: 'Print', onClick: () => setPrintOpen(true) },
            { label: 'Proforma Invoice', onClick: () => toast('Proforma Invoice generated', 'info') },
            { label: 'Send by Email', onClick: () => setMail(true) },
          ]} />
          <MenuButton label="View" items={[{ label: 'Opportunity', onClick: () => nav(`/crm/opportunities/${q.oppId}`) }, { label: 'Order', disabled: !so, onClick: () => nav(`/crm/sales-orders/${so}`) }, { label: 'Revision', disabled: !chain.length, onClick: () => nav(`/crm/quotations/${chain[0].id}`) }]} />
          {q.status === 'Approved' && <Button variant="contained" onClick={() => { const n = orderFromQuotation(q); toast('Sales Order created and confirmed'); nav(`/crm/sales-orders/${n}`); }}>Create Order</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <CommercialTabs kind="quote" f={f} set={() => undefined} locked
          items={<>
            <ItemsTable lines={q.lines} header={q.activity} vatType={q.vatType} locked fleet={fleet.rows} pricing={pricing.rows} mode="quote" />
            <Totals lines={q.lines} discountPct={q.discountPct} vatType={q.vatType} currency={q.currency} shipping={(q.shippingCost ?? 0) + (q.handlingCost ?? 0)} />
          </>} />
        <Panel title="Version History" sx={{ mt: 3 }} change="new" req={R.quote}>
          <Timeline items={q.log.map((c) => ({ ...c, tone: c.tone ?? ('blue' as const) }))} />
          {chain.length > 0 && <Text type="s4">Previous versions: {chain.map((p) => <a key={p.id} style={{ color: '#2EB273', marginRight: 8 }} href={`#/crm/quotations/${p.id}`}>{p.number} (v{p.version}, {p.status})</a>)}</Text>}
        </Panel>
      </Page>
      <EmailDialog open={mail} onClose={() => setMail(false)} docNo={q.number} customerId={q.customerId} onSent={(l) => quotes.update(q.id, { log: [l, ...q.log] })} />
    </>
  );
}
