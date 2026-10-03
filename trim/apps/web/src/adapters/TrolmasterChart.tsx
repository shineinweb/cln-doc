import { Alert, Box, FormControlLabel, Switch, Typography } from '@mui/material';
import { trolmasterChartSchema, trolmasterModeSchema, type TrolmasterChart, type TrolmasterMode } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiGet, apiSend } from '../api/client';

const METRIC_COLOR: Record<string, string> = {
  temp: '#e15b78',
  humid: '#5b9dff',
  co2: '#e6d36a',
  vpd: '#3dceb4',
  light: '#e0a84a',
  ec: '#e6b84a',
  vwc: '#7eb6f0',
};
const WIDTH = 960;
const HEIGHT = 420;
const PAD_X = 36;
const PAD_BOTTOM = 52;
const PAD_TOP = 18;
type ChartRange = 'day' | 'week' | 'month';

export function TrolmasterSwitches({ roomId }: { roomId: string }) {
  const mode = useTrolmasterMode(roomId);
  if (!mode.current) {
    return null;
  }
  return (
    <Box data-testid="trolmaster-switches" sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <ModeSwitch
        testId="trolmaster-enabled"
        label={mode.current.enabled ? 'Trolmaster on' : 'Trolmaster off'}
        checked={mode.current.enabled}
        disabled={mode.pending}
        onChange={(checked) => mode.save({ enabled: checked, testMode: checked ? mode.current?.testMode ?? false : false })}
      />
      <ModeSwitch
        testId="trolmaster-test"
        label={mode.current.testMode ? 'Test on' : 'Test off'}
        checked={mode.current.testMode}
        disabled={mode.pending}
        onChange={(checked) => mode.save({ enabled: checked ? true : (mode.current?.enabled ?? true), testMode: checked })}
      />
    </Box>
  );
}

