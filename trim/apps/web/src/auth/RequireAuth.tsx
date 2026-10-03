import { Box, Button, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, error, logout } = useAuth();

  if (loading) {
    return <Status title="Opening your workspace" body="Checking the signed-in account." />;
  }

  if (!user && error && !(error instanceof ApiError && error.status === 401)) {
    return (
      <Status
        title="Trim is not reachable"
        body={error.message}
        action={
          <Button variant="contained" onClick={logout}>
            Back to sign in
          </Button>
        }
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function Status({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box>
        <Typography variant="h2" sx={{ fontSize: 32 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>{body}</Typography>
        {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
      </Box>
    </Box>
  );
}
