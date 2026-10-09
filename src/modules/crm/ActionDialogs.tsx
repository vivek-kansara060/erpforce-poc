import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Checkbox } from '@mui/material';
import { Text } from '@/components/Text';
import { BANK_ACCOUNTS } from '@/modules/accounting/data';
import { advanceCollection } from '@/modules/accounting/engine';
import { suppliers } from '@/mock-data/masters';
import { AppDialog, useToast } from '@/components/Dialogs';
import { DateInput, FileInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { TODAY, cust, log, type Line, type LogItem } from './data';
import { NEXT_STEP, fulfilLine, getLine, getOrder, invoiceOrderLines, raiseCrossHire } from './flow';
import { MasterSelect, R, TO_CONFIRM, aed } from './shared';

/** Expiry decision for the whole order (decision 2): Extend the SAME Sales Order (on its Extend page, as a revision), or Proceed to Return. */
export function ExpiryDialog({ open, onClose, soId }: { open: boolean; onClose: () => void; soId?: string; lineId?: string }) {
  const nav = useNavigate();
  const [choice, setChoice] = useState('Extend the existing Sales Order');
  useEffect(() => { if (open) setChoice('Extend the existing Sales Order'); }, [open]);
  const so = getOrder(soId);
  if (!so) return null;
  const ret = choice.startsWith('Proceed');
  const go = () => { onClose(); nav(ret ? `/crm/customer-returns/add?so=${so.id}` : `/crm/sales-orders/${so.id}/extend`); };
  return (
    <AppDialog open={open} title={`Client confirmation: ${so.number}`} onClose={onClose} confirmLabel={ret ? 'Proceed to Return' : 'Open Extend page'} onConfirm={go}>
      <FormGrid cols={1}>
        <SelectInput label="Client decision" required change="new" req={R.exp} value={choice} options={['Extend the existing Sales Order', 'Proceed to Return']} onChange={setChoice} />
      </FormGrid>
      {!ret && <Alert severity="info" sx={{ mt: 2 }}>The existing Sales Order is revised on its Extend page: change the dates and rates there, and the previous version is kept under Revisions. No new order is created.</Alert>}
    </AppDialog>
  );
}

export function NextStepDialog({ open, onClose, soId, lineId }: { open: boolean; onClose: () => void; soId?: string; lineId?: string }) {
  const toast = useToast();
  const so = getOrder(soId);
  const l = getLine(so, lineId);
  const [opt, setOpt] = useState('');
  const [part, setPart] = useState('');
  const [hours, setHours] = useState('');
  if (!so || !l) return null;
  const step = NEXT_STEP[l.activity] ?? NEXT_STEP.Service;
  const service = l.activity === 'Service' || l.activity === 'Other';
  return (
    <AppDialog open={open} title={`${step.label}: ${l.item}`} onClose={onClose} confirmLabel="Confirm" confirmDisabled={(!!step.options && !opt) || (service && so.activity === 'Other' && !part.trim())}
      onConfirm={() => { const ref = fulfilLine(so.id, l.id, [opt, part, hours && `${hours} h`].filter(Boolean).join(', ') || undefined); toast(`${step.done}. Invoice ${ref} raised, pending approval in Accounting`); onClose(); }}>
      <FormGrid cols={1}>
        {step.options && <SelectInput label="Service Type" required value={opt} options={step.options} onChange={setOpt} />}
        {service && <><TextInput label="Particulars" required={so.activity === 'Other'} value={part} onChange={setPart} hint="Job card particulars (job card itself sits in the service module)" /><NumberInput label="Hours (if charged by hours)" value={hours} onChange={setHours} /></>}
        <TextInput label="Quantity" disabled value={`${l.qty} ${l.unit}`} />
      </FormGrid>
    </AppDialog>
  );
}

/** Send by Email with a compose step (18 Sep): To, CC, Subject, Body, Attachments. The existing ERP sends directly with the template. */
export function EmailDialog({ open, onClose, docNo, customerId, onSent }: { open: boolean; onClose: () => void; docNo: string; customerId: string; onSent: (l: LogItem) => void }) {
  const toast = useToast();
  const c = cust(customerId);
  const [f, setF] = useState({ to: c?.email ?? '', cc: '', subject: `${docNo} from Gulf Power Rentals LLC`, body: `Dear ${c?.contact ?? 'Sir / Madam'},\n\nPlease find attached ${docNo}.\n\nRegards,\nGulf Power Rentals LLC`, files: [`${docNo}.pdf`] });
  return (
    <AppDialog open={open} title={`Send ${docNo} by Email`} onClose={onClose} maxWidth="md" confirmLabel="Send" confirmDisabled={!f.to.trim() || !f.subject.trim()}
      onConfirm={() => { onSent(log(`Email sent to ${f.to}`, `${f.subject}${f.cc ? `, cc ${f.cc}` : ''}; ${f.files.join(', ')}`, 'blue')); toast(`Email sent to ${f.to}`); onClose(); }}>
      <FormGrid cols={1}>
        <TextInput label="To" required value={f.to} onChange={(v) => setF({ ...f, to: v })} />
        <TextInput label="CC" value={f.cc} onChange={(v) => setF({ ...f, cc: v })} />
        <TextInput label="Subject" required value={f.subject} onChange={(v) => setF({ ...f, subject: v })} />
        <TextInput label="Body" multiline rows={5} value={f.body} onChange={(v) => setF({ ...f, body: v })} />
        <FileInput label="Attachments" multiple value={f.files} onChange={(v) => setF({ ...f, files: v })} hint="The document PDF is attached; add certificates or other files" />
      </FormGrid>
    </AppDialog>
  );
}

/** Every printout asks which document template to use (5 Oct call: "I may have 10 formats for the sales order"). Templates are a master with Create New. */
export function PrintDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: string }) {
  const toast = useToast();
  const [tpl, setTpl] = useState('');
  return (
    <AppDialog open={open} title={`Print ${doc}`} onClose={onClose} confirmLabel="Print" confirmDisabled={!tpl} onConfirm={() => { toast(`${doc} printed with the template "${tpl}"`, 'info'); onClose(); }}>
      <FormGrid cols={1}>
        <MasterSelect master="docTemplate" label="Document Template" required change="new" req={R.meet} value={tpl} onChange={setTpl} hint="Choose the format for this printout. Allocation Tag is never printed" />
      </FormGrid>
    </AppDialog>
  );
}

