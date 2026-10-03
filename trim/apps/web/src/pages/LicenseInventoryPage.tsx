import { Alert, Box, Card, CardContent, Skeleton, Typography } from '@mui/material';
import { licenseInventorySchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';

export function LicenseInventoryPage() {
  const { licenseId = '' } = useParams();
  const inventory = useQuery({
    queryKey: ['license', licenseId],
    queryFn: () => apiGet(`/licenses/${licenseId}`, licenseInventorySchema),
    enabled: Boolean(licenseId),
    retry: false,
  });

  if (inventory.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (inventory.error instanceof ApiError && (inventory.error.status === 403 || inventory.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="license-access-warning">
        {inventory.error.status === 403
          ? 'You do not have access to this license.'
          : 'This license is not on a facility you can open.'}
      </Alert>
    );
  }
  if (inventory.error || !inventory.data) {
    return <Alert severity="error">{inventory.error?.message ?? 'This license could not be loaded.'}</Alert>;
  }

  const license = inventory.data;
  return (
    <Box data-testid="license-inventory">
      <PageHeader
        kicker={license.siteNames.join(', ')}
        title={license.licenseNumber}
        lede={`${license.licenseType} license. Plant totals come from tagged plants on this license.`}
      />
      <Typography data-testid="license-plant-count" sx={{ mb: 2, fontSize: 20 }}>
        {license.plantCount} plants
      </Typography>
      <Card>
        <CardContent>
          <Typography sx={{ mb: 1, color: 'text.secondary' }}>
            Showing {license.listedCount} of {license.plantCount} tags.
          </Typography>
          {license.plants.map((plant) => (
            <Typography key={plant.id} data-testid="plant-tag" sx={{ mb: 0.5 }}>
              <RouterLink to={`/plants/${plant.id}`}>{plant.tag}</RouterLink>
              {` · ${plant.strainName} · ${plant.roomName ?? 'No room'} · ${plant.cycleName ?? 'No cycle'}`}
            </Typography>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}
