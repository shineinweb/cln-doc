import { Alert, Box, Button, Card, CardContent, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { harvestDetailSchema, packageDetailSchema, recordRemovedSchema, scaleSampleViewSchema, tagSampleViewSchema, type HarvestDetail } from '@trim/contracts';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';

const stepLabel: Record<string, string> = {
  harvested: 'Harvested',
  wet_weight: 'Wet weight',
  drying: 'Drying',
  dry_weight: 'Dry weight',
  trimming: 'Trimming',
};

export function HarvestPage() {
  const { harvestId = '' } = useParams();
  const harvest = useQuery({
    queryKey: ['harvest', harvestId],
    queryFn: () => apiGet(`/harvests/${harvestId}`, harvestDetailSchema),
    enabled: Boolean(harvestId),
    retry: false,
  });

  if (harvest.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (harvest.error instanceof ApiError && (harvest.error.status === 403 || harvest.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="harvest-access-warning">
        {harvest.error.status === 403 ? 'You do not have access to this harvest.' : 'This harvest was not found.'}
      </Alert>
    );
  }
  if (harvest.error || !harvest.data) {
    return <Alert severity="error">{harvest.error?.message ?? 'This harvest could not be loaded.'}</Alert>;
  }

  const row = harvest.data;
  return (
    <Box>
      <BackLink to="/harvests" label="Harvests" />
      <PageHeader
        kicker={row.licenseNumber}
        title={row.name}
        lede={`${row.siteName ?? 'Facility'} · ${row.plantCount} plant tags stay on this harvest.`}
      />
      <Typography data-testid="harvest-plant-count" sx={{ mb: 2, fontSize: 20 }}>
        {row.plantCount} plants
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ order: { xs: 1, md: 2 } }}>
          <NextStep harvest={row} />
          <TagSamples harvestId={row.id} />
        </Box>
        <Box sx={{ order: { xs: 2, md: 1 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, alignItems: 'start' }}>
          <WeightLedger ledger={row.ledger} />
          <ScaleSamples harvestId={row.id} />
        </Box>
      </Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
            Steps
          </Typography>
          <PagedList
            items={row.steps}
            empty="No steps are recorded."
            render={(step) => (
              <WeightRow
                key={step.id}
                testId="harvest-step"
                harvestId={row.id}
                path={`/harvest-steps/${step.id}`}
                summary={`${stepLabel[step.kind] ?? step.kind}${step.weightGrams !== null ? ` · ${step.weightGrams} g` : ''}${step.roomName ? ` · ${step.roomName}` : ''} · ${step.actorName} · ${formatTimestamp(step.occurredAt)}`}
                grams={step.weightGrams}
                note={step.note}
              />
            )}
          />
          <PagedList
            items={row.wastes}
            empty="No waste is recorded."
            render={(waste) => (
              <WeightRow
                key={waste.id}
                testId="harvest-waste"
                harvestId={row.id}
                path={`/wastes/${waste.id}`}
                summary={`Waste · ${waste.weightGrams} g · ${waste.actorName} · ${formatTimestamp(waste.recordedAt)}${waste.note ? ` · ${waste.note}` : ''}`}
                grams={waste.weightGrams}
                note={waste.note}
              />
            )}
          />
        </CardContent>
      </Card>
      <Typography variant="h3" sx={{ fontSize: 22, mt: 3, mb: 1 }}>
        Source tags
      </Typography>
      <PagedList
        items={row.plants}
        empty="No source tags are recorded."
        testId="harvest-tags"
        render={(plant) => (
          <Typography key={plant.plantId} data-testid="harvest-tag">
            <RouterLink to={`/plants/${plant.plantId}`}>{plant.tag}</RouterLink>
          </Typography>
        )}
      />
      <Box sx={{ mt: 3 }}>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Packages
        </Typography>
        <PagedList
          items={row.packages}
          empty="No packages are recorded."
          render={(item) => (
            <PackageRow key={item.id} harvestId={row.id} item={item} />
          )}
        />
      </Box>
    </Box>
  );
}

function WeightRow({
  testId,
  harvestId,
  path,
  summary,
  grams,
  note,
}: {
  testId: string;
  harvestId: string;
  path: string;
  summary: string;
  grams: number | null;
  note: string | null;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['harvest', harvestId] });
  const save = useMutation({
    mutationFn: (body: { grams: number; note: string | null }) => apiSend(path, recordRemovedSchema, body, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(path, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      keepsHistory
      summary={<Typography data-testid={testId}>{summary}</Typography>}
      detail={<Typography>{note ?? 'No note'}</Typography>}
      editor={
        grams === null ? (
          <Typography>This step has no weight to change.</Typography>
        ) : (
          <Box
            component="form"
            sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const nextNote = String(form.get('note') ?? '').trim();
              save.mutate({ grams: Number(form.get('grams')), note: nextNote || null });
            }}
          >
            <TextField label="Grams" name="grams" type="number" defaultValue={grams} required />
            <TextField label="Note" name="note" defaultValue={note ?? ''} />
            <SaveChanges pending={save.isPending} />
          </Box>
        )
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function PackageRow({
  harvestId,
  item,
}: {
  harvestId: string;
  item: { id: string; label: string; weightGrams: number; sourceTagCount: number };
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['harvest', harvestId] });
  const save = useMutation({
    mutationFn: (label: string) => apiSend(`/packages/${item.id}`, recordRemovedSchema, { label }, 'PATCH'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/packages/${item.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: refresh,
  });
  return (
    <RecordActions
      keepsHistory
      summary={
        <Typography>
          <RouterLink to={`/packages/${item.id}`}>{item.label}</RouterLink>
          {` · ${item.weightGrams} g · ${item.sourceTagCount} source tags`}
        </Typography>
      }
      detail={<Typography>{item.weightGrams} g</Typography>}
      editor={
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1, maxWidth: 320 }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(String(new FormData(event.currentTarget).get('label') ?? ''));
          }}
        >
          <TextField label="Label" name="label" defaultValue={item.label} required />
          <SaveChanges pending={save.isPending} />
        </Box>
      }
      onDelete={() => remove.mutate()}
    />
  );
}

function ScaleSamples({ harvestId }: { harvestId: string }) {
  const samples = useQuery({
    queryKey: ['scale-samples', harvestId],
    queryFn: () => apiGet(`/adapters/scales/harvests/${harvestId}/samples`, z.array(scaleSampleViewSchema)),
    retry: false,
  });
  return (
    <Card data-testid="scale-samples" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
          Sample scale weight
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1 }}>
          This sample sits beside the ledger. It does not change wet, dry, packaged, waste, or unaccounted weight.
        </Typography>
        {samples.data && samples.data.length > 0 ? (
          samples.data.map((sample) => (
            <Typography key={sample.id} data-testid="scale-sample">
              {sample.deviceId} · {sample.weightGrams} {sample.unit} · {sample.quality} · {formatTimestamp(sample.recordedAt)} · Sample data
            </Typography>
          ))
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>No sample scale weight is stored.</Typography>
        )}
      </CardContent>
    </Card>
  );
}

