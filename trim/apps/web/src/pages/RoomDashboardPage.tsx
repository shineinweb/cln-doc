import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import {
  harvestDetailSchema,
  recordRemovedSchema,
  roomDetailSchema,
  startedCycleSchema,
  zoneSchema,
  type RoomDetail,
  type Zone,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { addCalendarDays, cycleDayLabel, formatCalendarDate, formatTimestamp, inclusiveDayCount } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { RoomAdapters } from '../adapters/RoomAdapters';
import { RoomEnvironment } from '../environment/RoomEnvironment';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { ROOM_TYPE_LABELS, roomTypeLabel, workbench } from '../theme';

export function RoomDashboardPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSiteId } = useSites();
  const [tab, setTab] = useState<'cycle' | 'room'>('cycle');
  const harvestCrop = useMutation({
    mutationFn: (cycleId: string) => apiSend('/harvests', harvestDetailSchema, { cycleId }),
    onSuccess: (harvest) => navigate(`/harvests/${harvest.id}`),
  });
  const room = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => apiGet(`/rooms/${roomId}`, roomDetailSchema),
    enabled: Boolean(roomId),
    retry: false,
  });

  const setSiteIdRef = useRef(setSiteId);
  setSiteIdRef.current = setSiteId;
  useEffect(() => {
    if (room.data) {
      setSiteIdRef.current(room.data.siteId, { navigate: false });
    }
  }, [room.data]);

  if (room.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }

  if (room.error instanceof ApiError && (room.error.status === 403 || room.error.status === 404)) {
    return (
      <Alert severity="warning">
        {room.error.status === 403
          ? 'You do not have access to this room.'
          : 'This room is not on a facility you can open.'}
      </Alert>
    );
  }

  if (room.error || !room.data) {
    return <Alert severity="error">{room.error?.message ?? 'This room could not be loaded.'}</Alert>;
  }

  const cycle = room.data.currentCycle;

  return (
    <Box>
      <PageHeader
        kicker={`${room.data.siteName} · ${roomTypeLabel(room.data.roomType)}`}
        title={room.data.name}
        lede="The room dashboard is the daily workspace. Crop figures, readings, and alerts below are stored records."
      />
      <Tabs value={tab} onChange={(_event, value: 'cycle' | 'room') => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="cycle" label="Crop cycle" data-testid="room-tab-cycle" />
        <Tab value="room" label="Room" data-testid="room-tab-room" />
      </Tabs>
      {tab === 'cycle' ? (
        <Box>
          {user?.isOrgAdmin ? <ResetRoomForm roomId={room.data.id} roomType={room.data.roomType} /> : null}
          {cycle ? (
            <Card sx={{ mb: 2 }} data-testid="current-cycle">
              <CardContent>
                <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.14em' }}>
                  Current crop
                </Typography>
                <Typography variant="h2" sx={{ fontSize: 32 }} data-testid="room-crop-name">
                  {cycle.name}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2 }}>
                  <Metric label="Cultivar" value={cycle.cultivar} testId="room-cultivar" />
                  <Metric label="Plants" value={String(cycle.plantCount)} testId="room-plant-count" />
                  <Metric label="Stage" value={roomTypeLabel(cycle.stage)} testId="room-stage" />
                  <Metric label="Cycle day" value={cycleDayLabel(cycle.cycleDay)} testId="room-cycle-day" />
                </Box>
                <Typography sx={{ mt: 2 }} data-testid="room-expected-harvest">
                  Expected harvest {formatCalendarDate(cycle.expectedHarvestDate)}
                </Typography>
                <EditCycleForm cycle={cycle} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Button component={RouterLink} to={`/rooms/${room.data.id}/cycles/${cycle.id}`} variant="contained" data-testid="open-cycle">
                    Open crop cycle
                  </Button>
                  {cycle.plantCount > 0 ? (
                    <Button
                      variant="outlined"
                      data-testid="harvest-crop"
                      disabled={harvestCrop.isPending}
                      onClick={() => harvestCrop.mutate(cycle.id)}
                    >
                      Harvest this crop
                    </Button>
                  ) : null}
                </Box>
                {harvestCrop.error ? (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {harvestCrop.error.message}
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              This room has no active crop cycle.
            </Alert>
          )}
          {room.data.archivedCycles.length > 0 ? (
            <ArchivedCrops roomId={room.data.id} cycles={room.data.archivedCycles} />
          ) : null}
        </Box>
      ) : (
        <Box>
          <ZoneList roomId={room.data.id} zones={room.data.zones} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
            <SignalCard title="Tasks due today" testId="tasks-due">
              <PagedList
                items={room.data.tasksDueToday}
                empty="No tasks are due today."
                render={(task) => <TaskDueRow key={task.id} task={task} />}
              />
            </SignalCard>
            <SignalCard title="Last successful Metrc sync" testId="metrc-sync">
              <MetrcSync sync={room.data.lastMetrcSync} />
            </SignalCard>
          </Box>
          <Box sx={{ mb: 3 }}>
            <RoomEnvironment room={room.data} />
          </Box>
          <Box sx={{ mb: 3 }}>
            <RoomAdapters roomId={room.data.id} siteId={room.data.siteId} timeZone={room.data.siteTimezone} />
          </Box>
          {room.data.operatingHistory ? (
            <Box>
              <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
                Operating history
              </Typography>
              <OperatingHistoryView history={room.data.operatingHistory} />
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function EditCycleForm({
  cycle,
}: {
  cycle: { id: string; roomId: string; name: string; cultivar: string; stage: string; startDate: string; expectedHarvestDate: string };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
    mutationFn: (body: Record<string, unknown>) => apiSend(`/cycles/${cycle.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: async () => {
      setMessage('Crop cycle saved.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['room', cycle.roomId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const stage = cycle.stage in ROOM_TYPE_LABELS ? cycle.stage : 'flower';

  if (!open) {
    return (
      <Box sx={{ mt: 2 }}>
        <Button variant="outlined" data-testid="edit-cycle" onClick={() => setOpen(true)}>
          Edit
        </Button>
        {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
      </Box>
    );
  }

  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 480, mt: 2 }}
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
      <Typography variant="h3" sx={{ fontSize: 22 }}>
        Edit crop cycle
      </Typography>
      <TextField label="Name" name="name" required defaultValue={cycle.name} />
      <TextField label="Cultivar" name="cultivar" required defaultValue={cycle.cultivar} />
      <TextField select label="Stage" name="stage" defaultValue={stage}>
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
        inputProps={{ 'data-testid': 'cycle-start' }}
      />
      <TextField
        label="Cycle duration in days"
        name="durationDays"
        type="number"
        required
        value={durationDays}
        onChange={(event) => setDurationDays(event.target.value)}
        inputProps={{ min: 1, step: 1, 'data-testid': 'cycle-duration' }}
      />
      <Typography data-testid="cycle-end-date" sx={{ color: endDate ? 'text.primary' : 'text.secondary' }}>
        {endDate ? `End of cycle ${formatCalendarDate(endDate)}.` : 'End of cycle is calculated from the start date and the duration. The start date is day 1.'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <SaveChanges pending={save.isPending || !endDate} />
        <Button type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </Box>
      {message ? <Alert>{message}</Alert> : null}
    </Box>
  );
}

function ResetRoomForm({ roomId, roomType }: { roomId: string; roomType: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const endDate = useMemo(() => {
    const days = Number(durationDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(days) || days < 1) {
      return null;
    }
    return addCalendarDays(startDate, days - 1);
  }, [durationDays, startDate]);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/rooms/${roomId}/reset`, startedCycleSchema, body),
    onSuccess: async () => {
      setMessage('Room reset.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const stage = roomType in ROOM_TYPE_LABELS ? roomType : 'flower';

  if (!open) {
    return (
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" data-testid="reset-room" onClick={() => setOpen(true)}>
          Reset room
        </Button>
        {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
      </Box>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Reset room
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          This closes the current crop and keeps it in the archive. Zones and readings stay on this room. The start date is day 1.
        </Typography>
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1.5, maxWidth: 480 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!endDate) {
              return;
            }
            const form = new FormData(event.currentTarget);
            const harvestDate = String(form.get('harvestDate') ?? '');
            save.mutate({
              strain: String(form.get('strain') ?? ''),
              plantCount: Number(form.get('plantCount')),
              stage: String(form.get('stage') ?? ''),
              startDate,
              durationDays: Number(durationDays),
              harvestDate: harvestDate || null,
            });
          }}
        >
          <TextField label="Strain" name="strain" required inputProps={{ 'data-testid': 'reset-strain' }} />
          <TextField label="Plant count" name="plantCount" type="number" required inputProps={{ min: 1, 'data-testid': 'reset-plant-count' }} />
          <TextField select label="Stage" name="stage" defaultValue={stage}>
            {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'reset-start' }}
          />
          <TextField
            label="Cycle duration in days"
            name="durationDays"
            type="number"
            required
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
            inputProps={{ min: 1, step: 1, 'data-testid': 'reset-duration' }}
          />
          <Typography data-testid="reset-end-date" sx={{ color: endDate ? 'text.primary' : 'text.secondary' }}>
            {endDate ? `End of cycle ${formatCalendarDate(endDate)}.` : 'End of cycle is calculated from the start date and the duration. The start date is day 1.'}
          </Typography>
          <TextField
            label="Harvest date"
            name="harvestDate"
            type="date"
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'reset-harvest' }}
            helperText="Optional. Stored on the crop being closed."
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" disabled={save.isPending || !endDate} data-testid="reset-room">
              Reset room
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Box>
        </Box>
        {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function ArchivedCrops({ roomId, cycles }: { roomId: string; cycles: RoomDetail['archivedCycles'] }) {
  return (
    <Box sx={{ mb: 2 }} data-testid="archived-crops">
      <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
        Archived crops
      </Typography>
      {cycles.map((cycle) => (
        <Typography key={cycle.id} data-testid="archived-crop">
          <RouterLink to={`/rooms/${roomId}/cycles/${cycle.id}`}>{cycle.name}</RouterLink>
          {` · ${cycle.cultivar} · ${roomTypeLabel(cycle.stage)} · started ${formatCalendarDate(cycle.startDate)}`}
          {cycle.harvestDate ? ` · harvest ${formatCalendarDate(cycle.harvestDate)}` : ' · no harvest date'}
        </Typography>
      ))}
    </Box>
  );
}

function ZoneList({ roomId, zones }: { roomId: string; zones: Zone[] }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['room', roomId] });
  const add = useMutation({
    mutationFn: (name: string) => apiSend(`/rooms/${roomId}/zones`, zoneSchema, { name }),
    onSuccess: async () => {
      setMessage('Zone added.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box sx={{ mb: 3 }}>
      <PagedList
        items={zones}
        empty="No zones yet."
        testId="zone-list"
        render={(zone) => <ZoneRow key={zone.id} zone={zone} onChanged={refresh} />}
      />
      <Box
        component="form"
        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          add.mutate(String(new FormData(form).get('name') ?? ''));
          form.reset();
        }}
      >
        <TextField label="Zone name" name="name" required size="small" />
        <Button type="submit" variant="contained" disabled={add.isPending}>
          Add zone
        </Button>
      </Box>
      {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
    </Box>
  );
}

function ZoneRow({ zone, onChanged }: { zone: Zone; onChanged: () => Promise<void> }) {
  const save = useMutation({
    mutationFn: (name: string) => apiSend(`/zones/${zone.id}`, zoneSchema, { name }, 'PATCH'),
    onSuccess: () => onChanged(),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/zones/${zone.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: () => onChanged(),
  });
  return (
    <RecordActions
      summary={<Chip label={zone.name} />}
      detail={<Typography>{zone.code}</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(String(new FormData(event.currentTarget).get('name') ?? ''));
          }}
        >
          <TextField label="Name" name="name" defaultValue={zone.name} required />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function TaskDueRow({ task }: { task: { id: string; title: string; assigneeLabel: string; dueOn: string } }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['room'] });
  const save = useMutation({
    mutationFn: (body: { title: string; dueOn: string }) => apiSend(`/tasks/${task.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      summary={
        <Typography data-testid="task-due-today">
          <RouterLink to={`/tasks/${task.id}`}>{task.title}</RouterLink>
          {` · ${task.assigneeLabel} · ${formatCalendarDate(task.dueOn)}`}
        </Typography>
      }
      detail={<Typography>{task.assigneeLabel}</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({ title: String(form.get('title') ?? ''), dueOn: String(form.get('dueOn') ?? '') });
          }}
        >
          <TextField label="Title" name="title" defaultValue={task.title} required />
          <TextField label="Due" name="dueOn" type="date" defaultValue={task.dueOn} required InputLabelProps={{ shrink: true }} />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <Box>
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600 }} data-testid={testId}>
        {value}
      </Typography>
    </Box>
  );
}

function SignalCard({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <Card sx={{ bgcolor: workbench.mist }} data-testid={testId}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function MetrcSync({ sync }: { sync: RoomDetail['lastMetrcSync'] }) {
  if (!sync) {
    return <Typography sx={{ color: 'text.secondary' }}>No successful Metrc sync is recorded.</Typography>;
  }
  return (
    <Typography>
      {formatTimestamp(sync.succeededAt)}
      {sync.isSample ? ' · Sample data' : ''}
    </Typography>
  );
}
