import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { PageTitle, Page } from '@/components/PageHeader';
import type { ModuleDef } from '@/types';

// PLACEHOLDER: replaced by the module builder.
const mod: ModuleDef = {
  id: 'accounting',
  label: 'Accounting & Finance',
  basePath: '/accounting',
  icon: <AccountBalanceOutlinedIcon />,
  tileBg: 'rgba(102,215,113,.10)',
  menu: [{ label: 'Dashboard', path: '/accounting', icon: <AccountBalanceOutlinedIcon /> }],
  routes: [{ index: true, element: <Page><PageTitle title="Accounting & Finance" /></Page> }],
  changes: [],
};
export default mod;
