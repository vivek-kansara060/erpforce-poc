/**
 * Accounting seed, built from the RAW CRM / Inventory seed constants as of the demo base day (30 Sep 2026). seedCollection then shifts every date by the
 * demo offset, exactly like the CRM seeds, so the history lines up with the shifted orders. Never build this from getCollection (that would shift twice).
 *
 * The builders below are generic: they loop over whatever exists in orderSeed, deliverySeed, jobCardSeed, crossHireSeed, tripSeed and disposalSeed, so the seed keeps
 * working when those arrays grow. Numbers are collision-proof: documents are created with placeholder numbers, and at the end invoices (from 300 upward, skipping every
 * number the CRM / Inventory seeds already reference), bills, collections, notes and journals are numbered in posting-date order and the placeholders are replaced.
 */
import dayjs from 'dayjs';
import { cust, crossHireSeed, deliverySeed, jobCardSeed, orderSeed, tripSeed, type LogItem, type SalesOrder } from '@/modules/crm/data';
import { disposalSeed, heavySeed } from '@/modules/inventory/data';
import { costCentres, customers, suppliers } from '@/mock-data/masters';
import { seedCollection } from '@/store/store';
import { advanceJournal, buildRentalLines, headerFromOrder, lid, linesFromJobCard, linesFromOrder, nextPeriodFor, noteJournal, paymentJournal, purchaseJournal, salesJournal } from './billing';
import {
  BANK_ACCOUNTS, COLA, SEED_MAX, addDays, daysBetween, dueDateFor, expenseAccountFor, incomeAccountFor, lineTotal, maxDate, minDate, payStatusOf, round2, seedRunner, seriesNo, termDays, totalsOf, vatPctOf,
  type Bill, type InvLine, type Journal, type JournalLine, type JournalType, type LineTag, type NoteDoc, type PaymentEntry, type RentalRun, type SalesInvoice,
} from './data';

const ASOF = '2026-09-30';
const FIN = 'Priya Menon';
const APPROVER = 'Ahmed Al Khouri';
const ENT = 'Gulf Power Rentals LLC';
const BANK1 = BANK_ACCOUNTS[0];
const BANK2 = BANK_ACCOUNTS[1];
const CASHACC = BANK_ACCOUNTS[2];
const lg = (when: string, title: string, detail?: string, tone?: LogItem['tone'], by = FIN): LogItem => ({ when, title, detail, by, tone });
const assetLabelRaw = (id: string) => { const h = heavySeed.find((x) => x.id === id); return h ? `${h.assetId} - ${h.name}` : id; };
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const numIn = (s?: string) => { const m = /(\d{3,6})\s*$/.exec(s ?? ''); return m ? Number(m[1]) : undefined; };
const normTerms = (t?: string) => { const m = /^Net\s+(\d+)$/i.exec(t ?? ''); return m ? `${m[1]} days` : t; };
const ccName = (id?: string) => (id ? costCentres.find((x) => x.id === id)?.name : undefined);

interface Built { invoices: SalesInvoice[]; bills: Bill[]; payments: PaymentEntry[]; creditNotes: NoteDoc[]; debitNotes: NoteDoc[]; journals: Journal[]; rentalRuns: RentalRun[]; failures: { id: string; soId: string; from: string; to: string; error: string; jobId?: string }[] }

/* ------------------------------------------------------------------ catalogues used by the manual documents */
/** [item, description, unit, rate, activity, tag, account override] */
type CatRow = [string, string, string, number, string, LineTag, string?];
const CAT: Record<string, CatRow> = {
  oilf: ['Oil Filter (Cummins C-Series)', 'Genuine oil filter element', 'Nos', 85, 'Trading', 'goods'],
  fuelf: ['Fuel Filter (Perkins 1106)', 'Genuine fuel filter element', 'Nos', 62, 'Trading', 'goods'],
  airf: ['Air Filter (Perkins 2506)', 'Genuine air filter element', 'Nos', 110, 'Trading', 'goods'],
  batt: ['Battery 12V 200Ah', 'Maintenance free starter battery', 'Nos', 640, 'Trading', 'goods'],
  oil: ['Engine Oil 15W-40 (20 L)', 'Diesel engine oil, 20 litre drum', 'Drum', 420, 'Trading', 'goods'],
  cable: ['Power Cable 4C x 185 mm (cut length)', 'Armoured copper cable, cut to length', 'Meter', 38, 'Trading', 'goods'],
  ats: ['ATS Panel 630A', 'Automatic transfer switch panel', 'Nos', 61000, 'Trading', 'goods'],
  dist: ['Distribution Panel 400A', 'Site distribution panel with MCCBs', 'Nos', 18500, 'Trading', 'goods'],
  sync: ['Synchronizing Panel', 'Load sharing synchronizing panel', 'Nos', 160000, 'Trading', 'goods'],
  diesel: ['Diesel (Bulk)', 'Bulk diesel delivered by tanker', 'Litre', 2.85, 'Fuel Trading', 'goods'],
  tech: ['Technician labour', 'Service technician, per hour', 'Hour', 120, 'Other', 'service'],
  inst: ['Generator Installation & Commissioning', 'Installation, cabling and commissioning', 'Job', 3500, 'Other', 'one-time-service'],
  deliv: ['Delivery Charge', 'Delivery to site by own fleet', 'Trip', 2000, 'Other', 'one-time-service'],
  load: ['Load bank test and report', 'Load bank test with report', 'Job', 2800, 'Other', 'service'],
  crane: ['Crane hire for offloading', 'Mobile crane for offloading at site', 'Job', 1800, 'Other', 'service'],
  sby: ['Standby operator', 'Generator operator on standby, per day', 'Day', 450, 'Other', 'service'],
  ovh: ['Engine overhaul labour', 'Top overhaul workshop labour', 'Job', 14500, 'Other', 'service'],
  therm: ['Thermal imaging inspection', 'Panel thermal imaging with report', 'Job', 1500, 'Other', 'service'],
  r100d: ['Generator 100 KVA rental', 'Short-term hire, per day', 'Day', 650, 'Rental', 'rental'],
  r200d: ['Generator 200 KVA rental', 'Short-term hire, per day', 'Day', 1400, 'Rental', 'rental'],
  r500d: ['Generator 500 KVA rental', 'Short-term hire, per day', 'Day', 2200, 'Rental', 'rental'],
  r1000w: ['Generator 1000 KVA rental', 'Hire, per week', 'Week', 24000, 'Rental', 'rental'],
  r500m: ['Generator 500 KVA rental', 'Hire, per month', 'Month', 50000, 'Rental', 'rental'],
  r1000m: ['Generator 1000 KVA rental', 'Hire, per month', 'Month', 98000, 'Rental', 'rental'],
  pod: ['POD 20 ft rental', 'Hire, per month', 'Month', 5200, 'Rental', 'rental'],
  tray: ['Cable tray rental', 'Hire, per month', 'Month', 900, 'Rental', 'rental'],
  dmg: ['Damage charge', 'Damage found on return inspection', 'Lump sum', 4500, 'Rental', 'damage', '410600'],
  sale200: ['Generator 200 KVA (ex-fleet)', 'Ex-fleet unit sold as inspected, with service history', 'Nos', 118000, 'Fixed Asset Trading', 'asset-sale'],
  sale500: ['Generator 500 KVA (ex-fleet)', 'Ex-fleet unit sold as inspected, with service history', 'Nos', 380000, 'Fixed Asset Trading', 'asset-sale'],
  salePod: ['POD 20 ft (ex-fleet)', 'Ex-fleet POD sold as inspected', 'Nos', 32000, 'Fixed Asset Trading', 'asset-sale'],
  sale1500: ['Generator 1500 KVA (refurbished)', 'Refurbished unit with 12 month warranty', 'Nos', 1180000, 'Fixed Asset Trading', 'asset-sale'],
  amc: ['AMC visit', 'Scheduled AMC visit, contract value share', 'Visit', 4500, 'AMC', 'visit'],
};
/** [item, description, unit, rate, account, tag, activity] */
type BcRow = [string, string, string, number, string, LineTag];
const BC: Record<string, BcRow> = {
  inj: ['Fuel injector set (6 cyl)', 'Genuine injector set', 'Set', 4200, '140100', 'goods'],
  oilf: ['Oil Filter (Cummins C-Series)', 'Genuine oil filter element', 'Nos', 52, '140100', 'goods'],
  fuelf: ['Fuel Filter (Perkins 1106)', 'Genuine fuel filter element', 'Nos', 38, '140100', 'goods'],
  airf: ['Air Filter (Perkins 2506)', 'Genuine air filter element', 'Nos', 70, '140100', 'goods'],
  batt: ['Battery 12V 200Ah', 'Maintenance free starter battery', 'Nos', 430, '140100', 'goods'],
  oil: ['Engine Oil 15W-40 (20 L)', 'Diesel engine oil, 20 litre drum', 'Drum', 285, '140100', 'goods'],
  avr: ['Alternator AVR module', 'Automatic voltage regulator', 'Nos', 1850, '140100', 'goods'],
  dsl_fleet: ['Diesel for own fleet (fuel card)', 'Vehicle fuel card consumption for the month', 'Litre', 2.78, '510320', 'goods'],
  dsl_stock: ['Diesel (Bulk) for resale', 'Bulk diesel delivered to the fuel stock location', 'Litre', 2.55, '140100', 'goods'],
  haul: ['Low-bed haulage, Jebel Ali to site', 'Heavy equipment haulage, per trip', 'Trip', 1400, '510300', 'transport'],
  crane: ['Mobile crane 100 ton, per day', 'Crane hire for loading and offloading', 'Day', 3200, '510310', 'service'],
  repair: ['Alternator rewinding and rebuild', 'Workshop repair, parts and labour', 'Job', 9500, '510500', 'service'],
  ovh: ['Engine major overhaul service', 'Major overhaul with gasket and bearing kit', 'Job', 28000, '510500', 'service'],
  ins: ['Contractors plant all risk insurance', 'Annual premium for the rental fleet', 'Policy', 46000, '520100', 'service'],
  xh500: ['Cross-hire Generator 500 KVA', 'Cross-hire for a client order, per month', 'Month', 36000, '510100', 'cross-hire'],
  xh200: ['Cross-hire Generator 200 KVA', 'Cross-hire for a client order, per month', 'Month', 21000, '510100', 'cross-hire'],
  xh1000: ['Cross-hire Generator 1000 KVA', 'Cross-hire for a client order, per month', 'Month', 58500, '510100', 'cross-hire'],
  capex500: ['Generator 500 KVA, new', 'New diesel generator for the rental fleet', 'Nos', 410000, '120100', 'goods'],
  matl: ['Cable glands and lugs, assorted', 'Consumables for panel work', 'Lot', 3400, '510400', 'goods'],
  panel: ['ATS panel components', 'Contactors, relays and controller', 'Lot', 7800, '510400', 'goods'],
};

