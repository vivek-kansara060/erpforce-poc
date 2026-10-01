import { createContext, useContext, useState, type ReactNode } from 'react';
import { Box, Tooltip } from '@mui/material';
import type { ChangeKind } from '@/types';

/**
 * Review Mode: when ON, everything that differs from the existing ERP carries a NEW / CHANGED badge with the
 * requirement reference in its tooltip. Turning it OFF shows the proposed ERP exactly as it would be used.
 */
interface ReviewCtx { enabled: boolean; toggle: () => void }
const Ctx = createContext<ReviewCtx>({ enabled: true, toggle: () => {} });
export const useReviewMode = () => useContext(Ctx);

export function ReviewModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  return <Ctx.Provider value={{ enabled, toggle: () => setEnabled((v) => !v) }}>{children}</Ctx.Provider>;
}

const STYLES: Record<ChangeKind, { bg: string; color: string; label: string }> = {
  new: { bg: '#B6E9D6', color: '#1F7C5E', label: 'NEW' },
  changed: { bg: '#F7EAC0', color: '#82691A', label: 'CHANGED' },
};

/** Small inline badge. `req` is the requirement reference shown in the tooltip. */
export function ChangeTag({ kind, req, note }: { kind?: ChangeKind; req?: string; note?: string }) {
  const { enabled } = useReviewMode();
  if (!kind || !enabled) return null;
  const s = STYLES[kind];
  const tip = [note, req ? `Requirement: ${req}` : undefined].filter(Boolean).join(' | ') || (kind === 'new' ? 'New in this requirement' : 'Existing, changed by this requirement');
  return (
    <Tooltip title={tip} arrow>
      <Box
        component="span"
        sx={{ display: 'inline-block', ml: 0.75, px: '5px', py: '0px', borderRadius: '3px', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, lineHeight: '15px', verticalAlign: 'middle', bgcolor: s.bg, color: s.color, cursor: 'help', userSelect: 'none' }}
      >
        {s.label}
      </Box>
    </Tooltip>
  );
}

/** Wraps a block (section, card, column group) with a left accent and a corner badge in Review Mode. */
export function Marked({ kind, req, note, children, sx }: { kind?: ChangeKind; req?: string; note?: string; children: ReactNode; sx?: object }) {
  const { enabled } = useReviewMode();
  if (!kind || !enabled) return <Box sx={sx}>{children}</Box>;
  const s = STYLES[kind];
  return (
    <Box sx={{ position: 'relative', borderLeft: `3px solid ${s.bg}`, pl: 1.5, ...sx }}>
      <Box sx={{ position: 'absolute', top: -2, right: 0 }}>
        <ChangeTag kind={kind} req={req} note={note} />
      </Box>
      {children}
    </Box>
  );
}
