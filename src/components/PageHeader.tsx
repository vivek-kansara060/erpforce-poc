import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useNavigate } from 'react-router-dom';
import { Text } from './Text';
import { ChangeTag } from './ChangeTag';
import type { ChangeKind } from '@/types';

export interface Crumb { label: string; to?: string }

/** Meta line under the title: mono brand-coloured id (.est-eb-sub), then plain parts separated by a dot. */
export function HeaderMeta({ id, parts }: { id?: string; parts?: (string | undefined)[] }) {
  return (
    <>
      {id && <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: '#146B43' }}>{id}</Box>}
      {parts?.filter(Boolean).map((x, i) => <span key={i}>{'· ' + x}</span>)}
    </>
  );
}

/**
 * Sticky page/form header (ERPForce DS est-eb-top pattern): back link to the parent crumb, divider,
 * title (last crumb) with optional meta line, then status and actions on the right.
 */
export function FormHeader({ crumbs, actions, status, subtitle }: { crumbs: Crumb[]; actions?: ReactNode; status?: ReactNode; subtitle?: ReactNode }) {
  const nav = useNavigate();
  const title = crumbs[crumbs.length - 1];
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 20, bgcolor: '#fff', px: '20px', py: '10px', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ECEDEF', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {parent && (
          <>
            <Box component="button" type="button" onClick={() => (parent.to ? nav(parent.to) : nav(-1))} aria-label={`Back to ${parent.label}`}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, color: '#6D7178', whiteSpace: 'nowrap', '&:hover': { color: '#3D4046' }, '&:focus-visible': { outline: 'none', boxShadow: '0 0 0 3px rgba(46,178,115,.18)', borderRadius: '4px' } }}>
              <ChevronLeftIcon sx={{ fontSize: 16 }} />{parent.label}
            </Box>
            <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: '#E1E3E6', my: '2px' }} />
          </>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Box aria-current="page" sx={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.011em', lineHeight: 1.25, color: '#15171B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title.label}</Box>
          {subtitle && <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 11, color: '#6D7178', mt: '1px', flexWrap: 'wrap' }}>{subtitle}</Box>}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{status}{actions}</Box>
    </Box>
  );
}

/** List/dashboard page title row (h3 medium title with optional right side content). */
export function PageTitle({ title, subtitle, right, change, req }: { title: string; subtitle?: string; right?: ReactNode; change?: ChangeKind; req?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, gap: 2, flexWrap: 'wrap' }}>
      <Box>
        <Text type="h3" weight="bold">{title}<ChangeTag kind={change} req={req} /></Text>
        {subtitle && <Text type="s4" color="theme.secondary.800" sx={{ mt: 0.25 }}>{subtitle}</Text>}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>{right}</Box>
    </Box>
  );
}

/** Standard padded page container (existing pages use 0 2rem). */
export function Page({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Box sx={{ px: 4, pb: 6, width: '100%', ...sx }}>{children}</Box>;
}
