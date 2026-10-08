/**
 * Procurement engine: every Purchase Order is created and changed here. One setting (Procurement Settings > Approval Workflow Required) decides
 * whether a PO needs approval before it can proceed to GRN; the same setting gates create, edit and delete alike (EDITABLE below), so there is a
 * single workflow, not three separate ones.
 */
import { getCollection, setCollection } from '@/store/store';
import { suppliers } from '@/mock-data/masters';
import { COLP, EDITABLE, TODAY, log, nextPONo, uid, type POLine, type ProcurementSettings, type PurchaseOrder } from './data';
import { seedProcurement } from './seed';

const all = <T,>(name: string): T[] => { seedProcurement(); return getCollection<T>(name); };
const put = <T extends { id: string }>(name: string, row: T) => setCollection(name, [row, ...all<T>(name)]);
const patch = <T extends { id: string }>(name: string, id: string, fn: (r: T) => T) => setCollection(name, all<T>(name).map((r) => (r.id === id ? fn(r) : r)));
export const ok = (message: string) => ({ ok: true as const, message });
export const fail = (message: string) => ({ ok: false as const, message });
export type Result = ReturnType<typeof ok> | ReturnType<typeof fail>;

/* ------------------------------------------------------------------ reads */
export const purchaseOrders = () => all<PurchaseOrder>(COLP.orders);
export const poByRef = (ref?: string) => (ref ? purchaseOrders().find((p) => p.id === ref || p.number === ref) : undefined);
export const procurementSettings = (): ProcurementSettings => all<ProcurementSettings>(COLP.settings)[0] ?? { id: 'default', approvalRequired: true };
export const approvalRequired = () => procurementSettings().approvalRequired;
export function setApprovalRequired(v: boolean): Result {
  patch<ProcurementSettings>(COLP.settings, 'default', (s) => ({ ...s, approvalRequired: v }));
  return ok(`Approval workflow ${v ? 'enabled' : 'disabled'} for Purchase Orders (applies to create, edit and delete)`);
}
/** No workflow configured: the PO is not blocked on the way to GRN, however its approval status reads. */
export const grnAllowed = (p: PurchaseOrder) => !approvalRequired() || p.approval === 'Approved';

/* ------------------------------------------------------------------ create / edit / delete */
export type PoInput = { date: string; expectedDate: string; supplierId?: string; supplierName: string; paymentTerms: string; currency: string; costCentre?: string; narration?: string; lines: POLine[] };
export function createPO(d: PoInput, opts: { draft?: boolean } = {}): PurchaseOrder {
  const needsApproval = approvalRequired();
  const approval = opts.draft ? 'Draft' : needsApproval ? 'Pending' : 'Draft';
  const p: PurchaseOrder = {
    ...d, id: uid('po'), number: nextPONo(), approval, receiptStatus: 'Not Received',
    log: [
      log(opts.draft ? 'Saved as draft' : 'Purchase Order created', opts.draft ? undefined : (needsApproval ? 'Pending approval' : 'No approval workflow configured; GRN is not blocked, and the PO stays editable like any other'), 'blue'),
    ],
  };
  put(COLP.orders, p);
  return p;
}
export function updatePO(id: string, patchData: Partial<PoInput>): Result {
  const p = poByRef(id);
  if (!p || !EDITABLE.includes(p.approval)) return fail('Only a Draft, Pending or Rejected Purchase Order can be edited (the same approval workflow governs edits as creation)');
  patch<PurchaseOrder>(COLP.orders, p.id, (x) => ({ ...x, ...patchData, log: [...x.log, log('Purchase Order edited')] }));
  return ok('Purchase Order updated');
}
export function deletePO(id: string): Result {
  const p = poByRef(id);
  if (!p) return fail('Purchase Order not found');
  if (!EDITABLE.includes(p.approval)) return fail('An approved Purchase Order cannot be deleted (the same approval workflow governs deletes as creation)');
  setCollection(COLP.orders, purchaseOrders().filter((x) => x.id !== p.id));
  return ok(`${p.number} deleted`);
}

/* ------------------------------------------------------------------ approval workflow (reuses the accounting ApprovalButtons widget) */
export function submitPO(id: string, approver: string): Result {
  patch<PurchaseOrder>(COLP.orders, id, (x) => ({ ...x, approval: 'Pending', approver, log: [...x.log, log('Submitted for approval', `Approver: ${approver}`, 'blue')] }));
  return ok(`Submitted to ${approver}`);
}
export function approvePO(id: string, how = 'Approved'): Result {
  const p = poByRef(id);
  if (!p) return fail('Purchase Order not found');
  if (p.approval === 'Approved') return fail('Already approved');
  patch<PurchaseOrder>(COLP.orders, p.id, (x) => ({ ...x, approval: 'Approved', approver: x.approver ?? 'Nasser Al Ketbi', log: [...x.log, log(how, undefined, 'green')] }));
  return ok(`${p.number} approved`);
}
export function rejectPO(id: string, note: string): Result {
  patch<PurchaseOrder>(COLP.orders, id, (x) => ({ ...x, approval: 'Rejected', log: [...x.log, log('Rejected', note, 'red')] }));
  return ok('Purchase Order rejected');
}

/* ------------------------------------------------------------------ GRN (minimal: a status transition, not a separate document) */
export function createGRN(id: string): Result {
  const p = poByRef(id);
  if (!p) return fail('Purchase Order not found');
  if (p.receiptStatus === 'Received') return fail('Already received');
  if (!grnAllowed(p)) return fail(`${p.number} needs approval before goods can be received`);
  patch<PurchaseOrder>(COLP.orders, p.id, (x) => ({ ...x, receiptStatus: 'Received', receivedDate: TODAY, log: [...x.log, log('GRN created', 'Goods received and closed', 'green')] }));
  return ok(`${p.number} marked as received`);
}

export { suppliers };
