import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  laborRateInputSchema,
  laborRateViewSchema,
  payrollAnswerSchema,
  payrollAskSchema,
  payrollReportSchema,
  timeClockStatusSchema,
  timePresenceListSchema,
  type LaborRateView,
  type PayrollReport,
  type TimeClockStatus,
  type TimePunchKind,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { displayFont, workbench } from '../theme';

const KIND_LABEL: Record<TimePunchKind, string> = {
  clock_in: 'Clock in',
  lunch_start: 'Start lunch',
  lunch_end: 'End lunch',
  clock_out: 'Clock out',
};

export function TimeClockPage() {
  const { user } = useAuth();
  const { siteId, site } = useSites();
  const queryClient = useQueryClient();
  const [periodStart, setPeriodStart] = useState(() => weekStartToday());
  const [periodEnd, setPeriodEnd] = useState(() => todayKey());
  const [question, setQuestion] = useState('Summarize payroll and overtime for this period');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [rateName, setRateName] = useState(user?.name ?? '');
  const [rateDollars, setRateDollars] = useState('28.00');
  const [limitToSite, setLimitToSite] = useState(false);
  const payrollSiteId = limitToSite ? siteId : null;

  const status = useQuery({
    queryKey: ['timeclock-status', siteId],
    queryFn: () => apiGet(`/timeclock/status${siteId ? `?siteId=${siteId}` : ''}`, timeClockStatusSchema),
  });
  const presence = useQuery({
    queryKey: ['timeclock-presence', siteId],
    queryFn: () => apiGet(`/timeclock/presence${siteId ? `?siteId=${siteId}` : ''}`, timePresenceListSchema),
  });
  const rates = useQuery({
    queryKey: ['timeclock-rates'],
    queryFn: () => apiGet('/timeclock/rates', z.array(laborRateViewSchema)),
    enabled: Boolean(user?.isOrgAdmin),
  });
  const payroll = useQuery({
    queryKey: ['timeclock-payroll', periodStart, periodEnd, payrollSiteId],
    queryFn: () =>
      apiGet(
        `/timeclock/payroll?from=${periodStart}&to=${periodEnd}${payrollSiteId ? `&siteId=${payrollSiteId}` : ''}`,
        payrollReportSchema,
      ),
    enabled: Boolean(user?.isOrgAdmin && periodStart && periodEnd),
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

  const saveRate = useMutation({
    mutationFn: () => {
      const dollars = Number(rateDollars);
      if (!Number.isFinite(dollars) || dollars < 0) {
        throw new Error('Enter a valid hourly rate.');
      }
      return apiSend(
        '/timeclock/rates',
        laborRateViewSchema,
        laborRateInputSchema.parse({ personName: rateName, hourlyCents: Math.round(dollars * 100) }),
        'POST',
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timeclock-rates'] });
      void queryClient.invalidateQueries({ queryKey: ['timeclock-payroll'] });
    },
  });

  const askAi = useMutation({
    mutationFn: () =>
      apiSend(
        '/timeclock/payroll/ask',
        payrollAnswerSchema,
        payrollAskSchema.parse({
          question,
          periodStart,
          periodEnd,
          siteId: payrollSiteId,
        }),
        'POST',
      ),
    onSuccess: (data) => {
      setAiReply(data.reply);
      void queryClient.setQueryData(['timeclock-payroll', periodStart, periodEnd, payrollSiteId], data.report);
    },
  });

  return (
    <Box data-testid="timeclock-page">
      <PageHeader
        kicker={site?.name ?? 'Workforce'}
        title="Time clock"
        lede="Clock in, take lunch, and clock out. Admins get AI payroll from stored punches and labor rates — hours and gross pay, not tax filing or bank deposits."
      />

      {status.isPending ? <Skeleton variant="rounded" height={180} sx={{ mb: 2 }} /> : null}
      {status.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {status.error.message}
        </Alert>
      ) : null}
      {status.data ? <PunchPanel status={status.data} pending={punch.isPending} onPunch={(kind) => punch.mutate(kind)} error={punch.error?.message} /> : null}

      <Typography variant="h2" sx={{ fontSize: 24, mt: 3, mb: 1 }}>
        Who’s in
      </Typography>
      {presence.isPending ? <Skeleton variant="rounded" height={80} /> : null}
      {presence.data && presence.data.people.length === 0 ? (
        <Alert severity="info">Nobody is clocked in right now.</Alert>
      ) : null}
      {presence.data ? (
        <Box sx={{ display: 'grid', gap: 1 }} data-testid="timeclock-presence">
          {presence.data.people.map((person) => (
            <Card key={person.userId}>
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {person.userName}
                  <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {` · ${person.state === 'lunch' ? 'On lunch' : 'On the clock'}`}
                    {person.siteName ? ` · ${person.siteName}` : ''}
                    {` · since ${formatTime(person.since)}`}
                  </Typography>
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}

      {user?.isOrgAdmin ? (
        <Box sx={{ mt: 4 }} data-testid="timeclock-payroll">
          <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>
            AI payroll & accounting
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 1.5, fontSize: 14 }}>
            Uses punches plus labor rates. California-style daily/weekly overtime at 1.5×. Lunch is unpaid.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'data-testid': 'payroll-from' }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'data-testid': 'payroll-to' }}
            />
            <Button variant="outlined" onClick={() => void payroll.refetch()} disabled={payroll.isFetching}>
              Refresh payroll
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={limitToSite}
                  onChange={(_, checked) => setLimitToSite(checked)}
                  inputProps={{ 'aria-label': 'Limit payroll to selected facility' }}
                />
              }
              label={site ? `Only ${site.name}` : 'Only selected facility'}
            />
          </Box>

          <Box
            component="form"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
            onSubmit={(event) => {
              event.preventDefault();
              askAi.mutate();
            }}
          >
            <TextField
              label="Ask AI about payroll"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              sx={{ flex: '1 1 280px' }}
              inputProps={{ 'data-testid': 'payroll-ask' }}
            />
            <Button type="submit" variant="contained" disabled={askAi.isPending} data-testid="payroll-ask-submit">
              Ask AI
            </Button>
          </Box>
          {askAi.error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {askAi.error.message}
            </Alert>
          ) : null}
          {aiReply ? (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="payroll-ai-reply">
              {aiReply}
            </Alert>
          ) : null}
          {payroll.error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {payroll.error.message}
            </Alert>
          ) : null}
          {payroll.isPending ? <Skeleton variant="rounded" height={200} /> : null}
          {payroll.data ? <PayrollPanel report={payroll.data} /> : null}

          <Typography variant="h2" sx={{ fontSize: 22, mt: 3, mb: 1 }}>
            Pay rates
          </Typography>
          <Box
            component="form"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              saveRate.mutate();
            }}
          >
            <TextField
              label="Employee name"
              value={rateName}
              onChange={(event) => setRateName(event.target.value)}
              required
              size="small"
            />
            <TextField
              label="Hourly $"
              value={rateDollars}
              onChange={(event) => setRateDollars(event.target.value)}
              required
              size="small"
              inputProps={{ 'data-testid': 'rate-dollars' }}
            />
            <Button type="submit" variant="outlined" disabled={saveRate.isPending} data-testid="rate-save">
              Save rate
            </Button>
          </Box>
          {saveRate.error ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {saveRate.error.message}
            </Alert>
          ) : null}
          <RatesTable rates={rates.data ?? []} />
        </Box>
      ) : (
        <Alert severity="info" sx={{ mt: 3 }}>
          Payroll and pay rates are available to organization admins. Your punches still count toward that payroll.
        </Alert>
      )}
    </Box>
  );
}

