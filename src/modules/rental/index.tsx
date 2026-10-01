import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'rental',
  label: 'Rental',
  basePath: '/rental',
  icon: <KeyOutlinedIcon />,
  tileBg: 'rgba(0,121,63,.10)',
  menu: [{ label: 'Dashboard', path: '/rental', icon: <KeyOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="Rental" /></Page> }],
  changes: [],
};
export default mod;
