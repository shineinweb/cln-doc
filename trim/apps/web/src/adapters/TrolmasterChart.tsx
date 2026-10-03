import { Alert, Box, Typography } from '@mui/material';
import { trolmasterChartSchema, type TrolmasterChart } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet } from '../api/client';

const EC_COLORS = ['#e6b84a', '#f6d78a', '#c9942a', '#ffe3a3', '#a67c2a'];
const VWC_COLORS = ['#7eb6f0', '#4f8fd6', '#b9d7f8', '#2f6eae', '#9ec8ef'];
const WIDTH = 960;
const HEIGHT = 420;
const PAD_X = 28;
const PAD_BOTTOM = 42;

export function TrolmasterChart({ roomId, timeZone }: { roomId: string; timeZone: string }) {
  const chart = useQuery({
    queryKey: ['trolmaster-chart', roomId],
    queryFn: () => apiGet(`/rooms/${roomId}/trolmaster/chart`, trolmasterChartSchema),
  });
  const [hoverAt, setHoverAt] = useState<string | null>(null);

  if (chart.isPending) {
    return <Alert severity="info">Reading Trolmaster…</Alert>;
  }
  if (chart.error) {
    return <Alert severity="error">{chart.error.message}</Alert>;
  }

  const data = chart.data;
  const domain = timeDomain(data);
  const hovered = hoverAt ? readingsAt(data, hoverAt) : data.latest;

  return (
    <Box data-testid="trolmaster-chart-card" sx={{ bgcolor: '#0b1d3a', color: '#e8eef8', borderRadius: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 22 }} data-testid="trolmaster-controller">
          {data.controllerId ?? 'Trolmaster'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {hovered.map((reading) => (
            <Box
              key={reading.metric}
              data-testid={reading.metric === 'ec' ? 'trolmaster-ec' : 'trolmaster-vwc'}
              sx={{ bgcolor: '#163056', borderRadius: 2, px: 1.5, py: 0.75, display: 'flex', gap: 1, alignItems: 'baseline' }}
            >
              <Typography sx={{ color: reading.metric === 'ec' ? '#e6b84a' : '#7eb6f0', fontSize: 13 }}>{reading.label}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {formatReading(reading.value)} {reading.unit}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      {data.series.length === 0 ? (
        <Alert severity="info" data-testid="trolmaster-chart-empty">
          {data.message ?? 'Trolmaster returned no chart points.'}
        </Alert>
      ) : (
        <ChartPlot data={data} domain={domain} timeZone={timeZone} hoverAt={hoverAt} onHover={setHoverAt} />
      )}
    </Box>
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
  const ticks = [domain.min, domain.min + (domain.max - domain.min) / 2, domain.max];

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="svg"
        data-testid="trolmaster-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Trolmaster chart"
        sx={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const viewX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          onHover(timeAt(viewX, domain));
        }}
        onMouseLeave={() => onHover(null)}
      >
        <line x1={PAD_X} y1={HEIGHT - PAD_BOTTOM} x2={WIDTH - PAD_X} y2={HEIGHT - PAD_BOTTOM} stroke="rgba(232,238,248,0.25)" />
        {data.series.map((series, index) => {
          const color = colorFor(series.metric, index);
          const scale = scales.get(series.metric);
          if (!scale) {
            return null;
          }
          const points = series.points
            .map((point) => {
              const x = xFor(new Date(point.at).getTime(), domain);
              const y = yFor(point.value, scale);
              return `${x},${y}`;
            })
            .join(' ');
          return <polyline key={series.id} fill="none" stroke={color} strokeWidth="1.6" points={points} />;
        })}
        {hoverX != null ? (
          <>
            <line x1={hoverX} y1={16} x2={hoverX} y2={HEIGHT - PAD_BOTTOM} stroke="rgba(232,238,248,0.7)" />
            <rect x={Math.min(hoverX + 8, WIDTH - 150)} y={12} width="132" height="26" rx="8" fill="#163056" />
            <text x={Math.min(hoverX + 16, WIDTH - 142)} y={30} fill="#e8eef8" fontSize="13" data-testid="trolmaster-chart-time">
              {formatHover(hoverAt ?? '', timeZone)}
            </text>
          </>
        ) : null}
        {ticks.map((tick) => (
          <text key={tick} x={xFor(tick, domain)} y={HEIGHT - 14} fill="#9aabc4" fontSize="12" textAnchor="middle">
            {formatAxis(tick, timeZone)}
          </text>
        ))}
      </Box>
    </Box>
  );
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

function readingsAt(data: TrolmasterChart, at: string): TrolmasterChart['latest'] {
  const target = new Date(at).getTime();
  return data.latest.map((reading) => {
    const series = data.series.find((item) => item.metric === reading.metric && (reading.label === 'EC PW' ? /pw/i.test(item.name) : true)) ?? data.series.find((item) => item.metric === reading.metric);
    const point = series ? nearest(series.points, target) : undefined;
    return point ? { ...reading, value: point.value } : reading;
  });
}

function nearest(points: TrolmasterChart['series'][number]['points'], target: number) {
  return points.reduce((best, point) => {
    const distance = Math.abs(new Date(point.at).getTime() - target);
    if (!best || distance < best.distance) {
      return { point, distance };
    }
    return best;
  }, null as { point: (typeof points)[number]; distance: number } | null)?.point;
}

function xFor(time: number, domain: { min: number; max: number }): number {
  return PAD_X + ((time - domain.min) / (domain.max - domain.min)) * (WIDTH - PAD_X * 2);
}

function yFor(value: number, scale: { min: number; max: number }): number {
  const top = 20;
  const bottom = HEIGHT - PAD_BOTTOM;
  return bottom - ((value - scale.min) / (scale.max - scale.min)) * (bottom - top);
}

function timeAt(viewX: number, domain: { min: number; max: number }): string {
  const fraction = Math.min(1, Math.max(0, (viewX - PAD_X) / (WIDTH - PAD_X * 2)));
  return new Date(domain.min + fraction * (domain.max - domain.min)).toISOString();
}

function colorFor(metric: string, index: number): string {
  if (metric === 'ec') {
    return EC_COLORS[index % EC_COLORS.length];
  }
  if (metric === 'vwc') {
    return VWC_COLORS[index % VWC_COLORS.length];
  }
  return '#9aabc4';
}

function formatReading(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatAxis(time: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
  }).format(new Date(time)).replace(',', '');
}

function formatHover(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
}
