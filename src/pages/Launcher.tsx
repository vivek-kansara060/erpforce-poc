import { Link } from 'react-router-dom';
import { Box } from '@mui/material';
import { Text } from '@/components/Text';
import { modules } from '@/modules';
import { neutral } from '@/theme/color';

/** Module launcher (existing /dashboard): heading + wrapped module tiles. */
export function Launcher() {
  return (
    <Box sx={{ px: { xs: 3, md: '8.25rem' }, py: 4 }}>
      <Text type="h2" weight="medium">Welcome, Ahmed</Text>
      <Text type="s3" color="theme.secondary.800" sx={{ mb: 3, mt: 0.5 }}>Select a module to continue</Text>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {modules.map((m) => (
          <Box key={m.id} component={Link} to={m.basePath} sx={{ width: '10.25rem', p: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRadius: '12px', '&:hover': { bgcolor: neutral[100] } }}>
            <Box sx={{ width: '6.25rem', height: '6.25rem', borderRadius: '0.75rem', bgcolor: m.tileBg, display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 44, color: neutral[900] } }}>{m.icon}</Box>
            <Text type="s3" sx={{ textAlign: 'center' }}>{m.label}</Text>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 6, p: 2, border: `1px solid ${neutral[200]}`, borderRadius: '8px', maxWidth: 760 }}>
        <Text type="s3" weight="medium">About this design POC</Text>
        <Text type="s4" color="theme.secondary.800" sx={{ mt: 0.5 }}>
          This is the existing ERP with only the changes from the Heavy Equipment Rental requirement document applied. Use <b>Review mode</b> (top bar) to highlight what is NEW or CHANGED, and open the <b>Change Register</b> for the full list with requirement references. All data is mock data; there is no backend.
        </Text>
      </Box>
    </Box>
  );
}
