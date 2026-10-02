import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Text } from '@/components/Text';
import { ChangeTag } from '@/components/ChangeTag';
import { useCollection } from '@/store/store';

/**
 * Minimal UI-level permission for the Inventory POC (2 Oct call: users with edit permission can edit, others can only view).
 * The POC has no login or role system, so one switch decides the reviewer's access; every screen asks useCanEdit() instead of
 * repeating its own check. In the live system this reads the user's role permissions.
 */
export type Access = 'Can edit' | 'View only';
interface AccessRec { id: 'access'; access: Access }
const seed: AccessRec[] = [{ id: 'access', access: 'Can edit' }];
const useAccessRec = () => useCollection<AccessRec>('inventory.access', seed);
export const REQ_RBAC = 'Roles & Permissions (2 Oct call: edit permission can edit, others view only; POC switch stands in for the role)';

export function useCanEdit(): boolean {
  return useAccessRec().get('access')?.access !== 'View only';
}

/** The reviewer's access switch, shown where it matters (reports, asset pages). */
export function AccessSwitch() {
  const rec = useAccessRec();
  const access = rec.get('access')?.access ?? 'Can edit';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Text type="s5" color="theme.secondary.800">My access<ChangeTag kind="new" req={REQ_RBAC} /></Text>
      <ToggleButtonGroup size="small" exclusive value={access} onChange={(_, v) => v && rec.update('access', { access: v })}>
        <ToggleButton value="Can edit" sx={{ py: 0.25, px: 1.25, fontSize: 12, textTransform: 'none' }}>Can edit</ToggleButton>
        <ToggleButton value="View only" sx={{ py: 0.25, px: 1.25, fontSize: 12, textTransform: 'none' }}>View only</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
