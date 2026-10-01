import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import App from './App';
import { theme } from './theme/theme';
import { ReviewModeProvider } from './components/ChangeTag';
import './theme/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} autoHideDuration={4000}>
        <ReviewModeProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ReviewModeProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
