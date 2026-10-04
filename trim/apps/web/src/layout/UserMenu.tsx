import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { TOKEN_KEY } from '../auth/storage';
import { workbench } from '../theme';

export function UserMenu({
  userId,
  name,
  photoUrl,
  onLogout,
}: {
  userId: string;
  name: string;
  photoUrl: string | null;
  onLogout: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let objectUrl = '';
    const token = sessionStorage.getItem(TOKEN_KEY);
    void fetch(`/api${photoUrl}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        if (!response.ok || cancelled) {
          return;
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setSrc(objectUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoUrl, userId]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <IconButton
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : 'false'}
        data-testid="user-menu-button"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            overflow: 'hidden',
            bgcolor: workbench.mist,
            border: `2px solid ${workbench.leaf}`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {src ? (
            <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{initials || '?'}</Typography>
          )}
        </Box>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        data-testid="user-menu"
      >
        <MenuItem
          component={RouterLink}
          to="/profile"
          data-testid="user-menu-profile"
          onClick={() => setAnchor(null)}
        >
          User Profile
        </MenuItem>
        <MenuItem
          data-testid="user-menu-logout"
          onClick={() => {
            setAnchor(null);
            onLogout();
          }}
        >
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}
