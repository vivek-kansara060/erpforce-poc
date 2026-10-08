/**
 * Procurement POC: a minimal Purchase Order with an approval workflow and a Create GRN action (client feedback items, 8 Oct).
 * Out of scope for this POC: Supplier Master, RFQ, Landed Cost, VRA. Suppliers are read from the shared masters.
 */
import { nextNumber } from '@/store/store';
import { ACTOR, TODAY, log, type LogItem } from '@/modules/crm/data';

export { TODAY, ACTOR, log };
export type { LogItem };

/* ------------------------------------------------------------------ statuses */
export type ApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
export const APPROVAL_STATUSES: ApprovalStatus[] = ['Draft', 'Pending', 'Approved', 'Rejected'];
/** Same list governs whether a PO can be edited or deleted: one workflow setting covers create, edit and delete alike. */
export const EDITABLE: ApprovalStatus[] = ['Draft', 'Pending', 'Rejected'];

export type ReceiptStatus = 'Not Received' | 'Received';

export interface POLine { id: string; item: string; desc: string; qty: number; unit: string; rate: number }
export const lineAmount = (l: Pick<POLine, 'qty' | 'rate'>) => Math.round(l.qty * l.rate * 100) / 100;
export const poTotal = (p: { lines: POLine[] }) => p.lines.reduce((s, l) => s + lineAmount(l), 0);

export interface PurchaseOrder {
  id: string; number: string; date: string; expectedDate: string;
  supplierId?: string; supplierName: string; paymentTerms: string; currency: string; costCentre?: string; narration?: string;
  lines: POLine[];
  approval: ApprovalStatus; approver?: string;
  receiptStatus: ReceiptStatus; receivedDate?: string;
  log: LogItem[];
}

/** Procurement settings: one switch for the whole PO approval workflow (not a per-action rule engine). */
export interface ProcurementSettings { id: 'default'; approvalRequired: boolean }

export const COLP = { orders: 'procurement.purchaseOrders', settings: 'procurement.settings' } as const;
export const SEED_MAX = { PO: 5 };
export const nextPONo = () => nextNumber('PO', SEED_MAX.PO);
export const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Requirement reference shown on NEW badges and the Change Register. */
export const R_PROC = 'Procurement > Purchase Order, approval workflow and GRN (client feedback, 8 Oct)';
