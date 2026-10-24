import {
  Alert,
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { dashboardAnalyticsSchema, type DashboardAnalytics } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiGet } from '../api/client';
import { displayFont, workbench } from '../theme';

const CULTIVAR_COLORS = [workbench.violet, workbench.sky, workbench.copper, workbench.greenhouse, workbench.gold, workbench.leaf];

export function DashboardCharts({ siteId }: { siteId: string }) {
  const analytics = useQuery({
    queryKey: ['dashboard-analytics', siteId],
    queryFn: () => apiGet(`/reports/sites/${siteId}/dashboard`, dashboardAnalyticsSchema),
  });

  if (analytics.isPending) {
    return <Skeleton variant="rounded" height={420} sx={{ mb: 3 }} />;
  }
  if (analytics.error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {analytics.error.message}
      </Alert>
    );
  }
  if (!analytics.data) {
    return null;
  }

  const data = analytics.data;
  return (
    <Box data-testid="dashboard-charts" sx={{ mb: 4, display: 'grid', gap: 2 }}>
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{data.statement}</Typography>

      <Panel title="Estimated Yield Graph" testId="dashboard-yield-graph">
        {data.yieldGraph.weeks.length === 0 ? (
          <Alert severity="info">No harvest dry weights or active crop estimates are stored for this facility.</Alert>
        ) : (
          <YieldStackedChart graph={data.yieldGraph} />
        )}
      </Panel>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr' },
          gap: 2,
        }}
      >
        <Panel title="COGS Breakdown" testId="dashboard-cogs">
          <CogsDonut cogs={data.cogs} />
        </Panel>
        <Panel title="Top Performing Strains" testId="dashboard-top-strains">
          {data.topStrains.length === 0 ? (
            <Alert severity="info">No harvests are stored for this facility.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Strain Name</TableCell>
                  <TableCell align="right">Harvests</TableCell>
                  <TableCell align="right">Packaged</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.topStrains.map((row) => (
                  <TableRow key={row.strainName} hover>
                    <TableCell>{row.strainName}</TableCell>
                    <TableCell align="right">{row.harvestCount}</TableCell>
                    <TableCell align="right">{formatGrams(row.packagedGrams)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' },
          gap: 2,
        }}
      >
        <Panel title="Plant Forecast" testId="dashboard-plant-forecast">
          {data.plantForecast.rows.length === 0 ? (
            <Alert severity="info">No active crops or room stays are stored for this facility.</Alert>
          ) : (
            <PlantForecastTable forecast={data.plantForecast} />
          )}
        </Panel>
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Kpi
              label="Packaged (MTD)"
              value={formatCompactGrams(data.kpis.packagedMtdGrams)}
              testId="dashboard-kpi-packaged"
            />
            <Kpi
              label="Average g per plant"
              value={
                data.kpis.averageGramsPerPlant == null
                  ? '—'
                  : data.kpis.averageGramsPerPlant.toLocaleString(undefined, { maximumFractionDigits: 2 })
              }
              testId="dashboard-kpi-gpp"
            />
          </Box>
          <Panel title="Packages by Item" testId="dashboard-packages">
            {data.packagesByItem.length === 0 ? (
              <Alert severity="info">No packages are stored for this facility.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Weight</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.packagesByItem.map((row) => (
                    <TableRow key={`${row.label}-${row.harvestName}`} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{row.label}</Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{row.harvestName}</Typography>
                      </TableCell>
                      <TableCell align="right">{formatGrams(row.weightGrams)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

function Panel({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        border: `1px solid ${workbench.line}`,
        bgcolor: workbench.paper,
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Typography
        sx={{
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: 20,
          mb: 1.5,
          textAlign: title === 'Estimated Yield Graph' ? 'center' : 'left',
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Kpi({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <Box
      data-testid={testId}
      sx={{
        border: `1px solid ${workbench.line}`,
        bgcolor: workbench.paper,
        p: 1.75,
        minHeight: 110,
      }}
    >
      <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: 34, lineHeight: 1.15, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

function YieldStackedChart({ graph }: { graph: DashboardAnalytics['yieldGraph'] }) {
  const width = 920;
  const height = 320;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 56;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const max = Math.max(
    1,
    ...graph.weeks.map((_, weekIndex) =>
      graph.series.reduce((sum, series) => sum + (series.points[weekIndex]?.grams ?? 0), 0),
    ),
  );
  const groupWidth = plotWidth / Math.max(graph.weeks.length, 1);
  const barWidth = Math.max(18, groupWidth * 0.55);

  return (
    <Box>
      <Box
        component="svg"
        data-testid="dashboard-yield-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Estimated yield by week and cultivar"
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <line
          x1={padLeft}
          y1={height - padBottom}
          x2={width - padRight}
          y2={height - padBottom}
          stroke={workbench.line}
        />
        {[0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = height - padBottom - plotHeight * fraction;
          return (
            <g key={fraction}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={workbench.line} strokeOpacity={0.4} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fill="#C4B6E4" fontSize="11">
                {Math.round(max * fraction).toLocaleString()}
              </text>
            </g>
          );
        })}
        {graph.weeks.map((week, weekIndex) => {
          const x = padLeft + weekIndex * groupWidth + (groupWidth - barWidth) / 2;
          let y = height - padBottom;
          return (
            <g key={week}>
              {graph.series.map((series, seriesIndex) => {
                const grams = series.points[weekIndex]?.grams ?? 0;
                if (grams <= 0) {
                  return null;
                }
                const barHeight = (grams / max) * plotHeight;
                y -= barHeight;
                return (
                  <rect
                    key={series.cultivar}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={CULTIVAR_COLORS[seriesIndex % CULTIVAR_COLORS.length]}
                  />
                );
              })}
              <text
                x={x + barWidth / 2}
                y={height - 18}
                textAnchor="middle"
                fill="#C4B6E4"
                fontSize="11"
              >
                {week}
              </text>
            </g>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center', mt: 1 }}>
        {graph.cultivars.map((cultivar, index) => (
          <Box key={cultivar} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: CULTIVAR_COLORS[index % CULTIVAR_COLORS.length] }} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{cultivar}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function CogsDonut({ cogs }: { cogs: DashboardAnalytics['cogs'] }) {
  const slices = [
    { label: 'Labor', cents: cogs.laborCents, color: workbench.greenhouse },
    { label: 'Non-Cannabis', cents: cogs.nonCannabisCents, color: workbench.copper },
    { label: 'Cannabis', cents: cogs.cannabisCents, color: workbench.sky },
  ];
  const total = Math.max(cogs.totalCents, 0);
  const radius = 68;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 180px' }, gap: 2, alignItems: 'center' }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {slices.map((slice) => (
          <Box key={slice.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: slice.color }} />
            <Typography sx={{ fontWeight: 600 }}>
              {slice.label}: {formatCents(slice.cents)}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ position: 'relative', width: 180, height: 180, justify: '0 auto' }}>
        <Box
          component="svg"
          viewBox="0 0 180 180"
          data-testid="dashboard-cogs-svg"
          sx={{ width: '100%', height: '100%' }}
        >
          <circle cx="90" cy="90" r={radius} fill="none" stroke={workbench.line} strokeWidth={stroke} />
          {total === 0 ? null : (
            slices.map((slice) => {
              const length = (slice.cents / total) * circumference;
              const node = (
                <circle
                  key={slice.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 90 90)"
                />
              );
              offset += length;
              return node;
            })
          )}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>Total</Typography>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: 18 }} data-testid="dashboard-cogs-total">
            {formatCents(cogs.totalCents)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function PlantForecastTable({ forecast }: { forecast: DashboardAnalytics['plantForecast'] }) {
  const flat = forecast.rows.flatMap((row) => row.values).filter((value) => value > 0);
  const median = flat.length === 0 ? 0 : [...flat].sort((a, b) => a - b)[Math.floor(flat.length / 2)]!;

  return (
    <Box sx={{ overflowX: 'auto', maxWidth: '100%', width: '100%' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Strain</TableCell>
            {forecast.dates.map((date) => (
              <TableCell key={date} align="right">
                {date}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {forecast.rows.map((row) => (
            <TableRow key={row.cultivar}>
              <TableCell sx={{ fontWeight: 600 }}>{row.cultivar}</TableCell>
              {row.values.map((value, index) => {
                const tone =
                  value === 0
                    ? 'transparent'
                    : value >= median
                      ? 'rgba(46, 230, 166, 0.22)'
                      : 'rgba(255, 79, 139, 0.18)';
                return (
                  <TableCell
                    key={`${row.cultivar}-${forecast.dates[index]}`}
                    align="right"
                    sx={{ bgcolor: tone, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {value}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatGrams(grams: number): string {
  return `${grams.toLocaleString()} g`;
}

function formatCompactGrams(grams: number): string {
  if (grams >= 1_000_000) {
    return `${(grams / 1_000_000).toFixed(1)}M g`;
  }
  if (grams >= 10_000) {
    return `${(grams / 1_000).toFixed(1)}k g`;
  }
  return formatGrams(grams);
}
