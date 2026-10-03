import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { loginRequestSchema, type LoginRequest } from '@trim/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Mark } from '../components/Mark';
import { workbench } from '../theme';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  if (loading) {
    return null;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Sign in failed.');
    }
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' } }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          bgcolor: workbench.greenhouseDeep,
          color: '#F4EFE6',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Mark size={36} />
          <Typography sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 40 }}>Trim</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 48, lineHeight: 1.05, maxWidth: 460 }}>
            Know which rooms are yours before the day starts.
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 420, color: '#C9C1B4', fontSize: 18 }}>
            Trim is the cultivation workspace for teams that run more than one facility. Access follows the site.
          </Typography>
        </Box>
        <Typography sx={{ color: '#8E887C' }}>Facilities, rooms, and the people assigned to them.</Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', px: 3, py: 6 }}>
        <Box component="form" noValidate onSubmit={onSubmit} sx={{ width: '100%', maxWidth: 420 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 3 }}>
            <Mark />
            <Typography sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 32 }}>Trim</Typography>
          </Box>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.16em' }}>
            Sign in
          </Typography>
          <Typography variant="h1" sx={{ fontSize: 40, mb: 1 }}>
            Your cultivation workspace
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3 }}>
            Use the account issued by your organization.
          </Typography>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              inputProps={{ 'data-testid': 'login-email' }}
              error={Boolean(form.formState.errors.email)}
              helperText={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              inputProps={{ 'data-testid': 'login-password' }}
              error={Boolean(form.formState.errors.password)}
              helperText={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={form.formState.isSubmitting}
              data-testid="login-submit"
            >
              {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
