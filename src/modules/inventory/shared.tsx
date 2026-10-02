import type { ReactNode } from 'react';
import { Box, Button } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { Text } from '@/components/Text';
import { FieldShell, FormGrid, FormSection, NumberInput, SelectInput, TextInput, DateInput, ValueField, ValueGrid } from '@/components/Form';
import type { AttributeDef } from './data';
import { fmtAED } from '@/mock-data/masters';
import { neutral } from '@/theme/color';

export const REQ_ITEM = 'Item Master > New Fields';
export const REQ_HE = 'Product Management > Heavy Equipment Fixed Asset';

export type Errors = Record<string, string>;
export const REQUIRED_MSG = 'This field is required';
export const num = (v: unknown) => (v === '' || v === undefined || v === null ? NaN : Number(v));
export const isBlank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
export const aed = (v?: number | string) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? '-' : fmtAED(Number(v)));

/** Validates the listed fields as required and returns the error map. */
export function requireFields(f: Record<string, any>, keys: string[], labels: Record<string, string> = {}): Errors {
  const e: Errors = {};
  keys.forEach((k) => { if (isBlank(f[k])) e[k] = labels[k] ? `${labels[k]} is required` : REQUIRED_MSG; });
  return e;
}

/** Validation shared by the serialized / asset-tracked field group. */
export function validateSerialized(f: Record<string, any>, skipValues = false): Errors {
  const e = requireFields(f, ['brand', 'model', 'engineNo', 'capacity', ...(skipValues ? [] : ['purchaseDate', 'assetValue', 'nbv', 'deprPct', 'deprAmount', 'capex'])]);
  if (skipValues) return e;
  const av = num(f.assetValue), nbv = num(f.nbv), pct = num(f.deprPct);
  if (!e.assetValue && av <= 0) e.assetValue = 'Asset Value must be greater than 0';
  if (!e.nbv && nbv < 0) e.nbv = 'Cannot be negative';
  if (!e.nbv && !e.assetValue && nbv > av) e.nbv = 'Cannot exceed Asset Value';
  if (!e.deprPct && (pct < 0 || pct > 100)) e.deprPct = 'Must be between 0 and 100';
  if (!e.deprAmount && num(f.deprAmount) < 0) e.deprAmount = 'Cannot be negative';
  if (!e.capex && num(f.capex) < 0) e.capex = 'Cannot be negative';
  return e;
}

/** Trivial arithmetic helper: derives Depreciated Amount and Depreciation % from Asset Value and Net Book Value. */
export function deriveDepreciation(assetValue: unknown, nbv: unknown) {
  const av = num(assetValue), n = num(nbv);
  if (Number.isNaN(av) || Number.isNaN(n) || av <= 0 || n > av) return {};
  return { deprAmount: String(Math.round((av - n) * 100) / 100), deprPct: String(Math.round(((av - n) / av) * 10000) / 100) };
}

/** Square photo placeholder / preview used on forms and on the item / asset record. */
export function PhotoBox({ src, size = 120 }: { src?: string; size?: number }) {
  return (
    <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: '8px', border: `1px solid ${neutral[200]}`, bgcolor: neutral[100], overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt="Item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOutlinedIcon sx={{ fontSize: size / 3, color: neutral[400] }} />}
    </Box>
  );
}

export function PhotoInput({ label = 'Item Image / Photo', value, onChange, change, req }: { label?: string; value?: string; onChange: (v?: string) => void; change?: 'new' | 'changed'; req?: string }) {
  return (
    <FieldShell label={label} change={change} req={req}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <PhotoBox src={value} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Button component="label" size="small" variant="outlined">
            {value ? 'Change photo' : 'Upload photo'}
            <input hidden type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) onChange(URL.createObjectURL(file)); }} />
          </Button>
          {value && <Button size="small" variant="text" color="error" onClick={() => onChange(undefined)}>Remove</Button>}
          <Text type="s5" color="theme.secondary.700">PNG or JPG, shown on the record</Text>
        </Box>
      </Box>
    </FieldShell>
  );
}

