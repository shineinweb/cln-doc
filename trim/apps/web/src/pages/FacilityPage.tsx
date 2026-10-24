import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Skeleton, TextField, Typography } from '@mui/material';
import { organizationSummarySchema, recordRemovedSchema, siteSchema, type Site } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { CanopyScene } from '../components/Graphics';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { DeleteRecord, SaveChanges } from '../records/RecordControls';
import { workbench } from '../theme';

export function FacilityPage() {
  const { user } = useAuth();
  const { sites, loading, error, setSiteId } = useSites();
  const canWrite = can(user, 'facilities.write');
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
      {loading || organization.isPending ? (
        <Skeleton variant="rounded" height={140} />
      ) : canWrite ? (
        <AddFacilityForm />
      ) : null}
      {!loading && sites.length === 0 ? <Alert severity="info">No facilities are assigned to this account.</Alert> : null}
      {sites.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {sites.map((site) => (
            <FacilityCard key={site.id} site={site} onOpen={() => setSiteId(site.id)} canWrite={canWrite} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function FacilityCard({ site, onOpen, canWrite }: { site: Site; onOpen: () => void; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: FacilityInput) => apiSend(`/sites/${site.id}`, siteSchema, body, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The facility could not be saved.'),
  });
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
          <Box
            sx={{
              height: { xs: 88, sm: 104 },
              mb: 1.5,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: workbench.greenhouseDeep,
            }}
          >
            <CanopyScene />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
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
      {canWrite ? (
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" data-testid="edit-record" onClick={() => setEditing((open) => !open)}>
              Edit
            </Button>
            <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} />
          </Box>
          {editing ? (
            <FacilityFields
              site={site}
              pending={save.isPending}
              submitLabel="save"
              onSubmit={(body) => save.mutate(body)}
            />
          ) : null}
          {error ? (
            <Alert sx={{ mt: 1 }} severity="error">
              {error}
            </Alert>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

type FacilityInput = { name: string; addressLine1: string; city: string; region: string; postalCode: string };

function AddFacilityForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: FacilityInput) => apiSend('/sites', siteSchema, body),
    onSuccess: async () => {
      setFormError(null);
      setMessage('Facility added.');
      setOpen(false);
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
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ fontSize: 22, mb: 1.5 }}>
              Add a facility
            </Typography>
            <FacilityFields
              key={formKey}
              pending={save.isPending}
              submitLabel="add"
              onSubmit={(body) => save.mutate(body)}
              onCancel={() => setOpen(false)}
            />
            {formError ? (
              <Alert sx={{ mt: 2 }} severity="error">
                {formError}
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Button variant="contained" data-testid="add-facility" onClick={() => setOpen(true)}>
          Add facility
        </Button>
      )}
      {message ? (
        <Alert sx={{ mt: 2 }} data-testid="facility-added">
          {message}
        </Alert>
      ) : null}
    </Box>
  );
}

function FacilityFields({
  site,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  site?: Site;
  pending: boolean;
  submitLabel: 'add' | 'save';
  onSubmit: (body: FacilityInput) => void;
  onCancel?: () => void;
}) {
  const editing = submitLabel === 'save';
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 420, mt: editing ? 2 : 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          name: String(form.get('name') ?? ''),
          addressLine1: String(form.get('addressLine1') ?? ''),
          city: String(form.get('city') ?? ''),
          region: String(form.get('region') ?? ''),
          postalCode: String(form.get('postalCode') ?? ''),
        });
      }}
    >
      <TextField
        label="Name"
        name="name"
        required
        defaultValue={site?.name ?? ''}
        inputProps={{ 'data-testid': editing ? 'edit-facility-name' : 'facility-name' }}
      />
      <TextField
        label="Street"
        name="addressLine1"
        defaultValue={site?.addressLine1 ?? ''}
        inputProps={{ 'data-testid': editing ? 'edit-facility-street' : 'facility-street' }}
      />
      <TextField
        label="City"
        name="city"
        defaultValue={site?.city ?? ''}
        inputProps={{ 'data-testid': editing ? 'edit-facility-city' : 'facility-city' }}
      />
      <TextField
        label="Region"
        name="region"
        defaultValue={site?.region ?? ''}
        inputProps={{ 'data-testid': editing ? 'edit-facility-region' : 'facility-region' }}
      />
      <TextField
        label="Postal code"
        name="postalCode"
        defaultValue={site?.postalCode ?? ''}
        inputProps={{ 'data-testid': editing ? 'edit-facility-postal' : 'facility-postal' }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        {editing ? (
          <SaveChanges pending={pending} />
        ) : (
          <Button type="submit" variant="contained" data-testid="add-facility" disabled={pending}>
            Add facility
          </Button>
        )}
        {onCancel ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
