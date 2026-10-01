import { createTheme } from '@mui/material/styles';
import { primaryGreen, green, olive, neutral, error } from './color';

// Mirrors createLightTheme() from the existing ERP (packages/common/src/theme/theme-impl.tsx)
export const theme = createTheme({
  palette: {
    contrastThreshold: 2,
    primary: { main: primaryGreen[800], light: primaryGreen[600], dark: primaryGreen[800], contrastText: neutral[100] },
    grey: { ...neutral, 50: '#FFFFFF' } as any,
    warning: { main: olive[700], light: olive[500], dark: olive[700], contrastText: '#fff' },
    error: { main: error[600], light: error[300], dark: error[700], contrastText: '#fff' },
    success: { main: green[700], light: green[500], dark: green[700], contrastText: '#fff' },
    background: { default: '#ffffff' },
    text: { primary: neutral[1000], secondary: neutral[800] },
  },
  typography: { fontFamily: 'Inter, sans-serif', fontSize: 14 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { textAlign: 'left' }, a: { textDecoration: 'none', color: 'inherit', cursor: 'pointer' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.25rem 0.75rem', lineHeight: '1.25rem', letterSpacing: '-0.01875rem', borderRadius: 4 },
        containedPrimary: { backgroundColor: primaryGreen[700], color: '#fff', '&:hover': { backgroundColor: primaryGreen[800] } },
        outlined: { color: neutral[1000], backgroundColor: '#fff', border: 'none', boxShadow: '0 0 2px #E0E0E0, 0 1px 4px -2px rgba(24,39,75,.02), 0 4px 4px -2px rgba(24,39,75,.06)', '&:hover': { border: 'none', backgroundColor: '#fff' } },
        text: { color: neutral[1000], '&:hover': { color: primaryGreen[700], backgroundColor: 'transparent' } },
        containedError: { backgroundColor: error[500], '&:hover': { backgroundColor: error[600] } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderRadius: '0.25rem', '& fieldset': { borderColor: neutral[400] }, '&:hover fieldset': { borderColor: neutral[500] }, '&.Mui-focused fieldset': { borderColor: primaryGreen[700], borderWidth: 1 }, '&.Mui-disabled': { backgroundColor: neutral[200] } },
        input: { padding: '8.5px 12px' },
      },
    },
    MuiSelect: { styleOverrides: { select: { '&.MuiSelect-select': { padding: '8.5px 14px', minHeight: '1.4375em' } } } },
    MuiMenu: { styleOverrides: { paper: { boxShadow: 'none', border: '1px solid #e0e0e0', borderRadius: 8, marginTop: 4 }, list: { padding: '0.25rem' } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.875rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginTop: '0.125rem', marginBottom: '0.125rem', '&.Mui-selected': { color: primaryGreen[700], fontWeight: 500, backgroundColor: primaryGreen[100] } } } },
    MuiDialog: { defaultProps: { transitionDuration: 250 }, styleOverrides: { paper: { borderRadius: '1rem' } } },
    MuiDialogTitle: { styleOverrides: { root: { backgroundColor: neutral[100], borderBottom: `1px solid ${neutral[200]}`, padding: '10px 24px', fontSize: '1rem', fontWeight: 500 } } },
    MuiDialogActions: { styleOverrides: { root: { backgroundColor: neutral[200], padding: '8px 24px' } } },
    MuiTabs: { styleOverrides: { root: { minHeight: '2.25rem', borderBottom: '1px solid #F3F2F2' }, indicator: { backgroundColor: primaryGreen[700] } } },
    MuiTab: { styleOverrides: { root: { minHeight: '2.25rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', color: neutral[700], '&.Mui-selected': { color: neutral[900] }, '&:hover': { backgroundColor: '#f5f6f5' } } } },
    MuiTableCell: { styleOverrides: { root: { fontSize: '0.8125rem', padding: '6px 10px', borderBottom: '1px solid #efefef', borderRight: '1px solid #efefef', '&:first-of-type': { borderLeft: '1px solid #efefef' } }, head: { fontSize: '0.875rem', fontWeight: 500, backgroundColor: neutral[100], whiteSpace: 'nowrap' } } },
    MuiChip: { styleOverrides: { root: { fontSize: 12, borderRadius: '0.25rem', height: 24 } } },
    MuiAccordion: { styleOverrides: { root: { boxShadow: 'none', '&:before': { display: 'none' } } } },
  },
});
