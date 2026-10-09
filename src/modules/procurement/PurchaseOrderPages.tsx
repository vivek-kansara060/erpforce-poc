import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog, MenuButton, useToast } from '@/components/Dialogs';
import { Timeline } from '@/components/Flow';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { costCentres, suppliers } from '@/mock-data/masters';
import { RowsEditor, Section, SpecForm, SpecView, type Spec } from '@/modules/crm/FormKit';
import { ApprovalButtons, DocChips } from '@/modules/accounting/shared';
import { APPROVAL_STATUSES, EDITABLE, R_PROC, TODAY, lineAmount, poTotal, uid, type POLine, type PurchaseOrder } from './data';
import { approvalRequired, approvePO, createGRN, createPO, deletePO, grnAllowed, poByRef, rejectPO, updatePO } from './engine';
import { money, usePOs } from './shared';

export function PurchaseOrderList() {
  const nav = useNavigate();
  const toast = useToast();
  const po = usePOs();
  return (
    <Page>
      <PageTitle title="Purchase Orders" change="new" req={R_PROC} />
      <DataTable<PurchaseOrder> rows={po.rows} searchPlaceholder="Search purchase orders..." filter={{ key: 'approval', options: APPROVAL_STATUSES, label: 'Status' }}
        onAdd={() => nav('/procurement/purchase-orders/add')} addLabel="Add Purchase Order" onRowClick={(r) => nav(`/procurement/purchase-orders/${r.id}`)}
        columns={[
          { key: 'number', label: 'PO Number' }, { key: 'supplierName', label: 'Supplier' }, { key: 'date', label: 'Date' }, { key: 'expectedDate', label: 'Expected Delivery' },
          { key: 'total', label: 'Total', align: 'right', render: (r) => money(poTotal(r)) },
          { key: 'approval', label: 'Approval Status', render: (r) => <DocChips approval={r.approval} /> },
          { key: 'receiptStatus', label: 'Receipt Status', render: (r) => <StatusChip status={r.receiptStatus} tone={r.receiptStatus === 'Received' ? 'green' : 'grey'} /> },
          { key: 'costCentre', label: 'Cost Centre / Project', render: (r) => costCentres.find((c) => c.id === r.costCentre)?.name ?? '-' },
        ]}
        actions={[
          { label: 'View', onClick: (r) => nav(`/procurement/purchase-orders/${r.id}`) },
          { label: 'Edit', hidden: (r) => !EDITABLE.includes(r.approval), onClick: (r) => nav(`/procurement/purchase-orders/${r.id}/edit`) },
          { label: 'Delete', danger: true, hidden: (r) => !EDITABLE.includes(r.approval), onClick: (r) => { const x = deletePO(r.id); toast(x.message, x.ok ? 'success' : 'error'); } },
        ]} />
    </Page>
  );
}

const viewSpecs: Spec[] = [
  { key: 'number', label: 'PO Number' }, { key: 'date', label: 'PO Date' }, { key: 'supplierName', label: 'Supplier' }, { key: 'expectedDate', label: 'Expected Delivery Date' },
  { key: 'paymentTerms', label: 'Payment Terms' }, { key: 'currency', label: 'Currency' }, { key: 'costCentreText', label: 'Cost Centre / Project' }, { key: 'narration', label: 'Narration' },
];

