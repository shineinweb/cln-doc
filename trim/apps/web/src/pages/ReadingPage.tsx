import { Alert, Box, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { environmentalReadingSchema, recordRemovedSchema } from '@trim/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { RecordActions, SaveChanges } from '../records/RecordControls';

export function ReadingPage() {
  const { readingId = '' } = useParams();
  const queryClient = useQueryClient();
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
      <RecordActions
        summary={
          <Typography data-testid="reading-detail">
            {row.deviceId} · {row.quality} · {formatTimestamp(row.recordedAt)}
            {row.isSample ? (
              <Box component="span" data-testid="reading-sample-label">
                {' '}
                · Sample data
              </Box>
            ) : null}
          </Typography>
        }
        detail={<Typography>{row.value} {row.unit}</Typography>}
        editor={
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const quality = String(form.get('quality') ?? 'good');
              void apiSend(
                `/readings/${row.id}`,
                recordRemovedSchema,
                {
                  value: Number(form.get('value')),
                  unit: String(form.get('unit') ?? ''),
                  quality: quality === 'suspect' || quality === 'bad' ? quality : 'good',
                },
                'PATCH',
              ).then(() => queryClient.invalidateQueries({ queryKey: ['reading', readingId] }));
            }}
          >
            <TextField label="Value" name="value" type="number" defaultValue={row.value} required />
            <TextField label="Unit" name="unit" defaultValue={row.unit} required />
            <TextField select label="Quality" name="quality" defaultValue={row.quality}>
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="suspect">Suspect</MenuItem>
              <MenuItem value="bad">Bad</MenuItem>
            </TextField>
            <SaveChanges />
          </Box>
        }
        onDelete={() => {
          void apiSend(`/readings/${row.id}`, recordRemovedSchema, undefined, 'DELETE');
        }}
      />
    </Box>
  );
}
