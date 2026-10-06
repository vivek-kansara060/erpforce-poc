import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { AppDialog, useToast } from '@/components/Dialogs';
import { CheckInput, DateInput, FormGrid, NumberInput, SelectInput, TextInput } from '@/components/Form';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { systemUsers } from '@/mock-data/masters';
import { useCollection } from '@/store/store';
import { TODAY } from '@/modules/crm/data';
import { aed } from '@/modules/crm/shared';
import {
  BANK_ACCOUNTS, COLA, accLabel, lineAmount, lineGross, lineVat, round2, totalsOf,
  type Bill, type ExpenseLine, type InvLine, type Journal, type NoteDoc, type PaymentEntry, type RentalRun, type SalesInvoice, type SourceRef,
} from './data';
import { seedAccounting } from './seed';
import { billDue, createPayment, invoiceDue, journalByRef, paymentErrors, pendingCollectionFor } from './engine';

/* ------------------------------------------------------------------ hooks (seed once, then live) */
const use = <T extends { id: string }>(name: string) => { seedAccounting(); return useCollection<T>(name); };
export const useInvoices = () => use<SalesInvoice>(COLA.invoices);
export const useBills = () => use<Bill>(COLA.bills);
export const usePayments = () => use<PaymentEntry>(COLA.payments);
export const useCreditNotes = () => use<NoteDoc>(COLA.creditNotes);
export const useDebitNotes = () => use<NoteDoc>(COLA.debitNotes);
export const useJournals = () => use<Journal>(COLA.journals);
export const useRentalRuns = () => use<RentalRun>(COLA.rentalRuns);

/** Requirement references used on NEW / CHANGED badges and the Change Register. */
export const R_ACC = {
  inv: 'Finance > Sales Invoicing & Receivables (Req L1340-1361); Instruction 6 Oct (accounting POC)',
  bill: 'Procurement > Vendor Bill (Req L842-864); Finance > Payables (Req L1371-1385)',
  pay: 'Finance > Payments & Collections (Req L1350-1359, L1371-1385)',
  gl: 'Finance > General Ledger, Cost Centre on journals (Req L1318-1334)',
  rental: 'Rental > Rental Invoicing & Billing Cycle (Req L264, L271, L628-634; calls 17, 18, 22, 30 Sep)',
  amc: 'CRM > AMC billing (Req L1479-1497; calls 22 Sep, 30 Sep, 5 Oct)',
  cross: 'Rental > Cross-Hire supplier invoice (Req L886-925)',
  disposal: 'Fixed Asset disposal sale invoice (call 2 Oct)',
  meet: 'Instruction 6 Oct (accounting POC)',
};
export const money = (n?: number) => aed(n === undefined ? undefined : round2(n));

/* ------------------------------------------------------------------ status chips */
export const approvalTone = (s: string) => (s === 'Approved' ? 'green' : s === 'Rejected' ? 'red' : s === 'Draft' ? 'grey' : 'amber');
export const payTone = (s: string) => (s === 'Paid' ? 'green' : s === 'Partially Paid' ? 'blue' : 'amber');
export function DocChips({ approval, payStatus }: { approval: string; payStatus?: string }) {
  return <Box sx={{ display: 'flex', gap: 1 }}><StatusChip status={approval} tone={approvalTone(approval) as any} />{payStatus && approval === 'Approved' && <StatusChip status={payStatus} tone={payTone(payStatus) as any} />}</Box>;
}

/* ------------------------------------------------------------------ source document link */
export function sourcePath(s: SourceRef): string | undefined {
  switch (s.type) {
    case 'Sales Order': case 'Rental Cycle': case 'Damage Charge': return s.soId ? `/crm/sales-orders/${s.soId}` : undefined;
    case 'Job Card': return `/crm/job-cards/${s.id}`;
    case 'Asset Disposal': return `/inventory/disposals/${s.id}`;
    case 'Cross Hire': return `/rental/cross-hire-orders/${s.id}`;
    case 'Trip': return `/crm/trips/${s.id}`;
    default: return undefined;
  }
}
export const sourceText = (s: SourceRef) => (s.type === 'Manual' ? 'Manual entry' : `${s.type} ${s.number}`);
export function SourceLink({ s }: { s: SourceRef }) {
  const nav = useNavigate();
  const to = sourcePath(s);
  return to ? <Box component="span" onClick={(e) => { e.stopPropagation(); nav(to); }} sx={{ cursor: 'pointer', textDecoration: 'underline' }}>{sourceText(s)}</Box> : <>{sourceText(s)}</>;
}

