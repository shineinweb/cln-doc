import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import {
  accessDirectorySchema,
  managedTaskSchema,
  recordRemovedSchema,
  type ManagedTask,
  type ManagedTaskInput,
  type RoomDetail,
  type Weekday,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type HTMLAttributes, type InputHTMLAttributes } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { formatCalendarDate } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { workbench } from '../theme';

type DueTask = RoomDetail['tasksDueToday'][number];

export function RoomTasksPanel({ roomId, siteId, tasksDueToday, managedTasks }: {
  roomId: string;
  siteId: string;
  tasksDueToday: DueTask[];
  managedTasks: ManagedTask[];
}) {
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Card sx={{ bgcolor: workbench.mist }} data-testid="room-tasks">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Tasks
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
            Add a one-time task, a daily task, or a weekly task on chosen days such as Tuesday and Friday. A recurring task has no due date. Description is optional, and you can assign more than one employee.
          </Typography>
          <AddTaskForm roomId={roomId} siteId={siteId} />
          <PagedList
            items={managedTasks}
            empty="No tasks have been added on this room."
            testId="room-task-list"
            render={(task) => <ManagedTaskRow key={task.id} roomId={roomId} siteId={siteId} task={task} />}
          />
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: workbench.mist }} data-testid="tasks-due">
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
            Tasks due today
          </Typography>
          <PagedList
            items={tasksDueToday}
            empty="No tasks are due today."
            render={(task) => <TaskDueRow key={task.id} roomId={roomId} siteId={siteId} task={task} />}
          />
        </CardContent>
      </Card>
    </Box>
  );
}

function AddTaskForm({ roomId, siteId }: { roomId: string; siteId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: ManagedTaskInput) => apiSend(`/rooms/${roomId}/tasks`, managedTaskSchema, body),
    onSuccess: async () => {
      setError(null);
      setMessage('Task added.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'The task could not be saved.');
    },
  });
  return (
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
            Add task
          </Typography>
          <TaskFields
            siteId={siteId}
            initial={{ title: '', description: '', kind: 'one_time', cadence: 'weekly', weekdays: [], dueOn: todayKey(), assigneeIds: [] }}
            pending={save.isPending}
            submitLabel="Add task"
            submitTestId="task-save"
            onSubmit={(body) => save.mutate(body)}
            onCancel={() => setOpen(false)}
          />
          {error ? <Alert sx={{ mt: 1 }} severity="error">{error}</Alert> : null}
        </Box>
      ) : (
        <Button variant="contained" data-testid="add-task" onClick={() => { setMessage(null); setOpen(true); }}>
          Add task
        </Button>
      )}
      {message ? <Alert sx={{ mt: 2 }} data-testid="task-added">{message}</Alert> : null}
    </Box>
  );
}

function ManagedTaskRow({ roomId, siteId, task }: { roomId: string; siteId: string; task: ManagedTask }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['room', roomId] });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: ManagedTaskInput) => apiSend(`/rooms/${roomId}/tasks/${task.id}`, managedTaskSchema, body, 'PATCH'),
    onSuccess: refresh,
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The task could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/rooms/${roomId}/tasks/${task.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The task could not be deleted.'),
  });
  return (
    <Box>
      <RecordActions
        summary={
          <Box>
            <Typography data-testid="room-task-title">{taskLine(task)}</Typography>
            {task.description ? (
              <Typography data-testid="room-task-description" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                {task.description}
              </Typography>
            ) : null}
          </Box>
        }
        detail={
          <Box>
            <Typography>
              {taskSummary(task)}
            </Typography>
            <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{task.description ?? 'No description.'}</Typography>
          </Box>
        }
        editor={
          <TaskFields
            siteId={siteId}
            initial={{
              title: task.title,
              description: task.description ?? '',
              kind: task.kind,
              cadence: task.cadence ?? 'weekly',
              weekdays: task.weekdays,
              dueOn: task.dueOn ?? todayKey(),
              assigneeIds: task.assignees.map((person) => person.id),
            }}
            pending={save.isPending}
            submitLabel="Save changes"
            submitTestId="save-changes"
            onSubmit={(body) => save.mutate(body)}
            onCancel={() => undefined}
          />
        }
        onDelete={() => remove.mutate()}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Box>
  );
}

