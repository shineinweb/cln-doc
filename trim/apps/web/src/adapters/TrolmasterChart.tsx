import { Alert, Box, FormControlLabel, Switch, Typography } from '@mui/material';
import { trolmasterChartSchema, trolmasterModeSchema, type TrolmasterChart, type TrolmasterMode } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiGet, apiSend } from '../api/client';
import { workbench } from '../theme';

const METRIC_COLOR: Record<string, string> = {
  temp: '#FF4F8B',
  humid: '#3DDCFF',
  co2: '#FFD166',
  vpd: '#2EE6A6',
  light: '#FF8A3D',
  ec: '#FFD166',
  vwc: '#7C5CFF',
};
const WIDTH = 960;
const HEIGHT = 420;
const PAD_X = 36;
const PAD_BOTTOM = 52;
const PAD_TOP = 18;
type ChartRange = 'day' | 'week' | 'month';
type PlotPoint = { x: number; y: number; value: number };

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
    <Box
      data-testid="trolmaster-chart-card"
      sx={{
        color: workbench.ink,
        borderRadius: 2,
        p: 2,
        border: `1px solid ${workbench.line}`,
        background: `linear-gradient(165deg, rgba(58, 24, 104, 0.55) 0%, ${workbench.paper} 42%, #12182A 100%)`,
        boxShadow: '0 18px 40px rgba(8, 6, 20, 0.45)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <TrolmasterSwitches roomId={roomId} />
        <Box sx={{ display: 'flex', bgcolor: 'rgba(16, 14, 28, 0.72)', border: `1px solid ${workbench.line}`, borderRadius: 999, p: 0.25 }}>
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
                color: range === item ? '#140E28' : workbench.ink,
                bgcolor: range === item ? workbench.sky : 'transparent',
                fontWeight: 700,
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
            <Box
              data-testid="trolmaster-chart-day"
              sx={{ bgcolor: 'rgba(16, 14, 28, 0.72)', border: `1px solid ${workbench.line}`, borderRadius: 999, px: 1.5, py: 0.5 }}
            >
              {formatDay(new Date(hoverAt ?? new Date(domain.max).toISOString()).getTime(), timeZone)}
            </Box>
            <Box
              data-testid="trolmaster-chart-time"
              sx={{ bgcolor: 'rgba(16, 14, 28, 0.72)', border: `1px solid ${workbench.line}`, borderRadius: 999, px: 1.5, py: 0.5 }}
            >
              {formatClock(new Date(hoverAt ?? new Date(domain.max).toISOString()).getTime(), timeZone)}
            </Box>
          </Box>
        ) : null}
      </Box>
      {showingSample ? (
        <Typography data-testid="trolmaster-sample-note" sx={{ color: workbench.gold, fontSize: 14, mb: 1 }}>
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
                    borderColor: off ? workbench.line : color,
                    color: off ? '#8B7FB0' : workbench.ink,
                    bgcolor: off ? 'transparent' : 'rgba(16, 14, 28, 0.35)',
                    borderRadius: 999,
                    px: 1.25,
                    py: 0.4,
                    cursor: 'pointer',
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, opacity: off ? 0.35 : 1, boxShadow: off ? 'none' : `0 0 8px ${color}` }} />
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      border: `1px solid ${workbench.line}`,
                      borderRadius: 999,
                      px: 1,
                      py: 0.4,
                      bgcolor: 'rgba(16, 14, 28, 0.35)',
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorFor(series.metric) }} />
                    {seriesLabel(series.metric, series.name)}
                  </Box>
                  <Typography sx={{ fontSize: 14, color: '#C4B6E4' }}>
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
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: 1.5,
          border: `1px solid ${workbench.line}`,
          overflow: 'hidden',
        }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const viewX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          onHover(timeAt(viewX, domain));
        }}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="trolmaster-plot-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#24183F" />
            <stop offset="46%" stopColor="#151B2E" />
            <stop offset="100%" stopColor="#0B1220" />
          </linearGradient>
          <radialGradient id="trolmaster-plot-glow" cx="78%" cy="18%" r="55%">
            <stop offset="0%" stopColor="rgba(61, 220, 255, 0.18)" />
            <stop offset="55%" stopColor="rgba(124, 92, 255, 0.12)" />
            <stop offset="100%" stopColor="rgba(16, 14, 28, 0)" />
          </radialGradient>
          <filter id="trolmaster-line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {data.series.map((series) => (
            <linearGradient key={series.id} id={`fill-${series.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorFor(series.metric)} stopOpacity="0.42" />
              <stop offset="55%" stopColor={colorFor(series.metric)} stopOpacity="0.12" />
              <stop offset="100%" stopColor={colorFor(series.metric)} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#trolmaster-plot-bg)" />
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#trolmaster-plot-glow)" />
        {[0.2, 0.4, 0.6, 0.8].map((fraction) => {
          const y = PAD_TOP + fraction * (bottom - PAD_TOP);
          return <line key={fraction} x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="rgba(196, 182, 228, 0.1)" />;
        })}
        <line x1={PAD_X} y1={PAD_TOP} x2={WIDTH - PAD_X} y2={PAD_TOP} stroke="rgba(196, 182, 228, 0.22)" />
        <line x1={PAD_X} y1={bottom} x2={WIDTH - PAD_X} y2={bottom} stroke="rgba(196, 182, 228, 0.28)" />
        {ticks.map((tick) => (
          <line key={tick} x1={xFor(tick, domain)} y1={PAD_TOP} x2={xFor(tick, domain)} y2={bottom} stroke="rgba(196, 182, 228, 0.1)" />
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
          const linePath = smoothLinePath(coords);
          const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${bottom} L ${coords[0].x} ${bottom} Z`;
          const hoverPoint = hoverAt ? nearestCoord(coords, xFor(new Date(hoverAt).getTime(), domain)) : null;
          const color = colorFor(series.metric);
          return (
            <g key={series.id}>
              <path d={areaPath} fill={`url(#fill-${series.id})`} />
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#trolmaster-line-glow)"
              />
              <path d={linePath} fill="none" stroke={color} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
              {hoverPoint ? (
                <g>
                  <circle cx={hoverPoint.x} cy={hoverPoint.y} r="7" fill={color} fillOpacity="0.22" />
                  <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3.4" fill={color} stroke="#140E28" strokeWidth="1.2" />
                  <text
                    x={hoverPoint.x + 8}
                    y={Math.max(PAD_TOP + 14, hoverPoint.y - 8)}
                    fill={color}
                    fontSize="13"
                    fontWeight="700"
                    style={{ paintOrder: 'stroke', stroke: 'rgba(16,14,28,0.85)', strokeWidth: 3 }}
                  >
                    {formatReading(hoverPoint.value)} {series.unit}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {hoverX != null ? (
          <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={bottom} stroke="rgba(246, 243, 255, 0.45)" strokeDasharray="3 5" />
        ) : null}
        {ticks.map((tick) => (
          <g key={`label-${tick}`}>
            <text x={xFor(tick, domain)} y={HEIGHT - 28} fill="#D7C6F5" fontSize="12" textAnchor="middle">
              {formatClock(tick, timeZone)}
            </text>
            <text x={xFor(tick, domain)} y={HEIGHT - 12} fill="#8B7FB0" fontSize="12" textAnchor="middle">
              {formatDay(tick, timeZone)}
            </text>
          </g>
        ))}
      </Box>
    </Box>
  );
}

/** Smooth cubic path through points (Catmull-Rom → Bezier). */
function smoothLinePath(points: PlotPoint[]): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
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

