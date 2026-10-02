import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, type RouteObject } from 'react-router-dom';
import { Badge, Box, Button, InputAdornment, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TableSortLabel, TextField } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { ChangeTag } from '@/components/ChangeTag';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Dialogs';
import { fmtAED } from '@/mock-data/masters';
import { neutral, primaryGreen } from '@/theme/color';
import type { ChangeKind } from '@/types';
import { AccessSwitch } from './permissions';

/** Inventory report definition. Rows are built from live POC data each time the report opens. */
export interface InvReportColumn {
  key: string; label: string; align?: 'left' | 'right' | 'center';
  /** how a numeric value is shown; the raw number is kept for sorting, filtering and totals */
  format?: 'aed' | 'num' | 'pct' | 'days';
  status?: boolean;
  /** add this column up in the totals row */
  total?: boolean;
  /** the cell opens the asset view (the row must carry _heavyId) */
  link?: 'asset';
}
export interface InvReportDef {
  slug: string; title: string; purpose: string; group?: string; change?: ChangeKind; req?: string;
  columns: InvReportColumn[];
  filters?: { key: string; label: string }[];
  rows: () => Record<string, any>[];
}

const REQ_REPORT = 'Reports (2 Oct call: visible filter, column search, totals, print, drill-down to the asset)';
const fmt = (c: InvReportColumn, v: any) => {
  if (v === undefined || v === null || v === '') return '-';
  if (typeof v !== 'number') return String(v);
  if (c.format === 'aed') return fmtAED(v);
  if (c.format === 'pct') return `${Math.round(v * 10) / 10}%`;
  if (c.format === 'days') return `${v.toLocaleString('en-US')} day${v === 1 ? '' : 's'}`;
  return v.toLocaleString('en-US');
};
const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