function TaskDueRow({ roomId, siteId, task }: { roomId: string; siteId: string; task: DueTask }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['room', roomId] });
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const save = useMutation({
    mutationFn: (body: { title: string; dueOn: string; assigneeId?: string | null }) =>
      apiSend(`/tasks/${task.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      summary={
        <Typography data-testid="task-due-today">
          <RouterLink to={`/tasks/${task.id}`}>{task.title}</RouterLink>
          {` · ${task.assigneeLabel} · ${formatCalendarDate(task.dueOn)}`}
        </Typography>
      }
      detail={<Typography>{task.assigneeLabel}</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextAssignee = assigneeId;
            const body: { title: string; dueOn: string; assigneeId?: string | null } = {
              title: String(form.get('title') ?? ''),
              dueOn: String(form.get('dueOn') ?? ''),
            };
            if (nextAssignee !== (task.assigneeId ?? '')) {
              body.assigneeId = nextAssignee || null;
            }
            save.mutate(body);
          }}
        >
          <TextField label="Title" name="title" defaultValue={task.title} required />
          <TextField label="Due" name="dueOn" type="date" defaultValue={task.dueOn} required InputLabelProps={{ shrink: true }} />
          <EmployeeSelect siteId={siteId} value={assigneeId} onChange={setAssigneeId} />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function TaskFields({
  siteId,
  initial,
  pending,
  submitLabel,
  submitTestId,
  onSubmit,
  onCancel,
}: {
  siteId: string;
  initial: { title: string; description: string; kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly'; weekdays: Weekday[]; dueOn: string; assigneeIds: string[] };
  pending?: boolean;
  submitLabel: string;
  submitTestId: string;
  onSubmit: (body: ManagedTaskInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState(initial.kind);
  const [cadence, setCadence] = useState(initial.cadence);
  const [weekdays, setWeekdays] = useState<Weekday[]>(initial.weekdays);
  const [dueOn, setDueOn] = useState(initial.dueOn);
  const [assigneeIds, setAssigneeIds] = useState(initial.assigneeIds);
  const [formError, setFormError] = useState<string | null>(null);
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 480 }}
      onSubmit={(event) => {
        event.preventDefault();
        const selected = WEEKDAYS.filter((day) => weekdays.includes(day.key)).map((day) => day.key);
        if (kind === 'recurring' && cadence === 'weekly' && selected.length === 0) {
          setFormError('Choose at least one day of the week.');
          return;
        }
        setFormError(null);
        onSubmit({
          title,
          description,
          kind,
          cadence: kind === 'recurring' ? cadence : null,
          weekdays: kind === 'recurring' && cadence === 'weekly' ? selected : [],
          dueOn: kind === 'one_time' ? dueOn : null,
          assigneeIds,
        });
      }}
    >
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required inputProps={{ 'data-testid': 'task-title' }} />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        multiline
        minRows={3}
        helperText="Optional."
        inputProps={{ 'data-testid': 'task-description' }}
      />
      <TextField
        select
        label="Schedule"
        value={kind}
        onChange={(event) => setKind(event.target.value as 'one_time' | 'recurring')}
        SelectProps={{ native: true, inputProps: { 'data-testid': 'task-kind' } }}
      >
        <option value="one_time">One time</option>
        <option value="recurring">Recurring</option>
      </TextField>
      {kind === 'recurring' ? (
        <TextField
          select
          label="Repeats"
          value={cadence}
          onChange={(event) => setCadence(event.target.value as 'daily' | 'weekly')}
          SelectProps={{ native: true, inputProps: { 'data-testid': 'task-cadence' } }}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </TextField>
      ) : null}
      {kind === 'recurring' && cadence === 'weekly' ? (
        <Box>
          <Typography sx={{ fontSize: 14, mb: 0.5 }}>Days</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
            {WEEKDAYS.map((day) => (
              <FormControlLabel
                key={day.key}
                control={
                  <Checkbox
                    checked={weekdays.includes(day.key)}
                    onChange={() => {
                      setWeekdays((current) =>
                        current.includes(day.key) ? current.filter((item) => item !== day.key) : [...current, day.key],
                      );
                    }}
                    inputProps={{ 'data-testid': `task-day-${day.key}` } as InputHTMLAttributes<HTMLInputElement>}
                  />
                }
                label={day.label}
              />
            ))}
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            Choose one or more days, such as Tuesday and Friday.
          </Typography>
          {formError ? <Alert sx={{ mt: 1 }} severity="error">{formError}</Alert> : null}
        </Box>
      ) : null}
      {kind === 'one_time' ? (
        <TextField
          label="Due date"
          type="date"
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
          required
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'task-due' }}
        />
      ) : null}
      <EmployeeMultiSelect siteId={siteId} value={assigneeIds} onChange={setAssigneeIds} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" data-testid={submitTestId} disabled={pending}>
          {submitLabel}
        </Button>
        {submitLabel === 'Add task' ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

function EmployeeSelect({ siteId, value, onChange }: { siteId: string; value: string; onChange: (value: string) => void }) {
  const access = useQuery({
    queryKey: ['access'],
    queryFn: () => apiGet('/access', accessDirectorySchema),
  });
  const people = (access.data?.users ?? []).filter((person) => person.opensEveryFacility || person.siteIds.includes(siteId));
  return (
    <TextField
      select
      label="Employee"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      helperText="Optional."
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        displayEmpty: true,
        SelectDisplayProps: { 'data-testid': 'task-assignee' } as HTMLAttributes<HTMLDivElement>,
      }}
    >
      <MenuItem value="">Unassigned</MenuItem>
      {people.map((person) => (
        <MenuItem key={person.id} value={person.id}>
          {person.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

function EmployeeMultiSelect({ siteId, value, onChange }: { siteId: string; value: string[]; onChange: (value: string[]) => void }) {
  const access = useQuery({
    queryKey: ['access'],
    queryFn: () => apiGet('/access', accessDirectorySchema),
  });
  const people = (access.data?.users ?? []).filter((person) => person.opensEveryFacility || person.siteIds.includes(siteId));
  return (
    <TextField
      select
      label="Employees"
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        onChange(typeof next === 'string' ? next.split(',').filter(Boolean) : next);
      }}
      helperText="Optional. Choose one or more."
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        multiple: true,
        displayEmpty: true,
        renderValue: (selected) => {
          const ids = Array.isArray(selected) ? selected.map(String) : [];
          return peopleLabel(people.filter((person) => ids.includes(person.id)));
        },
        SelectDisplayProps: { 'data-testid': 'task-employees' } as HTMLAttributes<HTMLDivElement>,
      }}
    >
      {people.map((person) => (
        <MenuItem key={person.id} value={person.id} data-testid={`task-employee-${person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
          {person.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

function taskLine(task: ManagedTask): string {
  return `${task.title} · ${taskSummary(task)}`;
}

function taskSummary(task: { kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly' | null; weekdays?: Weekday[]; assignees: { name: string }[]; dueOn: string | null }): string {
  const parts = [scheduleLabel(task), peopleLabel(task.assignees)];
  if (task.dueOn) {
    parts.push(formatCalendarDate(task.dueOn));
  }
  return parts.join(' · ');
}

function peopleLabel(people: { name: string }[]): string {
  const names = people.map((person) => person.name);
  if (names.length === 0) {
    return 'Unassigned';
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function scheduleLabel(task: { kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly' | null; weekdays?: Weekday[] }): string {
  if (task.kind === 'recurring' && task.cadence === 'daily') {
    return 'Daily';
  }
  if (task.kind === 'recurring') {
    return weekdayLabel(task.weekdays ?? []);
  }
  return 'One time';
}

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function weekdayLabel(days: Weekday[]): string {
  const names = WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.label);
  if (names.length === 0) {
    return 'Weekly';
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
