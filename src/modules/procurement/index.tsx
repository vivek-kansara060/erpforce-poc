import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'procurement',
  label: 'Procurement',
  basePath: '/procurement',
  icon: <ShoppingCartOutlinedIcon />,
  tileBg: 'rgba(255,125,172,.10)',
  menu: [{ label: 'Dashboard', path: '/procurement', icon: <ShoppingCartOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="Procurement" /></Page> }],
  changes: [],
};
export default mod;
