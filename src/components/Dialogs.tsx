import { useState, type ReactNode } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Drawer } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useSnackbar } from 'notistack';
import { Text } from './Text';

/** Modal in the existing ERP style: sticky light title bar, grey action bar. */
export function AppDialog({ open, title, onClose, children, actions, maxWidth = 'sm', confirmLabel, onConfirm, confirmDisabled, confirmColor }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  confirmLabel?: string; onConfirm?: () => void; confirmDisabled?: boolean; confirmColor?: 'primary' | 'error';
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}>{children}</DialogContent>
      <DialogActions>
        {actions}
        <Button variant="text" onClick={onClose}>Cancel</Button>
        {onConfirm && <Button variant="contained" color={confirmColor ?? 'primary'} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel ?? 'Save'}</Button>}
      </DialogActions>
    </Dialog>
  );
}

/** ConfirmPopUp equivalent (alert / info icon, red confirm for destructive). */
export function ConfirmDialog({ open, title, description, onClose, onConfirm, confirmLabel = 'Confirm', danger, info }: {
  open: boolean; title: string; description: ReactNode; onClose: () => void; onConfirm: () => void; confirmLabel?: string; danger?: boolean; info?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
        {info ? <InfoOutlinedIcon sx={{ color: '#3E8193' }} /> : <WarningAmberIcon sx={{ color: danger ? '#C64D4D' : '#A6914D' }} />}
        <Text type="s3" weight="medium" sx={{ flex: 1 }}>{title}</Text>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ px: 2.75, pb: 2.5, borderTop: '1px solid #EEEFF1', pt: 2 }}><Text type="s3" component="div">{description}</Text></Box>
      <DialogActions>
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Right side drawer for detail peeks. */
export function SideDrawer({ open, title, onClose, children, width = 520, actions }: { open: boolean; title: string; onClose: () => void; children: ReactNode; width?: number; actions?: ReactNode }) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width, maxWidth: '100vw' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, bgcolor: '#FBFBFB', borderBottom: '1px solid #EEEFF1' }}>
        <Text type="s2" weight="medium">{title}</Text>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>{children}</Box>
      {actions && <Box sx={{ p: 1.5, px: 3, bgcolor: '#EEEFF1', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>{actions}</Box>}
    </Drawer>
  );
}

/** Split "Create v" style dropdown button used on view pages. */
export function MenuButton({ label, items, variant = 'outlined', startIcon }: { label: string; items: { label: string; onClick: () => void; disabled?: boolean }[]; variant?: 'outlined' | 'contained' | 'text'; startIcon?: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button variant={variant} startIcon={startIcon} endIcon={<ArrowDropDownIcon />} onClick={(e) => setEl(e.currentTarget)}>{label}</Button>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        {items.map((i) => <MenuItem key={i.label} disabled={i.disabled} onClick={() => { setEl(null); i.onClick(); }}>{i.label}</MenuItem>)}
      </Menu>
    </>
  );
}

/** Toast helper wrapping notistack: const toast = useToast(); toast('Saved'). */
export function useToast() {
  const { enqueueSnackbar } = useSnackbar();
  // Error toasts go to the global error panel (8 Oct call): it lists the fields in error, or falls back to a toast when none are shown.
  return (msg: string, variant: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    if (variant === 'error') window.dispatchEvent(new CustomEvent('erp:form-error', { detail: msg }));
    else enqueueSnackbar(msg, { variant });
  };
}