/* ------------------------------------------------------------------ manual documents (data only, built by the loops in buildAccountingSeed) */
type Meth = PaymentEntry['method'];
type PState = 'Approved' | 'Pending' | 'Rejected';
/** [share of the document total, days after the document date (negative: days before 30 Sep), method, state, extras] */
type PS = [share: number, d: number, method?: Meth, st?: PState, x?: { cd?: string; n?: string }];
type At = string | { late: number } | { due: number };
type IL = [key: string, qty: number, rate?: number, disc?: number];
type IB = [key: string, qty: number, rate?: number];
interface MS { c: string; at: At; l: IL[]; st: 'D' | 'P' | 'S' | 'R' | 'A'; key?: string; pay?: PS[]; by?: string; note?: string; o?: Partial<SalesInvoice>; cc?: string; warn?: boolean }
interface BS { s: string; at: At; l: IB[]; ex?: [account: string, desc: string, amount: number][]; st: 'D' | 'P' | 'S' | 'R' | 'A'; key?: string; pay?: PS[]; grp?: string; by?: string; note?: string; cc?: string; act?: string; no?: string; o?: Partial<Bill> }
const FM = 'Nasser Al Ketbi';

const MS_LIST: MS[] = [
  /* Draft */
  { c: 'c19', at: '2026-09-29', l: [['r500d', 14]], st: 'D', note: 'Quote revised, awaiting site confirmation' },
  { c: 'c15', at: '2026-10-05', l: [['oilf', 24], ['fuelf', 24], ['airf', 12]], st: 'D' },
  { c: 'c25', at: '2026-09-30', l: [['diesel', 8000]], st: 'D' },
  /* Pending approval (two dated ahead) */
  { c: 'c5', at: '2026-09-28', l: [['inst', 2], ['deliv', 2], ['crane', 1]], st: 'P' },
  { c: 'c10', at: '2026-09-26', l: [['r1000m', 2]], st: 'P' },
  { c: 'c18', at: '2026-09-30', l: [['batt', 8], ['oil', 4]], st: 'P' },
  { c: 'c2', at: '2026-10-01', l: [['tech', 48], ['load', 1]], st: 'P' },
  { c: 'c12', at: '2026-09-27', l: [['ats', 1], ['inst', 1]], st: 'P' },
  { c: 'c23', at: '2026-10-12', l: [['r500d', 10], ['deliv', 1]], st: 'P' },
  /* Submitted with an approver */
  { c: 'c20', at: '2026-09-25', l: [['sale200', 1]], st: 'S', by: FM },
  { c: 'c27', at: '2026-09-29', l: [['r1000m', 3]], st: 'S', by: APPROVER },
  { c: 'c11', at: '2026-09-24', l: [['amc', 2], ['oil', 3]], st: 'S', by: FM },
  { c: 'c7', at: '2026-09-30', l: [['dist', 2], ['cable', 250]], st: 'S', by: APPROVER },
  /* Rejected, with the reason in the log */
  { c: 'c9', at: '2026-09-12', l: [['batt', 4], ['oil', 2]], st: 'R', by: FM, note: 'Customer is an individual without a TRN, please confirm the VAT treatment and resubmit' },
  { c: 'c26', at: '2026-09-15', l: [['r500d', 30, 1800]], st: 'R', by: FM, note: 'Rate does not match the LPO (AED 2,000 per day), correct and resubmit' },
  { c: 'c3', at: '2026-09-18', l: [['sale500', 1]], st: 'R', by: APPROVER, note: 'Asset sale needs the approved disposal request attached first' },
  /* Approved, not yet due */
  { c: 'c16', at: { due: 40 }, l: [['r1000m', 4]], st: 'A' },
  { c: 'c5', at: { due: 25 }, l: [['r500m', 3], ['deliv', 1]], st: 'A' },
  { c: 'c4', at: { due: 12 }, l: [['amc', 4]], st: 'A' },
  { c: 'c27', at: { due: 30 }, l: [['r1000m', 2], ['crane', 1]], st: 'A' },
  { c: 'c12', at: { due: 20 }, l: [['diesel', 15000]], st: 'A', pay: [[1, -1, 'Bank', 'Pending']] },
  { c: 'c26', at: { due: 8 }, l: [['tech', 60], ['crane', 2]], st: 'A', pay: [[1, -2, 'Cheque', 'Pending', { cd: '2026-10-10' }]] },
  { c: 'c6', at: { due: 35 }, l: [['load', 2], ['therm', 3]], st: 'A' },
  { c: 'c1', at: { due: 15 }, l: [['oilf', 40], ['airf', 20], ['oil', 10]], st: 'A' },
  /* Approved, overdue in every ageing bucket */
  { c: 'c2', at: { late: 8 }, key: 'a2', l: [['r200d', 30]], st: 'A' },
  { c: 'c8', at: { late: 22 }, key: 'a8', l: [['pod', 2], ['deliv', 1]], st: 'A' },
  { c: 'c3', at: { late: 15 }, l: [['r500d', 12]], st: 'A' },
  { c: 'c15', at: { late: 38 }, l: [['oilf', 60], ['fuelf', 60], ['batt', 6]], st: 'A', pay: [[0.5, -3, 'Bank', 'Pending']] },
  { c: 'c7', at: { late: 55 }, l: [['dist', 3], ['cable', 300]], st: 'A', pay: [[1, -20, 'Cheque', 'Rejected', { n: 'Cheque returned by the bank, insufficient funds' }]] },
  { c: 'c19', at: { late: 44 }, l: [['r200d', 20]], st: 'A' },
  { c: 'c23', at: { late: 66 }, key: 'a23', l: [['r500d', 16], ['deliv', 2]], st: 'A' },
  { c: 'c12', at: { late: 85 }, key: 'a12', l: [['ats', 1]], st: 'A' },
  { c: 'c20', at: { late: 104 }, l: [['pod', 2], ['tray', 10]], st: 'A' },
  { c: 'c25', at: { late: 98 }, l: [['diesel', 9000]], st: 'A' },
  { c: 'c11', at: { late: 140 }, l: [['amc', 3]], st: 'A' },
  { c: 'c26', at: { late: 172 }, key: 'a26', l: [['r1000m', 3]], st: 'A' },
  { c: 'c1', at: { late: 215 }, l: [['r500m', 2]], st: 'A' },
  { c: 'c6', at: { late: 290 }, l: [['ovh', 1], ['tech', 20]], st: 'A' },
  /* Burj Events (c13): open balances far above its credit limit of AED 120,000 */
  { c: 'c13', at: { late: 6 }, l: [['r1000w', 4]], st: 'A', warn: true },
  { c: 'c13', at: { late: 40 }, key: 'a13b', l: [['r500d', 20], ['cable', 300]], st: 'A', warn: true },
  { c: 'c13', at: { late: 75 }, l: [['r200d', 30], ['deliv', 2]], st: 'A', warn: true },
  { c: 'c13', at: { late: 130 }, l: [['sby', 40], ['load', 1]], st: 'A', warn: true },
  /* Ruwais Petrochemical (c17): open balance close to its credit limit of AED 3,500,000 */
  { c: 'c17', at: { late: 12 }, l: [['sale1500', 2]], st: 'A', warn: true },
  { c: 'c17', at: { due: 50 }, l: [['r1000m', 6]], st: 'A', warn: true },
  { c: 'c17', at: { due: 30 }, l: [['sync', 2]], st: 'A', warn: true },
  /* Partially paid, mixed shares */
  { c: 'c4', at: '2026-08-05', l: [['r500m', 2], ['deliv', 1]], st: 'A', pay: [[0.4, 20]] },
  { c: 'c10', at: '2026-06-20', l: [['r1000m', 2]], st: 'A', pay: [[0.6, 55, 'Cheque']] },
  { c: 'c14', at: '2026-07-10', l: [['sby', 60], ['tech', 80]], st: 'A', pay: [[0.25, 40]] },
  { c: 'c18', at: '2026-08-20', key: 'a18', l: [['batt', 10], ['oil', 6], ['airf', 10]], st: 'A', pay: [[0.5, 20]] },
  { c: 'c27', at: '2026-07-28', l: [['r1000m', 3]], st: 'A', pay: [[0.7, 45]] },
  { c: 'c16', at: '2026-06-15', l: [['r1000m', 5]], st: 'A', pay: [[0.3, 60]] },
  /* Advance applied (partly): the advance is applied in the loop below */
  { c: 'c11', at: '2026-08-18', key: 'a11adv', l: [['r1000m', 2]], st: 'A' },
  { c: 'c20', at: '2026-09-03', key: 'a20adv', l: [['salePod', 1]], st: 'A' },
  /* Paid, spread over the last twelve months */
  { c: 'c1', at: '2025-10-14', l: [['oil', 12], ['airf', 6], ['tech', 16]], st: 'A', pay: [[1, 38]] },
  { c: 'c10', at: '2025-11-20', l: [['r1000m', 2], ['inst', 1]], st: 'A', pay: [[1, 52]] },
  { c: 'c14', at: '2025-12-09', l: [['oil', 30], ['oilf', 60]], st: 'A', o: { vatType: 'Export (Zero-Rated)', placeOfSupply: 'Export' }, note: 'Spare parts supplied for offshore vessels, zero-rated export', pay: [[1, 55]] },
  { c: 'c24', at: '2025-11-05', l: [['r500m', 2]], st: 'A', pay: [[1, 32]] },
  { c: 'c24', at: '2026-01-20', l: [['tech', 24], ['oil', 4]], st: 'A', pay: [[1, 28, 'Cheque']] },
  { c: 'c2', at: '2026-03-03', l: [['r200d', 45]], st: 'A', pay: [[1, 29, 'Cheque']] },
  { c: 'c12', at: '2026-03-25', l: [['diesel', 20000]], st: 'A', pay: [[1, 40, 'Cheque']] },
  { c: 'c13', at: '2026-03-10', l: [['r500d', 6]], st: 'A', pay: [[1, 12, 'Cheque']] },
  { c: 'c16', at: '2026-04-15', l: [['load', 2], ['tech', 40]], st: 'A', o: { currency: 'USD', exchangeRate: 3.6725 }, note: 'Billed in USD at 3.6725, amounts shown in AED equivalent', pay: [[1, 70]] },
  { c: 'c10', at: '2026-05-05', l: [['r1000m', 1], ['inst', 1]], st: 'A', o: { discountOn: 'Net Amount', discountPct: 5, roundOff: true }, note: 'Includes a 5% additional discount, rounded to the nearest dirham', pay: [[1, 45]] },
  { c: 'c3', at: '2026-05-14', l: [['r500d', 9], ['deliv', 2]], st: 'A', pay: [[1, 14]] },
  { c: 'c6', at: '2026-06-09', l: [['ats', 1], ['inst', 1]], st: 'A', pay: [[1, 40, 'Cheque']] },
  { c: 'c19', at: '2026-06-30', l: [['sale200', 1]], st: 'A', pay: [[1, 20]] },
  { c: 'c9', at: '2026-07-08', l: [['batt', 3], ['oilf', 6]], st: 'A', pay: [[1, 5, 'Cash']] },
  { c: 'c8', at: '2026-08-02', l: [['pod', 3]], st: 'A', pay: [[1, 26]] },
  { c: 'c22', at: '2026-08-11', l: [['r200d', 3]], st: 'A', pay: [[1, 6]] },
  { c: 'c25', at: '2026-08-14', l: [['cable', 400], ['dist', 1]], st: 'A', o: { roundOff: true }, pay: [[1, 18]] },
  { c: 'c23', at: '2026-08-26', l: [['r200d', 10]], st: 'A', pay: [[1, 5]] },
  { c: 'c21', at: '2026-09-08', l: [['r100d', 5], ['deliv', 1]], st: 'A', o: { transactionType: 'Cash', paymentTerms: 'Immediate' }, note: 'Cash invoice, settled on approval', pay: [[1, 0, 'Cash']] },
  { c: 'c18', at: '2026-02-05', l: [['batt', 5], ['airf', 8]], st: 'A', pay: [[1, 27]] },
  { c: 'c11', at: '2026-04-01', l: [['r1000m', 2]], st: 'A', pay: [[1, 44, 'Cheque']] },
  { c: 'c4', at: '2026-02-25', l: [['amc', 2], ['load', 1]], st: 'A', pay: [[1, 58]] },
];

