import { Alert, Box, Skeleton, TextField, Typography } from '@mui/material';
import { recordRemovedSchema, submissionViewSchema } from '@trim/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { RecordActions, SaveChanges } from '../records/RecordControls';

export function SubmissionPage() {
  const { submissionId = '' } = useParams();
  const queryClient = useQueryClient();
  const submission = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => apiGet(`/submissions/${submissionId}`, submissionViewSchema),
    enabled: Boolean(submissionId),
    retry: false,
  });

  if (submission.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (submission.error instanceof ApiError && (submission.error.status === 403 || submission.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="submission-access-warning">
        {submission.error.status === 403
          ? 'You do not have access to this submission.'
          : 'This submission was not found.'}
      </Alert>
    );
  }
  if (submission.error || !submission.data) {
    return <Alert severity="error">{submission.error?.message ?? 'This submission could not be loaded.'}</Alert>;
  }

  const row = submission.data;
  return (
    <Box>
      <PageHeader
        kicker={row.licenseNumber}
        title={row.packageLabel ?? row.plantTag ?? 'Submission'}
        lede={`${row.eventType} · ${row.status}`}
      />
      <RecordActions
        keepsHistory
        summary={<Typography data-testid="submission-status">{row.status}</Typography>}
        detail={<Typography>{row.eventNote}</Typography>}
        editor={
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
            onSubmit={(event) => {
              event.preventDefault();
              const rejectionNote = String(new FormData(event.currentTarget).get('rejectionNote') ?? '');
              void apiSend(`/submissions/${row.id}`, recordRemovedSchema, { rejectionNote: rejectionNote || null }, 'PATCH').then(() =>
                queryClient.invalidateQueries({ queryKey: ['submission', submissionId] }),
              );
            }}
          >
            <TextField label="Rejection note" name="rejectionNote" defaultValue={row.rejectionNote ?? ''} />
            <SaveChanges />
          </Box>
        }
        onDelete={() => {
          void apiSend(`/submissions/${row.id}`, recordRemovedSchema, undefined, 'DELETE').then(() =>
            queryClient.invalidateQueries({ queryKey: ['submission', submissionId] }),
          );
        }}
      />
      <Typography sx={{ mt: 1 }}>{row.eventNote}</Typography>
      {row.attempt ? (
        <Typography data-testid="submission-attempt" sx={{ mt: 2 }}>
          Request {row.attempt.requestId} · {row.attempt.actorName} · {formatTimestamp(row.attempt.occurredAt)} · {row.attempt.outcome}
          {row.attempt.reconciliationResult ? ` · ${row.attempt.reconciliationResult}` : ''}
        </Typography>
      ) : (
        <Typography sx={{ mt: 2 }}>No delivery attempt is recorded.</Typography>
      )}
    </Box>
  );
}