/** Brand / Model / Engine Number / Capacity and the asset value group (form). Mandatory for serialized items. */
export function SerializedFields({ f, upd, errors, req, withNotDepreciable, hideValues }: { f: Record<string, any>; upd: (patch: Record<string, any>) => void; errors: Errors; req: string; withNotDepreciable?: boolean; hideValues?: boolean }) {
  const s = (k: string) => (v: string) => upd({ [k]: v });
  return (
    <>
      <FormGrid>
        <TextInput label="Brand" required change="new" req={req} value={f.brand} onChange={s('brand')} error={errors.brand} />
        <TextInput label="Model" required change="new" req={req} value={f.model} onChange={s('model')} error={errors.model} />
        <TextInput label="Engine Number" required change="new" req={req} value={f.engineNo} onChange={s('engineNo')} error={errors.engineNo} />
        <TextInput label="Capacity" required change="new" req={req} value={f.capacity} onChange={s('capacity')} error={errors.capacity} hint="e.g. 500 KVA, 40 Ton" />
      </FormGrid>
      {hideValues ? <Box sx={{ mt: 2 }}><Text type="s5" color="theme.secondary.700">Purchase and asset value details do not apply to Cross-Hired assets, which are costed instead of depreciated.</Text></Box> : <Box sx={{ mt: 3 }}>
        <Text type="s3" weight="medium" sx={{ mb: 1.5 }}>Asset Value Details</Text>
        <FormGrid>
          <DateInput label="Purchase Date" required change="new" req={req} value={f.purchaseDate} onChange={s('purchaseDate')} error={errors.purchaseDate} />
          <NumberInput label="Asset Value (AED)" required change="new" req={req} value={f.assetValue} error={errors.assetValue}
            onChange={(v) => upd({ assetValue: v, ...deriveDepreciation(v, f.nbv) })} />
          {withNotDepreciable && <NumberInput label="Not Depreciable Value (AED)" change="new" req={req} value={f.notDepreciable} onChange={s('notDepreciable')} />}
          <NumberInput label="Current Net Book Value (AED)" required change="new" req={req} value={f.nbv} error={errors.nbv}
            onChange={(v) => upd({ nbv: v, ...deriveDepreciation(f.assetValue, v) })} />
          <NumberInput label="Depreciation %" required change="new" req={req} value={f.deprPct} onChange={s('deprPct')} error={errors.deprPct} />
          <NumberInput label="Depreciated Amount (AED)" required change="new" req={req} value={f.deprAmount} onChange={s('deprAmount')} error={errors.deprAmount} />
          <NumberInput label="CapEx Value (AED)" required change="new" req={req} value={f.capex} onChange={s('capex')} error={errors.capex} />
        </FormGrid>
      </Box>}
    </>
  );
}

/** Read-only counterpart used on the view pages. */
export function SerializedView({ r, req }: { r: Record<string, any>; req: string }) {
  return (
    <>
      <ValueGrid cols={4}>
        <ValueField label="Brand" value={r.brand} change="new" req={req} />
        <ValueField label="Model" value={r.model} change="new" req={req} />
        <ValueField label="Engine Number" value={r.engineNo} change="new" req={req} />
        <ValueField label="Capacity" value={r.capacity} change="new" req={req} />
      </ValueGrid>
      <Box sx={{ mt: 3 }}>
        <Text type="s3" weight="medium" sx={{ mb: 1.5 }}>Asset Value Details</Text>
        <ValueGrid cols={4}>
          <ValueField label="Purchase Date" value={r.purchaseDate} change="new" req={req} />
          <ValueField label="Asset Value" value={aed(r.assetValue)} change="new" req={req} />
          {r.notDepreciable !== undefined && <ValueField label="Not Depreciable Value" value={aed(r.notDepreciable)} change="new" req={req} />}
          <ValueField label="Current Net Book Value" value={aed(r.nbv)} change="new" req={req} />
          <ValueField label="Depreciation %" value={r.deprPct === undefined ? undefined : `${r.deprPct}%`} change="new" req={req} />
          <ValueField label="Depreciated Amount" value={aed(r.deprAmount)} change="new" req={req} />
          <ValueField label="CapEx Value" value={aed(r.capex)} change="new" req={req} />
        </ValueGrid>
      </Box>
    </>
  );
}

export function FileList({ names }: { names?: string[] }) {
  if (!names?.length) return <Text type="s5" color="theme.secondary.700">No files attached</Text>;
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{names.map((n) => <Box key={n} sx={{ px: 1.25, py: 0.5, borderRadius: '4px', bgcolor: neutral[200] }}><Text type="s5">{n}</Text></Box>)}</Box>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Text type="s5" color="theme.secondary.700" sx={{ mb: 1.5 }}>{children}</Text>;
}

export const REQ_ATTR = 'Category Master > Custom Attributes';

/** Renders the custom attributes configured on the selected Category / Sub-Category (dynamic, no code change). */
export function AttributeFields({ defs, values, onChange, errors }: { defs: AttributeDef[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void; errors: Errors }) {
  if (!defs.length) return null;
  const set = (id: string) => (v: string) => onChange({ ...values, [id]: v });
  return (
    <FormSection title="Category Attributes" change="new" req={REQ_ATTR}>
      <FormGrid>
        {defs.map((d) => {
          const common = { label: d.name, required: d.required, value: values[d.id] ?? '', onChange: set(d.id), error: errors["attr:" + d.id], change: 'new' as const, req: REQ_ATTR };
          if (d.type === 'Number') return <NumberInput key={d.id} {...common} />;
          if (d.type === 'Date') return <DateInput key={d.id} {...common} />;
          if (d.type === 'Picklist') return <SelectInput key={d.id} {...common} options={d.options.split(',').map((o) => o.trim()).filter(Boolean)} />;
          return <TextInput key={d.id} {...common} />;
        })}
      </FormGrid>
    </FormSection>
  );
}

export function validateAttrs(defs: AttributeDef[], values: Record<string, string>): Errors {
  const e: Errors = {};
  defs.forEach((d) => { if (d.required && isBlank(values[d.id])) e["attr:" + d.id] = d.name + ' is required'; });
  return e;
}

export function AttributeValues({ defs, values }: { defs: AttributeDef[]; values?: Record<string, string> }) {
  if (!defs.length) return null;
  return (
    <ValueGrid cols={4}>
      {defs.map((d) => <ValueField key={d.id} label={d.name} value={values?.[d.id]} change="new" req={REQ_ATTR} />)}
    </ValueGrid>
  );
}
