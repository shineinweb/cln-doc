import { Alert, Box, Card, CardActionArea, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { organizationSummarySchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';

export function CompanyPage() {
  const { sites, loading, error, setSiteId } = useSites();
  const organization = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiGet('/organization', organizationSummarySchema),
    retry: false,
  });

  return (
    <Box>
      <PageHeader
        kicker="Company"
        title={organization.data?.name ?? 'Company'}
        lede="Facilities you can open are listed here. A site stays hidden until you have a membership, unless you are an organization admin."
      />
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {loading || organization.isPending ? (
        <Skeleton variant="rounded" height={140} />
      ) : sites.length === 0 ? (
        <Alert severity="info">No facilities are assigned to this account.</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {sites.map((site) => (
            <Card key={site.id}>
              <CardActionArea onClick={() => setSiteId(site.id)} sx={{ p: 0.5 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="h3" sx={{ fontSize: 28 }}>
                      {site.name}
                    </Typography>
                    <Chip label={site.code} size="small" />
                  </Box>
                  <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                    {[site.city, site.region].filter(Boolean).join(', ') || 'Address not recorded'}
                  </Typography>
                  <Typography sx={{ mt: 2, fontWeight: 600 }}>
                    {site.rooms.length} {site.rooms.length === 1 ? 'room' : 'rooms'}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
