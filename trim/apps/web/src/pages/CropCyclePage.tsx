import { Alert, Box, Button, Chip, Skeleton, Typography } from '@mui/material';
import { cropCycleDetailSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { cycleDayLabel, formatCalendarDate } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { useSites } from '../layout/SiteProvider';
import { roomTypeLabel } from '../theme';

export function CropCyclePage() {
  const { roomId = '', cycleId = '' } = useParams();
  const { setSiteId } = useSites();
  const cycle = useQuery({
    queryKey: ['cycle', cycleId],
    queryFn: () => apiGet(`/cycles/${cycleId}`, cropCycleDetailSchema),
    enabled: Boolean(cycleId),
    retry: false,
  });

  const setSiteIdRef = useRef(setSiteId);
  setSiteIdRef.current = setSiteId;
  useEffect(() => {
    if (cycle.data) {
      setSiteIdRef.current(cycle.data.siteId, { navigate: false });
    }
  }, [cycle.data]);

  if (cycle.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }

  if (cycle.error instanceof ApiError && (cycle.error.status === 403 || cycle.error.status === 404)) {
    return (
      <Alert severity="warning">
        {cycle.error.status === 403
          ? 'You do not have access to this crop cycle.'
          : 'This crop cycle is not on a facility you can open.'}
      </Alert>
    );
  }

  if (cycle.error || !cycle.data) {
    return <Alert severity="error">{cycle.error?.message ?? 'This crop cycle could not be loaded.'}</Alert>;
  }

  if (cycle.data.roomId !== roomId) {
    return <Alert severity="warning">This crop cycle is not in that room.</Alert>;
  }

  return (
    <Box>
      <Button component={RouterLink} to={`/rooms/${cycle.data.roomId}`} sx={{ px: 0, mb: 1 }}>
        Back to {cycle.data.roomName}
      </Button>
      <PageHeader
        kicker={`${cycle.data.siteName} · ${cycle.data.roomName}`}
        title={cycle.data.name}
        lede={`${cycle.data.cultivar} · ${cycle.data.plantCount} plants · ${roomTypeLabel(cycle.data.stage)} · ${cycleDayLabel(cycle.data.cycleDay)} · harvest ${formatCalendarDate(cycle.data.expectedHarvestDate)}`}
      />
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={cycle.data.status} />
        <Chip label={cycleDayLabel(cycle.data.cycleDay)} data-testid="cycle-page-day" />
      </Box>
      <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
        Operating history
      </Typography>
      <OperatingHistoryView history={cycle.data.operatingHistory} />
    </Box>
  );
}
