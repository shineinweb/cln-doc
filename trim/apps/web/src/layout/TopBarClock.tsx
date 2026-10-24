import { Alert, Box, Button, Typography } from '@mui/material';
import { timeClockStatusSchema, type TimeClockStatus, type TimePunchKind } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { workbench } from '../theme';

const ACTION_LABEL: Record<TimePunchKind, string> = {
  clock_in: 'Clock in',
  lunch_start: 'Lunch',
  lunch_end: 'End lunch',
  clock_out: 'Clock out',
};

const STATE_LABEL: Record<TimeClockStatus['state'], string> = {
  out: 'Out',
  in: 'In',
  lunch: 'Lunch',
};

export function TopBarClock({ siteId }: { siteId: string | null }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['timeclock-status', siteId],
    queryFn: () => apiGet(`/timeclock/status${siteId ? `?siteId=${siteId}` : ''}`, timeClockStatusSchema),
  });

  const punch = useMutation({
    mutationFn: (kind: TimePunchKind) =>
      apiSend('/timeclock/punch', timeClockStatusSchema, { kind, siteId: siteId ?? null }, 'POST'),
    onSuccess: (next) => {
      queryClient.setQueryData(['timeclock-status', siteId], next);
      void queryClient.invalidateQueries({ queryKey: ['timeclock-presence'] });
      void queryClient.invalidateQueries({ queryKey: ['timeclock-payroll'] });
    },
  });

  const data = status.data;
  const stateColor =
    data?.state === 'in' ? workbench.greenhouse : data?.state === 'lunch' ? workbench.gold : workbench.sky;

  return (
    <Box
      data-testid="topbar-clock"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <Button
        component={RouterLink}
        to="/timeclock"
        size="small"
        color="inherit"
        sx={{
          minWidth: 0,
          px: { xs: 0.75, sm: 1 },
          color: stateColor,
          fontWeight: 700,
          textTransform: 'none',
        }}
        title="Open Time clock"
      >
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: stateColor,
            mr: 0.75,
            display: 'inline-block',
          }}
        />
        <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, display: { xs: 'none', sm: 'inline' } }}>
          {data ? STATE_LABEL[data.state] : '…'}
        </Typography>
      </Button>
      {data
        ? data.allowed.map((kind) => (
            <Button
              key={kind}
              size="small"
              variant={kind === 'clock_in' || kind === 'clock_out' ? 'contained' : 'outlined'}
              color={kind === 'clock_out' ? 'secondary' : 'primary'}
              disabled={punch.isPending}
              onClick={() => punch.mutate(kind)}
              data-testid={`topbar-punch-${kind}`}
              sx={{
                minWidth: 0,
                px: { xs: 1, sm: 1.25 },
                whiteSpace: 'nowrap',
                fontSize: { xs: 12, sm: 13 },
              }}
            >
              {ACTION_LABEL[kind]}
            </Button>
          ))
        : null}
      {punch.error ? (
        <Alert
          severity="error"
          sx={{
            py: 0,
            px: 1,
            position: { xs: 'absolute', sm: 'static' },
            top: { xs: 64, sm: 'auto' },
            left: { xs: 8, sm: 'auto' },
            right: { xs: 8, sm: 'auto' },
            zIndex: 2,
            display: { xs: 'none', md: 'flex' },
          }}
        >
          {punch.error.message}
        </Alert>
      ) : null}
    </Box>
  );
}
