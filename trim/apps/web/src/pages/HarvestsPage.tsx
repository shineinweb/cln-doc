import { Alert, Box, Card, CardActionArea, CardContent, Skeleton, Typography } from '@mui/material';
import { harvestListSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';

export function HarvestsPage() {
  const harvests = useQuery({
    queryKey: ['harvests'],
    queryFn: () => apiGet('/harvests', harvestListSchema),
  });

  if (harvests.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (harvests.error || !harvests.data) {
    return <Alert severity="error">{harvests.error?.message ?? 'Harvests could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Postharvest"
        title="Harvests"
        lede="A harvest keeps the plant tags, weights, waste, and packages for one license. Veg crops stay in the room until they are cut."
      />
      {harvests.data.length === 0 ? (
        <Alert severity="info">No harvests are recorded for the facilities you can open.</Alert>
      ) : (
        harvests.data.map((harvest) => (
          <Card key={harvest.id} sx={{ mb: 2 }} data-testid="harvest-card">
            <CardActionArea component={RouterLink} to={`/harvests/${harvest.id}`}>
              <CardContent>
                <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="harvest-card-name">
                  {harvest.name}
                </Typography>
                <Typography sx={{ color: 'text.secondary' }}>
                  {harvest.licenseNumber}
                  {harvest.siteName ? ` · ${harvest.siteName}` : ''} · {harvest.plantCount} plants
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))
      )}
    </Box>
  );
}
