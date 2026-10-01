import type { ReactNode } from 'react';
import { Box, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';
import { Text } from './Text';
import { ChangeTag } from './ChangeTag';
import type { ChangeKind } from '@/types';

export interface Crumb { label: string; to?: string }

/** Sticky page/form header, same pattern as the existing FormHeader (breadcrumb left, actions right). */
export function FormHeader({ crumbs, actions, status }: { crumbs: Crumb[]; actions?: ReactNode; status?: ReactNode }) {
  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 20, bgcolor: '#fff', px: 4, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #f5f6f5', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Breadcrumbs separator={<Text type="s4" color="theme.secondary.600">/</Text>}>
          {crumbs.map((c, i) =>
            c.to && i < crumbs.length - 1 ? (
              <MuiLink key={i} component={Link} to={c.to} underline="hover"><Text type="s4" weight="medium" color="theme.secondary.600">{c.label}</Text></MuiLink>
            ) : (
              <Text key={i} type="s4" weight="medium">{c.label}</Text>
            ),
          )}
        </Breadcrumbs>
        {status}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</Box>
    </Box>
  );
}

/** List/dashboard page title row (h3 medium title with optional right side content). */
export function PageTitle({ title, subtitle, right, change, req }: { title: string; subtitle?: string; right?: ReactNode; change?: ChangeKind; req?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, gap: 2, flexWrap: 'wrap' }}>
      <Box>
        <Text type="h3" weight="medium">{title}<ChangeTag kind={change} req={req} /></Text>
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
