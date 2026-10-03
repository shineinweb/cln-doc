import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { submissionViewSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';

export function SubmissionPage() {
  const { submissionId = '' } = useParams();
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
      <Typography data-testid="submission-status">{row.status}</Typography>
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
