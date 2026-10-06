import { useState, type ReactNode } from 'react';
import { Box, Checkbox, Chip, FormControlLabel, MenuItem, Select, Switch, TextField, Button, OutlinedInput, Tooltip } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Text } from './Text';
import { ChangeTag, Marked } from './ChangeTag';
import { neutral } from '@/theme/color';
import type { ChangeKind } from '@/types';

/** Common wrapper: label ABOVE the control (existing ERP pattern), red asterisk, optional NEW/CHANGED badge. */
interface Base {
  label: string;
  required?: boolean;
  hint?: string;
  change?: ChangeKind;
  /** requirement reference shown in the badge tooltip */
  req?: string;
  disabled?: boolean;
  /** span both columns in a FormGrid */
  full?: boolean;
  error?: string;
}

/** The "?" that shows a hint on hover: beside a field label or a section title. */
export function HelpTip({ hint }: { hint?: ReactNode }) {
  if (!hint) return null;
  return <Tooltip title={hint} arrow placement="top"><Box component="span" aria-label="Help" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ml: 0.75, width: 15, height: 15, borderRadius: '50%', border: '1px solid #8C8FB0', color: '#6B6E94', fontSize: 10, fontWeight: 700, lineHeight: 1, cursor: 'help', verticalAlign: 'middle' }}>?</Box></Tooltip>;
}

export function FieldShell({ label, required, hint, change, req, full, error, children }: Base & { children: ReactNode }) {
  return (
    <Box sx={{ gridColumn: full ? '1 / -1' : undefined, minWidth: 0 }}>
      <Text type="s5" weight="medium" color={error ? '#C64D4D' : 'theme.secondary.800'} sx={{ mb: 0.5 }}>
        {label}{required && <span style={{ color: '#C64D4D' }}> *</span>}
        <ChangeTag kind={change} req={req} />
        <HelpTip hint={hint} />
      </Text>
      {children}
      {error && <Text type="s5" color="#C64D4D" sx={{ mt: 0.5 }}>{error}</Text>}
    </Box>
  );
}

type Opt = string | { value: string; label: string };
const val = (o: Opt) => (typeof o === 'string' ? o : o.value);
const lab = (o: Opt) => (typeof o === 'string' ? o : o.label);

export function TextInput({ value, onChange, placeholder, multiline, rows, type = 'text', ...b }: Base & { value?: string | number; onChange?: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number; type?: string }) {
  return (
    <FieldShell {...b}>
      <TextField fullWidth size="small" type={type} value={value ?? ''} disabled={b.disabled} placeholder={placeholder} multiline={multiline} rows={rows} error={!!b.error} onChange={(e) => onChange?.(e.target.value)} inputProps={type === 'number' ? { step: 'any' } : undefined} />
    </FieldShell>
  );
}
export const NumberInput = (p: Omit<Parameters<typeof TextInput>[0], 'type'>) => <TextInput {...p} type="number" />;
export const DateInput = ({ value, ...p }: Omit<Parameters<typeof TextInput>[0], 'type'>) => (
  <FieldShell {...p}>
    <TextField fullWidth size="small" type={p.label.toLowerCase().includes('time') ? 'datetime-local' : 'date'} value={value ?? ''} disabled={p.disabled} onChange={(e) => p.onChange?.(e.target.value)} InputLabelProps={{ shrink: true }} />
  </FieldShell>
);

export function SelectInput({ value, onChange, options, placeholder = 'Select', ...b }: Base & { value?: string; onChange?: (v: string) => void; options: Opt[]; placeholder?: string }) {
  return (
    <FieldShell {...b}>
      <Select fullWidth size="small" displayEmpty value={value ?? ''} disabled={b.disabled} error={!!b.error} onChange={(e) => onChange?.(e.target.value as string)} renderValue={(v) => (v ? lab(options.find((o) => val(o) === v) ?? (v as string)) : <span style={{ color: neutral[700] }}>{placeholder}</span>)}>
        {options.map((o) => <MenuItem key={val(o)} value={val(o)}>{lab(o)}</MenuItem>)}
      </Select>
    </FieldShell>
  );
}

