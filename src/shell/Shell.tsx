import { useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Avatar, Badge, Box, Collapse, Dialog, Divider, Drawer, FormControlLabel, IconButton, InputAdornment, List, ListItemButton, Switch, TextField, Toolbar, Tooltip } from '@mui/material';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { ChangeTag, useReviewMode } from '@/components/ChangeTag';
import type { MenuItem as Menu, ModuleDef } from '@/types';
import { changedMenu, visibleModules } from '@/modules';
import { NotificationBell } from './NotificationBell';

// Dimensions follow ERPForce DS v2.0 (--sidebar-w 220, --sidebar-w-mini 56, --topbar-h 44)
const DRAWER = 220;
const COLLAPSED = 56;
const TOPBAR = 44;

// DS tag tones for the module icon tiles (project_design/styles/appswitcher.css .as-ic--*)
const TILE_TONES = [
  { bg: '#E2F5EC', fg: '#1A6B43' }, { bg: '#E6EEF9', fg: '#1F4FA8' }, { bg: '#FEF1DD', fg: '#8A540B' }, { bg: '#DDF3F1', fg: '#156B66' },
  { bg: '#EFE9FC', fg: '#5535B8' }, { bg: '#FCE5E8', fg: '#A8232A' }, { bg: '#FBE4F1', fg: '#9D2B6F' }, { bg: '#ECEDEF', fg: '#3D4046' },
];

export function Logo({ height = 24 }: { height?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Box sx={{ width: height, height, borderRadius: '6px', bgcolor: '#2EB273', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: Math.round(height * 0.5), letterSpacing: '-0.04em', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)', flexShrink: 0 }}>E</Box>
      <Box sx={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: '#15171B' }}><Box component="b" sx={{ color: '#2EB273' }}>ERP</Box>Force</Box>
    </Box>
  );
}

