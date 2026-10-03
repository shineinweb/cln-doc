import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { loginRequestSchema, type LoginRequest } from '@trim/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { CanopyScene } from '../components/Graphics';
import { displayFont, workbench } from '../theme';

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-start', md: 'space-between' },
          gap: { xs: 2, md: 3 },
          p: { xs: 2.5, sm: 4, md: 6 },
          background: `linear-gradient(165deg, #4A1878 0%, ${workbench.greenhouseDeep} 46%, #0E3148 100%)`,
          color: workbench.ink,
        }}
      >
        <Box
          component="img"
          src="/brand/serenity-wordmark.png"
          alt="Serenity Inventory"
          sx={{
            display: 'block',
            width: { xs: 220, sm: 280, md: 320 },
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        <Box>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: 32, sm: 40, md: 48 }, lineHeight: 1.05, maxWidth: 480 }}>
            Know which rooms are yours before the day starts.
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 440, color: '#E4D4FF', fontSize: { xs: 16, md: 18 } }}>
            Trim is the cultivation workspace for teams that run more than one facility. Access follows the site.
          </Typography>
        </Box>
        <Box sx={{ height: { xs: 140, sm: 180, md: 220 }, maxWidth: 640 }}>
          <CanopyScene />
        </Box>
        <Typography sx={{ color: '#C9B6E8', display: { xs: 'none', md: 'block' } }}>
          Facilities, rooms, and the people assigned to them.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2.5, sm: 4 }, py: { xs: 4, md: 6 } }}>
        <Box component="form" noValidate onSubmit={onSubmit} sx={{ width: '100%', maxWidth: 420 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.16em' }}>
            Sign in
          </Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 40 }, mb: 1 }}>
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
