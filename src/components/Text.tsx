import { Typography, type TypographyProps } from '@mui/material';

/** Mirrors the existing ERP Typography wrapper: h1-h5 and s1-s5 sizes, normal/medium/bold weights. */
const SIZES = {
  h1: ['26px', '-0.018em'], h2: ['22px', '-0.011em'], h3: ['18px', '-0.011em'], h4: ['15px', '-0.011em'], h5: ['14px', '-0.011em'],
  s1: ['15px', '-0.011em'], s2: ['14px', '-0.003em'], s3: ['13px', '-0.003em'], s4: ['12px', '-0.003em'], s5: ['11px', '0'],
} as const;
const WEIGHTS = { normal: 400, medium: 500, bold: 600 } as const;

export function Text({ type = 's3', weight = 'normal', color = 'theme.secondary.1000', sx, ...rest }: { type?: keyof typeof SIZES; weight?: keyof typeof WEIGHTS } & Omit<TypographyProps, 'variant'>) {
  const [size, ls] = SIZES[type];
  const resolved = color === 'theme.secondary.1000' ? '#15171B' : color === 'theme.secondary.800' ? '#3D4046' : color === 'theme.secondary.700' ? '#6D7178' : color === 'theme.secondary.600' ? '#767B83' : color;
  return <Typography {...rest} sx={{ fontSize: size, letterSpacing: ls, fontWeight: WEIGHTS[weight], lineHeight: 1.35, color: resolved, ...sx }} />;
}