export function MultiSelectInput({ value = [], onChange, options, ...b }: Base & { value?: string[]; onChange?: (v: string[]) => void; options: Opt[] }) {
  return (
    <FieldShell {...b}>
      <Select multiple fullWidth size="small" displayEmpty value={value} disabled={b.disabled} input={<OutlinedInput />} onChange={(e) => onChange?.(e.target.value as string[])}
        renderValue={(sel) => (sel.length === 0 ? <span style={{ color: neutral[700] }}>Select</span> : <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{sel.map((s) => <Chip key={s} size="small" label={lab(options.find((o) => val(o) === s) ?? s)} sx={{ bgcolor: '#B6E9D6', color: '#1F7C5E', height: 22 }} />)}</Box>)}>
        {options.map((o) => <MenuItem key={val(o)} value={val(o)}><Checkbox size="small" checked={value.includes(val(o))} />{lab(o)}</MenuItem>)}
      </Select>
    </FieldShell>
  );
}

export function CheckInput({ label, checked, onChange, change, req, disabled, hint, full }: Omit<Base, 'required'> & { checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <Box sx={{ gridColumn: full ? '1 / -1' : undefined, display: 'flex', alignItems: 'center', minHeight: 56, pt: 2 }}>
      <FormControlLabel control={<Checkbox size="small" color="primary" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />} label={<Text type="s3">{label}<ChangeTag kind={change} req={req} /></Text>} />
      {hint && <Text type="s5" color="theme.secondary.700">{hint}</Text>}
    </Box>
  );
}

export function ToggleInput({ label, checked, onChange, change, req, disabled, onLabel = 'Active', offLabel = 'Inactive', full }: Omit<Base, 'required'> & { checked?: boolean; onChange?: (v: boolean) => void; onLabel?: string; offLabel?: string }) {
  return (
    <FieldShell label={label} change={change} req={req} full={full}>
      <FormControlLabel control={<Switch size="small" color="primary" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />} label={<Text type="s3">{checked ? onLabel : offLabel}</Text>} />
    </FieldShell>
  );
}

/** Mock file upload: picking a file just records its name. */
export function FileInput({ label, value, onChange, multiple, ...b }: Base & { value?: string[]; onChange?: (names: string[]) => void; multiple?: boolean }) {
  const [names, setNames] = useState<string[]>(value ?? []);
  const cur = value ?? names;
  return (
    <FieldShell label={label} {...b}>
      <Box sx={{ border: `1px dashed ${neutral[400]}`, borderRadius: '4px', p: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: b.disabled ? neutral[200] : '#fff' }}>
        <Button component="label" size="small" variant="outlined" startIcon={<UploadFileIcon />} disabled={b.disabled}>
          Upload
          <input hidden type="file" multiple={multiple} onChange={(e) => { const n = Array.from(e.target.files ?? []).map((f) => f.name); const next = multiple ? [...cur, ...n] : n; setNames(next); onChange?.(next); }} />
        </Button>
        {cur.length === 0 && <Text type="s5" color="theme.secondary.700">No file attached</Text>}
        {cur.map((n) => <Chip key={n} size="small" label={n} onDelete={b.disabled ? undefined : () => { const next = cur.filter((x) => x !== n); setNames(next); onChange?.(next); }} />)}
      </Box>
    </FieldShell>
  );
}

/** Two-column form grid (existing FormParser layout: 2 columns, 1rem gap). */
export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, gap: 2, alignItems: 'start' }}>{children}</Box>;
}

/** Titled form section with divider (existing pattern) and an optional NEW / CHANGED marker for the whole block. */
export function FormSection({ title, children, change, req, right, hint }: { title: string; children: ReactNode; change?: ChangeKind; req?: string; right?: ReactNode; hint?: ReactNode }) {
  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${neutral[200]}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Text type="s3" weight="medium">{title}<ChangeTag kind={change} req={req} /><HelpTip hint={hint} /></Text>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** Read-only label/value pair used on view pages (existing ValueField). */
export function ValueField({ label, value, change, req }: { label: string; value?: ReactNode; change?: ChangeKind; req?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Text type="s3" weight="medium">{label}<ChangeTag kind={change} req={req} /></Text>
      <Text type="s5" weight="medium" color="theme.secondary.700" component="div">{value === undefined || value === '' || value === null ? '-' : value}</Text>
    </Box>
  );
}

export function ValueGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, gap: 3 }}>{children}</Box>;
}

export { Marked };
