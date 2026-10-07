import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Checkbox } from '@mui/material';
import { Text } from '@/components/Text';
import { BANK_ACCOUNTS } from '@/modules/accounting/data';
import { advanceCollection } from '@/modules/accounting/engine';
import { suppliers } from '@/mock-data/masters';
import { AppDialog, useToast } from '@/components/Dialogs';
import { DateInput, FileInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { TODAY, cust, log, type Line, type LogItem } from './data';
import { NEXT_STEP, applyExtension, fulfilLine, getLine, getOrder, invoiceOrderLines, raiseCrossHire } from './flow';
import { MasterSelect, R, TO_CONFIRM, aed } from './shared';

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

export function CrossHireDialog({ open, onClose, soId, lineId, lineIds }: { open: boolean; onClose: () => void; soId?: string; lineId?: string; lineIds?: string[] }) {
  const nav = useNavigate();
  const toast = useToast();
  const [sup, setSup] = useState('');
  const [rate, setRate] = useState('');
  const so = getOrder(soId);
  const ids = lineIds?.length ? lineIds : lineId ? [lineId] : [];
  const lines = ids.map((i) => getLine(so, i)).filter(Boolean) as NonNullable<ReturnType<typeof getLine>>[];
  if (!so || !lines.length) return null;
  const list = suppliers.filter((s) => s.type === 'Cross-Hire Company');
  const bulk = lines.length > 1;
  return (
    <AppDialog open={open} title={bulk ? `Cross-Hire requests for ${lines.length} lines` : `Cross-Hire request: ${lines[0].group} ${lines[0].category}`} onClose={onClose} confirmLabel={bulk ? `Raise ${lines.length} Requests` : 'Raise Request'}
      onConfirm={() => { const s = list.find((x) => x.id === sup); lines.forEach((l) => raiseCrossHire(so.id, l.id, s?.id, s?.name, Number(rate) || 0)); toast(bulk ? `${lines.length} Cross-Hire requests raised. Submit them, then create an RFQ or an Order (Process Cross Hire handles several at once)` : 'Cross-Hire request raised. Submit it, then create an RFQ or an Order'); onClose(); nav('/rental/cross-hire'); }}>
      <Alert severity="warning" sx={{ mb: 2 }}>No owned unit is Ready for Hire for: {lines.map((l) => `${l.group} ${l.category} x ${l.qty}`).join(', ')}. {bulk ? 'One request is raised per line, all with the same preferred supplier and rate.' : 'This demand is sourced from a third-party supplier.'}</Alert>
      <FormGrid cols={1}>
        <SelectInput label="Preferred Supplier (optional)" value={sup} options={list.map((s) => ({ value: s.id, label: s.name }))} onChange={setSup} hint="Suppliers of type Cross-Hire Company" />
        <NumberInput label="Expected Rate (per month, AED, optional)" value={rate} onChange={setRate} hint="The RFQ award or the order fixes the agreed rate" />
      </FormGrid>
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
/** Create, Invoice on the Sales Order: one sales invoice for the selected lines, created Pending (decision D4). */
export function InvoiceLinesDialog({ open, onClose, soId }: { open: boolean; onClose: () => void; soId?: string }) {
  const toast = useToast();
  const nav = useNavigate();
  const so = getOrder(soId);
  const lines = so ? invoiceableLines(so.lines) : [];
  const [sel, setSel] = useState<string[]>([]);
  if (!so) return null;
  const chosen = sel.filter((x) => lines.some((l) => l.id === x));
  return (
    <AppDialog open={open} title={`Invoice from ${so.number}`} onClose={onClose} maxWidth="md" confirmLabel="Create Invoice" confirmDisabled={!chosen.length}
      onConfirm={() => { const n = invoiceOrderLines(so.id, chosen); toast(n ? `Invoice ${n} raised, pending approval in Accounting` : 'Nothing to invoice', n ? 'success' : 'error'); setSel([]); onClose(); }}>
      {!lines.length ? <Text type="s4">Every line that can be invoiced here already has an invoice. Rental lines are invoiced by the rental run (Rental, Invoicing Rental Order) and AMC visits from their job cards.</Text> : (
        <Box>
          {lines.map((l) => (
            <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid #EEE' }}>
              <Checkbox size="small" checked={chosen.includes(l.id)} onChange={(e) => setSel(e.target.checked ? [...chosen, l.id] : chosen.filter((x) => x !== l.id))} />
              <Box sx={{ flex: 1 }}><Text type="s4">{l.item}</Text><Text type="s5" color="theme.secondary.700">{l.activity}, {l.qty} {l.unit} at {aed(l.price)}{l.foc ? ' (FOC)' : ''}</Text></Box>
              <Text type="s4">{aed(l.foc ? 0 : l.qty * l.price * (1 - (l.discount ?? 0) / 100))}</Text>
            </Box>
          ))}
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>One invoice is created for the selected lines at the Sales Order price, Pending until it is approved in Accounting. <Box component="span" sx={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { onClose(); nav(`/accounting/invoices?so=${so.id}`); }}>See the invoices of this order</Box></Text>
        </Box>
      )}
    </AppDialog>
  );
}

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
