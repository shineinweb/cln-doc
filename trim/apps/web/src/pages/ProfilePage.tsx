import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { selfProfileSchema, type SelfProfile } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, apiGet, apiSend, apiUpload } from '../api/client';
import { TOKEN_KEY } from '../auth/storage';
import { PageHeader } from '../components/PageHeader';
import { workbench } from '../theme';

export function ProfilePage() {
  const profile = useQuery({
    queryKey: ['self-profile'],
    queryFn: () => apiGet('/auth/profile', selfProfileSchema),
  });

  return (
    <Box>
      <PageHeader kicker="Account" title="User Profile" lede="Your photo, phone, and address." />
      {profile.isPending ? <Typography>Loading profile.</Typography> : null}
      {profile.error ? <Alert severity="error">{profile.error.message}</Alert> : null}
      {profile.data ? <ProfileForm profile={profile.data} /> : null}
    </Box>
  );
}

function ProfileForm({ profile }: { profile: SelfProfile }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [addressLine1, setAddressLine1] = useState(profile.addressLine1 ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [region, setRegion] = useState(profile.region ?? '');
  const [postalCode, setPostalCode] = useState(profile.postalCode ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setPhone(profile.phone ?? '');
    setAddressLine1(profile.addressLine1 ?? '');
    setCity(profile.city ?? '');
    setRegion(profile.region ?? '');
    setPostalCode(profile.postalCode ?? '');
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      apiSend('/auth/profile', selfProfileSchema, { phone, addressLine1, city, region, postalCode }, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      setMessage('Profile saved.');
      await queryClient.invalidateQueries({ queryKey: ['self-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The profile could not be saved.'),
  });
  const upload = useMutation({
    mutationFn: (file: File) => apiUpload('/auth/profile/photo', selfProfileSchema, file),
    onSuccess: async () => {
      setError(null);
      setMessage('Photo saved.');
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['self-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The photo could not be saved.'),
  });

  return (
    <Box sx={{ display: 'grid', gap: 2, maxWidth: 560 }} data-testid="user-profile">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ProfilePhoto userId={profile.id} photoUrl={preview ? null : profile.photoUrl} preview={preview} name={profile.name} />
        <Button component="label" size="small" variant="outlined" data-testid="profile-photo-button">
          {upload.isPending ? 'Uploading…' : 'Change photo'}
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data-testid="profile-photo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) {
                return;
              }
              setPreview(URL.createObjectURL(file));
              upload.mutate(file);
            }}
          />
        </Button>
      </Box>
      <Typography sx={{ color: 'text.secondary' }}>{profile.name}</Typography>
      <Typography sx={{ color: 'text.secondary' }}>{profile.email}</Typography>
      <TextField label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} fullWidth inputProps={{ 'data-testid': 'profile-phone' }} />
      <Typography sx={{ fontWeight: 700 }}>Address</Typography>
      <TextField label="Street" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} fullWidth inputProps={{ 'data-testid': 'profile-address-line1' }} />
      <TextField label="City" value={city} onChange={(event) => setCity(event.target.value)} fullWidth inputProps={{ 'data-testid': 'profile-city' }} />
      <TextField label="Region" value={region} onChange={(event) => setRegion(event.target.value)} fullWidth inputProps={{ 'data-testid': 'profile-region' }} />
      <TextField label="Postal code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} fullWidth inputProps={{ 'data-testid': 'profile-postal-code' }} />
      <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} data-testid="profile-save">
        Save profile
      </Button>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Box>
  );
}

function ProfilePhoto({
  userId,
  photoUrl,
  preview,
  name,
}: {
  userId: string;
  photoUrl: string | null;
  preview: string | null;
  name: string;
}) {
  const [src, setSrc] = useState<string | null>(preview);
  useEffect(() => {
    if (preview) {
      setSrc(preview);
      return;
    }
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
  }, [photoUrl, preview, userId]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Box
      sx={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        overflow: 'hidden',
        bgcolor: workbench.mist,
        display: 'grid',
        placeItems: 'center',
        border: `2px solid ${workbench.leaf}`,
      }}
    >
      {src ? (
        <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography sx={{ fontWeight: 800 }}>{initials || '?'}</Typography>
      )}
    </Box>
  );
}
