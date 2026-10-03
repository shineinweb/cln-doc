import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, TextField, Typography } from '@mui/material';
import { cropCycleDetailSchema, harvestDetailSchema, recordRemovedSchema, reschedulePreviewSchema, rescheduleResultSchema, startedCycleSchema, type ReschedulePreview } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { cycleDayLabel, formatCalendarDate } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { roomTypeLabel } from '../theme';

export function CropCyclePage() {
  const { roomId = '', cycleId = '' } = useParams();
  const { user } = useAuth();
  const { setSiteId } = useSites();
  const cycle = useQuery({
    queryKey: ['cycle', cycleId],
    queryFn: () => apiGet(`/cycles/${cycleId}`, cropCycleDetailSchema),
    enabled: Boolean(cycleId),
    retry: false,
  });

  const setSiteIdRef = useRef(setSiteId);
  setSiteIdRef.current = setSiteId;
  useEffect(() => {
    if (cycle.data) {
      setSiteIdRef.current(cycle.data.siteId, { navigate: false });
    }
  }, [cycle.data]);

  if (cycle.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }

  if (cycle.error instanceof ApiError && (cycle.error.status === 403 || cycle.error.status === 404)) {
    return (
      <Alert severity="warning">
        {cycle.error.status === 403
          ? 'You do not have access to this crop cycle.'
          : 'This crop cycle is not on a facility you can open.'}
      </Alert>
    );
  }

  if (cycle.error || !cycle.data) {
    return <Alert severity="error">{cycle.error?.message ?? 'This crop cycle could not be loaded.'}</Alert>;
  }

  if (cycle.data.roomId !== roomId) {
    return <Alert severity="warning">This crop cycle is not in that room.</Alert>;
  }

  return (
    <Box>
      <Button component={RouterLink} to={`/rooms/${cycle.data.roomId}`} sx={{ px: 0, mb: 1 }}>
        Back to {cycle.data.roomName}
      </Button>
      <PageHeader
        kicker={`${cycle.data.siteName} · ${cycle.data.roomName}`}
        title={cycle.data.name}
        lede={`${cycle.data.cultivar} · ${cycle.data.plantCount} plants · ${roomTypeLabel(cycle.data.stage)} · ${cycleDayLabel(cycle.data.cycleDay)} · harvest ${formatCalendarDate(cycle.data.expectedHarvestDate)}`}
      />
      <Typography data-testid="cycle-plant-count" sx={{ mb: 2 }}>
        {cycle.data.plantCount} plants assigned to this cycle
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={cycle.data.status} />
        <Chip label={cycleDayLabel(cycle.data.cycleDay)} data-testid="cycle-page-day" />
        {cycle.data.workflow ? <Chip label={`${cycle.data.workflow.templateName} v${cycle.data.workflow.versionNumber}`} /> : null}
      </Box>
      {cycle.data.plantCount > 0 ? <HarvestCropButton cycleId={cycle.data.id} /> : null}
      <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
        Generated tasks
      </Typography>
      <TaskList cycleId={cycle.data.id} tasks={cycle.data.tasks} />
      {user?.isOrgAdmin ? <ReschedulePanel cycleId={cycle.data.id} startDate={cycle.data.startDate} workflow={cycle.data.workflow} /> : null}
      <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
        Operating history
      </Typography>
      <OperatingHistoryView history={cycle.data.operatingHistory} />
    </Box>
  );
}

function HarvestCropButton({ cycleId }: { cycleId: string }) {
  const navigate = useNavigate();
  const harvestCrop = useMutation({
    mutationFn: () => apiSend('/harvests', harvestDetailSchema, { cycleId }),
    onSuccess: (harvest) => navigate(`/harvests/${harvest.id}`),
  });
  return (
    <Box sx={{ mb: 3 }}>
      <Button variant="outlined" data-testid="harvest-crop" disabled={harvestCrop.isPending} onClick={() => harvestCrop.mutate()}>
        Harvest this crop
      </Button>
      {harvestCrop.error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {harvestCrop.error.message}
        </Alert>
      ) : null}
    </Box>
  );
}

