import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { plantDetailSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';

function eventLine(event: {
  eventType: string;
  actorName: string;
  toRoomName: string | null;
  fromRoomName: string | null;
  fromStage: string | null;
  toStage: string | null;
  note: string | null;
}): string {
  if (event.eventType === 'moved') {
    return `${event.actorName} moved this plant from ${event.fromRoomName ?? 'nowhere'} to ${event.toRoomName ?? 'nowhere'}`;
  }
  if (event.eventType === 'stage_changed') {
    return `${event.actorName} changed the stage from ${event.fromStage ?? 'unset'} to ${event.toStage ?? 'unset'}`;
  }
  if (event.eventType === 'observed') {
    return `${event.actorName} noted: ${event.note ?? ''}`;
  }
  return `${event.actorName} recorded ${event.eventType}`;
}

export function PlantPage() {
  const { plantId = '' } = useParams();
  const plant = useQuery({
    queryKey: ['plant', plantId],
    queryFn: () => apiGet(`/plants/${plantId}`, plantDetailSchema),
    enabled: Boolean(plantId),
    retry: false,
  });

  if (plant.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (plant.error instanceof ApiError && (plant.error.status === 403 || plant.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="plant-access-warning">
        {plant.error.status === 403 ? 'You do not have access to this plant.' : 'This plant was not found.'}
      </Alert>
    );
  }
  if (plant.error || !plant.data) {
    return <Alert severity="error">{plant.error?.message ?? 'This plant could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker={`${plant.data.licenseNumber} · ${plant.data.siteNames.join(', ')}`}
        title={plant.data.tag}
        lede={`${plant.data.strainName} · ${plant.data.stage} · ${plant.data.roomName ?? 'No room'} · ${plant.data.cycleName ?? 'No cycle'}`}
      />
      <Typography data-testid="plant-tag" sx={{ mb: 2 }}>
        {plant.data.tag}
      </Typography>
      {plant.data.events.map((event) => (
        <Typography key={event.id} data-testid="plant-event" sx={{ mb: 1 }}>
          {formatTimestamp(event.occurredAt)} · {eventLine(event)}
        </Typography>
      ))}
    </Box>
  );
}