/* ------------------------------------------------------------------ lines and totals */
export function LinesTable({ lines, showPeriod }: { lines: InvLine[]; showPeriod?: boolean }) {
  return (
    <DataTable hideToolbar pageSize={50} rows={lines} emptyText="No lines" columns={[
      { key: 'item', label: 'Item' }, { key: 'desc', label: 'Description' },
      ...(showPeriod ? [{ key: 'period', label: 'Period', change: 'new' as const, req: R_ACC.rental, render: (l: InvLine) => (l.periodFrom ? `${l.periodFrom} to ${l.periodTo}` : '-') }] : []),
      { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'unit', label: 'UOM' }, { key: 'rate', label: 'Rate', align: 'right', render: (l) => money(l.rate) },
      { key: 'discountPct', label: 'Discount %', align: 'right', render: (l) => (l.discountPct ? `${l.discountPct}%` : '-') },
      { key: 'vat', label: 'Tax', align: 'right', render: (l) => `${l.vatPct}% ${money(lineVat(l))}` },
      { key: 'account', label: 'Account', render: (l) => accLabel(l.account) },
      { key: 'costCentre', label: 'Cost Centre / Project', change: 'new', req: R_ACC.gl, render: (l) => l.costCentre ?? '-' },
      { key: 'amount', label: 'Amount', align: 'right', render: (l) => money(lineGross(l)) },
    ]} />
  );
}
export function ExpensesTable({ rows }: { rows: ExpenseLine[] }) {
  return <DataTable hideToolbar rows={rows} emptyText="No expense entries" columns={[{ key: 'account', label: 'Account', render: (e) => accLabel(e.account) }, { key: 'desc', label: 'Narration' }, { key: 'vat', label: 'Tax', render: (e) => `${e.vatPct}%` }, { key: 'amount', label: 'Total Amount', align: 'right', render: (e) => money(e.amount) }]} />;
}
/** Existing InvoiceSummary panel: quantity, gross, discounts, taxes, round off, total, then paid and due. */
export function TotalsBox({ doc, paid, extra }: { doc: { lines: InvLine[]; expenses?: ExpenseLine[]; discountOn?: string; discountPct?: number; roundOff?: boolean; currency?: string }; paid?: number; extra?: ReactNode }) {
  const t = totalsOf(doc);
  const cur = doc.currency ?? 'AED';
  const rows: [string, string][] = [
    ['Total Quantity', String(round2(t.qty))], ['Gross Amount', money(t.amount)], ['Item Discount', money(-t.itemDisc)], ...(t.addDisc ? [['Additional Discount', money(-t.addDisc)] as [string, string]] : []),
    ['Subtotal Excluding Taxes', money(t.taxable)], ['Taxes and Charges Added (VAT)', money(t.vat)], ...(t.roundDiff ? [['Round Off', money(t.roundDiff)] as [string, string]] : []),
  ];
  return (
    <Box sx={{ ml: 'auto', width: 380, mt: 2 }}>
      {rows.map(([k, v]) => <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s4">{k}</Text><Text type="s4">{v.replace('AED', cur)}</Text></Box>)}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid #D3D3D4' }}><Text type="s3" weight="medium">Grand Total</Text><Text type="s3" weight="medium">{money(t.total).replace('AED', cur)}</Text></Box>
      {paid !== undefined && <>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s4">Amount Paid and Settled</Text><Text type="s4">{money(paid)}</Text></Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}><Text type="s3" weight="medium">Amount Due</Text><Text type="s3" weight="medium">{money(t.total - paid)}</Text></Box>
      </>}
      {extra}
    </Box>
  );
}

/* ------------------------------------------------------------------ accounting ledger (journal lines) */
export function LedgerTable({ journalId }: { journalId?: string }) {
  const j = journalByRef(journalId);
  if (!j) return <Text type="s4">No journal yet. It is posted when the document is approved.</Text>;
  const dr = j.lines.reduce((s, l) => s + l.debit, 0);
  const cr = j.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <Box>
      <Text type="s4" sx={{ mb: 1 }}>Journal {j.number}, {j.journalType}, posted {j.postingDate}</Text>
      <DataTable hideToolbar pageSize={50} rows={j.lines.map((l, i) => ({ id: String(i), ...l }))} columns={[
        { key: 'account', label: 'Account', render: (l) => accLabel(l.account) }, { key: 'party', label: 'Party', render: (l) => l.party ?? '-' }, { key: 'costCentre', label: 'Cost Centre', change: 'new', req: R_ACC.gl, render: (l) => l.costCentre ?? '-' },
        { key: 'memo', label: 'Memo', render: (l) => l.memo ?? '-' }, { key: 'debit', label: 'Debit', align: 'right', render: (l) => (l.debit ? money(l.debit) : '-') }, { key: 'credit', label: 'Credit', align: 'right', render: (l) => (l.credit ? money(l.credit) : '-') },
      ]} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 1 }}><Text type="s4" weight="medium">Total Debit {money(dr)}</Text><Text type="s4" weight="medium">Total Credit {money(cr)}</Text></Box>
    </Box>
  );
}
export function LedgerDialog({ open, onClose, journalId }: { open: boolean; onClose: () => void; journalId?: string }) {
  return <AppDialog open={open} title="View Accounting Ledger" onClose={onClose} maxWidth="lg"><LedgerTable journalId={journalId} /></AppDialog>;
}

