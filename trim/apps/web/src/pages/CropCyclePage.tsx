import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import {
  cropCycleDetailSchema,
  harvestDetailSchema,
  recordRemovedSchema,
  reschedulePreviewSchema,
  rescheduleResultSchema,
  startedCycleSchema,
  type CropCycleDetail,
  type ReschedulePreview,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { addCalendarDays, cycleDayLabel, formatCalendarDate, inclusiveDayCount } from '../crops/format';
import { OperatingHistoryView } from '../crops/OperatingHistoryView';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { ROOM_TYPE_LABELS, roomTypeLabel } from '../theme';

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

  const detail: CropCycleDetail = {
    ...cycle.data,
    plants: cycle.data.plants ?? [],
    licenses: cycle.data.licenses ?? [],
  };

  return (
    <Box>
      <BackLink to={`/rooms/${detail.roomId}`} label={detail.roomName} />
      <PageHeader
        kicker={`${detail.siteName} · ${detail.roomName}`}
        title={detail.name}
        lede={`${detail.cultivar} · ${detail.plantCount} plants · ${roomTypeLabel(detail.stage)} · ${cycleDayLabel(detail.cycleDay)} · harvest ${formatCalendarDate(detail.expectedHarvestDate)}`}
      />
      <Typography data-testid="cycle-plant-count" sx={{ mb: 2, fontSize: 20 }}>
        {detail.plantCount} plants assigned to this cycle
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={detail.status} />
        <Chip label={cycleDayLabel(detail.cycleDay)} data-testid="cycle-page-day" />
        {detail.workflow ? <Chip label={`${detail.workflow.templateName} v${detail.workflow.versionNumber}`} /> : null}
      </Box>
      <HarvestPanel cycle={detail} />
      {detail.status === 'active' ? <CycleEditPanel cycle={detail} /> : null}
      <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
        Generated tasks
      </Typography>
      <TaskList cycleId={detail.id} tasks={detail.tasks} />
      {can(user, 'workflows.manage') ? (
        <ReschedulePanel cycleId={detail.id} startDate={detail.startDate} workflow={detail.workflow} />
      ) : null}
      <Typography variant="h2" sx={{ fontSize: 28, mb: 2 }}>
        Operating history
      </Typography>
      <OperatingHistoryView history={detail.operatingHistory} timeZone={detail.siteTimezone} />
    </Box>
  );
}

