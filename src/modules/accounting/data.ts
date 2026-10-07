import dayjs from 'dayjs';
import { nextNumber } from '@/store/store';
import type { LogItem } from '@/modules/crm/data';

/* ------------------------------------------------------------------ statuses (existing ERP: approval status and payment status are separate) */
export type ApprovalStatus = 'Draft' | 'Pending' | 'Submitted' | 'Approved' | 'Rejected';
export type PayStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export const APPROVAL_STATUSES: ApprovalStatus[] = ['Draft', 'Pending', 'Submitted', 'Approved', 'Rejected'];
export const PAY_STATUSES: PayStatus[] = ['Unpaid', 'Partially Paid', 'Paid'];
export const EDITABLE: ApprovalStatus[] = ['Draft', 'Pending', 'Rejected'];

export type SourceType = 'Sales Order' | 'Rental Cycle' | 'Job Card' | 'Damage Charge' | 'Asset Disposal' | 'Manual' | 'Cross Hire' | 'Trip';
export interface SourceRef { type: SourceType; id: string; number: string; soId?: string; lineIds?: string[] }

export type LineTag = 'rental' | 'recurring-service' | 'one-time-service' | 'waiting-charge' | 'damage' | 'visit' | 'material' | 'service' | 'goods' | 'asset-sale' | 'cross-hire' | 'transport' | 'manual';
export interface InvLine {
  id: string; item: string; desc: string; account: string;
  qty: number; unit: string; rate: number; discountPct: number; vatPct: number;
  activity?: string; costCentre?: string;
  periodFrom?: string; periodTo?: string; days?: number; periodDays?: number; assetId?: string; deliveryId?: string; soLineId?: string;
  tag?: LineTag;
}
export interface ExpenseLine { id: string; account: string; desc: string; amount: number; vatPct: number; costCentre?: string }

interface DocBase {
  id: string; number: string; date: string; postingTime: string; dueDate: string; paymentTerms: string;
  entity: string; currency: string; exchangeRate: number; location?: string; department?: string; narration?: string;
  discountOn: 'None' | 'Net Amount' | 'Gross Amount'; discountPct: number; roundOff: boolean;
  approval: ApprovalStatus; approver?: string; payStatus: PayStatus; amountPaid: number;
  activity?: string; costCentre?: string; source: SourceRef; journalId?: string;
  attachments: string[]; log: LogItem[];
}
export interface SalesInvoice extends DocBase {
  customerId?: string; partyName: string;
  transactionType: 'Cash' | 'Credit'; salesperson?: string; lpo?: string; soId?: string; soNumber?: string;
  contactPerson?: string; billingAddress?: string; shippingAddress?: string; placeOfSupply?: string; vatType: string;
  lines: InvLine[]; isRental?: boolean; periodFrom?: string; periodTo?: string; creditNoteIds: string[];
}
export interface Bill extends DocBase {
  supplierId?: string; supplierName: string; supplierInvoiceNo: string; supplierInvoiceDate: string;
  orderRef?: string; lines: InvLine[]; expenses: ExpenseLine[]; debitNoteIds: string[];
}
export interface Allocation { docType: 'invoice' | 'bill'; docId: string; docNumber: string; amount: number }
export interface PaymentEntry {
  id: string; number: string; direction: 'Receive' | 'Send'; date: string; partyType: 'Customer' | 'Supplier'; partyId?: string; partyName: string;
  method: 'Cash' | 'Bank' | 'Cheque'; bankAccount: string; chequeNo?: string; chequeDate?: string; reference?: string;
  amount: number; isAdvance: boolean; advanceUsed: number; soId?: string; soNumber?: string; allocations: Allocation[];
  approval: ApprovalStatus; journalId?: string; narration?: string; log: LogItem[];
}
export interface NoteDoc {
  id: string; number: string; kind: 'Credit' | 'Debit'; date: string; partyId?: string; partyName: string; reason: string;
  againstId: string; againstNumber: string; lines: InvLine[]; approval: ApprovalStatus; journalId?: string; costCentre?: string; log: LogItem[];
}
export interface JournalLine { account: string; party?: string; debit: number; credit: number; costCentre?: string; memo?: string }
export type JournalType = 'Sales' | 'Purchases' | 'Cash Receipt Voucher' | 'Payment' | 'Credit Note' | 'Debit Note' | 'Trip Expense';
export interface Journal {
  id: string; number: string; postingDate: string; journalType: JournalType;
  refType: string; refId: string; refNumber: string; status: 'Posted'; currency: string; narration: string; createdBy: string; lines: JournalLine[];
}
export interface RentalRun { id: string; number: string; runAt: string; soIds: string[]; soNumbers: string[]; invoiceIds: string[]; status: 'Processed' | 'Nothing to bill'; message: string; by: string }

