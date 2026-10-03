import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material';
import {
  createSopSchema,
  createTeamSchema,
  createWorkflowTemplateSchema,
  sopSummarySchema,
  teamSummarySchema,
  workflowDirectorySchema,
  workflowTemplateViewSchema,
  type CreateWorkflowTemplate,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';

const emptyTask = {
  taskKey: 'scout',
  title: '',
  offsetDays: 0,
  assigneeType: 'role' as const,
  teamId: null,
  roleId: null,
  userId: null,
  instructions: '',
  checklist: ['Look', 'Record'],
  sopRecordId: null,
  requiresNotes: true,
  requiresMeasurement: false,
  requiresPhoto: false,
  requiresSignOff: false,
  dependsOnKey: null,
  requiresApproval: false,
};

export function WorkflowsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const directory = useQuery({
    queryKey: ['workflow-directory'],
    queryFn: () => apiGet('/workflows/directory', workflowDirectorySchema),
  });

  const form = useForm<CreateWorkflowTemplate>({
    resolver: zodResolver(createWorkflowTemplateSchema),
    defaultValues: {
      name: '',
      cultivar: '',
      medium: '',
      durationDays: 28,
      startingEvent: 'cycle_start',
      tasks: [emptyTask],
    },
  });

  useEffect(() => {
    form.setValue('tasks.0.checklist', ['Look', 'Record']);
    form.setValue('tasks.0.requiresNotes', true);
    form.setValue('tasks.0.requiresMeasurement', false);
    form.setValue('tasks.0.requiresPhoto', false);
    form.setValue('tasks.0.requiresSignOff', false);
    form.setValue('tasks.0.requiresApproval', false);
  }, [form]);

  const createTemplate = useMutation({
    mutationFn: (values: CreateWorkflowTemplate) => apiSend('/workflows/templates', workflowTemplateViewSchema, values),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['workflow-directory'] });
    },
  });

  if (directory.isPending) {
    return <Typography>Loading workflows…</Typography>;
  }
  if (directory.error || !directory.data) {
    return <Alert severity="error">{directory.error?.message ?? 'Workflows could not be loaded.'}</Alert>;
  }

  const data = directory.data;
  const task = form.watch('tasks.0');

  return (
    <Box>
      <PageHeader
        kicker="Templates"
        title="Workflows"
        lede="A template is applied when a cycle starts. Editing it creates a new version and leaves existing cycles on the version they already have."
      />
      {data.templates.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No workflow templates yet.
        </Alert>
      ) : (
        data.templates.map((template) => (
          <Card key={template.id} sx={{ mb: 2 }} data-testid="workflow-template">
            <CardContent>
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                {template.name}
              </Typography>
              <Typography sx={{ color: 'text.secondary', mb: 1 }} data-testid="workflow-version">
                Version {template.currentVersion.versionNumber} of {template.versionCount} · {template.currentVersion.durationDays} days · starts at {template.currentVersion.startingEvent}
                {template.cultivar ? ` · Cultivar ${template.cultivar}` : ''}
                {template.medium ? ` · Medium ${template.medium}` : ''}
              </Typography>
              {template.currentVersion.tasks.map((item) => (
                <Typography key={item.id}>
                  Day {item.offsetDays + 1} · {item.title} · {item.assigneeLabel}
                  {item.dependsOnKey ? ` · after ${item.dependsOnKey}` : ''}
                  {item.requiresApproval ? ' · approval' : ''}
                </Typography>
              ))}
            </CardContent>
          </Card>
        ))
      )}
      {user?.isOrgAdmin ? (
        <Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
          <SopForm />
          <TeamForm employees={data.employees} />
          <Card>
            <CardContent>
              <Typography variant="h3" sx={{ fontSize: 24, mb: 2 }}>
                New template
              </Typography>
              <Box
                component="form"
                onSubmit={form.handleSubmit((values) => createTemplate.mutate(values))}
                sx={{ display: 'grid', gap: 2 }}
              >
                <TextField label="Template name" {...form.register('name')} />
                <TextField label="Cultivar" helperText="Leave blank when this template is not for one cultivar." {...form.register('cultivar')} />
                <TextField label="Medium" helperText="Leave blank when this template is not for one medium." {...form.register('medium')} />
                <TextField label="Duration in days" type="number" {...form.register('durationDays', { valueAsNumber: true })} />
                <TextField label="Starting event" helperText="Use cycle_start, or the title of a timeline event." {...form.register('startingEvent')} />
                <TextField label="Task key" {...form.register('tasks.0.taskKey')} />
                <TextField label="Task title" {...form.register('tasks.0.title')} />
                <TextField label="Days after the starting event" type="number" {...form.register('tasks.0.offsetDays', { valueAsNumber: true })} />
                <TextField label="Instructions" multiline minRows={2} {...form.register('tasks.0.instructions')} />
                <TextField
                  select
                  label="Assign to"
                  value={task?.assigneeType ?? 'role'}
                  onChange={(event) => form.setValue('tasks.0.assigneeType', event.target.value as CreateWorkflowTemplate['tasks'][number]['assigneeType'])}
                >
                  <MenuItem value="role">Role</MenuItem>
                  <MenuItem value="team">Team</MenuItem>
                  <MenuItem value="employee">Employee</MenuItem>
                </TextField>
                {task?.assigneeType === 'role' ? (
                  <TextField select label="Role" value={task.roleId ?? ''} onChange={(event) => form.setValue('tasks.0.roleId', event.target.value)}>
                    {data.roles.map((role) => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
                {task?.assigneeType === 'team' ? (
                  <TextField select label="Team" value={task.teamId ?? ''} onChange={(event) => form.setValue('tasks.0.teamId', event.target.value)}>
                    {data.teams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
                {task?.assigneeType === 'employee' ? (
                  <TextField select label="Employee" value={task.userId ?? ''} onChange={(event) => form.setValue('tasks.0.userId', event.target.value)}>
                    {data.employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
                <TextField
                  select
                  label="Linked SOP"
                  value={task?.sopRecordId ?? ''}
                  onChange={(event) => form.setValue('tasks.0.sopRecordId', event.target.value || null)}
                >
                  <MenuItem value="">None</MenuItem>
                  {data.sops.map((sop) => (
                    <MenuItem key={sop.id} value={sop.id}>
                      {sop.title}
                    </MenuItem>
                  ))}
                </TextField>
                {createTemplate.error ? <Alert severity="error">{createTemplate.error.message}</Alert> : null}
                <Button type="submit" variant="contained" disabled={createTemplate.isPending}>
                  Save template
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Typography sx={{ color: 'text.secondary' }}>Managers create templates. You can still work the assignments they generate.</Typography>
      )}
    </Box>
  );
}

function SopForm() {
  const queryClient = useQueryClient();
  const form = useForm<{ title: string; summary: string }>({
    resolver: zodResolver(createSopSchema),
    defaultValues: { title: '', summary: '' },
  });
  const save = useMutation({
    mutationFn: (values: { title: string; summary: string }) => apiSend('/workflows/sops', sopSummarySchema, values),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['workflow-directory'] });
    },
  });
  return (
    <Card>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          SOP record
        </Typography>
        <Box component="form" onSubmit={form.handleSubmit((values) => save.mutate(values))} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Title" {...form.register('title')} />
          <TextField label="Summary" multiline minRows={2} {...form.register('summary')} />
          <Button type="submit" disabled={save.isPending}>
            Save SOP
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function TeamForm({ employees }: { employees: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const form = useForm<{ name: string; memberIds: string[] }>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '', memberIds: [] },
  });
  const save = useMutation({
    mutationFn: (values: { name: string; memberIds: string[] }) => apiSend('/workflows/teams', teamSummarySchema, values),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['workflow-directory'] });
    },
  });
  const memberId = form.watch('memberIds')[0] ?? '';
  return (
    <Card>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Team
        </Typography>
        <Box component="form" onSubmit={form.handleSubmit((values) => save.mutate(values))} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Team name" {...form.register('name')} />
          <TextField select label="Member" value={memberId} onChange={(event) => form.setValue('memberIds', [event.target.value])}>
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.name}
              </MenuItem>
            ))}
          </TextField>
          {save.error ? <Alert severity="error">{save.error.message}</Alert> : null}
          <Button type="submit" disabled={save.isPending}>
            Save team
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
