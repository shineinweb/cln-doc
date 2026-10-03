import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { environmentalReadingSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';

export function ReadingPage() {
  const { readingId = '' } = useParams();
  const reading = useQuery({
    queryKey: ['reading', readingId],
    queryFn: () => apiGet(`/readings/${readingId}`, environmentalReadingSchema),
    enabled: Boolean(readingId),
    retry: false,
  });

  if (reading.isPending) {
    return <Skeleton variant="rounded" height={180} />;
  }

  if (reading.error instanceof ApiError && (reading.error.status === 403 || reading.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="reading-access-warning">
        {reading.error.status === 403
          ? 'You do not have access to this reading.'
          : 'This reading is not on a facility you can open.'}
      </Alert>
    );
  }

  if (reading.error || !reading.data) {
    return <Alert severity="error">{reading.error?.message ?? 'This reading could not be loaded.'}</Alert>;
  }

  const row = reading.data;
  return (
    <Box>
      <PageHeader kicker="Environmental reading" title={row.metric} lede={`${row.value} ${row.unit}`} />
      <Typography data-testid="reading-detail">
        {row.deviceId} · {row.quality} · {formatTimestamp(row.recordedAt)}
        {row.isSample ? (
          <Box component="span" data-testid="reading-sample-label">
            {' '}
            · Sample data
          </Box>
        ) : null}
      </Typography>
    </Box>
  );
}
