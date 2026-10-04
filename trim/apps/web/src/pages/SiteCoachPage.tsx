import { Alert, Box, Card, CardContent, Skeleton, Typography } from '@mui/material';
import { siteCoachSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { AiHelperPanel } from './AiHelperPanel';

export function SiteCoachPage() {
  const { siteId, site } = useSites();
  const coach = useQuery({
    queryKey: ['coach', siteId],
    queryFn: () => apiGet(`/sites/${siteId}/coach`, siteCoachSchema),
    enabled: Boolean(siteId),
  });

  return (
    <Box data-testid="site-coach">
      <PageHeader
        kicker={site ? site.name : 'Facility'}
        title="Serenity"
        lede="Serenity is the cultivation AI. Chat to generate tasks, train workers, quote stored procedures, or teach her with “Remember that…”. A room alert opens one task for the people who can open this facility. Yield and cost figures stay on Reports. The readiness list is not a state certification."
      />
      {!siteId ? <Alert severity="info">Choose a facility to open Serenity.</Alert> : null}
      {coach.isPending && siteId ? <Skeleton variant="rounded" height={240} /> : null}
      {coach.error ? <Alert severity="error">{coach.error.message}</Alert> : null}
      {coach.data ? (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <AiHelperPanel siteId={coach.data.siteId} helper={coach.data.helper} />
          <Box>
            <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
              Room notices
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
              Active alerts for this facility. The same notices appear on Workspace.
            </Typography>
            {coach.data.notices.length === 0 ? (
              <Alert severity="info">No active room alert is stored.</Alert>
            ) : (
              coach.data.notices.map((notice) => (
                <Card key={notice.alertId} sx={{ mb: 1.5 }} data-testid="coach-notice">
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>
                      <RouterLink to={`/rooms/${notice.roomId}`}>{notice.roomName}</RouterLink>
                      {` · ${notice.taskTitle}`}
                    </Typography>
                    <Typography sx={{ mt: 0.5 }}>{notice.message}</Typography>
                    {notice.sopTitle ? (
                      <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                        {notice.sopTitle}
                        {notice.sopSummary ? ` — ${notice.sopSummary}` : ''}
                      </Typography>
                    ) : (
                      <Typography sx={{ mt: 1, color: 'text.secondary' }}>No stored procedure title matches this metric.</Typography>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
          <Box data-testid="coach-readiness">
            <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
              Readiness
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              {coach.data.statement}
            </Alert>
            {coach.data.licenses.length === 0 ? (
              <Alert severity="info">This facility has no license stored.</Alert>
            ) : (
              coach.data.licenses.map((license) => (
                <Card key={license.licenseId} sx={{ mb: 1.5 }} data-testid="coach-license">
                  <CardContent>
                    <Typography variant="h3" sx={{ fontSize: 22 }} data-testid="coach-jurisdiction">
                      {`Readiness for ${license.jurisdiction}`}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', mb: 1 }}>{license.licenseNumber}</Typography>
                    {license.gaps.map((item) => (
                      <Typography key={item.kind} data-testid={`coach-gap-${item.kind}`}>
                        {item.detail}
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
