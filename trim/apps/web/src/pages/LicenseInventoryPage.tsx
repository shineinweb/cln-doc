import { Alert, Box, Button, Card, CardContent, Skeleton, TextField, Typography } from '@mui/material';
import { licenseInventorySchema, recordRemovedSchema } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { PagedList, Pager, RecordActions, SaveChanges } from '../records/RecordControls';

export function LicenseInventoryPage() {
  const { licenseId = '' } = useParams();
  const [page, setPage] = useState(1);
  const inventory = useQuery({
    queryKey: ['license', licenseId, page],
    queryFn: () => apiGet(`/licenses/${licenseId}?page=${page}&pageSize=5`, licenseInventorySchema),
    enabled: Boolean(licenseId),
    retry: false,
  });

  if (inventory.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (inventory.error instanceof ApiError && (inventory.error.status === 403 || inventory.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="license-access-warning">
        {inventory.error.status === 403
          ? 'You do not have access to this license.'
          : 'This license is not on a facility you can open.'}
      </Alert>
    );
  }
  if (inventory.error || !inventory.data) {
    return <Alert severity="error">{inventory.error?.message ?? 'This license could not be loaded.'}</Alert>;
  }

  const license = inventory.data;
  const pageCount = Math.max(1, Math.ceil(license.total / license.pageSize));
  return (
    <Box data-testid="license-inventory">
      <PageHeader
        kicker={license.siteNames.join(', ')}
        title={license.licenseNumber}
        lede={`${license.licenseType} license. Plant totals come from tagged plants on this license.`}
      />
      <Typography data-testid="license-plant-count" sx={{ mb: 2, fontSize: 20 }}>
        {license.plantCount} plants
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography sx={{ mb: 1, color: 'text.secondary' }}>
            Showing {license.listedCount} of {license.plantCount} tags.
          </Typography>
          {license.plants.map((plant) => (
            <PlantRow key={plant.id} plant={plant} licenseId={license.id} />
          ))}
          <Pager page={license.page} pageCount={pageCount} total={license.total} onPage={setPage} />
          <AddPlantForm licenseId={license.id} batches={license.batches} />
        </CardContent>
      </Card>
      <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
        Batches
      </Typography>
      <PagedList
        items={license.batches}
        empty="No batches are recorded on this license."
        testId="batch-list"
        render={(batch) => <BatchRow key={batch.id} batch={batch} licenseId={license.id} />}
      />
      <AddBatchForm licenseId={license.id} />
    </Box>
  );
}

function PlantRow({
  plant,
  licenseId,
}: {
  plant: { id: string; tag: string; strainName: string; stage: string; roomName: string | null; cycleName: string | null };
  licenseId: string;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
  const save = useMutation({
    mutationFn: (stage: string) => apiSend(`/plants/${plant.id}`, recordRemovedSchema, { stage }, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/plants/${plant.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      keepsHistory
      summary={
        <Typography data-testid="plant-tag">
          <RouterLink to={`/plants/${plant.id}`}>{plant.tag}</RouterLink>
          {` · ${plant.strainName} · ${plant.roomName ?? 'No room'} · ${plant.cycleName ?? 'No cycle'}`}
        </Typography>
      }
      detail={<Typography>{plant.stage}</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(String(new FormData(event.currentTarget).get('stage') ?? ''));
          }}
        >
          <TextField label="Stage" name="stage" defaultValue={plant.stage} required />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function BatchRow({
  batch,
  licenseId,
}: {
  batch: { id: string; name: string; strainName: string };
  licenseId: string;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
  const save = useMutation({
    mutationFn: (name: string) =>
      apiSend(`/batches/${batch.id}`, recordRemovedSchema, { name, strainName: batch.strainName }, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/batches/${batch.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      summary={
        <Typography data-testid="batch-row">
          {batch.name} · {batch.strainName}
        </Typography>
      }
      detail={<Typography>{batch.strainName}</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(String(new FormData(event.currentTarget).get('name') ?? ''));
          }}
        >
          <TextField label="Name" name="name" defaultValue={batch.name} required />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function AddBatchForm({ licenseId }: { licenseId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; strainName: string }) => apiSend(`/licenses/${licenseId}/batches`, recordRemovedSchema, body),
    onSuccess: async () => {
      setMessage('Batch saved.');
      await queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Card>
      <CardContent>
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({ name: String(form.get('name') ?? ''), strainName: String(form.get('strainName') ?? '') });
          }}
        >
          <TextField label="Batch name" name="name" required />
          <TextField label="Strain" name="strainName" required />
          <Button type="submit" variant="contained" disabled={save.isPending} sx={{ justifySelf: 'start' }}>
            Add batch
          </Button>
        </Box>
        {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function AddPlantForm({ licenseId, batches }: { licenseId: string; batches: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { batchId: string; tag: string; stage: string }) => apiSend(`/licenses/${licenseId}/plants`, recordRemovedSchema, body),
    onSuccess: async () => {
      setMessage('Plant saved.');
      await queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1, maxWidth: 420, mt: 2 }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        save.mutate({
          batchId: String(form.get('batchId') ?? ''),
          tag: String(form.get('tag') ?? ''),
          stage: String(form.get('stage') ?? ''),
        });
      }}
    >
      <TextField select label="Batch" name="batchId" defaultValue={batches[0]?.id ?? ''} required SelectProps={{ native: true }}>
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name}
          </option>
        ))}
      </TextField>
      <TextField label="Tag" name="tag" required />
      <TextField label="Stage" name="stage" required />
      <Button type="submit" variant="contained" disabled={save.isPending || batches.length === 0} sx={{ justifySelf: 'start' }}>
        Add plant
      </Button>
      {message ? <Alert>{message}</Alert> : null}
    </Box>
  );
}
