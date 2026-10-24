import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { forgotPasswordRequestSchema, forgotPasswordResponseSchema, type ForgotPasswordRequest } from '@trim/contracts';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, apiSend } from '../api/client';
import { displayFont, workbench } from '../theme';

export function ForgotPasswordPage() {
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await apiSend('/auth/forgot-password', forgotPasswordResponseSchema, values);
      setDone(result.message);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Request failed.');
    }
  });

  return (
    <AuthShell
      title="Reset your password"
      lede="Enter the email on your Serenity account. If it matches, we send a one-hour reset link."
    >
      <Box component="form" noValidate onSubmit={onSubmit} sx={{ width: '100%', maxWidth: 420 }}>
        <Stack spacing={2}>
          {done ? <Alert severity="success" data-testid="forgot-password-success">{done}</Alert> : null}
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            inputProps={{ 'data-testid': 'forgot-password-email' }}
            error={Boolean(form.formState.errors.email)}
            helperText={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={form.formState.isSubmitting || Boolean(done)}
            data-testid="forgot-password-submit"
          >
            {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button component={RouterLink} to="/login" variant="text">
            Back to sign in
          </Button>
        </Stack>
      </Box>
    </AuthShell>
  );
}

export function AuthShell({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2.5,
        py: 4,
        background: `radial-gradient(720px 320px at 0% -8%, rgba(255, 79, 139, 0.32), transparent 55%), ${workbench.canvas}`,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <Box
          component="img"
          src="/brand/serenity-wordmark-sm.png"
          alt="Serenity Universal"
          sx={{ display: 'block', width: 220, maxWidth: '100%', height: 'auto', mb: 3 }}
        />
        <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.16em' }}>
          Account
        </Typography>
        <Typography variant="h1" sx={{ fontFamily: displayFont, fontSize: { xs: 32, md: 40 }, mb: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 3 }}>{lede}</Typography>
        {children}
      </Box>
    </Box>
  );
}
