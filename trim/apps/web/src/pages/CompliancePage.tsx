import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { complianceOverviewSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';

function discrepancyLabel(kind: 'extra_tag' | 'missing_tag'): string {
  return kind === 'extra_tag' ? 'In the file, not in Trim' : 'In Trim, not in the file';
}

export function CompliancePage() {
  const overview = useQuery({
    queryKey: ['compliance'],
    queryFn: () => apiGet('/compliance', complianceOverviewSchema),
  });

  if (overview.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (overview.error || !overview.data) {
    return <Alert severity="error">{overview.error?.message ?? 'Compliance could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Licenses"
        title="Compliance"
        lede="Each license is compared with a saved inventory file. Trim does not call Metrc from this screen."
      />
      {overview.data.licenses.length === 0 ? (
        <Alert severity="info">No licenses are available for the facilities you can open.</Alert>
      ) : (
        overview.data.licenses.map((license) => (
          <Card key={license.id} sx={{ mb: 2 }} data-testid="compliance-license">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="compliance-license-number">
                    {license.licenseNumber}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    {license.siteNames.join(', ')} · {license.plantCount} plants
                  </Typography>
                </Box>
                <Button component={RouterLink} to={`/licenses/${license.id}`} variant="outlined">
                  Open inventory
                </Button>
              </Box>
              {license.latestImport ? (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    size="small"
                    label={`${license.latestImport.matchedCount} matched · ${license.latestImport.discrepancyCount} ${license.latestImport.discrepancyCount === 1 ? 'discrepancy' : 'discrepancies'}`}
                  />
                  <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                    File compared {formatTimestamp(license.latestImport.importedAt)}. Status {license.latestImport.status}.
                  </Typography>
                  {license.latestImport.discrepancies.length === 0 ? (
                    <Typography data-testid="compliance-clean" sx={{ mt: 1 }}>
                      No discrepancies.
                    </Typography>
                  ) : (
                    license.latestImport.discrepancies.map((item) => (
                      <Typography key={item.id} data-testid="compliance-discrepancy" sx={{ mt: 1 }}>
                        {item.tag} · {discrepancyLabel(item.kind)}
                      </Typography>
                    ))
                  )}
                </Box>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No inventory file has been compared for this license.
                </Alert>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}
