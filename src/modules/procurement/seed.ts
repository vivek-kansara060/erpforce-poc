import { suppliers } from '@/mock-data/masters';
import { seedCollection } from '@/store/store';
import { log, uid, type LogItem, type POLine, type ProcurementSettings, type PurchaseOrder } from './data';
import { COLP } from './data';

const lg = (title: string, detail?: string, tone?: LogItem['tone'], by = 'Farhan Sheikh'): LogItem => ({ when: '2026-09-20 09:00', title, detail, by, tone });
const sup = (id: string) => suppliers.find((s) => s.id === id)!;
const lines = (rows: [string, string, number, string, number][]): POLine[] => rows.map(([item, desc, qty, unit, rate]) => ({ id: uid('pol'), item, desc, qty, unit, rate }));

function buildSeed(): PurchaseOrder[] {
  return [
    {
      id: 'po-1', number: 'PO-26-00001', date: '2026-09-18', expectedDate: '2026-09-28', supplierId: sup('s1').id, supplierName: sup('s1').name, paymentTerms: 'Net 60', currency: 'AED', costCentre: 'cc1',
      narration: 'Spare engine for the 500 KVA fleet', lines: lines([['Spare Engine (Cummins QSX15)', 'For scheduled overhaul', 1, 'Nos', 68000]]),
      approval: 'Draft', receiptStatus: 'Not Received', log: [lg('Saved as draft', 'Awaiting final pricing from the supplier')],
    },
    {
      id: 'po-2', number: 'PO-26-00002', date: '2026-09-20', expectedDate: '2026-09-30', supplierId: sup('s3').id, supplierName: sup('s3').name, paymentTerms: 'Net 30', currency: 'AED', costCentre: 'cc6',
      narration: 'Quarterly spare parts replenishment', lines: lines([['Oil Filter (Cummins C-Series)', 'Reorder, yard stock low', 60, 'Nos', 85], ['Air Filter (Perkins 2506)', 'Reorder, yard stock low', 40, 'Nos', 110]]),
      approval: 'Pending', log: [lg('Purchase Order created', 'Submitted for approval'), lg('Submitted for approval', 'Approver: Nasser Al Ketbi', 'blue')],
      receiptStatus: 'Not Received',
    },
    {
      id: 'po-3', number: 'PO-26-00003', date: '2026-09-15', expectedDate: '2026-09-25', supplierId: sup('s2').id, supplierName: sup('s2').name, paymentTerms: 'Net 45', currency: 'AED', costCentre: 'cc4',
      narration: 'Replacement battery bank', lines: lines([['Battery 12V 200Ah', 'Replacement set, Abu Dhabi yard', 12, 'Nos', 640]]),
      approval: 'Approved', approver: 'Nasser Al Ketbi', receiptStatus: 'Not Received',
      log: [lg('Purchase Order created', 'Submitted for approval'), lg('Submitted for approval', 'Approver: Nasser Al Ketbi', 'blue'), lg('Approved', undefined, 'green')],
    },
    {
      id: 'po-4', number: 'PO-26-00004', date: '2026-09-05', expectedDate: '2026-09-12', supplierId: sup('s4').id, supplierName: sup('s4').name, paymentTerms: 'Net 15', currency: 'AED', costCentre: 'cc7',
      narration: 'Bulk diesel top-up', lines: lines([['Diesel (Bulk)', 'Fuel trading stock top-up', 15000, 'Litre', 2.85]]),
      approval: 'Approved', approver: 'Nasser Al Ketbi', receiptStatus: 'Received', receivedDate: '2026-09-13',
      log: [lg('Purchase Order created', 'Submitted for approval'), lg('Approved', undefined, 'green'), lg('GRN created', 'Goods received and closed', 'green')],
    },
    {
      id: 'po-5', number: 'PO-26-00005', date: '2026-09-22', expectedDate: '2026-10-02', supplierId: sup('s7').id, supplierName: sup('s7').name, paymentTerms: 'Net 45', currency: 'AED', costCentre: 'cc1',
      narration: 'ATS panel for standby changeover', lines: lines([['ATS Panel 630A', 'Rejected: budget not approved this quarter', 1, 'Nos', 61000]]),
      approval: 'Rejected', receiptStatus: 'Not Received',
      log: [lg('Purchase Order created', 'Submitted for approval'), lg('Rejected', 'Budget not approved this quarter', 'red')],
    },
  ];
}

let seeded = false;
/** Seeds Purchase Orders and the Procurement Settings record once (first caller wins). */
export function seedProcurement() {
  if (seeded) return;
  seeded = true;
  seedCollection(COLP.orders, buildSeed());
  seedCollection<ProcurementSettings>(COLP.settings, [{ id: 'default', approvalRequired: true }]);
}
