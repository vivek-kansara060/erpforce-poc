import { Alert } from '@mui/material';
import { Page, PageTitle } from '@/components/PageHeader';
import { useToast } from '@/components/Dialogs';
import { CheckInput } from '@/components/Form';
import { Text } from '@/components/Text';
import { R_PROC } from './data';
import { setApprovalRequired } from './engine';
import { useProcSettings } from './shared';

/**
 * One switch, not a rule engine: the same approval workflow applies uniformly to creating, editing and deleting a
 * Purchase Order, and to whether it can proceed to GRN. There is no separate toggle per action.
 */
export function ProcurementSettingsPage() {
  const toast = useToast();
  const s = useProcSettings();
  const settings = s.rows[0];
  if (!settings) return null;
  return (
    <Page>
      <PageTitle title="Procurement Settings" change="new" req={R_PROC} />
      <CheckInput
        label="Require an approval workflow for Purchase Orders"
        hint="Same approval workflow applies to create, edit and delete actions on a Purchase Order"
        change="new" req={R_PROC}
        checked={settings.approvalRequired}
        onChange={(v) => { const x = setApprovalRequired(v); toast(x.message, x.ok ? 'success' : 'error'); }}
      />
      {settings.approvalRequired ? (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 640 }}>
          A new Purchase Order is created Pending and needs approval. It cannot proceed to GRN (goods receipt) until it is approved. The same rule blocks editing or deleting an approved Purchase Order.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mt: 2, maxWidth: 640 }}>
          No approval workflow is configured. A new Purchase Order is approved automatically and is not blocked on its way to GRN.
        </Alert>
      )}
      <Text type="s5" color="theme.secondary.700" sx={{ mt: 2, maxWidth: 640 }}>
        Out of scope for this POC: Supplier Master, RFQ, Landed Cost and VRA. Suppliers are read from the shared masters used across the ERP.
      </Text>
    </Page>
  );
}
