import { Alert, Box, Skeleton, TextField, Typography } from '@mui/material';
import { recordRemovedSchema, workspaceTodaySchema, type CycleTaskDetail } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatCalendarDate } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { AssignmentCard } from '../tasks/AssignmentCard';

export function WorkspacePage() {
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => apiGet('/workspace/today', workspaceTodaySchema),
  });

  if (workspace.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (workspace.error || !workspace.data) {
    return <Alert severity="error">{workspace.error?.message ?? 'Assignments could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Today"
        title="Employee workspace"
        lede={`Assignments due ${formatCalendarDate(workspace.data.date)}. Tasks from another facility stay off this list.`}
      />
      {workspace.data.notices.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5, mb: 3 }} data-testid="workspace-notices">
          {workspace.data.notices.map((notice) => (
            <Alert key={notice.alertId} severity="warning" data-testid="workspace-notice">
              {`${notice.siteName} · ${notice.roomName}. ${notice.message} Task: ${notice.taskTitle}.`}
              {notice.sopTitle ? ` Procedure: ${notice.sopTitle}.` : ''}
            </Alert>
          ))}
        </Box>
      ) : null}
      <PagedList
        items={workspace.data.tasks}
        empty="Nothing is assigned to you today."
        testId="workspace-list"
        render={(task) => <WorkspaceRow key={task.id} task={task} />}
      />
    </Box>
  );
}

function WorkspaceRow({ task }: { task: CycleTaskDetail }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workspace'] });
  const save = useMutation({
    mutationFn: (body: { title: string; dueOn: string }) => apiSend(`/tasks/${task.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      summary={
        <Typography>
          <RouterLink to={`/tasks/${task.id}`}>{task.title}</RouterLink>
          {` · ${task.roomName} · ${formatCalendarDate(task.dueOn)}`}
        </Typography>
      }
      detail={<AssignmentCard task={task} />}
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
          <TextField label="Title" name="title" defaultValue={task.title} required />
          <TextField label="Due" name="dueOn" type="date" defaultValue={task.dueOn} required InputLabelProps={{ shrink: true }} />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}
