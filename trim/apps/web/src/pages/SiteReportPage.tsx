import { Alert, Box, Skeleton } from '@mui/material';
import { siteReportSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { CycleReportView } from '../reports/CycleReportView';

export function SiteReportPage() {
  const { siteId = '' } = useParams();
  const { setSiteId } = useSites();
  const report = useQuery({
    queryKey: ['reports', 'site', siteId],
    queryFn: () => apiGet(`/reports/sites/${siteId}`, siteReportSchema),
    enabled: Boolean(siteId),
    retry: false,
  });
  const setSiteIdRef = useRef(setSiteId);
  setSiteIdRef.current = setSiteId;
  useEffect(() => {
    if (report.data) {
      setSiteIdRef.current(report.data.siteId, { navigate: false });
    }
  }, [report.data]);

  if (report.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (report.error instanceof ApiError && (report.error.status === 403 || report.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="report-access-warning">
        {report.error.status === 403
          ? 'You do not have access to this report.'
          : 'This report is not on a facility you can open.'}
      </Alert>
    );
  }
  if (report.error || !report.data) {
    return <Alert severity="error">{report.error?.message ?? 'This report could not be loaded.'}</Alert>;
  }

  return (
    <Box data-testid="site-report">
      <PageHeader
        kicker={report.data.siteName}
        title="Facility report"
        lede="Yield, duration, labor, and cost for the crop cycles stored at this facility. Each formula cites those rows."
      />
      {report.data.cycles.length === 0 ? (
        <Alert severity="info">This facility has no stored crop cycles.</Alert>
      ) : (
        report.data.cycles.map((cycle) => <CycleReportView key={cycle.cycleId} report={cycle} />)
      )}
    </Box>
  );
}
