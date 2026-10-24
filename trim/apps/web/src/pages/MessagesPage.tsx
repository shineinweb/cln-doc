import {
  Alert,
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  messageDirectorySchema,
  messageThreadDetailSchema,
  messageThreadListSchema,
  type MessageDirectoryPerson,
  type MessageThreadSummary,
  type MessageView,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { workbench } from '../theme';

export function MessagesPage() {
  const { user } = useAuth();
  const { siteId } = useSites();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threads = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: () => apiGet('/messages/threads', messageThreadListSchema),
  });
  const directory = useQuery({
    queryKey: ['messages', 'directory'],
    queryFn: () => apiGet('/messages/directory', messageDirectorySchema),
    enabled: peopleOpen,
  });
  const thread = useQuery({
    queryKey: ['messages', 'thread', selectedId],
    queryFn: () => apiGet(`/messages/threads/${selectedId}`, messageThreadDetailSchema),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.data?.messages.length, selectedId]);

  const openDirect = useMutation({
    mutationFn: (peerUserId: string) =>
      apiSend('/messages/threads/direct', messageThreadDetailSchema, { peerUserId }),
    onSuccess: (detail) => {
      setSelectedId(detail.id);
      setPeopleOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
      queryClient.setQueryData(['messages', 'thread', detail.id], detail);
    },
  });

  const openAi = useMutation({
    mutationFn: () => apiSend('/messages/threads/ai', messageThreadDetailSchema, { siteId }),
    onSuccess: (detail) => {
      setSelectedId(detail.id);
      void queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
      queryClient.setQueryData(['messages', 'thread', detail.id], detail);
    },
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      apiSend(`/messages/threads/${selectedId}/messages`, messageThreadDetailSchema, { body }),
    onSuccess: (detail) => {
      setDraft('');
      queryClient.setQueryData(['messages', 'thread', detail.id], detail);
      void queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
    },
  });

  const orderedThreads = useMemo(
    () => threads.data?.threads ?? [],
    [threads.data?.threads],
  );

  function submitDraft() {
    const body = draft.trim();
    if (!body || !selectedId || send.isPending) {
      return;
    }
    send.mutate(body);
  }

  const active = thread.data;
  const error =
    threads.error ??
    directory.error ??
    thread.error ??
    openDirect.error ??
    openAi.error ??
    send.error;

  return (
    <Box data-testid="messages-page">
      <PageHeader
        kicker="Messages"
        title="Internal messages and Serenity"
        lede="Message people in your organization, or keep a saved Serenity thread that can generate room tasks, worker training, and learn notes for the facility in the top bar."
      />
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof ApiError ? error.message : error.message}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
          gap: 2,
          minHeight: { md: 560 },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            border: `1px solid ${workbench.line}`,
            bgcolor: workbench.paper,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 420,
          }}
        >
          <Box sx={{ p: 1.5, display: 'grid', gap: 1, borderBottom: `1px solid ${workbench.line}` }}>
            <Button
              variant="contained"
              data-testid="messages-open-ai"
              onClick={() => openAi.mutate()}
              disabled={openAi.isPending}
            >
              Chat with Serenity
            </Button>
            <Button
              variant="outlined"
              data-testid="messages-new"
              onClick={() => setPeopleOpen((value) => !value)}
            >
              {peopleOpen ? 'Hide people' : 'Message a person'}
            </Button>
          </Box>
          {peopleOpen ? (
            <Box sx={{ borderBottom: `1px solid ${workbench.line}`, maxHeight: 220, overflowY: 'auto' }}>
              {directory.isPending ? (
                <Typography sx={{ p: 1.5, color: 'text.secondary' }}>Loading people.</Typography>
              ) : null}
              <List dense disablePadding data-testid="messages-directory">
                {(directory.data?.people ?? []).map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    pending={openDirect.isPending}
                    onSelect={() => openDirect.mutate(person.id)}
                  />
                ))}
              </List>
              {directory.data && directory.data.people.length === 0 ? (
                <Typography sx={{ p: 1.5, color: 'text.secondary' }}>No other people yet.</Typography>
              ) : null}
            </Box>
          ) : null}
          <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }} data-testid="messages-thread-list">
            {threads.isPending ? (
              <Typography sx={{ p: 1.5, color: 'text.secondary' }}>Loading conversations.</Typography>
            ) : null}
            {orderedThreads.map((item) => (
              <ThreadRow
                key={item.id}
                thread={item}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
            {!threads.isPending && orderedThreads.length === 0 ? (
              <Typography sx={{ p: 1.5, color: 'text.secondary' }}>
                No conversations yet. Message a person or open Serenity.
              </Typography>
            ) : null}
          </List>
        </Box>

        <Box
          sx={{
            border: `1px solid ${workbench.line}`,
            bgcolor: workbench.paper,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 420,
          }}
          data-testid="messages-pane"
        >
          {!selectedId ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: 28, mb: 1 }}>
                Choose a conversation
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                Direct messages stay inside your organization. Serenity remembers this chat and uses the
                facility in the top bar for tasks and training.
              </Typography>
            </Box>
          ) : thread.isPending && !active ? (
            <Typography sx={{ p: 2, color: 'text.secondary' }}>Loading conversation.</Typography>
          ) : active ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${workbench.line}` }}>
                <Typography variant="h2" sx={{ fontSize: 24 }} data-testid="messages-thread-title">
                  {active.title}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                  {active.kind === 'ai'
                    ? 'Saved Serenity chat for this account'
                    : `Direct message${active.peerName ? ` with ${active.peerName}` : ''}`}
                </Typography>
              </Box>
              <Box
                data-testid="messages-transcript"
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 1.25,
                  alignContent: 'start',
                  px: 2,
                  py: 2,
                  bgcolor: 'rgba(16, 14, 28, 0.55)',
                }}
              >
                {active.messages.map((message) => (
                  <Bubble key={message.id} message={message} selfId={user?.id ?? null} />
                ))}
                <div ref={bottomRef} />
              </Box>
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitDraft();
                }}
                sx={{
                  display: 'flex',
                  gap: 1,
                  p: 1.5,
                  borderTop: `1px solid ${workbench.line}`,
                  alignItems: 'flex-end',
                }}
              >
                <TextField
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={4}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={active.kind === 'ai' ? 'Ask Serenity…' : 'Write a message…'}
                  data-testid="messages-draft"
                  disabled={send.isPending}
                />
                <Button
                  type="submit"
                  variant="contained"
                  data-testid="messages-send"
                  disabled={!draft.trim() || send.isPending}
                >
                  Send
                </Button>
              </Box>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function PersonRow({
  person,
  pending,
  onSelect,
}: {
  person: MessageDirectoryPerson;
  pending: boolean;
  onSelect: () => void;
}) {
  return (
    <ListItemButton onClick={onSelect} disabled={pending} data-testid={`messages-person-${person.id}`}>
      <ListItemText primary={person.name} secondary={person.email} />
    </ListItemButton>
  );
}

function ThreadRow({
  thread,
  selected,
  onSelect,
}: {
  thread: MessageThreadSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onSelect}
      data-testid={`messages-thread-${thread.id}`}
      sx={{ alignItems: 'flex-start' }}
    >
      <ListItemText
        primary={thread.title}
        secondary={thread.lastMessage ?? (thread.kind === 'ai' ? 'Serenity' : 'Direct message')}
        primaryTypographyProps={{ noWrap: true }}
        secondaryTypographyProps={{ noWrap: true }}
      />
    </ListItemButton>
  );
}

function Bubble({ message, selfId }: { message: MessageView; selfId: string | null }) {
  const mine = message.kind === 'user' && message.authorId === selfId;
  const system = message.kind === 'system';
  const assistant = message.kind === 'assistant';
  return (
    <Box
      data-testid={`messages-bubble-${message.kind}`}
      sx={{
        justifySelf: mine ? 'end' : 'start',
        maxWidth: '85%',
        px: 1.5,
        py: 1,
        border: `1px solid ${workbench.line}`,
        bgcolor: mine
          ? 'rgba(255, 79, 139, 0.16)'
          : assistant
            ? 'rgba(61, 220, 255, 0.1)'
            : system
              ? 'transparent'
              : workbench.mist,
        color: system ? 'text.secondary' : 'text.primary',
        whiteSpace: 'pre-wrap',
      }}
    >
      {!system ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.35 }}>{message.authorName}</Typography>
      ) : null}
      <Typography sx={{ fontSize: 15, lineHeight: 1.45 }}>{message.body}</Typography>
    </Box>
  );
}