const BS_LIST: BS[] = [
  /* Draft, Pending, Submitted, Rejected */
  { s: 's17', at: '2026-09-29', l: [['inj', 2]], st: 'D', cc: 'cc17', act: 'Other' },
  { s: 's5', at: '2026-09-30', l: [['xh500', 1]], ex: [['510300', 'Delivery to site', 450]], st: 'D', cc: 'cc15', act: 'Rental' },
  { s: 's3', at: '2026-09-28', l: [['oilf', 200], ['fuelf', 150], ['airf', 80]], st: 'P', cc: 'cc17', act: 'Trading' },
  { s: 's19', at: '2026-10-02', l: [['haul', 3]], ex: [['510310', 'Loading and unloading', 600]], st: 'P', cc: 'cc1', act: 'Rental' },
  { s: 's4', at: '2026-09-30', l: [['dsl_fleet', 9000]], st: 'P', cc: 'cc1', act: 'Rental' },
  { s: 's22', at: '2026-09-26', l: [['capex500', 2]], ex: [['510300', 'Freight and delivery to Jebel Ali', 2800]], st: 'S', by: FM, cc: 'cc8', act: 'Rental' },
  { s: 's1', at: '2026-09-27', l: [['ovh', 1], ['inj', 1]], st: 'S', by: APPROVER, cc: 'cc17', act: 'Other' },
  { s: 's20', at: '2026-09-14', l: [['crane', 2]], st: 'R', by: FM, note: 'Duplicate of crane bill ALH-3392 that is already booked', cc: 'cc1', act: 'Rental', no: 'ALH-3392' },
  { s: 's16', at: '2026-09-16', l: [['dsl_stock', 12000]], st: 'R', by: FM, note: 'Delivery note not signed by the yard, ask the supplier for the signed copy', cc: 'cc7', act: 'Fuel Trading' },
  /* Approved, not yet due (three with a payment waiting) */
  { s: 's4', at: { due: 10 }, l: [['dsl_fleet', 14000]], st: 'A', cc: 'cc1', act: 'Rental' },
  { s: 's15', at: { due: 9 }, l: [['dsl_stock', 20000]], st: 'A', cc: 'cc7', act: 'Fuel Trading' },
  { s: 's17', at: { due: 18 }, l: [['avr', 2], ['batt', 6]], st: 'A', cc: 'cc17', act: 'AMC', pay: [[1, -1, 'Bank', 'Pending']] },
  { s: 's19', at: { due: 14 }, l: [['haul', 2]], ex: [['510310', 'Loading and unloading', 400]], st: 'A', cc: 'cc1', act: 'Rental', pay: [[1, -2, 'Bank', 'Rejected', { n: 'Supplier bank details changed, confirm the IBAN with the supplier first' }]] },
  { s: 's18', at: { due: 30 }, l: [['oilf', 300], ['airf', 120]], st: 'A', cc: 'cc17', act: 'Trading', pay: [[1, -1, 'Cheque', 'Pending', { cd: '2026-10-15' }]] },
  /* Approved, overdue in the ageing buckets */
  { s: 's3', at: { late: 12 }, key: 'bS3', l: [['oilf', 250], ['airf', 100], ['batt', 12]], st: 'A', cc: 'cc17', act: 'Trading' },
  { s: 's6', at: { late: 35 }, key: 'bS6', l: [['xh200', 2]], ex: [['510300', 'Delivery and collection', 700]], st: 'A', cc: 'cc15', act: 'Rental' },
  { s: 's2', at: { late: 70 }, key: 'bS2', l: [['avr', 3], ['inj', 2]], st: 'A', cc: 'cc17', act: 'Other' },
  { s: 's11', at: { late: 100 }, l: [['xh1000', 1]], st: 'A', cc: 'cc15', act: 'Rental' },
  { s: 's7', at: { late: 150 }, key: 'bS7', l: [['panel', 1], ['matl', 2]], st: 'A', cc: 'cc17', act: 'Rental' },
  { s: 's21', at: { late: 230 }, l: [['haul', 4]], st: 'A', cc: 'cc10', act: 'Rental' },
  /* Paid (the two fuel bills of s4 are settled by one payment) */
  { s: 's4', at: '2026-06-02', l: [['dsl_fleet', 16000]], st: 'A', cc: 'cc1', act: 'Rental', grp: 'g1', pay: [[1, 12]] },
  { s: 's4', at: '2026-06-18', l: [['dsl_fleet', 12000]], st: 'A', cc: 'cc1', act: 'Rental', grp: 'g1', pay: [[1, 12]] },
  { s: 's15', at: '2026-07-05', l: [['dsl_stock', 22000]], st: 'A', cc: 'cc7', act: 'Fuel Trading', pay: [[1, 12, 'Cheque']] },
  { s: 's19', at: '2026-07-20', l: [['haul', 5]], ex: [['510310', 'Loading and unloading', 500]], st: 'A', cc: 'cc1', act: 'Rental', pay: [[1, 22]] },
  { s: 's20', at: '2026-08-04', l: [['crane', 1]], st: 'A', cc: 'cc1', act: 'Rental', pay: [[1, 9, 'Cash']] },
  { s: 's17', at: '2026-06-05', l: [['batt', 8], ['oil', 10]], st: 'A', cc: 'cc17', act: 'AMC', pay: [[1, 28]] },
  { s: 's14', at: '2026-01-15', l: [['ins', 1]], st: 'A', cc: 'cc6', act: 'Other', note: 'Annual premium, arranged through the equipment leasing company', pay: [[1, 40]] },
  /* Partially paid */
  { s: 's1', at: '2026-07-25', key: 'bS1', l: [['repair', 2], ['avr', 2]], st: 'A', cc: 'cc17', act: 'Other', pay: [[0.5, 40]] },
  { s: 's22', at: '2026-05-12', l: [['capex500', 2]], ex: [['510300', 'Freight and delivery to Jebel Ali', 2800]], st: 'A', cc: 'cc8', act: 'Rental', pay: [[0.6, 70]] },
  { s: 's5', at: '2026-08-01', l: [['xh500', 1]], ex: [['510300', 'Delivery to site', 450]], st: 'A', cc: 'cc15', act: 'Rental', pay: [[0.4, 25]] },
];

