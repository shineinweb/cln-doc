import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { controllerReadingSchema, environmentalReadingSchema, sensorGatewaySchema } from '@trim/contracts';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ApiError, apiGet, apiSend } from '../api/client';
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
  background: workbench.mist,
  color: workbench.ink,
};

export function RoomAdapters({
  roomId,
  siteId,
  timeZone,
}: {
  roomId: string;
  siteId: string;
  timeZone: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const gateway = useQuery({
    queryKey: ['site-gateway', siteId],
    queryFn: () => apiGet(`/adapters/environment/sites/${siteId}/gateway`, sensorGatewaySchema),
    retry: false,
  });
  const samples = useQuery({
    queryKey: ['controller-samples', roomId],
    queryFn: () => apiGet(`/adapters/controllers/rooms/${roomId}/samples`, z.array(controllerReadingSchema)),
    retry: false,
  });
  const postReading = useMutation({
    mutationFn: (payload: unknown) => {
      if (!gateway.data) {
        throw new Error('This site has no environment gateway.');
      }
      return apiSend(`/adapters/environment/gateways/${gateway.data.id}/readings`, environmentalReadingSchema, payload);
    },
    onSuccess: async (reading) => {
      setError(null);
      setMessage(`${reading.deviceId} posted ${reading.value} ${reading.unit}. This is a live reading.`);
      await queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (reason: Error) => {
      setMessage(null);
      setError(reason.message);
    },
  });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <Card data-testid="gateway-panel">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Environment gateway
          </Typography>
          {gateway.data ? (
            <Typography sx={{ color: 'text.secondary', mb: 1 }} data-testid="gateway-name">
              {gateway.data.name} posts a live reading. It is not sample data.
            </Typography>
          ) : gateway.error instanceof ApiError && gateway.error.status === 404 ? (
            <Typography sx={{ color: 'text.secondary' }}>No environment gateway is registered for this site.</Typography>
          ) : gateway.error ? (
            <Alert severity="warning">{gateway.error.message}</Alert>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>Loading the gateway.</Typography>
          )}
          {gateway.data ? (
            <Box
              component="form"
              data-testid="gateway-form"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                postReading.mutate({
                  roomId,
                  deviceId: String(form.get('deviceId') ?? ''),
                  metric: String(form.get('metric') ?? ''),
                  value: Number(form.get('value')),
                  unit: String(form.get('unit') ?? ''),
                  recordedAt: String(form.get('recordedAt') ?? ''),
                  quality: String(form.get('quality') ?? 'good'),
                });
              }}
              sx={{ display: 'grid', gap: 1 }}
            >
              <label>
                Device
                <Box component="input" name="deviceId" data-testid="gateway-device" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
              </label>
              <label>
                Metric
                <Box component="select" name="metric" data-testid="gateway-metric" defaultValue="temperature" sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }}>
                  {METRICS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Box>
              </label>
              <label>
                Value
                <Box component="input" name="value" type="number" step="0.1" data-testid="gateway-value" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
              </label>
              <label>
                Unit
                <Box component="input" name="unit" data-testid="gateway-unit" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
              </label>
              <label>
                Timestamp
                <Box component="input" name="recordedAt" type="datetime-local" data-testid="gateway-recorded-at" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
              </label>
              <label>
                Quality
                <Box component="select" name="quality" data-testid="gateway-quality" defaultValue="good" sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }}>
                  <option value="good">Good</option>
                  <option value="suspect">Suspect</option>
                  <option value="bad">Bad</option>
                </Box>
              </label>
              <Button type="submit" variant="contained" data-testid="gateway-submit" disabled={postReading.isPending}>
                Post gateway reading
              </Button>
            </Box>
          ) : null}
          {message ? (
            <Alert severity="success" sx={{ mt: 1 }} data-testid="gateway-saved">
              {message}
            </Alert>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mt: 1 }} data-testid="gateway-error">
              {error}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Card data-testid="controller-samples">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Controller sample
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 1 }}>
            Controller payloads are sample data. They do not clear or create range alerts.
          </Typography>
          {samples.data && samples.data.length > 0 ? (
            samples.data.map((sample) => (
              <Typography key={sample.id} data-testid="controller-sample" sx={{ mb: 0.75 }}>
                {sample.deviceId} · {sample.metric} {sample.value} {sample.unit} · {sample.quality} ·{' '}
                {formatTimestamp(sample.recordedAt, timeZone)} · Sample data
              </Typography>
            ))
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>No controller sample is stored for this room.</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
