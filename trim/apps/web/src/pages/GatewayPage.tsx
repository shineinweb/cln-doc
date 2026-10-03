import { Alert, Box, Button, Card, CardContent } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { environmentalReadingSchema, sensorGatewaySchema } from '@trim/contracts';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { workbench } from '../theme';

const fieldStyle = {
  font: 'inherit',
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${workbench.line}`,
  background: '#fff',
  color: workbench.ink,
};

export function GatewayPage() {
  const { gatewayId = '' } = useParams();
  const [error, setError] = useState<string | null>(null);
  const gateway = useQuery({
    queryKey: ['gateway', gatewayId],
    queryFn: () => apiGet(`/adapters/environment/gateways/${gatewayId}`, sensorGatewaySchema),
    enabled: Boolean(gatewayId),
    retry: false,
  });
  const postReading = useMutation({
    mutationFn: (payload: unknown) =>
      apiSend(`/adapters/environment/gateways/${gatewayId}/readings`, environmentalReadingSchema, payload),
    onSuccess: () => setError(null),
    onError: (reason: Error) => setError(reason.message),
  });
  const denied = gateway.error instanceof ApiError && (gateway.error.status === 403 || gateway.error.status === 404);

  return (
    <Box>
      <PageHeader
        kicker="Environment gateway"
        title={gateway.data?.name ?? 'Gateway write'}
        lede="A gateway can post a live reading only for a room on its own site."
      />
      {denied ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="gateway-load-denied">
          {gateway.error instanceof ApiError && gateway.error.status === 403
            ? 'You do not have access to this gateway.'
            : 'This gateway was not found.'}
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <Box
            component="form"
            data-testid="gateway-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              postReading.mutate({
                roomId: String(form.get('roomId') ?? ''),
                deviceId: String(form.get('deviceId') ?? ''),
                metric: String(form.get('metric') ?? 'temperature'),
                value: Number(form.get('value')),
                unit: String(form.get('unit') ?? ''),
                recordedAt: String(form.get('recordedAt') ?? ''),
                quality: String(form.get('quality') ?? 'good'),
              });
            }}
            sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
          >
            <label>
              Room
              <Box component="input" name="roomId" data-testid="gateway-room" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
            </label>
            <label>
              Device
              <Box component="input" name="deviceId" data-testid="gateway-device" required sx={{ ...fieldStyle, display: 'block', width: '100%', mt: 0.5 }} />
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
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }} data-testid="gateway-error">
              {error}
            </Alert>
          ) : null}
          {postReading.isSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }} data-testid="gateway-saved">
              Live reading stored.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
