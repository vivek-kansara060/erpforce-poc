import { Box } from '@mui/material';

// ERPForce DS v2.0 pills: semantic *-bg / *-fg-strong and tag tones (project_design/styles/components.css .pill)
type Tone = { bg: string; color: string };
const TONES: Record<string, Tone> = {
  green: { bg: '#D8F3EB', color: '#07543F' },
  blue: { bg: '#E6EEF9', color: '#133A7E' },
  amber: { bg: '#FEF1DD', color: '#5C3604' },
  red: { bg: '#FBE3E5', color: '#7A1A1F' },
  grey: { bg: '#ECEDEF', color: '#3D4046' },
  magenta: { bg: '#FBE4F1', color: '#9D2B6F' },
  dark: { bg: '#25272C', color: '#FFFFFF' },
  teal: { bg: '#DDF3F1', color: '#156B66' },
};

const RULES: [RegExp, keyof typeof TONES][] = [
  [/(reject|cancel|unpaid|lost|inactive|disabled|breakdown|damage|mismatch|expired|overdue|blacklist|failed|terminated|disposed|unqualified|blocked|stuck|delayed|escalat|breach)/i, 'red'],
  [/(partial|hold|maintenance|follow|yard|off hire|off-hire|pending inspection|warning|due soon|expiring|revised|idle|low|under review|verbal|written)/i, 'amber'],
  [/(draft|new$|not started|n\/a)/i, 'grey'],
  [/(approved|paid|complete|convert|active|deliver|ready|accept|received|validated|matched|passed|posted|resolved|won|confirmed|closed|fully|available|acknowledged|running|processed|free|generated|superseded|in service)/i, 'green'],
  [/(pending|submit|open|progress|scheduled|on hire|on-hire|quoted|qualified|contacted|assigned|en route|dispatched|requested|sent|in transit|enquiry|allocated|invited|awaiting)/i, 'blue'],
];

export function toneFor(status: string): Tone {
  for (const [re, tone] of RULES) if (re.test(status)) return TONES[tone];
  return TONES.grey;
}

export function StatusChip({ status, tone }: { status: string; tone?: keyof typeof TONES }) {
  const t = tone ? TONES[tone] : toneFor(status);
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: 22, px: '8px', borderRadius: '4px', fontSize: 12, fontWeight: 500, letterSpacing: 0, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.color, '&::before': { content: '\"\"', width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor', flexShrink: 0 } }}>
      {status}
    </Box>
  );
}
