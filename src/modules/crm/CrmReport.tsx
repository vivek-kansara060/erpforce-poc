import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { FormHeader, Page, PageTitle } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Dialogs';
import { neutral } from '@/theme/color';
import type { ChangeKind } from '@/types';
import { aed } from './shared';

export interface CrmCol { key: string; label: string; align?: 'left' | 'right'; status?: boolean; money?: boolean; total?: boolean; filter?: boolean }
export interface CrmReportDef { slug: string; title: string; purpose: string; group: string; change?: ChangeKind; req?: string; columns: CrmCol[]; rows: Record<string, any>[] }

/**
 * CRM report page following the 2 Oct feedback: a search box under each column, dropdown filters, totals that stay visible (sticky footer), Print,
 * and drill-down (clicking a row opens the record it came from). Built inside CRM so the shared report page used by Inventory is unchanged.
 */
export function CrmReportPage({ def }: { def: CrmReportDef }) {
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState<Record<string, string>>({});
  const rows = useMemo(() => def.rows.filter((r) => def.columns.every((c) => {
    const v = q[c.key];
    if (!v) return true;
    return c.filter ? String(r[c.key]) === v : String(r[c.key] ?? '').toLowerCase().includes(v.toLowerCase());
  })), [def, q]);
  const show = (c: CrmCol, v: any) => (c.money ? aed(Number(v) || 0) : c.status ? <StatusChip status={String(v)} /> : v ?? '-');
  const hasTotals = def.columns.some((c) => c.total);
  return (
    <Box>
      <FormHeader crumbs={[{ label: 'Reports', to: '/crm/reports' }, { label: def.title }]} />
      <Page>
        <PageTitle title={def.title} subtitle={def.purpose} change={def.change} req={def.req}
          right={<Box sx={{ display: 'flex', gap: 1 }}><Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>Print</Button><Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => toast(`${def.title} exported (POC: no file generated)`, 'info')}>Export</Button></Box>} />
        <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px', maxHeight: 'calc(100vh - 260px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>{def.columns.map((c) => <TableCell key={c.key} align={c.align} sx={{ fontWeight: 500, bgcolor: neutral[100], whiteSpace: 'nowrap' }}>{c.label}</TableCell>)}</TableRow>
              <TableRow>
                {def.columns.map((c) => (
                  <TableCell key={c.key} sx={{ bgcolor: '#fff', top: 37, py: 0.5 }}>
                    {c.filter
                      ? <Select size="small" displayEmpty fullWidth value={q[c.key] ?? ''} onChange={(e) => setQ({ ...q, [c.key]: e.target.value as string })} sx={{ fontSize: 12 }}>
                          <MenuItem value="">All</MenuItem>{Array.from(new Set(def.rows.map((r) => String(r[c.key])))).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                        </Select>
                      : <TextField size="small" fullWidth placeholder="Search" value={q[c.key] ?? ''} onChange={(e) => setQ({ ...q, [c.key]: e.target.value })} sx={{ '& input': { fontSize: 12, py: '5px' } }} />}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={def.columns.length} align="center"><Text type="s4">No rows match the filters</Text></TableCell></TableRow>}
              {rows.map((r, i) => (
                <TableRow key={i} hover onClick={() => r._link && nav(r._link)} sx={{ cursor: r._link ? 'pointer' : 'default' }}>
                  {def.columns.map((c) => <TableCell key={c.key} align={c.align} sx={{ fontSize: 13 }}>{show(c, r[c.key])}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
            {hasTotals && (
              <TableFooter sx={{ position: 'sticky', bottom: 0, bgcolor: neutral[100] }}>
                <TableRow>{def.columns.map((c, i) => <TableCell key={c.key} align={c.align} sx={{ fontWeight: 600, fontSize: 13, color: '#1F2125' }}>{i === 0 ? `Total (${rows.length} rows)` : c.total ? (c.money ? aed(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)) : rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)) : ''}</TableCell>)}</TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
        <Text type="s5" color="theme.secondary.700" sx={{ mt: 1 }}>Click a row to open the record. Totals follow the filters and stay visible while scrolling.</Text>
      </Page>
    </Box>
  );
}
