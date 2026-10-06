import { useState, type ReactNode } from 'react';
import { Box, Button, FormControlLabel, IconButton, MenuItem, Radio, RadioGroup, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Checkbox } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { CheckInput, DateInput, FileInput, MultiSelectInput, NumberInput, SelectInput, TextInput, ToggleInput, ValueField } from '@/components/Form';
import { Text } from '@/components/Text';
import { ChangeTag } from '@/components/ChangeTag';
import { Marked } from '@/components/ChangeTag';
import { neutral } from '@/theme/color';
import type { ChangeKind } from '@/types';
import { MasterSelect, RowMenu } from './shared';

type Opt = string | { value: string; label: string };
export const optsOf = (s: { options?: Opt[] | (() => Opt[]) }): Opt[] => (typeof s.options === 'function' ? s.options() : s.options ?? []);
export interface Spec {
  key: string; label: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'master' | 'multi' | 'textarea' | 'toggle' | 'check' | 'radio' | 'readonly' | 'file';
  options?: Opt[] | (() => Opt[]); master?: string; required?: boolean; change?: ChangeKind; req?: string; hint?: string;
  show?: (f: Record<string, any>) => boolean; disabled?: boolean | ((f: Record<string, any>) => boolean); full?: boolean; rows?: number; value?: (f: Record<string, any>) => any;
  onLabel?: string; offLabel?: string;
}
type F = Record<string, any>;

/** Renders a list of field specs in the existing ERP two-column form layout. Existing fields carry no badge; new ones carry `change`. */
export function SpecForm({ specs, f, set, err = {}, locked, cols = 2 }: { specs: Spec[]; f: F; set: (k: string, v: any) => void; err?: Record<string, string>; locked?: boolean; cols?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, gap: 2, alignItems: 'start' }}>
      {specs.filter((s) => s.key !== 'number' && (!s.show || s.show(f))).map((s) => {
        const dis = locked || (typeof s.disabled === 'function' ? s.disabled(f) : s.disabled);
        const base = { label: s.label, required: s.required, change: s.change, req: s.req, hint: s.hint, disabled: dis, error: err[s.key], full: s.full };
        const v = s.value ? s.value(f) : f[s.key];
        const on = (x: any) => set(s.key, x);
        switch (s.type) {
          case 'number': return <NumberInput key={s.key} {...base} value={v} onChange={(x) => on(x === '' ? '' : Number(x))} />;
          case 'date': return <DateInput key={s.key} {...base} value={v} onChange={on} />;
          case 'datetime': return <DateInput key={s.key} {...base} label={s.label.includes('Time') ? s.label : `${s.label} Time`} value={v} onChange={on} />;
          case 'select': return <SelectInput key={s.key} {...base} value={v} options={optsOf(s)} onChange={on} />;
          case 'master': return <MasterSelect key={s.key} master={s.master!} {...base} value={v} onChange={on} />;
          case 'multi': return <MultiSelectInput key={s.key} {...base} value={v ?? []} options={optsOf(s)} onChange={on} />;
          case 'textarea': return <TextInput key={s.key} {...base} multiline rows={s.rows ?? 2} value={v} onChange={on} full />;
          case 'toggle': return <ToggleInput key={s.key} label={s.label} change={s.change} req={s.req} disabled={dis} checked={!!v} onChange={on} onLabel={s.onLabel} offLabel={s.offLabel} full={s.full} />;
          case 'check': return <CheckInput key={s.key} label={s.label} change={s.change} req={s.req} hint={s.hint} disabled={dis} checked={!!v} onChange={on} full={s.full} />;
          case 'file': return <FileInput key={s.key} {...base} multiple value={v ?? []} onChange={on} />;
          case 'radio':
            return (
              <Box key={s.key} sx={{ gridColumn: s.full ? '1 / -1' : undefined }}>
                <Text type="s5" weight="medium" color="theme.secondary.800">{s.label}{s.required && <span style={{ color: '#C64D4D' }}> *</span>}<ChangeTag kind={s.change} req={s.req} /></Text>
                <RadioGroup row value={v ?? ''} onChange={(e) => on(e.target.value)}>
                  {optsOf(s).map((o) => { const ov = typeof o === 'string' ? o : o.value; return <FormControlLabel key={ov} value={ov} disabled={dis} control={<Radio size="small" />} label={<Text type="s3">{typeof o === 'string' ? o : o.label}</Text>} />; })}
                </RadioGroup>
              </Box>
            );
          case 'readonly': return <TextInput key={s.key} {...base} disabled value={v} />;
          default: return <TextInput key={s.key} {...base} value={v} onChange={on} />;
        }
      })}
    </Box>
  );
}

