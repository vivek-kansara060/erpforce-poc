import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { FullscreenLayout, ModuleLayout } from '@/shell/Shell';
import { Launcher } from '@/pages/Launcher';
import { ChangeRegister } from '@/pages/ChangeRegister';
import { Changelog } from '@/pages/Changelog';
import { modules } from '@/modules';
import { renderRoutes } from '@/routes/renderRoutes';
import { processAutomatic } from '@/modules/accounting/schedule';

const Loader = () => <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={50} sx={{ color: '#6FD3A6' }} /></Box>;

let schedulerStarted = false;

export default function App() {
  // The scheduler of the existing ERP raises Automatic invoices on their date; in the POC it runs once when the app opens.
  useEffect(() => {
    if (schedulerStarted) return;
    schedulerStarted = true;
    try { processAutomatic(); } catch { /* the POC keeps working without it */ }
  }, []);
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<FullscreenLayout><Launcher /></FullscreenLayout>} />
        <Route path="/change-register" element={<FullscreenLayout><ChangeRegister /></FullscreenLayout>} />
        <Route path="/change-register/changelog" element={<FullscreenLayout><Changelog /></FullscreenLayout>} />
        {modules.map((m) => (
          <Route key={m.id} path={m.basePath} element={<ModuleLayout mod={m} />}>
            {renderRoutes(m.routes)}
          </Route>
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
