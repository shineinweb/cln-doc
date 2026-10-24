import { Alert, Box, Button, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import {
  emailBroadcastInputSchema,
  emailBroadcastListSchema,
  emailBroadcastSchema,
  emailTemplatePreviewInputSchema,
  emailTemplatePreviewSchema,
  type EmailBroadcast,
  type EmailTemplateKind,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { workbench } from '../theme';

const TEMPLATE_COPY: Record<
  EmailTemplateKind,
  { label: string; blurb: string }
> = {
  marketing: {
    label: 'Marketing',
    blurb: 'Branded announcement wrapper for org-wide sends from this page.',
  },
  password_reset: {
    label: 'Password reset',
    blurb: 'Transactional security email with a one-hour reset button.',
  },
  task_assigned: {
    label: 'Task notification',
    blurb: 'Assignment alert with task details and an Open Tasks CTA.',
  },
};

export function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<EmailTemplateKind>('marketing');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
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
  const preview = useMutation({
    mutationFn: (input: { template: EmailTemplateKind; subject?: string; body?: string }) =>
      apiSend(
        '/communications/preview',
        emailTemplatePreviewSchema,
        emailTemplatePreviewInputSchema.parse(input),
      ),
    onSuccess: (result) => {
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    },
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      preview.mutate({
        template: previewKind,
        subject: previewKind === 'marketing' ? subject || undefined : undefined,
        body: previewKind === 'marketing' ? body || undefined : undefined,
      });
    }, 280);
    return () => window.clearTimeout(handle);
    // preview.mutate identity is stable enough for this page; avoid looping on mutation object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKind, subject, body]);

  return (
    <Box data-testid="communications-page">
      <PageHeader
        kicker="Email"
        title="Marketing & announcements"
        lede="Compose with the Serenity branded template. Password reset and task notification mail use matching custom templates on the same delivery path."
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
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          mb: 3,
          alignItems: 'start',
        }}
      >
        <Box
          sx={{
            border: `1px solid ${workbench.line}`,
            bgcolor: workbench.paper,
            borderRadius: 2,
            p: 2,
          }}
        >
          <Stack
            spacing={2}
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(null);
              send.mutate();
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>Compose announcement</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
              Live sends use the Marketing branded HTML template. Recipients with email notifications off are skipped.
            </Typography>
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
              minRows={8}
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

        <Box
          sx={{
            border: `1px solid ${workbench.line}`,
            bgcolor: workbench.paper,
            borderRadius: 2,
            p: 2,
          }}
          data-testid="email-template-preview"
        >
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Custom email templates</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 1.5 }}>
            Preview the branded layouts used for marketing, password reset, and task notifications.
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={previewKind}
            onChange={(_, value: EmailTemplateKind | null) => {
              if (value) {
                setPreviewKind(value);
              }
            }}
            sx={{ mb: 1.5, flexWrap: 'wrap' }}
          >
            {(Object.keys(TEMPLATE_COPY) as EmailTemplateKind[]).map((kind) => (
              <ToggleButton key={kind} value={kind} data-testid={`template-tab-${kind}`}>
                {TEMPLATE_COPY[kind].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
            {TEMPLATE_COPY[previewKind].blurb}
            {previewSubject ? ` · Subject: ${previewSubject}` : ''}
          </Typography>
          {preview.error ? <Alert severity="error" sx={{ mb: 1 }}>{preview.error.message}</Alert> : null}
          {preview.isPending && !previewHtml ? <Skeleton variant="rounded" height={360} /> : null}
          {previewHtml ? (
            <Box
              component="iframe"
              title="Email template preview"
              srcDoc={previewHtml}
              sx={{
                width: '100%',
                height: 420,
                border: `1px solid ${workbench.line}`,
                borderRadius: 1.5,
                bgcolor: workbench.canvas,
              }}
              data-testid="email-template-iframe"
            />
          ) : null}
        </Box>
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
              {' · Marketing template'}
            </Typography>
            <Typography sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>{row.body}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