/* ------------------------------------------------------------------ collections and number series */
export const COLA = {
  invoices: 'accounting.invoices', bills: 'accounting.bills', payments: 'accounting.payments', creditNotes: 'accounting.creditNotes',
  debitNotes: 'accounting.debitNotes', journals: 'accounting.journals', rentalRuns: 'accounting.rentalRuns',
} as const;
/**
 * One call site per series. The seed raises these to its highest number before the first runtime document, so new numbers always follow the seeded ones.
 * INV starts after 415, the highest invoice number already referenced by the CRM and Inventory seeds.
 */
export const SEED_MAX: Record<string, number> = { INV: 415, BILL: 23, PAY: 30, CRN: 8, DBN: 3, JV: 199, RUN: 12 };
export const nextInvoiceNo = () => nextNumber('INV', SEED_MAX.INV);
export const nextBillNo = () => nextNumber('BILL', SEED_MAX.BILL);
export const nextPaymentNo = () => nextNumber('PAY', SEED_MAX.PAY);
export const nextCreditNo = () => nextNumber('CRN', SEED_MAX.CRN);
export const nextDebitNo = () => nextNumber('DBN', SEED_MAX.DBN);
export const nextJournalNo = () => nextNumber('JV', SEED_MAX.JV);
export const nextRunNo = () => nextNumber('RUN', SEED_MAX.RUN);
export const seriesNo = (prefix: string, n: number) => `${prefix}-26-${String(n).padStart(5, '0')}`;
export const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ------------------------------------------------------------------ masters */
export const BANK_ACCOUNTS = ['Emirates NBD Current 1015-447821-01', 'ADCB Current 6031-228410-001', 'Cash in Hand (Jebel Ali Office)'];
export const PAYMENT_METHODS = ['Bank', 'Cheque', 'Cash'] as const;
export const NOTE_REASONS = ['Early termination', 'Rate correction', 'Returned goods', 'Billing error', 'Other'];
export const DEBIT_REASONS = ['Early off-hire by supplier', 'Unit breakdown downtime', 'Rate correction', 'Rejected on receipt (QC)', 'Other'];
export const termDays = (terms?: string) => (!terms || terms === 'Immediate' ? 0 : Number.parseInt(terms, 10) || 30);
export const dueDateFor = (date: string, terms?: string) => dayjs(date).add(termDays(terms), 'day').format('YYYY-MM-DD');