function TaskList({
  cycleId,
  tasks,
}: {
  cycleId: string;
  tasks: Array<{ id: string; title: string; assigneeLabel: string; dueOn: string; status: string }>;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
  const add = useMutation({
    mutationFn: (body: { title: string; dueOn: string }) => apiSend(`/cycles/${cycleId}/tasks`, recordRemovedSchema, body),
    onSuccess: async () => {
      setMessage('Task added.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box sx={{ mb: 3 }} data-testid="generated-tasks">
      <PagedList
        items={tasks}
        empty="This cycle has no workflow assignments yet."
        render={(task) => <TaskRow key={task.id} task={task} onChanged={refresh} />}
      />
      <Box
        component="form"
        sx={{ display: 'grid', gap: 1, maxWidth: 420, mt: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          add.mutate({ title: String(form.get('title') ?? ''), dueOn: String(form.get('dueOn') ?? '') });
          event.currentTarget.reset();
        }}
      >
        <TextField label="Task title" name="title" required />
        <TextField label="Due" name="dueOn" type="date" required InputLabelProps={{ shrink: true }} />
        <Button type="submit" variant="contained" disabled={add.isPending} sx={{ justifySelf: 'start' }}>
          Add task
        </Button>
      </Box>
      {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
    </Box>
  );
}

function TaskRow({
  task,
  onChanged,
}: {
  task: { id: string; title: string; assigneeLabel: string; dueOn: string; status: string };
  onChanged: () => Promise<void> | void;
}) {
  const save = useMutation({
    mutationFn: (body: { title: string; dueOn: string }) => apiSend(`/tasks/${task.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: () => onChanged(),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/tasks/${task.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: () => onChanged(),
  });
  return (
    <RecordActions
      summary={
        <Typography data-testid="generated-task">
          <RouterLink to={`/tasks/${task.id}`}>{task.title}</RouterLink>
          {` · ${task.assigneeLabel} · ${formatCalendarDate(task.dueOn)}`}
        </Typography>
      }
      detail={<Typography>{task.status}</Typography>}
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

function ReschedulePanel({
  cycleId,
  startDate,
  workflow,
}: {
  cycleId: string;
  startDate: string;
  workflow: { latestVersionId: string; latestVersionNumber: number; versionId: string; versionNumber: number } | null;
}) {
  const queryClient = useQueryClient();
  const [nextStart, setNextStart] = useState(startDate);
  const [preview, setPreview] = useState<ReschedulePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runPreview = useMutation({
    mutationFn: () => apiSend(`/cycles/${cycleId}/reschedule/preview`, reschedulePreviewSchema, { startDate: nextStart }),
    onSuccess: (result) => {
      setPreview(result);
      setMessage('Preview only. Nothing has been saved.');
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const confirm = useMutation({
    mutationFn: () => apiSend(`/cycles/${cycleId}/reschedule`, rescheduleResultSchema, { startDate: nextStart }),
    onSuccess: async () => {
      setPreview(null);
      setMessage('Reschedule saved.');
      await queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const applyUpdate = useMutation({
    mutationFn: () => apiSend(`/cycles/${cycleId}/workflow`, startedCycleSchema, { versionId: workflow?.latestVersionId }),
    onSuccess: async () => {
      setMessage('The newer template version is now assigned to this cycle.');
      await queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Card sx={{ mb: 3 }} data-testid="reschedule-panel">
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Reschedule
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          Current start {formatCalendarDate(startDate)}. Preview the task dates before anything is written.
        </Typography>
        <TextField
          label="New start date"
          type="date"
          value={nextStart}
          onChange={(event) => {
            setNextStart(event.target.value);
            setPreview(null);
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'reschedule-start' }}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="outlined" data-testid="reschedule-preview" onClick={() => runPreview.mutate()} disabled={runPreview.isPending}>
            Preview
          </Button>
          <Button
            variant="contained"
            data-testid="reschedule-confirm"
            disabled={!preview || confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            Confirm reschedule
          </Button>
        </Box>
        {preview ? (
          <Box data-testid="reschedule-preview-result" sx={{ mt: 2 }}>
            {preview.tasks.map((task) => (
              <Typography key={task.id}>
                {task.title}: {formatCalendarDate(task.fromDueOn)} → {formatCalendarDate(task.toDueOn)}
              </Typography>
            ))}
          </Box>
        ) : null}
        {workflow && workflow.latestVersionNumber > workflow.versionNumber ? (
          <Button sx={{ mt: 2 }} onClick={() => applyUpdate.mutate()} disabled={applyUpdate.isPending}>
            Apply version {workflow.latestVersionNumber}
          </Button>
        ) : null}
        {message ? (
          <Alert severity="info" sx={{ mt: 2 }} data-testid="reschedule-message">
            {message}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
