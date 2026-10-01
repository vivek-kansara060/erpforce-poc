import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Box } from '@mui/material';
import { Page, FormHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { modules } from '@/modules';
import type { MenuItem } from '@/types';
import changelogSource from '../../CHANGELOG.md?raw';

/* ------------------------------------------------------------------ minimal markdown (the subset CHANGELOG.md uses) */
/** Inline formatting: **bold**, *italic* and `code`. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <Box key={i} component="code" sx={{ px: 0.5, py: 0.1, borderRadius: '4px', bgcolor: '#EEEFF1', fontSize: '0.9em' }}>{part.slice(1, -1)}</Box>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Headings, paragraphs (one line each), bullet lists and rules. No markdown library is available in this POC. */
function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length) { blocks.push(<Box key={`l${blocks.length}`} component="ul" sx={{ my: 1, pl: 3, lineHeight: 1.7, fontSize: 14.5, color: '#1F2125' }}>{list.map((t, i) => <li key={i}>{inline(t)}</li>)}</Box>); list = []; }
  };
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      const level = h[1].length;
      blocks.push(<Box key={`h${blocks.length}`} component={`h${level}` as 'h1'} sx={{ fontSize: level === 1 ? 26 : level === 2 ? 20 : 16, fontWeight: 600, mt: level === 1 ? 0 : 2, mb: 1 }}>{inline(h[2])}</Box>);
    } else if (/^---+$/.test(line)) {
      flushList();
      blocks.push(<Box key={`r${blocks.length}`} component="hr" sx={{ my: 3, border: 0, borderTop: '1px solid #D3D3D4' }} />);
    } else if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      blocks.push(<Box key={`p${blocks.length}`} component="p" sx={{ my: 1, lineHeight: 1.7, fontSize: 14.5, color: '#1F2125' }}>{inline(line.trim())}</Box>);
    }
  }
  flushList();
  return <>{blocks}</>;
}

/* ------------------------------------------------------------------ parse CHANGELOG.md into tagged entries */
export interface Entry { id: string; title: string; when: string; sort: number; wheres: string[][]; type: string; body: string }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "1 Oct, around 12:00 PM" -> sortable number (year is always 2026 in this POC). Undated entries sort last. */
function sortKey(when: string): number {
  const m = /(\d{1,2})\s+([A-Za-z]{3}),\s+(?:around\s+)?(\d{1,2}):(\d{2})\s+(AM|PM)/.exec(when);
  if (!m) return -1;
  const hour = (Number(m[3]) % 12) + (m[5] === 'PM' ? 12 : 0);
  return ((MONTHS.indexOf(m[2].toLowerCase()) * 31 + Number(m[1])) * 24 + hour) * 60 + Number(m[4]);
}

export function parseChangelog(source: string): { intro: string; entries: Entry[] } {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const starts = lines.flatMap((l, i) => (l.startsWith('### ') ? [i] : []));
  const intro = lines.slice(0, starts[0] ?? lines.length).join('\n');
  const entries = starts.map((s, n): Entry => {
    const block = lines.slice(s, starts[n + 1] ?? lines.length);
    const head = /^###\s+(.*?\b(?:AM|PM)):\s+(.*)$/.exec(block[0]);
    const wheres: string[][] = [];
    let type = 'NEW';
    const body: string[] = [];
    for (const l of block.slice(1)) {
      const w = /^\*\*Where:\*\*\s*(.+)$/.exec(l.trim());
      const t = /^\*\*Type:\*\*\s*(.+)$/.exec(l.trim());
      if (w) wheres.push(w[1].split('>').map((x) => x.trim()));
      else if (t) type = t[1].trim().toUpperCase();
      else body.push(l);
    }
    const when = head ? head[1] : '';
    return { id: `e${n}`, title: head ? head[2] : block[0].replace(/^###\s+/, ''), when, sort: sortKey(when), wheres, type, body: body.join('\n').trim() };
  });
  // newest first; entries logged at the same time keep their order in the file
  return { intro, entries: entries.map((e, i) => ({ e, i })).sort((a, b) => b.e.sort - a.e.sort || a.i - b.i).map((x) => x.e) };
}

/* ------------------------------------------------------------------ filters */
const POC_TOOLS = { id: 'poc', label: 'POC Review Tools', basePath: '/change-register', menu: [{ label: 'Change Register', path: '/change-register', children: [{ label: 'Detailed changelog', path: '/change-register/changelog' }] }] as MenuItem[] };
const MODULE_LIST: { id: string; label: string; basePath: string; menu: MenuItem[] }[] = [...modules.map((m) => ({ id: m.id, label: m.label, basePath: m.basePath, menu: m.menu })), POC_TOOLS];
const TYPES = ['NEW', 'EXISTING WITH CHANGE', 'EXISTING', 'REMOVED'];
const typeTone = (t: string) => (t === 'NEW' ? 'green' : t === 'EXISTING WITH CHANGE' ? 'amber' : t === 'REMOVED' ? 'red' : 'grey') as 'green' | 'amber' | 'red' | 'grey';

export interface Filter { mod: string; group: string; item: string; type: string }
export const matches = (e: Entry, f: Filter) =>
  (!f.type || e.type === f.type) &&
  (!f.mod && !f.group && !f.item ? true : e.wheres.some((w) => (!f.mod || w[0] === f.mod) && (!f.group || w[1] === f.group) && (!f.item || w[2] === f.item)));

/** Where an entry's location chip leads: the screen, else the menu group, else the module home. */
function whereLink(w: string[]): string {
  const mod = MODULE_LIST.find((m) => m.label === w[0]);
  const group = mod?.menu.find((g) => g.label === w[1]);
  const item = group?.children?.find((c) => c.label === w[2]);
  return item?.path ?? group?.path ?? group?.children?.[0]?.path ?? mod?.basePath ?? '/';
}

function Pill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <Box onClick={onClick} sx={{ cursor: 'pointer', px: 1.25, py: 0.4, borderRadius: '1.5rem', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', opacity: count === 0 && !active ? 0.55 : 1, bgcolor: active ? '#B6E9D6' : '#EEEFF1', color: active ? '#279769' : '#656669' }}>
      {label} <Box component="span" sx={{ opacity: 0.8 }}>({count})</Box>
    </Box>
  );
}

function FilterRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
      <Box sx={{ width: 96, fontSize: 12, fontWeight: 600, color: '#656669' }}>{title}</Box>
      {children}
    </Box>
  );
}

