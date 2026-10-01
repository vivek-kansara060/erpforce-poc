import { Box } from '@mui/material';
import { primaryGreen, blue, olive, red, neutral, magenta, green } from '@/theme/color';

type Tone = { bg: string; color: string };
const TONES: Record<string, Tone> = {
  green: { bg: primaryGreen[200], color: primaryGreen[900] },
  blue: { bg: blue[200], color: blue[900] },
  amber: { bg: olive[200], color: olive[900] },
  red: { bg: red[200], color: red[900] },
  grey: { bg: neutral[200], color: neutral[900] },
  magenta: { bg: magenta[300], color: magenta[1000] },
  dark: { bg: neutral[800], color: neutral[100] },
  teal: { bg: green[200], color: green[900] },
};

const RULES: [RegExp, keyof typeof TONES][] = [
  [/(reject|cancel|unpaid|lost|inactive|disabled|breakdown|damage|mismatch|expired|overdue|blacklist|failed|terminated|disposed|unqualified|blocked|stuck|delayed|escalat|breach)/i, 'red'],
  [/(partial|hold|maintenance|follow|yard|off hire|off-hire|pending inspection|warning|due soon|expiring|revised|idle|low|under review|verbal|written)/i, 'amber'],
  [/(draft|new$|not started|n\/a)/i, 'grey'],
  [/(approved|paid|complete|convert|active|deliver|ready|accept|received|validated|matched|passed|posted|resolved|won|confirmed|closed|fully|available|acknowledged|running|processed|free|generated|superseded)/i, 'green'],
  [/(pending|submit|open|progress|scheduled|on hire|on-hire|quoted|qualified|contacted|assigned|en route|dispatched|requested|sent|in transit|enquiry|allocated|invited|awaiting)/i, 'blue'],
];

export function toneFor(status: string): Tone {
  for (const [re, tone] of RULES) if (re.test(status)) return TONES[tone];
  return TONES.grey;
}

export function StatusChip({ status, tone }: { status: string; tone?: keyof typeof TONES }) {
  const t = tone ? TONES[tone] : toneFor(status);
  return (
    <Box component="span" sx={{ display: 'inline-block', px: '8px', py: '2px', borderRadius: '4px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.color }}>
      {status}
    </Box>
  );
}
