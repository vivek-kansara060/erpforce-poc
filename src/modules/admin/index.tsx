import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'admin',
  label: 'User & Administration',
  basePath: '/admin',
  icon: <AdminPanelSettingsOutlinedIcon />,
  tileBg: 'rgba(204,172,255,.10)',
  menu: [{ label: 'Dashboard', path: '/admin', icon: <AdminPanelSettingsOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="User & Administration" /></Page> }],
  changes: [],
};
export default mod;