function CycleEditPanel({ cycle }: { cycle: CropCycleDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(cycle.startDate);
  const [durationDays, setDurationDays] = useState(
    String(Math.max(1, inclusiveDayCount(cycle.startDate, cycle.expectedHarvestDate))),
  );
  const endDate = useMemo(() => {
    const days = Number(durationDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(days) || days < 1) {
      return null;
    }
    return addCalendarDays(startDate, days - 1);
  }, [durationDays, startDate]);
  const save = useMutation({
    mutationFn: (body: { name: string; cultivar: string; stage: string; startDate: string; expectedHarvestDate: string }) =>
      apiSend(`/cycles/${cycle.id}`, recordRemovedSchema, body, 'PATCH'),
    onSuccess: async () => {
      setMessage('Crop cycle saved.');
      await queryClient.invalidateQueries({ queryKey: ['cycle', cycle.id] });
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['room', cycle.roomId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/cycles/${cycle.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['room', cycle.roomId] });
      navigate(`/rooms/${cycle.roomId}`);
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Card sx={{ mb: 3 }} data-testid="cycle-edit">
      <CardContent>
        <RecordActions
          summary={<Typography sx={{ fontWeight: 700 }}>Crop details</Typography>}
          detail={
            <Typography sx={{ color: 'text.secondary' }}>
              Edit the name, cultivar, stage, start, and duration, or delete this active crop.
            </Typography>
          }
          editor={
            <Box
              component="form"
              sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                if (!endDate) {
                  return;
                }
                const form = new FormData(event.currentTarget);
                save.mutate({
                  name: String(form.get('name') ?? ''),
                  cultivar: String(form.get('cultivar') ?? ''),
                  stage: String(form.get('stage') ?? ''),
                  startDate,
                  expectedHarvestDate: endDate,
                });
              }}
            >
              <TextField label="Name" name="name" defaultValue={cycle.name} required />
              <TextField label="Cultivar" name="cultivar" defaultValue={cycle.cultivar} required />
              <TextField select label="Stage" name="stage" defaultValue={cycle.stage in ROOM_TYPE_LABELS ? cycle.stage : 'flower'}>
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Start"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Cycle duration in days"
                name="durationDays"
                type="number"
                required
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                inputProps={{ min: 1, step: 1 }}
              />
              <Typography sx={{ color: endDate ? 'text.primary' : 'text.secondary' }}>
                {endDate
                  ? `End of cycle ${formatCalendarDate(endDate)}.`
                  : 'End of cycle is calculated from the start date and the duration. The start date is day 1.'}
              </Typography>
              <SaveChanges pending={save.isPending || !endDate} />
            </Box>
          }
          onDelete={() => remove.mutate()}
        />
        {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function HarvestPanel({ cycle }: { cycle: CropCycleDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canAddPlants = can(user, 'inventory.write', 'harvests.write');
  const canHarvest = can(user, 'harvests.write');
  // Cached cycle payloads from before this panel shipped may omit these arrays.
  const plants = cycle.plants ?? [];
  const licenses = cycle.licenses ?? [];
  const [licenseId, setLicenseId] = useState(licenses[0]?.id ?? '');
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!licenseId && licenses[0]?.id) {
      setLicenseId(licenses[0].id);
    }
  }, [licenses, licenseId]);

  const addPlants = useMutation({
    mutationFn: (body: { tags: string[]; licenseId?: string }) =>
      apiSend(`/cycles/${cycle.id}/plants`, cropCycleDetailSchema, body),
    onSuccess: async (updated) => {
      setTagText('');
      setMessage(`Added tags. ${updated.plantCount} plants on this crop.`);
      await queryClient.invalidateQueries({ queryKey: ['cycle', cycle.id] });
      await queryClient.invalidateQueries({ queryKey: ['room', cycle.roomId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const harvestCrop = useMutation({
    mutationFn: () => apiSend('/harvests', harvestDetailSchema, { cycleId: cycle.id }),
    onSuccess: (harvest) => navigate(`/harvests/${harvest.id}`),
  });

  const tags = tagText
    .split(/[\n,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    <Card sx={{ mb: 3 }} data-testid="harvest-panel">
      <CardContent sx={{ display: 'grid', gap: 2 }}>
        <Typography variant="h2" sx={{ fontSize: 26, m: 0 }}>
          Harvest
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Stay on this page: add plant tags to the crop, then harvest. Reset room only plans the room — it does not create
          tags.
        </Typography>

        <Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>1. Plants on this crop</Typography>
          {plants.length === 0 ? (
            <Typography color="text.secondary" data-testid="harvest-needs-plants">
              None yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="cycle-plant-tags">
              {plants.map((plant) => (
                <Chip
                  key={plant.id}
                  component={RouterLink}
                  to={`/plants/${plant.id}`}
                  clickable
                  label={plant.tag}
                  size="small"
                />
              ))}
            </Box>
          )}
        </Box>

        {cycle.status === 'active' && canAddPlants ? (
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 520 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (tags.length === 0) {
                setMessage('Enter at least one tag.');
                return;
              }
              addPlants.mutate({
                tags,
                ...(licenses.length > 1 ? { licenseId } : {}),
              });
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>2. Add tags</Typography>
            {licenses.length === 0 ? (
              <Alert severity="warning">
                No license covers {cycle.siteName}. Add one under{' '}
                <Button component={RouterLink} to="/compliance" size="small" sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
                  Compliance
                </Button>{' '}
                first.
              </Alert>
            ) : (
              <>
                {licenses.length > 1 ? (
                  <TextField
                    select
                    label="License"
                    value={licenseId}
                    onChange={(event) => setLicenseId(event.target.value)}
                    required
                    inputProps={{ 'data-testid': 'cycle-plant-license' }}
                  >
                    {licenses.map((license) => (
                      <MenuItem key={license.id} value={license.id}>
                        {license.licenseNumber}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Typography sx={{ color: 'text.secondary' }}>
                    License {licenses[0]?.licenseNumber}
                  </Typography>
                )}
                <TextField
                  label="Plant tags"
                  name="tags"
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  placeholder="One tag per line"
                  multiline
                  minRows={3}
                  required
                  inputProps={{ 'data-testid': 'cycle-plant-tags-input' }}
                  helperText="Creates the tags on this crop. A batch is made from the cultivar when needed."
                />
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={addPlants.isPending || tags.length === 0}
                  sx={{ justifySelf: 'start' }}
                  data-testid="cycle-add-plants"
                >
                  Add tags to crop
                </Button>
              </>
            )}
          </Box>
        ) : null}

        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>3. Cut the crop</Typography>
          {cycle.plantCount > 0 && canHarvest ? (
            <Button
              variant="contained"
              data-testid="harvest-crop"
              disabled={harvestCrop.isPending}
              onClick={() => harvestCrop.mutate()}
            >
              Harvest this crop
            </Button>
          ) : (
            <Alert severity="info">
              {cycle.plantCount === 0
                ? 'Add at least one tag above, then harvest.'
                : 'You need harvest permission to cut this crop.'}
            </Alert>
          )}
        </Box>

        {message ? <Alert severity={addPlants.isError ? 'error' : 'success'}>{message}</Alert> : null}
        {harvestCrop.error ? <Alert severity="error">{harvestCrop.error.message}</Alert> : null}
      </CardContent>
    </Card>
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
