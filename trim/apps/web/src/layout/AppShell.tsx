import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { NavGlyph, type GlyphName } from '../components/Graphics';
import { Mark } from '../components/Mark';
import { displayFont, workbench } from '../theme';
import { useSites } from './SiteProvider';

const DRAWER_WIDTH = 248;

const NAV: { to: string; label: string; end: boolean; hint?: string; glyph: GlyphName }[] = [
  { to: '/', label: 'Dashboard', end: true, glyph: 'dashboard' },
  { to: '/access', label: 'Users', end: true, glyph: 'access' },
  { to: '/facilities', label: 'Facility', end: true, glyph: 'facility' },
  { to: '/rooms', label: 'Rooms', end: false, hint: 'Center', glyph: 'rooms' },
  { to: '/workflows', label: 'Workflows', end: true, glyph: 'workflows' },
  { to: '/workspace', label: 'Workspace', end: true, glyph: 'workspace' },
  { to: '/compliance', label: 'Compliance', end: true, glyph: 'compliance' },
  { to: '/harvests', label: 'Harvests', end: false, glyph: 'harvests' },
  { to: '/operations', label: 'Operations', end: false, glyph: 'operations' },
  { to: '/reports', label: 'Reports', end: false, glyph: 'reports' },
  { to: '/coach', label: 'AI helper', end: true, glyph: 'coach' },
  { to: '/user-manual', label: 'User manual', end: true, glyph: 'manual' },
  { to: '/settings', label: 'Settings', end: true, glyph: 'settings' },
];

const PHONE_NAV = [
  { to: '/', label: 'Dashboard', glyph: 'dashboard' as const, match: (path: string) => path === '/' },
  { to: '/rooms', label: 'Rooms', glyph: 'rooms' as const, match: (path: string) => path.startsWith('/rooms') },
  { to: '/workspace', label: 'Workspace', glyph: 'workspace' as const, match: (path: string) => path.startsWith('/workspace') },
  { to: '/harvests', label: 'Harvests', glyph: 'harvests' as const, match: (path: string) => path.startsWith('/harvests') },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { sites, siteId, setSiteId } = useSites();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const phoneValue = PHONE_NAV.find((item) => item.match(location.pathname))?.to ?? 'more';

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: workbench.ink,
        background: `linear-gradient(180deg, #3A1868 0%, ${workbench.greenhouseDeep} 46%, #10243A 100%)`,
      }}
    >
      <Box sx={{ px: 2.25, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Mark />
          <Typography sx={{ fontFamily: displayFont, fontSize: 28, lineHeight: 1, fontWeight: 700 }}>
            Trim
          </Typography>
        </Box>
        <Typography sx={{ mt: 1.5, color: '#D7C6F5', fontSize: 13 }}>{user?.organizationName}</Typography>
      </Box>
      <List sx={{ px: 1, flex: 1, overflowY: 'auto' }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: '#F4EEFF',
              minHeight: 46,
              '&.active': {
                bgcolor: 'rgba(255, 79, 139, 0.28)',
                boxShadow: `inset 3px 0 0 ${workbench.sky}`,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
              <NavGlyph name={item.glyph} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              secondary={item.hint}
              slotProps={{
                primary: { sx: { fontWeight: 600, color: 'inherit' } },
                secondary: { sx: { color: '#FFB4D6', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' } },
              }}
            />
          </ListItemButton>
        ))}
      </List>
      <Typography sx={{ px: 2.25, pb: 2, color: '#C9B6E8', fontSize: 12 }}>
        Room dashboards are the daily center of Trim.
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: `radial-gradient(720px 320px at 0% -8%, rgba(255, 79, 139, 0.32), transparent 55%), radial-gradient(640px 280px at 100% 0%, rgba(61, 220, 255, 0.18), transparent 50%), radial-gradient(520px 320px at 80% 100%, rgba(124, 92, 255, 0.28), transparent 55%), ${workbench.canvas}`,
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(16, 14, 28, 0.88)',
          color: 'text.primary',
          borderBottom: `1px solid ${workbench.line}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64, sm: 72 } }}>
          <IconButton
            aria-label="Open navigation"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { sm: 'none' } }}
          >
            <Box component="span" aria-hidden="true" sx={{ fontSize: 22, lineHeight: 1 }}>
              ≡
            </Box>
          </IconButton>
          <FormControl size="small" sx={{ minWidth: 0, flex: { xs: 1, sm: '0 1 280px' }, width: { sm: 280 } }}>
            <InputLabel id="site-switcher-label">Facility</InputLabel>
            <Select
              labelId="site-switcher-label"
              label="Facility"
              value={sites.some((site) => site.id === siteId) ? siteId ?? '' : ''}
              inputProps={{ 'data-testid': 'site-switcher' }}
              onChange={(event) => setSiteId(String(event.target.value))}
            >
              {sites.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          <Typography sx={{ display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>{user?.name}</Typography>
          <Button color="secondary" variant="outlined" onClick={logout} sx={{ flexShrink: 0, px: { xs: 1.25, sm: 2 } }}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: workbench.greenhouseDeep, backgroundImage: 'none' } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 0 },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 1.5, sm: 2.5, lg: 4 },
          pb: { xs: 12, sm: 6 },
          pt: { xs: 10, sm: 12 },
        }}
      >
        <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <BottomNavigation
        showLabels
        value={phoneValue}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 68,
          zIndex: (mui) => mui.zIndex.appBar,
          borderTop: `1px solid ${workbench.line}`,
          bgcolor: workbench.paper,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        {PHONE_NAV.map((item) => (
          <BottomNavigationAction
            key={item.to}
            label={item.label}
            value={item.to}
            icon={<NavGlyph name={item.glyph} />}
            onClick={() => navigate(item.to)}
          />
        ))}
        <BottomNavigationAction
          label="More"
          value="more"
          icon={<NavGlyph name="more" />}
          onClick={() => setMobileOpen(true)}
        />
      </BottomNavigation>
    </Box>
  );
}
