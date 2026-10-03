import { Alert, Box, Card, CardActionArea, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel } from '../theme';

export function RoomsPage() {
  const { site, loading, error } = useSites();

  return (
    <Box>
      <PageHeader
        kicker="Center"
        title="Rooms"
        lede="Open a room to see its current crop, cycle day, and operating history."
      />
      {loading ? <Skeleton variant="rounded" height={180} /> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!loading && !site ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {site ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {site.rooms.map((room) => (
            <Card key={room.id}>
              <CardActionArea component={RouterLink} to={`/rooms/${room.id}`}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontSize: 24 }}>
                      {room.name}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {room.currentCycle
                        ? `${room.currentCycle.cultivar} · ${room.currentCycle.plantCount} plants`
                        : 'No active crop'}
                    </Typography>
                  </Box>
                  <Chip label={roomTypeLabel(room.roomType)} />
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
