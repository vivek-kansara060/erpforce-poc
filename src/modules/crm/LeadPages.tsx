import { PrintDialog } from './ActionDialogs';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { FormSection, SelectInput, TextInput } from '@/components/Form';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { TabPanels } from '@/components/Widgets';
import { nextNumber } from '@/store/store';
import { ACTIVITY_TYPES, ACTOR, ADDRESS_TYPES, DEPARTMENTS, FOLLOW_TYPES, LEAD_PROBABILITY, LEAD_STATUSES, PRIORITIES, SALESPEOPLE, TODAY, yards, log, masterValues, type Addr, type ContactRow, type FollowUp, type Lead } from './data';
import { convertLead } from './flow';
import { Section, RowsEditor, SpecForm, SpecView, type Spec } from './FormKit';
import { ActivityChip, R, useLeads } from './shared';

const needsLost = (s: string) => ['Lost', 'Unqualified', 'Not qualified'].includes(s);
export const blankAddr: Addr = { type: 'Office', addressee: '', line1: '', city: '', state: '', country: 'United Arab Emirates', zip: '', phone: '' };
export const blankContact: ContactRow = { name: '', email: '', code: '+971', phone: '' };
export const blankFollow: FollowUp = { type: 'Call', date: '', remind: '', desc: '' };

/** Existing Lead form fields in the existing order; NEW items are marked. */
const basic: Spec[] = [
  { key: 'entity', label: 'Entity', type: 'master', master: 'entity', required: true, change: 'changed', req: R.meet, hint: 'Our own company, first field as agreed on the 5 Oct call' },
  { key: 'leadType', label: 'Type', type: 'radio', options: ['Company', 'Individual'], required: true, full: true },
  { key: 'number', label: 'ID', type: 'readonly' },
  { key: 'firstName', label: 'First Name', required: true, show: (f) => f.leadType === 'Individual' },
  { key: 'middleName', label: 'Middle Name', show: (f) => f.leadType === 'Individual' },
  { key: 'lastName', label: 'Last Name', required: true, show: (f) => f.leadType === 'Individual' },
  { key: 'company', label: 'Lead Company', required: true, show: (f) => f.leadType !== 'Individual' },
  { key: 'phone', label: 'Phone No.', required: true },
  { key: 'email', label: 'Email ID', required: true },
  { key: 'website', label: 'Website' },
  { key: 'currency', label: 'Currency', type: 'master', master: 'currency', required: true },
  { key: 'activity', label: 'Activity Type', type: 'select', options: [...ACTIVITY_TYPES], required: true, change: 'new', req: R.meet, hint: 'One Activity Type per enquiry; it drives the Opportunity, Quotation and Sales Order' },
  { key: 'status', label: 'Lead Status', type: 'select', options: LEAD_STATUSES, required: true },
  { key: 'probability', label: 'Conversion Probability', type: 'readonly', value: (f) => `${LEAD_PROBABILITY[f.status] ?? 0}%`, hint: 'Filled automatically from the Lead Status' },
  { key: 'lostReason', label: 'Lost Reason', type: 'master', master: 'lostReason', required: true, change: 'new', req: R.lead, show: (f) => needsLost(f.status) },
  { key: 'nextFollowUp', label: 'Next Follow-Up Date', type: 'date', change: 'new', req: R.lead, hint: 'Drives follow-up reminders' },
  { key: 'reference', label: 'Reference No.' },
  { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
  { key: 'vat', label: 'Vat Number', hint: '15 digits' },
  { key: 'crn', label: 'CRN', hint: '10 digits' },
  { key: 'responsible', label: 'Responsible Person', required: true },
  { key: 'tags', label: 'Classification / Tags', change: 'new', req: R.lead },
];
const owner: Spec[] = [
  { key: 'owner', label: 'Salesperson', type: 'select', options: SALESPEOPLE, required: true },
  { key: 'source', label: 'Source', type: 'master', master: 'leadSource', required: true },
  { key: 'industry', label: 'Industry', type: 'master', master: 'industry' },
  { key: 'annualRevenue', label: 'Annual Revenue', type: 'number' },
  { key: 'narration', label: 'Narration', type: 'textarea' },
];
const classification: Spec[] = [
  { key: 'location', label: 'Location', type: 'select', options: yards }, { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
];
export const followCols = [{ key: 'type', label: 'Follow Up Type', type: 'select' as const, options: FOLLOW_TYPES }, { key: 'date', label: 'Follow Up Date & Time', type: 'datetime' as const }, { key: 'remind', label: 'Remind Me', type: 'datetime' as const }, { key: 'desc', label: 'Description', width: 260 }];
export const addrCols = [{ key: 'type', label: 'Address Type', type: 'select' as const, options: ADDRESS_TYPES }, { key: 'addressee', label: 'Addressee' }, { key: 'line1', label: 'Address 1', width: 220 }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'country', label: 'Country' }, { key: 'zip', label: 'Zip Code' }, { key: 'phone', label: 'Contact Number' }, { key: 'defaultShipping', label: 'Default shipping address', type: 'check' as const }, { key: 'defaultBilling', label: 'Default Billing address', type: 'check' as const }];
export const contactCols = [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'code', label: 'Country Code', width: 90 }, { key: 'phone', label: 'Contact Number' }];

