import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import {
  recordRemovedSchema,
  roomDetailSchema,
  startedCycleSchema,
  zoneSchema,
  type RoomDetail,
  type Zone,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { addCalendarDays, formatCalendarDate, formatTimestamp } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { RoomAdapters } from '../adapters/RoomAdapters';
import { TrolmasterChart } from '../adapters/TrolmasterChart';
import { TrolmasterPanel } from '../adapters/TrolmasterPanel';
import { RoomAlertRules, RoomEnvironment } from '../environment/RoomEnvironment';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { RoomNotesPanel } from '../rooms/RoomNotesPanel';
import { RoomTasksPanel } from '../rooms/RoomTasksPanel';
import { ROOM_TYPE_LABELS, roomTypeLabel, workbench } from '../theme';

export function RoomDashboardPage() {
  const { roomId = '' } = useParams();
  const { user } = useAuth();
  const { setSiteId } = useSites();
  const [tab, setTab] = useState<RoomTab>('room');
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
        lede="The room opens on the Trolmaster chart and operating history. Zones, Trolmaster settings, and room settings are on their own tabs."
      />
      <Tabs value={tab} onChange={(_event, value: RoomTab) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="room" label="Room" data-testid="room-tab-room" />
        <Tab value="tasks" label="Tasks" data-testid="room-tab-tasks" />
        <Tab value="notes" label="Notes" data-testid="room-tab-notes" />
        <Tab value="zones" label="Zones" data-testid="room-tab-zones" />
        {room.data.roomType === 'flower' ? <Tab value="trolmaster" label="Trolmaster settings" data-testid="room-tab-trolmaster" /> : null}
        <Tab value="settings" label="Settings" data-testid="room-tab-settings" />
      </Tabs>
      {tab === 'room' ? (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <TrolmasterChart roomId={room.data.id} timeZone={room.data.siteTimezone} />
          <Box data-testid="room-operating-history">
            {room.data.operatingHistory ? (
              <Box>
                <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
                  Operating history
                </Typography>
                <OperatingHistoryView history={room.data.operatingHistory} hideObservations timeZone={room.data.siteTimezone} />
              </Box>
            ) : (
              <Alert severity="info">This room has no operating history.</Alert>
            )}
          </Box>
        </Box>
      ) : null}
      {tab === 'tasks' ? (
        <RoomTasksPanel
          roomId={room.data.id}
          siteId={room.data.siteId}
          tasksDueToday={room.data.tasksDueToday}
          managedTasks={room.data.managedTasks}
        />
      ) : null}
      {tab === 'notes' ? (
        <RoomNotesPanel roomId={room.data.id} cycleName={cycle?.name ?? null} timeZone={room.data.siteTimezone} notes={room.data.operatingHistory?.observations ?? []} />
      ) : null}
      {tab === 'zones' ? <ZoneList roomId={room.data.id} zones={room.data.zones} /> : null}
      {tab === 'trolmaster' && room.data.roomType === 'flower' ? (
        <TrolmasterPanel siteId={room.data.siteId} roomId={room.data.id} />
      ) : null}
      {tab === 'settings' ? (
        <Box data-testid="room-settings" sx={{ display: 'grid', gap: 3 }}>
          <RoomAlertRules room={room.data} />
          {user?.isOrgAdmin ? <ResetRoomForm roomId={room.data.id} roomType={room.data.roomType} /> : null}
          {room.data.archivedCycles.length > 0 ? (
            <ArchivedCrops roomId={room.data.id} cycles={room.data.archivedCycles} />
          ) : null}
          <SignalCard title="Last successful Metrc sync" testId="metrc-sync">
            <MetrcSync sync={room.data.lastMetrcSync} />
          </SignalCard>
          <RoomEnvironment room={room.data} />
          <RoomAdapters roomId={room.data.id} siteId={room.data.siteId} timeZone={room.data.siteTimezone} />
        </Box>
      ) : null}
    </Box>
  );
}

type RoomTab = 'room' | 'tasks' | 'notes' | 'zones' | 'trolmaster' | 'settings';

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
          This closes the current crop and keeps it in the archive. Zones stay on the Zones tab. Readings and alert rules stay on Settings. The start date is day 1.
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
