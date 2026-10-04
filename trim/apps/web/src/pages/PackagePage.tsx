import { Alert, Box, Button, Skeleton, TextField, Typography } from '@mui/material';
import { packageDetailSchema, recordRemovedSchema, submissionViewSchema } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';

export function PackagePage() {
  const { packageId = '' } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('success');
  const detail = useQuery({
    queryKey: ['package', packageId],
    queryFn: () => apiGet(`/packages/${packageId}`, packageDetailSchema),
    enabled: Boolean(packageId),
    retry: false,
  });
  const queue = useMutation({
    mutationFn: () =>
      apiSend('/submissions', submissionViewSchema, {
        packageId,
        sandboxOutcome: outcome,
      }),
    onSuccess: async () => {
      setMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['package', packageId] });
      await queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (detail.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (detail.error instanceof ApiError && (detail.error.status === 403 || detail.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="package-access-warning">
        {detail.error.status === 403 ? 'You do not have access to this package.' : 'This package was not found.'}
      </Alert>
    );
  }
  if (detail.error || !detail.data) {
    return <Alert severity="error">{detail.error?.message ?? 'This package could not be loaded.'}</Alert>;
  }

  const row = detail.data;
  const statusCopy =
    row.submission?.status === 'pending_review'
      ? 'Queued for review. Nothing has been sent.'
      : row.submission
        ? `Submission ${row.submission.status}.`
        : null;
  return (
    <Box>
      <BackLink to={`/harvests/${row.harvestId}`} label={row.harvestName} />
      <PageHeader
        kicker={row.licenseNumber}
        title={row.label}
        lede={`${row.weightGrams} g from ${row.harvestName}. The source tags are the plants that went into this package.`}
      />
      <RecordActions
        keepsHistory
        summary={<Typography data-testid="package-label">{row.label}</Typography>}
        detail={<Typography>{row.weightGrams} g · {row.actorName}</Typography>}
        editor={
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              const label = String(new FormData(event.currentTarget).get('label') ?? '');
              apiSend(`/packages/${row.id}`, recordRemovedSchema, { label }, 'PATCH').then(async () => {
                await queryClient.invalidateQueries({ queryKey: ['package', packageId] });
              });
            }}
          >
            <TextField label="Label" name="label" defaultValue={row.label} required />
            <SaveChanges />
          </Box>
        }
        onDelete={() => {
          void apiSend(`/packages/${row.id}`, recordRemovedSchema, undefined, 'DELETE').then(async () => {
            await queryClient.invalidateQueries({ queryKey: ['package', packageId] });
          });
        }}
      />
      <Typography data-testid="package-weight" sx={{ mt: 1 }}>
        {row.weightGrams} g · {row.actorName} · {formatTimestamp(row.recordedAt)}
      </Typography>
      <Typography sx={{ mt: 1 }}>
        Dry {row.ledger.dryWeightGrams ?? '—'} g · packaged {row.ledger.packageWeightGrams} g · waste {row.ledger.wasteWeightGrams} g ·
        unaccounted {row.ledger.unaccountedGrams ?? '—'} g
      </Typography>
      <Typography sx={{ mt: 2 }}>
        <RouterLink to={`/harvests/${row.harvestId}`}>Open harvest</RouterLink>
      </Typography>
      <Typography data-testid="source-tag-count" sx={{ mt: 2, fontWeight: 600 }}>
        {row.sourceTags.length} source tags
      </Typography>
      <Box sx={{ mt: 1 }}>
        <PagedList
          items={row.sourceTags}
          empty="No source tags."
          render={(source) => (
            <Typography key={source.tag} data-testid="source-tag">
              {source.tag}
            </Typography>
          )}
        />
      </Box>
      {statusCopy ? (
        <Alert severity="info" sx={{ mt: 2 }} data-testid="package-submission-status">
          {statusCopy}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box
            component="select"
            data-testid="sandbox-outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            sx={{ font: 'inherit', py: 1, px: 1.5 }}
          >
            <option value="success">Success</option>
            <option value="failure">Definite failure</option>
            <option value="uncertain">Uncertain</option>
          </Box>
          <Button data-testid="queue-package" variant="contained" onClick={() => queue.mutate()} disabled={queue.isPending}>
            Queue for review
          </Button>
        </Box>
      )}
      {message && message !== statusCopy ? (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="package-message">
          {message}
        </Alert>
      ) : null}
    </Box>
  );
}
