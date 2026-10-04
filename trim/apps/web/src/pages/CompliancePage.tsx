import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, TextField, Typography } from '@mui/material';
import { complianceOverviewSchema, recordRemovedSchema, submissionViewSchema, type SubmissionView } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';

function discrepancyLabel(kind: 'extra_tag' | 'missing_tag'): string {
  return kind === 'extra_tag' ? 'In the file, not in Serenity' : 'In Serenity, not in the file';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review';
    case 'queued':
      return 'Queued';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'uncertain':
      return 'Uncertain';
    case 'rejected':
      return 'Rejected';
    case 'reconciled':
      return 'Reconciled';
    default:
      return status;
  }
}

export function CompliancePage() {
  const overview = useQuery({
    queryKey: ['compliance'],
    queryFn: () => apiGet('/compliance', complianceOverviewSchema),
    refetchInterval: (query) => {
      const waiting = query.state.data?.licenses.some((license) =>
        license.submissions.some((submission) => submission.status === 'queued'),
      );
      return waiting ? 1000 : false;
    },
  });

  if (overview.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (overview.error || !overview.data) {
    return <Alert severity="error">{overview.error?.message ?? 'Compliance could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Licenses"
        title="Compliance"
        lede="Imports stay on the license. A move or stage change is sent only after a manager approves it, and only to the sandbox."
      />
      {overview.data.licenses.length === 0 ? (
        <Alert severity="info">No licenses are available for the facilities you can open.</Alert>
      ) : (
        overview.data.licenses.map((license) => (
          <Card key={license.id} sx={{ mb: 2 }} data-testid="compliance-license">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="compliance-license-number">
                    {license.licenseNumber}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    {license.siteNames.join(', ')} · {license.plantCount} plants
                  </Typography>
                </Box>
                <Button component={RouterLink} to={`/licenses/${license.id}`} variant="outlined">
                  Open inventory
                </Button>
              </Box>
              {license.latestImport ? (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    size="small"
                    label={`${license.latestImport.matchedCount} matched · ${license.latestImport.discrepancyCount} ${license.latestImport.discrepancyCount === 1 ? 'discrepancy' : 'discrepancies'}`}
                  />
                  <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                    File compared {formatTimestamp(license.latestImport.importedAt)}. Status {license.latestImport.status}.
                  </Typography>
                  {license.latestImport.discrepancies.length === 0 ? (
                    <Typography data-testid="compliance-clean" sx={{ mt: 1 }}>
                      No discrepancies.
                    </Typography>
                  ) : (
                    license.latestImport.discrepancies.map((item) => (
                      <Typography key={item.id} data-testid="compliance-discrepancy" sx={{ mt: 1 }}>
                        {item.tag} · {discrepancyLabel(item.kind)}
                      </Typography>
                    ))
                  )}
                </Box>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No inventory file has been compared for this license.
                </Alert>
              )}
              <Typography variant="h3" sx={{ fontSize: 22, mt: 3, mb: 1 }}>
                Submissions
              </Typography>
              <PagedList
                items={license.submissions}
                empty="No submissions for this license."
                render={(submission) => <SubmissionCard key={submission.id} submission={submission} />}
              />
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}

function SubmissionCard({ submission }: { submission: SubmissionView }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState(submission.sandboxOutcome);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['compliance'] });
    await queryClient.invalidateQueries({ queryKey: ['submission', submission.id] });
  };
  const review = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      apiSend(`/submissions/${submission.id}/review`, submissionViewSchema, {
        decision,
        sandboxOutcome: decision === 'approve' ? outcome : undefined,
        note: decision === 'reject' ? 'Held back before send.' : undefined,
      }),
    onSuccess: async (result) => {
      setMessage(result.status === 'rejected' ? 'Rejected. Nothing was sent.' : 'Approved. The outbox will deliver it.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const reconcile = useMutation({
    mutationFn: (finding: 'landed' | 'not_landed') =>
      apiSend(`/submissions/${submission.id}/reconcile`, submissionViewSchema, { finding }),
    onSuccess: async (result) => {
      setMessage(
        result.attempt?.reconciliationResult === 'landed'
          ? 'Sandbox says the write landed. It will not be sent again.'
          : 'Sandbox says the write did not land. A new reviewed submission can be queued.',
      );
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const voidSubmission = useMutation({
    mutationFn: () => apiSend(`/submissions/${submission.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });
  const editNote = useMutation({
    mutationFn: (rejectionNote: string) =>
      apiSend(`/submissions/${submission.id}`, recordRemovedSchema, { rejectionNote: rejectionNote || null }, 'PATCH'),
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });
  const queueAgain = useMutation({
    mutationFn: () =>
      apiSend('/submissions', submissionViewSchema, {
        plantEventId: submission.plantEventId,
        sandboxOutcome: 'success',
      }),
    onSuccess: async () => {
      setMessage('A new submission is waiting for review. It has not been sent.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Box data-testid="submission-card" sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, mt: 1.5 }}>
      <RecordActions
        keepsHistory
        summary={
          <Typography sx={{ fontWeight: 600 }}>
            <RouterLink to={`/submissions/${submission.id}`}>{submission.packageLabel ?? submission.plantTag}</RouterLink>
            {` · ${submission.eventType}`}
          </Typography>
        }
        detail={<Typography>{statusLabel(submission.status)}</Typography>}
        editor={
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
            onSubmit={(event) => {
              event.preventDefault();
              editNote.mutate(String(new FormData(event.currentTarget).get('rejectionNote') ?? ''));
            }}
          >
            <TextField label="Rejection note" name="rejectionNote" defaultValue={submission.rejectionNote ?? ''} />
            <SaveChanges pending={editNote.isPending} />
          </Box>
        }
        onDelete={() => voidSubmission.mutate()}
      />
      <Typography data-testid="submission-note">{submission.eventNote}</Typography>
      <Typography data-testid="submission-status" sx={{ mt: 0.5 }}>
        {statusLabel(submission.status)}
      </Typography>
      {submission.attempt ? (
        <Typography data-testid="submission-attempt" sx={{ color: 'text.secondary' }}>
          Request {submission.attempt.requestId} · {submission.attempt.actorName} · {formatTimestamp(submission.attempt.occurredAt)} ·{' '}
          {submission.attempt.outcome}
          {submission.attempt.reconciliationResult
            ? ` · reconciliation ${submission.attempt.reconciliationResult}`
            : ''}
        </Typography>
      ) : null}
      {submission.status === 'failed' ? (
        <Typography data-testid="submission-failure" sx={{ mt: 1 }}>
          Definite failure. Retry only by queueing a new reviewed submission.
        </Typography>
      ) : null}
      {submission.status === 'uncertain' ? (
        <Typography data-testid="submission-uncertain" sx={{ mt: 1 }}>
          This change will not be sent again until the sandbox says whether it landed.
        </Typography>
      ) : null}
      {submission.status === 'pending_review' ? (
        <Typography data-testid="submission-pending" sx={{ mt: 1 }}>
          Waiting for a manager. Nothing has been sent.
        </Typography>
      ) : null}
      {can(user, 'compliance.write') && submission.status === 'pending_review' ? (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <Button data-testid="approve-submission" variant="contained" onClick={() => review.mutate('approve')} disabled={review.isPending}>
            Approve
          </Button>
          <Button data-testid="reject-submission" onClick={() => review.mutate('reject')} disabled={review.isPending}>
            Reject
          </Button>
        </Box>
      ) : null}
      {can(user, 'compliance.write') && submission.status === 'uncertain' ? (
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button data-testid="reconcile-landed" variant="outlined" onClick={() => reconcile.mutate('landed')} disabled={reconcile.isPending}>
            Sandbox says landed
          </Button>
          <Button data-testid="reconcile-not-landed" variant="outlined" onClick={() => reconcile.mutate('not_landed')} disabled={reconcile.isPending}>
            Sandbox says it did not land
          </Button>
        </Box>
      ) : null}
      {can(user, 'compliance.write') && submission.canQueueAgain ? (
        <Button data-testid="queue-again" sx={{ mt: 1 }} onClick={() => queueAgain.mutate()} disabled={queueAgain.isPending}>
          Queue again
        </Button>
      ) : null}
      {message && (message !== 'Approved. The outbox will deliver it.' || submission.status === 'queued') ? (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="submission-message">
          {message}
        </Alert>
      ) : null}
    </Box>
  );
}