export function TrolmasterChart({ roomId, timeZone }: { roomId: string; timeZone: string }) {
  const [range, setRange] = useState<ChartRange>('day');
  const [hidden, setHidden] = useState<string[]>([]);
  const chart = useQuery({
    queryKey: ['trolmaster-chart', roomId, range],
    queryFn: () => apiGet(`/rooms/${roomId}/trolmaster/chart?range=${range}`, trolmasterChartSchema),
  });
  const [hoverAt, setHoverAt] = useState<string | null>(null);
  const sample = useMemo(() => sampleChart(range), [range]);

  if (chart.isPending) {
    return <Alert severity="info">Reading Trolmaster…</Alert>;
  }

  const live = chart.data ?? emptyChart(chart.error?.message ?? 'Trolmaster did not return a chart.');
  const showingSample = live.enabled && live.testMode;
  const data = showingSample ? sample : live;
  const visible = data.series.filter((series) => !hidden.includes(series.metric));
  const plotData = { ...data, series: visible };
  const domain = timeDomain(plotData);
  const plot = live.enabled && visible.length > 0;

  return (
    <Box data-testid="trolmaster-chart-card" sx={{ bgcolor: '#141416', color: '#f2f2f2', borderRadius: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <TrolmasterSwitches roomId={roomId} />
        <Box sx={{ display: 'flex', bgcolor: '#2a2a2e', borderRadius: 999, p: 0.25 }}>
          {(['day', 'week', 'month'] as const).map((item) => (
            <Box
              key={item}
              component="button"
              type="button"
              data-testid={`trolmaster-range-${item}`}
              onClick={() => setRange(item)}
              sx={{
                border: 0,
                cursor: 'pointer',
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                color: range === item ? '#111' : '#f2f2f2',
                bgcolor: range === item ? '#f2f2f2' : 'transparent',
              }}
            >
              {item === 'day' ? '24 Hour' : item === 'week' ? 'Week' : 'Month'}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 22 }} data-testid="trolmaster-controller">
          {live.enabled ? (data.controllerId ?? 'Trolmaster') : 'Trolmaster'}
        </Typography>
        {plot ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box data-testid="trolmaster-chart-day" sx={{ bgcolor: '#2a2a2e', borderRadius: 999, px: 1.5, py: 0.5 }}>
              {formatDay(new Date(hoverAt ?? new Date(domain.max).toISOString()).getTime(), timeZone)}
            </Box>
            <Box data-testid="trolmaster-chart-time" sx={{ bgcolor: '#2a2a2e', borderRadius: 999, px: 1.5, py: 0.5 }}>
              {formatClock(new Date(hoverAt ?? new Date(domain.max).toISOString()).getTime(), timeZone)}
            </Box>
          </Box>
        ) : null}
      </Box>
      {showingSample ? (
        <Typography data-testid="trolmaster-sample-note" sx={{ color: '#e6d36a', fontSize: 14, mb: 1 }}>
          Sample readings. Trim is not calling Trolmaster.
        </Typography>
      ) : null}
      {plot ? (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            {data.series.map((series) => {
              const color = colorFor(series.metric);
              const off = hidden.includes(series.metric);
              return (
                <Box
                  key={series.id}
                  component="button"
                  type="button"
                  data-testid={`trolmaster-series-${series.metric}`}
                  onClick={() => setHidden((current) => (current.includes(series.metric) ? current.filter((item) => item !== series.metric) : [...current, series.metric]))}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    border: '1px solid',
                    borderColor: off ? '#3a3a3e' : color,
                    color: off ? '#8a8a8e' : '#f2f2f2',
                    bgcolor: 'transparent',
                    borderRadius: 999,
                    px: 1.25,
                    py: 0.4,
                    cursor: 'pointer',
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, opacity: off ? 0.35 : 1 }} />
                  {seriesLabel(series.metric, series.name)}
                </Box>
              );
            })}
          </Box>
          <ChartPlot data={plotData} domain={domain} timeZone={timeZone} hoverAt={hoverAt} onHover={setHoverAt} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 2 }}>
            {visible.map((series) => {
              const values = series.points.map((point) => point.value);
              const max = Math.max(...values);
              const min = Math.min(...values);
              return (
                <Box key={series.id} data-testid={`trolmaster-legend-${series.metric}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, border: '1px solid #3a3a3e', borderRadius: 999, px: 1, py: 0.4 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorFor(series.metric) }} />
                    {seriesLabel(series.metric, series.name)}
                  </Box>
                  <Typography sx={{ fontSize: 14, color: '#c8c8cc' }}>
                    Max {formatReading(max)} {series.unit}
                    <br />
                    Min {formatReading(min)} {series.unit}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </>
      ) : (
        <Alert severity={chart.error && !chart.data ? 'error' : 'info'} data-testid="trolmaster-chart-empty">
          {live.enabled && data.series.length > 0 && visible.length === 0 ? 'Turn a parameter back on to see the chart.' : (live.message ?? 'Trolmaster returned no chart points.')}
        </Alert>
      )}
    </Box>
  );
}

function useTrolmasterMode(roomId: string) {
  const queryClient = useQueryClient();
  const chart = useQuery({
    queryKey: ['trolmaster-chart', roomId],
    queryFn: () => apiGet(`/rooms/${roomId}/trolmaster/chart`, trolmasterChartSchema),
  });
  const save = useMutation({
    mutationFn: (mode: TrolmasterMode) => apiSend(`/rooms/${roomId}/trolmaster`, trolmasterModeSchema, mode, 'PATCH'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trolmaster-chart', roomId] });
    },
  });
  return {
    current: chart.data ? { enabled: chart.data.enabled, testMode: chart.data.testMode } : null,
    pending: save.isPending,
    save: (mode: TrolmasterMode) => save.mutate(mode),
  };
}

function ModeSwitch({
  testId,
  label,
  checked,
  disabled,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      data-testid={testId}
      sx={{ color: 'inherit', m: 0 }}
      label={label}
      control={<Switch checked={checked} disabled={disabled} onChange={(_event, next) => onChange(next)} />}
    />
  );
}

function ChartPlot({
  data,
  domain,
  timeZone,
  hoverAt,
  onHover,
}: {
  data: TrolmasterChart;
  domain: { min: number; max: number };
  timeZone: string;
  hoverAt: string | null;
  onHover: (at: string | null) => void;
}) {
  const scales = metricScales(data);
  const hoverX = hoverAt ? xFor(new Date(hoverAt).getTime(), domain) : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => domain.min + fraction * (domain.max - domain.min));
  const bottom = HEIGHT - PAD_BOTTOM;

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="svg"
        data-testid="trolmaster-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Trolmaster chart"
        sx={{ width: '100%', height: 'auto', display: 'block', bgcolor: '#101012', borderRadius: 1 }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const viewX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          onHover(timeAt(viewX, domain));
        }}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          {data.series.map((series) => (
            <linearGradient key={series.id} id={`fill-${series.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorFor(series.metric)} stopOpacity="0.45" />
              <stop offset="100%" stopColor={colorFor(series.metric)} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        <line x1={PAD_X} y1={PAD_TOP} x2={WIDTH - PAD_X} y2={PAD_TOP} stroke="rgba(255,255,255,0.28)" strokeDasharray="4 6" />
        <line x1={PAD_X} y1={bottom} x2={WIDTH - PAD_X} y2={bottom} stroke="rgba(255,255,255,0.28)" strokeDasharray="4 6" />
        {ticks.map((tick) => (
          <line key={tick} x1={xFor(tick, domain)} y1={PAD_TOP} x2={xFor(tick, domain)} y2={bottom} stroke="rgba(255,255,255,0.12)" />
        ))}
        {data.series.map((series) => {
          const scale = scales.get(series.metric);
          if (!scale) {
            return null;
          }
          const coords = series.points.map((point) => ({
            x: xFor(new Date(point.at).getTime(), domain),
            y: yFor(point.value, scale),
            value: point.value,
          }));
          if (coords.length === 0) {
            return null;
          }
          const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
          const area = `${coords[0].x},${bottom} ${line} ${coords[coords.length - 1].x},${bottom}`;
          const hoverPoint = hoverAt ? nearestCoord(coords, xFor(new Date(hoverAt).getTime(), domain)) : null;
          return (
            <g key={series.id}>
              <polygon points={area} fill={`url(#fill-${series.id})`} />
              <polyline fill="none" stroke={colorFor(series.metric)} strokeWidth="1.7" points={line} />
              {hoverPoint ? (
                <text x={hoverPoint.x + 6} y={Math.max(PAD_TOP + 12, hoverPoint.y - 6)} fill={colorFor(series.metric)} fontSize="13">
                  {formatReading(hoverPoint.value)} {series.unit}
                </text>
              ) : null}
            </g>
          );
        })}
        {hoverX != null ? <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={bottom} stroke="rgba(255,255,255,0.55)" /> : null}
        {ticks.map((tick) => (
          <g key={`label-${tick}`}>
            <text x={xFor(tick, domain)} y={HEIGHT - 28} fill="#bdbdc2" fontSize="12" textAnchor="middle">
              {formatClock(tick, timeZone)}
            </text>
            <text x={xFor(tick, domain)} y={HEIGHT - 12} fill="#8d8d93" fontSize="12" textAnchor="middle">
              {formatDay(tick, timeZone)}
            </text>
          </g>
        ))}
      </Box>
    </Box>
  );
}

function emptyChart(message: string): TrolmasterChart {
  return { controllerId: null, connected: false, enabled: true, testMode: false, message, latest: [], series: [] };
}

function sampleChart(range: ChartRange, now = Date.now()): TrolmasterChart {
  const hours = range === 'month' ? 24 * 30 : range === 'week' ? 24 * 7 : 24;
  const start = now - hours * 60 * 60 * 1000;
  const step = range === 'day' ? 15 * 60 * 1000 : range === 'week' ? 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
  const count = Math.max(2, Math.round((now - start) / step));
  const raw = Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const drop = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.1);
    const ripple = Math.sin(t * Math.PI * (range === 'day' ? 14 : 8));
    return {
      at: new Date(start + index * step).toISOString(),
      temp: 76 + ripple * 1.5 - drop * 18,
      humid: 30 + ripple + drop * 28,
      vpd: 2.2 - ripple * 0.08 - drop * 1.4,
      co2: 0,
      light: 0,
    };
  });
  const temp = scalePoints(raw, 'temp', 56.9, 80.1, 1);
  const humid = scalePoints(raw, 'humid', 24.5, 61.2, 1);
  const vpd = scalePoints(raw, 'vpd', 0.66, 2.56, 2);
  const flat = (metric: 'co2' | 'light') => raw.map((row) => ({ at: row.at, value: row[metric] }));
  return {
    controllerId: 'Sample',
    connected: false,
    enabled: true,
    testMode: true,
    message: 'Sample readings. Trim is not calling Trolmaster.',
    latest: [
      { metric: 'temp', label: 'Temp', value: 80.1, unit: '°F' },
      { metric: 'humid', label: 'Humid', value: 61.2, unit: '%' },
      { metric: 'co2', label: 'CO2', value: 0, unit: 'PPM' },
      { metric: 'vpd', label: 'VPD', value: 2.56, unit: 'kPa' },
      { metric: 'light', label: 'Light', value: 0, unit: 'PPFD' },
    ],
    series: [
      { id: 'sample-temp', name: 'Temp', metric: 'temp', unit: '°F', points: temp },
      { id: 'sample-humid', name: 'Humid', metric: 'humid', unit: '%', points: humid },
      { id: 'sample-co2', name: 'CO2', metric: 'co2', unit: 'PPM', points: flat('co2') },
      { id: 'sample-vpd', name: 'VPD', metric: 'vpd', unit: 'kPa', points: vpd },
      { id: 'sample-light', name: 'Light', metric: 'light', unit: 'PPFD', points: flat('light') },
    ],
  };
}

function scalePoints(
  rows: Array<{ at: string; temp: number; humid: number; vpd: number }>,
  key: 'temp' | 'humid' | 'vpd',
  targetMin: number,
  targetMax: number,
  digits: number,
) {
  const values = rows.map((row) => row[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max === min ? 1 : max - min;
  const factor = 10 ** digits;
  return rows.map((row) => ({
    at: row.at,
    value: Math.round((targetMin + ((row[key] - min) / span) * (targetMax - targetMin)) * factor) / factor,
  }));
}

function timeDomain(data: TrolmasterChart): { min: number; max: number } {
  const times = data.series.flatMap((series) => series.points.map((point) => new Date(point.at).getTime()));
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (!Number.isFinite(min) || min === max) {
    return { min: min || 0, max: (min || 0) + 1 };
  }
  return { min, max };
}

function metricScales(data: TrolmasterChart): Map<string, { min: number; max: number }> {
  const grouped = new Map<string, number[]>();
  for (const series of data.series) {
    const values = grouped.get(series.metric) ?? [];
    values.push(...series.points.map((point) => point.value));
    grouped.set(series.metric, values);
  }
  return new Map(
    [...grouped.entries()].map(([metric, values]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return [metric, { min, max: max === min ? min + 1 : max }];
    }),
  );
}

function xFor(time: number, domain: { min: number; max: number }): number {
  return PAD_X + ((time - domain.min) / (domain.max - domain.min)) * (WIDTH - PAD_X * 2);
}

function yFor(value: number, scale: { min: number; max: number }): number {
  const bottom = HEIGHT - PAD_BOTTOM;
  return bottom - ((value - scale.min) / (scale.max - scale.min)) * (bottom - PAD_TOP);
}

function timeAt(viewX: number, domain: { min: number; max: number }): string {
  const fraction = Math.min(1, Math.max(0, (viewX - PAD_X) / (WIDTH - PAD_X * 2)));
  return new Date(domain.min + fraction * (domain.max - domain.min)).toISOString();
}

function colorFor(metric: string): string {
  return METRIC_COLOR[metric] ?? '#bdbdc2';
}

function seriesLabel(metric: string, name: string): string {
  const labels: Record<string, string> = { temp: 'Temp', humid: 'Humid', co2: 'CO2', vpd: 'VPD', light: 'Light', ec: 'EC', vwc: 'VWC' };
  return labels[metric] ?? name;
}

function nearestCoord(points: Array<{ x: number; y: number; value: number }>, targetX: number) {
  return points.reduce((best, point) => {
    const distance = Math.abs(point.x - targetX);
    if (!best || distance < best.distance) {
      return { point, distance };
    }
    return best;
  }, null as { point: (typeof points)[number]; distance: number } | null)?.point;
}

function formatReading(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatClock(time: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(time));
}

function formatDay(time: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: '2-digit' }).format(new Date(time));
}