function PunchPanel({
  status,
  pending,
  onPunch,
  error,
}: {
  status: TimeClockStatus;
  pending: boolean;
  onPunch: (kind: TimePunchKind) => void;
  error?: string;
}) {
  const stateLabel = status.state === 'out' ? 'Clocked out' : status.state === 'lunch' ? 'On lunch' : 'On the clock';
  return (
    <Card data-testid="timeclock-punch-panel" sx={{ mb: 2, bgcolor: workbench.mist }}>
      <CardContent>
        <Typography
          data-testid="timeclock-state"
          sx={{ fontFamily: displayFont, fontSize: 28, fontWeight: 700, mb: 0.5 }}
        >
          {stateLabel}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          Today: {formatHours(status.workedMinutesToday)} worked
          {status.lunchMinutesToday > 0 ? ` · ${formatHours(status.lunchMinutesToday)} lunch` : ''}
          {status.openSince ? ` · since ${formatTime(status.openSince)}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(['clock_in', 'lunch_start', 'lunch_end', 'clock_out'] as TimePunchKind[]).map((kind) => {
            const allowed = status.allowed.includes(kind);
            return (
              <Button
                key={kind}
                variant={allowed ? 'contained' : 'outlined'}
                disabled={!allowed || pending}
                onClick={() => onPunch(kind)}
                data-testid={`punch-${kind}`}
                sx={{ minWidth: 140 }}
              >
                {KIND_LABEL[kind]}
              </Button>
            );
          })}
        </Box>
        {error ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        ) : null}
        {status.todayPunches.length > 0 ? (
          <Box sx={{ mt: 2 }} data-testid="timeclock-today-punches">
            {status.todayPunches.map((punch) => (
              <Typography key={punch.id} sx={{ fontSize: 14, color: 'text.secondary' }}>
                {KIND_LABEL[punch.kind]} · {formatTime(punch.punchedAt)}
                {punch.siteName ? ` · ${punch.siteName}` : ''}
              </Typography>
            ))}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PayrollPanel({ report }: { report: PayrollReport }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }} data-testid="payroll-statement">
        {report.statement}
      </Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Stat label="Employees" value={String(report.totals.employees)} />
        <Stat label="Regular hrs" value={formatHours(report.totals.regularMinutes)} />
        <Stat label="OT hrs" value={formatHours(report.totals.overtimeMinutes)} />
        <Stat label="Gross" value={formatMoney(report.totals.grossCents)} />
      </Box>
      <Table size="small" data-testid="payroll-table">
        <TableHead>
          <TableRow>
            <TableCell>Employee</TableCell>
            <TableCell align="right">Worked</TableCell>
            <TableCell align="right">Lunch</TableCell>
            <TableCell align="right">Regular</TableCell>
            <TableCell align="right">OT</TableCell>
            <TableCell align="right">Gross</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {report.employees.map((row) => (
            <TableRow key={row.userId} hover>
              <TableCell>
                {row.userName}
                {row.openShift ? ' · open' : ''}
                {row.hourlyCents == null ? ' · no rate' : ''}
              </TableCell>
              <TableCell align="right">{formatHours(row.workedMinutes)}</TableCell>
              <TableCell align="right">{formatHours(row.lunchMinutes)}</TableCell>
              <TableCell align="right">{formatHours(row.regularMinutes)}</TableCell>
              <TableCell align="right">{formatHours(row.overtimeMinutes)}</TableCell>
              <TableCell align="right">{formatMoney(row.grossCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ mt: 1.5 }}>
        {report.accountingNotes.map((note) => (
          <Typography key={note} sx={{ color: 'text.secondary', fontSize: 13 }}>
            {note}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function RatesTable({ rates }: { rates: LaborRateView[] }) {
  if (rates.length === 0) {
    return <Alert severity="info">No labor rates stored yet.</Alert>;
  }
  return (
    <Table size="small" data-testid="rates-table">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell align="right">Hourly</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rates.map((rate) => (
          <TableRow key={rate.id}>
            <TableCell>{rate.personName}</TableCell>
            <TableCell align="right">{formatMoney(rate.hourlyCents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ bgcolor: workbench.mist }}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: 28 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(2)}h`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function weekStartToday(): string {
  const today = todayKey();
  const date = new Date(`${today}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getTime() + mondayOffset * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