/** Read-only counterpart: label/value pairs for the view pages (same fields as the form). */
export function SpecView({ specs, f, cols = 4 }: { specs: Spec[]; f: F; cols?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, gap: 3 }}>
      {specs.filter((s) => (!s.show || s.show(f)) && s.type !== 'file').map((s) => {
        const raw = s.value ? s.value(f) : f[s.key];
        const lab = s.type === 'select' || s.type === 'radio' ? optsOf(s).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)).find((o) => o.value === raw)?.label : undefined;
        const val = lab ?? (Array.isArray(raw) ? raw.join(', ') : typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : raw);
        return <ValueField key={s.key} label={s.label} change={s.change} req={s.req} value={val as ReactNode} />;
      })}
    </Box>
  );
}

/** Existing ERP "inline table" pattern (Follow Up, Address, Contact): rows with an Add Row button. */
export interface RowCol { key: string; label: string; type?: 'text' | 'select' | 'date' | 'datetime' | 'check'; options?: string[]; width?: number }
export function RowsEditor<T extends Record<string, any>>({ cols, rows, onChange, locked, blank, addLabel = 'Add Row', empty = 'No rows' }: {
  cols: RowCol[]; rows: T[]; onChange?: (r: T[]) => void; locked?: boolean; blank: T; addLabel?: string; empty?: string;
}) {
  const set = (i: number, k: string, v: any) => onChange?.(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Box>
      <TableContainer sx={{ border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
        <Table size="small">
          <TableHead><TableRow sx={{ bgcolor: neutral[100] }}>{cols.map((c) => <TableCell key={c.key} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{c.label}</TableCell>)}{!locked && <TableCell />}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={cols.length + 1}><Text type="s4" color="theme.secondary.700">{empty}</Text></TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c.key} sx={{ py: 0.5 }}>
                    {locked ? <Text type="s4">{c.type === 'check' ? (r[c.key] ? 'Yes' : 'No') : String(r[c.key] ?? '-') || '-'}</Text>
                      : c.type === 'select' ? <Select size="small" displayEmpty value={r[c.key] ?? ''} sx={{ width: c.width ?? 140, fontSize: 13 }} onChange={(e) => set(i, c.key, e.target.value)}>{(c.options ?? []).map((o) => <MenuItem key={o} value={o}>{o || 'None'}</MenuItem>)}</Select>
                      : c.type === 'check' ? <Checkbox size="small" checked={!!r[c.key]} onChange={(e) => set(i, c.key, e.target.checked)} />
                      : <TextField size="small" type={c.type === 'date' ? 'date' : c.type === 'datetime' ? 'datetime-local' : 'text'} value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: c.width ?? 150, '& input': { fontSize: 13, py: '7px' } }} />}
                  </TableCell>
                ))}
                {!locked && <TableCell><RowMenu items={[{ label: 'Delete', danger: true, onClick: () => onChange?.(rows.filter((_, j) => j !== i)) }]} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!locked && onChange && <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => onChange([...rows, { ...blank }])}>{addLabel}</Button>}
    </Box>
  );
}

/** Collapsible-style section used by the existing forms (Attachments, Owner Details, Classification, Follow Up ...). */
export function Section({ title, children, change, req }: { title: string; children: ReactNode; change?: 'new' | 'changed'; req?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ mt: 2.5, border: `1px solid ${neutral[200]}`, borderRadius: '8px' }}>
      <Box onClick={() => setOpen(!open)} sx={{ px: 2, py: 1, cursor: 'pointer', bgcolor: neutral[100], borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between' }}>
        <Text type="s3" weight="medium">{title}<ChangeTag kind={change} req={req} /></Text><Text type="s5">{open ? 'Hide' : 'Show'}</Text>
      </Box>
      {open && <Box sx={{ p: 2 }}>{children}</Box>}
    </Box>
  );
}
export { Marked };
