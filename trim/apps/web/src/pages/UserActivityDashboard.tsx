import { Alert, Box, Card, CardContent, Typography } from '@mui/material';
import type { AccessDirectory, AuditLogView } from '@trim/contracts';
import { displayFont, workbench } from '../theme';

const DAY_COUNT = 14;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;

type DayBucket = {
  key: string;
  label: string;
  signIns: number;
  changes: number;
};

export function UserActivityDashboard({ directory }: { directory: AccessDirectory }) {
  const series = activitySeries(directory.audit, DAY_COUNT);
  const stats = activityStats(directory, series);
  const actors = actorCounts(directory.audit).slice(0, 5);

  return (
    <Box data-testid="user-activity-dashboard" sx={{ mb: 3 }}>
      <Typography variant="h2" sx={{ fontSize: 26, mb: 0.5 }}>
        Activity
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
        Sign-ins and access changes from the audit log for the last {DAY_COUNT} days.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Stat label="People" value={String(stats.people)} />
        <Stat label="Sign-ins" value={String(stats.signIns)} />
        <Stat label="Changes" value={String(stats.changes)} />
        <Stat label="Active people" value={String(stats.activePeople)} />
      </Box>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pt: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1, alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>Daily activity</Typography>
            <LegendSwatch color={workbench.sky} label="Sign-ins" />
            <LegendSwatch color={workbench.leaf} label="Changes" />
          </Box>
          <ActivityChart series={series} />
          {stats.totalEvents === 0 ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              No sign-ins or access changes are recorded yet.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      {actors.length > 0 ? (
        <Card>
          <CardContent sx={{ pt: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Most active people</Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {actors.map((actor) => (
                <ActorBar key={actor.name} name={actor.name} count={actor.count} max={actors[0]?.count ?? 1} />
              ))}
            </Box>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ bgcolor: workbench.mist }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: 32, lineHeight: 1.1 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function ActivityChart({ series }: { series: DayBucket[] }) {
  const max = Math.max(1, ...series.map((day) => day.signIns + day.changes));
  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const groupWidth = plotWidth / series.length;
  const barWidth = Math.max(6, groupWidth * 0.55);

  return (
    <Box
      component="svg"
      data-testid="user-activity-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="User activity for the last 14 days"
      sx={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <line
        x1={PAD_LEFT}
        y1={CHART_HEIGHT - PAD_BOTTOM}
        x2={CHART_WIDTH - PAD_RIGHT}
        y2={CHART_HEIGHT - PAD_BOTTOM}
        stroke={workbench.line}
      />
      {[0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = CHART_HEIGHT - PAD_BOTTOM - plotHeight * fraction;
        return (
          <line
            key={fraction}
            x1={PAD_LEFT}
            y1={y}
            x2={CHART_WIDTH - PAD_RIGHT}
            y2={y}
            stroke={workbench.line}
            strokeOpacity={0.45}
          />
        );
      })}
      <text x={8} y={PAD_TOP + 4} fill="#C4B6E4" fontSize="11">
        {max}
      </text>
      {series.map((day, index) => {
        const x = PAD_LEFT + index * groupWidth + (groupWidth - barWidth) / 2;
        const changeHeight = (day.changes / max) * plotHeight;
        const signInHeight = (day.signIns / max) * plotHeight;
        const baseY = CHART_HEIGHT - PAD_BOTTOM;
        const changeY = baseY - changeHeight;
        const signInY = changeY - signInHeight;
        const showLabel = index % 2 === 0 || index === series.length - 1;
        return (
          <g key={day.key}>
            {day.changes > 0 ? (
              <rect x={x} y={changeY} width={barWidth} height={changeHeight} rx={3} fill={workbench.leaf} />
            ) : null}
            {day.signIns > 0 ? (
              <rect x={x} y={signInY} width={barWidth} height={signInHeight} rx={3} fill={workbench.sky} />
            ) : null}
            {day.signIns === 0 && day.changes === 0 ? (
              <rect
                x={x}
                y={baseY - 3}
                width={barWidth}
                height={3}
                rx={1.5}
                fill={workbench.line}
                opacity={0.7}
              />
            ) : null}
            {showLabel ? (
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 12}
                textAnchor="middle"
                fill="#C4B6E4"
                fontSize="11"
              >
                {day.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </Box>
  );
}

function ActorBar({ name, count, max }: { name: string; count: number; max: number }) {
  const width = Math.max(8, Math.round((count / Math.max(max, 1)) * 100));
  return (
    <Box data-testid="user-activity-actor" sx={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', gap: 1, alignItems: 'center' }}>
      <Typography sx={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
      <Box sx={{ height: 10, borderRadius: 999, bgcolor: workbench.mist, overflow: 'hidden' }}>
        <Box sx={{ width: `${width}%`, height: '100%', bgcolor: workbench.violet }} />
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'right' }}>{count}</Typography>
    </Box>
  );
}

function activityStats(directory: AccessDirectory, series: DayBucket[]) {
  const signIns = series.reduce((sum, day) => sum + day.signIns, 0);
  const changes = series.reduce((sum, day) => sum + day.changes, 0);
  const windowKeys = new Set(series.map((day) => day.key));
  const activePeople = new Set(
    directory.audit
      .filter((entry) => windowKeys.has(dayKey(new Date(entry.at))))
      .map((entry) => entry.actorName),
  ).size;
  return {
    people: directory.users.length,
    signIns,
    changes,
    activePeople,
    totalEvents: signIns + changes,
  };
}

function activitySeries(audit: AuditLogView[], days: number): DayBucket[] {
  const keys = recentDayKeys(days);
  const buckets = new Map<string, DayBucket>(
    keys.map((key) => [
      key,
      {
        key,
        label: labelForDayKey(key),
        signIns: 0,
        changes: 0,
      },
    ]),
  );
  for (const entry of audit) {
    const key = dayKey(new Date(entry.at));
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }
    if (entry.action === 'Signed in') {
      bucket.signIns += 1;
    } else {
      bucket.changes += 1;
    }
  }
  return [...buckets.values()];
}

function actorCounts(audit: AuditLogView[]): Array<{ name: string; count: number }> {
  const windowKeys = new Set(recentDayKeys(DAY_COUNT));
  const counts = new Map<string, number>();
  for (const entry of audit) {
    if (!windowKeys.has(dayKey(new Date(entry.at)))) {
      continue;
    }
    counts.set(entry.actorName, (counts.get(entry.actorName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function recentDayKeys(days: number): string[] {
  const todayKey = dayKey(new Date());
  const [year, month, day] = todayKey.split('-').map(Number);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1, day - offset, 12));
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

function labelForDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
