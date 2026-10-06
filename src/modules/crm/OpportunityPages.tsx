import { PrintDialog } from './ActionDialogs';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { customers } from '@/mock-data/masters';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { TabPanels } from '@/components/Widgets';
import { neutral } from '@/theme/color';
import { nextNumber } from '@/store/store';
import { ACTIVITY_TYPES, DEPARTMENTS, OPP_PROBABILITY, OPP_STAGES, PRIORITIES, RATINGS, SALESPEOPLE, TODAY, WIN_LOSS_REASONS, yards, availability, custName, isRentalLine, masterValues, type Line, type Opportunity } from './data';
import { duplicateOpportunity, quoteFromOpportunity } from './flow';
import { ItemsTable } from './Items';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from './FormKit';
import { addrCols, blankAddr, blankContact, blankFollow, contactCols, followCols } from './LeadPages';
import { ActivityChip, R, aed, useFleet, useOpps, usePricing, useQuotes } from './shared';

const forecast = (o: Pick<Opportunity, 'estimated' | 'probability'>) => Math.round((o.estimated * o.probability) / 100);

function Pipeline({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: Opportunity[] }) {
  return (
    <AppDialog open={open} title="Sales Pipeline" onClose={onClose} maxWidth="xl">
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${OPP_STAGES.length}, minmax(150px, 1fr))`, gap: 1, overflowX: 'auto' }}>
        {OPP_STAGES.map((s) => (
          <Box key={s} sx={{ bgcolor: neutral[100], borderRadius: '6px', p: 1 }}>
            <Text type="s4" weight="medium">{s} ({rows.filter((r) => r.stage === s).length})</Text>
            {rows.filter((r) => r.stage === s).map((r) => (
              <Box key={r.id} sx={{ bgcolor: '#fff', border: `1px solid ${neutral[200]}`, borderRadius: '4px', p: 1, mt: 1 }}>
                <Text type="s5" weight="medium">{r.number}</Text><Text type="s5">{r.title}</Text><Text type="s5" color="theme.secondary.700">{custName(r.customerId)}, {aed(r.estimated)}</Text><ActivityChip activity={r.activity} />
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </AppDialog>
  );
}

const specs = (): { basic: Spec[]; owner: Spec[]; classification: Spec[] } => ({
  /* existing Opportunity fields in the existing order; NEW items are marked */
  basic: [
    { key: 'entity', label: 'Entity', type: 'master', master: 'entity', required: true, change: 'changed', req: R.meet, hint: 'First field, as agreed on the 5 Oct call' },
    { key: 'number', label: 'ID', type: 'readonly' },
    { key: 'customerId', label: 'Customer', type: 'select', options: customers.map((c) => ({ value: c.id, label: c.name })), required: true, value: (f) => f.customerId },
    { key: 'title', label: 'Opportunity Title', required: true, change: 'new', req: R.opp, hint: 'Searchable, carried to the Quotation, e.g. Rent 120 KVA for LGME Contracting' },
    { key: 'project', label: 'Project', required: true, change: 'new', req: R.meet, hint: "The client's project or site" },
    { key: 'contact', label: 'Contact Person', required: true, change: 'new', req: R.meet },
    { key: 'activity', label: 'Activity Type', type: 'select', options: [...ACTIVITY_TYPES], change: 'new', req: R.meet, hint: 'Optional here, the detail is known at the Quotation. One Activity Type per opportunity' },
    { key: 'expectedClose', label: 'Expected Closing Date', type: 'date', required: true },
    { key: 'estimated', label: 'Expected Revenue', type: 'number' },
    { key: 'stage', label: 'Stage', type: 'select', options: OPP_STAGES, required: true, change: 'changed', req: R.opp, hint: 'Existing stages kept; Enquiry, Quoted and Won added' },
    { key: 'probability', label: 'Probability', type: 'number', hint: 'Filled from the Stage, editable' },
    { key: 'winLossReason', label: 'Win/Loss Reason', type: 'select', options: WIN_LOSS_REASONS, show: (f) => ['Won', 'Lost'].includes(f.stage) },
    { key: 'phone', label: 'Phone Number' }, { key: 'emailId', label: 'Email ID' },
    { key: 'website', label: 'Website' }, { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
    { key: 'vat', label: 'VAT Number', hint: '15 digits' }, { key: 'crn', label: 'CRN', hint: '10 digits' }, { key: 'reference', label: 'Reference No.' },
    { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
    { key: 'rating', label: 'Rating', type: 'select', options: RATINGS, change: 'new', req: R.opp },
    { key: 'forecast', label: 'Sales Forecast Value', type: 'readonly', change: 'new', req: R.opp, value: (f) => aed(forecast({ estimated: Number(f.estimated) || 0, probability: Number(f.probability) || 0 })), hint: 'Expected Revenue x Probability. Formula and period to be confirmed with client' },
    { key: 'approvalRequired', label: 'Approval Required', type: 'check', change: 'new', req: R.opp, hint: 'Off by default. Thresholds to be confirmed with client' },
    { key: 'site', label: 'Location / Site', change: 'new', req: R.opp }, { key: 'nextAction', label: 'Next Action', change: 'new', req: R.opp },
  ],
  owner: [
    { key: 'owner', label: 'Salesperson', type: 'select', options: SALESPEOPLE, required: true }, { key: 'phone', label: 'Phone Number', type: 'readonly' }, { key: 'emailId', label: 'Email ID', type: 'readonly' },
    { key: 'source', label: 'Source', type: 'master', master: 'leadSource' }, { key: 'industry', label: 'Industry', type: 'master', master: 'industry' }, { key: 'narration', label: 'Narration', type: 'textarea' },
  ],
  classification: [{ key: 'location', label: 'Location', type: 'select', options: yards }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS }],
});

export function OpportunityList({ activity }: { activity?: string } = {}) {
  const nav = useNavigate();
  const opps = useOpps();
  const [pipe, setPipe] = useState(false);
  return (
    <Page>
      <PageTitle title="Opportunity" />
      <DataTable<Opportunity> rows={activity ? opps.rows.filter((o) => o.activity === activity) : opps.rows} searchPlaceholder="Search by title, customer, project..." filter={{ key: 'stage', options: OPP_STAGES }} onAdd={() => nav('/crm/opportunities/add')} addLabel="Add Opportunity"
        toolbarRight={<Button variant="outlined" onClick={() => setPipe(true)}>View Sales Pipeline</Button>} onRowClick={(r) => nav(`/crm/opportunities/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'title', label: 'Opportunity Title', change: 'new', req: R.meet }, { key: 'customerId', label: 'Customer', render: (r) => custName(r.customerId) }, { key: 'entity', label: 'Entity', render: (r) => r.entity ?? 'Gulf Power Rentals LLC' },
          { key: 'project', label: 'Project', change: 'new', req: R.meet }, { key: 'activity', label: 'Activity Type', change: 'new', req: R.meet, render: (r) => <ActivityChip activity={r.activity} /> },
          { key: 'estimated', label: 'Expected Revenue', align: 'right', render: (r) => aed(r.estimated) },
          { key: 'stage', label: 'Stage', render: (r) => <StatusChip status={r.stage} /> }, { key: 'expectedClose', label: 'Closing Date' }, { key: 'contact', label: 'Contact Name' }, { key: 'owner', label: 'Salesperson' },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/opportunities/${r.id}`) }, { label: 'Edit', onClick: (r) => nav(`/crm/opportunities/${r.id}/edit`) }, { label: 'Delete', danger: true, onClick: (r) => opps.remove(r.id) }]} />
      <Pipeline open={pipe} onClose={() => setPipe(false)} rows={opps.rows} />
    </Page>
  );
}

export function OpportunityForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const opps = useOpps();
  const fleet = useFleet();
  const pricing = usePricing();
  const ex = id ? opps.get(id) : undefined;
  const S = specs();
  const [f, setF] = useState<Record<string, any>>(() => ({ number: ex?.number ?? 'Auto-generated', customerId: '', contact: '', project: '', title: '', owner: 'Leena Thomas', activity: '', stage: 'Enquiry', rating: 'Warm', lines: [] as Line[], estimated: 0, probability: 10, expectedClose: '', source: '', site: '', approvalRequired: false, nextAction: '', entity: masterValues('entity')[0], currency: 'AED', priority: 'Medium', phone: '', emailId: '', website: '', vat: '', crn: '', reference: '', industry: '', narration: '', location: '', department: '', recordStatus: 'Active', attachments: [], followUps: [], addresses: [], contacts: [], ...(ex ?? {}) }));
  const [err, setErr] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<Opportunity | undefined>();
  const set = (k: string, v: any) => setF((x) => {
    const n: Record<string, any> = { ...x, [k]: v };
    if (k === 'stage') n.probability = OPP_PROBABILITY[v] ?? x.probability;
    if (k === 'customerId') { const c = customers.find((y) => y.id === v); n.contact = x.contact || c?.contact || ''; n.phone = c?.phone ?? x.phone; n.emailId = c?.email ?? x.emailId; }
    if (k === 'activity') n.lines = [];
    return n;
  });
  const zero = (f.lines as Line[]).filter(isRentalLine).filter((l) => l.group && l.category && (() => { const a = availability(l.group, l.category, fleet.rows); return a.owned.length + a.cross.length === 0; })());
  const write = () => {
    const rec = { ...(ex ?? {}), ...f, id: ex?.id ?? `op${Date.now()}`, number: ex?.number ?? nextNumber('OP', 30), date: ex?.date ?? TODAY, estimated: Number(f.estimated) || 0, probability: Number(f.probability) || 0 } as Opportunity;
    if (ex) opps.update(rec.id, rec); else opps.add(rec);
    toast(ex ? 'Opportunity updated' : 'Opportunity created');
    nav(`/crm/opportunities/${rec.id}`);
  };
  const save = () => {
    const e: Record<string, string> = {};
    ['customerId', 'contact', 'project', 'title', 'owner', 'stage', 'expectedClose', 'entity', 'currency'].forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    if (f.vat && !/^\d{15}$/.test(f.vat)) e.vat = 'VAT Number must be 15 digits';
    if (f.crn && !/^\d{10}$/.test(f.crn)) e.crn = 'CRN must be 10 digits';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const d = duplicateOpportunity({ id: ex?.id ?? '', title: f.title, project: f.project, customerId: f.customerId, contact: f.contact });
    if (d) { setDup(d); return; }
    write();
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Opportunity', to: '/crm/opportunities' }, { label: ex ? `Edit ${ex.number}` : 'Add Opportunity' }]} actions={<><Button variant="outlined" onClick={() => nav('/crm/opportunities')}>Discard</Button><Button variant="contained" onClick={save}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        {zero.length > 0 && <Alert severity="info" sx={{ mb: 2 }}>No unit of {zero.map((l) => `${l.group} ${l.category}`).join(', ')} is available across the fleet. This is flagged for pipeline and procurement planning but does not block the Opportunity.</Alert>}
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={S.basic} f={f} set={set} err={err} />
              <Section title="Attachments"><SpecForm specs={[{ key: 'attachments', label: 'Attachments', type: 'file' }, { key: 'recordStatus', label: 'Status', type: 'toggle', value: (x) => x.recordStatus !== 'Inactive' }]} f={f} set={(k, v) => (k === 'recordStatus' ? set(k, v ? 'Active' : 'Inactive') : set(k, v))} /></Section>
              <Section title="Opportunity Owner Detail"><SpecForm specs={S.owner} f={f} set={set} /></Section>
              <Section title="Classification"><SpecForm specs={S.classification} f={f} set={set} /></Section>
              <Section title={f.activity === 'Rental' || f.activity === 'AMC' ? 'Items (Category / Subcategory, optional)' : 'Items (optional)'} change="changed" req={R.meet}>
                {f.activity ? <ItemsTable lines={f.lines} onChange={(l) => set('lines', l)} header={f.activity} vatType="Standard (With VAT)" fleet={fleet.rows} pricing={pricing.rows} mode="opp" /> : <Text type="s4">Select the Activity Type to add items.</Text>}
              </Section>
              <Section title="Follow Up"><RowsEditor cols={followCols} rows={f.followUps} onChange={(r) => set('followUps', r)} blank={blankFollow} addLabel="Add Follow Up" empty="No follow ups" /></Section>
            </>) },
          { label: 'Address', content: <RowsEditor cols={addrCols} rows={f.addresses} onChange={(r) => set('addresses', r)} blank={blankAddr} addLabel="Add Address" empty="No addresses" /> },
          { label: 'Contact', content: <RowsEditor cols={contactCols} rows={f.contacts} onChange={(r) => set('contacts', r)} blank={blankContact} addLabel="Add Contact" empty="No contacts" /> },
          { label: 'Promotion', content: <Text type="s4">Promotions are applied on the Quotation. Rules come from Settings, Promotions (existing, unchanged).</Text> },
        ]} />
      </Page>
      <ConfirmDialog open={!!dup} title="Possible duplicate" description={`${dup?.number} has the same Opportunity Title, Project, Customer and Contact Person. Do you want to continue?`} confirmLabel="Continue" onClose={() => setDup(undefined)} onConfirm={() => { setDup(undefined); write(); }} />
    </>
  );
}

export function OpportunityView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const opps = useOpps();
  const quotes = useQuotes();
  const fleet = useFleet();
  const pricing = usePricing();
  const o = opps.get(id);
  if (!o) return <Page><PageTitle title="Opportunity not found" right={<Button variant="outlined" onClick={() => nav('/crm/opportunities')}>Back</Button>} /></Page>;
  const qt = quotes.get(o.quotationId);
  const S = specs();
  const f = { ...o, entity: o.entity ?? 'Gulf Power Rentals LLC', currency: o.currency ?? 'AED', priority: o.priority ?? 'Medium' };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Opportunity', to: '/crm/opportunities' }, { label: o.number }]} status={<StatusChip status={o.stage} />}
        actions={<>
          <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} doc="Opportunity" /><MenuButton label="Actions" items={[{ label: 'Print', onClick: () => setPrintOpen(true) }, { label: 'Edit', disabled: !!qt || o.stage === 'Won', onClick: () => nav(`/crm/opportunities/${o.id}/edit`) }, { label: 'Duplicate', onClick: () => toast('Opportunity duplicated as a draft', 'info') }, { label: 'Delete', disabled: !!qt, onClick: () => { opps.remove(o.id); nav('/crm/opportunities'); } }]} />
          {o.leadId && <Button variant="outlined" onClick={() => nav(`/crm/leads/${o.leadId}`)}>View Lead</Button>}
          {qt ? <Button variant="contained" onClick={() => nav(`/crm/quotations/${qt.id}`)}>View Quotation</Button> : <Button variant="contained" onClick={() => { const q = quoteFromOpportunity(o); toast('Quotation created from the Opportunity'); nav(`/crm/quotations/${q}/edit`); }}>Make Quotation</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={S.basic} f={f} />
              <Section title="Opportunity Owner Detail"><SpecView specs={S.owner} f={f} cols={3} /></Section>
              <Section title="Classification"><SpecView specs={S.classification} f={f} cols={3} /></Section>
              <Section title="Items" change="changed" req={R.meet}><ItemsTable lines={o.lines} header={o.activity} vatType="Standard (With VAT)" fleet={fleet.rows} pricing={pricing.rows} mode="opp" locked /></Section>
              <Section title="Follow Up"><RowsEditor cols={followCols} rows={o.followUps ?? []} locked blank={blankFollow} empty="No follow ups" /></Section>
            </>) },
          { label: 'Address', content: <RowsEditor cols={addrCols} rows={o.addresses ?? []} locked blank={blankAddr} empty="No addresses" /> },
          { label: 'Contact', content: <RowsEditor cols={contactCols} rows={o.contacts ?? []} locked blank={blankContact} empty="No contacts" /> },
          { label: 'Promotion', content: <Text type="s4">Promotions are applied on the Quotation.</Text> },
        ]} />
      </Page>
    </>
  );
}
