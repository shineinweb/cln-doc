import { Alert, Box, Button, Card, CardContent, Skeleton, TextField, Typography } from '@mui/material';
import { coachAnswerSchema, siteCoachSchema, type CoachAnswer } from '@trim/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { CycleReportView } from '../reports/CycleReportView';

export function SiteCoachPage() {
  const { siteId, site } = useSites();
  const coach = useQuery({
    queryKey: ['coach', siteId],
    queryFn: () => apiGet(`/sites/${siteId}/coach`, siteCoachSchema),
    enabled: Boolean(siteId),
  });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const ask = useMutation({
    mutationFn: () => apiSend(`/sites/${siteId}/coach/ask`, coachAnswerSchema, { question }),
    onSuccess: (result) => setAnswer(result),
  });

  return (
    <Box data-testid="site-coach">
      <PageHeader
        kicker={site ? site.name : 'Facility'}
        title="Site coach"
        lede="Figures come from stored harvest, labor, and cost rows. Procedures are quoted from the facility’s stored SOPs. A room alert opens one task for the people who can open this facility. The readiness list is not a state certification."
      />
      {!siteId ? <Alert severity="info">Choose a facility to open the coach.</Alert> : null}
      {coach.isPending && siteId ? <Skeleton variant="rounded" height={240} /> : null}
      {coach.error ? <Alert severity="error">{coach.error.message}</Alert> : null}
      {coach.data ? (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
              Statistics
            </Typography>
            {coach.data.cycles.length === 0 ? (
              <Alert severity="info">No crop cycles are stored for this facility, so yield, duration, labor, and cost are absent.</Alert>
            ) : (
              coach.data.cycles.map((cycle) => <CycleReportView key={cycle.cycleId} report={cycle} />)
            )}
          </Box>
          <Box>
            <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
              Room notices
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
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5, maxWidth: 640 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (question.trim()) {
                ask.mutate();
              }
            }}
          >
            <Typography variant="h2" sx={{ fontSize: 28 }}>
              Procedure
            </Typography>
            <TextField
              label="Ask about a stored procedure"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              inputProps={{ 'data-testid': 'coach-question' }}
            />
            <Button type="submit" variant="contained" disabled={ask.isPending || question.trim().length === 0} data-testid="coach-ask" sx={{ justifySelf: 'start' }}>
              Ask
            </Button>
            {ask.error ? <Alert severity="error">{ask.error.message}</Alert> : null}
            {answer ? (
              <Alert severity={answer.matched ? 'success' : 'info'} data-testid="coach-answer">
                {answer.matched && answer.title ? `${answer.title}. ${answer.summary}` : answer.message}
              </Alert>
            ) : null}
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