/* ------------------------------------------------------------------ approval widget (existing ERP: Submit for Approval, Quick Approval, Accept / Reject) */
export function ApprovalButtons({ approval, onSubmit, onApprove, onReject, simple }: { approval: string; onSubmit?: (approver: string) => void; onApprove: (how: string) => void; onReject: (note: string) => void; simple?: boolean }) {
  const [dlg, setDlg] = useState<'submit' | 'reject' | null>(null);
  const [v, setV] = useState('');
  if (approval === 'Approved') return null;
  return (
    <>
      {!simple && onSubmit && ['Draft', 'Pending', 'Rejected'].includes(approval) && <Button variant="outlined" onClick={() => { setV(''); setDlg('submit'); }}>Submit for Approval</Button>}
      {simple && approval === 'Pending' && <Button variant="outlined" color="error" onClick={() => { setV(''); setDlg('reject'); }}>Reject</Button>}
      {['Draft', 'Pending', 'Rejected'].includes(approval) && <Button variant="contained" onClick={() => onApprove(simple ? 'Approved' : 'Approved (Quick Approval)')}>{simple ? 'Approve' : 'Quick Approval'}</Button>}
      {approval === 'Submitted' && <><Button variant="outlined" color="error" onClick={() => { setV(''); setDlg('reject'); }}>Reject</Button><Button variant="contained" onClick={() => onApprove('Accepted by the approver')}>Accept</Button></>}
      <AppDialog open={dlg === 'submit'} title="Submit for Approval" onClose={() => setDlg(null)} confirmLabel="Submit" confirmDisabled={!v} onConfirm={() => { onSubmit?.(v); setDlg(null); }}>
        <SelectInput label="Approver" required value={v} options={systemUsers.map((u) => u.name)} onChange={setV} />
      </AppDialog>
      <AppDialog open={dlg === 'reject'} title="Reject" onClose={() => setDlg(null)} confirmLabel="Reject" confirmDisabled={!v.trim()} onConfirm={() => { onReject(v); setDlg(null); }}>
        <TextInput label="Reason" required multiline rows={2} value={v} onChange={setV} />
      </AppDialog>
    </>
  );
}

