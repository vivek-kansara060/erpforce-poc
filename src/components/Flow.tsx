import { useRef, useState, useEffect, type ReactNode } from 'react';
import { Box, Button } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { Text } from './Text';
import { neutral, primaryGreen } from '@/theme/color';

/** Horizontal lifecycle stepper (e.g. Request > Receive > Allocate > Return to Us > Return to Supplier). */
export function LifecycleStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflowX: 'auto', py: 1 }}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, bgcolor: done ? primaryGreen[800] : active ? primaryGreen[200] : neutral[200], color: done ? '#fff' : active ? primaryGreen[1000] : neutral[700], border: active ? `2px solid ${primaryGreen[800]}` : 'none' }}>
                {done ? <CheckIcon sx={{ fontSize: 15 }} /> : i + 1}
              </Box>
              <Text type="s4" weight={active ? 'medium' : 'normal'} color={active || done ? 'theme.secondary.1000' : 'theme.secondary.700'} sx={{ whiteSpace: 'nowrap' }}>{s}</Text>
            </Box>
            {i < steps.length - 1 && <Box sx={{ flex: 1, height: 2, mx: 1.5, minWidth: 16, bgcolor: done ? primaryGreen[800] : neutral[300] }} />}
          </Box>
        );
      })}
    </Box>
  );
}

export interface TimelineItem { when: string; title: string; detail?: ReactNode; by?: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'grey' }
const DOT = { green: primaryGreen[800], amber: '#A6914D', red: '#C64D4D', blue: '#3E8193', grey: neutral[500] };

/** Vertical chronological log (audit trail, movement history, version history, status history). */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <Box sx={{ position: 'relative', pl: 3 }}>
      <Box sx={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, bgcolor: neutral[200] }} />
      {items.map((it, i) => (
        <Box key={i} sx={{ position: 'relative', pb: 2 }}>
          <Box sx={{ position: 'absolute', left: -23, top: 5, width: 12, height: 12, borderRadius: '50%', bgcolor: DOT[it.tone ?? 'grey'], border: '2px solid #fff' }} />
          <Text type="s4" weight="medium">{it.title}</Text>
          {it.detail && <Text type="s5" color="theme.secondary.800" component="div">{it.detail}</Text>}
          <Text type="s5" color="theme.secondary.600">{it.when}{it.by ? ` - ${it.by}` : ''}</Text>
        </Box>
      ))}
    </Box>
  );
}

/** Mock signature capture (canvas). Calls onChange(true) once something is drawn. */
export function SignaturePad({ onChange, height = 120 }: { onChange?: (signed: boolean) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const c = ref.current!;
    c.width = c.offsetWidth;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1F2125';
  }, [height]);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  return (
    <Box>
      <Box sx={{ border: `1px dashed ${neutral[400]}`, borderRadius: '4px', bgcolor: '#fff' }}>
        <canvas ref={ref} style={{ width: '100%', height, touchAction: 'none', display: 'block', cursor: 'crosshair' }}
          onPointerDown={(e) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }}
          onPointerMove={(e) => { if (!drawing.current) return; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }}
          onPointerUp={() => { drawing.current = false; if (!signed) { setSigned(true); onChange?.(true); } }}
          onPointerLeave={() => { drawing.current = false; }} />
      </Box>
      <Button size="small" variant="text" onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false); onChange?.(false); }}>Clear</Button>
    </Box>
  );
}
