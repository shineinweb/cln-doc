import { Alert, Box, Skeleton, TextField } from '@mui/material';
import { cycleTaskDetailSchema, recordRemovedSchema } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { RecordActions, SaveChanges } from '../records/RecordControls';
import { AssignmentCard } from '../tasks/AssignmentCard';

export function TaskPage() {
  const { taskId = '' } = useParams();
  const queryClient = useQueryClient();
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiGet(`/tasks/${taskId}`, cycleTaskDetailSchema),
    enabled: Boolean(taskId),
    retry: false,
  });

  if (task.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (task.error instanceof ApiError && (task.error.status === 403 || task.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="task-access-warning">
        {task.error.status === 403 ? 'You do not have access to this assignment.' : 'This assignment was not found.'}
      </Alert>
    );
  }
  if (task.error || !task.data) {
    return <Alert severity="error">{task.error?.message ?? 'This assignment could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader kicker={task.data.siteName} title={task.data.title} lede={task.data.roomName} />
      <TaskEditor taskId={task.data.id} title={task.data.title} dueOn={task.data.dueOn} onChanged={() => queryClient.invalidateQueries({ queryKey: ['task', taskId] })} />
      <AssignmentCard task={task.data} />
    </Box>
  );
}

function TaskEditor({
  taskId,
  title,
  dueOn,
  onChanged,
}: {
  taskId: string;
  title: string;
  dueOn: string;
  onChanged: () => void;
}) {
  const save = useMutation({
    mutationFn: (body: { title: string; dueOn: string }) => apiSend(`/tasks/${taskId}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/tasks/${taskId}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: onChanged,
  });
  return (
    <RecordActions
      summary={<Alert severity="info" sx={{ py: 0 }}>Open View to work this assignment. Edit changes the title and due date.</Alert>}
      detail={null}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({ title: String(form.get('title') ?? ''), dueOn: String(form.get('dueOn') ?? '') });
          }}
        >
          <TextField label="Title" name="title" defaultValue={title} required />
          <TextField label="Due" name="dueOn" type="date" defaultValue={dueOn} required InputLabelProps={{ shrink: true }} />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}
