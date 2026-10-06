import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { FormHeader, PageTitle, Page } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { ValueField, ValueGrid } from '@/components/Form';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { disposalSeed, type DisposalRec } from '@/modules/inventory/data';
import type { ModuleDef } from '@/types';

/** Accounting is standard and not designed in this POC (5 Oct call). This page only receives the redirect from a disposal so the invoice can be reviewed there. */
function InvoicePage() {
  const { ref } = useParams();
  const nav = useNavigate();
  const rows = useCollection<DisposalRec>('inventory.disposals', disposalSeed);
  const d = rows.rows.find((x) => x.outcome?.invoiceRef === ref);
  const o = d?.outcome;
  return (
    <>
      <FormHeader crumbs={[{ label: 'Invoices' }, { label: ref ?? '-' }]} status={<StatusChip status="Draft" />} actions={d ? <Button variant="outlined" onClick={() => nav(`/inventory/disposals/${d.id}`)}>Back to Disposal Request</Button> : undefined} />
      <Page sx={{ pt: 2 }}>
        {!d || !o ? <PageTitle title="Invoice not found" /> : (
          <>
            <PageTitle title={`Invoice ${o.invoiceRef}`} subtitle="Opened from a disposal request. The standard Accounting invoice screen applies here; fields can be added when Accounting is designed." />
            <ValueGrid cols={4}>
              <ValueField label="Invoice Number" value={o.invoiceRef} /><ValueField label="Invoice Date" value={o.date} /><ValueField label="Invoice To" value={o.buyer} /><ValueField label="Amount" value={`AED ${o.saleValue?.toLocaleString('en-US')}`} />
              <ValueField label="Source" value={`${d.number} (${d.method} of ${d.assetId})`} /><ValueField label="Journal" value={o.journalRef} /><ValueField label="Net Book Value at Disposal" value={`AED ${o.nbvAtDisposal.toLocaleString('en-US')}`} />
            </ValueGrid>
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 2 }}>Reference record only in this POC.</Text>
          </>
        )}
      </Page>
    </>
  );
}

const mod: ModuleDef = {
  id: 'accounting',
  label: 'Accounting & Finance',
  basePath: '/accounting',
  icon: <AccountBalanceOutlinedIcon />,
  tileBg: 'rgba(102,215,113,.10)',
  menu: [{ label: 'Dashboard', path: '/accounting', icon: <AccountBalanceOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="Accounting & Finance" /></Page> }, { path: 'invoices/:ref', element: <InvoicePage /> }],
  changes: [],
};
export default mod;
