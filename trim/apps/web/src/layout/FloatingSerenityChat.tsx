import {
  Alert,
  Box,
  Fab,
  IconButton,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { siteCoachSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { apiGet } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { NavGlyph } from '../components/Graphics';
import { AiHelperPanel } from '../pages/AiHelperPanel';
import { workbench } from '../theme';
import { useSites } from './SiteProvider';

export function FloatingSerenityChat() {
  const { user } = useAuth();
  const { siteId, site } = useSites();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const allowed = can(user, 'coach.use');
  const onCoachPage = location.pathname === '/coach' || location.pathname.startsWith('/coach/');

  const coach = useQuery({
    queryKey: ['coach', siteId, 'floating'],
    queryFn: () => apiGet(`/sites/${siteId}/coach`, siteCoachSchema),
    enabled: allowed && open && Boolean(siteId),
  });

  if (!allowed || onCoachPage) {
    return null;
  }

  return (
    <Box
      data-testid="floating-serenity-chat"
      sx={{
        position: 'fixed',
        right: { xs: 16, sm: 24 },
        left: { xs: 16, sm: 'auto' },
        bottom: { xs: 84, sm: 24 },
        zIndex: (theme) => theme.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        gap: 1.25,
        pointerEvents: 'none',
        maxWidth: { sm: 400 },
      }}
    >
      {open ? (
        <Paper
          elevation={0}
          data-testid="floating-serenity-panel"
          sx={{
            pointerEvents: 'auto',
            width: { xs: '100%', sm: 400 },
            maxWidth: '100%',
            height: { xs: 'min(70vh, 560px)', sm: 560 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: workbench.paper,
            border: `1px solid ${workbench.line}`,
            backgroundImage: `linear-gradient(180deg, rgba(58, 24, 104, 0.55) 0%, ${workbench.paper} 28%)`,
            boxShadow: '0 18px 48px rgba(8, 6, 20, 0.55)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1.1,
              borderBottom: `1px solid ${workbench.line}`,
            }}
          >
            <Box
              component="img"
              src="/brand/serenity-mark.png"
              alt=""
              sx={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                Serenity
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {site?.name ?? 'Choose a facility'}
                {coach.data
                  ? ` · ${coach.data.helper.sops.length} procedures`
                  : ''}
              </Typography>
            </Box>
            <IconButton
              component={RouterLink}
              to="/coach"
              size="small"
              aria-label="Open full Serenity page"
              data-testid="floating-serenity-expand"
              onClick={() => setOpen(false)}
              sx={{ color: 'text.secondary' }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: 16, lineHeight: 1 }}>
                ↗
              </Box>
            </IconButton>
            <IconButton
              size="small"
              aria-label="Close Serenity chat"
              data-testid="floating-serenity-close"
              onClick={() => setOpen(false)}
              sx={{ color: 'text.secondary' }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: 18, lineHeight: 1 }}>
                ×
              </Box>
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {!siteId ? <Alert severity="info" sx={{ m: 1.5 }}>Choose a facility to chat with Serenity.</Alert> : null}
            {siteId && coach.isPending ? <Skeleton variant="rounded" height="100%" sx={{ m: 1.5, flex: 1 }} /> : null}
            {coach.error ? (
              <Alert severity="error" sx={{ m: 1.5 }}>
                {coach.error.message}
              </Alert>
            ) : null}
            {coach.data ? <AiHelperPanel siteId={coach.data.siteId} helper={coach.data.helper} compact /> : null}
          </Box>
        </Paper>
      ) : null}

      <Fab
        color="primary"
        aria-label={open ? 'Close Serenity chat' : 'Open Serenity chat'}
        data-testid="floating-serenity-fab"
        onClick={() => setOpen((current) => !current)}
        sx={{
          pointerEvents: 'auto',
          width: 58,
          height: 58,
          boxShadow: '0 10px 28px rgba(255, 79, 139, 0.45)',
          '&:hover': { boxShadow: '0 12px 32px rgba(255, 79, 139, 0.55)' },
        }}
      >
        <NavGlyph name="coach" />
      </Fab>
    </Box>
  );
}
