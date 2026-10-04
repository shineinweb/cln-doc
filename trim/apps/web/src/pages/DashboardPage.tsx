import { Alert, Box, Card, CardActionArea, CardContent, Skeleton, Typography } from '@mui/material';
import { workspaceTodaySchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { RoomGlyph } from '../components/Graphics';
import { PageHeader } from '../components/PageHeader';
import { formatCalendarDate } from '../crops/format';
import { useSites } from '../layout/SiteProvider';
import { displayFont, roomTypeColor, roomTypeLabel, workbench } from '../theme';
import { DashboardCharts } from './DashboardCharts';
import { FacilityBoard } from './FacilityBoard';

export function DashboardPage() {
  const { user } = useAuth();
  const { sites, site, siteId, loading, error } = useSites();
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => apiGet('/workspace/today', workspaceTodaySchema),
  });
  const rooms = site?.rooms ?? [];
  const activeCrops = rooms.filter((room) => room.currentCycle).length;

  return (
    <Box data-testid="main-dashboard">
      <PageHeader
        kicker={user?.organizationName ?? 'Today'}
        title="Dashboard"
        lede={
          site
            ? `${site.name} is selected. The facility board, yield charts, rooms, and tasks due today all use this facility.`
            : 'Choose a facility in the top bar to see its rooms.'
        }
      />
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {loading ? <Skeleton variant="rounded" height={120} /> : null}
      {!loading && site ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <Stat label="Facilities" value={String(sites.length)} />
          <Stat label="Rooms" value={String(rooms.length)} />
          <Stat label="Active crops" value={String(activeCrops)} />
          <Stat
            label="Tasks due"
            value={
              workspace.data
                ? String(workspace.data.tasks.length + workspace.data.roomTasks.length + workspace.data.duties.length)
                : '—'
            }
          />
        </Box>
      ) : null}
      {siteId ? <FacilityBoard siteId={siteId} /> : null}
      {siteId ? <DashboardCharts siteId={siteId} /> : null}
      <Typography variant="h2" sx={{ fontSize: 26, mb: 1.5 }}>
        Rooms
      </Typography>
      {!loading && rooms.length === 0 ? <Alert severity="info">No rooms are recorded for this facility.</Alert> : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 1.5, mb: 3 }}>
        {rooms.map((room) => (
          <Card key={room.id} sx={{ borderLeft: `6px solid ${roomTypeColor(room.roomType)}` }}>
            <CardActionArea component={RouterLink} to={`/rooms/${room.id}`} data-testid="dashboard-room">
              <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <RoomGlyph color={roomTypeColor(room.roomType)} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{room.name}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                    {roomTypeLabel(room.roomType)}
                    {room.currentCycle
                      ? ` · ${room.currentCycle.name} · Day ${room.currentCycle.cycleDay}`
                      : ' · No active crop'}
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Typography variant="h2" sx={{ fontSize: 26, mb: 1.5 }}>
        Tasks due today
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
        Crop cycles, room chores, and recurring duties. Open{' '}
        <RouterLink to="/workspace">Tasks</RouterLink> for the full list.
      </Typography>
      {workspace.isPending ? <Skeleton variant="rounded" height={80} /> : null}
      {workspace.error ? <Alert severity="error">{workspace.error.message}</Alert> : null}
      {workspace.data &&
      workspace.data.tasks.length + workspace.data.roomTasks.length + workspace.data.duties.length === 0 ? (
        <Alert severity="info">Nothing is due for you today.</Alert>
      ) : null}
      {workspace.data ? (
        <Box sx={{ display: 'grid', gap: 1 }} data-testid="dashboard-tasks">
          <Typography sx={{ color: 'text.secondary' }}>{formatCalendarDate(workspace.data.date)}</Typography>
          {workspace.data.tasks.map((task) => (
            <Card key={`cycle-${task.id}`}>
              <CardContent>
                <Typography>
                  Cycle · <RouterLink to={`/tasks/${task.id}`}>{task.title}</RouterLink>
                  {` · ${task.roomName} · ${formatCalendarDate(task.dueOn)}`}
                </Typography>
              </CardContent>
            </Card>
          ))}
          {workspace.data.roomTasks.map((task) => (
            <Card key={`room-${task.id}`}>
              <CardContent>
                <Typography>
                  Room · <RouterLink to={`/rooms/${task.roomId}`}>{task.title}</RouterLink>
                  {` · ${task.roomName}`}
                </Typography>
              </CardContent>
            </Card>
          ))}
          {workspace.data.duties.map((duty) => (
            <Card key={`duty-${duty.id}`}>
              <CardContent>
                <Typography>
                  Duty · <RouterLink to="/operations/recurring">{duty.title}</RouterLink>
                  {` · ${duty.siteName} · next ${formatCalendarDate(duty.nextDueOn)}`}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ bgcolor: workbench.mist }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: 32, lineHeight: 1.1 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
