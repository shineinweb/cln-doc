import { Alert, Box, Skeleton, TextField, Typography } from '@mui/material';
import {
  recordRemovedSchema,
  workspaceTodaySchema,
  type CycleTaskDetail,
  type WorkspaceDuty,
  type WorkspaceRoomTask,
  type WorkspaceToday,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatCalendarDate } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { AssignmentCard } from '../tasks/AssignmentCard';
import { workbench } from '../theme';

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

  const data = workspace.data;
  const total = data.tasks.length + data.roomTasks.length + data.duties.length;

  return (
    <Box data-testid="workspace-tasks">
      <PageHeader
        kicker="Tasks"
        title="All tasks due today"
        lede={`Crop-cycle work, room chores, and Operations recurring duties due ${formatCalendarDate(data.date)}. Training stays under Operations → Training.`}
      />
      {data.notices.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5, mb: 3 }} data-testid="workspace-notices">
          {data.notices.map((notice) => (
            <Alert key={notice.alertId} severity="warning" data-testid="workspace-notice">
              {`${notice.siteName} · ${notice.roomName}. ${notice.message} Task: ${notice.taskTitle}.`}
              {notice.sopTitle ? ` Procedure: ${notice.sopTitle}.` : ''}{' '}
              <RouterLink to={`/rooms/${notice.roomId}`}>Open room</RouterLink>
            </Alert>
          ))}
        </Box>
      ) : null}

      <Section
        title="Crop cycle tasks"
        count={data.tasks.length}
        testId="workspace-cycle-section"
        empty="No crop-cycle assignments due today."
      >
        <PagedList
          items={data.tasks}
          empty="No crop-cycle assignments due today."
          testId="workspace-list"
          render={(task) => <WorkspaceRow key={task.id} task={task} />}
        />
      </Section>

      <Section
        title="Room tasks"
        count={data.roomTasks.length}
        testId="workspace-room-section"
        empty="No room chores assigned to you today."
      >
        <Box sx={{ display: 'grid', gap: 1 }} data-testid="workspace-room-list">
          {data.roomTasks.map((task) => (
            <RoomTaskRow key={task.id} task={task} />
          ))}
        </Box>
      </Section>

      <Section
        title="Recurring duties"
        count={data.duties.length}
        testId="workspace-duty-section"
        empty="No Operations recurring duties are due."
      >
        <Box sx={{ display: 'grid', gap: 1 }} data-testid="workspace-duty-list">
          {data.duties.map((duty) => (
            <DutyRow key={duty.id} duty={duty} />
          ))}
        </Box>
      </Section>

      {total === 0 ? (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="workspace-empty">
          Nothing is due for you today across crop cycles, room chores, or recurring duties.
        </Alert>
      ) : null}
    </Box>
  );
}

function Section({
  title,
  count,
  testId,
  empty,
  children,
}: {
  title: string;
  count: number;
  testId: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <Box data-testid={testId} sx={{ mb: 3 }}>
      <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>
        {title}
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 16, ml: 1 }}>
          {count}
        </Typography>
      </Typography>
      {count === 0 ? <Alert severity="info">{empty}</Alert> : children}
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
          <KindChip label="Cycle" />
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

function RoomTaskRow({ task }: { task: WorkspaceRoomTask }) {
  return (
    <Box
      data-testid={`workspace-room-task-${task.id}`}
      sx={{ border: `1px solid ${workbench.line}`, bgcolor: workbench.paper, px: 1.5, py: 1.25 }}
    >
      <Typography>
        <KindChip label="Room" />
        <RouterLink to={`/rooms/${task.roomId}`}>{task.title}</RouterLink>
        {` · ${task.siteName} · ${task.roomName}`}
        {task.dueOn ? ` · ${formatCalendarDate(task.dueOn)}` : task.kind === 'recurring' ? ` · ${task.cadence ?? 'recurring'}` : ''}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.35 }}>
        {task.source === 'alert' ? 'Alert follow-up' : task.source === 'ai' ? 'From AI / stored procedure' : 'Room chore'}
        {task.assignees.length > 0 ? ` · ${task.assignees.map((person) => person.name).join(', ')}` : ''}
      </Typography>
      {task.description ? (
        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{task.description}</Typography>
      ) : null}
    </Box>
  );
}

function DutyRow({ duty }: { duty: WorkspaceDuty }) {
  return (
    <Box
      data-testid={`workspace-duty-${duty.id}`}
      sx={{ border: `1px solid ${workbench.line}`, bgcolor: workbench.paper, px: 1.5, py: 1.25 }}
    >
      <Typography>
        <KindChip label="Duty" />
        <RouterLink to="/operations/recurring">{duty.title}</RouterLink>
        {` · ${duty.siteName}`}
        {duty.roomName ? ` · ${duty.roomName}` : ''}
        {` · next ${formatCalendarDate(duty.nextDueOn)}`}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.35 }}>
        {duty.cadence} · {duty.assigneeLabel}
        {duty.sopTitle ? ` · ${duty.sopTitle}` : ''}
      </Typography>
    </Box>
  );
}

function KindChip({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        mr: 1,
        px: 0.75,
        py: 0.15,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: workbench.ink,
        bgcolor: workbench.mist,
        border: `1px solid ${workbench.line}`,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </Box>
  );
}

export function workspaceTaskCount(data: WorkspaceToday): number {
  return data.tasks.length + data.roomTasks.length + data.duties.length;
}