/* ------------------------------------------------------------------ Chart of Accounts (codes follow ACCOUNTS in inventory/data.ts) */
export interface Account { code: string; name: string; type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' }
export const COA: Account[] = [
  { code: '110100', name: 'Cash in Hand', type: 'Asset' },
  { code: '110200', name: 'Bank: Emirates NBD Current', type: 'Asset' },
  { code: '110300', name: 'Bank: ADCB Current', type: 'Asset' },
  { code: '120100', name: 'Fixed Assets: Plant & Machinery', type: 'Asset' },
  { code: '130100', name: 'Accounts Receivable', type: 'Asset' },
  { code: '130200', name: 'Input VAT Recoverable', type: 'Asset' },
  { code: '140100', name: 'Inventory: Spare Parts and Consumables', type: 'Asset' },
  { code: '210100', name: 'Accounts Payable', type: 'Liability' },
  { code: '210300', name: 'Output VAT Payable', type: 'Liability' },
  { code: '210400', name: 'Customer Advances', type: 'Liability' },
  { code: '210500', name: 'Accrued Trip Expenses', type: 'Liability' },
  { code: '410100', name: 'Rental Income', type: 'Income' },
  { code: '410200', name: 'Trading Sales', type: 'Income' },
  { code: '410300', name: 'Fuel Sales', type: 'Income' },
  { code: '410400', name: 'AMC Income', type: 'Income' },
  { code: '410500', name: 'Service and Other Charges Income', type: 'Income' },
  { code: '410600', name: 'Damage Recovery Income', type: 'Income' },
  { code: '410700', name: 'Asset Sale Proceeds', type: 'Income' },
  { code: '410900', name: 'Sales Discount', type: 'Income' },
  { code: '510100', name: 'Cross-Hire Charges', type: 'Expense' },
  { code: '510300', name: 'Transportation Expense', type: 'Expense' },
  { code: '510310', name: 'Loading and Unloading', type: 'Expense' },
  { code: '510320', name: 'Fuel Expense', type: 'Expense' },
  { code: '510400', name: 'Cost of Materials Consumed', type: 'Expense' },
  { code: '510500', name: 'Other Direct Expense', type: 'Expense' },
  { code: '520100', name: 'Insurance Expense', type: 'Expense' },
  { code: '590100', name: 'Round Off', type: 'Expense' },
];
export const ACC = { cash: '110100', bank1: '110200', bank2: '110300', ar: '130100', inputVat: '130200', ap: '210100', outputVat: '210300', advances: '210400', tripAccrual: '210500', discount: '410900', roundOff: '590100' } as const;
export const accName = (code?: string) => COA.find((a) => a.code === code)?.name ?? code ?? '-';
export const accLabel = (code?: string) => (code ? `${code} ${accName(code)}` : '-');
export const incomeAccounts = COA.filter((a) => a.type === 'Income' && a.code !== ACC.discount);
export const expenseAccounts = COA.filter((a) => a.type === 'Expense' && a.code !== ACC.roundOff);
export function incomeAccountFor(kind?: string): string {
  switch (kind) {
    case 'Rental': return '410100';
    case 'Trading': return '410200';
    case 'Fuel Trading': return '410300';
    case 'AMC': return '410400';
    case 'Fixed Asset Trading': return '410700';
    default: return '410500';
  }
}
/** The expense accounts named on the Cross Hire order Expense Entry. */
export function expenseAccountFor(name?: string): string {
  const m: Record<string, string> = { 'Transportation Expense': '510300', 'Loading and Unloading': '510310', 'Fuel Expense': '510320', 'Insurance Expense': '520100', 'Other Direct Expense': '510500' };
  return m[name ?? ''] ?? '510500';
}
/** Ledger account of a trip expense type (the Trip Expense Types master): fuel to Fuel Expense, driver allowance and the rest to Other Direct, tolls, parking and transport to Transportation. */
export function tripExpenseAccount(type?: string): string {
  if (type === 'Fuel') return '510320';
  if (type === 'Driver Allowance' || type === 'Other') return '510500';
  return '510300';
}
export const bankAccountCode = (bank?: string) => (bank?.startsWith('Cash') ? ACC.cash : bank?.startsWith('ADCB') ? ACC.bank2 : ACC.bank1);

/* ------------------------------------------------------------------ calculators (existing ERP order: line discount, VAT, additional discount, round off) */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const vatPctOf = (vatType?: string) => (vatType?.startsWith('Export') ? 0 : 5);
export const lineAmount = (l: Pick<InvLine, 'qty' | 'rate'>) => l.qty * l.rate;
export const lineDisc = (l: InvLine) => (lineAmount(l) * (l.discountPct || 0)) / 100;
export const lineGross = (l: InvLine) => round2(lineAmount(l) - lineDisc(l));
export const lineVat = (l: InvLine) => round2((lineGross(l) * (l.vatPct || 0)) / 100);
export const lineTotal = (l: InvLine) => round2(lineGross(l) + lineVat(l));
export interface Totals { qty: number; amount: number; itemDisc: number; sub: number; addDisc: number; taxable: number; vat: number; roundDiff: number; total: number }
export function totalsOf(doc: { lines: InvLine[]; expenses?: ExpenseLine[]; discountOn?: string; discountPct?: number; roundOff?: boolean }): Totals {
  const amount = doc.lines.reduce((s, l) => s + lineAmount(l), 0) + (doc.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const itemDisc = doc.lines.reduce((s, l) => s + lineDisc(l), 0);
  const sub = round2(amount - itemDisc);
  const addDisc = !doc.discountOn || doc.discountOn === 'None' ? 0 : round2((sub * (doc.discountPct || 0)) / 100);
  const taxable = round2(sub - addDisc);
  const rawVat = doc.lines.reduce((s, l) => s + lineVat(l), 0) + (doc.expenses ?? []).reduce((s, e) => s + round2((e.amount * (e.vatPct || 0)) / 100), 0);
  const vat = round2(sub ? (rawVat * taxable) / sub : 0);
  const exact = round2(taxable + vat);
  const total = doc.roundOff ? Math.round(exact) : exact;
  return { qty: doc.lines.reduce((s, l) => s + l.qty, 0), amount: round2(amount), itemDisc: round2(itemDisc), sub, addDisc, taxable, vat, roundDiff: round2(total - exact), total };
}
export const noteTotal = (n: NoteDoc) => totalsOf({ lines: n.lines }).total;
export const payStatusOf = (due: number, total: number): PayStatus => (due < 1 ? 'Paid' : due < total - 0.005 ? 'Partially Paid' : 'Unpaid');
export const fmtMoney = (n: number, cur = 'AED') => `${cur} ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const daysBetween = (a: string, b: string) => dayjs(b).diff(dayjs(a), 'day');
export const addDays = (d: string, n: number) => dayjs(d).add(n, 'day').format('YYYY-MM-DD');
export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);