/** Lines of a Sales Order that can be invoiced now: not Rental (billed by the rental run), not AMC (billed from job cards), not invoiced yet. */
export const invoiceableLines = (lines: Line[]) => lines.filter((l) => !['Rental', 'AMC'].includes(l.activity) && !(l.activity === 'Service' && l.billing === 'Recurring') && !l.fulfilmentRef && (!l.fulfilment || l.fulfilment === 'Delivered'));

/** Create, Advance on the Sales Order: an advance Collection, Pending until approved in Accounting (decision D5); applied later from the invoice. */
export function AdvanceDialog({ open, onClose, soId, onDone }: { open: boolean; onClose: () => void; soId?: string; onDone?: (l: LogItem) => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const so = getOrder(soId);
  const [f, setF] = useState({ amount: '', method: 'Bank', bank: BANK_ACCOUNTS[0], ref: '', date: TODAY });
  if (!so) return null;
  return (
    <AppDialog open={open} title={`Advance against ${so.number}`} onClose={onClose} confirmLabel="Save" confirmDisabled={!(Number(f.amount) > 0)}
      onConfirm={() => { const p = advanceCollection({ soId: so.id, amount: Number(f.amount), method: f.method as 'Bank' | 'Cheque' | 'Cash', bankAccount: f.method === 'Cash' ? BANK_ACCOUNTS[2] : f.bank, reference: f.ref, date: f.date }); if (p) { onDone?.(log(`Advance ${p.number} recorded, AED ${p.amount}`, 'Pending approval in Accounting', 'blue')); toast(`Advance ${p.number} saved, pending approval in Accounting`); onClose(); nav(`/accounting/payment-entries/${p.id}`); } }}>
      <FormGrid cols={2}>
        <NumberInput label="Amount (AED)" required value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        <DateInput label="Date" required value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <SelectInput label="Type" required value={f.method} options={['Bank', 'Cheque', 'Cash']} onChange={(v) => setF({ ...f, method: v })} />
        {f.method !== 'Cash' && <SelectInput label="Bank Account" required value={f.bank} options={BANK_ACCOUNTS.slice(0, 2)} onChange={(v) => setF({ ...f, bank: v })} />}
        <TextInput label="Reference" value={f.ref} onChange={(v) => setF({ ...f, ref: v })} />
      </FormGrid>
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Saved as a Pending advance Collection. Once approved it can be applied to this customer's invoices (invoice, Create, Apply Payment).</Text>
    </AppDialog>
  );
}
