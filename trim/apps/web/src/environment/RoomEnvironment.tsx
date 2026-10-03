import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import {
  alertRuleSchema,
  environmentalReadingSchema,
  importReadingsResultSchema,
  type RoomDetail,
} from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiSend } from '../api/client';
import { formatTimestamp } from '../crops/format';
import { workbench } from '../theme';

const METRICS = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'relative_humidity', label: 'Relative humidity' },
  { value: 'co2', label: 'CO₂' },
  { value: 'substrate', label: 'Substrate' },
] as const;

const fieldStyle = {
  font: 'inherit',
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${workbench.line}`,
  background: '#fff',
  color: workbench.ink,
};

export function RoomEnvironment({ room }: { room: RoomDetail }) {
  const queryClient = useQueryClient();
  const [metric, setMetric] = useState<string>('temperature');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['room', room.id] });
  };

  const saveReading = useMutation({
    mutationFn: (payload: unknown) => apiSend(`/rooms/${room.id}/readings`, environmentalReadingSchema, payload),
    onSuccess: async (reading) => {
      setError(null);
      setMessage(reading.isSample ? 'Sample reading saved.' : 'Reading saved.');
      await refresh();
    },
    onError: (reason: Error) => {
      setMessage(null);
      setError(reason.message);
    },
  });

  const importCsv = useMutation({
    mutationFn: (csv: string) => apiSend(`/rooms/${room.id}/readings/import`, importReadingsResultSchema, { csv }),
    onSuccess: async (result) => {
      setError(null);
      setMessage(`Imported ${result.imported} ${result.imported === 1 ? 'reading' : 'readings'}.`);
      await refresh();
    },
    onError: (reason: Error) => {
      setMessage(null);
      setError(reason.message);
    },
  });

  const saveRule = useMutation({
    mutationFn: (payload: unknown) => apiSend(`/rooms/${room.id}/alert-rules`, alertRuleSchema, payload),
    onSuccess: async () => {
      setError(null);
      setMessage('Alert rule saved.');
      await refresh();
    },
    onError: (reason: Error) => {
      setMessage(null);
      setError(reason.message);
    },
  });

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Card sx={{ bgcolor: workbench.mist }} data-testid="latest-readings">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 0.5 }}>
            Latest environmental readings
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 1.5 }} data-testid="stale-rule">
            A reading older than {room.staleAfterMinutes} minutes is stale. Times use {room.siteTimezone}.
          </Typography>
          {room.latestReadings.map((slot) => (
            <ReadingRow key={slot.metric} slot={slot} timeZone={room.siteTimezone} />
          ))}
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: workbench.mist }} data-testid="active-alerts">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Active alerts
          </Typography>
          {room.activeAlerts.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No active alerts.</Typography>
          ) : (
            room.activeAlerts.map((alert) => (
              <Typography key={alert.id} data-testid="alert-row" sx={{ mb: 0.5 }}>
                {alert.message}
              </Typography>
            ))
          )}
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: workbench.mist }}>
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Reading history
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Typography component="label" htmlFor="chart-metric" sx={{ color: 'text.secondary' }}>
              Metric
            </Typography>
            <Box
              component="select"
              id="chart-metric"
              data-testid="chart-metric"
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
              sx={fieldStyle}
            >
              {METRICS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Box>
          </Box>
          <ReadingChart history={room.readingHistory} metric={metric} />
        </CardContent>
      </Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
              Record a reading
            </Typography>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                saveReading.mutate({
                  deviceId: String(form.get('deviceId') ?? ''),
                  metric: String(form.get('metric') ?? ''),
                  value: Number(form.get('value')),
                  unit: String(form.get('unit') ?? ''),
                  recordedAt: String(form.get('recordedAt') ?? ''),
                  quality: String(form.get('quality') ?? ''),
                  isSample: form.get('isSample') === 'on',
                });
              }}
              sx={{ display: 'grid', gap: 1 }}
            >
              <Field label="Device" name="deviceId" testId="reading-device" />
              <LabeledSelect label="Metric" name="metric" testId="reading-metric" options={METRICS} />
              <Field label="Value" name="value" testId="reading-value" type="number" />
              <Field label="Unit" name="unit" testId="reading-unit" />
              <Field label="Timestamp" name="recordedAt" testId="reading-recorded-at" type="datetime-local" />
              <LabeledSelect
                label="Quality"
                name="quality"
                testId="reading-quality"
                options={[
                  { value: 'good', label: 'Good' },
                  { value: 'suspect', label: 'Suspect' },
                  { value: 'bad', label: 'Bad' },
                ]}
              />
              <Typography component="label" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <input type="checkbox" name="isSample" data-testid="reading-sample" />
                Sample data
              </Typography>
              <Button type="submit" variant="contained" data-testid="save-reading" disabled={saveReading.isPending}>
                Save reading
              </Button>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
              Import a CSV
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 1 }}>
              Columns: device_id, metric, value, unit, recorded_at, quality, sample. A time without an offset is {room.siteTimezone}.
            </Typography>
            <Box
              component="form"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem('csv');
                const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
                if (!file) {
                  setMessage(null);
                  setError('Choose a CSV file.');
                  return;
                }
                void file.text().then((csv) => importCsv.mutate(csv));
              }}
              sx={{ display: 'grid', gap: 1 }}
            >
              <input type="file" name="csv" accept=".csv,text/csv" data-testid="reading-csv" />
              <Button type="submit" variant="outlined" data-testid="import-readings" disabled={importCsv.isPending}>
                Import readings
              </Button>
            </Box>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const kind = String(form.get('kind') ?? 'stale');
                const minRaw = String(form.get('minValue') ?? '');
                const maxRaw = String(form.get('maxValue') ?? '');
                saveRule.mutate({
                  metric: String(form.get('metric') ?? 'temperature'),
                  kind,
                  minValue: minRaw === '' ? null : Number(minRaw),
                  maxValue: maxRaw === '' ? null : Number(maxRaw),
                });
              }}
              sx={{ display: 'grid', gap: 1, mt: 3 }}
            >
              <Typography variant="h3" sx={{ fontSize: 20 }}>
                Alert rule
              </Typography>
              <LabeledSelect label="Metric" name="metric" testId="rule-metric" options={METRICS} />
              <LabeledSelect
                label="Kind"
                name="kind"
                testId="rule-kind"
                options={[
                  { value: 'stale', label: 'Stale metric' },
                  { value: 'range', label: 'Outside a range' },
                ]}
              />
              <Field label="Minimum" name="minValue" testId="rule-min" type="number" />
              <Field label="Maximum" name="maxValue" testId="rule-max" type="number" />
              <Button type="submit" variant="outlined" data-testid="save-alert-rule" disabled={saveRule.isPending}>
                Save alert rule
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
      {message ? (
        <Alert severity="success" data-testid="environment-message">
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" data-testid="environment-error">
          {error}
        </Alert>
      ) : null}
    </Box>
  );
}

function ReadingRow({ slot, timeZone }: { slot: RoomDetail['latestReadings'][number]; timeZone: string }) {
  const label = METRICS.find((item) => item.value === slot.metric)?.label ?? slot.metric;
  return (
    <Box data-testid="reading-row" data-metric={slot.metric} sx={{ mb: 1.25 }}>
      <Typography sx={{ fontWeight: 600 }}>
        {label}
        {slot.value == null ? '' : ` ${slot.value} ${slot.unit ?? ''}`}
      </Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        {slot.value == null ? 'No reading' : `${slot.deviceId} · ${slot.quality} · ${formatTimestamp(slot.recordedAt ?? '', timeZone)}`}
        {slot.stale ? (
          <Box component="span" data-testid="reading-stale" sx={{ color: 'primary.main', fontWeight: 700 }}>
            {' '}
            · Stale
          </Box>
        ) : null}
        {slot.isSample ? (
          <Box component="span" data-testid="reading-sample-label" sx={{ fontWeight: 700 }}>
            {' '}
            · Sample data
          </Box>
        ) : null}
      </Typography>
    </Box>
  );
}

function ReadingChart({ history, metric }: { history: RoomDetail['readingHistory']; metric: string }) {
  const points = history.filter((reading) => reading.metric === metric);
  const width = 640;
  const height = 220;
  const pad = 36;
  const hasSample = points.some((point) => point.isSample);
  let coords: Array<{ x: number; y: number; sample: boolean }> = [];
  if (points.length > 0) {
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    coords = points.map((point, index) => ({
      x: pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2),
      y: height - pad - ((point.value - min) / span) * (height - pad * 2),
      sample: point.isSample,
    }));
  }
  return (
    <Box>
      <Box
        component="svg"
        data-testid="environment-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Reading history"
        sx={{ width: '100%', height: 'auto', bgcolor: '#fff', borderRadius: 2 }}
      >
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={workbench.line} />
        {coords.length > 1 ? (
          <polyline
            fill="none"
            stroke={workbench.greenhouse}
            strokeWidth="2"
            points={coords.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {coords.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            cx={point.x}
            cy={point.y}
            r="5"
            fill={point.sample ? '#fff' : workbench.copper}
            stroke={point.sample ? workbench.copper : workbench.copper}
          />
        ))}
        {coords.length === 0 ? (
          <text x={pad} y={height / 2} fill="#5C564C" fontSize="16">
            No readings for this metric.
          </text>
        ) : null}
      </Box>
      {hasSample ? (
        <Typography data-testid="chart-sample-label" sx={{ mt: 1 }}>
          Open circles are sample data.
        </Typography>
      ) : null}
    </Box>
  );
}

function Field({
  label,
  name,
  testId,
  type = 'text',
}: {
  label: string;
  name: string;
  testId: string;
  type?: string;
}) {
  return (
    <Typography component="label" sx={{ display: 'grid', gap: 0.5 }}>
      {label}
      <Box component="input" name={name} type={type} data-testid={testId} required={type !== 'number' || name === 'value'} sx={fieldStyle} />
    </Typography>
  );
}

function LabeledSelect({
  label,
  name,
  testId,
  options,
}: {
  label: string;
  name: string;
  testId: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <Typography component="label" sx={{ display: 'grid', gap: 0.5 }}>
      {label}
      <Box component="select" name={name} data-testid={testId} defaultValue={options[0]?.value} sx={fieldStyle}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Box>
    </Typography>
  );
}
