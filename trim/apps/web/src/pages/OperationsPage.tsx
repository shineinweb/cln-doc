import { Alert, Box, Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material';
import {
  operationsOverviewSchema,
  recordRemovedSchema,
  recurringViewSchema,
  sopLibrarySchema,
  type OperationsOverview,
  type SopLibrary,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';

const AREAS = [
  ['irrigation', 'Irrigation and feed'],
  ['ipm', 'IPM'],
  ['maintenance', 'Maintenance'],
  ['purchasing', 'Purchasing'],
  ['sanitation', 'Sanitation'],
  ['training', 'Training'],
  ['calendar', 'Room calendar'],
  ['recurring', 'Recurring tasks'],
  ['library', 'SOP library'],
] as const;

type Area = (typeof AREAS)[number][0];

const AREA_COPY: Record<Area, string> = {
  irrigation: 'Record water and nutrient passes for a room. Volumes stay on this facility.',
  ipm: 'Record what you found and what you did. A clear scout is still a record.',
  maintenance: 'Record preventive work and repairs. A next due date keeps the asset on the list.',
  purchasing: 'Record what this facility ordered and whether it has arrived.',
  sanitation: 'Record the area, the method, and whether the pass is done.',
  training: 'Record who was trained and which procedure they used.',
  calendar: 'See which cultivar and medium occupy each room.',
  recurring: 'A repeating task stays on the list. Marking it done moves the next due date.',
  library: 'Procedures cited by a template task or by a cycle task. Cycle tasks from another facility stay off this list.',
};

export function OperationsPage() {
  const { area = 'irrigation' } = useParams();
  const known = AREAS.some(([id]) => id === area);
  if (!known) {
    return <Navigate to="/operations/irrigation" replace />;
  }
  return <OperationsArea area={area as Area} />;
}

function OperationsArea({ area }: { area: Area }) {
  const { siteId } = useSites();
  const overview = useQuery({
    queryKey: ['operations', siteId],
    queryFn: () => apiGet(`/operations/sites/${siteId}`, operationsOverviewSchema),
    enabled: Boolean(siteId) && area !== 'library',
  });
  const library = useQuery({
    queryKey: ['sop-library'],
    queryFn: () => apiGet('/operations/sop-library', sopLibrarySchema),
    enabled: area === 'library',
  });

  return (
    <Box>
      <PageHeader kicker="Floor" title={titleFor(area)} lede={AREA_COPY[area]} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {AREAS.map(([id, label]) => (
          <Button key={id} component={RouterLink} to={`/operations/${id}`} variant={id === area ? 'contained' : 'outlined'} size="small">
            {label}
          </Button>
        ))}
      </Box>
      {area === 'library' ? <LibraryView library={library.data} error={library.error} pending={library.isPending} /> : null}
      {area !== 'library' && !siteId ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {area !== 'library' && overview.error ? <Alert severity="error">{overview.error.message}</Alert> : null}
      {area !== 'library' && overview.data ? <AreaBody area={area} overview={overview.data} /> : null}
    </Box>
  );
}

function titleFor(area: Area): string {
  return AREAS.find(([id]) => id === area)?.[1] ?? 'Operations';
}

function AreaBody({ area, overview }: { area: Area; overview: OperationsOverview }) {
  if (area === 'irrigation') return <IrrigationPanel overview={overview} />;
  if (area === 'ipm') return <IpmPanel overview={overview} />;
  if (area === 'maintenance') return <MaintenancePanel overview={overview} />;
  if (area === 'purchasing') return <PurchasingPanel overview={overview} />;
  if (area === 'sanitation') return <SanitationPanel overview={overview} />;
  if (area === 'training') return <TrainingPanel overview={overview} />;
  if (area === 'calendar') return <CalendarPanel overview={overview} />;
  return <RecurringPanel overview={overview} />;
}

function RoomSelect({ rooms, testId }: { rooms: OperationsOverview['rooms']; testId: string }) {
  return (
    <TextField select label="Room" name="roomId" defaultValue={rooms[0]?.id ?? ''} required inputProps={{ 'data-testid': testId }}>
      {rooms.map((room) => (
        <MenuItem key={room.id} value={room.id}>
          {room.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

function useRefresh(siteId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['operations', siteId] });
  };
}

function IrrigationPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'irrigation');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/irrigation`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Irrigation and feed record saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="irrigation-list" empty="No irrigation or feed records yet.">
        {overview.irrigation.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="irrigation-row">
                {row.recordedOn} · {row.roomName} · {row.kind === 'feed' ? 'Feed' : 'Irrigation'} · {row.method}
                {row.volumeLiters != null ? ` · ${row.volumeLiters} L` : ''}
                {row.nutrientName ? ` · ${row.nutrientName}` : ''} · {row.actorName}
              </Typography>
            }
            detail={
              <Typography>
                EC {row.ec ?? '—'} · pH {row.ph ?? '—'} · {row.note || 'No note'}
              </Typography>
            }
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const method = String(new FormData(event.currentTarget).get('method') ?? '');
                  rows.save.mutate({
                    id: row.id,
                    body: {
                      roomId: row.roomId,
                      recordedOn: row.recordedOn,
                      kind: row.kind,
                      method,
                      volumeLiters: row.volumeLiters,
                      ec: row.ec,
                      ph: row.ph,
                      nutrientName: row.nutrientName,
                      note: row.note,
                    },
                  });
                }}
              >
                <TextField label="Method" name="method" defaultValue={row.method} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                roomId: String(form.get('roomId')),
                recordedOn: String(form.get('recordedOn')),
                kind: String(form.get('kind')),
                method: String(form.get('method')),
                volumeLiters: numberOrNull(form.get('volumeLiters')),
                ec: numberOrNull(form.get('ec')),
                ph: numberOrNull(form.get('ph')),
                nutrientName: String(form.get('nutrientName') ?? ''),
                note: String(form.get('note') ?? ''),
              });
            }}
          >
            <RoomSelect rooms={overview.rooms} testId="irrigation-room" />
            <TextField label="Date" name="recordedOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField select label="Kind" name="kind" defaultValue="irrigation">
              <MenuItem value="irrigation">Irrigation</MenuItem>
              <MenuItem value="feed">Feed</MenuItem>
            </TextField>
            <TextField label="Method" name="method" required />
            <TextField label="Volume (L)" name="volumeLiters" type="number" />
            <TextField label="EC" name="ec" type="number" />
            <TextField label="pH" name="ph" type="number" />
            <TextField label="Nutrient" name="nutrientName" />
            <TextField label="Note" name="note" />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save record
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function IpmPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'ipm');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/ipm`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('IPM record saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="ipm-list" empty="No IPM records yet.">
        {overview.ipm.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="ipm-row">
                {row.recordedOn} · {row.roomName} · {row.target} · {row.finding === 'present' ? 'Present' : 'Clear'} · {row.response} · {row.actorName}
              </Typography>
            }
            detail={<Typography>{row.note || 'No note'}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, response: String(new FormData(event.currentTarget).get('response') ?? '') },
                  });
                }}
              >
                <TextField label="Response" name="response" defaultValue={row.response} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                roomId: String(form.get('roomId')),
                recordedOn: String(form.get('recordedOn')),
                target: String(form.get('target')),
                finding: String(form.get('finding')),
                response: String(form.get('response')),
                note: String(form.get('note') ?? ''),
              });
            }}
          >
            <RoomSelect rooms={overview.rooms} testId="ipm-room" />
            <TextField label="Date" name="recordedOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField label="Target" name="target" required />
            <TextField select label="Finding" name="finding" defaultValue="clear">
              <MenuItem value="clear">Clear</MenuItem>
              <MenuItem value="present">Present</MenuItem>
            </TextField>
            <TextField label="Response" name="response" required />
            <TextField label="Note" name="note" />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save record
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function MaintenancePanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'maintenance');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/maintenance`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Maintenance record saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="maintenance-list" empty="No maintenance records yet.">
        {overview.maintenance.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="maintenance-row">
                {row.recordedOn} · {row.assetName} · {row.kind === 'repair' ? 'Repair' : 'Preventive'} · {row.summary}
                {row.roomName ? ` · ${row.roomName}` : ''}
              </Typography>
            }
            detail={<Typography>{row.nextDueOn ? `Next due ${row.nextDueOn}` : 'No next due date'}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, summary: String(new FormData(event.currentTarget).get('summary') ?? '') },
                  });
                }}
              >
                <TextField label="Summary" name="summary" defaultValue={row.summary} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const roomId = String(form.get('roomId') ?? '');
              save.mutate({
                roomId: roomId || null,
                recordedOn: String(form.get('recordedOn')),
                assetName: String(form.get('assetName')),
                kind: String(form.get('kind')),
                summary: String(form.get('summary')),
                nextDueOn: String(form.get('nextDueOn') ?? '') || null,
              });
            }}
          >
            <TextField select label="Room" name="roomId" defaultValue="">
              <MenuItem value="">Facility</MenuItem>
              {overview.rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Date" name="recordedOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField label="Asset" name="assetName" required />
            <TextField select label="Kind" name="kind" defaultValue="preventive">
              <MenuItem value="preventive">Preventive</MenuItem>
              <MenuItem value="repair">Repair</MenuItem>
            </TextField>
            <TextField label="Summary" name="summary" required />
            <TextField label="Next due" name="nextDueOn" type="date" InputLabelProps={{ shrink: true }} />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save record
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function PurchasingPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'purchasing');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/purchasing`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Purchase saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="purchase-list" empty="No purchases yet.">
        {overview.purchasing.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="purchase-row">
                {row.orderedOn} · {row.vendorName} · {row.description} · {row.quantity} · {row.unitCostCents} cents ·{' '}
                {row.status === 'received' ? 'Received' : 'Requested'}
              </Typography>
            }
            detail={<Typography>{row.vendorName}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, description: String(new FormData(event.currentTarget).get('description') ?? '') },
                  });
                }}
              >
                <TextField label="Description" name="description" defaultValue={row.description} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                vendorName: String(form.get('vendorName')),
                orderedOn: String(form.get('orderedOn')),
                status: String(form.get('status')),
                description: String(form.get('description')),
                quantity: Number(form.get('quantity')),
                unitCostCents: Number(form.get('unitCostCents')),
              });
            }}
          >
            <TextField label="Vendor" name="vendorName" required />
            <TextField label="Ordered on" name="orderedOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField select label="Status" name="status" defaultValue="requested">
              <MenuItem value="requested">Requested</MenuItem>
              <MenuItem value="received">Received</MenuItem>
            </TextField>
            <TextField label="Description" name="description" required />
            <TextField label="Quantity" name="quantity" type="number" required />
            <TextField label="Unit cost (cents)" name="unitCostCents" type="number" required />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save purchase
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function SanitationPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'sanitation');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/sanitation`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Sanitation record saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="sanitation-list" empty="No sanitation records yet.">
        {overview.sanitation.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="sanitation-row">
                {row.recordedOn} · {row.roomName} · {row.area} · {row.method} · {row.outcome === 'done' ? 'Done' : 'Needs follow-up'} · {row.actorName}
              </Typography>
            }
            detail={<Typography>{row.actorName}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, method: String(new FormData(event.currentTarget).get('method') ?? '') },
                  });
                }}
              >
                <TextField label="Method" name="method" defaultValue={row.method} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                roomId: String(form.get('roomId')),
                recordedOn: String(form.get('recordedOn')),
                area: String(form.get('area')),
                method: String(form.get('method')),
                outcome: String(form.get('outcome')),
              });
            }}
          >
            <RoomSelect rooms={overview.rooms} testId="sanitation-room" />
            <TextField label="Date" name="recordedOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField label="Area" name="area" required />
            <TextField label="Method" name="method" required />
            <TextField select label="Outcome" name="outcome" defaultValue="done">
              <MenuItem value="done">Done</MenuItem>
              <MenuItem value="follow_up">Needs follow-up</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save record
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function TrainingPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'training');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/training`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Training record saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <RecordList testId="training-list" empty="No training records yet.">
        {overview.training.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="training-row">
                {row.traineeName} · {row.title}
                {row.sopTitle ? ` · ${row.sopTitle}` : ''} · {row.status === 'completed' ? 'Completed' : 'Assigned'}
                {row.completedOn ? ` · ${row.completedOn}` : ''}
              </Typography>
            }
            detail={<Typography>{row.actorName}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, title: String(new FormData(event.currentTarget).get('title') ?? '') },
                  });
                }}
              >
                <TextField label="Title" name="title" defaultValue={row.title} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                traineeName: String(form.get('traineeName')),
                title: String(form.get('title')),
                sopTitle: String(form.get('sopTitle') ?? ''),
                status: String(form.get('status')),
                completedOn: String(form.get('completedOn') ?? '') || null,
              });
            }}
          >
            <TextField label="Trainee" name="traineeName" required />
            <TextField label="Title" name="title" required />
            <TextField label="Procedure" name="sopTitle" />
            <TextField select label="Status" name="status" defaultValue="assigned">
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField label="Completed on" name="completedOn" type="date" InputLabelProps={{ shrink: true }} />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save training
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function CalendarPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'stays');
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/stays`, operationsOverviewSchema, body),
    onSuccess: async () => {
      setMessage('Room stay saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).format(new Date());
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year ?? 2026, monthNumber ?? 1, 0)).getUTCDate();
  return (
    <Box>
      <Typography sx={{ mb: 1 }} data-testid="calendar-month">
        {month}
      </Typography>
      <RecordList testId="stay-list" empty="No room stays are recorded for this facility.">
        {overview.stays.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="stay-row">
                {row.roomName} · {row.label} · {row.cultivar} · {row.medium} · {row.startsOn} – {row.endsOn}
              </Typography>
            }
            detail={<Typography>{row.roomName}</Typography>}
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, label: String(new FormData(event.currentTarget).get('label') ?? '') },
                  });
                }}
              >
                <TextField label="Label" name="label" defaultValue={row.label} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      <Box data-testid="room-calendar" sx={{ display: 'grid', gap: 1, mb: 2 }}>
        {Array.from({ length: days }, (_, index) => {
          const day = String(index + 1).padStart(2, '0');
          const key = `${month}-${day}`;
          const occupied = overview.stays.filter((stay) => stay.startsOn <= key && stay.endsOn >= key);
          return (
            <Typography key={key} data-testid="calendar-day">
              {key}
              {occupied.length === 0 ? ' · open' : occupied.map((stay) => ` · ${stay.roomName} ${stay.cultivar} ${stay.medium}`).join('')}
            </Typography>
          );
        })}
      </Box>
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                roomId: String(form.get('roomId')),
                label: String(form.get('label')),
                cultivar: String(form.get('cultivar')),
                medium: String(form.get('medium')),
                startsOn: String(form.get('startsOn')),
                endsOn: String(form.get('endsOn')),
              });
            }}
          >
            <RoomSelect rooms={overview.rooms} testId="stay-room" />
            <TextField label="Label" name="label" required />
            <TextField label="Cultivar" name="cultivar" required />
            <TextField label="Medium" name="medium" required />
            <TextField label="Starts" name="startsOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField label="Ends" name="endsOn" type="date" required InputLabelProps={{ shrink: true }} />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save stay
            </Button>
          </Box>
          {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
        </CardContent>
      </Card>
    </Box>
  );
}

function RecurringPanel({ overview }: { overview: OperationsOverview }) {
  const refresh = useRefresh(overview.siteId);
  const rows = useOpsChange(overview.siteId, 'recurring');
  const [message, setMessage] = useState<string | null>(null);
  const complete = useMutation({
    mutationFn: (dutyId: string) => apiSend(`/operations/sites/${overview.siteId}/recurring/${dutyId}/complete`, recurringViewSchema, {}),
    onSuccess: async () => {
      setMessage('Next due date moved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/operations/sites/${overview.siteId}/recurring`, recurringViewSchema, body),
    onSuccess: async () => {
      setMessage('Recurring task saved.');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Box>
      <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
        Duties due today also appear under Tasks so crop-cycle work, room chores, and recurring duties share one daily list.
      </Typography>
      <RecordList testId="recurring-list" empty="No recurring tasks yet.">
        {overview.recurring.map((row) => (
          <RecordActions
            key={row.id}
            summary={
              <Typography data-testid="recurring-row">
                {row.nextDueOn} · {row.title} · {row.cadence === 'weekly' ? 'Weekly' : 'Daily'} · {row.assigneeLabel}
                {row.roomName ? ` · ${row.roomName}` : ''}
                {row.sopTitle ? ` · ${row.sopTitle}` : ''}
              </Typography>
            }
            detail={
              <Button size="small" data-testid="complete-recurring" onClick={() => complete.mutate(row.id)} disabled={complete.isPending}>
                Mark done
              </Button>
            }
            editor={
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  rows.save.mutate({
                    id: row.id,
                    body: { ...row, title: String(new FormData(event.currentTarget).get('title') ?? '') },
                  });
                }}
              >
                <TextField label="Title" name="title" defaultValue={row.title} required />
                <SaveChanges pending={rows.save.isPending} />
              </Box>
            }
            onDelete={() => rows.remove.mutate(row.id)}
          />
        ))}
      </RecordList>
      {message ? <Alert sx={{ mb: 2 }}>{message}</Alert> : null}
      <Card>
        <CardContent>
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const roomId = String(form.get('roomId') ?? '');
              save.mutate({
                roomId: roomId || null,
                title: String(form.get('title')),
                cadence: String(form.get('cadence')),
                nextDueOn: String(form.get('nextDueOn')),
                assigneeLabel: String(form.get('assigneeLabel')),
                sopTitle: String(form.get('sopTitle') ?? ''),
              });
            }}
          >
            <TextField label="Title" name="title" required />
            <TextField select label="Cadence" name="cadence" defaultValue="weekly">
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
            </TextField>
            <TextField label="Next due" name="nextDueOn" type="date" required InputLabelProps={{ shrink: true }} />
            <TextField label="Assignee" name="assigneeLabel" required />
            <TextField select label="Room" name="roomId" defaultValue="">
              <MenuItem value="">Facility</MenuItem>
              {overview.rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Procedure" name="sopTitle" />
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save recurring task
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function LibraryView({ library, error, pending }: { library: SopLibrary | undefined; error: Error | null; pending: boolean }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (input: { id: string; title: string; summary: string }) =>
      apiSend(`/workflows/sops/${input.id}`, recordRemovedSchema, { title: input.title, summary: input.summary }, 'PATCH'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sop-library'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/workflows/sops/${id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sop-library'] });
    },
  });
  if (pending) {
    return <Typography>Loading procedures…</Typography>;
  }
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }
  if (!library || library.entries.length === 0) {
    return <Alert severity="info">No procedures are stored yet.</Alert>;
  }
  return (
    <PagedList
      items={library.entries}
      empty="No procedures are stored yet."
      testId="sop-library"
      render={(entry) => (
        <Card key={entry.id} sx={{ mb: 2 }} data-testid="sop-library-entry">
          <CardContent>
            <RecordActions
              summary={
                <Typography variant="h3" sx={{ fontSize: 22 }}>
                  {entry.title}
                </Typography>
              }
              detail={
                <Box>
                  <Typography sx={{ color: 'text.secondary', mb: 1 }}>{entry.summary}</Typography>
                  {entry.templateTasks.length === 0 && entry.cycleTasks.length === 0 ? (
                    <Typography>Not linked to a task yet.</Typography>
                  ) : null}
                  {entry.templateTasks.map((task) => (
                    <Typography key={`${task.templateName}-${task.taskTitle}`} data-testid="sop-template-link">
                      Template {task.templateName}
                      {task.cultivar ? ` · ${task.cultivar}` : ''}
                      {task.medium ? ` · ${task.medium}` : ''} · {task.taskTitle}
                    </Typography>
                  ))}
                  {entry.cycleTasks.map((task) => (
                    <Typography key={`${task.siteName}-${task.roomName}-${task.taskTitle}`} data-testid="sop-cycle-link">
                      {task.siteName} · {task.roomName} · {task.cycleName} · {task.taskTitle}
                    </Typography>
                  ))}
                </Box>
              }
              editor={
                <Box
                  component="form"
                  sx={{ display: 'grid', gap: 1 }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    save.mutate({
                      id: entry.id,
                      title: String(form.get('title') ?? ''),
                      summary: String(form.get('summary') ?? ''),
                    });
                  }}
                >
                  <TextField label="Title" name="title" defaultValue={entry.title} required />
                  <TextField label="Summary" name="summary" defaultValue={entry.summary} required multiline minRows={2} />
                  <SaveChanges pending={save.isPending} />
                </Box>
              }
              onDelete={() => remove.mutate(entry.id)}
            />
          </CardContent>
        </Card>
      )}
    />
  );
}

function RecordList({ testId, empty, children }: { testId: string; empty: string; children: ReactNode }) {
  const list = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return <PagedList items={list} empty={empty} testId={testId} render={(item) => item} />;
}

function useOpsChange(siteId: string, kind: string) {
  const refresh = useRefresh(siteId);
  const save = useMutation({
    mutationFn: (input: { id: string; body: unknown }) =>
      apiSend(`/operations/sites/${siteId}/${kind}/${input.id}`, operationsOverviewSchema, input.body, 'PATCH'),
    onSuccess: () => refresh(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/operations/sites/${siteId}/${kind}/${id}`, operationsOverviewSchema, undefined, 'DELETE'),
    onSuccess: () => refresh(),
  });
  return { save, remove };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
