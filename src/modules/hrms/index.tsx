import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'hrms',
  label: 'HRMS',
  basePath: '/hrms',
  icon: <BadgeOutlinedIcon />,
  tileBg: 'rgba(75,179,255,.10)',
  menu: [{ label: 'Dashboard', path: '/hrms', icon: <BadgeOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="HRMS" /></Page> }],
  changes: [],
};
export default mod;
