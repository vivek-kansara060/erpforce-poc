import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { Text } from './Text';
import { ChangeTag } from './ChangeTag';
import { neutral, primaryGreen, olive, red, blue, magenta } from '@/theme/color';
import type { ChangeKind } from '@/types';

/** KPI card (existing DashBoardCard): bordered 8px radius card, small title, big value. */
export function KpiCard({ title, value, sub, tint, change, req, onClick }: { title: string; value: ReactNode; sub?: ReactNode; tint?: string; change?: ChangeKind; req?: string; onClick?: () => void }) {
  return (
    <Box onClick={onClick} sx={{ p: 2, border: `1px solid ${neutral[200]}`, borderRadius: '8px', bgcolor: tint ?? '#fff', flex: '1 1 180px', minWidth: 170, cursor: onClick ? 'pointer' : 'default' }}>
      <Text type="s5" color="theme.secondary.800">{title}<ChangeTag kind={change} req={req} /></Text>
      <Text type="h2" weight="bold" sx={{ mt: 0.5 }} component="div">{value}</Text>
      {sub && <Text type="s5" color="theme.secondary.700" component="div">{sub}</Text>}
    </Box>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>{children}</Box>;
}

/** Bordered panel with title (existing .box-class). */
export function Panel({ title, children, right, change, req, sx }: { title?: string; children: ReactNode; right?: ReactNode; change?: ChangeKind; req?: string; sx?: object }) {
  return (
    <Box sx={{ p: 2, border: `1px solid ${neutral[200]}`, borderRadius: '8px', bgcolor: '#fff', ...sx }}>
      {(title || right) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Text type="s3" weight="medium">{title}<ChangeTag kind={change} req={req} /></Text>{right}
        </Box>
      )}
      {children}
    </Box>
  );
}

export const CHART_COLORS = [primaryGreen[800], blue[800], olive[700], magenta[800], red[700], neutral[600], primaryGreen[400], blue[500]];

/** Horizontal/vertical bar chart drawn with plain divs (no chart library). */
export function BarChart({ data, height = 160, color = primaryGreen[800], format = (n: number) => String(n) }: { data: { label: string; value: number; color?: string }[]; height?: number; color?: string; format?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height, pt: 2 }}>
      {data.map((d, i) => (
        <Box key={d.label + i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
          <Text type="s5" weight="medium" color="theme.secondary.800">{format(d.value)}</Text>
          <Box sx={{ width: '100%', maxWidth: 44, height: `${(d.value / max) * (height - 46)}px`, minHeight: 2, bgcolor: d.color ?? color, borderRadius: '3px 3px 0 0' }} />
          <Text type="s5" color="theme.secondary.700" sx={{ mt: 0.5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{d.label}</Text>
        </Box>
      ))}
    </Box>
  );
}

/** Donut chart (SVG) with legend. */
export function DonutChart({ data, size = 140, centerLabel }: { data: { label: string; value: number; color?: string }[]; size?: number; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={neutral[200]} strokeWidth={14} />
          {data.map((d, i) => {
            const len = (d.value / total) * c;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={14} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="h3" weight="bold">{total}</Text>
          {centerLabel && <Text type="s5" color="theme.secondary.700">{centerLabel}</Text>}
        </Box>
      </Box>
      <Box>
        {data.map((d, i) => (
          <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
            <Text type="s5">{d.label}: <b>{d.value}</b></Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Simple progress bar (percentage). */
export function Progress({ value, color = primaryGreen[800] }: { value: number; color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: neutral[200], overflow: 'hidden', minWidth: 60 }}><Box sx={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', bgcolor: color }} /></Box>
      <Text type="s5" color="theme.secondary.800">{Math.round(value)}%</Text>
    </Box>
  );
}

/**
 * Tab strip + panels helper: <TabPanels tabs={[{label, content, change}]} />
 * Every tab stays mounted (8 Oct call, global error panel) so a field error on another tab is found; the inactive ones are hidden.
 * A tab whose panel holds fields in error shows a red count, and the error panel can switch to it (erp:reveal-field).
 */
export function TabPanels({ tabs, initial = 0 }: { tabs: { label: string; content: ReactNode; change?: ChangeKind; req?: string; hidden?: boolean }[]; initial?: number }) {
  const [v, setV] = useState(initial);
  const [counts, setCounts] = useState<number[]>([]);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const list = tabs.filter((t) => !t.hidden);
  const idx = Math.min(v, list.length - 1);
  useEffect(() => {
    const count = () => {
      const next = list.map((_, i) => refs.current[i]?.querySelectorAll('[data-field-error]').length ?? 0);
      setCounts((prev) => (prev.length === next.length && prev.every((n, i) => n === next[i]) ? prev : next));
    };
    const reveal = (e: Event) => {
      const el = (e as CustomEvent<Element>).detail;
      const at = refs.current.findIndex((p) => p?.contains(el));
      if (at >= 0) setV(at);
    };
    window.addEventListener('erp:errors-changed', count);
    window.addEventListener('erp:reveal-field', reveal);
    count();
    return () => { window.removeEventListener('erp:errors-changed', count); window.removeEventListener('erp:reveal-field', reveal); };
  }, [list.length]);
  return (
    <Box>
      <Tabs value={idx} onChange={(_, n) => setV(n)} variant="scrollable" scrollButtons="auto">
        {list.map((t, i) => (
          <Tab key={t.label} value={i} label={<span>{t.label}<ChangeTag kind={t.change} req={t.req} />{!!counts[i] && <Box component="span" sx={{ ml: 0.75, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, px: 0.5, borderRadius: '8px', bgcolor: '#C64D4D', color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1 }}>{counts[i]}</Box>}</span>} />
        ))}
      </Tabs>
      {list.map((t, i) => <Box key={t.label} ref={(el: HTMLDivElement | null) => { refs.current[i] = el; }} data-tab-panel={i} sx={{ pt: 2.5, display: i === idx ? 'block' : 'none' }}>{t.content}</Box>)}
    </Box>
  );
}
