import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@mui/material';
import { suppliers } from '@/mock-data/masters';
import { AppDialog, useToast } from '@/components/Dialogs';
import { DateInput, FileInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { cust, log, type LogItem } from './data';
import { NEXT_STEP, applyExtension, fulfilLine, getLine, getOrder, raiseCrossHire } from './flow';
import { R, TO_CONFIRM } from './shared';

/** Expiry decision for the whole order (decision 2): Extend the SAME Sales Order, Early Termination, or Proceed to Return. */
export function ExpiryDialog({ open, onClose, soId }: { open: boolean; onClose: () => void; soId?: string; lineId?: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const [choice, setChoice] = useState('Extend the existing Sales Order');
  const [by, setBy] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const so = getOrder(soId);
  if (!so) return null;
  const cur = so.contractEnd ?? '';
  const ext = choice.startsWith('Extend');
  const ret = choice.startsWith('Proceed');
  const valid = by.trim() && (ret || ext || note.trim()) && (!ext || (end && end > cur));
  const go = () => {
    if (ret) { onClose(); nav(`/crm/customer-returns/add?so=${so.id}`); return; }
    applyExtension({ soId: so.id, kind: ext ? 'Extension' : 'Early Termination', newEnd: ext ? end : cur, note, confirmedBy: by });
    toast(ext ? `Sales Order ${so.number} revised, new end date ${end}` : 'Early Termination recorded, Finance decides the adjustment');
    onClose();
  };
  return (
    <AppDialog open={open} title={`Client confirmation: ${so.number}`} onClose={onClose} confirmLabel={ret ? 'Proceed to Return' : 'Save'} confirmDisabled={!valid} onConfirm={go}>
      <FormGrid cols={1}>
        <SelectInput label="Client decision" required change="new" req={R.exp} value={choice} options={['Extend the existing Sales Order', 'Early Termination', 'Proceed to Return']} onChange={setChoice} />
        <TextInput label="Confirmed by (client contact)" required value={by} onChange={setBy} />
        {ext && <DateInput label="New Contract End Date" required value={end} onChange={setEnd} error={end && end <= cur ? `Must be after the current end date ${cur}` : undefined} hint={`Current end date ${cur}; the LPO expiry moves with it when earlier`} />}
        {!ret && <TextInput label={ext ? 'Note' : 'Reason'} required={!ext} multiline rows={2} value={note} onChange={setNote} />}
      </FormGrid>
      {ext && <Alert severity="info" sx={{ mt: 2 }}>The existing Sales Order is revised. No new order is created and every change is audited.</Alert>}
      {choice === 'Early Termination' && <Alert severity="warning" sx={{ mt: 2 }}>Early termination follows the normal return process. Finance manually decides the adjustment: full committed amount or pro-rated by days used. {TO_CONFIRM}.</Alert>}
    </AppDialog>
  );
}

export function CrossHireDialog({ open, onClose, soId, lineId }: { open: boolean; onClose: () => void; soId?: string; lineId?: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const [sup, setSup] = useState('');
  const [rate, setRate] = useState('');
  const so = getOrder(soId);
  const l = getLine(so, lineId);
  if (!so || !l) return null;
  const list = suppliers.filter((s) => s.type === 'Cross-Hire Company');
  return (
    <AppDialog open={open} title={`Cross-Hire request: ${l.group} ${l.category}`} onClose={onClose} confirmLabel="Raise Request" confirmDisabled={!sup || !Number(rate)}
      onConfirm={() => { const s = list.find((x) => x.id === sup)!; raiseCrossHire(so.id, l.id, s.id, s.name, Number(rate)); toast('Cross-Hire request raised (stage 1 of 5: Request)'); onClose(); nav('/rental/cross-hire'); }}>
      <Alert severity="warning" sx={{ mb: 2 }}>No owned {l.group} {l.category} unit is Ready for Hire, so this demand is sourced from a third-party supplier.</Alert>
      <FormGrid cols={1}>
        <SelectInput label="Cross-Hire Supplier" required value={sup} options={list.map((s) => ({ value: s.id, label: s.name }))} onChange={setSup} hint="Suppliers of type Cross-Hire Company" />
        <NumberInput label="Agreed Rate (per month, AED)" required value={rate} onChange={setRate} hint="Negotiated per transaction" />
      </FormGrid>
    </AppDialog>
  );
}

/** Per-line next step for the non-rental branches: Stock/Invoice, Charge/Invoice (particulars, hours or amount). */
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
    <AppDialog open={open} title={`${step.label}: ${l.item}`} onClose={onClose} confirmLabel="Confirm" confirmDisabled={(!!step.options && !opt) || (service && so.activity === 'Service' && !part.trim())}
      onConfirm={() => { const ref = fulfilLine(so.id, l.id, [opt, part, hours && `${hours} h`].filter(Boolean).join(', ') || undefined); toast(`${step.done}, reference ${ref}`); onClose(); }}>
      <FormGrid cols={1}>
        {step.options && <SelectInput label="Service Type" required value={opt} options={step.options} onChange={setOpt} />}
        {service && <><TextInput label="Particulars" required={so.activity === 'Service'} value={part} onChange={setPart} hint="Job card particulars (job card itself sits in the service module)" /><NumberInput label="Hours (if charged by hours)" value={hours} onChange={setHours} /></>}
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
