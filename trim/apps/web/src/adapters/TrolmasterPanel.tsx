import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { trolmasterConnectionSchema, type TrolmasterConnection } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { apiGet, apiSend } from '../api/client';

const trolmasterListSchema = z.array(trolmasterConnectionSchema);

export function TrolmasterPanel({ siteId, roomId }: { siteId: string; roomId: string }) {
  const queryClient = useQueryClient();
  const [controllerId, setControllerId] = useState('');
  const [apiCredential, setApiCredential] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const saved = useQuery({
    queryKey: ['trolmaster', siteId],
    queryFn: () => apiGet(`/sites/${siteId}/trolmaster`, trolmasterListSchema),
  });
  const save = useMutation({
    mutationFn: () =>
      apiSend(`/sites/${siteId}/trolmaster`, trolmasterConnectionSchema, {
        roomId,
        controllerId,
        apiCredential,
      }),
    onSuccess: async () => {
      setMessage('Credential saved.');
      setControllerId('');
      setApiCredential('');
      await queryClient.invalidateQueries({ queryKey: ['trolmaster', siteId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Box data-testid="trolmaster-panel">
      <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
        Trolmaster API's
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        This stores the controller id and credential for this room. Trim does not call TrolMaster.
      </Typography>
      <Box
        component="form"
        sx={{ display: 'grid', gap: 1.5, maxWidth: 480 }}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <TextField
          label="TrolMaster controller id"
          value={controllerId}
          onChange={(event) => setControllerId(event.target.value)}
          required
          inputProps={{ 'data-testid': 'trolmaster-controller-id' }}
        />
        <TextField
          label="API credential"
          value={apiCredential}
          onChange={(event) => setApiCredential(event.target.value)}
          required
          autoComplete="off"
          inputProps={{ 'data-testid': 'trolmaster-credential' }}
        />
        <Button type="submit" variant="contained" disabled={save.isPending} data-testid="trolmaster-save">
          Save
        </Button>
      </Box>
      {message ? (
        <Alert sx={{ mt: 2 }} severity={message === 'Credential saved.' ? 'success' : 'error'}>
          {message}
        </Alert>
      ) : null}
      <SavedConnections rows={saved.data ?? []} />
    </Box>
  );
}

function SavedConnections({ rows }: { rows: TrolmasterConnection[] }) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ mt: 3, color: 'text.secondary' }} data-testid="trolmaster-empty">
        No TrolMaster controller is saved for this facility.
      </Typography>
    );
  }
  return (
    <Box sx={{ mt: 3 }}>
      {rows.map((row) => (
        <Typography key={row.id} data-testid="trolmaster-saved">
          {row.roomName} · {row.controllerId} · Credential saved
        </Typography>
      ))}
    </Box>
  );
}