export function ReportView({ report, basePath }: { report: InvReportDef; basePath: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const all = useMemo(() => report.rows(), [report]);
  const [showFilters, setShowFilters] = useState(true);
  const [fv, setFv] = useState<Record<string, string>>({});
  const [colQ, setColQ] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const filterOptions = (key: string) => Array.from(new Set(all.map((r) => r[key]).filter((v) => v !== undefined && v !== null && v !== ''))).map(String).sort();
  const rows = useMemo(() => {
    let r = all.filter((row) => Object.entries(fv).every(([k, v]) => !v || String(row[k]) === v));
    r = r.filter((row) => Object.entries(colQ).every(([k, v]) => { const c = report.columns.find((x) => x.key === k); return !v.trim() || (c ? fmt(c, row[k]) : String(row[k] ?? '')).toLowerCase().includes(v.trim().toLowerCase()); }));
    if (q.trim()) r = r.filter((row) => report.columns.some((c) => fmt(c, row[c.key]).toLowerCase().includes(q.trim().toLowerCase())));
    if (sort) r = [...r].sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? '')); return sort.dir === 'asc' ? c : -c; });
    return r;
  }, [all, fv, colQ, q, sort, report.columns]);
  const active = Object.values(fv).filter(Boolean).length + Object.values(colQ).filter((v) => v.trim()).length + (q.trim() ? 1 : 0);
  const totals = report.columns.map((c) => (c.total ? rows.reduce((t, r) => t + (typeof r[c.key] === 'number' ? r[c.key] : 0), 0) : undefined));
  const hasTotals = totals.some((t) => t !== undefined);
  const clear = () => { setFv({}); setColQ({}); setQ(''); };
  const print = () => {
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) { toast('Allow pop-ups for this site to print the report', 'error'); return; }
    const head = report.columns.map((c) => `<th style="text-align:${c.align ?? 'left'}">${esc(c.label)}</th>`).join('');
    const body = rows.map((r) => `<tr>${report.columns.map((c) => `<td style="text-align:${c.align ?? 'left'}">${esc(fmt(c, r[c.key]))}</td>`).join('')}</tr>`).join('');
    const foot = hasTotals ? `<tr class="t">${report.columns.map((c, i) => `<td style="text-align:${c.align ?? 'left'}">${i === 0 ? `Total (${rows.length} rows)` : totals[i] !== undefined ? esc(fmt(c, totals[i])) : ''}</td>`).join('')}</tr>` : '';
    const applied = [...Object.entries(fv).filter(([, v]) => v).map(([k, v]) => `${report.filters?.find((f) => f.key === k)?.label ?? k}: ${v}`), ...Object.entries(colQ).filter(([, v]) => v.trim()).map(([k, v]) => `${report.columns.find((c) => c.key === k)?.label ?? k} contains "${v}"`), ...(q.trim() ? [`Search: "${q}"`] : [])];
    w.document.write(`<!doctype html><html><head><title>${esc(report.title)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:0 0 8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px}th{background:#f2f2f2}tr.t td{font-weight:bold;background:#f7f7f7}</style></head><body><h1>${esc(report.title)}</h1><p>${esc(report.purpose)}</p><p>Gulf Power Rentals LLC. ${rows.length} rows. ${applied.length ? `Filters: ${esc(applied.join('; '))}` : 'No filters applied'}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };
  const cell = (c: InvReportColumn, r: Record<string, any>) => {
    const text = fmt(c, r[c.key]);
    if (c.status) return <StatusChip status={text} />;
    if (c.link === 'asset' && r._heavyId) return <Box component="span" onClick={() => nav(`/inventory/items/heavy/${r._heavyId}`)} sx={{ color: primaryGreen[900], cursor: 'pointer', textDecoration: 'underline' }}>{text}</Box>;
    return text;
  };
  return (
    <Box>
      <FormHeader crumbs={[{ label: 'Reports', to: `${basePath}/reports` }, { label: report.title }]} />
      <Page>
        <PageTitle title={report.title} subtitle={report.purpose} change={report.change} req={report.req}
          right={<Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <AccessSwitch />
            <Badge color="primary" badgeContent={active} invisible={!active}><Button variant={showFilters ? 'contained' : 'outlined'} startIcon={<FilterListIcon />} onClick={() => setShowFilters(!showFilters)}>Filter</Button></Badge>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={print}>Print</Button>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => toast(`${report.title} exported (POC: no file generated)`, 'info')}>Export</Button>
          </Box>} />
        {showFilters && (
          <Box sx={{ p: 1.5, mb: 1.5, border: `1px solid ${neutral[200]}`, borderRadius: '8px', bgcolor: '#FBFBFB' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Text type="s4" weight="medium">Filters<ChangeTag kind="new" req={REQ_REPORT} /></Text>
              {active > 0 && <Button size="small" variant="text" onClick={clear}>Clear all filters</Button>}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField size="small" placeholder="Search all columns" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220, bgcolor: '#fff' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: neutral[600] }} /></InputAdornment> }} />
              {(report.filters ?? []).map((f) => (
                <Box key={f.key} sx={{ minWidth: 180 }}>
                  <Select fullWidth size="small" displayEmpty value={fv[f.key] ?? ''} onChange={(e) => setFv({ ...fv, [f.key]: e.target.value as string })} renderValue={(v) => (v ? `${f.label}: ${v}` : `${f.label}: All`)} sx={{ bgcolor: '#fff' }}>
                    <MenuItem value="">All</MenuItem>
                    {filterOptions(f.key).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </Box>
              ))}
            </Box>
            <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Search inside any column using the boxes under the column headings.</Text>
          </Box>
        )}
        <TableContainer sx={{ border: '1px solid #efefef', borderRadius: '8px', maxHeight: 'calc(100vh - 330px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {report.columns.map((c) => (
                  <TableCell key={c.key} align={c.align}>
                    <TableSortLabel active={sort?.key === c.key} direction={sort?.key === c.key ? sort.dir : 'asc'} onClick={() => setSort((s) => (s?.key === c.key && s.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' }))}>{c.label}</TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
              {showFilters && (
                <TableRow>
                  {report.columns.map((c) => (
                    <TableCell key={c.key} sx={{ top: 37, py: 0.5, bgcolor: '#fff' }}>
                      <TextField size="small" variant="standard" placeholder="Search" value={colQ[c.key] ?? ''} onChange={(e) => setColQ({ ...colQ, [c.key]: e.target.value })} inputProps={{ style: { fontSize: 12 } }} fullWidth />
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={report.columns.length} align="center" sx={{ py: 5 }}><Text type="s3" weight="medium" color="theme.secondary.800">No rows match the filters</Text></TableCell></TableRow>}
              {rows.map((r, i) => (
                <TableRow key={i} hover>
                  {report.columns.map((c) => <TableCell key={c.key} align={c.align}>{cell(c, r)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {report.columns.map((c, i) => (
                  <TableCell key={c.key} align={c.align} sx={{ position: 'sticky', bottom: 0, bgcolor: '#F4F5F7', fontWeight: 600, color: '#1F2125', fontSize: 13, borderTop: `2px solid ${neutral[300]}` }}>
                    {i === 0 ? `Total (${rows.length} row${rows.length === 1 ? '' : 's'})` : totals[i] !== undefined ? fmt(c, totals[i]) : ''}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
        <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>{rows.length} of {all.length} rows shown. The totals row stays visible while scrolling.{report.columns.some((c) => c.link === 'asset') ? ' Click an asset to open its details, status and history.' : ''}</Text>
      </Page>
    </Box>
  );
}

export function ReportsIndexPage({ reports, basePath }: { reports: InvReportDef[]; basePath: string }) {
  const groups = Array.from(new Set(reports.map((r) => r.group ?? 'Reports')));
  return (
    <Page>
      <PageTitle title="Reports" subtitle={`${reports.length} reports. Every report has filters, column search, totals and print.`} right={<AccessSwitch />} />
      {groups.map((g) => (
        <Box key={g} sx={{ mb: 3 }}>
          <Text type="s2" weight="medium" sx={{ mb: 1 }}>{g}</Text>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
            {reports.filter((r) => (r.group ?? 'Reports') === g).map((r) => (
              <Box key={r.slug} component={Link} to={`${basePath}/reports/${r.slug}`} sx={{ display: 'block', p: 1.5, border: `1px solid ${neutral[200]}`, borderRadius: '8px', '&:hover': { borderColor: primaryGreen[700], bgcolor: primaryGreen[50] } }}>
                <Text type="s3" weight="medium">{r.title}<ChangeTag kind={r.change} req={r.req} /></Text>
                <Text type="s5" color="theme.secondary.800" sx={{ mt: 0.5 }}>{r.purpose}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Page>
  );
}

function ReportRoute({ reports, basePath }: { reports: InvReportDef[]; basePath: string }) {
  const { slug } = useParams();
  const r = reports.find((x) => x.slug === slug);
  return r ? <ReportView key={r.slug} report={r} basePath={basePath} /> : <Navigate to={`${basePath}/reports`} replace />;
}

export function invReportRoutes(basePath: string, reports: InvReportDef[]): RouteObject[] {
  return [
    { path: 'reports', element: <ReportsIndexPage reports={reports} basePath={basePath} /> },
    { path: 'reports/:slug', element: <ReportRoute reports={reports} basePath={basePath} /> },
  ];
}
