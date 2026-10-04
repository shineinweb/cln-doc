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
import { can } from '../auth/permissions';
import { NavGlyph, type GlyphName } from '../components/Graphics';
import { workbench } from '../theme';
import { FloatingSerenityChat } from './FloatingSerenityChat';
import { useSites } from './SiteProvider';
import { TopBarClock } from './TopBarClock';

const DRAWER_WIDTH = 248;

const NAV: { to: string; label: string; end: boolean; hint?: string; glyph: GlyphName; permissions: string[] }[] = [
  { to: '/', label: 'Dashboard', end: true, glyph: 'dashboard', permissions: ['dashboard.read'] },
  { to: '/access', label: 'Users', end: true, glyph: 'access', permissions: ['access.manage'] },
  { to: '/facilities', label: 'Facility', end: true, glyph: 'facility', permissions: ['facilities.read', 'sites.read'] },
  { to: '/rooms', label: 'Rooms', end: false, hint: 'Center', glyph: 'rooms', permissions: ['rooms.read'] },
  { to: '/workspace', label: 'Tasks', end: true, glyph: 'workspace', permissions: ['tasks.read'] },
  { to: '/timeclock', label: 'Time clock', end: true, glyph: 'timeclock', permissions: ['timeclock.punch'] },
  { to: '/compliance', label: 'Compliance', end: true, glyph: 'compliance', permissions: ['compliance.read'] },
  { to: '/harvests', label: 'Harvests', end: false, glyph: 'harvests', permissions: ['harvests.read'] },
  { to: '/operations', label: 'Operations', end: false, glyph: 'operations', permissions: ['operations.read'] },
  { to: '/reports', label: 'Reports', end: false, glyph: 'reports', permissions: ['reports.read'] },
  { to: '/coach', label: 'Serenity', end: true, glyph: 'coach', permissions: ['coach.use'] },
  { to: '/messages', label: 'Messages', end: true, glyph: 'messages', permissions: ['messages.use'] },
  { to: '/user-manual', label: 'User manual', end: true, glyph: 'manual', permissions: ['dashboard.read'] },
  { to: '/settings', label: 'Settings', end: true, glyph: 'settings', permissions: ['settings.manage'] },
];

const PHONE_NAV = [
  { to: '/', label: 'Dashboard', glyph: 'dashboard' as const, match: (path: string) => path === '/', permissions: ['dashboard.read'] },
  { to: '/rooms', label: 'Rooms', glyph: 'rooms' as const, match: (path: string) => path.startsWith('/rooms'), permissions: ['rooms.read'] },
  { to: '/workspace', label: 'Tasks', glyph: 'workspace' as const, match: (path: string) => path.startsWith('/workspace'), permissions: ['tasks.read'] },
  { to: '/harvests', label: 'Harvests', glyph: 'harvests' as const, match: (path: string) => path.startsWith('/harvests'), permissions: ['harvests.read'] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { sites, siteId, setSiteId } = useSites();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = NAV.filter((item) => can(user, ...item.permissions));
  const phoneItems = PHONE_NAV.filter((item) => can(user, ...item.permissions));
  const phoneValue = phoneItems.find((item) => item.match(location.pathname))?.to ?? 'more';

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
        <Box
          component="img"
          src="/brand/serenity-wordmark-sm.png"
          alt="Serenity Universal"
          sx={{ display: 'block', width: '100%', maxWidth: 196, height: 'auto' }}
        />
        <Typography sx={{ mt: 1.5, color: '#D7C6F5', fontSize: 13 }}>{user?.organizationName}</Typography>
      </Box>
      <List sx={{ px: 1, flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => (
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
        Room dashboards are the daily center of Serenity.
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        maxWidth: '100%',
        overflowX: 'hidden',
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
          {can(user, 'timeclock.punch') ? <TopBarClock siteId={siteId} /> : null}
          <Typography sx={{ display: { xs: 'none', lg: 'block' }, color: 'text.secondary', ml: 0.5 }}>
            {user?.name}
          </Typography>
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
          maxWidth: '100%',
          overflowX: 'hidden',
          px: { xs: 1.5, sm: 2.5, lg: 4 },
          pb: { xs: 12, sm: 6 },
          pt: { xs: 10, sm: 12 },
        }}
      >
        <Box sx={{ maxWidth: 1180, width: '100%', mx: 'auto', minWidth: 0 }}>
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
        {phoneItems.map((item) => (
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
      <FloatingSerenityChat />
    </Box>
  );
}
