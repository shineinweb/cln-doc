import { Alert, Box, Button, Skeleton, Stack, TextField, Typography } from '@mui/material';
import {
  emailBroadcastInputSchema,
  emailBroadcastListSchema,
  emailBroadcastSchema,
  type EmailBroadcast,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { workbench } from '../theme';

export function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['communications', 'broadcasts'],
    queryFn: () => apiGet('/communications/broadcasts', emailBroadcastListSchema),
  });
  const send = useMutation({
    mutationFn: () =>
      apiSend(
        '/communications/broadcasts',
        emailBroadcastSchema,
        emailBroadcastInputSchema.parse({ subject, body }),
      ),
    onSuccess: async (broadcast: EmailBroadcast) => {
      setNotice(`Sent “${broadcast.subject}” to ${broadcast.recipientCount} people.`);
      setSubject('');
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['communications', 'broadcasts'] });
    },
  });

  return (
    <Box data-testid="communications-page">
      <PageHeader
        kicker="Email"
        title="Marketing & announcements"
        lede="Send a one-off email to everyone in the organization who still has email notifications on. Transactional task mail uses the same delivery path."
      />
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="broadcast-success">
          {notice}
        </Alert>
      ) : null}
      {send.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {send.error.message}
        </Alert>
      ) : null}
      <Box
        sx={{
          border: `1px solid ${workbench.line}`,
          bgcolor: workbench.paper,
          borderRadius: 2,
          p: 2,
          mb: 3,
          maxWidth: 720,
        }}
      >
        <Stack spacing={2} component="form"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            send.mutate();
          }}
        >
          <TextField
            label="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            inputProps={{ 'data-testid': 'broadcast-subject' }}
          />
          <TextField
            label="Message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            multiline
            minRows={6}
            inputProps={{ 'data-testid': 'broadcast-body' }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={send.isPending || subject.trim().length === 0 || body.trim().length === 0}
            data-testid="broadcast-send"
            sx={{ alignSelf: 'flex-start' }}
          >
            {send.isPending ? 'Sending…' : 'Send to organization'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>
        Recent sends
      </Typography>
      {list.isPending ? <Skeleton variant="rounded" height={120} /> : null}
      {list.error ? <Alert severity="error">{list.error.message}</Alert> : null}
      {list.data?.broadcasts.length === 0 ? <Alert severity="info">No broadcasts yet.</Alert> : null}
      <Box sx={{ display: 'grid', gap: 1 }} data-testid="broadcast-list">
        {list.data?.broadcasts.map((row) => (
          <Box
            key={row.id}
            sx={{ border: `1px solid ${workbench.line}`, bgcolor: workbench.mist, px: 1.5, py: 1.25 }}
          >
            <Typography sx={{ fontWeight: 700 }}>{row.subject}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
              {row.createdByName} · {row.recipientCount} recipients
              {row.sentAt ? ` · ${new Date(row.sentAt).toLocaleString()}` : ''}
            </Typography>
            <Typography sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>{row.body}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
