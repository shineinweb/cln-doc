import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { formatCalendarDate } from '../crops/format';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel } from '../theme';

export function FacilityPage() {
  const { site, loading, error } = useSites();

  if (loading) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }
  if (!site) {
    return <Alert severity="info">No facilities are assigned to this account.</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker={site.code}
        title={site.name}
        lede={[site.addressLine1, site.city, site.region, site.postalCode].filter(Boolean).join(', ') || 'Rooms at this facility.'}
      />
      {site.rooms.length === 0 ? (
        <Alert severity="info">No rooms are recorded at this facility yet.</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {site.rooms.map((room) => (
            <Card key={room.id} data-testid="facility-room-card">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="h3" sx={{ fontSize: 26 }}>
                    {room.name}
                  </Typography>
                  <Chip label={roomTypeLabel(room.roomType)} size="small" />
                </Box>
                {room.currentCycle ? (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography data-testid="facility-crop" sx={{ fontWeight: 600 }}>
                      {room.currentCycle.name}
                    </Typography>
                    <Typography data-testid="facility-plant-count" sx={{ color: 'text.secondary' }}>
                      {room.currentCycle.cultivar} · {room.currentCycle.plantCount} plants
                    </Typography>
                    <Typography data-testid="facility-harvest" sx={{ color: 'text.secondary' }}>
                      Harvest {formatCalendarDate(room.currentCycle.expectedHarvestDate)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>No active crop</Typography>
                )}
                <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                  {room.zones.length} {room.zones.length === 1 ? 'zone' : 'zones'}:{' '}
                  {room.zones.map((zone) => zone.name).join(', ')}
                </Typography>
                <Button component={RouterLink} to={`/rooms/${room.id}`} sx={{ mt: 2, px: 0 }} color="primary">
                  Open room dashboard
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