function TagSamples({ harvestId }: { harvestId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const samples = useQuery({
    queryKey: ['tag-samples', harvestId],
    queryFn: () => apiGet(`/adapters/tags/harvests/${harvestId}/samples`, z.array(tagSampleViewSchema)),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend(`/adapters/tags/harvests/${harvestId}/samples`, tagSampleViewSchema, body),
    onSuccess: async () => {
      setMessage('Sample tag stored. The ledger and plant tags are unchanged.');
      await queryClient.invalidateQueries({ queryKey: ['tag-samples', harvestId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <Card data-testid="tag-samples" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
          Sample tag
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1 }}>
          This sample sits beside the harvest. It does not change plant tags, packages, or the weight ledger.
        </Typography>
        {samples.data && samples.data.length > 0 ? (
          samples.data.map((sample) => (
            <Typography key={sample.id} data-testid="tag-sample">
              {sample.deviceId} · {sample.tag} · {sample.quality} · {formatTimestamp(sample.recordedAt)} · Sample data
            </Typography>
          ))
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>No sample tag is stored.</Typography>
        )}
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1.5, mt: 2 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({
              deviceId: String(form.get('deviceId')),
              tag: String(form.get('tag')),
              recordedAt: String(form.get('recordedAt')),
              quality: String(form.get('quality')),
              isSample: true,
            });
          }}
        >
          <TextField label="Device" name="deviceId" required fullWidth inputProps={{ 'data-testid': 'tag-device' }} />
          <TextField label="Tag" name="tag" required fullWidth inputProps={{ 'data-testid': 'tag-value' }} />
          <TextField label="Timestamp" name="recordedAt" type="datetime-local" required fullWidth InputLabelProps={{ shrink: true }} />
          <TextField select label="Quality" name="quality" defaultValue="good" fullWidth>
            <MenuItem value="good">Good</MenuItem>
            <MenuItem value="suspect">Suspect</MenuItem>
            <MenuItem value="bad">Bad</MenuItem>
          </TextField>
          <Button type="submit" variant="outlined" fullWidth disabled={save.isPending}>
            Save sample tag
          </Button>
        </Box>
        {message ? <Alert sx={{ mt: 1 }}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function WeightLedger({ ledger }: { ledger: HarvestDetail['ledger'] }) {
  return (
    <Box data-testid="weight-ledger" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5, mb: 2 }}>
      <Figure testId="weight-wet" label="Wet weight" value={ledger.wetWeightGrams} />
      <Figure testId="weight-dry" label="Dry weight" value={ledger.dryWeightGrams} />
      <Figure testId="weight-packaged" label="Packaged" value={ledger.packageWeightGrams} />
      <Figure testId="weight-waste" label="Waste" value={ledger.wasteWeightGrams} />
      <Figure testId="weight-unaccounted" label="Unaccounted" value={ledger.unaccountedGrams} />
    </Box>
  );
}

function Figure({ testId, label, value }: { testId: string; label: string; value: number | null }) {
  return (
    <Box>
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{label}</Typography>
      <Typography data-testid={testId} sx={{ fontWeight: 600 }}>
        {value === null ? 'Not recorded' : `${value} g`}
      </Typography>
    </Box>
  );
}

function NextStep({ harvest }: { harvest: HarvestDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [grams, setGrams] = useState('');
  const [packageGrams, setPackageGrams] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [scan, setScan] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const kinds = new Set(harvest.steps.map((step) => step.kind));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['harvest', harvest.id] });
    await queryClient.invalidateQueries({ queryKey: ['harvests'] });
  };
  const send = useMutation({
    mutationFn: async (action: 'wet' | 'drying' | 'dry' | 'trim' | 'waste') => {
      const weight = Number(grams);
      if (action === 'wet') {
        return apiSend(`/harvests/${harvest.id}/wet-weight`, harvestDetailSchema, { grams: weight });
      }
      if (action === 'drying') {
        return apiSend(`/harvests/${harvest.id}/drying`, harvestDetailSchema, {});
      }
      if (action === 'dry') {
        return apiSend(`/harvests/${harvest.id}/dry-weight`, harvestDetailSchema, { grams: weight });
      }
      if (action === 'trim') {
        return apiSend(`/harvests/${harvest.id}/trimming`, harvestDetailSchema, {});
      }
      return apiSend(`/harvests/${harvest.id}/waste`, harvestDetailSchema, { grams: weight, note });
    },
    onSuccess: async () => {
      setMessage(null);
      setGrams('');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const createPackage = useMutation({
    mutationFn: () =>
      apiSend(`/harvests/${harvest.id}/packages`, packageDetailSchema, {
        label: label.trim(),
        grams: Number(packageGrams),
        tags,
      }),
    onSuccess: async (created) => {
      await refresh();
      navigate(`/packages/${created.id}`);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addTag = (value: string) => {
    const next = value.trim();
    if (!next || tags.includes(next)) {
      return;
    }
    setTags((current) => [...current, next]);
    setScan('');
  };

  return (
    <Card data-testid="harvest-capture">
      <CardContent>
        <WeighStation harvest={harvest} />
        {!kinds.has('wet_weight') ? (
          <WeightAction
            testId="wet-weight"
            buttonId="record-wet-weight"
            label="Wet weight (g)"
            grams={grams}
            onGrams={setGrams}
            onSubmit={() => send.mutate('wet')}
            pending={send.isPending}
            button="Record wet weight"
          />
        ) : null}
        {kinds.has('wet_weight') && !kinds.has('drying') ? (
          <Button data-testid="start-drying" variant="contained" onClick={() => send.mutate('drying')} disabled={send.isPending} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Start drying
          </Button>
        ) : null}
        {kinds.has('drying') && !kinds.has('dry_weight') ? (
          <WeightAction
            testId="dry-weight"
            buttonId="record-dry-weight"
            label="Dry weight (g)"
            grams={grams}
            onGrams={setGrams}
            onSubmit={() => send.mutate('dry')}
            pending={send.isPending}
            button="Record dry weight"
          />
        ) : null}
        {kinds.has('dry_weight') && !kinds.has('trimming') ? (
          <Button data-testid="record-trimming" variant="contained" onClick={() => send.mutate('trim')} disabled={send.isPending} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Record trimming
          </Button>
        ) : null}
        {kinds.has('trimming') ? (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Waste note" value={note} onChange={(event) => setNote(event.target.value)} fullWidth inputProps={{ 'data-testid': 'waste-note' }} />
            <WeightAction
              testId="waste-weight"
              buttonId="record-waste"
              label="Waste (g)"
              grams={grams}
              onGrams={setGrams}
              onSubmit={() => send.mutate('waste')}
              pending={send.isPending}
              button="Record waste"
            />
            <Typography sx={{ fontWeight: 600 }}>Package</Typography>
            <TextField
              label="Package weight (g)"
              type="number"
              value={packageGrams}
              onChange={(event) => setPackageGrams(event.target.value)}
              fullWidth
              inputProps={{ 'data-testid': 'package-weight-input' }}
            />
            <Box
              component="input"
              data-testid="package-label"
              aria-label="Package tag"
              value={label}
              autoComplete="off"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
              sx={{ width: '100%', font: 'inherit', py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            />
            <Box
              component="input"
              data-testid="scan-source-tag"
              aria-label="Scan a source tag"
              value={scan}
              autoComplete="off"
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag(scan);
                }
              }}
              sx={{ width: '100%', font: 'inherit', py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            />
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, flexWrap: 'wrap' }}>
              <Button data-testid="include-harvested-tags" onClick={() => setTags(harvest.plants.map((plant) => plant.tag))}>
                Include harvested tags
              </Button>
              <Button
                data-testid="create-package"
                variant="contained"
                onClick={() => createPackage.mutate()}
                disabled={createPackage.isPending || tags.length === 0 || label.trim().length === 0 || Number(packageGrams) <= 0}
              >
                Create package
              </Button>
            </Box>
            <Typography data-testid="selected-tag-count">{tags.length} source tags selected</Typography>
          </Box>
        ) : null}
        {message ? (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="harvest-message">
            {message}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeighStation({ harvest }: { harvest: HarvestDetail }) {
  const queryClient = useQueryClient();
  const scanRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState('');
  const [grams, setGrams] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wetRecorded = harvest.steps.some((step) => step.kind === 'wet_weight');

  useEffect(() => {
    scanRef.current?.focus();
  }, [harvest.id]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['harvest', harvest.id] });
  };
  const save = useMutation({
    mutationFn: () =>
      apiSend(`/harvests/${harvest.id}/weigh`, harvestDetailSchema, {
        tag: tag.trim(),
        grams: Number(grams),
        deviceId: 'harvest-scale',
      }),
    onSuccess: async () => {
      setTag('');
      setGrams('');
      setError(null);
      setMessage('Weight saved.');
      await refresh();
      scanRef.current?.focus();
    },
    onError: (caught: Error) => {
      setMessage(null);
      setError(caught.message);
      scanRef.current?.focus();
    },
  });
  const useTotal = useMutation({
    mutationFn: () => apiSend(`/harvests/${harvest.id}/wet-weight`, harvestDetailSchema, { grams: harvest.weighTotalGrams }),
    onSuccess: async () => {
      setError(null);
      setMessage('Wet weight recorded from the plant total.');
      await refresh();
    },
    onError: (caught: Error) => {
      setMessage(null);
      setError(caught.message);
    },
  });

  return (
    <Box data-testid="weigh-station" sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
      <Typography sx={{ fontWeight: 700 }}>Weigh a plant</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        Scan the Metrc tag, then the scale weight. The tag must already be on this harvest. Scanning it again replaces the grams.
      </Typography>
      <Box
        component="input"
        data-testid="weigh-scan-tag"
        aria-label="Scan tag"
        placeholder="Scan tag"
        value={tag}
        autoComplete="off"
        ref={scanRef}
        onChange={(event) => setTag(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (tag.trim()) {
              weightRef.current?.focus();
            }
          }
        }}
        sx={{ width: '100%', font: 'inherit', py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
      />
      <TextField
        label="Weight (g)"
        type="number"
        value={grams}
        onChange={(event) => setGrams(event.target.value)}
        inputRef={weightRef}
        inputProps={{ 'data-testid': 'weigh-grams' }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (tag.trim() && Number(grams) > 0) {
              save.mutate();
            }
          }
        }}
      />
      <Button
        data-testid="save-plant-weight"
        variant="contained"
        onClick={() => save.mutate()}
        disabled={save.isPending || tag.trim().length === 0 || Number(grams) <= 0}
      >
        Save weight
      </Button>
      {harvest.weighs.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>No plant weights yet.</Typography>
      ) : (
        harvest.weighs.map((row) => (
          <Typography key={row.id} data-testid="plant-weigh">
            {row.tag} · {row.weightGrams} g · {formatTimestamp(row.recordedAt)}
          </Typography>
        ))
      )}
      <Typography data-testid="plant-weigh-total">Total {harvest.weighTotalGrams} g</Typography>
      {!wetRecorded && harvest.weighTotalGrams > 0 ? (
        <Button
          data-testid="use-weigh-total"
          variant="outlined"
          onClick={() => useTotal.mutate()}
          disabled={useTotal.isPending}
        >
          Use total as wet weight
        </Button>
      ) : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error" data-testid="weigh-error">{error}</Alert> : null}
    </Box>
  );
}

function WeightAction({
  testId,
  buttonId,
  label,
  grams,
  onGrams,
  onSubmit,
  pending,
  button,
}: {
  testId: string;
  buttonId: string;
  label: string;
  grams: string;
  onGrams: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  button: string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}>
      <TextField
        label={label}
        type="number"
        value={grams}
        onChange={(event) => onGrams(event.target.value)}
        fullWidth
        inputProps={{ 'data-testid': testId }}
      />
      <Button data-testid={buttonId} variant="contained" onClick={onSubmit} disabled={pending} sx={{ width: { xs: '100%', sm: 'auto' } }}>
        {button}
      </Button>
    </Box>
  );
}
