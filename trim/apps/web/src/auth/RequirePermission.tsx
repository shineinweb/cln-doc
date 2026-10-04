import { Alert, Box } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { can } from './permissions';

export function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!can(user, ...anyOf)) {
    return (
      <Box sx={{ py: 4 }} data-testid="permission-denied">
        <Alert severity="warning">You do not have permission to open this section.</Alert>
      </Box>
    );
  }
  return children;
}
