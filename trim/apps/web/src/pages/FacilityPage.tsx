import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Skeleton, TextField, Typography } from '@mui/material';
import { organizationSummarySchema, recordRemovedSchema, siteSchema, type Site } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { DeleteRecord } from '../records/RecordControls';

export function FacilityPage() {
  const { sites, loading, error, setSiteId } = useSites();
  const organization = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiGet('/organization', organizationSummarySchema),
    retry: false,
  });

  return (
    <Box>
      <PageHeader
        kicker="Facility"
        title={organization.data?.name ?? 'Facility'}
        lede="Facilities you can open are listed here. A site stays hidden until you have a membership, unless you are an organization admin."
      />
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {loading || organization.isPending ? <Skeleton variant="rounded" height={140} /> : <AddFacilityForm />}
      {!loading && sites.length === 0 ? <Alert severity="info">No facilities are assigned to this account.</Alert> : null}
      {sites.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {sites.map((site) => (
            <FacilityCard key={site.id} site={site} onOpen={() => setSiteId(site.id)} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function FacilityCard({ site, onOpen }: { site: Site; onOpen: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => apiSend(`/sites/${site.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The facility could not be deleted.'),
  });

  return (
    <Card data-testid="facility-card">
      <CardActionArea onClick={onOpen} sx={{ p: 0.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h3" sx={{ fontSize: 28 }} data-testid="facility-row-name">
              {site.name}
            </Typography>
            <Chip label={site.code} size="small" />
          </Box>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            {[site.city, site.region].filter(Boolean).join(', ') || 'Address not recorded'}
          </Typography>
          <Typography sx={{ mt: 2, fontWeight: 600 }}>
            {site.rooms.length} {site.rooms.length === 1 ? 'room' : 'rooms'}
          </Typography>
        </CardContent>
      </CardActionArea>
      <CardContent sx={{ pt: 0 }}>
        <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} />
        {error ? (
          <Alert sx={{ mt: 1 }} severity="error">
            {error}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddFacilityForm() {
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; addressLine1: string; city: string; region: string; postalCode: string }) =>
      apiSend('/sites', siteSchema, body),
    onSuccess: async () => {
      setFormError(null);
      setMessage('Facility added.');
      setFormKey((key) => key + 1);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (caught) => {
      setMessage(null);
      setFormError(caught instanceof ApiError ? caught.message : 'The facility could not be saved.');
    },
  });

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1.5 }}>
          Add a facility
        </Typography>
        <Box
          key={formKey}
          component="form"
          sx={{ display: 'grid', gap: 1.5, maxWidth: 420 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({
              name: String(form.get('name') ?? ''),
              addressLine1: String(form.get('addressLine1') ?? ''),
              city: String(form.get('city') ?? ''),
              region: String(form.get('region') ?? ''),
              postalCode: String(form.get('postalCode') ?? ''),
            });
          }}
        >
          <TextField label="Name" name="name" required inputProps={{ 'data-testid': 'facility-name' }} />
          <TextField label="Street" name="addressLine1" inputProps={{ 'data-testid': 'facility-street' }} />
          <TextField label="City" name="city" inputProps={{ 'data-testid': 'facility-city' }} />
          <TextField label="Region" name="region" inputProps={{ 'data-testid': 'facility-region' }} />
          <TextField label="Postal code" name="postalCode" inputProps={{ 'data-testid': 'facility-postal' }} />
          <Button type="submit" variant="contained" data-testid="add-facility" disabled={save.isPending} sx={{ justifySelf: 'start' }}>
            Add facility
          </Button>
        </Box>
        {message ? (
          <Alert sx={{ mt: 2 }} data-testid="facility-added">
            {message}
          </Alert>
        ) : null}
        {formError ? (
          <Alert sx={{ mt: 2 }} severity="error">
            {formError}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
