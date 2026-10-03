import { Alert, Box, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { roomDetailSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel, workbench } from '../theme';

const LATER = [
  { title: 'Tasks', body: 'Nothing is recorded here yet.' },
  { title: 'Climate', body: 'Sensor history is not part of this release.' },
  { title: 'Crop stage', body: 'Crop cycles are not part of this release.' },
];

export function RoomDashboardPage() {
  const { roomId = '' } = useParams();
  const { setSiteId } = useSites();
  const room = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => apiGet(`/rooms/${roomId}`, roomDetailSchema),
    enabled: Boolean(roomId),
    retry: false,
  });

  useEffect(() => {
    if (room.data) {
      setSiteId(room.data.siteId, { navigate: false });
    }
  }, [room.data, setSiteId]);

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

  return (
    <Box>
      <PageHeader
        kicker={`${room.data.siteName} · ${roomTypeLabel(room.data.roomType)}`}
        title={room.data.name}
        lede="This is the room dashboard shell. The room, its facility, and its zones come from the database. The work panels below are placeholders."
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {room.data.zones.map((zone) => (
          <Chip key={zone.id} label={zone.name} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
        {LATER.map((panel) => (
          <Card key={panel.title} sx={{ bgcolor: workbench.mist }}>
            <CardContent>
              <Typography variant="h3" sx={{ fontSize: 22 }}>
                {panel.title}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>{panel.body}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