/** Notes: [invoice or bill key, reason, state, days after the document, lines [item, qty, rate]]; no lines means the note settles the whole amount due. */
const CN_LIST: { key: string; reason: string; st: 'Approved' | 'Pending'; days: number; l?: [string, number, number][] }[] = [
  { key: 'a2', reason: 'Billing error', st: 'Approved', days: 3, l: [['Overbilled hire days', 2, 1400]] },
  { key: 'a8', reason: 'Early termination', st: 'Approved', days: 6, l: [['One POD off hire early, unused days', 1, 5200]] },
  { key: 'a13b', reason: 'Early termination', st: 'Approved', days: 5, l: [['Exhibition ended three days early', 3, 2200]] },
  { key: 'a12', reason: 'Billing error', st: 'Approved', days: 10 },
  { key: 'a18', reason: 'Returned goods', st: 'Approved', days: 15, l: [['Batteries returned unused', 2, 640]] },
  { key: 'a23', reason: 'Rate correction', st: 'Pending', days: 7, l: [['Rate corrected to the agreed LPO rate', 16, 100]] },
  { key: 'a26', reason: 'Billing error', st: 'Pending', days: 20, l: [['One unit not delivered, billed in error', 1, 98000]] },
];
const DN_LIST: typeof CN_LIST = [
  { key: 'bS3', reason: 'Rejected on receipt (QC)', st: 'Approved', days: 6, l: [['Filters rejected on receipt (QC)', 30, 70]] },
  { key: 'bS6', reason: 'Early off-hire by supplier', st: 'Approved', days: 10, l: [['Unit off hire early, three days not payable', 3, 1200]] },
  { key: 'bS2', reason: 'Rate correction', st: 'Pending', days: 12, l: [['Rate difference against the purchase order', 1, 1500]] },
  { key: 'bS1', reason: 'Other', st: 'Approved', days: 5, l: [['Warranty rework credited by the supplier', 1, 2200]] },
  { key: 'bS7', reason: 'Rate correction', st: 'Pending', days: 9, l: [['Price difference on the delivery', 1, 900]] },
];

