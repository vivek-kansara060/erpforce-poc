import { createTheme } from '@mui/material/styles';
import { primaryGreen, green, olive, neutral, error } from './color';

// Mirrors createLightTheme() from the existing ERP (packages/common/src/theme/theme-impl.tsx)
export const theme = createTheme({
  palette: {
    contrastThreshold: 2,
    primary: { main: primaryGreen[700], light: primaryGreen[600], dark: primaryGreen[800], contrastText: neutral[100] },
    grey: { ...neutral, 50: '#FFFFFF' } as any,
    warning: { main: olive[700], light: olive[500], dark: olive[700], contrastText: '#fff' },
    error: { main: error[600], light: error[300], dark: error[700], contrastText: '#fff' },
    success: { main: green[700], light: green[500], dark: green[700], contrastText: '#fff' },
    background: { default: '#FCFCFD' },
    text: { primary: neutral[1000], secondary: neutral[800] },
  },
  typography: { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 13 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { textAlign: 'left' }, a: { textDecoration: 'none', color: 'inherit', cursor: 'pointer' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontSize: 13, fontWeight: 500, padding: '0.25rem 0.75rem', lineHeight: '20px', letterSpacing: '-0.003em', borderRadius: '6px' },
        containedPrimary: { backgroundColor: primaryGreen[700], color: '#fff', '&:hover': { backgroundColor: primaryGreen[800] } },
        outlined: { color: neutral[1000], backgroundColor: '#fff', border: 'none', boxShadow: '0 0 2px #E1E3E6, 0 1px 4px -2px rgba(24,39,75,.02), 0 4px 4px -2px rgba(24,39,75,.06)', '&:hover': { border: 'none', backgroundColor: '#fff' } },
        text: { color: neutral[1000], '&:hover': { color: primaryGreen[700], backgroundColor: 'transparent' } },
        containedError: { backgroundColor: error[500], '&:hover': { backgroundColor: error[600] } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: 13, borderRadius: '6px', '& fieldset': { borderColor: neutral[400] }, '&:hover fieldset': { borderColor: neutral[500] }, '&.Mui-focused fieldset': { borderColor: primaryGreen[700], borderWidth: 1 }, '&.Mui-disabled': { backgroundColor: neutral[200] } },
        input: { padding: '8.5px 12px' },
      },
    },
    MuiSelect: { styleOverrides: { select: { '&.MuiSelect-select': { padding: '8.5px 14px', minHeight: '1.4375em' } } } },
    MuiMenu: { styleOverrides: { paper: { boxShadow: 'none', border: '1px solid #E1E3E6', borderRadius: 8, marginTop: 4 }, list: { padding: '0.25rem' } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: 13, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginTop: '0.125rem', marginBottom: '0.125rem', '&.Mui-selected': { color: primaryGreen[700], fontWeight: 500, backgroundColor: primaryGreen[100] } } } },
    MuiDialog: { defaultProps: { transitionDuration: 250 }, styleOverrides: { paper: { borderRadius: '10px' } } },
    MuiDialogTitle: { styleOverrides: { root: { backgroundColor: neutral[100], borderBottom: `1px solid ${neutral[200]}`, padding: '10px 24px', fontSize: 15, fontWeight: 600, letterSpacing: '-0.011em' } } },
    MuiDialogActions: { styleOverrides: { root: { backgroundColor: neutral[200], padding: '8px 24px' } } },
    MuiTabs: { styleOverrides: { root: { minHeight: '2.25rem', borderBottom: '1px solid #ECEDEF' }, indicator: { backgroundColor: primaryGreen[700] } } },
    MuiTab: { styleOverrides: { root: { minHeight: '2.25rem', padding: '0.5rem 1rem', fontSize: 13, fontWeight: 500, textTransform: 'none', color: neutral[700], '&.Mui-selected': { color: neutral[900] }, '&:hover': { backgroundColor: '#F2F3F5' } } } },
    MuiTableCell: { styleOverrides: { root: { fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #ECEDEF', borderRight: '1px solid #ECEDEF', '&:first-of-type': { borderLeft: '1px solid #ECEDEF' } }, head: { fontSize: 12, fontWeight: 600, backgroundColor: neutral[100], whiteSpace: 'nowrap' } } },
    MuiChip: { styleOverrides: { root: { fontSize: 12, borderRadius: '0.25rem', height: 24 } } },
    MuiAccordion: { styleOverrides: { root: { boxShadow: 'none', '&:before': { display: 'none' } } } },
  },
});