export function PurchaseOrderView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  usePOs();
  const p = poByRef(id);
  const [dlg, setDlg] = useState<'grn' | 'del' | null>(null);
  if (!p) return <Page><PageTitle title="Purchase Order not found" right={<Button variant="outlined" onClick={() => nav('/procurement/purchase-orders')}>Back</Button>} /></Page>;
  const r = (x: { ok: boolean; message: string }) => toast(x.message, x.ok ? 'success' : 'error');
  const canGrn = grnAllowed(p) && p.receiptStatus !== 'Received';
  return (
    <>
      <FormHeader crumbs={[{ label: 'Purchase Orders', to: '/procurement/purchase-orders' }, { label: p.number }]}
        status={<><DocChips approval={p.approval} /><StatusChip status={p.receiptStatus} tone={p.receiptStatus === 'Received' ? 'green' : 'grey'} /></>}
        actions={<>
          {EDITABLE.includes(p.approval) && <Button variant="outlined" onClick={() => nav(`/procurement/purchase-orders/${p.id}/edit`)}>Edit</Button>}
          <ApprovalButtons simple approval={p.approval} onApprove={(how) => r(approvePO(p.id, how))} onReject={(n) => r(rejectPO(p.id, n))} />
          <MenuButton label="Create" items={[{ label: 'GRN (Mark as Received)', disabled: !canGrn, onClick: () => setDlg('grn') }]} />
          <MenuButton label="Actions" items={[{ label: 'Delete', disabled: !EDITABLE.includes(p.approval), onClick: () => setDlg('del') }]} />
        </>} />
      <Page sx={{ pt: 2 }}>
        {!approvalRequired() && <Alert severity="info" sx={{ mb: 2 }}>No approval workflow is configured in Procurement Settings, so this Purchase Order is not blocked on its way to GRN.</Alert>}
        {approvalRequired() && p.approval !== 'Approved' && <Alert severity="warning" sx={{ mb: 2 }}>An approval workflow is configured in Procurement Settings. GRN is not available until this Purchase Order is approved.</Alert>}
        <SpecView cols={4} specs={viewSpecs} f={{ ...p, costCentreText: costCentres.find((c) => c.id === p.costCentre)?.name ?? '-' }} />
        <Section title="Items">
          <DataTable hideToolbar rows={p.lines} emptyText="No items" columns={[
            { key: 'item', label: 'Item' }, { key: 'desc', label: 'Description' }, { key: 'qty', label: 'Quantity', align: 'right' }, { key: 'unit', label: 'UOM' },
            { key: 'rate', label: 'Rate', align: 'right', render: (l) => money(l.rate) }, { key: 'amount', label: 'Amount', align: 'right', render: (l) => money(lineAmount(l)) },
          ]} />
        </Section>
        <Box sx={{ ml: 'auto', width: 320, mt: 2, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #D3D3D4', py: 0.5 }}>
          <Text type="s3" weight="medium">Grand Total</Text><Text type="s3" weight="medium">{money(poTotal(p))}</Text>
        </Box>
        {p.receiptStatus === 'Received' && <Text type="s4" color="theme.secondary.800" sx={{ mt: 1.5 }}>Goods received on {p.receivedDate}.</Text>}
        <Text type="s3" weight="medium" sx={{ mt: 3, mb: 1 }}>Activity Log</Text>
        <Timeline items={[...p.log].reverse()} />
      </Page>
      <ConfirmDialog open={dlg === 'grn'} title={`Create GRN for ${p.number}`} info description="This marks the Purchase Order as goods received and closed. A separate GRN document is not raised in this POC." confirmLabel="Create GRN"
        onClose={() => setDlg(null)} onConfirm={() => r(createGRN(p.id))} />
      <ConfirmDialog open={dlg === 'del'} title={`Delete ${p.number}`} description="The Purchase Order is removed. This is only possible before approval (the same approval workflow governs deletes as creation)." confirmLabel="Delete" danger
        onClose={() => setDlg(null)} onConfirm={() => { const x = deletePO(p.id); r(x); setDlg(null); if (x.ok) nav('/procurement/purchase-orders'); }} />
    </>
  );
}

type Row = { item: string; desc: string; qty: any; unit: string; rate: any };

export function PurchaseOrderForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const existing = poByRef(id);
  const [f, setF] = useState<Record<string, any>>(() => existing ? { ...existing } : { date: TODAY, expectedDate: TODAY, paymentTerms: 'Net 30', currency: 'AED' });
  const [rows, setRows] = useState<Row[]>(() => (existing?.lines ?? []).map((l) => ({ item: l.item, desc: l.desc, qty: l.qty, unit: l.unit, rate: l.rate })));
  const [err, setErr] = useState<Record<string, string>>({});
  if (id && !existing) return <Page><PageTitle title="Purchase Order not found" /></Page>;
  if (existing && !EDITABLE.includes(existing.approval)) return <Page><PageTitle title={`${existing.number} is approved and cannot be edited`} subtitle="The same approval workflow that gates creation also gates edits on an approved Purchase Order." right={<Button variant="outlined" onClick={() => nav(`/procurement/purchase-orders/${existing.id}`)}>Back</Button>} /></Page>;
  const set = (k: string, v: any) => setF((x) => { const n = { ...x, [k]: v }; if (k === 'supplierId') { const s = suppliers.find((y) => y.id === v); n.supplierName = s?.name ?? ''; n.paymentTerms = s?.paymentTerms ?? x.paymentTerms; } return n; });
  const lines: POLine[] = rows.filter((r) => r.item.trim()).map((r) => ({ id: uid('pol'), item: r.item, desc: r.desc || r.item, qty: Number(r.qty) || 0, unit: r.unit || 'Nos', rate: Number(r.rate) || 0 }));
  const specs: Spec[] = [
    { key: 'supplierId', label: 'Supplier', type: 'select', required: true, options: suppliers.filter((s) => s.active || s.id === f.supplierId).map((s) => ({ value: s.id, label: s.name })) },
    { key: 'date', label: 'PO Date', type: 'date', required: true }, { key: 'expectedDate', label: 'Expected Delivery Date', type: 'date', required: true },
    { key: 'paymentTerms', label: 'Payment Terms' }, { key: 'currency', label: 'Currency', type: 'select', options: ['AED', 'USD'] },
    { key: 'costCentre', label: 'Cost Centre / Project', type: 'select', options: costCentres.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name })) },
    { key: 'narration', label: 'Narration', type: 'textarea', full: true },
  ];
  const save = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (!f.supplierId && !f.supplierName) e.supplierId = 'Supplier is required';
    setErr(e);
    if (Object.keys(e).length) { toast('Please complete the mandatory fields highlighted on the form', 'error'); return; }
    if (!lines.length) { toast('Add at least one item', 'error'); return; }
    const data = { date: f.date, expectedDate: f.expectedDate, supplierId: f.supplierId, supplierName: f.supplierName, paymentTerms: f.paymentTerms, currency: f.currency, costCentre: f.costCentre || undefined, narration: f.narration || undefined, lines };
    if (existing) { const x = updatePO(existing.id, data); toast(x.message, x.ok ? 'success' : 'error'); nav(`/procurement/purchase-orders/${existing.id}`); return; }
    const p = createPO(data, { draft });
    toast(`${p.number} ${draft ? 'saved as draft' : !approvalRequired() ? 'created (no approval workflow configured; not blocked on its way to GRN)' : 'created, pending approval'}`);
    nav(`/procurement/purchase-orders/${p.id}`);
  };
  return (
    <>
      <FormHeader crumbs={[{ label: 'Purchase Orders', to: '/procurement/purchase-orders' }, { label: existing ? `Edit ${existing.number}` : 'New Purchase Order' }]}
        actions={<><Button variant="outlined" onClick={() => nav(existing ? `/procurement/purchase-orders/${existing.id}` : '/procurement/purchase-orders')}>Discard</Button>{!existing && <Button variant="outlined" onClick={() => save(true)}>Save as Draft</Button>}<Button variant="contained" onClick={() => save(false)}>{existing ? 'Update' : 'Save'}</Button></>} />
      <Page sx={{ pt: 2 }}>
        {!existing && !approvalRequired() && <Alert severity="info" sx={{ mb: 2 }}>No approval workflow is configured in Procurement Settings: this Purchase Order will not be blocked from proceeding to GRN.</Alert>}
        <SpecForm specs={specs} f={f} set={set} err={err} />
        <Section title="Items">
          <RowsEditor<Row> cols={[{ key: 'item', label: 'Item', width: 220 }, { key: 'desc', label: 'Description', width: 220 }, { key: 'qty', label: 'Quantity', width: 90 }, { key: 'unit', label: 'UOM', width: 90 }, { key: 'rate', label: 'Rate', width: 110 }]}
            rows={rows} onChange={setRows} blank={{ item: '', desc: '', qty: 1, unit: 'Nos', rate: 0 }} addLabel="Add Item" empty="No items" />
        </Section>
      </Page>
    </>
  );
}
