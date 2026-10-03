import { Alert, Box, Card, CardContent, Skeleton, TextField, Typography } from '@mui/material';
import { harvestListSchema, recordRemovedSchema, type HarvestSummary } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';

export function HarvestsPage() {
  const harvests = useQuery({
    queryKey: ['harvests'],
    queryFn: () => apiGet('/harvests', harvestListSchema),
  });

  if (harvests.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (harvests.error || !harvests.data) {
    return <Alert severity="error">{harvests.error?.message ?? 'Harvests could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Postharvest"
        title="Harvests"
        lede="A harvest keeps the plant tags, weights, waste, and packages for one license. Veg crops stay in the room until they are cut."
      />
      <PagedList
        items={harvests.data}
        empty="No harvests are recorded for the facilities you can open."
        testId="harvest-list"
        render={(harvest) => <HarvestRow key={harvest.id} harvest={harvest} />}
      />
    </Box>
  );
}

function HarvestRow({ harvest }: { harvest: HarvestSummary }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['harvests'] });
  const save = useMutation({
    mutationFn: (name: string) => apiSend(`/harvests/${harvest.id}`, recordRemovedSchema, { name }, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/harvests/${harvest.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <Card sx={{ mb: 2 }} data-testid="harvest-card">
      <CardContent>
        <RecordActions
          keepsHistory
          summary={
            <Box>
              <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="harvest-card-name">
                <RouterLink to={`/harvests/${harvest.id}`}>{harvest.name}</RouterLink>
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                {harvest.licenseNumber}
                {harvest.siteName ? ` · ${harvest.siteName}` : ''} · {harvest.plantCount} plants
              </Typography>
            </Box>
          }
          detail={
            <Typography>
              Wet {harvest.ledger.wetWeightGrams ?? '—'} g · dry {harvest.ledger.dryWeightGrams ?? '—'} g · packaged{' '}
              {harvest.ledger.packageWeightGrams} g · waste {harvest.ledger.wasteWeightGrams} g
            </Typography>
          }
          editor={
            <Box
              component="form"
              sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(String(new FormData(event.currentTarget).get('name') ?? ''));
              }}
            >
              <TextField label="Name" name="name" defaultValue={harvest.name} required />
              <SaveChanges pending={save.isPending} />
            </Box>
          }
          onDelete={() => remove.mutate()}
        />
      </CardContent>
    </Card>
  );
}
