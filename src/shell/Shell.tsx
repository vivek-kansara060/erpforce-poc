import { useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Avatar, Box, Collapse, Divider, Drawer, FormControlLabel, IconButton, InputAdornment, List, ListItemButton, MenuItem, Select, Switch, TextField, Toolbar, Tooltip, Badge } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import { Text } from '@/components/Text';
import { ChangeTag, useReviewMode } from '@/components/ChangeTag';
import { neutral, primaryGreen } from '@/theme/color';
import type { MenuItem as Menu, ModuleDef } from '@/types';
import { changedMenu, visibleModules } from '@/modules';
import { NotificationBell } from './NotificationBell';

const DRAWER = 300;
const COLLAPSED = 65;

export function Logo({ height = 34 }: { height?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: height, height, borderRadius: '8px', bgcolor: primaryGreen[800], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: height * 0.5 }}>E</Box>
      <Text type="s1" weight="bold" sx={{ letterSpacing: '-0.03rem' }}>ERPForce</Text>
    </Box>
  );
}

function TopBar({ mod, drawerWidth, launcher }: { mod?: ModuleDef; drawerWidth: number; launcher?: boolean }) {
  const nav = useNavigate();
  const { enabled, toggle } = useReviewMode();
  return (
    <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#FBFBFB', color: neutral[1000], borderBottom: `1px solid ${neutral[200]}`, width: launcher ? '100%' : `calc(100% - ${drawerWidth}px)`, ml: launcher ? 0 : `${drawerWidth}px`, transition: 'width .2s, margin .2s' }}>
      <Toolbar sx={{ minHeight: '75px !important', gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {launcher ? <Logo height={36} /> : (
            <>
              {/* Same as the existing ERP header (window.history.back()); falls back to the module screen when there is no earlier in-app page, e.g. a link opened in a new tab. */}
              <Tooltip title="Back"><IconButton size="small" onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))}><KeyboardBackspaceIcon sx={{ color: neutral[1000] }} /></IconButton></Tooltip>
              <Select size="small" variant="standard" disableUnderline value={visibleModules.some((x) => x.id === mod?.id) ? mod?.id : ''} onChange={(e) => { const m = visibleModules.find((x) => x.id === e.target.value); if (m) nav(m.basePath); }} sx={{ minWidth: 250, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, fontWeight: 500, py: 1 } }}>
                {visibleModules.map((m) => <MenuItem key={m.id} value={m.id} sx={{ gap: 1 }}><Box sx={{ display: 'flex', '& svg': { fontSize: 20 } }}>{m.icon}</Box>{m.label}</MenuItem>)}
              </Select>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Review Mode highlights everything that differs from the existing ERP (NEW / CHANGED). Turn it off to see the ERP as it will be used.">
            <FormControlLabel sx={{ mr: 0 }} control={<Switch size="small" color="primary" checked={enabled} onChange={toggle} />} label={<Text type="s4" weight="medium">Review mode</Text>} />
          </Tooltip>
          <Box component={Link} to="/change-register" sx={{ px: 1.25, py: 0.5, borderRadius: '4px', fontSize: 13, fontWeight: 500, bgcolor: '#fff', boxShadow: '0 0 2px #E0E0E0', '&:hover': { color: primaryGreen[700] } }}>Change Register</Box>
          <NotificationBell />
          <HelpOutlineIcon sx={{ color: neutral[700] }} />
          <Divider orientation="vertical" flexItem />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar variant="rounded" sx={{ width: 32, height: 32, bgcolor: primaryGreen[200], color: primaryGreen[800], fontSize: 13, fontWeight: 600, borderRadius: '8px' }}>AK</Avatar>
            <Box><Text type="s3" weight="medium" color="#232529" sx={{ lineHeight: 1.2 }}>Ahmed Al Khouri</Text><Text type="s5" color="#A7A8A9" sx={{ lineHeight: 1.2 }}>General Manager</Text></Box>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function isActive(path: string | undefined, current: string, base: string) {
  if (!path) return false;
  if (path === base) return current === base || current === base + '/';
  return current === path || current.startsWith(path + '/');
}
function hasActive(item: Menu, current: string, base: string): boolean {
  return isActive(item.path, current, base) || !!item.children?.some((c) => hasActive(c, current, base));
}
function filterMenu(items: Menu[], q: string): Menu[] {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.flatMap((i) => {
    const kids = i.children ? filterMenu(i.children, q) : undefined;
    if (i.label.toLowerCase().includes(s)) return [i];
    return kids && kids.length ? [{ ...i, children: kids }] : [];
  });
}

function MenuNode({ item, depth, current, base, collapsed, forceOpen }: { item: Menu; depth: number; current: string; base: string; collapsed: boolean; forceOpen: boolean }) {
  const active = hasActive(item, current, base);
  const [open, setOpen] = useState(active);
  const sel = isActive(item.path, current, base) && !item.children;
  const label = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, pl: depth * 1.5 }}>
      {item.icon ? <Box sx={{ display: 'flex', color: sel || (active && depth === 0) ? primaryGreen[800] : neutral[700], '& svg': { fontSize: 20 } }}>{item.icon}</Box> : depth === 0 ? <ChevronRightIcon sx={{ fontSize: 20, color: neutral[600] }} /> : <Box sx={{ width: 20 }} />}
      {!collapsed && (
        <Text type="s3" weight={depth === 0 || sel ? 'medium' : 'normal'} sx={{ fontSize: depth === 0 ? '0.875rem' : '0.8125rem', color: sel ? primaryGreen[800] : '#1F2125', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}<ChangeTag kind={item.change} req="Sidebar entry" />
        </Text>
      )}
    </Box>
  );
  const btnSx = { minHeight: 32, borderRadius: '16px', gap: 1, px: 1.5, '&.Mui-selected': { bgcolor: primaryGreen[100], '&:hover': { bgcolor: primaryGreen[200] } } };
  const content = item.children ? (
    <>
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <ListItemButton selected={false} sx={btnSx} onClick={() => setOpen(!open)}>
          {label}
          {!collapsed && (open || forceOpen ? <ExpandLessIcon sx={{ fontSize: 20, color: neutral[600] }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: neutral[600] }} />)}
        </ListItemButton>
      </Tooltip>
      {!collapsed && <Collapse in={open || forceOpen} unmountOnExit><List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px', mt: '2px' }}>{item.children.map((c) => <MenuNode key={c.label} item={c} depth={depth + 1} current={current} base={base} collapsed={collapsed} forceOpen={forceOpen} />)}</List></Collapse>}
    </>
  ) : (
    <Tooltip title={collapsed ? item.label : ''} placement="right">
      <ListItemButton component={Link} to={item.path ?? '#'} selected={sel} sx={btnSx}>{label}</ListItemButton>
    </Tooltip>
  );
  return <Box>{content}</Box>;
}

