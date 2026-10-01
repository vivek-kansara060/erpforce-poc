import { useMemo, useState, type ReactNode } from 'react';
import { Box, IconButton, InputAdornment, Menu, MenuItem, Pagination, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Checkbox, Button, TableSortLabel } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import { Text } from './Text';
import { ChangeTag } from './ChangeTag';
import { neutral, primaryGreen } from '@/theme/color';
import type { ChangeKind } from '@/types';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  /** shows a NEW / CHANGED badge on the column header in Review Mode */
  change?: ChangeKind;
  req?: string;
  sortable?: boolean;
}

export interface RowAction<T> { label: string; onClick: (row: T) => void; danger?: boolean; hidden?: (row: T) => boolean }

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: RowAction<T>[];
  /** chips above the table to filter by a field value, e.g. { key: 'status', options: ['Draft','Approved'] } */
  filter?: { key: string; options: string[]; label?: string };
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  toolbarRight?: ReactNode;
  pageSize?: number;
  selectable?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  emptyText?: string;
  hideToolbar?: boolean;
  /** highlight a row (e.g. overdue) */
  rowSx?: (row: T) => object | undefined;
}

/** List table in the existing ERP style (search + filter chips + row menu + footer pagination). */
export function DataTable<T extends Record<string, any>>({
  rows, columns, rowKey = (r) => r.id, onRowClick, actions, filter, searchPlaceholder = 'Search...', onAdd, addLabel = 'Add', toolbarRight,
  pageSize = 10, selectable, selected = [], onSelect, emptyText = 'No data', hideToolbar, rowSx,
}: Props<T>) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [chip, setChip] = useState<string>('All');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; row: T } | null>(null);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter && chip !== 'All') r = r.filter((x) => String(x[filter.key]) === chip);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((x) => Object.values(x).some((v) => (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(s)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sort.dir === 'asc' ? c : -c;
      });
    }
    return r;
  }, [rows, q, chip, filter, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const view = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  const allIds = view.map(rowKey);
  const visibleActions = (row: T) => (actions ?? []).filter((a) => !a.hidden?.(row));

  return (
    <Box>
      {!hideToolbar && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {filter && ['All', ...filter.options].map((o) => (
              <Box key={o} onClick={() => { setChip(o); setPage(1); }} sx={{ cursor: 'pointer', px: 1.25, py: 0.4, borderRadius: '1.5rem', fontSize: 12, fontWeight: 500, bgcolor: chip === o ? primaryGreen[200] : neutral[200], color: chip === o ? primaryGreen[900] : neutral[800], '&:hover': { bgcolor: chip === o ? primaryGreen[200] : neutral[300] } }}>
                {o}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TextField
              size="small" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: neutral[600] }} /></InputAdornment>, sx: { bgcolor: neutral[200], borderRadius: '0.5rem', '& fieldset': { border: 'none' }, minWidth: 240 } }}
            />
            {toolbarRight}
            {onAdd && <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>{addLabel}</Button>}
          </Box>
        </Box>
      )}
      <TableContainer sx={{ border: '1px solid #efefef', borderRadius: '8px', maxHeight: 'calc(100vh - 260px)' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ width: 40 }}>
                  <Checkbox size="small" checked={allIds.length > 0 && allIds.every((i) => selected.includes(i))} onChange={(e) => onSelect?.(e.target.checked ? Array.from(new Set([...selected, ...allIds])) : selected.filter((s) => !allIds.includes(s)))} />
                </TableCell>
              )}
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align} sx={{ width: c.width }}>
                  {c.sortable === false ? c.label : (
                    <TableSortLabel active={sort?.key === c.key} direction={sort?.key === c.key ? sort.dir : 'asc'} onClick={() => setSort((s) => (s?.key === c.key && s.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' }))}>
                      {c.label}
                    </TableSortLabel>
                  )}
                  <ChangeTag kind={c.change} req={c.req} />
                </TableCell>
              ))}
              {actions && <TableCell sx={{ width: 44 }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {view.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)} align="center" sx={{ py: 5 }}><Text type="s3" weight="medium" color="theme.secondary.800">{emptyText}</Text></TableCell></TableRow>
            )}
            {view.map((row) => {
              const id = rowKey(row);
              return (
                <TableRow key={id} hover onClick={() => onRowClick?.(row)} selected={selected.includes(id)} sx={{ cursor: onRowClick ? 'pointer' : 'default', '&.Mui-selected': { bgcolor: primaryGreen[100] }, ...(rowSx?.(row) ?? {}) }}>
                  {selectable && (
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.includes(id)} onChange={(e) => onSelect?.(e.target.checked ? [...selected, id] : selected.filter((s) => s !== id))} />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align}>{c.render ? c.render(row) : (row[c.key] as ReactNode) ?? '-'}</TableCell>
                  ))}
                  {actions && (
                    <TableCell padding="none" onClick={(e) => e.stopPropagation()}>
                      {visibleActions(row).length > 0 && <IconButton size="small" onClick={(e) => setMenu({ el: e.currentTarget, row })}><MoreVertIcon fontSize="small" /></IconButton>}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Text type="s5" color="theme.secondary.800">{filtered.length} record{filtered.length === 1 ? '' : 's'}</Text>
        <Pagination size="small" shape="rounded" page={cur} count={pages} onChange={(_, p) => setPage(p)} color="primary" />
      </Box>
      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        {menu && visibleActions(menu.row).map((a) => (
          <MenuItem key={a.label} sx={a.danger ? { color: '#C64D4D', '&:hover': { bgcolor: '#FEDFDF' } } : undefined} onClick={() => { const r = menu.row; setMenu(null); a.onClick(r); }}>{a.label}</MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
