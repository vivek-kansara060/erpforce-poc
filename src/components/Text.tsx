import { Typography, type TypographyProps } from '@mui/material';

/** Mirrors the existing ERP Typography wrapper: h1-h5 and s1-s5 sizes, normal/medium/bold weights. */
const SIZES = {
  h1: ['1.75rem', '-0.035rem'], h2: ['1.5rem', '-0.03rem'], h3: ['1.25rem', '-0.025rem'], h4: ['1.125rem', '-0.0225rem'], h5: ['1rem', '-0.02rem'],
  s1: ['1.125rem', '-0.02rem'], s2: ['1rem', '-0.02rem'], s3: ['0.875rem', '-0.0175rem'], s4: ['0.8125rem', '-0.01625rem'], s5: ['0.75rem', '-0.015rem'],
} as const;
const WEIGHTS = { normal: 400, medium: 500, bold: 600 } as const;

export function Text({ type = 's3', weight = 'normal', color = 'theme.secondary.1000', sx, ...rest }: { type?: keyof typeof SIZES; weight?: keyof typeof WEIGHTS } & Omit<TypographyProps, 'variant'>) {
  const [size, ls] = SIZES[type];
  const resolved = color === 'theme.secondary.1000' ? '#1F2125' : color === 'theme.secondary.800' ? '#656669' : color === 'theme.secondary.700' ? '#7B7C7F' : color === 'theme.secondary.600' ? '#919294' : color;
  return <Typography {...rest} sx={{ fontSize: size, letterSpacing: ls, fontWeight: WEIGHTS[weight], lineHeight: 1.4, color: resolved, ...sx }} />;
}
