import { Alert, Box, Button, Tab, Tabs, TextField, Typography } from '@mui/material';
import { settingsViewSchema, type SettingsView } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';

export function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'general' | 'apis'>('general');
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet('/settings', settingsViewSchema),
  });

  return (
    <Box>
      <PageHeader
        kicker="Settings"
        title={user?.organizationName ?? 'Settings'}
        lede="Company details and the API keys Trim stores. Saving an API key does not call that service."
      />
      <Tabs value={tab} onChange={(_event, value: 'general' | 'apis') => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="general" label="General" data-testid="settings-tab-general" />
        <Tab value="apis" label="API's" data-testid="settings-tab-apis" />
      </Tabs>
      {settings.isPending ? <Typography>Loading settings.</Typography> : null}
      {settings.error ? <Alert severity="error">{settings.error.message}</Alert> : null}
      {settings.data && tab === 'general' ? <GeneralTab settings={settings.data} canSave={Boolean(user?.isOrgAdmin)} /> : null}
      {settings.data && tab === 'apis' ? <ApisTab settings={settings.data} canSave={Boolean(user?.isOrgAdmin)} /> : null}
    </Box>
  );
}

function GeneralTab({ settings, canSave }: { settings: SettingsView; canSave: boolean }) {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState(settings.general.companyName);
  const [title, setTitle] = useState(settings.general.title);
  const [description, setDescription] = useState(settings.general.description);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setCompanyName(settings.general.companyName);
    setTitle(settings.general.title);
    setDescription(settings.general.description);
  }, [settings]);
  const save = useMutation({
    mutationFn: () =>
      apiSend('/settings/general', settingsViewSchema, { companyName, title, description }, 'PATCH'),
    onSuccess: async () => {
      setMessage('Settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 560 }}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <TextField
        label="Company name"
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
        required
        disabled={!canSave}
        inputProps={{ 'data-testid': 'settings-company-name' }}
      />
      <TextField
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={!canSave}
        inputProps={{ 'data-testid': 'settings-title' }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={!canSave}
        multiline
        minRows={3}
        inputProps={{ 'data-testid': 'settings-description' }}
      />
      {canSave ? (
        <Button type="submit" variant="contained" disabled={save.isPending || !companyName.trim()} data-testid="settings-save-general">
          Save changes
        </Button>
      ) : (
        <Alert severity="info">Only a manager can change settings.</Alert>
      )}
      {message ? <Alert severity={message === 'Settings saved.' ? 'success' : 'error'}>{message}</Alert> : null}
    </Box>
  );
}

function ApisTab({ settings, canSave }: { settings: SettingsView; canSave: boolean }) {
  const queryClient = useQueryClient();
  const [integratorApiKey, setIntegratorApiKey] = useState('');
  const [userApiKey, setUserApiKey] = useState('');
  const [licenseNumber, setLicenseNumber] = useState(settings.metrc.licenseNumber);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setLicenseNumber(settings.metrc.licenseNumber);
  }, [settings.metrc.licenseNumber]);
  const save = useMutation({
    mutationFn: () =>
      apiSend('/settings/metrc', settingsViewSchema, { integratorApiKey, userApiKey, licenseNumber }),
    onSuccess: async () => {
      setMessage('Metrc API keys saved.');
      setIntegratorApiKey('');
      setUserApiKey('');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Box data-testid="metrc-apis">
      <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
        Metrc API's
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        Metrc authenticates with an integrator API key and a user API key. The integrator key is the username and the user API key is the password. The user API key belongs to the Metrc user, not the facility. Requests also send the facility license number. Trim stores these and does not call Metrc.
      </Typography>
      <Box
        component="form"
        sx={{ display: 'grid', gap: 1.5, maxWidth: 560 }}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <TextField
          label="Integrator API key"
          value={integratorApiKey}
          onChange={(event) => setIntegratorApiKey(event.target.value)}
          disabled={!canSave}
          autoComplete="off"
          helperText={settings.metrc.integratorKeySaved ? 'An integrator API key is saved. Leave this blank to keep it.' : 'From Metrc Connect. Used as the username.'}
          inputProps={{ 'data-testid': 'metrc-integrator-key' }}
        />
        <TextField
          label="User API key"
          value={userApiKey}
          onChange={(event) => setUserApiKey(event.target.value)}
          disabled={!canSave}
          autoComplete="off"
          helperText={settings.metrc.userKeySaved ? 'A user API key is saved. Leave this blank to keep it.' : 'Created by the Metrc user. Used as the password.'}
          inputProps={{ 'data-testid': 'metrc-user-key' }}
        />
        <TextField
          label="Facility license number"
          value={licenseNumber}
          onChange={(event) => setLicenseNumber(event.target.value)}
          disabled={!canSave}
          inputProps={{ 'data-testid': 'metrc-license' }}
        />
        {canSave ? (
          <Button type="submit" variant="contained" disabled={save.isPending} data-testid="metrc-save">
            Save
          </Button>
        ) : null}
      </Box>
      {message ? <Alert sx={{ mt: 2 }} severity={message === 'Metrc API keys saved.' ? 'success' : 'error'}>{message}</Alert> : null}
    </Box>
  );
}
