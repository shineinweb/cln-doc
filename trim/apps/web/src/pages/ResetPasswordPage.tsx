import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { resetPasswordResponseSchema } from '@trim/contracts';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiError, apiSend } from '../api/client';
import { AuthShell } from './ForgotPasswordPage';

const formSchema = z
  .object({
    token: z.string().trim().min(20),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
    confirm: z.string().min(8).max(200),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'Passwords must match.',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { token, password: '', confirm: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await apiSend('/auth/reset-password', resetPasswordResponseSchema, {
        token: values.token || token,
        password: values.password,
      });
      navigate('/login', { replace: true, state: { notice: result.message } });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Reset failed.');
    }
  });

  if (!token) {
    return (
      <AuthShell title="Reset link missing" lede="Open the link from your email, or request a new reset.">
        <Button component={RouterLink} to="/forgot-password" variant="contained">
          Request a reset link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" lede="This link works once and expires in one hour.">
      <Box component="form" noValidate onSubmit={onSubmit} sx={{ width: '100%', maxWidth: 420 }}>
        <Stack spacing={2}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <input type="hidden" {...form.register('token')} />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'reset-password-password' }}
            error={Boolean(form.formState.errors.password)}
            helperText={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'reset-password-confirm' }}
            error={Boolean(form.formState.errors.confirm)}
            helperText={form.formState.errors.confirm?.message}
            {...form.register('confirm')}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={form.formState.isSubmitting}
            data-testid="reset-password-submit"
          >
            {form.formState.isSubmitting ? 'Saving…' : 'Update password'}
          </Button>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            <RouterLink to="/login">Back to sign in</RouterLink>
          </Typography>
        </Stack>
      </Box>
    </AuthShell>
  );
}
