import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { recordRemovedSchema, startedCycleSchema, workflowDirectorySchema } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { cycleDayLabel, formatCalendarDate } from '../crops/format';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { ROOM_TYPE_LABELS, roomTypeLabel } from '../theme';

export function CropCyclesPage() {
  const { site, loading, error } = useSites();
  const cycles = site?.rooms.filter((room) => room.currentCycle) ?? [];

  return (
    <Box>
      <PageHeader
        kicker={site?.name ?? 'Facility'}
        title="Crop cycles"
        lede="Active cycles on the selected facility. Open one to read its timeline, movements, observations, and labor."
      />
      {loading ? <Skeleton variant="rounded" height={160} /> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!loading && !site ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {site ? (
        <>
          <AddCycleForm rooms={site.rooms.map((room) => ({ id: room.id, name: room.name }))} />
          <PagedList
            items={cycles}
            empty="No active crop cycles are recorded here."
            testId="cycle-list"
            render={(room) => {
              const cycle = room.currentCycle;
              if (!cycle) {
                return null;
              }
              return <CycleRow key={cycle.id} roomName={room.name} cycle={cycle} />;
            }}
          />
        </>
      ) : null}
    </Box>
  );
}

function CycleRow({
  roomName,
  cycle,
}: {
  roomName: string;
  cycle: {
    id: string;
    roomId: string;
    name: string;
    cultivar: string;
    plantCount: number;
    expectedHarvestDate: string;
    stage: string;
    cycleDay: number;
  };
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; cultivar: string; expectedHarvestDate: string }) =>
      apiSend(`/cycles/${cycle.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: async () => {
      setMessage('Crop cycle saved.');
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/cycles/${cycle.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Card>
      <CardContent>
        <RecordActions
          summary={
            <Box>
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                <RouterLink to={`/rooms/${cycle.roomId}/cycles/${cycle.id}`}>{cycle.name}</RouterLink>
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                {roomName} · {cycle.cultivar} · {cycle.plantCount} plants · harvest {formatCalendarDate(cycle.expectedHarvestDate)}
              </Typography>
            </Box>
          }
          detail={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={roomTypeLabel(cycle.stage)} />
              <Chip label={cycleDayLabel(cycle.cycleDay)} />
            </Box>
          }
          editor={
            <Box
              component="form"
              sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                save.mutate({
                  name: String(form.get('name') ?? ''),
                  cultivar: String(form.get('cultivar') ?? ''),
                  expectedHarvestDate: String(form.get('expectedHarvestDate') ?? ''),
                });
              }}
            >
              <TextField label="Name" name="name" defaultValue={cycle.name} required />
              <TextField label="Cultivar" name="cultivar" defaultValue={cycle.cultivar} required />
              <TextField
                label="Expected harvest"
                name="expectedHarvestDate"
                type="date"
                defaultValue={cycle.expectedHarvestDate}
                required
                InputLabelProps={{ shrink: true }}
              />
              <SaveChanges pending={save.isPending} />
            </Box>
          }
          onDelete={() => remove.mutate()}
        />
        {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function AddCycleForm({ rooms }: { rooms: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const directory = useQuery({
    queryKey: ['workflow-directory'],
    queryFn: () => apiGet('/workflows/directory', workflowDirectorySchema),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend('/cycles', startedCycleSchema, body),
    onSuccess: async () => {
      setMessage('Crop cycle started.');
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Start a crop cycle
        </Typography>
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1.5, maxWidth: 480 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({
              roomId: String(form.get('roomId') ?? ''),
              name: String(form.get('name') ?? ''),
              cultivar: String(form.get('cultivar') ?? ''),
              plantCount: Number(form.get('plantCount')),
              stage: String(form.get('stage') ?? ''),
              startDate: String(form.get('startDate') ?? ''),
              expectedHarvestDate: String(form.get('expectedHarvestDate') ?? ''),
              templateVersionId: String(form.get('templateVersionId') ?? ''),
            });
          }}
        >
          <TextField select label="Room" name="roomId" defaultValue={rooms[0]?.id ?? ''} required data-testid="cycle-room">
            {rooms.map((room) => (
              <MenuItem key={room.id} value={room.id}>
                {room.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Name" name="name" required />
          <TextField label="Cultivar" name="cultivar" required />
          <TextField label="Plant count" name="plantCount" type="number" required />
          <TextField select label="Stage" name="stage" defaultValue="flower">
            {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Start" name="startDate" type="date" required InputLabelProps={{ shrink: true }} />
          <TextField label="Expected harvest" name="expectedHarvestDate" type="date" required InputLabelProps={{ shrink: true }} />
          <TextField
            select
            label="Template"
            name="templateVersionId"
            defaultValue={directory.data?.templates[0]?.currentVersion.id ?? ''}
            required
          >
            {(directory.data?.templates ?? []).map((template) => (
              <MenuItem key={template.currentVersion.id} value={template.currentVersion.id}>
                {template.name}
                {template.cultivar ? ` · ${template.cultivar}` : ''}
                {template.medium ? ` · ${template.medium}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" disabled={save.isPending} data-testid="start-cycle" sx={{ justifySelf: 'start' }}>
            Start cycle
          </Button>
        </Box>
        {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}
