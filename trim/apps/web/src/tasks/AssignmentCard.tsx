import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, TextField, Typography } from '@mui/material';
import { cycleTaskDetailSchema, type CycleTaskDetail } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiSend, apiUpload } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { formatCalendarDate } from '../crops/format';
import { TOKEN_KEY } from '../auth/storage';

export function AssignmentCard({ task }: { task: CycleTaskDetail }) {
  const { user } = useAuth();
  const canComplete = can(user, 'tasks.complete', 'tasks.write');
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspace'] });
    await queryClient.invalidateQueries({ queryKey: ['task', task.id] });
  };

  const sendComment = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}/comments`, cycleTaskDetailSchema, { body: comment }),
    onSuccess: async () => {
      setComment('');
      setError(null);
      await refresh();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const toggle = useMutation({
    mutationFn: (input: { itemId: string; checked: boolean }) =>
      apiSend(`/tasks/${task.id}/checklist`, cycleTaskDetailSchema, input),
    onSuccess: refresh,
    onError: (reason: Error) => setError(reason.message),
  });

  const saveNotes = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}/evidence`, cycleTaskDetailSchema, { notes }),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const upload = useMutation({
    mutationFn: (file: File) => apiUpload(`/tasks/${task.id}/attachments`, cycleTaskDetailSchema, file),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const finish = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}/complete`, cycleTaskDetailSchema, {}),
    onSuccess: async () => {
      setError(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['room'] });
      await queryClient.invalidateQueries({ queryKey: ['cycle'] });
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const open = task.status === 'open';

  return (
    <Card data-testid="assignment-card" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.12em' }}>
          {task.siteName} · {task.roomName}
        </Typography>
        <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="assignment-title">
          {task.title}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1 }}>
          {formatCalendarDate(task.dueOn)} · {task.assigneeLabel} · {task.cycleName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {open ? null : <Chip size="small" color="success" label="Finished" data-testid="task-finished-chip" />}
          {task.requiresApproval ? <Chip size="small" label="Supervisor approval" /> : null}
          {task.requiresPhoto ? <Chip size="small" label="Photo" /> : null}
          {task.requiresNotes ? <Chip size="small" label="Notes" /> : null}
          {task.requiresMeasurement ? <Chip size="small" label="Measurement" /> : null}
          {task.requiresSignOff ? <Chip size="small" label="Sign-off" /> : null}
        </Box>
        {open && canComplete ? (
          <Button
            variant="contained"
            color="primary"
            data-testid="finish-task"
            sx={{ mb: 2 }}
            disabled={finish.isPending}
            onClick={() => finish.mutate()}
          >
            {finish.isPending ? 'Finishing…' : 'Finished'}
          </Button>
        ) : null}
        <Typography sx={{ mb: 2 }}>{task.instructions}</Typography>
        {task.dependsOnTitle ? (
          <Typography sx={{ mb: 2, color: 'text.secondary' }}>Depends on {task.dependsOnTitle}.</Typography>
        ) : null}
        {task.sop ? (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>{task.sop.title}</Typography>
            <Typography sx={{ color: 'text.secondary' }}>{task.sop.summary}</Typography>
          </Box>
        ) : null}
        {task.checklist.map((item) => (
          <FormControlLabel
            key={item.id}
            control={
              <Checkbox
                checked={item.checked}
                disabled={!canComplete}
                onChange={(event) => toggle.mutate({ itemId: item.id, checked: event.target.checked })}
              />
            }
            label={item.label}
          />
        ))}
        {error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : null}
        {canComplete ? (
          <>
            <TextField
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
            />
            <Button sx={{ mt: 1 }} onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
              Save notes
            </Button>
            <Box sx={{ mt: 2 }}>
              <Button component="label" variant="outlined">
                Add photo
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  data-testid="task-photo"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      upload.mutate(file);
                    }
                  }}
                />
              </Button>
              {task.attachments.map((file) => (
                <Button key={file.id} sx={{ ml: 1 }} onClick={() => downloadAttachment(task.id, file.id, file.fileName)}>
                  {file.fileName}
                </Button>
              ))}
            </Box>
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Comments</Typography>
              {task.comments.length === 0 ? (
                <Typography sx={{ color: 'text.secondary' }}>No comments yet.</Typography>
              ) : (
                task.comments.map((entry) => (
                  <Typography key={entry.id} sx={{ mb: 1 }}>
                    {entry.authorName}: {entry.body}
                  </Typography>
                ))
              )}
              <TextField
                label="Comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                fullWidth
                sx={{ mt: 1 }}
              />
              <Button sx={{ mt: 1 }} variant="contained" disabled={!comment.trim() || sendComment.isPending} onClick={() => sendComment.mutate()}>
                Add comment
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{ mt: 2 }}>
            {task.attachments.map((file) => (
              <Button key={file.id} sx={{ mr: 1 }} onClick={() => downloadAttachment(task.id, file.id, file.fileName)}>
                {file.fileName}
              </Button>
            ))}
            {task.comments.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>Comments</Typography>
                {task.comments.map((entry) => (
                  <Typography key={entry.id} sx={{ mb: 1 }}>
                    {entry.authorName}: {entry.body}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

async function downloadAttachment(taskId: string, attachmentId: string, fileName: string): Promise<void> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
