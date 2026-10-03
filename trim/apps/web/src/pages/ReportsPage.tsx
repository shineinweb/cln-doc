import { Alert, Box, Skeleton } from '@mui/material';
import { comparisonReportSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { CycleReportView } from '../reports/CycleReportView';

export function ReportsPage() {
  const report = useQuery({
    queryKey: ['reports', 'comparison'],
    queryFn: () => apiGet('/reports/comparison', comparisonReportSchema),
  });

  return (
    <Box>
      <PageHeader
        kicker="Analytics"
        title="Cultivar and room comparison"
        lede="Each figure is computed from stored harvest, labor, and cost rows. The formula under a number is the calculation."
      />
      {report.isPending ? <Skeleton variant="rounded" height={240} /> : null}
      {report.error ? <Alert severity="error">{report.error.message}</Alert> : null}
      {report.data ? (
        <Box data-testid="report-comparison">
          {report.data.cycles.length === 0 ? (
            <Alert severity="info">No crop cycles are stored for the facilities you can open.</Alert>
          ) : (
            report.data.cycles.map((cycle) => <CycleReportView key={cycle.cycleId} report={cycle} />)
          )}
        </Box>
      ) : null}
    </Box>
  );
}
