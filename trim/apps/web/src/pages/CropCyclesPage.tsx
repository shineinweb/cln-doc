import { Alert, Box, Card, CardContent, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { recordRemovedSchema } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { addCalendarDays, cycleDayLabel, formatCalendarDate, inclusiveDayCount } from '../crops/format';
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
        lede="Active cycles on the selected facility. Start a cycle from the room dashboard. Open one here to read its timeline, movements, observations, and labor."
      />
      {loading ? <Skeleton variant="rounded" height={160} /> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!loading && !site ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {site ? (
        <>
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
    startDate: string;
    expectedHarvestDate: string;
    stage: string;
    cycleDay: number;
  };
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(cycle.startDate);
  const [durationDays, setDurationDays] = useState(String(Math.max(1, inclusiveDayCount(cycle.startDate, cycle.expectedHarvestDate))));
  const endDate = useMemo(() => {
    const days = Number(durationDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(days) || days < 1) {
      return null;
    }
    return addCalendarDays(startDate, days - 1);
  }, [durationDays, startDate]);
  const save = useMutation({
    mutationFn: (body: { name: string; cultivar: string; stage: string; startDate: string; expectedHarvestDate: string }) =>
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
                if (!endDate) {
                  return;
                }
                const form = new FormData(event.currentTarget);
                save.mutate({
                  name: String(form.get('name') ?? ''),
                  cultivar: String(form.get('cultivar') ?? ''),
                  stage: String(form.get('stage') ?? ''),
                  startDate,
                  expectedHarvestDate: endDate,
                });
              }}
            >
              <TextField label="Name" name="name" defaultValue={cycle.name} required />
              <TextField label="Cultivar" name="cultivar" defaultValue={cycle.cultivar} required />
              <TextField select label="Stage" name="stage" defaultValue={cycle.stage in ROOM_TYPE_LABELS ? cycle.stage : 'flower'}>
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Start"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Cycle duration in days"
                name="durationDays"
                type="number"
                required
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                inputProps={{ min: 1, step: 1 }}
              />
              <Typography sx={{ color: endDate ? 'text.primary' : 'text.secondary' }}>
                {endDate ? `End of cycle ${formatCalendarDate(endDate)}.` : 'End of cycle is calculated from the start date and the duration. The start date is day 1.'}
              </Typography>
              <SaveChanges pending={save.isPending || !endDate} />
            </Box>
          }
          onDelete={() => remove.mutate()}
        />
        {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}
