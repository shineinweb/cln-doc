import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { harvestDetailSchema, roomDetailSchema, type RoomDetail } from '@trim/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { cycleDayLabel, formatCalendarDate, formatTimestamp } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { RoomEnvironment } from '../environment/RoomEnvironment';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel, workbench } from '../theme';

export function RoomDashboardPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { setSiteId } = useSites();
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
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {room.data.zones.map((zone) => (
          <Chip key={zone.id} label={zone.name} />
        ))}
      </Box>
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <SignalCard title="Tasks due today" testId="tasks-due">
          {room.data.tasksDueToday.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No tasks are due today.</Typography>
          ) : (
            room.data.tasksDueToday.map((task) => (
              <Typography key={task.id} data-testid="task-due-today">
                {task.title} · {task.assigneeLabel} · {formatCalendarDate(task.dueOn)}
              </Typography>
            ))
          )}
        </SignalCard>
        <SignalCard title="Last successful Metrc sync" testId="metrc-sync">
          <MetrcSync sync={room.data.lastMetrcSync} />
        </SignalCard>
      </Box>
      <Box sx={{ mb: 3 }}>
        <RoomEnvironment room={room.data} />
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
