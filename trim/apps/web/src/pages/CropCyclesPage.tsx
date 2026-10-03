import { Alert, Box, Card, CardActionArea, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { cycleDayLabel, formatCalendarDate } from '../crops/format';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel } from '../theme';

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
      {site && cycles.length === 0 ? <Alert severity="info">No active crop cycles are recorded here.</Alert> : null}
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {cycles.map((room) => {
          const cycle = room.currentCycle;
          if (!cycle) {
            return null;
          }
          return (
            <Card key={cycle.id}>
              <CardActionArea component={RouterLink} to={`/rooms/${room.id}/cycles/${cycle.id}`}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontSize: 24 }}>
                      {cycle.name}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {room.name} · {cycle.cultivar} · {cycle.plantCount} plants · harvest{' '}
                      {formatCalendarDate(cycle.expectedHarvestDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={roomTypeLabel(cycle.stage)} />
                    <Chip label={cycleDayLabel(cycle.cycleDay)} />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