/* ------------------------------------------------------------------ Collection Entry / Payment Entry from a document (created Pending, decision D5) */
export function PaymentDialog({ open, onClose, doc, kind }: { open: boolean; onClose: () => void; doc?: SalesInvoice | Bill; kind: 'invoice' | 'bill' }) {
  const toast = useToast();
  const nav = useNavigate();
  const due = doc ? (kind === 'invoice' ? invoiceDue(doc as SalesInvoice) : billDue(doc as Bill)) : 0;
  const [f, setF] = useState({ amount: '', method: 'Bank', bank: BANK_ACCOUNTS[0], ref: '', date: TODAY, chequeNo: '', chequeDate: '' });
  if (!doc) return null;
  const amount = Number(f.amount || due);
  const party = kind === 'invoice' ? (doc as SalesInvoice).partyName : (doc as Bill).supplierName;
  const partyId = kind === 'invoice' ? (doc as SalesInvoice).customerId : (doc as Bill).supplierId;
  const blocked = kind === 'invoice' && pendingCollectionFor(doc.id);
  const input = { direction: (kind === 'invoice' ? 'Receive' : 'Send') as PaymentEntry['direction'], partyType: (kind === 'invoice' ? 'Customer' : 'Supplier') as PaymentEntry['partyType'], partyId, partyName: party,
    method: f.method as PaymentEntry['method'], bankAccount: f.method === 'Cash' ? BANK_ACCOUNTS[2] : f.bank, reference: f.ref, chequeNo: f.chequeNo || undefined, chequeDate: f.chequeDate || undefined, amount, isAdvance: false, date: f.date,
    soId: (doc as SalesInvoice).soId, soNumber: (doc as SalesInvoice).soNumber, allocations: [{ docType: kind, docId: doc.id, docNumber: doc.number, amount }] };
  const err = paymentErrors(input);
  return (
    <AppDialog open={open} title={kind === 'invoice' ? `Collection Entry for ${doc.number}` : `Payment Entry for ${doc.number}`} onClose={onClose} confirmLabel="Save" confirmDisabled={!!err || !!blocked}
      onConfirm={() => { const p = createPayment(input); toast(`${p.number} created, pending approval. The ${kind} changes when it is approved`); onClose(); nav(`/accounting/payment-entries/${p.id}`); }}>
      <FormGrid cols={2}>
        <TextInput label={kind === 'invoice' ? 'Customer' : 'Supplier'} disabled value={party} />
        <TextInput label="Amount Due" disabled value={money(due)} />
        <NumberInput label="Amount" required value={f.amount || String(due)} onChange={(v) => setF({ ...f, amount: v })} error={err} />
        <DateInput label="Date" required value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <SelectInput label="Type" required value={f.method} options={['Bank', 'Cheque', 'Cash']} onChange={(v) => setF({ ...f, method: v })} />
        {f.method !== 'Cash' && <SelectInput label="Bank Account" required value={f.bank} options={BANK_ACCOUNTS.slice(0, 2)} onChange={(v) => setF({ ...f, bank: v })} />}
        {f.method === 'Cheque' && <><TextInput label="Cheque Number" value={f.chequeNo} onChange={(v) => setF({ ...f, chequeNo: v })} /><DateInput label="Cheque Date" value={f.chequeDate} onChange={(v) => setF({ ...f, chequeDate: v })} /></>}
        <TextInput label="Reference" value={f.ref} onChange={(v) => setF({ ...f, ref: v })} />
      </FormGrid>
      <Text type="s5" color={blocked ? '#C64D4D' : 'theme.secondary.700'} sx={{ mt: 1.5 }}>{blocked ? `${blocked.number} is already pending approval for this invoice. Approve or reject it first.` : 'Saved as Pending. Approve it on its page (Accounting, Payment Entry) to post the journal and update the payment status.'}</Text>
    </AppDialog>
  );
}
export { CheckInput, lineAmount };