/** Module switcher (DS AppSwitcher): search + tinted tile grid, opened from the grid button beside the title. */
function ModuleSwitcher({ open, onClose, currentId }: { open: boolean; onClose: () => void; currentId?: string }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const list = visibleModules.filter((m) => m.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onExited: () => setQ('') }}
      PaperProps={{ sx: { width: 540, maxWidth: '100%', borderRadius: '10px', border: '1px solid #E1E3E6', borderTop: '3px solid #001866', boxShadow: '0 24px 48px -12px rgba(15,17,21,.22), 0 8px 16px -4px rgba(15,17,21,.08)', m: 2, alignSelf: 'flex-start', mt: '11vh' } }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(15,17,21,.56)', backdropFilter: 'blur(3px)' } } }}>
      <Box sx={{ p: '12px 14px 10px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', height: 38, px: '12px', bgcolor: '#F2F3F5', border: '1px solid #E1E3E6', borderRadius: '8px', '&:focus-within': { borderColor: '#2EB273', boxShadow: '0 0 0 3px rgba(46,178,115,.18)', bgcolor: '#fff' } }}>
          <SearchIcon sx={{ fontSize: 16, color: '#6D7178' }} />
          <Box component="input" autoFocus value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} placeholder="Search modules" aria-label="Search modules"
            sx={{ flex: 1, minWidth: 0, border: 0, bgcolor: 'transparent', outline: 'none', font: 'inherit', fontSize: 13, color: '#15171B', '&::placeholder': { color: '#767B83' } }} />
        </Box>
      </Box>
      <Box sx={{ p: '2px 14px 14px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', py: '10px' }}>
          <Box sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#767B83' }}>All modules</Box>
          <Box sx={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, px: '5px', borderRadius: '9999px', bgcolor: '#ECEDEF', color: '#6D7178', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{list.length}</Box>
        </Box>
        {list.length === 0 ? <Box sx={{ py: 4, textAlign: 'center', fontSize: 12, color: '#6D7178' }}>No modules match "{q}".</Box> : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {list.map((m) => {
              const tone = TILE_TONES[visibleModules.indexOf(m) % TILE_TONES.length];
              const cur = m.id === currentId;
              return (
                <Box key={m.id} component="button" type="button" onClick={() => { onClose(); nav(m.basePath); }}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', p: '12px 10px', border: 0, borderRadius: '8px', textAlign: 'left', cursor: 'pointer', font: 'inherit', bgcolor: cur ? 'rgba(46,178,115,.08)' : 'transparent', '&:hover': { bgcolor: cur ? 'rgba(46,178,115,.12)' : '#F2F3F5' }, '&:focus-visible': { outline: 'none', boxShadow: '0 0 0 3px rgba(46,178,115,.18)' } }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '6px', display: 'grid', placeItems: 'center', bgcolor: tone.bg, color: tone.fg, '& svg': { fontSize: 18 } }}>{m.icon}</Box>
                  <Box sx={{ fontSize: 12, fontWeight: 600, color: '#15171B', lineHeight: 1.3 }}>{m.label}</Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

function TopBar({ mod, drawerWidth, launcher }: { mod?: ModuleDef; drawerWidth: number; launcher?: boolean }) {
  const { enabled, toggle } = useReviewMode();
  return (
    <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#fff', color: '#15171B', borderBottom: '1px solid #ECEDEF', width: launcher ? '100%' : `calc(100% - ${drawerWidth}px)`, ml: launcher ? 0 : `${drawerWidth}px`, transition: 'width .2s, margin .2s' }}>
      <Toolbar disableGutters sx={{ minHeight: `${TOPBAR}px !important`, height: TOPBAR, px: '16px', gap: '10px', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {launcher ? <Logo height={24} /> : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 12, color: '#6D7178' }}>
              ERPForce<ChevronRightIcon sx={{ fontSize: 13, color: '#767B83' }} /><Box component="b" sx={{ color: '#15171B', fontWeight: 600 }}>{mod?.label}</Box>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tooltip title="Review Mode highlights everything that differs from the existing ERP (NEW / CHANGED). Turn it off to see the ERP as it will be used.">
            <FormControlLabel sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 12, fontWeight: 500 } }} control={<Switch size="small" color="primary" checked={enabled} onChange={toggle} />} label="Review mode" />
          </Tooltip>
          <Box component={Link} to="/change-register" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: '10px', borderRadius: '6px', fontSize: 12, fontWeight: 500, color: '#3D4046', bgcolor: '#fff', border: '1px solid #E1E3E6', '&:hover': { bgcolor: '#F2F3F5', color: '#15171B' } }}>Change Register</Box>
          <NotificationBell />
          <HelpOutlineIcon sx={{ fontSize: 18, color: '#6D7178' }} />
          <Divider orientation="vertical" flexItem sx={{ my: '10px' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar variant="rounded" sx={{ width: 24, height: 24, bgcolor: '#E2F5EC', color: '#1A6B43', fontSize: 11, fontWeight: 600, borderRadius: '6px' }}>AK</Avatar>
            <Box><Box sx={{ fontSize: 12, fontWeight: 600, color: '#15171B', lineHeight: 1.25 }}>Ahmed Al Khouri</Box><Box sx={{ fontSize: 11, color: '#6D7178', lineHeight: 1.25 }}>General Manager</Box></Box>
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
  const child = depth > 0;
  const label = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
      {item.icon ? <Box sx={{ display: 'flex', color: sel || (active && depth === 0) ? '#2EB273' : '#6D7178', '& svg': { fontSize: 15 } }}>{item.icon}</Box> : depth === 0 ? <ChevronRightIcon sx={{ fontSize: 15, color: '#6D7178' }} /> : null}
      {!collapsed && (
        <Box component="span" sx={{ fontSize: child ? 12 : 13, fontWeight: sel ? 500 : 400, letterSpacing: '-0.003em', color: sel ? '#15171B' : child ? '#6D7178' : '#3D4046', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}<ChangeTag kind={item.change} req="Sidebar entry" />
        </Box>
      )}
    </Box>
  );
  const btnSx = {
    height: child ? 24 : 26, minHeight: 0, borderRadius: '6px', px: '10px', pl: collapsed ? '10px' : `${10 + depth * 14}px`, gap: '10px', border: '1px solid transparent',
    '&:hover': { bgcolor: '#F2F3F5' },
    '&.Mui-selected': { bgcolor: '#fff', borderColor: '#ECEDEF', boxShadow: '0 1px 0 rgba(15,17,21,.04)', '&:hover': { bgcolor: '#fff' } },
  };
  const content = item.children ? (
    <>
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <ListItemButton selected={false} sx={btnSx} onClick={() => setOpen(!open)}>
          {label}
          {!collapsed && (open || forceOpen ? <ExpandLessIcon sx={{ fontSize: 14, color: '#767B83' }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: '#767B83' }} />)}
        </ListItemButton>
      </Tooltip>
      {!collapsed && <Collapse in={open || forceOpen} unmountOnExit><List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '1px', mt: '1px' }}>{item.children.map((c) => <MenuNode key={c.label} item={c} depth={depth + 1} current={current} base={base} collapsed={collapsed} forceOpen={forceOpen} />)}</List></Collapse>}
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
  const [switcher, setSwitcher] = useState(false);
  const items = useMemo(() => filterMenu(changedMenu(mod.menu), q), [mod, q]);
  const w = open ? DRAWER : COLLAPSED;
  return (
    <Drawer variant="permanent" sx={{ width: w, flexShrink: 0, transition: 'width .2s', '& .MuiDrawer-paper': { width: w, transition: 'width .2s', bgcolor: '#F7F8F9', borderRight: '1px solid #ECEDEF', overflowX: 'hidden' } }}>
      <Box sx={{ height: TOPBAR, minHeight: TOPBAR, display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: '8px', px: open ? '12px' : 0, borderBottom: '1px solid #ECEDEF', flexShrink: 0 }}>
        {open ? <Logo /> : <Tooltip title="Switch module" placement="right"><Box component="button" type="button" onClick={() => setSwitcher(true)} aria-label="Switch module" sx={{ border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer' }}><Logo height={24} /></Box></Tooltip>}
        {open && (
          <Tooltip title="Switch module">
            <IconButton onClick={() => setSwitcher(true)} aria-label="Switch module" disableRipple sx={{ ml: 'auto', width: 22, height: 22, borderRadius: '4px', color: '#767B83', '&:hover': { bgcolor: '#ECEDEF', color: '#3D4046' } }}>
              <GridViewOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <ModuleSwitcher open={switcher} onClose={() => setSwitcher(false)} currentId={mod.id} />
      <IconButton onClick={onToggle} size="small" sx={{ position: 'fixed', top: TOPBAR + 8, left: w - 1, zIndex: 1201, width: 20, height: 28, bgcolor: '#fff', border: '1px solid #ECEDEF', borderLeft: 0, borderRadius: '0 6px 6px 0', transition: 'left .2s', '&:hover': { bgcolor: '#F2F3F5' } }}>
        {open ? <ChevronLeftIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
      </IconButton>
      {open && (
        <Box sx={{ px: '12px', py: '10px' }}>
          <TextField fullWidth size="small" placeholder="Search menu..." value={q} onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: '#767B83' }} /></InputAdornment>, sx: { height: 28, fontSize: 12, bgcolor: '#F2F3F5', borderRadius: '6px', '& input': { p: '0 !important' }, '& fieldset': { border: '1px solid transparent !important' }, '&.Mui-focused fieldset': { borderColor: '#2EB273 !important' } } }} />
        </Box>
      )}
      <List sx={{ p: '6px 6px 16px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto' }}>
        {items.map((i) => <MenuNode key={i.label} item={i} depth={0} current={loc.pathname} base={mod.basePath} collapsed={!open} forceOpen={!!q} />)}
      </List>
      {open && <Box sx={{ mt: 'auto', px: '12px', py: '10px', borderTop: '1px solid #ECEDEF', fontSize: 11, color: '#767B83' }}>Design POC: mock data, no backend</Box>}
    </Drawer>
  );
}

export function ModuleLayout({ mod }: { mod: ModuleDef }) {
  const [open, setOpen] = useState(true);
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <TopBar mod={mod} drawerWidth={open ? DRAWER : COLLAPSED} />
      <SideBar mod={mod} open={open} onToggle={() => setOpen(!open)} />
      <Box component="main" className="main-wrapper" sx={{ mt: `${TOPBAR}px`, flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <TopBar drawerWidth={0} launcher />
      <Box component="main" className="main-wrapper" sx={{ mt: `${TOPBAR}px` }}>{children}</Box>
    </Box>
  );
}

export { Badge };
