import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'crm',
  label: 'CRM / Sales',
  basePath: '/crm',
  icon: <PeopleAltOutlinedIcon />,
  tileBg: 'rgba(111,102,215,.10)',
  menu: [{ label: 'Dashboard', path: '/crm', icon: <PeopleAltOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="CRM / Sales" /></Page> }],
  changes: [],
};
export default mod;