/* ------------------------------------------------------------------ build */
export function buildAccountingSeed(): Built {
  const invoices: SalesInvoice[] = [];
  const bills: Bill[] = [];
  const payments: PaymentEntry[] = [];
  const creditNotes: NoteDoc[] = [];
  const debitNotes: NoteDoc[] = [];
  const pending: { date: string; type: JournalType; refType: string; refId: string; refNumber: string; narration: string; lines: JournalLine[]; set?: (id: string) => void; no?: number }[] = [];

  /* -------- numbers already referenced by the CRM and Inventory seeds (never reused) */
  const reservedInv = new Set<number>();
  const reservedJv = new Set<number>();
  orderSeed.forEach((o) => o.lines.forEach((l) => { const n = numIn(l.fulfilmentRef); if (n && /^INV-/.test(l.fulfilmentRef ?? '')) reservedInv.add(n); }));
  jobCardSeed.forEach((j) => { [j.invoiceRef, j.invoiceId].forEach((x) => { const n = numIn(x); if (n) reservedInv.add(n); }); });
  disposalSeed.forEach((d) => { const n = numIn(d.outcome?.invoiceRef); if (n) reservedInv.add(n); const j = numIn(d.outcome?.journalRef); if (j) reservedJv.add(j); });

  /* -------- placeholder numbers: replaced at the end, in posting-date order */
  type Kind = 'INV' | 'BILL' | 'PAY' | 'CRN' | 'DBN';
  const reg: Record<Kind, { k: number; date: string }[]> = { INV: [], BILL: [], PAY: [], CRN: [], DBN: [] };
  const tok = (kind: Kind, date: string) => {
    const k = reg[kind].length + 1;
    reg[kind].push({ k, date });
    return { no: `⟦${kind}:${k}:n⟧`, id: `${kind.toLowerCase()}-⟦${kind}:${k}:i⟧` };
  };
  const last5 = (no: string) => (no.includes('⟦') ? no.replace(':n⟧', ':d⟧') : no.slice(-5));

  const base = { postingTime: '09:00', exchangeRate: 1, discountOn: 'None' as const, discountPct: 0, roundOff: false, attachments: [] as string[] };
  const MAN = { type: 'Manual' as const, id: '', number: '' };

  /* -------- sales invoice (every state) */
  const inv = (o: Partial<SalesInvoice> & Pick<SalesInvoice, 'id' | 'number' | 'date' | 'partyName' | 'lines' | 'source'>, rejectNote?: string): SalesInvoice => {
    const r: SalesInvoice = {
      ...base, entity: ENT, currency: 'AED', paymentTerms: '30 days', transactionType: 'Credit', vatType: 'Standard (With VAT)', dueDate: '', approval: 'Approved', approver: APPROVER,
      payStatus: 'Unpaid', amountPaid: 0, creditNoteIds: [], log: [], ...o,
    };
    r.dueDate = r.dueDate || dueDateFor(r.date, r.paymentTerms);
    const from = r.source.type === 'Manual' ? 'Entered manually' : `From ${r.source.type} ${r.source.number}`;
    const at = (h: string) => `${r.date} ${h}`;
    const head: LogItem[] = r.approval === 'Approved' ? [lg(at('10:00'), 'Invoice created', from), lg(at('12:00'), 'Approved (Quick Approval)', undefined, 'green', r.approver ?? APPROVER)]
      : r.approval === 'Draft' ? [lg(at('10:00'), 'Saved as draft', from, 'blue')]
        : r.approval === 'Pending' ? [lg(at('10:00'), 'Invoice created', `${from}. Pending approval`, 'blue')]
          : r.approval === 'Submitted' ? [lg(at('10:00'), 'Invoice created', from, 'blue'), lg(at('11:00'), 'Submitted for approval', `Approver: ${r.approver}`, 'blue')]
            : [lg(at('10:00'), 'Invoice created', from, 'blue'), lg(at('11:00'), 'Submitted for approval', `Approver: ${r.approver}`, 'blue'), lg(`${addDays(r.date, 1)} 15:00`, 'Rejected', rejectNote, 'red', r.approver ?? APPROVER)];
    r.log = [...head, ...r.log];
    invoices.push(r);
    if (r.approval === 'Approved') pending.push({ date: r.date, type: 'Sales', refType: 'Sales Invoice', refId: r.id, refNumber: r.number, narration: `Sales invoice ${r.number}, ${r.partyName}`, lines: salesJournal(r), set: (j) => { r.journalId = j; } });
    return r;
  };

  /* -------- collection: allocated in full or part to one invoice; Pending and Rejected ones leave the invoice untouched */
  const payDate = (docDate: string, d: number) => (d >= 0 ? minDate(ASOF, addDays(docDate, d)) : addDays(ASOF, d));
  interface PayOpt { date: string; share?: number; amount?: number; method?: Meth; st?: PState; chequeDate?: string; note?: string; narration?: string }
  const collect = (r: SalesInvoice, o: PayOpt): PaymentEntry | undefined => {
    const total = totalsOf(r).total;
    const due = round2(total - r.amountPaid);
    const amount = round2(Math.min(o.amount ?? round2(total * (o.share ?? 1)), due));
    if (!(amount > 0)) return undefined;
    const date = maxDate(r.date, o.date);
    const st = o.st ?? 'Approved';
    const method = o.method ?? 'Bank';
    const h = hash(r.id + date);
    const bankAccount = method === 'Cash' ? CASHACC : h % 4 === 0 ? BANK2 : BANK1;
    const chequeNo = String(100000 + (h % 899999));
    const l5 = last5(r.number);
    const t = tok('PAY', date);
    const how = method === 'Cheque' ? `Cheque ${chequeNo}` : method === 'Cash' ? 'Cash' : 'Bank transfer';
    const p: PaymentEntry = {
      id: t.id, number: t.no, direction: 'Receive', date, partyType: 'Customer', partyId: r.customerId, partyName: r.partyName, method, bankAccount,
      reference: method === 'Cheque' ? `CHQ-${chequeNo}` : method === 'Cash' ? `RCT-${l5}` : `TT-${l5}`, ...(method === 'Cheque' ? { chequeNo, chequeDate: o.chequeDate ?? date } : {}),
      amount, isAdvance: false, advanceUsed: 0, soId: r.soId, soNumber: r.soNumber, allocations: [{ docType: 'invoice', docId: r.id, docNumber: r.number, amount }], approval: st, narration: o.narration ?? (r.transactionType === 'Cash' ? 'Cash invoice settled on approval' : amount < total - 0.005 ? `Part payment against ${r.number}` : undefined),
      log: st === 'Approved' ? [lg(`${date} 11:00`, 'Collection received', `${how}, ${r.number}`), lg(`${date} 11:30`, 'Approved', undefined, 'green')]
        : st === 'Pending' ? [lg(`${date} 11:00`, 'Collection created', `${method}, AED ${amount}. Pending approval`, 'blue')]
          : [lg(`${date} 11:00`, 'Collection created', `${method}, AED ${amount}. Pending approval`, 'blue'), lg(`${date} 16:00`, 'Rejected', o.note, 'red')],
    };
    payments.push(p);
    if (st === 'Approved') {
      r.amountPaid = round2(r.amountPaid + amount);
      r.payStatus = payStatusOf(total - r.amountPaid, total);
      r.log.push(lg(`${date} 11:30`, `Collection ${p.number} applied`, `AED ${amount}`, 'green'));
      pending.push({ date, type: 'Cash Receipt Voucher', refType: 'Collection', refId: p.id, refNumber: p.number, narration: `Collection ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
    }
    return p;
  };
  const collectSpec = (r: SalesInvoice, ps: PS[] = []) => ps.forEach(([share, d, method, st, x]) => collect(r, { date: payDate(r.date, d), share, method, st, chequeDate: x?.cd, note: x?.n }));

  /* -------- advance received (against an order or only for the customer), optionally applied to an invoice later (engine.applyAdvance pattern) */
  const advance = (partyId: string | undefined, partyName: string, amount: number, date: string, o: { method?: Meth; st?: PState; so?: SalesOrder; ref?: string; narration?: string; note?: string; chequeDate?: string } = {}): PaymentEntry => {
    const method = o.method ?? 'Bank';
    const st = o.st ?? 'Approved';
    const h = hash(partyName + date);
    const chequeNo = String(100000 + (h % 899999));
    const t = tok('PAY', date);
    const p: PaymentEntry = {
      id: t.id, number: t.no, direction: 'Receive', date, partyType: 'Customer', partyId, partyName, method, bankAccount: method === 'Cash' ? CASHACC : h % 3 === 0 ? BANK2 : BANK1,
      reference: o.ref ?? (method === 'Cheque' ? `CHQ-${chequeNo}` : method === 'Cash' ? `RCT-ADV-${h % 9000}` : `TT-ADV-${10000 + (h % 89999)}`), ...(method === 'Cheque' ? { chequeNo, chequeDate: o.chequeDate ?? date } : {}),
      amount, isAdvance: true, advanceUsed: 0, soId: o.so?.id, soNumber: o.so?.number, allocations: [], approval: st, narration: o.narration ?? (o.so ? `Advance against ${o.so.number}` : 'Advance received'),
      log: st === 'Approved' ? [lg(`${date} 10:00`, 'Advance received', o.so ? `Against ${o.so.number}` : undefined), lg(`${date} 10:30`, 'Approved', undefined, 'green')]
        : st === 'Pending' ? [lg(`${date} 10:00`, 'Advance collection created', `${method}, AED ${amount}. Pending approval`, 'blue')]
          : [lg(`${date} 10:00`, 'Advance collection created', `${method}, AED ${amount}. Pending approval`, 'blue'), lg(`${date} 15:00`, 'Rejected', o.note, 'red')],
    };
    payments.push(p);
    if (st === 'Approved') pending.push({ date, type: 'Cash Receipt Voucher', refType: 'Collection', refId: p.id, refNumber: p.number, narration: `Advance ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
    return p;
  };
  const applyAdvance = (r: SalesInvoice, p: PaymentEntry, amount: number, date: string) => {
    const total = totalsOf(r).total;
    const left = round2(p.amount - p.allocations.reduce((s, a) => s + a.amount, 0) - p.advanceUsed);
    const amt = round2(Math.min(amount, left, round2(total - r.amountPaid)));
    if (!(amt > 0) || r.approval !== 'Approved' || p.approval !== 'Approved') return;
    p.advanceUsed = round2(p.advanceUsed + amt);
    p.log.push(lg(`${date} 10:00`, `Applied to ${r.number}`, `AED ${amt}`, 'green'));
    r.amountPaid = round2(r.amountPaid + amt);
    r.payStatus = payStatusOf(total - r.amountPaid, total);
    r.log.push(lg(`${date} 10:00`, `Advance ${p.number} applied`, `AED ${amt}`, 'green'));
    pending.push({ date, type: 'Cash Receipt Voucher', refType: 'Advance applied', refId: r.id, refNumber: r.number, narration: `Advance ${p.number} applied to ${r.number}`, lines: advanceJournal(r.partyName, amt, r.number) });
  };

  /* -------- bill (every state) */
  const bill = (o: Partial<Bill> & Pick<Bill, 'id' | 'number' | 'date' | 'supplierName' | 'lines' | 'source'>, rejectNote?: string): Bill => {
    const sup = suppliers.find((s) => s.id === o.supplierId);
    const terms = normTerms(o.paymentTerms) ?? `${sup?.creditPeriod || 30} days`;
    const b: Bill = {
      ...base, entity: ENT, currency: 'AED', dueDate: '', supplierInvoiceNo: '', supplierInvoiceDate: o.date, expenses: [], approval: 'Approved', approver: APPROVER, payStatus: 'Unpaid', amountPaid: 0, debitNoteIds: [], log: [], ...o, paymentTerms: terms,
    };
    b.dueDate = o.dueDate || dueDateFor(b.date, terms);
    const from = b.source.type === 'Manual' ? `Entered manually, supplier invoice ${b.supplierInvoiceNo}` : `From ${b.source.type} ${b.source.number}, supplier invoice ${b.supplierInvoiceNo || 'to follow'}`;
    const at = (h: string) => `${b.date} ${h}`;
    const head: LogItem[] = b.approval === 'Approved' ? [lg(at('10:00'), 'Bill created', from), lg(at('12:00'), 'Approved', undefined, 'green', b.approver ?? APPROVER)]
      : b.approval === 'Draft' ? [lg(at('10:00'), 'Saved as draft', from, 'blue')]
        : b.approval === 'Pending' ? [lg(at('10:00'), 'Bill created', `${from}. Pending approval`, 'blue')]
          : b.approval === 'Submitted' ? [lg(at('10:00'), 'Bill created', from, 'blue'), lg(at('11:00'), 'Submitted for approval', `Approver: ${b.approver}`, 'blue')]
            : [lg(at('10:00'), 'Bill created', from, 'blue'), lg(at('11:00'), 'Submitted for approval', `Approver: ${b.approver}`, 'blue'), lg(`${addDays(b.date, 1)} 15:00`, 'Rejected', rejectNote, 'red', b.approver ?? APPROVER)];
    b.log = [...head, ...b.log];
    bills.push(b);
    if (b.approval === 'Approved') pending.push({ date: b.date, type: 'Purchases', refType: 'Bill', refId: b.id, refNumber: b.number, narration: `Bill ${b.number}, ${b.supplierName}`, lines: purchaseJournal(b), set: (j) => { b.journalId = j; } });
    return b;
  };

  /* -------- supplier payment: one entry can settle several bills of the same supplier */
  const payBills = (bs: Bill[], o: { date: string; share?: number; method?: Meth; st?: PState; chequeDate?: string; note?: string }): PaymentEntry | undefined => {
    const allocs = bs.map((b) => ({ b, amt: round2(Math.min(round2(totalsOf(b).total * (o.share ?? 1)), round2(totalsOf(b).total - b.amountPaid))) })).filter((x) => x.amt > 0);
    if (!allocs.length) return undefined;
    const amount = round2(allocs.reduce((s, x) => s + x.amt, 0));
    const first = bs[0];
    const date = bs.reduce((d, b) => maxDate(d, b.date), o.date);
    const st = o.st ?? 'Approved';
    const method = o.method ?? 'Bank';
    const h = hash(first.id + date);
    const chequeNo = String(200000 + (h % 799999));
    const l5 = last5(first.number);
    const t = tok('PAY', date);
    const how = method === 'Cheque' ? `Cheque ${chequeNo}` : method === 'Cash' ? 'Cash' : 'Bank transfer';
    const p: PaymentEntry = {
      id: t.id, number: t.no, direction: 'Send', date, partyType: 'Supplier', partyId: first.supplierId, partyName: first.supplierName, method, bankAccount: method === 'Cash' ? CASHACC : h % 3 === 0 ? BANK2 : BANK1,
      reference: method === 'Cheque' ? `CHQ-${chequeNo}` : method === 'Cash' ? `PV-${l5}` : `OUT-${l5}`, ...(method === 'Cheque' ? { chequeNo, chequeDate: o.chequeDate ?? date } : {}),
      amount, isAdvance: false, advanceUsed: 0, allocations: allocs.map((x) => ({ docType: 'bill' as const, docId: x.b.id, docNumber: x.b.number, amount: x.amt })), approval: st,
      log: st === 'Approved' ? [lg(`${date} 11:00`, 'Payment made', `${how}, ${allocs.map((x) => x.b.number).join(', ')}`), lg(`${date} 11:30`, 'Approved', undefined, 'green')]
        : st === 'Pending' ? [lg(`${date} 11:00`, 'Payment created', `${method}, AED ${amount}. Pending approval`, 'blue')]
          : [lg(`${date} 11:00`, 'Payment created', `${method}, AED ${amount}. Pending approval`, 'blue'), lg(`${date} 16:00`, 'Rejected', o.note, 'red')],
    };
    payments.push(p);
    if (st === 'Approved') {
      allocs.forEach(({ b, amt }) => {
        const total = totalsOf(b).total;
        b.amountPaid = round2(b.amountPaid + amt);
        b.payStatus = payStatusOf(total - b.amountPaid, total);
        b.log.push(lg(`${date} 11:30`, `Payment ${p.number} applied`, `AED ${amt}`, 'green'));
      });
      pending.push({ date, type: 'Payment', refType: 'Payment', refId: p.id, refNumber: p.number, narration: `Payment ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
    }
    return p;
  };
  const payAdvanceSupplier = (supplierId: string, amount: number, date: string, method: Meth, narration: string) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return;
    const t = tok('PAY', date);
    const p: PaymentEntry = {
      id: t.id, number: t.no, direction: 'Send', date, partyType: 'Supplier', partyId: sup.id, partyName: sup.name, method, bankAccount: method === 'Cash' ? CASHACC : BANK1, reference: method === 'Cash' ? `PV-ADV-${hash(sup.id) % 900}` : `OUT-ADV-${hash(sup.id + date) % 9000}`,
      amount, isAdvance: true, advanceUsed: 0, allocations: [], approval: 'Approved', narration, log: [lg(`${date} 11:00`, 'Advance payment made', narration), lg(`${date} 11:30`, 'Approved', undefined, 'green')],
    };
    payments.push(p);
    pending.push({ date, type: 'Payment', refType: 'Payment', refId: p.id, refNumber: p.number, narration: `Advance ${p.number}, ${p.partyName}`, lines: paymentJournal(p), set: (j) => { p.journalId = j; } });
  };

  /* -------- credit and debit notes: never more than the amount due, Pending ones settle nothing */
  const rateFor = (total: number, vat: number, line: Omit<InvLine, 'rate'>): InvLine => {
    const r0 = round2(total / (1 + vat / 100));
    let best: InvLine | undefined;
    for (let k = 3; k >= -3; k -= 1) {
      const l = { ...line, rate: round2(r0 + k / 100) };
      const t = lineTotal(l);
      if (t === total) return l;
      if (t < total && !best) best = l;
    }
    return best ?? { ...line, rate: r0 };
  };
  const mkNote = (kind: 'Credit' | 'Debit', doc: SalesInvoice | Bill, reason: string, date: string, st: 'Approved' | 'Pending', lines?: [string, number, number][]): NoteDoc | undefined => {
    if (doc.approval !== 'Approved') return undefined;
    const total = totalsOf(doc).total;
    const due = round2(total - doc.amountPaid);
    const first = doc.lines[0];
    const vat = first?.vatPct ?? 5;
    const mk = (item: string, qty: number, rate: number): InvLine => ({ id: lid(), item, desc: item, account: first?.account ?? '410500', qty, unit: 'Lump sum', rate, discountPct: 0, vatPct: vat, activity: first?.activity, costCentre: first?.costCentre ?? doc.costCentre });
    const noteLines: InvLine[] = lines ? lines.map(([item, qty, rate]) => mk(item, qty, rate))
      : [rateFor(due, vat, { id: lid(), item: reason === 'Returned goods' ? 'Goods returned' : 'Invoice raised in error', desc: `Full credit of ${doc.number}`, account: first?.account ?? '410500', qty: 1, unit: 'Lump sum', discountPct: 0, vatPct: vat, activity: first?.activity, costCentre: first?.costCentre ?? doc.costCentre })];
    const nt = totalsOf({ lines: noteLines }).total;
    if (!(nt > 0) || nt > due + 0.005) return undefined;
    const t = tok(kind === 'Credit' ? 'CRN' : 'DBN', date);
    const party = kind === 'Credit' ? (doc as SalesInvoice).partyName : (doc as Bill).supplierName;
    const partyId = kind === 'Credit' ? (doc as SalesInvoice).customerId : (doc as Bill).supplierId;
    const n: NoteDoc = { id: t.id, number: t.no, kind, date, partyId, partyName: party, reason, againstId: doc.id, againstNumber: doc.number, lines: noteLines, approval: st, costCentre: doc.costCentre,
      log: st === 'Approved' ? [lg(`${date} 10:00`, `${kind} note created`, `Against ${doc.number}`), lg(`${date} 12:00`, 'Approved', undefined, 'green')] : [lg(`${date} 10:00`, `${kind} note created`, `Against ${doc.number}. Pending approval`, 'blue')] };
    (kind === 'Credit' ? creditNotes : debitNotes).push(n);
    if (st === 'Approved') {
      if (kind === 'Credit') (doc as SalesInvoice).creditNoteIds.push(n.id); else (doc as Bill).debitNoteIds.push(n.id);
      doc.amountPaid = round2(doc.amountPaid + nt);
      doc.payStatus = payStatusOf(total - doc.amountPaid, total);
      doc.log.push(lg(`${date} 12:00`, `${kind} note ${n.number} settled`, `AED ${nt}`, 'green'));
      pending.push({ date, type: kind === 'Credit' ? 'Credit Note' : 'Debit Note', refType: `${kind} Note`, refId: n.id, refNumber: n.number, narration: `${kind} note ${n.number} against ${n.againstNumber}`, lines: noteJournal(n), set: (j) => { n.journalId = j; } });
    }
    return n;
  };

  const built = new Set<number>();
  const orderOf = (id: string) => orderSeed.find((o) => o.id === id);

  /* -------- invoices raised from job cards (status Invoiced), number kept as the job card carries it */
  jobCardSeed.filter((j) => j.status === 'Invoiced').forEach((jc) => {
    const n = numIn(jc.invoiceRef) ?? numIn(jc.invoiceId);
    if (!n || built.has(n)) return;
    built.add(n);
    const o = orderOf(jc.soId);
    const date = minDate(ASOF, jc.doneOn ?? jc.plannedDate);
    const r = inv({ id: jc.invoiceId ?? `inv-${n}`, number: seriesNo('INV', n), date, ...(o ? headerFromOrder(o) : { partyName: cust(jc.customerId)?.name ?? '-', customerId: jc.customerId }), activity: 'AMC', lines: linesFromJobCard(jc, o),
      narration: `AMC visit ${jc.visitIdx + 1}, job card ${jc.number}`, source: { type: 'Job Card', id: jc.id, number: jc.number, soId: jc.soId } });
    if (jc.paymentStatus === 'Paid') {
      const logged = jc.log.find((l) => /payment received/i.test(l.title))?.when.slice(0, 10);
      collect(r, { date: minDate(ASOF, logged ?? addDays(r.dueDate, -5)) });
    }
  });

  /* -------- invoices named on Sales Order lines (fulfilmentRef INV-26-nnnnn): one invoice per reference, lines sharing it grouped */
  const refs = new Map<string, { o: SalesOrder; ids: string[] }>();
  orderSeed.forEach((o) => o.lines.forEach((l) => {
    const ref = l.fulfilmentRef;
    if (!ref || !/^INV-26-\d{5}$/.test(ref)) return;
    const e = refs.get(ref) ?? { o, ids: [] };
    e.ids.push(l.id);
    refs.set(ref, e);
  }));
  [...refs.entries()].forEach(([ref, { o, ids }], i) => {
    const n = numIn(ref)!;
    if (built.has(n)) return;
    built.add(n);
    const ds = deliverySeed.filter((d) => d.soId === o.id).map((d) => d.date).sort();
    const date = minDate(ASOF, ds[0] ?? o.date);
    const r = inv({ id: `inv-${n}`, number: ref, date, ...headerFromOrder(o), lines: linesFromOrder(o, o.lines.filter((l) => ids.includes(l.id))), source: { type: 'Sales Order', id: o.id, number: o.number, soId: o.id, lineIds: ids } });
    if (i % 4 !== 3) collect(r, { date: minDate(ASOF, addDays(date, 20)) });
  });

  /* -------- invoices for asset disposals that have an outcome invoice reference */
  const disposals = disposalSeed.filter((x) => x.outcome?.invoiceRef);
  const newestDisposal = disposals.reduce((m, d) => (d.outcome!.date > m ? d.outcome!.date : m), '');
  disposals.forEach((d) => {
    const out = d.outcome!;
    const n = numIn(out.invoiceRef);
    if (!n || built.has(n)) return;
    built.add(n);
    const h = heavySeed.find((x) => x.assetId === d.assetId);
    const buyer = customers.find((c) => c.name === out.buyer);
    const jv = numIn(out.journalRef);
    const r = inv({ id: `inv-${n}`, number: out.invoiceRef!, date: out.date, partyName: out.buyer ?? '-', customerId: buyer?.id, paymentTerms: 'Immediate',
      lines: [{ id: lid(), item: d.method === 'Scrap' ? 'Scrap sale' : 'Sale of fixed asset', desc: `${d.assetId}${h ? ` - ${h.name}` : ''}, disposal ${d.number}`, account: '410700', qty: 1, unit: 'Nos', rate: out.saleValue ?? 0, discountPct: 0, vatPct: 5, activity: 'Fixed Asset Trading', tag: 'asset-sale' }],
      activity: 'Fixed Asset Trading', narration: `Disposal ${d.number} (${d.method})`, source: { type: 'Asset Disposal', id: d.id, number: d.number } });
    const j = pending[pending.length - 1];
    if (jv && j.refId === r.id) j.no = jv;
    if (out.date !== newestDisposal) collect(r, { date: minDate(ASOF, addDays(out.date, 2)) });
  });

  /* -------- rental history: every full period that ended before the demo day (last 14 months only), numbered from 300 upward in date order */
  const rentalBuilt: { o: SalesOrder; r: SalesInvoice }[] = [];
  const drafts: { o: SalesOrder; from: string; to: string; lines: InvLine[] }[] = [];
  for (const o of orderSeed.filter((x) => x.activity === 'Rental')) {
    const prior: SalesInvoice[] = [];
    for (let guard = 0; guard < 24; guard += 1) {
      const p = nextPeriodFor(o, prior);
      if (!p || p.to >= ASOF) break;
      const b = buildRentalLines(o, deliverySeed, prior, p.from, p.to, assetLabelRaw);
      if (!b.lines.length) break;
      const stub = { isRental: true, periodFrom: p.from, periodTo: p.to, lines: b.lines } as SalesInvoice;
      prior.push(stub);
      drafts.push({ o, from: p.from, to: p.to, lines: b.lines });
    }
  }
  const capFrom = dayjs(ASOF).subtract(14, 'month').format('YYYY-MM-DD');
  drafts.filter((d) => addDays(d.to, 1) >= capFrom).sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0)).forEach((d) => {
    const date = addDays(d.to, 1);
    const t = tok('INV', date);
    const r = inv({ id: t.id, number: t.no, date, ...headerFromOrder(d.o), lines: d.lines, isRental: true, periodFrom: d.from, periodTo: d.to,
      narration: 'Rental invoice for the billing period', source: { type: 'Rental Cycle', id: d.o.id, number: d.o.number, soId: d.o.id } });
    rentalBuilt.push({ o: d.o, r });
  });
  // Payment pattern: older invoices paid, the newest per order open; a few overdue and part-paid so every ageing bucket has data.
  const byOrder = new Map<string, SalesInvoice[]>();
  rentalBuilt.forEach(({ o, r }) => byOrder.set(o.id, [...(byOrder.get(o.id) ?? []), r]));
  byOrder.forEach((list, soId) => list.forEach((r, i) => {
    const newest = i === list.length - 1;
    const h = hash(`${soId}:${i}`);
    const method: Meth = h % 4 === 0 ? 'Cheque' : 'Bank';
    if (soId === 'so5' && i === list.length - 2) { collect(r, { date: minDate(ASOF, addDays(r.dueDate, 3)), share: 0.5, method }); return; }
    if ((soId === 'so1' && i === 2) || (soId === 'so3' && i === 1)) return;
    if (newest || r.dueDate > '2026-09-15') return;
    const known = soId === 'so1' || soId === 'so3' || soId === 'so5';
    if (!known && h % 5 === 2) return;
    if (!known && h % 5 === 3) { collect(r, { date: minDate(ASOF, addDays(r.dueDate, 6)), share: 0.6, method }); return; }
    collect(r, { date: minDate(ASOF, addDays(r.dueDate, -4)), method });
  }));

  /* -------- credit note on the newest Sharjah Cement invoice (rate correction) */
  const so5Last = (byOrder.get('so5') ?? []).slice(-1)[0];
  if (so5Last) mkNote('Credit', so5Last, 'Rate correction', minDate(ASOF, addDays(so5Last.date, 4)), 'Approved', [['Standby days not chargeable', 1, 3000]]);

  /* -------- bills from cross-hire orders: one for every order that has a supplier invoice, in a spread of states */
  const CH_STATES = ['paid', 'paid', 'approved', 'overdue', 'paid', 'pending', 'approved', 'rejected', 'draft', 'paid'] as const;
  const chBills = new Map<string, Bill>();
  crossHireSeed.filter((c) => !!c.supplierInvoice).forEach((ch, idx) => {
    const o = orderOf(ch.soId);
    const sup = suppliers.find((s) => s.id === ch.supplierId);
    const date = minDate(ASOF, ch.expectedReceipt ?? ch.date);
    let st: (typeof CH_STATES)[number] = CH_STATES[idx % CH_STATES.length];
    if ((st === 'pending' || st === 'rejected' || st === 'draft') && daysBetween(date, ASOF) > 30) st = 'approved';
    const t = tok('BILL', date);
    const terms = normTerms(ch.paymentTerms) ?? `${sup?.creditPeriod ?? 30} days`;
    const b = bill({
      id: t.id, number: t.no, date, paymentTerms: terms, supplierId: ch.supplierId, supplierName: ch.supplier, supplierInvoiceNo: ch.supplierInvoice ?? '', supplierInvoiceDate: date, orderRef: ch.number,
      lines: [{ id: lid(), item: `Cross-hire ${ch.group} ${ch.category}`, desc: `${ch.number} for ${ch.soNumber}`, account: '510100', qty: ch.qty ?? 1, unit: 'Nos', rate: ch.rate, discountPct: 0, vatPct: 5, activity: 'Rental', costCentre: o?.costCentre, tag: 'cross-hire' }],
      expenses: (ch.expenses ?? []).map((e) => ({ id: lid(), account: expenseAccountFor(e.account), desc: e.note || e.account, amount: e.amount, vatPct: 5, costCentre: o?.costCentre })),
      approval: st === 'pending' ? 'Pending' : st === 'rejected' ? 'Rejected' : st === 'draft' ? 'Draft' : 'Approved', approver: st === 'rejected' ? FM : st === 'pending' || st === 'draft' ? undefined : APPROVER,
      activity: 'Rental', costCentre: o?.costCentre, narration: `Cross-hire order ${ch.number}`, source: { type: 'Cross Hire', id: ch.id, number: ch.number, soId: ch.soId },
    }, 'Supplier invoice amount differs from the cross-hire order, ask the supplier for a corrected invoice');
    chBills.set(ch.id, b);
    if (st === 'paid') payBills([b], { date: minDate(ASOF, maxDate(date, addDays(b.dueDate, -2))) });
  });
  const b5 = chBills.get('ch5');
  if (b5) mkNote('Debit', b5, 'Unit breakdown downtime', minDate(ASOF, addDays(b5.date, 1)), 'Approved', [['Breakdown downtime', 1, 900]]);

  /* -------- bills from completed trips of an external transporter that carry a Transport Charge */
  let tripIdx = 0;
  tripSeed.filter((t) => t.status === 'Completed' && t.transport === 'External Transporter' && t.expenses.some((e) => e.type === 'Transport Charge' && e.amount > 0)).forEach((t) => {
    t.expenses.filter((e) => e.type === 'Transport Charge' && e.amount > 0).forEach((e) => {
      const sup = suppliers.find((s) => s.name === t.transporter);
      const date = minDate(ASOF, (t.since ?? t.date).slice(0, 10));
      const k = tripIdx % 3;
      tripIdx += 1;
      const recent = daysBetween(date, ASOF) <= 21;
      const pendingBill = k === 2 && recent;
      const tk = tok('BILL', date);
      const initials = (t.transporter ?? 'EXT').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
      const b = bill({
        id: tk.id, number: tk.no, date, supplierId: sup?.id, supplierName: t.transporter ?? 'External transporter', supplierInvoiceNo: pendingBill ? '' : `${initials}-${t.number.slice(-4)}`, supplierInvoiceDate: date, orderRef: t.number, costCentre: t.costCentre,
        lines: [{ id: lid(), item: `Transport charge, ${t.kind.toLowerCase()}`, desc: `${t.number} for ${t.docNumber}${e.note ? `, ${e.note}` : ''}`, account: '510300', qty: 1, unit: 'Trip', rate: e.amount, discountPct: 0, vatPct: 5, costCentre: t.costCentre, tag: 'transport' }],
        narration: `Trip ${t.number}`, approval: pendingBill ? 'Pending' : 'Approved', approver: pendingBill ? undefined : APPROVER, source: { type: 'Trip', id: t.id, number: t.number, soId: t.soId },
      });
      if (k === 0 && b.approval === 'Approved') payBills([b], { date: minDate(ASOF, maxDate(date, addDays(b.dueDate, -2))) });
    });
  });

  /* ================================================================ manual sales invoices */
  const C = (id: string) => customers.find((c) => c.id === id);
  const termsOf = (id: string) => { const n = C(id)?.creditTerms ?? 30; return n === 0 ? 'Immediate' : `${n} days`; };
  const atDate = (terms: string, at: At) => (typeof at === 'string' ? at : 'late' in at ? addDays(ASOF, -at.late - termDays(terms)) : addDays(ASOF, at.due - termDays(terms)));
  const branch = (city: string) => ccName(city === 'Dubai' ? 'cc1' : city === 'Sharjah' || city === 'Ras Al Khaimah' ? 'cc10' : city === 'Ajman' ? 'cc13' : 'cc4');
  const supply = (city: string) => (city === 'Al Ain' ? 'Abu Dhabi' : city);
  const keyed = new Map<string, SalesInvoice | Bill>();
  const APPROVAL = { D: 'Draft', P: 'Pending', S: 'Submitted', R: 'Rejected', A: 'Approved' } as const;

  MS_LIST.forEach((s) => {
    const c = C(s.c);
    if (!c) return;
    const terms = s.o?.paymentTerms ?? termsOf(s.c);
    const date = atDate(terms, s.at);
    const exportSale = !!s.o?.vatType?.startsWith('Export');
    const lines: InvLine[] = s.l.flatMap(([key, qty, rate, disc]) => {
      const row = CAT[key];
      if (!row) return [];
      const [item, desc, unit, price, activity, tag, account] = row;
      const cc = activity === 'AMC' ? ccName('cc14') : activity === 'Fuel Trading' ? ccName('cc7') : activity === 'Rental' && c.city === 'Dubai' ? ccName('cc15') : branch(c.city);
      return [{ id: lid(), item, desc, account: account ?? incomeAccountFor(activity), qty, unit, rate: rate ?? price, discountPct: disc ?? 0, vatPct: exportSale ? 0 : 5, activity, costCentre: s.cc ? ccName(s.cc) : cc, tag }];
    });
    const t = tok('INV', date);
    const approval = APPROVAL[s.st];
    const r = inv({
      id: t.id, number: t.no, date, customerId: c.id, partyName: c.name, paymentTerms: terms, salesperson: c.salesperson, contactPerson: c.contact, billingAddress: `${c.name}, ${c.city}, UAE`, shippingAddress: `${c.city}, UAE`, placeOfSupply: supply(c.city),
      location: 'Jebel Ali Main Yard', department: 'Sales', activity: s.l[0] ? CAT[s.l[0][0]]?.[4] : undefined, costCentre: lines[0]?.costCentre, narration: s.st !== 'R' && s.note ? s.note : lines.map((l) => l.item).join(', '), lines, source: MAN, approval,
      approver: approval === 'Submitted' || approval === 'Rejected' ? s.by ?? APPROVER : approval === 'Approved' ? APPROVER : undefined, ...s.o,
    }, s.note);
    if (s.warn) r.log.push(lg(`${date} 10:05`, 'Credit limit exceeded (warning only)', `${c.name}: open receivables plus this invoice exceed the credit limit of AED ${c.creditLimit.toLocaleString('en-US')}`, 'amber'));
    if (s.key) keyed.set(s.key, r);
    collectSpec(r, s.pay);
  });

  /* -------- advances received: unapplied, against an order, partly or fully applied, Pending and Rejected */
  const so4 = orderOf('so4');
  if (so4) advance(so4.customerId, cust(so4.customerId)?.name ?? '-', 20000, '2026-09-18', { so: so4, ref: 'TT-PMD-77101', narration: `Mobilisation advance as per ${so4.lpo}` });
  const soB = orderSeed.find((o) => o.status === 'Confirmed' && o.activity === 'Rental' && o.id !== 'so4');
  if (soB) advance(soB.customerId, cust(soB.customerId)?.name ?? '-', 40000, '2026-09-22', { so: soB, method: 'Cheque', narration: `Advance against ${soB.number}, LPO ${soB.lpo}` });
  advance('c3', C('c3')?.name ?? '-', 15000, '2026-09-10', { narration: 'Advance for the winter festival generator hire' });
  advance('c23', C('c23')?.name ?? '-', 25000, '2026-09-24', { method: 'Cash', narration: 'Cash advance for the festival generators' });
  advance('c22', C('c22')?.name ?? '-', 5000, '2026-09-27', { narration: 'Deposit for the private event hire' });
  const advC11 = advance('c11', C('c11')?.name ?? '-', 50000, '2026-08-10', { narration: 'Advance for the hotel standby generators' });
  const advC20 = advance('c20', C('c20')?.name ?? '-', 12000, '2026-08-25', { narration: 'Advance for the POD purchase' });
  advance('c25', C('c25')?.name ?? '-', 20000, '2026-09-29', { st: 'Pending', narration: 'Advance for the farm irrigation power supply' });
  advance('c18', C('c18')?.name ?? '-', 10000, '2026-09-15', { st: 'Rejected', method: 'Cheque', note: 'Cheque returned by the bank, account closed', narration: 'Advance for the hospital standby unit' });
  const a11 = keyed.get('a11adv') as SalesInvoice | undefined;
  if (a11) applyAdvance(a11, advC11, 30000, '2026-08-20');
  const a20 = keyed.get('a20adv') as SalesInvoice | undefined;
  if (a20) applyAdvance(a20, advC20, 12000, '2026-09-04');

  /* -------- credit notes on the manual invoices */
  CN_LIST.forEach((n) => { const d = keyed.get(n.key) as SalesInvoice | undefined; if (d) mkNote('Credit', d, n.reason, minDate(ASOF, addDays(d.date, n.days)), n.st, n.l); });

  /* ================================================================ manual supplier bills */
  const SUPPLIER_TERMS = (id: string) => { const sup = suppliers.find((x) => x.id === id); return `${sup?.creditPeriod || 30} days`; };
  const groups = new Map<string, { bs: Bill[]; ps?: PS; date: string }>();
  BS_LIST.forEach((s) => {
    const sup = suppliers.find((x) => x.id === s.s);
    if (!sup) return;
    const terms = SUPPLIER_TERMS(s.s);
    const date = atDate(terms, s.at);
    const cc = ccName(s.cc);
    const lines: InvLine[] = s.l.flatMap(([key, qty, rate]) => {
      const row = BC[key];
      if (!row) return [];
      const [item, desc, unit, price, account, tag] = row;
      return [{ id: lid(), item, desc, account, qty, unit, rate: rate ?? price, discountPct: 0, vatPct: 5, activity: s.act, costCentre: cc, tag }];
    });
    const t = tok('BILL', date);
    const approval = APPROVAL[s.st];
    const abbr = sup.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    const b = bill({
      id: t.id, number: t.no, date, supplierId: sup.id, supplierName: sup.name, supplierInvoiceNo: s.no ?? `${abbr}-${2200 + (hash(s.s + date) % 7800)}`, supplierInvoiceDate: addDays(date, -(hash(date) % 3)), paymentTerms: terms, activity: s.act, costCentre: cc, lines,
      expenses: (s.ex ?? []).map(([account, desc, amount]) => ({ id: lid(), account, desc, amount, vatPct: 5, costCentre: cc })), narration: s.note && approval !== 'Rejected' ? s.note : lines.map((l) => l.item).join(', '), source: MAN, approval,
      approver: approval === 'Submitted' || approval === 'Rejected' ? s.by ?? APPROVER : approval === 'Approved' ? APPROVER : undefined, ...s.o,
    }, s.note);
    if (s.key) keyed.set(s.key, b);
    if (s.pay && s.grp) {
      const g = groups.get(s.grp) ?? { bs: [], ps: s.pay[0], date: '' };
      g.bs.push(b);
      g.date = maxDate(g.date, payDate(b.date, s.pay[0][1]));
      groups.set(s.grp, g);
    } else {
      (s.pay ?? []).forEach(([share, d, method, st, x]) => payBills([b], { date: payDate(b.date, d), share, method, st, chequeDate: x?.cd, note: x?.n }));
    }
  });
  groups.forEach((g) => { if (g.ps) payBills(g.bs, { date: g.date, share: g.ps[0], method: g.ps[2], st: g.ps[3] }); });
  payAdvanceSupplier('s22', 164000, '2026-09-05', 'Bank', 'Advance for the 2 x 500 KVA generators, purchase order ATL-26-118');
  payAdvanceSupplier('s20', 5000, '2026-09-20', 'Cash', 'Advance for crane mobilisation');
  DN_LIST.forEach((n) => { const d = keyed.get(n.key) as Bill | undefined; if (d) mkNote('Debit', d, n.reason, minDate(ASOF, addDays(d.date, n.days)), n.st, n.l); });

  /* ================================================================ numbering */
  const nums = new Map<string, number>();
  const sortReg = (kind: Kind) => [...reg[kind]].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.k - b.k));
  const assign = (kind: Kind, start: number, skip = new Set<number>()) => {
    let n = start;
    sortReg(kind).forEach((e) => { while (skip.has(n)) n += 1; nums.set(`${kind}:${e.k}`, n); n += 1; });
    return n - 1;
  };
  const usedInv = new Set<number>([...reservedInv, ...built]);
  const lastInv = assign('INV', 300, usedInv);
  const lastBill = assign('BILL', 1);
  const lastPay = assign('PAY', 1);
  const lastCrn = assign('CRN', 1);
  const lastDbn = assign('DBN', 1);
  const resolve = (s: string) => s.replace(/⟦(\w+):(\d+):([nid])⟧/g, (_m, kind: string, k: string, f: string) => {
    const n = nums.get(`${kind}:${k}`)!;
    return f === 'n' ? seriesNo(kind, n) : f === 'i' ? String(n) : String(n).padStart(5, '0');
  });
  const deep = <T,>(v: T): T => (typeof v === 'string' ? resolve(v) as T : Array.isArray(v) ? v.map(deep) as T : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) as T : v);

  /* -------- journals numbered in posting order from 200, skipping numbers other seeds already quote (a disposal invoice takes the journal ref its disposal carries) */
  const fixedJv = new Set<number>(pending.filter((p) => p.no).map((p) => p.no!));
  const skipJv = new Set<number>([...reservedJv, ...fixedJv]);
  let jvN = 200;
  let jvMax = 0;
  const journals: Journal[] = [...pending].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((p) => {
    let n = p.no;
    if (!n) { while (skipJv.has(jvN)) jvN += 1; n = jvN; jvN += 1; }
    jvMax = Math.max(jvMax, n);
    const id = `jv-${n}`;
    p.set?.(id);
    return { id, number: seriesNo('JV', n), postingDate: p.date, journalType: p.type, refType: p.refType, refId: p.refId, refNumber: p.refNumber, status: 'Posted', currency: 'AED', narration: p.narration, createdBy: 'System (on approval)', lines: p.lines };
  });

  /* -------- Previous Jobs: one monthly run per calendar month that has rental history invoices (last 12), a failed line, and one run with nothing to bill */
  const monthRuns = new Map<string, SalesInvoice[]>();
  rentalBuilt.forEach(({ r }) => monthRuns.set(r.date.slice(0, 7), [...(monthRuns.get(r.date.slice(0, 7)) ?? []), r]));
  type RunDraft = Omit<RentalRun, 'id' | 'number'>;
  const runDrafts: RunDraft[] = [...monthRuns.entries()].sort().slice(-12).map(([, list]) => {
    const at = list.map((r) => r.date).sort().pop()!;
    return { runAt: `${at} 06:00`, soIds: [...new Set(list.map((r) => r.soId!))], soNumbers: [...new Set(list.map((r) => r.soNumber!))], invoiceIds: list.map((r) => r.id), status: 'Processed', message: `${list.length} invoice(s) raised`, by: 'System (scheduled run)' };
  });
  const quiet = orderSeed.find((o) => o.activity === 'Rental' && o.invoicingType === 'Automatic') ?? orderSeed.find((o) => o.activity === 'Rental');
  if (quiet) runDrafts.push({ runAt: `${addDays(ASOF, -2)} 06:00`, soIds: [quiet.id], soNumbers: [quiet.number], invoiceIds: [], status: 'Nothing to bill', message: 'Nothing to bill for the selected period', by: 'System (scheduler)', mode: 'Automatic', lines: [] });

  /* -------- one failed job line: the next period of a submitted rental order could not be saved, so it is still waiting (Retry) */
  const failed = orderOf('so2');
  const failedNext = failed ? nextPeriodFor(failed, rentalBuilt.filter((x) => x.o.id === failed.id).map((x) => x.r)) : undefined;
  const err = 'Customer credit approval is pending in Accounting, the invoice could not be saved';
  if (failed && failedNext) {
    runDrafts.push({ runAt: `${ASOF} 07:30`, soIds: [failed.id], soNumbers: [failed.number], invoiceIds: [], status: 'Failed', message: '0 of 1 invoice(s) raised', by: FIN, mode: 'Manual',
      lines: [{ soId: failed.id, soNumber: failed.number, from: failedNext.from, to: failedNext.to, kind: 'recurring', status: 'failed', error: err }] });
  }
  const runs: RentalRun[] = runDrafts.sort((a, b) => (a.runAt < b.runAt ? -1 : a.runAt > b.runAt ? 1 : 0)).map((d, i) => ({ ...d, id: `run-${i + 1}`, number: seriesNo('RUN', i + 1) }));
  const failures: Built['failures'] = [];
  const failedRun = runs.find((r) => r.status === 'Failed');
  if (failed && failedNext && failedRun) failures.push({ id: `${failed.id}|${failedNext.from}`, soId: failed.id, from: failedNext.from, to: failedNext.to, error: err, jobId: failedRun.id });

  /* -------- SEED_MAX: the true maxima, so runtime numbers continue after the seeds */
  SEED_MAX.INV = Math.max(lastInv, ...usedInv, 0);
  SEED_MAX.BILL = lastBill;
  SEED_MAX.PAY = lastPay;
  SEED_MAX.CRN = lastCrn;
  SEED_MAX.DBN = lastDbn;
  SEED_MAX.JV = Math.max(jvMax, ...reservedJv);
  SEED_MAX.RUN = runs.length;

  const byDateDesc = <T extends { number: string }>(key: (x: T) => string) => (a: T, b: T) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : a.number < b.number ? 1 : -1);
  return {
    invoices: deep(invoices).sort(byDateDesc((x) => x.date)), bills: deep(bills).sort(byDateDesc((x) => x.date)), payments: deep(payments).sort(byDateDesc((x) => x.date)),
    creditNotes: deep(creditNotes).sort(byDateDesc((x) => x.date)), debitNotes: deep(debitNotes).sort(byDateDesc((x) => x.date)), journals: deep(journals).sort(byDateDesc((x) => x.postingDate)),
    rentalRuns: deep(runs).sort((a, b) => (a.runAt < b.runAt ? 1 : -1)), failures,
  };
}

let seeded = false;
/** Seeds every accounting collection once (first caller wins). */
export function seedAccounting() {
  if (seeded) return;
  seeded = true;
  const b = buildAccountingSeed();
  seedCollection(COLA.invoices, b.invoices); seedCollection(COLA.bills, b.bills); seedCollection(COLA.payments, b.payments);
  seedCollection(COLA.creditNotes, b.creditNotes); seedCollection(COLA.debitNotes, b.debitNotes); seedCollection(COLA.journals, b.journals); seedCollection(COLA.rentalRuns, b.rentalRuns); seedCollection(COLA.schedFail, b.failures);
}
/** Numbers are drawn at call time (data.ts): make sure the seed has run, and raised SEED_MAX, before the first runtime document takes a number. */
seedRunner.run = seedAccounting;
export { vatPctOf };