function SideBar({ mod, open, onToggle }: { mod: ModuleDef; open: boolean; onToggle: () => void }) {
  const loc = useLocation();
  const [q, setQ] = useState('');
  const items = useMemo(() => filterMenu(changedMenu(mod.menu), q), [mod, q]);
  const w = open ? DRAWER : COLLAPSED;
  return (
    <Drawer variant="permanent" sx={{ width: w, flexShrink: 0, transition: 'width .2s', '& .MuiDrawer-paper': { width: w, transition: 'width .2s', bgcolor: '#FBFBFB', borderRight: `1px solid ${neutral[200]}`, overflowX: 'hidden' } }}>
      <Box sx={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', px: open ? 2 : 0, borderBottom: `1px solid ${neutral[200]}` }}>
        {open ? <Logo /> : <Logo height={34} />}
      </Box>
      <IconButton onClick={onToggle} size="small" sx={{ position: 'fixed', top: 64.5, left: w - 1, zIndex: 1201, width: 30, height: 30, bgcolor: 'rgba(0,0,0,.04)', borderRadius: '0 8px 8px 0', transition: 'left .2s' }}>
        {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
      {open && (
        <Box sx={{ px: 1.5, py: 1.5, borderBottom: `1px solid ${neutral[200]}` }}>
          <TextField fullWidth size="small" placeholder="Search menu..." value={q} onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: neutral[600] }} /></InputAdornment>, sx: { bgcolor: neutral[200], borderRadius: '0.5rem', '& fieldset': { border: 'none' } } }} />
        </Box>
      )}
      <List sx={{ p: '0.75rem 0.5rem 1.5rem', pt: 1.5, display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {items.map((i) => <MenuNode key={i.label} item={i} depth={0} current={loc.pathname} base={mod.basePath} collapsed={!open} forceOpen={!!q} />)}
      </List>
      {open && <Box sx={{ mt: 'auto', p: 1.5, borderTop: `1px solid ${neutral[200]}` }}><Text type="s5" color="theme.secondary.600">Design POC: mock data, no backend</Text></Box>}
    </Drawer>
  );
}

export function ModuleLayout({ mod }: { mod: ModuleDef }) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <TopBar mod={mod} drawerWidth={open ? DRAWER : COLLAPSED} />
      <SideBar mod={mod} open={open} onToggle={() => setOpen(!open)} />
      <Box component="main" className="main-wrapper" sx={{ mt: '4.6875rem', flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <TopBar drawerWidth={0} launcher />
      <Box component="main" className="main-wrapper" sx={{ mt: '4.6875rem' }}>{children}</Box>
    </Box>
  );
}

export { Badge };
