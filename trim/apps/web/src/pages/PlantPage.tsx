import { Alert, Box, Button, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { plantDetailSchema, recordRemovedSchema, siteListSchema } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { RecordActions, SaveChanges } from '../records/RecordControls';

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
  if (event.eventType === 'voided') {
    return `${event.actorName} removed this plant from the active list`;
  }
  return `${event.actorName} recorded ${event.eventType}`;
}

export function PlantPage() {
  const { plantId = '' } = useParams();
  const queryClient = useQueryClient();
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
      <BackLink to={`/licenses/${plant.data.licenseId}`} label={plant.data.licenseNumber} />
      <PageHeader
        kicker={`${plant.data.licenseNumber} · ${plant.data.siteNames.join(', ')}`}
        title={plant.data.tag}
        lede={`${plant.data.strainName} · ${plant.data.stage} · ${plant.data.roomName ?? 'No room'} · ${plant.data.cycleName ?? 'No cycle'}`}
      />
      <RecordActions
        keepsHistory
        summary={
          <Typography data-testid="plant-tag" sx={{ mb: 1 }}>
            {plant.data.tag}
          </Typography>
        }
        detail={<Typography>{plant.data.stage}</Typography>}
        editor={
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              const stage = String(new FormData(event.currentTarget).get('stage') ?? '');
              void apiSend(`/plants/${plant.data.id}`, recordRemovedSchema, { stage }, 'PATCH').then(() =>
                queryClient.invalidateQueries({ queryKey: ['plant', plantId] }),
              );
            }}
          >
            <TextField label="Stage" name="stage" defaultValue={plant.data.stage} required />
            <SaveChanges />
          </Box>
        }
        onDelete={() => {
          void apiSend(`/plants/${plant.data.id}`, recordRemovedSchema, undefined, 'DELETE').then(() =>
            queryClient.invalidateQueries({ queryKey: ['plant', plantId] }),
          );
        }}
      />
      {plant.data.status === 'active' ? (
        <MovePlantForm
          plantId={plant.data.id}
          roomId={plant.data.roomId}
          siteNames={plant.data.siteNames}
          onMoved={() => queryClient.invalidateQueries({ queryKey: ['plant', plantId] })}
        />
      ) : (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="plant-not-movable">
          This plant is {plant.data.status}, so it cannot be moved onto a crop for harvest.
        </Alert>
      )}
      {plant.data.events.map((event) => (
        <Typography key={event.id} data-testid="plant-event" sx={{ mb: 1 }}>
          {formatTimestamp(event.occurredAt)} · {eventLine(event)}
        </Typography>
      ))}
    </Box>
  );
}

function MovePlantForm({
  plantId,
  roomId,
  siteNames,
  onMoved,
}: {
  plantId: string;
  roomId: string | null;
  siteNames: string[];
  onMoved: () => void;
}) {
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet('/sites', siteListSchema),
  });
  const rooms = useMemo(() => {
    const allowed = new Set(siteNames);
    return (sites.data ?? [])
      .filter((site) => allowed.has(site.name))
      .flatMap((site) => site.rooms.map((room) => ({ id: room.id, label: `${site.name} · ${room.name}` })));
  }, [siteNames, sites.data]);
  const [targetRoomId, setTargetRoomId] = useState(roomId ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: (nextRoomId: string) => apiSend(`/plants/${plantId}/moves`, plantDetailSchema, { roomId: nextRoomId }),
    onSuccess: async () => {
      setMessage("Plant moved onto that room's active crop when one is open.");
      onMoved();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Box sx={{ display: 'grid', gap: 1, maxWidth: 420, mb: 3 }} data-testid="move-plant">
      <Typography sx={{ fontWeight: 700 }}>Move to room</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        Moving into a room assigns this tag to that room's active crop so Harvest this crop can run.
      </Typography>
      <TextField
        select
        label="Room"
        value={targetRoomId}
        onChange={(event) => setTargetRoomId(event.target.value)}
        required
        inputProps={{ 'data-testid': 'move-plant-room' }}
      >
        {rooms.map((room) => (
          <MenuItem key={room.id} value={room.id}>
            {room.label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        disabled={move.isPending || !targetRoomId || targetRoomId === roomId}
        onClick={() => move.mutate(targetRoomId)}
        sx={{ justifySelf: 'start' }}
        data-testid="move-plant-submit"
      >
        Move plant
      </Button>
      {message ? <Alert severity={move.isError ? 'error' : 'success'}>{message}</Alert> : null}
    </Box>
  );
}