export function LeadList({ activity }: { activity?: string } = {}) {
  const nav = useNavigate();
  const leads = useLeads();
  return (
    <Page>
      <PageTitle title="Lead" />
      <DataTable<Lead> rows={activity ? leads.rows.filter((l) => l.activity === activity) : leads.rows} searchPlaceholder="Search leads..." filter={{ key: 'status', options: LEAD_STATUSES }}
        onAdd={() => nav('/crm/leads/add')} addLabel="Add Lead" onRowClick={(r) => nav(`/crm/leads/${r.id}`)}
        columns={[
          { key: 'number', label: 'ID' }, { key: 'contact', label: 'Name' }, { key: 'company', label: 'Company' },
          { key: 'activity', label: 'Activity Type', change: 'new', req: R.meet, render: (r) => <ActivityChip activity={r.activity} /> },
          { key: 'status', label: 'Lead Status', render: (r) => <StatusChip status={r.status} /> }, { key: 'owner', label: 'Owner' }, { key: 'source', label: 'Source' },
          { key: 'nextFollowUp', label: 'Next Follow-Up', change: 'new', req: R.lead, render: (r) => r.nextFollowUp ?? '-' },
          { key: 'rec', label: 'Status', render: (r) => <StatusChip status={r.recordStatus ?? 'Active'} /> },
        ]}
        actions={[{ label: 'View', onClick: (r) => nav(`/crm/leads/${r.id}`) }, { label: 'Edit', onClick: (r) => nav(`/crm/leads/${r.id}/edit`) }, { label: 'Delete', danger: true, onClick: (r) => leads.remove(r.id) }]} />
    </Page>
  );
}

