import { useState, type ReactNode } from 'react';
import { Link, useParams, Navigate, type RouteObject } from 'react-router-dom';
import { Box, Button, MenuItem, Select } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useSnackbar } from 'notistack';
import { DataTable, type Column } from './DataTable';
import { FormHeader, Page, PageTitle } from './PageHeader';
import { BarChart, DonutChart, KpiCard, KpiRow, Panel, Progress } from './Widgets';
import { StatusChip } from './StatusChip';
import { Text } from './Text';
import { ChangeTag } from './ChangeTag';
import { neutral, primaryGreen } from '@/theme/color';
import type { ChangeKind } from '@/types';

/* ------------------------------------------------------------------ Reports */

export interface ReportDef {
  slug: string;
  title: string;
  /** the "Purpose" text from the requirement document */
  purpose: string;
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center'; status?: boolean }[];
  rows: Record<string, any>[];
  /** simple dropdown filters that filter rows by column value: { key: 'status', label: 'Status', options: [...] } */
  filters?: { key: string; label: string; options: string[] }[];
  change?: ChangeKind;
  req?: string;
  /** group heading in the reports index (e.g. 'Sales', 'Fleet') */
  group?: string;
}

export function ReportPage({ report, basePath }: { report: ReportDef; basePath: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [fv, setFv] = useState<Record<string, string>>({});
  const rows = report.rows.filter((r) => Object.entries(fv).every(([k, v]) => !v || String(r[k]) === v));
  const cols: Column<any>[] = report.columns.map((c) => ({ key: c.key, label: c.label, align: c.align, render: c.status ? (r) => <StatusChip status={String(r[c.key])} /> : undefined }));
  return (
    <Box>
      <FormHeader crumbs={[{ label: 'Reports', to: `${basePath}/reports` }, { label: report.title }]} />
      <Page>
        <PageTitle title={report.title} subtitle={report.purpose} change={report.change} req={report.req}
          right={<Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => enqueueSnackbar(`${report.title} exported (POC: no file generated)`, { variant: 'info' })}>Export</Button>} />
        {report.filters && (
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
            {report.filters.map((f) => (
              <Box key={f.key} sx={{ minWidth: 180 }}>
                <Text type="s5" weight="medium" color="theme.secondary.800" sx={{ mb: 0.5 }}>{f.label}</Text>
                <Select fullWidth size="small" displayEmpty value={fv[f.key] ?? ''} onChange={(e) => setFv({ ...fv, [f.key]: e.target.value as string })} renderValue={(v) => (v ? String(v) : 'All')}>
                  <MenuItem value="">All</MenuItem>
                  {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </Box>
            ))}
          </Box>
        )}
        <DataTable rows={rows.map((r, i) => ({ id: String(i), ...r }))} columns={cols} pageSize={12} />
      </Page>
    </Box>
  );
}

export function ReportsIndex({ reports, basePath, title = 'Reports' }: { reports: ReportDef[]; basePath: string; title?: string }) {
  const groups = Array.from(new Set(reports.map((r) => r.group ?? 'Reports')));
  return (
    <Page>
      <PageTitle title={title} subtitle={`${reports.length} reports`} />
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

/** Route objects (relative to the module base path) for a reports index + each report. */
export function reportRoutes(basePath: string, reports: ReportDef[]): RouteObject[] {
  return [
    { path: 'reports', element: <ReportsIndex reports={reports} basePath={basePath} /> },
    { path: 'reports/:slug', element: <ReportRoute reports={reports} basePath={basePath} /> },
  ];
}
function ReportRoute({ reports, basePath }: { reports: ReportDef[]; basePath: string }) {
  const { slug } = useParams();
  const r = reports.find((x) => x.slug === slug);
  return r ? <ReportPage report={r} basePath={basePath} /> : <Navigate to={`${basePath}/reports`} replace />;
}

/* --------------------------------------------------------------- Dashboards */

export type Widget =
  | { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; span?: number; change?: ChangeKind; req?: string; format?: (n: number) => string }
  | { type: 'donut'; title: string; data: { label: string; value: number; color?: string }[]; centerLabel?: string; span?: number; change?: ChangeKind; req?: string }
  | { type: 'table'; title: string; columns: { key: string; label: string; align?: 'left' | 'right' | 'center'; status?: boolean }[]; rows: Record<string, any>[]; span?: number; change?: ChangeKind; req?: string }
  | { type: 'progress'; title: string; items: { label: string; value: number; sub?: string }[]; span?: number; change?: ChangeKind; req?: string }
  | { type: 'heat'; title: string; rows: string[]; cols: string[]; values: number[][]; span?: number; change?: ChangeKind; req?: string }
  | { type: 'custom'; title: string; node: ReactNode; span?: number; change?: ChangeKind; req?: string };

export interface DashboardDef {
  slug: string;
  title: string;
  /** description from the requirement document */
  purpose: string;
  kpis?: { title: string; value: ReactNode; sub?: ReactNode; tint?: string }[];
  widgets: Widget[];
  change?: ChangeKind;
  req?: string;
}

function WidgetView({ w }: { w: Widget }) {
  const inner = (() => {
    switch (w.type) {
      case 'bar': return <BarChart data={w.data} format={w.format} />;
      case 'donut': return <DonutChart data={w.data} centerLabel={w.centerLabel} />;
      case 'table':
        return <DataTable hideToolbar pageSize={6} rows={w.rows.map((r, i) => ({ id: String(i), ...r }))} columns={w.columns.map((c) => ({ key: c.key, label: c.label, align: c.align, render: c.status ? (r: any) => <StatusChip status={String(r[c.key])} /> : undefined }))} />;
      case 'progress': return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{w.items.map((i) => <Box key={i.label}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Text type="s4">{i.label}</Text>{i.sub && <Text type="s5" color="theme.secondary.700">{i.sub}</Text>}</Box><Progress value={i.value} /></Box>)}</Box>;
      case 'heat': {
        const max = Math.max(...w.values.flat(), 1);
        return (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${w.cols.length}, minmax(64px, 1fr))`, gap: '2px', alignItems: 'center' }}>
              <span />
              {w.cols.map((c) => <Text key={c} type="s5" color="theme.secondary.700" sx={{ textAlign: 'center' }}>{c}</Text>)}
              {w.rows.map((r, ri) => (
                <Box key={r} sx={{ display: 'contents' }}>
                  <Text type="s4">{r}</Text>
                  {w.values[ri].map((v, ci) => <Box key={ci} sx={{ textAlign: 'center', py: 0.75, borderRadius: '3px', fontSize: 12, fontWeight: 500, bgcolor: `rgba(46,178,115,${0.08 + (v / max) * 0.8})`, color: v / max > 0.55 ? '#fff' : '#1F2125' }}>{v}</Box>)}
                </Box>
              ))}
            </Box>
          </Box>
        );
      }
      case 'custom': return <>{w.node}</>;
    }
  })();
  return <Panel title={w.title} change={w.change} req={w.req} sx={{ gridColumn: { md: `span ${w.span ?? 1}` }, minWidth: 0 }}>{inner}</Panel>;
}

export function DashboardPage({ def, basePath, crumbs = true }: { def: DashboardDef; basePath?: string; crumbs?: boolean }) {
  return (
    <Box>
      {crumbs && basePath && <FormHeader crumbs={[{ label: 'Dashboards', to: `${basePath}/dashboards` }, { label: def.title }]} />}
      <Page>
        <PageTitle title={def.title} subtitle={def.purpose} change={def.change} req={def.req} />
        {def.kpis && <KpiRow>{def.kpis.map((k) => <KpiCard key={k.title} {...k} />)}</KpiRow>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          {def.widgets.map((w, i) => <WidgetView key={i} w={w} />)}
        </Box>
      </Page>
    </Box>
  );
}

export function DashboardsIndex({ dashboards, basePath }: { dashboards: DashboardDef[]; basePath: string }) {
  return (
    <Page>
      <PageTitle title="Dashboards" subtitle={`${dashboards.length} dashboards`} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
        {dashboards.map((d) => (
          <Box key={d.slug} component={Link} to={`${basePath}/dashboards/${d.slug}`} sx={{ display: 'block', p: 1.5, border: `1px solid ${neutral[200]}`, borderRadius: '8px', '&:hover': { borderColor: primaryGreen[700], bgcolor: primaryGreen[50] } }}>
            <Text type="s3" weight="medium">{d.title}<ChangeTag kind={d.change} req={d.req} /></Text>
            <Text type="s5" color="theme.secondary.800" sx={{ mt: 0.5 }}>{d.purpose}</Text>
          </Box>
        ))}
      </Box>
    </Page>
  );
}

export function dashboardRoutes(basePath: string, dashboards: DashboardDef[]): RouteObject[] {
  return [
    { path: 'dashboards', element: <DashboardsIndex dashboards={dashboards} basePath={basePath} /> },
    { path: 'dashboards/:slug', element: <DashboardRoute dashboards={dashboards} basePath={basePath} /> },
  ];
}
function DashboardRoute({ dashboards, basePath }: { dashboards: DashboardDef[]; basePath: string }) {
  const { slug } = useParams();
  const d = dashboards.find((x) => x.slug === slug);
  return d ? <DashboardPage def={d} basePath={basePath} /> : <Navigate to={`${basePath}/dashboards`} replace />;
}
