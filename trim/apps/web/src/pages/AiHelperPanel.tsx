import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import {
  coachChatResponseSchema,
  type CoachChatAction,
  type CoachChatResponse,
  type CoachHelper,
} from '@trim/contracts';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiSend } from '../api/client';
import { workbench } from '../theme';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: CoachChatAction[];
  suggestions?: string[];
};

const STARTER: ChatMessage = {
  id: 'starter',
  role: 'assistant',
  content:
    'I am the AI helper for this facility. I generate room tasks from stored procedures, assign worker training, and quote procedures when you ask.',
  suggestions: [
    'Generate tasks from stored procedures',
    'Train workers on Canopy scout',
    'How do I check irrigation?',
  ],
};

export function AiHelperPanel({ siteId, helper }: { siteId: string; helper: CoachHelper }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const chat = useMutation({
    mutationFn: ({ message, history }: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
      apiSend(`/sites/${siteId}/coach/chat`, coachChatResponseSchema, { message, history }),
    onSuccess: (result) => {
      setMessages((current) => [...current, toAssistantMessage(result)]);
    },
  });

  function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || chat.isPending) {
      return;
    }
    const history = messages
      .filter((item) => item.id !== 'starter')
      .slice(-12)
      .map((item) => ({ role: item.role, content: item.content }));
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: trimmed }]);
    setDraft('');
    chat.mutate({ message: trimmed, history });
  }

  return (
    <Box data-testid="ai-helper">
      <Typography variant="h2" sx={{ fontSize: 28, mb: 0.5 }}>
        AI helper
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
        Chat to generate tasks, train workers, or quote a stored procedure. {helper.sops.length} procedures,{' '}
        {helper.people.length} people, and {helper.rooms.length} rooms are in scope for this facility. Saved chats with
        people and Trim AI also live under{' '}
        <Button size="small" variant="text" component={RouterLink} to="/messages" sx={{ px: 0.5, minWidth: 0, verticalAlign: 'baseline' }}>
          Messages
        </Button>
        .
      </Typography>
      <Card
        sx={{
          backgroundImage: 'none',
          bgcolor: workbench.paper,
          border: `1px solid ${workbench.line}`,
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Box
            data-testid="ai-helper-transcript"
            sx={{
              display: 'grid',
              gap: 1.25,
              maxHeight: 420,
              overflowY: 'auto',
              px: 2,
              py: 2,
              bgcolor: 'rgba(16, 14, 28, 0.55)',
            }}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onSuggest={send} pending={chat.isPending} />
            ))}
            <div ref={bottomRef} />
          </Box>
          <Box
            component="form"
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
              alignItems: 'start',
              px: 2,
              py: 1.5,
              borderTop: `1px solid ${workbench.line}`,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <TextField
              label="Message the AI helper"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              inputProps={{ 'data-testid': 'ai-helper-input' }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={chat.isPending || draft.trim().length === 0}
              data-testid="ai-helper-send"
              sx={{ minWidth: 108, justifySelf: { sm: 'stretch' } }}
            >
              Send
            </Button>
          </Box>
          {chat.error ? (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              {chat.error.message}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
        <Button
          size="small"
          variant="outlined"
          data-testid="ai-helper-generate-tasks"
          disabled={chat.isPending}
          onClick={() => send('Generate tasks from stored procedures')}
        >
          Generate tasks
        </Button>
        <Button
          size="small"
          variant="outlined"
          data-testid="ai-helper-train-workers"
          disabled={chat.isPending}
          onClick={() => send('Train workers on Canopy scout')}
        >
          Train workers
        </Button>
        <Button size="small" variant="text" component={RouterLink} to="/operations/training">
          Open training
        </Button>
      </Box>
    </Box>
  );
}

function MessageBubble({
  message,
  onSuggest,
  pending,
}: {
  message: ChatMessage;
  onSuggest: (value: string) => void;
  pending: boolean;
}) {
  const mine = message.role === 'user';
  return (
    <Box
      data-testid={mine ? 'ai-helper-user-message' : 'ai-helper-assistant-message'}
      sx={{
        justifySelf: mine ? 'end' : 'start',
        maxWidth: { xs: '92%', sm: '80%' },
        display: 'grid',
        gap: 1,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1.1,
          borderRadius: 3,
          bgcolor: mine ? 'rgba(255, 79, 139, 0.22)' : workbench.mist,
          border: `1px solid ${mine ? 'rgba(255, 79, 139, 0.45)' : workbench.line}`,
        }}
      >
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
      </Box>
      {message.actions && message.actions.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          {message.actions.map((action) => (
            <ActionCard key={actionKey(action)} action={action} />
          ))}
        </Box>
      ) : null}
      {message.suggestions && message.suggestions.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {message.suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              size="small"
              variant="outlined"
              disabled={pending}
              onClick={() => onSuggest(suggestion)}
              data-testid="ai-helper-suggestion"
            >
              {suggestion}
            </Button>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function ActionCard({ action }: { action: CoachChatAction }) {
  if (action.type === 'task') {
    return (
      <Box
        data-testid="ai-helper-task-action"
        sx={{
          px: 1.25,
          py: 1,
          borderRadius: 2,
          border: `1px solid ${workbench.line}`,
          bgcolor: 'rgba(61, 220, 255, 0.08)',
        }}
      >
        <Typography sx={{ fontWeight: 700 }}>Task · {action.title}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          <RouterLink to={`/rooms/${action.roomId}`}>{action.roomName}</RouterLink>
          {action.sopTitle ? ` · ${action.sopTitle}` : ''}
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      data-testid="ai-helper-training-action"
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 2,
        border: `1px solid ${workbench.line}`,
        bgcolor: 'rgba(139, 108, 255, 0.12)',
      }}
    >
      <Typography sx={{ fontWeight: 700 }}>Training · {action.traineeName}</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
        {action.title}
        {action.sopTitle ? ` · ${action.sopTitle}` : ''}
      </Typography>
    </Box>
  );
}

function toAssistantMessage(result: CoachChatResponse): ChatMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: result.reply,
    actions: result.actions,
    suggestions: result.suggestions,
  };
}

function actionKey(action: CoachChatAction): string {
  return action.type === 'task' ? `task-${action.taskId}` : `training-${action.trainingId}`;
}