/** POC-only review aid: the detailed, plain-language changelog (CHANGELOG.md), filterable by module, side menu and change type. */
export function Changelog() {
  const { intro, entries } = useMemo(() => parseChangelog(changelogSource), []);
  const [f, setF] = useState<Filter>({ mod: '', group: '', item: '', type: '' });
  const mod = MODULE_LIST.find((m) => m.label === f.mod);
  const group = mod?.menu.find((g) => g.label === f.group);
  const shown = entries.filter((e) => matches(e, f));
  const n = (over: Partial<Filter>) => entries.filter((e) => matches(e, { ...f, ...over })).length;
  const filtered = !!(f.mod || f.group || f.item || f.type);
  return (
    <Box>
      <FormHeader crumbs={[{ label: 'Modules', to: '/' }, { label: 'Change Register', to: '/change-register' }, { label: 'Detailed Changelog' }]} />
      <Page>
        <Box sx={{ maxWidth: 980, mx: 'auto', pb: 6 }}>
          <Box sx={{ mb: 1, fontSize: 13 }}><Link to="/change-register" style={{ color: '#2EB273', fontWeight: 500 }}>Back to Change Register</Link></Box>
          <Box component="h1" sx={{ fontSize: 26, fontWeight: 600, mt: 0, mb: 0.5 }}>Detailed Changelog</Box>
          <Text type="s4" color="theme.secondary.700" sx={{ mb: 2 }}>What changed in this POC, on which screen, and why. Filter by module, side menu and change type.</Text>

          <Box component="details" sx={{ mb: 2, p: 1.5, border: '1px solid #E3E4E6', borderRadius: '8px', bgcolor: '#FAFAFA' }}>
            <Box component="summary" sx={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>How to read this page</Box>
            <Markdown source={intro.replace(/^#\s+.*$/m, '')} />
          </Box>

          <FilterRow title="Module">
            <Pill label="All" count={n({ mod: '', group: '', item: '' })} active={!f.mod} onClick={() => setF({ ...f, mod: '', group: '', item: '' })} />
            {MODULE_LIST.map((m) => <Pill key={m.id} label={m.label} count={n({ mod: m.label, group: '', item: '' })} active={f.mod === m.label} onClick={() => setF({ ...f, mod: m.label, group: '', item: '' })} />)}
          </FilterRow>
          {mod && (
            <FilterRow title="Side menu">
              <Pill label="All" count={n({ group: '', item: '' })} active={!f.group} onClick={() => setF({ ...f, group: '', item: '' })} />
              {mod.menu.map((g) => <Pill key={g.label} label={g.label} count={n({ group: g.label, item: '' })} active={f.group === g.label} onClick={() => setF({ ...f, group: g.label, item: '' })} />)}
            </FilterRow>
          )}
          {group?.children && group.children.length > 0 && (
            <FilterRow title="Screen">
              <Pill label="All" count={n({ item: '' })} active={!f.item} onClick={() => setF({ ...f, item: '' })} />
              {group.children.map((c) => <Pill key={c.label} label={c.label} count={n({ item: c.label })} active={f.item === c.label} onClick={() => setF({ ...f, item: c.label })} />)}
            </FilterRow>
          )}
          <FilterRow title="Change type">
            <Pill label="All" count={n({ type: '' })} active={!f.type} onClick={() => setF({ ...f, type: '' })} />
            {TYPES.map((t) => <Pill key={t} label={t} count={n({ type: t })} active={f.type === t} onClick={() => setF({ ...f, type: t })} />)}
          </FilterRow>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2, fontSize: 13, color: '#656669' }}>
            <span>Showing {shown.length} of {entries.length} changes</span>
            {filtered && <Box component="span" onClick={() => setF({ mod: '', group: '', item: '', type: '' })} sx={{ cursor: 'pointer', color: '#2EB273', fontWeight: 500 }}>Clear filters</Box>}
          </Box>

          {shown.length === 0 && <Text type="s3" color="theme.secondary.700">No changes have been logged for this selection yet.</Text>}
          {shown.map((e) => (
            <Box key={e.id} sx={{ border: '1px solid #E3E4E6', borderRadius: '8px', p: 2.5, mb: 2, bgcolor: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75, flexWrap: 'wrap' }}>
                {e.when && <Box sx={{ fontSize: 12, fontWeight: 500, color: '#656669' }}>{e.when}</Box>}
                <StatusChip status={e.type} tone={typeTone(e.type)} />
              </Box>
              <Box component="h3" sx={{ fontSize: 16, fontWeight: 600, m: 0, mb: 1 }}>{e.title}</Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {e.wheres.map((w, i) => (
                  <Box key={i} component={Link} to={whereLink(w)} sx={{ px: 1, py: 0.25, borderRadius: '4px', bgcolor: '#E8F5F0', color: '#279769', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>{w.join(' › ')}</Box>
                ))}
              </Box>
              <Markdown source={e.body} />
            </Box>
          ))}
        </Box>
      </Page>
    </Box>
  );
}
