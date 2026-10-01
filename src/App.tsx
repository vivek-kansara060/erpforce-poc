import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { FullscreenLayout, ModuleLayout } from '@/shell/Shell';
import { Launcher } from '@/pages/Launcher';
import { ChangeRegister } from '@/pages/ChangeRegister';
import { modules } from '@/modules';
import { renderRoutes } from '@/routes/renderRoutes';

const Loader = () => <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={50} sx={{ color: '#6FD3A6' }} /></Box>;

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<FullscreenLayout><Launcher /></FullscreenLayout>} />
        <Route path="/change-register" element={<FullscreenLayout><ChangeRegister /></FullscreenLayout>} />
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
