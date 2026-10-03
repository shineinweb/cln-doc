import {
  AppBar,
  Box,
  Button,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Mark } from '../components/Mark';
import { workbench } from '../theme';
import { useSites } from './SiteProvider';

const DRAWER_WIDTH = 232;

const NAV = [
  { to: '/', label: 'Company', end: true },
  { to: '/facility', label: 'Facility', end: true },
  { to: '/rooms', label: 'Rooms', end: false, hint: 'Center' },
  { to: '/crop-cycles', label: 'Crop cycles', end: true },
  { to: '/workflows', label: 'Workflows', end: true },
  { to: '/workspace', label: 'Workspace', end: true },
  { to: '/compliance', label: 'Compliance', end: true },
  { to: '/harvests', label: 'Harvests', end: false },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { sites, siteId, setSiteId } = useSites();
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: workbench.greenhouseDeep, color: '#F4EFE6' }}>
      <Box sx={{ px: 2.25, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Mark />
          <Typography sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 28, lineHeight: 1 }}>
            Trim
          </Typography>
        </Box>
        <Typography sx={{ mt: 1.5, color: '#C9C1B4', fontSize: 13 }}>{user?.organizationName}</Typography>
      </Box>
      <List sx={{ px: 1, flex: 1 }}>
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
              color: '#E7E1D6',
              '&.active': {
                bgcolor: 'rgba(184, 67, 31, 0.22)',
                boxShadow: `inset 3px 0 0 ${workbench.copper}`,
              },
            }}
          >
            <ListItemText
              primary={item.label}
              secondary={item.hint}
              slotProps={{
                primary: { sx: { fontWeight: 600, color: 'inherit' } },
                secondary: { sx: { color: '#E7B199', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' } },
              }}
            />
          </ListItemButton>
        ))}
      </List>
      <Typography sx={{ px: 2.25, pb: 2, color: '#8E887C', fontSize: 12 }}>
        Room dashboards are the daily center of Trim.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(247, 244, 238, 0.92)',
          color: 'text.primary',
          borderBottom: `1px solid ${workbench.line}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            aria-label="Open navigation"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <Box component="span" aria-hidden="true" sx={{ fontSize: 22, lineHeight: 1 }}>
              ≡
            </Box>
          </IconButton>
          <FormControl size="small" sx={{ minWidth: { xs: 160, sm: 260 } }}>
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
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}>{user?.name}</Typography>
          <Button color="secondary" variant="outlined" onClick={logout}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: workbench.greenhouseDeep } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 0 },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 4 }, pb: 6, pt: { xs: 10, md: 12 }, maxWidth: 1120 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