export function LeadForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const leads = useLeads();
  const ex = id ? leads.get(id) : undefined;
  const number = ex?.number ?? 'Auto-generated';
  const [f, setF] = useState<Record<string, any>>(() => ({
    leadType: 'Company', company: '', firstName: '', middleName: '', lastName: '', phone: '', email: '', entity: masterValues('entity')[0], website: '', currency: 'AED', activity: '', status: 'New', lostReason: '', nextFollowUp: '', reference: '', priority: 'Medium',
    vat: '', crn: '', responsible: '', tags: '', owner: 'Leena Thomas', source: '', industry: '', annualRevenue: '', narration: '', location: '', department: '', recordStatus: 'Active', attachments: [], followUps: [], addresses: [], contacts: [], contact: '', ...(ex ?? {}), number,
  }));
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    const req = ['phone', 'email', 'entity', 'currency', 'activity', 'status', 'responsible', 'owner', 'source', ...(f.leadType === 'Individual' ? ['firstName', 'lastName'] : ['company'])];
    req.forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = 'This field is required'; });
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email';
    if (f.vat && !/^\d{15}$/.test(f.vat)) e.vat = 'VAT Number must be 15 digits';
    if (f.crn && !/^\d{10}$/.test(f.crn)) e.crn = 'CRN must be 10 digits';
    if (needsLost(f.status) && !f.lostReason) e.lostReason = 'Lost Reason is required when the status is Lost or Unqualified';
    setErr(e);
    if (!draft && Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    const company = f.leadType === 'Individual' ? `${f.firstName} ${f.lastName}`.trim() : f.company;
    const rec = { ...(ex ?? { comms: [] }), ...f, id: ex?.id ?? `ld${Date.now()}`, number: ex?.number ?? nextNumber('LD', 35), date: ex?.date ?? TODAY, company, contact: f.contact || f.responsible, probability: LEAD_PROBABILITY[f.status] ?? 0,
      lostReason: needsLost(f.status) ? f.lostReason : undefined, recordStatus: draft ? 'Draft' : f.recordStatus === 'Draft' ? 'Active' : f.recordStatus, annualRevenue: Number(f.annualRevenue) || undefined } as Lead;
    if (ex) leads.update(rec.id, rec); else leads.add(rec);
    toast(draft ? 'Lead saved as draft' : ex ? 'Lead updated' : 'Lead created');
    nav(`/crm/leads/${rec.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Lead', to: '/crm/leads' }, { label: ex ? `Edit ${ex.number}` : 'Add Lead' }]} actions={<><Button variant="outlined" onClick={() => nav('/crm/leads')}>Discard</Button><Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button><Button variant="contained" onClick={() => save(false)}>Save</Button></>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecForm specs={basic} f={f} set={set} err={err} />
              <Section title="Attachments">
                <SpecForm specs={[{ key: 'attachments', label: 'Attachments (RFQ, site plan, etc.)', type: 'file' }, { key: 'recordStatus', label: 'Status', type: 'toggle', value: (x) => x.recordStatus !== 'Inactive' }]} f={f} set={(k, v) => (k === 'recordStatus' ? set(k, v ? 'Active' : 'Inactive') : set(k, v))} />
              </Section>
              <Section title="Lead Owner Details"><SpecForm specs={owner} f={f} set={set} err={err} /></Section>
              <Section title="Follow Up"><RowsEditor cols={followCols} rows={f.followUps} onChange={(r) => set('followUps', r)} blank={blankFollow} addLabel="Add Follow Up" empty="No follow ups" /></Section>
              <Section title="Classifications"><SpecForm specs={classification} f={f} set={set} /></Section>
            </>) },
          { label: 'Address', content: <RowsEditor cols={addrCols} rows={f.addresses} onChange={(r) => set('addresses', r)} blank={blankAddr} addLabel="Add Address" empty="No addresses" /> },
          { label: 'Contact', content: <RowsEditor cols={contactCols} rows={f.contacts} onChange={(r) => set('contacts', r)} blank={blankContact} addLabel="Add Contact" empty="No contacts" /> },
        ]} />
      </Page>
    </>
  );
}

export function LeadView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const leads = useLeads();
  const l = leads.get(id);
  const [conf, setConf] = useState(false);
  const [com, setCom] = useState<{ open: boolean; type: string; text: string }>({ open: false, type: 'Phone call', text: '' });
  if (!l) return <Page><PageTitle title="Lead not found" right={<Button variant="outlined" onClick={() => nav('/crm/leads')}>Back to Lead</Button>} /></Page>;
  const convert = () => {
    const res = convertLead(l);
    toast(res.message, res.ok ? 'success' : 'error');
    setConf(false);
    if (res.ok) nav(`/crm/opportunities/${res.id}`);
  };
  const f = { ...l, probability: l.probability, entity: l.entity ?? 'Gulf Power Rentals LLC', currency: l.currency ?? 'AED' };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Lead', to: '/crm/leads' }, { label: l.number }]} status={<StatusChip status={l.status} />}
        actions={<>
          <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} doc="Lead" /><MenuButton label="Actions" items={[{ label: 'Edit', onClick: () => nav(`/crm/leads/${l.id}/edit`) }, { label: 'Print', onClick: () => setPrintOpen(true) }, { label: 'Duplicate', onClick: () => toast('Lead duplicated as a draft', 'info') }, { label: 'Delete', onClick: () => { leads.remove(l.id); nav('/crm/leads'); } }]} />
          <Button variant="outlined" onClick={() => setCom({ ...com, open: true })}>Communication Log</Button>
          {l.opportunityId ? <Button variant="contained" onClick={() => nav(`/crm/opportunities/${l.opportunityId}`)}>View Opportunity</Button> : ['Lost', 'Unqualified', 'Not qualified'].includes(l.status) ? null : <Button variant="contained" onClick={() => (l.activity ? setConf(true) : toast('An Activity Type is required before a Lead can be converted', 'error'))}>Convert</Button>}
        </>} />
      <Page sx={{ pt: 2 }}>
        <TabPanels tabs={[
          { label: 'Basic Details', content: (
            <>
              <SpecView specs={basic.filter((s) => s.key !== 'number').concat({ key: 'number', label: 'ID', type: 'readonly' })} f={f} />
              <Section title="Lead Owner Details"><SpecView specs={owner} f={f} cols={3} /></Section>
              <Section title="Follow Up"><RowsEditor cols={followCols} rows={l.followUps ?? []} locked blank={blankFollow} empty="No follow ups" /></Section>
              <Section title="Classifications"><SpecView specs={classification} f={f} cols={3} /></Section>
              <FormSection title="Communication Log">{l.comms.length ? <Timeline items={l.comms.map((c) => ({ ...c, tone: 'blue' as const }))} /> : <span>No entries yet</span>}</FormSection>
            </>) },
          { label: 'Address', content: <RowsEditor cols={addrCols} rows={l.addresses ?? []} locked blank={blankAddr} empty="No addresses" /> },
          { label: 'Contact', content: <RowsEditor cols={contactCols} rows={l.contacts ?? []} locked blank={blankContact} empty="No contacts" /> },
        ]} />
      </Page>
      <ConfirmDialog open={conf} info title="Convert to Opportunity" description={`${l.company} will become one Opportunity. Customer, Contact and the Activity Type (${l.activity}) are carried forward.`} confirmLabel="Convert" onClose={() => setConf(false)} onConfirm={convert} />
      <AppDialog open={com.open} title="Communication Log" onClose={() => setCom({ ...com, open: false })} confirmLabel="Add Entry" onConfirm={() => { if (!com.text.trim()) return; leads.update(l.id, { comms: [{ ...log(`${com.type}: ${com.text}`), by: ACTOR }, ...l.comms] }); setCom({ open: false, type: 'Phone call', text: '' }); toast('Entry added'); }}>
        <SelectInput label="Type" value={com.type} options={['Phone call', 'Email', 'Face to face', 'Virtual']} onChange={(v) => setCom({ ...com, type: v })} /><TextInput label="Agenda / Note" multiline rows={3} value={com.text} onChange={(v) => setCom({ ...com, text: v })} />
      </AppDialog>
    </>
  );
}
